// NIVL · Trae el CEREBRO desde Notion, tal cual está.
//
// La primera importación se hizo con una reconstrucción a mano y salió
// bastante más pobre que el original: la página real tiene entradas de log
// mucho más detalladas. Esto la baja entera por la API, así que la memoria del
// coach es el documento de verdad y no un resumen.
//
// Uso:
//   node scripts/pull-cerebro.mjs        (escribe scripts/cerebro.md)
//   node scripts/pull-cerebro.mjs --ver  (solo enseña lo que traería)

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SALIDA = join(ROOT, 'scripts', 'cerebro.md');
const SOLO_VER = process.argv.includes('--ver');
const PAGE_ID = process.env.NOTION_PAGE_ID ?? '3ac2eddc-56e0-810f-be4b-daf2a8b2c048';

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

const TOKEN = leerNotionToken();
if (!TOKEN) {
  console.error('Falta el token de Notion en notion-token.txt.');
  process.exit(1);
}

/** Texto plano de un rich_text, conservando el negrita como marcador. */
function texto(rich = []) {
  return rich
    .map((t) => {
      const c = t.plain_text ?? '';
      return t.annotations?.bold && c.trim() ? `**${c}**` : c;
    })
    .join('');
}

async function bloques(id) {
  const salida = [];
  let cursor;
  do {
    const url = new URL(`https://api.notion.com/v1/blocks/${id}/children`);
    url.searchParams.set('page_size', '100');
    if (cursor) url.searchParams.set('start_cursor', cursor);
    const res = await fetch(url, {
      headers: { authorization: `Bearer ${TOKEN}`, 'notion-version': '2022-06-28' },
    });
    if (!res.ok) throw new Error(`${res.status}: ${(await res.text()).slice(0, 300)}`);
    const j = await res.json();
    salida.push(...(j.results ?? []));
    cursor = j.has_more ? j.next_cursor : undefined;
  } while (cursor);
  return salida;
}

function aMarkdown(lista) {
  const lineas = [];
  for (const b of lista) {
    const t = b.type;
    const contenido = texto(b[t]?.rich_text);
    switch (t) {
      case 'heading_1':
        lineas.push('', `# ${contenido}`);
        break;
      case 'heading_2':
        lineas.push('', `## ${contenido}`);
        break;
      case 'heading_3':
        lineas.push('', `### ${contenido}`);
        break;
      case 'bulleted_list_item':
        lineas.push(`- ${contenido}`);
        break;
      case 'numbered_list_item':
        lineas.push(`1. ${contenido}`);
        break;
      case 'to_do':
        lineas.push(`- [${b.to_do?.checked ? 'x' : ' '}] ${contenido}`);
        break;
      case 'quote':
      case 'callout':
        // El aviso de cabecera ("página mantenida por el coach") no aporta
        // nada a la memoria y solo gastaría contexto en cada prompt.
        if (contenido.includes('mantenida por el coach')) break;
        lineas.push('', `> ${contenido}`);
        break;
      case 'divider':
        break;
      case 'paragraph':
        if (contenido.trim()) lineas.push('', contenido);
        break;
      default:
        if (contenido.trim()) lineas.push('', contenido);
    }
  }
  return lineas
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const lista = await bloques(PAGE_ID);
const md = aMarkdown(lista);

console.log(`Bloques        ${lista.length}`);
console.log(`Markdown       ${md.length} caracteres (~${Math.round(md.length / 3.6)} tokens)`);
console.log(`Secciones      ${(md.match(/^# /gm) || []).length}`);

if (SOLO_VER) {
  console.log('\n--- primeras 15 líneas ---');
  console.log(md.split('\n').slice(0, 15).join('\n'));
  process.exit(0);
}

let previo = 0;
try {
  previo = readFileSync(SALIDA, 'utf8').length;
} catch {
  /* no había */
}
writeFileSync(SALIDA, `${md}\n`);
console.log(`\nEscrito en scripts/cerebro.md (antes ${previo} caracteres, ahora ${md.length}).`);
console.log('Siguiente paso:  node scripts/import-cerebro.mjs');
