-- Prueba de 0062 (rosql.mjs, BEGIN…ROLLBACK; migración aplicada dos veces). 04/10/2026 en producción:
-- A_borra_cuenta: filas=1 reporter=NULL displayed=«Nombre ofensivo» status=open; dos_anonimas_abiertas=2; B_borra_cuenta=0; huella=true.
create temp table r (k text, v text);
insert into auth.users (id, instance_id, aud, role, email) values
 ('00000000-0000-4000-8000-0000000000a1','00000000-0000-0000-0000-000000000000','authenticated','authenticated','a@example.invalid'),
 ('00000000-0000-4000-8000-0000000000b2','00000000-0000-0000-0000-000000000000','authenticated','authenticated','b@example.invalid'),
 ('00000000-0000-4000-8000-0000000000c3','00000000-0000-0000-0000-000000000000','authenticated','authenticated','c@example.invalid');
insert into public.profiles (id) select id from auth.users where email in ('a@example.invalid','b@example.invalid','c@example.invalid') on conflict do nothing;
insert into public.social_reports (id, reporter, subject, reason, status, displayed_name) values
 ('00000000-0000-4000-8000-00000000d001','00000000-0000-4000-8000-0000000000a1','00000000-0000-4000-8000-0000000000b2','name','open','Nombre ofensivo'),
 ('00000000-0000-4000-8000-00000000d002','00000000-0000-4000-8000-0000000000c3','00000000-0000-4000-8000-0000000000b2','name','open','Nombre ofensivo');
-- quien denuncia borra su cuenta
delete from auth.users where id = '00000000-0000-4000-8000-0000000000a1';
insert into r select 'A_borra_cuenta', (select format('filas=%s reporter=%s displayed=%s status=%s', count(*), coalesce(max(reporter::text),'NULL'), max(displayed_name), max(status)) from public.social_reports where id='00000000-0000-4000-8000-00000000d001');
-- C también, y queda otra anónima abierta contra el mismo sujeto y motivo: el índice único admite dos null
delete from auth.users where id = '00000000-0000-4000-8000-0000000000c3';
insert into r select 'dos_anonimas_abiertas', (select count(*)::text from public.social_reports where subject='00000000-0000-4000-8000-0000000000b2' and reporter is null and status='open');
-- el denunciado borra su cuenta: sus denuncias se van con él (CASCADE)
delete from auth.users where id = '00000000-0000-4000-8000-0000000000b2';
insert into r select 'B_borra_cuenta', (select count(*)::text from public.social_reports where id in ('00000000-0000-4000-8000-00000000d001','00000000-0000-4000-8000-00000000d002'));
insert into r select 'huella', (select (confdeltype = 'n')::text from pg_constraint where conname = 'social_reports_reporter_fkey');
select k, v from r order by k;
