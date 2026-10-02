# Auditoría (b) — Privacidad, consentimientos, exportación y borrado

Chat 3 · Seguridad · subagente (b) · 2026-10-02 · rama `winter/chat3-seguridad` (base `bf32d28`).
Proyecto remoto: NIVL `dueyufxxkiixdxighpaz` (nunca el de Franky). Todo lo remoto se hizo con `rosql.mjs`, siempre en BEGIN…ROLLBACK, con cuentas **ficticias** (`*-sim@example.invalid`, uuids `5ec0…`). No se ha leído ningún dato personal real: solo catálogo y conteos.

## Resumen

- **P0: ninguno encontrado.** Comprobado en la BD real:
  - El servidor no llama a la IA sin consentimiento vigente.
  - Los datos de salud no se leen ni se escriben sin el permiso de salud.
  - Ninguna cuenta ve, exporta ni consulta el consentimiento de otra.
  - El borrado de cuenta elimina de verdad todas las filas con dueño, Storage y Auth, y deja intacta a la cuenta testigo.
- **P1:** cuatro hallazgos.
  - P1-1 `store_events` conserva el uuid y el payload de RevenueCat después del borrado.
  - P1-2 No se borraba el cliente en RevenueCat.
  - P1-3 La exportación omitía 17 tablas y no dice qué fotos existen.
  - P1-4 La exportación en web no funcionaba.
  - Corregidos en código: P1-2 y P1-4. Con propuesta SQL probada: P1-1 y P1-3.
- **P2:** diez. Cuatro corregidos con tests; el resto son decisiones o dependencias.

## Reproducciones (resultado REAL)

Scripts en `scratchpad/b/` (`seed.sql`, `seed2.sql`, `count.sql`, `erase.sql`, `consent.sql`). Las propuestas y sus tests están en `docs/security-audit/proposals/b-*.sql`.

### R1. Borrado de cuenta de punta a punta (0031 + `account-erasure`)

Montaje: cuenta A (la que se borra) y B (testigo), con filas en **las 66 tablas** donde la siembra genérica o manual pudo crear una. Incluye amistad A↔B, denuncias en los dos sentidos, bloqueo, creador, venta, `store_events` y 2 objetos de Storage (`evidence` y `avatars`).

| Paso | Resultado real | Estado |
|---|---|---|
| `begin_account_erasure` como `authenticated` | `permission denied for function` | PASS |
| `begin_account_erasure` como service_role, dos veces | El mismo `job_id` las dos veces (idempotente) | PASS |
| `account_erasure_paths` con un job ajeno | `No autorizado` | PASS |
| `account_erasure_ready` con objetos aún en Storage | `false` | PASS |
| Pendiente: `ai_consent_ok(A)` / `health_consent_active(A)` | `false` / `false` (B sigue en `true`) | PASS |
| Pendiente: A inserta en `quests` o `push_tokens`, sube un avatar o llama a `accept_ai_consent` | Todo rechazado con `borrado_cuenta_pendiente` | PASS |
| Pendiente: B escribe | Permitido | PASS |
| Pendiente: A llama a `export_my_data` | Funciona (48 claves): se puede exportar antes de que acabe | PASS |
| Storage vaciado (simulando la API de Storage) → `ready` | `true` | PASS |
| `delete auth.users` (lo que hace `deleteUser`) | Sin errores: los triggers no bloquean las cascadas SET NULL | PASS |
| Qué queda con el uuid de A | **Solo `store_events.app_user_id`** (con el payload) | **FAIL → P1-1** |
| Qué se queda sin vínculo | `creators` (user_id → NULL, alias), `store_sales` (user_id → NULL, transaction ids): contabilidad | PASS (retención legal) |
| B | Conserva sus 60 tablas; desaparecen su amistad, su bloqueo y su denuncia sobre A | PASS (ver P2-7) |
| Franky | `account-erasure/index.ts` solo usa `adminClient()` del proyecto NIVL; un test de cliente prueba que no hay `fetch` | PASS |

