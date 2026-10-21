// NIVL · FOCUS: qué misión paga un bloque de estudio (puro, con tests).
//
// Un solo gesto, versión FOCUS: el bloque de foco NO tiene XP propio. Si al
// empezarlo hay enlazada una misión de FOCUS de hoy sin hacer, al terminar el
// bloque ENTERO se completa esa misión por el camino de siempre
// (`complete_quest`, que suma también el XP del modo). Sin misión, el bloque
// cuenta horas y repasos, y ni un punto: no hay economía nueva.

export interface MisionFocus {
  id: string;
  titulo: string;
  hecha: boolean;
  /** Las de penalización no se enlazan: restauran, no se estudian. */
  penalizacion?: boolean;
}

const normal = (s: string) =>
  s
    .toLocaleLowerCase('es')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/** Las misiones que se pueden enlazar a un bloque: de hoy, sin hacer y no de penalización. */
export function enlazables<T extends MisionFocus>(misiones: readonly T[]): T[] {
  return misiones.filter((m) => !m.hecha && !m.penalizacion);
}

/**
 * La misión que se propone enlazar: la primera pendiente cuyo título nombra la
 * asignatura (sin tildes ni mayúsculas); si no, la primera pendiente que hable
 * de estudiar; si no, ninguna (el usuario la elige a mano).
 */
export function misionPropuesta<T extends MisionFocus>(misiones: readonly T[], asignatura: string | null): T | null {
  const libres = enlazables(misiones);
  if (asignatura) {
    const a = normal(asignatura);
    const porNombre = a.length >= 3 ? libres.find((m) => normal(m.titulo).includes(a)) : undefined;
    if (porNombre) return porNombre;
  }
  return libres.find((m) => /\b(estudi|repas|pomodoro|bloque|tema|examen|leer|apuntes)/.test(normal(m.titulo))) ?? null;
}

/** El bloque cumple la misión si se ha terminado entero (no saltado ni a medias). */
export function cumpleMision(focoCompleto: { minutos: number } | null, misionId: string | null): misionId is string {
  return focoCompleto !== null && focoCompleto.minutos > 0 && typeof misionId === 'string' && misionId.length > 0;
}
