// Demo de la galería /kit/pantallas (solo desarrollo). FASE3 Lote E1.
//
// GymVista con datos de mentira: sin sesión ni Supabase. Hoy es el día fijo
// de la galería (HOY_DEMO, viernes 2 de octubre de 2026): la rutina del
// viernes es la de hoy. Las acciones no hacen nada.
import type { DemoPantalla } from '@/components/arena/galeria';
import { HOY_DEMO } from '@/components/arena/demoDatos';
import type { Prescription } from '@/lib/bodywork';
import type { GymDay, GymExercise, GymSession } from '@/lib/types';
import { GymVista, type GymVistaProps } from './GymVista';
import type { LiftInput } from './SesionEnCurso';

const nada = () => {};
const VIERNES = 5;
const U = 'demo-usuario';

const DIAS: GymDay[] = [
  { id: 'd1', user_id: U, day_of_week: 1, name: 'Empuje' },
  { id: 'd3', user_id: U, day_of_week: 3, name: 'Tirón' },
  { id: 'd5', user_id: U, day_of_week: 5, name: 'Pierna' },
];

function ej(id: string, dia: string, name: string, sets: number, reps: number, weight: number | null, position: number): GymExercise {
  return { id, gym_day_id: dia, user_id: U, name, sets, reps, weight, position };
}

const EJERCICIOS: GymExercise[] = [
  ej('e1', 'd1', 'Press banca', 4, 8, 70, 0),
  ej('e2', 'd1', 'Press militar', 3, 10, 40, 1),
  ej('e3', 'd1', 'Fondos', 3, 12, null, 2),
  ej('e4', 'd3', 'Dominadas', 4, 6, null, 0),
  ej('e5', 'd3', 'Remo con barra', 4, 8, 60, 1),
  ej('e6', 'd5', 'Sentadilla', 4, 6, 100, 0),
  ej('e7', 'd5', 'Peso muerto rumano', 3, 8, 80, 1),
  ej('e8', 'd5', 'Zancadas', 3, 10, 22.5, 2),
];

const SESION: GymSession = {
  id: 's1',
  user_id: U,
  date: HOY_DEMO,
  gym_day_id: 'd5',
  xp_awarded: 25,
  notes: null,
  created_at: `${HOY_DEMO}T19:30:00Z`,
};

const PRESCRITO: Prescription[] = [
  { id: 'p1', date: HOY_DEMO, exercise_name: 'Sentadilla', sets: 4, reps: '5', weight: 102.5, rpe_target: 8, notes: 'Sube 2,5 kg: la última salió a RPE 7', position: 0 },
  { id: 'p2', date: HOY_DEMO, exercise_name: 'Peso muerto rumano', sets: 3, reps: '8', weight: 80, rpe_target: 7, notes: null, position: 1 },
  { id: 'p3', date: HOY_DEMO, exercise_name: 'Plancha', sets: 3, reps: '45 s', weight: null, rpe_target: null, notes: 'Entre series de zancadas', position: 2 },
];

const EN_CURSO: LiftInput[] = [
  {
    exercise: 'Sentadilla',
    series: [
      { weight: '100', reps: '6', rpe: '7' },
      { weight: '100', reps: '6', rpe: '8' },
      { weight: '102,5', reps: '5', rpe: '' },
      { weight: '102,5', reps: '5', rpe: '' },
    ],
  },
  {
    exercise: 'Peso muerto rumano',
    series: [
      { weight: '80', reps: '8', rpe: '' },
      { weight: '80', reps: '8', rpe: '' },
      { weight: '80', reps: '8', rpe: '' },
    ],
  },
  { exercise: 'Zancadas', series: [{ weight: '22,5', reps: '10', rpe: '' }] },
];

function base(cambios: Partial<GymVistaProps> = {}): GymVistaProps {
  return {
    cargado: true,
    errorCarga: null,
    hoyDia: VIERNES,
    dias: DIAS,
    ejercicios: EJERCICIOS,
    sesionHoy: null,
    xpMisionHoy: 0,
    prescrito: [],
    entrenando: false,
    series: [],
    notas: '',
    fotoLista: false,
    ocupado: false,
    acciones: {
      onVolver: nada,
      onReintentar: nada,
      onNuevoDia: nada,
      onEntrenar: nada,
      onTerminar: nada,
      onCambiarSerie: nada,
      onAnadirSerie: nada,
      onQuitarSerie: nada,
      onNotas: nada,
      onFoto: nada,
      onNuevoEjercicio: nada,
      onEditarEjercicio: nada,
      onBorrarDia: nada,
      onBorrarEjercicio: nada,
    },
    ...cambios,
  };
}

export const DEMO: DemoPantalla | null = {
  id: 'gym',
  titulo: 'Gimnasio',
  marco: 'pila',
  estados: [
    {
      id: 'sin-rutina',
      titulo: 'Sin rutina',
      render: () => <GymVista {...base({ dias: [], ejercicios: [] })} />,
    },
    {
      id: 'rutina-hoy',
      titulo: 'Rutina de hoy',
      render: () => <GymVista {...base()} />,
    },
    {
      id: 'entrenando',
      titulo: 'Entrenando',
      render: () => (
        <GymVista
          {...base({
            entrenando: true,
            series: EN_CURSO,
            notas: 'La rodilla izquierda, bien. Último bloque con poca energía.',
            fotoLista: true,
          })}
        />
      ),
    },
    {
      id: 'sesion-hecha',
      titulo: 'Sesión hecha',
      render: () => <GymVista {...base({ sesionHoy: SESION, xpMisionHoy: 25 })} />,
    },
    {
      id: 'descanso',
      titulo: 'Descanso',
      render: () => <GymVista {...base({ dias: DIAS.filter((d) => d.day_of_week !== VIERNES) })} />,
    },
    {
      id: 'prescrito',
      titulo: 'Prescrito por el sistema',
      render: () => <GymVista {...base({ prescrito: PRESCRITO })} />,
    },
    {
      id: 'cargando',
      titulo: 'Cargando',
      render: () => <GymVista {...base({ cargado: false })} />,
    },
    {
      id: 'error',
      titulo: 'Error al cargar',
      render: () => (
        <GymVista {...base({ cargado: false, errorCarga: 'Sin conexión. Revisa la red y vuelve a intentarlo.' })} />
      ),
    },
  ],
};
