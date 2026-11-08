// NIVL · Ayuda contextual, parte pura: qué pistas se han cerrado y cuál toca
// enseñar. Sin AsyncStorage, sin React. Los efectos están en ayudaEstado.ts.

export interface EstadoAyuda {
  /** Ids de las pistas cerradas con «Entendido». */
  descartadas: readonly string[];
  /** «No mostrar más pistas»: ninguna se pinta hasta reactivarlas. */
  apagadas: boolean;
}

export const ESTADO_INICIAL: EstadoAyuda = { descartadas: [], apagadas: false };

/** Una pista montada que compite con otras de su grupo. */
export interface RegistroPista {
  id: string;
  grupo: string;
  /** Menor número, antes sale. */
  prioridad: number;
}

/** Convención de ids: `pantalla.tema` o `modo.pantalla.tema`, en minúsculas y con guiones. */
export function esIdPistaValido(id: string): boolean {
  return /^[a-z0-9]+(-[a-z0-9]+)*(\.[a-z0-9]+(-[a-z0-9]+)*){1,2}$/.test(id);
}

/** Lo guardado, tolerando basura: un almacén roto nunca debe romper una pantalla. */
export function parsearEstado(crudo: string | null): EstadoAyuda {
  if (!crudo) return ESTADO_INICIAL;
  let datos: unknown;
  try {
    datos = JSON.parse(crudo);
  } catch {
    return ESTADO_INICIAL;
  }
  if (typeof datos !== 'object' || datos === null) return ESTADO_INICIAL;
  const { descartadas, apagadas } = datos as { descartadas?: unknown; apagadas?: unknown };
  const lista = Array.isArray(descartadas) ? descartadas.filter((d): d is string => typeof d === 'string') : [];
  return { descartadas: [...new Set(lista)], apagadas: apagadas === true };
}

export function serializarEstado(estado: EstadoAyuda): string {
  return JSON.stringify(estado);
}

export function estaDescartada(estado: EstadoAyuda, id: string): boolean {
  return estado.descartadas.includes(id);
}

export function descartarPista(estado: EstadoAyuda, id: string): EstadoAyuda {
  return estaDescartada(estado, id) ? estado : { ...estado, descartadas: [...estado.descartadas, id] };
}

export function apagarTodas(estado: EstadoAyuda): EstadoAyuda {
  return estado.apagadas ? estado : { ...estado, apagadas: true };
}

/** Enciende las pistas y olvida las cerradas: quien las reactiva quiere volver a verlas. */
export function reactivarTodas(estado: EstadoAyuda): EstadoAyuda {
  return !estado.apagadas && estado.descartadas.length === 0 ? estado : ESTADO_INICIAL;
}

/** La pista de un grupo que toca enseñar: la primera sin cerrar por prioridad, o null. */
export function ganadoraDelGrupo(estado: EstadoAyuda, registros: readonly RegistroPista[], grupo: string): string | null {
  let ganadora: RegistroPista | null = null;
  for (const r of registros) {
    if (r.grupo !== grupo || estaDescartada(estado, r.id)) continue;
    // Con la misma prioridad gana la primera en montarse (la que va más arriba).
    if (!ganadora || r.prioridad < ganadora.prioridad) ganadora = r;
  }
  return ganadora?.id ?? null;
}

export function pistaVisible(
  estado: EstadoAyuda,
  registros: readonly RegistroPista[],
  id: string,
  grupo?: string,
): boolean {
  if (estado.apagadas || estaDescartada(estado, id)) return false;
  return !grupo || ganadoraDelGrupo(estado, registros, grupo) === id;
}
