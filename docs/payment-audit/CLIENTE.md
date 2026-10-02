# Auditoría de pagos · cliente y experiencia de compra

Chat 2 · Compras, subagente (a). Fecha: 2026-10-02. Rama `winter/chat2-compras`, base `bf32d28`. `react-native-purchases` instalado: **10.10.2**.

Alcance: `src/lib/{pro,proplans,subscription,storepolicy}.ts`, `src/app/pro.tsx`, `src/components/ProOffer.tsx` y sus tests. Se conservan los arreglos del 29/09: reconciliación con `store-reconcile` (cuerpo vacío), comparación de precio antes de cobrar y tienda cerrada en solo lectura.

Nota: **ningún test automático acredita una compra real.** Los mocks del SDK no sustituyen a StoreKit ni a Play Billing. Todo lo que dependa de la tienda queda como NO PROBADO en dispositivo.

## Hallazgos

| Sev | Hallazgo | Dónde (antes → ahora) | Corrección |
|---|---|---|---|
| **P0** | **Doble cobro en Android al cambiar de plan.** `purchasePackage(paquete)` se llamaba sin `productChangeInfo`. En Google Play, comprar otro producto así abre una **segunda suscripción en paralelo**. Afecta a Pro→Élite y a anual↔mensual. | `pro.ts:299` → `pro.ts:419-470` | Antes de cobrar se lee `getCustomerInfo()` y se sacan las suscripciones NIVL activas (`subscriptionsByProductIdentifier`, `activeSubscriptions` y entitlements). En Android se pasa `StoreProductChangeInfo{oldProductIdentifier: id sin «:baseplan», replacementMode}` (la API vigente; `GoogleProductChangeInfo` está obsoleta): `CHARGE_PRORATED_PRICE` para subir de nivel y `DEFERRED` para el resto. Si no se puede leer `customerInfo`, no se cobra. |
| **P0** | **Segundo cobro entre tiendas o con Stripe.** Con una suscripción viva en la App Store, comprar en Android, o con Stripe/web comprar en la tienda, creaba otra suscripción. Además, `pro.tsx` ofrecía «Ver NIVL Élite» a cualquier Pro, también a los de Stripe. | `pro.ts`, `pro.tsx:115` → `pro.ts:440-445`, `proplans.ts:616`, `pro.tsx:126` | Si la suscripción activa es de otra tienda, se bloquea y se dice dónde gestionarla. `puedeMejorarEnTienda` deja fuera a Élite, owner, `provider='stripe'` y los planes heredados `mensual`/`anual`. Para ello `fetchSubscription` ahora lee `provider` (columna de 0020; la política RLS de lectura propia ya existe). |
| **P0 (Apple 2.1)** | **No se veían todos los productos a la vez.** El selector solo mostraba el nivel elegido; el Élite exigía tocar otra pestaña. Los títulos eran «ANUAL»/«FUNDADOR», sin nombre de suscripción ni duración. | `ProOffer.tsx:338-368` → `ProOffer.tsx:145-160` y su lista | Con la tienda abierta, una sola lista con los 5 productos (el fundador solo mientras quedan plazas). Cada fila lleva el título de App Store Connect («NIVL Élite fundador»), la duración («Anual · 1 año · renovación automática») y el `priceString`. |
| **P1** | **Compra a nombre de otra cuenta.** `asegurarUsuario` ejecutaba `aplicarUsuario` fuera de la cola, así que podía colarse entre dos cambios de sesión. Nunca se comprobaba la identidad real del SDK. | `pro.ts:156-163` → `pro.ts:177-198` | El cambio de usuario va por la misma cola. Después se compara `Purchases.getAppUserID()` con el uid de la sesión; si no coinciden, ni se compra ni se restaura. Si `logIn` falla, la compra se aborta. |
| **P1** | **Restaurar podía devolver «nada» por error.** Solo se miraba `activeSubscriptions`. | `pro.ts:320` → `pro.ts:396-416, 482` | También se miran `subscriptionsByProductIdentifier.isActive` y `entitlements.active`. Los ids «producto:baseplan» de Play se normalizan. Tras borrar la cuenta y crear otra, el flujo `restorePurchases` → `store-reconcile {}` → espera a `ai_status` sigue igual. |
| **P1** | **Restaurar con un recibo de otra cuenta** (si RevenueCat no transfiere) mostraba un error genérico. | `pro.ts:traducir` | `RECEIPT_ALREADY_IN_USE` y `RECEIPT_IN_USE_BY_OTHER_SUBSCRIBER` explican que la compra es de otra cuenta NIVL. Se añadieron también `PRODUCT_ALREADY_PURCHASED`, `OPERATION_ALREADY_IN_PROGRESS`, `STORE_PROBLEM` y `OFFLINE_CONNECTION`. |
| **P1** | **No había forma de gestionar ni cancelar desde la app.** Solo una nota de texto. | `pro.tsx:172` → `pro.tsx:196` y `pro.ts:506` | Nuevo botón «Gestionar o cancelar suscripción», solo para `provider` apple/google. En iOS abre `showManageSubscriptions()`; en Android, la `managementURL` de RevenueCat, con la página de la tienda como alternativa. Si la suscripción es de Stripe, se remite a la web. |
| **P1** | **Volver a comprar lo que ya se tiene, y falsos «activa».** Un Pro podía elegir su mismo plan. Un cambio de plan daba «activa» en cuanto el servidor devolvía cualquier derecho de pago, aunque fuera el plan anterior. | `pro.ts:305`, `proplans.compraReflejada` | El mismo plan se bloquea en `purchase` y en la UI se marca como «Tu plan actual», no seleccionable. En un cambio de plan solo cuenta el plan **exacto** (`planExacto`). Un nuevo resultado, `programada`, cubre las bajadas o cambios de periodo que la tienda aplica al renovar. |
| **P2** | **Pagos pendientes sin salida.** El aviso de Ask to Buy, pago diferido o resultado `pendiente` no decía qué hacer. | `pro.ts:222`, `ProOffer.tsx:66-71` | Ahora dice que no se ha cobrado nada e indica «pulsa Restaurar compras». |
| **P2** | **Oferta introductoria.** No se mostraba nunca. Hoy no hay ninguna en ASC (dato de Chat 1), pero si se configurara una en Play, quedaría oculta. | `pro.ts:281`, `proplans.textoIntro` | `introsDeTienda()` la declara solo si la tienda la da: en iOS, con elegibilidad (inelegible = no se dice; desconocida = texto condicional); en Android, con `introPrice` de la opción por defecto. Si falla la lectura, el catálogo cuenta como error y no se vende. Sin oferta, el paywall no menciona ninguna prueba de tienda. La prueba de 7 días sigue siendo solo del servidor. |
| **P2** | **Copy de Élite.** «pensando al máximo» no era cierto: el esfuerzo es `xhigh`, no `max`. El beneficio del ludus se ha renombrado según la decisión del usuario. | `proplans.ts:331-332` | Ahora dice «pensando a fondo». El beneficio pasa a «Solicita plaza en un ludus (5-8)» con «asignación manual, según disponibilidad». No hay acceso anticipado, retos ni uso ilimitado (test). **→ revisión UX del Chat 4.** |
| **P2** | **Errores mal tratados.** «Avísame» podía mostrar error si `insertEvent` fallaba (trigger de salud de 0030). `startTrial` convertía cualquier `ok:false` en «ya usada». | `ProOffer.tsx:213`, `pro.ts:88-92` | El aviso es best-effort. Solo `reason:'ya_usada'` cuenta como prueba usada; el resto sale con el mensaje genérico. |

