// NIVL · IRON · El catálogo con sus nombres en el idioma de la interfaz y en
// español, para casar el texto libre de Gimnasio y para el selector.
// Sin Supabase (lo usan Gimnasio y /iron/[id]); lo puro está en casar.ts.

import { idiomaInterfaz } from '@/i18n';
import { textoIron } from '@/components/iron/texto';
import { buscarEjercicios, casarEjercicio, indiceCasado, type EntradaCasado } from './casar';
import { EJERCICIOS, ejercicioPorId } from './ejercicios';
import type { Ejercicio, GrupoMuscular } from './tipos';

export interface EntradaIron extends EntradaCasado {
  /** El nombre en el idioma de la interfaz (el que se escribe en el campo). */
  readonly nombre: string;
  readonly grupo: GrupoMuscular;
  readonly ejercicio: Ejercicio;
}

let cache: {
  idioma: string;
  entradas: EntradaIron[];
  indice: ReadonlyMap<string, string>;
} | null = null;

function construir() {
  const idioma = idiomaInterfaz();
  if (cache && cache.idioma === idioma) return cache;
  const entradas = EJERCICIOS.map((e) => {
    const nombre = textoIron(e.nombre);
    const es = textoIron(e.nombre, { lng: 'es' });
    return {
      id: e.id,
      nombre,
      nombres: nombre === es ? [nombre] : [nombre, es],
      grupo: e.grupo,
      ejercicio: e,
    };
  });
  cache = { idioma, entradas, indice: indiceCasado(entradas) };
  return cache;
}

/** Todo el catálogo, en su orden. */
export function entradasIron(): readonly EntradaIron[] {
  return construir().entradas;
}

/** Los ejercicios de la búsqueda del selector. */
export function buscarIron(consulta: string): EntradaIron[] {
  return buscarEjercicios(consulta, construir().entradas);
}

/** El ejercicio del catálogo con ese nombre exacto (normalizado), o undefined. */
export function ejercicioIronDe(nombre: string): Ejercicio | undefined {
  const id = casarEjercicio(nombre, construir().indice);
  return id ? ejercicioPorId(id) : undefined;
}
