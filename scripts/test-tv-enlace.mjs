// Prueba SQL local del enlace de Apple TV (0125, 0126, 0127). Sin red, sin credenciales y sin tocar producción:
// PostgreSQL en memoria (PGlite) con TODAS las migraciones reales del repo, salvo la 0010 (cron y vault).
//   PGLITE_PACKAGE_ROOT=<carpeta con @electric-sql/pglite> node scripts/test-tv-enlace.mjs
//
// auth.uid() y auth.role() son las de Supabase: leen request.jwt.claim.sub y también request.jwt.claims. Aquí
// la sesión se identifica solo con request.jwt.claims, como hace la PostgREST actual.
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { createRequire, stripTypeScriptTypes } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(process.env.PGLITE_PACKAGE_ROOT || root, 'package.json'));
const dist = path.dirname(require.resolve('@electric-sql/pglite'));
const { PGlite } = await import(pathToFileURL(path.join(dist, 'index.js')).href);
const { pgcrypto } = await import(pathToFileURL(path.join(dist, 'contrib/pgcrypto.js')).href);
const leer = (n) => readFile(path.join(root, 'supabase/migrations', n), 'utf8');

const db = new PGlite({ extensions: { pgcrypto } });
await db.exec(`
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create schema auth; create schema storage; create schema extensions;
create extension pgcrypto with schema extensions;
create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
create function auth.uid() returns uuid language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),
    (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub'))::uuid $$;
create function auth.role() returns text language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim.role',true),''),
    (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'role'))::text $$;
create function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
create table storage.buckets(id text primary key,name text,public boolean default false,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,owner uuid,
  created_at timestamptz default now(),updated_at timestamptz default now(),metadata jsonb default '{}');
alter table storage.objects enable row level security;
create function storage.foldername(text) returns text[] language sql immutable as $$select string_to_array($1,'/')$$;
create publication supabase_realtime;
grant usage on schema public,auth,storage,extensions to anon,authenticated,service_role;
grant all on all tables in schema storage to anon,authenticated,service_role;
alter default privileges in schema public grant all on tables to anon,authenticated,service_role;
alter default privileges in schema public grant all on sequences to anon,authenticated,service_role;
alter default privileges in schema public grant execute on functions to anon,authenticated,service_role;
`);

const migraciones = (await readdir(path.join(root, 'supabase/migrations')))
  .filter((n) => /^\d{4}.*\.sql$/.test(n) && !n.startsWith('0010')).sort();
for (const n of migraciones) {
  try { await db.exec(await leer(n)); } catch (e) { throw new Error(`Migración ${n}: ${e.message}`); }
}
const MIAS = ['0125_tv_enlace.sql', '0126_tv_datos.sql', '0127_tv_export.sql'];
for (const n of MIAS) assert.ok(migraciones.includes(n), 'falta ' + n);
for (const n of MIAS) await db.exec(await leer(n)); // Reejecutables.

const A = 'a0000000-0000-4000-8000-00000000000a', B = 'b0000000-0000-4000-8000-00000000000b',
  C = 'c0000000-0000-4000-8000-00000000000c', D = 'd0000000-0000-4000-8000-00000000000d',
  E = 'e0000000-0000-4000-8000-00000000000e', F = 'f0000000-0000-4000-8000-00000000000f';

async function como(rol, uid = '') {
  await db.exec('reset role');
  const claims = rol === 'postgres' && !uid ? '' : JSON.stringify(uid ? { sub: uid, role: rol } : { role: rol });
  await db.query("select set_config('request.jwt.claims',$1,false),set_config('request.jwt.claim.sub','',false),set_config('request.jwt.claim.role','',false)", [claims]);
  if (rol !== 'postgres') await db.exec('set role ' + rol);
}
const uno = async (q, a = []) => Object.values((await db.query(q, a)).rows[0])[0];
const filas = async (q, a = []) => (await db.query(q, a)).rows;
async function negado(q, a = []) {
  let err;
  try { await db.query(q, a); } catch (e) { err = e; }
  assert.ok(err, 'tenía que negarse: ' + q);
  assert.equal(err.code, '42501', err.code + ': ' + err.message);
}
let n = 0;
async function test(nombre, fn) { await como('postgres'); await fn(); console.log('PASS', nombre); n++; }

