-- Test de la PROPUESTA c3-economia-cierre.sql. Se ejecuta tras aplicar la
-- migración (sin begin/commit) dentro de una transacción que se revierte.
-- Usuarios ficticios @example.invalid. Cada fila de r es un caso: ok=true pasa.
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
select caso, ok, left(detalle, 90) detalle from r;
