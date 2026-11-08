// NIVL · Resistencia: el progreso (efectos). Entrenos, perfil y peso de un tirón;
// los récords aparte, porque necesitan la ruta entera y pesan: la curva no los
// espera y su fallo no la tumba.

import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { addDays, dateKey } from '@/lib/dates';
import { recordsPersonales, type Record_ } from '@/lib/entrenomath';
import { fetchWeights } from '@/lib/progress';
import { fetchEntrenos, fetchHistorialRecords, fetchPerfilEntreno, type EntrenoFila, type PerfilEntreno } from '@/lib/resistencia';
import { mensajeSistema } from '@/lib/validation';
import { datosProgreso, DIAS_CURVA, type PesoVista, type ProgresoVistaProps } from './ProgresoVista';

/** La curva de 42 días necesita historia previa para no arrancar de cero. */
const DIAS_CALENTAMIENTO = 150;
type Datos = { entrenos: EntrenoFila[]; perfil: PerfilEntreno | null; pesos: PesoVista[] };

export function useProgreso(): ProgresoVistaProps {
  const hoy = dateKey();
  const [estado, setEstado] = useState<ProgresoVistaProps['estado']>('cargando');
  const [error, setError] = useState<string | null>(null);
  const [datos, setDatos] = useState<Datos>({ entrenos: [], perfil: null, pesos: [] });
  const [records, setRecords] = useState<Record_[]>([]);
  const [recordsEstado, setRecordsEstado] = useState<ProgresoVistaProps['recordsEstado']>('cargando');
  const [refreshing, setRefreshing] = useState(false);
  const turno = useRef(0);

  const cargar = useCallback(async () => {
    const mio = ++turno.current;
    const dia = dateKey();
    const principal = (async () => {
      try {
        const [entrenos, perfil, pesos] = await Promise.all([
          fetchEntrenos(addDays(dia, -(DIAS_CURVA + DIAS_CALENTAMIENTO))),
          fetchPerfilEntreno(),
          fetchWeights(DIAS_CURVA),
        ]);
        if (mio !== turno.current) return;
        setDatos({ entrenos, perfil, pesos: pesos.map((w) => ({ fecha: w.date, kg: Number(w.weight_kg) })) });
        setError(null);
        setEstado('listo');
      } catch (e) {
        if (mio !== turno.current) return;
        setError(mensajeSistema(e));
        setEstado((previo) => (previo === 'listo' ? previo : 'error'));
      }
    })();
    const palmares = (async () => {
      try {
        const lista = await fetchHistorialRecords();
        if (mio !== turno.current) return;
        setRecords(recordsPersonales(lista));
        setRecordsEstado('listo');
      } catch {
        if (mio !== turno.current) return;
        setRecordsEstado('error');
      }
    })();
    await Promise.all([principal, palmares]);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void cargar();
      return () => {
        turno.current++;
      };
    }, [cargar]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void cargar().finally(() => setRefreshing(false));
  }, [cargar]);

  const onReintentar = useCallback(() => {
    setError(null);
    setEstado((previo) => (previo === 'listo' ? previo : 'cargando'));
    setRecordsEstado((previo) => (previo === 'listo' ? previo : 'cargando'));
    void cargar();
  }, [cargar]);

  const calculado = useMemo(
    () =>
      datosProgreso(
        datos.entrenos,
        { fc_max: datos.perfil?.fc_max ?? null, fc_reposo: datos.perfil?.fc_reposo ?? null, umbral: datos.perfil?.fc_umbral ?? null },
        datos.pesos,
        hoy,
      ),
    [datos, hoy],
  );

  return {
    ...calculado,
    estado,
    error,
    records,
    recordsEstado,
    refreshing,
    onRefresh,
    onReintentar,
    onVolver: () => (router.canGoBack() ? router.back() : router.replace('/resistencia' as Href)),
    // Registrar vive en el hub: una sola hoja, una sola puerta.
    onRegistrar: () => router.replace({ pathname: '/resistencia', params: { registrar: '1' } } as Href),
    onVerEntreno: (id: string) => router.push(`/resistencia/${id}` as Href),
  };
}
