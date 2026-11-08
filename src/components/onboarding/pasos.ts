// NIVL · Onboarding: el orden de los pasos (puro, con test).
//
// El onboarding de Ónix: 0 bienvenida · 1 nombre · 4 misiones · 5 plan · 6
// oferta (quien mide por paso sigue viendo enteros de 0 a 6). Entran además:
//   · PASO_IDIOMA (-1), con `idiomas_activos`;
//   · PASO_CUESTIONARIO (0.5), si este teléfono no trae las respuestas de /empezar;
//   · PASO_MODOS (2.5), con `modos_activos`;
//   · PASO_SALUD (3), si lo contestado incluye salud y falta el permiso.

export const PASO_IDIOMA = -1;
export const PASO_CUESTIONARIO = 0.5;
export const PASO_MODOS = 2.5;
export const PASO_SALUD = 3;
/** Los pasos de siempre: bienvenida, nombre, misiones, plan y oferta. */
export const PASOS_BASE = [0, 1, 4, 5, 6] as const;

export interface InterruptoresOnboarding {
  idioma: boolean;
  modos: boolean;
  /** Este teléfono no tiene el cuestionario de /empezar: se hace aquí. */
  cuestionario?: boolean;
  /** Lo contestado incluye salud y aún no hay permiso. */
  salud?: boolean;
}

export function secuenciaPasos(i: InterruptoresOnboarding): number[] {
  const out: number[] = [];
  if (i.idioma) out.push(PASO_IDIOMA);
  for (const p of PASOS_BASE) {
    if (p === 4 && i.salud) out.push(PASO_SALUD);
    out.push(p);
    if (p === 0 && i.cuestionario) out.push(PASO_CUESTIONARIO);
    if (p === 1 && i.modos) out.push(PASO_MODOS);
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
