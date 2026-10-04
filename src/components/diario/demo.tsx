// Demo de la galería /kit/pantallas (solo desarrollo). FASE3 Lote D.
//
// DiarioVista con datos de mentira: sin sesión ni Supabase. El «hoy» es el
// fijo de la galería (HOY_DEMO), así que el día, la racha y los recuerdos se
// ven igual cualquier día. Las acciones no hacen nada.
import type { DemoPantalla } from '@/components/arena/galeria';
import { HOY_DEMO } from '@/components/arena/demoDatos';
import { addDays } from '@/lib/dates';
import { MAX_VICTORIAS, completitud, limpiarVictorias } from '@/lib/journalmath';
import type { JournalEntry } from '@/lib/types';
import type { LineaCronica } from './Cronica';
import { DiarioVista, type DiarioVistaProps, type FotoDiario, type RespuestasDiario } from './DiarioVista';

const nada = () => {};

const VACIAS: RespuestasDiario = {
  mood: null,
  energy: null,
  emotions: [],
  sleep: null,
  wins: [''],
  text: '',
  lesson: '',
  gratitude: '',
  plan: '',
};

const A_MEDIAS: RespuestasDiario = {
  mood: 4,
  energy: 3,
  emotions: ['enfocado', 'cansado'],
  sleep: 6.5,
  wins: ['Diez llamadas en frío antes de comer', 'Cerré la propuesta de Ibérica', ''],
  text: 'Mañana larga de llamadas. Dos reuniones buenas y una que sobraba. Por la tarde me costó arrancar, pero el gimnasio lo arregló.',
  lesson: '',
  gratitude: '',
  plan: '',
};

const COMPLETAS: RespuestasDiario = {
  ...A_MEDIAS,
  wins: ['Diez llamadas en frío antes de comer', 'Cerré la propuesta de Ibérica', 'Sentadilla: 100 kg por fin'],
  lesson: 'Las reuniones sin orden del día se alargan. La próxima, agenda o no voy.',
  gratitude: 'A Marta, por leerse la propuesta a las once de la noche.',
  plan: 'A las 8:00, revisar el contrato de Ibérica antes del correo.',
};

const CRONICA: LineaCronica[] = [
  { id: 'c1', linea: 'Misión completada: Diez llamadas en frío (+25 XP)', victoria: 'Diez llamadas en frío' },
  { id: 'c2', linea: 'Sesión de gimnasio registrada (+30 XP)', victoria: 'Sesión de gimnasio' },
  { id: 'c3', linea: 'RÉCORD personal: Sentadilla · 100 kg', victoria: 'Récord en Sentadilla: 100 kg' },
  { id: 'c4', linea: 'Una Piedra de Protección se consumió por ti', victoria: null },
];

const FOTOS: FotoDiario[] = [
  { photo: { id: 'f1', user_id: 'demo-usuario', date: HOY_DEMO, path: 'demo/1.jpg', created_at: '' }, url: null },
];

/** Una entrada del archivo `n` días antes de hoy. */
function entrada(n: number, cambios: Partial<JournalEntry>): JournalEntry {
  const date = addDays(HOY_DEMO, -n);
  return {
    id: `e${n}`,
    user_id: 'demo-usuario',
    date,
    mood: null,
    energy: null,
    text: null,
    plan: null,
    emotions: [],
    wins: [],
    lesson: null,
    gratitude: null,
    sleep_hours: null,
    created_at: `${date}T22:00:00Z`,
    ...cambios,
  };
}

const ENTRADAS: JournalEntry[] = [
  entrada(1, {
    mood: 4,
    energy: 4,
    sleep_hours: 7.5,
    emotions: ['motivado', 'enfocado'],
    wins: ['Terminé el informe trimestral', 'Correr 5 km sin parar'],
    text: 'Día redondo. El informe salió a la primera y por la tarde corrí sin mirar el reloj. Me di cuenta de que el ritmo bueno llega cuando no lo fuerzo.',
    lesson: 'Empezar por lo difícil deja la tarde libre.',
    plan: 'A las 8:00, diez llamadas.',
  }),
  entrada(2, {
    mood: 2,
    energy: 2,
    sleep_hours: 5.5,
    emotions: ['cansado', 'estresado', 'disperso'],
    wins: ['Al menos fui al gimnasio'],
    text: 'Dormí mal y se notó todo el día.',
  }),
  entrada(3, { mood: 3, energy: 3, sleep_hours: 7, emotions: ['tranquilo'], text: 'Un día normal, sin más.' }),
  entrada(4, {
    mood: 5,
    energy: 4,
    sleep_hours: 8,
    emotions: ['orgulloso', 'feliz'],
    wins: ['Firmamos con Ibérica'],
    gratitude: 'Al equipo entero.',
  }),
  entrada(5, { mood: 4, energy: 3, sleep_hours: 7, text: 'Semana de cierre. Mucho correo y poco trabajo de verdad.' }),
  entrada(6, { mood: 3, energy: 2, sleep_hours: 6, emotions: ['ansioso'] }),
  entrada(7, {
    mood: 4,
    energy: 4,
    sleep_hours: 7.5,
    emotions: ['motivado'],
    wins: ['Primera semana entera sin redes antes de las diez'],
    text: 'Hace una semana que no miro el móvil al despertar. La mañana dura el doble.',
  }),
  entrada(9, { mood: 3, energy: 3, sleep_hours: 6.5, text: 'Viaje a Valencia. Reunión corta, vuelta tarde.' }),
  entrada(11, { mood: 4, energy: 5, sleep_hours: 8, emotions: ['fuerte'], wins: ['Peso muerto: 140 kg'] }),
  entrada(13, { mood: 2, energy: 3, sleep_hours: 6, emotions: ['frustrado'], text: 'La propuesta volvió con cambios.' }),
];

