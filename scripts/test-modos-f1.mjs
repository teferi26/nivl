// NIVL · Modos F1 (servidor): 0066 a 0069 contra las migraciones REALES del repo, en PostgreSQL en memoria.
// Sin red, sin Supabase, sin credenciales y sin datos reales (cuentas ficticias *.invalid).
//
//   node scripts/test-modos-f1.mjs /ruta/a/@electric-sql/pglite/dist/index.js
//
// Qué demuestra:
//   1. «La 1.0.9 no se rompe»: el MISMO guion de un usuario sin modos ni locale (misiones normal, extra y de
//      penalización, doble toque, award_xp, exportación, y la matriz de planes de ai_state / user_tier /
//      ai_begin_turn) da resultados idénticos en una base hasta la 0065 y en otra con 0066 a 0069 aplicadas.
//   2. XP por modo: suma lo pagado a cada modo; nada con modes vacío, extra, penalización o doble toque.
//   3. RLS de app_config, user_modes, mode_xp y profiles.locale.
//   4. Prueba automática: apagada no nace; encendida nace, usa Haiku, tiene tope diario y caduca sin gracia;
//      nunca pisa una fila existente; una compra (evento o reconciliación, también sandbox) la sustituye.
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

if (!process.argv[2]) throw new Error('Indica la ruta de un módulo PGlite existente (este test no instala nada).');
const moduleUrl = pathToFileURL(resolve(process.argv[2]));
const { PGlite } = await import(moduleUrl.href);
const { pgcrypto } = await import(new URL('./contrib/pgcrypto.js', moduleUrl).href);
const root = new URL('../', import.meta.url);
const migrations = new URL('supabase/migrations/', root);

const STUBS = `
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create schema auth; create schema storage; create schema extensions;
create extension pgcrypto with schema extensions;
create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create function auth.role() returns text language sql stable as $$ select nullif(current_setting('request.jwt.claim.role',true),'') $$;
create function auth.jwt() returns jsonb language sql stable as $$ select jsonb_build_object('sub',auth.uid(),'role',auth.role()) $$;
create table storage.buckets(id text primary key,name text,public boolean default false,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,owner uuid,
  created_at timestamptz default now(), updated_at timestamptz default now(),metadata jsonb default '{}');
alter table storage.objects enable row level security;
create function storage.foldername(text) returns text[] language sql immutable as $$select string_to_array($1,'/')$$;
create publication supabase_realtime;
grant usage on schema public,auth,storage to anon,authenticated,service_role;
grant all on all tables in schema storage to anon,authenticated,service_role;
alter default privileges in schema public grant all on tables to anon,authenticated,service_role;
alter default privileges in schema public grant all on sequences to anon,authenticated,service_role;
`;

async function boot(hasta) {
  const db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(STUBS);
  const nombres = (await readdir(migrations)).filter((n) => /^\d{4}.*\.sql$/.test(n) && !n.startsWith('0010')).sort();
  for (const n of nombres) {
    if (Number(n.slice(0, 4)) > hasta) continue;
    try { await db.exec(await readFile(new URL(n, migrations), 'utf8')); }
    catch (e) { throw new Error(`Migración ${n}: ${e.message}`); }
  }
  return db;
}

let checks = 0;
const eq = (a, b, m) => { assert.deepEqual(a, b, m); checks++; };
const ok = (v, m) => { assert.ok(v, m); checks++; };

const as = async (db, uid) => {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub',$1,false), set_config('request.jwt.claim.role','authenticated',false)", [uid]);
  await db.exec('set role authenticated');
};
const asAnon = async (db) => {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub','',false), set_config('request.jwt.claim.role','anon',false)");
  await db.exec('set role anon');
};
const admin = async (db) => {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub','',false), set_config('request.jwt.claim.role','service_role',false)");
};
const one = async (db, sql, args = []) => Object.values((await db.query(sql, args)).rows[0] ?? {})[0];
const rejects = async (p, re, m) => { await assert.rejects(p, re, m); checks++; };

