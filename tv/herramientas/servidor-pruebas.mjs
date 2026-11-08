// Servidor local de pruebas de la app de Apple TV. Sin red, sin credenciales y sin tocar producción.
//
// Ejecuta el SQL REAL de las migraciones (todas salvo la 0010, cron y vault) sobre PostgreSQL en memoria
// (PGlite), con las mismas piezas mínimas que scripts/test-tv-enlace.mjs, y expone /rest/v1/rpc/* como lo
// haría PostgREST. Los datos se pierden al pararlo. Nombres inventados, ningún dato personal.
//
//   PGLITE_PACKAGE_ROOT=<carpeta con @electric-sql/pglite> node tv/herramientas/servidor-pruebas.mjs [--puerto 54399]
//   node tv/herramientas/servidor-pruebas.mjs aprobar [CODIGO] [--cuenta llena|vacia|sinsalud]
//   node tv/herramientas/servidor-pruebas.mjs rechazar [CODIGO]
//   node tv/herramientas/servidor-pruebas.mjs caducar-codigo | revocar | estado
//   node tv/herramientas/servidor-pruebas.mjs fallo 503      (0 corta la conexión; «no» lo quita)
//
// Ver tv/herramientas/README.md.
import { createServer } from 'node:http';
import { readFile, readdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const argv = process.argv.slice(2);
const opcion = (nombre, porDefecto) => {
  const i = argv.indexOf('--' + nombre);
  if (i < 0) return porDefecto;
  const [, v] = argv.splice(i, 2);
  return v;
};
const PUERTO = Number(opcion('puerto', process.env.NIVL_PUERTO || 54399));
const CLAVE = opcion('clave', 'clave-publica-local');
const CUENTA = opcion('cuenta', 'llena');
const [orden, ...resto] = argv;

// ── Comandos: simulan el iPhone hablando con el servidor ya arrancado ──
if (orden) {
  const ruta = { aprobar: 'aprobar', rechazar: 'rechazar', 'caducar-codigo': 'caducar-codigo', revocar: 'revocar', estado: 'estado', fallo: 'fallo' }[orden];
  if (!ruta) { console.error('Orden desconocida: ' + orden); process.exit(2); }
  const cuerpo = orden === 'fallo' ? { http: resto[0] } : { codigo: resto[0], cuenta: CUENTA };
  try {
    const r = await fetch(`http://127.0.0.1:${PUERTO}/_pruebas/${ruta}`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(cuerpo),
    });
    console.log(JSON.stringify(await r.json()));
    process.exit(r.ok ? 0 : 1);
  } catch {
    console.error(`No hay servidor en el puerto ${PUERTO}. Arráncalo antes.`);
    process.exit(1);
  }
}

// ── Base de datos ──
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(path.join(process.env.PGLITE_PACKAGE_ROOT || root, 'package.json'));
let dist;
try {
  dist = path.dirname(require.resolve('@electric-sql/pglite'));
} catch {
  console.error('Falta @electric-sql/pglite. Instálalo en una carpeta temporal y apunta PGLITE_PACKAGE_ROOT a ella.');
  process.exit(1);
}
const { PGlite } = await import(pathToFileURL(path.join(dist, 'index.js')).href);
const { pgcrypto } = await import(pathToFileURL(path.join(dist, 'contrib/pgcrypto.js')).href);

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

const carpeta = path.join(root, 'supabase/migrations');
const migraciones = (await readdir(carpeta)).filter((n) => /^\d{4}.*\.sql$/.test(n) && !n.startsWith('0010')).sort();
for (const n of migraciones) {
  try { await db.exec(await readFile(path.join(carpeta, n), 'utf8')); } catch (e) { throw new Error(`Migración ${n}: ${e.message}`); }
}

async function como(rol, uid = '') {
  await db.exec('reset role');
  const claims = rol === 'postgres' && !uid ? '' : JSON.stringify(uid ? { sub: uid, role: rol } : { role: rol });
  await db.query("select set_config('request.jwt.claims',$1,false),set_config('request.jwt.claim.sub','',false),set_config('request.jwt.claim.role','',false)", [claims]);
  if (rol !== 'postgres') await db.exec('set role ' + rol);
}
const uno = async (q, a = []) => Object.values((await db.query(q, a)).rows[0])[0];

