// NIVL · Leer el extracto del banco (CSV, o las líneas que devuelve la IA al
// leer un PDF) y proponer los movimientos. Puro y determinista.
//
// COPIA EXACTA de src/lib/moneyextracto.ts (allí están los tests, incluido el
// de paridad que compara los dos archivos de «INICIO» a «FIN»). El empaquetado
// de la Edge Function no sube nada de fuera de supabase/: si tocas uno, toca
// el otro.

// ── INICIO (idéntico en _shared/extracto.ts) ──

/** Tope de filas por archivo: un extracto de 2 años de uso normal cabe de sobra. */
export const MAX_FILAS_EXTRACTO = 3000;

/** Una línea leída del extracto, ya normalizada. */
export interface FilaExtracto {
  fecha: string; // YYYY-MM-DD
  importe: number; // negativo gasto, positivo ingreso
  concepto: string;
  divisa: string;
  /** Traspaso entre cuentas propias (Revolut: exchange, topup, vault…). */
  interno: boolean;
}

export interface LecturaExtracto {
  filas: FilaExtracto[];
  /** Filas que no se pudieron leer (pendientes, revertidas, sin fecha o importe). */
  descartadas: number;
  /** 'sin_columnas' si no se reconoce la cabecera; 'vacio' sin filas de datos. */
  error: 'sin_columnas' | 'vacio' | null;
}

/** Separador más probable de la primera línea: «;» en los bancos españoles, «,» en Revolut. */
export function separadorDe(texto: string): string {
  // Las primeras líneas pueden ser títulos sin separador: manda la que más tenga.
  const lineas = texto.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim() !== '').slice(0, 15);
  const cuenta = (c: string) => Math.max(0, ...lineas.map((l) => l.split(c).length - 1));
  const opciones = [';', ',', '\t'].map((c) => ({ c, n: cuenta(c) }));
  opciones.sort((a, b) => b.n - a.n);
  return opciones[0]!.n > 0 ? opciones[0]!.c : ',';
}

/** CSV con comillas: los conceptos traen el separador dentro y partir a lo bruto los rompe. */
export function parseCsv(texto: string, sep = separadorDe(texto)): string[][] {
  const filas: string[][] = [];
  let campo = '';
  let fila: string[] = [];
  let enComillas = false;
  const s = texto.replace(/^﻿/, '');
  for (let i = 0; i < s.length; i++) {
    const c = s[i]!;
    if (enComillas) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          campo += '"';
          i++;
        } else enComillas = false;
      } else campo += c;
    } else if (c === '"') enComillas = true;
    else if (c === sep) {
      fila.push(campo);
      campo = '';
    } else if (c === '\n') {
      fila.push(campo);
      filas.push(fila);
      fila = [];
      campo = '';
    } else if (c !== '\r') campo += c;
  }
  if (campo || fila.length) {
    fila.push(campo);
    filas.push(fila);
  }
  return filas.filter((f) => f.some((v) => v.trim() !== ''));
}

function normal(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ');
}

/** Columna por varios nombres posibles (exactos primero, luego «empieza por»). */
function columna(cab: string[], nombres: string[]): number {
  const c = cab.map(normal);
  for (const n of nombres) {
    const i = c.indexOf(n);
    if (i !== -1) return i;
  }
  for (const n of nombres) {
    const i = c.findIndex((x) => x.startsWith(n));
    if (i !== -1) return i;
  }
  return -1;
}

const COL_FECHA = ['fecha operacion', 'fecha', 'f. operacion', 'fecha de operacion', 'completed date', 'started date', 'date completed (utc)', 'date', 'booking date', 'fecha valor', 'f. valor'];
const COL_CONCEPTO = ['concepto', 'descripcion', 'description', 'detalle', 'movimiento', 'reference', 'referencia', 'beneficiario', 'counterparty'];
const COL_IMPORTE = ['importe', 'amount', 'cantidad', 'importe (eur)', 'importe eur', 'valor'];
const COL_CARGO = ['cargo', 'cargos', 'debe', 'paid out', 'paid out (eur)', 'salida', 'gasto'];
const COL_ABONO = ['abono', 'abonos', 'haber', 'paid in', 'paid in (eur)', 'entrada', 'ingreso'];
const COL_DIVISA = ['divisa', 'currency', 'moneda'];
const COL_ESTADO = ['estado', 'state', 'status'];
const COL_TIPO = ['tipo', 'type'];
const COL_COMISION = ['comision', 'fee'];