const emitir = async (nombre = 'Salón') => { await como('anon'); return uno('select tv_emitir_codigo($1)', [nombre]); };
const canjear = async (s) => { await como('anon'); return uno('select tv_canjear($1)', [s]); };
const aprobar = async (u, c) => { await como('authenticated', u); return uno('select tv_aprobar($1)', [c]); };
const datos = async (t, hoy = null) => { await como('anon'); return uno('select tv_datos($1,$2::date)', [t, hoy]); };
const rejuvenecer = async (s) => { await como('postgres'); await db.query("update tv_enlaces set ultimo_sondeo = now() - interval '10 seconds' where secreto_hash = sha256(convert_to($1,'UTF8'))", [s]); };
async function enlazar(u, nombre = 'Salón') {
  const e = await emitir(nombre);
  assert.equal((await aprobar(u, e.codigo)).ok, true);
  const r = await canjear(e.secreto);
  assert.equal(r.estado, 'aprobado');
  return r.token;
}
const asentar = async (q, a = []) => { await como('postgres'); await db.query(q, a); };
const fechaLocal = (delta = 0) => new Date(Date.now() + delta * 86400000).toISOString().slice(0, 10);

// ── Datos de ejemplo ──
await como('postgres');
for (const u of [A, B, C, D, E, F]) await db.query("insert into auth.users(id,email) values($1,$2)", [u, u[0] + '@correo.invalid']);
for (const [u, nom] of [[A, 'Ana'], [B, 'Berta'], [C, 'Carlos'], [D, 'Dora'], [E, 'Eva'], [F, 'Fede']]) {
  await db.query("insert into profiles(id,name,avatar_url,timezone) values($1,$2,$3,'UTC') on conflict (id) do update set name=excluded.name,avatar_url=excluded.avatar_url,timezone='UTC'", [u, nom, u + '/cara.jpg']);
}
const planElite = await uno("select plan from ai_plans where tier='elite' order by plan limit 1");
await db.query("update subscriptions set status='active',plan=$2 where user_id=$1", [A, planElite]);
if (!(await uno('select count(*)::int from subscriptions where user_id=$1 and plan=$2', [A, planElite]))) {
  await db.query("insert into subscriptions(user_id,status,plan) values($1,'active',$2)", [A, planElite]);
}
await db.query("update profiles set xp_total=9000,streak_days=7,protection_stones=2,equipped_title=null where id=$1", [A]);
await db.query("insert into achievements(user_id,code) values($1,'rango_C')", [A]);
await db.query("insert into friendships(requester,addressee,status) values($1,$2,'accepted'),($1,$3,'accepted')", [A, B, C]);
const version = await (async () => { await como('authenticated', A); const v = await uno('select health_consent_version()'); return v; })();
for (const u of [A, B]) { await como('authenticated', u); assert.equal((await uno('select accept_health_consent($1)', [version])).ok, true); }

const hoy = fechaLocal();
const isodow = await uno('select extract(isodow from $1::date)::int', [hoy]);
await como('postgres', A);
await db.query("select set_config('request.jwt.claim.role','authenticated',false)");
const dia = await uno("insert into gym_days(user_id,day_of_week,name) values($1,$2,'Torso') returning id", [A, isodow]);
await db.query("insert into gym_exercises(gym_day_id,user_id,name,sets,reps,weight,position) values($1,$2,'Press banca',4,8,80,1),($1,$2,'Dominadas',3,10,null,2)", [dia, A]);
const pesosA = [];
for (let i = 30; i >= 0; i -= 2) pesosA.push([fechaLocal(-i), (84.6 - (30 - i) * 0.0617 + (i % 4 ? 0.13 : -0.07)).toFixed(1)]);
for (const [f, kg] of pesosA) await db.query('insert into body_metrics(user_id,date,weight_kg) values($1,$2,$3)', [A, f, kg]);
const qNormal = await uno("insert into quests(user_id,title,stat,difficulty,created_at) values($1,'Leer diez páginas','INT','media',now()-interval '60 days') returning id", [A]);
const qSalud = await uno("insert into quests(user_id,title,stat,difficulty,created_at) values($1,'Ir al gym','FUE','media',now()-interval '60 days') returning id", [A]);
await db.query('insert into completions(user_id,quest_id,date,xp_awarded) values($1,$2,$3,700)', [A, qNormal, hoy]);
await db.query('insert into completions(user_id,quest_id,date,xp_awarded) values($1,$2,$3,50)', [A, qSalud, hoy]);
await como('postgres');
const huellasEconomia = "select id,xp_total,streak_days,protection_stones,bonus_points,last_day_processed from profiles order by id";

