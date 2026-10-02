-- 0047_coach_telemetria · telemetría de coste del coach y resumen del hilo (Chat 3 · IA v2, L0; PROPUESTA, número pedido al coordinador).
-- Huella: exists(select 1 from information_schema.columns where table_schema = 'public' and table_name = 'coach_runs' and column_name = 'state_chars')
-- Test: 0047_coach_telemetria.test.sql (concatenado detrás de esta, en una transacción que se revierte).
--
-- Aditiva y compatible con 1.0.7: solo columnas NUEVAS y NULAS, y un CHECK
-- de kind que AMPLÍA el vivo. Nada se renombra ni se borra; la app no lee
-- ninguna de estas columnas.
--
-- coach_runs: cache_read_tokens y cache_write_tokens ya existen (0008, NOT
-- NULL default 0; comprobado en el esquema vivo el 2026-10-02): no se duplican.
-- Se añade lo que falta para saber DÓNDE se va el dinero:
--   route          'completa' (coach con todo) · 'mecanica' (Haiku, sin contexto) · L3: 'registro'…
--   intent         'afirmacion' · 'general' (solo chat; null en rituales)
--   tools_offered  herramientas enviadas en la petición
--   tool_calls     herramientas que llamó el modelo en el turno
--   iterations     llamadas al proveedor (con reintentos)
--   state_chars    caracteres del estado del día enviado en el sistema
-- Etiquetas cortas y enteros: ningún texto del usuario ni del modelo.
--
-- coach_threads: summary / summary_until para el resumen incremental del hilo
-- (L4). Ojo: la política "own coach_threads" (for all) deja al usuario
-- escribir su propio resumen. Solo puede contaminar SU contexto, pero quien lo
-- use (L4) debe tratarlo como DATO (entre <datos_del_gladiador>), nunca como
-- instrucción.
--
-- Orden de salida: indiferente. coach/handler.ts y ritual/handler.ts insertan
-- primero CON estas columnas y, si la base responde columna inexistente
-- (42703 / PGRST204), repiten sin ellas. Con la migración aplicada antes que
-- los kinds nuevos, los inserts de 'checkin'/'resumen_hilo' ya no fallan.
--
-- La exportación (export_my_data v4, 0044) vuelca coach_runs y coach_threads
-- por fila entera, así que las columnas nuevas salen solas; el borrado de
-- cuenta va por cascada de user_id. Nada que tocar ahí.

alter table public.coach_runs
  add column if not exists route text,
  add column if not exists intent text,
  add column if not exists tools_offered smallint,
  add column if not exists tool_calls smallint,
  add column if not exists iterations smallint,
  add column if not exists state_chars integer;

alter table public.coach_runs drop constraint if exists coach_runs_telemetria_check;
alter table public.coach_runs add constraint coach_runs_telemetria_check check (
  (route is null or char_length(route) between 1 and 40)
  and (intent is null or char_length(intent) between 1 and 40)
  and (tools_offered is null or tools_offered >= 0)
  and (tool_calls is null or tool_calls >= 0)
  and (iterations is null or iterations >= 0)
  and (state_chars is null or state_chars >= 0)
);

alter table public.coach_threads
  add column if not exists summary text,
  add column if not exists summary_until timestamptz;

alter table public.coach_threads drop constraint if exists coach_threads_summary_check;
alter table public.coach_threads add constraint coach_threads_summary_check check (
  summary is null or char_length(summary) <= 8000
);

-- El CHECK de kind vivo (0038) + 'checkin' (L6) y 'resumen_hilo' (L4).
-- NOT VALID como la 0038: no revalida filas viejas.
alter table public.coach_runs drop constraint if exists coach_runs_kind_check;
alter table public.coach_runs add constraint coach_runs_kind_check check (
  kind = any (array[
    'chat', 'brief', 'plan', 'revision_semanal', 'cierre_mensual', 'import', 'escalada',
    'clasificar', 'resumen_semanal', 'resumen_mensual',
    'oracle', 'titular',
    'checkin', 'resumen_hilo'
  ])
) not valid;
