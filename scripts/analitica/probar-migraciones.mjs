// NIVL · Prueba en local (sin base real) de las migraciones 0070-0072:
// embudo anónimo, opinión interna y métricas de admin. Monta un Postgres en
// memoria (PGlite) con un esqueleto mínimo de Supabase (roles, auth.uid(),
// las tablas que leen las RPC y un export_my_data falso con sus huellas),
// aplica las tres migraciones y comprueba RLS, lista blanca, límites,
// exportación y borrado de cuenta. No toca ningún proyecto de Supabase.
//
// PGlite NO es dependencia del proyecto. Para ejecutarla:
//   mkdir /tmp/pg && cd /tmp/pg && npm i @electric-sql/pglite@0.2.17
//   cp <repo>/scripts/analitica/probar-migraciones.mjs . && node probar-migraciones.mjs <repo>/supabase/migrations
// Sale con código 1 si algo falla.
// eslint-disable-next-line import/no-unresolved -- PGlite se instala aparte (ver arriba)
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
const MIG = process.argv[2];
const db = new PGlite();
const q = async (sql, p) => { try { return await db.query(sql, p); } catch (e) { throw new Error(sql.slice(0, 120) + ' => ' + e.message); } };
const ex = async (sql) => { try { return await db.exec(sql); } catch (e) { throw new Error('EXEC => ' + e.message); } };
await ex(`
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create schema auth;
create table auth.users (id uuid primary key default gen_random_uuid(), email text);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
grant usage on schema auth to anon, authenticated; grant execute on function auth.uid() to anon, authenticated;
grant usage on schema public to anon, authenticated;
create table public.profiles (id uuid primary key references auth.users on delete cascade, created_at timestamptz default now(), last_open_on date, onboarding_done boolean default false);
create table public.quests (id uuid primary key default gen_random_uuid(), user_id uuid references auth.users on delete cascade, created_at timestamptz default now());
create table public.completions (id uuid primary key default gen_random_uuid(), user_id uuid references auth.users on delete cascade, date date);
create table public.events (id uuid primary key default gen_random_uuid(), user_id uuid references auth.users on delete cascade, type text, created_at timestamptz default now());
create table public.subscriptions (user_id uuid primary key references auth.users on delete cascade, status text, plan text, provider text, current_period_end timestamptz, updated_at timestamptz default now());
create table public.store_sales (id uuid primary key default gen_random_uuid(), user_id uuid, store text, product_id text, currency text, payment_number int, price_cents int, net_cents int, purchased_at timestamptz, refunded_at timestamptz);
create table public.gym_sessions (user_id uuid, date date);
create table public.cardio_sessions (user_id uuid, date date);
create table public.nutrition_logs (user_id uuid, date date);
create table public.body_metrics (user_id uuid, date date);
create table public.journal_entries (user_id uuid, date date);
create table public.transactions (user_id uuid, date date);
create table public.coach_messages (user_id uuid, role text, created_at timestamptz default now());
create table public.progress_photos (user_id uuid, created_at timestamptz default now());
create table public.dungeons (user_id uuid, created_at timestamptz default now());
create table public.friendships (requester uuid, created_at timestamptz default now());
create table public.app_config (key text primary key, value jsonb not null, public boolean not null default false, updated_at timestamptz default now());
create function public.export_my_data() returns jsonb language plpgsql security definer as $$ begin if auth.uid() is null then raise exception 'x'; end if; return jsonb_build_object('app','NIVL','version',7,'profiles','[]'::jsonb); end $$;
comment on function public.export_my_data() is 'Owner-only rights export v7; nivl:export-completo-v4 nivl:export-v5 nivl:export-v6 nivl:store-cleanup-export-0064';
grant execute on function public.export_my_data() to authenticated;
`);
for (const f of ['0070_funnel_events.sql', '0071_app_feedback.sql', '0072_admin_metricas.sql']) {
  await ex(readFileSync(MIG + '/' + f, 'utf8'));
  console.log('aplicada', f);
}
const ok = (c, m) => { if (!c) { console.error('FALLO:', m); process.exitCode = 1; } else console.log('ok', m); };
const como = async (rol, uid, sql, p) => {
  await ex(`reset role; select set_config('request.jwt.claim.sub', '${uid ?? ''}', false); set role ${rol};`);
  try { return await db.query(sql, p); } finally { await ex('reset role'); }
};
const falla = async (rol, uid, sql, p, re) => {
  try { await como(rol, uid, sql, p); return false; } catch (e) { if (re && !re.test(e.message)) console.log('   (mensaje:', e.message, ')'); return re ? re.test(e.message) : true; }
};
const [{ id: u1 }] = (await q(`insert into auth.users(email) values ('a@x.es') returning id`)).rows;
const [{ id: u2 }] = (await q(`insert into auth.users(email) values ('b@x.es') returning id`)).rows;
await q(`insert into profiles(id) values ($1),($2)`, [u1, u2]);
const INST = 'abcdef12-3456-4789-abcd-ef1234567890';
const INST2 = 'zzzzef12-3456-4789-abcd-ef1234567890';
let r = await como('anon', null, `select registrar_evento($1,'primer_arranque','{}'::jsonb,'1.0.10','ios',null) ok`, [INST]);
ok(r.rows[0].ok === true, 'anon registra primer_arranque');
await como('anon', null, `select registrar_evento($1,'onboarding_paso','{"paso":2}'::jsonb,'1.0.10','ios',now()-interval '2 hours')`, [INST]);
await como('authenticated', u1, `select registrar_evento($1,'apertura_dia','{"dia":1}'::jsonb,'1.0.10','android',now()-interval '90 days')`, [INST]);
ok(true, 'auth registra');
ok(await falla('anon', null, `select registrar_evento($1,'hackeo','{}'::jsonb)`, [INST], /no admitido/), 'evento fuera de lista');
ok(await falla('anon', null, `select registrar_evento($1,'registro','{"email":"a@b.es"}'::jsonb)`, [INST], /props/), 'clave fuera de lista');
ok(await falla('anon', null, `select registrar_evento($1,'registro','{"resultado":"Juan Pérez"}'::jsonb)`, [INST], /props/), 'texto libre rechazado');
ok(await falla('anon', null, `select registrar_evento($1,'registro','{"resultado":"a@b.es"}'::jsonb)`, [INST], /props/), 'correo rechazado');
ok(await falla('anon', null, `select registrar_evento($1,'apertura_dia','{"dia":1.5}'::jsonb)`, [INST], /props/), 'decimal rechazado');
ok(await falla('anon', null, `select registrar_evento($1,'apertura_dia','{"dia":{"x":1}}'::jsonb)`, [INST], /props/), 'objeto rechazado');
ok(await falla('anon', null, `select registrar_evento('corto','primer_arranque','{}'::jsonb)`, [], /install_id/), 'install_id corto');
ok(await falla('anon', null, `select count(*) from funnel_events`, [], /permission/), 'anon no lee');
ok(await falla('authenticated', u1, `select count(*) from funnel_events`, [], /permission/), 'auth no lee');
ok(await falla('authenticated', u1, `insert into funnel_events(install_id,evento) values ('${INST}','registro')`, [], /permission/), 'auth no inserta directo');
r = await q(`select user_id, created_at > now()-interval '1 day' reciente, app_version, plataforma from funnel_events where evento='apertura_dia'`);
ok(r.rows[0].user_id === u1 && r.rows[0].reciente, 'user_id del servidor y fecha antigua acotada');
r = await q(`select created_at < now()-interval '1 hour' antes from funnel_events where evento='onboarding_paso'`);
ok(r.rows[0].antes, 'hora del móvil reciente se respeta');
await q(`insert into funnel_events(install_id,evento) select $1,'apertura_dia' from generate_series(1,120)`, [INST2]);
r = await como('anon', null, `select registrar_evento($1,'primer_arranque','{}'::jsonb) ok`, [INST2]);
ok(r.rows[0].ok === false, 'límite por hora devuelve false');
await q(`delete from funnel_events where install_id=$1`, [INST2]);
await como('authenticated', u1, `insert into app_feedback(gusta, cambiaria, version) values ('Las misiones','Más colores','1.0.10')`);
ok(await falla('authenticated', u1, `insert into app_feedback(user_id, gusta) values ($1,'x')`, [u2]), 'no inserta la de otro');
ok(await falla('authenticated', u1, `select * from app_feedback`), 'no lee opiniones');
ok(await falla('anon', null, `insert into app_feedback(gusta) values ('x')`), 'anon no opina');
ok(await falla('authenticated', u1, `insert into app_feedback(gusta, cambiaria) values ('  ', null)`), 'vacía rechazada');
await como('authenticated', u1, `insert into app_feedback(gusta) values ('b')`);
await como('authenticated', u1, `insert into app_feedback(gusta) values ('c')`);
ok(await falla('authenticated', u1, `insert into app_feedback(gusta) values ('d')`, [], /Demasiadas/), 'tope diario');
ok(await falla('authenticated', u1, `select admin_resumen()`, [], /Solo admin/), 'no admin no ve resumen');
ok(await falla('anon', null, `select admin_resumen()`, [], /permission/), 'anon no ejecuta admin');
r = await como('authenticated', u1, `select es_admin() a`); ok(r.rows[0].a === false, 'es_admin false');
ok(await falla('authenticated', u1, `select * from admins`, [], /permission/), 'admins cerrada');
await q(`insert into admins(user_id) values ($1)`, [u2]);
r = await como('authenticated', u2, `select es_admin() a`); ok(r.rows[0].a === true, 'es_admin true');
await q(`insert into completions(user_id,date) values ($1,current_date)`, [u1]);
await q(`insert into subscriptions(user_id,status,plan,provider,current_period_end) values ($1,'active','pro_mensual','apple',now()+interval '20 days')`, [u1]);
await q(`insert into store_sales(user_id,store,product_id,currency,payment_number,price_cents,net_cents,purchased_at) values ($1,'apple','nivl_pro_mensual','EUR',1,999,600,now())`, [u1]);
for (const sql of [`select admin_resumen() x`, `select * from admin_altas_por_dia(null,null)`, `select * from admin_embudo(null,null)`,
  `select * from admin_donde_se_quedan(null,null)`, `select * from admin_retencion(null,null)`, `select * from admin_misiones_por_dia(current_date-3,current_date)`,
  `select * from admin_uso_modulos(null,null)`, `select admin_conversiones(null,null) x`, `select * from admin_opiniones(10,null)`]) {
  r = await como('authenticated', u2, sql); console.log(sql, JSON.stringify(r.rows).slice(0, 300));
}
await como('anon', null, `select registrar_evento('previo00-3456-4789-abcd-ef1234567890','primer_arranque','{"previo":true}'::jsonb)`);
r = await como('authenticated', u2, `select admin_resumen() x`);
ok(r.rows[0].x.instalaciones === 1 && r.rows[0].x.instalaciones_previas === 1, 'quien venía de antes no cuenta como instalación nueva');
r = await como('authenticated', u2, `select instalaciones from admin_embudo(null,null) where paso='primer_arranque'`);
ok(Number(r.rows[0].instalaciones) === 1, 'embudo sin previas');
ok(await falla('authenticated', u2, `select * from admin_embudo('2020-01-01','2026-01-01')`, [], /366/), 'ventana máxima');
r = await como('authenticated', u2, `select * from admin_opiniones(10,null)`); ok(!('user_id' in r.rows[0]), 'opiniones sin user_id');
r = await como('authenticated', u1, `select export_my_data() x`);
const x = r.rows[0].x; ok(x.version === 7 && x.profiles && x.funnel_events.length === 1 && x.app_feedback.length === 3 && Array.isArray(x.admins), 'export con claves nuevas');
r = await q(`select obj_description(to_regprocedure('public.export_my_data()'),'pg_proc') c`); console.log(r.rows[0].c);
ok(/nivl:store-cleanup-export-0064/.test(r.rows[0].c) && /nivl:export-analitica-0072/.test(r.rows[0].c), 'huellas conservadas');
ok(await falla('authenticated', u1, `select export_my_data_antes_0072()`, [], /permission/), 'la base envuelta no es pública');
await q(`insert into funnel_events(install_id,evento) values ($1,'primer_arranque')`, ['otraotra-3456-4789-abcd-ef1234567890']);
await q(`delete from auth.users where id=$1`, [u1]);
r = await q(`select install_id, user_id from funnel_events`);
ok(r.rows.every((y) => y.install_id !== INST), 'borrado de cuenta se lleva la instalación entera');
ok(r.rows.length === 2, 'otras instalaciones intactas');
r = await q(`select count(*)::int n from app_feedback`); ok(r.rows[0].n === 0, 'opiniones borradas');
r = await q(`select value from app_config where key='analitica_activa'`); ok(r.rows[0].value === false, 'flag sembrado apagado');
r = await q(`select value from app_config where key='opinion_activa'`); ok(r.rows[0].value === false, 'flag de opinión sembrado apagado');
