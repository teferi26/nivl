// NIVL · Mundo IRON: el agua y la comida libre del día (efectos, 0077). Van en
// el parte del día (`nutrition_logs`) del día en la zona del perfil, el mismo
// que usa Nutrición, y se guardan solos al tocar. No pagan XP. Con la
// migración 0077 sin aplicar, guardar falla y la tarjeta lo dice en línea.

import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { vibrar } from '@/design/haptics';
import { useAuth } from '@/lib/auth';
import { fetchNutritionLog, saveAguaLibre } from '@/lib/bodywork';
import { ensureProfile } from '@/lib/data';
import { dateKeyEnZona } from '@/lib/dates';
import { mensajeSistema } from '@/lib/validation';
import { ML_VASO, mlAlTocarVaso, VASOS_OBJETIVO } from './calculos';

export interface EstadoAguaLibre {
  cargado: boolean;
  ml: number;
  objetivoMl: number;
  libre: boolean;
  guardando: boolean;
  error: string | null;
  onVaso: (i: number) => void;
  onMas: () => void;
  onLibre: () => void;
}

export function useAguaLibre(): EstadoAguaLibre {
  const { session } = useAuth();
  const userId = session?.user.id;
  const [cargado, setCargado] = useState(false);
  const [ml, setMl] = useState(0);
  const [libre, setLibre] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dia = useRef<string | null>(null);
  const cola = useRef<Promise<unknown>>(Promise.resolve());

  useFocusEffect(
    useCallback(() => {
      let vivo = true;
      (async () => {
        try {
          const perfil = userId ? await ensureProfile(userId).catch(() => null) : null;
          const hoy = dateKeyEnZona(perfil?.timezone);
          dia.current = hoy;
          const log = await fetchNutritionLog(hoy);
          if (!vivo) return;
          setMl(log?.water_ml ?? 0);
          setLibre(log?.free_meal ?? false);
          setError(null);
        } catch (e) {
          if (vivo) setError(mensajeSistema(e));
        } finally {
          if (vivo) setCargado(true);
        }
      })();
      return () => {
        vivo = false;
      };
    }, [userId]),
  );

  /** Guarda en orden (un toque tras otro no se pisan) y deshace si falla. */
  const guardar = (cambio: { water_ml?: number; free_meal?: boolean }, deshacer: () => void) => {
    if (!userId || !dia.current) return;
    const hoy = dia.current;
    setGuardando(true);
    setError(null);
    cola.current = cola.current
      .then(() => saveAguaLibre(userId, hoy, cambio))
      .catch((e: unknown) => {
        deshacer();
        setError(mensajeSistema(e));
      })
      .finally(() => setGuardando(false));
  };

  const fijarMl = (nuevo: number) => {
    const antes = ml;
    if (nuevo === antes) return;
    vibrar('seleccion');
    setMl(nuevo);
    guardar({ water_ml: nuevo }, () => setMl(antes));
  };

  return {
    cargado,
    ml,
    objetivoMl: ML_VASO * VASOS_OBJETIVO,
    libre,
    guardando,
    error,
    onVaso: (i) => fijarMl(mlAlTocarVaso(ml, i)),
    onMas: () => fijarMl(Math.min(10000, ml + ML_VASO)),
    onLibre: () => {
      const antes = libre;
      vibrar('seleccion');
      setLibre(!antes);
      guardar({ free_meal: !antes }, () => setLibre(antes));
    },
  };
}
