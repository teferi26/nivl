# Revisión independiente (c) · seguridad y escenarios de cobro

Fecha: 2026-10-02. Rama `winter/chat2-compras`, base `bf32d28`. Revisado: `git diff bf32d28..HEAD` (56eecf3 servidor, 125eff8 propuesta 0036, b85ce96 cliente, 997c760/2d18519 oráculo), con 0020/0024/0025/0027/0033 en solo lectura.

No he cambiado código de producto. Solo he añadido este documento y dos tests de reproducción:
- `supabase/functions/_shared/store-review_test.ts`
- `src/lib/__tests__/pro-review-escenarios.test.ts`

Los tests marcados «DEFECTO» **pasan mientras el defecto exista**. Al corregir, hay que invertir la aserción marcada. Nada se ha desplegado ni se ha llamado a Supabase, RevenueCat, Stripe ni a las tiendas.

Evidencia: **AUTO** = test automático local · **PGlite** = SQL real (0027 + 0033 ± 0036) en memoria · **SANDBOX** / **DISPOSITIVO** = no hechos.

## Resumen

- **P0: ninguno.**
  - El cliente no tiene ninguna vía para concederse IA ni para concedérsela a otro.
  - Las ventas y comisiones solo salen de PRODUCTION.
  - Sin `sk_` las dos funciones fallan en cerrado.
- **P1: tres hallazgos.**
  - Uno en el cliente: Android, segunda suscripción tras recrear la cuenta.
  - Dos en Stripe web. Están dormidos mientras Stripe no se active en la web, pero bloquean activarlo.

## Hallazgos

### P1-1 · Android: doble suscripción tras borrar la cuenta NIVL y crear otra (o al cambiar de cuenta NIVL con la misma cuenta de Google)
- **Dónde:** `src/lib/pro.ts:431-456`.
  - `actual` se calcula solo con `Purchases.getCustomerInfo()` del uid nuevo.
  - La compra Play sigue en la cuenta de Google, pero RevenueCat la tiene asociada al uid antiguo. Por eso `actual = null`, `tipo = 'nueva'` y `purchasePackage(paquete)` se llama **sin** `productChangeInfo`.
- **Escenario:**
  1. El usuario tenía Pro mensual en Play.
  2. Borra la cuenta NIVL (o entra con otra) y **no** pulsa Restaurar.
  3. Compra Pro anual o Élite.
  4. Google crea una segunda suscripción en paralelo: dos cobros.
  - En iOS no ocurre: los productos están en el mismo grupo y Apple lo trata como cambio.
- **Reproducción:** AUTO `pro-review-escenarios.test.ts` «DEFECTO P1 Android». No se llama a `purchasePackage` con tercer argumento ni a `restorePurchases`. El comportamiento de Play sale de la documentación de Google (cada `purchase` sin `SubscriptionUpdateParams` es una suscripción nueva). Falta la prueba en SANDBOX.
- **Corrección:** en Android, antes de una compra `nueva`, llamar a `Purchases.syncPurchases()` (o `restorePurchases()`). Con Restore Behavior = Transfer, eso trae la compra Play al uid actual. Después, reevaluar `getCustomerInfo()`. Si aparece una suscripción NIVL, tratarla como `mismo`/`cambio`. Alternativa: bloquear la compra si Play informa de una compra NIVL activa que no es de este uid y pedir «Restaurar».

### P1-2 · Stripe web: quitarle la suscripción a otro usuario con su uuid (`client_reference_id`)
- **Dónde:** `supabase/functions/_shared/store-stripe.ts:58` (`row.provider === 'stripe'` → siempre se reemplaza) y `:105-106` (se sobrescribe `stripe_subscription_id`).
- **Escenario:**
  1. El atacante abre el Payment Link con `?client_reference_id=<uuid víctima>` (el uuid se expone a otros usuarios; SERVIDOR P2-4) y paga.
  2. La fila de la víctima pasa a apuntar a `sub_attacker`.
  3. El atacante cancela o pide el reembolso y llega `customer.subscription.deleted(sub_attacker)`: la víctima queda en `canceled`.
  4. Los eventos de la suscripción propia de la víctima (`sub_victim`) ya no encuentran fila (`sin_fila_stripe`). Sigue pagando y no tiene acceso.
