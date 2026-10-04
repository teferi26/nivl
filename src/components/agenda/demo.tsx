// Demo de la galería /kit/pantallas (solo desarrollo). Lote C de la Fase 3
// (docs/design-v2/FASE3.md): la Agenda.
//
// AgendaVista con datos de mentira: sin sesión ni Supabase. El «hoy» es el de
// la galería (HOY_DEMO) y la línea de «ahora» va fija a las 11:20, así que se
// ve igual cualquier día. Las acciones no hacen nada.
import type { DemoPantalla } from '@/components/arena/galeria';
import { HOY_DEMO, misionDemo } from '@/components/arena/demoDatos';
import type { PlanConBloques } from '@/lib/dayplan';
import { addDays } from '@/lib/dates';
import type { DayBlock } from '@/lib/plan';
import type { CalendarEvent, DungeonTask } from '@/lib/types';
import { AgendaVista, type AgendaVistaProps } from './AgendaVista';

const nada = () => {};

const LLAMADAS = misionDemo({ title: 'Diez llamadas en frío', stat: 'PER' });
const LEER = misionDemo({ title: 'Leer 20 páginas', stat: 'INT' });
const CORRER = misionDemo({ title: 'Correr 5 km', stat: 'AGI', days_of_week: [1, 3, 5] });

const evento = (id: string, date: string, title: string, time: string | null, notes: string | null = null): CalendarEvent => ({
  id,
  user_id: 'demo-usuario',
  title,
  date,
  time,
  notes,
  created_at: '2026-09-28T09:00:00Z',
});

const EVENTOS: CalendarEvent[] = [
  evento('e1', HOY_DEMO, 'Llamada con inversores', '09:30:00', 'Llevar las cifras de septiembre'),
  evento('e2', HOY_DEMO, 'Entreno con Marta', '18:00:00'),
  evento('e3', HOY_DEMO, 'Pagar el alquiler', null),
  evento('e4', addDays(HOY_DEMO, -2), 'Dentista', '16:30:00'),
  evento('e5', addDays(HOY_DEMO, 1), 'Cena de cumpleaños', '21:00:00'),
  evento('e6', addDays(HOY_DEMO, 4), 'Examen de inglés', '10:00:00'),
  evento('e7', addDays(HOY_DEMO, 4), 'Revisión del coche', '13:00:00'),
  evento('e8', addDays(HOY_DEMO, 12), 'Viaje a Lisboa', null),
];

const tarea = (id: string, title: string, due: string, is_boss = false): DungeonTask => ({
  id,
  dungeon_id: 'demo-campana',
  user_id: 'demo-usuario',
  title,
  is_boss,
  difficulty: 'media',
  done: false,
  done_at: null,
  due_date: due,
  position: 0,
});

const PLAZOS: DungeonTask[] = [
  tarea('t1', 'Enviar la propuesta a Acme', HOY_DEMO),
  tarea('t2', 'Lanzar la web', addDays(HOY_DEMO, 7), true),
];

const bloque = (id: string, start: number, end: number, title: string, kind: DayBlock['kind'], done = false): DayBlock => ({
  id,
  plan_id: 'demo-plan',
  start_min: start,
  end_min: end,
  title,
  kind,
  detail: null,
  quest_id: null,
  notify: false,
  done,
  position: 0,
});

const PLAN: PlanConBloques = {
  plan: {
    id: 'demo-plan',
    date: HOY_DEMO,
    status: 'activo',
    verdict: null,
    brief: null,
    generated_at: '2026-10-02T06:00:00Z',
  },
  bloques: [
    bloque('b1', 7 * 60, 7 * 60 + 30, 'Ritual de mañana', 'ritual', true),
    bloque('b2', 8 * 60, 9 * 60 + 15, 'Trabajo profundo', 'deep_work', true),
    bloque('b3', 11 * 60, 12 * 60 + 30, 'Bloque de ventas', 'ventas'),
    bloque('b4', 14 * 60, 15 * 60, 'Comida sin pantallas', 'comida'),
  ],
};

function base(cambios: Partial<AgendaVistaProps> = {}): AgendaVistaProps {
  return {
    estado: 'listo',
    error: null,
    hoy: HOY_DEMO,
    dia: HOY_DEMO,
    modo: 'dia',
    quests: [LLAMADAS, LEER, CORRER],
    events: EVENTOS,
    dueTasks: PLAZOS,
    hechas: new Set([LEER.id]),
    plan: PLAN,
    esPro: true,
    ahoraMin: 11 * 60 + 20,
    acciones: {
      onModo: nada,
      onDia: nada,
      onElegirDia: nada,
      onNuevo: nada,
      onDetalle: nada,
      onReintentar: nada,
    },
    ...cambios,
  };
}

const SIN_NADA: Partial<AgendaVistaProps> = { quests: [], plan: null, hechas: new Set() };

export const DEMO: DemoPantalla | null = {
  id: 'agenda',
  titulo: 'Agenda',
  estados: [
    { id: 'dia-lleno', titulo: 'Día lleno', render: () => <AgendaVista {...base()} /> },
    { id: 'semana', titulo: 'Semana', render: () => <AgendaVista {...base({ modo: 'semana' })} /> },
    { id: 'mes', titulo: 'Mes', render: () => <AgendaVista {...base({ modo: 'mes' })} /> },
    {
      id: 'vacio-futuro',
      titulo: 'Vacío (futuro)',
      render: () => <AgendaVista {...base({ ...SIN_NADA, dia: addDays(HOY_DEMO, 3), ahoraMin: null })} />,
    },
    {
      id: 'vacio-pasado',
      titulo: 'Vacío (pasado)',
      render: () => (
        <AgendaVista {...base({ ...SIN_NADA, modo: 'semana', dia: addDays(HOY_DEMO, -10), ahoraMin: null })} />
      ),
    },
    {
      id: 'cargando',
      titulo: 'Cargando',
      render: () => <AgendaVista {...base({ estado: 'cargando', quests: [], events: [], dueTasks: [], plan: null })} />,
    },
    {
      id: 'error',
      titulo: 'Sin conexión',
      render: () => (
        <AgendaVista
          {...base({
            error: 'Sin conexión. Revisa la red y vuelve a intentarlo.',
            quests: [],
            events: [],
            dueTasks: [],
            plan: null,
          })}
        />
      ),
    },
  ],
};
