// NIVL · FOCUS: las cuentas del arranque guiado (puro, con tests).

import { temasDesdeTexto, type TemaImportado } from './importar';
import { leerFechaEs } from './fechas';

export const MAX_ASIGNATURAS = 30;
export const MAX_NOMBRE_ASIGNATURA = 80;

/** Las elegidas de la plantilla más las pegadas, sin repetir (da igual mayúsculas), en ese orden. */
export function nombresDeAsignaturas(elegidas: readonly string[], texto: string): string[] {
  const pegadas = texto
    .split(/\r\n|\r|\n/)
    .map((l) => l.replace(/^[-*•·]\s+/, '').trim())
    .filter(Boolean);
  const vistas = new Set<string>();
  const out: string[] = [];
  for (const cruda of [...elegidas, ...pegadas]) {
    const nombre = cruda.trim().slice(0, MAX_NOMBRE_ASIGNATURA).trimEnd();
    const clave = nombre.toLocaleLowerCase('es');
    if (!nombre || vistas.has(clave)) continue;
    vistas.add(clave);
    out.push(nombre);
    if (out.length === MAX_ASIGNATURAS) break;
  }
  return out;
}

/** La asignatura del primer examen: la elegida; si solo hay una, esa; si no, ninguna. */
export function asignaturaDelExamen(asignaturas: readonly { id: string }[], elegida: string | null): string | null {
  if (elegida && asignaturas.some((a) => a.id === elegida)) return elegida;
  return asignaturas.length === 1 ? (asignaturas[0]?.id ?? null) : null;
}

export interface ExamenDeArranque {
  asignaturaId: string;
  /** null: aún sin fecha. */
  fecha: string | null;
  temas: TemaImportado[];
}

/**
 * Lo que se guarda al acabar el arranque. `fecha` vacío significa «aún sin fecha».
 * Sin asignatura a la que atarlo no se crea nada; con una fecha ilegible o
 * pasada, 'fecha_mala'.
 */
export function examenDeArranque(asignaturaId: string | null, fecha: string, temas: string, hoy: string): ExamenDeArranque | null | 'fecha_mala' {
  const texto = fecha.trim();
  let leida: string | null = null;
  if (texto) {
    leida = leerFechaEs(texto, hoy);
    if (leida === null || leida < hoy) return 'fecha_mala';
  }
  if (asignaturaId === null) return null;
  return { asignaturaId, fecha: leida, temas: temasDesdeTexto(temas).temas };
}
