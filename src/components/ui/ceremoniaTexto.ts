// NIVL · Los textos de la ceremonia (Ceremony.tsx), puros para testearlos:
// qué cifra sale, cuál entra y qué falta para el siguiente rango.

import { RANGOS, type Celebracion, type RangoId } from '@/lib/progression';

export function romano(n: number): string {
  return n === 3 ? 'III' : n === 2 ? 'II' : 'I';
}

/** El rango inmediatamente anterior (E se queda en E). */
export function rangoAnterior(r: RangoId): RangoId {
  const i = RANGOS.findIndex((x) => x.id === r);
  return RANGOS[Math.max(0, i - 1)]!.id;
}

/** El rango del que se sale: el de antes de la acción, o el anterior si no se sabe. */
export function rangoDeSalida(c: Celebracion): RangoId {
  if (c.tipo !== 'rango') return rangoAnterior('E');
  return c.desde && c.desde !== c.rango ? c.desde : rangoAnterior(c.rango);
}

export interface PiezasCeremonia {
  viejo: string;
  nuevo: string;
  eyebrow: string;
  titulo: string;
  anuncio: string;
}

/** Qué cifra sale y cuál entra, rótulos y texto para el lector. */
export function piezasCeremonia(c: Celebracion): PiezasCeremonia {
  switch (c.tipo) {
    case 'rango':
      return {
        viejo: rangoDeSalida(c),
        nuevo: c.rango,
        eyebrow: 'NUEVO RANGO',
        titulo: c.nombre,
        anuncio: `Nuevo rango: ${c.rango}, ${c.nombre}. ${c.lema}`,
      };
    case 'grado': {
      const desde = c.desde !== undefined && c.desde < c.grado ? c.desde : Math.max(1, c.grado - 1);
      return {
        viejo: romano(desde),
        nuevo: romano(c.grado),
        eyebrow: 'NUEVO GRADO',
        titulo: `${c.nombre} ${romano(c.grado)}`,
        anuncio: `Nuevo grado: ${c.nombre} ${romano(c.grado)}`,
      };
    }
    case 'nivel': {
      const desde = c.desde !== undefined && c.desde >= 1 && c.desde < c.nivel ? c.desde : Math.max(1, c.nivel - 1);
      return {
        viejo: String(desde),
        nuevo: String(c.nivel),
        eyebrow: 'SUBES DE NIVEL',
        titulo: `Nivel ${c.nivel}`,
        anuncio: `Subes al nivel ${c.nivel}`,
      };
    }
    default:
      return { viejo: '', nuevo: '', eyebrow: '', titulo: '', anuncio: '' };
  }
}

/**
 * «Faltan 3 niveles y 40 días activos», «Faltan 40 días activos» o «Falta 1
 * nivel». null si no falta nada que se sepa (nunca «Faltan 0 niveles»).
 */
export function lineaFaltan(faltan: number, faltanDias: number | null): string | null {
  const partes: string[] = [];
  if (faltan > 0) partes.push(`${faltan} ${faltan === 1 ? 'nivel' : 'niveles'}`);
  if (faltanDias !== null && faltanDias > 0) partes.push(`${faltanDias} ${faltanDias === 1 ? 'día activo' : 'días activos'}`);
  if (partes.length === 0) return null;
  const singular = partes.length === 1 && (faltan === 1 || (faltan <= 0 && faltanDias === 1));
  return `${singular ? 'Falta' : 'Faltan'} ${partes.join(' y ')}`;
}
