-- 0077 · IRON · Dieta: agua y comida libre en el parte del día.
-- Huella: coalesce(col_description('public.nutrition_logs'::regclass, (select attnum from pg_attribute where attrelid = 'public.nutrition_logs'::regclass and attname = 'water_ml')::int) like '%nivl:agua-0077%', false)
--
-- El mundo IRON (gym + dieta) apunta el agua del día y si hoy toca comida
-- libre. Van en el MISMO parte del día (`nutrition_logs`, una fila por persona
-- y día), así que:
--   · La exportación (`export_my_data`) ya los cubre: copia la fila entera.
--   · El borrado de cuenta y la retirada del consentimiento de salud también:
--     son columnas de una tabla que ya se borra (0030).
--   · RLS: la política «own nutrition_logs» (0012) ya vale.
-- Sin XP: ni el agua ni la comida libre pagan nada (la economía no se toca).
-- El XP del parte sigue saliendo del recibo `nutrition_day` en `events`, no de
-- que exista la fila: apuntar agua antes del parte no cobra ni bloquea nada.
-- Solo aditiva.
begin;

alter table public.nutrition_logs
  add column if not exists water_ml integer not null default 0
    check (water_ml between 0 and 10000),
  add column if not exists free_meal boolean not null default false;

comment on column public.nutrition_logs.water_ml is
  'Agua del día en mililitros (IRON · Dieta). nivl:agua-0077';
comment on column public.nutrition_logs.free_meal is
  'Hoy hay comida libre (IRON · Dieta): fuera del plan, sin castigo. nivl:agua-0077';

commit;