// ── Pruebas ──
await test('emisión: formato, secreto de 256 bits y solo su hash en la base', async () => {
  const e = await emitir('Salón');
  assert.equal(e.estado, 'ok');
  assert.match(e.codigo, /^[A-HJ-NP-Z2-9]{8}$/);
  assert.match(e.secreto, /^[0-9a-f]{64}$/);
  assert.equal(e.sondeo_seg, 5);
  const seg = (new Date(e.caduca_en) - Date.now()) / 1000;
  assert.ok(seg > 590 && seg <= 600, 'caduca a los 10 min');
  await como('postgres');
  const fila = (await filas('select to_jsonb(t) j from tv_enlaces t where codigo=$1', [e.codigo]))[0].j;
  assert.ok(!JSON.stringify(fila).includes(e.secreto), 'el secreto no se guarda');
});

await test('emisión: limpia lo caducado y aplica el tope global', async () => {
  await asentar("update tv_enlaces set caduca_en = now() - interval '1 second'");
  await emitir();
  await como('postgres');
  assert.equal(await uno("select count(*)::int from tv_enlaces"), 1, 'borra los caducados');
  await asentar(`insert into tv_enlaces(codigo,secreto_hash,nombre,caduca_en)
    select 'AAAA' || lpad(translate(upper(to_hex(i)), '01', 'QR'), 4, 'Z'), sha256(convert_to(i::text,'UTF8')), 'x', now() + interval '5 minutes'
    from generate_series(1,5000) i`);
  const r = await emitir();
  assert.equal(r.estado, 'saturado');
  await asentar('delete from tv_enlaces');
});

await test('anon y authenticated no leen ni escriben las tablas', async () => {
  for (const rol of ['anon', 'authenticated']) {
    await como(rol, rol === 'authenticated' ? A : '');
    for (const t of ['tv_enlaces', 'tv_dispositivos', 'tv_intentos']) {
      await negado(`select * from public.${t}`);
      await negado(`delete from public.${t}`);
    }
    await negado("insert into public.tv_dispositivos(user_id,nombre,token_hash,caduca_en) values ('" + A + "','x',sha256('x'::bytea),now())");
  }
  await como('postgres');
  for (const t of ['tv_enlaces', 'tv_dispositivos', 'tv_intentos']) {
    assert.equal(await uno('select relrowsecurity from pg_class where oid=$1::regclass', ['public.' + t]), true);
    assert.equal(await uno('select count(*)::int from pg_policies where tablename=$1', [t]), 0);
  }
});

await test('permisos de cada RPC y funciones internas cerradas', async () => {
  const anon = ['tv_emitir_codigo(text)', 'tv_canjear(text)', 'tv_datos(text,date)', 'tv_cerrar_sesion(text)'];
  const auth = ['tv_aprobar(text)', 'tv_rechazar(text)', 'tv_mis_dispositivos()', 'tv_revocar(uuid)'];
  const prv = (rol, f) => uno('select has_function_privilege($1,$2,\'execute\')', [rol, 'public.' + f]);
  for (const f of anon) { assert.equal(await prv('anon', f), true, f); assert.equal(await prv('authenticated', f), false, f); }
  for (const f of auth) { assert.equal(await prv('authenticated', f), true, f); assert.equal(await prv('anon', f), false, f); }
  for (const f of ['_tv_sha(text)', '_tv_codigo(text)', '_tv_frenado(uuid)', '_tv_contar_fallo(uuid)', '_export_my_data_sin_tv()']) {
    for (const r of ['anon', 'authenticated']) assert.equal(await prv(r, f), false, r + ' ' + f);
  }
  for (const f of [...anon, ...auth]) {
    const c = await uno("select array_to_string(proconfig,',') from pg_proc where oid=to_regprocedure($1)", ['public.' + f]);
    assert.match(c, /search_path=public, pg_temp/, 'search_path fijo en ' + f);
    assert.equal(await uno('select prosecdef from pg_proc where oid=to_regprocedure($1)', ['public.' + f]), true);
  }
});

await test('aprobar sin sesión se rechaza', async () => {
  const e = await emitir();
  await como('anon');
  await negado('select tv_aprobar($1)', [e.codigo]);
  await como('authenticated');
  await negado('select tv_aprobar($1)', [e.codigo]);
  assert.equal((await canjear(e.secreto)).estado, 'pendiente');
});

