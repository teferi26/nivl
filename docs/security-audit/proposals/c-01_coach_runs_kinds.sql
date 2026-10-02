-- c-01 · El libro de gasto de la IA admite el Oráculo y el titular del push.
--
-- Por qué: coach_runs es lo único que suma ai_state (lo gastado del mes) y su
-- CHECK de kind no admitía 'oracle' ni 'titular'. Desde Chat 3 · c el Oráculo
-- pasa por ai_begin_turn y apunta su coste con kind 'oracle', y el titular
-- del push del ritual con kind 'titular'. Sin esta migración esos insert
-- fallan (quedan en el log) y su gasto sigue fuera del candado.
--
-- Comprobado en remoto (2026-10-02, en transacción deshecha):
--   insert into coach_runs (..., kind 'oracle', ...) →
--   ERROR 23514 violates check constraint "coach_runs_kind_check".
--
-- Se mantiene NOT VALID como la restricción actual (no revalida filas viejas).
-- Orden de salida: esta migración ANTES de desplegar oracle/ritual nuevos
-- (si se despliegan antes, solo se pierde el apunte; el cerrojo ya funciona).

alter table public.coach_runs drop constraint if exists coach_runs_kind_check;
alter table public.coach_runs add constraint coach_runs_kind_check check (
  kind = any (array[
    'chat', 'brief', 'plan', 'revision_semanal', 'cierre_mensual', 'import', 'escalada',
    'clasificar', 'resumen_semanal', 'resumen_mensual',
    'oracle', 'titular'
  ])
) not valid;
