# Auditoría de pagos · servidor y reconciliación (2026-10-02)

Subagente (b) del Chat 2 · Compras. Rama `winter/chat2-compras`, base `bf32d28`. Nada desplegado; nada ejecutado contra Supabase, RevenueCat, Stripe ni las tiendas. Se conservan los arreglos del 29/09: 0033, reserva de revisión, snapshot fresco y transacción única.

Evidencia: **AUTO** = test automático local · **SANDBOX** = compra de prueba real · **PROD** = producción. Todo lo marcado PASS es AUTO. Nada se ha probado en SANDBOX ni en PROD.

## Hallazgos

### P0-1 · El servidor usaba la clave pública iOS como clave de RevenueCat
- **Dónde:** `revenuecat-webhook/index.ts:9` y `store-reconcile/index.ts:6` (base): `REVENUECAT_API_KEY ?? EXPO_PUBLIC_RC_IOS_KEY`. `PROPUESTA-RESTAURACION.md` §3 indica fijar `REVENUECAT_API_KEY` con la clave pública iOS y dice que «no se necesita clave secreta».
- **Qué dice RevenueCat** (consultado 2026-10-02):
  - Las claves públicas («SDK keys») son específicas de cada app y sirven para cambios «no potentes».
  - Las secretas (`sk_…`) valen para todo el proyecto y deben guardarse solo en servidores. [Authentication](https://www.revenuecat.com/docs/projects/authentication)
  - `GET /v1/subscribers` admite una clave pública. La documentación **no aclara** si la clave de la app iOS devuelve las compras de Play Store. Customer Info se comparte a nivel de proyecto ([blog cross-platform](https://www.revenuecat.com/blog/engineering/cross-platform-subscription)), así que probablemente sí, pero queda **NO PROBADO**.
  - Además, ese GET **crea el cliente si no existe**. [API v1 Customers](https://www.revenuecat.com/docs/api-v1/customers)
  - La regla del encargo prohíbe usar la clave iOS en lugar de la configuración de Android.
- **Corrección (código):** nuevo `_shared/store-config.ts`.
  - `revenueCatServerKey` solo acepta `REVENUECAT_API_KEY` con formato `sk_…`. Rechaza `appl_`/`goog_` y ya no hay fallback a `EXPO_PUBLIC_RC_IOS_KEY`.
  - Si falta la clave, ambas funciones fallan en cerrado: el webhook responde `503 {"error":"store_not_configured"}` antes de cualquier RPC o HTTP (`store-webhook.ts:36`) y `store-reconcile` responde 503 «pendiente». En los dos casos queda un `console.error`.
- **⚠ Producción depende hoy de la clave pública** (por `REVENUECAT_API_KEY=appl_…` o por el fallback). Si se despliega este código sin poner antes la secreta, la restauración queda en 503 y los webhooks se reintentan. RevenueCat reintenta 5 veces (a los 5, 10, 20, 40 y 80 min) y después **pierde el evento**, es decir, la venta y la comisión. El estado de acceso se recupera con la siguiente reconciliación.
- **Reproducción:** `before_test.ts` sobre el código base → 3 FAIL (fallback iOS, sin error de configuración y producto Google). Con el código nuevo → PASS (`store-audit_test.ts`).

### P1-1 · Las ventas y comisiones de Google Play se descartaban
- **Dónde:** `0027:170` busca `store_products` por el `product_id` exacto. RevenueCat envía los productos de Play creados desde 02/2023 como `<subscription_id>:<base_plan_id>` ([Android products](https://www.revenuecat.com/docs/getting-started/entitlements/android-products)).
- **Efecto:** la venta se marca como «producto fuera del catálogo» y no llega a `record_sale`, así que no hay venta ni comisión. El acceso sí se concedía, porque el snapshot ya hace `split(':')`.
- **Corrección (código, sin migración):** `normalizeStoreEvent` (`store-reconcile.ts:75`, aplicada en la línea 119) pasa al SQL el id del catálogo y guarda el original en `store_product_id_raw`.
- **Evidencia (PGlite, 0027 + 0033 reales):** evento crudo → `sales: 0, note: "producto fuera del catálogo"` (FAIL); evento normalizado → 1 venta (PASS).
- Pendiente de confirmar en el panel cuál es el id real de los base plans: SANDBOX/Play, **NO PROBADO**.

### P1-2 · Sandbox = Pro/Élite gratis renovable en la base de datos de producción
- **Escenario:** cualquier compra sandbox concede acceso real (0027 lo hace a propósito para App Review).
  - TestFlight renueva cada día hasta 6 veces ([Apple](https://developer.apple.com/help/app-store-connect/test-a-beta-version/subscription-renewal-rate-in-testflight)).
  - Los license testers de Google renuevan cada 5–30 min hasta 6 veces ([Android](https://developer.android.com/google/play/billing/test)).
  - `ai_state` añade 2 días de gracia.
  - Se puede volver a comprar sin coste, así que el acceso es gratis **indefinidamente**: unos 9 días por compra con TestFlight.
  - El coste para NIVL es la IA consumida, limitada por el candado mensual de cada plan. **Nunca** genera ventas ni comisiones: se verificó que `environment='PRODUCTION'` es obligatorio en 0027:207.
- **Riesgo:** hoy está acotado (TestFlight interno, testers de licencia elegidos por nosotros). Pasa a ser real si se publica un enlace público de TestFlight.
- **¿Puede un sandbox pisar producción?** Dentro de un mismo snapshot, no: gana producción (0033:122). **Sí** pisaba una concesión manual o de Stripe vigente (ver P1-3).
- **Mitigación (código, configurable):** variable `STORE_SANDBOX_ACCESS` (`store-config.ts`):
  - sin definir o `all`: comportamiento actual, para que App Review siga funcionando;
  - `none`: ninguna cuenta obtiene acceso desde sandbox;
  - `uuid,uuid`: solo las cuentas de revisión/QA;
  - cualquier otro valor falla en cerrado (`none`).
  - Los eventos sandbox se siguen registrando. AUTO PASS.

### P1-3 · Una compra sandbox borraba el Élite manual de las cuentas demo
- **Dónde:** `0033:131-158`. Si `v_best` existe, se hace upsert sobre una fila `manual`/`stripe` vigente. Cuando caduca el sandbox, la fila pasa a `canceled` y se pierde la concesión manual. `DEMO-REVISION.md` ya lo avisa («No compres con una cuenta demo manual»), pero el revisor de Apple puede comprar con cualquier cuenta.
- **Evidencia PGlite:** antes → durante la compra la fila es `pro_mensual/apple/SANDBOX` y después `canceled` (FAIL). Con la propuesta → la fila se mantiene `elite_anual/manual/active` (PASS). Una compra real de tier superior (Pro manual → Élite tienda) sigue sustituyéndola (PASS).
- **Propuesta SQL:** `propuestas/NNNN-borrador-proteger-concesiones-manuales.sql` (SHA-256 `ef64ea2f0ad7edb118f00afe60b2191a14f7091dd465d97140ab63641fbdf258`).

### P1-4 · Stripe (solo web; dormido en las apps nativas): orden, duplicados y sobrescritura
- **Defectos de la base** (`stripe-webhook/index.ts`, por inspección, porque el módulo no era testeable):
  1. Escribía el estado del evento: un `updated(active)` antiguo podía reactivar una suscripción cancelada. Stripe no garantiza el orden ([webhooks](https://docs.stripe.com/webhooks), «Orden de los eventos»).
  2. El upsert sin guarda pisaba `owner`, filas Apple/Google vigentes o concesiones manuales. Un `subscription.deleted` antiguo cancelaba a quien ya pagaba en la tienda.
  3. Un checkout sin suscripción escribía `active` con `current_period_end=null`, y `ai_state` lo trata como acceso **para siempre**.
  4. No validaba que `client_reference_id` fuera un uuid: Stripe reintentaba con 500 durante 3 días.
  5. Usaba `STRIPE_WEBHOOK_SECRET ?? ''`, sin fallar en cerrado.
- **Corrección (código):** nuevo `_shared/store-stripe.ts` con la función reescrita.
  - Vuelve a leer la suscripción con `subscriptions.retrieve`, así que el resultado no depende del orden y los duplicados son inocuos.
  - Hace update optimista con condiciones sobre provider, plan y stripe id.
  - Respeta las filas protegidas y exige uuid y suscripción.
  - Con los secretos ausentes o con formato inválido responde 500 (Stripe reintenta).
  - Firma con `constructEventAsync` + `createSubtleCryptoProvider`, con la tolerancia por defecto de 300 s.
- **Evidencia:** 6 tests AUTO PASS.

### P2 (documentados, sin cambio)
- **P2-1 · Eventos perdidos tras 5 reintentos.** Si RevenueCat o Supabase fallan durante unas 2,6 h, un `INITIAL_PURCHASE`/`RENEWAL` se pierde para ventas y comisiones (el acceso se recupera). Propuesta futura: una bandeja `store_event_inbox` que guarde el evento verificado antes de reconciliar, más un cron de reproceso. También hay que revisar a menudo «Webhook failures» en el panel.
- **P2-2 · `REFUND_REVERSED` solo se registra.** La comisión anulada por el reembolso no vuelve. El acceso sí vuelve, porque el snapshot ya no trae `refunded_at`.
- **P2-3 · Fallos que se reintentan con 503 hasta agotar los reintentos:**
  - Un evento con un usuario que tiene **borrado pendiente**: `begin` lo omite y `apply` lanza `Incomplete store event snapshot`. Se resuelve solo cuando el borrado termina.
  - Más de 20 alias en un evento.
- **P2-4 · Privacidad de la identidad RevenueCat.** El `app_user_id` es el uuid de Supabase y la clave pública va dentro de la app, así que quien conozca un uuid ajeno puede leer su Customer Info (estado, `creator_code`) o fijarle atributos. **No** puede quitarle la suscripción: haría falta el recibo de la Apple ID o Google de la víctima. Lo único que puede hacer es regalarle la suya. Mitigación real, con cambio de cliente y servidor: usar como `app_user_id` un HMAC del uuid, o no exponer uuids a otros usuarios.
- **P2-5 · `TEMPORARY_ENTITLEMENT_GRANT`** (caída de la tienda, como máximo 24 h): no aparece en `subscriptions` de tienda nativa, así que no da acceso hasta el evento real (falla en cerrado). `SUBSCRIPTION_PAUSED`, `BILLING_ISSUE` (gracia vía `grace_period_expires_date`), `PRODUCT_CHANGE`, `EXPIRATION` antes que `RENEWAL` y `TRANSFER` repetido son inocuos: el acceso se decide por el snapshot actual, no por el tipo de evento ([event types](https://www.revenuecat.com/docs/integrations/webhooks/event-types-and-fields)).
- **P2-6 · Al restaurar con transferencia desde otra cuenta NIVL viva**, la cuenta origen conserva el acceso hasta que llega el webhook `TRANSFER`. Si ese webhook se pierde, lo conserva como máximo hasta el fin del periodo más 2 días.

## Verificado sin defecto
- **Autenticación RevenueCat:** la cabecera se compara en tiempo constante (SHA-256) contra el valor exacto o `Bearer <valor>`; sin secreto → 401. RevenueCat envía la cabecera tal cual se configura y solo da por buena una respuesta 200 en menos de 60 s ([webhooks](https://www.revenuecat.com/docs/integrations/webhooks)). Un JSON inválido o un evento sin id → 200 (no se reintenta); un fallo transitorio → 503.
- **Idempotencia:** `store_events.id` se inserta dentro de la transacción de `apply_store_reconciliation`. Si el proceso muere tras la reserva, no se aplica nada y el reintento repite todo. Si muere tras el commit, el reintento es un duplicado y el snapshot se vuelve a aplicar sin efecto. Una respuesta lenta queda invalidada por una reserva posterior (`pending` → 503 o 202).
- **Acceso a otra persona:** `store-reconcile` usa solo el uid validado por `auth.getUser(JWT)` e ignora el cuerpo (test existente PASS). Ningún id del cliente llega al SQL.

## Restaurar tras borrar la cuenta NIVL (prioridad máxima)
- **Restore Behavior** ([docs](https://www.revenuecat.com/docs/projects/restore-behavior), 2026-10-02). Por defecto: **Transfer to new App User ID**. Las otras opciones son *Transfer if there are no active subscriptions*, *Keep with original App User ID* y *Share (legacy)*. Se puede fijar un comportamiento distinto para sandbox. La documentación no menciona límites de transferencia: **NO PROBADO**.
- **Con NIVL:** la cuenta borrada desaparece de `auth.users` y su uuid ya no se puede usar. Solo la opción por defecto permite restaurar.
  - *Keep with original*: la restauración devuelve error.
  - *Transfer if no active*: no transfiere mientras la suscripción siga activa.
  - En ambos casos, el usuario que pagó queda sin acceso hasta que caduque. **El panel tiene que estar en «Transfer to new App User ID», tanto en producción como en el ajuste de sandbox.**
- **Implementado:** el `TRANSFER` con origen borrado reconcilia el destino (tests PGlite existentes: 45/45 PASS) y `store-reconcile` reconcilia al que restaura.
- **Ventas:** con el borrado, `store_sales.user_id` pasa a null y se conservan (0025). Las renovaciones siguientes cuentan para la cuenta nueva por `original_transaction_id`. Restaurar no crea ventas.
- **¿Borrar el subscriber en RevenueCat al borrar la cuenta?** Recomendado, como cambio del dueño de `account-erasure` (no es mío):
  - Hacer `DELETE /v1/subscribers/{uuid}` con la clave secreta. RevenueCat lo considera suficiente para RGPD.
  - No cancela la suscripción en Apple ni en Google. Si el usuario vuelve, se recrea y se puede restaurar sin depender del Restore Behavior ([Deleting users](https://www.revenuecat.com/docs/dashboard-and-metrics/customer-history/manage-users)).
  - Coste: se pierde el historial en RevenueCat. Los reembolsos siguen funcionando, porque `record_refund` usa `transaction_id`.

## Resultados exactos
- `deno check` de las 3 funciones y los tests → OK (deno 2.9.6, `npx` cache).
- `deno test --allow-read _shared/store-reconcile_test.ts _shared/store-audit_test.ts` → **21 passed, 0 failed** (11 existentes + 10 nuevos).
- Defectos con el código base (`before_test.ts`, scratchpad) → **3 failed**.
- `node scripts/test-store-reconciliation.mjs <PGlite 0.5.8>` → `{"ok":true,"checks":45}`. Con la propuesta cargada dos veces encima de 0033 → también 45/45.
- Escenarios de auditoría en PGlite: sin propuesta, 2 FAIL (manual Élite y Google en crudo); con propuesta y TS, PASS. El caso «Google en crudo» falla siempre a propósito: muestra lo que hace 0027 sin la normalización de TS.
- PGlite tomado de `C:/temp/AGROLAFORGA/node_modules/@electric-sql/pglite` (no se ha instalado nada).

## Acciones del coordinador (en orden)
1. RevenueCat → API keys: crear una **secret key de API v1** (`sk_…`; no v2, porque el endpoint es v1) → `supabase secrets set REVENUECAT_API_KEY=sk_…`. Retirar `EXPO_PUBLIC_RC_IOS_KEY` de los secrets del servidor. **Solo después** desplegar `revenuecat-webhook` y `store-reconcile`.
2. Comprobar en el panel que el Restore Behavior es **Transfer to new App User ID** en producción y en el ajuste de sandbox.
3. Decidir `STORE_SANDBOX_ACCESS`. Durante App Review: `all`, o la lista de uuids de las cuentas de revisión. Antes de un TestFlight público: `none` o lista.
4. Asignar número y huella a la propuesta SQL y aplicarla. Corregir `PROPUESTA-RESTAURACION.md` §3 (sobre la clave secreta).
5. Stripe, si se activa en la web: `STRIPE_SECRET_KEY` (`sk_`/`rk_`) y `STRIPE_WEBHOOK_SECRET` (`whsec_`).
6. Confirmar con el dueño de account-erasure el `DELETE` del subscriber en RevenueCat.

## QA pendiente (SANDBOX o dispositivo físico; nada probado)
- Compra en iOS sandbox → webhook 200 → acceso.
- Restaurar en la misma cuenta.
- Borrar la cuenta → crear otra → restaurar → TRANSFER → acceso en la nueva.
- Transferencia entre dos cuentas vivas.
- Comprar en Android con un license tester y verificar que el `product_id` tiene el formato `x:base` y que sale 1 venta solo en PRODUCTION.
- `BILLING_ISSUE` → gracia → `EXPIRATION`.
- Reembolso → 503 con la clave ausente (reintento) → recuperación.
- Cuenta demo manual Élite que compra en sandbox, con la propuesta aplicada.
- `STORE_SANDBOX_ACCESS=none` → sin acceso desde sandbox.
