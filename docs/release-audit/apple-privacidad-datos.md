# Apple · Privacidad, datos, SDK y permisos de NIVL (iOS 1.0.7)

> **Actualización del 02/10/2026:** el usuario ha decidido eliminar el puente de Franky; NIVL tendrá su propio Supabase Auth. Las menciones a Franky de este documento (proveedor de identidad, datos enviados a Franky al registrarse, cuenta que sobrevive al borrado) dejan de aplicar a la build que la integre. Las declaraciones finales no deben incluir Franky como destinatario, salvo que el Chat 3 confirme que queda alguna migración o puente para cuentas antiguas.

Chat 1 · Tiendas, subagente Apple. Fecha: 02/10/2026. Solo lectura de código y de exportaciones GET de App Store Connect (ASC); no se ha cambiado nada en ASC ni en el código.

- Código revisado: rama `winter/chat1-tiendas`, SHA `58f4c60` (base `bf32d28`). Las citas `archivo:línea` son relativas a la raíz del repo en ese SHA.
- Contexto: Apple rechazó la 1.0.7 (build 18) el 29/09/2026 con «Guideline 2.1 - Information Needed» (`docs/release-audit/00-apple-rechazo-literal.md`). **Apple no ha señalado ningún defecto de privacidad.** Este documento compara lo que hace el código con lo que hay que declarar, para que la respuesta y el reenvío no contengan contradicciones.
- Fuentes de ASC: `privado/asc-chat1-readonly-20261002.json` y `privado/asc-chat1-readonly-prices-20261002.json` (GET del 02/10/2026). Las respuestas de «Privacidad de la app» **no se pueden leer por la API**; solo hay capturas del 28/09 (`privado/apple-privacidad-confirmacion.png` y `privado/apple-privacidad-publicada.png`).
- Leyenda: **NO PROBADO** = no se ha podido comprobar con el código o los datos disponibles. **NO VERIFICADO EN ASC** = no hay evidencia legible del estado publicado.

## 1. SDK y servicios externos (lo que hay realmente en el binario y en el servidor)

| Componente | Evidencia | Qué hace con los datos |
|---|---|---|
| Supabase (auth, Postgres, Storage, Edge Functions) | `package.json:20` (`@supabase/supabase-js`); sesión en AsyncStorage `src/lib/supabase.ts:2`, `:19` | Cuenta, todos los registros y las fotos (buckets `evidence` y `avatars`, `supabase/functions/_shared/account-erasure.ts:4`). La política publicada declara la región Frankfurt (consultada el 02/10/2026); **la región real del proyecto es NO PROBADO** (Chat 3). |
| RevenueCat | `package.json:41` (`react-native-purchases ^10.10.2`); `src/lib/pro.ts:126` `Purchases.configure({ apiKey, appUserID: userId })`; atributo `creator_code` en `src/lib/pro.ts:173`; servidor: `supabase/functions/revenuecat-webhook`, `supabase/functions/store-reconcile` (llama a `api.revenuecat.com/v1/subscribers/`) | Compras, estado de la suscripción y UUID de la cuenta; código de creador como atributo. |
| Anthropic (Claude) | `supabase/functions/_shared/anthropic.ts` (`api.anthropic.com/v1/messages`); proveedor por nombre de modelo en `supabase/functions/_shared/routing.ts:40-42` | Contexto del coach (salud, diario, finanzas, agenda, chat y fotos adjuntas). |
| Proveedor «compatible OpenAI» (DeepSeek según la doc y el consentimiento) | `supabase/functions/_shared/openai.ts:1-12`; `routing.ts:39-42` (todo lo que no sea `claude-*` va a `COACH_BASE_URL`); consentimiento `src/lib/consentmath.ts:39-42` | El mismo contexto que Claude. **La URL y el modelo en producción son secretos/filas de `ai_plans`: NO PROBADO** que hoy sea DeepSeek (memoria del proyecto: producción en Sonnet). |
| Expo Notifications | `package.json:29`; token `src/lib/push.ts:30` guardado con `user_id` en `push_tokens` `src/lib/push.ts:37-45` (tabla `supabase/migrations/0008_coach.sql:116`); envío `exp.host/--/api/v2/push/send` desde el servidor | Token push vinculado a la cuenta. |
| Expo Updates (EAS Update) | `package.json:36`; `app.json:96-102` | Identificador de instalación y el último error fatal en cada comprobación de actualización (según `privado/appstore-privacidad.md`, citando `node_modules/expo-updates/.../FileDownloader.swift:299` y `:307`; **no hay `node_modules` en este worktree: NO PROBADO aquí**). |
| Franky (franky.es) | `src/lib/frankyAuth.ts:11`; registro reenviado a `franky.es/api/auth/signup` con nombre, correo, contraseña y `attribution: { utm_source: 'nivl' … }` en `supabase/functions/franky-auth/index.ts:109-117` | Identidad de la cuenta. Si Franky es otra entidad o servicio separado, es un destinatario de datos: **titularidad NO PROBADO**. |
| Notion | `supabase/functions/_shared/notion.ts:1-25`; uso limitado a `tier === 'owner'` en `supabase/functions/ritual/index.ts:364-371` | Solo la cuenta del dueño. No afecta a usuarios. |
| OpenAI directo / clave propia (BYOK) | `src/lib/oracle.ts:57-59`; desactivado en la app de tienda por `byokEnabled()` `src/lib/subscription.ts:30-32` | Fuera del binario de tienda (solo `__DEV__`). |
| Stripe | `supabase/functions/stripe-webhook`; `paywallEnabled()` `src/lib/subscription.ts:25-27` | Solo web/Oráculo heredado; no hay compra Stripe en iOS. |