Tests Deno sobre la función:
- Existentes: `account-erasure_test.ts` 7/7 y `health_test.ts` 9/9.
- Nuevos: `sec_priv_account_erasure_test.ts` 12/12 y `sec_priv_health_erasure_test.ts` 5/5.
- Contra el código ANTERIOR (copiado de `HEAD` a un archivo temporal, ya borrado): fallan 2 de 7 de borrado de cuenta (respuesta perdida y concurrencia) y 5 de 5 de borrado de salud.

### R2. Consentimientos separados de IA y de salud (0028/0029/0030/0034)

Cuentas C y D ficticias. Resultados reales:

| Caso | Resultado | Estado |
|---|---|---|
| Sin filas: `ai_consent_ok` | `false` (cerrado por defecto) | PASS |
| Aceptar la versión vieja `2026-09-27` | `{ok:false, reason:version_obsoleta, current_version:2026-09-29}` | PASS |
| INSERT directo en `ai_consents` (falsificar `source`) | `permission denied for table` | PASS |
| `authenticated` llama a `ai_consent_ok` | `permission denied for function` | PASS |
| Aceptar la versión vigente → `my_ai_consent` | `granted:true` | PASS |
| Con solo el consentimiento de IA, `health_consent_ok` | `false` (son independientes) | PASS |
| `body_profile` / peso sin permiso de salud | `sin_consentimiento_salud` | PASS |
| Peso con permiso de salud | Permitido | PASS |
| C pregunta por `health_consent_ok` de D | `false` | PASS |
| Retirar salud sin borrar | `{ok:false, reason:confirmar_borrado}` | PASS (ver P2-4) |
| Retirar IA → `ai_consent_ok` | `false`; salud sigue `true` (independiente) | PASS |
| La última fila tiene `source='migracion'` | `false` | PASS |
| D lee `ai_consents`, `health_state` o `body_metrics` de C | `0/0/0` | PASS |
| `export_my_data` de D contiene a C | `false` | PASS |

Servidor (Edge Functions):
- `coach/handler.ts:543` exige el consentimiento de IA antes de leer el cuerpo de la petición. `:670` exige además el de salud antes del contexto. El atajo `clasificar` (`:642`) solo pide el de IA (ver P2-5).
- `oracle/handler.ts:98,103,161,164,195` exige los dos antes y después de la llamada.
- `ritual/index.ts:113,299,316,353` exige los dos para generar y para hacer push.
- `_shared/health.ts:18` (`healthGuardedResult`) vuelve a comprobar la revisión cuando llega la respuesta del modelo.
- Estado: **PASS por lectura y por los tests Deno existentes** (`health_test.ts`). Las pruebas del coach y del oráculo con backend simulado son del subagente (a) (`sec_coach_*_test.ts`). Desde aquí no se ha llamado a ningún modelo real: **NO PROBADO end-to-end contra el proveedor.**
- Datos ya enviados: no se recuperan. Lo dicen la hoja (`consentmath.ts:54`) y la política (apartado 6). Su retención depende del proveedor.

### R3. Exportación

| Caso | Resultado | Estado |
|---|---|---|
| Tablas con dueño que `export_my_data` (v2, en producción) no cubre | `account_erasure_jobs, age_confirmations, coach_runs, elite_group_members, elite_group_requests, friend_request_log, friendships, oracle_usage, push_tokens, referrals, social_avatar_paths, social_blocks, social_profile_reviews, social_reports, store_reconciliation, store_sales, subscriptions` | **FAIL → P1-3** |
| Con `b-0035`: tablas sin cubrir / claves del cliente actual / nada de la otra cuenta | `ninguna` / `true` / `true` | PASS (propuesta) |
| Fotos | Solo salen rutas (`evidence_url`, `path`), no los bytes; la v2 ni siquiera dice qué objetos existen | FAIL parcial → P1-3 |
| Solo datos propios | `export_my_data` usa `auth.uid()` y una lista cerrada (R2: D no ve a C) | PASS |
| Web | `new File(Paths.cache)` es un stub en web (lo reportó el Chat 4) | **FAIL → P1-4, corregido** |

