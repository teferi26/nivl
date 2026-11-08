// NIVL · Gafas Meta: de una transcripción en español a una candidata. Puro.
//
// Determinista y sin IA. Lo máximo que sale de aquí es «¿confirmas esta
// misión?». Completarla es de la vía de siempre (complete_quest, propagarActo)
// y solo después de que interpretarRespuesta devuelva 'si'. Ante la duda, gana
// siempre lo que no completa: una orden de cancelar manda sobre todo lo demás.

import { recortar } from './tarjetas';
import type {
  Candidata,
  Intencion,
  MisionPendiente,
  RespuestaConfirmacion,
} from './tipos';

/** Cuánto de la frase o de la misión ha de casar para no preguntar. */
export const UMBRAL_CONFIANZA = 0.6;
/** Con menos ventaja que esta sobre la segunda, es un empate. */
export const MARGEN_EMPATE = 0.1;

const MAX_OPCIONES = 3;
const MAX_TITULO_HABLADO = 40;

const MULETILLAS = [
  'eh', 'ehm', 'em', 'mm', 'mmm', 'hm', 'ah', 'pues', 'bueno', 'o sea',
  'es decir', 'a ver', 'digamos', 'oye', 'mira', 'por favor', 'porfa',
  'hey meta', 'oye meta', 'ok meta',
];

const VACIAS = new Set([
  'a', 'al', 'ante', 'antes', 'ayer', 'como', 'con', 'cuando', 'de', 'del',
  'despues', 'e', 'el', 'en', 'es', 'esa', 'ese', 'eso', 'esta', 'este', 'esto',
  'ha', 'hacer', 'hay', 'he', 'hoy', 'ir', 'la', 'las', 'le', 'lo', 'los',
  'manana', 'mas', 'me', 'mi', 'mis', 'mision', 'misiones', 'muy', 'no',
  'noche', 'o', 'ok', 'para', 'por', 'que', 'se', 'si', 'su', 'sus', 'tarde',
  'tarea', 'tareas', 'te', 'toda', 'todas', 'todo', 'todos', 'tu', 'tus', 'u',
  'un', 'una', 'unas', 'uno', 'unos', 'vale', 'y', 'ya',
]);

const SINONIMOS: Record<string, string> = { gimnasio: 'gym', gim: 'gym', yim: 'gym' };

const CANCELAR = [
  'cancela', 'cancelar', 'cancelalo', 'cancelala', 'olvida', 'olvidalo',
  'olvidala', 'dejalo', 'dejala', 'anula', 'anulalo', 'anulala', 'da igual',
  'ni caso', 'no importa',
];
const CANCELAR_SOLO = new Set(['no', 'nada', 'para', 'basta', 'deja']);

const REPETIR = [
  'repite', 'repitelo', 'repiteme', 'repetir', 'otra vez', 'como dices',
  'que dices', 'que has dicho', 'no te he oido', 'no he oido', 'no te oigo',
];

const SIGUIENTE = [
  'siguiente', 'proxima', 'proximo', 'que toca', 'que me toca', 'que sigue',
  'que queda', 'que me queda', 'que falta', 'que me falta',
];

/** Solo pasado o imperativo: «voy a terminar» no es haber terminado. */
const HECHO = new Set([
  'hecho', 'hecha', 'hechos', 'hechas', 'hice', 'termine', 'terminado',
  'terminada', 'terminados', 'terminadas', 'complete', 'completado',
  'completada', 'completados', 'completadas', 'completa', 'completala',
  'completalo', 'cumplido', 'cumplida', 'cumpli', 'acabe', 'acabado', 'acabada',
  'listo', 'lista', 'marca', 'marcala', 'marcalo', 'marcar', 'tacha', 'tachala',
  'tachalo', 'ido', 'fui',
]);

const NEGACION = new Set(['no', 'nunca', 'ni', 'sin']);
const VENTANA_NEGACION = 4;