**No hay** SDK de analítica, publicidad, atribución ni crash reporting de terceros (no hay Sentry, Firebase, AppsFlyer, Adjust, Meta, etc. en `package.json:3-43`). No hay `expo-tracking-transparency` ni uso de IDFA (búsqueda sin resultados en `src/`, `app.json` y `package.json`). En ASC, `usesIdfa` es `null` (JSON, `versions.data[0].attributes`). Conclusión: **tracking = No**, con la salvedad de las integraciones de RevenueCat que estén activadas en su panel (NO PROBADO; pregunta para Chat 2/Chat 3).

## 2. Permisos de iOS

| Permiso | Evidencia | Uso real | Observación |
|---|---|---|---|
| Cámara | `app.json:16` y `:70`; llamadas `src/app/(tabs)/index.tsx:201-206` (foto de misión), `src/app/diario.tsx:273-278`, `src/app/gym.tsx:328-333` | Evidencias de misión, diario y entreno; se suben a `evidence` (`src/lib/photos.ts:50-59`) | Coincide con el texto. La foto del entreno entra en `quest_photos` y «la ve el coach» (comentario `src/app/gym.tsx:223-225`); el resumen manda al modelo los pies de foto, no los bytes (`supabase/functions/_shared/recap.ts:89`). |
| Fotos | `app.json:17` y `:71`; `src/app/(tabs)/coach.tsx:243-256` (adjuntos al coach, hasta 3, base64); `src/app/(tabs)/perfil.tsx:231` (retrato con selector del sistema) | Retrato y adjuntos al coach | El texto menciona el proveedor de IA externo. Bien. |
| Micrófono | `app.json:72` `microphonePermission: false`; Android `RECORD_AUDIO` bloqueado `app.json:47-50` | No hay audio ni voz | `src/lib/voice.ts` es un banco de frases, no voz. |
| Notificaciones | `src/lib/notifications.ts:128-130`; entitlement `time-sensitive` `app.json:20-22`, usado en `src/lib/notifications.ts:185` y `:239` | Avisos y empujes del coach | Correcto: el entitlement se usa. |
| Salud (HealthKit) | Ninguna dependencia ni entitlement | Registro manual | No usa HealthKit. |
| Ubicación, contactos del teléfono, Bluetooth, seguimiento | No hay | — | — |
| Cifrado | `app.json:18` `ITSAppUsesNonExemptEncryption: false`; ASC build 18 `usesNonExemptEncryption: false` | Solo HTTPS del sistema | Coherente. Sin documentación de exportación adicional. |
| iPad | `app.json:13` `supportsTablet: false` | Solo iPhone | No hacen falta capturas de iPad. |

