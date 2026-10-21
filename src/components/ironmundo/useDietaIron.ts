// NIVL · Mundo IRON: la pestaña Dieta (efectos). Sin lógica nueva: junta
//   · el parte del día y el objetivo: useNutricion (su pago por el recibo);
//   · las comidas del plan de hoy: useDieta (su hoja, generar y la compra);
//   · el peso corporal: useAvances (el mismo pesaje y su XP);
//   · el agua y la comida libre: useAguaLibre (0077, sin XP).
// El nivel de IRON de la cabecera: useMundo.

import { useAvances, type UseAvances } from '@/components/avances/useAvances';
import { useDieta } from '@/components/dieta/useDieta';
import type { HojaComidaProps } from '@/components/dieta/HojaComida';
import { useMundo, type UseMundo } from '@/components/modos/mundo/useMundo';
import { useNutricion } from '@/components/nutricion/useNutricion';
import { dateKey } from '@/lib/dates';
import { WEIGH_IN_XP } from '@/lib/game';
import type { DietaIronVistaProps } from './DietaIronVista';
import { useAguaLibre } from './useAguaLibre';
import { fechaIron } from './textos';

export interface UseDietaIron {
  mundo: UseMundo;
  hojaComida: HojaComidaProps;
  avances: UseAvances;
  vista: Omit<DietaIronVistaProps, 'cabecera' | 'overlay'>;
}

export function useDietaIron(): UseDietaIron {
  const mundo = useMundo('iron');
  const n = useNutricion();
  const dieta = useDieta();
  const avances = useAvances();
  const agua = useAguaLibre();
  const d = dieta.vista;
  const a = avances.vista;
  return {
    mundo,
    hojaComida: dieta.hoja,
    avances,
    vista: {
      fecha: fechaIron(dateKey()),
      parte: {
        cargado: n.cargado,
        errorCarga: n.errorCarga,
        objetivo: n.objetivo,
        hoyLog: n.hoyLog,
        kcal: n.kcal,
        prote: n.prote,
        notas: n.notas,
        guardando: n.guardando,
        xpDia: n.xpDia,
        acciones: {
          onKcal: n.acciones.onKcal,
          onProte: n.acciones.onProte,
          onNotas: n.acciones.onNotas,
          onGuardar: n.acciones.onGuardar,
          onCoach: n.acciones.onCoach,
          onReintentar: n.acciones.onReintentar,
        },
      },
      agua,
      comidas: {
        cargado: d.cargado,
        errorCarga: d.errorCarga,
        hoy: d.slots.filter((s) => s.day_of_week === d.hoy),
        generando: d.generando,
        acciones: {
          onComida: d.acciones.onComida,
          onGenerar: d.acciones.onGenerar,
          onCompra: d.acciones.onCompra,
          onReintentar: d.acciones.onReintentar,
        },
      },
      peso: {
        cargado: a.cargado,
        pesajes: a.weights,
        pesadoHoy: a.pesadoHoy,
        valor: a.peso,
        error: a.errorPeso,
        pesando: a.pesando,
        xpPesaje: WEIGH_IN_XP,
        onValor: a.acciones.onPeso,
        onPesar: a.acciones.onPesar,
      },
    },
  };
}
