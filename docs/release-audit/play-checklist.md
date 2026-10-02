# Google Play · Checklist de lanzamiento Android (NIVL)

> **Actualización del 02/10/2026:** el usuario ha decidido eliminar el puente de Franky; NIVL tendrá su propio Supabase Auth. Las menciones a Franky de este documento (proveedor de identidad, datos enviados a Franky al registrarse, cuenta que sobrevive al borrado) dejan de aplicar a la build que la integre. Las declaraciones finales no deben incluir Franky como destinatario, salvo que el Chat 3 confirme que queda alguna migración o puente para cuentas antiguas.

Redactado el 02/10/2026 por el subagente (b) Google Play/Android del Chat 1 · Tiendas. Base: rama `winter/chat1-tiendas` @ `bf32d28`.
Solo lectura de código y de fuentes oficiales. **No se ha abierto Play Console, no se ha compilado ningún AAB y no se ha probado nada en un Android físico.** Todo lo que depende de eso figura como NO PROBADO.

Leyenda: **PASS** (comprobado en el repo o en una fuente) · **FAIL** (falta o contradice un requisito) · **NO PROBADO** (no se puede acreditar sin build, consola o dispositivo) · **NO APLICABLE**.
Dueños: **Coordinador** (app.json, eas.json, CI, consolas con el usuario) · **Chat 2** (pagos) · **Chat 3** (datos/servidor) · **Chat 4** (web) · **Usuario** (cuentas, pagos y firmas legales).

## 0. Rastro previo de Play Console

- En el repo, en `privado/` y en `coordinacion-winter-arc/` **no hay ningún rastro de Play Console**: no figuran ficha, pista interna, cuenta de servicio, Data Safety ni capturas de Play. Lo único Android que existe es lo siguiente:
  - `app.json:24-51` (bloque `android`) y `eas.json:41` (`app-bundle` en `production`).
  - `privado/estado-1.0.7-verificado.md:86`: «Android 8/15» builds de EAS consumidos en el ciclo del 01/09 al 01/10/2026. **Hubo builds Android en EAS**, así que es probable que EAS ya haya generado un keystore gestionado. No se ha verificado (sería necesario `eas credentials -p android`, que se hace con el usuario).
  - `nivl-web/.well-known/assetlinks.json`, publicado en `https://nivl-web.vercel.app/.well-known/assetlinks.json` (200, `application/json`, comprobado el 02/10/2026) con `"sha256_cert_fingerprints": ["PENDIENTE_SHA256_FINGERPRINT"]`.
  - `.env.example` declara `EXPO_PUBLIC_RC_ANDROID_KEY` (RevenueCat `goog_…`). No consta que esté creada en EAS.
- Conclusión: **la cuenta de desarrollador de Google Play no está acreditada.** Es el primer bloqueo externo.

## 1. Identidad del binario

| # | Punto | Estado | Evidencia | Acción · dueño |
|---|---|---|---|---|
| 1.1 | Package / applicationId `com.teferi.nivl` | PASS | `app.json:25`. Coincide con iOS `bundleIdentifier` (`app.json:12`) y con `assetlinks.json`. | Es **inmutable** una vez creada la app en Play. Confirmar con el usuario antes de crearla. · Coordinador |
| 1.2 | versionName | PASS | `app.json:5` → `1.0.7`. `runtimeVersion.policy = appVersion` (`app.json:97`): las OTA van atadas a 1.0.7. | Ninguna. |
| 1.3 | versionCode | PASS (configuración) / NO PROBADO (valor) | `eas.json:4` `appVersionSource: remote` + `eas.json:34` `autoIncrement: true`. EAS lleva el contador en remoto. | Comprobar con `eas build:version:get -p android` qué versionCode toca. Play rechaza los códigos repetidos o menores. · Coordinador |
| 1.4 | Formato AAB | PASS | `eas.json:41` `buildType: app-bundle` en `production`. Los perfiles `development` y `preview` generan APK (`eas.json:20,29`), que **no se sube a Play**. | Ninguna. |
| 1.5 | Firma: keystore gestionado por EAS + Play App Signing | NO PROBADO | No hay keystore en el repo (correcto). Que haya builds Android previos indica que probablemente ya hay credenciales en EAS. | Con el usuario: `eas credentials -p android` → anotar solo las **huellas** SHA-1/SHA-256 de la clave de subida (no exportar el keystore). Al crear la app en Play, aceptar **Play App Signing** (obligatorio para AAB). La clave EAS pasa a ser la *upload key*. · Coordinador + Usuario |
| 1.6 | Subida y pista interna | FAIL (no configurado) | `eas.json:45-52`: `submit.production` solo tiene `ios`. No existe workflow Android en `.github/workflows/` (solo `ci.yml` e `ios-testflight.yml`). | **La primera subida del AAB a Play se hace a mano en Play Console** (la API no puede crear la primera versión). Después, PROPUESTA de diff en §11. Cuenta de servicio de Google guardada **en EAS** (`eas credentials`), nunca en el repo público. · Coordinador + Usuario |

