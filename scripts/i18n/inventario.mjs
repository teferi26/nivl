// NIVL · Idiomas: inventario por AST de los textos en español de Experiencia.
//
//   node scripts/i18n/inventario.mjs                 resumen por namespace (árbol de trabajo)
//   node scripts/i18n/inventario.mjs --git 40abdbe   lo mismo en un commit
//   node scripts/i18n/inventario.mjs --tsv           una línea por texto: ns, sitio, tipo, texto
//   node scripts/i18n/inventario.mjs --json          lo mismo en JSON (lo usan los tests)
//   node scripts/i18n/inventario.mjs --raiz <dir>    otro árbol (los tests usan uno de prueba)
//
// Tipos de registro:
//   jsx       texto entre etiquetas JSX
//   prop:<p>  texto en un atributo JSX visible (title, label, accessibilityLabel...)
//   lit       cadena suelta que parece humana (en un objeto, un argumento, un return...)
//   t-modulo  una llamada a t() fuera de toda función (prohibido: el idioma cambia)
// Un `// i18n-ok` en la línea o en la anterior deja fuera ese texto.
//
// Qué carpeta va a qué namespace: `namespaceDe`. Fuera quedan src/lib (salvo
// voice.ts y notifications.ts), pro.tsx y ProOffer.tsx (de Compras), el kit,
// los demos, src/i18n y las pruebas. Heurística sacada del prototipo del plan:
// cuenta de más antes que de menos.

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const RAIZ_REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

// ── Carpetas → namespaces ───────────────────────────────────────────────

const RUTAS = {
  'src/app/_layout.tsx': 'raiz',
  'src/app/+not-found.tsx': 'raiz',
  'src/app/index.tsx': 'raiz',
  'src/app/(tabs)/_layout.tsx': 'raiz',
  'src/app/(tabs)/index.tsx': 'hoy',
  'src/app/(tabs)/agenda.tsx': 'agenda',
  'src/app/(tabs)/coach.tsx': 'coach',
  'src/app/(tabs)/habitos.tsx': 'habitos',
  'src/app/(tabs)/mazmorras.tsx': 'campanas',
  'src/app/(tabs)/perfil.tsx': 'perfil',
  'src/app/login.tsx': 'acceso',
  // Puertas que viven en la raíz de components (tanda 3, no la 1).
  'src/components/EdadMinima.tsx': 'puertas',
  'src/components/ConsentimientoSalud.tsx': 'puertas',
  'src/components/ConsentimientoIA.tsx': 'puertas',
  'src/components/DenunciarIA.tsx': 'puertas',
  'src/components/denunciaIA.ts': 'puertas',
};
const RUTAS_CARPETA = { 'src/app/auth/': 'acceso', 'src/app/dungeon/': 'campanas', 'src/app/c/': 'creador' };
const LIB = { 'src/lib/voice.ts': 'voz', 'src/lib/notifications.ts': 'avisos' };
const FUERA = [
  /^src\/app\/pro\.tsx$/,
  /^src\/components\/ProOffer\.tsx$/,
  /^src\/app\/kit(\.tsx|\/)/,
  /(^|\/)demo\.tsx?$/,
  /^src\/components\/arena\/(demoDatos|galeria)\.ts$/,
  /^src\/i18n\//,
  /(^|\/)__tests__\//,
  /\.test\.tsx?$/,
  /\.d\.ts$/,
];

/** El namespace de un archivo (ruta relativa con «/»), o null si no es de Experiencia. */
export function namespaceDe(rel) {
  if (FUERA.some((re) => re.test(rel))) return null;
  if (RUTAS[rel]) return RUTAS[rel];
  for (const [prefijo, ns] of Object.entries(RUTAS_CARPETA)) if (rel.startsWith(prefijo)) return ns;
  if (LIB[rel]) return LIB[rel];
  let m = /^src\/app\/([^/]+)\.tsx$/.exec(rel);
  if (m) return m[1];
  m = /^src\/components\/([^/]+)\/.+\.tsx?$/.exec(rel);
  if (m) return m[1];
  if (/^src\/components\/[^/]+\.tsx?$/.test(rel)) return 'raiz';
  return null;
}

// ── Lectura: árbol de trabajo o commit ──────────────────────────────────

function archivosDisco(raiz) {
  const out = [];
  const base = path.join(raiz, 'src');
  if (!fs.existsSync(base)) return out;
  (function andar(dir) {
    for (const f of fs.readdirSync(dir)) {
      const p = path.join(dir, f);
      if (fs.statSync(p).isDirectory()) {
        if (f !== 'node_modules') andar(p);
      } else if (/\.(ts|tsx)$/.test(f)) {
        const rel = path.relative(raiz, p).split(path.sep).join('/');
        out.push({ rel, leer: () => fs.readFileSync(p, 'utf8') });
      }
    }
  })(base);
  return out;
}

