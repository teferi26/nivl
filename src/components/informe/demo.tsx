// Demo de la galería /kit/pantallas (solo desarrollo). FASE3 Lote F.
//
// InformeVista con datos de mentira: sin sesión ni Supabase. Las misiones
// completadas salen de un patrón fijo hacia atrás desde HOY_DEMO (13
// semanas), así que la franja, la lectura y el mapa se ven igual cualquier
// día. Las cuentas son las de verdad (derivarInforme). Las acciones no hacen
// nada.
import type { DemoPantalla } from '@/components/arena/galeria';
import { HOY_DEMO, misionDemo } from '@/components/arena/demoDatos';
import { addDays } from '@/lib/dates';
import type { WeeklyAdvice } from '@/lib/oracle';
import type { Completion, Quest } from '@/lib/types';
import { derivarInforme } from './derivarInforme';
import { InformeVista, type InformeVistaProps } from './InformeVista';

const nada = () => {};

const QUESTS: Quest[] = [
  misionDemo({ id: 'q-gym', title: 'Entrenar fuerza', stat: 'FUE', difficulty: 'dificil' }),
  misionDemo({ id: 'q-leer', title: 'Leer 30 minutos', stat: 'INT' }),
  misionDemo({ id: 'q-agua', title: 'Dos litros de agua', stat: 'VIT', difficulty: 'facil' }),
  misionDemo({ id: 'q-llamadas', title: 'Diez llamadas en frío', stat: 'AGI', difficulty: 'dificil' }),
  misionDemo({ id: 'q-meditar', title: 'Meditar diez minutos', stat: 'PER', difficulty: 'facil' }),
];

const XP: Record<string, number> = { 'q-gym': 40, 'q-leer': 25, 'q-agua': 15, 'q-llamadas': 40, 'q-meditar': 15 };

/** Un patrón fijo: qué misiones se hicieron `n` días antes de hoy. */
function completadas(dias: number): Completion[] {
  const out: Completion[] = [];
  for (let n = 0; n < dias; n++) {
    const date = addDays(HOY_DEMO, -n);
    QUESTS.forEach((q, k) => {
      // Más constancia reciente; huecos a ritmo fijo para que el mapa respire.
      const hecha = (n * 7 + k * 3) % (n < 14 ? 5 : 3) !== 0 && (n + k) % 11 !== 0;
      if (!hecha) return;
      out.push({
        id: `c-${n}-${q.id}`,
        user_id: 'demo-usuario',
        quest_id: q.id,
        date,
        completed_at: `${date}T19:00:00Z`,
        xp_awarded: XP[q.id] ?? 20,
        evidence_url: (n + k) % 2 === 0 ? 'demo/evidencia.jpg' : null,
      });
    });
  }
  return out;
}

const LLENO = completadas(91);

const ANALISIS: WeeklyAdvice = {
  analysis:
    'Catorce días con una base sólida: la fuerza y la lectura no fallan. Las llamadas se caen los viernes y la meditación ya no exige nada.',
  adjustments: [
    {
      quest_id: 'q-llamadas',
      quest_title: 'Diez llamadas en frío',
      action: 'ajustar_dificultad',
      new_difficulty: 'media',
      reasoning: 'Fallas tres de cada diez; mejor cumplir siete que prometer diez.',
    },
    {
      quest_id: 'q-meditar',
      quest_title: 'Meditar diez minutos',
      action: 'ajustar_dificultad',
      new_difficulty: 'media',
      reasoning: 'Catorce de catorce: ya es un hábito, súbele el listón.',
    },
  ],
  new_quests: [
    {
      title: 'Caminar 20 minutos tras comer',
      stat: 'VIT',
      difficulty: 'facil',
      days_of_week: [1, 2, 3, 4, 5],
      reasoning: 'Tu cardio está a cero entre semana.',
    },
  ],
  advice: 'Mantén el gimnasio a primera hora: es lo único que no se ha movido en dos semanas.',
};

function base(cambios: Partial<InformeVistaProps> = {}, completions: Completion[] = LLENO): InformeVistaProps {
  return {
    cargado: true,
    errorCarga: null,
    hoy: HOY_DEMO,
    datos: derivarInforme(completions, QUESTS, HOY_DEMO),
    advice: null,
    aplicados: new Set(),
    aplicando: new Set(),
    consultando: false,
    errorOraculo: null,
    refrescando: false,
    acciones: {
      onVolver: nada,
      onRefrescar: nada,
      onReintentar: nada,
      onConsultar: nada,
      onAplicar: nada,
      onCrear: nada,
    },
    ...cambios,
  };
}

export const DEMO: DemoPantalla | null = {
  id: 'informe',
  titulo: 'Informe',
  marco: 'pila',
  estados: [
    {
      id: 'lleno',
      titulo: 'Lleno, sin análisis',
      render: () => <InformeVista {...base()} />,
    },
    {
      id: 'analisis',
      titulo: 'Con análisis (uno aplicado)',
      render: () => <InformeVista {...base({ advice: ANALISIS, aplicados: new Set(['q-meditar']) })} />,
    },
    {
      id: 'oraculo-error',
      titulo: 'El oráculo no responde',
      render: () => (
        <InformeVista {...base({ errorOraculo: 'Sin conexión. Revisa la red y vuelve a intentarlo.' })} />
      ),
    },
    {
      id: 'vacio',
      titulo: 'Vacío',
      render: () => <InformeVista {...base({}, [])} />,
    },
    {
      id: 'cargando',
      titulo: 'Cargando',
      render: () => <InformeVista {...base({ cargado: false })} />,
    },
    {
      id: 'error',
      titulo: 'Error al cargar',
      render: () => (
        <InformeVista {...base({ cargado: false, errorCarga: 'Sin conexión. Revisa la red y vuelve a intentarlo.' })} />
      ),
    },
  ],
};
