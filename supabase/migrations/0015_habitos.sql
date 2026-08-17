-- NIVL · 0015 — Hábitos adquiridos
-- Pegar en SQL Editor después de 0014.
--
-- Una misión recurrente y un hábito son la misma cosa mirada en dos momentos:
-- al principio hay que obligarse a marcarla, y llega un punto en que ya se hace
-- sola. El sistema no reconocía ese punto, así que lectura o skincare seguían
-- pidiendo un toque diario para siempre, como el primer día.
--
-- 21 días es el umbral pactado. No es una ley científica —la literatura da un
-- rango amplísimo y depende del hábito— pero es un listón claro, alcanzable y
-- lo bastante largo para que signifique algo.
--
-- Consolidar un hábito es una RECOMPENSA, no un archivado: deja de exigir el
-- toque diario y deja de poder romperte la racha. Por eso se decide a mano y no
-- automáticamente: hay hábitos que uno quiere seguir contando.

alter table public.quests
  -- Cuándo se consolidó. Con fecha puesta, la misión deja de programarse: ni
  -- pide marcarse ni cuenta para el cierre del día.
  add column if not exists acquired_at timestamptz,
  -- Días seguidos que hicieron falta, congelados en el momento de consolidar.
  -- Se guarda el número porque la racha se calcula sobre las completadas y, si
  -- algún día se purgan, el logro no debería evaporarse con ellas.
  add column if not exists acquired_streak integer;

-- Se consultan juntas al pintar la pantalla de Hábitos.
create index if not exists quests_acquired_idx on public.quests (user_id, acquired_at);
