// NIVL · Test de abuso del tope de IA (0078/0079) contra las migraciones REALES, en PostgreSQL en memoria.
// Sin red, sin Supabase y sin datos reales (cuentas ficticias *.invalid).
//
//   node scripts/test-ia-tope-abuso.mjs /ruta/a/@electric-sql/pglite/dist/index.js
//
// Qué demuestra (decisión de Teferi, 21/10/2026: «que nadie pase del máximo de IA ni en abuso máximo»):
//   1. Abuso máximo de un Élite: 12 dispositivos a la vez, cientos de peticiones con reservas de hasta 0,6 $,
//      reintentos con la misma clave, fallos a mitad (el proveedor no cobra → se libera; la función muere →
//      la reserva se queda cobrada entera) y modo profundo. El gasto comprometido NUNCA pasa de 8 $
//      (6 estándar + 2 profundo), ni en un solo microdólar, y se llega hasta el borde (el test es real).
//   2. Con una recarga de 1,50 $ (apply_ai_recargas, idempotente), el tope sube a 9,50 $ y tampoco se pasa;
//      el reembolso la quita; lo no gastado pasa al mes siguiente.
//   3. Reparto diario (ritmo ×3) y tope de funciones (profundo 3 turnos al día).
//   4. Lo apuntado en coach_runs por caminos antiguos también cuenta.
//   5. Reservas huérfanas (más de 15 min) se dan por cobradas enteras; liquidar dos veces no devuelve dinero.
//   6. Permisos: la app no puede reservar ni liquidar; ai_status trae la cartera; la exportación trae los
//      cargos y recargas propios (y ninguno ajeno) y conserva las marcas de la versión envuelta.
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';

if (!process.argv[2]) throw new Error('Indica la ruta de un módulo PGlite existente (este test no instala nada).');
const moduleUrl = pathToFileURL(resolve(process.argv[2]));
const { PGlite } = await import(moduleUrl.href);
const { pgcrypto } = await import(new URL('./contrib/pgcrypto.js', moduleUrl).href);
const migrations = new URL('../supabase/migrations/', import.meta.url);

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

const db = new PGlite({ extensions: { pgcrypto } });
await db.exec(STUBS);
for (const n of (await readdir(migrations)).filter((x) => /^\d{4}.*\.sql$/.test(x) && !x.startsWith('0010')).sort()) {
  try { await db.exec(await readFile(new URL(n, migrations), 'utf8')); }
  catch (e) { throw new Error(`Migración ${n}: ${e.message}`); }
}
// Re-ejecutable: aplicar otra vez la 0078 y la 0079 no cambia nada (ni envuelve dos veces la exportación).
for (const n of (await readdir(migrations)).filter((x) => /^007[89]_/.test(x)).sort()) {
  await db.exec(await readFile(new URL(n, migrations), 'utf8'));
}

let checks = 0;
const eq = (a, b, m) => { assert.deepEqual(a, b, m); checks++; };
const ok = (v, m) => { assert.ok(v, m); checks++; };
const q1 = async (sql, args = []) => (await db.query(sql, args)).rows[0];

// Semilla determinista: el test da siempre lo mismo.
let semilla = 20261021;
const azar = () => ((semilla = (semilla * 1103515245 + 12345) % 2147483648) / 2147483648);
const entre = (a, b) => Math.floor(a + azar() * (b - a));

async function usuario(plan, email) {
  const id = randomUUID();
  await db.query('insert into auth.users(id,email) values($1,$2)', [id, email]);
  if (plan) {
    await db.query(`insert into subscriptions(user_id,status,plan,provider,current_period_end)
      values($1,'active',$2,'apple',now()+interval '40 days')`, [id, plan]);
  }
  return id;
}

const reservar = (u, funcion, modo, micro, turno, idem = null) =>
  q1('select ai_reservar($1,$2,$3,$4,$5,$6) as r', [u, funcion, modo, micro, turno, idem]).then((x) => x.r);
const liquidar = (id, real) => q1('select ai_liquidar($1,$2) as r', [id, real]).then((x) => x.r);

/** Lo comprometido del usuario: real de lo liquidado/caducado + lo reservado en vuelo, por modo. */
async function comprometido(u) {
  const r = await q1(`select
      coalesce(sum(coalesce(real_micro,reservado_micro)) filter (where modo='estandar'),0)::bigint as std,
      coalesce(sum(coalesce(real_micro,reservado_micro)) filter (where modo='profundo'),0)::bigint as deep,
      coalesce(sum(exceso_micro),0)::bigint as exceso
    from ai_cargos where user_id=$1`, [u]);
  return { std: Number(r.std), deep: Number(r.deep), total: Number(r.std) + Number(r.deep), exceso: Number(r.exceso) };
}

