// NIVL · Trasplante de la memoria del coach anterior.
//
// Lee el CEREBRO exportado de Notion y lo reparte en dos sitios:
//   · Todo lo estable (perfil, objetivos, proyectos, reglas, sistema,
//     protocolos, aprendizajes) → coach_dossier. Va cacheado en cada prompt.
//   · El "Log del coach" → coach_facts, una fila por entrada con su fecha
//     real. Así el coach nuevo recuerda lo que pasó cada día, no solo el
//     resumen.
//
// Uso (el mismo token que aplica las migraciones):
//   SUPABASE_ACCESS_TOKEN=sbp_... node scripts/import-cerebro.mjs [--dry]
//
// La credencial se pasa por entorno para esta única ejecución, nunca se
// guarda en el repo. El fichero de origen (scripts/cerebro.md) está
// gitignorado porque contiene datos personales, financieros y de salud.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { missingTokenMessage, readToken } from './token.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');

const DRY = process.argv.includes('--dry');
const SRC = process.argv.find((a) => a.endsWith('.md')) ?? join(HERE, 'cerebro.md');

// ── Configuración ───────────────────────────────────────────────────
function readEnv() {
  const out = {};
  try {
    const t = readFileSync(join(ROOT, '.env'), 'utf8');
    for (const line of t.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (m) out[m[1]] = m[2].trim();
    }
  } catch {
    /* sin .env: se espera todo por entorno */
  }
  return out;
}

const env = readEnv();
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const TOKEN = readToken(ROOT);
// La cuenta de NIVL en Supabase (distinta del correo personal). Se puede
// sobreescribir con NIVL_EMAIL si algún día cambia.
const EMAIL = process.env.NIVL_EMAIL ?? 'teferilaforga@gmail.com';
const REF = SUPABASE_URL.match(/https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1];

