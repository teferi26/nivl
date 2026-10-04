// NIVL · Recuerdos: datos y efectos de la lista (patrón L-RADICAL §C, FASE3
// Lote F). Cortado y pegado de la ruta sin reescribir: cargar los pases,
// generar el de la semana tras el consentimiento de IA (el pase lo monta el
// coach: sin NIVL Pro el aviso lleva el camino a /pro, no un error) y abrir
// el recién hecho. Devuelve el pase abierto, las props de ResumenVista y la
// hoja del consentimiento.
//
// Cambio de presentación (no de lógica): un fallo al cargar ya no se traga
// en silencio; va en línea con «Reintentar».

import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState, type ReactNode } from 'react';
import { useConsentimientoIA } from '@/components/ConsentimientoIA';
import { volver } from '@/components/ui/Screen';
import { accessNotice, CoachAccessError, generarResumen } from '@/lib/coach';
import { fetchRecaps, type Recap } from '@/lib/photos';
import { mensajeSistema } from '@/lib/validation';
import type { ResumenVistaProps } from './ResumenVista';

export interface UseResumen {
  /** El pase abierto, o null si se ve la lista. */
  abierto: Recap | null;
  cerrar: () => void;
  vista: ResumenVistaProps;
  hoja: ReactNode;
}

export function useResumen(): UseResumen {
  const consentimiento = useConsentimientoIA();
  const [recaps, setRecaps] = useState<Recap[]>([]);
  const [abierto, setAbierto] = useState<Recap | null>(null);
  const [generando, setGenerando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  // El pase lo monta la IA: sin NIVL Pro el aviso lleva el camino, no un error.
  const [pidePro, setPidePro] = useState(false);
  const [cargado, setCargado] = useState(false);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [refrescando, setRefrescando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      setRecaps(await fetchRecaps());
      setErrorCarga(null);
    } catch (e) {
      setErrorCarga(mensajeSistema(e));
    } finally {
      setCargado(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar]),
  );

  const refrescar = async () => {
    setRefrescando(true);
    await cargar();
    setRefrescando(false);
  };

  const generar = async () => {
    if (generando) return;
    if (!(await consentimiento.asegurar())) return;
    setGenerando(true);
    setAviso(null);
    setPidePro(false);
    try {
      const r = await generarResumen('semanal');
      if (!r.slides.length) {
        setAviso(r.motivo ?? 'Sin fotos esta semana.');
        return;
      }
      await cargar();
      const nuevos = await fetchRecaps();
      setAbierto(nuevos[0] ?? null);
    } catch (e) {
      if (e instanceof CoachAccessError) {
        setPidePro(e.reason === 'sin_suscripcion');
        setAviso(
          e.reason === 'sin_suscripcion'
            ? 'El pase de la semana lo monta el coach, y el coach es parte de NIVL Pro. Tus fotos y tus recuerdos guardados siguen aquí.'
            : accessNotice(e),
        );
      } else {
        setAviso(mensajeSistema(e));
      }
    } finally {
      setGenerando(false);
    }
  };

  return {
    abierto,
    cerrar: () => setAbierto(null),
    vista: {
      cargado,
      errorCarga,
      recaps,
      generando,
      aviso,
      pidePro,
      refrescando,
      acciones: {
        onVolver: () => volver(router),
        onRefrescar: refrescar,
        onReintentar: () => {
          cargar();
        },
        onGenerar: generar,
        onVerPro: () => router.push('/pro'),
        onAbrir: setAbierto,
      },
    },
    hoja: consentimiento.hoja,
  };
}
