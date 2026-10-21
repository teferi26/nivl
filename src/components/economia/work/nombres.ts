// NIVL · WORK: cómo se llaman las cosas al pintarlas (categorías, cuentas,
// importes). Se traduce al pintar, nunca al cargar el módulo.

import type Ionicons from '@expo/vector-icons/Ionicons';
import { t } from '@/i18n';
import { moneda } from '@/i18n/formato';
import { grupoDe, GRUPOS, type CategoriaPropia, type GrupoId } from '@/lib/moneywork';

type Icono = keyof typeof Ionicons.glyphMap;

export const ICONO_GRUPO: Readonly<Record<GrupoId, Icono>> = {
  comida: 'restaurant-outline',
  transporte: 'bus-outline',
  ocio: 'game-controller-outline',
  casa: 'home-outline',
  suscripciones: 'repeat-outline',
  salud: 'medkit-outline',
  educacion: 'school-outline',
  otros: 'pricetag-outline',
};

export const ICONO_CUENTA: Readonly<Record<string, Icono>> = {
  efectivo: 'cash-outline',
  banco: 'business-outline',
  revolut: 'card-outline',
  inversion: 'trending-up-outline',
  otro: 'wallet-outline',
};

export function iconoCuenta(tipo: string): Icono {
  return ICONO_CUENTA[tipo] ?? 'wallet-outline';
}

const INGRESOS: Record<string, 'nomina' | 'negocio' | 'otro'> = {
  ingreso_nomina: 'nomina',
  ingreso_negocio: 'negocio',
  ingreso_otro: 'otro',
};

export function nombreGrupo(g: GrupoId): string {
  return t(`economia:work.grupo.${g}`);
}

/** Nombre de una clave de «En qué se va» (grupo o `u:<id>` de una categoría propia). */
export function nombreClave(clave: string, propias: readonly CategoriaPropia[]): string {
  if (clave.startsWith('u:')) return propias.find((c) => `u:${c.id}` === clave)?.name ?? t('economia:work.grupo.otros');
  return (GRUPOS as readonly string[]).includes(clave) ? nombreGrupo(clave as GrupoId) : clave;
}

export function iconoClave(clave: string): Icono {
  return clave.startsWith('u:') ? 'bookmark-outline' : (ICONO_GRUPO[clave as GrupoId] ?? 'pricetag-outline');
}

/** Nombre de la categoría de un movimiento. */
export function nombreCategoriaMov(
  m: { category: string; user_category_id?: string | null; is_internal?: boolean },
  propias: readonly CategoriaPropia[],
): string {
  if (m.user_category_id) return nombreClave(`u:${m.user_category_id}`, propias);
  if (m.is_internal || m.category === 'transferencia') return t('economia:work.transferencia');
  if (m.category === 'sin_clasificar') return t('economia:work.sinClasificar');
  const ingreso = INGRESOS[m.category];
  if (ingreso) return t(`economia:work.ingreso.${ingreso}`);
  if (m.category === 'ahorro' || m.category === 'inversion') return t('economia:work.ahorro');
  return nombreGrupo(grupoDe(m.category));
}

/** «1.234,50 €» (siempre con céntimos si los hay). */
export function euros(n: number): string {
  return moneda(n, Number.isInteger(Math.round(n * 100) / 100) ? 0 : 2);
}

/** Con signo: «−12,50 €» / «+2.150 €». El signo es la información. */
export function eurosSigno(n: number): string {
  return `${n < 0 ? '−' : '+'}${euros(Math.abs(n))}`;
}