## 2. SDK, API objetivo y librerías nativas

| # | Punto | Estado | Evidencia | Acción · dueño |
|---|---|---|---|---|
| 2.1 | Requisito vigente de API objetivo de Play | PASS (por configuración de Expo) | Fuente: https://developer.android.com/google/play/requirements/target-sdk (consultada el 02/10/2026): «Starting August 31 2026: New apps and app updates must target Android 16 (API level 36) or higher». Prórroga posible hasta el 01/11/2026. | Ninguna, si el AAB sale de Expo SDK 54 sin sobrescribir `targetSdkVersion`. |
| 2.2 | compileSdk / targetSdk / minSdk efectivos | PASS (documental) / NO PROBADO (AAB) | `package.json:12` `expo ~54.0.37`, `package.json:33` `react-native 0.81.5`. Fuente: https://docs.expo.dev/versions/v54.0.0/ (02/10/2026): SDK 54 → `compileSdkVersion 36`, `targetSdkVersion 36`, Android 7+ (**minSdk 24**). No hay `expo-build-properties` que lo cambie. `node_modules` no está en el worktree, así que no se ha ejecutado `expo config`. | Tras el primer AAB, verificar en Play Console → App bundle explorer: target 36, min 24. · Coordinador |
| 2.3 | Consecuencias de target 36 (Android 16) | NO PROBADO | Fuente: https://developer.android.com/about/versions/16/behavior-changes-16 (02/10/2026). (a) **Edge-to-edge obligatorio**, sin opción de desactivarlo. (b) En pantallas con `sw ≥ 600dp` se **ignoran** `screenOrientation`, `resizableActivity` y las relaciones de aspecto: `orientation: "portrait"` (`app.json:6`) no se respeta en tablets ni en plegables abiertos. La desactivación temporal `PROPERTY_COMPAT_ALLOW_RESTRICTED_RESIZABILITY` dejará de valer con API 37. | Probar insets (barra de gestos y teclado) en un Android 15/16 real y el apaisado en tablet o plegable. Ver `matriz-dispositivos.md`. · Coordinador (QA) |
| 2.4 | Play Billing Library vigente | PASS (documental) | `package.json:35` `react-native-purchases ^10.10.2`. Fuente de Google: https://developer.android.com/google/play/billing/deprecation-faq (02/10/2026): PBL 7 tenía de plazo el 31/08/2026 (prórroga hasta el 01/11/2026), así que **hace falta PBL 8 o superior**. RevenueCat: react-native-purchases v10 incluye PBL 8 (https://www.revenuecat.com/blog/engineering/google-play-billing-v8). | Confirmar en el AAB (dependencia `com.android.billingclient:billing:8.x`). · Chat 2 |
| 2.5 | Páginas de memoria de 16 KB | PASS (documental) / NO PROBADO | Fuente: https://developer.android.com/guide/practices/page-sizes (02/10/2026): las apps con target ≥ 35 deben admitir 16 KB, y desde el 01/02/2027 no se podrán publicar actualizaciones que no lo hagan. RN ≥ 0.77 ya es compatible (https://reactnative.dev/blog/2025/08/12/react-native-0.81). No hay librerías NDK propias. | Revisar el aviso de 16 KB en Play Console → App bundle explorer tras la primera subida. · Coordinador |
| 2.6 | Health Connect | NO APLICABLE | No hay ninguna dependencia de Health Connect ni de Google Fit en `package.json`. Los datos de salud se introducen a mano (`src/lib/health.ts`, `src/lib/progress.ts:8`). | Aun así hay que rellenar la **Health apps declaration** (§7.5). |
| 2.7 | Notificaciones push remotas (FCM) | FAIL | `src/lib/push.ts:30` llama a `getExpoPushTokenAsync`. En Android eso exige Firebase (`google-services.json` + credencial FCM v1 en EAS). `app.json` no tiene `android.googleServicesFile` y en el repo no hay rastro de FCM. El `catch` silencioso (`push.ts:46-49`) evita el cierre de la app, pero **en Android no se registra ningún token** y el coach no puede enviar push. | Crear un proyecto Firebase, subir la clave FCM v1 a EAS y añadir `googleServicesFile` (diff en §11). Las notificaciones locales (`src/lib/notifications.ts`) no dependen de esto. · Coordinador + Usuario |

## 3. Permisos del manifiesto

Declarados en `app.json:41-50` (con **duplicados**: `POST_NOTIFICATIONS` y `SCHEDULE_EXACT_ALARM` aparecen dos veces, y también `RECORD_AUDIO` en `blockedPermissions`). Son inocuos, pero hay que limpiarlos (§11).
Los permisos que añaden las librerías se han leído de sus manifiestos publicados en unpkg el 02/10/2026. **Hay que confirmarlo en el manifiesto final del AAB** (App bundle explorer o `aapt dump permissions`).