const NEGATIVAS = new Set([
  'no', 'nop', 'nope', 'ni', 'nunca', 'negativo', 'cancela', 'cancelar',
  'cancelalo', 'olvida', 'olvidalo', 'dejalo', 'espera', 'todavia', 'aun',
]);
const AFIRMATIVAS = new Set([
  'si', 'sip', 'claro', 'vale', 'venga', 'dale', 'ok', 'okay', 'confirmo',
  'confirma', 'confirmar', 'correcto', 'exacto', 'afirmativo', 'adelante',
]);
const AFIRMATIVAS_FRASE = new Set(['eso es', 'de acuerdo']);
/** Muletillas que en una confirmación delatan duda: se comprueban antes de quitarlas. */
const DUDAS = ['a ver', 'eh', 'ehm', 'em', 'mm', 'mmm', 'hm', 'digamos'];

/** Minúsculas, sin tildes y sin puntuación; las muletillas siguen ahí. */
function limpiar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Minúsculas, sin tildes, sin puntuación y sin muletillas. */
export function normalizar(texto: string | null | undefined): string {
  if (!texto) return '';
  let t = ` ${limpiar(texto)} `;
  for (const m of MULETILLAS) {
    while (t.includes(` ${m} `)) t = t.replace(` ${m} `, ' ');
  }
  return t.trim();
}

function palabrasDe(normalizado: string): string[] {
  return normalizado ? normalizado.split(' ') : [];
}

function dice(normalizado: string, frases: readonly string[]): boolean {
  const t = ` ${normalizado} `;
  return frases.some((f) => t.includes(` ${f} `));
}

function indicesDeHecho(p: readonly string[]): number[] {
  const indices: number[] = [];
  p.forEach((palabra, i) => {
    if (HECHO.has(palabra) || (palabra === 'esta' && p[i - 1] === 'ya')) indices.push(i);
  });
  return indices;
}

export function detectarIntencion(transcripcion: string | null | undefined): Intencion {
  const t = normalizar(transcripcion);
  const p = palabrasDe(t);
  if (p.length === 0) return 'nada';
  if (dice(t, CANCELAR) || (p.length === 1 && CANCELAR_SOLO.has(p[0]))) return 'cancelar';

  const hechos = indicesDeHecho(p);
  if (hechos.length > 0) {
    // «No he ido al gym» nombra la misión y dice justo lo contrario.
    const negada = hechos.some((i) =>
      p.slice(Math.max(0, i - VENTANA_NEGACION), i).some((w) => NEGACION.has(w)),
    );
    return negada ? 'nada' : 'completar';
  }
  if (dice(t, REPETIR)) return 'repetir';
  if (dice(t, SIGUIENTE)) return 'siguiente';
  return 'nada';
}

function canonica(palabra: string): string {
  return SINONIMOS[palabra] ?? palabra;
}

/** Iguales, o la misma en singular y plural: clase/clases, flexión/flexiones, luz/luces. */
function mismaPalabra(a: string, b: string): boolean {
  if (a === b) return true;
  const [corta, larga] = a.length < b.length ? [a, b] : [b, a];
  if (corta.length < 3) return false;
  return (
    larga === `${corta}s` ||
    larga === `${corta}es` ||
    (corta.endsWith('z') && larga === `${corta.slice(0, -1)}ces`)
  );
}

function contenidoDe(palabras: readonly string[]): string[] {
  return [
    ...new Set(
      palabras
        .filter((p) => !VACIAS.has(p) && (p.length > 1 || /\d/.test(p)))
        .map(canonica),
    ),
  ];
}

function contenidoDeFrase(transcripcion: string | null | undefined): string[] {
  return contenidoDe(palabrasDe(normalizar(transcripcion)).filter((p) => !HECHO.has(p)));
}

function nombrar(m: MisionPendiente): string {
  return recortar(m.titulo, MAX_TITULO_HABLADO, '');
}

function ambigua(opciones: MisionPendiente[], pregunta?: string): Candidata {
  const nombres = opciones.map(nombrar);
  let texto = pregunta;
  if (!texto) {
    if (nombres.length === 0) texto = 'No la encuentro. ¿Qué misión era?';
    else if (nombres.length === 1) texto = `¿Te refieres a ${nombres[0]}?`;
    else texto = `¿${nombres.slice(0, -1).join(', ')} o ${nombres[nombres.length - 1]}?`;
  }
  return { tipo: 'ambigua', opciones, pregunta: texto };
}

