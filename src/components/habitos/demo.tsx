// Demo de la galería /kit/pantallas (solo desarrollo). Lo rellena el encargo
// de esta pantalla del rediseño L-RADICAL (docs/design-v2/L-RADICAL.md §C).
//
// HabitosVista con datos de mentira: sin sesión ni Supabase. Las rachas salen
// de clasificarHabitos con el «hoy» fijo de la galería, así que se ven igual
// cualquier día. Las acciones no hacen nada.
import type { DemoPantalla } from '@/components/arena/galeria';
import { QuestForm } from '@/components/QuestForm';
import { HOY_DEMO, misionDemo } from '@/components/arena/demoDatos';
import { addDays } from '@/lib/dates';
import type { Rule } from '@/lib/types';
import { clasificarHabitos } from './derivarHabitos';
import { HabitosVista, type HabitosVistaProps } from './HabitosVista';

const nada = () => {};

/** Los últimos `n` días naturales hasta hoy incluido. */
const ultimos = (n: number): Set<string> => new Set(Array.from({ length: n }, (_, i) => addDays(HOY_DEMO, -i)));

const LLAMADAS = misionDemo({ title: 'Diez llamadas en frío', stat: 'PER' });
const LEER = misionDemo({ title: 'Leer 20 páginas', stat: 'INT' });
const CORRER = misionDemo({ title: 'Correr 5 km', stat: 'AGI', days_of_week: [1, 3, 5] });
const DORMIR = misionDemo({ title: 'Dormir antes de las doce', stat: 'VIT', days_of_week: [1, 2, 3, 4, 5] });
const REDES = misionDemo({
  title: 'Sin redes antes de las diez',
  acquired_at: '2026-09-12T08:00:00Z',
  acquired_streak: 21,
});
const AGUA = misionDemo({ title: 'Agua al despertar', acquired_at: '2026-08-30T08:00:00Z', acquired_streak: 24 });

const FECHAS = new Map([
  [LLAMADAS.id, ultimos(23)],
  [LEER.id, ultimos(14)],
  [CORRER.id, ultimos(30)],
  [DORMIR.id, ultimos(6)],
]);

const regla = (id: string, text: string, consequence: string): Rule => ({
  id,
  user_id: 'demo-usuario',
  position: 0,
  text,
  consequence,
  active: true,
  created_at: '2026-09-01T09:00:00Z',
});

const REGLAS: Rule[] = [
  regla('r1', 'Nada de móvil en la cama', 'Mañana sin redes hasta mediodía'),
  regla('r2', 'Cena antes de las diez', 'Mañana sin postre'),
  regla('r3', 'Repasar la agenda de mañana', 'Mañana te levantas 30 minutos antes'),
];

function base(cambios: Partial<HabitosVistaProps> = {}): HabitosVistaProps {
  const c = clasificarHabitos([LLAMADAS, LEER, CORRER, DORMIR, REDES, AGUA], FECHAS, HOY_DEMO);
  return {
    estado: 'listo',
    error: null,
    enCurso: c.enCurso,
    adquiridos: c.adquiridos,
    progresos: c.progresos,
    reglas: REGLAS,
    cumplidas: new Set(['r1']),
    ocupado: false,
    acciones: {
      onNuevo: nada,
      onEditar: nada,
      onConsolidar: nada,
      onReactivar: nada,
      onAlternarRegla: nada,
      onReintentar: nada,
    },
    ...cambios,
  };
}

export const DEMO: DemoPantalla | null = {
  id: 'habitos',
  titulo: 'Hábitos',
  estados: [
    {
      id: 'lleno',
      titulo: 'Lleno (uno consolidable)',
      render: () => <HabitosVista {...base()} />,
    },
    {
      id: 'vacio',
      titulo: 'Vacío',
      render: () => (
        <HabitosVista {...base({ enCurso: [], adquiridos: [], progresos: new Map(), reglas: [], cumplidas: new Set() })} />
      ),
    },
    {
      id: 'cargando',
      titulo: 'Cargando',
      render: () => <HabitosVista {...base({ estado: 'cargando', enCurso: [], adquiridos: [], reglas: [] })} />,
    },
    {
      id: 'error',
      titulo: 'Sin conexión',
      render: () => (
        <HabitosVista
          {...base({
            error: 'Sin conexión. Revisa la red y vuelve a intentarlo.',
            enCurso: [],
            adquiridos: [],
            reglas: [],
          })}
        />
      ),
    },
    {
      id: 'hoja-habito',
      titulo: 'Hoja «Nuevo hábito» (QuestForm)',
      render: () => (
        <>
          <HabitosVista {...base()} />
          <QuestForm visible onClose={nada} onSubmit={async () => {}} sustantivo="hábito" />
        </>
      ),
    },
  ],
};