function archivosGit(raiz, rev) {
  const lista = execFileSync('git', ['ls-tree', '-r', '--name-only', rev, '--', 'src'], { cwd: raiz, encoding: 'utf8' })
    .split('\n')
    .filter((f) => /\.(ts|tsx)$/.test(f));
  const elegidos = lista.filter((rel) => namespaceDe(rel));
  const entrada = elegidos.map((rel) => `${rev}:${rel}`).join('\n') + '\n';
  const salida = execFileSync('git', ['cat-file', '--batch'], { cwd: raiz, input: entrada, maxBuffer: 256 * 1024 * 1024 });
  const contenidos = [];
  let i = 0;
  while (i < salida.length) {
    const fin = salida.indexOf(0x0a, i);
    const cabecera = salida.subarray(i, fin).toString('utf8');
    const tam = Number(cabecera.split(' ')[2]);
    contenidos.push(salida.subarray(fin + 1, fin + 1 + tam).toString('utf8'));
    i = fin + 1 + tam + 1;
  }
  return elegidos.map((rel, k) => ({ rel, leer: () => contenidos[k] }));
}

// ── Heurística (del prototipo) ──────────────────────────────────────────

const PROPS_VISIBLES =
  /^(title|label|placeholder|accessibilityLabel|accessibilityHint|subtitle|hint|message|texto|text|cta|kicker|eyebrow|empty|confirmLabel|cancelLabel|descripcion|description|body|ayuda|etiqueta|titulo|subtitulo|vacio|aria-label)$/i;
