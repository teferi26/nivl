// NIVL · Administración de los ludus del Élite (local, solo el dueño).
//
// Un ludus (tabla elite_groups, 0026) es un grupo de 5 a 8 gladiadores Élite
// con el mismo objetivo. La app solo deja PEDIR plaza; formar los ludus y
// asignar a cada uno es a mano, con este script: con 100 plazas de fundador,
// emparejar a mano es lo sensato. Habla con la base por la Management API,
// con el mismo token que apply-migrations.mjs (supabase-token.txt, gitignorado,
// o SUPABASE_ACCESS_TOKEN).
//
// Uso:
//   node scripts/ludus.mjs lista
//   node scripts/ludus.mjs pendientes
//   node scripts/ludus.mjs crear "nombre" objetivo [plazas 5-8]
//   node scripts/ludus.mjs asignar "nombre" email
//   node scripts/ludus.mjs sacar email
//
// objetivo: emprendedor | trabajador | deportista | estudiante | general
//
// El servidor revalida al asignar (trigger de la 0026): si la cuenta no es
// Élite o el ludus está lleno, la base de datos lo rechaza. La salida lleva
// emails: no la pegues en un commit, un issue ni una captura.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { missingTokenMessage, readToken } from './token.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');

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
const REF = URL_SB.match(/https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1];

function fallo(msg) {
  console.error(msg);
  process.exit(1);
}

async function sql(query) {
  const token = readToken(ROOT);
  if (!REF) fallo('No se pudo deducir el project ref de EXPO_PUBLIC_SUPABASE_URL.');
  if (!token) fallo(missingTokenMessage(ROOT));
  const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
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

// ── Validación y literales ──────────────────────────────────────────

/** Literal de texto SQL. */
function q(v) {
  const s = String(v);
  if (s.includes('\u0000')) fallo('Texto con caracteres no válidos.');
  return `'${s.replace(/'/g, "''")}'`;
}

const OBJETIVOS = ['emprendedor', 'trabajador', 'deportista', 'estudiante', 'general'];

function nombre(raw) {
  const n = String(raw ?? '').trim();
  if (n.length < 1 || n.length > 40) fallo('El nombre del ludus va de 1 a 40 caracteres.');
  return n;
}

function objetivo(raw) {
  const o = String(raw ?? '').toLowerCase();
  if (!OBJETIVOS.includes(o)) fallo(`Objetivo no válido: «${raw ?? ''}». Usa ${OBJETIVOS.join(' | ')}.`);
  return o;
}

function plazas(raw) {
  if (raw === undefined) return 8;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 5 || n > 8) fallo('Las plazas van de 5 a 8.');
  return n;
}

function email(raw) {
  const e = String(raw ?? '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) fallo('Email no válido.');
  return e;
}

// ── Comandos ────────────────────────────────────────────────────────

async function lista() {
  const rows = await sql(
    `select g.name as ludus, g.goal as objetivo,
            (select count(*) from public.elite_group_members m where m.group_id = g.id)::int as miembros,
            g.capacity as plazas
     from public.elite_groups g
     order by g.goal, g.name;`,
  );
  if (!rows.length) return console.log('Aún no hay ningún ludus. Crea uno con: crear "nombre" objetivo');
  console.table(rows);
}

async function pendientes() {
  const rows = await sql(
    `select u.email, r.goal as objetivo, public.user_tier(r.user_id) as nivel,
            to_char(r.created_at at time zone 'Europe/Madrid', 'YYYY-MM-DD HH24:MI') as pedido,
            coalesce(r.note, '') as nota
     from public.elite_group_requests r
     join auth.users u on u.id = r.user_id
     order by r.goal, r.created_at;`,
  );
  if (!rows.length) return console.log('No hay peticiones pendientes.');
  console.table(rows);
  const caducadas = rows.filter((r) => r.nivel !== 'elite' && r.nivel !== 'owner');
  if (caducadas.length) {
    console.log(`\n${caducadas.length} ya no son Élite: el servidor no dejará asignarlas.`);
  }
}

async function crear(rawNombre, rawObjetivo, rawPlazas) {
  const n = nombre(rawNombre);
  const o = objetivo(rawObjetivo);
  const p = plazas(rawPlazas);
  const res = await sql(
    `insert into public.elite_groups (name, goal, capacity)
     values (${q(n)}, ${q(o)}, ${p})
     on conflict do nothing
     returning name;`,
  );
  if (!res.length) fallo(`Ya existe un ludus llamado «${n}».`);
  console.log(`Ludus «${n}» creado (${o}, ${p} plazas).`);
}

async function asignar(rawNombre, rawEmail) {
  const n = nombre(rawNombre);
  const e = email(rawEmail);
  const [g] = await sql(`select id from public.elite_groups where lower(btrim(name)) = lower(${q(n)});`);
  if (!g) fallo(`No hay ningún ludus llamado «${n}».`);
  const [u] = await sql(`select id from auth.users where lower(email) = ${q(e)} limit 1;`);
  if (!u) fallo('Esa cuenta no ha entrado nunca en NIVL.');
  const [ya] = await sql(
    `select g.name from public.elite_group_members m join public.elite_groups g on g.id = m.group_id
     where m.user_id = ${q(u.id)};`,
  );
  if (ya) fallo(`Ya está en el ludus «${ya.name}». Sácale primero con: sacar ${e}`);
  // El trigger de la 0026 comprueba que es Élite y que cabe; si no, lanza.
  await sql(`insert into public.elite_group_members (group_id, user_id) values (${q(g.id)}, ${q(u.id)});`);
  console.log(`Asignado a «${n}». Lo verá en Amigos → Tu ludus.`);
}

async function sacar(rawEmail) {
  const e = email(rawEmail);
  const res = await sql(
    `delete from public.elite_group_members m
     using auth.users u
     where u.id = m.user_id and lower(u.email) = ${q(e)}
     returning m.group_id;`,
  );
  if (!res.length) fallo('Esa cuenta no está en ningún ludus.');
  console.log('Fuera de su ludus.');
}

// ── Entrada ─────────────────────────────────────────────────────────

const COMANDOS = { lista, pendientes, crear, asignar, sacar };

const [cmd, ...args] = process.argv.slice(2);
const fn = COMANDOS[cmd];
if (!fn) {
  console.log(
    readFileSync(fileURLToPath(import.meta.url), 'utf8')
      .split('\n')
      .filter((l) => l.startsWith('//   node'))
      .map((l) => l.slice(5))
      .join('\n'),
  );
  process.exit(cmd ? 1 : 0);
}

try {
  await fn(...args);
} catch (e) {
  fallo(`Falló: ${e.message}`);
}