Comprobado sin cambios:

- **El cliente no se concede acceso.** El derecho sale solo de `ai_status`. A `store-reconcile` se envía `body: {}`, y `ai_status` va sin argumentos (test «ningún id… viaja al servidor»).
- **Web / tiendas.** En web, `purchasesAvailable()` es false. `storepolicy` impide Stripe y la clave propia en iOS/Android (`storepolicy.test.ts`).
- **Doble toque.** El cerrojo `lock` deja una sola compra (test nuevo).
- **App cerrada a mitad de compra.** El SDK termina la transacción al volver y la sincroniza; `pro.tsx` relee el estado al enfocar. No queda nada colgado en el cliente (NO PROBADO en dispositivo).

## Requisitos Apple 2.1 / 3.1.2 (vídeo en iPhone físico)

| Requisito | Estado en código | Evidencia |
|---|---|---|
| Título de cada suscripción | Hecho: «NIVL Pro mensual / anual», «NIVL Élite mensual / anual / fundador», iguales que en ASC es-ES | test `prooffer` «los cinco productos…» PASS |
| Duración de cada una | Hecho: «Mensual · 1 mes» / «Anual · 1 año», más «renovación automática» | ídem PASS |
| Precio de cada una | Hecho: `priceString` de StoreKit; nunca la tabla en euros | ídem PASS |
| Todos visibles sin pasos ocultos | Hecho: lista única de 5 (el fundador solo mientras `founder_seats_left()>0`) | PASS (mock) |
| Enlaces a Términos de uso y Privacidad | Hecho: visibles bajo «Restaurar compras», sin desplegar nada; URLs `nivl-web.vercel.app/{terminos,privacidad}` | PASS |
| EULA | Hecho: en iOS, tercer enlace «EULA de Apple» al EULA estándar (no hay uno propio); en Android no aparece | PASS (iOS sí, Android no) |
| 2.3.10: no nombrar la otra plataforma | Hecho: `textoGestionTienda(plataforma)` en la letra de renovación y en `pro.tsx`. iOS: «Ajustes > tu nombre > Suscripciones»; Android: «Google Play > Pagos y suscripciones > Suscripciones»; web: sin nombrar tiendas. El bloqueo entre tiendas dice «otra tienda» | `proplans`/`prooffer` PASS |
| Fundador anual, no vitalicio | Hecho: «suscripción anual (1 año) de renovación automática… no es un pago único ni vitalicio» | PASS |
| Falta un producto en la offering | Hecho: aviso «Algún plan no está disponible…». Si falta el nivel entero o todo el catálogo, mensaje con «Reintentar precios». Nunca un paywall vacío sin explicación | PASS |
| Grabación en iPhone real | **NO PROBADO**: Chat 5 / dueño | — |

