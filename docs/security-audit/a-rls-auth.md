# Auditoría de seguridad · (a) RLS y auth

Chat 3 · Seguridad · subagente (a). Fecha: 2026-10-02. Rama `winter/chat3-seguridad`.
Proyecto auditado: NIVL (`dueyufxxkiixdxighpaz`). Las pruebas SQL se hicieron en remoto **dentro de una transacción que se deshace**. Usé cuentas ficticias (`@example.invalid`, uuids `aaaa…`/`bbbb…`/`cccc…`) y suplanté los roles `authenticated` y `anon`. No se leyó ningún dato personal: solo el catálogo y conteos agregados.

Estados: **PASS** (probado y correcto) · **FAIL** (probado y roto) · **NO PROBADO** (solo inspeccionado o fuera de alcance).
Severidad: **P0** (acceso entre cuentas, escalada, secreto, borrado no real) · **P1** · **P2**.

## Resumen

| ID | Sev | Estado a cierre | Qué |
|---|---|---|---|
| A-01 | **P0** | Mitigado: configuración cambiada + puente corregido (pendiente de desplegar) | Alta pública con autoconfirmación: se podía ocupar la cuenta NIVL de un correo ajeno, y el puente franky-auth se la entregaba después a su dueño |
| A-02 | P1 | **PASS en remoto** (0035 aplicada, re-probado) | Borrar y reinsertar el perfil: XP/piedras/bonus/racha inventados y suspensión de moderación anulada |
| A-03 | P1 | FAIL (proceso) | Una denuncia queda en `social_reports` y no avisa a nadie |
| A-04 | P1 | Fix en cliente (`authFlow.cerrarSesion`) + propuesta a-01; pendiente de integrar en pantallas | El siguiente usuario del móvil recibe los push y recordatorios del anterior |
| A-05 | P2 | Propuesta a-02 | TRUNCATE para anon/authenticated en 45 tablas y en las futuras |
| A-06 | P2 | Fix en franky-auth | Freno esquivable (`x-forwarded-for` del cliente); sin freno por correo |
| A-07 | P2 | FAIL | El franky-auth desplegado es anterior al repo |
| A-08 | P2 | NO PROBADO | La economía confía en cantidades del cliente |
| A-09 | P2 | inspección | `journalPhotoUrl` firma 1 h |
| A-10 | P2 | Resuelto en `authFlow` | Mensajes de Auth crudos (`mapAuthError` devolvía `raw`) |

---

## A-01 · P0 · Alta abierta + autoconfirmación → secuestro previo de la cuenta

- **Reproducción (resultado real, al empezar):** `GET /auth/v1/settings` → `disable_signup=false`, `mailer_autoconfirm=true`. No se ejecutó ningún alta.
- **Ataque:** el atacante hace `signUp` con el correo de la víctima y una contraseña suya, y la cuenta queda confirmada al momento. Cuando la víctima entra por franky-auth, el puente ve `email_exists`, genera el magic link de esa cuenta y le abre la sesión. El atacante conserva su contraseña y lee el diario, la salud y el dinero de la víctima. Lo mismo pasaba con el cambio de correo autoconfirmado.
- **Estado al cierre:**
  1. **Configuración:** releída al cierre → `mailer_autoconfirm=false`, `disable_signup=false`. El alta queda abierta a propósito, porque el login nativo nuevo la necesita, y con confirmación de correo obligatoria.
  2. **Puente** (`supabase/functions/franky-auth/{index.ts,logic.ts}`, sigue vivo hasta que salga el login nativo):
     - la cuenta NIVL se ata al id de Franky en `app_metadata.franky_id`, que solo escribe el servidor;
     - otro id → `409 account_conflict`, sin sesión;
     - sin vínculo → se vincula. Si además **no tiene el correo confirmado** (la pudo crear un tercero con `signUp`), en el mismo `updateUserById` se sustituye su contraseña por una aleatoria de 32 bytes (base64url) que no se registra en ningún sitio;
     - las cuentas ya confirmadas (las 8 existentes, la del revisor) conservan su contraseña;
     - si el vínculo falla, no hay sesión.

     Decisión pura y testeada: `decidirVinculo` y `passwordAleatoria`, con test en `logic_test.ts`, Deno, 9/9.
  3. Riesgo residual: una cuenta ocupada y **confirmada** antes del cambio de configuración. Conteo al empezar: 8 usuarios, 0 con `franky_id`, 0 sin confirmar. El dueño debería comprobar que los 8 son suyos o de pruebas.