- **Reproducción:** AUTO `store-review_test.ts` «DEFECTO P1 (Stripe web): un tercero…» → PASS. Es decir, el defecto se reproduce.
- **Corrección:**
  - No dejar que un checkout reemplace una fila Stripe **vigente** con otro `stripe_subscription_id`. Alternativa: exigir que `session.customer` coincida con `row.stripe_customer_id`.
  - Crear la Checkout Session en el servidor, autenticada con el JWT, en vez de un Payment Link público con `client_reference_id` en la URL.
- **Bloquea:** activar Stripe en la web.

### P1-3 · Stripe web: un checkout sobre una fila protegida cobra y no se registra en ningún sitio
- **Dónde:** `store-stripe.ts:104`. Si la fila es Apple/Google vigente o manual, devuelve `200 {ignored:'fila_protegida'}` y no guarda `sub_new`.
- **Escenario:**
  1. Alguien con Pro de App Store (o con una concesión manual) paga en la web.
  2. Stripe cobra cada mes.
  3. Al caducar la fila de tienda, ningún evento de `sub_new` encuentra fila. Paga sin acceso y no hay reconciliación Stripe que lo arregle.
- **Reproducción:** AUTO `store-review_test.ts` «DEFECTO P1 … fila protegida» → PASS (defecto reproducido).
- **Corrección:** elegir una de estas tres:
  - registrar la suscripción Stripe en una tabla propia (o en `stripe_subscription_id` sin tocar el derecho) para que pueda tomar el relevo;
  - cancelar o reembolsar automáticamente con aviso;
  - que la web no ofrezca checkout a quien ya tiene derecho, comprobándolo en el servidor al crear la sesión.

### P2
| # | Dónde | Escenario | Evidencia | Corrección |
|---|---|---|---|---|
| P2-1 | `pro.ts:404-405, 438-439` | Una suscripción cancelada pero vigente (`willRenew=false`) del mismo plan queda en «mismo» y el mensaje remite a «Restaurar compras», que no la reactiva. Google permite recomprar el mismo SKU para reactivarla; Apple la reactiva desde Ajustes. | AUTO `pro-review-escenarios` «DEFECTO P2» | Si `willRenew === false`, mensaje «Reactívala en Gestionar suscripción» con el botón, o permitir la recompra en Android. |
| P2-2 | `pro.ts:419` vs `:455` | Carrera: si `identificarEnTienda(otra)` entra en la cola después de comprobar `getAppUserID()` y antes de `purchasePackage`, el cobro queda a nombre de la otra cuenta. Exige cambiar de sesión durante la compra. | AUTO «DEFECTO P2 (carrera)» | Ejecutar la compra dentro de la misma cola (o volver a comprobar `getAppUserID()` justo antes y bloquear los cambios de sesión mientras `lock`). |
| P2-3 | `pro.ts:448-453`, `proplans.ts:623` | Cambio de plan en Play sobre una suscripción **cancelada pero vigente**: Google recomienda `WITHOUT_PRORATION` (*winback*); el código usa `CHARGE_PRORATED_PRICE`/`DEFERRED`. No está documentado si fallan. | NO PROBADO (SANDBOX Play) | Probarlo; si da `DEVELOPER_ERROR`, usar `WITHOUT_PRORATION` cuando `willRenew=false`. |
| P2-4 | `store-config.ts:17` | El regex `^sk_[A-Za-z0-9]{8,}$` rechaza `_` o `-` después del prefijo. El formato documentado (`sk_1234567890abcdef`) pasa. Si RevenueCat emitiera otro formato: 503 en cerrado (seguro, pero sin restauración). | AUTO `store-review_test` «clave» | Aceptar `^sk_[A-Za-z0-9_-]{8,}$`, o validar con una llamada de prueba al arrancar y registrar el error. |
| P2-5 | `0027:89` | `v_env := coalesce(environment, 'PRODUCTION')`: un evento sin `environment` contaría como venta. RevenueCat siempre lo envía y el webhook está autenticado. | Lectura | Valor por defecto `'SANDBOX'` o ignorar la venta si falta (en una migración futura). |
| P2-6 | 0036 `:130-140` | Stripe anual vigente más compra de tienda PRODUCTION del mismo nivel: se conserva Stripe. Si después se cancela Stripe, queda **sin acceso** hasta el siguiente evento de tienda o hasta Restaurar. | PGlite R4/R5 PASS (hueco demostrado) | Al cancelar Stripe, disparar una reconciliación de tienda para ese usuario, o incluir `provider='stripe'` solo si la fecha de Stripe es mayor. Además, el cliente ya bloquea esta compra (`puedeMejorarEnTienda`). |
| P2-7 | 0027 `TRANSFER` + 0033 | TRANSFER forzado tipo «regalo»: un cliente modificado hace `logIn(uuid_víctima)` + restore con su **propio** recibo. La fila de la víctima recibe el derecho del atacante. Con 0033 sin 0036 puede pisar un Élite manual o una fila Stripe de la víctima, y la suscripción Stripe queda huérfana (P1-2). | Razonamiento | Aplicar 0036 y corregir P1-2/P1-3. A medio plazo, `app_user_id` = HMAC del uuid (SERVIDOR P2-4). |
| P2-8 | `store-reconcile.ts:127-148` | Sin límite por usuario: muchas cuentas pueden agotar el límite de la API de RevenueCat y los webhooks pasarían a 503. Tras 5 reintentos se pierden ventas y comisiones. | Razonamiento | Limitar a ~1 llamada cada 10 s por uid (columna `requested_at` de `store_reconciliation`). |
| P2-9 | `0024 start_trial` | Una prueba de 7 días por cuenta: crear cuentas da pruebas nuevas (0,50 $ y sin profundo cada una). | Lectura | Aceptable por el tope de 0,50 $. Vigilar altas y pruebas por IP o dispositivo si crece. |
| P2-10 | `pro.ts:433` | `getCustomerInfo()` puede devolver la caché (hasta 5 min o sin red). Una suscripción recién caducada podría verse «activa» y bloquear con «mismo», o pasar como `oldProduct` en Play. | Razonamiento | Usar `syncPurchases()`/`invalidateCustomerInfoCache()` antes de decidir en un cambio de plan. |

