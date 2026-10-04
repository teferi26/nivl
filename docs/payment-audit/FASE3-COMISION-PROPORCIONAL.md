# Fase 3 · Comisión proporcional y venta sin precio (propuesta SQL 1.0.9)

Chat «NIVL - Compras», subagente E. Fecha: 2026-10-04. **Es una propuesta y no tiene número.** No se ha ejecutado nada contra Supabase. El coordinador asigna el número y la huella.

- SQL: `docs/payment-audit/propuestas/NNNN-borrador-comision-proporcional.sql`
  SHA-256 `838daeaabfeb1fd5eeb1965c1b2f965e2b1586be829929a75805f61a8db45649`
- Espejo TS: `src/lib/creatormath.ts` (`factorOferta`, `comisionCents` con `factorPrecio`) y `src/lib/__tests__/creatormath.test.ts`
- Prueba: `scripts/test-comision-proporcional.mjs`
  SHA-256 `4f46336b28ecbb5c2db5755fa5204813be564f75f278df27712be638f7ab8a16`

Resuelve los dos P1 de `FASE3-OFERTAS-109.md` §2 y §4.3, con las decisiones del dueño del 04/10/2026:

1. La comisión de una oferta rebajada es **proporcional al precio pagado**. No se recorta por precios regionales (aclaración del Chat 2, 04/10).
2. Se arregla el **precio null** de 0027.

## Contrato

| Pieza | Cambio |
|---|---|
| `store_products.list_price_cents` (nueva, `> 0`) | Precio de catálogo en céntimos de EUR con IVA, tomado de `PRECIOS.md`: 1299 / 9999 / 2999 / 29900 / 24900. Solo se rellena donde vale null, así que al re-ejecutar no se pisa un ajuste manual. **null = sin escalar**, como en 0025. |
| `commissions.price_ratio` (nueva, 0–1) | El factor aplicado, para auditoría. null en mensual y en las filas viejas. |
| `record_sale_proporcional(…9 parámetros de record_sale…, p_price_ratio numeric)` (nueva) | La cuenta de 0025 con el factor. null o fuera de rango cuenta como 1. **Anual (primer pago):** `least(tope − generado, round(tope × factor))`. **Renovación** (solo si `renewal_pct > 0`): `base × % × factor`. **Mensual: sin cambios.** |
| `record_sale` (firma de 0025) | Envoltorio de la nueva con factor 1. Da exactamente el mismo resultado que hoy. |
| `apply_store_event(jsonb)` (misma firma) | Es una copia íntegra de 0027; **ninguna migración posterior la redefine** (0033 y 0036 solo la llaman). Tiene dos cambios mínimos, marcados `NNNN (a)` y `NNNN (b)`. El (b) solo da un factor menor que 1 en una **oferta** pagada en EUR (ver D2/D3). |
| Permisos | Los mismos de 0025 y 0027: `revoke` a public, anon y authenticated, y `grant execute` a `service_role`. |
| Huella | Comentario `nivl:comision-proporcional` en `record_sale_proporcional` y en `apply_store_event`. Expresión sugerida, en la cabecera del SQL: `obj_description(…) like '%nivl:comision-proporcional%'` sobre las dos funciones. |

**Sin cambios:** `record_refund`, `net_cents_eur`, `apply_store_reconciliation` (0033/0036), `creator_panel`, `creator_board` y 0046.

### Mensual: ya era proporcional (verificado)

En 0025 (l.248), el mensual paga `least(round(neto × pct), tope − generado)`, y el neto sale de lo cobrado. Por eso un mes al 50 % ya genera la mitad. **No se le aplica el factor**, porque se contaría dos veces. La prueba lo comprueba: con descuento sale la mitad (±1 céntimo de redondeo), no un cuarto.

## Decisiones

- **D1 · Precio null: no se registra la venta** (en lugar de registrarla con neto 0 y sin comisión). Una venta con neto 0:
  - ocuparía `payment_number = 1`, así que el primer cobro real contaría como 2 y saldría del ranking y de las ventas de 0046/0025;
  - haría que `claim_referral` respondiera `ya_pagas`;
  - ocuparía una plaza de fundador en `founder_seats_left`.

  Ahora se exige `v_price > 0` y que el equivalente en EUR no sea null y sea mayor que 0. Si no se cumple, el evento queda con la nota `venta sin precio: no se registra`. **El acceso (`subscriptions`) se concede igual**, como hoy. El precio 0 sigue sin entrar en la rama, igual que en 0027.
- **D2 · Qué es una oferta y cuál es la referencia.** Es oferta si `offer_code` no es null ni vacío, o si `period_type` es `INTRO` o `PROMOTIONAL`.
  - **Sin oferta, el factor es 1 siempre**, también con precio regional o en otra moneda.
  - **Con oferta en EUR**, el factor es `least(1, price_in_purchased_currency × 100 / store_products.list_price_cents)`. El catálogo es una columna aditiva, en EUR con IVA.
  - **Con oferta en otra moneda, o sin catálogo**, el factor es 1 y el evento queda con la nota `oferta sin referencia: comisión completa`.