const RECUERDOS: JournalEntry[] = [
  entrada(7, ENTRADAS[6]!),
  entrada(365, {
    id: 'anio',
    mood: 3,
    energy: 2,
    sleep_hours: 6,
    emotions: ['estresado'],
    wins: ['Primer día en la arena'],
    text: 'Hoy empiezo con NIVL. A ver cuánto dura esto.',
  }),
];

function base(cambios: Partial<DiarioVistaProps> = {}): DiarioVistaProps {
  const respuestas = cambios.respuestas ?? VACIAS;
  const victorias = limpiarVictorias(respuestas.wins);
  return {
    segmento: 'escribir',
    hoy: HOY_DEMO,
    dia: HOY_DEMO,
    cargado: true,
    registrado: false,
    sucio: false,
    ocupado: false,
    refrescando: false,
    aviso: null,
    errorGuardado: null,
    errorCarga: null,
    xp: 10,
    pista: '¿Qué pasó hoy que quieras recordar dentro de un año?',
    respuestas,
    hecho: completitud({
      mood: respuestas.mood,
      energy: respuestas.energy,
      emotions: respuestas.emotions,
      sleep_hours: respuestas.sleep,
      wins: victorias,
      text: respuestas.text || null,
      lesson: respuestas.lesson || null,
      gratitude: respuestas.gratitude || null,
      plan: respuestas.plan || null,
    }),
    reclamadas: new Set(victorias.map((w) => w.toLocaleLowerCase('es'))),
    cabenMas: victorias.length < MAX_VICTORIAS,
    fotos: [],
    cronica: CRONICA,
    archivo: {
      cargado: true,
      entries: ENTRADAS,
      recuerdos: RECUERDOS,
      photoCounts: new Map([[ENTRADAS[0]!.date, 2]]),
      loadPhotos: () => Promise.resolve([]),
    },
    acciones: {
      onVolver: nada,
      onSegmento: nada,
      onIrADia: nada,
      onMood: nada,
      onEnergy: nada,
      onEmotions: nada,
      onSleep: nada,
      onWins: nada,
      onText: nada,
      onLesson: nada,
      onGratitude: nada,
      onPlan: nada,
      onReclamar: nada,
      onAnadirFoto: nada,
      onQuitarFoto: nada,
      onGuardar: nada,
      onRefrescar: nada,
      onReintentarCarga: nada,
    },
    ...cambios,
  };
}

export const DEMO: DemoPantalla | null = {
  id: 'diario',
  titulo: 'Diario',
  marco: 'pila',
  estados: [
    {
      id: 'escribir-vacio',
      titulo: 'Escribir · vacío',
      render: () => <DiarioVista {...base({ cronica: [] })} />,
    },
    {
      id: 'a-medias',
      titulo: 'Escribir · a medias, sin guardar',
      render: () => <DiarioVista {...base({ respuestas: A_MEDIAS, sucio: true })} />,
    },
    {
      id: 'registrado',
      titulo: 'Escribir · registrado',
      render: () => <DiarioVista {...base({ respuestas: COMPLETAS, registrado: true, fotos: FOTOS })} />,
    },
    {
      id: 'archivo-lleno',
      titulo: 'Archivo · lleno',
      render: () => <DiarioVista {...base({ segmento: 'archivo' })} />,
    },
    {
      id: 'archivo-vacio',
      titulo: 'Archivo · vacío',
      render: () => (
        <DiarioVista {...base({ segmento: 'archivo', archivo: { ...base().archivo, entries: [], recuerdos: [] } })} />
      ),
    },
    {
      id: 'cargando',
      titulo: 'Cargando',
      render: () => <DiarioVista {...base({ cargado: false })} />,
    },
    {
      id: 'error-carga',
      titulo: 'Error al cargar el día',
      render: () => (
        <DiarioVista {...base({ errorCarga: 'Sin conexión. Revisa la red y vuelve a intentarlo.' })} />
      ),
    },
    {
      id: 'error-guardado',
      titulo: 'Error al guardar',
      render: () => (
        <DiarioVista
          {...base({
            respuestas: A_MEDIAS,
            sucio: true,
            errorGuardado: 'Sin conexión. Revisa la red y vuelve a intentarlo. Tus respuestas siguen aquí.',
          })}
        />
      ),
    },
  ],
};
