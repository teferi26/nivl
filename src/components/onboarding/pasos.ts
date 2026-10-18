// NIVL · Onboarding: el orden de los pasos (puro, con test).
//
// Los siete pasos de siempre se numeran 0 a 6 (Bienvenida · Nombre · Para qué
// · El objetivo · Primeros hábitos · La firma · NIVL Pro) y onboarding.tsx los
// compara por número. Los pasos nuevos de la fase 1 de Modos entran SOLO con
// su interruptor y con un número que cae entre los de siempre, así nada de lo
// anterior se renumera:
//   · PASO_IDIOMA (-1): el primero de todos, con `idiomas_activos`;
//   · PASO_MODOS (2.5): «Elige tus modos», tras elegir para qué, con
//     `modos_activos`.
// Con los dos apagados la secuencia es 0..6 y avanzar es sumar uno: el
// onboarding de siempre, paso a paso.

export const PASO_IDIOMA = -1;
export const PASO_MODOS = 2.5;
/** Los pasos de siempre. */
export const PASOS_BASE = [0, 1, 2, 3, 4, 5, 6] as const;

export interface InterruptoresOnboarding {
  idioma: boolean;
  modos: boolean;
}

export function secuenciaPasos(i: InterruptoresOnboarding): number[] {
  const out: number[] = [];
  if (i.idioma) out.push(PASO_IDIOMA);
  for (const p of PASOS_BASE) {
    out.push(p);
    if (p === 2 && i.modos) out.push(PASO_MODOS);
  }
  return out;
}

/** El paso que sigue a `actual` (el último se queda donde está). */
export function siguientePaso(secuencia: readonly number[], actual: number): number {
  const i = secuencia.indexOf(actual);
  if (i < 0) {
    // Un paso que ya no está en la secuencia (el interruptor se apagó a
    // mitad): el primero de los que vienen detrás.
    return secuencia.find((p) => p > actual) ?? actual;
  }
  return secuencia[Math.min(i + 1, secuencia.length - 1)]!;
}

/** El paso anterior (el primero se queda donde está). */
export function pasoAnterior(secuencia: readonly number[], actual: number): number {
  const i = secuencia.indexOf(actual);
  if (i < 0) return [...secuencia].reverse().find((p) => p < actual) ?? secuencia[0]!;
  return secuencia[Math.max(i - 1, 0)]!;
}

/** «Paso N de M» del progreso: la posición en la secuencia, desde 1. */
export function posicionPaso(secuencia: readonly number[], actual: number): { paso: number; total: number } {
  const i = secuencia.indexOf(actual);
  return { paso: (i < 0 ? secuencia.filter((p) => p < actual).length : i) + 1, total: secuencia.length };
}
