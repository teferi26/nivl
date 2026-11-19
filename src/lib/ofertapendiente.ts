// NIVL · La oferta que el cuestionario de entrada no llegó a enseñar.
//
// El paso 6 del cuestionario solo enseña la oferta si puede leer el estado de
// la cuenta (`fetchAiStatus`) en 4 s. Sin red, con la lectura lenta o con un
// fallo, la persona entra sin haber visto nunca un precio ni la prueba de 7
// días, y ninguna otra pantalla le enseña una hoja por su cuenta: para ella
// el muro no existe. Aquí se apunta eso en el dispositivo y, en la siguiente
// apertura de «Hoy» con el estado ya leído, se ofrece UNA vez la oferta del
// paso 6 (`firma`), con sus mismas reglas (`ofrecerSi`): a quien ya paga o ya
// vio la firma, nada.
//
// Las funciones puras (`quedaPendiente`, `parsearPendiente`) tienen tests en
// `__tests__/ofertapendiente.test.ts`. Los efectos nunca lanzan.

import type AsyncStorageTipo from '@react-native-async-storage/async-storage';
import { DIA, type DecisionOferta } from './paywallmoment';

export const CLAVE_OFERTA_PENDIENTE = 'nivl.oferta_pendiente.v1';
/** Pasada una semana ya no es «la oferta del cuestionario»: se olvida. */
export const CADUCIDAD_PENDIENTE = 7 * DIA;

/**
 * Razones del paso 6 por las que la oferta no se enseñó sin que la cuenta lo
 * decidiera: lectura vencida (`tiempo`), sin estado (`sin_estado`) o un fallo
 * (`error`). Las demás (ya paga, topes, tienda cerrada…) son decisiones y se
 * respetan: no dejan nada pendiente.
 */
export const RAZONES_SIN_VER: readonly string[] = ['tiempo', 'sin_estado', 'error'];

export function quedaPendiente(d: DecisionOferta | null | undefined): boolean {
  return !!d && !d.mostrar && RAZONES_SIN_VER.includes(d.razon);
}

/** El instante apuntado, o null si no hay, está roto, es del futuro lejano o caducó. */
export function parsearPendiente(raw: string | null | undefined, ahora: number): number | null {
  if (!raw) return null;
  const at = Number(raw);
  if (!Number.isFinite(at) || at <= 0) return null;
  // Un reloj cambiado puede dejar el apunte «en el futuro»: hasta un día se acepta.
  if (at - ahora > DIA) return null;
  if (ahora - at > CADUCIDAD_PENDIENTE) return null;
  return at;
}

type Almacen = Pick<typeof AsyncStorageTipo, 'getItem' | 'setItem' | 'removeItem'>;
function almacen(): Almacen {
  // Carga perezosa, como en `pro.ts`: los tests que importan este módulo de
  // rebote no arrastran el módulo nativo.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const m = require('@react-native-async-storage/async-storage') as { default?: Almacen } & Almacen;
  return m.default ?? m;
}

export async function marcarOfertaPendiente(ahora = Date.now()): Promise<void> {
  try {
    await almacen().setItem(CLAVE_OFERTA_PENDIENTE, String(ahora));
  } catch {
    /* sin almacenamiento: no hay segunda oportunidad, nunca un fallo */
  }
}

/** ¿Hay una oferta del cuestionario sin enseñar? Si caducó, la borra. */
export async function hayOfertaPendiente(ahora = Date.now()): Promise<boolean> {
  try {
    const raw = await almacen().getItem(CLAVE_OFERTA_PENDIENTE);
    if (raw === null) return false;
    if (parsearPendiente(raw, ahora) !== null) return true;
    await almacen().removeItem(CLAVE_OFERTA_PENDIENTE);
    return false;
  } catch {
    return false;
  }
}

export async function olvidarOfertaPendiente(): Promise<void> {
  try {
    await almacen().removeItem(CLAVE_OFERTA_PENDIENTE);
  } catch {
    /* nada */
  }
}