let tokenA;
await test('sondeo: pendiente, demasiado rápido y canje único', async () => {
  const e = await emitir('Cuarto');
  const r1 = await canjear(e.secreto);
  assert.equal(r1.estado, 'pendiente');
  assert.equal(r1.demasiado_rapido, undefined);
  const r2 = await canjear(e.secreto);
  assert.equal(r2.estado, 'pendiente');
  assert.equal(r2.demasiado_rapido, true);

  assert.equal((await aprobar(A, e.codigo.slice(0, 4) + '-' + e.codigo.slice(4))).ok, true, 'admite XXXX-XXXX');
  const r3 = await canjear(e.secreto);
  assert.equal(r3.demasiado_rapido, true, 'el token no sale antes de respetar el intervalo');
  assert.equal(r3.token, undefined);

  await rejuvenecer(e.secreto);
  const r4 = await canjear(e.secreto);
  assert.equal(r4.estado, 'aprobado');
  assert.match(r4.token, /^[0-9a-f]{64}$/);
  const dias = (new Date(r4.caduca_en) - Date.now()) / 86400000;
  assert.ok(dias > 89.9 && dias <= 90);
  tokenA = r4.token;

  assert.equal((await canjear(e.secreto)).estado, 'caducado', 'el secreto no se canjea dos veces');
  await como('postgres');
  assert.equal(await uno('select count(*)::int from tv_dispositivos where user_id=$1', [A]), 1);
  const fila = JSON.stringify((await filas('select to_jsonb(t) j from tv_dispositivos t'))[0].j);
  assert.ok(!fila.includes(tokenA), 'el token no se guarda');
});

await test('el código es de un solo uso', async () => {
  const e = await emitir();
  assert.equal((await aprobar(A, e.codigo)).ok, true);
  const r = await aprobar(B, e.codigo);
  assert.deepEqual(r, { ok: false, reason: 'codigo_invalido' });
  await como('postgres');
  assert.equal(await uno("select user_id::text from tv_enlaces where codigo=$1", [e.codigo]), A, 'sigue atado a quien aprobó');
  await asentar('delete from tv_intentos');
  await asentar('delete from tv_enlaces');
});

await test('caducidad del código', async () => {
  const e = await emitir();
  await asentar("update tv_enlaces set caduca_en = now() - interval '1 second' where codigo=$1", [e.codigo]);
  assert.deepEqual(await aprobar(A, e.codigo), { ok: false, reason: 'codigo_invalido' });
  assert.equal((await canjear(e.secreto)).estado, 'caducado');
  assert.equal(await (async () => { await como('postgres'); return uno('select count(*)::int from tv_enlaces where codigo=$1', [e.codigo]); })(), 0);
  assert.equal((await canjear('f'.repeat(64))).estado, 'caducado', 'lo inventado responde igual');
  assert.equal((await canjear("'; drop table x;--")).estado, 'caducado');
  await asentar('delete from tv_intentos');
});

await test('rechazar desde el iPhone deja la TV en denegado', async () => {
  const e = await emitir();
  await como('authenticated', A);
  assert.equal((await uno('select tv_rechazar($1)', [e.codigo])).ok, true);
  assert.deepEqual(await aprobar(A, e.codigo), { ok: false, reason: 'codigo_invalido' });
  assert.equal((await canjear(e.secreto)).estado, 'denegado');
  await asentar('delete from tv_intentos');
});

await test('fuerza bruta: frenada por usuario y acertar no limpia el contador', async () => {
  const buena = await emitir();
  for (let i = 0; i < 9; i++) assert.equal((await aprobar(B, 'ZZZZZZZ' + 'ABCDEFGHJ'[i])).reason, 'codigo_invalido');
  assert.equal((await aprobar(B, buena.codigo)).ok, true, 'el noveno fallo aún deja acertar');
  assert.equal((await aprobar(B, 'ZZZZZZZZ')).reason, 'codigo_invalido');
  const otra = await emitir();
  assert.deepEqual(await aprobar(B, otra.codigo), { ok: false, reason: 'demasiados_intentos' }, 'frenado aunque el código sea bueno');
  assert.equal((await aprobar(A, otra.codigo)).ok, true, 'el freno es por usuario');
  await asentar("update tv_intentos set ventana_desde = now() - interval '61 minutes' where user_id=$1", [B]);
  const tercera = await emitir();
  assert.equal((await aprobar(B, tercera.codigo)).ok, true, 'pasada la hora vuelve a poder');
  await asentar('delete from tv_intentos');
  await asentar('delete from tv_enlaces');
  await asentar('delete from tv_dispositivos where user_id=$1', [B]);
});

