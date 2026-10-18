#!/usr/bin/env node
// NIVL · Idiomas (Modos F1): escribe src/i18n/traducidos.ts con los idiomas
// que tienen carpeta en src/i18n/<lng>/ (junto a es/) y los namespaces de es.
// Uso: node scripts/i18n/registrar-traducidos.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const I18N = path.join(RAIZ, 'src', 'i18n');
const NO_IDIOMA = new Set(['es', '__tests__']);

// El orden de los namespaces es el de recursos.ts.
const recursos = fs.readFileSync(path.join(I18N, 'recursos.ts'), 'utf8');
const ns = [...recursos.matchAll(/^import (\w+) from '\.\/es\/\1\.json';$/gm)].map((m) => m[1]);
const ORDEN = ['en', 'fr', 'pt', 'de', 'it'];
const lngs = fs
  .readdirSync(I18N)
  .filter((d) => !NO_IDIOMA.has(d) && fs.statSync(path.join(I18N, d)).isDirectory())
  .sort((a, b) => (ORDEN.indexOf(a) + 1 || 99) - (ORDEN.indexOf(b) + 1 || 99) || a.localeCompare(b));

let s = `// NIVL · Idiomas (Modos F1): los catálogos traducidos, src/i18n/<lng>/<ns>.json.
//
// GENERADO por scripts/i18n/registrar-traducidos.mjs: no se edita a mano.
// Mismos namespaces y claves que src/i18n/es (el español sigue siendo la fuente
// de verdad y el tipo de las claves); __tests__/traducidos.test.ts lo comprueba.
// Van dentro del paquete: el init de i18next es síncrono.

import type { RecursosEs } from './recursos';
`;
for (const l of lngs) for (const n of ns) s += `import ${l}${n[0].toUpperCase()}${n.slice(1)} from './${l}/${n}.json';\n`;
s += `
/** Los idiomas con interfaz traducida (el español no está: es la base). */
export const IDIOMAS_TRADUCIDOS = [${lngs.map((l) => `'${l}'`).join(', ')}] as const;
export type IdiomaTraducido = (typeof IDIOMAS_TRADUCIDOS)[number];

type Catalogo = { [K in keyof RecursosEs]: unknown };

export const RECURSOS_LOCALES: Record<IdiomaTraducido, Catalogo> = {
`;
for (const l of lngs) {
  s += `  ${l}: {\n`;
  for (const n of ns) s += `    ${n}: ${l}${n[0].toUpperCase()}${n.slice(1)},\n`;
  s += `  },\n`;
}
s += `};\n`;
fs.writeFileSync(path.join(I18N, 'traducidos.ts'), s);
console.log(`traducidos.ts: ${lngs.join(', ') || '(ninguno)'} × ${ns.length} namespaces`);
