# Seguridad de los datos y App content de NIVL 1.1.0 en Google Play

Fecha: 9 de noviembre de 2026. Sacado del código y del manifiesto generado con `npx expo prebuild --platform android --no-install` sobre una copia temporal. No se ha compilado el AAB: los permisos de dependencias se han leído en sus propios manifiestos. Definiciones: [Data safety](https://support.google.com/googleplay/android-developer/answer/10787469?hl=es).

Nada de esto se ha introducido en Play Console.

## Android no es iOS

Esta ficha describe solo la app de Android. Lo que cambia:

| Función | iOS | Android |
|---|---|---|
| Apple Salud | Sí | **No.** `nivl-salud` declara solo `apple` (`modules/nivl-salud/expo-module.config.json`) y `saludNativa.ts:85` carga el módulo solo si `Platform.OS === 'ios'` |
| Health Connect | | **No existe** |
| GPS durante el entreno | Sí | **No.** Sin permiso de ubicación en el manifiesto. La pantalla lo dice (`medicion.json`, `gps.noDisponible.android`) |
| Apple Watch y Apple TV | Sí | No |
| Mapa nativo | Sí | No: dibujo SVG sin clave de Google (`src/components/resistencia/moduloMapas.ts`) |
| Calendario del teléfono | Sí | Sí |
| Salud y entrenos a mano, coach, economía, dictado | Sí | Sí |

Si una misma cuenta se usa también en iPhone, sus datos de Salud y rutas están en el servidor, pero la app de Android no los recoge.

## Preguntas generales

| Pregunta | Respuesta |
|---|---|
| ¿Recoge o comparte datos de los tipos requeridos? | Sí |
| ¿Todos los datos se cifran en tránsito? | Sí. Supabase, Anthropic, RevenueCat, Expo y Open-Meteo van por https |
| ¿Se ofrece un modo de solicitar el borrado? | Sí |
| URL de borrado | https://nivl.app/borrar-cuenta (responde 200, explica los dos caminos, el plazo de 30 días y lo que se conserva) |

Cómo se borra: Perfil, Cuenta, Eliminar cuenta (`src/components/perfil/PerfilAjustes.tsx:366`, `src/lib/account.ts`, `supabase/functions/_shared/account-erasure.ts`). Borra archivos de Storage, cliente de RevenueCat y usuario de Auth, y las tablas caen en cascada. Hay además borrado parcial: «Retirar y borrar salud» (`health-erasure`).

## Compartido: por qué va No en todas las filas

Google no cuenta como compartir la transferencia a proveedores que tratan datos solo por cuenta del desarrollador, ni la hecha tras aviso y consentimiento destacados.

- Anthropic: proveedor, y hay hoja de consentimiento previa. Depende de dos cosas sin cerrar: el contrato con Anthropic no se ha visto, y la hoja no nombra el calendario (hallazgos P2 y P3). Hasta cerrarlas, la respuesta prudente en Calendario es **compartido: Sí**.
- Open-Meteo: coordenadas redondeadas, de servidor a servidor, sin identificador (`_shared/tiempo.ts:50-60`).
- RevenueCat y Expo: proveedores.

## Respuestas por tipo

Si no se indica otra cosa: compartido No, no efímero.

| Categoría | Tipo | Recogido | Obligatorio | Finalidades | De dónde sale |
|---|---|---|---|---|---|
| Ubicación | Aproximada | Sí | Opcional | Funcionalidad, Personalización | Ciudad elegida a mano (`resistencia.ts:232`). No es del dispositivo |
| Ubicación | Precisa | **No** | | | Sin permiso ni GPS en Android |
| Información personal | Nombre | Sí | Obligatorio | Funcionalidad, Personalización, Gestión de cuentas | `profiles.name` |
| Información personal | Dirección de correo | Sí | Obligatorio | Funcionalidad, Gestión de cuentas | `src/lib/authFlow.ts` |
| Información personal | IDs de usuario | Sí | Obligatorio | Funcionalidad, Gestión de cuentas, Análisis | uuid de Supabase, `appUserID` en RevenueCat |
| Información personal | Dirección, teléfono, etnia, política o religión, orientación | No | | | Sin campo |
| Información personal | Otra información | No | | | |
| Información financiera | Información para pagos | No | | | Lo lleva Google Play |
| Información financiera | Historial de compras | Sí | Opcional | Funcionalidad, Análisis | RevenueCat, `subscriptions` |
| Información financiera | Calificación crediticia | No | | | |
| Información financiera | Otra información financiera | Sí | Opcional | Funcionalidad, Personalización | `money_accounts`, `transactions`, `budgets` |
| Salud y actividad física | Información de salud | Sí | Opcional | Funcionalidad, Personalización | `body_metrics`, `body_profile`, `journal_entries`, `nutrition_logs`, `entreno_bienestar`. Solo con permiso de salud |
| Salud y actividad física | Información de actividad física | Sí | Opcional | Funcionalidad, Personalización | `cardio_sessions`, `gym_*`, `entrenos_medidos` con origen `manual`, `plan_sesiones` |
| Mensajes | Correos, SMS o MMS | No | | | |
| Mensajes | Otros mensajes en aplicaciones | Sí | Opcional | Funcionalidad, Personalización | Chat con el coach |
| Fotos y vídeos | Fotos | Sí | Opcional | Funcionalidad, Personalización | Buckets `evidence`, `avatars`, `progress`. Selector con `mediaTypes: ['images']` |
| Fotos y vídeos | Vídeos | No | | | Solo imágenes |
| Archivos de audio | Todos | No | | | El dictado devuelve texto (`src/lib/coachvoz/dictar.ts`). En Android prefiere el reconocedor local cuando existe; si no, el del sistema |
| Archivos y documentos | Archivos y documentos | Sí, **efímero** | Opcional | Funcionalidad | Extracto PDF: solo en memoria de la petición, no se guarda (`economia/handler.ts:19-22`). El CSV no sale del móvil |
| Calendario | Eventos de calendario | Sí | Opcional | Funcionalidad, Personalización | Título y horas de 14 días (`src/work/calendarioDispositivo.ts`). **Llegan a Anthropic** (`context.ts:346`). Compartido: ver arriba |
| Contactos | Contactos | Sí, solo grafo social | Opcional | Funcionalidad | Amigos dentro de NIVL (`src/lib/social.ts`). No hay permiso de contactos |
| Actividad en la app | Interacciones | Sí, si `analitica_activa` se enciende | Opcional | Análisis | `funnel_events`, con consentimiento (`src/lib/analitica.ts`) |
| Actividad en la app | Historial de búsqueda | No | | | La búsqueda de ciudad no se guarda |
| Actividad en la app | Aplicaciones instaladas | No | | | |
| Actividad en la app | Otro contenido generado | Sí | Opcional | Funcionalidad, Personalización | Diario, misiones, reglas, campañas, agenda, denuncias |
| Actividad en la app | Otras acciones | Sí | Obligatorio | Funcionalidad | XP, rachas, rankings |
| Navegación web | Historial | No | | | |
| Info y rendimiento | Registros de fallos | No | | | Sin SDK de fallos |
| Info y rendimiento | Diagnósticos | Sí | Obligatorio | Funcionalidad | Peticiones de `expo-updates` |
| Info y rendimiento | Otros datos | Sí | Obligatorio | Funcionalidad | Telemetría de coste del coach (`_shared/telemetria.ts`) |
| IDs de dispositivo | IDs de dispositivo o de otro tipo | Sí | Obligatorio | Funcionalidad, Análisis | Token push, identificador de `expo-updates`, `install_id` si se acepta. `AD_ID` retirado |

## Permisos del manifiesto generado

| Permiso | Viene de | ¿Hace falta? |
|---|---|---|
| `INTERNET`, `VIBRATE`, `ACCESS_NETWORK_STATE`, `RECEIVE_BOOT_COMPLETED`, `POST_NOTIFICATIONS` | Plantilla y librerías | Sí |
| `READ_CALENDAR`, `WRITE_CALENDAR` | `app.json` | La app no escribe, pero `expo-calendar` pide los dos juntos (`CalendarModule.kt:235`). Si se quita el de escritura, conectar el calendario deja de funcionar |
| `RECORD_AUDIO` | `expo-speech-recognition`, `expo-audio` | Sí, dictado |
| `CAMERA` | `expo-image-picker` | Sí, evidencias |
| `READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE` | Plantilla y librerías | Heredados, se pueden bloquear tras probar el selector |
| `SYSTEM_ALERT_WINDOW` | Plantilla | **No se usa** (hallazgo P12) |
| `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_MEDIA_PLAYBACK` y servicios `mediaPlayback` y `microphone` | `expo-audio` | **No se usan**: la app solo reproduce sonidos cortos (hallazgo P11) |
| `DETECT_SCREEN_CAPTURE` | `expo-screen-capture` | Normal |
| `com.google.android.gms.permission.AD_ID`, `READ_MEDIA_IMAGES`, `READ_MEDIA_VIDEO`, `SCHEDULE_EXACT_ALARM`, `USE_EXACT_ALARM` | | Retirados con `tools:node="remove"`. Bien |
| `com.android.vending.BILLING` | RevenueCat | Sí. No se ve en `node_modules`: comprobar en el AAB |

No hay ninguna clave de Firebase en `app.json` ni `google-services.json` en el repo. Sin él, el push en Android no funciona salvo que EAS lo inyecte (sin verificar).

## App content

| Declaración | Respuesta | Base o aviso |
|---|---|---|
| Política de privacidad | https://nivl.app/privacidad | Antes de declararla, añadir calendario y Open-Meteo (hallazgo P1) |
| Anuncios | No contiene anuncios | Sin SDK de anuncios, `AD_ID` retirado |
| ID de publicidad | No se usa | |
| Acceso a la app | Hace falta cuenta. Dar cuenta de revisión en el campo privado de Play Console | No poner credenciales en el repo |
| Clasificación de contenido | Rellenar el cuestionario IARC | Sin verificar. La app tiene contenido social (alias, fotos) y charla con IA |
| Público objetivo | 16 a 17 años y 18 o más. No marcar menores de 16 | `EDAD_MINIMA = 16`, puerta declarativa (`src/components/EdadMinima.tsx`). 18+ para fotos corporales (`src/lib/age.ts`) |
| Noticias, Gobierno | No | |
| Declaración de salud | Salud y bienestar: Actividad y forma física, Nutrición y control del peso, Gestión del sueño (solo si el diario de sueño se considera función), Gestión del estrés (solo si el diario de ánimo se considera función). **No marcar** Medicina ni Dispositivos médicos | [Categorías](https://support.google.com/googleplay/android-developer/answer/14738291?hl=es). NIVL no diagnostica ni trata (`_shared/ai-safety.ts`). Sin Health Connect |
| Funciones financieras | Registro de cuentas y presupuesto propio. No da préstamos, inversión, banca ni pagos | No se pudo leer la página oficial de opciones: elegir en el formulario la más cercana, y si solo hay servicios financieros, «sin funciones financieras». **Sin verificar** |
| Contenido generado por IA | Sí, chatbot. Denuncia dentro de la app: «Denunciar respuesta» (`src/components/coach/MensajeCoach.tsx:126`) | [Política](https://support.google.com/googleplay/android-developer/answer/13985936?hl=es). Cumple en el código |
| Permisos de servicios en primer plano | Hace falta si se dejan los de `expo-audio`. Mejor retirarlos | Hallazgo P11 |
| Eliminación de cuenta | Sí, https://nivl.app/borrar-cuenta | [Requisitos](https://support.google.com/googleplay/android-developer/answer/13327111?hl=es). En la app y en la web. La página usa una dirección personal: cambiar por la de soporte |
| Fotos y vídeos | Sin formulario: `READ_MEDIA_*` retirados | |

## Datos en copia de Google

El manifiesto lleva `allowBackup="true"` y solo excluye SecureStore (`secure_store_backup_rules`). Lo que guarda AsyncStorage (borradores, cola de medición) puede ir a la copia de la cuenta de Google de la persona. No es recogida por NIVL a efectos del formulario.
