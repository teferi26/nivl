# Plan: tres niveles, potencia de IA, Élite y programa de creadores

Decidido por el dueño el 2026-09-24. Esto es un PLAN: no hay nada implementado.
**Fuente de verdad de precios, presupuestos y comisiones: `docs/PRECIOS.md`**
(reescrito el mismo día). Aquí solo se repite lo que el código necesita.

Cada fase deja la app funcionando y se puede publicar sola. Las migraciones
siguen la regla de siempre: número nuevo (la primera libre es la **0024**),
huella en `HUELLAS` de `scripts/apply-migrations.mjs` y **nunca** se edita una
ya aplicada. Orden: esquema BD → Edge Functions → datos (`src/lib`) → UI. Una
migración o un despliegue de función va SIEMPRE antes que la OTA que lo usa.

---

## 0. Lo que el código tiene que reflejar de PRECIOS.md

- Pro 12,99 €/mes · 99,99 €/año. Élite 29,99 €/mes · 299 €/año · fundador
  249 €/año (100 plazas, precio congelado).
- Presupuestos de IA (`ai_plans`, en microdólares, cambiables con un `update`):
  cortesía/prueba **0,50 $**, Pro **1,50 $** (DeepSeek), Élite **4,00 $**
  (Sonnet + modo profundo con el modelo top). Owner, 40 $ como hoy.
- La prueba de 7 días es `plan = 'cortesia'` con presupuesto propio de 0,50 $.
  Aquí se implementa como `status = 'trialing'` + `current_period_end` a 7 días
  sobre ese plan. **Ojo**: bajar `cortesia` de 2,50 $ a 0,50 $ afecta también a
  las cuentas que la 0020 pasó a cortesía indefinida (los primeros usuarios).
  Si el dueño quiere respetarlos, se crea un plan `cortesia_historica` con
  2,50 $ y se les mueve en la misma migración (decisión pendiente, §11).
- Modo profundo: solo Élite (Pro es "Estándar"). Propuesta de reparto del
  Élite: 4,00 $ = **2,50 $ estándar + 1,50 $ profundo**. Con Sonnet, 2,50 $
  son ~8 briefs en la cuenta más pesada medida y ~30 en una normal: medir dos
  semanas en `coach_runs`; si se agota antes del día 30, la palanca es
  `routes.brief = 'deepseek-v4-pro'` para Élite, sin desplegar.
- Comisión de creador: base **100 €** × 25/35/50 % según rango. Anual: todo
  en el primer pago. **Mensual: su % del neto de cada mes cobrado hasta llegar
  al mismo tope** (25/35/50 €). Renovaciones: 0 % (parámetro, máx. 10 %).
  Retención **30 días**; reembolso = comisión anulada. **Fuera del Small
  Business Program, la comisión sobre Pro anual se limita a 35 %** (parámetro).
- Neto = precio / 1,21 × (1 − comisión de tienda); la de tienda es 15 % con
  SBP y 30 % sin él (parámetros en `creator_settings`).
- Dominio **nivl.app** es nuestro: términos, privacidad, enlaces universales y,
  más adelante, la web del panel de creadores.

---

## 1. Fases

| Fase | Qué | Cómo sale | Bloqueo |
|---|---|---|---|
| 0 | Tareas solo del dueño | fuera del repo | — (empieza ya, en paralelo) |
| 1 | Niveles + potencia de IA + prueba de 7 días | migración 0024 + `coach` + **OTA** | secrets de DeepSeek puestos ANTES |
| 2 | Programa de creadores: código, enlace `nivl://`, panel, admin | migración 0025 + **OTA** | condiciones del programa (legal) |
| 3 | Élite: insignia y escuadras de rendición de cuentas | migración 0026 + **OTA** | decisión de color del laurel |
| 4 | Tienda: RevenueCat, compra, webhook, comisiones reales, enlaces universales | migración 0027 + función nueva + **binario 1.0.7** | productos en App Store Connect y RevenueCat |
| 5 | Aplazado (ver §12) | — | — |

Las fases 1-3 son solo JS/TS: salen por OTA al binario 1.0.6 **sin subir
`version`**. El esquema `nivl://` ya está en el binario, así que el enlace de
creador también sale por OTA. Solo la fase 4 necesita binario (dependencia
nativa `react-native-purchases` y `associatedDomains` para `nivl.app`).

Élite no se vende en la tienda hasta que la fase 3 esté fuera: Apple (3.1.2)
exige que una suscripción entregue lo que promete, y en la oferta solo se
listan funciones que existen (regla que ya cumple `PRO_BENEFITS`).

---

## 2. Fase 0 — Lo que solo puede hacer el dueño

1. **DeepSeek**: cuenta y clave; en Supabase → Edge Functions → Secrets:
   `COACH_BASE_URL=https://api.deepseek.com` y `COACH_API_KEY=…`. Con el
   enrutado nuevo el modelo sale de `ai_plans.routes`, no de
   `COACH_MODEL_CHAT`. Sin esto, Pro y la prueba caen a Sonnet (el candado
   corta igual, pero 0,50 $ de prueba son dos briefs).
2. **Small Business Program** de Apple y tarifa reducida de Google:
   solicitarlos. Mientras no estén concedidos, `creator_settings.small_business_program`
   va a `false` (tope de 35 % en Pro anual y neto al 30 %).
3. **App Store Connect**: acuerdo de apps de pago, banco e impuestos. Un solo
   *grupo de suscripción* "NIVL" con los cinco productos, Élite por encima de
   Pro (así se excluyen y el cambio lo gestiona Apple): `nivl_pro_mensual`
   12,99 · `nivl_pro_anual` 99,99 · `nivl_elite_mensual` 29,99 ·
   `nivl_elite_anual` 299 · `nivl_elite_fundador` 249. Oferta introductoria
   de 7 días solo si se quiere la prueba también por tienda (la de servidor de
   la fase 1 no la necesita).
4. **Play Console**: los mismos ids (necesita la app al menos en pruebas internas).
5. **RevenueCat**: proyecto, apps iOS/Android, entitlements `pro` y `elite`
   (Élite concede ambos), offering por defecto, webhook a
   `https://dueyufxxkiixdxighpaz.supabase.co/functions/v1/revenuecat-webhook`
   con cabecera Authorization secreta → `supabase secrets set
   REVENUECAT_WEBHOOK_AUTH=…`. Claves públicas del SDK como variables de EAS
   (`EXPO_PUBLIC_RC_IOS_KEY`, `EXPO_PUBLIC_RC_ANDROID_KEY`), no en el repo.
6. **nivl.app**: publicar `/terminos` y `/privacidad` (ya enlazados en
   `LEGAL_URLS`), y para la fase 4 el archivo
   `/.well-known/apple-app-site-association` (y `assetlinks.json` para
   Android) con la ruta `/c/*`, más una página mínima `/c/CODIGO` que enseñe el
   código y los botones de tienda.
7. **Legal**: **condiciones del programa de creadores** (comisión, retención,
   reembolsos, pagos, fiscalidad de cada creador) y **bases de los retos
   trimestrales** (Apple 5.3: concurso con premio = bases oficiales y aclarar
   que Apple no lo patrocina).
8. **Decisiones pendientes** (§11).

---

## 3. Fase 1 — Tres niveles y elegir potencia (servidor + OTA)

**Idea central**: el candado de 0020 se extiende, no se sustituye. Se añaden
a `ai_plans` el nivel (`tier`), un bolsillo de presupuesto **profundo**
separado del estándar y un mapa de modelos por ritual (`routes`). El proveedor
sale del **nombre del modelo** (`claude-*` → Anthropic; cualquier otro → la
API compatible de `COACH_BASE_URL`), así que Pro va por DeepSeek y Élite por
Anthropic **a la vez**. Los bolsillos son separados a propósito: si el
estándar se comiera el profundo, "te quedan 5 turnos profundos" mentiría.

Pasos:

1. `supabase/migrations/0024_niveles_y_potencia.sql` (SQL en §8).
   Huella: `'0024': exists(select 1 from information_schema.columns where table_name = 'ai_plans' and column_name = 'routes')`.
   Arregla de paso un fallo real: el CHECK de `coach_runs.kind` (0008) no
   admite `clasificar` ni `resumen_*`, así que esos inserts fallan y **su
   coste no entra en el candado** (solo queda un `console.error`).
2. `supabase/functions/_shared/routing.ts` (nuevo, puro):
   - `type Modo = 'estandar' | 'profundo'`.
   - `elegirModelo(routes, kind, modo, fallbackEnv): string` →
     `modo === 'profundo' ? routes.profundo : routes[kind] ?? routes.default ?? fallbackEnv()`.
   - `proveedorDe(model): 'anthropic' | 'compat'` por prefijo `claude-`.
