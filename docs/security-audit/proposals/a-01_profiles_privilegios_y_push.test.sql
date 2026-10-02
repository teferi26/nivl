-- Test de a-01. Pensado para ejecutarse DENTRO de una transacción que se
-- deshace al final (ayudante rosql de Chat 3, o psql con begin; ... y deshacer).
-- Aplica el cuerpo de la propuesta, crea tres cuentas ficticias y comprueba
-- casos positivos y negativos. Salida: tabla res (k, v, ok).

create temp table res(n serial, k text, v text, ok boolean);
grant all on res to authenticated, anon;
grant all on sequence res_n_seq to authenticated, anon;

-- Cuerpo de la propuesta (sin begin/fin).
revoke insert, delete on public.profiles from anon, authenticated;
revoke all on public.profiles from anon;
grant insert (id) on public.profiles to authenticated;
revoke truncate on all tables in schema public from anon, authenticated;
alter default privileges for role postgres in schema public revoke truncate on tables from anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
create or replace function public.claim_push_token(p_token text, p_platform text)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'No autenticado' using errcode = '42501'; end if;
  if p_token is null or length(p_token) not between 10 and 200 or p_token !~ '^(Expo(nent)?PushToken\[[A-Za-z0-9_-]+\])$' then
    raise exception 'Token no válido';
  end if;
  if p_platform not in ('ios', 'android') then raise exception 'Plataforma no válida'; end if;
  insert into public.push_tokens(token, user_id, platform, updated_at)
  values (p_token, v_uid, p_platform, now())
  on conflict (token) do update
    set user_id = excluded.user_id, platform = excluded.platform, updated_at = excluded.updated_at;
end; $$;
revoke all on function public.claim_push_token(text, text) from public, anon, authenticated;
grant execute on function public.claim_push_token(text, text) to authenticated;

-- Cuentas ficticias.
insert into auth.users(id, instance_id, aud, role, email, email_confirmed_at, raw_user_meta_data, raw_app_meta_data, created_at, updated_at) values
 ('aaaaaaaa-0000-4000-8000-00000000000a','00000000-0000-0000-0000-000000000000','authenticated','authenticated','sec-a@example.invalid',now(),'{}','{}',now(),now()),
 ('bbbbbbbb-0000-4000-8000-00000000000b','00000000-0000-0000-0000-000000000000','authenticated','authenticated','sec-b@example.invalid',now(),'{}','{}',now(),now());
-- C sin perfil: simula la carrera que cubre ensureProfile.
insert into auth.users(id, instance_id, aud, role, email, email_confirmed_at, raw_user_meta_data, raw_app_meta_data, created_at, updated_at) values
 ('cccccccc-0000-4000-8000-00000000000c','00000000-0000-0000-0000-000000000000','authenticated','authenticated','sec-c@example.invalid',now(),'{}','{}',now(),now());
delete from public.profiles where id='cccccccc-0000-4000-8000-00000000000c';
update public.social_profile_reviews set status='suspended', review_note='test' where user_id='aaaaaaaa-0000-4000-8000-00000000000a';

create or replace function pg_temp.try(p_k text, p_sql text, p_debe_pasar boolean) returns void language plpgsql as $$
declare n bigint; begin
  execute p_sql; get diagnostics n = row_count;
  insert into res(k,v,ok) values(p_k, 'ejecutado, filas='||n, p_debe_pasar);
exception when others then insert into res(k,v,ok) values(p_k, 'denegado: '||left(sqlerrm,80), not p_debe_pasar);
end $$;
grant execute on function pg_temp.try(text,text,boolean) to authenticated, anon;

set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-4000-8000-00000000000a","role":"authenticated"}';
select pg_temp.try('A (suspendido) borra su perfil', $q$delete from public.profiles where id=auth.uid()$q$, false);
select pg_temp.try('A inserta perfil con XP', $q$insert into public.profiles(id,xp_total) values(auth.uid(),99999) on conflict (id) do nothing$q$, false);
select pg_temp.try('A update de su nombre (sigue permitido)', $q$update public.profiles set name='SecA2' where id=auth.uid()$q$, true);
select pg_temp.try('A reclama token del móvil', $q$select public.claim_push_token('ExponentPushToken[sec-device-1]','ios')$q$, true);
select pg_temp.try('A reclama token con formato inválido', $q$select public.claim_push_token('https://evil.example/x','ios')$q$, false);
set local request.jwt.claims = '{"sub":"cccccccc-0000-4000-8000-00000000000c","role":"authenticated"}';
select pg_temp.try('C ensureProfile: upsert solo id ON CONFLICT DO NOTHING', $q$insert into public.profiles(id) values(auth.uid()) on conflict (id) do nothing$q$, true);
select pg_temp.try('C ensureProfile repetido (ya existe)', $q$insert into public.profiles(id) values(auth.uid()) on conflict (id) do nothing$q$, true);
select pg_temp.try('C inserta perfil de otra persona', $q$insert into public.profiles(id) values('bbbbbbbb-0000-4000-8000-00000000000b') on conflict (id) do nothing$q$, false);
set local request.jwt.claims = '{"sub":"bbbbbbbb-0000-4000-8000-00000000000b","role":"authenticated"}';
select pg_temp.try('B (siguiente usuario del móvil) reclama el token', $q$select public.claim_push_token('ExponentPushToken[sec-device-1]','ios')$q$, true);
select pg_temp.try('B ejecuta handle_new_user', $q$select public.handle_new_user()$q$, false);
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
select pg_temp.try('anon reclama token', $q$select public.claim_push_token('ExponentPushToken[sec-device-2]','ios')$q$, false);
select pg_temp.try('anon lee profiles', $q$select 1 from public.profiles$q$, false);
reset role;
insert into res(k,v,ok) select 'A sigue suspendido', status, status='suspended' from public.social_profile_reviews where user_id='aaaaaaaa-0000-4000-8000-00000000000a';
insert into res(k,v,ok) select 'A conserva XP 0', xp_total::text, xp_total=0 from public.profiles where id='aaaaaaaa-0000-4000-8000-00000000000a';
insert into res(k,v,ok) select 'C tiene perfil con economía por defecto', format('xp=%s stones=%s', xp_total, protection_stones), xp_total=0 and protection_stones=0 from public.profiles where id='cccccccc-0000-4000-8000-00000000000c';
insert into res(k,v,ok) select 'token del móvil pasa a B', case user_id when 'bbbbbbbb-0000-4000-8000-00000000000b' then 'B' else 'otro' end, user_id='bbbbbbbb-0000-4000-8000-00000000000b' from public.push_tokens where token='ExponentPushToken[sec-device-1]';
insert into res(k,v,ok) select 'TRUNCATE para authenticated', count(*)::text, count(*)=0 from pg_class c where c.relnamespace='public'::regnamespace and c.relkind='r' and has_table_privilege('authenticated',c.oid,'TRUNCATE');
insert into res(k,v,ok) select 'TRUNCATE para anon', count(*)::text, count(*)=0 from pg_class c where c.relnamespace='public'::regnamespace and c.relkind='r' and has_table_privilege('anon',c.oid,'TRUNCATE');
select k, v, ok from res order by n;