// Sin ritmo diario para medir solo el tope del mes (el ritmo se prueba aparte).
await db.query(`insert into app_config(key,value) values('ia_ritmo_factor','31'::jsonb)
  on conflict (key) do update set value=excluded.value`);

// ── 0. El plan Élite está a 8 $ ─────────────────────────────────────
{
  const p = await q1("select monthly_budget_micro_usd m, deep_budget_micro_usd d from ai_plans where plan='elite_mensual'");
  eq([Number(p.m), Number(p.d)], [8000000, 2000000], 'Élite = 8 $ (6 estándar + 2 profundo)');
}

/**
 * Un "dispositivo": peticiones seguidas hasta que la puerta cierra. Cada petición es un turno de 1 a 4
 * llamadas, como el bucle de herramientas del coach. Los dispositivos corren a la vez (Promise.all): entre
 * la reserva y la liquidación de uno se cuelan las reservas de los demás.
 */
async function dispositivo(u, n, log) {
  let negadas = 0;
  for (let i = 0; i < 400 && negadas < 6; i++) {
    const turno = randomUUID();
    const profundo = azar() < 0.2;
    const funcion = profundo ? 'profundo' : azar() < 0.2 ? 'estudio' : 'chat';
    const llamadas = entre(1, 5);
    for (let k = 0; k < llamadas; k++) {
      const tope = funcion === 'estudio' ? 290000 : 600000;
      // Casi todas pequeñas (partes, estudio, chats cacheados) y una de cada cinco grande (hasta la cota).
      const reserva = azar() < 0.2 ? entre(5000, tope) : entre(5000, 60000);
      const idem = azar() < 0.15 ? `disp${n}-${i}-${k}` : null;
      const r = await reservar(u, funcion, profundo ? 'profundo' : 'estandar', reserva, turno, idem);
      log.peticiones++;
      if (!r.ok) { negadas++; log.negadas[r.motivo] = (log.negadas[r.motivo] ?? 0) + 1; break; }
      // Reintento del cliente con la misma clave: no hay segunda reserva.
      if (idem) {
        const otra = await reservar(u, funcion, profundo ? 'profundo' : 'estandar', reserva, turno, idem);
        eq(otra.id, r.id, 'el reintento con la misma clave devuelve la misma reserva');
        log.reintentos++;
      }
      await new Promise((res) => setTimeout(res, entre(0, 3)));
      const destino = azar();
      if (destino < 0.08) { log.huerfanas++; continue; }                 // la función murió: nadie liquida
      if (destino < 0.18) { await liquidar(r.id, 0); log.liberadas++; continue; } // el proveedor no cobró
      const real = entre(0, reserva + 1);                                // el coste real nunca pasa de la cota
      await liquidar(r.id, real);
      if (azar() < 0.1) eq((await liquidar(r.id, real)).ok, false, 'liquidar dos veces no hace nada');
    }
  }
}

async function abuso(u, dispositivos) {
  const log = { peticiones: 0, negadas: {}, reintentos: 0, huerfanas: 0, liberadas: 0 };
  await Promise.all(Array.from({ length: dispositivos }, (_, n) => dispositivo(u, n, log)));
  return log;
}

// ── 1. Abuso máximo de un Élite ─────────────────────────────────────
// Aquí el profundo va sin tope de turnos al día para medir también su tope de dinero (se restaura en el 3).
await db.query("update ai_topes_funcion set max_turnos_dia=null where funcion='profundo'");
const E = await usuario('elite_mensual', 'elite@abuso.invalid');
const logE = await abuso(E, 12);
const gE = await comprometido(E);
ok(gE.std <= 6000000, `estándar ${gE.std} <= 6.000.000`);
ok(gE.deep <= 2000000, `profundo ${gE.deep} <= 2.000.000`);
ok(gE.total <= 8000000, `total ${gE.total} <= 8.000.000`);
eq(gE.exceso, 0, 'ningún cargo por encima de su reserva');
// Que se haya llegado al borde: lo que queda sin usar es menos que la mayor reserva posible.
ok(gE.std > 6000000 - 600000, `el estándar llega al tope (${gE.std})`);
ok(gE.deep > 2000000 - 600000, `el profundo llega al tope (${gE.deep})`);
ok((logE.negadas.tope_mes ?? 0) > 0, 'la puerta cierra por tope del mes');

// Más reintentos y dispositivos con la puerta ya cerrada: ni un microdólar más.
await abuso(E, 6);
{
  const g2 = await comprometido(E);
  ok(g2.std <= 6000000 && g2.deep <= 2000000 && g2.total <= 8000000, `segunda oleada: total ${g2.total} <= 8.000.000`);
  eq((await reservar(E, 'chat', 'estandar', 6000000 - g2.std + 1, randomUUID())).ok, false, 'un microdólar por encima del resto: no');
}

