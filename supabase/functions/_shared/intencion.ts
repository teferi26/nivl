// NIVL · ¿El gladiador afirma haber hecho o registrado algo?
//
// Módulo PURO (sin red ni Supabase) y CONSERVADOR a propósito. Si dice que sí,
// el servidor adjunta al turno una comprobación de lo registrado (ver
// comprobacion.ts), para que el coach no conteste «no lo has registrado» sin
// haber mirado. Un falso positivo cuesta una lectura de más; un falso negativo
// es el fallo de siempre, que el modelo aún cubre con consultar_dia.
//
// Lo que NO es afirmación:
//   · las preguntas («¿he entrenado hoy?», «he comido bien?»),
//   · las negaciones («no he entrenado», «todavía no lo he subido»),
//   · los planes y condicionales («voy a entrenar», «cuando acabe te lo subo»).

const PARTICIPIOS = [
  'hecho', 'subido', 'registrado', 'anotado', 'apuntado', 'marcado', 'metido', 'entrenado',
  'corrido', 'nadado', 'rodado', 'comido', 'cenado', 'desayunado', 'almorzado', 'pesado',
  'escrito', 'completado', 'terminado', 'acabado', 'cumplido', 'guardado', 'puesto',
  'levantado', 'caminado', 'andado', 'meditado', 'leido', 'estudiado',
];

// Sin «pese»: «pese a todo» no es pesarse. «Me pesé» va en su propio patrón.
const PRETERITOS = [
  'hice', 'subi', 'registre', 'anote', 'apunte', 'marque', 'meti', 'entrene', 'corri',
  'nade', 'comi', 'cene', 'desayune', 'escribi', 'complete', 'termine', 'acabe',
  'cumpli', 'guarde', 'medite', 'lei', 'estudie', 'camine',
];

const INFINITIVOS = [
  'hacer', 'subir', 'registrar', 'anotar', 'apuntar', 'marcar', 'meter', 'entrenar', 'correr',
  'nadar', 'comer', 'cenar', 'pesarme', 'escribir', 'completar', 'terminar', 'acabar', 'guardar',
];

const CLITICO = String.raw`(?:(?:te|lo|la|los|las|me|se|le|les)\s+)?`;

const PATRONES: RegExp[] = [
  // «te he subido el gym», «ya lo he marcado», «me he pesado», «hemos entrenado»
  new RegExp(String.raw`\b(?:ya\s+)?${CLITICO}(?:he|hemos)\s+(?:ya\s+)?(?:${PARTICIPIOS.join('|')})\b`, 'g'),
  // «hice pierna», «ya entrené», «lo subí»
  new RegExp(String.raw`\b(?:ya\s+)?${CLITICO}(?:${PRETERITOS.join('|')})\b`, 'g'),
  // «me pesé»
  /\bme\s+pese\b/g,
  // «acabo de registrar el peso», «acabo de entrenar»
  new RegExp(String.raw`\bacabo\s+de\s+${CLITICO}(?:${INFINITIVOS.join('|')})\b`, 'g'),
  // «he ido al gimnasio», «fui a correr»
  /\b(?:he\s+ido|fui|hemos\s+ido|fuimos)\s+al?\s+(?:gym|gimnasio|entrenar|correr|nadar|entreno)\b/g,
  // «ya está», «ya está hecho», «ya están subidas»
  /\bya\s+estan?\b\s*(?:hech[oa]s?|subid[oa]s?|registrad[oa]s?|marcad[oa]s?|apuntad[oa]s?|list[oa]s?|$)/g,
];

/** Lo que va justo antes de un acierto y lo convierte en negación. */
const NEGACION = /\b(?:no|nunca|jamas|todavia\s+no|aun\s+no|tampoco|ni)\s+(?:(?:te|lo|la|los|las|me|se|le|les|ya)\s+){0,2}$/;

/** «si he entrenado…», «cuando acabe…»: condicional o futuro, no afirmación. */
const CONDICION = /\b(?:si|cuando|aunque|hasta\s+que|antes\s+de\s+que|para\s+que|en\s+cuanto)\s+(?:\w+\s+){0,2}$/;

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[ \t]+/g, ' ');
}

/** Quita las preguntas: las de «¿…?» y las frases que acaban en «?». */
function sinPreguntas(texto: string): string {
  return texto
    .replace(/¿[^?]*\?/g, ' . ')
    .replace(/¿[^.!\n]*/g, ' . ')
    .replace(/[^.!?\n]*\?/g, ' . ');
}

/** ¿Afirma haber hecho o registrado algo? Conservador: ante la duda, no. */
export function pareceAfirmacion(texto: string): boolean {
  if (typeof texto !== 'string' || !texto.trim()) return false;
  const limpio = sinPreguntas(normalizar(texto.slice(0, 2000)));
  for (const frase of limpio.split(/[.!;:,\n]+/)) {
    for (const re of PATRONES) {
      for (const m of frase.matchAll(re)) {
        const antes = frase.slice(0, m.index);
        if (NEGACION.test(antes) || CONDICION.test(antes)) continue;
        return true;
      }
    }
  }
  return false;
}