## Lo verificado como correcto
1. **Autoconcesión imposible desde el cliente.**
   - `subscriptions` solo tiene RLS de lectura propia (0006:19).
   - `store_reconciliation` y `store_events` están revocadas.
   - `begin/apply_store_reconciliation`, `apply_store_event` y `user_tier` solo son de `service_role` (0027:274-277, 0033:166-169; PGlite 0036 «permisos» PASS).
   - Lo único expuesto a `authenticated` que escribe derechos es `start_trial`: una por cuenta, `cortesia` de 0,50 $, sin profundo, `on conflict do nothing`.
   - `store-reconcile` ignora el cuerpo y usa el uid del JWT.
   - Los productos `test_store`, promocionales y de Stripe en RevenueCat nunca dan derecho nativo: AUTO `store-review_test` sandbox PASS.
2. **Quitarle el derecho a otro vía RevenueCat** (`logIn(uuid_víctima)` + restore): solo **transfiere el recibo del atacante** hacia la víctima. Para quitárselo hace falta el recibo de la Apple ID o la cuenta Google de la víctima. Es aceptable, con las salvedades de P2-7.
3. **Sandbox y producción.**
   - Las ventas exigen `v_env='PRODUCTION'` (0027:208). El caso «sandbox sin venta» pasa en PGlite.
   - `STORE_SANDBOX_ACCESS` se aplica igual en el webhook y en reconcile, por el mismo `sandboxPolicy(env)`.
   - Un valor no válido falla en cerrado.
   - Con `none` y un snapshot solo sandbox:
     - una fila apple SANDBOX previa pasa a `canceled` con `current_period_end ≤ now` (PGlite R1);
     - un Élite **manual** queda intacto, también con el evento `INITIAL_PURCHASE` sandbox en la misma transacción (R2), y eso incluso sin 0036;
     - si no había fila, el `insert` de 0027 se cancela antes del commit (R3).