// ── 2. Recarga de pago ──────────────────────────────────────────────
const compra = [{ id: 'rc_tx_1', product_id: 'nivl_ia_recarga_1', store: 'app_store', sandbox: false, purchased_at: new Date().toISOString() }];
eq((await q1('select apply_ai_recargas($1,$2) n', [E, JSON.stringify(compra)])).n, 1, 'la recarga se apunta');
eq((await q1('select apply_ai_recargas($1,$2) n', [E, JSON.stringify(compra)])).n, 0, 'la misma compra dos veces es una recarga');
eq((await q1('select apply_ai_recargas($1,$2) n', [E, JSON.stringify([{ ...compra[0], id: 'x', product_id: 'nivl_pro_anual' }])])).n, 0,
  'un producto que no es recarga no da crédito');
{
  const st = (await q1('select ai_state($1) s', [E])).s;
  eq(Number(st.budget), 6000000 + 1500000, 'la recarga sube el bolsillo estándar');
}
await abuso(E, 12);
const gR = await comprometido(E);
ok(gR.total <= 9500000, `con recarga: total ${gR.total} <= 9.500.000`);
ok(gR.std > 7500000 - 600000, `con recarga se llega al nuevo borde (${gR.std})`);
eq(gR.exceso, 0);
eq((await q1('select revocar_ai_recarga($1) r', ['rc_tx_1'])).r, true, 'reembolso');
eq(Number((await q1('select ai_state($1) s', [E])).s.budget), 6000000, 'sin la recarga reembolsada');
eq((await reservar(E, 'chat', 'estandar', 20000, randomUUID())).motivo, 'tope_mes', 'tras el reembolso, cerrado');

// La recarga que no se usa pasa al mes siguiente: compra hoy, gasto del mes pasado por debajo del plan.
{
  const M = await usuario('elite_mensual', 'mes@abuso.invalid');
  await db.query(`insert into ai_cargos(user_id,funcion,modo,turno,reservado_micro,real_micro,estado,tope_plan_micro,created_at)
    values($1,'chat','estandar',gen_random_uuid(),7000000,7000000,'liquidado',6000000,date_trunc('month',now())-interval '3 days')`, [M]);
  await db.query('select apply_ai_recargas($1,$2)', [M, JSON.stringify([{ ...compra[0], id: 'rc_tx_m', purchased_at: new Date(Date.now() - 40 * 864e5).toISOString() }])]);
  eq(Number((await q1('select ai_state($1) s', [M])).s.recarga), 500000, 'el mes pasado usó 1 $ de los 1,5: quedan 0,5 $');
}

// ── 3. Reparto diario y tope de funciones ───────────────────────────
await db.query("update ai_topes_funcion set max_turnos_dia=3 where funcion='profundo'");
await db.query("update app_config set value='3'::jsonb where key='ia_ritmo_factor'");
{
  const D = await usuario('elite_mensual', 'ritmo@abuso.invalid');
  const est = (await q1('select ai_cartera_estado($1) e', [D])).e;
  const dias = Math.max(1, Math.round((Date.parse(est.renueva) - Date.parse(new Date().toISOString().slice(0, 10))) / 864e5));
  eq(Number(est.limite_hoy), Math.ceil(6000000 * Math.min(1, 3 / dias)), 'límite de hoy = restante × 3 / días que quedan');
  let ultimo;
  for (let i = 0; i < 500; i++) {
    const r = await reservar(D, 'chat', 'estandar', 50000, randomUUID());
    if (!r.ok) { ultimo = r; break; }
    await liquidar(r.id, 50000);
  }
  eq(ultimo?.motivo, dias <= 3 ? 'tope_mes' : 'ritmo_diario', 'el día se corta por el ritmo');
  const g = await comprometido(D);
  ok(g.std <= Number(est.limite_hoy) + 50000, 'el día no pasa de su límite más una llamada');

  const P = await usuario('elite_mensual', 'profundo@abuso.invalid');
  for (let t = 0; t < 3; t++) {
    const turno = randomUUID();
    for (let k = 0; k < 2; k++) {
      const r = await reservar(P, 'profundo', 'profundo', 30000, turno);
      eq(r.ok, true, 'las llamadas de un mismo turno profundo cuentan como un turno');
      await liquidar(r.id, 30000);
    }
  }
  eq((await reservar(P, 'profundo', 'profundo', 30000, randomUUID())).motivo, 'tope_funcion', 'el cuarto turno profundo del día, no');
  eq((await reservar(P, 'chat', 'estandar', 2000000, randomUUID())).motivo, 'tope_llamada', 'una llamada no puede reservar más que su función');
  eq((await reservar(P, 'inventada', 'estandar', 1000, randomUUID())).motivo, 'funcion_desconocida');
}

