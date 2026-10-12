// NIVL · Idiomas: ¿el español sigue diciendo lo mismo que en 40abdbe?
//
//   node scripts/i18n/verificar-es.mjs              compara con docs/i18n/textos-es.base.tsv
//   node scripts/i18n/verificar-es.mjs --desde REV  compara con un commit (sin línea base)
//   node scripts/i18n/verificar-es.mjs --base       regenera la línea base desde 40abdbe
//   node scripts/i18n/verificar-es.mjs --detalle    lista también los textos que faltan o sobran
//
// Por namespace, cuenta los textos de la línea base y los de ahora: los que
// quedan en el código (inventario.mjs) más los valores de src/i18n/es/<ns>.json.
// `${x}` y {{x}} valen lo mismo y las <b> de TextoRico no cuentan. Un texto
// que falta en su namespace vale si está en comun.json (las claves comunes se
// comparten). Lo que cambia a propósito (un texto nuevo, una frase partida
// que pasa a plural) se apunta en docs/i18n/textos-es.aceptados.tsv:
//   <ns> TAB + TAB <texto>   un texto nuevo aceptado
//   <ns> TAB - TAB <texto>   un texto que se va a propósito
// Sale con 1 si hay diferencias sin aceptar. La tanda no se cierra hasta que
// dé 0.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { aTsv, inventariar, normalizar } from './inventario.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const rel = (p) => path.relative(RAIZ, p).split(path.sep).join('/');
const BASE = path.join(RAIZ, 'docs', 'i18n', 'textos-es.base.tsv');
const ACEPTADOS = path.join(RAIZ, 'docs', 'i18n', 'textos-es.aceptados.tsv');
const CATALOGOS = path.join(RAIZ, 'src', 'i18n', 'es');
const COMMIT_BASE = '40abdbe';
const CABECERA = `# Textos en español de Experiencia en ${COMMIT_BASE} (scripts/i18n/verificar-es.mjs --base). ns, sitio, tipo, texto.`;

const args = process.argv.slice(2);
const valor = (nombre) => (args.includes(nombre) ? args[args.indexOf(nombre) + 1] : null);

if (args.includes('--base')) {
  const registros = inventariar({ raiz: RAIZ, git: COMMIT_BASE });
  fs.mkdirSync(path.dirname(BASE), { recursive: true });
  fs.writeFileSync(BASE, [CABECERA, ...registros.map(aTsv)].join('\n') + '\n');
  console.log(`Línea base: ${registros.length} textos de ${COMMIT_BASE} en ${rel(BASE)}`);
  process.exit(0);
}

const leerTsv = (archivo) =>
  fs.existsSync(archivo)
    ? fs
        .readFileSync(archivo, 'utf8')
        .split(/\r?\n/)
        .filter((l) => l && !l.startsWith('#'))
        .map((l) => l.split('\t'))
    : [];

/** ns → lista de textos normalizados. */
function agrupar(pares) {
  const out = new Map();
  for (const [ns, texto] of pares) {
    if (!out.has(ns)) out.set(ns, []);
    out.get(ns).push(normalizar(texto));
  }
  return out;
}

function hojas(arbol, out = []) {
  for (const v of Object.values(arbol)) {
    if (typeof v === 'string') out.push(v);
    else if (v && typeof v === 'object') hojas(v, out);
  }
  return out;
}

const desde = valor('--desde');
const base = desde
  ? agrupar(inventariar({ raiz: RAIZ, git: desde }).map((r) => [r.ns, r.texto]))
  : agrupar(leerTsv(BASE).map((c) => [c[0], c[3] ?? '']));
if (!desde && base.size === 0) {
  console.error(`No hay línea base en ${rel(BASE)}: node scripts/i18n/verificar-es.mjs --base`);
  process.exit(1);
}

const actual = agrupar(inventariar({ raiz: RAIZ }).map((r) => [r.ns, r.texto]));
const comun = new Set();
for (const f of fs.existsSync(CATALOGOS) ? fs.readdirSync(CATALOGOS) : []) {
  if (!f.endsWith('.json')) continue;
  const ns = f.slice(0, -'.json'.length);
  const textos = hojas(JSON.parse(fs.readFileSync(path.join(CATALOGOS, f), 'utf8'))).map(normalizar);
  if (ns === 'comun') textos.forEach((t) => comun.add(t));
  else {
    if (!actual.has(ns)) actual.set(ns, []);
    actual.get(ns).push(...textos);
  }
}

const aceptados = { '+': new Map(), '-': new Map() };
for (const [ns, signo, texto] of leerTsv(ACEPTADOS)) {
  if (!aceptados[signo]) continue;
  const m = aceptados[signo];
  if (!m.has(ns)) m.set(ns, []);
  m.get(ns).push(normalizar(texto ?? ''));
}

/** a − b como multiconjunto. */
function resta(a, b) {
  const cuenta = new Map();
  for (const x of b) cuenta.set(x, (cuenta.get(x) ?? 0) + 1);
  const out = [];
  for (const x of a) {
    const n = cuenta.get(x) ?? 0;
    if (n > 0) cuenta.set(x, n - 1);
    else out.push(x);
  }
  return out;
}

const namespaces = [...new Set([...base.keys(), ...actual.keys()])].sort();
let fallos = 0;
console.log('ns\tbase\tahora\tfaltan\tsobran');
for (const ns of namespaces) {
  const b = base.get(ns) ?? [];
  const a = actual.get(ns) ?? [];
  const faltan = resta(resta(b, a), aceptados['-'].get(ns) ?? []).filter((x) => !comun.has(x));
  const sobran = resta(resta(a, b), aceptados['+'].get(ns) ?? []);
  if (faltan.length || sobran.length) fallos++;
  if (b.length || a.length) console.log(`${ns}\t${b.length}\t${a.length}\t${faltan.length}\t${sobran.length}`);
  if (args.includes('--detalle')) {
    for (const x of faltan) console.log(`  - ${x}`);
    for (const x of sobran) console.log(`  + ${x}`);
  }
}
if (fallos) {
  console.error(`\n${fallos} namespace(s) con diferencias. --detalle para verlas; las que son a propósito van en ${rel(ACEPTADOS)}.`);
  process.exit(1);
}
console.log('\nEl español dice lo mismo que la línea base.');
