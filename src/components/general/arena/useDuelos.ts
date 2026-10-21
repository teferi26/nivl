// NIVL · General · Arena: los duelos de la semana (efectos). La misma carga y
// la misma respuesta que <Competicion> (src/components/amigos), sin ligas
// (LIGAS_VISIBLES sigue apagado): solo misDuelos, responderDuelo y el reparto
// puro de competicionVista. Retar va por la RetarSheet de siempre.

import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { duelosConRivalEnTablero, repartirDuelos, type DuelosVista } from '@/components/amigos/competicionVista';
import type { Amigo } from '@/components/amigos/Competicion';
import { vibrar } from '@/design/haptics';
import { esFaltaDeServidor, misDuelos, responderDuelo, type Duelo } from '@/lib/competicionData';
import { dateKey } from '@/lib/dates';
import { marcarDuelosVistos, reprogramarAvisosDelPlan } from '@/lib/notifications';
import { mensajeSistema } from '@/lib/validation';

export type DuelosReparto = DuelosVista<Duelo>;

export interface DatosDuelos {
  disponible: boolean;
  listo: boolean;
  fallo: string | null;
  hoy: string;
  vista: DuelosReparto;
  ocupado: string | null;
  responder: (d: Duelo, aceptar: boolean) => void;
  recargar: () => void;
}

export function useDuelos(tablero: readonly Amigo[] | null, recarga: number): DatosDuelos {
  const [disponible, setDisponible] = useState(true);
  const [cargado, setCargado] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);
  const [duelos, setDuelos] = useState<Duelo[]>([]);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const lock = useRef(false);

  const cargar = useCallback(async () => {
    try {
      const d = await misDuelos();
      setDuelos(d);
      void marcarDuelosVistos(d);
      setFallo(null);
      setDisponible(true);
    } catch (e) {
      if (esFaltaDeServidor(e)) setDisponible(false);
      else setFallo(mensajeSistema(e));
    } finally {
      setCargado(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void cargar();
    }, [cargar]),
  );
  const primera = useRef(true);
  useEffect(() => {
    if (primera.current) {
      primera.current = false;
      return;
    }
    void cargar();
  }, [recarga, cargar]);

  const hoy = dateKey();
  const vista = useMemo(() => repartirDuelos(tablero ? duelosConRivalEnTablero(duelos, tablero) : [], hoy), [duelos, tablero, hoy]);

  const responder = (d: Duelo, aceptar: boolean) => {
    if (lock.current) return;
    lock.current = true;
    setOcupado(d.id);
    void (async () => {
      try {
        await responderDuelo(d.id, aceptar);
        if (aceptar) vibrar('mision');
        await cargar();
        if (aceptar) reprogramarAvisosDelPlan();
      } catch (e) {
        vibrar('penalizacion');
        setFallo(mensajeSistema(e));
      } finally {
        lock.current = false;
        setOcupado(null);
      }
    })();
  };

  return { disponible, listo: cargado && tablero !== null, fallo, hoy, vista, ocupado, responder, recargar: () => void cargar() };
}