| Permiso | Origen | Justificación en NIVL | ¿Declaración en Play? | Estado |
|---|---|---|---|---|
| `INTERNET`, `ACCESS_NETWORK_STATE` | RN / Expo | Supabase, IA, RevenueCat | No | PASS |
| `POST_NOTIFICATIONS` | `app.json:42` + expo-notifications | Avisos de las 8:00 y de cierre a las 21:30, y recordatorios de bloque (`notifications.ts:179-302`) | No (permiso de tiempo de ejecución) | PASS |
| `RECEIVE_BOOT_COMPLETED` | expo-notifications 0.32.17 (manifiesto) | Reprogramar las locales tras reiniciar | No | PASS |
| `SCHEDULE_EXACT_ALARM` | `app.json:43` | Avisos a hora exacta (DAILY/DATE en `notifications.ts:189,244,265,302`) | **No** se declara (lo que tiene formulario y revisión es `USE_EXACT_ALARM`, que NIVL no usa). Fuente: https://support.google.com/googleplay/android-developer/answer/9888170 y https://developer.android.com/about/versions/14/changes/schedule-exact-alarms (02/10/2026) | PASS (política) / NO PROBADO (funcionamiento): desde Android 14 viene **denegado por defecto** y la app no lo pide en ninguna pantalla, así que la hora exacta no está garantizada. Probar la de las 21:30 en Android 14+. · Coordinador (QA) |
| `CAMERA` | expo-image-picker (manifiesto) + plugin (`app.json:68-73`) | Fotos de evidencia (`(tabs)/index.tsx:201-206`, `diario.tsx:273-278`, `gym.tsx:328-333`) | No | PASS |
| `READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE` | expo-image-picker 17.0.11 (manifiesto) | La galería usa el selector del sistema (`launchImageLibraryAsync`, `perfil.tsx:231`, `coach.tsx:248`). Con target 36 estos permisos no surten efecto en Android 13+ | No (la política de fotos y vídeos afecta a `READ_MEDIA_IMAGES/VIDEO`, que NIVL **no** declara) | PASS / P2: valorar bloquearlos tras probar en Android 7-12 (§11) |
| `RECORD_AUDIO` | bloqueado (`app.json:47-50`, `microphonePermission: false`) | No hay voz | — | PASS |
| `com.android.vending.BILLING` | react-native-purchases | Suscripciones | No | PASS |
| `VIBRATE` | expo-haptics (probable) | Hápticos | No | NO PROBADO (confirmar en el AAB) |
| Servicio en primer plano, ubicación, contactos, SMS, accesibilidad, Health | — | No se usan | — | NO APLICABLE |

## 4. Pagos (Google Play Billing vía RevenueCat)

| # | Punto | Estado | Evidencia | Acción · dueño |
|---|---|---|---|---|
| 4.1 | Stripe excluido en Android | PASS | `src/lib/storepolicy.ts:14-26`: `esTienda('android')`, así que `stripePermitido` devuelve false y la clave propia no se permite fuera de desarrollo. Política de pagos de Play: el contenido digital se cobra con Play Billing. | Confirmar en un build `production` de Android que no aparece el muro de Stripe ni el campo de clave propia del Oráculo. · Chat 2 |
| 4.2 | IDs de producto en Play | FAIL (no creados) | El código espera exactamente `nivl_pro_mensual`, `nivl_pro_anual`, `nivl_elite_mensual`, `nivl_elite_anual` y `nivl_elite_fundador` (`src/lib/proplans.ts:151-156`). En Play, RevenueCat los entrega como `id:baseplan` y `productoBase` corta por `:` (`proplans.ts:452-456`). **No son `pro_mensual`, etc.** | Crear **5 suscripciones independientes**, cada una con **un solo plan base** (mensual: renovación de 1 mes; anual: de 1 año). Precios equivalentes a ASC: 12,99 / 99,99 / 29,99 / 299 / 249 € (`proplans.ts:180-184`; ASC según `00-apple-rechazo-literal.md`). Importarlas en RevenueCat, en la misma offering que iOS. · Chat 2 + Usuario |
| 4.3 | Cambio de nivel Pro → Élite en Android | FAIL (riesgo de doble cobro) | `src/lib/pro.ts:299` llama a `Purchases.purchasePackage(paquete)` **sin `googleProductChangeInfo`** (en `src/` no aparece `googleProductChangeInfo` ni `replacementMode`). Play no tiene «grupos de suscripción»: sin ese parámetro, comprar Élite con Pro activo crea **una segunda suscripción en paralelo**. | Pasar `googleProductChangeInfo: { oldProductIdentifier, prorationMode/replacementMode }` cuando haya una suscripción activa, o bloquear la compra cruzada en Android. · Chat 2 |
| 4.4 | Gestionar o cancelar en Google Play | PASS en la web (02/10: /soporte explica la cancelación en Google Play; HTTP 200). Copy de la app: Chat 2 lo separa por plataforma en c87df0d | El copy legal menciona Google Play (`proplans.ts:446`), pero `nivl-web/soporte.html:34` solo explica cómo cancelar «En tu iPhone». | Añadir en /soporte: «Google Play → Perfil → Pagos y suscripciones → Suscripciones → NIVL». En la app, valorar abrir `customerInfo.managementURL`. · Chat 4 (web) y Chat 2 (app) |
| 4.5 | Clave pública de RevenueCat para Android | NO PROBADO | `src/lib/pro.ts:97-100` lee `EXPO_PUBLIC_RC_ANDROID_KEY`. Sin ella, `purchasesAvailable()` devuelve false y la tienda queda en solo lectura (AGENTS.md:43). | Crear la app Android en RevenueCat, vincularla con la cuenta de servicio de Play y crear la variable en el entorno `production` de EAS. · Chat 2 + Usuario |
| 4.6 | Webhook y servidor para `google` | NO PROBADO | AGENTS.md:28 y `supabase/migrations/0027_tienda.sql` / `0033_store_reconciliation.sql` contemplan Google Play. No se ha probado ningún evento real de Google. | Compra de prueba con un *license tester* en la pista interna. Verificar `subscriptions.provider = 'google'`. · Chat 2 + Chat 3 |
| 4.7 | Cuentas de prueba de licencias | NO PROBADO | — | Añadir los Gmail de los testers en Play Console → Configuración → Pruebas de licencias. · Usuario |