- **Despliegue:** `supabase functions deploy franky-auth --no-verify-jwt`.

## A-02 · P1 · Borrar y reinsertar el perfil (CERRADO por la 0035)

- **Reproducción (resultado real, antes de la 0035):** una cuenta suspendida hace delete + insert de su propio perfil → `status=pending xp=99999 stones=3 bonus=9999 streak=365`.
- **Re-prueba tras la 0035 (resultado real):** update, delete e insert → *permission denied*; sigue `suspended`, xp 0. **PASS.**

## A-03 · P1 · La denuncia no llega a nadie

- **Reproducción (resultado real):** dos denuncias de A a B → 1 fila `open` (deduplicada). El cliente no lee la tabla. `social_reports` no tiene ningún trigger; el único cron es `nivl-rituales`, y ninguna función del repo la lee.
- **Impacto (App Review 1.2):** que se atienda depende de abrir el SQL Editor (`docs/MODERACION-SOCIAL.md`). No hay aviso ni responsable medible.
- **Fix propuesto:** aviso al responsable por cada denuncia y por cada perfil pendiente (trigger o cron hacia una función de correo). Nombrar responsable y suplente antes del reenvío. No implementado aquí: requiere infraestructura y secretos.

## A-04 · P1 · Cerrar sesión no limpiaba el dispositivo

- **Reproducción (resultado real):** A registra el token del móvil. Entra B, y su upsert falla con `new row violates row-level security policy (USING expression)`. El token sigue siendo de **A**.
- **Fix hecho:** `cerrarSesion()` en `src/lib/authFlow.ts`.
  - Borra el token push (antes del signOut, porque la RLS lo exige), cancela los recordatorios locales y borra la key del Oráculo, el código de creador y el consentimiento recordado.
  - Cada paso va aislado, y luego hace `signOut()` global, con caída a `local` si falla.
  - Tests en `sec-auth-flow.test.ts`.
- **Propuesta servidor:** `docs/security-audit/proposals/a-01_push_token.sql`, RPC `claim_push_token`. Su test, ejecutado en remoto con resultado deshecho, da 8/8:
  - el upsert actual de B falla y con la RPC B se queda el token;
  - anon y los formatos inválidos se rechazan.
- **DEPENDENCIAS:**
  - Chat 4: `perfil.tsx:333` debe llamar a `cerrarSesion()` de `authFlow`.
  - `src/lib/push.ts` debe usar `rpc('claim_push_token', …)` en lugar del upsert.
- RevenueCat: PASS por inspección (`_layout.tsx` → `identificarEnTienda(null)` → `logOut`).

## A-05 · P2 · TRUNCATE para los roles de la API

45 tablas tras la 0035 (antes 47), más los privilegios por defecto para las tablas nuevas. Propuesta y test: `a-02_truncate_y_higiene.sql` / `.test.sql`. El test en remoto, deshecho, da 6/6: 0 tablas con TRUNCATE, una tabla nueva no lo hereda pero conserva SELECT, y `handle_new_user` deja de ser ejecutable por anon.

## A-06 · P2 · Freno de franky-auth

Hecho:

- prioridad a `cf-connecting-ip` / `x-real-ip`, más un **freno por correo** (8 intentos en 15 min) que no depende de cabeceras;
- el mapa de intentos tiene tope;
- el mensaje reenviado desde Franky se corta a 200 caracteres;
- los logs solo llevan códigos.

NO PROBADO en vivo, para no agotar el límite de Auth de Franky, que comparten todos los usuarios del puente.

## A-07 · P2 · Despliegue desfasado

En vivo, `{"action":"admin"}` → 401 (el repo responde 400). Hay que redesplegar.

## A-08 · P2 · Economía dirigida por el cliente

`award_xp` (±2000 por llamada) y `complete_quest` (hasta 50 000) son por diseño. El cierre del día lo revisa el coordinador. Recomendación: un tope diario en servidor.

## A-09 · P2 · `src/lib/contract.ts:259`

Firma de 1 h para fotos del diario; el resto, 60 s. Recomendación: 60 s. El archivo no es de este subagente.

---

## Login nativo de NIVL (`src/lib/authFlow.ts`): contrato para el Chat 4

Las pantallas no llaman a `supabase.auth` directamente; usan solo esto:

