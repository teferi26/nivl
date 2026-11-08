-- 0142 · A los creadores se les paga en múltiplos de 5 €, redondeando hacia abajo.
-- Huella: coalesce(obj_description(to_regprocedure('public.liquidate_creator(uuid,text)'), 'pg_proc') like '%nivl:pago-multiplos-0142%', false)
--
-- Decisión del dueño (8-nov-2026). El redondeo va en la liquidación, no en cada
-- comisión: un tramo mensual de 1,76 € se quedaría siempre en 0. Lo que sobra al
-- redondear un pago se queda en NIVL y no pasa a la siguiente. Mientras el saldo
-- no llegue a 5 € no se paga nada y las comisiones siguen disponibles. Solo afecta
-- a las comisiones: fijos y premios se apuntan aparte. Espejo: liquidacionCents
-- en src/lib/creatormath.ts.
begin;

create or replace function public.liquidate_creator(p_creator uuid, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_total bigint;
  v_claw bigint;
  v_saldo bigint;
  v_pago bigint;
  v_payout uuid;
begin
  perform 1 from public.creators where id = p_creator for update;
  if not found then raise exception 'Creador desconocido'; end if;

  select coalesce(sum(amount_cents), 0) into v_total
  from public.commissions
  where creator_id = p_creator and status = 'pendiente' and available_at <= now();

  select coalesce(sum(amount_cents), 0) into v_claw
  from public.commissions
  where creator_id = p_creator and clawback and clawback_settled_at is null;

  v_saldo := v_total - v_claw;
  v_pago := greatest(0, v_saldo - v_saldo % 500);

  if v_pago <= 0 then
    return jsonb_build_object('ok', false, 'available', v_total, 'clawback', v_claw);
  end if;

  insert into public.creator_payouts (creator_id, kind, amount_cents, period, note)
  values (p_creator, 'comisiones', v_pago::integer, to_char(now() at time zone 'Europe/Madrid', 'YYYY-MM'), p_note)
  returning id into v_payout;

  update public.commissions set status = 'pagada', payout_id = v_payout
  where creator_id = p_creator and status = 'pendiente' and available_at <= now();

  update public.commissions set clawback_settled_at = now()
  where creator_id = p_creator and clawback and clawback_settled_at is null;

  return jsonb_build_object('ok', true, 'payout', v_payout, 'amount', v_pago,
    'available', v_total, 'clawback', v_claw, 'redondeo', v_saldo - v_pago);
end;
$$;

comment on function public.liquidate_creator(uuid, text) is 'Paga en múltiplos de 5 €. nivl:pago-multiplos-0142';

commit;
