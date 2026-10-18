// NIVL · Analítica del recorrido (efectos). Contrato de Modos F1:
// `registrar(evento, props?)`, anónimo, contra `public.funnel_events` (0070).
//
// · Nunca bloquea la interfaz ni lanza: `registrar` devuelve al momento y
//   todo lo demás va en segundo plano, con los fallos tragados.
// · Anónimo: un `install_id` aleatorio en AsyncStorage (no es el uuid de la
//   cuenta ni sale del correo). El servidor añade el user_id si hay sesión.
// · Sin datos personales: las props pasan por la lista blanca de
//   `analiticamath.ts` (y otra vez por la del servidor).
// · Cola offline: lo registrado espera en AsyncStorage (200 como mucho) y se
//   manda cuando hay red y el flag `analitica_activa` está encendido. Con el
//   flag apagado NADA sale del móvil.
//
// Las aperturas (D1/D3/D7) las apunta `arrancarAnalitica()`, que se llama una
// vez desde `_layout.tsx` y vuelve a mirar cada vez que la app pasa a primer
// plano.

import type AsyncStorageTipo from '@react-native-async-storage/async-storage';
import { AppState, Platform } from 'react-native';
import {
  aperturaDeHoy,
  destinoTrasEnvio,
  encolar,
  esEvento,
  leerCola,
  leerInstalacion,
  limpiarProps,
  type EventoEmbudo,
  type EventoEnCola,
  type Instalacion,
} from './analiticamath';
import { dateKey } from './dates';
import { flagActivo } from './flagsServidor';
import { supabase } from './supabase';

export type { EventoEmbudo, OrigenMision, SalidaOnboarding } from './analiticamath';

// Carga perezosa, como en pro.ts: un import estático arrastraría el módulo
// nativo a todos los tests que importan data.ts o engine.ts de rebote. Si no
// está, cada llamada falla dentro de su try y la analítica calla.
type Almacen = Pick<typeof AsyncStorageTipo, 'getItem' | 'setItem' | 'removeItem' | 'multiRemove'>;
function almacen(): Almacen {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const m = require('@react-native-async-storage/async-storage') as { default?: Almacen } & Almacen;
  return m.default ?? m;
}
const AsyncStorage = {
  getItem: (k: string) => almacen().getItem(k),
  setItem: (k: string, v: string) => almacen().setItem(k, v),
  removeItem: (k: string) => almacen().removeItem(k),
  multiRemove: (k: readonly string[]) => almacen().multiRemove(k),
};

const K_COLA = 'nivl.analitica.cola.v1';
const K_INSTALACION = 'nivl.analitica.instalacion.v1';
const K_UNA_VEZ = 'nivl.analitica.unavez.v1';
/** Todo lo que la analítica guarda en el móvil (lo borra `olvidarAnalitica`). */
export const CLAVES_ANALITICA = [K_COLA, K_INSTALACION, K_UNA_VEZ];

export const FLAG_ANALITICA = 'analitica_activa';
/** Cuánto se espera tras registrar antes de mandar (agrupa ráfagas). */
const ESPERA_ENVIO_MS = 1500;
/** Eventos por vaciado: el resto, en el siguiente. */
const MAX_POR_ENVIO = 50;

// Las lecturas y escrituras de AsyncStorage van en fila: dos `registrar`
// seguidos no pueden leer la misma cola y pisarse.
let cadena: Promise<unknown> = Promise.resolve();
function enSerie<T>(fn: () => Promise<T>): Promise<T> {
  const p = cadena.then(fn, fn);
  cadena = p.catch(() => undefined);
  return p;
}

async function leerColaGuardada(): Promise<EventoEnCola[]> {
  return leerCola(await AsyncStorage.getItem(K_COLA));
}

async function guardarCola(cola: EventoEnCola[]): Promise<void> {
  if (cola.length === 0) await AsyncStorage.removeItem(K_COLA);
  else await AsyncStorage.setItem(K_COLA, JSON.stringify(cola));
}

async function encolarGuardado(items: EventoEnCola[]): Promise<void> {
  if (items.length === 0) return;
  let cola = await leerColaGuardada();
  for (const it of items) cola = encolar(cola, it);
  await guardarCola(cola);
}

let temporizador: ReturnType<typeof setTimeout> | null = null;
function programarEnvio(): void {
  if (temporizador) return;
  temporizador = setTimeout(() => {
    temporizador = null;
    void vaciarCola();
  }, ESPERA_ENVIO_MS);
}

/**
 * Apunta un evento del embudo. Devuelve al momento; nunca lanza. Las props
 * que no estén en la lista blanca del evento no salen del móvil.
 */
export function registrar(evento: EventoEmbudo, props?: Record<string, unknown>): void {
  try {
    if (!esEvento(evento)) return;
    const item: EventoEnCola = { evento, props: limpiarProps(evento, props), ts: new Date().toISOString() };
    enSerie(() => encolarGuardado([item]))
      .then(programarEnvio)
      .catch(() => undefined);
  } catch {
    // La analítica nunca rompe nada.
  }
}

/**
 * Como `registrar`, pero una sola vez por instalación (primera misión
 * creada, primera completada). La marca se pone aunque el flag esté apagado:
 * lo que importa es la PRIMERA vez, no la primera vez con el flag encendido.
 */
