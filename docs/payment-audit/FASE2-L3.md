# Fase 2 · L3 — Programa de creadores gamificado

Rama `winter2/chat2-monetizacion` (base 99729ea). Decisión D4 de `FASE2-PLAN.md`.
Nada se ha ejecutado contra Supabase real; ningún dato de creadores en el repo.

## Entregables

| Archivo | Qué |
|---|---|
| `docs/payment-audit/propuestas/0046_programa_creadores.sql` | SQL B, aditiva. El coordinador la copia a `supabase/migrations/` y añade la huella. |
| `scripts/test-creator-program.mjs` | PGlite en memoria: esquema mínimo + **0025 real** (carga sin réplica) + 0046 ×2. |
| `src/lib/creatormath.ts` (+test) | `enlaceCreador` → `https://nivl.app/c/CODIGO`; `progresoRango`, `estadoReto`, `CreatorRole`, `rolValido`, `rangoValido`. |
| `src/lib/creators.ts` (+test nuevo) | `fetchCreatorProgress`, `fetchCreatorHistory`, `fetchCreatorBoardPeriod`. |
| `src/lib/creatorprogram.ts` (+test) | Parseo puro de las RPC, `PortalCreador`, `RPC_PORTAL`, `vistaPanelCreador`, kit de clips y `revisarTexto`. |
| `scripts/creadores.mjs` | `rol`, `reto lista|alta|cerrar`, `umbral`, `revisar-rangos [--aplicar --confirmar]`. |

## 0046 · huella y SHA-256

- Huella (`HUELLAS` de `scripts/apply-migrations.mjs`):
  `'0046': \`coalesce(obj_description(to_regprocedure('public.creator_progress()'), 'pg_proc') like '%nivl:creator-program-0046%', false)\``
- SHA-256 del archivo entregado: `4a8c9049061579465445c4b2c969e6f39cb0c7fbc72a0fd53ba743f1bdbc70da`

Contenido: `creators.role` (`creador|comercial|clipper`, por defecto `creador`);
`creator_rank_rules` (rank → `creator_ranks`, `min_sales_90d`, `min_months_active`
por defecto 0) **sin filas**; `creator_challenges` (título ≤80, descripción ≤300,
`ends_at > starts_at`, `goal_sales > 0`, premio ≤200, `role` null = todos). RLS
activa, sin políticas y `revoke all` a anon/authenticated, como en 0025. Una
función interna `creator_sales_between` (sin grant a nadie) y tres RPC de solo
lectura con `grant execute` a `authenticated`.

### Compatibilidad con 1.0.7

Aditiva: no re-crea ni toca `creator_panel`, `creator_board`, `claim_referral`,
`my_referral`, `record_sale`, `record_refund`, `liquidate_creator`. El `role`
nuevo tiene valor por defecto, así que las altas de `creadores.mjs alta` y los
`select *` de 0025 siguen igual. Probado: `creator_panel()` devuelve lo mismo y
`creator_board_period('mes')` = `creator_board()` fila a fila.

## Contrato para Chat 4 (portal web y `creador.tsx`)

Todo con supabase-js y la **sesión del creador** (nunca service_role). Cada RPC
revalida `creators.user_id = auth.uid() and active`; si no, null / 0 filas.
Una "venta" es la de 0025: cuenta nueva con primer cobro y comisión viva.

| RPC (`RPC_PORTAL`) | Devuelve | Parseo puro |
|---|---|---|
| `creator_panel()` (0025) | jsonb \| null con su dinero | `fetchCreatorPanel` (creators.ts) |
| `creator_progress()` | jsonb \| null: `alias, code, role, rank, pct, base_cents, sales_90d, months_active, next_rank, next_min_sales_90d, next_min_months_active, challenges[{id, title, description, starts_at, ends_at, goal_sales, prize, role, sales}]` | `parseCreatorProgress` |
| `creator_sales_history(p_months int default 12)` | filas `month 'AAAA-MM' (Madrid), sales, pending_cents, available_cents, paid_cents, voided_cents, clawback_cents`; mes en curso primero; `least(greatest(p_months,1),24)`, null = 12; sin user_id de compradores | `parseCreatorHistory` |
| `creator_board_period(p_period text)` | `alias, sales, pos, is_me`; `'mes'` o `'reto:<uuid>'`; reto de otro rol, inexistente o periodo raro = 0 filas; en un reto con rol solo compiten los de ese rol | `parseCreatorBoard`, `periodoTabla` |

