// NIVL · 0085 (recuento anónimo de descargas del regalo) contra la migración REAL, en PostgreSQL en memoria.
// Sin red, sin Supabase, sin credenciales.
//
//   node scripts/test-regalo-descargas.mjs /ruta/a/@electric-sql/pglite/dist/index.js
//
// Qué demuestra:
//   1. regalo_contar suma 1 por (día, origen) con upsert; origen inválido o nulo cuenta como `otro`; mayúsculas a minúsculas.
//   2. anon y authenticated no pueden ni ejecutar la RPC ni leer la tabla; service_role sí.
//   3. La purga borra solo lo de más de 365 días.
//   4. La huella de apply-migrations.mjs da true tras aplicarla.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

if (!process.argv[2]) throw new Error('Indica la ruta de un módulo PGlite existente (este test no instala nada).');
const { PGlite } = await import(pathToFileURL(resolve(process.argv[2])).href);
const root = new URL('../', import.meta.url);

const db = new PGlite();
await db.exec(`
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
`);
await db.exec(await readFile(new URL('supabase/migrations/0085_regalo_descargas.sql', root), 'utf8'));

let checks = 0;
const eq = (a, b, m) => { assert.deepEqual(a, b, m); checks++; };
const como = async (rol, sql) => {
  await db.exec(`set role ${rol}`);
  try { return await db.query(sql); } finally { await db.exec('reset role'); }
};
const falla = async (rol, sql, m) => {
  await assert.rejects(como(rol, sql), /permission denied/, m); checks++;
};

// 1. Recuento.
const c = async (o) => (await como('service_role', `select public.regalo_contar(${o}) as n`)).rows[0].n;
eq(await c(`'clips_hb_yt'`), 1, 'primera descarga');
eq(await c(`'clips_hb_yt'`), 2, 'segunda descarga, misma fila');
eq(await c(`'CLIPS_HB_YT'`), 3, 'mayúsculas cuentan como el mismo origen');
eq(await c(`'md'`), 1, 'otro origen, otra fila');
eq(await c(`'<script>'`), 1, 'origen inválido cuenta como otro');
eq(await c(`null`), 2, 'origen nulo cuenta como otro');
eq(await c(`'${'a'.repeat(49)}'`), 3, 'origen de 49 caracteres es inválido');
eq(await c(`''`), 4, 'origen vacío es inválido');
const filas = (await db.query(`select origen, n from public.regalo_descargas order by origen`)).rows;
eq(filas, [{ origen: 'clips_hb_yt', n: 3 }, { origen: 'md', n: 1 }, { origen: 'otro', n: 4 }], 'tabla final');
eq((await db.query(`select count(distinct dia)::int as d from public.regalo_descargas`)).rows[0].d, 1, 'un solo día');

// 2. Permisos.
for (const rol of ['anon', 'authenticated']) {
  await falla(rol, `select public.regalo_contar('x')`, `${rol} no ejecuta la RPC`);
  await falla(rol, `select * from public.regalo_descargas`, `${rol} no lee la tabla`);
  await falla(rol, `insert into public.regalo_descargas values (current_date, 'x', 1)`, `${rol} no escribe`);
  await falla(rol, `select public.purgar_regalo_descargas()`, `${rol} no purga`);
}
eq((await como('service_role', `select count(*)::int as k from public.regalo_descargas`)).rows[0].k, 3, 'service_role lee');

// 3. Purga.
await db.exec(`insert into public.regalo_descargas values
  ((now() at time zone 'utc')::date - 366, 'viejo', 5),
  ((now() at time zone 'utc')::date - 365, 'limite', 2)`);
eq((await db.query(`select public.purgar_regalo_descargas() as b`)).rows[0].b, 1, 'purga solo > 365 días');
eq((await db.query(`select origen from public.regalo_descargas where origen in ('viejo','limite')`)).rows, [{ origen: 'limite' }], 'queda el del límite');

// 4. Huella.
const apply = await readFile(new URL('scripts/apply-migrations.mjs', root), 'utf8');
const huella = apply.match(/'0085': `([^`]+)`/)[1];
eq((await db.query(`select ${huella} as ok`)).rows[0].ok, true, 'huella 0085');

console.log(`OK test-regalo-descargas: ${checks} comprobaciones.`);
