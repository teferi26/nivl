// Demo de la galería /kit/pantallas (solo desarrollo). FASE3 Oleada 2, lote E2.
//
// DietaVista con datos de mentira: sin sesión ni Supabase. El día elegido es
// un viernes fijo (5) y «hoy» también, así se ve igual cualquier día. Las
// acciones no hacen nada; el estado «hoja» abre la hoja de la comida encima.
import type { DemoPantalla } from '@/components/arena/galeria';
import type { MealSlot, MealSlotName } from '@/lib/types';
import { DietaVista, type DietaVistaProps } from './DietaVista';
import { HojaComida } from './HojaComida';

const nada = () => {};

const comida = (
  dia: number,
  slot: MealSlotName,
  description: string,
  ingredients: string | null,
  kcal: number | null = null,
  protein_g: number | null = null,
): MealSlot => ({
  id: `${dia}-${slot}`,
  user_id: 'demo-usuario',
  day_of_week: dia,
  slot,
  description,
  ingredients,
  kcal,
  protein_g,
});

/** Semana planificada por el coach, con macros. */
const DEL_COACH: MealSlot[] = [5, 1, 3].flatMap((d) => [
  comida(d, 'desayuno', 'Avena con yogur y plátano', 'avena, yogur griego, plátano', 520, 32),
  comida(d, 'comida', 'Pollo con arroz y brócoli', 'pollo, arroz, brócoli, aceite de oliva', 780, 58),
  comida(d, 'merienda', 'Tostada con pavo', 'pan integral, pavo', 310, 24),
  comida(d, 'cena', 'Merluza con patata y ensalada', 'merluza, patata, lechuga, tomate', 640, 44),
]);

/** Escritas a mano: sin macros. */
const A_MANO: MealSlot[] = [
  comida(5, 'desayuno', 'Café y tostadas', 'pan, tomate, aceite de oliva'),
  comida(5, 'comida', 'Lentejas', 'lentejas, chorizo, zanahoria'),
];

function base(cambios: Partial<DietaVistaProps> = {}): DietaVistaProps {
  return {
    cargado: true,
    errorCarga: null,
    slots: DEL_COACH,
    dia: 5,
    hoy: 5,
    generando: false,
    acciones: {
      onVolver: nada,
      onDia: nada,
      onComida: nada,
      onGenerar: nada,
      onCompra: nada,
      onReintentar: nada,
    },
    ...cambios,
  };
}

export const DEMO: DemoPantalla | null = {
  id: 'dieta',
  titulo: 'Dieta',
  marco: 'pila',
  estados: [
    { id: 'plan-coach', titulo: 'Plan del coach', render: () => <DietaVista {...base()} /> },
    { id: 'a-mano', titulo: 'Escrita a mano', render: () => <DietaVista {...base({ slots: A_MANO })} /> },
    { id: 'otro-dia', titulo: 'Otro día sin plan', render: () => <DietaVista {...base({ dia: 7 })} /> },
    { id: 'vacio', titulo: 'Semana vacía', render: () => <DietaVista {...base({ slots: [] })} /> },
    {
      id: 'hoja',
      titulo: 'Hoja de una comida',
      render: () => (
        <>
          <DietaVista {...base()} />
          <HojaComida
            visible
            slot="comida"
            existe
            dia={5}
            descripcion="Pollo con arroz y brócoli"
            ingredientes="pollo, arroz, brócoli, aceite de oliva"
            guardando={false}
            quitando={false}
            error={null}
            onDescripcion={nada}
            onIngredientes={nada}
            onGuardar={nada}
            onQuitar={nada}
            onCerrar={nada}
          />
        </>
      ),
    },
    { id: 'cargando', titulo: 'Cargando', render: () => <DietaVista {...base({ cargado: false, slots: [] })} /> },
    {
      id: 'error',
      titulo: 'Sin conexión',
      render: () => (
        <DietaVista {...base({ errorCarga: 'Sin conexión. Revisa la red y vuelve a intentarlo.', slots: [] })} />
      ),
    },
  ],
};
