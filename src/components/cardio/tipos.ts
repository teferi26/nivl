// NIVL · Cardio: nombres, iconos y zonas para la vista y la hoja. Puro.
//
// Los Record son exhaustivos sobre los tipos de `bodywork` (solo `import type`,
// sin Supabase): un tipo o una zona nueva no compila hasta tener su icono (o
// su sitio) aquí y su nombre en el catálogo (cardio:tipo.*, cardio:zona.*), y
// el orden de las claves es el de CARDIO_KINDS y CARDIO_ZONES.

import type Ionicons from '@expo/vector-icons/Ionicons';
import { t } from '@/i18n';
import { decimal } from '@/i18n/formato';
import type { CardioKind, CardioZone } from '@/lib/bodywork';

export const ICONO: Record<CardioKind, keyof typeof Ionicons.glyphMap> = {
  correr: 'walk-outline',
  nadar: 'water-outline',
  bici: 'bicycle-outline',
  caminar: 'footsteps-outline',
  remo: 'boat-outline',
  otro: 'pulse-outline',
};

/** El nombre del tipo de sesión: «Correr». */
export function etiquetaCardio(kind: CardioKind): string {
  return t(`cardio:tipo.${kind}`);
}

// La natación se mide en metros y por tiempo; el resto en kilómetros.
export const PIDE_DISTANCIA: Record<CardioKind, boolean> = {
  correr: true,
  nadar: true,
  bici: true,
  caminar: true,
  remo: true,
  otro: false,
};

/** El orden de las zonas en la hoja (exhaustivo sobre CardioZone). */
const ORDEN_ZONA: Record<CardioZone, number> = {
  Z1: 1,
  Z2: 2,
  Z3: 3,
  Z4: 4,
  Z5: 5,
  intervalos: 6,
  libre: 7,
};

/** El nombre de la zona: «Z2», «Intervalos». */
export function zonaCardio(zona: CardioZone): string {
  return t(`cardio:zona.${zona}`);
}

export const TIPOS = Object.keys(ICONO) as CardioKind[];
export const ZONAS = Object.keys(ORDEN_ZONA) as CardioZone[];

/**
 * Una cifra con hasta `decimales` decimales, sin ceros de cola y con la coma
 * del idioma, como `numeroES` de pagoActo: 12.5 → «12,5»; 10 → «10».
 */
export function cifraCorta(n: number, decimales = 2): string {
  const factor = 10 ** decimales;
  const redondo = Math.round(n * factor) / factor;
  return decimal(redondo, (String(redondo).split('.')[1] ?? '').length);
}

/** "2026-09-17" → "17/09". Solo para la lista. */
export const fechaCorta = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
