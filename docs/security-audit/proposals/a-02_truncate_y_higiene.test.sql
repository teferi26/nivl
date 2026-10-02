-- Test de a-02. Ejecutar DENTRO de una transacción que se deshace.
create temp table res(n serial, k text, v text, ok boolean);
insert into res(k,v,ok) select 'ANTES: TRUNCATE para authenticated', count(*)::text, count(*)>0 from pg_class c where c.relnamespace='public'::regnamespace and c.relkind='r' and has_table_privilege('authenticated',c.oid,'TRUNCATE');
revoke truncate on all tables in schema public from anon, authenticated;
alter default privileges for role postgres in schema public revoke truncate on tables from anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
insert into res(k,v,ok) select 'TRUNCATE para authenticated', count(*)::text, count(*)=0 from pg_class c where c.relnamespace='public'::regnamespace and c.relkind='r' and has_table_privilege('authenticated',c.oid,'TRUNCATE');
insert into res(k,v,ok) select 'TRUNCATE para anon', count(*)::text, count(*)=0 from pg_class c where c.relnamespace='public'::regnamespace and c.relkind='r' and has_table_privilege('anon',c.oid,'TRUNCATE');
create table public.sec_tmp_default_acl(x int);
insert into res(k,v,ok) select 'tabla nueva sin TRUNCATE para la API', (has_table_privilege('authenticated','public.sec_tmp_default_acl','TRUNCATE') or has_table_privilege('anon','public.sec_tmp_default_acl','TRUNCATE'))::text, not (has_table_privilege('authenticated','public.sec_tmp_default_acl','TRUNCATE') or has_table_privilege('anon','public.sec_tmp_default_acl','TRUNCATE'));
insert into res(k,v,ok) select 'tabla nueva conserva SELECT para authenticated', has_table_privilege('authenticated','public.sec_tmp_default_acl','SELECT')::text, has_table_privilege('authenticated','public.sec_tmp_default_acl','SELECT');
insert into res(k,v,ok) select 'handle_new_user no ejecutable por anon', has_function_privilege('anon','public.handle_new_user()','execute')::text, not has_function_privilege('anon','public.handle_new_user()','execute');
select k, v, ok from res order by n;
