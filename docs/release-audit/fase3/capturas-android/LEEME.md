# Capturas de Android para Google Play (PROPUESTA al coordinador)

**Qué hay:** `screenshots-android.yml.propuesta`. Es el gemelo de `.github/workflows/screenshots.yml`, pero en un emulador Android. Usa el mismo flujo de Maestro (`e2e/maestro/capturas-108.yaml`), la misma cuenta demo de capturas y los mismos secretos. No sube nada a Google y no publica OTA.

**Para activarlo (lo hace el coordinador):**

1. Añadir Android al perfil `screenshots` de `eas.json`:

   ```json
   "screenshots": {
     "extends": "base",
     "distribution": "internal",
     "channel": "production",
     "environment": "production",
     "ios": { "simulator": true, "buildConfiguration": "Release" },
     "android": { "buildType": "apk" }
   }
   ```

   Después, comprobarlo sin gastar build:

   ```bash
   npx eas-cli config --platform android --profile screenshots
   ```

2. Copiar la propuesta a `.github/workflows/screenshots-android.yml` y lanzarla a mano desde Actions con `ref = winter2/integracion`.

**Por qué 1080 × 1920 y no el Pixel 7:** Play rechaza las capturas cuyo lado largo pase del doble del corto. 2400 / 1080 = 2,22, así que no vale. 1920 / 1080 = 1,78 sí vale.

**NO PROBADO:**

- No se ha ejecutado nunca. Hay que revisar la primera pasada.
- **Escena 07 (NIVL Pro).** En el emulador no hay cuenta de Play, así que lo más probable es que no carguen los precios. Si sale «Las compras no están disponibles» o la oferta sin precios, esa captura **no se usa**: Play no exige capturas del paywall.
- **Escena 04 (amigos).** El flujo de Maestro se revisó con rótulos de iOS. Si en Android no encuentra un rótulo, el Chat 5 ajusta el flujo.

**Escenas para la ficha:**

- **Hoy.**
- **Coach**, con el rótulo «Con NIVL Pro o Élite».
- **Perfil.**
- **Amigos.**
- **Campañas.**
- **Agenda.**

Mínimo 2 y máximo 8. Para que la app pueda salir en las recomendaciones de Play hacen falta al menos 4.