// ── Ruta del turno (coach v2, L3 «ruta estrecha») ─────────────────────
//
// Un parte («he hecho…», «ya está», «peso 94,2», «he comido…») no necesita el
// coach entero: con el modelo barato, el estado de HOY y cuatro herramientas de
// leer y apuntar basta. Medido tras L1: «te he subido el gym» costó 0,25 $ y
// 14,5 s con la ruta completa, y el coach programó un entreno que nadie pidió.
//
// CONSERVADOR a propósito: 'registro' solo si el mensaje es un parte claro y
// nada más. Cualquier pregunta, petición de consejo o plan, o un texto largo,
// va por la ruta completa. Un falso 'completa' cuesta lo de siempre; un falso
// 'registro' deja sin respuesta buena a quien pedía algo más.

export type Ruta = 'registro' | 'completa';

/** Partes de un dato sin verbo: «peso 94,2», «94,2 kg», «hoy 2300 kcal». */
const DATOS_SUELTOS: RegExp[] = [
  /^(?:hoy\s+|esta\s+manana\s+)?(?:peso|pesaje|me\s+peso)\s*:?\s*\d{2,3}(?:[.,]\d{1,2})?\s*(?:kg|kilos)?(?:\s+(?:hoy|esta\s+manana))?$/,
  /^(?:hoy\s+)?\d{2,3}(?:[.,]\d{1,2})?\s*(?:kg|kilos)(?:\s+(?:hoy|esta\s+manana))?$/,
  /^(?:hoy\s+)?(?:\d{1,2}\.?\d{3}|\d{3})\s*kcal(?:\s+y\s+\d{2,3}\s*g?\s*(?:de\s+)?proteina)?(?:\s+hoy)?$/,
];

/**
 * Lo que convierte un parte en otra cosa: preguntas, peticiones de consejo,
 * de plan o de cambios, y lo que se dice pensando en mañana. «como» se trata
 * como pregunta aunque a veces sea «yo como» o «como siempre»: ante la duda,
 * ruta completa.
 */
const PIDE_MAS_PALABRAS: readonly string[] = [
  String.raw`que\s+(?:hago|hare|toca|me\s+toca|entreno|como|ceno|deberia|debo|puedo|opinas|tal|te\s+parece)`,
  'como', 'cuanto', String.raw`cuantas?`, 'cuantos', 'cuando', 'donde', String.raw`por\s+que`, String.raw`porque\s+no`, String.raw`para\s+que`,
  'plan', 'planes', String.raw`planifica\w*`, String.raw`programa\w*`, String.raw`prescri\w*`, 'dieta', 'menu',
  String.raw`consejo\w*`, String.raw`aconseja\w*`, String.raw`recomienda\w*`, String.raw`recomendacion\w*`, String.raw`sugiere\w*`, String.raw`sugerencia\w*`,
  String.raw`ayuda\w*`, 'ayudame', 'dime', String.raw`explica\w*`, String.raw`analiza\w*`, String.raw`revisa\w*`, String.raw`valora\w*`, String.raw`opina\w*`,
  String.raw`deberia\w*`, 'debo', 'puedo', String.raw`podria\w*`, 'necesito', 'quiero', 'quisiera',
  'haz', 'hazme', 'dame', 'manda', 'mandame', String.raw`genera\w*`, String.raw`disena\w*`, String.raw`monta\w*`,
  'crea', 'creame', 'crear', String.raw`anade\w*`, 'pon', 'ponme', String.raw`cambia\w*`, String.raw`mueve\w*`, String.raw`borra\w*`, String.raw`elimina\w*`,
  String.raw`quita\w*`, String.raw`ajusta\w*`, String.raw`organiza\w*`, String.raw`agenda\w*`, String.raw`objetivo\w*`, 'meta', 'metas',
  // «mañana» como futuro sí; «esta mañana» o «por la mañana», no.
  String.raw`(?<!(?:esta|la)\s)manana`, String.raw`la\s+semana\s+que\s+viene`, String.raw`proxima\s+semana`,
];
const PIDE_MAS = new RegExp(String.raw`\b(?:${PIDE_MAS_PALABRAS.join('|')})\b`);

const MAX_REGISTRO_CHARS = 300;
const MAX_REGISTRO_FRASES = 3;

function normalizarRuta(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * ¿Por qué ruta va este turno? 'registro' solo para el chat con un parte claro
 * (afirmación de algo hecho o un dato suelto) y SIN pregunta, petición de
 * consejo, plan o cambio, ni un texto largo. Ante la duda, 'completa'.
 */
export function rutaDelTurno(texto: unknown, kind: string): Ruta {
  if (kind !== 'chat' || typeof texto !== 'string') return 'completa';
  const crudo = texto.trim();
  if (!crudo || crudo.length > MAX_REGISTRO_CHARS) return 'completa';
  // Cualquier pregunta, también la que no lleva «¿»: «he entrenado hoy?».
  if (/[¿?]/.test(crudo)) return 'completa';
  const t = normalizarRuta(crudo);
  const frases = t.split(/[.!;\n]+/).map((f) => f.trim()).filter(Boolean);
  if (frases.length > MAX_REGISTRO_FRASES) return 'completa';
  if (PIDE_MAS.test(t)) return 'completa';
  if (pareceAfirmacion(crudo)) return 'registro';
  const sinPunto = t.replace(/[.!,]+$/g, '').trim();
  return DATOS_SUELTOS.some((re) => re.test(sinPunto)) ? 'registro' : 'completa';
}