/**
 * Fecha a YYYY-MM-DD desde 2026-10-21, 21/10/2026, 21-10-2026, 21.10.2026,
 * 21/10/26 y con hora detrás. Null si no es una fecha real.
 */
export function leerFecha(texto: string): string | null {
  const s = texto.trim();
  let a: number, m: number, d: number;
  let r = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(s);
  if (r) {
    a = Number(r[1]);
    m = Number(r[2]);
    d = Number(r[3]);
  } else {
    r = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/.exec(s);
    if (!r) return null;
    d = Number(r[1]);
    m = Number(r[2]);
    a = Number(r[3]);
    if (a < 100) a += 2000;
  }
  if (m < 1 || m > 12 || d < 1 || d > 31 || a < 1990 || a > 2100) return null;
  const f = new Date(Date.UTC(a, m - 1, d));
  if (f.getUTCMonth() !== m - 1) return null;
  return `${a}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/**
 * Importe con signo desde «-1.234,56», «1,234.56», «−12,50 €», «(12,50)»,
 * «12,50-». Null si no es un número.
 */
export function leerImporteExtracto(texto: string): number | null {
  let s = texto.trim().replace(/[€$£\s ]/g, '').replace(/[A-Za-z]{3}$/, '');
  if (!s) return null;
  let negativo = false;
  if (/^\(.*\)$/.test(s)) {
    negativo = true;
    s = s.slice(1, -1);
  }
  if (/^[-−]/.test(s)) {
    negativo = !negativo;
    s = s.slice(1);
  } else if (s.startsWith('+')) s = s.slice(1);
  if (/[-−]$/.test(s)) {
    negativo = !negativo;
    s = s.slice(0, -1);
  }
  const coma = s.lastIndexOf(',');
  const punto = s.lastIndexOf('.');
  if (coma > -1 && punto > -1) s = coma > punto ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  else if (coma > -1) s = /^\d{1,3}(,\d{3})+$/.test(s) ? s.replace(/,/g, '') : s.replace(',', '.');
  else if (punto > -1 && /^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const n = Math.round(Number(s) * 100) / 100;
  if (!Number.isFinite(n)) return null;
  return negativo ? -n : n;
}

const TIPOS_INTERNOS = ['exchange', 'topup', 'top-up', 'vault', 'savings', 'transfer between accounts'];
const DESC_INTERNA = /^(to|from|a|de|traspaso (a|de)) (my |mi |mis )?(eur|usd|gbp|vault|savings|pocket|bolsillo|ahorro|hucha)/i;

/** Lee un CSV de extracto. Determinista: el mismo archivo da siempre lo mismo. */
export function leerExtractoCsv(texto: string): LecturaExtracto {
  const filas = parseCsv(texto);
  if (filas.length < 2) return { filas: [], descartadas: 0, error: 'vacio' };
  // Algunos bancos ponen líneas de título antes de la cabecera: la cabecera es
  // la primera fila (de las 15 primeras) que tiene fecha y concepto.
  let iCab = -1;
  for (let i = 0; i < Math.min(filas.length, 15); i++) {
    if (columna(filas[i]!, COL_FECHA) !== -1 && columna(filas[i]!, COL_CONCEPTO) !== -1) {
      iCab = i;
      break;
    }
  }
  if (iCab === -1) return { filas: [], descartadas: 0, error: 'sin_columnas' };
  const cab = filas[iCab]!;
  const iFecha = columna(cab, COL_FECHA);
  const iConcepto = columna(cab, COL_CONCEPTO);
  const iImporte = columna(cab, COL_IMPORTE);
  const iCargo = columna(cab, COL_CARGO);
  const iAbono = columna(cab, COL_ABONO);
  const iDivisa = columna(cab, COL_DIVISA);
  const iEstado = columna(cab, COL_ESTADO);
  const iTipo = columna(cab, COL_TIPO);
  const iComision = columna(cab, COL_COMISION);
  if (iImporte === -1 && iCargo === -1 && iAbono === -1) return { filas: [], descartadas: 0, error: 'sin_columnas' };

  const salida: FilaExtracto[] = [];
  let descartadas = 0;
  for (const f of filas.slice(iCab + 1)) {
    if (salida.length >= MAX_FILAS_EXTRACTO) {
      descartadas++;
      continue;
    }
    const estado = iEstado !== -1 ? normal(f[iEstado] ?? '') : '';
    // Los pendientes cambian de importe y los revertidos nunca ocurrieron.
    if (estado && !['completed', 'completado', 'liquidado', 'confirmado', 'ok'].includes(estado)) {
      descartadas++;
      continue;
    }
    const fecha = leerFecha(f[iFecha] ?? '');
    let importe: number | null = null;
    if (iImporte !== -1) importe = leerImporteExtracto(f[iImporte] ?? '');
    if (importe === null && (iCargo !== -1 || iAbono !== -1)) {
      const cargo = iCargo !== -1 ? leerImporteExtracto(f[iCargo] ?? '') : null;
      const abono = iAbono !== -1 ? leerImporteExtracto(f[iAbono] ?? '') : null;
      if (cargo) importe = -Math.abs(cargo);
      else if (abono) importe = Math.abs(abono);
    }
    if (!fecha || importe === null || importe === 0) {
      descartadas++;
      continue;
    }
    const comision = iComision !== -1 ? leerImporteExtracto(f[iComision] ?? '') : null;
    if (comision && iImporte !== -1) importe = Math.round((importe - Math.abs(comision)) * 100) / 100;
    const concepto = (f[iConcepto] ?? '').replace(/\s+/g, ' ').trim().slice(0, 140) || 'Movimiento sin concepto';
    const tipo = iTipo !== -1 ? normal(f[iTipo] ?? '') : '';
    const divisa = (iDivisa !== -1 ? (f[iDivisa] ?? '').trim().toUpperCase() : '') || 'EUR';
    salida.push({
      fecha,
      importe,
      concepto,
      divisa: /^[A-Z]{3}$/.test(divisa) ? divisa : 'EUR',
      interno: TIPOS_INTERNOS.includes(tipo) || DESC_INTERNA.test(concepto),
    });
  }
  return { filas: salida, descartadas, error: salida.length === 0 && descartadas === 0 ? 'vacio' : null };
}

/**
 * Lee las líneas `YYYY-MM-DD|importe|concepto` que devuelve la IA al leer un
 * PDF. Tolerante: una línea mal formada se descarta y las demás valen.
 */
export function leerLineasIa(texto: string): LecturaExtracto {
  const filas: FilaExtracto[] = [];
  let descartadas = 0;
  for (const linea of texto.split(/\r?\n/)) {
    const l = linea.trim();
    if (!l || !l.includes('|')) continue;
    const [f, i, ...resto] = l.split('|');
    const fecha = leerFecha(f ?? '');
    const importe = leerImporteExtracto(i ?? '');
    const concepto = resto.join(' ').replace(/\s+/g, ' ').trim().slice(0, 140);
    if (!fecha || importe === null || importe === 0 || !concepto) {
      descartadas++;
      continue;
    }
    if (filas.length >= MAX_FILAS_EXTRACTO) break;
    filas.push({ fecha, importe, concepto, divisa: 'EUR', interno: DESC_INTERNA.test(concepto) });
  }
  return { filas, descartadas, error: filas.length === 0 ? 'vacio' : null };
}

/**
 * Enmascara IBAN, números de cuenta y de tarjeta en el texto de un extracto
 * ANTES de mandarlo a la IA: se queda con los 4 últimos dígitos («ES12 ****
 * 3456»). Cubre IBAN (con o sin espacios), CCC de 20 dígitos y tarjetas de 13
 * a 19 dígitos (con espacios o guiones), y cualquier tira de 10 o más cifras.
 * Las fechas y los importes no se tocan: llevan separadores y son cortos.
 */
export function enmascararDatosBancarios(texto: string): string {
  const ultimos4 = (s: string) => s.replace(/\D/g, '').slice(-4);
  return texto
    .replace(/\b[A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]){11,30}\b/g, (m) => `${m.slice(0, 2)}** **** ${ultimos4(m)}`)
    .replace(/\d{10,}/g, (m) => `****${m.slice(-4)}`)
    .replace(/\b\d{4}(?:[ -]\d{4}){2,3}\b|\b\d{4}[ -]\d{6}[ -]\d{5}\b/g, (m) => `**** ${ultimos4(m)}`);
}

/** Reglas de categoría: las de la persona (category_rules) y las de serie. */
export interface ReglaCategoria {
  pattern: string;
  category: string;
  priority: number;
}

/** Las reglas de serie (las mismas que siembra scripts/import-revolut.mjs). */
export const REGLAS_BASE: readonly ReglaCategoria[] = [
  ['amazon prime', 'suscripciones', 90], ['prime video', 'suscripciones', 90],
  ['netflix', 'suscripciones', 80], ['spotify', 'suscripciones', 80], ['hbo', 'suscripciones', 80],
  ['disney', 'suscripciones', 80], ['youtube', 'suscripciones', 80], ['apple.com/bill', 'suscripciones', 80],
  ['itunes', 'suscripciones', 80], ['icloud', 'suscripciones', 80], ['google one', 'suscripciones', 80],
  ['adobe', 'suscripciones', 80], ['canva', 'suscripciones', 80], ['notion', 'suscripciones', 80],
  ['dropbox', 'suscripciones', 80], ['chatgpt', 'suscripciones', 80], ['openai', 'suscripciones', 80],
  ['mercadona', 'super', 70], ['carrefour', 'super', 70], ['lidl', 'super', 70], ['aldi', 'super', 70],
  ['alcampo', 'super', 70], ['consum', 'super', 70], ['eroski', 'super', 70], ['ahorramas', 'super', 70],
  ['supermercado', 'super', 60], ['bonarea', 'super', 70], ['condis', 'super', 70],
  ['mcdonald', 'restaurante', 70], ['burger king', 'restaurante', 70], ['telepizza', 'restaurante', 70],
  ['glovo', 'restaurante', 70], ['just eat', 'restaurante', 70], ['uber eats', 'restaurante', 75],
  ['starbucks', 'restaurante', 70], ['cafeteria', 'restaurante', 60], ['restaurante', 'restaurante', 60], ['bar ', 'restaurante', 40],
  ['uber', 'transporte', 60], ['cabify', 'transporte', 70], ['bolt', 'transporte', 60], ['renfe', 'transporte', 70],
  ['taxi', 'transporte', 60], ['parking', 'transporte', 60], ['repsol', 'transporte', 70], ['cepsa', 'transporte', 70],
  ['galp', 'transporte', 70], ['gasolinera', 'transporte', 70], ['ryanair', 'transporte', 70], ['vueling', 'transporte', 70],
  ['iberia', 'transporte', 70], ['blablacar', 'transporte', 70], ['metro', 'transporte', 50], ['emt', 'transporte', 50],
  ['farmacia', 'salud', 70], ['clinica', 'salud', 60], ['dentista', 'salud', 70], ['sanitas', 'salud', 70],
  ['adeslas', 'salud', 70], ['optica', 'salud', 70],
  ['gimnasio', 'gimnasio', 80], ['basic fit', 'gimnasio', 80], ['basic-fit', 'gimnasio', 80], ['altafit', 'gimnasio', 80],
  ['mcfit', 'gimnasio', 80], ['synergym', 'gimnasio', 80], ['viva gym', 'gimnasio', 80],
  ['alquiler', 'vivienda', 80], ['hipoteca', 'vivienda', 80], ['comunidad de propietarios', 'vivienda', 80],
  ['iberdrola', 'suministros', 80], ['endesa', 'suministros', 80], ['naturgy', 'suministros', 80],
  ['movistar', 'suministros', 80], ['vodafone', 'suministros', 80], ['orange', 'suministros', 80],
  ['jazztel', 'suministros', 80], ['yoigo', 'suministros', 80], ['pepephone', 'suministros', 80], ['digi', 'suministros', 70],
  ['zara', 'ropa', 70], ['primark', 'ropa', 70], ['decathlon', 'ropa', 70], ['el corte ingles', 'ropa', 60],
  ['udemy', 'formacion', 80], ['coursera', 'formacion', 80], ['domestika', 'formacion', 80], ['platzi', 'formacion', 80],
  ['libreria', 'formacion', 60], ['matricula', 'formacion', 70], ['universidad', 'formacion', 70],
  ['steam', 'ocio', 70], ['playstation', 'ocio', 70], ['nintendo', 'ocio', 70], ['cinesa', 'ocio', 70], ['yelmo', 'ocio', 70],
  ['nomina', 'ingreso_nomina', 90], ['nómina', 'ingreso_nomina', 90], ['payroll', 'ingreso_nomina', 90], ['salary', 'ingreso_nomina', 90],
  ['stripe', 'ingreso_negocio', 80],
].map(([pattern, category, priority]) => ({ pattern: pattern as string, category: category as string, priority: priority as number }));

const INGRESOS = ['ingreso_negocio', 'ingreso_nomina', 'ingreso_otro'];

/**
 * Categoría de un concepto: la regla de más prioridad que encaje (las de la
 * persona antes que las de serie a igual prioridad). Un ingreso sin regla es
 * 'ingreso_otro'; un gasto sin regla se queda 'sin_clasificar' para que se
 * vea en vez de esconderse en «otros». Un ingreso nunca cae en categoría de
 * gasto ni al revés: el signo lo sabe el dato.
 */
export function categorizar(concepto: string, importe: number, reglas: readonly ReglaCategoria[] = []): string {
  const t = normal(concepto);
  const todas = [...reglas.map((r) => ({ ...r, propia: 1 })), ...REGLAS_BASE.map((r) => ({ ...r, propia: 0 }))].sort(
    (a, b) => b.priority - a.priority || b.propia - a.propia || b.pattern.length - a.pattern.length,
  );
  for (const r of todas) {
    const p = normal(r.pattern);
    if (p.length < 2 || !t.includes(p)) continue;
    const esIngreso = INGRESOS.includes(r.category);
    if (importe >= 0 ? esIngreso : !esIngreso) return r.category;
  }
  return importe >= 0 ? 'ingreso_otro' : 'sin_clasificar';
}

/** La huella de un movimiento importado: la misma que scripts/import-revolut.mjs. */
export function huellaExtracto(cuenta: string, fecha: string, importe: number, concepto: string): string {
  return `${cuenta}|${fecha}|${Number(importe).toFixed(2)}|${concepto.toLowerCase().slice(0, 60)}`;
}

export type EstadoPropuesta = 'nuevo' | 'repetido' | 'parecido';

export interface FilaPropuesta extends FilaExtracto {
  categoria: string;
  huella: string;
  /** nuevo: se guarda · repetido: ya está (misma huella) · parecido: hay uno manual igual cerca. */
  estado: EstadoPropuesta;
}

/** Un movimiento que ya está en la cuenta, para detectar repetidos y parecidos. */
export interface MovExistente {
  date: string;
  amount: number;
  dedup_hash: string;
  source?: string;
}

function diasEntre(a: string, b: string): number {
  return Math.abs(Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000;
}

/**
 * La propuesta que se revisa antes de guardar: categoría, huella y estado de
 * cada fila. Repetido = misma huella ya guardada (o dos veces en el archivo).
 * Parecido = un movimiento apuntado a mano con el mismo importe a 3 días o
 * menos: lo más probable es que sea el mismo, y se deja sin marcar.
 */
export function proponerImportacion(
  filas: readonly FilaExtracto[],
  cuenta: string,
  reglas: readonly ReglaCategoria[],
  existentes: readonly MovExistente[],
): FilaPropuesta[] {
  const huellas = new Set(existentes.map((e) => e.dedup_hash));
  const manuales = existentes.filter((e) => e.source === 'manual' || e.dedup_hash.startsWith('app|'));
  const vistas = new Set<string>();
  return filas.map((f) => {
    const huella = huellaExtracto(cuenta, f.fecha, f.importe, f.concepto);
    let estado: EstadoPropuesta = 'nuevo';
    if (huellas.has(huella) || vistas.has(huella)) estado = 'repetido';
    else if (manuales.some((m) => Math.abs(Number(m.amount) - f.importe) < 0.005 && diasEntre(m.date, f.fecha) <= 3)) estado = 'parecido';
    vistas.add(huella);
    return { ...f, categoria: f.interno ? 'transferencia' : categorizar(f.concepto, f.importe, reglas), huella, estado };
  });
}

// ── FIN ──
