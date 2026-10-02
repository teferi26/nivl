// NIVL · Coste del coach por kind, ruta y modelo (coach v2, L0). SOLO LECTURA.
//
// Lee coach_runs por la Management API (como apply-migrations.mjs: token de
// supabase-token.txt o SUPABASE_ACCESS_TOKEN, ref de EXPO_PUBLIC_SUPABASE_URL)
// y aborta si el proyecto no es el de NIVL. Imprime, por kind/ruta/modelo:
// turnos, coste medio, p50 y p90, % de entrada leída de caché y escritura de
// caché media por turno.
//
// Privacidad: nunca selecciona user_id ni textos; solo agregados. Un grupo con
// menos de 3 usuarios distintos NO se desglosa (con un solo usuario, sus cifras
// son las de esa persona): se cuentan los grupos ocultados y nada más.
//
// Uso:
//   node scripts/coste-coach.mjs [--dias 30]

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { missingTokenMessage, readToken } from './token.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const REF_NIVL = 'dueyufxxkiixdxighpaz';
const MIN_USUARIOS = 3;

function readEnv() {
  const out = {};
  try {
    for (const line of readFileSync(join(ROOT, '.env'), 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (m) out[m[1]] = m[2].trim();
    }
  } catch {
    /* sin .env */
  }
  return out;
}

function argDias() {
  const i = process.argv.indexOf('--dias');
  if (i === -1) return 30;
  const n = Number(process.argv[i + 1]);
  if (!Number.isInteger(n) || n < 1 || n > 366) {
    console.error('--dias debe ser un entero entre 1 y 366.');
    process.exit(1);
  }
  return n;
}

const DIAS = argDias();
const env = readEnv();
const URL_SB = process.env.EXPO_PUBLIC_SUPABASE_URL ?? env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const REF = URL_SB.match(/https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1];
if (REF !== REF_NIVL) {
  console.error(`Proyecto inesperado (${REF ?? 'sin ref'}): este script solo lee NIVL (${REF_NIVL}). Aborto.`);
  process.exit(2);
}
const TOKEN = readToken(ROOT);
if (!TOKEN) {
  console.error(missingTokenMessage(ROOT));
  process.exit(1);
}

async function sql(query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST',
    headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status}: ${text.slice(0, 300)}`);
  return JSON.parse(text);
}

// La columna route llega con la 0047: sin ella, la ruta sale como "—".
const [{ con_ruta: conRuta }] = await sql(
  `select exists(select 1 from information_schema.columns where table_schema = 'public' and table_name = 'coach_runs' and column_name = 'route') as con_ruta`,
);
const ruta = conRuta ? `coalesce(route, '—')` : `'—'::text`;

// Las consultas son SELECT fijos: DIAS es un entero validado arriba.
const grupos = `
  with base as (
    select kind, ${ruta} as route, coalesce(model, '—') as model, user_id,
           cost_micro_usd, in_tokens, cache_read_tokens, cache_write_tokens
    from public.coach_runs
    where created_at >= now() - make_interval(days => ${DIAS})
  )
  select kind, route, model,
         count(*)::int as turnos,
         count(distinct user_id)::int as usuarios,
         round(avg(cost_micro_usd))::bigint as media,
         round(percentile_cont(0.5) within group (order by cost_micro_usd))::bigint as p50,
         round(percentile_cont(0.9) within group (order by cost_micro_usd))::bigint as p90,
         round(100.0 * sum(cache_read_tokens) / nullif(sum(in_tokens + cache_read_tokens + cache_write_tokens), 0), 1) as pct_lectura,
         round(avg(cache_write_tokens))::bigint as escritura_media
  from base
  group by kind, route, model`;

const visibles = await sql(`${grupos} having count(distinct user_id) >= ${MIN_USUARIOS} order by turnos desc`);
const [{ ocultos }] = await sql(
  `select count(*)::int as ocultos from (${grupos} having count(distinct user_id) < ${MIN_USUARIOS}) g`,
);

const usd = (micro) => (Number(micro) / 1e6).toFixed(4);
console.log(`Proyecto ${REF} · coach_runs · últimos ${DIAS} días${conRuta ? '' : ' · (sin 0047: ruta "—")'}\n`);
if (!visibles.length) {
  console.log(`Ningún grupo con ${MIN_USUARIOS} o más usuarios distintos: no se desglosa nada.`);
} else {
  console.table(
    visibles.map((g) => ({
      kind: g.kind,
      ruta: g.route,
      modelo: g.model,
      turnos: g.turnos,
      'media $': usd(g.media),
      'p50 $': usd(g.p50),
      'p90 $': usd(g.p90),
      '% lectura caché': g.pct_lectura ?? '—',
      'escritura media': g.escritura_media,
    })),
  );
}
if (ocultos) console.log(`\n${ocultos} grupo(s) con menos de ${MIN_USUARIOS} usuarios distintos ocultados.`);
