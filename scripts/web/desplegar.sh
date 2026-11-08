#!/usr/bin/env bash
# Despliega la app web (app.nivl.app) en el proyecto de Vercel «nivl-app».
# Guía y pasos de producción: docs/web/APP-WEB.md.
#
#   VERCEL_SCOPE=<equipo> SALIDA=/ruta/temporal scripts/web/desplegar.sh            # PREVIEW (por defecto)
#   GALERIA=1 VERCEL_SCOPE=… SALIDA=… scripts/web/desplegar.sh                      # PREVIEW con /kit (demos, sin datos)
#   PRODUCCION=1 VERCEL_SCOPE=… SALIDA=… scripts/web/desplegar.sh                   # SOLO con el OK de Teferi
#
# Solo dos variables públicas (URL y clave publicable de Supabase) desde .env:
# EXPO_NO_DOTENV evita que se cuele cualquier otra (p. ej. la clave de IA de
# desarrollo). Producción nunca lleva la galería.
set -euo pipefail
SCOPE="${VERCEL_SCOPE:?indica VERCEL_SCOPE, el equipo de Vercel}"
SALIDA="${SALIDA:?indica SALIDA, una carpeta temporal fuera del repo}"
PROYECTO="${PROYECTO:-nivl-app}"
if [ "${PRODUCCION:-0}" = "1" ] && [ "${GALERIA:-0}" = "1" ]; then echo 'La galería no va a producción: aborto'; exit 1; fi
U=$(grep -E '^EXPO_PUBLIC_SUPABASE_URL=' .env | cut -d= -f2-)
K=$(grep -E '^EXPO_PUBLIC_SUPABASE_KEY=' .env | cut -d= -f2-)
[ -n "$U" ] && [ -n "$K" ] || { echo 'Faltan EXPO_PUBLIC_SUPABASE_URL / _KEY en .env'; exit 1; }
rm -rf dist-web "$SALIDA"
# --clear: Metro guarda en caché las EXPO_PUBLIC_* ya incrustadas (ver src/lib/sitio.ts y metro.config.js).
EXPO_NO_DOTENV=1 EXPO_PUBLIC_SUPABASE_URL="$U" EXPO_PUBLIC_SUPABASE_KEY="$K" EXPO_PUBLIC_GALERIA="${GALERIA:-0}" \
  CI=true npx expo export --platform web --clear --output-dir dist-web
mkdir -p "$SALIDA" && cp -r dist-web/. "$SALIDA/"
cp scripts/web/vercel.json scripts/web/robots.txt "$SALIDA/"
# Vercel no sube carpetas llamadas node_modules: las fuentes de Expo viven en assets/node_modules.
if [ -d "$SALIDA/assets/node_modules" ]; then
  mv "$SALIDA/assets/node_modules" "$SALIDA/assets/nm"
  { grep -rl 'assets/node_modules/' --include=*.js --include=*.html --include=*.json "$SALIDA" || true; } | xargs -r sed -i 's#assets/node_modules/#assets/nm/#g'
fi
grep -rlE 'service_role|sb_secret_|sk_live_|sk_test_|sk-ant-api|sk-proj-[A-Za-z0-9]{20}|re_[A-Za-z0-9]{20}' "$SALIDA" && { echo 'Secreto en el bundle: aborto'; exit 1; } || true
# Un JWT de service_role lleva «role":"service_role» en base64 dentro del payload.
# (Con pipefail, un grep sin coincidencias no puede tumbar el script: de ahí los «|| true».)
SERVICIO=$({ grep -rhoE 'eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}' "$SALIDA" || true; } | sort -u | while read -r jwt; do
  p=$(printf '%s' "$jwt" | cut -d. -f2 | tr '_-' '/+'); while [ $(( ${#p} % 4 )) -ne 0 ]; do p="$p="; done
  if printf '%s' "$p" | base64 -d 2>/dev/null | grep -q '"role":"service_role"'; then echo x; fi
done)
[ -n "$SERVICIO" ] && { echo 'JWT de service_role en el bundle: aborto'; exit 1; } || true
# Sin scripts en línea: la CSP es script-src 'self'.
grep -qE '<script>[^<]' "$SALIDA/index.html" && { echo 'Script en línea en index.html: la CSP lo bloquearía'; exit 1; } || true
# Preview EXPLÍCITO: en un proyecto sin despliegues de producción, `vercel deploy`
# a secas manda el primero a producción (pasó el 21/10 con el primero de nivl-app).
DESTINO=(--target preview)
[ "${PRODUCCION:-0}" = "1" ] && DESTINO=(--prod)
(cd "$SALIDA" && npx --yes vercel link --yes --project "$PROYECTO" --scope "$SCOPE" >/dev/null && npx --yes vercel deploy "${DESTINO[@]}" --yes --scope "$SCOPE")