export function registrarUnaVez(evento: EventoEmbudo, props?: Record<string, unknown>): void {
  try {
    if (!esEvento(evento)) return;
    const ts = new Date().toISOString();
    enSerie(async () => {
      let hechos: string[] = [];
      try {
        const v: unknown = JSON.parse((await AsyncStorage.getItem(K_UNA_VEZ)) ?? '[]');
        if (Array.isArray(v)) hechos = v.filter((x): x is string => typeof x === 'string');
      } catch {
        hechos = [];
      }
      if (hechos.includes(evento)) return false;
      await AsyncStorage.setItem(K_UNA_VEZ, JSON.stringify([...hechos, evento]));
      await encolarGuardado([{ evento, props: limpiarProps(evento, props), ts }]);
      return true;
    })
      .then((nuevo) => {
        if (nuevo) programarEnvio();
      })
      .catch(() => undefined);
  } catch {
    // Nunca rompe nada.
  }
}

async function haySesionGuardada(): Promise<boolean> {
  try {
    const { data } = await supabase.auth.getSession();
    return !!data?.session;
  } catch {
    return false;
  }
}

/**
 * Mira si hoy toca apuntar la apertura (y, la primera vez, crea la
 * instalación). Si al estrenar la analítica ya había una sesión guardada, es
 * alguien que venía de una versión anterior: su primer arranque va con
 * `previo: true` y el panel no lo cuenta como instalación nueva.
 */
export async function marcarApertura(hoy: string = dateKey()): Promise<void> {
  try {
    const previo = await haySesionGuardada();
    const nuevos = await enSerie(async () => {
      const antes = leerInstalacion(await AsyncStorage.getItem(K_INSTALACION));
      const { instalacion, eventos } = aperturaDeHoy(antes, hoy);
      if (eventos.length === 0 && antes?.ultimoDia === instalacion.ultimoDia) return 0;
      await AsyncStorage.setItem(K_INSTALACION, JSON.stringify(instalacion));
      const ts = new Date().toISOString();
      await encolarGuardado(
        eventos.map((e) => ({
          evento: e.evento,
          props: e.evento === 'primer_arranque' ? limpiarProps('primer_arranque', { previo }) : e.props,
          ts,
        })),
      );
      return eventos.length;
    });
    if (nuevos > 0) programarEnvio();
  } catch {
    // Nunca rompe nada.
  }
}

/** La instalación guardada (null antes del primer arranque o tras borrar la cuenta). */
export async function leerInstalacionGuardada(): Promise<Instalacion | null> {
  try {
    return leerInstalacion(await AsyncStorage.getItem(K_INSTALACION));
  } catch {
    return null;
  }
}

function plataforma(): 'ios' | 'android' | 'web' | null {
  return Platform.OS === 'ios' || Platform.OS === 'android' || Platform.OS === 'web' ? Platform.OS : null;
}

function versionApp(): string | null {
  let v: unknown;
  try {
    // Perezoso por lo mismo que AsyncStorage: expo-constants toca módulos nativos al cargar.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const m = require('expo-constants') as { default?: { expoConfig?: { version?: unknown } | null } };
    v = m.default?.expoConfig?.version;
  } catch {
    return null;
  }
  return typeof v === 'string' && /^[0-9A-Za-z.+-]{1,24}$/.test(v) ? v : null;
}

let enviando = false;

/**
 * Manda lo que haya en la cola, en orden, hasta que falle la red. Sin el
 * flag encendido no manda nada (y la cola se queda, con su tope). Nunca lanza.
 */
export async function vaciarCola(): Promise<void> {
  if (enviando) return;
  enviando = true;
  try {
    if (!(await flagActivo(FLAG_ANALITICA))) return;
    const inst = await leerInstalacionGuardada();
    if (!inst) return;
    for (let i = 0; i < MAX_POR_ENVIO; i++) {
      const cola = await enSerie(leerColaGuardada);
      const primero = cola[0];
      if (!primero) break;
      let error: { code?: string | null } | null = null;
      try {
        const r = await supabase.rpc('registrar_evento', {
          p_install_id: inst.id,
          p_evento: primero.evento,
          p_props: primero.props,
          p_app_version: versionApp(),
          p_plataforma: plataforma(),
          p_ocurrido_en: primero.ts,
        });
        error = r.error ? { code: (r.error as { code?: string }).code ?? null } : null;
      } catch {
        error = { code: null };
      }
      if (destinoTrasEnvio(error) === 'reintentar') break;
      await enSerie(async () => {
        const actual = await leerColaGuardada();
        const i2 = actual.findIndex((x) => x.ts === primero.ts && x.evento === primero.evento);
        if (i2 >= 0) actual.splice(i2, 1);
        await guardarCola(actual);
      });
    }
  } catch {
    // Nunca rompe nada.
  } finally {
    enviando = false;
  }
}

/**
 * Se llama una vez al arrancar (`_layout.tsx`). Apunta la apertura de hoy y
 * vuelve a mirar cada vez que la app vuelve a primer plano (quien la deja
 * abierta de un día para otro también cuenta). Devuelve cómo soltarlo.
 */
export function arrancarAnalitica(): () => void {
  void marcarApertura().then(vaciarCola);
  try {
    const sub = AppState.addEventListener('change', (estado) => {
      if (estado === 'active') void marcarApertura().then(vaciarCola);
    });
    return () => sub.remove();
  } catch {
    return () => undefined;
  }
}

/**
 * Al borrar la cuenta: se olvida la instalación, la cola y las marcas. Lo
 * siguiente que se apunte será otra instalación, sin relación con la borrada
 * (en el servidor, el borrado ya se llevó sus filas: 0070).
 */
export async function olvidarAnalitica(): Promise<void> {
  try {
    if (temporizador) clearTimeout(temporizador);
    temporizador = null;
    await enSerie(() => AsyncStorage.multiRemove(CLAVES_ANALITICA));
  } catch {
    // Nunca rompe nada.
  }
}

/** Solo tests: espera a que acaben las escrituras pendientes y para el temporizador. */
export async function __esperarAnalitica(): Promise<void> {
  await cadena;
  if (temporizador) clearTimeout(temporizador);
  temporizador = null;
}
