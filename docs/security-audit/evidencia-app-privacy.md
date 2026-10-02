# Evidencia para App Privacy (Apple) y Data Safety (Google) — NIVL

Chat 3 · subagente (b) privacidad y borrado · 2026-10-02 · rama `winter/chat3-seguridad` (base `bf32d28`).

Fuente: el **código** de este worktree y el catálogo de la BD remota de NIVL (`dueyufxxkiixdxighpaz`, solo lectura, BEGIN…ROLLBACK). No se ha leído ningún dato personal real. Solo se declara lo que se ve en el código; lo que no se puede probar desde aquí va marcado como **NO PROBADO**.

> **Cuenta y acceso (decisión del dueño, 2026-10-02):** NIVL deja el puente de Franky y pasa a usar Supabase Auth propio (registro con email de confirmación, login y recuperación). Esta tabla ya refleja ese estado: **Franky no aparece ni como proveedor de identidad ni como destinatario**. OJO: en este worktree el puente todavía existe (`supabase/functions/franky-auth/index.ts:146-149`, `src/lib/frankyAuth.ts:67`). Las declaraciones solo son ciertas si el cambio de Auth sale **antes** del envío a revisión. Si no sale, hay que volver a añadir «email y contraseña en tránsito → Franky».

## 1. Tabla dato → finalidad → proveedor → vinculado → tracking → prueba

«Vinculado» significa que se asocia al uuid de la cuenta. «Tracking» se usa en el sentido de Apple (enlazar con datos de terceros para publicidad o compartir con data brokers). No hay SDK de anuncios ni de analítica, no se usa IDFA/ATT ni Sentry: en `package.json` solo están Expo, Supabase y RevenueCat. Por eso **tracking = No en todas las filas**.

| Dato | Finalidad | Proveedor(es) que lo recibe(n) | Vinculado | Tracking | Prueba (archivo:línea) |
|---|---|---|---|---|---|
| Email | Cuenta, acceso, confirmación y recuperación | Supabase (Auth); envío de correo: [PENDIENTE: proveedor SMTP] | Sí | No | Auth de Supabase (`auth.users`); hoy `franky-auth/index.ts:189` crea el usuario |
| Nombre / alias, retrato | Perfil; lo ven tus amigos | Supabase; **el alias va al proveedor de IA** en cada turno | Sí | No | `_shared/context.ts:248` (`Nombre: ${p.name}`); `src/lib/data.ts:208` (bucket `avatars`); `friends_board` (0030) |
| User ID (uuid) | Identificar la cuenta; compras | Supabase; RevenueCat (`appUserID` = uuid) | Sí | No | `src/lib/pro.ts:126,132` |
| Salud y forma física: peso, ficha física (altura, año de nacimiento, sexo, lesiones, salud), gimnasio, cardio, nutrición, diario de ánimo, energía y sueño | Mostrar la evolución; coach | Supabase; **proveedor de IA** (solo con consentimiento de IA **y** de salud) | Sí | No | Tablas en la lista de la 0030 (`body_profile`…`nutrition_logs`); `src/lib/bodywork.ts:67`, `src/lib/body.ts:82`; doble control en `coach/handler.ts:543,670` y `oracle/handler.ts:98,103` |
| Fotos (evidencia de misión, diario, progreso) | Prueba de hábitos; diario | Supabase Storage (`evidence`); **IA solo si se adjuntan al chat** | Sí | No | `src/lib/data.ts:197`, `src/lib/contract.ts:212`; `coach/handler.ts:358` (base64 en el turno, sin guardarlo) |
| Contenido del usuario: misiones, reglas, campañas, agenda, metas, cartas, conversación y memoria del coach | Funcionalidad de la app; coach | Supabase; proveedor de IA | Sí | No | `_shared/context.ts` (estado que va al modelo); tablas `coach_*` |
| Finanzas introducidas a mano o por archivo: cuentas, movimientos, presupuestos | Módulo Economía; coach contable | Supabase; proveedor de IA (estudios y movimientos; la clasificación envía importe y contraparte) | Sí | No | `src/lib/money.ts:92,102,124`; `_shared/clasificar.ts:71,90` |
| Historial de compras / estado de suscripción | Gestionar la suscripción | RevenueCat; Apple / Google (responsables propios); Supabase (`subscriptions`, `store_sales`, `store_events`) | Sí | No | `src/lib/pro.ts:126-173`; `0027_tienda.sql:28,110` |
| Código de creador | Atribuir el alta | Supabase (`referrals`); RevenueCat (atributo `creator_code`) | Sí | No | `src/lib/pro.ts:173`; `src/lib/creators.ts:33` |
| Token push de Expo, plataforma | Avisos del coach (brief, cierre) | Expo Push (exp.host) → APNs/FCM; el **texto** del aviso lo genera la IA | Sí | No | `src/lib/push.ts:30-45`; `ritual/index.ts:25,107-121` (solo con consentimiento de IA y de salud, `:113`) |
| Zona horaria, horas de despertar y dormir | Programar el día y el ritual | Supabase | Sí | No | `profiles.timezone` (`friends_board`, 0030) |
| Consumo de IA (tokens, coste y modelo por turno) | Candado de gasto (0020) | Supabase (`coach_runs`) | Sí | No | `coach/handler.ts` (inserción en `coach_runs`) |
| Registro de consentimientos (IA, salud, edad) | Prueba del consentimiento (RGPD art. 7.1) | Supabase | Sí | No | 0028:44, 0029, 0030:352 |
| Amigos, bloqueos, denuncias | Funciones sociales y moderación | Supabase | Sí | No | `src/lib/social.ts:70`; 0032 |
| Peticiones de actualización OTA (versión de runtime, plataforma, id de instalación) | Distribuir actualizaciones | Expo (u.expo.dev) | NO PROBADO (lo decide Expo) | No | `app.json:101`; dependencia `expo-updates` |
| Diagnóstico / fallos | — | **Ninguno en el código** (no hay Sentry, Crashlytics ni expo-insights) | — | — | `package.json` (dependencias) |
| Ubicación, contactos, historial de navegación o búsqueda, IDFA | — | **No se recogen** | — | — | No aparece ninguna API de ubicación ni de contactos en `src/` |

