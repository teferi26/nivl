-- Test de 0053 (en rollback). A con alias aprobado, B sin aprobar, C suspendido.
create temp table r(caso text, ok boolean, detalle text);
grant all on r to authenticated, anon;
insert into auth.users(id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select ('00000000-0000-4000-8000-0000000c3e0'||g)::uuid,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','c3e0'||g||'@example.invalid','{}','{}',now(),now() from generate_series(1,3) g;
insert into public.profiles(id) select ('00000000-0000-4000-8000-0000000c3e0'||g)::uuid from generate_series(1,3) g on conflict do nothing;
update public.profiles set name = 'Leónidas' where id = '00000000-0000-4000-8000-0000000c3e01';
update public.profiles set name = 'Nombre Real Secreto' where id = '00000000-0000-4000-8000-0000000c3e02';
update public.profiles set name = 'Suspendido' where id = '00000000-0000-4000-8000-0000000c3e03';
insert into public.social_profile_reviews(user_id, status, approved_name) values
 ('00000000-0000-4000-8000-0000000c3e01', 'approved', 'Leónidas'),
 ('00000000-0000-4000-8000-0000000c3e02', 'pending', null),
 ('00000000-0000-4000-8000-0000000c3e03', 'suspended', 'Suspendido')
on conflict (user_id) do update set status = excluded.status, approved_name = excluded.approved_name;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000c3e01","role":"authenticated"}';
insert into r select 'A_aprobado', (j->>'alias') = 'Leónidas' and (j->>'aprobado')::boolean, j::text from (select public.my_share_alias() j) x;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000c3e02","role":"authenticated"}';
insert into r select 'B_sin_aprobar_no_expone_nombre_real', (j->>'alias') like 'Gladiador %' and not (j->>'aprobado')::boolean and position('Secreto' in j::text) = 0, j::text from (select public.my_share_alias() j) x;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000c3e03","role":"authenticated"}';
insert into r select 'C_suspendido_alias_generico', (j->>'alias') like 'Gladiador %', j::text from (select public.my_share_alias() j) x;
insert into r select 'sin_datos_ajenos', position('Leónidas' in public.my_share_alias()::text) = 0, null;
set local role anon;
do $$ begin
  begin perform public.my_share_alias(); insert into r values ('anon_sin_acceso', false, 'ejecutó');
  exception when insufficient_privilege then insert into r values ('anon_sin_acceso', true, null); end;
end $$;
reset role;
select * from r;
