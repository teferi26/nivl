-- 0061 · health_data nulo cuenta como «no es de salud» (04/10/2026)
--
-- supabase-js, al insertar varias filas a la vez, manda como NULL las claves
-- que faltan en algunas de ellas. En el onboarding de la 1.0.7 (build 21) las
-- misiones iniciales llevan `health_data: true` solo las de salud, así que
-- elegir «Entrenar» junto a «Leer 20 minutos» enviaba health_data = NULL en la
-- segunda y el NOT NULL rechazaba el lote entero («El sistema no ha podido
-- completar la operación»). Reproducido en prod con una cuenta de ensayo.
--
-- Arreglo aditivo y compatible con la 1.0.7: un BEFORE INSERT/UPDATE que
-- convierte NULL en false (lo mismo que hace el default al omitir la clave).
-- El nombre empieza por «a0_» para dispararse antes que health_write y el
-- resto (los triggers BEFORE se ejecutan por orden alfabético).

create or replace function public._health_data_nulo_es_falso()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.health_data is null then
    new.health_data := false;
  end if;
  return new;
end;
$$;

comment on function public._health_data_nulo_es_falso() is 'nivl:0061 health_data NULL -> false';
revoke all on function public._health_data_nulo_es_falso() from public, anon, authenticated;

do $$
declare t text;
begin
  foreach t in array array['quests','rules','goals','dungeons','dungeon_tasks','calendar_events','shopping_items','events','letters'] loop
    execute format('drop trigger if exists a0_health_data_nulo on public.%I', t);
    execute format('create trigger a0_health_data_nulo before insert or update on public.%I for each row execute function public._health_data_nulo_es_falso()', t);
  end loop;
end;
$$;
