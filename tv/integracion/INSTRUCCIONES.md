# Pantalla del iPhone para enlazar la TV

`confirmar-tv.tsx.plantilla` es la ruta que abre el QR de la TV (`nivl://tv/XXXX-XXXX`). Lleva la extensión `.plantilla` para que `tsc` y Metro no la recojan: la app de React Native no se toca en este frente.

## Cómo activarla

```bash
mkdir -p src/app/tv
cp tv/integracion/confirmar-tv.tsx.plantilla 'src/app/tv/[codigo].tsx'
npx expo start   # unos segundos, para regenerar las rutas tipadas; luego ciérralo
npm run typecheck && npm test && npm run lint && npx expo export --platform ios
```

Antes de publicar la OTA van las migraciones 0125, 0126, 0127 y 0128: la OTA llega en minutos y no espera al servidor.

## Requisitos antes de activarla

Un enlace `nivl://tv/...` puede llegar por phishing. Sin estas dos piezas, quien pulsa «Enlazar este televisor» por error no se entera ni puede cortarlo. No se ha hecho ninguna: tocan la app de React Native y un envío.

1. **Entrada permanente en Perfil** a «Televisores enlazados», con `tv_mis_dispositivos()` y `tv_revocar(p_id)` (ver `tv/CONTRATO.md`). Hoy esa lista solo existe dentro de esta ruta, y para llegar hace falta otro enlace de TV.
2. **Aviso a la cuenta al aprobar** (push con el token de `profiles` o correo): nombre del televisor y dónde cortarlo.

## Lo que hay que saber

- **Es solo JS**: sale por OTA, sin binario. El esquema `nivl` ya está en `app.json`.
- **Ruta con sesión**: `src/app/_layout.tsx` no la incluye en la zona pública. Sin sesión, la puerta manda a `/login` y hay que volver a escanear al entrar.
- **Textos**: están escritos en español en la plantilla. Al activarla, pásalos al sistema `t()` si la pantalla debe ir en más idiomas.
- **Cambiar la contraseña desenlaza todas las TV** de la cuenta (trigger de la 0125). El cierre global de sesiones de `authFlow.ts` no las toca: si se quiere, que llame a `tv_revocar` por cada una.
- **El QR es `nivl://`**: sin la app instalada no abre nada. Para que caiga en la App Store haría falta `https://nivl.app/tv/XXXX-XXXX`, su ruta y el AASA en `nivl-web`.
