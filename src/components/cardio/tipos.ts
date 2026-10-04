// NIVL · Cardio: nombres, iconos y zonas para la vista y la hoja. Puro.
//
// Los Record son exhaustivos sobre los tipos de `bodywork` (solo `import type`,
// sin Supabase): un tipo o una zona nueva no compila hasta tener su nombre
// aquí, y el orden de las claves es el de CARDIO_KINDS y CARDIO_ZONES.

import type Ionicons from '@expo/vector-icons/Ionicons';
import type { CardioKind, CardioZone } from '@/lib/bodywork';

export const ICONO: Record<CardioKind, keyof typeof Ionicons.glyphMap> = {
  correr: 'walk-outline',
  nadar: 'water-outline',
  bici: 'bicycle-outline',
  caminar: 'footsteps-outline',
  remo: 'boat-outline',
  otro: 'pulse-outline',
};

export const ETIQUETA: Record<CardioKind, string> = {
  correr: 'Correr',
  nadar: 'Nadar',
  bici: 'Bici',
  caminar: 'Caminar',
  remo: 'Remo',
  otro: 'Otro',
};

// La natación se mide en metros y por tiempo; el resto en kilómetros.
export const PIDE_DISTANCIA: Record<CardioKind, boolean> = {
  correr: true,
  nadar: true,
  bici: true,
  caminar: true,
  remo: true,
  otro: false,
};

export const ZONA: Record<CardioZone, string> = {
  Z1: 'Z1',
  Z2: 'Z2',
  Z3: 'Z3',
  Z4: 'Z4',
  Z5: 'Z5',
  intervalos: 'Intervalos',
  libre: 'Libre',
};

export const TIPOS = Object.keys(ETIQUETA) as CardioKind[];
export const ZONAS = Object.keys(ZONA) as CardioZone[];

/** "2026-09-17" → "17/09". Solo para la lista. */
export const fechaCorta = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
