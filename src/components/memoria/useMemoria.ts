// NIVL · Memoria: datos y efectos (patrón L-RADICAL §C, FASE3 G1). Cortado y
// pegado de la ruta sin reescribir: el dossier, los hechos anotados por el
// coach y el gasto del mes, con su carga al volver a la pantalla. El filtro
// por categoría y el dossier plegado son estado de la vista y viven aquí.
//
// La memoria se lee, no se borra: src/lib/coach.ts no tiene cómo borrar un
// hecho, y sin eso no hay botón de borrar (no se inventa en la vista).

import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { avisar } from '@/components/ui/confirmar';
import { volver } from '@/components/ui/Screen';
import { fetchDossier, fetchFacts, fetchMonthCost, type CoachFact } from '@/lib/coach';
import { mensajeSistema } from '@/lib/validation';
import { etiquetaCategoria, type MemoriaVistaProps } from './MemoriaVista';

export function useMemoria(): MemoriaVistaProps {
  const [dossier, setDossier] = useState<{ content: string; version: number } | null>(null);
  const [hechos, setHechos] = useState<CoachFact[]>([]);
  const [gasto, setGasto] = useState<number | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtro, setFiltro] = useState('todo');
  const [dossierAbierto, setDossierAbierto] = useState(false);

  const cargar = useCallback(async () => {
    try {
      setError(null);
      const [d, h, g] = await Promise.all([fetchDossier(), fetchFacts(200), fetchMonthCost()]);
      setDossier(d);
      setHechos(h);
      setGasto(g);
    } catch (e) {
      setError(mensajeSistema(e));
    } finally {
      setCargando(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar]),
  );

  return {
    cargando,
    error,
    dossier,
    hechos,
    gasto,
    filtro,
    dossierAbierto,
    acciones: {
      onVolver: () => volver(router),
      onFiltro: setFiltro,
      onAlternarDossier: () => setDossierAbierto((v) => !v),
      onAbrirHecho: (h) => avisar(`${etiquetaCategoria(h.category)} · ${h.date}`, h.content),
      onReintentar: () => {
        cargar();
      },
    },
  };
}
