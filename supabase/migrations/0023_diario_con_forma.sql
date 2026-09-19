-- NIVL · 0023 — El diario deja de ser dos cajas de texto.
--
-- Hasta aquí una entrada eran dos notas del 1 al 5 y dos textos libres ("lo
-- vivido" y "plan"), y no quedaba claro qué iba en cada uno: el plan de hoy,
-- el de mañana, lo que pasó… Releerlo tampoco daba gusto, porque un bloque de
-- texto no se recorre, se descifra. Y el coach solo podía leer prosa.
--
-- Ahora el cierre del día tiene forma, y cada pieza responde a una pregunta:
--   · cómo me sentí  → mood, energy + `emotions` (con nombre, no solo un 3/5)
--   · cómo dormí     → `sleep_hours` (la palanca que el coach mira antes que
--                      ninguna otra y que hasta hoy no se registraba en ningún
--                      sitio)
--   · qué logré      → `wins`, las victorias del día, una por línea
--   · qué viví       → `text`, como siempre
--   · qué aprendí    → `lesson`
--   · qué agradezco  → `gratitude`
--   · mañana         → `plan`, que pasa a significar UNA cosa: lo primero de
--                      mañana. El plan de hoy ya lo escribe el coach.
--
-- Todo es opcional y aditivo: las entradas antiguas siguen valiendo tal cual.

alter table public.journal_entries
  add column if not exists emotions text[] not null default '{}',
  add column if not exists wins text[] not null default '{}',
  add column if not exists lesson text,
  add column if not exists gratitude text,
  add column if not exists sleep_hours numeric;

alter table public.journal_entries drop constraint if exists journal_sleep_hours_check;
alter table public.journal_entries add constraint journal_sleep_hours_check
  check (sleep_hours is null or (sleep_hours >= 0 and sleep_hours <= 24));

-- Topes contra entradas absurdas (y contra que un estado del coach se hinche).
alter table public.journal_entries drop constraint if exists journal_emotions_check;
alter table public.journal_entries add constraint journal_emotions_check
  check (coalesce(array_length(emotions, 1), 0) <= 8);

alter table public.journal_entries drop constraint if exists journal_wins_check;
alter table public.journal_entries add constraint journal_wins_check
  check (coalesce(array_length(wins, 1), 0) <= 10);
