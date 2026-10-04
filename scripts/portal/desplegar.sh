#!/usr/bin/env bash
# Despliega el portal de creadores (creadores.nivl.app) en el proyecto Vercel «nivl-creadores».
# Solo tres variables públicas (informe docs/security-audit/portal-creadores.md, R5): nada de .env.
# Uso: SALIDA=/ruta/temporal scripts/portal/desplegar.sh   (desde la raíz del repo)
set -euo pipefail
SCOPE="${VERCEL_SCOPE:?indica VERCEL_SCOPE, el equipo de Vercel del proyecto nivl-creadores}"
SALIDA="${SALIDA:?indica SALIDA, una carpeta temporal fuera del repo}"
U=$(grep -E '^EXPO_PUBLIC_SUPABASE_URL=' .env | cut -d= -f2-)
K=$(grep -E '^EXPO_PUBLIC_SUPABASE_KEY=' .env | cut -d= -f2-)
rm -rf dist-creadores "$SALIDA"
EXPO_NO_DOTENV=1 EXPO_PUBLIC_SUPABASE_URL="$U" EXPO_PUBLIC_SUPABASE_KEY="$K" EXPO_PUBLIC_SITIO=creadores \
  CI=true npx expo export --platform web --clear --output-dir dist-creadores
mkdir -p "$SALIDA" && cp -r dist-creadores/. "$SALIDA/"
cp scripts/portal/vercel.json scripts/portal/robots.txt "$SALIDA/"
# Vercel no sube carpetas llamadas node_modules: las fuentes de Expo viven en assets/node_modules.
if [ -d "$SALIDA/assets/node_modules" ]; then
  mv "$SALIDA/assets/node_modules" "$SALIDA/assets/nm"
  grep -rl 'assets/node_modules/' --include=*.js --include=*.html --include=*.json "$SALIDA" | xargs -r sed -i 's#assets/node_modules/#assets/nm/#g'
fi
grep -rlE 'service_role|sb_secret_|sk_live_|sk_test_|re_[A-Za-z0-9]{20}' "$SALIDA" && { echo 'Secreto en el bundle: aborto'; exit 1; } || true
# Un JWT de service_role lleva «role":"service_role» en base64 dentro del payload.
grep -rhoE 'eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}' "$SALIDA" | sort -u | while read -r jwt; do
  p=$(printf '%s' "$jwt" | cut -d. -f2 | tr '_-' '/+'); while [ $(( ${#p} % 4 )) -ne 0 ]; do p="$p="; done
  printf '%s' "$p" | base64 -d 2>/dev/null | grep -q '"role":"service_role"' && { echo 'JWT de service_role en el bundle: aborto'; exit 1; }
done
(cd "$SALIDA" && npx --yes vercel link --yes --project nivl-creadores --scope "$SCOPE" >/dev/null && npx --yes vercel deploy --prod --yes --scope "$SCOPE")
