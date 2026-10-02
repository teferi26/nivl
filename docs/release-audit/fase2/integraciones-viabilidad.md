# Viabilidad de integraciones de salud y deporte (HealthKit, Health Connect, Strava)

Informe del NIVL Chat 1, fase 2. Es solo investigación: no cambia código, configuración ni la base de datos.
Fecha: 02/10/2026. Las fuentes se consultaron ese mismo día salvo que se indique otra fecha.

## Contexto verificado en el repositorio (worktree w2-chat1)

- La app usa Expo SDK 54 (`expo ~54.0.37`), React Native 0.81.5 y React 19.1.0. `app.json` declara la versión `1.0.8` y `runtimeVersion.policy = appVersion`.
- **No hay carpetas `ios/` ni `android/` en el repositorio**: los nativos salen de CNG/prebuild. Cualquier integración nativa debe ir por un config plugin y **exige un binario nuevo**, porque no puede llegar por OTA.
- iOS se compila con `.github/workflows/ios-testflight.yml`, que ejecuta `eas build --local --non-interactive` en un runner macOS. Su único secreto es `EXPO_TOKEN` y las credenciales están en EAS.
- Hoy no hay `expo-build-properties` ni `expo-auth-session` (sí `expo-web-browser`), ni entitlements de HealthKit. Android no declara `minSdkVersion`, así que usa el valor por defecto de SDK 54 (24).
- Datos de salud y ejercicio propios en la base de datos: `gym_days/gym_exercises/gym_sessions/gym_lifts/meal_slots` (0002), `body_metrics` (0007), `cardio_sessions`, `nutrition_targets`, `nutrition_logs` y `training_prescriptions` (0012) y `body_profile` (0019). El cliente usa `src/lib/bodywork.ts`.
- Hay un consentimiento de salud propio (`0030_consentimiento_salud.sql`: `health_consents`, `health_state`, `health_erasure_jobs` y la función `health-erasure`) y otro de IA con destinos (`0028`, `0029`, `0034`).
- **El coach lee todo `cardio_sessions`, `gym_sessions` y `body_metrics`** (`supabase/functions/_shared/analytics.ts:98-100`, `context.ts:198`, `recap.ts:101-102`, `tools.ts:1478-1491`). Cualquier dato importado a esas tablas acaba en el contexto de DeepSeek o Anthropic.
- Las notas a Apple de la revisión 1.0.7 (`docs/appstore-review-2026-09-29/NOTAS-APPLE.txt:24` y `RESPUESTA-APPLE.md:57`) afirman: «It does not use HealthKit».
- La idea ya figura en el backlog: INT-003 (pasos automáticos), autocompletar el gym con un workout e INT de escritura de workouts (`docs/mejoras/16-integraciones-y-widgets.md`), además de la fase 3 de `docs/ROADMAP.md`.

---

## Tabla resumen

