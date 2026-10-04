// Demo de la galería /kit/pantallas (solo desarrollo). FASE3 Oleada 2, lote E2.
//
// NutricionVista con datos de mentira: sin sesión ni Supabase. Las acciones no
// hacen nada.
import type { DemoPantalla } from '@/components/arena/galeria';
import { HOY_DEMO } from '@/components/arena/demoDatos';
import { addDays } from '@/lib/dates';
import type { NutritionLog, NutritionTarget } from '@/lib/bodywork';
import { NutricionVista, type NutricionVistaProps } from './NutricionVista';

const nada = () => {};

const OBJETIVO: NutritionTarget = {
  id: 'obj',
  from_date: addDays(HOY_DEMO, -20),
  kcal: 2350,
  protein_g: 150,
  carbs_g: 260,
  fat_g: 75,
  rationale:
    'Mantenimiento estimado de 2.700 kcal con cuatro días de fuerza: 350 por debajo y 2 g de proteína por kilo. Se revisa cada dos semanas con tu peso.',
};

/** 28 días con una adherencia creíble (en kcal falla más que en proteína). */
const HISTORIAL: NutritionLog[] = Array.from({ length: 22 }, (_, i) => ({
  id: `n${i}`,
  date: addDays(HOY_DEMO, -(i + 1)),
  hit_kcal: i % 4 !== 1,
  hit_protein: i % 7 !== 3,
  kcal_est: null,
  protein_est: null,
  notes: null,
}));

const PAGADO: NutritionLog = {
  id: 'hoy',
  date: HOY_DEMO,
  hit_kcal: true,
  hit_protein: true,
  kcal_est: 2280,
  protein_est: 154,
  notes: 'Cena fuera, pero dentro.',
};

function base(cambios: Partial<NutricionVistaProps> = {}): NutricionVistaProps {
  return {
    cargado: true,
    errorCarga: null,
    objetivo: OBJETIVO,
    hoyLog: null,
    historial: HISTORIAL,
    kcal: false,
    prote: false,
    notas: '',
    guardando: false,
    xpDia: 10,
    acciones: {
      onVolver: nada,
      onKcal: nada,
      onProte: nada,
      onNotas: nada,
      onGuardar: nada,
      onCoach: nada,
      onReintentar: nada,
    },
    ...cambios,
  };
}

export const DEMO: DemoPantalla | null = {
  id: 'nutricion',
  titulo: 'Nutrición',
  marco: 'pila',
  estados: [
    { id: 'parte-vacio', titulo: 'Parte sin marcar', render: () => <NutricionVista {...base()} /> },
    {
      id: 'a-medias',
      titulo: 'A medias',
      render: () => <NutricionVista {...base({ kcal: false, prote: true, notas: 'Me pasé con el pan en la comida.' })} />,
    },
    {
      id: 'registrado',
      titulo: 'Registrado y pagado',
      render: () => (
        <NutricionVista {...base({ hoyLog: PAGADO, kcal: true, prote: true, notas: PAGADO.notes ?? '' })} />
      ),
    },
    {
      id: 'sin-objetivo',
      titulo: 'Sin objetivo ni partes',
      render: () => <NutricionVista {...base({ objetivo: null, historial: [] })} />,
    },
    { id: 'cargando', titulo: 'Cargando', render: () => <NutricionVista {...base({ cargado: false })} /> },
    {
      id: 'error',
      titulo: 'Sin conexión',
      render: () => (
        <NutricionVista
          {...base({ errorCarga: 'Sin conexión. Revisa la red y vuelve a intentarlo.', objetivo: null, historial: [] })}
        />
      ),
    },
  ],
};