### Destinos del proveedor de IA (con quién va qué)
- **Anthropic**: modelos `claude-*`: Élite (`claude-sonnet-5`), owner y tareas con Haiku (titular del push, clasificación y Oráculo). Ver `_shared/routing.ts:39`, `_shared/anthropic.ts:177,205`.
- **DeepSeek**: Pro y la prueba de 7 días. `ai_plans.routes.default = deepseek-v4-flash` leído en remoto el 2026-10-02 para `mensual`, `anual`, `pro_*` y `cortesia`. Vía `COACH_BASE_URL` (`_shared/anthropic.ts:159-160`, `_shared/openai.ts:146`).
- **Oráculo con clave propia** (directo desde el dispositivo a `api.anthropic.com` / `api.openai.com`, `src/lib/oracle.ts:59,214`): **no existe en la app de tienda** (`storepolicy.ts:25`). No se declara para iOS ni Android.
- **Notion**: solo el espejo de la cuenta del dueño (`ritual/index.ts:370`, `tier === 'owner'`). No afecta a usuarios.

## 2. Apple — App Privacy (propuesta para el Chat 1)

«Data Used to Track You»: **ninguno**. Todo lo de abajo va como «Data Linked to You». No hay nada «Not Linked».

| Categoría de Apple | Tipo | Finalidad de Apple |
|---|---|---|
| Contact Info | Email Address; Name | App Functionality |
| Health & Fitness | Health; Fitness | App Functionality |
| Financial Info | Other Financial Info (movimientos y presupuestos que mete el usuario) | App Functionality |
| User Content | Photos or Videos; Other User Content (diario, misiones, conversación con el coach); Customer Support (si escribe a soporte) | App Functionality |
| Identifiers | User ID | App Functionality |
| Purchases | Purchase History | App Functionality |
| Usage Data | — no se declara (no hay analítica de producto); ver la nota de Expo | — |
| Diagnostics | — no se declara por código; **NO PROBADO** si Expo o EAS recogen diagnósticos con la configuración del proyecto | — |

Notas para el Chat 1:
- Apple exige declarar también lo que recogen terceros (RevenueCat, Expo). RevenueCat: User ID y Purchase History, ya incluidos.
- Que los datos de salud y finanzas vayan a un proveedor de IA no es «tracking». Sí debe constar en la política (Guideline 5.1.2(i)), y consta en el apartado 4.

## 3. Google Play — Data Safety (propuesta para el Chat 1)

- **¿Recoge o comparte datos?** Recoge: sí. Comparte: ver la nota sobre proveedores.
- **Cifrado en tránsito:** sí (todo es HTTPS: Supabase, RevenueCat, Expo y proveedores de IA).
- **Petición de borrado:** sí, desde la app (Perfil → Eliminar cuenta) y por email.

| Categoría de Google | Tipo | Recogido | Compartido | Opcional | Finalidad |
|---|---|---|---|---|---|
| Personal info | Name, Email address, User IDs | Sí | No (proveedores por encargo) | No (email) / Sí (alias) | Account management, App functionality |
| Health and fitness | Health info, Fitness info | Sí | **Ver nota** | Sí | App functionality |
| Financial info | Purchase history; Other financial info | Sí | **Ver nota** | Sí | App functionality |
| Photos and videos | Photos | Sí | **Ver nota** (solo los adjuntos al chat) | Sí | App functionality |
| App activity | Other user-generated content (diario, misiones, conversación con el coach) | Sí | **Ver nota** | Sí | App functionality |
| Device or other IDs | Token push | Sí | No | Sí | App functionality |

**Nota (decisión del Chat 1 o del dueño, no del código):** Google no cuenta como «compartir» la transferencia a un proveedor que trata los datos **por encargo**. Anthropic y Supabase actúan así según sus términos de API. **DeepSeek**: este análisis no ha podido verificar si su API ofrece un acuerdo de encargado del tratamiento (NO PROBADO). Si no lo ofrece, salud, finanzas, fotos y contenido enviados a DeepSeek habría que declararlos como **compartidos**.

## 4. Lo que hace falta para que todo esto siga siendo cierto
- El cambio a Supabase Auth propio tiene que salir antes del envío (ver el aviso de arriba).
- Hay que aplicar `proposals/0039_store_events_seudonimizar.sql`. Si no, `store_events` guarda el uuid y el payload de RevenueCat después del borrado.
- Configurar `REVENUECAT_API_KEY` (la secreta `sk_…`) en las Edge Functions para que el borrado de cuenta elimine también el cliente en RevenueCat (`_shared/account-erasure.ts`). Sin ella, el borrado avisa y continúa: **NO PROBADO en producción**.