- **D3 · El webhook no trae el precio sin oferta del país.** Lo verifiqué el 2026-10-04 en https://www.revenuecat.com/docs/integrations/webhooks/event-types-and-fields. Los campos que existen son:
  - `period_type`: `TRIAL`, `INTRO`, `NORMAL`, `PROMOTIONAL`, `PREPAID`;
  - `offer_code`: puede ser null; App Store y Play;
  - `price`: en USD;
  - `price_in_purchased_currency`, `currency`, `country_code`, `tax_percentage`, `commission_percentage` y `renewal_number`.

  Ningún campo da el precio de lista o sin descuento. Por eso la comparación «con el mismo país» no se puede hacer con el evento, y fuera del EUR se aplica la regla de D2. Si algún día se quiere, haría falta una tabla de precios por país y producto, que también sería aditiva.
- **D4 · La renovación también se escala.** Con `renewal_pct = 0`, que es el valor actual, no cambia nada.
- **D5 · Una sola comisión por cuenta**, como ya era: el tope se suma por usuario. Un reembolso anula la fila, que ya es la proporcional. Después, el tope vuelve a quedar libre.

## Compatibilidad

- **1.0.7 / 1.0.8:** el cliente no llama a ninguna de estas funciones (solo `service_role`, desde el webhook de RevenueCat y `store-reconcile`). El webhook sigue llamando a `apply_store_event(jsonb)`.
- **Datos existentes:** no se recalcula ninguna comisión. Las filas viejas quedan con `price_ratio` null.
- **Espejo TS actualizado:**
  - `factorOferta()` aplica la misma regla de D2 y la misma nota.
  - `comisionCents({…, factorPrecio})` lleva el factor en el anual y en la renovación, y no en el mensual. El parámetro es opcional y vale 1 por defecto, así que las llamadas existentes no cambian.
- **No se toca la 0033** (`trial → cortesia`, verificación V1 de FASE3-OFERTAS).

## Prueba (PGlite en memoria; 0025 y 0027 reales y la propuesta aplicada dos veces)

`node scripts/test-comision-proporcional.mjs C:/temp/AGROLAFORGA/node_modules/@electric-sql/pglite/dist/index.js`

Resultado: `{"ok":true,"checks":50,"database":"PGlite in memory","productionTouched":false}`

Casos (SBP activo, creador Élite al 50 %, tope de 50 €):

1. **Precio null** con `offer_code`: sin venta ni comisión, con la nota correcta y el acceso concedido. USD con `price_in_purchased_currency` null: tampoco hay venta. El RENEWAL real posterior es `payment_number 1` y paga 50 €.
2. **Precio 0:** sin venta.
3. **Anual a precio completo:** 50 € (factor 1,0000).
4. **Ofertas en EUR al 50 %:**
   - Élite 149,50 € con `offer_code`: 25 €;
   - Pro 49,995 € con INTRO: 25 €;
   - PROMOTIONAL: 25 €.
   - **Sin oferta, 149,50 € paga 50 €.** Una oferta por encima del catálogo paga 50 €, no más.
5. **Mensual completo y con descuento (INTRO):** el % del neto. Con descuento sale la mitad, no un cuarto. 15 meses se quedan en el tope de 50 €.
6. **Renovación:** sin comisión con `renewal_pct = 0`. Con 10 % y una oferta al 50 %: 5 €.
7. **Reembolso** de un anual con oferta: se anulan los 25 € y se cancela el acceso. Una compra completa posterior vuelve a pagar 50 €.
8. **Sandbox** (Apple y Google): nunca hay venta, aunque sí acceso.
9. **Idempotencia:** el mismo id de evento devuelve `duplicate`; el mismo `transaction_id` con otro id no duplica.
10. `record_sale` con la firma de 0025: mismo resultado (factor 1).
11. **USD sin oferta:** comisión completa y sin nota. **Oferta en USD:** comisión completa y nota `oferta sin referencia: comisión completa`.
12. **Oferta en EUR** sobre un producto con `list_price_cents` null: comisión completa y la misma nota.
13. **Permisos:** anon y authenticated reciben `permission denied` en las tres funciones; `service_role` tiene EXECUTE.

Además: re-ejecutar no duplica la columna ni pisa un `list_price_cents` editado a mano, y la huella responde `true`.

## Espejo TS

- `npm run typecheck`: sin errores.
- `CI=true npx jest --ci --runInBand src/lib/__tests__/creatormath.test.ts`: **39/39**, de ellas 8 nuevas en «oferta rebajada: comisión proporcional».
- `CI=true npx eslint src/lib/creatormath.ts src/lib/__tests__/creatormath.test.ts scripts/test-comision-proporcional.mjs`: salida 0.
