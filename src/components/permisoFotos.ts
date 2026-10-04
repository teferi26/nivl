// NIVL · Permiso para las fotos de progreso (L5 · B1).
//
// Las fotos de progreso son dato de salud y solo para mayores de 18. Aquí se
// junta lo que dicen el servidor (confirmación 18+, `@/lib/age`) y el permiso
// de salud (`@/lib/health`) en las tres preguntas que hace la interfaz:
//   - ¿esta tarjeta lleva una foto que exige permiso? (`necesitaPermisoFotos`)
//   - ¿se pueden compartir fotos ahora mismo? (`leerPuedeCompartirFotos`)
//   - ¿qué se enseña en Avances y en /fotos? (`accesoFotos`, `usePermisoFotos`)
//
// Ante cualquier duda, no: un error de red al leer la edad o la salud cuenta
// como «no se puede compartir». Pero un error no es un «no»: la pantalla lo
// enseña como 'error' (reintentar) y nunca vuelve a preguntar la edad por un
// fallo de red. El control de verdad es del servidor (0050: RLS, bucket
// privado y trigger); esto solo decide qué ve la persona.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useHealthConsent } from '@/components/ConsentimientoSalud';
import { fetchMayorDeEdadConfirmada } from '@/lib/age';
import { fetchHealthConsent } from '@/lib/health';
import { permisosFotos, type PermisosFotos } from '@/lib/progressPhotos';
import type { Tarjeta } from '@/lib/sharecard';
import { mensajeSistema } from '@/lib/validation';

/** La tarjeta lleva (o puede llevar) una foto corporal: antes/después, o un recuerdo con foto. */
export function necesitaPermisoFotos(t: Tarjeta): boolean {
  if (t.tipo === 'antesDespues') return true;
  return t.tipo === 'recuerdo' && !!t.foto?.uri;
}

/** 18+ y salud leídos del servidor en paralelo. Sin confirmación no hay «menor»: es `null`. */
async function leerEntrada(): Promise<{ mayor18: true | null; salud: boolean }> {
  const [mayor, salud] = await Promise.all([fetchMayorDeEdadConfirmada(), fetchHealthConsent()]);
  return { mayor18: mayor === true ? true : null, salud: salud.accepted === true };
}

/**
 * ¿Se pueden compartir fotos de progreso ahora? Se lee en el momento (no se
 * guarda en ningún sitio). Si falla la lectura, LANZA: quien abre la hoja de
 * compartir distingue «no» de «no se sabe» (CelebracionProvider).
 */
export async function leerPermisoCompartirFotos(): Promise<boolean> {
  const { mayor18, salud } = await leerEntrada();
  // El consentimiento de IA no cuenta para compartir: va a false a propósito.
  return permisosFotos({ mayor18, consentimientoSalud: salud, consentimientoIA: false }).compartir;
}

/** Como `leerPermisoCompartirFotos`, pero ante un error, false. */
export async function leerPuedeCompartirFotos(): Promise<boolean> {
  try {
    return await leerPermisoCompartirFotos();
  } catch {
    return false;
  }
}

/** 'error': no se ha podido leer la salud o la confirmación 18+ (sin conexión). */
export type AccesoFotos = 'cargando' | 'error' | 'sin_salud' | 'confirmar_edad' | 'abierto';

/**
 * Qué enseñar. `salud`: null mientras se comprueba. `mayor18`: undefined
 * mientras se lee, true si está confirmado y null si no (nunca hay «menor»).
 * `errorSalud` y `errorEdad`: la lectura ha fallado; se enseña el error, no
 * el permiso de salud ni la pregunta de la edad.
 */
export function accesoFotos(e: {
  salud: boolean | null;
  mayor18: boolean | null | undefined;
  errorSalud?: boolean;
  errorEdad?: boolean;
}): AccesoFotos {
  if (e.salud === null) return 'cargando';
  if (e.errorSalud) return 'error';
  if (!e.salud) return 'sin_salud';
  if (e.errorEdad) return 'error';
  if (e.mayor18 === undefined) return 'cargando';
  return e.mayor18 === true ? 'abierto' : 'confirmar_edad';
}

export interface PermisoFotos {
  estado: AccesoFotos;
  permisos: PermisosFotos;
  /** No se ha podido leer la confirmación 18+ (la salud trae su propio error). */
  error: string | null;
  /** Vuelve a leer la confirmación 18+ (tras confirmarla o tras un error de gate). */
  recargar: () => Promise<void>;
  /** Con `estado === 'error'`: vuelve a leer la salud y la confirmación 18+. */
  reintentar: () => void;
}

/**
 * El estado de acceso de la pantalla. La salud llega del proveedor (que ya se
 * refresca solo); la confirmación 18+ se lee al montar, cada vez que cambia el
 * permiso de salud y al llamar a `recargar`.
 */
export function usePermisoFotos(): PermisoFotos {
  const health = useHealthConsent();
  const [mayor18, setMayor18] = useState<true | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const serie = useRef(0);
  const vivo = useRef(true);
  useEffect(() => {
    vivo.current = true;
    return () => {
      vivo.current = false;
    };
  }, []);

  const recargar = useCallback(async () => {
    const n = ++serie.current;
    try {
      const ok = await fetchMayorDeEdadConfirmada();
      if (!vivo.current || n !== serie.current) return;
      setMayor18(ok ? true : null);
      setError(null);
    } catch (e) {
      if (!vivo.current || n !== serie.current) return;
      // Sin poder leerlo NO se pregunta la edad: es un error, no un «no».
      setMayor18(undefined);
      setError(mensajeSistema(e));
    }
  }, []);

  const aceptada = health.accepted;
  const epoch = health.epoch;
  useEffect(() => {
    if (!aceptada) {
      serie.current++;
      setMayor18(undefined);
      setError(null);
      return;
    }
    void recargar();
  }, [aceptada, epoch, recargar]);

  const refrescarSalud = health.refresh;
  // Si la salud vuelve aceptada, el efecto de arriba ya relee la edad.
  const reintentar = useCallback(() => {
    void refrescarSalud();
    if (aceptada) void recargar();
  }, [refrescarSalud, aceptada, recargar]);

  const salud = health.loading ? null : health.accepted;
  const estado = accesoFotos({ salud, mayor18, errorSalud: !!health.error, errorEdad: error !== null });
  const permisos = permisosFotos({
    mayor18: mayor18 ?? null,
    consentimientoSalud: health.accepted,
    consentimientoIA: false,
  });
  return { estado, permisos, error, recargar, reintentar };
}