3. `supabase/functions/coach/index.ts`:
   - Leer el modo de la cabecera `x-nivl-mode` (no del cuerpo: la puerta va
     antes de leer el cuerpo a propósito).
   - `admin.rpc('ai_begin_turn', { p_user, p_mode })`; añadir a `MENSAJES`
     `profundo_no_incluido` (402, "El modo profundo es parte de NIVL Élite.": es la respuesta que recibe un Pro)
     y `profundo_agotado` (402, "Has usado tus turnos profundos de este mes.
     El modo estándar sigue disponible.").
   - `atender(req, userId, token, estado)` recibe `turn_budget`, `routes` y
     `mode`. `modeloDe(kind)` pasa a `elegirModelo(estado.routes, kind, mode,
     () => modeloDeEnv(kind))`: la función actual, renombrada, queda como
     reserva (es la que usa el owner).
   - En el bucle, `compat` deja de ser global: si `proveedorDe(elegido) ===
     'compat'` se usa `proveedorCompatible()`; sin esos secrets se cae a
     `COACH_MODEL` con `console.warn` (el candado sigue cortando el gasto).
   - Profundo: `effort 'xhigh'`, `maxTokens` 16000, tope por turno
     `min(1_500_000, turn_budget)` en vez de 750.000.
   - `coach_runs.insert({ …, mode })` en los sitios de `atender`.
   - La "revisión semanal profunda" de Élite sale solo por `routes`
     (`revision_semanal` ya piensa en `xhigh`); cuenta en el bolsillo estándar
     y no gasta turnos profundos del usuario.
4. `supabase/functions/_shared/anthropic.ts`: solo el comentario de
   `proveedorCompatible` (ya no es "el proveedor global"). `claude-opus-5` y
   `deepseek-v4-flash` ya están en `PRICE_PER_MTOK`.
5. `src/lib/proplans.ts` (puro):
   - `AiStatus`: `plan` admite los nuevos (`pro_mensual`, `pro_anual`,
     `elite_mensual`, `elite_anual`, `elite_fundador` y los
     heredados); campos nuevos `tier: 'free'|'pro'|'elite'|'owner'`,
     `deepAllowed`, `deepRemaining`, `deepTurns`, `trialAvailable`.
   - `isElite`, `turnosProfundos`, `puedeProfundo`.
   - `planLabel`: etiqueta por plan y **valor por defecto** para uno
     desconocido. El owner deja de llamarse "Fundador" (choca con Élite
     fundador): "Dueño".
   - `ProPlanId` pasa a los cinco ids; `PRO_PLANS` → planes agrupados por
     nivel (`TIERS`) con 12,99/99,99 y 29,99/299/249; `ELITE_BENEFITS` solo
     con lo que ya existe (en esta fase: máxima potencia y modo profundo);
     `legalText(id)` por plan.
   - `src/lib/__tests__/proplans.test.ts`: rehacer (Pro anual −36 %, 4 meses
     gratis; Élite anual −17 % frente a 29,99).
6. `src/lib/pro.ts`: `fetchAiStatus` mapea los campos nuevos con valores por
   defecto; `startTrial(): Promise<{ ok: boolean; reason?: 'ya_usada' }>`
   sobre la RPC `start_trial`.
7. `src/lib/coach.ts`: `streamCoach({ mode })` → cabecera `x-nivl-mode`;
   `CoachDenyReason` suma `profundo_no_incluido | profundo_agotado`, y
   `DENY_REASONS` y `accessNotice` los cubren (el `switch` sin `default`
   obliga a ello con TS estricto).
8. `src/app/(tabs)/coach.tsx`: selector **Estándar / Profundo** con dos
   `Chip` encima del `TextInput`, solo si `deepAllowed`; debajo, "Te quedan
   N turnos profundos este mes". Tras cada turno profundo el selector
   **vuelve a Estándar** (que no se queme el mes por despiste) y se relee
   `fetchAiStatus()`. Con 0 turnos, el chip queda deshabilitado con su
   texto; nunca un error.
9. `src/components/ProOffer.tsx` y `src/app/pro.tsx`: conmutador Pro / Élite
   dentro de `useProOffer` (el nivel elegido vive ahí para que el pie fijo
   siga funcionando); lista de solo lectura mientras `purchasesAvailable()`
   sea false. CTA nueva si `trialAvailable`: **"Probar el coach 7 días"** →
   `startTrial()` → releer estado. En `src/app/onboarding.tsx`, paso 6, es la
   acción principal mientras la tienda esté cerrada.
10. `docs/PRECIOS.md`: rehacer con §0. `AGENTS.md`: una línea en "NIVL Pro"
    sobre niveles, `routes` y modo profundo.

**Salida**: aplicar 0024 → desplegar `coach` → `node scripts/smoke-coach.mjs`
con un Pro y un Élite → OTA.

---

## 4. Fase 2 — Programa de creadores (servidor + OTA)

**Decisión: el panel va dentro de la app, en una pantalla oculta** (`/creador`),
no en web: aún no hay stack web, la app ya tiene la sesión y sale por
OTA. La web (nivl.app ya es nuestro) queda para después: primero que funcione y se use. **El admin no tiene pantalla**:
es un script local con el token del proyecto, como `apply-migrations.mjs`; así
ningún dato de creadores pasa por el repo ni por una interfaz expuesta.

Reglas (todas en SQL y auditables; los parámetros, en `creator_settings` y
`store_products`):
- Atribución a la primera que llegue y para siempre; solo si la cuenta tiene
  menos de `claim_window_days` (14) y aún no ha pagado; nunca a uno mismo.
- **Tope por cuenta** = base del producto (100 €) × % del rango del creador en
  el momento del cobro. Sin SBP, el % de Pro anual se limita a
  `store_products.max_pct_without_sbp` (35).
- **Anual**: el primer cobro paga el tope entero (`kind = 'primer_pago'`).
- **Mensual**: cada cobro paga `neto × %` (`kind = 'mensual'`) hasta llenar el
  tope; después, nada. Si la cuenta pasa de mensual a anual a mitad, el anual
  paga lo que falte hasta el tope. Un cambio Pro→Élite no reinicia el tope.
- Renovaciones anuales, ya con el tope lleno: `renewal_pct` sobre la base
  (0 por defecto; `kind = 'renovacion'`).
- Cada comisión nace `pendiente` con `available_at = cobro + hold_days` (30).
  "Disponible" no es un estado guardado: `pendiente` con `available_at <= now()`.
  Sin cron.
- Reembolso (webhook): comisión no pagada → `anulada`; ya pagada → `anulada`
  con `clawback`, que se resta en la siguiente liquidación (Apple admite
  reembolsos hasta ~90 días, más allá de la retención).
- Fijos mensuales, premios y lo de Whop (vistas/CPM) se apuntan a mano en
  `creator_payouts` con su `kind`; salen del presupuesto de marketing.

Pasos:

1. `supabase/migrations/0025_creadores.sql` (§8). Huella:
   `'0025': to_regclass('public.creators') is not null`.
2. `src/lib/creatormath.ts` (puro) + `src/lib/__tests__/creatormath.test.ts`:
   `normalizarCodigo` (mayúsculas, sin espacios, `^[A-Z0-9_]{3,20}$`),
   `netoCents(precio, sbp)`, `comisionCents(tope, acumulado, neto, pct, periodo)` (mismo redondeo que el SQL, con casos: anual, mensual hasta el tope, cambio a anual, sin SBP) y el formateo del panel.
3. `src/lib/creators.ts` (efectos): `claimReferral(code, source)`,
   `fetchMyReferral()`, `fetchCreatorPanel()`, `fetchCreatorBoard()`,
   `guardarCodigoPendiente` / `tomarCodigoPendiente` (AsyncStorage
   `nivl.codigoCreador`). Un rechazo de negocio vuelve como resultado, no
   como excepción; el resto, por `mensajeSistema`.
4. Enlace `nivl://c/CODIGO`: `src/app/c/[code].tsx` guarda el código y hace
   `router.replace('/')`. En `src/app/_layout.tsx` el guard trata `c` como
   zona pública (`segments[0] === 'login' || segments[0] === 'c'`) para que
   el código se guarde antes del salto a `/login`. Arrancar Metro para
   regenerar las rutas tipadas.
5. `src/app/onboarding.tsx`, paso 1 (nombre): campo opcional **"¿Quién te
   trajo?"**, precargado con el código pendiente. Al avanzar se llama a
   `claimReferral`; si falla, una línea bajo el campo y se deja seguir. Sin
   conexión: queda pendiente y `src/app/index.tsx` lo reintenta al entrar. No
   se añade paso (siguen 7).
6. `src/app/(tabs)/perfil.tsx`: fila "Código de creador" (sin atribución y en
   plazo) y fila **"Panel de creador"** solo si `fetchCreatorPanel()`
   devuelve algo.
7. `src/app/creador.tsx`: panel con huecos mientras carga (`Skeleton`):
   código y enlace para copiar, rango y %, instalaciones atribuidas (total y
   mes), ventas, pendiente, disponible, pagos recibidos, posición del mes,
   premio del primero y el ranking (alias y ventas del mes; nunca dinero ajeno).
8. `scripts/creadores.mjs` (admin, local): `alta CODIGO "alias" [rango]` ·
   `vincular CODIGO email` · `rango CODIGO novato|pro|elite` · `fijo CODIGO
   euros` · `premio "texto"` · `informe [AAAA-MM]` · `liquidar CODIGO`
   (desglose y confirmación; llama a `liquidate_creator`) · `pago CODIGO euros
   fijo_mensual|premio|contenido_externo|ajuste "nota"`. Lee el token como
   `apply-migrations.mjs`. Si exporta algo, a `privado/` (gitignorado).
9. `.gitignore`: `privado/` y `scripts/*.local.*`.

Nota honesta sobre "instalaciones atribuidas": sin un SDK de atribución
(Branch, AppsFlyer) no hay *deferred deep link*: quien pulsa el enlace sin la
app llega a la tienda y el código se pierde. La cifra real son **cuentas que
meten el código**. Por eso la pregunta del onboarding es el mecanismo
principal y el enlace solo ayuda a quien ya tiene la app.

---

## 5. Fase 3 — Élite: insignia y escuadras (servidor + OTA)

Revisado con la lente del game balancer: **nada de esto mueve XP, racha,
piedras de protección ni el orden de ningún ranking**. La insignia es
estética; el marcador de escuadra usa exactamente las métricas recortadas de
`friends_board` (sin penalizaciones, 500 XP por completion como mucho). No
se vende nunca una piedra de protección ni un "salvar racha".

1. `supabase/migrations/0026_elite.sql` (§8). Huella:
   `'0026': to_regclass('public.elite_groups') is not null`.
2. `src/lib/social.ts`: `fetchEliteBadges(): Promise<Set<string>>`,
   `fetchMyEliteGroup()`, `requestEliteGroup(goal, note)`,
   `fetchGroupBoard(days)` (mismo `BoardEntry` que `fetchBoard`).
3. `src/components/EliteBadge.tsx`: laurel pequeño junto al nombre.
   **Choca con el sistema de diseño**: el oro está reservado a "rachas e
   hitos". O el dueño amplía esa regla en
   `.claude/skills/nivl-design-system/SKILL.md` ("…y la insignia Élite"), o
   la insignia va en blanco hueso con el trazo del laurel. Decisión pendiente.
4. `src/app/amigos.tsx`: insignia en las filas cuyo `user_id` esté en el
   conjunto; sección **"Tu escuadra"** para Élite (marcador 7/30 días) o, sin
   escuadra, "Pedir escuadra" con el objetivo (los cinco perfiles de
   `kinds.ts`) y una nota de 280 caracteres. Para Pro, nada: sin paywall
   dentro de Amigos.
5. `src/app/(tabs)/perfil.tsx`: insignia junto al nombre propio.
6. `scripts/escuadras.mjs`: `crear "nombre" objetivo`, `asignar grupo email`,
   `pendientes`. Con 100 plazas de fundador, emparejar a mano es lo sensato.
7. Acceso anticipado: `src/lib/features.ts` (puro) con `enabled(feature, tier)`.
   Solo el mecanismo; qué entra es decisión de producto.
8. Añadir a `ELITE_BENEFITS` lo que ya exista: escuadra, insignia, revisión
   semanal con el modelo top. Los retos, cuando existan.

---

## 6. Fase 4 — Tienda: RevenueCat (binario 1.0.7)

1. `npm i react-native-purchases` y lockfile con
   `npx npm@10.9.2 install --package-lock-only`. No necesita plugin en
   `app.json`. `version` → **1.0.7** (hay nativo). No funciona en Expo Go: se
   prueba en TestFlight con cuentas sandbox (build por GitHub Actions).
2. `src/lib/pro.ts`: `purchasesAvailable()` = módulo nativo presente y clave
   de la plataforma definida. Al iniciar sesión, `Purchases.configure({ apiKey })`
   + `Purchases.logIn(userId)` (el `app_user_id` TIENE que ser el uuid de
   Supabase: con él escribe el webhook); `logOut` al cerrar sesión.
   `purchase(planId)` busca el paquete por `product.identifier`; cancelar no
   es error. `restorePurchases()`. Tras comprar, releer `fetchAiStatus()` con
   reintentos cortos (el webhook tarda segundos).
3. Tras `claimReferral` con éxito: `Purchases.setAttributes({ creator_code })`
   (solo para los gráficos de RevenueCat; la verdad está en `referrals`).
4. `supabase/migrations/0027_tienda.sql` (§8). Huella:
   `'0027': to_regclass('public.store_events') is not null`.
5. `supabase/functions/revenuecat-webhook/index.ts` (nueva): compara
   `Authorization` con `REVENUECAT_WEBHOOK_AUTH` en tiempo constante (si no,
   401), llama a `apply_store_event(event)` con el cliente de servicio y
   responde 200 aunque el evento se ignore (RevenueCat reintenta los no-200).
   Desplegar con `--no-verify-jwt`.
6. `ProOffer`: con la tienda abierta, selector, "Restaurar compras", letra de
   renovación y enlaces legales (ya previstos). Élite fundador solo mientras
   `founder_seats_left() > 0`; al llegar a 0 el dueño cambia la offering en
   RevenueCat (el tope es blando: dos compras simultáneas en la plaza 100
   entran las dos).
7. Stripe (web) queda como está; cuando haya web, `stripe-webhook` llamará
   también a `record_sale`.

8. **Enlaces universales** (van en este binario porque tocan `app.json`):
   `ios.associatedDomains: ["applinks:nivl.app"]` y el `intentFilters` de
   Android para `https://nivl.app/c/*`. La ruta `src/app/c/[code].tsx` de la
   fase 2 sirve para los dos esquemas. Requiere el paso 6 de la fase 0.

---

## 7. Qué NO entra en el repo (teferi26/nivl es público)

Entra (está bien): el esquema, los porcentajes por rango (25/35/50), la base
de 100 €, los ids de producto, los presupuestos de `ai_plans`, los scripts.

**Nunca** entra:
- Códigos reales de creador, alias, emails, nombres, cuántos son, cuánto ha
  ganado cada uno, pagos, IBAN o datos fiscales. Ningún `insert into
  creators` ni `creator_payouts` en una migración: las altas van con el
  script contra la base.
- Exportes del script (`privado/`, `*.local.*`), capturas del panel.
- `REVENUECAT_WEBHOOK_AUTH`, claves de DeepSeek y Anthropic, clave de
  servicio de Supabase, token de despliegue (ya gitignorado).
- Claves públicas de RevenueCat: como variables de EAS, no escritas en código
  (no son secretas, pero así se rotan sin commit).
- El importe del premio de creadores si es confidencial: va en
  `creator_settings.prize_text`, que se escribe con el script.
- La 0020 ya lleva el email del dueño; no repetir ese patrón.

---

## 8. Migraciones SQL

### 0024_niveles_y_potencia.sql

```sql
-- NIVL · 0024 — Tres niveles y dos potencias de IA.
--
-- Extiende el candado de 0020; no lo sustituye. Cada plan de ai_plans lleva
-- ahora su nivel, un bolsillo de presupuesto PROFUNDO separado del estándar y
-- un mapa de modelos por ritual (routes). El proveedor lo deduce la función
-- `coach` del nombre del modelo, así que Pro (DeepSeek) y Élite (Anthropic)
-- conviven. Los bolsillos son separados para que "te quedan N turnos
-- profundos" no mienta: el chat estándar no se come el profundo.
--
-- Si cambias un presupuesto, rehaz docs/PRECIOS.md (fuente de verdad).

-- ── Planes ─────────────────────────────────────────────────────────
-- La prueba de 7 días NO es un plan: es 'cortesia' con status 'trialing' y
-- current_period_end a siete días (docs/PRECIOS.md).
alter table public.subscriptions drop constraint if exists subscriptions_plan_check;
alter table public.subscriptions add constraint subscriptions_plan_check check (plan in (
  'mensual', 'anual',                 -- heredados (Stripe): son Pro
  'pro_mensual', 'pro_anual',
  'elite_mensual', 'elite_anual', 'elite_fundador',
  'cortesia', 'owner'
));

alter table public.ai_plans
  add column if not exists tier text not null default 'pro',
  add column if not exists deep_budget_micro_usd bigint not null default 0,
  add column if not exists deep_turn_estimate_micro_usd bigint not null default 400000,
  add column if not exists routes jsonb not null default '{}'::jsonb;

alter table public.ai_plans drop constraint if exists ai_plans_tier_check;
alter table public.ai_plans add constraint ai_plans_tier_check
  check (tier in ('pro', 'elite', 'owner'));
alter table public.ai_plans drop constraint if exists ai_plans_deep_check;
alter table public.ai_plans add constraint ai_plans_deep_check check (
  deep_budget_micro_usd >= 0
  and deep_budget_micro_usd <= monthly_budget_micro_usd
  and deep_turn_estimate_micro_usd > 0
);
alter table public.ai_plans drop constraint if exists ai_plans_routes_check;
alter table public.ai_plans add constraint ai_plans_routes_check
  check (jsonb_typeof(routes) = 'object');

-- Claves de routes: 'default', cualquier kind del coach (chat, brief, plan,
-- revision_semanal, cierre_mensual, escalada) y 'profundo'. Sin 'profundo' no
-- hay modo profundo. Sin 'default' ni el kind, la función usa los secrets
-- COACH_MODEL_* (es lo que hace el owner).
insert into public.ai_plans
  (plan, tier, monthly_budget_micro_usd, deep_budget_micro_usd, routes)
values
  ('pro_mensual', 'pro', 1500000, 0, '{"default":"deepseek-v4-flash"}'),
  ('pro_anual', 'pro', 1500000, 0, '{"default":"deepseek-v4-flash"}'),
  ('elite_mensual', 'elite', 4000000, 1500000,
    '{"default":"claude-sonnet-5","profundo":"claude-opus-5"}'),
  ('elite_anual', 'elite', 4000000, 1500000,
    '{"default":"claude-sonnet-5","profundo":"claude-opus-5"}'),
  ('elite_fundador', 'elite', 4000000, 1500000,
    '{"default":"claude-sonnet-5","profundo":"claude-opus-5"}')
on conflict (plan) do nothing;

-- Los que ya existían. Solo si nadie los ha tocado a mano (routes vacío).
-- Los heredados de Stripe pasan a ser Pro con el presupuesto de Pro.
update public.ai_plans
set tier = 'pro', monthly_budget_micro_usd = 1500000,
    routes = '{"default":"deepseek-v4-flash"}'
where plan in ('mensual', 'anual') and routes = '{}'::jsonb;

-- Cortesía = la prueba: 0,50 $ (PRECIOS.md). Afecta también a las cortesías
-- indefinidas de la 0020: ver la decisión pendiente del plan.
update public.ai_plans
set tier = 'pro', monthly_budget_micro_usd = 500000,
    routes = '{"default":"deepseek-v4-flash"}'
where plan = 'cortesia' and routes = '{}'::jsonb;

update public.ai_plans
set tier = 'owner', deep_budget_micro_usd = 10000000,
    routes = '{"profundo":"claude-opus-5"}'
where plan = 'owner' and routes = '{}'::jsonb;

-- ── El libro de cuentas ────────────────────────────────────────────
-- El CHECK de 0008 no admitía 'clasificar' ni 'resumen_*': esos inserts
-- fallaban y su coste NO entraba en el candado. NOT VALID por si producción
-- tiene filas que no casan: las nuevas sí se comprueban.
alter table public.coach_runs drop constraint if exists coach_runs_kind_check;
alter table public.coach_runs add constraint coach_runs_kind_check check (kind in (
  'chat', 'brief', 'plan', 'revision_semanal', 'cierre_mensual', 'import', 'escalada',
  'clasificar', 'resumen_semanal', 'resumen_mensual'
)) not valid;

alter table public.coach_runs
  add column if not exists mode text not null default 'estandar';
alter table public.coach_runs drop constraint if exists coach_runs_mode_check;
alter table public.coach_runs add constraint coach_runs_mode_check
  check (mode in ('estandar', 'profundo'));
create index if not exists coach_runs_user_mode_idx
  on public.coach_runs (user_id, mode, created_at desc);

-- ── Estado ─────────────────────────────────────────────────────────
-- 'budget', 'spent' y 'remaining' pasan a ser del bolsillo ESTÁNDAR (la barra
-- de energía y el cron de rituales siguen leyendo esos campos). El profundo va
-- aparte y se enseña en turnos, no en dinero.
create or replace function public.ai_state(p_user uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_sub public.subscriptions;
  v_plan public.ai_plans;
  v_entitled boolean;
  v_since timestamptz;
  v_renews timestamptz;
  v_std_budget bigint;
  v_deep_budget bigint;
  v_std_spent bigint;
  v_deep_spent bigint;
  v_std_left bigint;
  v_deep_left bigint;
  v_avg bigint;
begin
  select * into v_sub from public.subscriptions where user_id = p_user;

  -- La prueba no tiene los dos días de gracia: existen porque los webhooks de
  -- renovación llegan tarde, y una prueba no se renueva.
  v_entitled := v_sub.user_id is not null
    and v_sub.status in ('active', 'trialing')
    and case
      when v_sub.status = 'trialing' then coalesce(v_sub.current_period_end > now(), false)
      else v_sub.current_period_end is null
        or v_sub.current_period_end > now() - interval '2 days'
    end;

  if not v_entitled then
    return jsonb_build_object(
      'entitled', false, 'plan', null, 'tier', 'free',
      'budget', 0, 'spent', 0, 'remaining', 0,
      'deep_allowed', false, 'deep_budget', 0, 'deep_remaining', 0, 'deep_turns', 0,
      -- Una prueba por cuenta: quien ya tuvo fila (prueba, cortesía o pago) no.
      'trial_available', v_sub.user_id is null,
      'routes', '{}'::jsonb
    );
  end if;

  select * into v_plan from public.ai_plans where plan = v_sub.plan;
  v_deep_budget := coalesce(v_plan.deep_budget_micro_usd, 0);
  v_std_budget := greatest(0, coalesce(v_plan.monthly_budget_micro_usd, 0) - v_deep_budget);

  if v_sub.status = 'trialing' then
    v_since := v_sub.current_period_end - interval '7 days';
    v_renews := v_sub.current_period_end;
  else
    v_since := date_trunc('month', now());
    v_renews := date_trunc('month', now()) + interval '1 month';
  end if;

  select
    coalesce(sum(cost_micro_usd) filter (where mode = 'estandar'), 0),
    coalesce(sum(cost_micro_usd) filter (where mode = 'profundo'), 0)
  into v_std_spent, v_deep_spent
  from public.coach_runs
  where user_id = p_user and created_at >= v_since;

  v_std_left := greatest(0, v_std_budget - v_std_spent);
  v_deep_left := greatest(0, v_deep_budget - v_deep_spent);

  -- "Te quedan N turnos profundos": con la media real de SUS últimos diez, y
  -- con la estimación del plan mientras no tenga historia.
  select avg(t.cost_micro_usd)::bigint into v_avg
  from (
    select cost_micro_usd from public.coach_runs
    where user_id = p_user and mode = 'profundo' and error is null and cost_micro_usd > 0
    order by created_at desc
    limit 10
  ) t;
  v_avg := greatest(coalesce(v_avg, v_plan.deep_turn_estimate_micro_usd, 400000), 20000);

  return jsonb_build_object(
    'entitled', true,
    'plan', v_sub.plan,
    'tier', coalesce(v_plan.tier, 'pro'),
    'budget', v_std_budget,
    'spent', v_std_spent,
    'remaining', v_std_left,
    'renews', to_char(v_renews, 'YYYY-MM-DD'),
    'deep_allowed', v_deep_budget > 0 and coalesce(v_plan.routes ? 'profundo', false),
    'deep_budget', v_deep_budget,
    'deep_remaining', v_deep_left,
    'deep_turns', (v_deep_left / v_avg)::integer,
    'trial_available', false,
    'routes', coalesce(v_plan.routes, '{}'::jsonb)
  );
end;
$$;

-- ── La puerta, ahora con modo ──────────────────────────────────────
-- Se crea la de dos argumentos y se borra la de uno. La función `coach` ya
-- desplegada llama con { p_user } y resuelve a esta por el valor por defecto:
-- la migración puede ir antes que el despliegue sin cortar nada.
create or replace function public.ai_begin_turn(p_user uuid, p_mode text default 'estandar')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_state jsonb;
  v_locked uuid;
  v_mode text := case when p_mode = 'profundo' then 'profundo' else 'estandar' end;
  v_left bigint;
begin
  v_state := public.ai_state(p_user);

  if not (v_state->>'entitled')::boolean then
    return v_state || jsonb_build_object('allowed', false, 'reason', 'sin_suscripcion');
  end if;

  if v_mode = 'profundo' then
    if not (v_state->>'deep_allowed')::boolean then
      return v_state || jsonb_build_object('allowed', false, 'reason', 'profundo_no_incluido');
    end if;
    v_left := (v_state->>'deep_remaining')::bigint;
    if v_left < 20000 then
      return v_state || jsonb_build_object('allowed', false, 'reason', 'profundo_agotado');
    end if;
  else
    v_left := (v_state->>'remaining')::bigint;
    if v_left < 20000 then
      return v_state || jsonb_build_object('allowed', false, 'reason', 'presupuesto_agotado');
    end if;
  end if;

  insert into public.ai_turn_locks (user_id, started_at)
  values (p_user, now())
  on conflict (user_id) do update
    set started_at = now()
    where public.ai_turn_locks.started_at < now() - interval '4 minutes'
  returning user_id into v_locked;

  if v_locked is null then
    return v_state || jsonb_build_object('allowed', false, 'reason', 'turno_en_curso');
  end if;

  return v_state || jsonb_build_object('allowed', true, 'mode', v_mode, 'turn_budget', v_left);
end;
$$;

drop function if exists public.ai_begin_turn(uuid);

-- Lo que ve la app: sin el mapa de modelos (no es secreto, pero no es suyo).
create or replace function public.ai_status()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select public.ai_state(auth.uid()) - 'routes';
$$;

-- ── Prueba de 7 días, sin tienda ───────────────────────────────────
-- Una por cuenta: solo si la cuenta nunca tuvo fila en subscriptions. El
-- abuso con cuentas nuevas está acotado a 0,50 $ cada una (plan cortesía), y cada cuenta pasa
-- por el alta de Franky.
create or replace function public.start_trial()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_ins uuid;
  v_end timestamptz := now() + interval '7 days';
begin
  if v_uid is null then raise exception 'No autenticado'; end if;

  insert into public.subscriptions (user_id, status, plan, provider, current_period_end)
  values (v_uid, 'trialing', 'cortesia', 'manual', v_end)
  on conflict (user_id) do nothing
  returning user_id into v_ins;

  if v_ins is null then
    return jsonb_build_object('ok', false, 'reason', 'ya_usada');
  end if;

  insert into public.events (user_id, type, payload)
  values (v_uid, 'trial_started', jsonb_build_object('ends', v_end));

  return jsonb_build_object('ok', true, 'ends', to_char(v_end, 'YYYY-MM-DD'));
end;
$$;

-- ── Nivel de una cuenta (barato: sin sumar coach_runs) ──────────────
create or replace function public.user_tier(p_user uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select p.tier
    from public.subscriptions s
    join public.ai_plans p on p.plan = s.plan
    where s.user_id = p_user
      and s.status in ('active', 'trialing')
      and (s.current_period_end is null or s.current_period_end > now() - interval '2 days')
  ), 'free');
$$;

-- ── Permisos ────────────────────────────────────────────────────────
revoke all on function public.ai_begin_turn(uuid, text) from public, anon, authenticated;
grant execute on function public.ai_begin_turn(uuid, text) to service_role;
revoke all on function public.start_trial() from public, anon;
grant execute on function public.start_trial() to authenticated;
revoke all on function public.user_tier(uuid) from public, anon, authenticated;
grant execute on function public.user_tier(uuid) to service_role;
-- ai_state y ai_status conservan los permisos de 0020 (create or replace no los toca).

notify pgrst, 'reload schema';
```

### 0025_creadores.sql

```sql
-- NIVL · 0025 — Programa de creadores.
--
-- Quien trae a alguien que paga cobra una comisión sobre una BASE FIJA por
-- producto (100 € el anual), nunca sobre el precio: da igual que el comprador
-- elija Pro o Élite. Anual: el tope entero en el primer cobro; mensual: su %
-- del neto de cada mes hasta el mismo tope (docs/PRECIOS.md). Todo es del servidor:
-- ninguna tabla tiene políticas para el cliente; lo único que cruza son las
-- RPC de abajo, y a un creador solo se le enseña SU dinero.
--
-- REPO PÚBLICO: aquí no se inserta ningún creador, código ni pago. Las altas
-- se hacen con scripts/creadores.mjs contra la base.

-- Parámetros (una sola fila). Los valores son los de docs/PRECIOS.md.
create table if not exists public.creator_settings (
  id boolean primary key default true check (id),
  base_cents integer not null default 10000 check (base_cents >= 0),
  -- Sin SBP: neto al 30 % y tope de % en los productos que lo marquen.
  small_business_program boolean not null default false,
  vat_pct numeric(5,2) not null default 21 check (vat_pct between 0 and 50),
  eur_per_usd numeric(6,4) not null default 0.93 check (eur_per_usd > 0),
  renewal_pct numeric(5,2) not null default 0 check (renewal_pct between 0 and 10),
  hold_days integer not null default 30 check (hold_days between 0 and 120),
  claim_window_days integer not null default 14 check (claim_window_days between 0 and 90),
  prize_text text check (char_length(prize_text) <= 200)
);
insert into public.creator_settings (id) values (true) on conflict (id) do nothing;

create table if not exists public.creator_ranks (
  rank text primary key check (rank in ('novato', 'pro', 'elite')),
  pct numeric(5,2) not null check (pct between 0 and 100)
);
insert into public.creator_ranks (rank, pct)
values ('novato', 25), ('pro', 35), ('elite', 50)
on conflict (rank) do nothing;

-- El catálogo de tienda: a qué plan da derecho cada producto y cómo comisiona.
create table if not exists public.store_products (
  product_id text primary key,
  plan text not null,
  tier text not null check (tier in ('pro', 'elite')),
  period text not null check (period in ('mensual', 'anual')),
  commission_base_cents integer,            -- null = creator_settings.base_cents
  max_pct_without_sbp numeric(5,2),         -- null = sin límite
  max_seats integer                         -- solo el de fundador
);
insert into public.store_products
  (product_id, plan, tier, period, commission_base_cents, max_pct_without_sbp, max_seats)
values
  ('nivl_pro_mensual', 'pro_mensual', 'pro', 'mensual', null, null, null),
  ('nivl_pro_anual', 'pro_anual', 'pro', 'anual', null, 35, null),
  ('nivl_elite_mensual', 'elite_mensual', 'elite', 'mensual', null, null, null),
  ('nivl_elite_anual', 'elite_anual', 'elite', 'anual', null, null, null),
  ('nivl_elite_fundador', 'elite_fundador', 'elite', 'anual', null, null, 100)
on conflict (product_id) do nothing;

create table if not exists public.creators (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users (id) on delete set null,
  code text not null unique check (code ~ '^[A-Z0-9_]{3,20}$'),
  alias text not null check (char_length(alias) between 1 and 40),
  rank text not null default 'novato' references public.creator_ranks (rank),
  monthly_fixed_cents integer not null default 0 check (monthly_fixed_cents >= 0),
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now()
);

-- Una atribución por cuenta, para siempre.
create table if not exists public.referrals (
  user_id uuid primary key references auth.users (id) on delete cascade,
  creator_id uuid not null references public.creators (id),
  source text not null check (source in ('onboarding', 'enlace', 'perfil', 'manual')),
  created_at timestamptz not null default now()
);
create index if not exists referrals_creator_idx on public.referrals (creator_id, created_at);

-- Cada cobro real de tienda. Lo escribe record_sale (vía apply_store_event).
create table if not exists public.store_sales (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  creator_id uuid references public.creators (id),
  store text not null check (store in ('apple', 'google', 'stripe', 'manual')),
  transaction_id text not null unique,
  original_transaction_id text not null,
  product_id text not null references public.store_products (product_id),
  payment_number integer not null check (payment_number >= 1),
  price_cents integer,                -- lo que pagó, con IVA, en su moneda
  currency text,
  net_cents integer not null,         -- en euros: sin IVA y sin la comisión de tienda
  purchased_at timestamptz not null,
  refunded_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists store_sales_user_idx on public.store_sales (user_id, purchased_at);
create index if not exists store_sales_creator_idx on public.store_sales (creator_id, purchased_at);

create table if not exists public.creator_payouts (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators (id),
  kind text not null check (kind in ('comisiones', 'fijo_mensual', 'premio', 'contenido_externo', 'ajuste')),
  amount_cents integer not null,
  period text,
  note text check (char_length(note) <= 280),
  paid_at timestamptz not null default now()
);
create index if not exists creator_payouts_creator_idx on public.creator_payouts (creator_id, paid_at desc);

create table if not exists public.commissions (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators (id),
  sale_id uuid not null unique references public.store_sales (id),
  kind text not null check (kind in ('primer_pago', 'mensual', 'renovacion')),
  -- Foto del momento del cobro: subir de rango no cambia lo ya cobrado.
  rank text not null,
  pct numeric(5,2) not null,
  cap_cents integer not null,
  amount_cents integer not null check (amount_cents >= 0),
  -- pendiente: en retención (disponible cuando available_at <= now()) · pagada · anulada.
  status text not null check (status in ('pendiente', 'pagada', 'anulada')),
  available_at timestamptz not null,
  payout_id uuid references public.creator_payouts (id),
  clawback boolean not null default false,
  clawback_settled_at timestamptz,
  voided_reason text,
  created_at timestamptz not null default now()
);
create index if not exists commissions_creator_idx on public.commissions (creator_id, status);

alter table public.creator_settings enable row level security;
alter table public.creator_ranks enable row level security;
alter table public.store_products enable row level security;
alter table public.creators enable row level security;
alter table public.referrals enable row level security;
alter table public.store_sales enable row level security;
alter table public.creator_payouts enable row level security;
alter table public.commissions enable row level security;
-- Sin políticas salvo el catálogo (público: son ids de tienda). Lo demás, solo
-- security definer y service_role.
drop policy if exists "store_products read" on public.store_products;
create policy "store_products read" on public.store_products for select to authenticated using (true);

-- ── Neto de un cobro, en céntimos de euro ───────────────────────────
-- Sin IVA y sin la comisión de tienda (15 % con SBP, 30 % sin él: peca de
-- prudente, porque desde el segundo año de cada suscripción Apple cobra 15 %).
create or replace function public.net_cents_eur(p_price_eur numeric)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select round(
    coalesce(p_price_eur, 0) * 100 / (1 + s.vat_pct / 100)
    * (1 - case when s.small_business_program then 0.15 else 0.30 end)
  )::integer
  from public.creator_settings s;
$$;

-- ── Registrar un cobro (lo llama apply_store_event, 0027) ────────────
-- Idempotente por transaction_id. Devuelve el id de la venta o null si ya
-- estaba. La comisión sigue docs/PRECIOS.md: tope por cuenta = base × % del
-- rango; el anual lo llena de golpe, el mensual con su % del neto de cada mes.
create or replace function public.record_sale(
  p_user uuid, p_store text, p_txn text, p_orig text, p_product text,
  p_price_cents integer, p_currency text, p_net_cents integer, p_purchased_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prod public.store_products;
  v_creator public.creators;
  v_set public.creator_settings;
  v_sale uuid;
  v_n integer;
  v_pct numeric;
  v_base integer;
  v_cap integer;
  v_accrued integer;
  v_amount integer;
  v_kind text;
begin
  select * into v_prod from public.store_products where product_id = p_product;
  if v_prod.product_id is null then raise exception 'Producto desconocido: %', p_product; end if;

  select count(*) + 1 into v_n
  from public.store_sales where original_transaction_id = p_orig and refunded_at is null;

  select c.* into v_creator
  from public.referrals r join public.creators c on c.id = r.creator_id
  where r.user_id = p_user and c.active;

  insert into public.store_sales (user_id, creator_id, store, transaction_id, original_transaction_id,
    product_id, payment_number, price_cents, currency, net_cents, purchased_at)
  values (p_user, v_creator.id, p_store, p_txn, p_orig, p_product, v_n,
    p_price_cents, p_currency, p_net_cents, p_purchased_at)
  on conflict (transaction_id) do nothing
  returning id into v_sale;

  if v_sale is null or v_creator.id is null then return v_sale; end if;

  select * into v_set from public.creator_settings;
  select pct into v_pct from public.creator_ranks where rank = v_creator.rank;
  if not v_set.small_business_program and v_prod.max_pct_without_sbp is not null then
    v_pct := least(v_pct, v_prod.max_pct_without_sbp);
  end if;
  v_base := coalesce(v_prod.commission_base_cents, v_set.base_cents);
  v_cap := round(v_base * v_pct / 100)::integer;

  -- Lo que esta CUENTA ya ha generado (sin anuladas). Un cambio Pro→Élite o
  -- de mensual a anual no reinicia el tope.
  select coalesce(sum(k.amount_cents), 0) into v_accrued
  from public.commissions k join public.store_sales s on s.id = k.sale_id
  where s.user_id = p_user and k.kind in ('primer_pago', 'mensual') and k.status <> 'anulada';

  if v_accrued < v_cap then
    v_kind := case when v_prod.period = 'anual' then 'primer_pago' else 'mensual' end;
    v_amount := case
      when v_prod.period = 'anual' then v_cap - v_accrued
      else least(round(p_net_cents * v_pct / 100)::integer, v_cap - v_accrued)
    end;
  elsif v_prod.period = 'anual' and v_set.renewal_pct > 0 then
    v_kind := 'renovacion';
    v_pct := v_set.renewal_pct;
    v_amount := round(v_base * v_set.renewal_pct / 100)::integer;
  else
    return v_sale;
  end if;

  if v_amount > 0 then
    insert into public.commissions
      (creator_id, sale_id, kind, rank, pct, cap_cents, amount_cents, status, available_at)
    values (v_creator.id, v_sale, v_kind, v_creator.rank, v_pct, v_cap, v_amount, 'pendiente',
      p_purchased_at + make_interval(days => v_set.hold_days));
  end if;

  return v_sale;
end;
$$;

-- ── Reembolso ───────────────────────────────────────────────────────
create or replace function public.record_refund(p_txn text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sale uuid;
begin
  update public.store_sales set refunded_at = coalesce(refunded_at, now())
  where transaction_id = p_txn
  returning id into v_sale;
  if v_sale is null then return; end if;

  -- Lo ya pagado queda como clawback: se resta en la siguiente liquidación.
  update public.commissions
  set clawback = (status = 'pagada'),
      status = 'anulada',
      voided_reason = 'reembolso'
  where sale_id = v_sale and status <> 'anulada';
end;
$$;

-- ── "¿Quién te trajo?" ──────────────────────────────────────────────
create or replace function public.claim_referral(p_code text, p_source text default 'onboarding')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_code text := upper(regexp_replace(coalesce(p_code, ''), '\s', '', 'g'));
  v_source text := case when p_source in ('onboarding', 'enlace', 'perfil') then p_source else 'perfil' end;
  v_creator public.creators;
  v_created timestamptz;
  v_window integer;
begin
  if v_uid is null then raise exception 'No autenticado'; end if;

  if exists (select 1 from public.referrals where user_id = v_uid) then
    return jsonb_build_object('ok', false, 'reason', 'ya_asignado');
  end if;

  select * into v_creator from public.creators where code = v_code and active;
  if v_creator.id is null then
    return jsonb_build_object('ok', false, 'reason', 'desconocido');
  end if;
  if v_creator.user_id = v_uid then
    return jsonb_build_object('ok', false, 'reason', 'propio');
  end if;
  if exists (select 1 from public.store_sales where user_id = v_uid) then
    return jsonb_build_object('ok', false, 'reason', 'ya_pagas');
  end if;

  select created_at into v_created from auth.users where id = v_uid;
  select claim_window_days into v_window from public.creator_settings;
  if v_created < now() - make_interval(days => v_window) then
    return jsonb_build_object('ok', false, 'reason', 'fuera_de_plazo');
  end if;

  insert into public.referrals (user_id, creator_id, source)
  values (v_uid, v_creator.id, v_source)
  on conflict (user_id) do nothing;

  insert into public.events (user_id, type, payload)
  values (v_uid, 'creator_referral', jsonb_build_object('source', v_source));

  return jsonb_build_object('ok', true, 'alias', v_creator.alias);
end;
$$;

create or replace function public.my_referral()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object('alias', c.alias, 'since', r.created_at)
  from public.referrals r join public.creators c on c.id = r.creator_id
  where r.user_id = auth.uid();
$$;

-- ── Panel del creador: SOLO su dinero ───────────────────────────────
-- Una "venta" es una cuenta nueva que paga: comisión viva sobre el PRIMER
-- cobro de su suscripción (payment_number = 1). El resto de cobros mensuales
-- suman dinero, no ventas.
create or replace function public.creator_panel()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_c public.creators;
  v_set public.creator_settings;
  v_pct numeric;
  -- El mes del premio es el de España, no el de UTC.
  v_mes timestamptz := date_trunc('month', now() at time zone 'Europe/Madrid') at time zone 'Europe/Madrid';
  v_pos integer;
  v_total integer;
begin
  if v_uid is null then return null; end if;
  select * into v_c from public.creators where user_id = v_uid and active;
  if v_c.id is null then return null; end if;
  select * into v_set from public.creator_settings;
  select pct into v_pct from public.creator_ranks where rank = v_c.rank;

  with ventas as (
    select cr.id, count(distinct s.user_id) filter (where k.id is not null) as n
    from public.creators cr
    left join public.store_sales s
      on s.creator_id = cr.id and s.purchased_at >= v_mes and s.payment_number = 1
    left join public.commissions k
      on k.sale_id = s.id and k.status <> 'anulada'
    where cr.active
    group by cr.id
  ), puestos as (
    select id, (rank() over (order by n desc))::integer as pos, (count(*) over ())::integer as total
    from ventas
  )
  select pos, total into v_pos, v_total from puestos where id = v_c.id;

  return jsonb_build_object(
    'alias', v_c.alias,
    'code', v_c.code,
    'rank', v_c.rank,
    'pct', v_pct,
    'installs', (select count(*) from public.referrals where creator_id = v_c.id),
    'installs_month', (select count(*) from public.referrals where creator_id = v_c.id and created_at >= v_mes),
    'sales', (select count(distinct s.user_id) from public.commissions k join public.store_sales s on s.id = k.sale_id
              where k.creator_id = v_c.id and k.status <> 'anulada' and s.payment_number = 1),
    'sales_month', (select count(distinct s.user_id) from public.commissions k join public.store_sales s on s.id = k.sale_id
                    where k.creator_id = v_c.id and k.status <> 'anulada' and s.payment_number = 1
                      and s.purchased_at >= v_mes),
    'pending_cents', (select coalesce(sum(amount_cents), 0) from public.commissions
                      where creator_id = v_c.id and status = 'pendiente' and available_at > now()),
    'available_cents', (select coalesce(sum(amount_cents), 0) from public.commissions
                        where creator_id = v_c.id and status = 'pendiente' and available_at <= now()),
    'clawback_cents', (select coalesce(sum(amount_cents), 0) from public.commissions
                       where creator_id = v_c.id and clawback and clawback_settled_at is null),
    'paid_cents', (select coalesce(sum(amount_cents), 0) from public.creator_payouts where creator_id = v_c.id),
    'monthly_fixed_cents', v_c.monthly_fixed_cents,
    'position', v_pos,
    'creators', v_total,
    'prize', v_set.prize_text,
    'payouts', coalesce((
      select jsonb_agg(jsonb_build_object('kind', p.kind, 'cents', p.amount_cents, 'at', p.paid_at) order by p.paid_at desc)
      from (select * from public.creator_payouts where creator_id = v_c.id order by paid_at desc limit 12) p
    ), '[]'::jsonb)
  );
end;
$$;

-- Ranking de creadores del mes: alias y ventas. Nunca dinero ajeno.
create or replace function public.creator_board()
returns table (alias text, sales integer, pos integer, is_me boolean)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
  v_mes timestamptz := date_trunc('month', now() at time zone 'Europe/Madrid') at time zone 'Europe/Madrid';
begin
  if not exists (select 1 from public.creators where user_id = v_uid and active) then return; end if;
  return query
  select cr.alias,
         (count(distinct s.user_id) filter (where k.id is not null))::integer,
         (rank() over (order by count(distinct s.user_id) filter (where k.id is not null) desc))::integer,
         cr.user_id is not distinct from v_uid
  from public.creators cr
  left join public.store_sales s
    on s.creator_id = cr.id and s.purchased_at >= v_mes and s.payment_number = 1
  left join public.commissions k
    on k.sale_id = s.id and k.status <> 'anulada'
  where cr.active
  group by cr.id, cr.alias, cr.user_id
  order by 3, 1
  limit 50;
end;
$$;

-- ── Liquidar (solo service_role, desde scripts/creadores.mjs) ────────
-- Apunta el pago; la transferencia la hace el dueño fuera.
create or replace function public.liquidate_creator(p_creator uuid, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total bigint;
  v_claw bigint;
  v_payout uuid;
begin
  select coalesce(sum(amount_cents), 0) into v_total
  from public.commissions
  where creator_id = p_creator and status = 'pendiente' and available_at <= now();

  select coalesce(sum(amount_cents), 0) into v_claw
  from public.commissions
  where creator_id = p_creator and clawback and clawback_settled_at is null;

  if v_total - v_claw <= 0 then
    return jsonb_build_object('ok', false, 'available', v_total, 'clawback', v_claw);
  end if;

  insert into public.creator_payouts (creator_id, kind, amount_cents, period, note)
  values (p_creator, 'comisiones', (v_total - v_claw)::integer, to_char(now(), 'YYYY-MM'), p_note)
  returning id into v_payout;

  update public.commissions set status = 'pagada', payout_id = v_payout
  where creator_id = p_creator and status = 'pendiente' and available_at <= now();

  update public.commissions set clawback_settled_at = now()
  where creator_id = p_creator and clawback and clawback_settled_at is null;

  return jsonb_build_object('ok', true, 'payout', v_payout, 'amount', v_total - v_claw);
end;
$$;

revoke all on function public.net_cents_eur(numeric) from public, anon, authenticated;
revoke all on function public.record_sale(uuid, text, text, text, text, integer, text, integer, timestamptz) from public, anon, authenticated;
revoke all on function public.record_refund(text) from public, anon, authenticated;
revoke all on function public.liquidate_creator(uuid, text) from public, anon, authenticated;
grant execute on function public.net_cents_eur(numeric) to service_role;
grant execute on function public.record_sale(uuid, text, text, text, text, integer, text, integer, timestamptz) to service_role;
grant execute on function public.record_refund(text) to service_role;
grant execute on function public.liquidate_creator(uuid, text) to service_role;

revoke all on function public.claim_referral(text, text) from public, anon;
revoke all on function public.my_referral() from public, anon;
revoke all on function public.creator_panel() from public, anon;
revoke all on function public.creator_board() from public, anon;
grant execute on function public.claim_referral(text, text) to authenticated;
grant execute on function public.my_referral() to authenticated;
grant execute on function public.creator_panel() to authenticated;
grant execute on function public.creator_board() to authenticated;

notify pgrst, 'reload schema';
```

### 0026_elite.sql

```sql
-- NIVL · 0026 — Élite: escuadras de rendición de cuentas y la insignia.
--
-- Nada de esto toca XP, racha ni el orden de ningún marcador: la insignia es
-- estética y el marcador de escuadra usa los mismos recortes que friends_board.
-- Un miembro de escuadra ve un marcador, no una vida (misma regla que 0021).

create table if not exists public.elite_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 40),
  goal text not null check (goal in ('emprendedor', 'trabajador', 'deportista', 'estudiante', 'general')),
  capacity smallint not null default 8 check (capacity between 5 and 8),
  created_at timestamptz not null default now()
);

create table if not exists public.elite_group_members (
  group_id uuid not null references public.elite_groups (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
-- Una escuadra por persona.
create unique index if not exists elite_group_members_user_idx on public.elite_group_members (user_id);

create table if not exists public.elite_group_requests (
  user_id uuid primary key references auth.users (id) on delete cascade,
  goal text not null check (goal in ('emprendedor', 'trabajador', 'deportista', 'estudiante', 'general')),
  note text check (char_length(note) <= 280),
  created_at timestamptz not null default now()
);

alter table public.elite_groups enable row level security;
alter table public.elite_group_members enable row level security;
alter table public.elite_group_requests enable row level security;

create or replace function public.elite_request_group(p_goal text, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'No autenticado'; end if;
  if public.user_tier(v_uid) not in ('elite', 'owner') then
    return jsonb_build_object('ok', false, 'reason', 'no_elite');
  end if;
  if exists (select 1 from public.elite_group_members where user_id = v_uid) then
    return jsonb_build_object('ok', false, 'reason', 'ya_en_escuadra');
  end if;
  insert into public.elite_group_requests (user_id, goal, note)
  values (v_uid, p_goal, left(p_note, 280))
  on conflict (user_id) do update
    set goal = excluded.goal, note = excluded.note, created_at = now();
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.my_elite_group()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'group', (
      select jsonb_build_object(
        'name', g.name, 'goal', g.goal,
        'members', (select count(*) from public.elite_group_members x where x.group_id = g.id))
      from public.elite_group_members m join public.elite_groups g on g.id = m.group_id
      where m.user_id = auth.uid()
    ),
    'requested', exists (select 1 from public.elite_group_requests where user_id = auth.uid())
  );
$$;

-- Insignias visibles para quien pregunta: él, sus amigos aceptados y su
-- escuadra, respetando social_visible.
create or replace function public.elite_badges()
returns table (user_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  with miembros as (
    select auth.uid() as uid
    union
    select case when f.requester = auth.uid() then f.addressee else f.requester end
    from public.friendships f
    where f.status = 'accepted' and (f.requester = auth.uid() or f.addressee = auth.uid())
    union
    select m2.user_id
    from public.elite_group_members m1
    join public.elite_group_members m2 on m2.group_id = m1.group_id
    where m1.user_id = auth.uid()
  )
  select m.uid
  from miembros m join public.profiles p on p.id = m.uid
  where (m.uid = auth.uid() or p.social_visible)
    and public.user_tier(m.uid) = 'elite';
$$;

-- elite_group_board(p_days integer default 7): COPIA de friends_board (0021)
-- cambiando SOLO el CTE `miembros` por los de la escuadra de auth.uid():
--   select m2.user_id as uid, null::uuid as fid
--   from public.elite_group_members m1
--   join public.elite_group_members m2 on m2.group_id = m1.group_id
--   where m1.user_id = v_uid
-- y devolviendo 0 filas si public.user_tier(v_uid) not in ('elite', 'owner').
-- Mismo RETURNS TABLE, mismos recortes (sin penalizaciones, least(xp, 500)),
-- mismo safe_tz. No se refactoriza friends_board para compartir cuerpo: está
-- en producción y funciona. (Pegar aquí el cuerpo completo al implementar.)

revoke all on function public.elite_request_group(text, text) from public, anon;
revoke all on function public.my_elite_group() from public, anon;
revoke all on function public.elite_badges() from public, anon;
grant execute on function public.elite_request_group(text, text) to authenticated;
grant execute on function public.my_elite_group() to authenticated;
grant execute on function public.elite_badges() to authenticated;
-- user_tier solo se usa dentro de funciones security definer.

notify pgrst, 'reload schema';
```


### 0027_tienda.sql

```sql
-- NIVL · 0027 — La tienda: RevenueCat → subscriptions + cobros + comisiones.
--
-- El webhook (supabase/functions/revenuecat-webhook) solo autentica y llama a
-- apply_store_event: toda la lógica vive aquí, en una transacción, idempotente
-- por id de evento. El catálogo (store_products) está en la 0025.

create table if not exists public.store_events (
  id text primary key,
  type text not null,
  app_user_id text,
  environment text,
  payload jsonb not null,
  note text,
  received_at timestamptz not null default now()
);
alter table public.store_events enable row level security;

alter table public.subscriptions
  add column if not exists store_product_id text,
  add column if not exists original_transaction_id text;

create or replace function public.apply_store_event(p_event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id text := p_event->>'id';
  v_type text := p_event->>'type';
  v_env text := coalesce(p_event->>'environment', 'PRODUCTION');
  v_user uuid;
  v_prod public.store_products;
  v_store text := case p_event->>'store'
    when 'APP_STORE' then 'apple' when 'MAC_APP_STORE' then 'apple'
    when 'PLAY_STORE' then 'google' when 'STRIPE' then 'stripe' else 'manual' end;
  v_trial boolean := (p_event->>'period_type') = 'TRIAL';
  v_exp timestamptz;
  v_bought timestamptz;
  v_eur numeric;
  v_ins text;
begin
  insert into public.store_events (id, type, app_user_id, environment, payload)
  values (v_id, v_type, p_event->>'app_user_id', v_env, p_event)
  on conflict (id) do nothing
  returning id into v_ins;
  if v_ins is null then return jsonb_build_object('ok', true, 'duplicate', true); end if;

  -- app_user_id es el uuid de Supabase (Purchases.logIn). Un id anónimo no se atribuye.
  begin
    v_user := (p_event->>'app_user_id')::uuid;
  exception when invalid_text_representation then
    update public.store_events set note = 'app_user_id no es uuid' where id = v_id;
    return jsonb_build_object('ok', true, 'ignored', 'anon');
  end;
  if not exists (select 1 from auth.users where id = v_user) then
    update public.store_events set note = 'usuario desconocido' where id = v_id;
    return jsonb_build_object('ok', true, 'ignored', 'user');
  end if;

  select * into v_prod from public.store_products where product_id = p_event->>'product_id';
  v_exp := to_timestamp(nullif(p_event->>'expiration_at_ms', '')::bigint / 1000.0);
  v_bought := coalesce(to_timestamp(nullif(p_event->>'purchased_at_ms', '')::bigint / 1000.0), now());

  if v_type in ('INITIAL_PURCHASE', 'RENEWAL', 'UNCANCELLATION', 'SUBSCRIPTION_EXTENDED')
     and v_prod.product_id is not null then
    -- La prueba de tienda es la misma que la de servidor: cortesía en 'trialing'.
    insert into public.subscriptions (user_id, status, plan, provider, current_period_end,
      store_product_id, original_transaction_id, updated_at)
    values (v_user, case when v_trial then 'trialing' else 'active' end,
      case when v_trial then 'cortesia' else v_prod.plan end, v_store, v_exp,
      v_prod.product_id, p_event->>'original_transaction_id', now())
    on conflict (user_id) do update set
      status = excluded.status, plan = excluded.plan, provider = excluded.provider,
      current_period_end = excluded.current_period_end,
      store_product_id = excluded.store_product_id,
      original_transaction_id = excluded.original_transaction_id,
      updated_at = now()
    where public.subscriptions.plan <> 'owner';

    -- Un cobro real (ni prueba ni sandbox) es una venta. La conversión de una
    -- prueba llega como RENEWAL y es el primer cobro: record_sale lo cuenta así.
    if v_type in ('INITIAL_PURCHASE', 'RENEWAL') and not v_trial and v_env = 'PRODUCTION' then
      v_eur := case
        when p_event->>'currency' = 'EUR' then (p_event->>'price_in_purchased_currency')::numeric
        else (p_event->>'price')::numeric * (select eur_per_usd from public.creator_settings)
      end;
      perform public.record_sale(
        v_user, v_store, p_event->>'transaction_id', p_event->>'original_transaction_id',
        v_prod.product_id,
        round(coalesce((p_event->>'price_in_purchased_currency')::numeric, 0) * 100)::integer,
        p_event->>'currency', public.net_cents_eur(v_eur), v_bought);
    end if;

  elsif v_type = 'CANCELLATION' and p_event->>'cancel_reason' = 'CUSTOMER_SUPPORT' then
    -- Reembolso de Apple/Google: fuera la IA y fuera la comisión.
    perform public.record_refund(p_event->>'transaction_id');
    update public.subscriptions set status = 'canceled', current_period_end = now(), updated_at = now()
    where user_id = v_user and plan <> 'owner';

  elsif v_type = 'EXPIRATION' then
    update public.subscriptions set status = 'canceled', updated_at = now()
    where user_id = v_user and plan <> 'owner';

  else
    -- CANCELLATION normal (sigue activo hasta fin de periodo), BILLING_ISSUE
    -- (la gracia de la tienda la cubre la fecha de fin), PRODUCT_CHANGE (el
    -- cambio real llega en la siguiente RENEWAL), TRANSFER, TEST…: solo se apunta.
    update public.store_events set note = 'solo registrado' where id = v_id;
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.founder_seats_left()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select greatest(0, coalesce(max(p.max_seats), 0) - (
    select count(distinct s.user_id)::integer from public.store_sales s
    where s.product_id = 'nivl_elite_fundador' and s.refunded_at is null
  ))
  from public.store_products p where p.product_id = 'nivl_elite_fundador';
$$;

revoke all on function public.apply_store_event(jsonb) from public, anon, authenticated;
grant execute on function public.apply_store_event(jsonb) to service_role;
revoke all on function public.founder_seats_left() from public, anon;
grant execute on function public.founder_seats_left() to authenticated;

notify pgrst, 'reload schema';
```

Antes de aplicar la 0027, contrastar con la documentación vigente de
RevenueCat los nombres de campo (`period_type`, `cancel_reason`,
`transaction_id`, `price`, `price_in_purchased_currency`, `currency`,
`environment`) y que el reembolso siga llegando como `CANCELLATION` +
`CUSTOMER_SUPPORT`. Si el evento trae `tax_percentage` y
`commission_percentage`, se pueden usar en lugar de la fórmula de
`net_cents_eur`, pero la fórmula peca de prudente y es determinista.

---

## 9. Riesgos y cómo se mitigan

- **Orden de despliegue**: 0024 antes que `coach`; `coach` antes que la OTA.
  La 0024 es compatible hacia atrás: la función vieja llama con `{p_user}` y
  resuelve a la firma nueva por el valor por defecto, y el `remaining` que lee
  pasa a ser el del bolsillo estándar. La app vieja con un `plan` nuevo:
  `planLabel` devolvería `undefined` hasta la OTA; por eso lleva valor por
  defecto.
- **Sin secrets de DeepSeek**, Pro y la prueba caen a Sonnet: nadie pierde
  dinero (el candado corta) pero el producto no funciona (PRECIOS.md: "el Pro
  solo existe con DeepSeek"). No publicar la CTA de prueba ni el Pro hasta
  tener los secrets y un `smoke-coach` en DeepSeek.
- **DeepSeek con 25 herramientas**: el adaptador compat existe pero no se ha
  usado a escala. Probar los rituales (el brief llama a `planificar_dia` con un
  JSON largo) con `smoke-coach` antes de soltar Pro.
- **Cortesías antiguas a 0,50 $**: los primeros usuarios pasan de 2,50 $ a
  0,50 $ y de Sonnet a DeepSeek el mismo día. Avisar o crear
  `cortesia_historica` (§11).
- **Élite con Sonnet a 2,50 $ de estándar**: ver §0. Revisar `coach_runs`
  por plan a las dos semanas y mover `routes`/presupuestos con un `update`.
- **Zonas horarias**: el mes del candado es `date_trunc('month', now())` en
  UTC, como en 0020 (en España se recarga a la 1-2 h del día 1: aceptable). El
  mes de los creadores se calcula en Europe/Madrid a propósito (el premio
  mensual tiene fecha humana).
- **RLS**: todas las tablas nuevas con RLS y sin políticas (salvo el catálogo
  de productos, de lectura); lo que cruza son RPC `security definer` con
  `search_path = public` y `revoke` de `public/anon`. `record_sale`,
  `record_refund`, `net_cents_eur`, `liquidate_creator`, `apply_store_event`,
  `ai_begin_turn` y `user_tier` solo para service_role. Comprobar con una
  cuenta normal que `select * from creators` da 0 filas y que
  `rpc('record_sale')` da permiso denegado.
- **Fraude de creadores**: autorreferido bloqueado por `user_id`; sin cobro
  real de producción no hay comisión; reembolso anula o descuenta; retención
  de 30 días; el sandbox no crea ventas. El plazo de 14 días se cuenta desde
  `auth.users.created_at` de NIVL: verificar que el puente `franky-auth` crea
  el usuario en su primer acceso a NIVL y no con la fecha de Franky.
- **Moneda**: la base es en euros. Un cobro en otra moneda se convierte con
  `price` (USD) × `eur_per_usd`: aproximado, y solo afecta al mensual (el
  anual paga el tope fijo).
- **Deep link antes de iniciar sesión**: sin tratar `c` como zona pública, el
  guard de `_layout.tsx` salta a `/login` y el código se pierde.
- **Sin conexión en el onboarding**: el código queda pendiente en
  AsyncStorage y se reintenta; el onboarding nunca se bloquea por él.
- **TS estricto**: `AiStatus` con campos nuevos rellenados en `fetchAiStatus`;
  `CoachDenyReason` ampliado rompe `accessNotice` a propósito hasta cubrirlo;
  rutas nuevas (`c/[code]`, `creador`) exigen arrancar Metro para los tipos.
- **Tope de fundadores**: la tienda no se puede bloquear desde el servidor;
  el cupo es blando (puede entrar el 101). Se cierra la offering a mano.
- **Apple**: el código de creador no da nada al usuario (ni descuento ni XP):
  correcto. Retos con premio: bases oficiales (5.3). Élite solo en tienda
  cuando sus funciones existan (3.1.2).
- **Diseño**: el oro está reservado a rachas e hitos; la insignia Élite
  necesita decisión antes de la fase 3.

---

## 10. Verificación

Siempre: `npm run typecheck` · `npm test` · `npm run lint` ·
`npx expo export --platform ios` y `--platform android`. Funciones:
`npx deno check supabase/functions/<nombre>/index.ts`. Migraciones:
`node scripts/apply-migrations.mjs` dos veces (la segunda no aplica nada:
huella correcta).

Fase 1, a mano (Expo Go sobre el runtime 1.0.6 / TestFlight):
- SQL: `ai_state(uuid)` para un owner, una cortesía antigua y una cuenta sin
  fila (esta última con `trial_available: true`).
- `node scripts/smoke-coach.mjs "hola"` con un Pro (DeepSeek) y un Élite
  (Sonnet); en `coach_runs`, `model` y `mode` correctos.
- Un `clasificar` ahora SÍ aparece en `coach_runs`.
- Cuenta nueva: onboarding, "Probar el coach 7 días", el chat responde; un
  segundo intento da `ya_usada`. Con `current_period_end` en el pasado, el
  coach pinta el hueco de Pro, no un error (sin los dos días de gracia).
- Élite: selector visible; un turno profundo gasta del bolsillo profundo y
  baja "te quedan N"; al agotarlo (bajar `deep_budget` a mano) el chip se apaga
  con su texto y el estándar sigue. Pro: selector oculto.
- `/pro` y el paso 6 del onboarding con Pro/Élite, sin selector ni legales
  (tienda cerrada).

Fase 2:
- Alta de un creador de prueba con el script; `nivl://c/PRUEBA` con la app
  cerrada y sin sesión: login y onboarding con el código precargado.
- Código inexistente, propio, cuenta de 15 días: mensaje correcto y se sigue.
- Simular cobros con `record_sale` desde SQL: anual (tope entero); mensual xN
  (va sumando hasta el tope y luego 0); mensual y después anual (el anual paga
  lo que falta); `small_business_program = false` con Pro anual de un creador
  Élite (35 € y no 50 €); reembolso antes y después de liquidar (anulada o
  clawback). Los mismos casos en `creatormath.test.ts`.
- Con una cuenta normal, `creator_panel()` devuelve null y la fila de Perfil
  no sale.

Fase 3:
- Insignia visible en Amigos y Perfil para un Élite; oculta con
  `social_visible = false`; el orden del marcador no cambia.
- Escuadra asignada con el script: su marcador da las mismas cifras que el de
  amigos para las mismas personas.

Fase 4 (TestFlight, sandbox):
- Compra Pro anual, cambio a Élite, restaurar, prueba y conversión (el primer
  cobro llega como RENEWAL), reembolso sandbox (no crea comisión:
  `environment` SANDBOX). Reenviar el mismo evento: `duplicate`.
- `https://nivl.app/c/PRUEBA` abre la app si está instalada (enlace universal).
- `npx eas-cli config --platform ios --profile production` antes del build.

---

## 11. Decisiones del dueño

**Resueltas el 2026-09-24** (aceptó todas las recomendaciones):

1. Cortesías antiguas → bajan a 0,50 $ y a DeepSeek con todos; no hay
   `cortesia_historica`. El owner queda como está.
2. Élite = 2,50 $ estándar + 1,50 $ profundo.
3. Revisión semanal Élite → Sonnet `xhigh`.
4. Profundo → Sonnet `xhigh` (más turnos antes que el modelo top).
5. Insignia Élite → **oro**; se amplía la regla del sistema de diseño (el oro
   pasa a cubrir rachas, hitos y el estatus Élite).
6. Escuadras en la interfaz → **"ludus"**.
7. Rangos de creador → "Creador novato / pro / élite".

Planteamiento original:

1. Cortesías antiguas: ¿bajan a 0,50 $ con todos (lo que dice PRECIOS.md) o se
   crea `cortesia_historica` a 2,50 $?
2. Reparto del Élite: 2,50 $ estándar + 1,50 $ profundo (propuesto).
3. Modelo de la revisión semanal Élite: Sonnet `xhigh` (propuesto; ~0,5 $ en
   cuenta pesada) u Opus (~1 $ por semana, casi todo el mes).
4. Profundo con Opus (unos 3-4 turnos al mes con 1,50 $) o con Sonnet `xhigh`
   (unos 7): "el modelo top" frente a "más turnos".
5. Insignia: oro (ampliar la regla del sistema de diseño) o blanco hueso.
6. Nombre de las escuadras en la interfaz ("escuadra", "ludus"…).
7. Rangos de creador en pantalla: "Novato/Pro/Élite" choca con los niveles de
   la app; propongo "Creador novato / pro / élite".

---

## 12. Fuera de alcance (y por qué)

- **Packs de turnos profundos (consumibles)**: necesitan la tienda y un libro
  de créditos que alimente el bolsillo profundo. El candado ya lo permite
  después sin tocar lo de arriba; primero hay que ver si alguien agota turnos.
- **Retos trimestrales con premio**: necesitan bases legales y diseño (qué se
  mide y cómo no se trampea). El primero se lleva a mano dentro de las
  escuadras; el premio nunca es XP.
- **Chat de escuadra**: exige moderación y denuncias (Apple 1.2, contenido de
  usuarios). El marcador de escuadra sí entra.
- **Web del panel de creadores** en nivl.app: el panel en la app basta para
  empezar; la web, cuando haya más de un puñado de creadores.
- **Atribución de instalaciones de verdad** (deferred deep link con Branch o
  AppsFlyer): SDK nativo, coste y ATT. No compensa aún.
- **Pagos automáticos a creadores** y la integración con Whop: se apuntan a
  mano en `creator_payouts`.
- **Stripe web con atribución**: cuando haya web de pago; `record_sale` ya
  sirve (con `store = 'stripe'`).
- **Refactorizar `friends_board`** para compartir cuerpo con el marcador de
  escuadra: funciona en producción; se copia.
