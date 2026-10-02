# Fase 2 · L2 — Invitaciones con recompensa cosmética (Chat 2, 02/10/2026)

Rama `winter2/chat2-monetizacion` @99729ea. D3 aprobada: **sin días de Pro desde servidor, sin XP**; la recompensa es una insignia. Ajustes del coordinador (acordados con Chat 5 y Chat 3) incorporados: activación a 7 días reales en ventana de 21, topes antifraude 3/30 d y 12/365 d con estado `tope`, insignias `reclutador`/`lanista`/`senor_del_ludus`, `my_invites` devuelve `activos`.

## Archivos

| Archivo | Qué |
|---|---|
| `docs/payment-audit/propuestas/0045_invitaciones.sql` | Migración (el coordinador la copia a `supabase/migrations/`) |
| `scripts/test-invites.mjs` | Test SQL en PGlite en memoria (no instala nada, no toca Supabase) |
| `src/lib/invites.ts` | Cliente: `claimInvite`, `settleMyInvites`, `fetchMyInvites` + puros `mensajeInvite`, `siguienteUmbral`, `normalizarCodigo` |
| `src/lib/__tests__/invites.test.ts` | Jest con `supabase.rpc` simulado |

SHA-256 de `0045_invitaciones.sql`: `d9c2243997c25e3f25e5027fe001bd6022d6aeca342a5f507b21d1c920466d97`

Huella para `HUELLAS` de `scripts/apply-migrations.mjs`:

```js
'0045': `coalesce(obj_description(to_regprocedure('public.claim_invite(text)'), 'pg_proc') like '%nivl:invites-0045%', false)`,
```

(`to_regprocedure` y no `::regprocedure`: la sonda no revienta si la función aún no existe.)

## Contrato SQL

Tablas (RLS activo, sin políticas, `revoke all` a public/anon/authenticated; solo RPC):

- `invites(invitee uuid PK → auth.users cascade, inviter uuid not null → auth.users cascade, created_at, status ∈ pendiente|activa|caducada|anulada|tope, settled_at, check invitee<>inviter)`, índices `(inviter,status)` y `(inviter,settled_at) where activa`.
- `invite_rewards(id, user_id → auth.users cascade, kind ∈ reclutador|lanista|senor_del_ludus, created_at, unique(user_id,kind))`: auditoría de insignias.
- Si existe `require_account_active()` (0031), se le enganchan triggers de guardia de borrado (`invite_rewards.user_id`, `invites.invitee`, `invites.inviter`): 0031 solo cubrió las tablas que existían entonces.

RPC (security definer, `search_path = public, pg_temp`; `execute` solo a `authenticated`):

| RPC | Quién | Devuelve |
|---|---|---|
| `claim_invite(p_code text)` | invitado | `{ok, reason}`; reason ∈ `sin_sesion, limite, borrado_pendiente, ya_invitado, formato, desconocido, propio, fuera_de_plazo, reciproca, tope` (`null` si ok) |
| `settle_my_invites()` | quien invita; idempotente | `{ok, activos, activas, pendientes, nuevas_insignias[]}` o `{ok:false, reason}` |
| `my_invites()` | cualquiera | `{activos, pendientes, caducadas, tope, insignias[], siguiente_umbral, invitado}`; `null` sin sesión |

- El código es el **código de amigo** de 0021 (`profiles.friend_code`, 8 caracteres sin 0/O/1/I); se normaliza igual que `friend_request`.
- Activación: ≥3 días distintos con progreso en `[created_at, created_at+21 d)` y `now() ≥ created_at+7 d`; vencidos los 21 días sin eso → `caducada`. Si quien invita ya tiene 3 activaciones en 30 días o 12 en 365 días, la que cumple pasa a `tope` (no cuenta para insignias).
- Progreso = días (zona del invitado vía `safe_tz`) con `completions.completed_at` (hora del servidor; las completions solo las escribe `complete_quest` desde 0035) ∪ días de `xp_daily_ledger` (0041) con `xp > 0`. Si `xp_daily_ledger` no existe, solo completions.
- Insignias por activos: 1 `reclutador`, 3 `lanista`, 10 `senor_del_ludus` (`on conflict do nothing`).
- **Sin evento en `events`**: `invite_*` no está en la lista de tipos generales del trigger de salud (0035 la redefine); insertarlo pediría consentimiento de salud o marcaría la fila como salud. Las tablas propias son el registro. Si Chat 3/5 quieren el evento, hace falta ampliar esa lista en una migración suya.

## Contrato cliente (`src/lib/invites.ts`)

- `claimInvite(code)` → `{ok:true} | {ok:false, reason: InviteReason}`; formato inválido no llama a la red; motivo desconocido o respuesta rota → `'otro'`; error de red se lanza (la UI usa `mensajeSistema`).
- `settleMyInvites()` → `{activos, pendientes, nuevasInsignias}` (ceros si `ok:false`). Llamarla al abrir Amigos/Perfil; `nuevasInsignias` sirve para celebrar una sola vez.
- `fetchMyInvites()` → `{activos, pendientes, caducadas, tope, insignias, siguienteUmbral, invitado}`; todo a cero sin sesión.
- Puros: `mensajeInvite(reason)` (voz del sistema, sin exclamaciones, con test), `siguienteUmbral(activas)` (1→3→10→null), `normalizarCodigo`, `UMBRALES_INVITACION`.
- Nota de arquitectura: los puros viven en el mismo módulo que los efectos (archivos asignados); el test simula `../supabase`. Si Chat 5 los necesita sin Supabase, se mueven a un `invitemath.ts`.

