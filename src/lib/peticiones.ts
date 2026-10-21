// NIVL · Valoración de la tienda y opinión interna (efectos). La decisión es
// pura (`peticionesmath.ts`); aquí se leen flags, estado y día de uso, se
// llama al diálogo nativo y se guarda la opinión. docs/modos/F1-analitica.md.
//
// VALORACIÓN NATIVA: la build publicada (1.0.9/1.0.10) NO lleva
// `expo-store-review`. Este módulo pregunta por el módulo nativo
// `ExpoStoreReview` con `requireOptionalNativeModule`: sin él (hoy) la
// valoración no está disponible y nunca se pide. Para encenderla hace falta
// una build nueva con `npx expo install expo-store-review` (pasa por la
// revisión de Apple) y después el flag `valoracion_activa`. La opinión
// interna, en cambio, es solo JS: puede salir por OTA (flag `opinion_activa`).

import { requireOptionalNativeModule } from 'expo';
import type AsyncStorageTipo from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { diasEntre } from './analiticamath';
import { dateKey } from './dates';
import { flagActivo } from './flagsServidor';
import { decidirPeticion, leerEstado, limpiarOpinion, type MomentoPositivo, type Peticion } from './peticionesmath';
import { supabase } from './supabase';

// 1.0.11: las claves de esta versión (la 1.0.10 lee `valoracion_activa` y
// `opinion_activa`, apagadas para siempre).
export const FLAG_VALORACION = 'valoracion_1011';
export const FLAG_OPINION = 'opinion_1011';
const K_ESTADO = 'nivl.peticiones.v1';

/** La interfaz del diálogo nativo. Hoy la cumple el módulo de expo-store-review si está enlazado. */
export interface ValoracionNativa {
  disponible(): Promise<boolean>;
  pedir(): Promise<void>;
}

interface ModuloStoreReview {
  isAvailableAsync?: () => Promise<boolean>;
  requestReview?: () => Promise<void>;
}

/** El de verdad: el módulo nativo de expo-store-review, si la build lo trae. */
export const valoracionDeTienda: ValoracionNativa = {
  async disponible() {
    if (Platform.OS !== 'ios' && Platform.OS !== 'android') return false;
    try {
      const m = requireOptionalNativeModule<ModuloStoreReview>('ExpoStoreReview');
      if (!m?.isAvailableAsync || !m.requestReview) return false;
      return await m.isAvailableAsync();
    } catch {
      return false;
    }
  },
  async pedir() {
    try {
      await requireOptionalNativeModule<ModuloStoreReview>('ExpoStoreReview')?.requestReview?.();
    } catch {
      // El sistema decide si la enseña; un fallo no es asunto de nadie.
    }
  },
};

type Almacen = Pick<typeof AsyncStorageTipo, 'getItem' | 'setItem'>;
function almacen(): Almacen {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const m = require('@react-native-async-storage/async-storage') as { default?: Almacen } & Almacen;
  return m.default ?? m;
}

let decidiendo = false;

/**
 * Tras un momento bueno: ¿toca valoración, opinión o nada? Lee los flags (un
 * fallo = apagado), el día de uso y lo ya pedido, y deja marcado lo que
 * decide. No enseña nada: quien llama lo hace cuando no haya una
 * celebración en pantalla. Nunca lanza.
 */
export async function alMomentoPositivo(
  _momento: MomentoPositivo,
  nativa: ValoracionNativa = valoracionDeTienda,
  ahora: number = Date.now(),
): Promise<Peticion | null> {
  if (decidiendo) return null;
  decidiendo = true;
  try {
    const [valoracionActiva, opinionActiva] = await Promise.all([flagActivo(FLAG_VALORACION), flagActivo(FLAG_OPINION)]);
    if (!valoracionActiva && !opinionActiva) return null;
    const hoy = dateKey(new Date(ahora));
    const guardado = leerEstado(await almacen().getItem(K_ESTADO));
    // El primer momento bueno marca el día 0 de esta pieza.
    const estado = guardado.primerDia ? guardado : { ...guardado, primerDia: hoy };
    const diaDeUso = diasEntre(estado.primerDia!, hoy);
    const valoracionDisponible = valoracionActiva ? await nativa.disponible() : false;
    const d = decidirPeticion(estado, { diaDeUso, valoracionActiva, opinionActiva, valoracionDisponible, ahora });
    if (d.peticion || !guardado.primerDia) await almacen().setItem(K_ESTADO, JSON.stringify(d.estado));
    return d.peticion;
  } catch {
    return null;
  } finally {
    decidiendo = false;
  }
}

/** Pide la valoración nativa. El sistema decide si la enseña (y cuántas veces al año). */
export function pedirValoracion(nativa: ValoracionNativa = valoracionDeTienda): Promise<void> {
  return nativa.pedir();
}

function versionApp(): string | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const m = require('expo-constants') as { default?: { expoConfig?: { version?: unknown } | null } };
    const v = m.default?.expoConfig?.version;
    return typeof v === 'string' && /^[0-9A-Za-z.+-]{1,24}$/.test(v) ? v : null;
  } catch {
    return null;
  }
}

/**
 * Guarda la opinión en `app_feedback` (0071). Solo el texto que la persona
 * ha escrito y la versión de la app; el servidor pone el user_id. Lanza si
 * no se pudo guardar (la hoja lo dice con `mensajeSistema`).
 */
export async function enviarOpinion(gusta: string, cambiaria: string): Promise<void> {
  const limpia = limpiarOpinion(gusta, cambiaria);
  if (!limpia) return;
  const { error } = await supabase.from('app_feedback').insert({ ...limpia, version: versionApp() });
  if (error) throw error;
}

/** Solo tests. */
export function __reiniciarPeticiones(): void {
  decidiendo = false;
}
