-- Test de c3-moderacion.sql (aplicar sin begin/commit, en una transacción que se revierte).
create temp table r(caso text, ok boolean, detalle text);
grant all on r to authenticated, anon, service_role;
insert into auth.users(id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
 ('00000000-0000-4000-8000-0000000c3a31','00000000-0000-0000-0000-000000000000','authenticated','authenticated','c3a31@example.invalid','{}','{}',now(),now()),
 ('00000000-0000-4000-8000-0000000c3a32','00000000-0000-0000-0000-000000000000','authenticated','authenticated','c3a32@example.invalid','{}','{}',now(),now());
-- Punto de partida limpio para el recuento de novedades.
-- now() es fijo en la transacción: un segundo antes para que lo de este test cuente como nuevo.
update public.moderation_alert_state set last_alert_at = now() - interval '1 second' where id = 1;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000c3a31","role":"authenticated"}';
insert into r select 'denuncia_ok', (public.report_ai_message('coach','00000000-0000-4000-8000-00000000c3d1','salud','Respuesta denunciada')->>'ok')::boolean, null;
insert into r select 'denuncia_repetida_idempotente', (public.report_ai_message('coach','00000000-0000-4000-8000-00000000c3d1','salud','Otra vez')->>'ok')::boolean, null;
do $$ begin
  begin perform public.report_ai_message('coach', null, 'spam', 'x'); insert into r values ('motivo_invalido_rechazado', false, 'aceptó');
  exception when others then insert into r values ('motivo_invalido_rechazado', true, sqlerrm); end;
  begin perform public.report_ai_message('oraculo', null, 'otro', '   '); insert into r values ('extracto_vacio_rechazado', false, 'aceptó');
  exception when others then insert into r values ('extracto_vacio_rechazado', true, sqlerrm); end;
  begin perform 1 from public.ai_reports; insert into r values ('tabla_cerrada_al_cliente', false, 'leyó');
  exception when insufficient_privilege then insert into r values ('tabla_cerrada_al_cliente', true, sqlerrm); end;
  begin perform public.moderation_digest(); insert into r values ('digest_no_para_clientes', false, 'ejecutó');
  exception when others then insert into r values ('digest_no_para_clientes', true, sqlerrm); end;
end $$;
-- Freno: 20 al día
select public.report_ai_message('oraculo', null, 'otro', 'n'||g) from generate_series(1,19) g;
insert into r select 'limite_diario', public.report_ai_message('oraculo', null, 'otro', 'una más')->>'reason' = 'limite', null;

set local role anon;
do $$ begin
  begin perform public.report_ai_message('coach', null, 'otro', 'x'); insert into r values ('anon_no_denuncia', false, 'ejecutó');
  exception when others then insert into r values ('anon_no_denuncia', true, sqlerrm); end;
end $$;

set local role service_role;
set local request.jwt.claims = '{"role":"service_role"}';
create temp table d as select public.moderation_digest() j;
insert into r select 'digest_cuenta_nuevas', (j->>'nuevos')::int >= 20, j::text from d;
insert into r select 'digest_sin_contenido', not (j::text ilike '%denunciada%'), null from d;
insert into r select 'digest_marca_aviso', (public.moderation_digest()->>'nuevos')::int = 0, null;
reset role;
select * from r;
