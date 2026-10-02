-- Test de a-01 (claim_push_token). Ejecutar DENTRO de una transacción que se
-- deshace (ayudante rosql de Chat 3). Salida: tabla res (k, v, ok).
create temp table res(n serial, k text, v text, ok boolean);
grant all on res to authenticated, anon;
grant all on sequence res_n_seq to authenticated, anon;

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

insert into auth.users(id, instance_id, aud, role, email, email_confirmed_at, raw_user_meta_data, raw_app_meta_data, created_at, updated_at) values
 ('aaaaaaaa-0000-4000-8000-00000000000a','00000000-0000-0000-0000-000000000000','authenticated','authenticated','sec-a@example.invalid',now(),'{}','{}',now(),now()),
 ('bbbbbbbb-0000-4000-8000-00000000000b','00000000-0000-0000-0000-000000000000','authenticated','authenticated','sec-b@example.invalid',now(),'{}','{}',now(),now());
create or replace function pg_temp.try(p_k text, p_sql text, p_debe_pasar boolean) returns void language plpgsql as $$
declare n bigint; begin
  execute p_sql; get diagnostics n = row_count;
  insert into res(k,v,ok) values(p_k, 'ejecutado, filas='||n, p_debe_pasar);
exception when others then insert into res(k,v,ok) values(p_k, 'denegado: '||left(sqlerrm,80), not p_debe_pasar);
end $$;
grant execute on function pg_temp.try(text,text,boolean) to authenticated, anon;
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-4000-8000-00000000000a","role":"authenticated"}';
select pg_temp.try('A reclama token del móvil', $q$select public.claim_push_token('ExponentPushToken[sec-device-1]','ios')$q$, true);
select pg_temp.try('A reclama token con formato inválido', $q$select public.claim_push_token('https://evil.example/x','ios')$q$, false);
select pg_temp.try('A reclama con plataforma inválida', $q$select public.claim_push_token('ExponentPushToken[sec-device-9]','web')$q$, false);
set local request.jwt.claims = '{"sub":"bbbbbbbb-0000-4000-8000-00000000000b","role":"authenticated"}';
select pg_temp.try('B: el upsert de hoy sigue fallando (motivo de la RPC)', $q$insert into public.push_tokens(token,user_id,platform) values('ExponentPushToken[sec-device-1]',auth.uid(),'ios') on conflict (token) do update set user_id=excluded.user_id$q$, false);
select pg_temp.try('B (siguiente usuario del móvil) reclama el token', $q$select public.claim_push_token('ExponentPushToken[sec-device-1]','ios')$q$, true);
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
select pg_temp.try('anon reclama token', $q$select public.claim_push_token('ExponentPushToken[sec-device-2]','ios')$q$, false);
reset role;
insert into res(k,v,ok) select 'token del móvil pasa a B', case user_id when 'bbbbbbbb-0000-4000-8000-00000000000b' then 'B' else 'otro' end, user_id='bbbbbbbb-0000-4000-8000-00000000000b' from public.push_tokens where token='ExponentPushToken[sec-device-1]';
insert into res(k,v,ok) select 'filas del token', count(*)::text, count(*)=1 from public.push_tokens where token='ExponentPushToken[sec-device-1]';
select k, v, ok from res order by n;
