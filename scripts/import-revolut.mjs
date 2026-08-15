// NIVL · Importar el extracto de Revolut.
//
// Uso:
//   node scripts/import-revolut.mjs extracto.csv [--cuenta "Revolut EUR"] [--seco]
//   node scripts/import-revolut.mjs --semilla     (solo crea las reglas base)
//
// Cómo se saca el CSV: app de Revolut → Menú → Extractos → formato **Excel/CSV**
// (no PDF) → rango de fechas → compartir/guardar. Cuanto más histórico, mejor:
// con menos de tres meses no se detectan los cargos recurrentes.
//
// Se puede ejecutar tantas veces como quieras y con extractos solapados: cada
// movimiento lleva una huella estable y la base rechaza los repetidos. Eso es
// lo que evita el fallo clásico de todo importador de finanzas, que es contar
// el mismo cargo dos veces y dar por bueno un presupuesto falso.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { abrirSesion, rest } from './session.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const SECO = argv.includes('--seco');
const SOLO_SEMILLA = argv.includes('--semilla');
const cuentaIdx = argv.indexOf('--cuenta');
const NOMBRE_CUENTA = cuentaIdx !== -1 ? argv[cuentaIdx + 1] : 'Revolut';
const fichero = argv.find((a, i) => !a.startsWith('--') && !(cuentaIdx !== -1 && i === cuentaIdx + 1));

// ── Reglas base ─────────────────────────────────────────────────────
// Se siembran en category_rules la primera vez, así que quedan a la vista y
// tanto tú como el coach podéis corregirlas. Una corrección tuya nunca se
// pisa: la siembra ignora los patrones que ya existan.
//
// Prioridad alta gana. Lo específico va por encima de lo genérico: "AMAZON
// PRIME" es una suscripción y "AMAZON" a secas es otra cosa.
const REGLAS_BASE = [
  ['amazon prime', 'suscripciones', 90], ['prime video', 'suscripciones', 90],
  ['netflix', 'suscripciones', 80], ['spotify', 'suscripciones', 80],
  ['hbo', 'suscripciones', 80], ['disney', 'suscripciones', 80],
  ['youtube', 'suscripciones', 80], ['apple.com/bill', 'suscripciones', 80],
  ['itunes', 'suscripciones', 80], ['icloud', 'suscripciones', 80],
  ['google storage', 'suscripciones', 80], ['google one', 'suscripciones', 80],
  ['adobe', 'suscripciones', 80], ['canva', 'suscripciones', 80],
  ['notion', 'suscripciones', 80], ['dropbox', 'suscripciones', 80],
  ['anthropic', 'suscripciones', 80], ['openai', 'suscripciones', 80],
  ['chatgpt', 'suscripciones', 80], ['claude', 'suscripciones', 80],
  ['linkedin', 'suscripciones', 80], ['microsoft', 'suscripciones', 70],
  ['github', 'suscripciones', 80], ['vercel', 'suscripciones', 80],

  ['mercadona', 'super', 70], ['carrefour', 'super', 70], ['lidl', 'super', 70],
  ['aldi', 'super', 70], ['alcampo', 'super', 70], ['consum', 'super', 70],
  ['eroski', 'super', 70], ['ahorramas', 'super', 70], ['supercor', 'super', 70],
  ['hipercor', 'super', 70], ['bonarea', 'super', 70], ['condis', 'super', 70],

  ['mcdonald', 'restaurante', 70], ['burger king', 'restaurante', 70],
  ['telepizza', 'restaurante', 70], ['domino', 'restaurante', 70],
  ['glovo', 'restaurante', 70], ['just eat', 'restaurante', 70],
  ['uber eats', 'restaurante', 75], ['starbucks', 'restaurante', 70],
  ['cafeteria', 'restaurante', 60], ['restaurante', 'restaurante', 60],

  ['uber', 'transporte', 60], ['cabify', 'transporte', 70], ['bolt.eu', 'transporte', 70],
  ['renfe', 'transporte', 70], ['taxi', 'transporte', 60], ['parking', 'transporte', 60],
  ['repsol', 'transporte', 70], ['cepsa', 'transporte', 70], ['galp', 'transporte', 70],
  ['gasolinera', 'transporte', 70], ['ryanair', 'transporte', 70],
  ['vueling', 'transporte', 70], ['iberia', 'transporte', 70], ['blablacar', 'transporte', 70],

  ['farmacia', 'salud', 70], ['clinica', 'salud', 60], ['dentista', 'salud', 70],
  ['sanitas', 'salud', 70], ['adeslas', 'salud', 70], ['optica', 'salud', 70],

  ['gimnasio', 'gimnasio', 80], ['basic fit', 'gimnasio', 80], ['basic-fit', 'gimnasio', 80],
  ['altafit', 'gimnasio', 80], ['mcfit', 'gimnasio', 80], ['synergym', 'gimnasio', 80],
  ['viva gym', 'gimnasio', 80], ['fitness', 'gimnasio', 60],

  ['alquiler', 'vivienda', 80], ['hipoteca', 'vivienda', 80],
  ['comunidad de propietarios', 'vivienda', 80], ['inmobiliaria', 'vivienda', 70],

  ['iberdrola', 'suministros', 80], ['endesa', 'suministros', 80],
  ['naturgy', 'suministros', 80], ['movistar', 'suministros', 80],
  ['vodafone', 'suministros', 80], ['orange', 'suministros', 80],
  ['jazztel', 'suministros', 80], ['yoigo', 'suministros', 80],
  ['pepephone', 'suministros', 80], ['digi', 'suministros', 70],

  ['zara', 'ropa', 70], ['h&m', 'ropa', 70], ['primark', 'ropa', 70],
  ['decathlon', 'ropa', 70], ['nike', 'ropa', 70], ['adidas', 'ropa', 70],
  ['el corte ingles', 'ropa', 60],

  ['udemy', 'formacion', 80], ['coursera', 'formacion', 80],
  ['domestika', 'formacion', 80], ['platzi', 'formacion', 80],

  ['steam', 'ocio', 70], ['playstation', 'ocio', 70], ['nintendo', 'ocio', 70],
  ['cinesa', 'ocio', 70], ['yelmo', 'ocio', 70],

  ['agencia tributaria', 'impuestos', 90], ['seguridad social', 'impuestos', 90],
  ['hacienda', 'impuestos', 80],

  ['stripe', 'ingreso_negocio', 80],
];

