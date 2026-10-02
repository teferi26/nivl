// La voz del coach, parte pura: convierte una respuesta escrita (markdown,
// cifras del juego, fechas ISO, unidades) en texto que un sintetizador lee
// como lo diría una persona, y lo trocea en frases cortas para iOS.
//
// Sin imports nativos ni de Supabase: se prueba sola en Jest.
//
// Ojo con Hermes: nada de lookbehind ni de `\p{…}` en las expresiones; los
// emojis se quitan por rangos explícitos.

/** Tope por trozo: iOS corta o se traba con enunciados largos. */
export const MAX_TROZO = 200;

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

const HORAS = [
  'doce', 'una', 'dos', 'tres', 'cuatro', 'cinco', 'seis',
  'siete', 'ocho', 'nueve', 'diez', 'once',
];

export interface OpcionesVoz {
  /**
   * Año en curso. Si se pasa, una fecha ISO de OTRO año se lee con el año
   * («3 de octubre de 2027»); sin él, el año nunca se lee.
   */
  anioActual?: number;
}

// Emojis y pictogramas. Rangos explícitos (Hermes): símbolos y pictogramas
// suplementarios, banderas, flechas decoradas, dingbats, variación, ZWJ y
// el keycap. `×` (U+00D7) y `−` (U+2212) se tratan antes y no caen aquí.
const EMOJI =
  /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{2300}-\u{23FF}\u{3030}\u{303D}\u{3297}\u{3299}\u{E0020}-\u{E007F}︎️‍⃣©®™]/gu;

/** «07:30» → «siete y media de la mañana». */
export function horaEnPalabras(h: number, m: number): string {
  let hora = h;
  let resto: string;
  if (m === 0) resto = '';
  else if (m === 15) resto = ' y cuarto';
  else if (m === 30) resto = ' y media';
  else if (m === 45) {
    resto = ' menos cuarto';
    hora = (h + 1) % 24;
  } else resto = ` y ${m}`;
  const palabra = HORAS[hora % 12];
  let franja: string;
  if (hora < 6) franja = 'de la madrugada';
  else if (hora < 12) franja = 'de la mañana';
  else if (hora < 14) franja = 'del mediodía';
  else if (hora < 21) franja = 'de la tarde';
  else franja = 'de la noche';
  if (hora === 0) franja = 'de la noche';
  return `${palabra}${resto} ${franja}`;
}

/** «2026-10-03» → «3 de octubre» (o null si no es una fecha válida). */
export function fechaEnPalabras(iso: string, opciones: OpcionesVoz = {}): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const anio = Number(m[1]);
  const mes = Number(m[2]);
  const dia = Number(m[3]);
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;
  const base = `${dia} de ${MESES[mes - 1]}`;
  if (opciones.anioActual !== undefined && opciones.anioActual !== anio) return `${base} de ${anio}`;
  return base;
}

/** Termina con puntuación para que el sintetizador haga la pausa. */
function cerrar(linea: string): string {
  const t = linea.trim();
  if (!t) return '';
  return /[.!?…:;,]$/.test(t) ? t : `${t}.`;
}

