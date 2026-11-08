-- 0090 · Cuota plana: el tope mensual pasa a ser un freno solo contra abusos.
-- Huella: coalesce(obj_description('public.ai_topes_funcion'::regclass,'pg_class') like '%nivl:freno-antiabuso-0090%', false)
--
-- Decisión de Teferi (8-nov-2026): quien paga usa el coach sin contadores ni
-- pagos extra. La cartera de la 0078 se queda (reserva atómica, nadie la
-- rebasa), pero con límites que no alcanza una persona. Solo planes de pago:
-- la prueba y la cortesía conservan los suyos. Cambiar un valor es un UPDATE.
begin;

update public.ai_plans
   set monthly_budget_micro_usd = 10000000, deep_budget_micro_usd = 0
 where plan in ('pro_mensual', 'pro_anual');

update public.ai_plans
   set monthly_budget_micro_usd = 40000000, deep_budget_micro_usd = 10000000
 where plan in ('elite_mensual', 'elite_anual', 'elite_fundador');

-- Sin reparto diario apreciable: el día puede gastar 30 veces la media que queda.
insert into public.app_config (key, value, public)
values ('ia_ritmo_factor', '30'::jsonb, false)
on conflict (key) do update set value = excluded.value;

-- Turnos al día que no alcanza una persona. Los de cron (ritual, checkin) no cambian.
update public.ai_topes_funcion set max_turnos_dia = 30 where funcion = 'profundo';
update public.ai_topes_funcion set max_turnos_dia = 300 where funcion = 'estudio';
update public.ai_topes_funcion set max_turnos_dia = 50 where funcion = 'pdf';
update public.ai_topes_funcion set max_turnos_dia = 100 where funcion = 'clasificar';
update public.ai_topes_funcion set max_turnos_dia = 30 where funcion = 'resumen';
update public.ai_topes_funcion set max_turnos_dia = 200 where funcion = 'resumen_hilo';
update public.ai_topes_funcion set max_turnos_dia = 100 where funcion = 'oracle';

comment on table public.ai_topes_funcion is 'Límites por función de IA: freno solo contra abusos. nivl:freno-antiabuso-0090';

commit;