// Quita lo que cambia entre dos bases aunque el comportamiento sea el mismo (uuids aleatorios y relojes).
const VOLATIL = new Set(['id', 'created_at', 'completed_at', 'updated_at', 'exported_at', 'received_at', 'requested_at', 'started_at', 'friend_code']);
function normal(v) {
  if (Array.isArray(v)) return v.map(normal);
  if (v && typeof v === 'object') {
    const o = {};
    for (const k of Object.keys(v).sort()) if (!VOLATIL.has(k)) o[k] = normal(v[k]);
    return o;
  }
  return v;
}

const U = '11111111-1111-4111-8111-111111111111';
const Q = { normal: 'a0000000-0000-4000-8000-000000000001', extra: 'a0000000-0000-4000-8000-000000000002', castigo: 'a0000000-0000-4000-8000-000000000003' };

// El guion de un usuario de la 1.0.9: sin modos, sin locale, sin prueba.
async function guion109(db) {
  const out = {};
  await admin(db);
  await db.query("insert into auth.users(id,email,raw_user_meta_data) values($1,'u109@example.invalid','{\"full_name\":\"Prueba\"}')", [U]);
  const hoy = await one(db, "select (now() at time zone 'Europe/Madrid')::date::text");
  // La penalización solo nace de XP realmente perdido (0035): crédito de recuperación ficticio.
  await db.query('insert into recovery_credits(user_id,xp) values($1,100)', [U]);
  await as(db, U);
  await db.query(`insert into quests(id,title,stat,difficulty) values($1,'Leer 20 minutos','INT','media')`, [Q.normal]);
  await db.query(`insert into quests(id,title,stat,difficulty,is_bonus) values($1,'Escribir una carta','PER','facil',true)`, [Q.extra]);
  await db.query(`insert into quests(id,title,stat,difficulty,is_penalty,penalty_date,penalty_xp) values($1,'Recuperar el día','INT','media',true,$2,30)`, [Q.castigo, hoy]);
  out.c1 = await one(db, 'select complete_quest($1,$2::date,50,0,true,null)', [Q.normal, hoy]);
  out.c1doble = await one(db, 'select complete_quest($1,$2::date,50,0,true,null)', [Q.normal, hoy]);
  out.c2 = await one(db, 'select complete_quest($1,$2::date,0,5,true,null)', [Q.extra, hoy]);
  out.c3 = await one(db, 'select complete_quest($1,$2::date,999,0,false,null)', [Q.castigo, hoy]);
  out.award = await one(db, "select to_jsonb(award_xp(100,'INT','habit_acquired',jsonb_build_object('quest_id',$1::text)))", [Q.normal]);
  out.flags = await db.query('select xp_total,xp_int,xp_per,bonus_points from profiles where id=$1', [U]).then((r) => r.rows[0]);
  out.export = await one(db, 'select export_my_data()');
  await admin(db);
  out.subs = await one(db, 'select count(*)::int from subscriptions where user_id=$1', [U]);

  // Matriz de planes: el mismo usuario pasa por cada situación de la 0020/0024.
  await db.query("insert into coach_runs(user_id,kind,mode,model,cost_micro_usd,created_at) values($1,'chat','estandar','claude-haiku-4-5',30000,now()-interval '1 hour'),($1,'chat','profundo','claude-sonnet-5',90000,now()-interval '2 hours')", [U]);
  const casos = [
    ['sin fila', null],
    ['cortesia 7 dias viva', "('trialing','cortesia','manual',now()+interval '3 days')"],
    ['cortesia 7 dias caducada', "('trialing','cortesia','manual',now()-interval '1 hour')"],
    ['cortesia indefinida', "('active','cortesia','manual',null::timestamptz)"],
    ['pro anual', "('active','pro_anual','apple',now()+interval '200 days')"],
    ['pro en gracia', "('active','pro_mensual','apple',now()-interval '1 day')"],
    ['pro fuera de gracia', "('active','pro_mensual','apple',now()-interval '3 days')"],
    ['elite', "('active','elite_anual','apple',now()+interval '200 days')"],
    ['elite trial de tienda', "('trialing','cortesia','apple',now()+interval '5 days')"],
    ['owner', "('active','owner','manual',null::timestamptz)"],
    ['stripe cancelada', "('canceled','mensual','stripe',now()+interval '10 days')"],
  ];
  out.matriz = {};
  for (const [nombre, fila] of casos) {
    await db.query('delete from subscriptions where user_id=$1', [U]);
    if (fila) await db.query(`insert into subscriptions(user_id,status,plan,provider,current_period_end) select $1, s.* from (values ${fila}) s`, [U]);
    const fila109 = {};
    fila109.state = await one(db, 'select ai_state($1)', [U]);
    fila109.tier = await one(db, 'select user_tier($1)', [U]);
    fila109.est = await one(db, "select ai_begin_turn($1,'estandar')", [U]);
    await db.query('select ai_end_turn($1)', [U]);
    fila109.prof = await one(db, "select ai_begin_turn($1,'profundo')", [U]);
    await db.query('select ai_end_turn($1)', [U]);
    await as(db, U);
    fila109.status = await one(db, 'select ai_status()');
    await admin(db);
    out.matriz[nombre] = fila109;
  }
  return out;
}