## Compatibilidad con 1.0.7

Puramente aditiva: dos tablas, cinco funciones nuevas (`claim_invite`, `settle_my_invites`, `my_invites` y las internas `invite_erasure_pending`, `invite_progress_days`, sin `execute` para clientes) y triggers solo en las tablas nuevas. No cambia firmas existentes, no toca `subscriptions` ni sus constraints, ni `profiles`, ni `friend_request`. La 1.0.7 no llama a nada de esto. Re-ejecutable (probado dos veces seguidas).

## Anti-abuso

- Autoinvitación (`propio`), código inexistente o con formato erróneo, cuenta del invitado con >7 días (`fuera_de_plazo`), doble reclamación (PK + `on conflict do nothing` + cerrojo), invitación recíproca A↔B (`reciproca`).
- Borrado pendiente: del invitado → `borrado_pendiente` (se comprueba ANTES de escribir el log, porque la guardia de 0031 lo rechazaría); del que invita → `desconocido` (0031: no se revela el borrado de otra persona). En la liquidación no se activa a un invitado con borrado pendiente.
- Freno compartido con `friend_request` (`friend_request_log`, 30 intentos/hora): probar códigos a ciegas gasta el mismo cupo.
- Tope de 10 reclamaciones por código y día; 3 activaciones/30 d y 12/365 d por quien invita.
- Progreso con datos que el cliente no escribe (`completed_at` del servidor, no `date`, que admite 2 días atrás). Residual aceptado como en 0041: cambiar `profiles.timezone` puede desplazar un día del libro; la exigencia de 7 días reales lo acota.
- Cero valor transferible: sin XP, sin Pro, sin dinero. El incentivo para fabricar cuentas es una insignia.

## Resultados

| Comprobación | Resultado |
|---|---|
| `node scripts/test-invites.mjs C:/temp/AGROLAFORGA/node_modules/@electric-sql/pglite/dist/index.js` | `{"ok":true,"checks":66,"database":"PGlite in memory","productionTouched":false}` |
| `CI=true npx jest --ci --runInBand src/lib/__tests__/invites.test.ts` | 16/16 |
| `npm run typecheck` | sin errores |
| `CI=true npm run lint` | 0 errores (1 aviso previo en `pro-purchases.test.ts`, ajeno) |

El test PGlite carga las migraciones REALES 0021 (códigos de amigo y freno), 0031 (borrado de cuenta y guardias) y 0041 (`xp_daily_ledger`) sobre un esquema mínimo, y 0045 dos veces. Casos: huella; autoinvitación; código inexistente y formato; cuenta >7 días; sin sesión; código con espacios/minúsculas; doble reclamación (mismo y otro código); recíproca; borrado pendiente propio y ajeno; freno 30/h; <7 días con progreso sigue pendiente; 7 días + 3 días → activa + `reclutador`, idempotente; mismo día repetido cuenta una vez; progreso mixto completions + libro; inactivo → caducada; progreso fuera de los 21 días no cuenta; 4.ª activación en 30 d → `tope` sin insignia; 13.ª en 365 d → `tope`; `lanista` y `senor_del_ludus` una sola vez; `my_invites` sin ids ajenos; tope 10/día por código; borrado en cascada (invitado, quien invita e insignias); permisos (anon no ejecuta las 3 RPC; authenticated no lee ni inserta en las tablas ni ejecuta las internas; RLS activo); `subscriptions` y XP intactos; ningún evento `invite*`.

## Dependencias

- **Coordinador**: copiar `0045_invitaciones.sql` a `supabase/migrations/` y añadir la huella. Aplicar ANTES de cualquier OTA que llame a estas RPC.
- **Chat 5**: diseño de las insignias `reclutador`/`lanista`/`senor_del_ludus` (cosméticas, cero XP, solo blanco y negro + laurel de la marca) y embudo: `claimInvite` en onboarding/«¿Quién te invitó?» (primeros 7 días; convive con `claim_referral` de creadores, son tablas distintas) y `settleMyInvites` al abrir Amigos/Perfil. Consume `activos`.
- **Chat 4**: sección de invitar en `amigos.tsx` con `fetchMyInvites()` y `mensajeInvite()`.
- **Chat 3**: (1) **exportación**: `export_my_data()` (0044) enumera tablas; falta añadir `invite_rewards` (tiene `user_id`) y, como relación, solo la parte propia de `invites` (como invitado: `created_at`, `status`; como quien invita: cifras o filas sin el uuid del invitado). (2) Borrado: cubierto por `on delete cascade`; revisar si se quiere conservar algo para auditoría. (3) Revisión anti-abuso y, si se quiere, el estado `anulada` (hoy solo lo pondría un administrador con service_role) y el evento en `events` (requiere ampliar la lista de 0035).
- **Chat 1**: dictamen 3.1.1/3.2.2 confirma que la recompensa es solo de estatus (sin Pro, sin dinero, sin incentivo a valorar).
