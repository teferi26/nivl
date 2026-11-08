-- 0116 · WORK: calendar_events puede traer eventos copiados del calendario del teléfono. docs/modos/WORK.md
-- Huella: coalesce(col_description('public.calendar_events'::regclass, (select attnum from pg_attribute where attrelid = 'public.calendar_events'::regclass and attname = 'external_id')::int) like '%nivl:work-calendario-0116%', false)
--
-- Solo lectura del calendario, con permiso explícito: se copian título y horas. Desconectar borra lo
-- importado (`source = 'dispositivo'`). Las columnas viajan en la exportación con la fila entera.
begin;

alter table public.calendar_events add column if not exists source text not null default 'manual';
alter table public.calendar_events add column if not exists external_id text null;
alter table public.calendar_events add column if not exists end_time text null;

alter table public.calendar_events drop constraint if exists calendar_events_source_check;
alter table public.calendar_events add constraint calendar_events_source_check check (source in ('manual','dispositivo'));
alter table public.calendar_events drop constraint if exists calendar_events_external_check;
alter table public.calendar_events add constraint calendar_events_external_check
  check ((source = 'manual') = (external_id is null) and (external_id is null or char_length(external_id) between 1 and 300));
alter table public.calendar_events drop constraint if exists calendar_events_end_time_check;
alter table public.calendar_events add constraint calendar_events_end_time_check
  check (end_time is null or end_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]');

-- Reimportar no duplica. Índice ENTERO, no parcial, porque PostgREST solo infiere así el on_conflict;
-- los eventos manuales llevan external_id NULL y NULL no choca con NULL.
create unique index if not exists calendar_events_externo_idx on public.calendar_events (user_id, external_id);

comment on column public.calendar_events.source is 'manual o dispositivo (copiado del calendario del teléfono).';
comment on column public.calendar_events.external_id is 'nivl:work-calendario-0116 · Id del evento en el teléfono + día de la ocurrencia.';
comment on column public.calendar_events.end_time is 'HH:MM local. null = se asume la duración por defecto.';

commit;
