// NIVL · Alinea el coach del móvil con el de escritorio.
//
// Deja los dos secrets que activan el espejo hacia la página del CEREBRO. Y
// antes de dar nada por bueno, comprueba lo que de verdad suele fallar: que la
// integración TENGA ACCESO a la página. Crear el token no basta — hay que
// compartir la página con la integración, y si no se hace Notion contesta 404
// con un token perfectamente válido.
//
// Uso:
//   node scripts/setup-notion.mjs [--comprobar]

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { missingTokenMessage, readToken } from './token.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SOLO_COMPROBAR = process.argv.includes('--comprobar');

// La página "🧠 CEREBRO DEL COACH — Tafa".
const PAGE_ID = process.env.NOTION_PAGE_ID ?? '3ac2eddc-56e0-810f-be4b-daf2a8b2c048';

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

function leerNotionToken() {
  if (process.env.NOTION_TOKEN?.trim()) return process.env.NOTION_TOKEN.trim();
  try {
    return readFileSync(join(ROOT, 'notion-token.txt'), 'utf8')
      .split(/\r?\n/)
      .map((l) => l.trim())
      .find((l) => l && !l.startsWith('#'));
  } catch {
    return undefined;
  }
}

const URL_SB = process.env.EXPO_PUBLIC_SUPABASE_URL ?? env().EXPO_PUBLIC_SUPABASE_URL ?? '';
const REF = URL_SB.match(/https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1];
const PAT = readToken(ROOT);
const NOTION = leerNotionToken();

if (!REF) {
  console.error('No se pudo deducir el project ref de EXPO_PUBLIC_SUPABASE_URL.');
  process.exit(1);
}
if (!PAT) {
  console.error(missingTokenMessage(ROOT));
  process.exit(1);
}
if (!NOTION) {
  console.error(
    'Falta el token de Notion.\n\n' +
      '  1. Créalo en https://www.notion.so/my-integrations\n' +
      `  2. Pégalo dentro de: ${join(ROOT, 'notion-token.txt')}\n` +
      '  3. Comparte la página del CEREBRO con esa integración\n     (menú "..." → Connections → tu integración)',
  );
  process.exit(1);
}

// 1) ¿El token es válido y la página está compartida?
console.log(`Página        ${PAGE_ID}`);
const res = await fetch(`https://api.notion.com/v1/pages/${PAGE_ID}`, {
  headers: {
    authorization: `Bearer ${NOTION}`,
    'notion-version': '2022-06-28',
  },
});

if (res.status === 401) {
  console.error('\nToken de Notion rechazado (401). Revisa que lo copiaste entero.');
  process.exit(1);
}
if (res.status === 404) {
  console.error(
    '\nNotion responde 404. El token es válido pero la integración NO tiene acceso a la página.\n' +
      'Abre la página del CEREBRO en Notion → menú "..." arriba a la derecha →\n' +
      'Connections / Conexiones → busca tu integración → Confirmar. Y vuelve a ejecutar esto.',
  );
  process.exit(1);
}
if (!res.ok) {
  console.error(`\nNotion respondió ${res.status}: ${(await res.text()).slice(0, 300)}`);
  process.exit(1);
}

const pagina = await res.json();
const titulo =
  Object.values(pagina.properties ?? {})
    .flatMap((p) => (p?.type === 'title' ? p.title ?? [] : []))
    .map((t) => t.plain_text)
    .join('') || '(sin título)';
console.log(`Acceso        OK — "${titulo}"`);

if (SOLO_COMPROBAR) {
  console.log('\n(--comprobar) No se ha tocado ningún secret.');
  process.exit(0);
}

// 2) Guardar los dos secrets en la Edge Function.
const set = await fetch(`https://api.supabase.com/v1/projects/${REF}/secrets`, {
  method: 'POST',
  headers: { authorization: `Bearer ${PAT}`, 'content-type': 'application/json' },
  body: JSON.stringify([
    { name: 'NOTION_TOKEN', value: NOTION },
    { name: 'NOTION_PAGE_ID', value: PAGE_ID },
  ]),
});
if (!set.ok) {
  console.error(`\nNo se pudieron guardar los secrets: ${set.status} ${(await set.text()).slice(0, 300)}`);
  process.exit(1);
}

console.log('Secrets       NOTION_TOKEN y NOTION_PAGE_ID puestos');
console.log('\nEspejo activo. A partir del próximo ritual con contenido duradero');
console.log('(revisión semanal, cierre mensual, escalada) la página del CEREBRO');
console.log('se irá actualizando sola. El brief diario NO se espeja: cambia cada');
console.log('día y llenaría la página de ruido.');
