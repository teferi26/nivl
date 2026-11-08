-- 0113 · FOCUS: el acto 'estudio' entra en «un solo gesto» (docs/modos/FOCUS.md, AGENTS.md).
-- Huella: coalesce(obj_description(to_regprocedure('public.titulo_de_estudio(text)'),'pg_proc') like '%nivl:link-estudio-0113%', false)
--
-- ORDEN DE DESPLIEGUE: 0112 (columnas) → OTA → esta. La OTA con ActLink ampliado (src/lib/types.ts,
-- src/lib/links.ts) va ANTES que esta migración (excepción consciente a «migración primero»): sin
-- filas 'estudio' la OTA es inerte; al revés, un binario sin la OTA leería link='estudio' y
-- CompletarSheet y useHoy harían MODULO_DE_ACTO['estudio'] undefined y router.push(undefined).
-- Por eso esta espera a que la OTA esté adoptada: el código viejo no se puede arreglar desde aquí.
-- Aplicar en dos pasos: node scripts/apply-migrations.mjs --hasta=0112, OTA, y luego sin --hasta.
--
-- Reglas:
--   · infer_link NO se toca: health_row trata como salud todo link distinto de 'ninguno' o todo
--     título con infer_link distinto de 'ninguno'. Por eso hay función aparte (titulo_de_estudio)
--     y health_row excluye 'estudio': estudiar no es un dato de salud.
--   · 'estudio' solo vale en misiones con modes 'focus' y en reglas de quien tiene FOCUS activo.
--     Sin FOCUS cae a 'ninguno' (la ruta del módulo redirigiría fuera del mundo).
--   · El backfill salta filas con health_data, títulos que ya infieren otro acto y cuentas con
--     borrado pendiente: los triggers de salud y de borrado abortarían la migración entera.
--   · Cero economía nueva: esta migración no mueve XP.
begin;
create or replace function public.titulo_de_estudio(p_title text) returns boolean language sql immutable as $$
  select p_title !~* '(venta|pitch|llamada)' and p_title ~* '(\m(estudiar|repasar)\M|\mpomodoros?\M|sesi[oó]n de estudio)'
$$;
comment on function public.titulo_de_estudio(text) is 'nivl:link-estudio-0113';
alter table public.quests drop constraint if exists quests_link_check;
alter table public.quests add constraint quests_link_check check (link is null or link in ('gym','cardio','nutricion','peso','diario','estudio','trabajo','ninguno'));
alter table public.rules drop constraint if exists rules_link_check;
alter table public.rules add constraint rules_link_check check (link is null or link in ('gym','cardio','nutricion','peso','diario','estudio','trabajo','ninguno'));
create or replace function public.quests_set_link() returns trigger language plpgsql as $$
begin
  if new.is_penalty then new.link := 'ninguno'; return new; end if;
  if new.link is null
     or (tg_op='UPDATE' and new.link is not distinct from old.link
         and (new.title is distinct from old.title
              or (new.modes is distinct from old.modes and new.link in ('ninguno','estudio')))) then
    new.link := case when 'focus'=any(new.modes) and public.titulo_de_estudio(new.title) then 'estudio'
                     else public.infer_link(new.title) end;
  end if;
  if new.link='estudio' and not ('focus'=any(new.modes)) then new.link := 'ninguno'; end if;
  return new;
end $$;
drop trigger if exists quests_set_link on public.quests;
create trigger quests_set_link before insert or update of title, link, modes on public.quests
  for each row execute function public.quests_set_link();
create or replace function public.rules_set_link() returns trigger language plpgsql as $$
declare foco boolean := exists(select 1 from public.user_modes m where m.user_id=new.user_id and m.mode='focus' and m.enabled);
begin
  if new.link is null
     or (tg_op='UPDATE' and new.text is distinct from old.text and new.link is not distinct from old.link) then
    new.link := case when foco and public.titulo_de_estudio(new.text) then 'estudio' else public.infer_link(new.text) end;
  end if;
  if new.link='estudio' and not foco then new.link := 'ninguno'; end if;
  return new;
end $$;
create or replace function public.health_row(p_table text,p_row jsonb) returns boolean language sql stable
set search_path=public as $$
  select coalesce((p_row->>'health_data')::boolean,false) or case p_table
    when 'quests' then coalesce(p_row->>'link','ninguno') not in ('ninguno','estudio','trabajo') or public.infer_link(p_row->>'title')<>'ninguno'
    when 'rules' then coalesce(p_row->>'link','ninguno') not in ('ninguno','estudio','trabajo') or public.infer_link(p_row->>'text')<>'ninguno' or public.infer_link(p_row->>'consequence')<>'ninguno'
    when 'goals' then coalesce(p_row->>'metric_type','libre') <> 'libre'
    when 'events' then public.health_event(p_row->>'type',p_row->'payload')
    when 'dungeons' then false
    when 'calendar_events' then false
    when 'shopping_items' then false
    when 'letters' then false
    when 'money_plan' then coalesce((p_row->>'health_note')::boolean,false)
    when 'budgets' then coalesce((p_row->>'health_note')::boolean,false)
    when 'category_rules' then coalesce((p_row->>'health_note')::boolean,false)
    when 'transactions' then coalesce((p_row->>'health_note')::boolean,false)
    when 'dungeon_tasks' then coalesce((select public.health_row('dungeons',to_jsonb(d)) from public.dungeons d where d.id=(p_row->>'dungeon_id')::uuid and d.user_id=(p_row->>'user_id')::uuid),true)
    when 'completions' then nullif(p_row->>'evidence_url','') is not null or coalesce((select public.health_row('quests',to_jsonb(q)) from public.quests q where q.id=(p_row->>'quest_id')::uuid and q.user_id=(p_row->>'user_id')::uuid),true)
    when 'rule_checks' then coalesce((select public.health_row('rules',to_jsonb(r)) from public.rules r where r.id=(p_row->>'rule_id')::uuid and r.user_id=(p_row->>'user_id')::uuid),true)
    when 'rule_breaks' then coalesce((select public.health_row('rules',to_jsonb(r)) from public.rules r where r.id=(p_row->>'rule_id')::uuid and r.user_id=(p_row->>'user_id')::uuid),true)
    else true end
$$;
update public.quests q set modes = array_append(q.modes,'focus')
 where cardinality(q.modes)=0 and not q.is_penalty and not q.health_data and q.active
   and public.titulo_de_estudio(q.title) and public.infer_link(q.title)='ninguno'
   and not public.account_erasure_pending(q.user_id)
   and exists(select 1 from public.user_modes m where m.user_id=q.user_id and m.mode='focus' and m.enabled);
update public.quests set link='estudio'
 where link='ninguno' and not is_penalty and not health_data and 'focus'=any(modes)
   and public.titulo_de_estudio(title) and public.infer_link(title)='ninguno'
   and not public.account_erasure_pending(user_id);
commit;
