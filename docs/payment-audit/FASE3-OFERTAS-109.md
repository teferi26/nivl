# Fase 3 · Ofertas promocionales y códigos para la 1.0.9 (plan)

Chat 2 · Compras, subagente B. Fecha: 2026-10-04. **Solo es un plan.** No se ha tocado ASC, Play Console, RevenueCat ni Supabase. El SQL de este documento es una propuesta aditiva y **no tiene número**: el número lo asigna el coordinador. La configuración en las tiendas la hace el usuario.

Parte de la decisión **D3** (`FASE2-PLAN.md`): el servidor **no** concede días de Pro (zona de riesgo de 3.1.1). En la 1.0.8, las recompensas por invitar son cosméticas (insignias de 0045). La 1.0.9 añade **solo vías de tienda**.

## 1. Reglas oficiales (consultadas el 2026-10-04)

### Apple

| Regla | Detalle | Fuente |
|---|---|---|
| Offer Codes · tipos | **Códigos de un solo uso**: únicos, se generan en lotes de **500 a 25.000**, caducan como máximo a los **6 meses** y se entregan en un CSV. **Códigos personalizados** (por ejemplo «SPRINGPROMO»): hasta **25.000 canjes por lote**, caducidad opcional, un uso por cliente y oferta. | [Set up offer codes](https://developer.apple.com/help/app-store-connect/manage-subscriptions/set-up-subscription-offer-codes) |
| Offer Codes · límites | **1 millón de códigos por app y trimestre**. **Máximo 10 ofertas activas por SKU**. Un código tarda hasta 1 h en poder canjearse. Un código personalizado no puede repetirse en otra oferta. Una oferta desactivada no se puede reactivar. | ídem |
| Offer Codes · elegibilidad y tipo | Clientes nuevos, actuales o caducados (uno o varios grupos). Tipos: gratis, pago por periodo o pago por adelantado. Se puede elegir si después se aplica la oferta introductoria. | ídem |
| Offer Codes · canje | URL de canje, flujo de canje de la App Store o dentro de la app (iOS 14+). En sandbox: códigos de un solo uso, de 10 a 10.000, con iOS 16.3+. | ídem |
| Promotional Offers | Para suscriptores **actuales o antiguos**. **10 activas por suscripción**. Gratis, pago por periodo o por adelantado. Valen en todos los países. Requieren la **clave de compras integradas (.p8)**. La duración y el tipo no se pueden editar. | [Promotional offers](https://developer.apple.com/help/app-store-connect/manage-subscriptions/set-up-promotional-offers-for-auto-renewable-subscriptions) |
| Firma | La firma se genera **en el servidor**, con la clave .p8. Cubre el bundle, el id de clave, el producto, la oferta, el `appAccountToken`, un nonce y una marca de tiempo **válida 24 h**. **El desarrollador decide quién es elegible.** | [Generating a signature for promotional offers](https://developer.apple.com/documentation/storekit/generating-a-signature-for-promotional-offers) |
| Win-back | Por producto. Elegibilidad: tiempo pagado (1–24 meses o 3–5 años), tiempo desde la baja (mín. 1, máx. 24 meses) y espera opcional entre ofertas (2–24 meses). **5 activas por país y suscripción**, 350 en total. Aparecen solas en «Gestionar suscripción» (iOS 14.3+) y en la hoja dentro de la app (**iOS 18+**). Promoción opcional en la App Store. Empiezan como pronto mañana y duran al menos 3 días. | [Win-back offers](https://developer.apple.com/help/app-store-connect/manage-subscriptions/set-up-win-back-offers) |
| Prórroga de renovación | Máximo 2 por cliente y año y 90 días por petición. Apple la pone como ejemplo para caídas del servicio o atención al cliente. **RevenueCat no sabe si encaja como promoción.** | [RC · Promotional subscription extensions](https://www.revenuecat.com/docs/guides/promotional-subscription-extensions) |
| 3.1.1 | Desbloquear funciones exige compra integrada. **No vale un mecanismo propio** (claves de licencia, QR…). | [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/) |
| 3.1.2(c) | Antes de suscribir hay que **describir con claridad qué recibe el usuario por el precio**. | ídem |

### Google Play

| Regla | Detalle | Fuente |
|---|---|---|
| Promo codes de suscripción | Solo **prueba gratis de 3 a 90 días**, sobre el base plan compatible con versiones anteriores (sustituye a otra prueba u oferta). **De un solo uso**: 10.000 por trimestre y producto; clientes nuevos, actuales o antiguos; se canjean en Play o en la app. **Personalizados**: de 2.000 a 99.999 canjes, **solo clientes nuevos y solo canje en la app**, alfanuméricos y sin distinguir mayúsculas. Caducan al final del trimestre y la cantidad no se puede cambiar. | [Play Console · promo codes](https://support.google.com/googleplay/android-developer/answer/6321495) |
| Elegibilidad de ofertas | *Captación de clientes nuevos*, *Mejora* y **Determinada por el desarrollador**: en esta Google no comprueba nada y la lógica es nuestra. Una oferta que se pueda comprar fuera de la app **no puede** ser determinada por el desarrollador. Máximo 250 base plans y ofertas por suscripción, 50 activas a la vez. La recuperación (winback) es el ejemplo típico de oferta determinada por el desarrollador. | [Play Console · ofertas](https://support.google.com/googleplay/android-developer/answer/12154973) |
| Aplazar la renovación | `defer` (vía RevenueCat, con clave secreta): hasta 365 días por petición y sin tope anual. | [RC · extensions](https://www.revenuecat.com/docs/guides/promotional-subscription-extensions) |

### RevenueCat (SDK instalado: `react-native-purchases` 10.10.2)

| Regla | Detalle | Fuente |
|---|---|---|
| Offer code | `Purchases.presentCodeRedemptionSheet()` (solo iOS). RC avisa de que la hoja de canje de Apple **es muy inestable** y propone enviar a `https://apps.apple.com/redeem?ctx=offercodes&id={apple_app_id}&code={code}`. Para registrar bien los ingresos de los offer codes hay que **subir la clave de compras integradas**. | [RC · iOS subscription offers](https://www.revenuecat.com/docs/subscription-guidance/subscription-offers/ios-subscription-offers) |
| Promotional Offer (RN) | `getPromotionalOffer(product, discount)` → `purchaseDiscountedPackage(pkg, promo)` o `purchaseDiscountedProduct`. RC **genera la firma** con la .p8 subida a su panel. | ídem + `node_modules/react-native-purchases/dist/purchases.d.ts` l.418, 460, 624 |
| Win-back (RN) | `getEligibleWinBackOffersForPackage(pkg)` → `purchasePackageWithWinBackOffer(pkg, offer)`. Solo iOS 18+ con StoreKit 2, que es el valor por defecto del SDK. La hoja automática es `IN_APP_MESSAGE_TYPE.WIN_BACK_OFFER`. Se puede desactivar con `shouldShowInAppMessagesAutomatically: false` y abrir con `showInAppMessages([...])`. Para los canjes hechos desde la App Store hay que activar las App Store Server Notifications. | ídem + `purchases.d.ts` l.634-670, 1016; `enums.d.ts` |
| Ofertas de Play | Las de *Captación* y *Mejora* solo aparecen en `subscriptionOptions` si el usuario es elegible. Las **determinadas por el desarrollador aparecen siempre**: hay que etiquetarlas **`rc-ignore-offer`** para que el SDK no las aplique solo, y comprarlas con `purchaseSubscriptionOption()`. Un promo code de Play aparece en RC «como si empezara una prueba». Canjeado en la tienda, llega con datos reducidos, a veces sin `orderId`. | [RC · Google Play offers](https://www.revenuecat.com/docs/subscription-guidance/subscription-offers/google-play-offers) |
| Webhook | `period_type` ∈ TRIAL, INTRO, NORMAL, PROMOTIONAL, PREPAID. `offer_code` («código de oferta o promoción usado», App Store y Play, puede ser null). `price` y `price_in_purchased_currency`: **0 en pruebas, null si se desconoce**, negativo en reembolsos. | [RC · event types](https://www.revenuecat.com/docs/integrations/webhooks/event-types-and-fields) |
| Comportamiento observado | PROMOTIONAL corresponde a lo concedido **por RevenueCat**, no por la tienda. No hay otra marca para las ofertas aparte de `period_type`. Un promo code gratuito de Play llegó como **`NORMAL`, precio 0, `offer_code` null**. Un ejemplo de Apple trae `offer_code: "free_month"` con `period_type: "NORMAL"`. | [Foro RC 4207](https://community.revenuecat.com/general-questions-7/identify-promotional-offer-in-webhook-4207) · [Foro RC 5926](https://community.revenuecat.com/general-questions-7/how-to-detect-free-days-trial-for-subscription-in-android-promo-offer-5926) · [RC · sample events](https://www.revenuecat.com/docs/integrations/webhooks/sample-events) |

## 2. Qué pasa hoy en el servidor con una oferta (0027 / 0033 / record_sale)

| Caso | 0027 `apply_store_event` (ventas) | 0033 (acceso) | Riesgo |
|---|---|---|---|
| Periodo **gratis** con precio 0 (offer code, promo code, oferta promocional o win-back gratis) | `coalesce(v_price,1) > 0` es falso, así que **no hay venta ni comisión**. | Concede según el `period_type` del snapshot. | Correcto. |
| Periodo gratis con **precio null** | `coalesce(null,1)=1 > 0`, así que **se llama a `record_sale` con 0 € y neto 0**. En un **anual**, la comisión es `v_cap − v_accrued`: **la comisión entera (25–50 €) sale de un periodo gratis**. | — | **P1.** Se arregla en el §4.3. |
| Primer cobro real tras el periodo gratis (RENEWAL, precio > 0) | `payment_number = 1`, porque el periodo gratis no dejó venta, así que cuenta como **primer pago**: comisión de primer pago y cuenta para el rango (0046, `payment_number = 1`). | — | Es correcto: es el primer dinero real. |
| Oferta **de pago con descuento** (por ejemplo, anual al 50 %) | Hay venta. En **mensual**, la comisión es el % del neto (proporcional). En **anual**, la comisión es el **tope entero** aunque se cobre la mitad. | — | **P1 económico.** Pro anual al 50 % con tienda al 15 %: unos 35 € limpios frente a 50 € de comisión de un Élite. Hay que decidir (§4.3). |
| `period_type` = `trial` en el snapshot | — | `0033:151-152`: `status='trialing'` y **`plan='cortesia'`**, con un presupuesto de IA de **0,50 $**. | **P1.** Si Apple o Play reportan como `trial` un mes gratis de offer code, de promo code o de oferta promocional, quien canjea «1 mes de NIVL Pro» recibe el presupuesto de la prueba. Peor aún: un suscriptor **actual** que canjea una oferta promocional bajaría a cortesía durante ese mes. Está **NO VERIFICADO**: es la verificación V1 (§7), y bloquea los textos. |
| `offer_code` | Se ignora en la lógica, pero queda guardado en `store_events.payload`. | No se usa. | Sirve para la auditoría sin migración. |

## 3. Diseño

### (a) Código de oferta para el invitado (referido)

- **Producto y oferta:**
  - Apple: Offer Code de **un solo uso** sobre `nivl_pro_mensual`, tipo **gratis 1 mes**, elegibilidad **clientes nuevos**, sin la oferta introductoria después. Lote de 500, que es el mínimo, renovado cada menos de 6 meses.
  - Google: **promo code de un solo uso** de **30 días** sobre `nivl_pro_mensual` (máx. 10.000 por trimestre).
  - Se descartan los códigos personalizados: un código compartido se filtra y deja de estar ligado a la invitación.
  - Se descarta también una oferta de Play determinada por el desarrollador: Google no comprueba nada y un cliente modificado la compraría.
- **Cuándo se asigna:** cuando la invitación de 0045 está **activa**, con el mismo criterio que `settle_my_invites`: al menos 7 días desde la invitación y 3 días con progreso dentro de 21. No basta con el `claim_invite`, porque así se evita el cultivo de cuentas falsas. Además:
  - el invitado no tiene ninguna suscripción de tienda viva;
  - no hay borrado pendiente.
  - La prueba de servidor de 7 días sigue igual. El código llega después, como segundo paso.
- **Seguridad** (requisitos del Chat 3):
  1. **Tabla cerrada** `store_offer_codes`: RLS activa, sin políticas y con `revoke all` para `anon`/`authenticated`. Solo la leen y escriben funciones `security definer`.
  2. **Asignación atómica:** `select … for update skip locked limit 1`, más un candado consultivo por usuario y un `unique (assigned_to, purpose)`. Resultado: **un código por recompensa** e idempotencia (volver a llamar devuelve el mismo código).
  3. **Registro:** `store_offer_code_log`, con asignación, entrega, agotamiento y canje visto.
  4. **El cliente solo ve el suyo:** la RPC `my_invite_offer(p_store)` devuelve el código y la URL de canje solo de `auth.uid()`. Con borrado de cuenta, `on delete set null`: el código queda consumido y no se reutiliza.
  5. **Nunca en el repo:**
     - el CSV de ASC y la lista de Play se descargan fuera del worktree;
     - un script con la clave `service_role`, ejecutado en local, los carga y borra el archivo;
     - nada de códigos en registros, Sentry, analítica ni AsyncStorage;
     - el `.gitignore` del coordinador cubre `*.codes.csv`.
  6. El `store` lo elige el cliente según su plataforma. No supone un riesgo: el tope sigue siendo de un código por usuario, sea cual sea la tienda.
- **Entrega en la app:**
  - iOS: botón «Canjear en la App Store», que abre `https://apps.apple.com/redeem?ctx=offercodes&id=<id>&code=<código>` (vía recomendada por RC). La alternativa es `presentCodeRedemptionSheet()` con el código copiable.
  - Android: abre `https://play.google.com/redeem?code=<código>`.
  - El código **no se muestra en grande** ni se puede compartir. Aparece solo en «Copiar».
- **Canje visto:** cuando llega un webhook del usuario con `offer_code` igual a nuestra referencia de oferta (Apple) o con un periodo gratis en `nivl_pro_mensual` (Google), se marca `redeemed_seen_at`. Es solo informativo.

### (b) Promotional Offer para quien invita y ya paga

- **Apple:**
  - Oferta promocional «1 mes gratis» (`nivl_promo_invita_1m`) en `nivl_pro_mensual` y `nivl_elite_mensual`.
  - En los anuales, una equivalente si se quiere. La duración gratuita disponible depende del periodo; se comprueba en ASC.
  - Elegible: quien invita, tiene una suscripción **Apple** activa y ha subido de nivel de reclutador (1, 3 o 10 invitaciones activas, 0045). Máximo una por nivel y **dos al año**.
- **Problema de firma:** con RevenueCat, **RC firma para cualquier usuario** que pida la oferta desde la app. La elegibilidad que exige Apple («la decide el desarrollador») solo la aplicaría nuestra interfaz, y un cliente modificado podría canjearla sin haberla ganado.
  - **Opción A (recomendada para la 1.0.9):** aceptar el riesgo residual. El coste es un mes de IA (como máximo 1,44 € en Pro y 4 € en Élite) para alguien que ya paga. Se mitiga con el registro (`promo_offer_grants`) y una alerta: un webhook con oferta promocional sin concesión registrada.
  - **Opción B:** firmar en nuestra Edge Function con la .p8, solo si es elegible y una única vez, y construir `PurchasesPromotionalOffer` (`identifier`, `keyIdentifier`, `nonce`, `signature`, `timestamp`). Que el puente RN acepte un objeto que no viene de `getPromotionalOffer` está **NO VERIFICADO**, y la .p8 pasaría a nuestro servidor (otro secreto que rotar). Se queda para la 1.0.10 si la alerta de la A salta.
- **Google:** no hay oferta promocional para una suscripción en curso. Opción: **`defer` de 30 días** vía la API de RC con la clave secreta, una herramienta de la tienda que llega con el evento `SUBSCRIPTION_EXTENDED`. Hay que confirmarlo con el Chat 1 frente a la política de Play. En Apple **no** se usa la prórroga: Apple la presenta para caídas y atención al cliente, y RC duda de que encaje como promoción.
- **Cliente:** la compra del **mismo plan** está bloqueada hoy (`pro.ts`, «mismo plan»). La oferta promocional necesita un camino aparte, `canjearOfertaPromocional()`, que solo se abre si el servidor dice que es elegible. Apple aplica la oferta en la próxima renovación del mismo producto: el texto tiene que decirlo.

### (c) Win-back (recuperación)

- **Apple:**
  - Oferta de recuperación en `nivl_pro_mensual` y `nivl_pro_anual`: «primer mes a mitad de precio» o «1 mes gratis».
  - Elegibilidad: al menos 2 meses pagados, entre 1 y 6 meses desde la baja y 12 meses de espera entre ofertas.
  - Prioridad normal y sin promoción en la App Store al principio.
  - La propia Apple la enseña en «Gestionar suscripción» (sin código).
  - Dentro de la app: desactivar la hoja automática (`shouldShowInAppMessagesAutomatically: false`) para que **no tape una celebración** (regla D1). Se llama a `showInAppMessages([WIN_BACK_OFFER, BILLING_ISSUE, PRICE_INCREASE_CONSENT])` en un momento tranquilo, por ejemplo al abrir `/pro`.
  - En `/pro`, si `getEligibleWinBackOffersForPackage` devuelve una oferta, la fila la muestra (§5) y se compra con `purchasePackageWithWinBackOffer`. Solo en iOS 18+; en otras versiones no aparece.
- **Google:**
  - Oferta **determinada por el desarrollador** con la etiqueta `rc-ignore-offer` (más `winback`) en el base plan mensual.
  - Elegible según nuestro servidor: una suscripción `google` pagada, ya `canceled` y sin otra viva, mediante la RPC `my_winback_eligibility()`.
  - Se compra con `purchaseSubscriptionOption`.
  - Riesgo: Google no comprueba la elegibilidad. El coste es un descuento para quien manipule el cliente; se acepta y se registra.
- **Ventas:** un win-back de pago genera una venta nueva con un `original_transaction_id` nuevo. Pasa a ser **un primer pago** para comisiones si el usuario sigue en `referrals`. Decisión del usuario: ¿un usuario recuperado vuelve a generar comisión? La propuesta es que **no** (§4.3, «una vez por usuario», que ya es así: `v_accrued` se suma por usuario y no por transacción). **Hoy el tope ya impide la doble comisión** en anual y mensual. Bien.

### (d) Códigos de creador

- **¿Sirven los Offer Codes personalizados por creador?** Técnicamente sí. El límite de **10 ofertas activas por SKU** cuenta **ofertas**, no códigos: varios códigos personalizados («RUBEN», «LAURA»…) caben en una misma oferta «Creador · 1 mes gratis», con hasta 25.000 canjes por lote ([Apple](https://developer.apple.com/help/app-store-connect/manage-subscriptions/set-up-subscription-offer-codes)). Es una lectura de la ayuda: hay que confirmar en ASC que una oferta admite varios códigos personalizados.
  - **Pros:** el creador puede decir «usa mi código RUBEN y tienes un mes gratis».
  - **Contras:**
    - Solo clientes nuevos.
    - Apple **no garantiza** que `offer_code` traiga el nombre del código personalizado: puede traer la referencia de la oferta. Por eso la **atribución sigue saliendo de `referrals`** (`nivl.app/c/CODIGO` → `claim_referral`), no del offer code.
    - En Play, los personalizados son solo para clientes nuevos, se canjean solo en la app, permiten 2.000–99.999 canjes y dan una prueba de 3–90 días.
    - Mantener un código por creador en dos tiendas es trabajo manual del usuario.
- **Recomendación:**
  - En la 1.0.9, **una sola oferta de creador**, sin código propio por creador. Al llegar por el enlace del creador, la app ofrece el canje con un código de un solo uso de un lote «creador», con la misma tabla del §4.1 y `purpose='creador'`.
  - Los códigos personalizados con nombre, solo para los creadores Élite y como piloto.
  - **Nunca** una oferta con descuento de pago en anual hasta que se resuelva el §4.3.

### (e) Impacto en ventas y comisiones (`record_sale`)

- **Un periodo gratis no es un primer pago** si llega con precio 0. El primer cobro real sí lo es (`payment_number = 1`). La comisión se calcula entonces y sigue la retención de 30 días. **Esto ya cumple la regla 2 de `PRECIOS.md`.**
- Hay que blindar el caso **precio null** con `offer_code` o con `period_type` en (`TRIAL`, `INTRO`): no se crea venta hasta que haya un precio mayor que 0 (§4.3).
- **Ofertas de pago con descuento en anual:** la comisión tiene que ser proporcional (`least(tope, neto × pct)`), no el tope entero. Si no, el Pro anual con oferta pierde dinero. Es una **decisión del usuario**, porque cambia la regla «base siempre 100 €»; mientras no decida, **no se crean ofertas de pago con descuento en anuales**.
- Ranking de creadores (0046): solo cuentan las ventas con `payment_number = 1` y comisión viva. Un canje gratis sin cobro posterior **no cuenta**. Es correcto.

## 4. Servidor · SQL propuesto (aditivo, sin número)

### 4.1 Tablas cerradas y asignación del código del invitado

```sql
-- NIVL · NNNN — Códigos de oferta de tienda (invitado / creador). Aditivo.
begin;

create table if not exists public.store_offer_codes (
  id bigint generated always as identity primary key,
  store text not null check (store in ('apple', 'google')),
  purpose text not null check (purpose in ('invitado', 'creador')),
  offer_ref text not null,                -- referencia de la oferta en ASC/Play (no es secreta)
  code text not null,                     -- SECRETO: solo lo ve su asignatario
  batch text not null,
  expires_at timestamptz not null,
  assigned_to uuid references auth.users (id) on delete set null,
  assigned_at timestamptz,
  redeemed_seen_at timestamptz,
  revoked_at timestamptz,
  unique (store, code)
);
create index if not exists store_offer_codes_free_idx
  on public.store_offer_codes (store, purpose, expires_at)
  where assigned_at is null and revoked_at is null;
create unique index if not exists store_offer_codes_one_per_user
  on public.store_offer_codes (assigned_to, purpose) where assigned_to is not null;

create table if not exists public.store_offer_code_log (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users (id) on delete set null,
  code_id bigint references public.store_offer_codes (id),
  action text not null check (action in ('asignado', 'entregado', 'sin_stock', 'no_elegible', 'canje_visto')),
  store text,
  created_at timestamptz not null default now()
);

alter table public.store_offer_codes enable row level security;
alter table public.store_offer_code_log enable row level security;
revoke all on public.store_offer_codes from public, anon, authenticated;
revoke all on public.store_offer_code_log from public, anon, authenticated;

create or replace function public.my_invite_offer(p_store text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_inv public.invites;
  v_row public.store_offer_codes;
begin
  if v_uid is null then return jsonb_build_object('ok', false, 'reason', 'sin_sesion'); end if;
  if p_store not in ('apple', 'google') then return jsonb_build_object('ok', false, 'reason', 'tienda'); end if;
  if public.invite_erasure_pending(v_uid) then return jsonb_build_object('ok', false, 'reason', 'borrado_pendiente'); end if;

  perform pg_advisory_xact_lock(hashtext('nivl_offer_code'), hashtext(v_uid::text));

  -- Idempotente: si ya tiene uno, el mismo (aunque cambie de plataforma: uno por recompensa).
  select * into v_row from public.store_offer_codes
   where assigned_to = v_uid and purpose = 'invitado';
  if v_row.id is not null then
    insert into public.store_offer_code_log (user_id, code_id, action, store) values (v_uid, v_row.id, 'entregado', v_row.store);
    return jsonb_build_object('ok', true, 'store', v_row.store, 'code', v_row.code, 'expires_at', v_row.expires_at);
  end if;

  -- Mismo criterio de activación que settle_my_invites (0045).
  select * into v_inv from public.invites where invitee = v_uid;
  if v_inv.invitee is null
     or v_inv.status in ('anulada', 'caducada')
     or now() < v_inv.created_at + interval '7 days'
     or public.invite_progress_days(v_uid, v_inv.created_at, least(now(), v_inv.created_at + interval '21 days')) < 3
     or exists (select 1 from public.subscriptions s
                where s.user_id = v_uid and s.provider in ('apple', 'google')
                  and s.status in ('active', 'trialing')
                  and (s.current_period_end is null or s.current_period_end > now())) then
    insert into public.store_offer_code_log (user_id, action, store) values (v_uid, 'no_elegible', p_store);
    return jsonb_build_object('ok', false, 'reason', 'no_elegible');
  end if;

  select * into v_row from public.store_offer_codes
   where store = p_store and purpose = 'invitado'
     and assigned_at is null and revoked_at is null
     and expires_at > now() + interval '7 days'
   order by expires_at, id
   limit 1
   for update skip locked;
  if v_row.id is null then
    insert into public.store_offer_code_log (user_id, action, store) values (v_uid, 'sin_stock', p_store);
    return jsonb_build_object('ok', false, 'reason', 'sin_stock');
  end if;

  update public.store_offer_codes set assigned_to = v_uid, assigned_at = now() where id = v_row.id;
  insert into public.store_offer_code_log (user_id, code_id, action, store) values (v_uid, v_row.id, 'asignado', p_store);
  return jsonb_build_object('ok', true, 'store', v_row.store, 'code', v_row.code, 'expires_at', v_row.expires_at);
end $$;

revoke all on function public.my_invite_offer(text) from public, anon;
grant execute on function public.my_invite_offer(text) to authenticated;
-- + guardia require_account_active (0031) en store_offer_codes(assigned_to), como hace 0045.
commit;
```

- Carga: `scripts/cargar-codigos-oferta.mjs`, nuevo y con `service_role`. Lee un CSV local (ruta por argumento, fuera del repo), inserta con `on conflict (store, code) do nothing`, imprime **solo recuentos** y borra el archivo después de confirmar.
- Alerta de stock: un aviso por correo o en el panel cuando queden menos de 50 códigos libres o el lote caduque en menos de 30 días.
- Exportación RGPD (0040/0044/0060, Chat 3): incluir el código asignado del propio usuario y sus filas de registro.

### 4.2 Concesiones de oferta promocional y elegibilidad

```sql
create table if not exists public.promo_offer_grants (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  store text not null check (store in ('apple', 'google')),
  reason text not null check (reason in ('reclutador', 'lanista', 'senor_del_ludus', 'winback')),
  offer_ref text not null,
  granted_at timestamptz not null default now(),
  redeemed_seen_at timestamptz,
  unique (user_id, reason)
);
-- RLS sin políticas + revoke, igual que arriba.
-- RPC my_promo_offer(): elegible si hay fila en invite_rewards de ese nivel, una
-- suscripción apple activa y menos de 2 concesiones en 365 días. Devuelve
-- {ok, offer_ref}; el cliente pide la firma a RC con ese identificador.
```

### 4.3 Blindaje de ventas (cambio de `apply_store_event` de 0027, misma firma)

- Antes de llamar a `record_sale`, añadir a la condición:
  `and (v_price is not null or ((p_event->>'offer_code') is null and coalesce(p_event->>'period_type', 'NORMAL') <> 'INTRO'))`
  El TRIAL ya está excluido por `not v_trial`. Un INTRO **de pago con precio conocido** sigue creando venta, como hoy. Solo se bloquea la venta sin precio cuando hay oferta (`offer_code` o INTRO).
- Columnas aditivas `store_sales.offer_code text` y `store_sales.period_type text`. Se rellenan con un `update` justo después de `record_sale`.
- Ajuste opcional, pendiente de decisión del usuario:
  `update commissions set amount_cents = least(amount_cents, round(net_cents * pct / 100)) where sale_id = v_sale and kind = 'primer_pago'`
  cuando la venta lleve una oferta (`offer_code` no null o `period_type = 'INTRO'`).
- 0033: si V1 confirma que un mes gratis de oferta llega como `trial`, hay que decidir el plan que se da. Opción mínima en `store-reconcile.ts`: conservar `trial → cortesia` solo cuando el producto **nunca** se pagó (sin `store_sales` para ese `original_transaction_id`), y si no, el plan del producto. Así un suscriptor actual que canjea una oferta promocional no baja a cortesía.
- Las pruebas, en PGlite con 0027 + 0033, siguiendo el patrón de `scripts/test-store-reconciliation.mjs`:
  - gratis con precio 0, sin venta;
  - gratis con precio null y `offer_code`, sin venta;
  - RENEWAL posterior, con `payment_number = 1`;
  - anual con descuento y comisión proporcional (si se aprueba).

## 5. Cliente (1.0.9; todo JS, con las funciones ya presentes en el nativo 10.10.2)

- `src/lib/ofertas.ts` (nuevo, módulo puro):
  - `textoOferta(discount | winback, priceString, plataforma)`;
  - `urlCanjeApple(appId, code)` y `urlCanjePlay(code)`;
  - ningún código en `console` ni en analítica.
- `pro.ts`:
  - `canjearCodigoInvitado()`: llama a la RPC `my_invite_offer` y abre la URL de canje;
  - `canjearOfertaPromocional(pkg, offerRef)`: `product.discounts` → `getPromotionalOffer` → `purchaseDiscountedPackage`, saltándose el bloqueo de «mismo plan» solo en esta vía;
  - `ofertaRecuperacion(pkg)`: `getEligibleWinBackOffersForPackage` y `purchasePackageWithWinBackOffer`;
  - Android: `purchaseSubscriptionOption` para la opción con etiqueta `winback`;
  - después de cada canje: `store-reconcile {}` y espera a `ai_status`, como en una compra.
- `Purchases.configure({ …, shouldShowInAppMessagesAutomatically: false })` y `showInAppMessages(...)` al abrir `/pro`.
- UI (Chat 4):
  - tarjeta en Amigos/invitar: «Tu invitación ya cuenta: tienes 1 mes de NIVL Pro para canjear en la tienda»;
  - fila de oferta en `/pro`;
  - nunca encima de una celebración, siempre con la «X» visible y sin cuenta atrás falsa.
- Tests:
  - el código no aparece en el registro;
  - el texto de la oferta siempre lleva el precio posterior y «renovación automática»;
  - sin oferta elegible, no se pinta nada.

## 6. Configuración en las tiendas (la hace el usuario; aquí no se toca nada)

1. **ASC → Usuarios y acceso → Integraciones → Compras integradas:** generar la **clave de compras integradas (.p8)**. Se descarga **una sola vez**: guardarla en el gestor de secretos, nunca en el repo.
2. **RevenueCat → app iOS → In-app purchase key:** subir la .p8, el Key ID y el Issuer ID. Es necesaria para firmar ofertas promocionales y para que cuadren los ingresos de los offer codes.
3. **ASC → Suscripciones → `nivl_pro_mensual` → Códigos de oferta:**
   - oferta «Invitado 1 mes», gratis 1 mes, clientes nuevos, sin introductoria después;
   - lote de 500 códigos de un solo uso, que caducan en 6 meses;
   - descargar el CSV y entregarlo al coordinador para la carga.
   - Para probar: códigos de sandbox.
4. **ASC → Suscripciones → mensuales → Ofertas promocionales:** identificador `nivl_promo_invita_1m`, gratis 1 mes.
5. **ASC → Win-back:** las ofertas del §3(c) (fecha de inicio como pronto mañana).
6. **App Store Server Notifications V2** hacia RevenueCat: necesarias para los win-back canjeados fuera de la app. Comprobar que ya están activas.
7. **Play Console:**
   - promo codes de un solo uso de 30 días para `nivl_pro_mensual`;
   - oferta `winback` determinada por el desarrollador con las etiquetas `rc-ignore-offer` y `winback`;
   - **ninguna** oferta determinada por el desarrollador puede quedar a la venta fuera de la app.
8. Nada de esto requiere tocar los productos mientras la 1.0.8 esté en revisión. Las ofertas se crean **después** de que se apruebe.

## 7. Textos 3.1.2 (borrador para el Chat 4; los importes salen de la tienda)

- **Invitado:**
  > Tu invitación incluye 1 mes gratis de NIVL Pro mensual. Después, {priceString}/mes con renovación automática, salvo que la canceles al menos 24 horas antes de que acabe el mes gratis. Solo para cuentas de la tienda que no hayan estado suscritas a NIVL. Se canjea en {la App Store | Google Play}.

  StoreKit no da los detalles de un offer code: el «1 mes» sale del servidor (`offer_ref` → descripción) y el precio sale de `priceString`.
- **Quien invita** (oferta promocional; datos de `discount.period`/`priceString`):
  > Por tus invitaciones: tu próxima renovación de {título} es gratis ({1 mes}). Después sigue a {priceString} {cada mes}. No cambia nada más y puedes cancelar cuando quieras.
- **Win-back:**
  > Vuelve a {título}: {el primer mes a {priceDescuento} | 1 mes gratis}, y después {priceString} {cada mes}, con renovación automática. {textoGestionTienda}
- **Reglas:**
  - el importe que se cobra después tiene que ser tan visible como el «gratis»;
  - no se nombra la otra tienda (2.3.10);
  - nada de «últimas horas» si no es verdad;
  - Términos, Privacidad, EULA y Restaurar siguen en el pie.

## 8. Riesgos

| Riesgo | Mitigación |
|---|---|
| **V1:** un mes gratis llega como `trial` y da cortesía (o rebaja a un suscriptor) | Verificar en sandbox antes de escribir los textos; cambio en 0033/TS del §4.3. |
| Precio null con oferta, y comisión anual entera | Blindaje del §4.3 **antes** de crear ninguna oferta en ASC o Play. |
| Oferta anual de pago con descuento, y comisión mayor que el neto | No crearla hasta que se decida lo proporcional. |
| Firma de RC sin control de elegibilidad (oferta promocional) | Registro + alerta; opción B (firma propia) si hay abuso. |
| Ofertas de Play determinadas por el desarrollador sin control de Google | Solo descuentos pequeños; registro; `rc-ignore-offer`. |
| Fuga de códigos | Un solo uso, tabla cerrada, sin registros; el código asignado a un usuario no sirve a otro con una Apple ID ya suscrita (Apple: «clientes nuevos»). |
| Hoja de canje de Apple inestable | URL de canje como vía principal. |
| Lotes que caducan (Apple 6 meses; Play, al final del trimestre) | Alerta de stock y caducidad; recarga periódica. |
| Cultivo de cuentas para conseguir códigos | Activación de 0045 (7 días + 3 días con progreso) y topes por quien invita (3/30 días, 12/año). |
| Hoja automática de win-back encima de una celebración | `shouldShowInAppMessagesAutomatically: false`. |
| `offer_code` sin el nombre del código personalizado | La atribución de creadores sigue en `referrals`. |
| Prórroga de Apple usada como promoción | No se usa. |

## 9. Orden de entrega

1. **V1 en sandbox:**
   - canjear un código de sandbox (Apple), un promo code (license tester de Play) y una oferta promocional;
   - anotar del webhook: `period_type`, `price`, `price_in_purchased_currency` y `offer_code`;
   - anotar el `period_type` del snapshot `GET /v1/subscribers` y el `plan` resultante en `subscriptions`.
2. **Servidor:** SQL §4.1 + §4.2 + §4.3 (blindaje de ventas), y el ajuste de 0033/TS según V1. Son compatibles con 1.0.7 y 1.0.8 porque los clientes viejos no llaman a las RPC nuevas. Hacen falta número y huella del coordinador y la revisión del Chat 3.
3. **Tiendas:** el usuario sigue el §6, solo después de que se apruebe la 1.0.8. Carga de códigos con el script.
4. **Cliente 1.0.9 (§5):** UI del Chat 4 y tests. Puede ir por OTA sobre el binario 1.0.8, porque las funciones nativas ya están en 10.10.2 (lo confirma `purchases.d.ts`). Aun así, **hay que probarlo en dispositivo**.
5. **QA física (Chat 5):**
   - canje del invitado en iOS y Android;
   - oferta promocional para un suscriptor actual, que se aplica en la renovación y sin bajar de plan;
   - win-back en iOS 18;
   - reembolso tras una oferta;
   - comprobar que no hay venta en el periodo gratis y que sí la hay en el primer cobro.
6. **Creadores:** primero el lote de un solo uso con `purpose='creador'`, después el piloto de códigos personalizados para Élite.

Nada de lo anterior se ha probado: **NO PROBADO** en sandbox ni en producción.
