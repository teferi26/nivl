-- NIVL · 0062 — Las denuncias sociales sobreviven al borrado de cuenta de quien denuncia
-- (NIVL - Seguridad, 04/10/2026; número del coordinador; guideline 1.2 «act on reports in a timely manner»).
-- Huella para scripts/apply-migrations.mjs:
--   coalesce((select confdeltype = 'n' from pg_constraint where conname = 'social_reports_reporter_fkey'), false)
--
-- Fallo (0032): social_reports.reporter y .subject tenían ON DELETE CASCADE. Si quien denuncia borra su
-- cuenta antes de que se revise, la denuncia desaparece y el contenido ofensivo queda sin revisar.
-- Arreglo, ADITIVO y compatible con 1.0.7/1.0.8 (las RPC siguen insertando con reporter = auth.uid()):
--   · reporter: nullable y ON DELETE SET NULL. La denuncia sigue, ANÓNIMA: no queda ningún dato de quien
--     denunció. Lo denunciado ya estaba copiado en displayed_name/avatar/title.
--   · subject: se queda en CASCADE a propósito. Si el denunciado borra su cuenta, su nombre, avatar y
--     título dejan de existir para los demás (lo que había que revisar ya no se ve) y no se conserva nada
--     suyo sin necesidad (minimización).
--   · El índice único de denuncias abiertas (reporter, subject, reason) admite varios reporter null: no rompe.
--   · CHECK (reporter <> subject) con reporter null da null y no bloquea.
--   · La exportación (s.reporter = u) y el borrado de cuenta no cambian: tras el borrado ya no hay u.
-- ai_reports (0037) no se toca: su excerpt es texto de la IA dirigido a esa persona y puede llevar sus
-- datos; se borra con su cuenta.
-- Re-ejecutable.

alter table public.social_reports alter column reporter drop not null;
alter table public.social_reports drop constraint if exists social_reports_reporter_fkey;
alter table public.social_reports
  add constraint social_reports_reporter_fkey foreign key (reporter) references auth.users (id) on delete set null;

comment on column public.social_reports.reporter is
  'Quien denunció. NULL si borró su cuenta (0062): la denuncia sigue, anónima, para moderar.';