// ── Semillas ficticias ──
const uid = (n) => `${String(n).padStart(8, '0')}-0000-4000-8000-000000000000`;
const CUENTAS = { llena: uid(1), vacia: uid(2), sinsalud: uid(3) };
const AMIGOS = [
  [uid(11), 'Cassio Valerio', 'B', 18400, 34],
  [uid(12), 'Drusila Faro', 'C', 12100, 21],
  [uid(13), 'Flavio Ostia', 'D', 6300, 12],
  [uid(14), 'Hortensia Lima', 'D', 4100, 6],
  [uid(15), 'Marcelo Tuto', 'E', 900, 2],
];
const fecha = (delta = 0) => new Date(Date.now() + delta * 86400000).toISOString().slice(0, 10);

await como('postgres');
const todos = [[CUENTAS.llena, 'Livia Tessari'], [CUENTAS.vacia, 'Tito Novel'], [CUENTAS.sinsalud, 'Sabina Roca'], ...AMIGOS.map((a) => [a[0], a[1]])];
for (const [id, nombre] of todos) {
  await db.query('insert into auth.users(id,email) values($1,$2)', [id, id.slice(0, 8) + '@correo.invalid']);
  await db.query("insert into profiles(id,name,timezone) values($1,$2,'UTC') on conflict (id) do update set name=excluded.name,timezone='UTC'", [id, nombre]);
}
const A = CUENTAS.llena;
const planElite = await uno("select plan from ai_plans where tier='elite' order by plan limit 1");
for (const id of [A, AMIGOS[0][0], AMIGOS[1][0]]) {
  await db.query("insert into subscriptions(user_id,status,plan) values($1,'active',$2) on conflict (user_id) do update set status='active',plan=excluded.plan", [id, planElite]);
}
await db.query('update profiles set xp_total=9000,streak_days=7,protection_stones=2 where id=$1', [A]);
await db.query("insert into achievements(user_id,code) values($1,'rango_C')", [A]);
for (const [id, , rango, xp, racha] of AMIGOS) {
  await db.query('update profiles set xp_total=$2,streak_days=$3 where id=$1', [id, xp, racha]);
  if (rango !== 'E') await db.query('insert into achievements(user_id,code) values($1,$2)', [id, 'rango_' + rango]);
  await db.query("insert into friendships(requester,addressee,status) values($1,$2,'accepted')", [A, id]);
}
await como('authenticated', A);
const version = await uno('select health_consent_version()');
for (const id of [A, CUENTAS.vacia]) { await como('authenticated', id); await uno('select accept_health_consent($1)', [version]); }

// Consentimiento dado, sin rutina ni amigos: vacia. Sin consentimiento: sinsalud.
const hoy = fecha();
const isodow = await uno('select extract(isodow from $1::date)::int', [hoy]);
await como('postgres', A);
await db.query("select set_config('request.jwt.claim.role','authenticated',false)");
const dia = await uno("insert into gym_days(user_id,day_of_week,name) values($1,$2,'Torso fuerza') returning id", [A, isodow]);
await db.query(`insert into gym_exercises(gym_day_id,user_id,name,sets,reps,weight,position) values
  ($1,$2,'Press de banca',4,6,80,1),($1,$2,'Remo con barra',4,8,70,2),($1,$2,'Press militar',3,10,42.5,3),($1,$2,'Dominadas',3,8,null,4)`, [dia, A]);
for (let i = 30; i >= 0; i -= 2) {
  await db.query('insert into body_metrics(user_id,date,weight_kg) values($1,$2,$3)', [A, fecha(-i), (84.6 - (30 - i) * 0.0617 + (i % 4 ? 0.13 : -0.07)).toFixed(1)]);
}
const titulos = [['Leer diez páginas', 'INT'], ['Caminar treinta minutos', 'VIT'], ['Meditar diez minutos', 'INT'], ['Sin pantallas tras la cena', 'SAB']];
const misiones = async (u, k) => {
  await como('postgres', u);
  await db.query("select set_config('request.jwt.claim.role','authenticated',false)");
  for (let q = 0; q < titulos.length; q++) {
    const id = await uno("insert into quests(user_id,title,stat,difficulty,created_at) values($1,$2,'INT','media',now()-interval '100 days') returning id", [u, titulos[q][0]]);
    await db.query(`insert into completions(user_id,quest_id,date,xp_awarded)
      select $1,$2,d::date,40 from generate_series($3::date,$4::date,interval '1 day') d
      where (extract(doy from d)::int * 7 + $6::int * 3) % ($5::int + 2 + $6::int) <> 0`, [u, id, fecha(-90), fecha(-1), k, q]);
  }
  await como('postgres');
};
await misiones(A, 0);
for (let i = 0; i < AMIGOS.length; i++) await misiones(AMIGOS[i][0], i + 1);
await como('postgres');
const grupo = '11111111-1111-4111-8111-111111111111';
await db.query("insert into elite_groups(id,name,goal) values($1,'Capua','general')", [grupo]);
for (const id of [A, AMIGOS[0][0], AMIGOS[1][0]]) await db.query('insert into elite_group_members(group_id,user_id) values($1,$2)', [grupo, id]);

