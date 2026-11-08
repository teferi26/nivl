// NIVL · WORK: los efectos de la revisión semanal. Revisar no paga: solo pagarán,
// si se hacen, las misiones que salgan de aquí.

import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAlVolver, volver } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { dateKey } from '@/lib/dates';
import { mensajeSistema } from '@/lib/validation';
import { guardarRevision, leerMisionesSemana } from '@/work/datos';
import { crearPrioridadesDelDia } from '@/work/datosGestion';
import { sumarDias } from '@/work/fechas';
import type { MisionSemana } from '@/work/semana';
import { semanaARevisar } from '@/work/semana';
import type { ItemRevision, RazonQuedo } from '@/work/tipos';
import type { CargaVistaProps, RevisionVistaProps } from './RevisionVista';
import { useWorkDatos } from '../useWorkDatos';
import { claveRazon, construirRevision, pasoAnterior, pasoSiguiente, razonesDe, tresIniciales, vistaCarga, vistaRevision, type PasoRevision } from './vistas';

export function useRevision(): { revision: RevisionVistaProps; carga: CargaVistaProps } {
  const { session } = useAuth();
  const uid = session?.user.id ?? null;
  const w = useWorkDatos();
  const hoy = dateKey();
  const lunes = semanaARevisar(hoy);

  const [misiones, setMisiones] = useState<MisionSemana[] | null>(null);
  const [errorMisiones, setErrorMisiones] = useState<string | null>(null);
  const cargarMisiones = useCallback(async () => {
    setErrorMisiones(null);
    try {
      setMisiones(await leerMisionesSemana(lunes, sumarDias(lunes, 6)));
    } catch (e) {
      setErrorMisiones(mensajeSistema(e));
    }
  }, [lunes]);
  useEffect(() => {
    void cargarMisiones();
  }, [cargarMisiones]);
  useAlVolver(() => void w.recargar());

  const vista = useMemo(() => vistaRevision(w.datos, misiones ?? [], hoy), [w.datos, misiones, hoy]);
  const carga = useMemo(() => vistaCarga(w.datos, hoy), [w.datos, hoy]);

  const [paso, setPaso] = useState<PasoRevision>(1);
  const [repasando, setRepasando] = useState(false);
  const [razones, setRazones] = useState<Record<string, RazonQuedo>>({});
  // null: el usuario aún no ha tocado las tres; se derivan de lo calculado.
  const [tresEditadas, setTresEditadas] = useState<string[] | null>(null);
  const [terminada, setTerminada] = useState<{ creadas: number } | null>(null);
  const [guardando, setGuardando] = useState(false);
  const cerrojo = useRef(false);

  const haySeQuedo = vista.resumen.seQuedo.length > 0;
  const tres = tresEditadas ?? tresIniciales(vista, razones);

  const cerrar = () => {
    if (cerrojo.current || !uid) return;
    cerrojo.current = true;
    setGuardando(true);
    let creadas = 0;
    void w
      .hacer(async () => {
        // Primero las misiones: repetir no las duplica, y si falla no queda una
        // revisión guardada sin sus tres.
        creadas = await crearPrioridadesDelDia(uid, tres, vista.dia);
        await guardarRevision(construirRevision(vista.resumen, razones, tres, null));
      })
      .then((ok) => {
        if (ok) setTerminada({ creadas });
      })
      .finally(() => {
        cerrojo.current = false;
        setGuardando(false);
      });
  };

  const estadoComun = {
    disponible: w.disponible,
    onVolver: () => volver(router),
    onReintentar: () => {
      void w.recargar();
      void cargarMisiones();
    },
  };

  return {
    revision: {
      ...estadoComun,
      estado: w.estado === 'error' || errorMisiones ? 'error' : w.estado === 'cargando' || misiones === null ? 'cargando' : 'listo',
      error: w.error ?? errorMisiones,
      vista,
      carga,
      paso,
      razones,
      tres,
      guardando,
      terminada,
      yaHecha: !!vista.previa && !repasando,
      acciones: {
        onSiguiente: () => setPaso((p) => pasoSiguiente(p, haySeQuedo)),
        onAtras: () => setPaso((p) => pasoAnterior(p, haySeQuedo)),
        onRazon: (i: ItemRevision, r: RazonQuedo) =>
          setRazones((x) => {
            const k = claveRazon(i);
            const { [k]: previa, ...resto } = x;
            return previa === r ? resto : { ...x, [k]: r };
          }),
        onTres: (i, valor) => setTresEditadas(tres.map((v, n) => (n === i ? valor : v))),
        onCerrar: cerrar,
        onRepasar: () => {
          setRazones(razonesDe(vista.previa));
          setRepasando(true);
        },
      },
    },
    carga: { ...estadoComun, estado: w.estado, error: w.error, carga },
  };
}