## 5. Datos, privacidad y borrado

### 5.1 Borrador de la sección «Seguridad de los datos» (Data Safety)

Se basa **solo en lo que hace el cliente**. La retención, los proveedores y las transferencias del lado del servidor quedan **pendientes del Chat 3**. No sustituye a la revisión legal.

| Categoría de Play | ¿Se recoge? | Evidencia | ¿Opcional? | Finalidad | Notas |
|---|---|---|---|---|---|
| Información personal → Correo electrónico | Sí | `src/app/login.tsx:81,84,88` (login y registro con email, puente Franky `src/lib/frankyAuth.ts`; **sin Franky en la build final**: decisión del 02/10 y privacidad §10, fila 8) | No | Gestión de la cuenta | **Pendiente Chat 3**: qué recibe Franky (servicio del mismo responsable o tercero) |
| Información personal → Nombre | Sí | `src/app/onboarding.tsx:181`, `src/lib/data.ts:33` (`profiles`) | No (se puede usar un alias) | Funcionalidad de la app, social | Visible para amigos (`amigos.tsx`) |
| Información personal → Otros (edad mínima confirmada) | Sí (booleano) | `src/lib/age.ts:14-18` (`confirm_minimum_age`, 16) | No | Cumplimiento | — |
| Salud y forma física → Salud | Sí | `src/lib/progress.ts:8` (`body_metrics`), `src/lib/health.ts` (consentimiento explícito) | Sí | Funcionalidad de la app, personalización (coach) | Consentimiento de salud (migración 0030) |
| Salud y forma física → Forma física | Sí | `src/lib/body.ts:73-117` (`gym_sessions`), `src/lib/bodywork.ts:67,170` (`cardio_sessions`, `nutrition_logs`) | Sí | Funcionalidad, personalización | — |
| Información financiera → Otra información financiera | Sí | `src/lib/money.ts:92,102,178` (`transactions`, `money_accounts`), presupuestos | Sí | Funcionalidad | No se recogen números de tarjeta |
| Información financiera → Historial de compras | Sí | `src/lib/pro.ts:126,132` (RevenueCat `appUserID` = uuid de Supabase), tabla `subscriptions` | No (si compra) | Funcionalidad, gestión de cuenta | RevenueCat actúa como proveedor de servicios |
| Fotos y vídeos → Fotos | Sí | `src/lib/data.ts:196-226` (`avatars`), `src/lib/photos.ts:40,53` (`evidence`), `src/lib/contract.ts:211` | Sí | Funcionalidad, coach IA (si el usuario las envía) | Las imágenes enviadas al coach van al proveedor de IA (`app.json` `photosPermission`) |
| Mensajes → Otros mensajes en la app | Sí | `src/lib/coach.ts:279-348` (`coach_messages`) | Sí (función Pro) | Funcionalidad (coach IA) | **Pendiente Chat 3**: proveedor (Anthropic / DeepSeek / compatible con OpenAI, `supabase/functions/coach/index.ts:28-30`) y región. La privacidad web menciona tratamiento en China con DeepSeek |
| Contenido generado por el usuario / otros | Sí | `src/lib/journal.ts:25-77` (diario), misiones, contrato, calendario (`dungeons.ts:103`) | Sí | Funcionalidad | — |
| Actividad en la app → Interacciones | Sí | misiones, logros, XP (`quests`, `achievements`) | No | Funcionalidad | No hay analítica de terceros: no aparece Sentry/Firebase Analytics/PostHog en `src/` (búsqueda del 02/10/2026) |
| Identificadores del dispositivo u otros | Sí | `src/lib/push.ts:37-44` (`push_tokens` con token Expo) | Sí (depende del permiso) | Funcionalidad (push) | — |
| Información de la app y rendimiento → Registros de fallos | No (cliente) | `src/components/ErrorBoundary.tsx:26` (solo log local) | — | — | **Pendiente Chat 3**: logs del servidor |
| Ubicación, contactos, audio, calendario del sistema, historial web | No | `app.json:47-50` (audio bloqueado); `privado/appstore-privacidad.md:48-51` | — | — | — |

