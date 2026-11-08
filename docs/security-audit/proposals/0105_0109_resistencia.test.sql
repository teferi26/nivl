-- Prueba de 0105-0109 (IRON Resistencia). Se ejecuta DENTRO de BEGIN…ROLLBACK, cuando ya están aplicadas. Solo cuentas ficticias.
create temp table r(step text, result text); grant all on r to public;
insert into auth.users(id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values ('5ec0a105-0000-4000-8000-00000000000a','00000000-0000-0000-0000-000000000000','authenticated','authenticated','r-a@example.invalid','',now(),now(),now(),'{}','{}'),
       ('5ec0b105-0000-4000-8000-00000000000b','00000000-0000-0000-0000-000000000000','authenticated','authenticated','r-b@example.invalid','',now(),now(),now(),'{}','{}');
insert into public.health_state(user_id,accepted,version) values('5ec0a105-0000-4000-8000-00000000000a',true,public.health_consent_version());

create temp table ids as select gen_random_uuid() entreno, gen_random_uuid() objetivo; grant all on ids to public;
create function pg_temp.falla(q text) returns text language plpgsql as $$
begin execute q; return 'ACEPTADO'; exception when others then return sqlerrm; end $$;

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"5ec0a105-0000-4000-8000-00000000000a","role":"authenticated"}',true);
insert into public.entrenos_medidos(id,origen,externo_id,deporte,fecha,inicio,fin,duracion_s,distancia_m,ruta)
  select entreno,'manual','humo-1','carrera',current_date,now()-interval '1 hour',now(),3600,10000,'[{"t":0,"lat":40.4,"lon":-3.6,"alt":null}]' from ids;
insert into public.objetivos_carrera(id,tipo,fecha,horas_semana,nivel) select objetivo,'olimpico',current_date+70,8,'intermedio' from ids;
insert into public.plan_sesiones(objetivo_id,semana,fecha,disciplina,titulo,hecha_entreno_id) select objetivo,1,current_date,'carrera','Rodaje',entreno from ids;
insert into public.entreno_bienestar(fecha,dolor) values(current_date,false);
insert into public.entreno_perfil(user_id,fc_max,ubicacion_lat,ubicacion_lon,ubicacion_consentida_en) values(auth.uid(),190,40.42,-3.70,now());
reset role;
insert into r select '01 duplicado por externo_id', (pg_temp.falla($q$insert into public.entrenos_medidos(user_id,origen,externo_id,deporte,fecha,inicio,fin,duracion_s) values('5ec0a105-0000-4000-8000-00000000000a','manual','humo-1','carrera',current_date,now()-interval '1 hour',now(),3600)$q$) like '%entrenos_medidos_externo_key%')::text;
insert into r select '02 ubicación sin redondear', (pg_temp.falla($q$update public.entreno_perfil set ubicacion_lat=40.423 where user_id='5ec0a105-0000-4000-8000-00000000000a'$q$) like '%check%')::text;
insert into r select '03 dos objetivos activos', (pg_temp.falla($q$insert into public.objetivos_carrera(user_id,tipo,fecha,horas_semana,nivel) values('5ec0a105-0000-4000-8000-00000000000a','10k',current_date+70,8,'intermedio')$q$) like '%objetivos_carrera_un_activo%')::text;

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"5ec0a105-0000-4000-8000-00000000000a","role":"authenticated"}',true);
create temp table d as select public.export_my_data() j;
reset role;
insert into r select '04 exportación con las cinco claves', (select bool_and(j ? t) from unnest(array['entrenos_medidos','entreno_perfil','entreno_bienestar','objetivos_carrera','plan_sesiones']) t)::text from d;
insert into r select '05 exportación con la ruta', (jsonb_array_length(j->'entrenos_medidos'->0->'ruta')=1)::text from d;
insert into r select '06 exportación sigue con IA', (j ? 'ai_cargos')::text from d;

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"5ec0b105-0000-4000-8000-00000000000b","role":"authenticated"}',true);
insert into r select '07 B sin permiso no lee', (count(*)=0)::text from public.entrenos_medidos;
insert into r select '08 B sin permiso no lee plan', (count(*)=0)::text from public.plan_sesiones;
insert into r select '09 B sin permiso no lee bienestar', (count(*)=0)::text from public.entreno_bienestar;
reset role;
insert into r select '10 B sin permiso no escribe', (position('sin_consentimiento' in pg_temp.falla($q$insert into public.entreno_bienestar(user_id,fecha) values('5ec0b105-0000-4000-8000-00000000000b',current_date)$q$))>0)::text;
insert into public.health_state(user_id,accepted,version) values('5ec0b105-0000-4000-8000-00000000000b',true,public.health_consent_version());
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"5ec0b105-0000-4000-8000-00000000000b","role":"authenticated"}',true);
insert into r select '11 B con permiso no ve lo de A', (count(*)=0)::text from public.entrenos_medidos;
reset role;
insert into r select '12 referencia ajena', (pg_temp.falla(format($q$insert into public.objetivos_carrera(user_id,tipo,fecha,horas_semana,nivel) values('5ec0b105-0000-4000-8000-00000000000b','10k',current_date+70,8,'intermedio'); insert into public.plan_sesiones(user_id,objetivo_id,semana,fecha,disciplina,titulo) values('5ec0b105-0000-4000-8000-00000000000b',%L,1,current_date,'carrera','x')$q$,(select objetivo from ids))) like '%Referencia ajena%')::text;

insert into public.health_erasure_jobs(user_id,status) values('5ec0a105-0000-4000-8000-00000000000a','pending');
select set_config('request.jwt.claims','{"sub":"5ec0a105-0000-4000-8000-00000000000a","role":"service_role"}',true);
select public.complete_health_erasure('5ec0a105-0000-4000-8000-00000000000a',(select id from public.health_erasure_jobs where user_id='5ec0a105-0000-4000-8000-00000000000a'));
insert into r select '13 borrado de salud vacía las cinco', ((select count(*) from public.entrenos_medidos where user_id='5ec0a105-0000-4000-8000-00000000000a')
  +(select count(*) from public.entreno_perfil where user_id='5ec0a105-0000-4000-8000-00000000000a')
  +(select count(*) from public.entreno_bienestar where user_id='5ec0a105-0000-4000-8000-00000000000a')
  +(select count(*) from public.objetivos_carrera where user_id='5ec0a105-0000-4000-8000-00000000000a')
  +(select count(*) from public.plan_sesiones where user_id='5ec0a105-0000-4000-8000-00000000000a')=0)::text;
insert into r select '14 infer_link brick y triatlón', (public.infer_link('Brick')='cardio' and public.infer_link('Entreno de triatlón')='cardio')::text;
insert into r select '14b infer_link carrera y piscina (0109)', (public.infer_link('Entreno de carrera')='cardio' and public.infer_link('Entrenamiento de carrera')='cardio' and public.infer_link('Entreno de piscina')='cardio' and public.infer_link('Entreno de carrera profesional')='gym')::text;
insert into r select '15 infer_link sigue conservador', (public.infer_link('Tirada de cartas')='ninguno' and public.infer_link('Entreno de ventas')='ninguno' and public.infer_link('Entrenar piernas')='gym')::text;
insert into r select '16 RLS en las cinco', (select bool_and(relrowsecurity) from pg_class where oid in ('public.entrenos_medidos'::regclass,'public.entreno_perfil'::regclass,'public.entreno_bienestar'::regclass,'public.objetivos_carrera'::regclass,'public.plan_sesiones'::regclass))::text;
select jsonb_agg(jsonb_build_object('s',step,'ok',result='true','r',result) order by step) from r;
