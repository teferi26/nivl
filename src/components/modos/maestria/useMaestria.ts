// NIVL · Modos: la maestría de un modo (efectos). Marca MK I a V y progreso.
//
// Lee la XP del modo con la MISMA lectura que los niveles de Perfil
// (`leerXpModos`, tabla `mode_xp` de la 0068) al enfocar la pantalla, y la
// convierte en marca con src/modos/maestria.ts. No escribe nada en el
// servidor: la maestría es una lectura, no economía.
//
// Subida de marca, una sola vez: por cuenta y modo se guarda en AsyncStorage
// la última marca enseñada (maestriaDatos.ts). La primera lectura en este
// teléfono es la base (no celebra lo que no se vio ganar). Si la marca leída
// supera la vista, `subida` trae la nueva y la vista se guarda EN ESE MOMENTO
// (si la app se cierra durante el momento, no vuelve a salir). La pantalla
// pinta <SubidaMarca marca={subida} … onFin={cerrarSubida} />.
//
// Con `modos_activos` apagado (o sin sesión) no lee nada: MK I a cero.
//
// Varias pantallas leen la marca (el marco del emblema de cada cabecera), pero
// la subida la vigila UNA sola instancia (el layout del mundo, con
// <SubidaMarca>): las demás pasan `{ subidas: false }` y no tocan la marca
// vista. `relectura` vuelve a leer al cambiar (p. ej. la pestaña del mundo).

import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { fijarMarcaCoach } from '@/lib/coach';
import { mensajeSistema } from '@/lib/validation';
import { leerXpModos } from '@/modos/datos';
import { progresoMarca, subidaDeMarca, type Marca, type ProgresoMarca } from '@/modos/maestria';
import { guardarMarcaVista, leerMarcaVista } from '@/modos/maestriaDatos';
import { useModo } from '@/modos/ModoProvider';
import type { ModoEtiqueta } from '@/modos/tipos';

export interface Maestria {
  /** Hasta la primera lectura (o con el interruptor apagado, false y a cero). */
  cargando: boolean;
  /** Fallo de la lectura, ya escrito para el usuario. La marca queda en la última buena. */
  error: string | null;
  marca: Marca;
  progreso: ProgresoMarca;
  /** La marca recién alcanzada, para <SubidaMarca>; null si no hay nada que enseñar. */
  subida: Marca | null;
  /** Llamar al terminar <SubidaMarca> (onFin). */
  cerrarSubida: () => void;
}

export interface OpcionesMaestria {
  /** Vigila y celebra la subida de marca (por defecto true). Solo una instancia por mundo. */
  subidas?: boolean;
  /** Cambiarla vuelve a leer la XP (además de al enfocar). */
  relectura?: string;
}

export function useMaestria(modo: ModoEtiqueta, { subidas = true, relectura }: OpcionesMaestria = {}): Maestria {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const { activo } = useModo();
  const [xp, setXp] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [subida, setSubida] = useState<Marca | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!activo || !userId) return;
      let vivo = true;
      (async () => {
        try {
          const todos = await leerXpModos(userId);
          if (!vivo) return;
          const leida = todos[modo] ?? 0;
          const { marca } = progresoMarca(leida);
          setXp(leida);
          setError(null);
          fijarMarcaCoach(modo, marca);
          if (!subidas) return;
          const vista = await leerMarcaVista(userId, modo);
          if (!vivo) return;
          const nueva = subidaDeMarca(vista, marca);
          if (vista === null || nueva !== null) await guardarMarcaVista(userId, modo, marca);
          if (vivo && nueva !== null) setSubida(nueva);
        } catch (e) {
          if (!vivo) return;
          setXp((prev) => prev ?? 0);
          setError(mensajeSistema(e));
        }
      })();
      return () => {
        vivo = false;
      };
      // `relectura` no se usa dentro: solo vuelve a disparar la lectura.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activo, userId, modo, subidas, relectura]),
  );

  const cerrarSubida = useCallback(() => setSubida(null), []);
  const progreso = progresoMarca(xp ?? 0);

  return {
    cargando: activo && !!userId && xp === null,
    error,
    marca: progreso.marca,
    progreso,
    subida,
    cerrarSubida,
  };
}