4. **Clave de RevenueCat.**
   - Sin `sk_` válida, el webhook responde 503 antes de cualquier RPC o HTTP y reconcile responde 503 (AUTO del subagente b).
   - El cliente solo lee `EXPO_PUBLIC_RC_*_KEY`, que es pública.
   - Ninguna clave sale de la petición.
5. **Android `productChangeInfo`.**
   - `oldProductIdentifier` sin base plan es correcto: el SDK espera «subscriptionId only» y descarta lo que va tras `:` (KDoc de `PurchaseParams.kt`).
   - `CHARGE_PRORATED_PRICE` vale para subir de nivel: todos los Élite cuestan más al mes que cualquier Pro (24,92 € vs 12,99 €/8,33 €).
   - `DEFERRED` vale para bajar de nivel o cambiar de periodo (Google lo recomienda para bajadas; requiere RTDN configuradas en RevenueCat).
   - Pendiente en SANDBOX: `DEFERRED` entre productos distintos del mismo nivel.
6. **Doble toque** (`lock`), **Ask to Buy / pendiente** (mensaje sin cobro), **sin red** (no se cobra; AUTO), **app matada tras cobrar** (el SDK termina la transacción y el webhook concede): correctos por diseño. El último está NO PROBADO en dispositivo.
7. **Idempotencia del servidor.**
   - `store_events.id` está dentro de la transacción y las reservas por revisión invalidan respuestas viejas.
   - Los eventos desordenados se deciden por el snapshot.
   - `normalizeStoreEvent` solo toca `product_id` del catálogo.
   - Stripe vuelve a leer la suscripción; los duplicados son inocuos; el `upsert ignoreDuplicates` devuelve `[]` si existe, con un único reintento y luego 500.
8. **0036.**
   - No abre ningún modo de conservar acceso sin pagar: solo conserva una fila manual o Stripe **ya vigente**, nunca la extiende (PGlite R7).
   - Una concesión manual sin fin de nivel ≥ «bloquea» una compra real inferior, pero el usuario mantiene un acceso mayor, así que es aceptable.
   - Al revocar la concesión hay que pedir Restaurar o esperar a la renovación (R6). Debe constar en el procedimiento de revocación.
9. **Oferta y entrega.**
   - Los precios de `proplans` (12,99 / 99,99 / 29,99 / 299 / 249 €) coinciden con `docs/PRECIOS.md`. Lo que se cobra es el `priceString` de la tienda, no la tabla.
   - En Élite, el ludus es «Solicita plaza… asignación manual» y el modo profundo tiene su límite mensual. No aparece nada ilimitado ni inmediato.
   - Prueba: `cortesia` = 500000 µ$ (0,50 $), sin profundo (0024:85).
   - Apple 2.1/3.1.2: título, duración y precio de cada producto; Términos, Privacidad y EULA (iOS) visibles (AUTO `prooffer`).
   - Apple 2.3.10: en iOS no se nombra Google Play (`textoGestionTienda`, `NOMBRE_TIENDA`). La grabación en un iPhone físico está NO PROBADA.

## Resultados exactos (2026-10-02, en este worktree)
| Comando | Resultado |
|---|---|
| `npm run typecheck` | OK (0 errores) |
| `CI=true npx jest --ci --runInBand src/lib/__tests__` | **31 suites, 440 tests, PASS**: 435 antes + 5 de la revisión |
| `CI=true npm run lint` | OK |
| `npx deno check revenuecat-webhook/index.ts store-reconcile/index.ts stripe-webhook/index.ts` | OK |
| `npx deno test --allow-read _shared/` | 46 passed, **1 failed**: `clasificar_test.ts` exige `--allow-env` (`ANTHROPIC_API_KEY`). Ajeno a pagos y no cambiado en esta rama. |
| `npx deno test --allow-read --allow-env _shared/` | **47 passed, 0 failed**. Incluye los 4 de `store-review_test.ts` |
| `node docs/payment-audit/propuestas/0036_test.mjs <PGlite>` | 10 pass / 0 fail. Con `--sin-0036`: 4 pass / 4 fail, como se esperaba. |
| PGlite de la revisión (scratchpad, no versionado; carga 0027 + 0033 + 0036 reales) | R1-R7: 7 pass / 0 fail |
| SANDBOX / DISPOSITIVO | NO PROBADO (ninguna compra) |