// ── HTTP ──
const RPC = {
  tv_emitir_codigo: [['p_nombre', 'text']],
  tv_canjear: [['p_secreto', 'text']],
  tv_datos: [['p_token', 'text'], ['p_hoy', 'date']],
  tv_cerrar_sesion: [['p_token', 'text']],
};
let fallo = null;
let cola = Promise.resolve();
const enCola = (fn) => { const r = cola.then(fn, fn); cola = r.catch(() => {}); return r; };

async function pendiente(codigo) {
  if (codigo) return codigo;
  await como('postgres');
  return (await db.query("select codigo from tv_enlaces where estado='pendiente' and caduca_en > now() order by creado_en desc limit 1")).rows[0]?.codigo;
}

const CONTROL = {
  async aprobar({ codigo, cuenta }) {
    const u = CUENTAS[cuenta || 'llena'];
    if (!u) return { ok: false, error: 'cuenta desconocida' };
    const c = await pendiente(codigo);
    if (!c) return { ok: false, error: 'no hay ningún código pendiente' };
    await como('authenticated', u);
    return { ...(await uno('select tv_aprobar($1)', [c])), codigo: c };
  },
  async rechazar({ codigo, cuenta }) {
    const c = await pendiente(codigo);
    if (!c) return { ok: false, error: 'no hay ningún código pendiente' };
    await como('authenticated', CUENTAS[cuenta || 'llena']);
    return uno('select tv_rechazar($1)', [c]);
  },
  async 'caducar-codigo'() {
    await como('postgres');
    await db.exec("update tv_enlaces set caduca_en = now() - interval '1 second'");
    return { ok: true };
  },
  async revocar() {
    await como('postgres');
    await db.exec('delete from tv_dispositivos');
    return { ok: true };
  },
  async estado() {
    await como('postgres');
    return {
      ok: true,
      dispositivos: await uno('select count(*)::int from tv_dispositivos'),
      codigos_pendientes: await uno("select count(*)::int from tv_enlaces where estado='pendiente'"),
      fallo,
    };
  },
  async fallo({ http }) {
    fallo = http === 'no' || http === undefined ? null : Number(http);
    return { ok: true, fallo };
  },
};

const leer = (req) => new Promise((ok) => { let b = ''; req.on('data', (c) => { b += c; }); req.on('end', () => ok(b)); });
const enviar = (res, status, cuerpo) => {
  const texto = JSON.stringify(cuerpo);
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(texto);
};

const servidor = createServer(async (req, res) => {
  try {
    const cuerpo = JSON.parse((await leer(req)) || '{}');
    if (req.url?.startsWith('/_pruebas/')) {
      const fn = CONTROL[req.url.slice('/_pruebas/'.length)];
      if (!fn) return enviar(res, 404, { error: 'no existe' });
      return enviar(res, 200, await enCola(() => fn(cuerpo)));
    }
    const m = /^\/rest\/v1\/rpc\/([a-z_]+)$/.exec(req.url || '');
    if (!m || req.method !== 'POST') return enviar(res, 404, { message: 'no existe' });
    if (req.headers.apikey !== CLAVE || req.headers.authorization !== `Bearer ${CLAVE}`) return enviar(res, 401, { message: 'clave inválida' });
    if (fallo === 0) return req.socket.destroy();
    if (fallo) return enviar(res, fallo, { message: 'fallo simulado' });
    const params = RPC[m[1]];
    if (!params) return enviar(res, 404, { message: 'función no disponible para anon' });
    const lista = params.map(([p, t], i) => `${p} => $${i + 1}::${t}`).join(', ');
    const valor = await enCola(async () => {
      await como('anon');
      return uno(`select public.${m[1]}(${lista})`, params.map(([p]) => cuerpo[p] ?? null));
    });
    enviar(res, 200, valor);
    console.log(`${new Date().toISOString()} ${m[1]} -> ${valor?.estado ?? (valor?.ok ? 'ok' : '?')}`);
  } catch (e) {
    console.error('Fallo:', e.message);
    enviar(res, 500, { message: 'error interno' });
  }
});

servidor.listen(PUERTO, '127.0.0.1', () => {
  console.log(`Servidor de pruebas listo en http://127.0.0.1:${PUERTO} (${migraciones.length} migraciones)`);
  console.log(`Clave pública local: ${CLAVE}`);
  console.log('Cuentas: llena, vacia, sinsalud');
});