## Hallazgos

### P1-1 · `store_events` conserva el uuid y el payload de RevenueCat tras borrar la cuenta
- **Dónde:** `supabase/migrations/0027_tienda.sql:28,110`: tabla sin FK, sin purga, con el `payload` completo (aliases, `original_app_user_id`, `subscriber_attributes`, `transferred_*`).
- **Reproducción:** R1, «Qué queda con el uuid de A». En producción hay 2 filas, las 2 huérfanas (solo se contaron).
- **Impacto:** el borrado no es completo (RGPD art. 17) y contradice la política («suprime los datos de uso»).
- **Fix (propuesta, NO aplicada):** `proposals/b-store-events-seudonimizar.sql`.
  - Se **redacta, no se borra**: el `id` es la clave de idempotencia de `apply_store_event` y un reenvío reprocesaría un reembolso.
  - `payload → {id, type, redacted:true}`, `app_user_id → null`, `note='redactado por borrado'`.
  - Se ejecuta en un trigger AFTER DELETE de `profiles`: corre en la misma transacción que la cascada de Auth, así que es atómico.
  - Un trigger BEFORE INSERT redacta los eventos tardíos de un uuid que ya no existe.
  - Un `update` final limpia las filas huérfanas que ya hay.
  - Columnas verificadas en remoto.
- **Test:** `b-store-events-seudonimizar.test.sql`, ejecutado en remoto con ROLLBACK:
  - 0 filas mencionan a G tras borrarlo.
  - Se conservan id, type, environment y received_at.
  - El TRANSFER que lo menciona también queda redactado.
  - El testigo H sigue intacto.
  - Un RENEWAL tardío llega redactado.
  - La idempotencia se mantiene.
- **Despliegue:** solo la migración (+ huella). El webhook no cambia (el Chat 2 lo ha revisado).