## Evidencia

- **Tests automáticos (2026-10-02, en el worktree):**
  - `npm run typecheck`: OK, 0 errores.
  - `CI=true npx jest --ci --runInBand src/lib/__tests__`: **29 suites, 432 tests, todos PASS**. De ellos, pro\*/store\* son 5 suites y 94 tests.
  - `CI=true npm run lint`: OK, sin avisos.
- **Antes/después:** con el `pro.ts` de la base y el test nuevo, `pro-purchases` falla **16 de 33**. Fallan, entre otros, el `productChangeInfo` de Android, el bloqueo del mismo plan, el bloqueo de otra tienda, el chequeo de `getAppUserID`, la restauración por entitlement y la de Play con «:baseplan», y la gestión. Con el código nuevo pasan 33/33. Con el `ProOffer` anterior, los tests nuevos de 2.1/3.1.2 fallan porque los títulos y el Élite no aparecen.
- **Simulador:** NO PROBADO.
- **Dispositivo / sandbox:** NO PROBADO, ninguna compra hecha.

## Casos físicos pendientes (QA · Chat 5)

En TestFlight y sandbox iOS, y en pista interna de Play con cuentas de prueba:

1. Vídeo 2.1: paywall con los 5 productos, títulos, duración, precio, Términos, Privacidad y EULA.
2. Compra Pro anual desde cero.
3. Pro→Élite: inmediato en iOS y Play, una sola suscripción activa en «Suscripciones» de la tienda.
4. Élite→Pro: programado. La app debe decir «se aplica en tu próxima renovación».
5. Anual↔mensual del mismo nivel.
6. Mismo plan: bloqueado.
7. Suscripción iOS con la misma cuenta en Android: bloqueado.
8. Ask to Buy (iOS) y pago pendiente en Play: aviso, aprobación y activación.
9. Cancelar la hoja de pago.
10. Modo avión a mitad de compra.
11. Matar la app a mitad de compra.
12. Restaurar en la misma cuenta.
13. **Borrar la cuenta NIVL, crear otra y Restaurar** (prioridad máxima).
14. Cerrar sesión con A, entrar con B y comprar: debe quedar a nombre de B.
15. «Gestionar o cancelar» en iOS y Android.
16. Expiración y reembolso: la app pasa a gratis tras `ai_status`.