`PortalCreador` (en `creatorprogram.ts`): `{ panel, progreso, historico, tablas: {'mes'?, 'reto:<uuid>'?}, enlace, kit }`.
`progresoRango(ventas90, reglas, meses)` y `estadoReto(reto, ventas, ahora)` dan la barra y la línea de cada reto.

### Tienda sin importes (dictamen del Chat 1, vía coordinador)

En iOS/Android (`esTienda(Platform.OS)`) el panel **no enseña ningún importe en €**:
solo rango, ventas atribuidas, retos y tabla. `vistaPanelCreador(plataforma, {panel, progreso, historico, tabla})`:

- Tienda → `PanelCreadorTienda` (`conImportes: false`) construido con **lista
  blanca**: sin céntimos, sin %, sin pagos ni fijo; histórico solo `{month, sales}`;
  premios, títulos o descripciones de reto que hablen de dinero se quitan; un alias
  con dinero cae en el código. Lleva `aviso: 'Tus ganancias se gestionan en nivl.app.'`
  y `enlaceAviso: 'https://nivl.app'` — **texto o enlace informativo, nunca un
  botón de cobro**.
- Web → `PanelCreadorWeb` (`conImportes: true`) con todo el dinero propio.
- Test: en `ios` y `android` el JSON de la vista no contiene `€`, `euros`, `$`, `%`
  ni claves de dinero.

**Pendiente de Chat 4**: `src/app/creador.tsx` hoy pinta `pendingCents`,
`availableCents`, `paidCents`, `pct`, premio y pagos desde `fetchCreatorPanel()`.
Debe pasar a pintar `vistaPanelCreador(Platform.OS, …)` en tienda (no lo he tocado:
es UI del Chat 4).

## Kit de clips (`KIT_CLIPS`)

Ganchos, guiones de 15/30/60 s, reglas de marca (solo blanco y negro, voz del
sistema, app real, vocabulario de arena), aviso obligatorio `#publi` y lo
prohibido: precios no oficiales, «gratis para siempre», promesas de resultados,
pedir valoraciones/descargas a cambio de algo (Apple 3.2.2/5.6.3, Google Play).
`revisarTexto(texto)` es una red para lo evidente; la revisión final es humana.
Los precios oficiales salen de `PRO_PLANS` (`proplans.ts`, solo lectura).

## Administración (`scripts/creadores.mjs`)

`rol CODIGO rol` · `reto lista` · `reto alta "título" desde hasta objetivo ["premio"] [--rol R] [--desc "…"]`
(fechas de Madrid, último día entero) · `reto cerrar ID` (si no ha empezado se
borra; si no, termina ahora) · `umbral pro|elite ventas90 [meses]` / `--quitar` ·
`revisar-rangos` solo propone (sube y baja); aplica únicamente con
`--aplicar --confirmar`, y cada update exige que el rango siga siendo el revisado.
El SQL de estos comandos se validó en PGlite; nada contra la base real.

## Resultados

- `npm run typecheck`: OK.
- `CI=true npx jest --ci --runInBand src/lib/__tests__`: 44 suites, 637 tests OK.
- `CI=true npm run lint`: 0 problemas.
- `node scripts/test-creator-program.mjs …/pglite/dist/index.js`: **67 comprobaciones OK**
  (no creador/desactivado → null y 0 filas; cada creador solo lo suyo; retención 30 d
  → pendiente vs disponible; pagado; reembolso sin pagar → anulado; reembolso de lo
  pagado → anulado + clawback, en su mes; 24 meses máximo, 1 mínimo, null = 12;
  tabla por reto y por rol; periodos basura; compatibilidad 0025; anon y
  authenticated sin acceso a tablas ni a la función interna; 0046 dos veces sin
  duplicar el check; huella verdadera).

## Dependencias

- **Chat 1**: dominio `nivl.app`, AASA/assetlinks para `/c/*` y la página web
  `/c/CODIGO` que guarde el código si no hay app. Hasta entonces el enlace
  `https://nivl.app/c/CODIGO` no abre la app (el esquema `nivl://c/` sigue
  funcionando en `c/[code].tsx`). `URL_NIVL` de `socialmath.ts` sigue en la web
  provisional: no lo he tocado (otro dueño).
- **Chat 4**: `creador.tsx` con `vistaPanelCreador` en tienda; portal web con
  `RPC_PORTAL`/`PortalCreador`, histórico y tablas por reto; sección de kit.
- **Coordinador**: copiar 0046, añadir la huella y aplicar.
