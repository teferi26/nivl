// NIVL · Modos: cada modo es un mundo propio (decisión de Teferi, 20/10,
// propuesta P01 «Rueda»). Un grupo de expo-router por modo con su barra
// inferior propia; NIVL (General) es `(tabs)`, la app de siempre.
//
//   (tabs)     NIVL     Hoy · Agenda · Coach · Hábitos · Campañas · Perfil
//   (iron)     IRON     Hoy · Entreno · Dieta · Coach   (gym + dieta; Pesos y Cardio dentro de Entreno)
//   (focus)    FOCUS    Hoy · Agenda · Diario · Coach
//   (work)     WORK     Hoy · Agenda · Diario · Coach
//   (founder)  FOUNDER  Hoy · Agenda · Economía · Coach
//
// Regla única: EL MODO ACTIVO DECIDE EL MUNDO. Cada layout de grupo mira el
// modo (ModoProvider) y, si no es el suyo, redirige al inicio del que toca
// (`destinoMundo`). El emblema cambia de mundo con `irAlMundo`: modo y
// navegación en un solo paso, y los layouts no redirigen mientras tanto.
// Con `modos_activos` apagado el modo es siempre General: los mundos no
// existen (sus layouts redirigen a `(tabs)`) y la app es la de siempre.
//
// Todo es puro (sin Supabase ni React Native, con test) salvo `irAlMundo`,
// que es el único efecto: cambia el modo y navega con `router.replace`.

import { router } from 'expo-router';
import type { ModoId } from './tipos';
import { esModo } from './tipos';

/** El nombre de cada destino de la barra de un mundo (clave `mundos:pestana.*`). */
export type PestanaMundo = 'hoy' | 'entreno' | 'dieta' | 'rutinas' | 'pesos' | 'agenda' | 'diario' | 'economia' | 'coach';

export interface Mundo {
  modo: ModoId;
  /** El grupo de expo-router (`src/app/(iron)`). */
  grupo: string;
  /** Las pestañas: nombre de la ruta (archivo) y su destino. La primera es el inicio. */
  pestanas: readonly { ruta: string; pestana: PestanaMundo }[];
}

/** Rutas de los mundos. Únicas en toda la app: un grupo no añade segmento a la URL. */
export const MUNDOS: Readonly<Record<ModoId, Mundo>> = {
  general: { modo: 'general', grupo: '(tabs)', pestanas: [] },
  iron: {
    modo: 'iron',
    grupo: '(iron)',
    pestanas: [
      { ruta: 'iron-hoy', pestana: 'hoy' },
      // La ruta de Entreno conserva su nombre (`iron-rutinas`): Rutinas, Pesos y Cardio.
      { ruta: 'iron-rutinas', pestana: 'entreno' },
      { ruta: 'iron-dieta', pestana: 'dieta' },
      { ruta: 'iron-coach', pestana: 'coach' },
    ],
  },
  focus: {
    modo: 'focus',
    grupo: '(focus)',
    pestanas: [
      { ruta: 'focus-hoy', pestana: 'hoy' },
      { ruta: 'focus-agenda', pestana: 'agenda' },
      { ruta: 'focus-diario', pestana: 'diario' },
      { ruta: 'focus-coach', pestana: 'coach' },
    ],
  },
  work: {
    modo: 'work',
    grupo: '(work)',
    pestanas: [
      { ruta: 'work-hoy', pestana: 'hoy' },
      { ruta: 'work-agenda', pestana: 'agenda' },
      { ruta: 'work-diario', pestana: 'diario' },
      { ruta: 'work-coach', pestana: 'coach' },
    ],
  },
  founder: {
    modo: 'founder',
    grupo: '(founder)',
    pestanas: [
      { ruta: 'founder-hoy', pestana: 'hoy' },
      { ruta: 'founder-agenda', pestana: 'agenda' },
      { ruta: 'founder-economia', pestana: 'economia' },
      { ruta: 'founder-coach', pestana: 'coach' },
    ],
  },
};

/** Las rutas de inicio, tal cual las acepta `router.replace` (rutas tipadas). */
export type RutaInicio = '/(tabs)' | '/iron-hoy' | '/focus-hoy' | '/work-hoy' | '/founder-hoy';

const INICIO: Readonly<Record<ModoId, RutaInicio>> = {
  general: '/(tabs)',
  iron: '/iron-hoy',
  focus: '/focus-hoy',
  work: '/work-hoy',
  founder: '/founder-hoy',
};

/** Lo primero que se ve de un modo. Un valor que no es modo: NIVL. */
export function rutaInicioDe(modo: ModoId | null | undefined): RutaInicio {
  return esModo(modo) ? INICIO[modo] : INICIO.general;
}

/** Las rutas del coach de cada mundo (el mismo chat; el modo va de contexto). */
export type RutaCoach = '/(tabs)/coach' | '/iron-coach' | '/focus-coach' | '/work-coach' | '/founder-coach';

const COACH: Readonly<Record<ModoId, RutaCoach>> = {
  general: '/(tabs)/coach',
  iron: '/iron-coach',
  focus: '/focus-coach',
  work: '/work-coach',
  founder: '/founder-coach',
};