async function sql(query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST',
    headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' },
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

// Comillas en dólar con etiqueta única: el CEREBRO lleva apóstrofos, comillas
// y saltos de línea a discreción, y escaparlos a mano es pedir un fallo.
function q(texto) {
  let tag = 'nivl';
  let i = 0;
  while (texto.includes(`$${tag}$`)) tag = `nivl${++i}`;
  return `$${tag}$${texto}$${tag}$`;
}

// ── Troceado ────────────────────────────────────────────────────────
const MESES = {
  ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6,
  jul: 7, ago: 8, sep: 9, oct: 10, nov: 11, dic: 12,
};

/**
 * Fecha de una entrada de log. El cuaderno mezcla dos formatos:
 *   **29/07/2026** — …        y        **3 ago (lunes noche) — …**
 * El segundo no lleva año: se toma el del contexto (la última fecha completa
 * vista), que es como lo leería un humano.
 */
function parseFecha(head, anioContexto) {
  // Las entradas que escribe el coach del móvil vienen en ISO.
  const iso = head.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return { iso: iso[0], anio: Number(iso[1]) };

  const dmy = head.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (dmy) {
    return {
      iso: `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`,
      anio: Number(dmy[3]),
    };
  }
  const dm = head.match(/(\d{1,2})\s+(ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)/i);
  if (dm && anioContexto) {
    const mes = MESES[dm[2].toLowerCase()];
    return {
      iso: `${anioContexto}-${String(mes).padStart(2, '0')}-${dm[1].padStart(2, '0')}`,
      anio: anioContexto,
    };
  }
  return null;
}

// Clasifica cada entrada para que el coach pueda recuperar por tipo.
// El orden importa: 'aprendizaje' y 'regla' son las categorías que NO caducan
// del contexto, así que se comprueban primero. Ante la duda, log.
function clasificar(texto) {
  const t = texto.toLowerCase();
  if (/\baprendizaje|\bpatr[oó]n\b|\blecci[oó]n\b|\bcoachability\b/.test(t)) return 'aprendizaje';
  if (/\bley nueva\b|\bregla nueva\b|\binnegociable/.test(t)) return 'regla';
  if (/\bmarcacion|\bllamada|\bdemo\b|\bdemos\b|\bcliente|\bpitch\b|\blead\b/.test(t)) return 'venta';
  if (/\bkg\b|\bpeso\b|\bbanca\b|\bcorrer\b|\bnadar\b/.test(t)) return 'metrica';
  return 'log';
}

// Una entrada de log empieza SIEMPRE por una fecha, en cualquiera de los tres
// formatos que conviven en la página: **29/07/2026 — …**, **3 ago (lunes) — …**
// y ### 2026-08-14 · … (las que escribe ya el coach del móvil).
const INICIO_ENTRADA =
  /^(?:###\s+)?\*{0,2}(?:\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4}|\d{1,2}\s+(?:ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)\b)/i;

function trocear(md) {
  // El log NO vive todo bajo su encabezado: en la página real hay entradas
  // sueltas después de los protocolos de dieta, gym y piel, porque se fueron
  // añadiendo al final del documento. Por eso no se busca por sección, sino
  // por forma: cualquier párrafo que empiece por una fecha es una entrada de
  // log, esté donde esté. Lo demás es dossier.
  const bloques = md.split(/\n\s*\n/);
  const hechos = [];
  const dossier = [];
  let anio = null;

  for (const bloque of bloques) {
    const texto = bloque.trim();
    if (!texto) continue;

    if (!INICIO_ENTRADA.test(texto)) {
      dossier.push(texto);
      continue;
    }

    const f = parseFecha(texto.slice(0, 140), anio);
    if (!f) {
      dossier.push(texto);
      continue;
    }
    anio = f.anio;

    const contenido = texto
      .replace(/^###\s+/, '')
      .replace(/\*\*/g, '')
      // La fecha ya vive en su columna: repetirla dentro del texto solo gasta
      // contexto en cada prompt.
      .replace(/^\s*\d{4}-\d{2}-\d{2}\s*[·—-]\s*/, '')
      .replace(/^\s*\d{1,2}\/\d{1,2}\/\d{4}\s*(\([^)]*\))?\s*[—-]\s*/, '')
      .replace(/^\s*\d{1,2}\s+\w+\s*(\([^)]*\))?\s*[—-]\s*/, '')
      .replace(/\s+/g, ' ')
      .trim();

    hechos.push({ date: f.iso, category: clasificar(contenido), content: contenido });
  }

  // El encabezado del log se queda huérfano al sacar sus entradas.
  const dossierMd = dossier
    .filter((b) => !/^#\s*📅?\s*Log del coach\s*$/i.test(b))
    .join('\n\n')
    .trim();

  hechos.sort((a, b) => a.date.localeCompare(b.date));
  return { dossierMd, hechos };
}

// ── Ejecución ───────────────────────────────────────────────────────
const md = readFileSync(SRC, 'utf8');
const { dossierMd, hechos } = trocear(md);

console.log(`Origen        ${SRC}`);
console.log(`Dossier       ${dossierMd.length} caracteres (~${Math.round(dossierMd.length / 3.6)} tokens)`);
console.log(`Hechos        ${hechos.length}`);
const porCat = {};
for (const h of hechos) porCat[h.category] = (porCat[h.category] ?? 0) + 1;
console.log(`Por categoría ${JSON.stringify(porCat)}`);
if (hechos.length) {
  console.log(`Rango fechas  ${hechos[0].date} → ${hechos[hechos.length - 1].date}`);
}

if (DRY) {
  console.log('\n--- primeras 3 entradas del log ---');
  for (const h of hechos.slice(0, 3)) {
    console.log(`\n[${h.date}] (${h.category}) ${h.content.slice(0, 180)}…`);
  }
  console.log('\n(--dry: no se ha escrito nada)');
  process.exit(0);
}

if (!REF) {
  console.error('\nNo se pudo deducir el project ref de EXPO_PUBLIC_SUPABASE_URL.');
  process.exit(1);
}
if (!TOKEN) {
  console.error(`\n${missingTokenMessage(ROOT)}`);
  process.exit(1);
}

const usuarios = await sql(
  `select id, email from auth.users where lower(email) = lower(${q(EMAIL)}) limit 1;`,
);
if (!usuarios.length) {
  console.error(`\nNo hay ningún usuario con email ${EMAIL}.`);
  console.error('Crea la cuenta en la app primero, o pasa NIVL_EMAIL=otro@correo');
  process.exit(1);
}
const user = usuarios[0];
console.log(`\nUsuario       ${user.email} (${user.id})`);

// Todo en una transacción: o entra la memoria entera o no entra nada.
// El borrado previo de lo importado hace que reimportar no duplique.
const valores = hechos
  .map((h) => `(${q(user.id)}::uuid, ${q(h.date)}::date, ${q(h.category)}, ${q(h.content)}, 'import')`)
  .join(',\n    ');

const script = `
begin;

insert into public.coach_dossier (user_id, content, version, updated_at)
  values (${q(user.id)}::uuid, ${q(dossierMd)}, 1, now())
  on conflict (user_id) do update
    set content = excluded.content,
        version = public.coach_dossier.version + 1,
        updated_at = now();

delete from public.coach_facts where user_id = ${q(user.id)}::uuid and source = 'import';

${
  hechos.length
    ? `insert into public.coach_facts (user_id, date, category, content, source)
  values
    ${valores};`
    : '-- sin entradas de log'
}

commit;
`;

try {
  await sql(script);
} catch (e) {
  console.error('\nError escribiendo la memoria:', e.message);
  process.exit(1);
}

const [resumen] = await sql(
  `select
     (select version from public.coach_dossier where user_id = ${q(user.id)}::uuid) as version,
     (select length(content) from public.coach_dossier where user_id = ${q(user.id)}::uuid) as chars,
     (select count(*) from public.coach_facts where user_id = ${q(user.id)}::uuid) as hechos;`,
);
console.log(`Dossier       versión ${resumen.version}, ${resumen.chars} caracteres`);
console.log(`Hechos        ${resumen.hechos} en memoria`);
console.log('\nEl coach ya recuerda.');