// ── CSV ─────────────────────────────────────────────────────────────

/** Parser con comillas: las descripciones traen comas y partir por "," rompe. */
function parseCsv(texto) {
  const filas = [];
  let campo = '';
  let fila = [];
  let enComillas = false;
  const s = texto.replace(/^\uFEFF/, '');

  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (enComillas) {
      if (c === '"') {
        if (s[i + 1] === '"') { campo += '"'; i++; } else enComillas = false;
      } else campo += c;
    } else if (c === '"') enComillas = true;
    else if (c === ',') { fila.push(campo); campo = ''; }
    else if (c === '\n') { fila.push(campo); filas.push(fila); fila = []; campo = ''; }
    else if (c !== '\r') campo += c;
  }
  if (campo || fila.length) { fila.push(campo); filas.push(fila); }
  return filas.filter((f) => f.some((v) => v.trim() !== ''));
}

/** Localiza una columna por varios nombres posibles: el formato ha cambiado. */
function col(cabecera, ...nombres) {
  for (const n of nombres) {
    const i = cabecera.findIndex((c) => c.trim().toLowerCase() === n);
    if (i !== -1) return i;
  }
  return -1;
}

function huella(fecha, importe, descripcion, cuenta) {
  return `${cuenta}|${fecha}|${Number(importe).toFixed(2)}|${descripcion.toLowerCase().slice(0, 60)}`;
}

// ── Ejecución ───────────────────────────────────────────────────────

const sesion = await abrirSesion(ROOT);
const db = rest(sesion);
console.log(`Sesión abierta para ${sesion.email}`);