| | Apple HealthKit | Health Connect (Android) | Strava API |
|---|---|---|---|
| **¿Viable en 1.0.8?** | Parcial: técnicamente sí, pero no es recomendable meterlo en 1.0.8 | Parcial: técnicamente sí, pero depende de la revisión de Play | **No** |
| Biblioteca | `@kingstinct/react-native-healthkit` 16.0.0 (18/09/2026, Nitro) + `react-native-nitro-modules` (≥0.35; la última es 0.37.1) | `react-native-health-connect` 4.1.3 (06/08/2026), que ya incluye el config plugin. `expo-health-connect` está **obsoleto** | Ninguna nativa: OAuth con `expo-auth-session`/`expo-web-browser` y backend en Edge Functions |
| ¿Binario nuevo? | Sí (entitlement + Info.plist + pod) | Sí (manifiesto + minSdk 26 + módulo) | No en sentido estricto, pero sí backend y webhooks nuevos |
| Paso de tienda | App Privacy (Health/Fitness), descripción e interfaz que muestren la integración (2.5.1), notas de revisión, política de privacidad y capability HealthKit en el App ID | Health apps declaration con justificación por permiso, Data safety, política de privacidad idéntica a la que muestra Health Connect y pantalla de *rationale* | Revisión de Strava para pasar de 10 atletas, suscripción de Strava del desarrollador y cumplimiento de las Brand Guidelines |
| ¿Se pueden mandar los datos al coach de IA? | Sí, con consentimiento explícito y divulgación (5.1.2(i), 5.1.3(i)); nunca para publicidad | Sí, con consentimiento explícito e informado; nunca para publicidad ni venta | **No.** La API Policy 5.3 lo prohíbe expresamente («ingestion into a context window»), incluso con el consentimiento del usuario |
| Esfuerzo estimado | 3-5 días de desarrollo + 1-2 de prueba en dispositivo y TestFlight | 3-5 días + hasta 7 días de revisión de la declaración (+5-7 días hábiles de propagación según el README de la biblioteca) | 6-10 días (OAuth, tokens en servidor, webhook, borrado, caché de 7 días) más bloqueos legales |
| Riesgo de tienda | Medio: contradice la nota «does not use HealthKit» de 1.0.7, que está en revisión. Rechazo 2.5.1 si la integración no se ve en la interfaz | Medio-alto: bloqueo de actualizaciones si la declaración no cuadra con los permisos | Alto (contractual, no de tienda): revocación del token y obligación de borrar los datos |
| **Recomendación** | **Preparar y documentar** (salir en 1.0.9/1.1 como binario dedicado) | **Preparar y documentar** (a la vez que HealthKit) | **Descartar la API.** Obtener las actividades de Strava de forma indirecta a través de Salud/Health Connect |

---

## 1. Apple HealthKit (iOS/iPadOS)

### Bibliotecas

- **`@kingstinct/react-native-healthkit` es la recomendada.**
  - Versión 16.0.0, publicada el 18/09/2026 según el registro npm. Sus peerDependencies son `react >=19`, `react-native >=0.79` y `react-native-nitro-modules >=0.35`, compatibles sobre el papel con RN 0.81.5 y React 19.1.
  - Es un módulo Nitro (JSI), pensado para la nueva arquitectura.
  - Incluye un config plugin (`packages/react-native-healthkit/app.plugin.ts`, leído en GitHub) con estas opciones:
    - `NSHealthShareUsageDescription` (lectura).
    - `NSHealthUpdateUsageDescription` (escritura; `false` la omite).
    - `background` (activo por defecto).
  - El plugin escribe `com.apple.developer.healthkit = true` y, salvo que se pase `background: false`, también `com.apple.developer.healthkit.background-delivery`.
  - Recomendación: **`background: false`** y sin `NSHealthUpdateUsageDescription` si solo se lee. Pedir solo lo mínimo reduce las preguntas de revisión.
  - No añade `UIRequiredDeviceCapabilities: healthkit`. Conviene que siga así, porque esa clave sacaría la app de los iPad que no tienen Salud.
  - Desde la 16.0.0, `@react-native-healthkit/core` es una dependencia fija y los registros clínicos van en un paquete aparte. **No se deben instalar** (exigen un entitlement de *health-records* y más escrutinio).
  - Hay que verificarlo en un dev build: que Nitro 0.37.x compile con RN 0.81.5 y con la versión de Xcode del runner (las 15.x y 16.x ya se generan contra cabeceras del SDK de iOS 27). Fijar la versión exacta en `package.json`.
- **`react-native-health` (agencyenterprise) no es recomendable.** Su última versión es la 1.19.0, de 15/10/2024: es un módulo del bridge antiguo, sin mantenimiento y solo funcionaría por la capa de interoperabilidad.

### Entitlements, capability y build en CI