## QA que añade esta revisión (SANDBOX Play / TestFlight)
1. Play: tener Pro mensual, borrar la cuenta NIVL, crear otra y comprar Pro anual **sin restaurar**. ¿Hay dos suscripciones en Play? (P1-1)
2. Play: cancelar Pro mensual (sin que caduque) → subir a Élite con `CHARGE_PRORATED_PRICE`, y cambiar a Pro anual con `DEFERRED`. (P2-3)
3. iOS: cancelar y, sin que caduque, intentar volver a comprar el mismo plan en la app. (P2-1)

## Fuentes (consultadas el 2026-10-02)
- RevenueCat, Authentication (prefijo `sk_`, ejemplo `sk_1234567890abcdef`; claves secretas solo en el servidor): https://www.revenuecat.com/docs/projects/authentication
- RevenueCat, Managing subscriptions (`productChangeInfo`, modos de sustitución, `DEFERRED` requiere Google RTDN): https://www.revenuecat.com/docs/subscription-guidance/managing-subscriptions
- RevenueCat purchases-android, KDoc de `oldProductId` («We expect the subscriptionId only…»): https://github.com/RevenueCat/purchases-android/blob/main/purchases/src/main/kotlin/com/revenuecat/purchases/PurchaseParams.kt
- Google Play Billing, subscriptions (modos de sustitución, restricción de `CHARGE_PRORATED_PRICE`, cancelada pero vigente, *winback* `WITHOUT_PRORATION`): https://developer.android.com/google/play/billing/subscriptions
- Stripe, webhooks (orden no garantizado): https://docs.stripe.com/webhooks
- Apple App Review Guidelines 2.1, 2.3.10, 3.1.2: https://developer.apple.com/app-store/review/guidelines/

## Estado tras las correcciones del Chat 2 (02/10/2026)

| Hallazgo | Estado | Commit / evidencia |
|---|---|---|
| P1-1 Android: 2.ª suscripción tras recrear cuenta | CORREGIDO: en Android, si RevenueCat no ve ninguna suscripción de NIVL, `purchase` llama a `restorePurchases()` antes de decidir y compra con `productChangeInfo` si aparece una viva. Efecto colateral aceptado: con Restore Behavior = Transfer, esa sincronización traslada a esta cuenta una suscripción de la misma cuenta de Google. | 0929957 · `pro-review-escenarios.test.ts` (CORREGIDO P1 Android + caso sin nada que sincronizar) |
| P2 carrera de cambio de cuenta antes del cobro | CORREGIDO: el cobro va dentro de la cola de cuentas (`enColaDeTienda`) con recomprobación de `getAppUserID`; si cambió, se aborta sin pagar. | 0929957 · test CORREGIDO P2 (carrera) |
| P2 mismo plan cancelado pero vigente → «Restaurar» | CORREGIDO: remite a «Gestionar o cancelar suscripción» (reactivar). Si el servidor ya refleja el plan tras reconciliar, devuelve `activa` sin cobrar. | 0929957 |
| P1-2 Stripe web: tercero sustituye la suscripción de la víctima | CORREGIDO: una fila Stripe vigente no se sustituye por OTRA suscripción. | ver commit siguiente · `store-review_test.ts` (CORREGIDO P1) |
| P1-3 Stripe web: pago sobre fila protegida no registrado | ABIERTO — **bloquea activar Stripe en la web**. Requisito: crear la sesión de Checkout en servidor con el JWT (no Payment Link con `client_reference_id` en la URL) y rechazarla si la cuenta ya tiene una suscripción vigente. Hoy se registra en logs para revisión/reembolso manual. | test ABIERTO P1-3 |
| P2 0027: evento sin `environment` cuenta como PRODUCTION | ABIERTO (SQL, coordinador). RevenueCat siempre envía `environment`; riesgo bajo. | — |
| Resto de P2 | Documentados arriba; sin cambio. | — |

Pruebas tras las correcciones: Jest `src/lib/__tests__` 442/442 PASS; `npm run typecheck` y `npm run lint` PASS; `deno test --allow-read --allow-env _shared/` 47/47 PASS; `deno check` de las 3 funciones PASS. Sandbox y dispositivo: NO PROBADO.
