// NIVL · Mundo IRON: el inicio (efectos). No hay lógica nueva: junta lo que
// ya existe.
//   · El entreno de hoy, la rutina, lo prescrito y la sesión en curso: useGym
//     (Gimnasio), el mismo hook con su cerrojo, su pago y su celebración.
//   · Tus pesos y récords: usePesos (iron/historialDatos + iron/pesos).
//   · La dieta de hoy: el objetivo y el parte de nutrición (lib/bodywork),
//     con el agua del parte (0077).
//   · El cierre del día y los avisos: useHoy, el mismo de NIVL. Quien vive en
//     IRON no abre Hoy de NIVL y sin esto no se cerrarían los días ni se
//     recolocarían los avisos; de él solo se pinta el informe del cierre.
//   · La cabecera: useMundo (nivel de IRON).

import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { useGym, type UseGym } from '@/components/gym/useGym';
import { useHoy } from '@/components/hoy/useHoy';
import { useMundo, type UseMundo } from '@/components/modos/mundo/useMundo';
import { fetchNutritionLog, fetchNutritionTarget } from '@/lib/bodywork';
import { dateKey } from '@/lib/dates';
import { GYM_SESSION_XP } from '@/lib/game';
import { ML_VASO, VASOS_OBJETIVO } from './calculos';
import type { AccionesInicioIron, EntradaEntrenoHoy, EstadoDietaHoy, InicioIronVistaProps } from './InicioIronVista';
import { fechaIron, palabraCoach } from './textos';
import { usePesos } from './usePesos';

function useDietaHoy(): EstadoDietaHoy {
  const [estado, setEstado] = useState<EstadoDietaHoy>({ estado: 'cargando' });
  const vigente = useRef(0);
  useFocusEffect(
    useCallback(() => {
      const turno = ++vigente.current;
      Promise.all([fetchNutritionTarget(), fetchNutritionLog(dateKey())])
        .then(([obj, log]) => {
          if (turno !== vigente.current) return;
          setEstado({
            estado: 'listo',
            kcal: log?.kcal_est ?? null,
            objetivoKcal: obj?.kcal ?? null,
            proteina: log?.protein_est ?? null,
            objetivoProteina: obj?.protein_g ?? null,
            aguaMl: log?.water_ml ?? 0,
            objetivoAguaMl: ML_VASO * VASOS_OBJETIVO,
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

export interface UseInicioIron {
  gym: UseGym;
  mundo: UseMundo;
  vista: Omit<InicioIronVistaProps, 'cabecera'>;
}

export function useInicioIron(): UseInicioIron {
  const gym = useGym();
  const { vista: hoy } = useHoy();
  const mundo = useMundo('iron');
  const pesos = usePesos();
  const dieta = useDietaHoy();
  const v = gym.vista;
  const entreno: EntradaEntrenoHoy = {
    cargado: v.cargado,
    errorCarga: v.errorCarga,
    hoyDia: v.hoyDia,
    dias: v.dias,
    ejercicios: v.ejercicios,
    prescrito: v.prescrito,
    xpHecho: v.sesionHoy ? v.sesionHoy.xp_awarded + v.xpMisionHoy : null,
    xpSesion: GYM_SESSION_XP,
    tecnicaDe: v.tecnicaDe,
    onEmpezar: v.acciones.onEntrenar,
    onReintentar: v.acciones.onReintentar,
  };
  const acciones: AccionesInicioIron = {
    onRutinas: () => router.navigate('/iron-rutinas'),
    onPesos: () => router.navigate({ pathname: '/iron-rutinas', params: { vista: 'pesos' } }),
    onCatalogo: () => router.push('/iron/catalogo'),
    onDieta: () => router.navigate('/iron-dieta'),
    onCoach: () => router.navigate('/iron-coach'),
  };
  return {
    gym,
    mundo,
    vista: {
      fecha: fechaIron(dateKey()),
      cierre: hoy.estado === 'listo' && hoy.datos.cierre ? { alerta: hoy.datos.cierre.alerta, lineas: hoy.datos.cierre.lineas } : null,
      entreno,
      pesos,
      dieta,
      coach: palabraCoach(entreno),
      acciones,
    },
  };
}
