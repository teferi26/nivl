# Arnés Maestro de `chore/ios-screenshots-107`: evaluación y port

Chat 5, 02/10/2026. Leído con `git show chore/ios-screenshots-107:<ruta>` sin cambiar de rama. Último commit de la rama: `41d346f3` (28/09/2026). Base actual: `bf32d28`.

## Qué es

Un arnés para hacer **capturas y QA visual en un simulador iOS** con la interfaz nativa real, pero **sin servidor, cuentas ni tienda**. Archivos en `scripts/screenshots/`:

| Archivo | Función |
|---|---|
| `README.md` | Describe el arnés. Escenario vigente: QA del consentimiento de salud |
| `prepare.mjs` | Exige `EXPO_PUBLIC_SCREENSHOT_MODE=1` y rechaza si hay `EXPO_TOKEN` o claves de Supabase. **Comprueba que `src/`, `assets/` y `package-lock.json` sean idénticos a `112109db`** (código de la build 18). Reescribe `package.json` (`main` → `scripts/screenshots/entry.js`) y `app.json` (bundle `com.teferi.nivl.screenshots`, esquema `nivl-capture`, sin Updates, sin dominios asociados) y escribe `provenance.json` |
| `entry.js` / `bootstrap.js` | Entrada alternativa. Fija el reloj en el 28/09/2026 a las 09:41, bloquea `fetch`, `XMLHttpRequest` y `WebSocket`, y activa la oferta Pro con el enlace `nivl-capture://pro` |
| `fixtures.ts` | Datos ficticios: «Alex» con 9.450 XP, 6 misiones e historial, plan, amigos, dinero y conversación de ejemplo |
| `purchases.ts` | Sustituye `react-native-purchases`: catálogo de 5 productos con precio fijo; **comprar y restaurar siempre fallan** |
| `notifications.ts` | Sustituye `expo-notifications`: permiso denegado y nada programado |
| `supabase.ts`, `fetch.ts` | (No pedidos; existen en la rama.) Sustituyen el cliente Supabase y `expo/fetch` por adaptadores locales que rechazan lo desconocido |
| `health-consent.yaml` | Flujo Maestro de consentimiento de salud (capturas 20–28) |
| `marketing.yaml` | Flujo de capturas de tienda (Hoy, misiones, agenda, coach, gimnasio, dinero, amigos, ranking, avances, hábitos) |
| `pro-review.yaml` | Capturas de los 5 planes con precios fijos, sin tocar compra |
| `capture.sh` | Descarga Maestro CLI 2.10.0 con checksum, elige un simulador iPhone Pro Max, modo oscuro, barra 9:41, instala la `.app`, ejecuta `health-consent.yaml` y calcula SHA-256 y dimensiones |
| `metro.config.js` (raíz de esa rama) | Con `EXPO_PUBLIC_SCREENSHOT_MODE=1` redirige `expo-notifications`, `expo/fetch`, `react-native-purchases` y `src/lib/supabase.ts` a los adaptadores |
| `.github/workflows/ios-screenshots.yml` | `macos-15` + Xcode estable + `npm ci` + `prebuild` + `pod install` + `xcodebuild` Release para simulador, sin firma, con caché de la `.app`. Ejecuta `capture.sh` y sube el artefacto 7 días. Permisos de solo lectura y sin secretos |

## Qué requiere

- **macOS con Xcode y un simulador iPhone.** No se puede ejecutar en el Windows de este equipo. En CI usa un runner `macos-15`, gratuito mientras el repo sea público.
- **`metro.config.js`**: la base `bf32d28` no tiene ninguno, y el resolvedor de fixtures depende de él. Es configuración compartida de Metro, **propiedad del coordinador**.
- **Workflow propio** (`.github/workflows/ios-screenshots.yml`) y la reescritura de `package.json`/`app.json` en el runner: también del coordinador.
- **Reescribir `prepare.mjs`** para la base nueva. Hoy se niega a ejecutarse si `src/` difiere de `112109db`, y en `bf32d28` difiere (todas las correcciones de la build 20).
- **Actualizar los fixtures**: el esquema y las pantallas cambiaron desde `112109db` (consentimiento 2026-09-29, reconciliación de compras, controles sociales). Un adaptador que rechaza toda llamada desconocida hará fallar cualquier pantalla que use una RPC nueva.

