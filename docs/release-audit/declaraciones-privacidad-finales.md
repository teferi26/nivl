# Declaraciones finales: App Privacy (Apple) y Data Safety (Google Play)

> **Actualización del 21/10/2026:** DeepSeek no recibe datos desde el 12/10. El coach de Pro y la prueba van con Anthropic (Claude Haiku). En Data Safety, los proveedores son Supabase, RevenueCat, Anthropic, Resend, Expo y Google. Para la 1.0.11, ver `coordinacion-winter-arc/FICHA-1011.md` §5.

**Para el coordinador.** La declaración la aplica el coordinador con el usuario en App Store Connect y en Play Console. Chat 1 no la ha cambiado. Se basa en la build **1.0.7 (21)**, SHA `c87df0d`: Supabase Auth propio, sin Franky, y paywall final. Si cambia el código o se añade algún SDK, proveedor o evento de medición, este documento se reabre.

## Fuentes de los hechos (02/10/2026)

- Inventario de datos del código: [apple-privacidad-datos.md](apple-privacidad-datos.md) §3 y §5 (con archivo:línea).
- Chat 3, servidor (§10): Supabase en eu-central-1 (Frankfurt). Pro y la prueba usan `deepseek-v4-flash` y Élite usa `claude-sonnet-5` (el usuario confirmó COACH_BASE_URL = DeepSeek). Buckets privados. Conservación tras el borrado: compras, reembolsos y comisiones con `user_id = NULL`, seudónimos, sin purga automática.
- Usuario, vía coordinador:
  - EAS Insights desactivado.
  - En RevenueCat solo está activa la integración de **Webhooks** (sin atribución, publicidad ni analítica).
  - «Handling multiple app user IDs = transfer».
