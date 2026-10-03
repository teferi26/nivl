-- Prueba de 0054 (Chat 3). Se ejecuta con rosql.mjs (BEGIN…ROLLBACK): migración aplicada dos veces + casos.
-- Cuerpo de la migración: supabase/migrations/0054_lista_espera.sql (se pega dos veces delante).
create temp table r (k text, v text);
grant all on r to anon, authenticated, service_role;
-- service_role
set local role service_role;
insert into r select 'alta1', public.waitlist_join(' Ana.Prueba@Example.INVALID ', 'espera-v1', 'c:CODIGO1', '1.2.3.4');
insert into r select 'alta_dup', public.waitlist_join('ana.prueba@example.invalid', 'espera-v1', 'bio', '5.6.7.8');
insert into r select 'filas_ana', (select count(*)||' '||max(source)||' '||max(consent_version) from public.waitlist where email='ana.prueba@example.invalid');
insert into r select 'correo_malo', public.waitlist_join('no-es-correo', 'espera-v1', null, '1.2.3.4');
insert into r select 'origen_malo', public.waitlist_join('b@example.invalid', 'espera-v1', '<script>', '9.9.9.9');
insert into r select 'origen_malo_null', (select coalesce(source,'NULL') from public.waitlist where email='b@example.invalid');
-- freno por correo: 3 por hora (ana ya lleva 2)
insert into r select 'em3', public.waitlist_join('ana.prueba@example.invalid', 'espera-v1', null, '7.7.7.7');
insert into r select 'em4', public.waitlist_join('ana.prueba@example.invalid', 'espera-v1', null, '8.8.8.8');
-- freno por IP: 5 en 10 min (1.2.3.4 lleva 2)
insert into r select 'ip3', public.waitlist_join('c3@example.invalid', 'espera-v1', null, '1.2.3.4');
insert into r select 'ip4', public.waitlist_join('c4@example.invalid', 'espera-v1', null, '1.2.3.4');
insert into r select 'ip5', public.waitlist_join('c5@example.invalid', 'espera-v1', null, '1.2.3.4');
insert into r select 'ip6', public.waitlist_join('c6@example.invalid', 'espera-v1', null, '1.2.3.4');
insert into r select 'ip7', public.waitlist_join('c7@example.invalid', 'espera-v1', null, '1.2.3.4');
insert into r select 'c7_no_guardado', (select count(*)::text from public.waitlist where email='c7@example.invalid');
insert into r select 'sales', (select count(*)::text from public.waitlist_salt);
insert into r select 'c6_guardado', (select count(*)::text from public.waitlist where email='c6@example.invalid');
insert into r select 'sin_ip_en_claro', (select count(*)::text from public.waitlist_throttle where bucket like '%1.2.3.4%');
do $$ begin perform public.waitlist_join('d@example.invalid', 'VERSION MALA', null, '1'); insert into r values ('version_mala','ACEPTADA');
exception when others then insert into r values ('version_mala','rechazada'); end $$;
reset role;
-- authenticated y anon
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated"}';
do $$ begin perform public.waitlist_join('e@example.invalid','espera-v1',null,'1'); insert into r values ('auth.rpc','EJECUTA');
exception when others then insert into r values ('auth.rpc', sqlstate); end $$;
do $$ begin perform 1 from public.waitlist limit 1; insert into r values ('auth.tabla','LEIDA');
exception when others then insert into r values ('auth.tabla', sqlstate); end $$;
do $$ begin perform 1 from public.waitlist_salt limit 1; insert into r values ('auth.sal','LEIDA');
exception when others then insert into r values ('auth.sal', sqlstate); end $$;
reset role;
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
do $$ begin perform public.waitlist_join('f@example.invalid','espera-v1',null,'1'); insert into r values ('anon.rpc','EJECUTA');
exception when others then insert into r values ('anon.rpc', sqlstate); end $$;
do $$ begin insert into public.waitlist (email, consent_version) values ('g@example.invalid','espera-v1'); insert into r values ('anon.insert','ESCRIBE');
exception when others then insert into r values ('anon.insert', sqlstate); end $$;
reset role;
select k, v from r order by k;