// ── 4. Lo apuntado en coach_runs por caminos antiguos también cuenta ──
{
  const L = await usuario('elite_mensual', 'legacy@abuso.invalid');
  await db.query(`insert into coach_runs(user_id,kind,mode,model,in_tokens,out_tokens,cost_micro_usd)
    values($1,'chat','estandar','claude-sonnet-5',1,1,5950000)`, [L]);
  eq((await reservar(L, 'chat', 'estandar', 60000, randomUUID())).motivo, 'tope_mes', 'coach_runs antiguos cuentan');
  eq((await reservar(L, 'chat', 'estandar', 50000, randomUUID())).ok, true, 'cabe lo que de verdad queda');
}

// ── 5. Huérfanas y sin derecho ──────────────────────────────────────
{
  const H = await usuario('pro_mensual', 'huerfana@abuso.invalid');
  const r = await reservar(H, 'chat', 'estandar', 100000, randomUUID());
  await db.query("update ai_cargos set created_at=now()-interval '20 minutes' where id=$1", [r.id]);
  await reservar(H, 'chat', 'estandar', 1000, randomUUID());
  const fila = await q1('select estado, real_micro from ai_cargos where id=$1', [r.id]);
  eq([fila.estado, Number(fila.real_micro)], ['caducado', 100000], 'la huérfana se cobra entera');
  eq((await liquidar(r.id, 0)).ok, false, 'una caducada no se puede liberar después');
  const F = await usuario(null, 'free@abuso.invalid');
  eq((await reservar(F, 'chat', 'estandar', 1000, randomUUID())).motivo, 'sin_suscripcion');
}

// ── 6. Permisos, estado de la app y exportación ─────────────────────
await db.exec("select set_config('request.jwt.claim.role','authenticated',false); set role authenticated");
await db.query("select set_config('request.jwt.claim.sub',$1,false)", [E]);
await assert.rejects(() => db.query('select ai_reservar($1,$2,$3,$4,$5)', [E, 'chat', 'estandar', 1, randomUUID()]), /permission denied/);
await assert.rejects(() => db.query('select ai_liquidar($1,$2)', [randomUUID(), 0]), /permission denied/);
await assert.rejects(() => db.query('select apply_ai_recargas($1,$2)', [E, '[]']), /permission denied/);
await assert.rejects(() => db.query('select * from ai_cargos'), /permission denied/);
checks += 4;
const status = (await q1('select ai_status() s')).s;
ok(status.ia && Number(status.ia.tope) === 8000000, 'ai_status trae la cartera');
ok(Number(status.ia.usado) <= Number(status.ia.tope), 'usado <= tope en la app');
ok(!('routes' in status) && !('periodo_desde' in status), 'sin rutas ni datos internos');
const exp = (await q1('select export_my_data() e')).e;
ok(exp.ai_cargos.length > 100 && exp.ai_recargas.length === 1 && exp.ai_cartera.length === 1, 'la exportación trae la cartera propia');
ok(Array.isArray(exp.coach_runs), 'y todo lo de antes (versión envuelta)');
// Con WORK (0075) y FOCUS (0076) en la base, la versión envuelta trae también sus tablas.
for (const t of ['money_recurring', 'money_briefs', 'focus_subjects', 'focus_cards']) {
  if ((await q1('select to_regclass($1) is not null as hay', [`public.${t}`])).hay) ok(Array.isArray(exp[t]), `la exportación final trae ${t}`);
}
ok(!JSON.stringify(exp).includes('mes@abuso') && !JSON.stringify(exp.ai_cargos).includes('turno'), 'nada ajeno ni ids internos');
await db.exec('reset role');
const comentario = (await q1("select obj_description(to_regprocedure('public.export_my_data()'),'pg_proc') c")).c;
ok(/nivl:export-analitica-0072/.test(comentario) && /nivl:export-modos-0068/.test(comentario) && /nivl:export-ia-0079/.test(comentario),
  'las huellas anteriores siguen en el comentario de export_my_data');
eq((comentario.match(/nivl:export-ia-0079/g) ?? []).length, 1, 'aplicada dos veces, envuelta una sola vez');

await db.close();
console.log(`PASS tope de IA: ${checks} comprobaciones.`);
console.log(`  Élite, 12 dispositivos: ${logE.peticiones} reservas, ${logE.reintentos} reintentos, ${logE.huerfanas} huérfanas, ` +
  `${logE.liberadas} liberadas, negadas ${JSON.stringify(logE.negadas)}.`);
console.log(`  Comprometido: estándar ${gE.std} / 6.000.000, profundo ${gE.deep} / 2.000.000, total ${gE.total} / 8.000.000 µ$ (exceso 0).`);
console.log(`  Con recarga de 1,5 $: total ${gR.total} / 9.500.000 µ$.`);