await test('tope de TV por usuario', async () => {
  const fichas = [];
  for (let i = 0; i < 5; i++) fichas.push(await enlazar(F, 'TV ' + i));
  const e = await emitir();
  const r = await aprobar(F, e.codigo);
  assert.equal(r.reason, 'tope_tv');
  assert.equal(r.tope, 5);
  await como('anon');
  await uno('select tv_cerrar_sesion($1)', [fichas[0]]);
  assert.equal((await aprobar(F, e.codigo)).ok, true, 'cerrar una libera sitio');
  await asentar('delete from tv_enlaces');
  await asentar('delete from tv_dispositivos where user_id=$1', [F]);
});

await test('tv_datos: forma completa, sin correo, retratos ni hashes', async () => {
  const d = await datos(tokenA, hoy);
  assert.equal(d.estado, 'ok');
  assert.equal(d.hoy, hoy);
  assert.equal(d.salud_activa, true);
  for (const k of ['generado_en', 'sesion_caduca_en', 'perfil', 'rutina', 'arena', 'ludus', 'semana']) assert.ok(k in d, 'falta ' + k);
  assert.equal(d.perfil.nombre, 'Ana');
  assert.equal(d.perfil.rango, 'C');
  assert.equal(d.perfil.titulo, 'Veterano', 'sin título equipado, el del rango');
  assert.equal(d.perfil.xp_total, 9000);
  assert.equal(d.perfil.elite, true);
  const txt = JSON.stringify(d);
  assert.ok(!/@correo|cara\.jpg|avatar|hash|friendship|secreto/i.test(txt), txt.slice(0, 300));
  assert.equal(d.rutina.fuente, 'rutina');
  assert.equal(d.rutina.nombre, 'Torso');
  assert.equal(d.rutina.dia_semana, isodow);
  assert.equal(d.rutina.hecha, false);
  assert.deepEqual(d.rutina.ejercicios.map((e) => [e.nombre, e.series, e.reps, e.carga_kg]), [['Press banca', 4, '8', 80], ['Dominadas', 3, '10', null]]);
  assert.equal(d.semana.piedras, 2);
  assert.equal(d.semana.piedras_max, 3);
  assert.equal(d.semana.xp_ganado, 550, 'least(700,500)+50');
  assert.equal(d.semana.dias.length, 7);
  assert.deepEqual(d.semana.dias.map((x) => x.inicial), ['L', 'M', 'X', 'J', 'V', 'S', 'D']);
  assert.equal(d.semana.mapa.length, 12);
  assert.ok(d.semana.mapa.every((s) => s.length === 7 && s.every((v) => v >= 0 && v <= 1)));
  const fila = d.semana.dias.find((x) => x.fecha === hoy);
  assert.equal(fila.hechas, 2);
  assert.equal(fila.falladas, 0, 'lo de hoy no falla');
  assert.equal(d.semana.racha, 8, 'rachaVisible: día de hoy cerrado');
  assert.equal(d.semana.mapa[11][isodow - 1], 1);
});

await test('la prescripción del coach manda sobre la rutina semanal', async () => {
  await como('postgres', A);
  await db.query("select set_config('request.jwt.claim.role','authenticated',false)");
  await db.query("insert into training_prescriptions(user_id,date,exercise_name,sets,reps,weight,position,notes) values($1,$2,'Sentadilla',5,'5',100,0,'nota privada')", [A, hoy]);
  const d = await datos(tokenA, hoy);
  assert.equal(d.rutina.fuente, 'prescripcion');
  assert.deepEqual(d.rutina.ejercicios.map((e) => [e.nombre, e.series, e.reps, e.carga_kg]), [['Sentadilla', 5, '5', 100]]);
  assert.ok(!JSON.stringify(d).includes('nota privada'));
  await asentar('delete from training_prescriptions where user_id=$1', [A]);
});

await test('p_hoy solo se acepta a un día del servidor', async () => {
  assert.equal((await datos(tokenA, fechaLocal(1))).hoy, fechaLocal(1));
  assert.equal((await datos(tokenA, fechaLocal(-1))).hoy, fechaLocal(-1));
  assert.equal((await datos(tokenA, fechaLocal(3))).hoy, hoy, 'fuera de margen manda la zona del perfil');
  assert.equal((await datos(tokenA, '2020-01-01')).hoy, hoy);
  assert.equal((await datos(tokenA, null)).hoy, hoy);
});

