// NIVL · Cierra el circuito de los rituales automáticos.
//
// La migración 0010 genera el secreto compartido dentro de la base de datos.
// Este script hace las dos cosas que la base de datos no puede hacer sola:
//   1. Guardar la URL del proyecto en el Vault, para que el cron sepa a dónde
//      llamar.
//   2. Sacar el secreto y ponerlo como variable de la Edge Function `ritual`,
//      que es su otra mitad.
//
// El secreto nunca se imprime ni se escribe en ningún fichero del repositorio.
//
// Uso:
//   node scripts/setup-cron.mjs [--comprobar]

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { missingTokenMessage, readToken } from './token.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SOLO_COMPROBAR = process.argv.includes('--comprobar');

function env() {
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

const URL_SB = process.env.EXPO_PUBLIC_SUPABASE_URL ?? env().EXPO_PUBLIC_SUPABASE_URL ?? '';
const REF = URL_SB.match(/https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1];
const TOKEN = readToken(ROOT);

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
    headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status}: ${text.slice(0, 500)}`);
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

// 1) Estado actual
const [estado] = await sql(`
  select
    exists(select 1 from pg_extension where extname = 'pg_cron') as cron,
    exists(select 1 from pg_extension where extname = 'pg_net') as net,
    exists(select 1 from vault.secrets where name = 'nivl_ritual_secret') as secreto,
    exists(select 1 from vault.secrets where name = 'nivl_project_url') as url,
    (select count(*) from cron.job where jobname = 'nivl-rituales') as trabajos;
`);

console.log(`Proyecto      ${REF}`);
console.log(`pg_cron       ${estado.cron ? 'sí' : 'NO'}`);
console.log(`pg_net        ${estado.net ? 'sí' : 'NO'}`);
console.log(`secreto       ${estado.secreto ? 'sí' : 'NO'}`);
console.log(`url guardada  ${estado.url ? 'sí' : 'NO'}`);
console.log(`cron activo   ${estado.trabajos > 0 ? 'sí' : 'NO'}`);

if (!estado.cron || !estado.secreto) {
  console.error('\nFalta aplicar la migración 0010. Ejecuta antes:');
  console.error('  node scripts/apply-migrations.mjs');
  process.exit(1);
}

if (SOLO_COMPROBAR) {
  const historial = await sql(`
    select status, return_message, start_time
      from cron.job_run_details
      where jobid = (select jobid from cron.job where jobname = 'nivl-rituales')
      order by start_time desc limit 5;
  `);
  console.log('\nÚltimas ejecuciones del cron:');
  console.table(historial);
  process.exit(0);
}

// 2) Guardar la URL del proyecto en el Vault
if (!estado.url) {
  await sql(`select vault.create_secret('${URL_SB}', 'nivl_project_url');`);
  console.log('\nURL del proyecto guardada en el Vault.');
} else {
  await sql(`
    update vault.secrets set secret = '${URL_SB}' where name = 'nivl_project_url';
  `).catch(() => {});
}

// 3) Pasar el secreto a la Edge Function. Se hace por la Management API en vez
//    de invocar al CLI: evita lanzar un subproceso (que en Windows falla) y
//    que el valor aparezca nunca en una línea de comandos.
const [{ decrypted_secret: secreto }] = await sql(
  `select decrypted_secret from vault.decrypted_secrets where name = 'nivl_ritual_secret';`,
);
if (!secreto) {
  console.error('El secreto existe pero no se pudo descifrar.');
  process.exit(1);
}

const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/secrets`, {
  method: 'POST',
  headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' },
  body: JSON.stringify([{ name: 'RITUAL_SECRET', value: secreto }]),
});
if (!res.ok) {
  console.error('No se pudo poner RITUAL_SECRET:', res.status, (await res.text()).slice(0, 300));
  process.exit(1);
}
console.log('RITUAL_SECRET puesto en la Edge Function.');

console.log('\nCircuito cerrado: el cron llamará a los rituales cada hora en punto.');
console.log('Para ver si corre:  node scripts/setup-cron.mjs --comprobar');