const ARCHIVOS = await readdir(migrations);
const HAY_ANALITICA = ARCHIVOS.some((n) => n.startsWith('0072'));
// 1.0.11 (0085): interruptores por versión. La prueba nace con `prueba_auto_1011`; la clave vieja ya no enciende nada.
const HAY_1011 = ARCHIVOS.some((n) => n.startsWith('0085'));
const CLAVE_PRUEBA = HAY_1011 ? 'prueba_auto_1011' : 'prueba_auto_activa';
const CLAVES_1011 = { modos_1011: false, idiomas_1011: false, prueba_auto_1011: false, valoracion_1011: false, analitica_1011: false, opinion_1011: false };
// Integración v3: la 0075 (WORK) deja la v10 y la 0076 (FOCUS) la v11, que exporta todo.
const V_EXPORT = ARCHIVOS.some((n) => n.startsWith('0076')) ? 11 : ARCHIVOS.some((n) => n.startsWith('0075')) ? 10 : HAY_ANALITICA ? 9 : 8;
const CLAVES_NUEVAS = ['money_categories', 'money_recurring', 'money_briefs', 'focus_subjects', 'focus_exams', 'focus_topics',
  'focus_sessions', 'focus_classes', 'focus_grades', 'focus_decks', 'focus_cards'];
