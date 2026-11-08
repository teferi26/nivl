# Pantalla del iPhone para enlazar la TV

`confirmar-tv.tsx.plantilla` es la ruta que abre el QR de la TV (`nivl://tv/XXXX-XXXX`). Lleva la extensión `.plantilla` para que `tsc` y Metro no la recojan: la app de React Native no se toca en este frente.

## Cómo activarla

```bash
mkdir -p src/app/tv
cp tv/integracion/confirmar-tv.tsx.plantilla 'src/app/tv/[codigo].tsx'
npx expo start   # unos segundos, para regenerar las rutas tipadas; luego ciérralo
npm run typecheck && npm test && npm run lint && npx expo export --platform ios
```

Antes de publicar la OTA van las migraciones 0125, 0126 y 0127: la OTA llega en minutos y no espera al servidor.

## Lo que hay que saber

- **Es solo JS**: sale por OTA, sin binario. El esquema `nivl` ya está en `app.json`.
- **Ruta con sesión**: `src/app/_layout.tsx` no la incluye en la zona pública. Sin sesión, la puerta manda a `/login` y hay que volver a escanear al entrar.
- **Textos**: están escritos en español en la plantilla. Al activarla, pásalos al sistema `t()` si la pantalla debe ir en más idiomas.
- **Dónde gestionar las TV después**: la lista de televisores vive en esta pantalla. Si se quiere en Perfil, las RPC son `tv_mis_dispositivos()` y `tv_revocar(p_id)` (ver `tv/CONTRATO.md`).
