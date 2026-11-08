-- 0142 · A los creadores se les paga en múltiplos de 5 €, redondeando hacia abajo.
-- Huella: to_regprocedure('public._creator_panel_sin_resto()') is not null
--
-- Decisión del dueño (8-nov-2026). El redondeo va en la liquidación, no en cada
-- comisión: un tramo mensual de 1,76 € se quedaría siempre en 0. Lo que sobra no
-- se pierde: queda en `creators.resto_cents` para la siguiente liquidación y el
-- creador lo ve como disponible. Solo afecta a las comisiones: fijos y premios
-- se apuntan aparte. Espejo: liquidacionCents en src/lib/creatormath.ts.
begin;

alter table public.creators add column if not exists resto_cents integer not null default 0 check (resto_cents >= 0);

create or replace function public.liquidate_creator(p_creator uuid, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_resto bigint;
  v_total bigint;
  v_claw bigint;
  v_saldo bigint;
  v_pago bigint;
  v_payout uuid;
begin
  select resto_cents into v_resto from public.creators where id = p_creator for update;
  if not found then raise exception 'Creador desconocido'; end if;

  select coalesce(sum(amount_cents), 0) into v_total
  from public.commissions
  where creator_id = p_creator and status = 'pendiente' and available_at <= now();

  select coalesce(sum(amount_cents), 0) into v_claw
  from public.commissions
  where creator_id = p_creator and clawback and clawback_settled_at is null;

  v_saldo := v_total + v_resto - v_claw;
  v_pago := greatest(0, v_saldo - v_saldo % 500);

  if v_pago <= 0 then
    return jsonb_build_object('ok', false, 'available', v_total, 'clawback', v_claw, 'resto', v_resto);
  end if;

  insert into public.creator_payouts (creator_id, kind, amount_cents, period, note)
  values (p_creator, 'comisiones', v_pago::integer, to_char(now() at time zone 'Europe/Madrid', 'YYYY-MM'), p_note)
  returning id into v_payout;

  update public.commissions set status = 'pagada', payout_id = v_payout
  where creator_id = p_creator and status = 'pendiente' and available_at <= now();

  update public.commissions set clawback_settled_at = now()
  where creator_id = p_creator and clawback and clawback_settled_at is null;

  update public.creators set resto_cents = (v_saldo - v_pago)::integer where id = p_creator;

  return jsonb_build_object('ok', true, 'payout', v_payout, 'amount', v_pago,
    'available', v_total, 'clawback', v_claw, 'resto', v_saldo - v_pago);
end;
$$;

-- El panel suma el resto a lo disponible: es dinero del creador que aún no se ha transferido.
do $$
begin
  if to_regprocedure('public._creator_panel_sin_resto()') is null then
    alter function public.creator_panel() rename to _creator_panel_sin_resto;
  end if;
end
$$;
revoke all on function public._creator_panel_sin_resto() from public, anon, authenticated;

create or replace function public.creator_panel()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_panel jsonb := public._creator_panel_sin_resto();
  v_resto integer;
begin
  if v_panel is null then return null; end if;
  select resto_cents into v_resto from public.creators where user_id = auth.uid() and active;
  return v_panel || jsonb_build_object(
    'available_cents', coalesce((v_panel->>'available_cents')::bigint, 0) + coalesce(v_resto, 0),
    'resto_cents', coalesce(v_resto, 0));
end;
$$;
revoke all on function public.creator_panel() from public, anon;
grant execute on function public.creator_panel() to authenticated;

commit;