- El entitlement `com.apple.developer.healthkit` obliga a tener la capability HealthKit activa en el App ID `com.teferi.nivl` y a **regenerar el perfil de aprovisionamiento**.
- EAS sincroniza las capabilities al hacer `eas build`, pero algunas operaciones necesitan autenticación de Apple local o interactiva ([Expo, iOS capabilities](https://docs.expo.dev/build-reference/ios-capabilities/)).
- El workflow actual es `--non-interactive` y solo tiene `EXPO_TOKEN`. **Es probable que la primera vez haya que ejecutar `eas credentials` o `eas build` en local con login de Apple**, o bien activar HealthKit a mano en el Developer Portal y regenerar el perfil. Dejarlo para CI sin probar puede romper la firma.

### iPad

- HealthKit tiene almacén propio en iPadOS 17 o posterior. En iPadOS 16 y anteriores, `isHealthDataAvailable()` devuelve `false`.
- `supportsTablet: true` está activo, así que la interfaz debe consultar la disponibilidad y ocultar la integración si no la hay.

### App Review (texto literal en [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/))

- **2.5.1**: HealthKit debe usarse con fines de salud y forma física e integrarse con la app Salud. La integración debe indicarse en la descripción de la app. Si el entitlement aparece y no hay una función visible que lo use, se suele rechazar.
- **5.1.1**: recogida mínima de datos y borrado de cuenta (NIVL ya lo tiene).
- **5.1.2(i)**: hay que revelar dónde se comparten datos personales con terceros, *«including with third-party AI»*, y obtener permiso explícito antes de hacerlo. Afecta directamente al coach.
- **5.1.2(vi)**: los datos de HealthKit no pueden usarse para marketing, publicidad ni minería de datos basada en el uso, tampoco por terceros.
- **5.1.3(i)**: no pueden usarse ni revelarse a terceros con fines publicitarios ni de minería de datos, salvo para mejorar la gestión de la salud o para investigación, y en ese caso solo con permiso.
- **5.1.3(ii)**: no escribir datos falsos en HealthKit y *«may not store personal health information in iCloud»*. NIVL guarda en Supabase, no en iCloud. Hay que comprobar que nada se respalde en iCloud, como el KV de AsyncStorage.
- La antigua sección «27 HealthKit» de las guías ya no existe: su contenido está repartido entre 2.5.1, 5.1.2(vi) y 5.1.3.
- La licencia del Apple Developer Program, según las fuentes secundarias consultadas (no pude leer la versión vigente del PDF), solo permite revelar datos de HealthKit a un tercero con consentimiento expreso y únicamente para que ese tercero preste servicios de salud o forma física. Un proveedor de IA que actúa como encargado del coach encaja, siempre con consentimiento expreso. **El Chat 3 debe validarlo con el texto vigente.**
- En [Protecting user privacy](https://developer.apple.com/documentation/healthkit/protecting-user-privacy), Apple exige política de privacidad y textos de uso. La app no puede saber si el usuario denegó la lectura, así que debe tolerar resultados vacíos.

### App Privacy (etiqueta nutricional)

- Apple define «Health» para incluir datos del HealthKit API y «Fitness» para los de ejercicio ([App privacy details](https://developer.apple.com/app-store/app-privacy-details/)).
- Si los datos solo se procesan en el dispositivo, no cuentan como recogidos. **Si se suben a Supabase o se mandan al coach, sí.**
- Hay que revisar que la etiqueta actual ya declare Health y Fitness vinculados al usuario y con finalidad App Functionality (y no Tracking). Si los datos de HealthKit van a la IA, la etiqueta y la política deben reflejarlo.

### Viabilidad en 1.0.8

- **Técnicamente sí; en la práctica, no conviene.**
  - 1.0.7 está en revisión con la declaración explícita de que no usa HealthKit.
  - Añadirlo en 1.0.8 obliga a cambiar a la vez los metadatos, las notas, la etiqueta de privacidad, la política, el consentimiento de salud (nueva versión de `health_consent_version`) y el de IA (nueva versión de `ai_consent_version` con la categoría «datos de Salud de Apple»).
  - Además, todo eso habría que probarlo en dispositivo físico (pendiente desde 1.0.6).
- **Diseño mínimo propuesto para 1.0.9/1.1:**
  - Solo lectura de `HKWorkout` (fuerza y cardio), `stepCount` y `bodyMass`.
  - Importación bajo demanda, en primer plano y sin background delivery.
  - Los registros se guardan en una tabla de importación con `source = 'healthkit'` y un identificador de la muestra para deduplicar.
  - El usuario confirma antes de convertir un registro en `cardio_sessions` o `body_metrics`.
  - Todo condicionado a `health_consent_ok` y con borrado por `health-erasure`.

---

## 2. Health Connect (Android)

### Biblioteca y config plugin

- **`react-native-health-connect` 4.1.3** (06/08/2026). Desde la v4 incluye la integración con Expo: ya no hay que instalar `expo-health-connect`. Ese paquete está obsoleto (su última versión, la 0.1.1, es de 31/07/2024) y, si se instala junto al otro, el build falla por una clase duplicada (README del repositorio).
  - Soporta la arquitectura antigua y la nueva.
- Requiere añadir `expo-build-properties` con `minSdkVersion: 26` y `compileSdkVersion`/`targetSdkVersion: 36`. Expo SDK 54 trae minSdk 24, así que **se dejarían de dar por soportados Android 7.x**, un impacto mínimo.
- Según la [guía oficial](https://developer.android.com/health-and-fitness/health-connect/get-started):
  - El SDK admite minSdk 26, pero Health Connect solo funciona en Android 9 o posterior.
  - En Android 14 o posterior forma parte del sistema. En Android 13 o anterior hay que instalar la app Health Connect.
  - Por defecto solo se leen 30 días anteriores a la concesión del permiso. Para leer más hace falta `READ_HEALTH_DATA_HISTORY`, que es un permiso adicional que también se declara.
- **Permisos por tipo** en `android.permissions` de `app.json`: por ejemplo `android.permission.health.READ_EXERCISE`, `READ_STEPS` y `READ_WEIGHT`. Pedir solo lo mínimo y nada en segundo plano (`READ_HEALTH_DATA_IN_BACKGROUND`), salvo que haya una función que lo justifique.
- **Actividad de *rationale* obligatoria** (privacidad):
  - El plugin v4 (leído en `app.plugin.js`) añade el intent-filter `androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE` a la `MainActivity` (hasta Android 13).
  - También añade el `activity-alias ViewPermissionUsageActivity` con `VIEW_PERMISSION_USAGE` + `HEALTH_PERMISSIONS` (Android 14 o posterior).
  - **Ese intent abre la app pero no lleva URI**, así que expo-router no sabe que tiene que mostrar la política. La guía oficial exige que esa pantalla muestre la misma política de privacidad declarada en Play Console.
  - **Pendiente de verificar en un build:** hará falta un handler (leer el intent inicial) o un pequeño config plugin propio con una actividad que abra la URL de la política.
- El delegado de permisos se registra solo en Expo: no hay que tocar `MainActivity`.

### Declaración en Play Console

- La [Health apps declaration](https://support.google.com/googleplay/android-developer/answer/14738291?hl=en) es obligatoria para todas las apps publicadas desde el 31/08/2024 (NIVL ya debería tenerla).
- Al acceder a Health Connect, en *App content* hay que justificar **cada tipo de dato** (beneficio para el usuario, por qué hace falta y alcance mínimo). Hay que volver a enviarla al añadir o quitar tipos ([Publish your health app](https://developer.android.com/health-and-fitness/health-connect/publish)).
- El antiguo formulario de Google se retiró: según el README de la biblioteca, el 03/09/2026 se cerró el que quedaba. Ahora todo pasa por Play Console.
- La política de privacidad de la ficha **debe coincidir** con la que enlaza Health Connect.
- Plazos (README de la biblioteca, no oficial): aprobación en hasta 7 días y luego 5-7 días hábiles hasta que se propaga la lista de apps permitidas. **Esto impide encajarlo en una 1.0.8 cercana.**
- Usos permitidos y prohibidos ([Android Health Permissions FAQ](https://support.google.com/googleplay/android-developer/answer/12991134?hl=en)):
  - Permitidos: «Fitness & Wellness», «Rewards Programs» (hábitos saludables) y «Health-Integrated Games» (progresión del personaje ligada a la actividad real). **Encaja con NIVL.**
  - Prohibidos: venta o transferencia a plataformas publicitarias o *data brokers*, publicidad personalizada, decisiones de crédito, seguros o empleo, y compartir con terceros sin consentimiento explícito e informado.
  - No hay una prohibición explícita de procesarlos con IA, pero la política de privacidad y la sección Data safety deben describir la transferencia al proveedor de IA. **El Chat 3 debe confirmarlo.**
- Data safety: «Health info» y «Fitness info» como recogidos y, si van al coach, compartidos o tratados por un proveedor de servicios, según cómo se clasifique al encargado.

### Viabilidad en 1.0.8

- **Parcial o no.** La integración técnica es pequeña. Pero meter los permisos `health.*` en el manifiesto obliga a tener la declaración aprobada **antes** de publicar, y esa revisión más la propagación (unas 2-3 semanas) son ajenas al equipo.
- No hay término medio: aunque la función esté detrás de un flag, si los permisos están en el manifiesto ya hay que declararlos.

---

## 3. Strava API

### Técnica

- **OAuth 2.0** ([Authentication](https://developers.strava.com/docs/authentication/)):
  - Endpoints: `https://www.strava.com/oauth/mobile/authorize` en móvil (o `/oauth/authorize` en web) y `POST /oauth/token` para el canje.
  - El canje y el refresco **requieren `client_secret`**, así que deben hacerse en una Edge Function, nunca en la app. La documentación no menciona PKCE.
  - Los access tokens caducan a las 6 h. El refresh token rota en cada canje y el anterior deja de valer.
  - Revocación con `POST /oauth/revoke`.
  - Flujo en la app: `expo-web-browser`/`expo-auth-session` con redirect `nivl://strava` (el esquema `nivl` ya existe). Se puede abrir con `strava://` si la app de Strava está instalada.
- **Scopes:** `read`, `read_all`, `profile:read_all`, `profile:write`, `activity:read` (actividades visibles, sin zonas de privacidad), `activity:read_all` (incluye las de «solo tú») y `activity:write`. Bastaría `activity:read`.
- **Límites** ([Rate limits](https://developers.strava.com/docs/rate-limits/)):
  - Globales: 200 peticiones cada 15 min y 2.000 al día.
  - Sin subida: 100 cada 15 min y 1.000 al día.
  - Una app nueva solo admite 1 atleta (o 10 con el ajuste propio del nivel Standard).
- **Niveles de acceso** ([API Policy 2026](https://www.strava.com/legal/api_policy) §3.3 y [anuncio en Community Hub](https://communityhub.strava.com/insider-journal-9/an-update-to-our-developer-program-13428)):
  - Standard: hasta 10 atletas, o hasta 9.999 tras revisión.
  - Extended Access: 10.000 o más, caso por caso.
  - El nivel Standard **exige una suscripción de pago a Strava** (desde el 01/06/2026 para desarrolladores nuevos y desde el 30/06/2026 para los existentes).
  - La admisión y las ampliaciones son discrecionales y sin plazo garantizado (§3.6).
- **Webhooks** ([Webhooks](https://developers.strava.com/docs/webhooks/)):
  - Una suscripción por app. Hay que validar el `hub.challenge` y responder 200 en menos de 2 s; Strava reintenta hasta 3 veces.
  - Eventos `activity` o `athlete` de tipo `create`, `update` o `delete`. La desautorización llega con `updates.authorized = "false"`.
  - Se puede implementar como una Edge Function nueva.

### Contrato: [API Agreement](https://www.strava.com/legal/api) y [API Policy](https://www.strava.com/legal/api_policy), ambos con fecha efectiva 01/06/2026

Este es el punto decisivo.

- **§5.3, prohibición de IA:** «You may not use the Strava API Materials or Strava Data, directly or indirectly, in connection with the development, training, evaluation, or operation of any AI Application».
  - La lista incluye expresamente *grounding*, RAG e **«ingestion into a context window or working memory»**.
  - Se extiende a los datos derivados, agregados o anonimizados y a la salida de los modelos.
  - **Enviar actividades de Strava (o XP, resúmenes o métricas derivadas) al coach de DeepSeek o Anthropic está prohibido**, aunque el usuario consienta.
- **§5.10:** prohíbe poner los datos de Strava a disposición de terceros, incluidos *«AI Application providers, or model developers — even if a user of your Developer Application consents»*.
- **§2.3 y §6.1:** los datos de un usuario solo pueden mostrarse a ese mismo usuario. **Afecta a amigos, ludus, rankings y tarjetas compartibles**: los datos derivados de Strava no pueden aparecer ahí.
- **§5.4:** prohíbe analítica o mejora de producto con datos de Strava y prohíbe **combinarlos con otros datos del cliente**. Mezclarlos en `cardio_sessions` con las tendencias y el XP de NIVL es, como mínimo, discutible.
- **§5.5, §5.7 y §6.2:** caché transitoria de un máximo de **7 días**. Fuera de esa caché no se pueden almacenar datos de Strava ni sus derivados. **NIVL no podría persistir el historial importado de Strava**, que es justo lo que necesita una racha o un registro de cardio.
- **§6.3:** reflejar en menos de 48 h las actividades borradas en Strava.
- **§2.5 y §7.4:** borrar todo cuando el usuario lo pida o revoque el acceso (como máximo en 30 días) y confirmárselo por escrito.
- **§5.8:** no se puede cobrar por funciones basadas en la API. **No se puede poner detrás de NIVL Pro o Élite.**
- **§2.1 y §7.2:** consentimiento con contenido mínimo: tipos de datos, método, cómo retirarlo, cómo pedir el borrado y confirmación del borrado.
- **§6.5:** hay que incluir en la política de privacidad una declaración sobre los Usage Data de Strava.
- **§8.3:** notificar las brechas a Strava en menos de 24 h.
- **Marca** ([Brand Guidelines](https://developers.strava.com/guidelines/), revisadas el 29/09/2025): botón oficial «Connect with Strava», enlaces «View on Strava» y logotipos «Powered by Strava» o «Compatible with Strava», sin dar a entender aval y sin usar «Strava» en el nombre ni en el icono.

### Viabilidad en 1.0.8

**No.**
- El modelo de NIVL (coach de IA, persistencia, XP, social y funciones de pago) choca con §5.3, §5.4, §5.8, §6.1 y §6.2.
- Una integración que cumpla el contrato quedaría reducida a esto: mostrar al usuario sus actividades de los últimos 7 días, sin coach, sin guardarlas, sin XP persistente y gratis. Además, solo para 10 atletas hasta que Strava la revise, y con suscripción de pago para el desarrollador.

### Alternativa recomendada

- Strava escribe sus actividades en Salud de Apple (rutas, tipo, distancia, tiempo y calorías) y en Health Connect en Android ([Strava Support, Health App and Strava](https://support.strava.com/hc/en-us/articles/216917527-Health-App-and-Strava)).
- Si el usuario activa esa sincronización, NIVL las recibe **a través de HealthKit o Health Connect**, con las reglas de Apple y Google y no con las de la API de Strava.
- Hay que decir «importa tus entrenos desde Salud o Health Connect», sin usar la marca Strava.
- **El Chat 3 debe validar con un abogado** que los datos que llegan por esta vía no se consideran «Strava Data». Lo razonable es que no, porque no se obtienen de los materiales de la API.

---

## 4. Privacidad y consentimiento (para el Chat 3)

1. **Nueva versión del consentimiento de salud** (`health_consent_version`): debe recoger la fuente («Salud de Apple» o «Health Connect»), los tipos concretos, la retirada (desde la app y desde los ajustes del sistema) y el borrado. Si se retira, `health-erasure` debe borrar también los datos importados.
2. **Nueva versión del consentimiento de IA** (`ai_consent_version`, que hoy es `2026-09-29`): si los datos importados llegan al coach, hay que nombrar la categoría y los destinos (DeepSeek y su país de tratamiento, Anthropic) según 5.1.2(i). Las categorías especiales del art. 9 del RGPD exigen consentimiento explícito.
3. **Separación técnica:** hay que añadir una columna `source` a `cardio_sessions` y a `body_metrics` (o tablas de importación aparte). Así se puede filtrar en `analytics.ts`, `context.ts`, `recap.ts` y `tools.ts` si el usuario acepta la importación pero no su envío a la IA. **Es imprescindible si algún día entra cualquier dato de la API de Strava.**
4. Actualizar la política de privacidad, App Privacy, Data safety y las notas de revisión de Apple, que hoy dicen «does not use HealthKit».
5. Nada de iCloud ni de publicidad con estos datos. Tampoco mostrarlos a los amigos sin una opción explícita por función.

## 5. Dependencias nuevas, por integración

- **HealthKit:** `@kingstinct/react-native-healthkit` (exacta, 16.0.0 o la última validada) y `react-native-nitro-modules`. El plugin se configura en `app.json` con `background: false`.
- **Health Connect:** `react-native-health-connect` ^4.1.3 y `expo-build-properties` (SDK 54). Además, permisos `android.permission.health.*` y, probablemente, un pequeño config plugin propio para la pantalla de *rationale*.
- **Strava (descartada):** `expo-auth-session`, dos Edge Functions (canje y refresco de token, webhook), una tabla de tokens cifrados y un job de purga a 7 días.

## Recomendación

| Integración | Decisión |
|---|---|
| HealthKit | **Preparar y documentar** en 1.0.8 (diseño, textos, consentimientos y declaraciones). Implementar en el siguiente binario, una vez cerrada la revisión de 1.0.7 y con pruebas en dispositivo |
| Health Connect | **Preparar y documentar.** Enviar la declaración de Play al empezar la implementación para absorber las 2-3 semanas de revisión |
| Strava API | **Descartar.** Cubrir el caso «tengo mis carreras en Strava» con HealthKit y Health Connect |

## Fuentes (consultadas el 02/10/2026)

- npm registry: `@kingstinct/react-native-healthkit` (16.0.0, 18/09/2026), `react-native-nitro-modules` (0.37.1), `react-native-health` (1.19.0, 15/10/2024), `react-native-health-connect` (4.1.3, 06/08/2026), `expo-health-connect` (0.1.1, 31/07/2024). URL: https://registry.npmjs.org/
- https://github.com/kingstinct/react-native-healthkit (README, `packages/react-native-healthkit/app.plugin.ts`, `packages/core/src/plugin/index.ts` y notas de la versión 16.0.0)
- https://github.com/matinzd/react-native-health-connect (README, `app.plugin.js`, `docs/docs/permissions.md`)
- https://docs.expo.dev/build-reference/ios-capabilities/
- https://developer.apple.com/app-store/review/guidelines/ (2.5.1, 5.1.1, 5.1.2(i), 5.1.2(vi), 5.1.3)
- https://developer.apple.com/app-store/app-privacy-details/
- https://developer.apple.com/documentation/healthkit/protecting-user-privacy
- https://developer.apple.com/forums/thread/740657 (HealthKit en iPad) y búsqueda sobre la disponibilidad en iPadOS 17
- https://developer.android.com/health-and-fitness/health-connect/get-started
- https://developer.android.com/health-and-fitness/health-connect/publish
- https://support.google.com/googleplay/android-developer/answer/14738291?hl=en
- https://support.google.com/googleplay/android-developer/answer/12991134?hl=en
- https://www.strava.com/legal/api (API Agreement, en vigor desde el 01/06/2026)
- https://www.strava.com/legal/api_policy (API Policy, en vigor desde el 01/06/2026: §2, §3, §5.3, §5.4, §5.8, §5.10, §6, §7)
- https://developers.strava.com/docs/authentication/
- https://developers.strava.com/docs/rate-limits/
- https://developers.strava.com/docs/webhooks/
- https://developers.strava.com/guidelines/ (revisadas el 29/09/2025)
- https://communityhub.strava.com/insider-journal-9/an-update-to-our-developer-program-13428
- https://support.strava.com/hc/en-us/articles/216917527-Health-App-and-Strava

Limitaciones:
- No pude leer el PDF vigente de la licencia del Apple Developer Program. Lo que se dice de su cláusula sobre HealthKit viene de fuentes secundarias.
- No compilé ni probé ninguna biblioteca. Las compatibilidades se basan en peerDependencies y en la documentación.