const PROPS_TECNICAS = /^(style|testID|name|icon|key|href|source|nativeID|d)$/;
/** Datos de un trazado SVG («M0 9.5H10 M0.5 9.5V0.5»): no son texto. */
const esTrazadoSvg = (s) => /^[Mm]\s?-?\d/.test(s.trim()) && /^[MmZzLlHhVvCcSsQqTtAa\d\s.,-]+$/.test(s.trim());
const pareceHumano = (s) =>
  /[a-záéíóúñü]/i.test(s) && (/\s/.test(s.trim()) || /[áéíóúñü¿¡]/i.test(s) || /^[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+[.!?:]?$/.test(s.trim()));
const pareceCodigo = (s) =>
  /^[@./#]|^https?:|^[a-z0-9_\-]+$|^[a-z]+[A-Z]\w*$|\.(png|ttf|json)$|^[A-Z_0-9]+$/.test(s.trim()) ||
  esTrazadoSvg(s) ||
  /^(select|insert|update|from|order|eq|gte|lte)\b/i.test(s.trim()) ||
  (/[{}();=<>]/.test(s) && !/\s[a-záéíóú]{3,}\s/i.test(s));

const esLlamadaT = (n, sf) => {
  const c = n.expression.getText(sf);
  return c === 't' || /\.t$/.test(c);
};
const FUNCIONES = [
  ts.SyntaxKind.FunctionDeclaration,
  ts.SyntaxKind.FunctionExpression,
  ts.SyntaxKind.ArrowFunction,
  ts.SyntaxKind.MethodDeclaration,
  ts.SyntaxKind.GetAccessor,
  ts.SyntaxKind.SetAccessor,
  ts.SyntaxKind.Constructor,
];
function dentroDeFuncion(n) {
  for (let p = n.parent; p; p = p.parent) if (FUNCIONES.includes(p.kind)) return true;
  return false;
}

/** Los textos de un archivo: [{ ns, archivo, linea, tipo, texto }]. */
export function textosDe(rel, fuente, ns = namespaceDe(rel)) {
  const sf = ts.createSourceFile(rel, fuente, ts.ScriptTarget.Latest, true, rel.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const lineas = fuente.split(/\r?\n/);
  const out = [];
  const permitido = (linea) => /i18n-ok/.test(lineas[linea - 1] ?? '') || /i18n-ok/.test(lineas[linea - 2] ?? '');
  const anotar = (tipo, n, texto) => {
    const linea = sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
    if (permitido(linea)) return;
    out.push({ ns, archivo: rel, linea, tipo, texto: texto.replace(/\s+/g, ' ').trim() });
  };
  (function visitar(n) {
    if (ts.isImportDeclaration(n) || ts.isExportDeclaration(n) || ts.isLiteralTypeNode(n)) return;
    if (ts.isCallExpression(n)) {
      if (/^(console\.|require$|it$|describe$|expect$)/.test(n.expression.getText(sf))) return;
      if (esLlamadaT(n, sf)) {
        if (!dentroDeFuncion(n)) anotar('t-modulo', n, n.getText(sf));
        // La clave y las opciones de t() no son textos.
        return;
      }
    }
    if (ts.isJsxText(n)) {
      const texto = n.getText(sf).trim();
      if (texto && /[a-záéíóúñ]/i.test(texto)) anotar('jsx', n, texto);
    } else if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) || ts.isTemplateExpression(n)) {
      const p = n.parent;
      const texto = ts.isTemplateExpression(n) ? n.getText(sf).slice(1, -1) : n.text;
      if (ts.isPropertyAssignment(p) && p.name === n) {
        // clave de objeto
      } else if (ts.isBinaryExpression(p) && /===|!==|==|!=/.test(p.operatorToken.getText(sf))) {
        // comparación
      } else if (ts.isCaseClause(p) || ts.isElementAccessExpression(p) || ts.isPropertyAccessExpression(p)) {
        // case, índice
      } else if (ts.isJsxAttribute(p) || (p && ts.isJsxExpression(p) && ts.isJsxAttribute(p.parent))) {
        const nombre = (ts.isJsxAttribute(p) ? p : p.parent).name.getText(sf);
        if (
          (PROPS_VISIBLES.test(nombre) && /[a-záéíóú]/i.test(texto)) ||
          (pareceHumano(texto) && !pareceCodigo(texto) && !PROPS_TECNICAS.test(nombre))
        ) {
          anotar(`prop:${nombre}`, n, texto);
        }
      } else if (pareceHumano(texto) && !pareceCodigo(texto)) {
        anotar('lit', n, texto);
      }
      if (ts.isTemplateExpression(n)) ts.forEachChild(n, visitar);
      return;
    }
    ts.forEachChild(n, visitar);
  })(sf);
  return out;
}

/** Inventario completo: árbol de trabajo (`raiz`) o un commit (`git`). */
export function inventariar({ raiz = RAIZ_REPO, git = null } = {}) {
  const archivos = git ? archivosGit(raiz, git) : archivosDisco(raiz);
  const out = [];
  for (const { rel, leer } of archivos) {
    const ns = namespaceDe(rel);
    if (!ns) continue;
    out.push(...textosDe(rel, leer(), ns));
  }
  return out.sort((a, b) => a.ns.localeCompare(b.ns) || a.archivo.localeCompare(b.archivo) || a.linea - b.linea);
}

/** Para comparar textos de código y de catálogo: `${x}` y {{x}} valen lo mismo y las <b> no cuentan. */
export function normalizar(texto) {
  return texto
    .replace(/\$\{[^}]*\}/g, '{}')
    .replace(/\{\{[^}]*\}\}/g, '{}')
    .replace(/<\/?b>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export const aTsv = (r) => `${r.ns}\t${r.archivo}:${r.linea}\t${r.tipo}\t${r.texto.replace(/\t/g, ' ')}`;

// ── CLI ─────────────────────────────────────────────────────────────────

const esPrincipal = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (esPrincipal) {
  const args = process.argv.slice(2);
  const valor = (nombre) => (args.includes(nombre) ? args[args.indexOf(nombre) + 1] : null);
  const registros = inventariar({ raiz: valor('--raiz') ? path.resolve(valor('--raiz')) : RAIZ_REPO, git: valor('--git') });
  if (args.includes('--json')) {
    process.stdout.write(JSON.stringify(registros));
  } else if (args.includes('--tsv')) {
    process.stdout.write(registros.map(aTsv).join('\n') + '\n');
  } else {
    const porNs = {};
    for (const r of registros) {
      const fila = (porNs[r.ns] ??= { jsx: 0, prop: 0, lit: 0, tmod: 0 });
      if (r.tipo === 'jsx') fila.jsx++;
      else if (r.tipo.startsWith('prop:')) fila.prop++;
      else if (r.tipo === 't-modulo') fila.tmod++;
      else fila.lit++;
    }
    const filas = Object.entries(porNs).sort((a, b) => b[1].jsx + b[1].prop + b[1].lit - (a[1].jsx + a[1].prop + a[1].lit));
    console.log('ns\tjsx\tprop\tlit\tt-modulo\ttotal');
    let total = 0;
    for (const [ns, f] of filas) {
      const n = f.jsx + f.prop + f.lit;
      total += n;
      console.log(`${ns}\t${f.jsx}\t${f.prop}\t${f.lit}\t${f.tmod}\t${n}`);
    }
    console.log(`TOTAL\t\t\t\t\t${total}`);
  }
}