## 3. Inventario de datos recogidos (código → servidor)

| Dato | Dónde se recoge / guarda | Vinculado a la identidad |
|---|---|---|
| Nombre/alias, correo, contraseña (Auth) | `src/app/login.tsx:81`; `supabase/functions/franky-auth/index.ts:109-117`; `profiles` `supabase/migrations/0001_init.sql:4` | Sí (UUID de Supabase) |
| Retrato (avatar) visible a amigos | `src/app/(tabs)/perfil.tsx:231`; bucket `avatars`; revisión `social_profile_reviews` `supabase/migrations/0032_social_safety.sql:12` | Sí |
| Misiones, completados, eventos de juego (XP, rachas) | `0001_init.sql:19`, `:34`, `:45`; `insertEvent` `src/lib/data.ts:171-181` | Sí |
| Peso, ficha física, lesiones, nutrición, cardio, prescripciones | `0007_avances.sql:5`; `0012_cuerpo.sql:31`, `:57`, `:77`, `:101`; ficha del coach (`fijar_ficha`, `_shared/tools.ts`) | Sí |
| Diario (texto, ánimo, energía) y sus fotos | `journal_entries`, `journal_photos` (lista en `src/lib/exporter.ts:10-60`) | Sí |
| Finanzas personales | `0013_dinero.sql:19`, `:41`, `:82`, `:95`, `:109` | Sí |
| Conversación, memoria y ejecuciones del coach (modelo, consumo) | `0008_coach.sql:29`, `:39`, `:55`, `:69`, `:128` | Sí |
| Fotos de evidencia | `src/lib/photos.ts:50-66` (`quest_photos`) | Sí |
| Grafo social, bloqueos, denuncias | `0021_amigos.sql:110`, `:143`; `0032_social_safety.sql:5`, `:19`, `:32` | Sí |
| Compras y estado de suscripción | `store_events` `0027_tienda.sql:28`; `store_sales`/`referrals` `0025_creadores.sql:78`, `:87` | Sí |
| Código de creador | `src/lib/creators.ts:33` (AsyncStorage local) y `src/lib/pro.ts:173` (RevenueCat) | Sí |
| Consentimientos de IA, de salud y confirmación de edad | `0028_consentimiento_ia.sql:44`, `:175`; `0030_consentimiento_salud.sql:5` | Sí |
| Token push | `src/lib/push.ts:37-45` | Sí |
| Identificador de instalación y error fatal (Expo Updates) | ver §1 | Sí según Apple (identificador persistente); NO PROBADO en este worktree |
| Soporte por correo | `src/lib/socialSafety.ts:15` (`/soporte`) | Sí (correo) |

**Datos que el código NO recoge**: ubicación, contactos del teléfono, audio, historial de navegación/búsqueda, datos publicitarios, datos de pago (la tarjeta la gestiona Apple), escaneo corporal o del entorno.

## 4. UGC, IA, salud, edad, borrado y exportación

