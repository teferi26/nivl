-- Prueba de b-0035. Se ejecuta DENTRO de BEGIN…ROLLBACK (rosql.mjs), concatenada
-- DESPUÉS de b-0035 sin sus líneas begin/commit. Solo cuentas ficticias.
create temp table r(step text, result text); grant all on r to public;
insert into auth.users(id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values ('5ec0e000-0000-4000-8000-00000000000e','00000000-0000-0000-0000-000000000000','authenticated','authenticated','e-sim@example.invalid','',now(),now(),now(),'{}','{}'),
       ('5ec0f000-0000-4000-8000-00000000000f','00000000-0000-0000-0000-000000000000','authenticated','authenticated','f-sim@example.invalid','',now(),now(),now(),'{}','{}');
insert into public.friendships(requester,addressee,status) values('5ec0e000-0000-4000-8000-00000000000e','5ec0f000-0000-4000-8000-00000000000f','accepted');
insert into public.social_reports(reporter,subject,reason,status) values('5ec0e000-0000-4000-8000-00000000000e','5ec0f000-0000-4000-8000-00000000000f','name','open');
insert into public.push_tokens(token,user_id,platform) values('ExponentPushToken[sim-e]','5ec0e000-0000-4000-8000-00000000000e','ios');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"5ec0e000-0000-4000-8000-00000000000e","role":"authenticated"}',true);
create temp table d as select public.export_my_data() j;
reset role;
insert into r select '1 version (4)', j->>'version' from d;
insert into r select '2 claves del cliente actual presentes', (select bool_and(j ? t) from unnest(array['profiles','quests','completions','events','dungeons','dungeon_tasks','calendar_events','gym_days','gym_exercises','gym_sessions','gym_lifts','meal_slots','shopping_items','journal_entries','achievements','rules','rule_breaks','bonus_redemptions','journal_photos','letters','body_metrics','goals','coach_dossier','coach_facts','coach_threads','coach_messages','day_plans','day_blocks','cardio_sessions','nutrition_targets','nutrition_logs','training_prescriptions','money_accounts','transactions','category_rules','budgets','money_plan','quest_photos','recaps','rule_checks','body_profile','health_consents','health_state','health_erasure_jobs','ai_consents']) t)::text from d;
insert into r select '3 tablas con dueño SIN cubrir', coalesce((select string_agg(distinct c.table_name,',') from information_schema.columns c join information_schema.tables x using(table_schema,table_name)
  where c.table_schema='public' and x.table_type='BASE TABLE' and c.column_name in ('user_id','requester','reporter','blocker') and not (d.j ? c.table_name)
  and c.table_name not in ('ai_turn_locks','creators')),'ninguna') from d;
insert into r select '4 amistad sin uuid ajeno / filas', (not (j->'friendships')::text like '%5ec0f000%')::text || ' / ' || jsonb_array_length(j->'friendships') from d;
insert into r select '5 push_tokens propios', jsonb_array_length(j->'push_tokens')::text from d;
insert into r select '6 nada de la otra cuenta en todo el volcado', (not j::text like '%5ec0f000%')::text from d;
select jsonb_agg(jsonb_build_object('s',step,'r',result) order by step) from r;
