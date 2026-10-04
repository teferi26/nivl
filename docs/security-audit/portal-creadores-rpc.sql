create temp table r (k text, v text);
grant all on r to anon, authenticated;
insert into auth.users (id, instance_id, aud, role, email) values
 ('00000000-0000-4000-8000-0000000000a1','00000000-0000-0000-0000-000000000000','authenticated','authenticated','x@example.invalid'),
 ('00000000-0000-4000-8000-0000000000b2','00000000-0000-0000-0000-000000000000','authenticated','authenticated','y@example.invalid'),
 ('00000000-0000-4000-8000-0000000000c3','00000000-0000-0000-0000-000000000000','authenticated','authenticated','z@example.invalid'),
 ('00000000-0000-4000-8000-0000000000d4','00000000-0000-0000-0000-000000000000','authenticated','authenticated','buyer1@example.invalid'),
 ('00000000-0000-4000-8000-0000000000e5','00000000-0000-0000-0000-000000000000','authenticated','authenticated','buyer2@example.invalid');
insert into public.creators (id, user_id, code, alias, monthly_fixed_cents, notes) values
 ('00000000-0000-4000-8000-00000000c0a1','00000000-0000-4000-8000-0000000000a1','ZZTESTX','ZZTEST X',1111,'NOTA-SECRETA-X'),
 ('00000000-0000-4000-8000-00000000c0b2','00000000-0000-4000-8000-0000000000b2','ZZTESTY','ZZTEST Y',2222,'NOTA-SECRETA-Y');
insert into public.store_sales (id, user_id, creator_id, store, transaction_id, original_transaction_id, product_id, payment_number, net_cents, purchased_at) values
 ('00000000-0000-4000-8000-0000000005a1','00000000-0000-4000-8000-0000000000d4','00000000-0000-4000-8000-00000000c0a1','manual','zz-tx-1','zz-tx-1',(select product_id from public.store_products limit 1),1,5000, now() - interval '2 days'),
 ('00000000-0000-4000-8000-0000000005b2','00000000-0000-4000-8000-0000000000e5','00000000-0000-4000-8000-00000000c0b2','manual','zz-tx-2','zz-tx-2',(select product_id from public.store_products limit 1),1,5000, now() - interval '2 days');
insert into public.creator_payouts (id, creator_id, kind, amount_cents, note) values
 ('00000000-0000-4000-8000-0000000007a1','00000000-0000-4000-8000-00000000c0a1','comisiones',3333,'IBAN-X'),
 ('00000000-0000-4000-8000-0000000007b2','00000000-0000-4000-8000-00000000c0b2','comisiones',4444,'IBAN-Y');
insert into public.commissions (creator_id, sale_id, kind, rank, pct, cap_cents, amount_cents, status, available_at) values
 ('00000000-0000-4000-8000-00000000c0a1','00000000-0000-4000-8000-0000000005a1','primer_pago','novato',25,99999,1234,'pendiente', now() + interval '20 days'),
 ('00000000-0000-4000-8000-00000000c0b2','00000000-0000-4000-8000-0000000005b2','primer_pago','novato',25,99999,5678,'pendiente', now() + interval '20 days');

-- Creador X
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated"}';
insert into r select 'X.panel', public.creator_panel()::text;
insert into r select 'X.board', (select string_agg(b::text, ';') from public.creator_board() b where b::text like '%ZZTEST%');
insert into r select 'X.history', (select string_agg(h::text, ';') from public.creator_sales_history(1) h);
insert into r select 'X.progress', public.creator_progress()::text;
do $$ begin perform 1 from public.creators limit 1; insert into r values ('X.tabla_creators','LEIDA');
exception when others then insert into r values ('X.tabla_creators', sqlstate || ' ' || sqlerrm); end $$;
do $$ begin perform 1 from public.commissions limit 1; insert into r values ('X.tabla_commissions','LEIDA');
exception when others then insert into r values ('X.tabla_commissions', sqlstate || ' ' || sqlerrm); end $$;
do $$ begin perform 1 from public.creator_payouts limit 1; insert into r values ('X.tabla_payouts','LEIDA');
exception when others then insert into r values ('X.tabla_payouts', sqlstate || ' ' || sqlerrm); end $$;
-- Creador Y
set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000000b2","role":"authenticated"}';
insert into r select 'Y.panel', public.creator_panel()::text;
insert into r select 'Y.history', (select string_agg(h::text, ';') from public.creator_sales_history(1) h);
-- Usuario normal Z
set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000000c3","role":"authenticated"}';
insert into r select 'Z.panel', coalesce(public.creator_panel()::text, 'NULL');
insert into r select 'Z.board', coalesce((select count(*)::text from public.creator_board()), 'NULL');
insert into r select 'Z.history', (select count(*)::text from public.creator_sales_history(12));
insert into r select 'Z.progress', coalesce(public.creator_progress()::text, 'NULL');
insert into r select 'Z.period', (select count(*)::text from public.creator_board_period('mes'));
-- anon
reset role;
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
do $$ begin perform public.creator_panel(); insert into r values ('anon.panel','EJECUTA');
exception when others then insert into r values ('anon.panel', sqlstate); end $$;
do $$ begin perform public.creator_board(); insert into r values ('anon.board','EJECUTA');
exception when others then insert into r values ('anon.board', sqlstate); end $$;
do $$ begin perform public.creator_sales_history(12); insert into r values ('anon.history','EJECUTA');
exception when others then insert into r values ('anon.history', sqlstate); end $$;
reset role;
select k, v from r order by k;