## Qué prueba realmente y qué no

**Prueba:**

- Que los componentes nativos reales de `112109db` se pintan en iOS Release en simulador con unos datos dados.
- Que la UI del consentimiento de salud se comporta como se espera **en esa versión**: casilla desmarcada, botón deshabilitado, «Ahora no» sin bloquear, aceptación, alerta de retirada cancelada.
- Que los planes muestran sus etiquetas de accesibilidad y la selección.

**No prueba:**

- **El binario actual.** Los fixtures y la comprobación de `112109db` hacen que lo que se prueba sea la build 18, no la 20 ni el SHA de Winter Arc. **Fixtures viejos ≠ binario actual.**
- Servidor, RLS, RPC de economía, cierre del día ni concurrencia: Supabase está sustituido.
- Compras: `purchases.ts` es un mock y comprar o restaurar siempre falla. **No acredita una compra sandbox.**
- Precios reales de StoreKit (los fija el fixture), notificaciones reales, permisos nativos, red, Expo Updates ni firma o instalación desde TestFlight.
- El dispositivo físico ni el «último iOS» que pide Apple: un simulador no sirve para el vídeo.

Conclusión: el arnés es útil para **capturas y QA visual reproducible**, no como evidencia de release. Su resultado (`healthConsentStatus=0` en `provenance.json`) cuenta como evidencia **emulada** de `112109db`, nunca de `bf32d28` ni de la build 20.

## Qué se ha portado

Los YAML se pueden portar **sin fixtures** si se quitan los textos que solo existen en los datos ficticios y los precios fijos. Se han copiado adaptados a `e2e/maestro/` (ver su [README](../../e2e/maestro/README.md)):

| Original | Port | Cambios |
|---|---|---|
| — | `login.yaml` | Nuevo subflujo. Credenciales solo por `-e NIVL_QA_EMAIL/NIVL_QA_PASSWORD` |
| `marketing.yaml` | `smoke-navegacion.yaml` | Sin «Buenos días, Alex», «Ejemplo», «Abrir Gym» ni «Avanzar en mi proyecto» (fixtures). Recorre las 6 pestañas reales. Solo lectura |
| `health-consent.yaml` | `health-consent.yaml` | `appId` real. Sin textos de fixtures. **Advierte que la aceptación escribe en el servidor real** y exige cuenta desechable. Retirada solo hasta «Cancelar» |
| `pro-review.yaml` | `pro-planes.yaml` | Precios con patrón genérico (`.+`), porque los da la tienda. Entrada por Perfil → «NIVL Pro». Fundador opcional (`runFlow when`). Comprueba la presencia de «Términos de uso» y «Política de privacidad». Nunca pulsa comprar, restaurar ni la prueba gratuita |

Todos los textos usados se comprobaron por `grep` en `bf32d28` (`login.tsx`, `ConsentimientoSalud.tsx`, `healthmath.ts`, `coach.tsx`, `ProOffer.tsx`, `proplans.ts`, `perfil.tsx`, `(tabs)/_layout.tsx`). La sintaxis YAML se validó con `js-yaml`. **No se han ejecutado**: no hay macOS ni simulador en este equipo, y no se usaron credenciales.

No se portaron `capture.sh`, `prepare.mjs`, `bootstrap.js`, `entry.js` ni los adaptadores: solo tienen sentido con fixtures, `metro.config.js` y su workflow, que son del coordinador.

## Recomendación al coordinador

1. **Para el reenvío a Apple, el arnés no aporta evidencia.** Hace falta la grabación física (QA-FISICA-WINTER.md) con la build final.
2. Si se quieren capturas nuevas de tienda con la UI de Winter Arc: rehacer `prepare.mjs` contra el SHA final, regenerar fixtures con el esquema vigente y añadir `metro.config.js` y el workflow en la integración. Es trabajo de capturas, no de QA de release.
3. Para regresión de UI emulada, preferir los flujos de `e2e/maestro/` contra una build de simulador del SHA candidato con una cuenta desechable de un entorno de pruebas. Se pueden integrar en CI macOS solo si existe un entorno Supabase de pruebas: no lanzarlos contra producción desde CI.
