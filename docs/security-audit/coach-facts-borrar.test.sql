-- Prueba de la RLS de coach_facts para borrarHecho (src/lib/coach.ts). rosql.mjs (BEGIN…ROLLBACK).
-- 04/10/2026 en producción: «A borra el de B» = 0, «A borra el suyo» = 1, queda «hecho de B». No hace falta migración.
create temp table r (k text, v text);
grant all on r to authenticated;
insert into auth.users (id, instance_id, aud, role, email) values
 ('00000000-0000-4000-8000-0000000000a1','00000000-0000-0000-0000-000000000000','authenticated','authenticated','a@example.invalid'),
 ('00000000-0000-4000-8000-0000000000b2','00000000-0000-0000-0000-000000000000','authenticated','authenticated','b@example.invalid');
insert into public.profiles (id) select id from auth.users where email in ('a@example.invalid','b@example.invalid') on conflict do nothing;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated"}';
select public.accept_health_consent('2026-09-27-salud-v1');
insert into public.coach_facts (id, user_id, date, category, content, source) values ('00000000-0000-4000-8000-00000000fa01','00000000-0000-4000-8000-0000000000a1', current_date, 'proyecto', 'hecho de A', 'coach');
set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000000b2","role":"authenticated"}';
select public.accept_health_consent('2026-09-27-salud-v1');
insert into public.coach_facts (id, user_id, date, category, content, source) values ('00000000-0000-4000-8000-00000000fb01','00000000-0000-4000-8000-0000000000b2', current_date, 'proyecto', 'hecho de B', 'coach');
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated"}';
with d as (delete from public.coach_facts where id = '00000000-0000-4000-8000-00000000fb01' returning 1) insert into r select 'A borra el de B', count(*)::text from d;
with d as (delete from public.coach_facts where id = '00000000-0000-4000-8000-00000000fa01' returning 1) insert into r select 'A borra el suyo', count(*)::text from d;
reset role;
insert into r select 'quedan', string_agg(content, ',') from public.coach_facts where id::text like '00000000-0000-4000-8000-00000000f%';
select k, v from r order by k;
