// NIVL · Mundo IRON: el inicio (efectos). No hay lógica nueva: junta lo que
// ya existe.
//   · El entreno de hoy, la rutina y la sesión en curso: useGym (Gimnasio),
//     el mismo hook con su cerrojo, su pago y su celebración.
//   · Tus pesos y récords: usePesosIron (iron/historialDatos + iron/pesos).
//   · La dieta de hoy: el objetivo y el parte de nutrición (lib/bodywork).
//   · El cierre del día y los avisos: useHoy, el mismo de NIVL. Quien vive en
//     IRON no abre Hoy de NIVL y sin esto no se cerrarían los días ni se
//     recolocarían los avisos; de él solo se pinta el informe del cierre.
//   · La cabecera: useMundo (nivel de IRON y volver a NIVL).

import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { useGym, type UseGym } from '@/components/gym/useGym';
import { useHoy } from '@/components/hoy/useHoy';
import { fetchNutritionLog, fetchNutritionTarget } from '@/lib/bodywork';
import { dateKey } from '@/lib/dates';
import type { CierreHoy } from '@/components/hoy/derivarHoy';
import { usePesosIron, type EstadoPesos } from './usePesosIron';
import { useMundo, type UseMundo } from './useMundo';

export type EstadoDieta =
  | { readonly estado: 'cargando' }
  | { readonly estado: 'error' }
  | {
      readonly estado: 'listo';
      readonly objetivo: { kcal: number; proteina: number } | null;
      readonly parte: { kcal: number | null; proteina: number | null } | null;
    };

export interface AccionesIronHoy {
  onRutinas: () => void;
  onPesos: () => void;
  onCatalogo: () => void;
  onDieta: () => void;
  onNutricion: () => void;
  onCoach: () => void;
}

export interface UseIronHoy {
  gym: UseGym;
  mundo: UseMundo;
  fecha: string | null;
  cierre: CierreHoy | null;
  pesos: EstadoPesos;
  dieta: EstadoDieta;
  acciones: AccionesIronHoy;
}

function useDietaHoy(): EstadoDieta {
  const [estado, setEstado] = useState<EstadoDieta>({ estado: 'cargando' });
  const vigente = useRef(0);
  useFocusEffect(
    useCallback(() => {
      const turno = ++vigente.current;
      Promise.all([fetchNutritionTarget(), fetchNutritionLog(dateKey())])
        .then(([obj, log]) => {
          if (turno !== vigente.current) return;
          setEstado({
            estado: 'listo',
            objetivo: obj ? { kcal: obj.kcal, proteina: obj.protein_g } : null,
            parte: log ? { kcal: log.kcal_est, proteina: log.protein_est } : null,
          });
        })
        .catch(() => {
          if (turno !== vigente.current) return;
          // Accesorio: sin dieta, la tarjeta solo ofrece abrirla.
          setEstado({ estado: 'error' });
        });
      return () => {
        vigente.current++;
      };
    }, []),
  );
  return estado;
}

export function useIronHoy(): UseIronHoy {
  const gym = useGym();
  const { vista: hoy } = useHoy();
  const mundo = useMundo('iron');
  const pesos = usePesosIron();
  const dieta = useDietaHoy();
  return {
    gym,
    mundo,
    fecha: hoy.estado === 'listo' ? hoy.datos.fecha : null,
    cierre: hoy.estado === 'listo' ? hoy.datos.cierre : null,
    pesos,
    dieta,
    acciones: {
      onRutinas: () => router.navigate('/iron-rutinas'),
      onPesos: () => router.navigate('/iron-pesos'),
      onCatalogo: () => router.push('/iron/catalogo'),
      onDieta: () => router.push('/dieta'),
      onNutricion: () => router.push('/nutricion'),
      onCoach: () => router.navigate('/iron-coach'),
    },
  };
}
