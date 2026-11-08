-- 0112 · FOCUS completo: entregas y deberes, examen sin fecha o estimado, vueltas, secciones,
-- nota objetivo, salidas del bloque y preferencias del modo.
-- Huella: col_description de focus_exams.kind like '%nivl:focus-entregas-0112%'
--
-- ORDEN DE DESPLIEGUE: esta (columnas), luego la OTA, luego la 0113 (link 'estudio'). Así la OTA
-- nunca escribe sin sus columnas. src/focus/datos.ts tolera igualmente que aún no existan (lee las
-- de la 0076, cae a los valores por defecto y avisa en vez de guardar a medias).
--
-- Reglas:
--   · Las entregas y los deberes son filas de focus_exams con kind='entrega'; done_on las cierra.
--     Sin tabla nueva: la exportación ya saca las filas enteras de focus_exams, focus_subjects,
--     focus_topics, focus_sessions y user_modes (export_my_data no cambia).
--   · user_modes.settings guarda las preferencias de FOCUS (perfil, minutosDia, sinClasesHasta,
--     arranqueHecho). Un objeto pequeño, con tope, escrito por su dueño (RLS de la 0068).
--   · account_write_guard en las ocho tablas FOCUS: con un borrado pendiente no se escribe, como
--     en WORK (0075). La 0076 no lo llevaba.
--   · Cero economía nueva: nada de aquí paga XP.
begin;

-- Exámenes: fecha opcional o estimada, hora, tipo y cierre.
alter table public.focus_exams alter column exam_date drop not null;
alter table public.focus_exams add column if not exists kind text not null default 'examen';
alter table public.focus_exams drop constraint if exists focus_exams_kind_check;
alter table public.focus_exams add constraint focus_exams_kind_check check (kind in ('examen','entrega','prueba'));
alter table public.focus_exams add column if not exists done_on date null;
-- Minuto del día (0 a 1439): con dos exámenes el mismo día, cuál va primero.
alter table public.focus_exams add column if not exists exam_time smallint null;
alter table public.focus_exams drop constraint if exists focus_exams_time_check;
alter table public.focus_exams add constraint focus_exams_time_check check (exam_time is null or exam_time between 0 and 1439);
alter table public.focus_exams add column if not exists date_estimated boolean not null default false;

-- Asignaturas: la nota que se quiere y la vuelta al temario en la que se va.
alter table public.focus_subjects add column if not exists target_grade numeric(4,2) null;
alter table public.focus_subjects drop constraint if exists focus_subjects_target_check;
alter table public.focus_subjects add constraint focus_subjects_target_check check (target_grade is null or (target_grade >= 0 and target_grade <= 14));
alter table public.focus_subjects add column if not exists lap smallint not null default 1;
alter table public.focus_subjects drop constraint if exists focus_subjects_lap_check;
alter table public.focus_subjects add constraint focus_subjects_lap_check check (lap between 1 and 99);

-- Temas: cuándo se repasó por última vez y el bloque o parte del temario.
alter table public.focus_topics add column if not exists last_reviewed_on date null;
alter table public.focus_topics add column if not exists section text null;
alter table public.focus_topics drop constraint if exists focus_topics_section_check;
alter table public.focus_topics add constraint focus_topics_section_check check (section is null or char_length(section) <= 80);

-- Sesiones: veces que se salió de la app durante el bloque. Solo informativo: nunca toca el pago.
alter table public.focus_sessions add column if not exists exits smallint not null default 0;
alter table public.focus_sessions drop constraint if exists focus_sessions_exits_check;
alter table public.focus_sessions add constraint focus_sessions_exits_check check (exits between 0 and 1000);

-- Preferencias del modo (viajan en la fila de user_modes, ya exportada).
alter table public.user_modes add column if not exists settings jsonb not null default '{}'::jsonb;
alter table public.user_modes drop constraint if exists user_modes_settings_check;
alter table public.user_modes add constraint user_modes_settings_check check (jsonb_typeof(settings) = 'object' and pg_column_size(settings) <= 4096);

-- Con un borrado de cuenta pendiente no se escribe (0031), como en WORK.
do $$ declare t text; begin
  foreach t in array array['focus_subjects','focus_exams','focus_topics','focus_sessions','focus_classes','focus_grades','focus_decks','focus_cards'] loop
    execute format('drop trigger if exists account_write_guard on public.%I', t);
    execute format('create trigger account_write_guard before insert or update on public.%I for each row execute function public.require_account_active(%L)', t, 'user_id');
  end loop;
end $$;

comment on column public.focus_exams.kind is 'nivl:focus-entregas-0112 · examen, entrega (también deberes) o prueba.';
commit;
