-- Test de 0035 (aplicar la migración sin begin/commit y ejecutar esto en una transacción que se revierte).
create temp table r(caso text, ok boolean, detalle text);
grant all on r to authenticated, anon;
insert into auth.users(id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
 ('00000000-0000-4000-8000-0000000c3a11','00000000-0000-0000-0000-000000000000','authenticated','authenticated','c3a11@example.invalid','{}','{}',now(),now()),
 ('00000000-0000-4000-8000-0000000c3a12','00000000-0000-0000-0000-000000000000','authenticated','authenticated','c3a12@example.invalid','{}','{}',now(),now());
delete from public.profiles where id in ('00000000-0000-4000-8000-0000000c3a11','00000000-0000-4000-8000-0000000c3a12');

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000c3a11","role":"authenticated"}';

-- Legítimo: ensureProfile (upsert id, ignoreDuplicates)
insert into public.profiles(id) values (auth.uid()) on conflict (id) do nothing;
insert into r select 'perfil_nace_con_id', count(*)=1, null from public.profiles where id=auth.uid();

-- E1: no se puede crear con XP ni borrar
do $$ begin
  begin insert into public.profiles(id, xp_total) values ('00000000-0000-4000-8000-0000000c3a12', 999999);
    insert into r values ('E1_insert_xp_bloqueado', false, 'insertó');
  exception when insufficient_privilege then insert into r values ('E1_insert_xp_bloqueado', true, sqlerrm); end;
  begin delete from public.profiles where id=auth.uid();
    insert into r values ('E1_delete_bloqueado', false, 'borró');
  exception when insufficient_privilege then insert into r values ('E1_delete_bloqueado', true, sqlerrm); end;
end $$;

-- Primer cierre (inicializa): legítimo
select public.apply_day_close_safe(current_date-6);
insert into r select 'cierre_inicial', last_day_processed=current_date-6, last_day_processed::text from public.profiles where id=auth.uid();

-- XP legítimo: misión media completada hoy
insert into public.quests(id,user_id,title,stat,difficulty,days_of_week) values ('00000000-0000-4000-8000-00000000c3c1',auth.uid(),'Leer','INT','media','{1,2,3,4,5,6,7}');
select public.complete_quest('00000000-0000-4000-8000-00000000c3c1', current_date, 50, 0, true, null);
-- E5: pagar de más se recorta
insert into public.quests(id,user_id,title,stat,difficulty,days_of_week) values ('00000000-0000-4000-8000-00000000c3c2',auth.uid(),'Escribir informe','INT','epica','{1,2,3,4,5,6,7}');
select public.complete_quest('00000000-0000-4000-8000-00000000c3c2', current_date, 50000, 0, true, null);
insert into r select 'E5_pago_recortado_469', xp_total=50+469, xp_total::text from public.profiles where id=auth.uid();
-- E2: replay de completion bloqueado
do $$ begin
  begin delete from public.completions where user_id=auth.uid();
    insert into r values ('E2_delete_completion_bloqueado', false, 'borró');
  exception when insufficient_privilege then insert into r values ('E2_delete_completion_bloqueado', true, sqlerrm); end;
end $$;
do $$ begin
  begin perform public.complete_quest('00000000-0000-4000-8000-00000000c3c1', current_date-30, 50, 0, true, null);
    insert into r values ('complete_fecha_antigua_rechazada', false, 'aceptó');
  exception when others then insert into r values ('complete_fecha_antigua_rechazada', true, sqlerrm); end;
end $$;

-- E3: cierre de 5 días con penalización 150, dos veces con el mismo estado
select public.apply_day_close_safe(current_date-1, 0, 0, 150, false, 0);
select public.apply_day_close_safe(current_date-1, 0, 0, 150, false, 0);
insert into r select 'E3_doble_cierre_descuenta_una_vez', xp_total=519-150, xp_total::text from public.profiles where id=auth.uid();

-- E6: el cliente antiguo inserta la recuperación dos veces
insert into public.quests(user_id,title,stat,difficulty,days_of_week,requires_evidence,is_penalty,penalty_date,penalty_xp)
  values (auth.uid(),'Misión de penalización','AGI','media','{}',false,true,current_date,150);
insert into public.quests(user_id,title,stat,difficulty,days_of_week,requires_evidence,is_penalty,penalty_date,penalty_xp)
  values (auth.uid(),'Misión de penalización','AGI','media','{}',false,true,current_date,150);
insert into r select 'E6_una_sola_recuperacion', count(*)=1, count(*)::text from public.quests where user_id=auth.uid() and is_penalty;
-- E5: forjar una penalización sin crédito no crea nada
insert into public.quests(user_id,title,stat,difficulty,days_of_week,requires_evidence,is_penalty,penalty_date,penalty_xp)
  values (auth.uid(),'Forja','AGI','media','{}',false,true,current_date,50000);
insert into r select 'E5_penalizacion_forjada_descartada', count(*)=0, count(*)::text from public.quests where user_id=auth.uid() and title='Forja';
do $$ begin
  begin update public.quests set penalty_xp=50000 where user_id=auth.uid() and is_penalty;
    insert into r values ('E5_update_penalizacion_bloqueado', false, 'actualizó');
  exception when insufficient_privilege then insert into r values ('E5_update_penalizacion_bloqueado', true, sqlerrm); end;
end $$;
select public.complete_quest(id, current_date, 50000, 0, false, null) from public.quests where user_id=auth.uid() and is_penalty;
insert into r select 'recuperacion_devuelve_150', xp_total=519, xp_total::text from public.profiles where id=auth.uid();

-- E4: forjas del cierre
do $$ begin
  begin perform public.apply_day_close_safe(current_date+3650, null, null, 0, false, null);
    insert into r values ('E4_futuro_rechazado', false, 'aceptó');
  exception when others then insert into r values ('E4_futuro_rechazado', true, sqlerrm); end;
  begin perform public.apply_day_close_safe(current_date-1, 100000, null, 0, false, null);
    insert into r values ('E4_racha_inflada_sin_efecto', (select streak_days<100000 from public.profiles where id=auth.uid()), 'replay');
  exception when others then insert into r values ('E4_racha_inflada_sin_efecto', true, sqlerrm); end;
  begin perform public.apply_day_close_safe('2000-01-01', null, null, 0, false, null);
    insert into r values ('E4_retroceso_sin_efecto', (select last_day_processed=current_date-1 from public.profiles where id=auth.uid()), 'no-op');
  exception when others then insert into r values ('E4_retroceso_sin_efecto', true, sqlerrm); end;
end $$;

-- Regla rota legítima (contract.ts): −25 y consecuencia de 25
select public.award_xp(-25, null, 'rule_broken', '{}'::jsonb);
insert into public.quests(user_id,title,stat,difficulty,days_of_week,requires_evidence,is_penalty,penalty_date,penalty_xp)
  values (auth.uid(),'Consecuencia: Ordenar el escritorio','AGI','media','{}',false,true,current_date,25);
insert into r select 'regla_rota_crea_consecuencia_25', count(*)=1, count(*)::text from public.quests where user_id=auth.uid() and title='Consecuencia: Ordenar el escritorio' and penalty_xp=25;

-- Penalización: solo su día
do $$ begin
  begin perform public.complete_quest(id, current_date-1, 25, 0, false, null) from public.quests
      where user_id=auth.uid() and title='Consecuencia: Ordenar el escritorio';
    insert into r values ('penalizacion_otro_dia_rechazada', false, 'aceptó');
  exception when others then insert into r values ('penalizacion_otro_dia_rechazada', true, sqlerrm); end;
end $$;

-- close_day_v2 (usuario 3): cierre + recuperación atómicos, carrera detectada
reset role;
insert into auth.users(id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
 ('00000000-0000-4000-8000-0000000c3a13','00000000-0000-0000-0000-000000000000','authenticated','authenticated','c3a13@example.invalid','{}','{}',now(),now());
insert into public.profiles(id) values ('00000000-0000-4000-8000-0000000c3a13') on conflict do nothing;
update public.profiles set xp_total=100, last_day_processed=current_date-3, streak_days=4 where id='00000000-0000-4000-8000-0000000c3a13';
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000c3a13","role":"authenticated"}';
create temp table v2(n int, res jsonb);
grant all on v2 to authenticated;
insert into v2 select 1, public.close_day_v2(current_date-3, current_date-1, 0, 0, 300, false, 0,
  '[{"title":"Misión de penalización","xp":150},{"title":"Consecuencia: 2 reglas rotas","xp":150}]'::jsonb);
insert into v2 select 2, public.close_day_v2(current_date-3, current_date-1, 0, 0, 300, false, 0,
  '[{"title":"Misión de penalización","xp":150}]'::jsonb);
insert into r select 'v2_aplica_una_vez', (select (res->>'applied')::boolean from v2 where n=1) and not (select (res->>'applied')::boolean from v2 where n=2), null;
insert into r select 'v2_descuenta_100_no_300', xp_total=0, xp_total::text from public.profiles where id=auth.uid();
insert into r select 'v2_recuperacion_igual_a_lo_perdido', coalesce(sum(penalty_xp),0)=100, string_agg(title||'='||penalty_xp, ', ')
  from public.quests where user_id=auth.uid() and is_penalty;
insert into r select 'v2_penalty_date_es_hoy_cliente', bool_and(penalty_date=current_date), null from public.quests where user_id=auth.uid() and is_penalty;

-- Aislamiento
set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000c3a12","role":"authenticated"}';
do $$ begin
  begin perform 1 from public.recovery_credits;
    insert into r values ('credito_cerrado_a_clientes', false, 'leyó');
  exception when insufficient_privilege then insert into r values ('credito_cerrado_a_clientes', true, sqlerrm); end;
end $$;
insert into r select 'quests_ajenas_invisibles', count(*)=0, count(*)::text from public.quests where user_id='00000000-0000-4000-8000-0000000c3a11';

set local role anon;
do $$ begin
  begin perform public.apply_day_close_safe(current_date-1);
    insert into r values ('anon_no_cierra', false, 'ejecutó');
  exception when others then insert into r values ('anon_no_cierra', true, sqlerrm); end;
end $$;
reset role;
reset role;
create temp table r2(caso text, ok boolean, detalle text);
grant all on r2 to authenticated;
insert into auth.users(id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
 ('00000000-0000-4000-8000-0000000c3a21','00000000-0000-0000-0000-000000000000','authenticated','authenticated','c3a21@example.invalid','{}','{}',now(),now());
insert into public.profiles(id) values ('00000000-0000-4000-8000-0000000c3a21') on conflict do nothing;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000c3a21","role":"authenticated"}';
insert into r2 values ('sin_consentimiento_salud', not public.health_consent_ok(auth.uid()), null);
do $$ begin
  begin perform public.start_trial(); insert into r2 values ('start_trial_sin_salud', true, 'ok');
  exception when others then insert into r2 values ('start_trial_sin_salud', false, sqlstate||' '||sqlerrm); end;
  begin insert into public.events(user_id,type,payload) values (auth.uid(),'pro_interest','{"plan":null,"tier":"pro"}'); insert into r2 values ('pro_interest_sin_salud', true, 'ok');
  exception when others then insert into r2 values ('pro_interest_sin_salud', false, sqlstate||' '||sqlerrm); end;
  begin insert into public.events(user_id,type,payload) values (auth.uid(),'weigh_in','{"weight":80}'); insert into r2 values ('weigh_in_sigue_bloqueado', false, 'aceptó');
  exception when others then insert into r2 values ('weigh_in_sigue_bloqueado', true, sqlerrm); end;
  begin insert into public.events(user_id,type,payload) values (auth.uid(),'tipo_nuevo','{}'); insert into r2 values ('tipo_desconocido_sigue_bloqueado', false, 'aceptó');
  exception when others then insert into r2 values ('tipo_desconocido_sigue_bloqueado', true, sqlerrm); end;
  begin insert into public.events(user_id,type,payload) values (auth.uid(),'pro_interest','{"tier":"pro","weight":80}'); insert into r2 values ('pro_interest_con_dato_salud_bloqueado', false, 'aceptó');
  exception when others then insert into r2 values ('pro_interest_con_dato_salud_bloqueado', true, sqlerrm); end;
  insert into public.events(user_id,type,payload) values (auth.uid(),'penalty','{"xp":150,"recuperacion":"fallida","missed":["Correr"]}');
end $$;
insert into r2 select 'trial_payload_ends_conservado', payload ? 'ends', payload::text from public.events where user_id=auth.uid() and type='trial_started';
insert into r2 select 'pro_interest_general_conservado', payload->>'tier'='pro' and health_data=false, payload::text from public.events where user_id=auth.uid() and type='pro_interest';
insert into r2 select 'penalty_recuperacion_si_missed_no', payload->>'recuperacion'='fallida' and not payload ? 'missed', payload::text from public.events where user_id=auth.uid() and type='penalty';

reset role;
select caso, ok, left(detalle, 90) detalle from r union all select caso, ok, left(detalle, 90) from r2;