// 1) Reglas base, sin pisar nada tuyo. En seco no se siembra: un ensayo que
// escribe en la base no es un ensayo.
if (!SECO) {
  const sembradas = await db.insert(
    'category_rules',
    REGLAS_BASE.map(([pattern, category, priority]) => ({
      user_id: sesion.userId, pattern, category, priority,
    })),
    { ignorarDuplicados: true, onConflict: 'user_id,pattern' },
  );
  console.log(`Reglas de categorización: ${sembradas.length} nuevas, ${REGLAS_BASE.length} en el catálogo.`);
}
if (SOLO_SEMILLA) process.exit(0);

if (!fichero) {
  console.error(
    '\nFalta el CSV.\n\n' +
      '  node scripts/import-revolut.mjs ruta/al/extracto.csv\n\n' +
      'Para sacarlo: app de Revolut → Menú → Extractos → formato Excel/CSV → el rango más largo que te deje.',
  );
  process.exit(1);
}

const filas = parseCsv(readFileSync(fichero, 'utf8'));
if (filas.length < 2) {
  console.error('El fichero no tiene filas de datos.');
  process.exit(1);
}

const cab = filas[0];
const iTipo = col(cab, 'type', 'tipo');
const iFecha = col(cab, 'completed date', 'started date', 'date completed (utc)', 'date started (utc)', 'fecha');
const iDesc = col(cab, 'description', 'descripción', 'descripcion', 'reference');
const iImporte = col(cab, 'amount', 'importe', 'paid out (eur)');
const iComision = col(cab, 'fee', 'comisión', 'comision');
const iDivisa = col(cab, 'currency', 'divisa');
const iEstado = col(cab, 'state', 'estado');
const iSaldo = col(cab, 'balance', 'saldo');

if (iFecha === -1 || iDesc === -1 || iImporte === -1) {
  console.error(
    'No reconozco las columnas de este CSV. Esperaba al menos fecha, descripción e importe.\n' +
      `Cabecera leída: ${cab.join(' | ')}`,
  );
  process.exit(1);
}

// 2) La cuenta.
const cuentas = await db.select(
  'money_accounts',
  `name=eq.${encodeURIComponent(NOMBRE_CUENTA)}&select=*`,
);
let cuenta = cuentas[0];
if (!cuenta && !SECO) {
  [cuenta] = await db.insert('money_accounts', [
    { user_id: sesion.userId, name: NOMBRE_CUENTA, provider: 'revolut', currency: 'EUR' },
  ]);
}

// 3) Reglas, de mayor prioridad a menor.
const reglas = (await db.select('category_rules', 'select=pattern,category,priority'))
  .sort((a, b) => b.priority - a.priority || b.pattern.length - a.pattern.length);

function categorizar(texto, importe) {
  const t = texto.toLowerCase();
  for (const r of reglas) if (t.includes(r.pattern.toLowerCase())) return r.category;
  // Sin regla: un ingreso al menos se sabe que es un ingreso. Un gasto se
  // deja sin clasificar a propósito, para que el coach pregunte por él en vez
  // de esconderlo en "otros" y falsear los presupuestos.
  return importe >= 0 ? 'ingreso_otro' : 'sin_clasificar';
}

// Traspasos entre cuentas propias: ni gasto ni ingreso. Si contaran, mover
// dinero al bolsillo de ahorro aparecería como un gasto del mismo tamaño.
const TIPOS_INTERNOS = ['exchange', 'topup', 'top-up', 'vault', 'savings'];
const DESC_INTERNA = /^(to|from|a|de) (my |mi )?(eur|usd|gbp|vault|savings|pocket|bolsillo|ahorro)/i;

const movimientos = [];
const comisiones = [];
let saldoFinal = null;
let saldoFecha = null;
let descartados = 0;