## Dependencias

- **Chat 1 (tiendas):**
  - Confirmar que en Play cada plan es un **producto propio** (`nivl_pro_anual`, …), no varios base plans de un mismo producto. Si no, Google solo permite `WITHOUT_PRORATION` o `CHARGE_FULL_PRICE`, y `DEFERRED` / `CHARGE_PRORATED_PRICE` darían `DEVELOPER_ERROR`.
  - Confirmar que no hay ofertas de introducción en Play o, si las hay, que se aceptan declaradas.
  - Confirmar Restore Behavior = Transfer en RevenueCat.
  - El grupo iOS «NIVL» y sus niveles ya están verificados.
- **Chat 4 (UX):** revisar el copy nuevo:
  - lista única de 5 productos;
  - «Tu plan actual»;
  - avisos `pendiente` y `programada`;
  - botón «Gestionar o cancelar suscripción»;
  - «Algún plan no está disponible…»;
  - beneficio «Solicita plaza en un ludus (5-8)»;
  - «pensando a fondo».

  Además, `onboarding.tsx` usa `ProOfferBody`/`ProOfferActions`: comprobar el pie fijo con la lista más larga.
- **Coordinador / producto:**
  - Elección de modos en Play: subida con `CHARGE_PRORATED_PRICE` (cobro de la diferencia ya) y bajada con `DEFERRED`. Validarlo.
  - El cliente asume que la columna `subscriptions.provider` (0020) sigue legible por el propio usuario.
- **Salida:** todo es JS/TS, así que va **por OTA** sobre el binario 1.0.7 (que ya trae `react-native-purchases` 10.10.2). **No hace falta binario nuevo.** `showManageSubscriptions`, `getAppUserID` y `checkTrialOrIntroductoryPriceEligibility` ya existen en el módulo nativo instalado.

## Fuentes (consultadas el 2026-10-02)

- RevenueCat, gestión de suscripciones (productChangeInfo, replacement modes, iOS sin código): https://www.revenuecat.com/docs/subscription-guidance/managing-subscriptions
- RevenueCat Community, error con DEFERRED en base plans del mismo producto: https://community.revenuecat.com/sdks-51/passing-oldproductid-when-googlereplacementmode-deferred-results-in-an-error-purchase-4793
- RevenueCat blog, `oldProductId` sin base plan y formato de `activeSubscriptions`: https://www.revenuecat.com/blog/engineering/custom-flows-android
- Google Play Billing, upgrades/downgrades y pagos pendientes: https://developer.android.com/google/play/billing/subscriptions
- Apple App Review Guidelines 3.1.1/3.1.2: https://developer.apple.com/app-store/review/guidelines/
- EULA estándar de Apple: https://www.apple.com/legal/internet-services/itunes/dev/stdeula/
- Tipos del SDK instalado: `node_modules/react-native-purchases/dist/purchases.d.ts` (`purchasePackage(aPackage, upgradeInfo?, productChangeInfo?, googleIsPersonalizedPrice?)`, `showManageSubscriptions`) y `@revenuecat/purchases-typescript-internal/dist/{offerings,customerInfo}.d.ts`.
- Rechazo vigente de Apple: `winter-chat1/docs/release-audit/00-apple-rechazo-literal.md` (solo lectura).
