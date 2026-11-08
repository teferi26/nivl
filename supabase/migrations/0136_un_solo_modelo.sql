-- 0136 · Un solo modelo para toda la IA: claude-haiku-5-5.
-- Huella: coalesce(col_description('public.ai_plans'::regclass, (select attnum::int from pg_attribute where attrelid = 'public.ai_plans'::regclass and attname = 'routes')) like '%nivl:un-modelo-0136%', false)
--
-- Decisión del dueño (8-nov-2026): Haiku 5.5 es el coach y no hay otra opción.
-- Las funciones ya no leen `routes` para elegir modelo; se deja el dato igual
-- que el código y sin la clave `profundo`, así ai_status devuelve deep_allowed
-- = false y los binarios antiguos dejan de pintar el selector de potencia.
--
-- No cambia precios ni presupuestos. `deep_budget_micro_usd`, la fila `profundo`
-- de ai_topes_funcion y el parámetro p_mode quedan en desuso, sin borrar: las
-- filas viejas de coach_runs y ai_cargos con mode = 'profundo' siguen siendo válidas.
begin;

update public.ai_plans set routes = jsonb_build_object('default', 'claude-haiku-5-5');
alter table public.ai_plans alter column routes set default '{"default":"claude-haiku-5-5"}'::jsonb;

comment on column public.ai_plans.routes is
  'En desuso desde la 0136: las funciones siempre usan COACH_MODEL (claude-haiku-5-5). Solo ai_status.vision lee default. nivl:un-modelo-0136';
comment on column public.ai_plans.deep_budget_micro_usd is
  'En desuso desde la 0136: el modo profundo está retirado. Sigue restándose del mensual para no cambiar presupuestos.';

commit;