function casar(frase: readonly string[], pendientes: readonly MisionPendiente[]): Candidata {
  if (pendientes.length === 0) return ambigua([], 'No quedan misiones pendientes.');
  if (frase.length === 0) return ambigua(pendientes.slice(0, MAX_OPCIONES));

  const puntuadas = pendientes
    .map((mision) => {
      const propias = contenidoDe(palabrasDe(normalizar(mision.titulo)));
      const aciertos = propias.filter((m) => frase.some((f) => mismaPalabra(m, f))).length;
      const total = propias.length;
      return {
        mision,
        aciertos,
        // Parecido entre las dos listas: decide quién gana.
        parecido: total > 0 ? (2 * aciertos) / (total + frase.length) : 0,
        // Basta con que una quepa casi entera en la otra.
        confianza: total > 0 ? Math.max(aciertos / total, aciertos / frase.length) : 0,
      };
    })
    .filter((p) => p.aciertos > 0);

  if (puntuadas.length === 0) return ambigua([]);

  const seguras = puntuadas
    .filter((p) => p.confianza >= UMBRAL_CONFIANZA)
    .sort((a, b) => b.parecido - a.parecido);
  if (seguras.length === 0) {
    return ambigua(puntuadas.slice(0, MAX_OPCIONES).map((p) => p.mision));
  }

  // Mismos aciertos: el título más corto no es razón para elegirlo.
  const empatadas = seguras.filter(
    (p) => seguras[0].parecido - p.parecido < MARGEN_EMPATE || p.aciertos === seguras[0].aciertos,
  );
  if (empatadas.length > 1) {
    return ambigua(empatadas.slice(0, MAX_OPCIONES).map((p) => p.mision));
  }

  const mision = seguras[0].mision;
  return { tipo: 'confirmar', mision, pregunta: `¿Confirmas ${nombrar(mision)}? Di sí o no.` };
}

/** La transcripción completa. Nunca completa: como mucho, pregunta. */
export function candidataDeVoz(
  transcripcion: string | null | undefined,
  pendientes: readonly MisionPendiente[],
): Candidata {
  const intencion = detectarIntencion(transcripcion);
  if (intencion !== 'completar') return { tipo: intencion };
  return casar(contenidoDeFrase(transcripcion), pendientes);
}

/** La respuesta a una `ambigua`: aquí nombrar la misión ya basta. */
export function aclarar(
  transcripcion: string | null | undefined,
  opciones: readonly MisionPendiente[],
): Candidata {
  const intencion = detectarIntencion(transcripcion);
  if (intencion === 'cancelar') return { tipo: 'cancelar' };
  if (normalizar(transcripcion) === '') return { tipo: 'nada' };
  if (opciones.length === 1) {
    // La pregunta fue «¿Te refieres a X?»: el sí solo lleva a la confirmación de X.
    const respuesta = interpretarRespuesta(transcripcion, true);
    if (respuesta === 'no') return { tipo: 'cancelar' };
    if (respuesta === 'si') return casar(contenidoDe(palabrasDe(normalizar(opciones[0].titulo))), opciones);
  }
  return casar(contenidoDeFrase(transcripcion), opciones);
}

/**
 * El sí o el no a una `confirmar`. Un sí ha de ser solo un sí: «si quieres
 * luego» no vale. Silencio, pregunta o duda son 'nada', y 'nada' no completa.
 * `final` viene del evento de transcripción y es obligatorio: un parcial «si»
 * puede acabar siendo «si quieres luego».
 */
export function interpretarRespuesta(
  transcripcion: string | null | undefined,
  final: boolean,
): RespuestaConfirmacion {
  if (!final || !transcripcion || /[¿?]/.test(transcripcion)) return 'nada';
  if (dice(limpiar(transcripcion), DUDAS)) return 'nada';
  const t = normalizar(transcripcion);
  const p = palabrasDe(t);
  if (p.length === 0) return 'nada';
  if (p.some((w) => NEGATIVAS.has(w))) return 'no';
  if (AFIRMATIVAS_FRASE.has(t) || p.every((w) => AFIRMATIVAS.has(w))) return 'si';
  return 'nada';
}
