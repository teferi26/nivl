// NIVL · Modos F1: los datos de los niveles por modo en Perfil (efectos).
//
// Lee `mode_xp` al entrar en Perfil y al volver a la pestaña. Solo con
// `modos_activos` encendido (si no, ni se monta). Un fallo no tumba Perfil:
// se enseñan los modos a cero y una línea con mensajeSistema.

import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { mensajeSistema } from '@/lib/validation';
import { leerXpModos } from '@/modos/datos';
import { nivelesDeModos, type NivelModo } from '@/modos/niveles';
import { useModo } from '@/modos/ModoProvider';
import type { ModoEtiqueta } from '@/modos/tipos';

const CERO: Record<ModoEtiqueta, number> = { iron: 0, focus: 0, work: 0, founder: 0 };

export function useNivelesModo(): {
  cargando: boolean;
  error: string | null;
  niveles: NivelModo[];
  activados: ModoEtiqueta[];
  guardar: (elegidos: readonly ModoEtiqueta[]) => Promise<void>;
} {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const { activo, activados, cargado, guardarActivados } = useModo();
  const [xp, setXp] = useState<Record<ModoEtiqueta, number> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!activo || !userId) return;
      let vivo = true;
      leerXpModos(userId)
        .then((x) => {
          if (!vivo) return;
          setXp(x);
          setError(null);
        })
        .catch((e) => {
          if (!vivo) return;
          setXp((prev) => prev ?? CERO);
          setError(mensajeSistema(e));
        });
      return () => {
        vivo = false;
      };
    }, [activo, userId]),
  );

  return {
    cargando: !cargado || xp === null,
    error,
    niveles: nivelesDeModos(activados, xp ?? CERO),
    activados,
    guardar: guardarActivados,
  };
}