| Función | Devuelve | Notas |
|---|---|---|
| `registrar(email, password, nombre)` | `'sesion' \| 'confirmar_email'` | `signUp` con `emailRedirectTo = Linking.createURL('auth/confirmar')` y `full_name`. Un correo existente devuelve también `'confirmar_email'` (no se delata). Valida antes el correo, el nombre (1–24) y la contraseña |
| `entrar(email, password)` | `void` | `signInWithPassword`; normaliza el correo |
| `pedirRecuperacion(email)` | `void` | `resetPasswordForEmail` con `redirectTo = Linking.createURL('auth/restablecer')`. Responde SIEMPRE igual; solo propaga fallos de red |
| `completarEnlace(url)` | `'confirmado' \| 'recuperacion'` | Solo acepta `nivl://auth/confirmar` y `nivl://auth/restablecer` (comparación exacta del esquema y la ruta con `createURL`). Con PKCE usa `?code=` → `exchangeCodeForSession`; por compatibilidad admite el fragmento implícito (`access_token`/`refresh_token` → `setSession`); `type=recovery` → `'recuperacion'`. Un enlace con `error*` o de otro origen → ErrorVisible, sin tocar la sesión. No registra tokens |
| `cambiarContrasena(nueva)` | `void` | Exige sesión (la de recuperación vale); valida contra el correo de la sesión; `updateUser({password})` |
| `cerrarSesion()` | `void` | Ver A-04 |

- **Errores:**
  - Llegan como `ErrorVisible` en español: credenciales no válidas, correo sin confirmar, demasiados intentos (429 / `over_*`), contraseña débil (`weak_password`, incluida la de filtraciones), contraseña igual a la anterior, enlace caducado o no válido, enlace abierto en otro móvil (PKCE sin verificador → pista de entrar con contraseña), sesión caducada y formato de correo.
  - El resto se relanza tal cual y la pantalla usa `mensajeSistema(e)` (sin conexión / fallo genérico). Nunca llega el texto técnico.
- **Rutas de enlace:** `nivl://auth/confirmar` y `nivl://auth/restablecer`, comprobadas en test con la config de un binario de tienda (`scheme: 'nivl'`). En Expo Go salen como `exp://…/--/auth/…`. Las pantallas de esas rutas (Chat 4) reciben la URL entrante (`Linking.useURL()` o `Linking.getInitialURL()`) y llaman a `completarEnlace(url)`. Con `'recuperacion'` muestran el formulario de nueva contraseña → `cambiarContrasena`.
- **Cliente** (`src/lib/supabase.ts`): `flowType: 'pkce'`, `detectSessionInUrl: false`, sesión en AsyncStorage. Con PKCE, el `code` del correo solo vale en el móvil que lo pidió.
- `src/lib/frankyAuth.ts` queda sin usar en cuanto `login.tsx` pase a `authFlow` (Chat 4). En `src/lib` no queda ninguna referencia `FRANKY_*` / `EXPO_PUBLIC_FRANKY` fuera de ese archivo; la única otra coincidencia es un color `franky` en `theme.ts`.
- **Contraseñas** (`src/lib/validation.ts`):
  - de 10 a 72 **bytes** UTF-8 (límite de bcrypt), sin reglas de composición;
  - rechaza que contenga el correo o su parte local (4 o más caracteres), solo espacios y menos de 5 caracteres distintos;
  - `checkPassword(password, email?)` mantiene su forma, así que `login.tsx` sigue compilando.

  **El control real es del servidor:** en el panel → Authentication → «Minimum password length» = **10** (el coordinador debe ponerlo igual), y si el plan lo permite, activar la protección contra contraseñas filtradas. Lo que rechace el servidor llega como «contraseña débil».
- **Registro y login reales en el dispositivo:** NO PROBADO (crear cuentas no está permitido a este agente). Queda para el vídeo de iPhone.

## Registro y login por el puente: pruebas en vivo

| Caso | Resultado | Estado |
|---|---|---|
| OPTIONS / GET | 200 / 405 | PASS |
| Sin apikey ni JWT, cuerpo vacío | 400 `invalid_email` | PASS (`--no-verify-jwt` a propósito) |
| Correo malo / registro sin nombre | 400 | PASS |
| Login de un correo inexistente | 401 genérico | PASS (sin enumeración) |
| Acción desconocida | 401 | FAIL A-07 |

## Denuncia y bloqueo (0032): prueba en remoto

Montaje: A y B Élite en el mismo ludus, amigos, A con retrato aprobado; luego A denuncia y bloquea a B.