await test('peso: la misma pendiente que analytics.ts y bodymath.ts', async () => {
  const sacar = async (archivo) => {
    const src = await readFile(path.join(root, archivo), 'utf8');
    const i = src.indexOf('export function pendientePorDia');
    const f = i + src.slice(i).indexOf('\n}\n') + 3;
    const js = stripTypeScriptTypes(src.slice(i, f).replace('export ', ''));
    return new Function(js + '; return pendientePorDia;')();
  };
  const reales = [await sacar('supabase/functions/_shared/analytics.ts'), await sacar('src/lib/bodymath.ts')];
  const dias = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);
  const hace28 = fechaLocal(-28);
  const base = pesosA.filter(([f]) => f >= fechaLocal(-56))[0][0];
  const puntos = pesosA.map(([f, kg]) => ({ x: dias(base, f), y: Number(kg), f }));
  const recientes = puntos.filter((p) => p.f >= hace28);
  const entrada = recientes.length >= 3 ? recientes : puntos;
  const d = await datos(tokenA, hoy);
  for (const real of reales) {
    const pend = real(entrada);
    assert.equal(d.semana.tendencia_kg_semana, Number((pend * 7).toFixed(2)));
  }
  assert.ok(d.semana.tendencia_inicio > d.semana.tendencia_fin, 'la recta baja');
  assert.equal(d.semana.pesos.length, pesosA.filter(([f]) => f >= fechaLocal(-27)).length);
  assert.deepEqual(d.semana.pesos.at(-1), { dia: 27, kg: Number(pesosA.at(-1)[1]) });
  assert.ok(!/[—–]/.test(d.semana.lectura));
  assert.ok(d.semana.lectura.length > 0);
});

await test('arena y ludus salen de las RPC originales', async () => {
  await como('postgres');
  await db.query("insert into elite_groups(id,name,goal) values('11111111-1111-4111-8111-111111111111','Capua','general')");
  await db.query("insert into elite_group_members(group_id,user_id) values('11111111-1111-4111-8111-111111111111',$1)", [A]);
  const d = await datos(tokenA, hoy);
  const nombres = d.arena.map((f) => f.nombre).sort();
  assert.deepEqual(nombres, ['Ana', 'Berta', 'Carlos']);
  assert.equal(d.arena.find((f) => f.soy_yo).rango, 'C');
  assert.equal(d.arena.find((f) => f.soy_yo).elite, true);
  assert.equal(d.arena.find((f) => f.nombre === 'Berta').elite, false);
  assert.equal(d.ludus.nombre, 'Capua');
  assert.deepEqual(d.ludus.miembros.map((m) => m.nombre), ['Ana']);
  assert.ok(!('rango' in d.ludus.miembros[0]) && !('puesto' in d.ludus.miembros[0]));

  await como('postgres');
  await db.query('update profiles set social_visible=false where id=$1', [C]);
  await db.query("insert into social_blocks(blocker,blocked) values($1,$2)", [B, A]);
  const sin = await datos(tokenA, hoy);
  assert.deepEqual(sin.arena.map((f) => f.nombre), ['Ana'], 'visibilidad y bloqueo se aplican sin copiar la RPC');
  await asentar('update profiles set social_visible=true where id=$1', [C]);
  await asentar('delete from social_blocks');
});

await test('otra cuenta no ve lo tuyo', async () => {
  const tokenE = await enlazar(E);
  const d = await datos(tokenE, hoy);
  assert.equal(d.perfil.nombre, 'Eva');
  assert.deepEqual(d.arena.map((f) => f.nombre), ['Eva']);
  assert.equal(d.rutina, null);
  assert.equal(d.ludus, null);
  assert.ok(!JSON.stringify(d).includes('Ana'));
});

await test('el token de TV no sirve para mover economía', async () => {
  await como('postgres');
  const antes = await filas(huellasEconomia);
  const antesComp = await uno('select count(*)::int from completions');
  const procs = await filas("select oid::regprocedure::text f from pg_proc where pronamespace='public'::regnamespace and proname in ('award_xp','complete_quest','apply_day_close','sync_rank','redeem_bonus','use_protection_stone','start_trial')");
  assert.ok(procs.length >= 3, 'tiene que encontrar las RPC de economía');
  for (const { f } of procs) {
    assert.equal(await uno("select has_function_privilege('anon',$1,'execute')", [f]), false, 'anon no ejecuta ' + f);
  }
  await como('anon');
  await negado("select award_xp(50,'INT','x','{}')");

  // Misma transacción: tras tv_datos, la identidad prestada ya no existe.
  await db.exec('begin');
  await db.query('select tv_datos($1,null)', [tokenA]);
  assert.equal(await uno('select auth.uid()'), null);
  assert.equal(await uno('select auth.role()'), 'anon');
  await negado("select award_xp(50,'INT','x','{}')");
  await db.exec('rollback');

  await como('postgres');
  assert.deepEqual(await filas(huellasEconomia), antes);
  assert.equal(await uno('select count(*)::int from completions'), antesComp);
});

