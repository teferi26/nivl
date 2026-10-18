// NIVL · IRON · El botón «Sustituir».
//
// Propone otro ejercicio para el mismo músculo, con el material que tiene la
// persona. Orden de preferencia:
// 1. Los `sustitutos` escritos a mano en el archivo del ejercicio, en orden.
// 2. Otro ejercicio del mismo grupo muscular, el que más músculos principales
//    comparta (y, a igualdad, más secundarios).
// Nunca propone un ejercicio de otro grupo: si no hay, devuelve null y la
// pantalla lo dice. Puro.

import { EJERCICIOS } from './ejercicios';
import type { Ejercicio, Material } from './tipos';

export interface Sustitucion {
  ejercicio: Ejercicio;
  /** 'elegido': está en la lista del ejercicio; 'grupo': mismo grupo muscular. */
  motivo: 'elegido' | 'grupo';
}

const comunes = <T,>(a: readonly T[], b: readonly T[]) => a.filter((x) => b.includes(x)).length;

/** ¿Se puede hacer con este material? Sin lista de material, todo vale. */
export function cabeConMaterial(ej: Ejercicio, material?: readonly Material[]): boolean {
  if (!material) return true;
  return ej.material.every((m) => m === 'peso_corporal' || material.includes(m));
}

export function sustituto(
  id: string,
  opciones: { material?: readonly Material[]; excluir?: readonly string[]; catalogo?: readonly Ejercicio[] } = {},
): Sustitucion | null {
  const catalogo = opciones.catalogo ?? EJERCICIOS;
  const actual = catalogo.find((e) => e.id === id);
  if (!actual) return null;
  const fuera = new Set([id, ...(opciones.excluir ?? [])]);
  const vale = (e: Ejercicio) => !fuera.has(e.id) && cabeConMaterial(e, opciones.material);

  for (const otroId of actual.sustitutos) {
    const otro = catalogo.find((e) => e.id === otroId);
    if (otro && vale(otro)) return { ejercicio: otro, motivo: 'elegido' };
  }

  const candidatos = catalogo
    .filter((e) => e.grupo === actual.grupo && vale(e))
    .map((e) => ({
      e,
      p: comunes(e.musculos.principales, actual.musculos.principales),
      s: comunes(e.musculos.secundarios, actual.musculos.secundarios),
    }))
    .sort((a, b) => b.p - a.p || b.s - a.s || a.e.id.localeCompare(b.e.id));
  return candidatos.length > 0 ? { ejercicio: candidatos[0].e, motivo: 'grupo' } : null;
}
