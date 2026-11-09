# App Privacy de NIVL 1.1.0: respuestas para App Store Connect

Fecha: 9 de noviembre de 2026. Sacado del código de la versión 1.1.0 (rama `claude/tienda-1-1-b4864e`), no de documentos anteriores. Las definiciones son las de [App privacy details](https://developer.apple.com/app-store/app-privacy-details/).

Nada de esto se ha introducido en App Store Connect. Las respuestas que hay guardadas allí hoy no se han podido leer.

**Sustituye a** `docs/appstore-review-2026-09-29/PRIVACIDAD-FICHA.md`, que decía que no había ubicación precisa ni micrófono: ya no es cierto.

## Cinco condiciones antes de pegar esto

1. La política publicada no nombra HealthKit, Apple Watch, GPS, calendario, TV ni Open-Meteo (hallazgo P1). La ficha y la política tienen que decir lo mismo.
2. La hoja de permiso de IA no nombra los datos nuevos que llegan a Anthropic (hallazgo P2).
3. El programa de medición de uso depende de un interruptor del servidor, `analitica_activa`, cuyo valor en producción no se ha podido leer. La respuesta de abajo asume que se encenderá. Si está apagado y se va a quedar apagado, «Product Interaction» puede ir en No.
4. Los contratos con proveedores (Anthropic incluido) no se han visto.
5. Comprobar el binario firmado: aquí se ha generado el proyecto con `expo prebuild`, no el IPA final.

## Respuesta general

- ¿Recoges datos de esta app? **Sí.**
- ¿Se usan para tracking? **No en ningún tipo.** No hay SDK de publicidad ni de analítica de terceros en `package-lock.json`, ni `NSUserTrackingUsageDescription` en el Info.plist generado, ni llamada a `collectDeviceIdentifiers` de RevenueCat (`src/lib/pro.ts` solo usa `logIn` en la línea 232 y `setAttributes` con el código de creador en la 312). ATT no hace falta.

## Respuestas por tipo

Vinculado significa ligado al uuid de la cuenta. La columna Tracking es No en todas las filas.

### Contact Info

| Tipo | ¿Se recoge? | Finalidad | Vinculado | De dónde sale |
|---|---|---|---|---|
| Name | Sí | App Functionality, Product Personalization | Sí | `profiles.name`; el coach lo recibe (`supabase/functions/_shared/context.ts:330`, uso de `p.name`) |
| Email Address | Sí | App Functionality | Sí | Registro y recuperación, `src/lib/authFlow.ts`; correos de Auth por SMTP de Resend. No se envía al coach: `context.ts` no lee el correo |
| Phone Number | No | | | No hay campo |
| Physical Address | No | | | No hay campo. La ciudad va en Location |
| Other User Contact Info | No | | | |

### Health and Fitness

| Tipo | ¿Se recoge? | Finalidad | Vinculado | De dónde sale |
|---|---|---|---|---|
| Health | Sí | App Functionality, Product Personalization | Sí | HealthKit: pasos, energía activa, pulso, pulso en reposo, sueño, peso (`modules/nivl-salud/ios/LectorSalud.swift:34-51`), subidos a `salud_diaria` (`src/lib/medicion/saludDiaria.ts:46`). A mano: `body_metrics`, `body_profile` (lesiones, notas de salud), `journal_entries`, `nutrition_logs`, `entreno_bienestar` |
| Fitness | Sí | App Functionality, Product Personalization | Sí | `entrenos_medidos` con origen `watch`, `iphone_gps`, `salud` o `manual` (migración 0105), `cardio_sessions`, `gym_sessions`, `gym_lifts`, `plan_sesiones` |

### Financial Info

| Tipo | ¿Se recoge? | Finalidad | Vinculado | De dónde sale |
|---|---|---|---|---|
| Payment Info | No | | | La hoja de pago es de Apple. NIVL no ve la tarjeta |
| Credit Info | No | | | |
| Other Financial Info | Sí | App Functionality, Product Personalization | Sí | `money_accounts`, `transactions`, `budgets`, `money_plan`. El CSV se lee en el móvil; el PDF pasa por memoria en `economia` y su texto, con IBAN enmascarado, va a Haiku (`supabase/functions/economia/handler.ts:3-14`) |

### Location

| Tipo | ¿Se recoge? | Finalidad | Vinculado | De dónde sale |
|---|---|---|---|---|
| Precise Location | Sí | App Functionality | Sí | Ruta GPS de las sesiones que arranca la persona (`modules/nivl-salud/ios/GpsSesion.swift`, `targets/watch/ServicioEntreno.swift`) o rutas de entrenos leídos de Salud (`LectorSalud.swift:544`). Se guarda en `entrenos_medidos.ruta`. No va al coach (`tools.ts:1783`, `estudioResistencia.ts:4`) |
| Coarse Location | Sí | App Functionality, Product Personalization | Sí | Ciudad elegida a mano para la previsión, coordenadas a dos decimales (`src/lib/resistencia.ts:232`, `entreno_perfil.ubicacion_lat`). No viene del GPS |

### Sensitive Info

**No.** Ningún campo pide origen, orientación, embarazo, discapacidad, creencias, afiliación, genética ni biometría (el Info.plist lleva `NSFaceIDUsageDescription`, pero la app no usa Face ID: hallazgo P7). El texto libre del diario o de las notas puede contener cualquier cosa. Va declarado en Other User Content. Es una decisión defendible, no una certeza: si el dueño prefiere cubrirse, marcar Sí no tiene coste.

### Contacts

| Tipo | ¿Se recoge? | Finalidad | Vinculado | De dónde sale |
|---|---|---|---|---|
| Contacts | Sí, solo el grafo social | App Functionality | Sí | Amigos, solicitudes y bloqueos dentro de NIVL (`src/lib/social.ts`). La definición de Apple incluye el grafo social. No se lee la libreta: no hay `expo-contacts` ni `NSContactsUsageDescription` |

### User Content

| Tipo | ¿Se recoge? | Finalidad | Vinculado | De dónde sale |
|---|---|---|---|---|
| Emails or Text Messages | No | | | El chat con el coach va en Other User Content |
| Photos or Videos | Sí, solo fotos | App Functionality, Product Personalization | Sí | Buckets `evidence`, `avatars`, `progress`. Al coach solo las adjuntas (`src/components/coach/useCoach.ts:403`) |
| Audio Data | No | | | Se dicta con `expo-speech-recognition` y a NIVL llega texto (`src/lib/coachvoz/dictar.ts:278`). En iOS, si no hay modelo local, transcribe Apple por la red (`dictar.ts:136-140`). NIVL no recibe audio |
| Gameplay Content | Sí | App Functionality | Sí | XP, niveles, rachas, rankings entre amigos |
| Customer Support | Sí | App Functionality | Sí | Denuncias de usuarios y de respuestas del coach (`src/components/coach/MensajeCoach.tsx:126`, migración 0032) |
| Other User Content | Sí | App Functionality, Product Personalization | Sí | Diario, misiones, reglas, campañas, plan, conversaciones con el coach, trabajos y entregas, y agenda con **eventos copiados del calendario del teléfono** (`src/work/calendarioDispositivo.ts`, migración 0116). Apple no tiene tipo «calendario»: va aquí |

### Browsing History y Search History

**No** en ambos. La búsqueda de ciudad va a Open-Meteo, responde y no se guarda (`supabase/functions/prevision/handler.ts`, sin logs de texto).

### Identifiers

| Tipo | ¿Se recoge? | Finalidad | Vinculado | De dónde sale |
|---|---|---|---|---|
| User ID | Sí | App Functionality, Analytics | Sí | uuid de Supabase, también `appUserID` en RevenueCat (`src/lib/pro.ts:232`) |
| Device ID | Sí | App Functionality, Analytics | Sí | Token push de Expo (`src/lib/push.ts`, `claim_push_token`), `EAS-Client-ID` de expo-updates, e `install_id` aleatorio si se acepta la medición (`src/lib/analitica.ts`). Nunca IDFA |

### Purchases

| Tipo | ¿Se recoge? | Finalidad | Vinculado | De dónde sale |
|---|---|---|---|---|
| Purchase History | Sí | App Functionality, Analytics | Sí | RevenueCat y `subscriptions` (`revenuecat-webhook`, migración 0027). [Guía de RevenueCat](https://www.revenuecat.com/docs/platform-resources/apple-platform-resources/apple-app-privacy) |

### Usage Data

| Tipo | ¿Se recoge? | Finalidad | Vinculado | De dónde sale |
|---|---|---|---|---|
| Product Interaction | Sí, con la condición 3 | Analytics | Sí | `funnel_events` con lista blanca de propiedades, solo con consentimiento y flag (`src/lib/analitica.ts:1-22`, migraciones 0070 y 0073). El servidor añade `user_id` si hay sesión, así que no es anónimo a efectos de Apple |
| Advertising Data | No | | | |
| Other Usage Data | Sí | App Functionality | Sí | Telemetría de coste del coach, sin textos libres (`supabase/functions/_shared/telemetria.ts`, `coach_runs`) |

### Diagnostics

| Tipo | ¿Se recoge? | Finalidad | Vinculado | De dónde sale |
|---|---|---|---|---|
| Crash Data | No | | | No hay Sentry, Crashlytics ni similar en `package-lock.json` |
| Performance Data | No | | | |
| Other Diagnostic Data | Sí | App Functionality | Sí, por prudencia | expo-updates pide actualizaciones con identificador de instalación. La política publicada ya dice que Expo recibe datos técnicos para diagnosticar fallos |

### Surroundings, Body y Other Data

**No** en Environment Scanning, Hands, Head y Other Data Types. No hay ARKit, cámara en tiempo real ni visionOS. El módulo de gafas Meta está fuera del binario: `modules/nivl-meta` no tiene `expo-module.config.json`, solo la variante interna.

## Quién recibe datos

| Tercero | Qué recibe | Cuándo | Comprobado en |
|---|---|---|---|
| Supabase (Frankfurt, según el permiso de salud) | Todo lo de la cuenta | Siempre | `src/lib/supabase.ts`, `healthmath.ts` |
| Anthropic | Ver la tabla siguiente | Solo con permiso de salud y permiso de IA vigentes | `_shared/consent.ts`, `coach/handler.ts:905,1112`, `ritual/handler.ts:271,523`, `oracle/handler.ts:103,108`, `economia/handler.ts:255` |
| RevenueCat | uuid, compras, código de creador | Al abrir la tienda o comprar | `src/lib/pro.ts:232,312` |
| Apple | Compra (StoreKit), push (APNs), dictado si no es local, teselas de mapa (`RutaMapa`, proveedor por defecto) | Según uso | `dictar.ts`, `src/components/resistencia/RutaMapa.tsx` |
| Expo | Token push y **texto de los avisos**, peticiones de OTA | Si hay avisos | `supabase/functions/ritual/handler.ts:241,272`, `expo-updates` |
| Resend | Correo y contenido de confirmación o recuperación | Alta y recuperación | `AGENTS.md`, política. La configuración SMTP no se ve desde el repo |
| Open-Meteo | Coordenadas a dos decimales y zona horaria, o el texto de la ciudad buscada, de servidor a servidor y sin identificador | Con ciudad guardada | `supabase/functions/_shared/tiempo.ts:50-60,105-113,166` |
| Vercel | Visitas a la web pública | Web, no el binario | Política, apartado 4 |
| Google Fonts | **Nadie desde el binario**: las fuentes van empaquetadas. La página `/privacidad` tampoco las carga | | `@expo-google-fonts/*`; búsqueda en el HTML publicado |
| Stripe | Solo web y Oráculo | No en el flujo iOS | `AGENTS.md`, `src/lib/subscription.ts` |
| Notion | Solo la cuenta del dueño | No afecta a usuarios | `ritual/handler.ts:817` |
| DeepSeek | Nadie: la rama OpenAI está muerta (`const compat = null`) | | `coach/handler.ts:1260` |
| Franky | Nadie desde el binario 1.1: `src/` no llama a `franky-auth` | | búsqueda en `src/` |

## Qué llega exactamente a Anthropic

| Dato | Lectura | Condición adicional |
|---|---|---|
| Nombre, tipo de perfil, zona horaria, horas de despertar y dormir, XP y racha | `context.ts:330` | |
| Misiones, reglas, campañas, tareas, plan del día | `context.ts:332-343,374` | |
| Agenda con título, fecha, hora y notas. **Incluye los eventos copiados del calendario** | `context.ts:346`, `trabajo.ts:742` | Ninguna distinta del permiso de IA |
| Diario: ánimo, energía, sueño, emociones (14 días) y texto de las 3 últimas entradas | `context.ts:363,379` | |
| Peso y ficha física | `context.ts:337,367` | |
| Memoria del coach | `context.ts:331,352,376` | |
| Salud diaria de Apple, 7 días cerrados: pasos, kcal, pulso medio y en reposo, sueño, peso | `context.ts:266-268` | Interruptor `enviar_a_coach`, apagado de inicio (`context.ts:262-263`) |
| **Entrenos medidos, de cualquier origen (reloj, GPS, Salud)**: deporte, duración, distancia, desnivel, pulso medio y máximo, parciales, notas | `estudioResistencia.ts:297`, `tools.ts:1784`, `resistenciaCoach.ts:203` | **Sin interruptor propio.** Lo avisa `medicion.json` en `explicacion.para`, no la hoja de IA |
| Bienestar: sueño, fatiga, dolor, VFC, pulso en reposo | `estudioResistencia.ts`, `tools.ts:1785` | |
| Finanzas: estudio por categoría. Sin concepto ni cobrador en el historial (`tools.ts:1781-1782`) | `_shared/finance.ts` | Al clasificar movimientos sí va la contraparte o la descripción (`clasificar.ts:92`) |
| Texto de un extracto PDF con IBAN enmascarado | `economia/handler.ts:7-9` | Lo pide la persona |
| Fotos | Solo las adjuntas, en ese turno | |
| Conversación con el coach | `coach/handler.ts` | |

**No llega:** ruta GPS, serie de pulso, coordenadas, correo. `anthropic.ts` no manda `metadata.user_id`.

## Permisos del Info.plist generado

Sale de `npx expo prebuild --platform ios` sobre una copia en carpeta temporal.

| Clave | ¿Se usa? | Nota |
|---|---|---|
| `NSHealthShareUsageDescription`, `NSHealthUpdateUsageDescription` | Sí | Bien |
| `NSLocationWhenInUseUsageDescription` | Sí | No dice que sigue con la pantalla apagada (hallazgo P6) |
| `NSLocationAlwaysAndWhenInUseUsageDescription` | **No** | Nadie llama a `requestAlwaysAuthorization` |
| `UIBackgroundModes: location` | Sí | Solo durante la sesión. `allowsBackgroundLocationUpdates` e indicador azul a true (`GpsSesion.swift:368-369`), se apaga al terminar (`:379`) |
| `NSCalendars*` | Sí | No menciona al coach (hallazgo P3) |
| `NSReminders*` | No | Hace falta o `expo-calendar` cierra la app (`docs/rediseno-1.1/INFORME-INTEGRACION.md`). El texto lo dice |
| `NSCameraUsageDescription`, `NSPhotoLibrary*`, `NSMicrophoneUsageDescription`, `NSSpeechRecognitionUsageDescription` | Sí | Bien |
| `NSFaceIDUsageDescription` | **No** | Texto por defecto en inglés (hallazgo P7) |

Reloj (`targets/watch/Info.plist`): Salud, ubicación en uso y modos `workout-processing` y `mindfulness` (hallazgo P9). App de TV: bundle aparte (`tv/README.md`), sin ruta de enlace en esta rama (`src/app/tv` no existe). Si sale con su propio registro necesita su propia ficha.

## Privacy manifests

- En el proyecto generado no hay `PrivacyInfo.xcprivacy` propio: lo construye React Native en `pod install` agregando los de los pods (`react_native_pods.rb:509`). Hay manifiestos en React Native, expo-constants, expo-file-system, expo-notifications y AsyncStorage. Cubren `UserDefaults` del módulo local `nivl-salud`, que no tiene el suyo.
- **El reloj y la complicación no tienen ninguno** y usan `UserDefaults`, también de App Group (hallazgo P5).
- El resultado final solo se ve en el IPA firmado o en el correo de App Store Connect tras la subida.
