-- Prueba de b-0036. DENTRO de BEGIN…ROLLBACK (rosql.mjs), concatenada DESPUÉS de
-- b-0036 sin begin/commit. Solo cuentas y eventos ficticios.
create temp table r(step text, result text);
insert into auth.users(id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values ('5ec01000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','g-sim@example.invalid','',now(),now(),now(),'{}','{}'),
       ('5ec02000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','h-sim@example.invalid','',now(),now(),now(),'{}','{}');
insert into public.store_events(id,type,app_user_id,environment,payload) values
 ('sim-g-1','INITIAL_PURCHASE','5ec01000-0000-4000-8000-000000000001','SANDBOX',
  '{"app_user_id":"5ec01000-0000-4000-8000-000000000001","aliases":["5ec01000-0000-4000-8000-000000000001"],"subscriber_attributes":{"creator_code":{"value":"X"}},"transaction_id":"sim-t1"}'),
 ('sim-g-t','TRANSFER','$RCAnonymousID:sim','SANDBOX','{"transferred_from":["5ec01000-0000-4000-8000-000000000001"],"transferred_to":["5ec02000-0000-4000-8000-000000000002"]}'),
 ('sim-h-1','INITIAL_PURCHASE','5ec02000-0000-4000-8000-000000000002','SANDBOX','{"app_user_id":"5ec02000-0000-4000-8000-000000000002","transaction_id":"sim-t2"}');
insert into r select '1 testigo intacto al insertar', (select app_user_id from public.store_events where id='sim-h-1');
delete from auth.users where id='5ec01000-0000-4000-8000-000000000001';
insert into r select '2 tras borrar G: filas que aún lo mencionan', (select count(*) from public.store_events where app_user_id='5ec01000-0000-4000-8000-000000000001' or payload::text like '%5ec01000%')::text;
insert into r select '3 conserva id/type/environment/received_at', (select id||' / '||type||' / '||environment||' / '||(received_at is not null)::text||' / '||payload::text||' / '||note from public.store_events where id='sim-g-1');
insert into r select '4 TRANSFER que lo menciona también redactado', (select payload::text from public.store_events where id='sim-g-t');
insert into r select '5 testigo H sigue vinculado', (select app_user_id||' / '||(payload->>'transaction_id') from public.store_events where id='sim-h-1');
insert into public.store_events(id,type,app_user_id,environment,payload) values
 ('sim-g-2','RENEWAL','5ec01000-0000-4000-8000-000000000001','SANDBOX','{"app_user_id":"5ec01000-0000-4000-8000-000000000001","transaction_id":"sim-t3"}');
insert into r select '6 evento tardío de G llega redactado', (select coalesce(app_user_id,'null')||' / '||payload::text from public.store_events where id='sim-g-2');
insert into r select '7 idempotencia: el id sigue ocupando su clave', (select count(*) from public.store_events where id in ('sim-g-1','sim-g-2'))::text;
select jsonb_agg(jsonb_build_object('s',step,'r',result) order by step) from r;