const antes = await boot(65);
const despues = await boot(9999);
try {
  // ── 1. Mismo comportamiento para un usuario 1.0.9 ──────────────────
  const a = await guion109(antes);
  const d = await guion109(despues);
  // Integración F1: con la 0072 de analítica la exportación es la v9 (la v8 de
  // la 0068 más funnel_events, app_feedback y admins). Sin las tablas de
  // analítica en el repo, la última es la v8 de la 0068.
  eq(d.export.version, V_EXPORT, `export v${V_EXPORT}`);
  if (HAY_ANALITICA) {
    eq(d.export.funnel_events, [], 'funnel_events vacío');
    eq(d.export.app_feedback, [], 'app_feedback vacío');
    eq(d.export.admins, [], 'admins vacío');
  }
  eq(a.export.version, 7, 'export v7 antes');
  eq(d.export.user_modes, [], 'user_modes vacío');
  eq(d.export.mode_xp, [], 'mode_xp vacío');
  eq(d.export.profiles[0].locale, null, 'locale nulo');
  ok(d.export.quests.every((q) => Array.isArray(q.modes) && q.modes.length === 0), 'quests.modes = {}');
  const dExp = structuredClone(d.export);
  delete dExp.version; delete dExp.user_modes; delete dExp.mode_xp;
  delete dExp.funnel_events; delete dExp.app_feedback; delete dExp.admins;
  for (const k of CLAVES_NUEVAS) { if (k in dExp) { eq(dExp[k], [], `${k} vacío`); delete dExp[k]; } }
  for (const p of dExp.profiles) delete p.locale;
  for (const q of dExp.quests) delete q.modes;
  const aExp = structuredClone(a.export); delete aExp.version;
  eq(normal(dExp), normal(aExp), 'exportación idéntica salvo las claves nuevas');
  // El perfil que devuelven las RPC gana la clave locale (null): aditivo, la 1.0.9 la ignora.
  const sinLocale = (perfil) => { eq(perfil.locale, null, 'locale nulo en el perfil devuelto'); const c = { ...perfil }; delete c.locale; return c; };
  for (const k of ['c1', 'c1doble', 'c2', 'c3']) {
    eq(normal({ ...d[k], profile: sinLocale(d[k].profile) }), normal(a[k]), `complete_quest ${k} idéntico`);
  }
  eq(normal(sinLocale(d.award)), normal(a.award), 'award_xp idéntico');
  eq(d.flags, a.flags, 'economía idéntica');
  eq(d.subs, 0, 'con el interruptor apagado no nace prueba');
  eq(a.subs, 0);
  for (const k of Object.keys(a.matriz)) {
    eq(normal(d.matriz[k]), normal(a.matriz[k]), `ai_state/user_tier/ai_begin_turn/ai_status idénticos: ${k}`);
  }
  eq(d.matriz['cortesia 7 dias viva'].state.trial, true);
  eq(d.matriz['pro en gracia'].tier, 'pro');
  eq(d.matriz['pro fuera de gracia'].tier, 'free');

  const db = despues;
  const hoy = await one(db, "select (now() at time zone 'Europe/Madrid')::date::text");
  const A = '22222222-2222-4222-8222-222222222222';
  const B = '33333333-3333-4333-8333-333333333333';
  await admin(db);
  await db.query("insert into auth.users(id,email) values($1,'a@example.invalid'),($2,'b@example.invalid')", [A, B]);
  await db.query('insert into recovery_credits(user_id,xp) values($1,100)', [A]);

  // ── 2. XP por modo ────────────────────────────────────────────────
  await as(db, A);
  const qm = 'b0000000-0000-4000-8000-000000000001', qs = 'b0000000-0000-4000-8000-000000000002';
  const qx = 'b0000000-0000-4000-8000-000000000003', qp = 'b0000000-0000-4000-8000-000000000004';
  await db.query("insert into quests(id,title,stat,difficulty,modes) values($1,'Estudiar tema 4','INT','media','{focus,work,focus}')", [qm]);
  await db.query("insert into quests(id,title,stat,difficulty) values($1,'Leer 20 minutos','INT','media')", [qs]);
  await db.query("insert into quests(id,title,stat,difficulty,is_bonus,modes) values($1,'Escribir','PER','facil',true,'{founder}')", [qx]);
  await db.query("insert into quests(id,title,stat,difficulty,is_penalty,penalty_date,penalty_xp,modes) values($1,'Recuperar','INT','media',true,$2,30,'{focus}')", [qp, hoy]);
  const rm = await one(db, 'select complete_quest($1,$2::date,60,0,true,null)', [qm, hoy]);
  const xpTrasModo = rm.profile.xp_total;
  eq(rm.awarded, true);
  eq(await one(db, 'select complete_quest($1,$2::date,60,0,true,null)', [qm, hoy]).then((r) => r.awarded), false, 'doble toque');
  await one(db, 'select complete_quest($1,$2::date,60,0,true,null)', [qs, hoy]);
  await one(db, 'select complete_quest($1,$2::date,0,5,true,null)', [qx, hoy]);
  const rp = await one(db, 'select complete_quest($1,$2::date,0,0,false,null)', [qp, hoy]);
  eq(rp.profile.xp_total, xpTrasModo + 60 + 30, 'xp_total cuenta todo como siempre');
  eq((await db.query('select mode, xp::int from mode_xp order by mode')).rows, [{ mode: 'focus', xp: 60 }, { mode: 'work', xp: 60 }],
    'solo la misión con modos suma, una vez por modo, sin extra ni penalización ni doble toque');
  await rejects(db.query("insert into quests(title,stat,difficulty,modes) values('x','INT','media','{general}')"), /quests_modes_check/, 'modo inválido');
  await rejects(db.query("insert into quests(title,stat,difficulty,modes) values('x','INT','media',array[null]::text[])"), /quests_modes_check/, 'modo nulo');
  await db.query("insert into quests(title,stat,difficulty,modes) values('Lote','INT','media',null)");
  eq(await one(db, "select modes from quests where title='Lote'"), [], 'NULL de supabase-js → {}');
  await rejects(db.query("insert into mode_xp(user_id,mode,xp) values($1,'iron',99999)", [A]), /permission denied/, 'el cliente no escribe mode_xp');
  await rejects(db.query("update mode_xp set xp=1"), /permission denied/);

  // ── 3. RLS ────────────────────────────────────────────────────────
  await db.query("insert into user_modes(mode) values('iron'),('focus')");
  await rejects(db.query("insert into user_modes(user_id,mode) values($1,'work')", [B]), /row-level security/, 'no escribe modos ajenos');
  await rejects(db.query("insert into user_modes(mode) values('general')"), /check/, 'general no se guarda');
  await db.query("update user_modes set enabled=false where mode='focus'");
  await as(db, B);
  eq(await one(db, 'select count(*)::int from user_modes'), 0, 'B no ve los modos de A');
  eq(await one(db, 'select count(*)::int from mode_xp'), 0, 'B no ve el XP por modo de A');
  eq((await db.query("update user_modes set enabled=true returning 1")).rows.length, 0, 'B no toca los modos de A');
  await db.query("update profiles set locale='en' where id=$1", [B]);
  eq(await one(db, 'select locale from profiles where id=$1', [B]), 'en');
  await db.query("update profiles set locale='pt-BR' where id=$1", [B]);
  await rejects(db.query("update profiles set locale='no es un idioma' where id=$1", [B]), /profiles_locale_check/);
  await rejects(db.query('update profiles set xp_total=999999 where id=$1', [B]), /permission denied/, 'la economía sigue cerrada');
  await as(db, A);
  eq(await one(db, 'select count(*)::int from user_modes where enabled'), 1);
  eq(await one(db, "select count(*)::int from mode_xp"), 2);
  await asAnon(db);
  await rejects(db.query('select * from user_modes'), /permission denied/);
  await rejects(db.query('select * from mode_xp'), /permission denied/);
  const flags = await one(db, 'select app_flags()');
  // Con la analítica integrada (0070, 0071) hay dos interruptores más, también apagados.
  const semillas = { idiomas_activos: false, modos_activos: false, prueba_auto_activa: false, prueba_auto_dias: 2, prueba_ia_mensajes_dia: 20, valoracion_activa: false };
  const conAnalitica = HAY_ANALITICA ? { ...semillas, analitica_activa: false, opinion_activa: false } : semillas;
  eq(flags, HAY_1011 ? { ...conAnalitica, ...CLAVES_1011 } : conAnalitica, 'semillas apagadas');
  await rejects(db.query("update app_config set value='true' where key='modos_activos'"), /permission denied/, 'anon no enciende');
  await rejects(db.query("insert into app_config(key,value,public) values('x','1',true)"), /permission denied/);
  await as(db, A);
  await rejects(db.query("update app_config set value='true' where key='modos_activos'"), /permission denied/, 'authenticated no enciende');
  await admin(db);
  await db.query("insert into app_config(key,value,public) values('secreto','1',false)");
  await asAnon(db);
  eq(await one(db, 'select count(*)::int from app_config'), (HAY_ANALITICA ? 8 : 6) + (HAY_1011 ? 6 : 0), 'anon solo lee lo público');
  eq('secreto' in (await one(db, 'select app_flags()')), false);
  await admin(db);
  await rejects(db.query('select app_config_value($1)', ['x']).then(async () => { await asAnon(db); return db.query("select app_config_value('modos_activos')"); }), /permission denied/);

  // Exportación de A: incluye sus tablas nuevas.
  await as(db, A);
  const expA = await one(db, 'select export_my_data()');
  eq(expA.user_modes.length, 2); eq(expA.mode_xp.length, 2);
  ok(!JSON.stringify(expA).includes(B), 'nada de B');

  // Borrado de cuenta: cascada.
  await admin(db);
  await db.query('delete from auth.users where id=$1', [A]);
  eq(await one(db, 'select count(*)::int from user_modes where user_id=$1', [A]), 0, 'borrado: user_modes');
  eq(await one(db, 'select count(*)::int from mode_xp where user_id=$1', [A]), 0, 'borrado: mode_xp');

  // ── 4. Prueba automática ───────────────────────────────────────────
  const P = '44444444-4444-4444-8444-444444444444', P2 = '55555555-5555-4555-8555-555555555555';
  const C = '66666666-6666-4666-8666-666666666666', S = '77777777-7777-4777-8777-777777777777';
  if (HAY_1011) {
    // La 1.0.10 no puede encender la prueba: su clave vieja ya no hace nada.
    await db.query(`update app_config set value='true' where key='prueba_auto_activa'`);
    await db.query("insert into auth.users(id,email) values($1,'vieja@example.invalid')", ['abababab-abab-4bab-8bab-abababababab']);
    eq(await one(db, 'select count(*)::int from subscriptions where user_id=$1', ['abababab-abab-4bab-8bab-abababababab']), 0, 'prueba_auto_activa ya no enciende');
    await db.query(`update app_config set value='false' where key='prueba_auto_activa'`);
  }
  await db.query(`update app_config set value='"true"' where key='${CLAVE_PRUEBA}'`);
  await db.query("insert into auth.users(id,email) values($1,'p0@example.invalid')", [P2]);
  eq(await one(db, 'select count(*)::int from subscriptions where user_id=$1', [P2]), 0, 'solo el booleano true enciende');
  await db.query(`update app_config set value='true' where key='${CLAVE_PRUEBA}'`);
  await db.query("insert into auth.users(id,email) values($1,'p@example.invalid')", [P]);
  const fila = (await db.query("select status,plan,provider,round(extract(epoch from current_period_end-now())/3600)::int as horas from subscriptions where user_id=$1", [P])).rows[0];
  eq(fila, { status: 'trialing', plan: 'prueba_auto', provider: 'prueba', horas: 48 }, 'nace la prueba de 2 días');
  let st = await one(db, 'select ai_state($1)', [P]);
  eq([st.entitled, st.trial, st.tier, st.routes.default, st.deep_allowed, st.tope_dia, st.mensajes_hoy, st.budget],
    [true, true, 'elite', 'claude-haiku-4-5', false, 20, 0, 1000000], 'Élite con Haiku, sin profundo, tope 20');
  eq(await one(db, 'select user_tier($1)', [P]), 'elite');
  eq((await one(db, "select ai_begin_turn($1,'estandar')", [P])).allowed, true); await db.query('select ai_end_turn($1)', [P]);
  eq((await one(db, "select ai_begin_turn($1,'profundo')", [P])).reason, 'profundo_no_incluido');
  await as(db, P);
  const status = await one(db, 'select ai_status()');
  eq([status.plan, status.trial, status.vision, 'routes' in status], ['prueba_auto', true, true, false], 'ai_status de la 1.0.9');
  eq(await one(db, 'select start_trial()'), { ok: false, reason: 'ya_usada' }, 'una prueba por cuenta');
  await admin(db);
  await db.query("insert into coach_runs(user_id,kind,model,cost_micro_usd) select $1,'chat','claude-haiku-4-5',1000 from generate_series(1,19)", [P]);
  await db.query("insert into coach_runs(user_id,kind,model,cost_micro_usd,error) values($1,'chat','claude-haiku-4-5',1000,'turn_failed'),($1,'brief','claude-haiku-4-5',1000,null)", [P]);
  eq((await one(db, "select ai_begin_turn($1,'estandar')", [P])).allowed, true, '19 mensajes: aún pasa (fallos y rituales no cuentan)');
  await db.query('select ai_end_turn($1)', [P]);
  await db.query("insert into coach_runs(user_id,kind,model,cost_micro_usd,created_at) values($1,'chat','claude-haiku-4-5',1000,now()-interval '2 days')", [P]);
  eq((await one(db, "select ai_begin_turn($1,'estandar')", [P])).allowed, true, 'los de otro día no cuentan');
  await db.query('select ai_end_turn($1)', [P]);
  await db.query("insert into coach_runs(user_id,kind,model,cost_micro_usd) values($1,'chat','claude-haiku-4-5',1000)", [P]);
  st = await one(db, "select ai_begin_turn($1,'estandar')", [P]);
  eq([st.allowed, st.reason, st.mensajes_hoy], [false, 'tope_diario', 20], 'tope diario');
  eq(await one(db, 'select count(*)::int from ai_turn_locks where user_id=$1', [P]), 0, 'el tope no toma el cerrojo');
  await db.query("update app_config set value='25' where key='prueba_ia_mensajes_dia'");
  eq((await one(db, "select ai_begin_turn($1,'estandar')", [P])).allowed, true, 'el tope se cambia sin desplegar');
  await db.query('select ai_end_turn($1)', [P]);
  await db.query("update app_config set value='\"mucho\"' where key='prueba_ia_mensajes_dia'");
  eq((await one(db, 'select ai_state($1)', [P])).tope_dia, 20, 'valor raro: el del contrato');
  await db.query("update app_config set value='20' where key='prueba_ia_mensajes_dia'");
  await db.query("update subscriptions set current_period_end=now()-interval '1 minute' where user_id=$1", [P]);
  st = await one(db, "select ai_begin_turn($1,'estandar')", [P]);
  eq([st.allowed, st.reason, st.trial_available], [false, 'sin_suscripcion', false], 'caduca sin días de gracia');
  eq(await one(db, 'select user_tier($1)', [P]), 'free');
  ok((await one(db, 'select prueba_auto_resumen()')).pruebas_total >= 1);
  await rejects((async () => { await as(db, P); return db.query('select prueba_auto_resumen()'); })(), /permission denied/);
  await admin(db);

  // Nunca pisa una fila existente (compra, cortesía, owner): el perfil se recrea con la fila ya puesta.
  await db.query(`update app_config set value='false' where key='${CLAVE_PRUEBA}'`);
  await db.query("insert into auth.users(id,email) values($1,'c@example.invalid')", [C]);
  await db.query("insert into subscriptions(user_id,status,plan,provider,current_period_end,store_product_id) values($1,'active','pro_anual','apple',now()+interval '300 days','nivl_pro_anual')", [C]);
  await db.query(`update app_config set value='true' where key='${CLAVE_PRUEBA}'`);
  await db.query("alter table profiles disable trigger user"); await db.query('delete from profiles where id=$1', [C]); await db.query("alter table profiles enable trigger user");
  await db.query('insert into profiles(id) values($1)', [C]);
  eq((await db.query('select status,plan,provider from subscriptions where user_id=$1', [C])).rows[0], { status: 'active', plan: 'pro_anual', provider: 'apple' }, 'la prueba no pisa una compra');
  // Un fallo dentro de la prueba no tumba el alta.
  await db.query("update app_config set value='99999999999999999999' where key='prueba_auto_dias'");
  await db.query("insert into auth.users(id,email) values('88888888-8888-4888-8888-888888888888','f@example.invalid')");
  eq(await one(db, "select count(*)::int from profiles where id='88888888-8888-4888-8888-888888888888'"), 1, 'el alta sigue');
  await db.query("update app_config set value='2' where key='prueba_auto_dias'");

  // Una compra sustituye a la prueba: evento de RevenueCat (0027).
  await db.query("update subscriptions set current_period_end=now()+interval '2 days' where user_id=$1", [P]);
  await db.query('select apply_store_event($1::jsonb)', [JSON.stringify({
    id: 'evt-modos-f1-1', type: 'INITIAL_PURCHASE', app_user_id: P, environment: 'PRODUCTION', store: 'APP_STORE',
    product_id: 'nivl_pro_anual', period_type: 'NORMAL', price_in_purchased_currency: 0, currency: 'EUR',
    transaction_id: 'T-F1', original_transaction_id: 'T-F1',
    purchased_at_ms: Date.now(), expiration_at_ms: Date.now() + 365 * 86400000,
  })]);
  eq((await db.query('select status,plan,provider from subscriptions where user_id=$1', [P])).rows[0], { status: 'active', plan: 'pro_anual', provider: 'apple' }, 'la compra sustituye a la prueba');

  // Reconciliación verificada (0033/0036): una compra de SANDBOX (TestFlight, revisión) también la sustituye,
  // y sin derecho de tienda la prueba se conserva (no se cancela).
  await db.query("insert into auth.users(id,email) values($1,'s@example.invalid')", [S]);
  eq(await one(db, 'select plan from subscriptions where user_id=$1', [S]), 'prueba_auto');
  const reconciliar = async (subs) => {
    const [res] = await one(db, 'select begin_store_reconciliation($1::uuid[])', [[S]]);
    return one(db, 'select apply_store_reconciliation($1::jsonb, null)', [JSON.stringify([{ ...res, requested_ms: Date.now(), subscriptions: subs }])]);
  };
  eq(await reconciliar([]), { ok: true });
  eq(await one(db, 'select plan from subscriptions where user_id=$1', [S]), 'prueba_auto', 'sin compra, la prueba sigue');
  eq(await reconciliar([{ product_id: 'nivl_pro_mensual', provider: 'apple', environment: 'SANDBOX', trial: false, refunded: false, expires_at: new Date(Date.now() + 3600_000).toISOString() }]), { ok: true });
  eq((await db.query('select status,plan,provider,store_environment from subscriptions where user_id=$1', [S])).rows[0],
    { status: 'active', plan: 'pro_mensual', provider: 'apple', store_environment: 'SANDBOX' }, 'una compra de sandbox sustituye a la prueba');

  // ── 5. El script de prueba en rollback (scripts/probar-f1-servidor.sql) pasa y no deja nada ──
  const limpia = await boot(9999);
  try {
    const sql = await readFile(new URL('scripts/probar-f1-servidor.sql', root), 'utf8');
    const resultados = await limpia.exec(sql);
    const filas = resultados.find((x) => x.fields?.some((f) => f.name === 'paso'))?.rows ?? [];
    eq(filas.length, 27, 'probar-f1-servidor.sql: 27 comprobaciones');
    for (const f of filas) eq(f.ok, true, `probar-f1-servidor.sql: ${f.paso} (${f.detalle})`);
    await admin(limpia);
    eq(await one(limpia, "select count(*)::int from auth.users where email like 'f1-%@example.invalid'"), 0, 'rollback: no queda nada');
    eq(await one(limpia, "select value from app_config where key='prueba_auto_activa'"), false, 'rollback: interruptor apagado');
  } finally { await limpia.close(); }

  console.log(`PASS modos F1 servidor: ${checks} comprobaciones (1.0.9 idéntica antes/después, XP por modo, RLS, flags, prueba automática y tienda)`);
} catch (e) {
  console.error('FAIL modos F1 servidor:', e.message, e.where ?? '', e.query ?? '');
  process.exitCode = 1;
} finally {
  await antes.close();
  await despues.close();
}
