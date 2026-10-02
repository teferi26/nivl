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