await test('caducidad deslizante: como mucho una escritura al día', async () => {
  await asentar("update tv_dispositivos set ultimo_uso = now() - interval '2 hours', caduca_en = now() + interval '30 days' where token_hash = sha256(convert_to($1,'UTF8'))", [tokenA]);
  await datos(tokenA, hoy);
  await como('postgres');
  const sinCambio = await uno("select caduca_en < now() + interval '31 days' from tv_dispositivos where token_hash = sha256(convert_to($1,'UTF8'))", [tokenA]);
  assert.equal(sinCambio, true, 'menos de un día: no escribe');
  await asentar("update tv_dispositivos set ultimo_uso = now() - interval '2 days' where token_hash = sha256(convert_to($1,'UTF8'))", [tokenA]);
  const d = await datos(tokenA, hoy);
  const dias = (new Date(d.sesion_caduca_en) - Date.now()) / 86400000;
  assert.ok(dias > 89.9 && dias <= 90, 'desliza a 90 días');
  await como('postgres');
  assert.equal(await uno("select ultimo_uso > now() - interval '1 minute' from tv_dispositivos where token_hash = sha256(convert_to($1,'UTF8'))", [tokenA]), true);
});

await test('token inválido, caducado o cerrado: la misma respuesta', async () => {
  const INV = { estado: 'sesion_invalida' };
  assert.deepEqual(await datos('nada'), INV);
  assert.deepEqual(await datos(null), INV);
  assert.deepEqual(await datos('a'.repeat(64)), INV);
  const t = await enlazar(F);
  await asentar("update tv_dispositivos set caduca_en = now() - interval '1 second' where token_hash = sha256(convert_to($1,'UTF8'))", [t]);
  assert.deepEqual(await datos(t), INV);
  await como('postgres');
  assert.equal(await uno("select count(*)::int from tv_dispositivos where token_hash = sha256(convert_to($1,'UTF8'))", [t]), 0, 'lo caducado se borra');

  const t2 = await enlazar(F);
  assert.equal((await datos(t2)).estado, 'ok');
  await como('anon');
  assert.deepEqual(await uno('select tv_cerrar_sesion($1)', [t2]), { ok: true });
  assert.deepEqual(await datos(t2), INV);
  await como('anon');
  assert.deepEqual(await uno('select tv_cerrar_sesion($1)', ['basura']), { ok: true }, 'no distingue');
});

await test('el dueño ve y revoca solo lo suyo', async () => {
  const t = await enlazar(F, 'Dormitorio');
  await como('authenticated', F);
  const mias = await filas('select * from tv_mis_dispositivos()');
  assert.equal(mias.length, 1);
  assert.equal(mias[0].nombre, 'Dormitorio');
  assert.deepEqual(Object.keys(mias[0]).sort(), ['caduca_en', 'creado_en', 'id', 'nombre', 'ultimo_uso']);
  await como('authenticated', A);
  assert.ok((await filas('select * from tv_mis_dispositivos()')).every((f) => f.nombre !== 'Dormitorio'));
  assert.deepEqual(await uno('select tv_revocar($1)', [mias[0].id]), { ok: false }, 'lo ajeno no se revoca');
  assert.equal((await datos(t)).estado, 'ok');
  await como('authenticated');
  await negado('select tv_revocar($1)', [mias[0].id]);
  await negado('select * from tv_mis_dispositivos()');
  await como('authenticated', F);
  assert.deepEqual(await uno('select tv_revocar($1)', [mias[0].id]), { ok: true });
  assert.deepEqual(await datos(t), { estado: 'sesion_invalida' });
});