- **UGC (1.2)**: lo visible para otros es alias, título y retrato, más marcadores. No hay chat entre usuarios (`docs/MODERACION-SOCIAL.md:7`). Hay moderación previa: alias, título y retrato solo se publican tras revisión humana (`docs/MODERACION-SOCIAL.md:7`; tabla `0032_social_safety.sql:12`). Denuncia con 4 motivos (`src/lib/socialSafety.ts:2-7`, RPC `src/lib/social.ts:216-218`, UI `src/app/amigos.tsx:326-331`, `:1031-1038`). Bloqueo y desbloqueo (`src/lib/social.ts:206-213`, `src/app/amigos.tsx:336-361`, `:1039`). Contacto publicado (`src/lib/socialSafety.ts:15`). Botón «…» por fila (`src/app/amigos.tsx:190-195`). **Pendiente: que haya una persona operando la cola** (`docs/MODERACION-SOCIAL.md:3`) y que 0032 esté aplicada en producción: NO PROBADO (Chat 3).
- **IA**: el consentimiento enumera datos y proveedores (`src/lib/consentmath.ts:24-58`). El servidor bloquea sin consentimiento (`supabase/functions/_shared/consent.ts:1-30`), también en los rituales (`supabase/functions/ritual/index.ts:355`). Los adjuntos de imagen van al modelo en base64 (`supabase/functions/coach/index.ts:340-345`) y en el historial solo se guarda una marca (`:353-362`).
- **Salud**: el consentimiento explícito de salud está en `src/components/ConsentimientoSalud.tsx:91`, `:124` y `:144`, y su borrado en `supabase/functions/_shared/health-erasure.ts:34`. Descargo y línea de crisis en `src/lib/consentmath.ts:61-65`.
- **Edad mínima**: 16, por declaración (`src/lib/consentmath.ts:16`; `src/components/EdadMinima.tsx:118-125`). No es una verificación. ASC: `appStoreAgeRating: SEVENTEEN_PLUS`, Brasil `SELF_RATED_SIXTEEN` (JSON `appInfos`). La declaración de la versión no se puede leer (`ageRating.error` 404 en el JSON): **cuestionario NO VERIFICADO EN ASC**.
- **Borrado de cuenta (5.1.1(v))**: Perfil > Cuenta > «Eliminar cuenta» (`src/app/(tabs)/perfil.tsx:884`, hoja `:915-922`). Llama a `account-erasure` (`src/lib/account.ts:7-21`), que borra Storage (`_shared/account-erasure.ts:52-55`) y el usuario de Auth (`:49`). **Alcance: solo NIVL; la cuenta de Franky creada desde NIVL se conserva** (`src/app/login.tsx:173`, `:308`). Ver el riesgo R-PRIV-3 (RESUELTO el 02/10: sin Franky).
- **Exportación**: «Exportar mis datos» (`src/app/(tabs)/perfil.tsx:865`), con las tablas de `src/lib/exporter.ts:10-63` (incluye `health_consents` y `ai_consents`).
- **Política de privacidad dentro de la app (5.1.1(i))**: enlace en las hojas de consentimiento de IA y de salud (`src/components/ConsentimientoIA.tsx:114-119`, `src/components/ConsentimientoSalud.tsx:116-117`) y en el paywall (`src/components/ProOffer.tsx:514-520`). **No hay un enlace permanente en Perfil** (búsqueda sin resultados en `src/app/(tabs)/perfil.tsx`). Ver R-PRIV-4.

## 5. Tabla de App Privacy de Apple

