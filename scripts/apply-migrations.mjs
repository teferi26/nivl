// NIVL · Aplica las migraciones pendientes contra el proyecto de Supabase.
//
// Usa la Management API, así que basta con un Personal Access Token: no hace
// falta la contraseña de la base de datos ni entrar al SQL Editor a pegar
// nada. Detecta qué migraciones ya están aplicadas mirando si existen los
// objetos que crean, de modo que es seguro ejecutarlo varias veces.
//
// Uso:
//   SUPABASE_ACCESS_TOKEN=sbp_... node scripts/apply-migrations.mjs [--dry]
//
// El token se saca en: supabase.com/dashboard/account/tokens

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { missingTokenMessage, readToken } from './token.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const MIGRATIONS = join(ROOT, 'supabase', 'migrations');
const DRY = process.argv.includes('--dry');

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

const env = readEnv();
const URL_SB = process.env.EXPO_PUBLIC_SUPABASE_URL ?? env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const TOKEN = readToken(ROOT);
const REF = URL_SB.match(/https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1];

if (!REF) {
  console.error('No se pudo deducir el project ref de EXPO_PUBLIC_SUPABASE_URL.');
  process.exit(1);
}
if (!TOKEN) {
  console.error(missingTokenMessage(ROOT));
  process.exit(1);
}

async function sql(query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${TOKEN}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status}: ${text.slice(0, 600)}`);
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

// Cada migración se reconoce por un objeto que solo ella crea.
const HUELLAS = {
  '0001': `to_regclass('public.profiles') is not null`,
  '0002': `to_regclass('public.dungeons') is not null`,
  '0003': `exists(select 1 from pg_constraint where conname = 'profiles_xp_nonneg')`,
  '0004': `exists(select 1 from pg_proc where proname = 'delete_own_account')`,
  '0005': `to_regclass('public.rules') is not null`,
  '0006': `to_regclass('public.subscriptions') is not null`,
  '0007': `to_regclass('public.goals') is not null`,
  '0008': `to_regclass('public.coach_dossier') is not null`,
  '0009': `exists(select 1 from pg_proc where proname = 'award_xp')`,
  // No se comprueba cron.job directamente: si pg_cron no está instalado, esa
  // tabla no existe y la consulta fallaría al analizarse.
  '0010': `exists(select 1 from pg_proc where proname = 'disparar_rituales')`,
  '0011': `exists(select 1 from pg_constraint where conname = 'journal_entries_unique')`,
  '0012': `to_regclass('public.cardio_sessions') is not null`,
};

const archivos = readdirSync(MIGRATIONS)
  .filter((f) => f.endsWith('.sql'))
  .sort();

const probe = Object.entries(HUELLAS)
  .map(([n, expr]) => `${expr} as m${n}`)
  .join(',\n  ');

console.log(`Proyecto      ${REF}`);
const [estado] = await sql(`select\n  ${probe};`);

// Una migración sin huella se considera PENDIENTE, no "ya aplicada": antes se
// filtraba en silencio y una migración nueva podía no llegar a ejecutarse
// nunca sin que nadie se enterase.
const sinHuella = archivos.filter((f) => !HUELLAS[f.slice(0, 4)]);
const pendientes = archivos.filter((f) => {
  const n = f.slice(0, 4);
  return !HUELLAS[n] || estado[`m${n}`] === false;
});

for (const f of archivos) {
  const n = f.slice(0, 4);
  const aplicada = HUELLAS[n] && estado[`m${n}`];
  console.log(`  ${aplicada ? 'ya aplicada ' : 'PENDIENTE  '} ${f}${HUELLAS[n] ? '' : '  (sin huella)'}`);
}

if (sinHuella.length) {
  console.log(
    `\nAviso: ${sinHuella.join(', ')} no tiene huella en este script. Se intentará` +
      ' aplicar cada vez hasta que se le añada una en HUELLAS.',
  );
}

if (!pendientes.length) {
  console.log('\nNada que hacer: el esquema está al día.');
  process.exit(0);
}

if (DRY) {
  console.log(`\n(--dry) Se aplicarían ${pendientes.length}: ${pendientes.join(', ')}`);
  process.exit(0);
}

console.log(`\nAplicando ${pendientes.length} migración(es)…\n`);
for (const f of pendientes) {
  const contenido = readFileSync(join(MIGRATIONS, f), 'utf8');
  process.stdout.write(`  ${f} … `);
  try {
    await sql(contenido);
    console.log('OK');
  } catch (e) {
    console.log('FALLÓ');
    console.error(`\n${e.message}\n`);
    console.error('Se ha detenido aquí: las anteriores sí se aplicaron.');
    process.exit(1);
  }
}

// Comprobación final: releer las huellas para confirmar que quedó todo.
const [final] = await sql(`select\n  ${probe};`);
const faltan = Object.keys(HUELLAS).filter((n) => final[`m${n}`] === false);
console.log(
  faltan.length ? `\nAtención: siguen sin detectarse ${faltan.join(', ')}.` : '\nEsquema al día.',
);
