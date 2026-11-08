// NIVL · Gafas Meta: la fachada.
//
// Sin el módulo enlazado (el caso normal: producción, Expo Go, tests) cada
// función es un no-op seguro. Un fallo del nativo tampoco sube: las gafas son
// un accesorio y no pueden tumbar una sesión de gimnasio.

import { requireOptionalNativeModule } from 'expo';

import { acotarTarjeta, LIMITES, recortar } from './tarjetas';
import { ESTADOS_GAFAS } from './tipos';
import type { EstadoGafas, EventoGafas, EventosGafas, Tarjeta } from './tipos';

export * from './tipos';
export * from './tarjetas';
export * from './voz';

interface SuscripcionNativa {
  remove(): void;
}

interface NivlMetaNativo {
  estado?(): EstadoGafas | Promise<EstadoGafas>;
  registrar?(): unknown;
  mostrar?(tarjeta: Tarjeta): unknown;
  hablarTexto?(texto: string): unknown;
  cerrar?(): unknown;
  addListener?<E extends EventoGafas>(
    evento: E,
    cb: (datos: EventosGafas[E]) => void,
  ): SuscripcionNativa;
}

const nativo = requireOptionalNativeModule<NivlMetaNativo>('NivlMeta');

async function intentar(accion: () => unknown): Promise<boolean> {
  try {
    await accion();
    return true;
  } catch {
    return false;
  }
}

/** ¿Está enlazado el módulo nativo? No dice si hay gafas: eso es estado(). */
export function disponible(): boolean {
  return nativo !== null;
}

export async function estado(): Promise<EstadoGafas> {
  if (!nativo?.estado) return 'no_disponible';
  try {
    const valor = await nativo.estado();
    return ESTADOS_GAFAS.includes(valor) ? valor : 'no_disponible';
  } catch {
    return 'no_disponible';
  }
}

/** Abre el registro en Meta AI. true si el nativo lo aceptó. */
export async function registrar(): Promise<boolean> {
  if (!nativo?.registrar) return false;
  return intentar(() => nativo.registrar?.());
}

export async function mostrar(tarjeta: Tarjeta): Promise<boolean> {
  if (!nativo?.mostrar) return false;
  return intentar(() => nativo.mostrar?.(acotarTarjeta(tarjeta)));
}

/** Solo existe si el nativo la trae: se llama con `hablarTexto?.(texto)`. */
export const hablarTexto: ((texto: string) => Promise<boolean>) | undefined = nativo?.hablarTexto
  ? async (texto: string) => {
      const frase = recortar(texto, LIMITES.hablado, '');
      if (!frase) return false;
      return intentar(() => nativo.hablarTexto?.(frase));
    }
  : undefined;

export async function cerrar(): Promise<boolean> {
  if (!nativo?.cerrar) return false;
  return intentar(() => nativo.cerrar?.());
}

/** Devuelve con qué darse de baja. Sin nativo, esa baja no hace nada. */
export function suscribir<E extends EventoGafas>(
  evento: E,
  cb: (datos: EventosGafas[E]) => void,
): () => void {
  if (!nativo?.addListener) return () => {};
  try {
    const suscripcion = nativo.addListener(evento, cb);
    return () => {
      try {
        suscripcion.remove();
      } catch {
        // Ya no había a quién avisar.
      }
    };
  } catch {
    return () => {};
  }
}
