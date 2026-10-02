# Flujos Maestro de NIVL (build real)

Flujos de [Maestro](https://docs.maestro.dev/) portados del arnés de capturas de la rama `chore/ios-screenshots-107` para ejecutarlos contra un **build real**. El análisis completo está en [docs/qa-audit/MAESTRO-PORT.md](../../docs/qa-audit/MAESTRO-PORT.md).

**Estado: ninguno se ha ejecutado todavía.** Los selectores salen del código de `bf32d28` (labels de accesibilidad y textos) y se validó la sintaxis YAML. Falta confirmarlos en un dispositivo. Hasta que alguien los ejecute y anote build, dispositivo y resultado, la matriz los cuenta como NO PROBADO.

| Flujo | Qué comprueba | ¿Escribe en el servidor? | Cuenta |
|---|---|---|---|
| `login.yaml` | Subflujo de entrada con cuenta Franky | No (solo inicia sesión) | Prueba |
| `smoke-navegacion.yaml` | Abre las seis pestañas y hace capturas | No | Prueba con onboarding hecho |
| `health-consent.yaml` | Guardia de salud, «Ahora no», aceptación explícita y alerta de retirada (cancelada) | **Sí**: guarda el consentimiento de salud | **Solo desechable** sin consentimiento previo |
| `pro-planes.yaml` | Planes Pro/Élite con precio de tienda y enlaces legales. Nunca compra ni restaura | No | Gratuita o de prueba |

## Contra qué build se ejecutan

- `appId: com.teferi.nivl`, el de la app real (`app.json`). El arnés original usaba `com.teferi.nivl.screenshots` con fixtures: **no mezclar**.
- **iOS:** una build de simulador del SHA candidato (`npx expo run:ios --configuration Release` en macOS) o un *development build* (dev client). Las builds de TestFlight se instalan en iPhones físicos. Maestro no maneja iPhones físicos con la misma fiabilidad que el simulador; para la build de TestFlight manda la lista manual `docs/qa-audit/QA-FISICA-WINTER.csv`.
- **Android:** el APK de la pista interna o un `npx expo run:android --variant release` en emulador o en dispositivo por USB (`adb`).
- Un `npx expo export` **no** sirve: no produce binario.
- En un simulador o emulador la tienda es sandbox o no existe. Si no se cargan precios, `pro-planes.yaml` falla en la espera de «Cargando precios de la tienda». Eso **no** es un fallo de la app. Y ver los planes nunca acredita una compra.

## Cómo ejecutarlos

```bash
# Requisitos: Maestro CLI (el arnés fijaba la 2.10.0, verificada por checksum) y Java 17.
maestro --version

# 1. Iniciar sesión con una cuenta de PRUEBA (credenciales solo en la línea de órdenes)
maestro test -e NIVL_QA_EMAIL="$NIVL_QA_EMAIL" -e NIVL_QA_PASSWORD="$NIVL_QA_PASSWORD" e2e/maestro/login.yaml

# 2. Flujos de solo lectura
maestro test --test-output-dir qa-out/smoke e2e/maestro/smoke-navegacion.yaml
maestro test --test-output-dir qa-out/pro   e2e/maestro/pro-planes.yaml

# 3. Solo con una cuenta DESECHABLE sin consentimiento de salud
maestro test --test-output-dir qa-out/health e2e/maestro/health-consent.yaml
```

- Las variables `NIVL_QA_EMAIL` y `NIVL_QA_PASSWORD` se exportan en la sesión de la terminal o vienen de un gestor de secretos. **Nunca** se escriben en estos archivos, en el repo ni en los registros que se suban.
- **Cuentas:** una cuenta de prueba creada para QA. **No** usar la cuenta revisora de Apple (no se aceptan consentimientos en su nombre) ni las cinco del ludus de demostración. Para `health-consent.yaml`, una desechable que se pueda borrar después (caso O-16).
- `qa-out/` está pensado como salida local: no subir capturas con datos de cuentas.
- Anotar en `docs/qa-audit/MATRIZ-QA.md` (columna emulada o física): SHA o build, dispositivo o simulador, versión del SO, cuenta (tipo, no credenciales) y resultado.

## Qué no cubren

Compra, restauración, borrado de cuenta, denuncia y bloqueo, cierre del día, misiones enlazadas, dos dispositivos, cambio de hora y modo avión. Para eso están los casos manuales de `QA-FISICA-WINTER.csv`. Cualquier flujo nuevo que escriba en el servidor debe declararlo arriba y exigir cuenta desechable.

No hay workflow de CI para estos flujos. Añadirlo (macOS, simulador y build) es decisión del coordinador: `.github/workflows/**`, `package.json` y `metro.config.js` son suyos.

## Capturas de la App Store 1.0.8 (`capturas-108.yaml`)

Las 7 escenas de la ficha de la tienda: Hoy, Coach, Perfil, Amigos, Campañas, Agenda y NIVL Pro. Se capturan en iPhone 6,9" y iPad 13" y las lanza `.github/workflows/screenshots.yml` con `-e SLUG=iphone-69|ipad-13`. Es una propuesta del Chat 1 @`20c1861`, revisada contra `winter2/integracion` @`21764de`. **No se ha ejecutado todavía.**

- **Solo lectura:** no completa, no compra y no acepta nada. No prueba lógica: son capturas.
- **Cuenta:** solo la **cuenta demo de capturas**, sembrada con `scripts/seed-capturas.mjs`. Nunca la revisora de Apple ni una cuenta real. Las credenciales llegan solo por `-e NIVL_QA_EMAIL=… -e NIVL_QA_PASSWORD=…` (en CI, los secretos `NIVL_SHOTS_*`).
- **Login:** va dentro del flujo, no con `runFlow: login.yaml`. Los selectores de `login.yaml` pueden tocar el rótulo en vez del campo, y su `index: 1` sobre «ENTRAR» puede no existir en iOS. El detalle está en `docs/qa-audit/CAPTURAS-108.md`.
- **Maestro 2.10.0:** el workflow verifica el zip oficial con `shasum -a 256 -c`. El digest lo obtuvo el Chat 1 de la API de GitHub y el Chat 5 no lo ha verificado: hay que contrastarlo con la release oficial `cli-2.10.0` (`checksums_sha256.txt`). Nunca `curl | bash`.

Cómo ejecutarlo, qué deja la siembra, las correcciones a la propuesta y los riesgos están en [docs/qa-audit/CAPTURAS-108.md](../../docs/qa-audit/CAPTURAS-108.md).
