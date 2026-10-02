# Cuentas demo Pro y Élite para App Review (concesión manual auditada)

Aceptado por el coordinador el 02/10/2026: una sola sentencia `service_role`, ejecutada por el coordinador con confirmación del usuario cerca del reenvío, y registro privado en `nivl/privado/`. Sin migración ni RPC nueva. **Este archivo no contiene emails ni contraseñas**: los valores se sustituyen al ejecutar y se apuntan solo en el registro privado.

## Por qué así

- **Comprar no necesita cuenta pagada.** App Review compra en sandbox con su propia cuenta de Apple, sin cargo. La cuenta de revisión gratuita sirve para el vídeo de compra/restaurar. Por diseño (0027/0033) el sandbox da derecho en la BD, pero no crea venta ni comisión.
- **«Credentials for each account type»**: Pro y Élite ya activos, sin pasar por StoreKit. Se usa `subscriptions.provider = 'manual'`, la misma vía que ya sostiene la demo Élite/ludus (AUDITORIA.md: 5 cuentas, `elite_anual`/manual/active hasta 2026-11-28T10:29:03.704Z).
- **La reconciliación no lo pisa**: `apply_store_reconciliation` (0033) conserva el plan cuando el snapshot no trae compra nativa y `provider` no es apple/google. **No compres con una cuenta demo manual**: una compra sandbox la convertiría en fila de tienda (provider apple) y la caducidad sandbox le quitaría el acceso. Para el flujo de compra se usa la cuenta gratis.
- `ai_state` (0024) da derecho si `status in ('active','trialing')` y `current_period_end > now() - 2 días`: la concesión caduca sola dos días después de la fecha fin.
- Planes válidos (CHECK de 0024 + `ai_plans`): `pro_mensual`, `pro_anual`, `elite_mensual`, `elite_anual` (y `elite_fundador`). Se usan `pro_anual` y `elite_anual`.
- El consentimiento de IA, edad y salud **no se fabrica**: el revisor lo acepta en la app (como en la demo Élite).

## 1. Concesión de la demo PRO

Sustituir `<EMAIL_DEMO_PRO>` (cuenta NIVL de login directo ya creada) y la fecha fin. Ejecutar en el SQL Editor de Supabase (rol postgres/service) en una transacción:

```sql
begin;
with u as (
  select id from auth.users where lower(email) = lower('<EMAIL_DEMO_PRO>')
)
insert into public.subscriptions (user_id, status, plan, provider, current_period_end,
  store_product_id, original_transaction_id, store_environment, updated_at)
select id, 'active', 'pro_anual', 'manual', timestamptz '2026-11-28 10:30:00+00',
  null, null, null, now()
from u
on conflict (user_id) do update set
  status = excluded.status, plan = excluded.plan, provider = excluded.provider,
  current_period_end = excluded.current_period_end, store_product_id = null,
  original_transaction_id = null, store_environment = null, updated_at = now()
where public.subscriptions.plan <> 'owner'
  and public.subscriptions.provider not in ('apple', 'google')   -- nunca pisar una compra real
returning user_id, status, plan, provider, current_period_end;
-- Debe devolver exactamente 1 fila. Si devuelve 0: el email no existe o la cuenta
-- ya tiene una suscripción de tienda/owner → ROLLBACK y revisar.
commit;
```

Notas:
- Afecta a 1 fila; sin `record_sale`, sin `store_sales`, sin comisión de creador.
- Antes de ejecutar, confirmar que la cuenta no tiene `referrals` (no debe generar atribución, aunque una concesión manual no la genera).

## 2. Verificación (Pro nueva + Élite existente)

```sql
select u.email, s.status, s.plan, s.provider, s.current_period_end, s.store_product_id,
       p.tier, (s.current_period_end > now()) as vigente
from public.subscriptions s
join auth.users u on u.id = s.user_id
left join public.ai_plans p on p.plan = s.plan
where lower(u.email) in (lower('<EMAIL_DEMO_PRO>'), lower('<EMAIL_DEMO_ELITE>'));
-- Esperado: Pro → active / pro_anual / manual / tier pro / vigente.
--           Élite → active / elite_anual / manual / tier elite / vigente.

-- Ninguna venta ni comisión asociada a las demos:
select count(*) as ventas from public.store_sales ss
join auth.users u on u.id = ss.user_id
where lower(u.email) in (lower('<EMAIL_DEMO_PRO>'), lower('<EMAIL_DEMO_ELITE>'));
-- Esperado: 0.
```

Comprobación desde la app (con la sesión de cada demo): Perfil › NIVL Pro debe mostrar el plan activo; `ai_status` → `entitled: true`, `tier: 'pro'|'elite'`, `trial: false`. Élite: Perfil › Amigos muestra su ludus de cinco.

## 3. Retirada (tras la aprobación o al caducar)

```sql
begin;
update public.subscriptions s set status = 'canceled',
  current_period_end = least(coalesce(s.current_period_end, now()), now()), updated_at = now()
from auth.users u
where u.id = s.user_id and s.provider = 'manual' and s.plan <> 'owner'
  and lower(u.email) in (lower('<EMAIL_DEMO_PRO>'), lower('<EMAIL_DEMO_ELITE>'))
returning u.email, s.status, s.plan;
commit;
```

Si se retira la demo Élite, su ludus deja de validar Élite (trigger de 0026): sacarla antes con `scripts/ludus.mjs` si el grupo debe seguir.

## 4. Registro privado (`nivl/privado/`, fuera del repo)

Por cada ejecución: cuenta (email), plan, fecha fin, motivo «App Review NIVL 1.0.7», quién la ejecutó, fecha/hora, salida del `returning` y de la verificación. Las credenciales solo en los campos privados de App Store Connect.

## Estado

- SQL: preparado, **NO ejecutado** (lo ejecuta el coordinador con confirmación del usuario).
- Probado en PGlite/servidor: NO PROBADO.