| Comprobación | Antes | Tras el bloqueo | Estado |
|---|---|---|---|
| `friends_board` / `elite_group_board` / `elite_badges` ven al otro (A y B) | 1 | 0 | PASS |
| `friendships` y solicitudes visibles | 1 / 0 | 0 / 0 | PASS |
| B: retrato de A (`social_avatar_readable`, `storage.objects`) | true / 1 | false / 0 | PASS |
| B vuelve a pedir amistad por código | — | `codigo_desconocido` | PASS |
| B inserta en `friendships` directamente | — | *permission denied* | PASS |
| `social_pair_allowed` sobre una pareja ajena | — | false | PASS |
| Un desconocido denuncia o bloquea | — | «Usuario no disponible» | PASS |
| anon llama a las RPC sociales | — | *permission denied* | PASS |
| Denuncia registrada, deduplicada y no legible por el cliente | — | 1 fila `open` | PASS |
| Autoaprobarse o tocar las revisiones | — | *permission denied* | PASS |
| La denuncia llega a una persona | — | — | **FAIL A-03** |

## RLS general: catálogo remoto

- **Tablas:** 73 en `public` con RLS; ninguna vista. Buckets `evidence` y `avatars` privados, con políticas por carpeta = uid; los retratos son inmutables y se revisan antes de mostrarse. Firmas de 60 s salvo A-09.
- **Políticas:** todas `TO authenticated`, `auth.uid() = user_id` con `WITH CHECK`; las tablas hijas comprueban además el padre; la restrictiva `health_permission`. Catálogo legible: `ai_plans` y `store_products`.
- **Columnas de `profiles` (UPDATE):** solo las de perfil (la 0009 sigue en vigor).
- **Funciones:** todas las SECURITY DEFINER con `search_path` fijo. Las internas, sin EXECUTE para la API. Las públicas validan `auth.uid()` (probado `health_erasure_paths` con un job ajeno → denegado).
- **Test de privilegios (resultado real, todo denegado):**
  - suscripción `owner` propia, buckets, subidas en la carpeta de otro usuario;
  - misiones a nombre de otro, mover un token push a otro;
  - tablas de erasure, tienda y moderación;
  - las RPC de servicio;
  - anon insertando perfiles o ejecutando `start_trial`.
- **Límites** (amigos 100/20/30 por hora, denuncias 10 por hora con dedup, aforo del ludus): PASS por inspección; solo se probó la dedup.

## Archivos de este subagente

- `src/lib/authFlow.ts` (nuevo)
- `src/lib/validation.ts` (política 10–72, correo)
- `src/lib/supabase.ts` (PKCE)
- `src/lib/__tests__/sec-auth-flow.test.ts` (nuevo)
- `src/lib/__tests__/validation.test.ts` (12 → 10)
- `supabase/functions/franky-auth/index.ts`, `logic.ts` (nuevo), `logic_test.ts` (nuevo)
- `docs/security-audit/proposals/a-01_push_token.sql` + `.test.sql`
- `docs/security-audit/proposals/a-02_truncate_y_higiene.sql` + `.test.sql`
- este informe

## Orden de despliegue

1. Panel de Auth: «Confirm email» ON (hecho), «Minimum password length» = 10 y protección contra filtradas si está disponible.
2. `supabase functions deploy franky-auth --no-verify-jwt`, mientras siga vivo el puente.
3. Migraciones de las propuestas a-01 (`claim_push_token`) y a-02 (TRUNCATE): numerarlas, añadir su huella y aplicarlas.
4. OTA con las pantallas del Chat 4 sobre `authFlow` (login, `auth/confirmar`, `auth/restablecer`, `perfil.tsx` → `cerrarSesion`) y `push.ts` → `claim_push_token`.
5. Moderación: responsable y aviso de denuncias (A-03) antes del reenvío a Apple.

## Revisión del Chat 3 (02/10)
- `completarEnlace` ya **no** acepta el flujo implícito (`#access_token=…&refresh_token=…`). Un enlace fabricado `nivl://auth/confirmar#access_token=<atacante>` habría abierto en el móvil de la víctima la sesión de la cuenta del atacante sin que lo notara (login CSRF). Con PKCE los correos legítimos traen `?code=`. Test actualizado.
- `cerrarSesion()` usa `signOut()` global: cierra también las otras sesiones de la cuenta. Es intencionado (en un móvil compartido revoca el refresh token). Si producto prefiere cerrar solo este dispositivo, se cambia a `scope: 'local'`.