- Manifiestos de privacidad de los SDK del binario (`node_modules` del checkout de integración): async-storage, expo-application, constants, device, file-system, notifications, system-ui y react-native **no declaran ningún dato recogido**, y los que lo indican, `NSPrivacyTracking=false`. No hay SDK de analítica, publicidad, atribución ni informes de fallos (Chat 3 y `package.json`).
- RevenueCat ([Apple App Privacy](https://www.revenuecat.com/docs/platform-resources/apple-platform-resources/apple-app-privacy), consultada el 02/10/2026): obliga a declarar **Purchases** con las finalidades **Analytics** y **App Functionality**.

**Actualización (Chat 3 @e5eeefa, 02/10):** se añade **Resend** como proveedor del envío de los correos de Auth (confirmación, recuperación y cambio de correo). Recibe el correo electrónico y el contenido del mensaje (un enlace de un solo uso). Sin tracking. **No añade categorías** en Apple: el correo ya está declarado, vinculado y con finalidad App Functionality. En Data Safety actúa como encargado, así que no cuenta como «compartido». Región de envío: UE (MX de rebotes en eu-west-1, Irlanda; DNS público leído por el Chat 3 el 02/10). Resend Inc. es una empresa de EE. UU., y la política cita su DPA. El estado «Verified» en el panel de Resend lo confirma el dueño. `team@nivl.app` NO recibe correo (no hay MX en la raíz): no usarlo como contacto en la ficha ni en la respuesta, sino el soporte publicado. Remitente `team@nivl.app`: el usuario compró `nivl.app` el 02/10. El dominio está verificado en Resend (DKIM, SPF y DMARC resuelven) y el usuario ha recibido en el iPhone un correo real de recuperación. Para la confirmación de registro abriendo la app, NO PROBADO (A2). `nivl.app` se usa **solo para el correo**; la web y los enlaces legales siguen en `nivl-web.vercel.app`.

## 1. App Privacy de Apple

**¿Recoge datos?** Sí. **¿Tracking?** **No**: no hay IDFA, ni ATT, ni datos combinados con terceros para publicidad, ni brókeres de datos. **Vinculados a la identidad:** todos, porque la app exige cuenta.

| Tipo de dato de Apple | Declarar | Vinculado | Tracking | Finalidades | Motivo |
|---|---|---|---|---|---|
| Contact Info › Name | Sí | Sí | No | App Functionality | Nombre del perfil, visible en Amigos y ludus tras la moderación |
| Contact Info › Email Address | Sí | Sí | No | App Functionality | Acceso, confirmación y recuperación de la cuenta |
| Contact Info › Phone / Physical Address / Other | No | — | — | — | No se piden |
| Health & Fitness › Health | Sí | Sí | No | App Functionality, Product Personalization | Peso, ficha física y datos de salud introducidos por el usuario; el coach los usa para personalizar (con consentimiento) |
| Health & Fitness › Fitness | Sí | Sí | No | App Functionality, Product Personalization | Gimnasio, cardio y nutrición |
| Financial Info › Other Financial Info | Sí | Sí | No | App Functionality, Product Personalization | Movimientos y presupuesto que introduce el usuario |
| Financial Info › Payment Info / Credit Info | No | — | — | — | Cobra Apple; NIVL no ve medios de pago |
| Location | No | — | — | — | No se usa |
| Sensitive Info | No | — | — | — | No se pide como categoría específica. El texto libre se declara en «Other User Content», según la guía de Apple |
| Contacts | Sí | Sí | No | App Functionality | Grafo social propio: amigos, solicitudes y ludus. **No** se accede a la agenda del teléfono |
| User Content › Photos or Videos | Sí | Sí | No | App Functionality | Avatar y fotos de evidencia (buckets privados) |
| User Content › Gameplay Content | Sí | Sí | No | App Functionality | Misiones, XP, rangos y rankings entre amigos |
| User Content › Customer Support | Sí | Sí | No | App Functionality | Correos a soporte y denuncias |
| User Content › Other User Content | Sí | Sí | No | App Functionality, Product Personalization | Hábitos, agenda, diario, conversación con el coach y texto libre |
| User Content › Emails or Text Messages / Audio | No | — | — | — | No hay mensajería entre usuarios ni audio |
| Browsing / Search History | No | — | — | — | — |
| Identifiers › User ID | Sí | Sí | No | App Functionality | UUID de la cuenta, también como app user ID de RevenueCat |
| Identifiers › Device ID | Sí | Sí | No | App Functionality | Token de notificaciones push (Expo/APNs). Declaración conservadora: no es el IDFA |
| Purchases › Purchase History | Sí | Sí | No | App Functionality, **Analytics** | Obligatorio con RevenueCat (validación y panel). Las compras se conservan seudonimizadas tras el borrado |
| Usage Data › Product Interaction | Sí | Sí | No | App Functionality, Analytics | Eventos propios (por ejemplo, objetivo del onboarding) y uso del coach para su presupuesto. Sin SDK de terceros |
| Usage Data › Advertising Data / Other Usage Data | No | — | — | — | — |
| Diagnostics › Crash / Performance / Other | **No** | — | — | — | No hay SDK de informes de fallos, y los manifiestos no declaran nada. Expo Updates solo descarga actualizaciones. **Si se añade Sentry u otro similar, cambia a Sí** |
| Surroundings / Body | No | — | — | — | — |
| Other Data | Sí | Sí | No | App Functionality | Edad declarada (16+), consentimientos de salud e IA, y código de creador opcional |

### Cambios respecto a lo publicado el 28/09

Lo publicado en ASC no se ha podido leer entero (ver apple-privacidad-datos.md §5). Al aplicar esto, el coordinador debe comparar categoría por categoría y anotar las diferencias. Las candidatas probables son: **Purchases** con la finalidad Analytics, **Contacts** (grafo social), **Customer Support** (denuncias), **Other Data** (edad y consentimientos) y el **Diagnostics = No** explícito. Franky no aparece como destinatario: la build 21 no lo usa y el coordinador retira franky-auth.

## 2. Data Safety de Google Play (borrador para cuando exista la app en Play)

Respuestas generales:
- ¿Recoge o comparte datos? **Sí**, los recoge.
- ¿Están cifrados en tránsito? **Sí** (HTTPS/TLS con Supabase, RevenueCat y los proveedores de IA).
- ¿Se puede pedir el borrado? **Sí**: en la app (Perfil > Cuenta > «Eliminar cuenta») y en la URL web https://nivl-web.vercel.app/borrar-cuenta (200, verificada el 02/10).
- ¿Usa el ID de publicidad? **No** (PROPUESTA en app.json: bloquear `com.google.android.gms.permission.AD_ID`).
- **Compartir:** los proveedores que tratan datos por cuenta de NIVL (Supabase, RevenueCat, Anthropic, Resend, Expo push y Google) son **encargados del tratamiento**, y según la definición de Google eso no es «compartir». Se declara **no compartido**, con la condición de que el usuario confirme que existen el contrato de encargado con Anthropic (sus condiciones de API). Si no es así, se declaran como compartidos para la funcionalidad de la app.

| Categoría de Data Safety | Tipo | Recogido | Obligatorio u opcional | Finalidades |
|---|---|---|---|---|
| Información personal | Nombre | Sí | Obligatorio | Funcionalidad de la app, gestión de la cuenta |
| Información personal | Dirección de correo | Sí | Obligatorio | Gestión de la cuenta, funcionalidad |
| Información personal | ID de usuario | Sí | Obligatorio | Funcionalidad, gestión de la cuenta |
| Información financiera | Historial de compras | Sí | Opcional (solo si compra) | Funcionalidad, analíticas |
| Información financiera | Otra información financiera | Sí | Opcional | Funcionalidad, personalización |
| Salud y forma física | Información de salud | Sí | Opcional (requiere consentimiento) | Funcionalidad, personalización |
| Salud y forma física | Información de forma física | Sí | Opcional | Funcionalidad, personalización |
| Mensajes | Otros mensajes en la app | Sí (conversación con el coach) | Opcional | Funcionalidad, personalización |
| Fotos y vídeos | Fotos | Sí | Opcional | Funcionalidad |
| Actividad en la app | Interacciones con la app | Sí | Obligatorio | Funcionalidad, analíticas |
| Actividad en la app | Otro contenido generado por el usuario | Sí | Opcional | Funcionalidad, personalización |
| Información y rendimiento de la app | Registros de fallos / Diagnóstico | **No** | — | — |
| Dispositivo u otros IDs | Dispositivo u otros IDs | **NO PROBADO en Android**: sin FCM no hay token push remoto. Si se configura FCM, **Sí** (funcionalidad) | — | — |
| Ubicación, contactos del teléfono, calendario, audio, archivos, navegación, apps instaladas | — | No | — | — |

## 3. Pendiente antes de aplicar

- [ ] El coordinador compara con lo publicado y aplica el apartado 1 en ASC (Privacidad de la app), con captura de evidencia en `privado/`.
- [ ] Se despliegan desde `c87df0d` el borrado del cliente de RevenueCat y la seudonimización de `store_events`. La declaración de Apple no cambia por esto, pero la política y la respuesta lo describen.
- [ ] El usuario confirma la condición de encargado de Anthropic, para el «compartir» de Data Safety.
- [ ] Data Safety: se aplica cuando exista la app en Play Console y estén la URL web de borrado y la decisión sobre FCM.
