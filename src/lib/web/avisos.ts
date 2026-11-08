// NIVL · Web: los avisos que en el móvil serían notificaciones.
//
// En el navegador no hay push ni avisos locales programados (expo-notifications
// no tiene web). Lo que sustituye a un aviso local (hoy, el fin de un bloque de
// FOCUS) pasa por aquí:
//   · SIEMPRE un aviso en pantalla (AvisosWeb, montado en el layout raíz), que
//     sigue ahí cuando vuelves a la pestaña;
//   · ADEMÁS una notificación del navegador si la pestaña está oculta y la
//     persona ya dio permiso. El permiso solo se pide tras un gesto suyo
//     (empezar un bloque), nunca al cargar.
// Nada sale del navegador: no hay servidor de push ni suscripción.
//
// Puro salvo por `globalThis` (document, Notification): sin React ni Supabase,
// para poder probarlo.

export interface AvisoWeb {
  id: number;
  titulo: string;
  cuerpo: string;
  /** Mismo valor = sustituye al anterior (como el id de un aviso local). */
  etiqueta: string;
}

type Oyente = (avisos: readonly AvisoWeb[]) => void;

/** Como mucho, los tres últimos: más no es un aviso, es ruido. */
export const MAX_AVISOS = 3;

let lista: AvisoWeb[] = [];
let siguiente = 1;
const oyentes = new Set<Oyente>();

function emitir(): void {
  const copia = [...lista];
  for (const o of oyentes) {
    try {
      o(copia);
    } catch {
      // Un oyente roto no impide que los demás se enteren.
    }
  }
}

/** Pone un aviso en pantalla. El de la misma etiqueta se sustituye. */
export function avisarEnPantalla(titulo: string, cuerpo: string, etiqueta = 'aviso'): AvisoWeb {
  const aviso: AvisoWeb = { id: siguiente++, titulo, cuerpo, etiqueta };
  lista = [...lista.filter((a) => a.etiqueta !== etiqueta), aviso].slice(-MAX_AVISOS);
  emitir();
  return aviso;
}

export function cerrarAviso(id: number): void {
  const antes = lista.length;
  lista = lista.filter((a) => a.id !== id);
  if (lista.length !== antes) emitir();
}

export function avisosActuales(): readonly AvisoWeb[] {
  return lista;
}

/** Se entera de cada cambio (y recibe el estado actual al suscribirse). */
export function suscribirAvisos(oyente: Oyente): () => void {
  oyentes.add(oyente);
  oyente([...lista]);
  return () => {
    oyentes.delete(oyente);
  };
}

/** Solo para las pruebas. */
export function _reiniciarAvisos(): void {
  lista = [];
  siguiente = 1;
  oyentes.clear();
}

// ── Notificación del navegador ──────────────────────────────────────

export type PermisoNavegador = 'granted' | 'denied' | 'default' | 'sin_soporte';

interface NotificacionGlobal {
  permission: 'granted' | 'denied' | 'default';
  requestPermission: () => Promise<'granted' | 'denied' | 'default'>;
  new (titulo: string, opciones?: { body?: string; tag?: string; icon?: string; silent?: boolean }): unknown;
}

function api(): NotificacionGlobal | null {
  const g = globalThis as { Notification?: NotificacionGlobal };
  return typeof g.Notification === 'function' ? g.Notification : null;
}

export function permisoNavegador(): PermisoNavegador {
  const N = api();
  return N ? N.permission : 'sin_soporte';
}

/**
 * Pide permiso de notificaciones si aún no se ha decidido. Llamar SOLO desde
 * un gesto de la persona (el navegador lo exige y, si no, lo da por denegado).
 * Nunca lanza.
 */
export async function pedirPermisoNavegador(): Promise<boolean> {
  const N = api();
  if (!N) return false;
  if (N.permission !== 'default') return N.permission === 'granted';
  try {
    return (await N.requestPermission()) === 'granted';
  } catch {
    return false;
  }
}

function pestanaOculta(): boolean {
  const d = (globalThis as { document?: { visibilityState?: string } }).document;
  return d?.visibilityState === 'hidden';
}

/**
 * El aviso completo: en pantalla siempre y, con la pestaña oculta y permiso,
 * también en el sistema. Devuelve si salió notificación del navegador.
 */
export function avisarWeb(titulo: string, cuerpo: string, etiqueta: string): boolean {
  avisarEnPantalla(titulo, cuerpo, etiqueta);
  const N = api();
  if (!N || N.permission !== 'granted' || !pestanaOculta()) return false;
  try {
    new N(titulo, { body: cuerpo, tag: etiqueta, icon: '/favicon.ico' });
    return true;
  } catch {
    // Safari antiguo o Android (exige service worker): basta el de pantalla.
    return false;
  }
}