### P1-2 · El cliente de RevenueCat no se borraba (PRIV-1) — CORREGIDO en código
- **Dónde:** `_shared/account-erasure.ts`. Ahora `eraseRevenueCatCustomer` hace `DELETE https://api.revenuecat.com/v1/subscribers/{uuid}` con `Bearer REVENUECAT_API_KEY`.
- **Cuándo:** con el job ya creado y Storage vacío, **justo antes** de `deleteUser`.
- **Respuestas:** 200 y 404 cuentan como hecho. Cualquier otra respuesta, la excepción o el timeout de 10 s (AbortController) devuelven 503 pendiente, y el reintento idempotente de la app lo repite.
- **Sin clave o con una clave pública** (`appl_`/`goog_`): no bloquea; `console.warn` sin datos personales.
- **Documentación de RevenueCat** (consultada el 2026-10-02):
  - Sobre el endpoint de borrado: «Permanently deletes a customer. Deletion is queued asynchronously.» Y además: «For retry-safe flows, treat both 200 and 404 as successful» (https://www.revenuecat.com/docs/api-v1/customers#tag/customers/operation/delete-subscriber).
  - En la página del perfil de cliente: borrar «clears out all of their data and is sufficient for GDPR erasure requests». También dice que **no cancela** la suscripción en la tienda (https://www.revenuecat.com/docs/dashboard-and-metrics/customer-profile).
  - **No está documentado** si una renovación posterior de Apple o Google vuelve a crear el cliente con el mismo `app_user_id`: no aparece en esas páginas ni en https://www.revenuecat.com/docs/customers/user-ids. **NO PROBADO.** Si se recrea, el trigger BEFORE INSERT de b-0036 redacta lo que llegue al webhook de NIVL, pero RevenueCat volvería a guardar el uuid. Si el dueño lo exige, hay que preguntar a RevenueCat.
- **Tests:** `sec_priv_account_erasure_test.ts`, 5 casos con fetch simulado: 200 (incluido el orden), 404, 500/401/429/excepción → 503 y reintento correcto, timeout, y sin clave o con clave pública.
- **Estado:** PASS en tests; **NO PROBADO en producción** hasta que el coordinador configure `REVENUECAT_API_KEY` (`sk_…`) y despliegue `account-erasure`.

### P1-3 · La exportación omite 17 tablas y no dice qué fotos existen
- **Dónde:** `export_my_data` (0030:642-660) y `src/lib/exporter.ts:10-64`.
- **Reproducción:** R3. Fallaba antes; pasa con la propuesta.
- **Impacto:** acceso y portabilidad incompletos (RGPD arts. 15 y 20): suscripción, consumo de IA, amistades, denuncias, ventas, token push, confirmación de edad…
- **Fix (propuesta, NO aplicada):** `proposals/b-export-completo.sql`.
  - v3, con la misma firma, solo **añade** claves: compatible con los binarios instalados.
  - De terceros solo exporta el hecho (rol, fecha, estado), nunca el uuid de la otra persona.
  - Añade `storage_objects` (bucket, ruta, tamaño, fecha).
  - Test en `b-export-completo.test.sql`.
- **Despliegue:** solo la migración. Los bytes de las fotos → DEPENDENCIA de UI (abajo).

### P1-4 · «Exportar mis datos» no funcionaba en web — CORREGIDO
- **Dónde:** `src/lib/exporter.ts` (antes en las líneas 77-78).
- **Fix:** rama `Platform.OS === 'web'`: Blob JSON, `URL.createObjectURL`, `<a download>` temporal, que se quita en el `finally`, y `revokeObjectURL`. Sin DOM, lanza un error claro. La ruta nativa no cambia.
- **Test:** `src/lib/__tests__/sec-priv-exporter.test.ts`, 5/5: web OK, clic que falla (la URL se revoca igualmente y el error se propaga), sin DOM, exportación incompleta y ruta nativa intacta.

### P2-1 · Respuesta perdida o concurrencia en el borrado de cuenta → «no ha terminado» para siempre — CORREGIDO
- **Dónde:** `_shared/account-erasure.ts`.
- **Antes:** si la app no recibía el 200, el reintento obtenía 401 (el usuario ya no existe) y la app mostraba «El borrado no ha terminado» indefinidamente sobre una cuenta borrada. Con dos peticiones a la vez, la segunda recibía 503 tras un `deleteUser` con 404.
- **Ahora:** `user_not_found` de Auth (en `getUser` o en `deleteUser`) responde 200. `session_not_found`, `bad_jwt` y 401 siguen siendo 401, porque no prueban el borrado.
- **Tests:** 2 que antes fallaban y ahora pasan, más 1 que comprueba que una sesión caducada no cuenta como borrado.

### P2-2 · Tras borrar la cuenta seguían los avisos locales programados — CORREGIDO
- **Dónde:** `src/lib/account.ts`.
- **Antes:** `deleteAccount` no cancelaba las notificaciones locales, que llevan títulos de misiones y del plan.
- **Ahora:** `cancelarTodo()` y `olvidarConsentimiento()`, cada paso aislado. Ningún fallo local mantiene la sesión abierta y `signOut({scope:'local'})` se ejecuta siempre.
- **Test:** `account.test.ts`, 10/10 (2 nuevos).

### P2-3 · `health-erasure`: una excepción daba 500 y la validación de rutas era más débil — CORREGIDO
- **Dónde:** `_shared/health-erasure.ts`.
- **Antes:** sin try/catch, una excepción del proveedor producía un 500 genérico. Rutas como `uid/x/..`, `uid//x` o `uid/./x` pasaban el filtro `includes('/../')`.
- **Ahora:**
  - La misma regla `ownPaths` que en el borrado de cuenta, con tope de 100.
  - 503 pendiente sin detalles.
  - No se dice «permiso retirado» si todavía no se ha retirado.
  - `cache-control: no-store`.
- **Test:** `sec_priv_health_erasure_test.ts`, 5/5. Contra el código anterior: 0/5.

### P2-4 · Retirar el permiso de salud obliga a borrar (decisión de producto)
- **Dónde:** `withdraw_health_consent` (0030:440-445) devuelve `confirmar_borrado` si `p_erase` no es true (reproducido en R2).
- **Riesgo:** el RGPD (art. 7.3) pide que retirar sea tan fácil como dar el consentimiento. Atar la retirada al borrado puede disuadir de retirarlo. Es coherente con la política publicada.
- **Propuesta:** decisión del dueño. Si se separan, hace falta una migración nueva que permita retirar sin borrar (los datos quedan bloqueados por RLS, como ya pasa) y UI del Chat 4.

### P2-5 · La clasificación de movimientos envía contrapartes a la IA con solo el consentimiento de IA
- **Dónde:** `_shared/clasificar.ts:71,90` (importe + contraparte o descripción). `coach/handler.ts:642` corre antes del control de salud.
- **Detalle:** las filas con `health_note` sí quedan fuera por RLS. Pero contrapartes como «Farmacia…» o «Clínica…» permiten deducir datos de salud (art. 9).
- **Fix:** exigir también el permiso de salud, o quitar del lote las contrapartes con términos sanitarios. No es mi archivo: DEPENDENCIA para el subagente (a) o el dueño. Mientras tanto, nombrarlo en la política (texto abajo).

### P2-6 · El alias va a la IA y la hoja de consentimiento no lo nombra
- **Dónde:** `_shared/context.ts:248`. `consentmath.ts:24-30` (`DATOS_IA`) no lo menciona.
- **Fix:** se añade a la política (texto abajo). Cambiar la hoja exige subir `AI_CONSENT_VERSION` y una migración nueva de `ai_consent_version()`, y vuelve a pedir el consentimiento a todo el mundo. **No lo he hecho:** decisión del Chat 1 o del dueño.

### P2-7 · Al borrar A desaparecen las denuncias que B hizo sobre A
- **Dónde:** cascada `social_reports.subject` (reproducido en R1).
- **Detalle:** coherente con la política (apartado 5). Se pierde la prueba si A se borra para eludir una investigación. Informativo.

### P2-8 · Oráculo con clave propia en web: llama directo al proveedor sin el consentimiento de IA del servidor
- **Dónde:** `src/lib/oracle.ts:59,214,281-283`. Solo fuera de la tienda (`storepolicy.ts:25`).
- **Fix:** comprobar `fetchConsentimiento()` antes de la rama BYOK. No es mi archivo: DEPENDENCIA. No afecta a iOS ni Android.

### P2-9 · El texto del push del coach pasa por Expo, APNs y FCM
- **Dónde:** `ritual/index.ts:114-121`.
- **Detalle:** el texto puede contener contenido de salud. Exige los dos consentimientos (`:113`) y la política lo declara («título y texto de la notificación»). Informativo.

### P2-10 · Sin SDK de diagnóstico, la política declara «información sobre fallos»
- **Dónde:** `package.json` (sin Sentry ni expo-insights) frente a la política, apartado 2, fila «Técnicos».
- **Detalle:** no es dañino (declara de más). Para App Privacy no se declara Diagnostics salvo que Expo lo recoja (NO PROBADO). Texto abajo.

## Casos por estado

- **PASS (con reproducción):**
  - Borrado real de las 66 tablas, Storage y Auth (salvo `store_events`).
  - Bloqueo de escrituras, IA, salud y subidas con el borrado pendiente.
  - Idempotencia del job.
  - Aislamiento entre cuentas (lectura, consentimiento, exportación).
  - Versión obsoleta.
  - Retirada de la IA.
  - Fila sembrada por migración ignorada.
  - Independencia de IA y salud.
  - Escritura de salud sin permiso rechazada.
  - Fallos parciales y reintentos (Deno).
  - Franky no se toca.
- **FAIL corregido:** P1-2, P1-4, P2-1, P2-2, P2-3.
- **FAIL con propuesta SQL probada:** P1-1 (b-0036), P1-3 (b-0035).
- **NO PROBADO:**
  - Llamada real al proveedor de IA.
  - DELETE real en RevenueCat (falta la clave) y si se recrea el cliente tras una renovación.
  - Borrado real de los bytes en S3 (simulado con metadatos y `storage.allow_delete_query`).
  - Región de Supabase (Fráncfort) desde la API.
  - Diagnósticos de Expo.
  - DPA de DeepSeek.
  - Retención en los proveedores de IA.

## Texto y condiciones para la web

Contraste de `nivl-web/privacidad.html` (v1.2, 29-09-2026) y `terminos.html` (solo lectura; tienen cambios sin commit del usuario) con el código y con la decisión de Auth propia (2026-10-02).

| # | Dónde (web) | Discrepancia | Texto exacto propuesto |
|---|---|---|---|
| W1 | Privacidad · «Lo esencial» | Menciona la cuenta de Franky; NIVL deja el puente | Sustituir la última frase por: «Puedes exportar tus datos o eliminar tu cuenta desde Perfil, con las excepciones legales del apartado 7.» (sin Franky) |
| W2 | Privacidad §2, fila «Cuenta» | «La contraseña no la guarda NIVL: se verifica contra tu cuenta de Franky» | **Cuenta y acceso** · Ejemplos: «Email, contraseña (guardada solo como hash por el servicio de autenticación), nombre o alias, identificador de usuario, fecha de alta, confirmación del email y solicitudes de recuperación de contraseña.» · De dónde salen: «Tú, al registrarte o entrar en NIVL.» |
| W3 | Privacidad §4, fila «Servicio de acceso Franky» | Ya no es destinatario | **Eliminar la fila.** Añadir a la fila de Supabase, en «Para qué»: «…y autenticación de NIVL (registro, inicio de sesión, confirmación de email y recuperación de contraseña)». Nueva fila: «[PENDIENTE: proveedor SMTP] · Envío de los emails de confirmación y recuperación · Email y contenido del mensaje · [PENDIENTE: ubicación]» |
| W4 | Privacidad §7 y Términos («Se entra con una cuenta de Franky…», «no elimina ni modifica tu cuenta de Franky») | Franky ya no participa | Privacidad §7: «Puedes borrar registros o eliminar tu cuenta de NIVL (Perfil → Eliminar cuenta).» Términos: «Para usar NIVL creas una cuenta con tu email y una contraseña; confirmaremos tu email y podrás recuperarla desde la app.» Y quitar «Esta acción no elimina ni modifica tu cuenta de Franky». |
| W5 | Privacidad §4, fila Anthropic | No nombra las tareas automáticas ni el alias | «Para qué»: «Coach de IA, Oráculo y tareas automáticas del coach (titular de los avisos y clasificación de movimientos de Economía) cuando la solicitud utiliza un modelo Claude.» «Datos»: «Tu alias, mensajes, contexto de tu cuenta que el coach necesita (incluidos datos de salud y finanzas), importe y contraparte de los movimientos que se clasifican, imágenes adjuntas.» |
| W6 | Privacidad §2, fila «Finanzas» | No dice que la clasificación envía importe y contraparte a la IA | Añadir: «Si usas la clasificación automática, el importe y la contraparte o el concepto de cada movimiento se envían al proveedor de IA (apartado 4). El nombre de un comercio puede revelar indirectamente información sensible (por ejemplo, una farmacia).» |
| W7 | Privacidad §4, fila RevenueCat | Falta el atributo de creador y qué pasa al borrar | «Datos»: «Identificador de usuario, compras, estado de la suscripción y, si llegaste con uno, el código de creador.» Y en §7: «Al eliminar tu cuenta pedimos a RevenueCat que elimine tu registro de cliente.» (**publicar solo cuando `REVENUECAT_API_KEY` esté configurada y desplegada**) |
| W8 | Privacidad §7 | No dice qué se conserva de las compras | Añadir: «De los eventos de compra que nos envía la tienda conservamos solo su identificador, tipo, entorno y fecha, sin ningún dato que te identifique, para no procesar dos veces un cobro o un reembolso. Las ventas se conservan sin vínculo con tu cuenta para la contabilidad.» (**publicar tras aplicar b-0036**) |
| W9 | Privacidad §2 «Técnicos» y §4 Expo | «Información sobre fallos / diagnóstico»: no hay SDK de diagnóstico en la app | Si Expo no recoge diagnósticos con esta configuración: quitar «información sobre fallos» y «diagnóstico de fallos». Si se confirma que sí, dejarlo. **NO PROBADO** |
| W10 | Privacidad §8 / Términos (exportación) | No dice qué incluye | «La exportación es un archivo JSON con todos los registros de tu cuenta, incluidos los consentimientos, la suscripción y el consumo de IA, y la lista de tus fotos. De tus amistades, bloqueos y denuncias se incluye tu parte, no los datos de la otra persona.» (**tras b-0035**) |
| W11 | Privacidad §3 (salud) | Coherente con el código (retirar = confirmar el borrado) | Sin cambios, salvo que el dueño separe retirada y borrado (P2-4) |

## Archivos cambiados (solo los de mi lista)

- `supabase/functions/_shared/account-erasure.ts`: `user_not_found` idempotente; borrado del cliente en RevenueCat antes de Auth.
- `supabase/functions/account-erasure/index.ts`: pasa `REVENUECAT_API_KEY`.
- `supabase/functions/_shared/health-erasure.ts`: `ownPaths`, try/catch, `no-store`.
- `supabase/functions/_shared/sec_priv_account_erasure_test.ts` (nuevo) y `sec_priv_health_erasure_test.ts` (nuevo).
- `src/lib/account.ts` y `src/lib/__tests__/account.test.ts`.
- `src/lib/exporter.ts` y `src/lib/__tests__/sec-priv-exporter.test.ts` (nuevo).
- `docs/security-audit/{b-privacidad-borrado.md, evidencia-app-privacy.md}`.
- `docs/security-audit/proposals/b-export-completo{.sql,.test.sql}` y `b-store-events-seudonimizar{.sql,.test.sql}`.

## Orden de despliegue propuesto

1. Migraciones `b-0036` y luego `b-0035`. Son independientes y compatibles con los clientes actuales. Hay que darles número y huella.
2. Secret `REVENUECAT_API_KEY` = la clave **secreta** `sk_…`, y desplegar `account-erasure` y `health-erasure`.
3. OTA con `account.ts` y `exporter.ts` (solo JS).
4. Web: W1-W4 cuando salga la Auth propia; W5, W6, W9 y W11 ya; W7, W8 y W10 cuando estén desplegados los pasos 1-2.

## Dependencias

**Chat 4 (UI/web):**
- Hoja de «Eliminar cuenta» (`perfil.tsx:904-950`): con la Auth propia, no mencionar Franky. Mantener el aviso de que no cancela la suscripción de Apple o Google. Si la función devuelve `pending`, ofrecer «Reintentar»: ya llega como `ErrorVisible`.
- Exportación de fotos: tras b-0035, un botón «Descargar mis fotos» que use `storage_objects` y `createSignedUrl` por lote, o un ZIP en servidor.
- Separar «retirar el permiso de salud» de «borrar los datos de salud», si el dueño lo decide (P2-4).
- Web: aplicar W1-W11 en `nivl-web/privacidad.html` y `terminos.html`.
- Oráculo BYOK en web: comprobar el consentimiento de IA antes de llamar (P2-8, `oracle.ts`).

**Chat 1 (declaraciones):**
- Usar `evidencia-app-privacy.md`: tracking = No; todo vinculado.
- Decidir si DeepSeek es «compartido» en Data Safety (DPA NO PROBADO).
- Confirmar con Expo si recoge diagnósticos.
- Decidir si se sube `AI_CONSENT_VERSION` para nombrar el alias y la clasificación en la hoja (P2-6). Requiere migración y volver a pedir el consentimiento.

**Subagente (a) / dueño:**
- `clasificar` con permiso de salud o con filtro de contrapartes sanitarias (P2-5).
