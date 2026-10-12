// NIVL · Los textos de la ceremonia (Ceremony.tsx), puros para testearlos:
// qué cifra sale, cuál entra y qué falta para el siguiente rango.

import { t } from '@/i18n';
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
        eyebrow: t('ui:ceremonia.nuevoRango'),
        titulo: c.nombre,
        anuncio: t('ui:ceremonia.anuncioRango', { rango: c.rango, nombre: c.nombre, lema: c.lema }),
      };
    case 'grado': {
      const desde = c.desde !== undefined && c.desde < c.grado ? c.desde : Math.max(1, c.grado - 1);
      return {
        viejo: romano(desde),
        nuevo: romano(c.grado),
        eyebrow: t('ui:ceremonia.nuevoGrado'),
        titulo: `${c.nombre} ${romano(c.grado)}`,
        anuncio: t('ui:ceremonia.anuncioGrado', { nombre: c.nombre, grado: romano(c.grado) }),
      };
    }
    case 'nivel': {
      const desde = c.desde !== undefined && c.desde >= 1 && c.desde < c.nivel ? c.desde : Math.max(1, c.nivel - 1);
      return {
        viejo: String(desde),
        nuevo: String(c.nivel),
        eyebrow: t('ui:ceremonia.subesNivel'),
        titulo: t('ui:ceremonia.tituloNivel', { nivel: c.nivel }),
        anuncio: t('ui:ceremonia.anuncioNivel', { nivel: c.nivel }),
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
  const hayNiveles = faltan > 0;
  const hayDias = faltanDias !== null && faltanDias > 0;
  if (hayNiveles && hayDias) {
    return t('ui:ceremonia.faltanAmbos', {
      niveles: t('ui:ceremonia.niveles', { count: faltan }),
      dias: t('ui:ceremonia.diasActivos', { count: faltanDias }),
    });
  }
  if (hayNiveles) return t('ui:ceremonia.faltaNiveles', { count: faltan });
  if (hayDias) return t('ui:ceremonia.faltaDias', { count: faltanDias });
  return null;
}
