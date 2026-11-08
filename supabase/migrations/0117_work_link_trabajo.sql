-- 0117 · WORK: el acto real 'trabajo' en quests.link y rules.link. docs/modos/WORK.md
-- Huella: exists(select 1 from pg_constraint where conname = 'quests_link_check' and conrelid = 'public.quests'::regclass and pg_get_constraintdef(oid) like '%trabajo%') and exists(select 1 from pg_constraint where conname = 'rules_link_check' and conrelid = 'public.rules'::regclass and pg_get_constraintdef(oid) like '%trabajo%') and position('''trabajo''' in pg_get_functiondef('public.health_row(text,jsonb)'::regprocedure)) > 0
--
-- Dos cambios, los dos leídos del catálogo porque otra sesión puede haber añadido valores antes:
--   1. Los CHECK se reescriben SUMANDO 'trabajo' a la lista que tengan en este momento.
--   2. health_row (0030) trata toda misión o regla con link <> 'ninguno' como dato de salud, y la
--      política restrictiva `health_permission` la esconde a quien no dio ese consentimiento. Un
--      bloque de trabajo no es un dato de salud: 'trabajo' sale de esa condición.
-- infer_link NO se toca: 'trabajo' nunca se deduce de un título, solo se pone explícito.
begin;

do $$
declare
  t text;
  c text;
  def text;
  valores text[];
begin
  foreach t in array array['quests','rules'] loop
    c := t || '_link_check';
    select pg_get_constraintdef(oid) into def
      from pg_constraint where conname = c and conrelid = format('public.%I', t)::regclass;
    if def is null then raise exception 'Falta el constraint %', c; end if;
    select array_agg(distinct m[1] order by m[1]) into valores from regexp_matches(def, $r$'([^']+)'$r$, 'g') as m;
    if valores is null or not ('ninguno' = any (valores)) then
      raise exception 'No se ha podido leer la lista de %: %', c, def;
    end if;
    if not ('trabajo' = any (valores)) then
      execute format('alter table public.%I drop constraint %I', t, c);
      execute format('alter table public.%I add constraint %I check (link is null or link = any (%L::text[]))',
                     t, c, array_append(valores, 'trabajo'));
    end if;
  end loop;
end $$;

do $$
declare
  actual text := pg_get_functiondef('public.health_row(text,jsonb)'::regprocedure);
  viejo constant text := $v$coalesce(p_row->>'link','ninguno')<>'ninguno'$v$;
  nuevo constant text := $v$coalesce(p_row->>'link','ninguno') not in ('ninguno','trabajo')$v$;
begin
  -- La 0113 (FOCUS) ya deja 'trabajo' fuera de salud: da igual cuál se aplique antes.
  if position(nuevo in actual) > 0 or position($v$not in ('ninguno','estudio','trabajo')$v$ in actual) > 0 then
    return;
  end if;
  if position(viejo in actual) = 0 then
    raise exception 'health_row ha cambiado: revisa la 0117 antes de aplicarla';
  end if;
  execute replace(actual, viejo, nuevo);
end $$;

commit;
