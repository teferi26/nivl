-- NIVL · 0011 — Unicidad: se acabaron las filas duplicadas
-- Pegar en SQL Editor después de 0010.
--
-- Cuatro tablas se escribían con "insert" pero se leían como si solo pudiera
-- existir una fila por clave. Un doble toque, un reintento de red o dos
-- pestañas abiertas dejaban duplicados que luego se pintaban repetidos y
-- descuadraban los conteos. La base de datos no lo impedía porque nadie se lo
-- había pedido.
--
-- Se limpia primero lo que ya está duplicado (conservando la fila más
-- reciente, que es la que el usuario cree tener) y después se pone la
-- restricción para que no vuelva a pasar.

-- ── meal_slots: una comida por día y franja ─────────────────────────
delete from public.meal_slots a
  using public.meal_slots b
  where a.user_id = b.user_id
    and a.day_of_week = b.day_of_week
    and a.slot = b.slot
    and a.ctid < b.ctid;

alter table public.meal_slots
  drop constraint if exists meal_slots_unique;
alter table public.meal_slots
  add constraint meal_slots_unique unique (user_id, day_of_week, slot);

-- ── gym_sessions: una sesión por día y rutina ───────────────────────
delete from public.gym_sessions a
  using public.gym_sessions b
  where a.user_id = b.user_id
    and a.date = b.date
    and a.gym_day_id is not distinct from b.gym_day_id
    and a.ctid < b.ctid;

alter table public.gym_sessions
  drop constraint if exists gym_sessions_unique;
alter table public.gym_sessions
  add constraint gym_sessions_unique unique (user_id, date, gym_day_id);

-- ── journal_entries: una entrada de diario por día ──────────────────
delete from public.journal_entries a
  using public.journal_entries b
  where a.user_id = b.user_id
    and a.date = b.date
    and a.ctid < b.ctid;

alter table public.journal_entries
  drop constraint if exists journal_entries_unique;
alter table public.journal_entries
  add constraint journal_entries_unique unique (user_id, date);

-- ── shopping_items: un artículo por nombre en la lista ──────────────
-- Aquí la clave es el nombre normalizado: "Pollo" y "pollo  " son el mismo
-- artículo para quien empuja el carro.
delete from public.shopping_items a
  using public.shopping_items b
  where a.user_id = b.user_id
    and lower(btrim(a.name)) = lower(btrim(b.name))
    and a.ctid < b.ctid;

drop index if exists shopping_items_unique;
create unique index shopping_items_unique
  on public.shopping_items (user_id, lower(btrim(name)));
