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
  '0054': `coalesce(obj_description(to_regprocedure('public.waitlist_join(text,text,text,text)'),'pg_proc') like '%nivl:waitlist-0054%', false)`,
  '0060': `coalesce(obj_description(to_regprocedure('public.export_my_data()'),'pg_proc') like '%nivl:export-v5%', false)`,
  '0053': `to_regprocedure('public.my_share_alias()') is not null`,
  '0052': `to_regprocedure('public.friends_ranks()') is not null`,
  '0047': `exists(select 1 from information_schema.columns where table_schema = 'public' and table_name = 'coach_runs' and column_name = 'state_chars')`,
  '0048': `to_regclass('public.league_invites') is not null`,
  '0051': `to_regprocedure('public.sync_rank()') is not null`,
  '0046': `coalesce(obj_description(to_regprocedure('public.creator_progress()'), 'pg_proc') like '%nivl:creator-program-0046%', false)`,
  '0050': `to_regclass('public.progress_photos') is not null`,
  '0045': `coalesce(obj_description(to_regprocedure('public.claim_invite(text)'), 'pg_proc') like '%nivl:invites-0045%', false)`,
  '0055': `coalesce(obj_description('public.my_duels()'::regprocedure, 'pg_proc') like '%nivl:competicion-0055%', false)`,
  '0044': `coalesce(obj_description('public.export_my_data()'::regprocedure, 'pg_proc') like '%nivl:export-completo-v4%', false)`,
  '0041': `to_regclass('public.xp_daily_ledger') is not null`,
  '0042': `to_regprocedure('public.claim_push_token(text,text)') is not null`,
  '0043': `not has_table_privilege('authenticated','public.quests','TRUNCATE')`,
  '0038': `pg_get_constraintdef((select oid from pg_constraint where conname='coach_runs_kind_check' and conrelid='public.coach_runs'::regclass)) like '%titular%'`,
  '0039': `to_regprocedure('public.store_events_redact(text)') is not null`,
  '0040': `coalesce(obj_description(to_regprocedure('public.export_my_data()'), 'pg_proc') like '%nivl:export-completo%', false)`,
  '0037': `to_regclass('public.ai_reports') is not null`,
  '0035': `to_regclass('public.recovery_credits') is not null`,
  '0036': `exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='apply_store_reconciliation' and obj_description(p.oid, 'pg_proc') like '%nivl:store-manual-grants-20261002%')`,
  '0034': `exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='ai_consent_version' and obj_description(p.oid, 'pg_proc') like '%nivl:consent-destinations-20260929%')`,
  '0031': `to_regclass('public.account_erasure_jobs') is not null and to_regprocedure('public.account_erasure_ready(uuid,uuid)') is not null and exists(select 1 from pg_trigger where tgrelid='storage.objects'::regclass and tgname='account_upload_guard')`,
  '0032': `to_regclass('public.social_reports') is not null and to_regclass('public.social_avatar_paths') is not null and to_regprocedure('public.social_blocked_users()') is not null and exists(select 1 from pg_trigger where tgrelid='storage.objects'::regclass and tgname='social_avatar_immutable')`,
  '0033': `to_regclass('public.store_reconciliation') is not null and to_regprocedure('public.apply_store_reconciliation(jsonb,jsonb)') is not null`,
  '0030': `to_regclass('public.health_consents') is not null and exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='complete_health_erasure')`,
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
  '0013': `to_regclass('public.transactions') is not null`,
  '0014': `to_regclass('public.recaps') is not null`,
  '0015': `exists(select 1 from information_schema.columns where table_name = 'quests' and column_name = 'acquired_at')`,
  '0016': `to_regclass('public.rule_checks') is not null`,
  '0017': `exists(select 1 from information_schema.columns where table_name = 'profiles' and column_name = 'perfect_streak_days')`,
  '0018': `exists(select 1 from information_schema.columns where table_name = 'profiles' and column_name = 'profile_kind')`,
  '0019': `exists(select 1 from information_schema.tables where table_schema = 'public' and table_name = 'body_profile')`,
  '0020': `exists(select 1 from information_schema.tables where table_schema = 'public' and table_name = 'ai_plans')`,
  // La 0022 no crea nada: reescribe un CHECK. Se reconoce por su definición.
  '0021': `to_regclass('public.friendships') is not null`,
  '0023': `exists(select 1 from information_schema.columns where table_name = 'journal_entries' and column_name = 'wins')`,
  '0022': `exists(select 1 from pg_constraint where conname = 'profiles_profile_kind_check' and pg_get_constraintdef(oid) like '%trabajador%')`,
  '0024': `exists(select 1 from information_schema.columns where table_name = 'ai_plans' and column_name = 'routes')`,
  '0025': `to_regclass('public.creators') is not null`,
  '0026': `to_regclass('public.elite_groups') is not null`,
  '0027': `to_regclass('public.store_events') is not null`,
  '0028': `to_regclass('public.ai_consents') is not null`,
  '0029': `exists(select 1 from information_schema.columns where table_schema = 'public' and table_name = 'age_confirmations' and column_name = 'app_confirmed_at') and exists(select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'ai_consent_ok' and regexp_replace(p.prosrc, '[[:space:]]', '', 'g') like '%c.source=''app''%')`,
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