await test('sin consentimiento de salud no salen rutina, peso ni misiones de salud', async () => {
  const conSalud = await datos(tokenA, hoy);
  assert.equal(conSalud.semana.dias.find((x) => x.fecha === hoy).hechas, 2);
  await como('authenticated', A);
  assert.equal((await uno('select withdraw_health_consent(true)')).ok, true);
  const d = await datos(tokenA, hoy);
  assert.equal(d.salud_activa, false);
  assert.equal(d.rutina, null);
  assert.deepEqual(d.semana.pesos, []);
  assert.equal(d.semana.tendencia_kg_semana, null);
  assert.equal(d.semana.tendencia_inicio, null);
  assert.equal(d.semana.tendencia_fin, null);
  assert.equal(d.semana.lectura, null);
  const fila = d.semana.dias.find((x) => x.fecha === hoy);
  assert.equal(fila.hechas, 1, 'la misión del gym no cuenta sin consentimiento');
  assert.equal(d.semana.xp_ganado, 500);
  await asentar("update health_erasure_jobs set status='complete' where user_id=$1", [A]);
  await como('authenticated', A);
  assert.equal((await uno('select accept_health_consent($1)', [version])).ok, true);
  assert.equal((await datos(tokenA, hoy)).salud_activa, true);
});

await test('exportación: cubre las tablas de la TV, sin hashes ni ajenos', async () => {
  const e = await emitir('Pendiente de A');
  assert.equal((await aprobar(A, e.codigo)).ok, true);
  await asentar("insert into tv_intentos(user_id,fallos) values($1,3) on conflict (user_id) do update set fallos=3", [A]);
  await como('authenticated', A);
  const x = await uno('select export_my_data()');
  assert.ok(x.tv_dispositivos.some((d) => d.nombre === 'Cuarto'));
  assert.ok(x.tv_dispositivos.every((d) => d.nombre !== 'Dormitorio'), 'nada ajeno');
  assert.equal(x.tv_enlaces[0].nombre, 'Pendiente de A');
  assert.equal(x.tv_intentos[0].fallos, 3);
  assert.ok('profiles' in x && 'ai_cargos' in x, 'la exportación envuelta sigue entera');
  const txt = JSON.stringify({ d: x.tv_dispositivos, e: x.tv_enlaces, i: x.tv_intentos });
  assert.ok(!/hash|secreto|codigo|token/.test(txt), txt);
  assert.ok(!txt.includes(e.codigo));
  await como('postgres');
  const c = await uno("select obj_description('public.export_my_data()'::regprocedure,'pg_proc')");
  assert.match(c, /nivl:export-tv-0127/);
  assert.match(c, /nivl:export-ia-0079/, 'conserva las marcas anteriores');
  assert.equal((c.match(/nivl:export-tv-0127/g) || []).length, 1, 'reejecutar no acumula');
  await asentar('delete from tv_enlaces');
  await asentar('delete from tv_intentos');
});

await test('borrado pendiente: bloquea datos, aprobación y canje', async () => {
  const e1 = await emitir();
  const e2 = await emitir();
  assert.equal((await aprobar(D, e1.codigo)).ok, true);
  const tokenD = await (async () => {
    const e = await emitir();
    assert.equal((await aprobar(D, e.codigo)).ok, true);
    return (await canjear(e.secreto)).token;
  })();
  assert.equal((await datos(tokenD)).estado, 'ok');
  await como('service_role', D);
  await db.query('select begin_account_erasure($1)', [D]);
  assert.deepEqual(await datos(tokenD), { estado: 'sesion_invalida' });
  assert.equal((await canjear(e1.secreto)).estado, 'denegado');
  assert.deepEqual(await aprobar(D, e2.codigo), { ok: false, reason: 'borrado_pendiente' });
});

await test('borrar la cuenta se lleva sus filas en cascada', async () => {
  await como('postgres');
  assert.ok(await uno('select count(*)::int from tv_dispositivos where user_id=$1', [D]) > 0);
  await db.query('delete from account_erasure_jobs where user_id=$1', [D]).catch(() => {});
  await db.query('delete from auth.users where id=$1', [D]);
  assert.equal(await uno('select count(*)::int from tv_dispositivos where user_id=$1', [D]), 0);
  assert.equal(await uno('select count(*)::int from tv_enlaces where user_id=$1', [D]), 0);
});

await test('las huellas de scripts/apply-migrations.mjs dan verdadero', async () => {
  const src = await readFile(path.join(root, 'scripts/apply-migrations.mjs'), 'utf8');
  for (const m of ['0125', '0126', '0127']) {
    const hit = new RegExp(`'${m}': \`([^\`]+)\``).exec(src);
    assert.ok(hit, 'falta la huella ' + m);
    assert.equal(await uno('select ' + hit[1]), true, m);
  }
});

console.log(`\n${n} pruebas PASS`);
await db.close();