Definiciones: [App privacy details](https://developer.apple.com/app-store/app-privacy-details/) (consultada el 02/10/2026). F = Funcionalidad de la app; P = Personalización del producto; A = Análisis. La columna «ASC» compara con `privado/appstore-privacidad.md` (17 categorías, 27/09) y `docs/appstore-review-2026-09-29/PRIVACIDAD-FICHA.md`.

| Categoría de Apple | ¿Recogido? | Vinculado | Tracking | Finalidades | Evidencia en código | ASC (estado) |
|---|---|---|---|---|---|---|
| Contacto · Nombre | Sí | Sí | No | F; P | `0001_init.sql:4`; `franky-auth/index.ts:109` | Propuesto en el archivo privado. NO VERIFICADO EN ASC |
| Contacto · Correo electrónico | Sí | Sí | No | F | `login.tsx:81`; `franky-auth/index.ts:109-117` | Propuesto. NO VERIFICADO EN ASC |
| Contacto · Teléfono / Dirección / Otra | No | — | — | — | — | Declarado no recogido. Correcto |
| Salud y forma física · Salud | Sí | Sí | No | F; P | `0007_avances.sql:5`; `0012_cuerpo.sql:77`; ficha física | Visible en la captura del 28/09 («Salud y forma física») |
| Salud y forma física · Forma física | Sí | Sí | No | F; P | `0012_cuerpo.sql:31`, `:101`; gym | Ídem |
| Financiera · Otra información financiera | Sí | Sí | No | F; P | `0013_dinero.sql:19-109` | Propuesto. NO VERIFICADO EN ASC |
| Financiera · Pago / Solvencia | No | — | — | — | Apple cobra | Correcto |
| Ubicación | No | — | — | — | — | Correcto |
| Información confidencial | No como dato pedido de forma específica | — | — | — | Texto libre: «Otro contenido» | Correcto según la guía de texto libre de Apple |
| Contactos (grafo social) | Sí | Sí | No | F | `0021_amigos.sql:110` | Propuesto. NO VERIFICADO EN ASC |
| Contenido · Correos o mensajes | Sí (chat con el coach) | Sí | No | F; P | `0008_coach.sql:69` | Propuesto. NO VERIFICADO EN ASC |
| Contenido · Fotos o vídeos | Sí (fotos) | Sí | No | F; P | `photos.ts:50-66`; avatares; `coach.tsx:248-256` | Propuesto. NO VERIFICADO EN ASC |
| Contenido · Audio | No | — | — | — | `app.json:72` | Correcto |
| Contenido · Contenido de juego | Sí | Sí | No | F; P | `0001_init.sql`; marcadores | Propuesto. NO VERIFICADO EN ASC |
| Contenido · Atención al cliente | Sí (correo a soporte) | Sí | No | F | `/soporte` | Propuesto. NO VERIFICADO EN ASC |
| Contenido · Otro contenido del usuario | Sí (misiones, diario, agenda, denuncias) | Sí | No | F; P | `0001_init.sql:19`; `0032_social_safety.sql:19` | «Contenido del usuario» visible el 28/09; subtipos NO VERIFICADOS |
| Historial de navegación / búsqueda | No | — | — | — | — | Correcto |
| Identificadores · ID de usuario | Sí | Sí | No | F; A | `pro.ts:126` | «Identificadores» visible el 28/09; subtipos NO VERIFICADOS |
| Identificadores · ID de dispositivo | Sí (token push; ID de instalación de Expo) | Sí | No | F; A | `push.ts:30-45`; Expo Updates | Ídem |
| Compras · Historial de compras | Sí | Sí | No | F; A | `0027_tienda.sql:28`; RevenueCat | Propuesto. NO VERIFICADO EN ASC |
| Uso · Interacción con el producto | Sí | Sí | No | F; A | `data.ts:178`; `0008_coach.sql:128` | Propuesto. NO VERIFICADO EN ASC |
| Uso · Datos publicitarios / Otros datos de uso | No / ver «Otros tipos de datos» | — | — | — | — | — |
| Diagnóstico · Datos de errores | Sí (Expo Updates) | Sí | No | F | `app.json:101`; Expo | Propuesto. NO VERIFICADO EN ASC |
| Diagnóstico · Rendimiento / Otros | No identificado | — | — | — | — | Correcto con la evidencia actual |
| Entorno, manos, cabeza | No | — | — | — | — | Correcto |
| Otros tipos de datos | Sí (código de creador; consentimientos; edad declarada) | Sí | No | F (A para creador) | `pro.ts:173`; `0028_consentimiento_ia.sql:44`, `:175` | El archivo privado solo cita el código de creador |

**Estado en ASC:** las capturas del 28/09 muestran que la ficha se **publicó** («Publicada hace unos segundos», `privado/apple-privacidad-publicada.png`, archivo de las 09:13 del 28/09). En la vista previa se ven «Identificadores», «Salud y forma física» y «Contenido del usuario» bajo «Datos vinculados contigo»; el resto queda fuera del encuadre. **Que estén las 17 categorías, sus finalidades y «sin tracking» está NO VERIFICADO EN ASC.**

## 6. Discrepancias y correcciones propuestas

| # | Discrepancia | Corrección propuesta | Dueño |
|---|---|---|---|
| D1 | Las citas `archivo:línea` de `privado/appstore-privacidad.md` remiten a otro checkout (`agent-a6669857…`). Algunas ya no coinciden (por ejemplo, `src/lib/data.ts:182`; hoy el insert de eventos está en `:178`). | Usar este documento como evidencia actualizada en la respuesta; no citar líneas antiguas. | Chat 1 |
| D2 | Después del 28/09 entraron 0032 (denuncias, revisiones y bloqueos), 0033 (reconciliación con RevenueCat) y 0034. Las denuncias son contenido del usuario nuevo y el archivo privado no las menciona. | Revisar en ASC que «Otro contenido del usuario» tiene marcada F. No hace falta una categoría nueva. Guardar una captura de **todas** las categorías (no solo el encabezado). | Chat 1 vía coordinador (en ASC) |
| D3 | `PRIVACIDAD-FICHA.md` habla de proveedores «posibles» y la doc de producto dice «Pro por DeepSeek». El enrutado real depende de `ai_plans.routes` y de secretos. | No afirmar en la respuesta a Apple qué modelo usa cada plan sin la confirmación de Chat 3. El consentimiento (`consentmath.ts:39-42`) promete DeepSeek para Pro y la prueba: debe coincidir con producción. | Chat 3 confirma; Chat 1 redacta |
| D4 | Franky recibe nombre, correo y contraseña al registrarse, con atribución `utm_source: nivl` (`franky-auth/index.ts:109-117`). El archivo privado lo presenta como «servicio de acceso», no como destinatario. | Si Franky es la misma persona responsable: declararlo en la política como servicio propio. Si es otra entidad: tratarla como destinataria en la política y en la respuesta 4 de Apple (servicios externos). Las etiquetas de Apple no cambian (no hay tracking). | Dueño + Chat 1 |
| D5 | «Otros tipos de datos» solo justifica el código de creador; los consentimientos y la edad declarada también son datos vinculados. | Mantener la categoría con F. No hace falta un tipo nuevo. Mencionarlo en la evidencia. | Chat 1 (documental) |
| D6 | ID de dispositivo / Datos de errores por Expo Updates: evidencia en `node_modules`, que no está en este worktree. | Chat 3 (o un `npm ci` en sandbox) debe confirmar que `expo-updates 29.0.x` envía `EAS-Client-ID` y `Expo-Fatal-Error`. Mientras tanto, mantener la declaración (es lo prudente). | Chat 3 |
| D7 | Privacy Manifest (`PrivacyInfo.xcprivacy`) del binario: no hay evidencia en el repo. | Comprobar en el `.ipa` de la build 20 que se agregan los manifiestos de Expo y RevenueCat, y que ASC no muestra avisos de «required reason API». NO PROBADO. | Chat 2 / Chat 3 |

## 7. Riesgos de privacidad para el reenvío (no son defectos señalados por Apple)

- **R-PRIV-1 (P0 de lanzamiento): DSA / estado de comerciante en la UE.** En el JSON de territorios, los 27 países de la UE (incluida **ESP**) tienen `TRADER_STATUS_NOT_PROVIDED` además de `CANNOT_SELL` (`privado/asc-chat1-readonly-prices-20261002.json`, `territories`). Sin estado de comerciante la app no se distribuye en la UE, que es su mercado principal. El archivo privado dice «DSA sigue en revisión». No bloquea la revisión, pero sí la publicación en España. Dueño: titular de la cuenta (lo coordina Chat 1).
- **R-PRIV-2 (RESUELTO el 02/10: 165 territorios) (P1): China continental con IA generativa y DeepSeek.** La app está disponible en 175 territorios, incluidos **CHN** y RUS (`territoryTotal: 175`). Desde 2023, Apple retira de China continental las apps de IA generativa sin licencia administrativa (MIIT/CAC), y además exige el número de registro ICP. Fuentes: [TechNode, 02/08/2023](https://technode.com/2023/08/02/apple-widely-removing-generative-ai-apps-from-chinas-app-store/) y [China Digital Times, 08/2023](https://chinadigitaltimes.net/2023/08/generative-ai-apps-removed-from-apples-chinese-app-store/), consultadas el 02/10/2026. **No se ha encontrado una página oficial de Apple con el requisito**: se apoya en prensa, NO PROBADO en fuente primaria. Propuesta: quitar China continental de la disponibilidad y decirlo en la respuesta 5 («diferencias regionales»). Valorar también RUS: las compras de App Store llevan suspendidas allí desde 2022 (dato de conocimiento general, NO PROBADO hoy).
- **R-PRIV-3 (P1): alcance del borrado.** La cuenta se crea en Franky desde la app (`login.tsx:173`, `:308`), pero el borrado solo elimina NIVL. La guía de Apple pide «delete the entire account record» y no trata las cuentas compartidas entre servicios ([Offering account deletion](https://developer.apple.com/support/offering-account-deletion-in-your-app/), consultada el 02/10/2026). Propuesta: en la hoja de borrado y en las notas, explicar cómo borrar también la cuenta de Franky (enlace directo). Si es posible, ofrecer un borrado completo desde la app. Dueño: Chat 4 (UI) + dueño (Franky).
- **R-PRIV-4 (P2): la política de privacidad no tiene un acceso permanente en la app.** Solo aparece en hojas de consentimiento y en el paywall. La 5.1.1(i) pide un acceso «easily accessible». Propuesta: fila «Privacidad y términos» en Perfil > Cuenta. Dueño: Chat 4.
- **R-PRIV-5 (DECIDIDO: dominio único; pendiente de código, Chat 4) (P2): `nivl.app`.** La tarjeta para compartir y `URL_NIVL` apuntan a `https://nivl.app` (`src/lib/socialmath.ts:236`), y `associatedDomains` lo incluye (`app.json:14`). La memoria del proyecto indica que el dominio no está comprado. Una URL de terceros en contenido compartido no es un problema de etiquetas, pero sí de completitud (2.1). Dueño: dueño / Chat 4.

## 8. Pendiente de confirmar por Chat 3 (Seguridad)

1. Región real del proyecto Supabase y de Storage. ¿Coincide con «Frankfurt» de la política publicada?
2. Filas actuales de `ai_plans.routes` para `pro_*`, `elite_*`, `cortesia` (prueba) y `owner`, y el valor de `COACH_BASE_URL`. ¿Va hoy algún turno a DeepSeek? ¿Coincide con `src/lib/consentmath.ts:39-42`?
3. ¿Están aplicadas en producción 0028–0034 y desplegadas `account-erasure`, `store-reconcile`, `revenuecat-webhook` y `coach` con la versión de este SHA?
4. ¿Hay una persona asignada a la cola de `social_reports` y `social_profile_reviews`? ¿Cuántas denuncias abiertas y con qué antigüedad?
5. Integraciones activas en el panel de RevenueCat (atribución, Meta/AppsFlyer/Adjust, recogida de identificadores de dispositivo). Si hay alguna publicitaria, la respuesta de tracking cambia.
6. ¿Recibe Expo algo más que el token push y las solicitudes de actualización (por ejemplo, EAS Insights activado en el proyecto)?
7. Conservación: ¿qué queda en `store_events`, `store_sales` y `commissions` tras borrar una cuenta (la política habla de 6 años para contabilidad)? ¿Queda vinculado al UUID?
8. ¿Recibe Franky algo más que el alta y el inicio de sesión (por ejemplo, eventos, nombre de perfil o la atribución `utm_source`)? ¿Es la misma persona responsable?
9. ¿Los buckets `evidence` y `avatars` son privados, con URL firmadas, y no hay listados públicos?

## 9. Fuentes consultadas el 02/10/2026

- Apple, [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/): 1.2, 2.1, 2.3.3, 2.3.10, 3.1.1, 3.1.2, 5.1.1(i), 5.1.1(v). La página consultada no mostraba fecha de actualización.
- Apple, [App privacy details](https://developer.apple.com/app-store/app-privacy-details/): categorías, «linked», «tracking», divulgación opcional, texto libre y SDK de terceros.
- Apple, [Offering account deletion in your app](https://developer.apple.com/support/offering-account-deletion-in-your-app/).
- NIVL, [Política de privacidad](https://nivl-web.vercel.app/privacidad), versión 1.2 del 29/09/2026: nombra Supabase (Frankfurt), Anthropic, DeepSeek (China), RevenueCat, Expo, Apple/Google, Franky, Vercel y Google Fonts.

## 10. Respuestas del Chat 3 (02/10/2026, solo lectura: Management API GET y catálogo SQL)

| # | Pregunta (§8) | Respuesta | Consecuencia para las declaraciones |
|---|---|---|---|
| 1 | Región | eu-central-1 (Frankfurt). Storage, en el mismo proyecto | «Frankfurt» en la respuesta a Apple y en la política: **PASS** |
| 2 | Rutas de IA | `pro_*`, `mensual`, `anual` y `cortesia` (prueba) → `deepseek-v4-flash`; `elite_*` → `claude-sonnet-5`. COACH_BASE_URL y COACH_API_KEY configurados, pero su valor no se ha leído | Coherente con `consentmath.ts:39-42` y con el punto 4 de la respuesta. **Falta que el dueño confirme que COACH_BASE_URL es DeepSeek** |
| 3 | Despliegue | 0028–0036 aplicadas. coach v58, oracle v9, ritual v29, revenuecat-webhook v4, account-erasure v1 y store-reconcile v1 (29/09); health-erasure v2 y franky-auth v6 (27/09). No se ha verificado que el código desplegado sea el de esta base | El SHA desplegado lo tiene que acreditar el coordinador antes del reenvío |
| 4 | RevenueCat | Sin SDK de atribución ni de publicidad, y sin IDFA, en el código. Las integraciones del panel de RevenueCat **NO VERIFICADAS** | «Tracking = No» queda condicionado a que el dueño revise el panel (Integrations) |
| 5 | Expo | Solo token push y Updates. EAS Insights en la cuenta **NO VERIFICADO** | Ídem: el dueño revisa la cuenta de Expo |
| 6 | Conservación | `store_sales`: importe y transaction_id con `user_id=NULL`. Comisiones sin user_id. **No hay ningún plazo legal definido** (no declarar «6 años»). `store_events`: seudonimización propuesta, no aplicada. Suscriptor de RevenueCat: se borrará (DELETE), **aún no desplegado** | La frase de la respuesta («limited records may be kept only where the law requires») es correcta si lo que queda está desvinculado. Antes de reenviar hay que verificar que el borrado de RevenueCat y de `store_events` está desplegado, o ajustar la política |
| 7 | Buckets | `evidence` y `avatars`: privados, 5 MB, sin listado, RLS por carpeta y URL firmadas | PASS (caducidad de las firmadas pendiente en el informe de RLS) |
| 8 | Franky | Tras la auth nativa, el cliente no envía nada a Franky. No hay migración: las 8 cuentas antiguas conservan su uuid. **La función franky-auth sigue desplegada** | Si la build enviada ya no usa Franky, retirar o desactivar franky-auth antes del reenvío y quitar Franky de App Privacy y Data Safety. Si se envía una build que aún lo usa, Franky es destinatario de nombre, correo y contraseña y hay que declararlo |

### 10.1 Actualización del 02/10/2026 (coordinador y Chat 3)

- **IA:** el usuario confirma COACH_BASE_URL = DeepSeek, y el coordinador verificó que cortesía y Pro usan `deepseek-v4-flash` → la declaración de proveedores de IA queda **cerrada**.
- **EAS Insights:** desactivado (lo confirma el usuario).
- **Integraciones de RevenueCat:** **pendientes** (las comprueba el coordinador). «Tracking = No» queda condicionado solo a esto.
- **Conservación tras el borrado** (Chat 3; texto literal pasado al Chat 4 para `/privacidad` §7): se conservan las compras, los reembolsos y las comisiones (id de transacción de la tienda, producto, importe, moneda y fecha) con `user_id = NULL`. El plazo citado es el general del Código de Comercio (6 años), **sin purga automática**: no declarar que se borran al vencer.
  - Para App Privacy: mientras la cuenta existe, «Purchases / Purchase history» está **vinculado** a la identidad. Lo que queda después es **seudónimo**, no anónimo: el id de transacción lo puede asociar Apple o Google. No declararlo como «no vinculado» para el uso normal.
  - El borrado del cliente de RevenueCat (`e3c9ba1`) y la reducción de `store_events` a `{id, type}` están **pendientes de desplegar**. La frase de borrado de la respuesta a Apple no los afirma (dice «limited records may be kept only where the law requires, as described in the Privacy Policy»): se mantiene.
