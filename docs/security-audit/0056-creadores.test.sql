-- Prueba de 0056 (NIVL - Seguridad). rosql.mjs (BEGIN…ROLLBACK): pegar delante el cuerpo de supabase/migrations/0056_creadores_borrado_exportacion.sql sin 'notify'.
-- Resultado 04/10/2026 en producción: huellas v4/v5/v6 true; X.creador con ficha, comisiones y liquidaciones; X.fugas null; Z.creador null;
-- Y re-vinculado sigue activo; X tras borrar la cuenta: active=f, alias «Creador retirado», notes null; contabilidad 1/1/1; código no aceptado.
create temp table r (k text, v text);
grant all on r to authenticated;
insert into auth.users (id, instance_id, aud, role, email) values
 ('00000000-0000-4000-8000-0000000000a1','00000000-0000-0000-0000-000000000000','authenticated','authenticated','x@example.invalid'),
 ('00000000-0000-4000-8000-0000000000b2','00000000-0000-0000-0000-000000000000','authenticated','authenticated','y@example.invalid'),
 ('00000000-0000-4000-8000-0000000000c3','00000000-0000-0000-0000-000000000000','authenticated','authenticated','z@example.invalid'),
 ('00000000-0000-4000-8000-0000000000d4','00000000-0000-0000-0000-000000000000','authenticated','authenticated','buyer@example.invalid');
insert into public.profiles (id) select id from auth.users where email like '%@example.invalid' and id::text like '00000000-0000-4000-8000-0000000000%' on conflict do nothing;
insert into public.creators (id, user_id, code, alias, monthly_fixed_cents, notes) values
 ('00000000-0000-4000-8000-00000000c0a1','00000000-0000-4000-8000-0000000000a1','ZZTESTX','ZZTEST X',1111,'NOTA-SECRETA-X'),
 ('00000000-0000-4000-8000-00000000c0b2','00000000-0000-4000-8000-0000000000b2','ZZTESTY','ZZTEST Y',0,'NOTA-Y');
insert into public.referrals (user_id, creator_id, source) values ('00000000-0000-4000-8000-0000000000d4','00000000-0000-4000-8000-00000000c0a1','enlace');
insert into public.store_sales (id, user_id, creator_id, store, transaction_id, original_transaction_id, product_id, payment_number, net_cents, purchased_at) values
 ('00000000-0000-4000-8000-0000000005a1','00000000-0000-4000-8000-0000000000d4','00000000-0000-4000-8000-00000000c0a1','manual','zz-tx-1','zz-tx-1',(select product_id from public.store_products limit 1),1,5000, now() - interval '2 days');
insert into public.creator_payouts (id, creator_id, kind, amount_cents, note) values ('00000000-0000-4000-8000-0000000007a1','00000000-0000-4000-8000-00000000c0a1','comisiones',3333,'IBAN-X');
insert into public.commissions (creator_id, sale_id, kind, rank, pct, cap_cents, amount_cents, status, available_at) values
 ('00000000-0000-4000-8000-00000000c0a1','00000000-0000-4000-8000-0000000005a1','primer_pago','novato',25,99999,1234,'pendiente', now() + interval '20 days');
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated"}';
insert into r select 'X.export.version', (public.export_my_data()->>'version');
insert into r select 'X.creador', (public.export_my_data()->'creador')::text;
insert into r select 'X.fugas', (select string_agg(m, ',') from unnest(array['0000000000d4','buyer@','IBAN-X','NOTA-SECRETA','0000005a1','0000007a1']) m where (public.export_my_data()->'creador')::text like '%'||m||'%');
set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000000c3","role":"authenticated"}';
insert into r select 'Z.creador', coalesce((public.export_my_data()->'creador')::text,'SQL NULL');
reset role;
-- re-vincular Y a otra cuenta: no desactiva
update public.creators set user_id = '00000000-0000-4000-8000-0000000000c3' where id = '00000000-0000-4000-8000-00000000c0b2';
insert into r select 'Y.revincular', (select format('active=%s alias=%s notes=%s', active, alias, coalesce(notes,'NULL')) from public.creators where id='00000000-0000-4000-8000-00000000c0b2');
-- borrar la cuenta de X (FK on delete set null)
delete from auth.users where id = '00000000-0000-4000-8000-0000000000a1';
insert into r select 'X.tras_borrar', (select format('user_id=%s active=%s alias=%s notes=%s', coalesce(user_id::text,'NULL'), active, alias, coalesce(notes,'NULL')) from public.creators where id='00000000-0000-4000-8000-00000000c0a1');
insert into r select 'X.contabilidad', (select format('commissions=%s payouts=%s referrals=%s', (select count(*) from public.commissions where creator_id='00000000-0000-4000-8000-00000000c0a1'), (select count(*) from public.creator_payouts where creator_id='00000000-0000-4000-8000-00000000c0a1'), (select count(*) from public.referrals where creator_id='00000000-0000-4000-8000-00000000c0a1')));
insert into r select 'X.codigo_aceptado', (select count(*)::text from public.creators where code='ZZTESTX' and active);
insert into r select 'huellas', format('v4=%s v5=%s v6=%s', obj_description('public.export_my_data()'::regprocedure,'pg_proc') like '%nivl:export-completo%', obj_description('public.export_my_data()'::regprocedure,'pg_proc') like '%nivl:export-v5%', obj_description('public.export_my_data()'::regprocedure,'pg_proc') like '%nivl:export-v6%');
select k, v from r order by k;
