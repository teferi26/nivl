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
// como «no se puede compartir». El control de verdad es del servidor (0050:
// RLS, bucket privado y trigger); esto solo decide qué ve la persona.

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
 * guarda en ningún sitio). Ante un error, false.
 */
export async function leerPuedeCompartirFotos(): Promise<boolean> {
  try {
    const { mayor18, salud } = await leerEntrada();
    // El consentimiento de IA no cuenta para compartir: va a false a propósito.
    return permisosFotos({ mayor18, consentimientoSalud: salud, consentimientoIA: false }).compartir;
  } catch {
    return false;
  }
}

export type AccesoFotos = 'cargando' | 'sin_salud' | 'confirmar_edad' | 'abierto';

/**
 * Qué enseñar. `salud`: null mientras se comprueba. `mayor18`: undefined
 * mientras se lee, true si está confirmado y null si no (nunca hay «menor»).
 */
export function accesoFotos(e: { salud: boolean | null; mayor18: boolean | null | undefined }): AccesoFotos {
  if (e.salud === null) return 'cargando';
  if (!e.salud) return 'sin_salud';
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
      // Sin poder leerlo, se pregunta: confirmar es idempotente en el servidor.
      setMayor18(null);
      setError(mensajeSistema(e));
    }
  }, []);

  const aceptada = health.accepted;
  const epoch = health.epoch;
  useEffect(() => {
    if (!aceptada) {
      serie.current++;
      setMayor18(undefined);
      return;
    }
    void recargar();
  }, [aceptada, epoch, recargar]);

  const salud = health.loading ? null : health.accepted;
  const estado = accesoFotos({ salud, mayor18 });
  const permisos = permisosFotos({
    mayor18: mayor18 ?? null,
    consentimientoSalud: health.accepted,
    consentimientoIA: false,
  });
  return { estado, permisos, error, recargar };
}
