// NIVL · Medición: lo que las pantallas calculan sin tocar nada nativo.
//
// Puro a propósito, con su test: decidir por qué algo no está disponible, dar
// formato a las cifras del GPS y traducir una sesión apuntada al «declarado»
// del contraste. Del módulo nativo solo entran tipos, que no se cargan.

import { SIN_DATO } from '@/components/ui/sinDato';
import { decimal } from '@/i18n/formato';
import type { CardioKind } from '@/lib/bodywork';
import { dateKey } from '@/lib/dates';
import type { DeporteEntreno } from '@/lib/entrenoMedido';
import type { CategoriaSalud } from '@/lib/medicion/saludNativa';

/** En el orden en que se explican: primero lo que más pesa en un entreno. */
export const ORDEN_CATEGORIAS: readonly CategoriaSalud[] = ['entrenos', 'fc', 'energia', 'pasos', 'sueno', 'peso'];

export type MotivoNoDisponible = 'web' | 'android' | 'sin_modulo' | 'sin_salud';

/**
 * Por qué no se puede medir aquí, o null si se puede. La plataforma va antes
 * que el módulo: en Android falta el módulo porque no existe, no porque haya
 * que actualizar.
 */
export function motivoNoDisponible(plataforma: string, hayModulo: boolean, hayServicio: boolean): MotivoNoDisponible | null {
  if (plataforma === 'web') return 'web';
  if (plataforma !== 'ios') return 'android';
  if (!hayModulo) return 'sin_modulo';
  return hayServicio ? null : 'sin_salud';
}

/** Kilómetros con dos decimales. Sin medir no es cero: es sin dato. */
export function kmDe(metros: number | null): string {
  return metros === null || !Number.isFinite(metros) ? SIN_DATO : decimal(metros / 1000, 2);
}

/** Por debajo de 1 s/km o sin dato no hay ritmo que enseñar (parado). */
function ritmoValido(sKm: number | null): sKm is number {
  return sKm !== null && Number.isFinite(sKm) && sKm >= 1;
}

/** En bici se habla en km/h: 120 s/km → «30,0». */
export function velocidadDe(sKm: number | null): string {
  return ritmoValido(sKm) ? decimal(3600 / sKm, 1) : SIN_DATO;
}

export type CalidadGps = 'buena' | 'media' | 'debil';

/** La calidad de la señal por su radio de error, o null sin lectura. */
export function calidadGps(precisionM: number | null): CalidadGps | null {
  if (precisionM === null || !Number.isFinite(precisionM) || precisionM < 0) return null;
  if (precisionM <= 10) return 'buena';
  return precisionM <= 30 ? 'media' : 'debil';
}

/**
 * ¿La sesión terminó otro día? Por fecha local de `fin`, nunca cortando el
 * ISO: a las 00:30 en Madrid el corte en UTC daría ayer.
 */
export function esDeOtroDia(finIso: string, hoy: string): boolean {
  const ms = Date.parse(finIso);
  return Number.isFinite(ms) && dateKey(new Date(ms)) !== hoy;
}

const DEPORTE_DE: Record<CardioKind, DeporteEntreno> = {
  correr: 'carrera',
  bici: 'bici',
  nadar: 'piscina',
  caminar: 'otro',
  remo: 'otro',
  otro: 'otro',
};

/** El deporte con el que se contrasta una sesión apuntada a mano. */
export function deporteDeCardio(kind: CardioKind): DeporteEntreno {
  return DEPORTE_DE[kind];
}