/** Quita la línea de fuentes («Consultado: …») que el coach pone al citar. */
function sinConsultado(texto: string): string {
  return texto
    .split('\n')
    .filter((l) => !/^[\s>*_#-]*consultad[oa]s?[*_\s]*:/i.test(l))
    .join('\n');
}

/** Una tabla markdown → una frase por fila, celdas separadas por comas. */
function tablas(texto: string): string {
  return texto
    .split('\n')
    .map((l) => {
      const t = l.trim();
      if (!t.includes('|')) return l;
      // Fila separadora: | --- | :---: |
      if (/^\|?[\s:|-]+\|?$/.test(t) && t.includes('-')) return '';
      if (!t.startsWith('|') && (t.match(/\|/g) ?? []).length < 2) return l;
      const celdas = t
        .replace(/^\|/, '')
        .replace(/\|$/, '')
        .split('|')
        .map((c) => c.trim())
        .filter(Boolean);
      return cerrar(celdas.join(', '));
    })
    .join('\n');
}

/** Lo que es de línea: bloques de código, títulos, citas, listas, reglas. */
function lineas(texto: string): string {
  const salida: string[] = [];
  for (const cruda of texto.split('\n')) {
    let l = cruda;
    if (/^\s*(```|~~~)/.test(l)) continue; // vallas de código: fuera, el contenido se queda
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(l)) continue; // --- *** ___
    const titulo = /^\s*#{1,6}\s+(.*)$/.exec(l);
    if (titulo) l = titulo[1].replace(/\s#+\s*$/, '');
    l = l.replace(/^\s*(>\s*)+/, ''); // citas
    const lista = /^\s*(?:[-*+•·]|\d{1,3}[.)])\s+(.*)$/.exec(l);
    if (lista) l = lista[1];
    l = l.replace(/^\s*\[[ xX]\]\s+/, ''); // casillas de tarea
    // Cada línea (título, punto de lista, párrafo) es una pausa.
    const cerrada = cerrar(l);
    if (cerrada) salida.push(cerrada);
  }
  return salida.join('\n');
}

/** Lo que es de dentro de la línea: enlaces, énfasis, código, URL. */
function enLinea(t: string): string {
  return t
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1') // imágenes → texto alternativo
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1') // enlaces → su texto
    .replace(/\[([^\]]+)\]\[[^\]]*\]/g, '$1') // enlaces por referencia
    .replace(/<?\bhttps?:\/\/[^\s>)]*[^\s>).,;:!?]>?/gi, '') // URL sueltas: nadie quiere oírlas
    .replace(/\bwww\.[^\s)]*[^\s).,;:!?]/gi, '')
    .replace(/<\/?[a-z][^>]*>/gi, '') // etiquetas html sueltas
    .replace(/`+([^`]*)`+/g, '$1')
    .replace(/(\*\*|__)(.+?)\1/g, '$2')
    .replace(/~~(.+?)~~/g, '$1')
    .replace(/(^|[^\w*])\*(?!\s)([^*\n]+?)\*(?!\w)/g, '$1$2')
    .replace(/(^|[^\w])_(?!\s)([^_\n]+?)_(?!\w)/g, '$1$2');
}

/** Cifras, unidades, signos y abreviaturas del juego y del coach. */
function cifras(t: string, opciones: OpcionesVoz): string {
  let s = t;
  // Fechas ISO antes que nada (si no, sus guiones parecen rangos o signos).
  s = s.replace(/\b(\d{4}-\d{2}-\d{2})(?:T[\d:.]+Z?)?\b/g, (todo, f: string) => fechaEnPalabras(f, opciones) ?? todo);
  // Horas 07:30 → «siete y media de la mañana».
  s = s.replace(/\b([01]?\d|2[0-3]):([0-5]\d)\b/g, (_, h: string, m: string) => horaEnPalabras(Number(h), Number(m)));
  // XP con signo: «−38 XP» / «-38 XP» / «+25 XP».
  s = s.replace(/(^|[^\w])([+\-−])\s?(\d+(?:[.,]\d+)?)\s?xp\b/gi, (_, antes: string, signo: string, n: string) =>
    `${antes}${signo === '+' ? 'más' : 'menos'} ${n} XP`);
  s = s.replace(/\bxp\b/gi, 'XP');
  // Signo matemático − siempre es «menos»; «+» o «-» pegados a una cifra al
  // empezar, tras espacio o paréntesis también.
  s = s.replace(/−\s?(?=\d)/g, 'menos ');
  s = s.replace(/(^|[\s(«"])\+\s?(?=\d)/g, '$1más ');
  s = s.replace(/(^|[\s(«"])-(?=\d)/g, '$1menos ');
  // Multiplicación: «3×10», «3 x 10», «×2».
  s = s.replace(/(\d)\s?[xX]\s?(?=\d)/g, '$1 por ');
  s = s.replace(/\s*×\s*/g, ' por ');
  // Rangos «8-12» / «8–12» → «8 a 12».
  s = s.replace(/(\d)\s?[-–—]\s?(?=\d)/g, '$1 a ');
  // Decimales con punto (72.5) → coma, que es como se lee en España. Los
  // miles con punto (1.000) no se tocan: tres cifras detrás.
  s = s.replace(/(\d)\.(\d{1,2})(?!\d)/g, '$1,$2');
  // Unidades compuestas antes que las simples.
  s = s.replace(/\bkm\s?\/\s?h\b/gi, 'kilómetros por hora');
  s = s.replace(/(^|[^\d,.])1\s?kg\b/gi, '$11 kilo');
  s = s.replace(/(^|[^\d,.])1\s?km\b/gi, '$11 kilómetro');
  s = s.replace(/(\d)\s?kg\b/gi, '$1 kilos');
  s = s.replace(/(\d)\s?km\b/gi, '$1 kilómetros');
  s = s.replace(/\bkgs?\b/gi, 'kilos');
  s = s.replace(/\bkm\b/gi, 'kilómetros');
  s = s.replace(/(\d)\s?kcal\b/gi, '$1 kilocalorías');
  s = s.replace(/\bkcal\b/gi, 'kilocalorías');
  s = s.replace(/(\d)\s?min\b/gi, '$1 minutos');
  s = s.replace(/(\d)\s?h\b/g, '$1 horas');
  s = s.replace(/(\d)\s?€/g, '$1 euros');
  s = s.replace(/€\s?(\d+(?:[.,]\d+)?)/g, '$1 euros');
  s = s.replace(/\s?%/g, ' por ciento');
  s = s.replace(/\be1RM\b/g, 'una repetición máxima estimada');
  s = s.replace(/\b1RM\b/g, 'una repetición máxima');
  return s;
}

/**
 * Sustituye una abreviatura con punto. Si ese punto también cerraba la
 * frase (fin de línea o mayúscula detrás), el punto se queda.
 */
function abrev(t: string, re: RegExp, palabra: string): string {
  return t.replace(re, (_m: string, ...args: unknown[]) => {
    const offset = args[args.length - 2] as number;
    const total = args[args.length - 1] as string;
    const resto = total.slice(offset + _m.length);
    const cierra = /^[ \t]*(\n|$)/.test(resto) || /^\s+[A-ZÁÉÍÓÚÑ¿¡«]/.test(resto);
    return cierra ? `${palabra}.` : palabra;
  });
}

/** Abreviaturas comunes y símbolos que el sintetizador lee mal. */
function abreviaturas(texto: string): string {
  let t = texto;
  const tabla: [RegExp, string][] = [
    [/\bp\.\s?ej\./gi, 'por ejemplo'],
    [/\bp\.\s?e\./gi, 'por ejemplo'],
    [/\baprox\./gi, 'aproximadamente'],
    [/\betc\./gi, 'etcétera'],
    [/\bmáx\./gi, 'máximo'],
    [/\bmín\./gi, 'mínimo'],
    [/\bnúm\./gi, 'número'],
    [/\bpág\./gi, 'página'],
    [/\bobj\./gi, 'objetivo'],
    [/\bsem\./gi, 'semana'],
    [/\bminutos\./g, 'minutos'], // «30 min.» ya convertido en cifras()
  ];
  for (const [re, palabra] of tabla) t = abrev(t, re, palabra);
  return t
    .replace(/\bvs\.?(?=\s)/gi, 'contra')
    .replace(/\bn\.?\s?º\s?(?=\d)/gi, 'número ')
    .replace(/\bq\b/g, 'que')
    .replace(/#(?=\d)/g, 'número ')
    .replace(/\s&\s/g, ' y ')
    .replace(/\s+\/\s+/g, ', ')
    .replace(/[→←⇒➡]/g, ',') // flechas → pausa
    .replace(/\s+[—–-]\s+/g, ', '); // incisos con raya
}

/**
 * La respuesta del coach, lista para leerse en voz alta: sin markdown, sin
 * emojis, con «×» como «por», «−38 XP» como «menos 38 XP», «kg» como
 * «kilos», fechas ISO como «3 de octubre» y horas como «siete y media de la
 * mañana». Quita la línea «Consultado: …» de las citas. Devuelve una sola
 * cadena; para iOS trocéala con `trocear`.
 */
export function paraVoz(texto: string, opciones: OpcionesVoz = {}): string {
  if (!texto) return '';
  let s = texto.replace(/\r\n?/g, '\n').replace(/[   ]/g, ' ');
  s = sinConsultado(s);
  s = tablas(s);
  s = lineas(s);
  s = enLinea(s);
  s = s.replace(EMOJI, '');
  s = cifras(s, opciones);
  s = abreviaturas(s);
  // Restos sueltos de markdown que no formaban pareja.
  s = s.replace(/[*`~|]/g, '').replace(/(^|\s)#+(?=\s|$)/g, '$1').replace(/(^|\s)_+(?=\s|$)/g, '$1');
  s = s.replace(/(\w)_(\w)/g, '$1 $2');
  // Espacios y puntuación.
  s = s
    .replace(/\n+/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\(\s*\)/g, '')
    .replace(/\s+([.,;:!?…)])/g, '$1')
    .replace(/([(¿¡])\s+/g, '$1')
    .replace(/,\s*,+/g, ',')
    .replace(/([.!?…])[.,]+/g, '$1')
    .replace(/,\s*([.!?…])/g, '$1')
    .replace(/^[\s,.;:]+/, '')
    .trim();
  return s;
}

/** Corta un texto largo por la mejor frontera disponible dentro del tope. */
function partirLargo(frase: string, max: number): string[] {
  const out: string[] = [];
  let resto = frase.trim();
  while (resto.length > max) {
    const ventana = resto.slice(0, max + 1);
    let corte = -1;
    for (const sep of [/[;:]\s/g, /,\s/g, /\s/g]) {
      let m: RegExpExecArray | null;
      let ultimo = -1;
      sep.lastIndex = 0;
      while ((m = sep.exec(ventana)) !== null) {
        if (m.index + 1 <= max && m.index > 0) ultimo = m.index + (m[0].length > 1 ? 1 : 0);
      }
      if (ultimo > max * 0.3) {
        corte = ultimo;
        break;
      }
    }
    if (corte <= 0) corte = max; // una «palabra» de más de 200: corte seco
    out.push(resto.slice(0, corte).trim());
    resto = resto.slice(corte).trim();
  }
  if (resto) out.push(resto);
  return out.filter(Boolean);
}

/**
 * Trocea en frases de como mucho `max` caracteres (200 por defecto). Junta
 * frases cortas en un mismo trozo para que no haya un silencio entre cada
 * una, y parte las largas por «;», «:», «,» o espacio, nunca a mitad de
 * palabra salvo que la palabra sola pase del tope.
 */
export function trocear(texto: string, max: number = MAX_TROZO): string[] {
  const limpio = (texto ?? '').replace(/\s+/g, ' ').trim();
  if (!limpio) return [];
  const tope = Math.max(20, Math.floor(max));
  // Partir en frases sin lookbehind: el separador se captura y se repega.
  const piezas = limpio.split(/([.!?…]+["»”')]*)\s+/);
  const frases: string[] = [];
  for (let i = 0; i < piezas.length; i += 2) {
    const f = (piezas[i] + (piezas[i + 1] ?? '')).trim();
    if (f) frases.push(f);
  }
  const trozos: string[] = [];
  let actual = '';
  for (const f of frases) {
    for (const parte of f.length > tope ? partirLargo(f, tope) : [f]) {
      if (!actual) actual = parte;
      else if (actual.length + 1 + parte.length <= tope) actual = `${actual} ${parte}`;
      else {
        trozos.push(actual);
        actual = parte;
      }
    }
  }
  if (actual) trozos.push(actual);
  return trozos;
}

/** `paraVoz` + `trocear`: lo que de verdad se manda al sintetizador. */
export function prepararVoz(texto: string, opciones: OpcionesVoz = {}, max: number = MAX_TROZO): string[] {
  return trocear(paraVoz(texto, opciones), max);
}