for (const f of filas.slice(1)) {
  const estado = iEstado !== -1 ? (f[iEstado] ?? '').trim().toUpperCase() : 'COMPLETED';
  // Los pendientes cambian de importe y los revertidos nunca ocurrieron.
  if (estado && !['COMPLETED', 'COMPLETADO'].includes(estado)) { descartados++; continue; }

  const fecha = (f[iFecha] ?? '').trim().slice(0, 10).replace(/\//g, '-');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) { descartados++; continue; }

  const importe = Number(String(f[iImporte] ?? '').replace(/\s/g, '').replace(',', '.'));
  if (!Number.isFinite(importe) || importe === 0) { descartados++; continue; }

  const desc = (f[iDesc] ?? '').trim() || 'Movimiento sin descripción';
  const tipo = iTipo !== -1 ? (f[iTipo] ?? '').trim().toLowerCase() : '';
  const divisa = (iDivisa !== -1 ? (f[iDivisa] ?? '').trim().toUpperCase() : 'EUR') || 'EUR';
  const interno = TIPOS_INTERNOS.includes(tipo) || DESC_INTERNA.test(desc);

  movimientos.push({
    user_id: sesion.userId,
    account_id: cuenta?.id ?? null,
    date: fecha,
    amount: importe,
    currency: divisa.length === 3 ? divisa : 'EUR',
    description: desc,
    counterparty: desc,
    category: interno ? 'transferencia' : categorizar(desc, importe),
    source: 'csv',
    dedup_hash: huella(fecha, importe, desc, NOMBRE_CUENTA),
    is_internal: interno,
  });

  // La comisión va como movimiento propio: escondida dentro del importe no se
  // ve nunca, y en Revolut suma bastante al cabo del año.
  const com = iComision !== -1 ? Number(String(f[iComision] ?? '0').replace(',', '.')) : 0;
  if (Number.isFinite(com) && com > 0) {
    comisiones.push({
      user_id: sesion.userId,
      account_id: cuenta?.id ?? null,
      date: fecha,
      amount: -com,
      currency: divisa.length === 3 ? divisa : 'EUR',
      description: `Comisión — ${desc}`,
      counterparty: 'Revolut',
      category: 'comisiones',
      source: 'csv',
      dedup_hash: `${huella(fecha, -com, desc, NOMBRE_CUENTA)}|fee`,
      is_internal: false,
    });
  }

  if (iSaldo !== -1) {
    const s = Number(String(f[iSaldo] ?? '').replace(',', '.'));
    if (Number.isFinite(s) && (saldoFecha === null || fecha >= saldoFecha)) {
      saldoFinal = s;
      saldoFecha = fecha;
    }
  }
}

const todos = [...movimientos, ...comisiones];
const fechas = todos.map((m) => m.date).sort();
console.log(
  `\nLeídos ${todos.length} movimientos` +
    (fechas.length ? ` (${fechas[0]} → ${fechas.at(-1)})` : '') +
    (descartados ? ` · ${descartados} descartados por estado o formato` : ''),
);

const sinClasificar = movimientos.filter((m) => m.category === 'sin_clasificar');
console.log(`Sin clasificar: ${sinClasificar.length}. El coach te preguntará por los mayores.`);

if (SECO) {
  console.log('\n--seco: no se ha escrito nada. Muestra de lo que se importaría:\n');
  for (const m of todos.slice(0, 12)) {
    console.log(`  ${m.date}  ${String(m.amount).padStart(10)} ${m.currency}  ${m.category.padEnd(16)} ${m.description.slice(0, 45)}`);
  }
  process.exit(0);
}

// 4) A la base, en tandas. Los repetidos los rechaza el índice único.
let insertados = 0;
for (let i = 0; i < todos.length; i += 400) {
  const tanda = todos.slice(i, i + 400);
  const r = await db.insert('transactions', tanda, {
    ignorarDuplicados: true,
    onConflict: 'user_id,dedup_hash',
  });
  insertados += r.length;
}

if (cuenta && saldoFinal !== null) {
  await db.update('money_accounts', `id=eq.${cuenta.id}`, {
    balance: saldoFinal,
    balance_at: `${saldoFecha}T23:59:59Z`,
  });
}

console.log(
  `\nImportados ${insertados} movimientos nuevos` +
    (todos.length - insertados > 0 ? ` · ${todos.length - insertados} ya estaban` : '') +
    (saldoFinal !== null ? `\nSaldo de ${NOMBRE_CUENTA}: ${saldoFinal} € a ${saldoFecha}` : ''),
);
console.log('\nAhora pídeselo al coach: "mira mis cuentas y dime en qué se me va el dinero".');
