// NIVL · Métricas y opiniones: datos. Lo que se pinta está en MetricasVista.

import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { cuentaEsAdmin, fetchMetricas, fetchOpiniones, type Metricas } from '@/lib/metricas';
import type { Opinion } from '@/lib/metricasAdmin';
import { mensajeSistema } from '@/lib/validation';

export type Pestana = 'metricas' | 'opiniones';

export interface MetricasVistaProps {
  loaded: boolean;
  /** null: todavía no se sabe. false: la cuenta no es admin. */
  admin: boolean | null;
  error: string | null;
  refreshing: boolean;
  pestana: Pestana;
  metricas: Metricas | null;
  opiniones: Opinion[];
  onRefresh: () => void;
  onPestana: (p: Pestana) => void;
}

export function useMetricas(): MetricasVistaProps {
  const [loaded, setLoaded] = useState(false);
  const [admin, setAdmin] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [pestana, setPestana] = useState<Pestana>('metricas');
  const [metricas, setMetricas] = useState<Metricas | null>(null);
  const [opiniones, setOpiniones] = useState<Opinion[]>([]);

  const load = useCallback(async () => {
    try {
      const es = await cuentaEsAdmin();
      setAdmin(es);
      if (!es) return;
      // Las opiniones son accesorias: si fallan, las métricas salen.
      const [m, o] = await Promise.all([fetchMetricas(), fetchOpiniones().catch(() => [])]);
      setMetricas(m);
      setOpiniones(o);
      setError(null);
    } catch (e) {
      setError(mensajeSistema(e));
    } finally {
      setLoaded(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void load().finally(() => setRefreshing(false));
  }, [load]);

  return { loaded, admin, error, refreshing, pestana, metricas, opiniones, onRefresh, onPestana: setPestana };
}