- Cifrado en tránsito: **Sí** (HTTPS a Supabase, RevenueCat e IA). PASS.
- El usuario puede pedir el borrado: **Sí** (§5.2).
- «Compartir con terceros»: los proveedores que tratan datos por cuenta de NIVL (Supabase, RevenueCat, proveedor de IA) suelen quedar fuera de «compartir» según Google, pero hay que **decidirlo con el Chat 3 y la revisión legal**, sobre todo en lo relativo a DeepSeek y Franky. Estado: **NO PROBADO / pendiente del Chat 3**.
- Coherencia: este borrador debe cuadrar con la etiqueta de privacidad de Apple ya publicada (`privado/appstore-privacidad.md`) y con `/privacidad`. · Chat 3

### 5.2 Borrado de cuenta

| # | Punto | Estado | Evidencia | Acción · dueño |
|---|---|---|---|---|
| 5.2.1 | Borrado dentro de la app | PASS (código) / NO PROBADO (Android) | `src/app/(tabs)/perfil.tsx:380,884` y `src/lib/account.ts:7-9` (función `account-erasure`, migración 0031). | Probarlo en Android. · Coordinador (QA) |
| 5.2.2 | **URL web de borrado** (requisito de Play) | PASS (02/10): https://nivl-web.vercel.app/borrar-cuenta da 200 y explica el borrado desde la app y, sin la app, por correo desde la cuenta con el asunto «Eliminar cuenta NIVL». Esta es la URL que se pone en Data Safety | Fuente: https://support.google.com/googleplay/android-developer/answer/13327111 (02/10/2026): enlace web funcional en el que se **pueda solicitar** el borrado **sin reinstalar la app**, que cite el nombre de la app o del desarrollador. Hoy `/privacidad` y `/soporte` solo remiten a «Perfil → Eliminar cuenta» y a un correo genérico (`soporte.html:42`, `privacidad.html:117,125`). | Crear `https://nivl-web.vercel.app/borrar-cuenta` (o una sección con ancla) con el título «NIVL: eliminar tu cuenta», los pasos en la app, un formulario o correo para pedirlo sin la app, qué se borra y qué se conserva, y los plazos. Esa URL va en Play Console → Contenido de la app → Eliminación de datos. · Chat 4 (web) + Chat 3 (proceso de servidor) |

### 5.3 Enlaces

| URL | Estado (02/10/2026) | Nota |
|---|---|---|
| https://nivl-web.vercel.app/privacidad | PASS (200) | Usada también en la app (`proplans.ts:427`). Debe nombrar a Google Play como canal de pago (Chat 4). |
| https://nivl-web.vercel.app/soporte | PASS (200) | Incluye la cancelación en Google Play (verificado el 02/10). |
| https://nivl-web.vercel.app/terminos | PASS (200) | — |
| https://nivl.app | NO APLICABLE para enlaces | Comprado el 02/10, pero solo se usa para el correo (Resend). Los enlaces, la web y los textos legales siguen en `nivl-web.vercel.app`. |

## 6. Deep links / App Links

| # | Punto | Estado | Evidencia | Acción · dueño |
|---|---|---|---|---|
| 6.1 | Intent filter verificado | FAIL (no verificará) | `app.json:33-40`: `autoVerify` solo para `https://nivl.app/c/…`, y **nivl.app no resuelve**. iOS sí incluye `nivl-web.vercel.app` (`app.json:14`); Android no. | Añadir el host `nivl-web.vercel.app` con `pathPrefix /c/` (diff en §11). No bloquea la publicación: los enlaces se abren en el navegador (`nivl-web/c.html`). · Coordinador |
| 6.2 | `assetlinks.json` | FAIL | Se sirve en `nivl-web.vercel.app` con `PENDIENTE_SHA256_FINGERPRINT`. | Poner la SHA-256 de la **clave de firma de Play App Signing** (Play Console → Integridad de la app) y, para builds internos fuera de Play, también la de la clave de subida de EAS. Es lo mismo en `nivl.app` cuando exista. · Chat 4 |
| 6.3 | Esquema propio `nivl://` | PASS | `app.json:8`. | — |

## 7. Contenido de la app (Play Console → Política → Contenido de la app)