/**
 * El coach del mundo en el que se está: desde una pantalla compartida (el
 * orden del día, Nutrición) «hablar con el coach» no saca del mundo.
 */
export function rutaCoachDe(modo: ModoId | null | undefined): RutaCoach {
  return esModo(modo) ? COACH[modo] : COACH.general;
}

/** El mundo de un grupo de expo-router (`useSegments()[0]`): `(iron)` → iron. Fuera de un mundo, null. */
export function mundoDeSegmento(segmento: string | null | undefined): ModoId | null {
  if (!segmento) return null;
  for (const m of Object.values(MUNDOS)) if (m.grupo === segmento) return m.modo;
  return null;
}

/** El mundo de una ruta de pestaña (`iron-dieta` → iron). Si no es de ningún mundo, null. */
export function mundoDeRuta(ruta: string | null | undefined): ModoId | null {
  if (!ruta) return null;
  for (const m of Object.values(MUNDOS)) if (m.pestanas.some((p) => p.ruta === ruta)) return m.modo;
  return null;
}

export interface EstadoModos {
  /** El interruptor `modos_activos`. */
  activo: boolean;
  /** Ya se sabe el modo de la cuenta (ModoProvider). */
  cargado: boolean;
  modo: ModoId;
  /**
   * El mundo al que se está yendo con `irAlMundo` (su `router.replace` ya va
   * en camino), o null. Mientras dura, ningún layout redirige por su cuenta:
   * ni el que se deja (sería una segunda navegación al mismo sitio) ni el que
   * llega (si aún viera el modo anterior, rebotaría al mundo de antes).
   */
  transito?: ModoId | null;
}

/**
 * Lo que decide el layout de un mundo (o de `(tabs)`, con `aqui = 'general'`):
 *   · 'esperar': aún no se sabe el modo (huecos, nada de redirigir);
 *   · null: este es el mundo que toca, se pinta;
 *   · una ruta: el mundo que toca es otro, se va a su inicio.
 * Con el interruptor apagado el único mundo es NIVL. `(tabs)` no espera: con
 * el modo aún sin leer pinta lo de siempre y, si al leerlo resulta ser otro
 * mundo, se va (es lo que pasa al arrancar con IRON activo).
 */
export function destinoMundo(estado: EstadoModos, aqui: ModoId): RutaInicio | 'esperar' | null {
  const destino = destinoSinTransito(estado, aqui);
  const hacia = estado.activo ? (estado.transito ?? null) : null;
  if (hacia === null || destino === null || destino === 'esperar') return destino;
  if (aqui === hacia) return aqui === 'general' ? null : 'esperar';
  if (destino === rutaInicioDe(hacia)) return null;
  return destino;
}

function destinoSinTransito(estado: EstadoModos, aqui: ModoId): RutaInicio | 'esperar' | null {
  const modo: ModoId = estado.activo ? estado.modo : 'general';
  if (aqui === 'general') {
    if (!estado.activo || !estado.cargado) return null;
    return modo === 'general' ? null : rutaInicioDe(modo);
  }
  if (!estado.activo) return rutaInicioDe('general');
  if (!estado.cargado) return 'esperar';
  return modo === aqui ? null : rutaInicioDe(modo);
}

/**
 * Al arrancar (`src/app/index.tsx`), tras el onboarding: el inicio del modo
 * activo. Sin interruptor o sin saber aún el modo, NIVL (y `(tabs)` llevará
 * al mundo en cuanto se lea, `destinoMundo`).
 */
export function rutaDeArranque(estado: EstadoModos): RutaInicio {
  if (!estado.activo || !estado.cargado) return rutaInicioDe('general');
  return rutaInicioDe(estado.modo);
}

/** Lo que puede durar un tránsito como mucho: si algo falla, los layouts vuelven a mandar. */
export const MS_TRANSITO = 1500;

let transito: { modo: ModoId; hasta: number } | null = null;

/** El mundo al que va `irAlMundo` ahora mismo (null si no hay tránsito o ya caducó). */
export function transitoMundo(ahora: number = Date.now()): ModoId | null {
  if (transito && ahora > transito.hasta) transito = null;
  return transito?.modo ?? null;
}

/** El layout del mundo de destino ya se pinta con su modo: se acaba el tránsito. */
export function llegadaAlMundo(modo: ModoId): void {
  if (transito?.modo === modo) transito = null;
}

/**
 * Entrar en el mundo de un modo, en UN solo paso: deja el modo activo (lo
 * guarda ModoProvider y lo recibe el coach en `x-nivl-modo`) y reemplaza la
 * pantalla por su inicio, sin dejar el mundo anterior en la pila. Mientras el
 * reemplazo va en camino, `transitoMundo()` lo dice y `destinoMundo` no deja
 * que los layouts redirijan por su cuenta (sin doble redirección ni rebote).
 * `cambiar` es el de `useModo()`: con el interruptor apagado no hace nada y
 * el layout del mundo devuelve a NIVL. Lo usa el emblema (EmblemaMundo).
 */
export function irAlMundo(modo: ModoId, cambiar: (m: ModoId) => void, ahora: number = Date.now()): void {
  transito = { modo, hasta: ahora + MS_TRANSITO };
  cambiar(modo);
  router.replace(rutaInicioDe(modo));
}
