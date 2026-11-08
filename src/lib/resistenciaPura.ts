// NIVL · Resistencia: decisiones puras de la capa de datos.
//
// Sin Supabase a propósito: importar `supabase` arrastra AsyncStorage y los
// tests de este módulo dejarían de arrancar. Los efectos, en `resistencia.ts`.

import type { DeporteEntreno, EntrenoMedido } from './entrenoMedido';
import type { Disciplina, PlanCarrera } from './planCarrera';

/** Menos de cinco minutos no es una sesión: es un sensor o un error. */
export const MIN_DURACION_PAGO_S = 300;

export type DecisionPago = 'pagar' | 'proponer' | 'solo_guardar';

/**
 * Qué hace la economía con un entreno nuevo. Medir no paga más que declarar:
 *  - Solo paga lo de HOY (`fecha` local del fin). Lo anterior se guarda con
 *    0 XP: ayer ya se cerró y un año importado de Salud no regala un año de XP.
 *  - Fuerza no paga: su acto real es la sesión del gimnasio. `otro` medido
 *    tampoco: el sensor no sabe qué fue.
 *  - Salud es un dato pasivo: no salda misiones sin que la persona lo confirme.
 *    Reloj y GPS sí pagan, porque ella arrancó la sesión.
 */
export function decidirPago(
  e: Pick<EntrenoMedido, 'origen' | 'deporte' | 'duracion_s'> & { fecha: string },
  hoy: string,
): DecisionPago {
  if (e.deporte === 'fuerza' || (e.deporte === 'otro' && e.origen !== 'manual')) return 'solo_guardar';
  if (e.fecha !== hoy || e.duracion_s < MIN_DURACION_PAGO_S) return 'solo_guardar';
  return e.origen === 'salud' ? 'proponer' : 'pagar';
}

/** La disciplina del plan que demuestra ese deporte, si alguna. */
export function disciplinaDeDeporte(d: DeporteEntreno): Disciplina | null {
  switch (d) {
    case 'carrera':
      return 'carrera';
    case 'bici':
      return 'bici';
    case 'piscina':
    case 'aguas_abiertas':
      return 'natacion';
    case 'fuerza':
      return 'fuerza';
    case 'caminar':
    case 'otro':
      return null;
  }
}

/** Los deportes que comparten palmarés: piscina y aguas abiertas son natación. */
export function deportesDelMismoRecord(d: DeporteEntreno): DeporteEntreno[] {
  return d === 'piscina' || d === 'aguas_abiertas' ? ['piscina', 'aguas_abiertas'] : [d];
}

/**
 * La sesión del plan que salda este entreno: la pendiente de su disciplina y, si
 * no hay, un brick pendiente (nadie registra un brick como deporte: se registra
 * la bici o la carrera). Las claves, primero; es la que importa no dejar abierta.
 */
export function elegirSesionPlan<S extends { id: string; disciplina: string; clave: boolean; hecha_entreno_id: string | null }>(
  sesiones: readonly S[],
  deporte: DeporteEntreno,
): S | null {
  const disciplina = disciplinaDeDeporte(deporte);
  if (!disciplina) return null;
  const pendientes = sesiones.filter((s) => s.hecha_entreno_id === null);
  const primera = (lista: S[]) => lista.find((s) => s.clave) ?? lista[0] ?? null;
  const directas = pendientes.filter((s) => s.disciplina === disciplina);
  if (directas.length > 0) return primera(directas);
  if (deporte === 'bici' || deporte === 'carrera') {
    return primera(pendientes.filter((s) => s.disciplina === 'brick'));
  }
  return null;
}

/**
 * Lo que cambia al reimportar un entreno que ya existe. Lo que esta lectura no
 * trae (null) no borra lo guardado: un Salud sin ruta no se come la del reloj.
 * RPE y notas solo si vienen; el XP y `created_at` nunca se tocan.
 */
export function camposReimportacion(
  e: EntrenoMedido,
  fecha: string,
  extra?: { rpe?: number | null; notas?: string | null },
): Record<string, unknown> {
  const cambios: Record<string, unknown> = {
    origen: e.origen,
    deporte: e.deporte,
    fecha,
    inicio: e.inicio,
    fin: e.fin,
    duracion_s: e.duracion_s,
  };
  const opcionales = {
    distancia_m: e.distancia_m,
    kcal: e.kcal,
    fc_media: e.fc_media,
    fc_max: e.fc_max,
    desnivel_m: e.desnivel_m,
    ruta: e.ruta,
    fc_serie: e.fc_serie ?? null,
    largo_piscina_m: e.largo_piscina_m,
    rpe: rpeValido(extra?.rpe),
    notas: notaValida(extra?.notas),
  };
  for (const [k, v] of Object.entries(opcionales)) if (v !== null) cambios[k] = v;
  if (e.parciales.length > 0) cambios.parciales = e.parciales;
  return cambios;
}

/** El CHECK de la 0105: 1 a 10, o nada. */
export function rpeValido(x: number | null | undefined): number | null {
  return typeof x === 'number' && Number.isFinite(x) && x >= 1 && x <= 10 ? x : null;
}

/** Notas recortadas al CHECK de la 0105. Una nota vacía es que no hay nota. */
export function notaValida(x: string | null | undefined): string | null {
  const t = x?.trim();
  return t ? t.slice(0, 2000) : null;
}

/**
 * Las coordenadas viajan y se guardan a 2 decimales (la ciudad, no la casa). El
 * CHECK de la 0106 rechaza cualquier otra cosa.
 */
export function redondearCoordenada(x: number): number {
  return Math.round(x * 100) / 100;
}

/** El plan calculado, en filas de `plan_sesiones`. */
export function filasDelPlan(plan: PlanCarrera, userId: string, objetivoId: string) {
  return plan.semanas.flatMap((semana) =>
    semana.sesiones.map((s) => ({
      user_id: userId,
      objetivo_id: objetivoId,
      semana: s.semana,
      fecha: s.fecha,
      disciplina: s.disciplina,
      titulo: s.titulo,
      detalle: s.detalle,
      duracion_min: s.duracion_min,
      zona: s.zona,
      clave: s.clave,
      fase: semana.fase,
    })),
  );
}