| # | Punto | Estado | Evidencia | Acción · dueño |
|---|---|---|---|---|
| 7.1 | Acceso a la app (cuenta de prueba) | NO PROBADO | Hay cuentas de revisión de Apple en `privado/` (no se copian aquí). Toda la app exige iniciar sesión (`login.tsx`). | Mismo criterio que en Apple: ninguna cuenta con la edad ni los consentimientos aceptados; los pasos van en las instrucciones de acceso. Crear o reutilizar una cuenta demo **para Google** (Pro y Élite, como en Apple) con instrucciones de acceso, incluido que la cuenta ya ha confirmado la edad y los consentimientos. Las credenciales van directamente en Play Console, no en el repo. · Chat 3 + Usuario |
| 7.2 | Clasificación IARC | NO PROBADO | Contenido: interacción entre usuarios (amigos, nombres y avatares), chat con IA, compras digitales, sin violencia real (la estética de arena y gladiador es simbólica), sin apuestas. | Rellenar el cuestionario con coherencia con la clasificación de Apple (`privado/asc-age-rating-applied.json`): «Los usuarios interactúan», «Compras digitales». · Coordinador + Usuario |
| 7.3 | Público objetivo | NO PROBADO | Edad mínima de 16 (`src/lib/consentmath.ts:16`, `privacidad.html:129`). | Marcar solo los tramos **16-17 y 18+** (ningún tramo por debajo de 13, para no entrar en la política de Familias). Valorar 18+ si legal lo prefiere por salud e IA. · Usuario |
| 7.4 | IA generativa: denuncia dentro de la app | **EN CURSO** (Chat 4 @bb8f695: «Denunciar respuesta» en el coach y en el Oráculo; hasta que exista la RPC del Chat 3, el envío abre un correo a soporte. NO PROBADO en Android) | Fuente: https://support.google.com/googleplay/android-developer/answer/13985936 (02/10/2026): las apps que generan contenido con IA deben permitir **denunciar o marcar contenido ofensivo sin salir de la app**. En `src/app/(tabs)/coach.tsx` y `src/lib/coach.ts` no hay ninguna acción de denunciar una respuesta (búsqueda de report/denunci/flag el 02/10/2026). La denuncia existente es solo social. | Añadir «Denunciar respuesta» (pulsación larga o menú en cada mensaje del coach y del Oráculo) que guarde el mensaje y el motivo en el servidor. **Bloquea Play.** · Chat 3 (tabla y RPC) + coordinador (UI) |
| 7.5 | UGC: denuncia y bloqueo de usuarios | PASS (código) / NO PROBADO | `src/lib/socialSafety.ts:2-15`, `src/lib/social.ts:201-218` (`social_block_user`, `social_report_user`), UI en `src/app/amigos.tsx:326,1031-1040`, migración `0032_social_safety.sql`, `docs/MODERACION-SOCIAL.md`. | Probarlo en Android. · QA |
| 7.6 | Declaración de apps de salud | NO PROBADO | Obligatoria para **todas** las apps, incluidas las de pistas de prueba (https://support.google.com/googleplay/android-developer/answer/14738291, 02/10/2026). NIVL tiene registro de forma física, nutrición y medidas corporales, sin Health Connect y sin pretensión de dispositivo médico. | Declarar «Fitness y bienestar / nutrición», «no es un dispositivo médico» y mantener el descargo (`src/components/DescargoSalud.tsx`). · Usuario + Chat 3 |
| 7.7 | Declaración de funciones financieras | NO PROBADO | Obligatoria en Contenido de la app. NIVL registra gastos y presupuestos, pero no presta, no invierte ni mueve dinero. | Declarar «sin funciones financieras reguladas» o, si Play lo ofrece, «gestión de finanzas personales». Verificarlo en la consola. · Usuario |
| 7.8 | Anuncios | PASS | No hay SDK de anuncios. | Declarar «sin anuncios». |
| 7.9 | Política de privacidad en la ficha | PASS (URL) | Ver §5.3. | Pegar la URL de /privacidad. · Coordinador |
| 7.10 | ID de publicidad (`AD_ID`) | NO PROBADO | No hay SDK de anuncios. Comprobar si alguna librería lo añade al manifiesto. | Declarar «no usa ID de publicidad» y, si aparece, bloquear `com.google.android.gms.permission.AD_ID`. · Coordinador |

## 8. Cuenta de desarrollador y pruebas cerradas

| # | Punto | Estado | Evidencia | Acción · dueño |
|---|---|---|---|---|
| 8.1 | Cuenta de Play Console | NO PROBADO (bloqueo externo) | No hay rastro de ella (§0). | El usuario crea o confirma la cuenta (personal u organización), verifica su identidad y paga la cuota. · Usuario |
| 8.2 | Requisito de pruebas cerradas | **Aplica**: la cuenta es personal y reciente (decisión del usuario, 02/10/2026) | Fuente: https://support.google.com/googleplay/android-developer/answer/14151465 (02/10/2026): «a minimum of 12 testers who have been opted in continuously for at least 14 days» antes de solicitar el acceso a producción. | Planificar 12 o más testers con Gmail en una pista **cerrada** durante 14 días seguidos (la pista interna no cuenta). Esto supone un mínimo de unas 2-3 semanas hasta producción. Con una cuenta de **organización** (requiere D-U-N-S) no se aplica. · Usuario |
| 8.3 | Pista interna para QA | NO PROBADO | — | Pista interna con hasta 100 testers para QA y para el *license tester* de pagos. · Coordinador |

## 9. Ficha de Play

| # | Punto | Estado | Acción · dueño |
|---|---|---|---|
| 9.1 | Nombre (≤ 30), descripción breve (≤ 80) y completa | NO PROBADO | Adaptar `privado/appstore-ficha.md`. Ojo: no se puede prometer soporte de tablet (ver la matriz). · Chat 1 |
| 9.2 | Icono 512×512, gráfico destacado 1024×500 y capturas de teléfono | FAIL (no hay material Android) | Las capturas de iOS (`privado/appstore-capturas-1.0.7`) tienen marco de iPhone y **no sirven** para Play. Hacen falta capturas Android reales (2 o más, de 320 a 3840 px, entre 9:16 y 16:9). Estética de arena: monocromo hueso/negro, Cinzel/Outfit. · Chat 1 + coordinador |
| 9.3 | Capturas de tablet de 7" y 10" | NO APLICABLE (de momento) | No incluirlas mientras no se pruebe en tablet. |

## 10. Prioridades

- **P0 (bloquea la publicación en Play):** 8.1 cuenta · 7.4 denuncia de respuestas de IA · 5.2.2 URL web de borrado · 4.2 productos en Play y 4.5 clave de RevenueCat Android (bloquean la venta) · 1.5 firma o Play App Signing · 8.2 pruebas cerradas de 12×14 si la cuenta es personal · Data Safety completa (5.1, pendiente del Chat 3) · 7.1 acceso de revisión · 7.6 y 7.7 declaraciones.
- **P1:** 4.3 doble suscripción Pro y Élite · 2.7 FCM para push · 4.4 copy de cancelación en Google Play · 2.3 edge-to-edge y apaisado en pantallas grandes · `SCHEDULE_EXACT_ALARM` sin pedir · 9.2 capturas Android.
- **P2:** 6.1 y 6.2 App Links verificados · deduplicar permisos y bloquear el almacenamiento externo · workflow Android de CI · `AD_ID`.

## 11. PROPUESTAS de cambio (no aplicadas: las decide el coordinador)

**P-A · app.json: deduplicar, verificar el host de Vercel y preparar FCM.** El cambio de `blockedPermissions` de almacenamiento solo después de probar la galería en Android 7-12.

```diff
       "predictiveBackGestureEnabled": false,
+      "googleServicesFile": "./google-services.json",
       "intentFilters": [
         {
           "action": "VIEW",
           "autoVerify": true,
-          "data": [{ "scheme": "https", "host": "nivl.app", "pathPrefix": "/c/" }],   (se sustituye: decisión del 02/10, dominio único nivl-web.vercel.app)
+          "data": [
+            { "scheme": "https", "host": "nivl-web.vercel.app", "pathPrefix": "/c/" }
+          ],
           "category": ["BROWSABLE", "DEFAULT"]
         }
       ],
       "permissions": [
         "android.permission.POST_NOTIFICATIONS",
-        "android.permission.SCHEDULE_EXACT_ALARM",
-        "android.permission.POST_NOTIFICATIONS",
         "android.permission.SCHEDULE_EXACT_ALARM"
       ],
       "blockedPermissions": [
-        "android.permission.RECORD_AUDIO",
-        "android.permission.RECORD_AUDIO"
+        "android.permission.RECORD_AUDIO",
+        "com.google.android.gms.permission.AD_ID"
       ]
```

Nota: `google-services.json` no es secreto en sentido estricto, pero el repo es público. Como alternativa, ponerlo como *file env var* de EAS (`googleServicesFile: process.env.GOOGLE_SERVICES_JSON`, lo que exige `app.config.ts`).

**P-B · eas.json: envío a la pista interna**, solo después de la primera subida manual. La cuenta de servicio se guarda en EAS, no en el repo.

```diff
   "submit": {
     "production": {
       "ios": {
         "language": "es-ES",
         "ascAppId": "6801825007"
-      }
+      },
+      "android": {
+        "track": "internal",
+        "releaseStatus": "draft"
+      }
     }
   }
```

**P-C · pro.ts (Chat 2)**: en Android, si `customerInfo.activeSubscriptions` contiene un `nivl_*`, llamar a `Purchases.purchasePackage(paquete, { oldProductIdentifier: <activo>, prorationMode/replacementMode adecuado })` (firma exacta según la documentación de RevenueCat v10) en lugar de la compra simple de `src/lib/pro.ts:299`.

## Fuentes (consultadas el 02/10/2026)

- API objetivo: https://developer.android.com/google/play/requirements/target-sdk
- Expo SDK 54 (SDK de Android y mínimos): https://docs.expo.dev/versions/v54.0.0/
- Cambios de comportamiento de Android 16: https://developer.android.com/about/versions/16/behavior-changes-16
- Plazos de Play Billing Library: https://developer.android.com/google/play/billing/deprecation-faq
- RevenueCat y PBL 8: https://www.revenuecat.com/blog/engineering/google-play-billing-v8
- 16 KB: https://developer.android.com/guide/practices/page-sizes · RN 0.81: https://reactnative.dev/blog/2025/08/12/react-native-0.81
- Borrado de cuenta: https://support.google.com/googleplay/android-developer/answer/13327111
- Pruebas para cuentas personales nuevas: https://support.google.com/googleplay/android-developer/answer/14151465
- Contenido generado por IA: https://support.google.com/googleplay/android-developer/answer/13985936
- Permisos sensibles y alarmas exactas: https://support.google.com/googleplay/android-developer/answer/9888170 · https://developer.android.com/about/versions/14/changes/schedule-exact-alarms
- Declaración de apps de salud: https://support.google.com/googleplay/android-developer/answer/14738291
- Manifiestos de las librerías: https://unpkg.com/expo-image-picker@17.0.11/android/src/main/AndroidManifest.xml · https://unpkg.com/expo-notifications@0.32.17/android/src/main/AndroidManifest.xml

## Plan de la prueba cerrada (cuenta personal reciente, decisión del usuario 02/10/2026)

Requisito oficial ([Play Console Help 14151465](https://support.google.com/googleplay/android-developer/answer/14151465), consultado el 02/10/2026): las cuentas personales creadas después del 13/11/2023 necesitan «a minimum of 12 testers who have been opted in continuously for at least 14 days» en una prueba cerrada. Los testers que se dan de baja antes de 14 días no cuentan. Después se solicita el acceso a producción desde el Panel, con un cuestionario sobre la prueba, la app y la preparación para producción. La revisión suele tardar 7 días o menos.

**Calendario mínimo:** día 0 abre la prueba → día 14, como pronto, se cumple el requisito → producción hacia el día 21, si la revisión no se alarga. Para un lanzamiento en Android dentro del Winter Arc, **la prueba cerrada tiene que abrirse cuanto antes**: cada día de retraso mueve la fecha de producción.

| Paso | Qué | Dueño | Estado |
|---|---|---|---|
| 1 | Crear la app `com.teferi.nivl` en Play Console, completar la ficha mínima, la política de privacidad (`https://nivl-web.vercel.app/privacidad`), el acceso a la app (cuenta de prueba), anuncios = No, clasificación IARC, público objetivo 16+, Data Safety (borrador en este documento, pendiente del Chat 3), y las declaraciones de salud y finanzas | Usuario + coordinador | NO HECHO |
| 2 | Primer AAB firmado (EAS, perfil de producción, `versionCode` nuevo), subido **a mano** a la pista interna y con Play App Signing activado. Instalarlo en un Android físico: arranque, login, compra con un tester de licencias | Coordinador | NO HECHO |
| 3 | Crear las 5 suscripciones `nivl_*` (un plan base cada una) y enlazarlas en RevenueCat; poner `EXPO_PUBLIC_RC_ANDROID_KEY` en EAS (no vale la de iOS). Antes de abrir la prueba cerrada, integrar la corrección de Pro→Élite del Chat 2 | Usuario + Chat 2 | NO HECHO |
| 4 | Promover la misma build a **Prueba cerrada**, con una lista de testers de Google Groups o de correos | Coordinador | NO HECHO |
| 5 | Reclutar **al menos 15 testers** (margen sobre los 12 por si alguien se da de baja) con Android propio: amigos, clippers o comunidad. Cada uno acepta en el enlace de inscripción **e instala la app**. Llevar un registro privado (fuera de git) con la fecha de alta de cada uno | Usuario | NO HECHO |
| 6 | Durante los 14 días: pedir uso real (misión diaria, coach con la prueba), recoger feedback con un formulario y corregir. **Las actualizaciones no reinician el contador**, pero un tester que se da de baja sí deja de contar | Usuario + chats | NO HECHO |
| 7 | Día 14 o después: Panel → «Solicitar acceso a producción». Responder con datos reales: cómo se reclutó, uso y feedback recibidos, y qué se cambió | Usuario | NO HECHO |
| 8 | Con el acceso concedido: lanzamiento por fases en producción, con los mismos territorios que iOS (165) salvo motivo documentado | Coordinador + usuario | NO HECHO |

Riesgos: (a) Google puede denegar el acceso si la prueba se nota poco usada, así que hay que pedir uso diario de verdad; (b) los P0 de IA generativa (denuncia de respuestas dentro de la app) y de la URL web de borrado deben estar resueltos **antes** de pedir producción, y si es posible antes de abrir la prueba cerrada; (c) sin FCM no hay push remoto en Android: o se acepta para el lanzamiento o se configura Firebase antes del paso 2.
