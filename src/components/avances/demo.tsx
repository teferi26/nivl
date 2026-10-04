// Demo de la galería /kit/pantallas (solo desarrollo). FASE3 Lote F.
//
// AvancesVista con datos de mentira: sin sesión ni Supabase. Los huecos con
// efectos propios no se pintan de verdad: la fila de fotos va vacía y el
// aviso de salud es su vista pura, AvisoSaludVista (HealthConsentNotice lee
// el contexto de salud). Las acciones no hacen nada.
import type { DemoPantalla } from '@/components/arena/galeria';
import { AvisoSaludVista } from '@/components/puertas/SaludPerfilVista';
import { HOY_DEMO } from '@/components/arena/demoDatos';
import { addDays } from '@/lib/dates';
import { goalProgress } from '@/lib/game';
import type { BodyMetric, Goal } from '@/lib/types';
import { AvancesVista, type AvancesVistaProps, type MetaVista } from './AvancesVista';
import { HojaMeta, HojaValor, type HojaMetaProps } from './HojasAvances';

const nada = () => {};

const PESOS = [86.2, 85.9, 86.1, 85.4, 85.0, 84.8, 84.9, 84.3, 83.9, 84.1, 83.6, 83.2, 82.9, 82.4];
const WEIGHTS: BodyMetric[] = PESOS.map((kg, i) => ({
  id: `w${i}`,
  user_id: 'demo-usuario',
  date: addDays(HOY_DEMO, -(PESOS.length - 1 - i) * 3 - 1),
  weight_kg: kg,
  notes: null,
  created_at: '',
}));

function meta(id: string, cambios: Partial<Goal>): Goal {
  return {
    id,
    user_id: 'demo-usuario',
    title: 'Meta',
    metric_type: 'libre',
    exercise_name: null,
    start_value: 0,
    target_value: 10,
    current_value: null,
    unit: 'kg',
    deadline: null,
    status: 'active',
    created_at: '',
    achieved_at: null,
    ...cambios,
  };
}

const PRS = [
  { exercise: 'Press banca', weight: 92.5 },
  { exercise: 'Sentadilla', weight: 120 },
  { exercise: 'Peso muerto', weight: 150 },
  { exercise: 'Press militar', weight: 57.5 },
];

function conProgreso(g: Goal, actual: number | null): MetaVista {
  return { goal: g, actual, progreso: actual === null ? 0 : goalProgress(g.start_value, g.target_value, actual) };
}

const METAS: MetaVista[] = [
  conProgreso(meta('g1', { title: 'Bajar a 78 kg', metric_type: 'peso_corporal', start_value: 86.2, target_value: 78 }), 82.4),
  conProgreso(
    meta('g2', { title: 'Press banca 100 kg', metric_type: 'ejercicio', exercise_name: 'Press banca', start_value: 80, target_value: 100 }),
    92.5,
  ),
  conProgreso(meta('g3', { title: 'Leer doce libros este año', start_value: 0, target_value: 12, current_value: 12, unit: 'libros' }), 12),
];

const LOGRADAS: Goal[] = [
  meta('g4', { title: 'Sentadilla 120 kg', metric_type: 'ejercicio', start_value: 100, target_value: 120, status: 'achieved', achieved_at: `${addDays(HOY_DEMO, -9)}T19:00:00Z` }),
  meta('g5', { title: 'Terminar el curso de inglés B2', start_value: 0, target_value: 4, unit: 'módulos', status: 'achieved', achieved_at: `${addDays(HOY_DEMO, -40)}T19:00:00Z` }),
];

/** El aviso de salud con datos fijos (el de verdad lee el contexto de salud). */
function AvisoSaludDoble() {
  return <AvisoSaludVista cargando={false} error={null} borradoPendiente={false} onReintentar={nada} onRevisar={nada} />;
}

function base(cambios: Partial<AvancesVistaProps> = {}): AvancesVistaProps {
  return {
    cargado: true,
    errorCarga: null,
    saludAceptada: true,
    weights: WEIGHTS,
    metas: METAS,
    logradas: LOGRADAS,
    prs: PRS,
    series: null,
    pesadoHoy: false,
    peso: '',
    errorPeso: null,
    pesando: false,
    refrescando: false,
    toast: null,
    avisoSalud: null,
    fotos: null,
    acciones: {
      onVolver: nada,
      onRefrescar: nada,
      onReintentar: nada,
      onPeso: nada,
      onPesar: nada,
      onNuevaMeta: nada,
      onReclamar: nada,
      onActualizar: nada,
      onBorrar: nada,
      onSerie: nada,
      onToastHecho: nada,
    },
    ...cambios,
  };
}

const HOJA_META: HojaMetaProps = {
  visible: true,
  saludAceptada: true,
  titulo: 'Press banca 100 kg',
  metrica: 'ejercicio',
  ejercicio: '',
  inicio: '80',
  objetivo: '100',
  guardando: false,
  error: 'Falta el ejercicio: escribe el nombre EXACTO del ejercicio del gym.',
  onTitulo: nada,
  onMetrica: nada,
  onEjercicio: nada,
  onInicio: nada,
  onObjetivo: nada,
  onGuardar: nada,
  onCerrar: nada,
};

export const DEMO: DemoPantalla | null = {
  id: 'avances',
  titulo: 'Avances',
  marco: 'pila',
  estados: [
    {
      id: 'lleno',
      titulo: 'Lleno',
      render: () => <AvancesVista {...base()} />,
    },
    {
      id: 'progresion',
      titulo: 'Progresión abierta y pesado hoy',
      render: () => (
        <AvancesVista
          {...base({
            pesadoHoy: true,
            series: { exercise: 'Press banca', values: [80, 82.5, 82.5, 85, 87.5, 87.5, 90, 92.5] },
            toast: { texto: 'Pesaje · +5 XP', anuncio: 'Pesaje registrado. +5 XP a VIT por el pesaje.' },
          })}
        />
      ),
    },
    {
      id: 'peso-invalido',
      titulo: 'Peso fuera de rango',
      render: () => <AvancesVista {...base({ peso: '7,84', errorPeso: 'Introduce tu peso en kg, p. ej. 78,4' })} />,
    },
    {
      id: 'vacio',
      titulo: 'Vacío',
      render: () => <AvancesVista {...base({ weights: [], metas: [], logradas: [], prs: [] })} />,
    },
    {
      id: 'sin-salud',
      titulo: 'Sin permiso de salud',
      render: () => (
        <AvancesVista
          {...base({
            saludAceptada: false,
            weights: [],
            prs: [],
            metas: [METAS[2]!],
            logradas: [LOGRADAS[1]!],
            avisoSalud: <AvisoSaludDoble />,
          })}
        />
      ),
    },
    {
      id: 'hoja-meta',
      titulo: 'Hoja «Nueva meta» con un fallo',
      render: () => (
        <>
          <AvancesVista {...base()} />
          <HojaMeta {...HOJA_META} />
        </>
      ),
    },
    {
      id: 'hoja-valor',
      titulo: 'Hoja «Progreso manual»',
      render: () => (
        <>
          <AvancesVista {...base()} />
          <HojaValor meta={METAS[2]!.goal} valor="11" error={null} onValor={nada} onGuardar={nada} onCerrar={nada} />
        </>
      ),
    },
    {
      id: 'cargando',
      titulo: 'Cargando',
      render: () => <AvancesVista {...base({ cargado: false })} />,
    },
    {
      id: 'error',
      titulo: 'Error al cargar',
      render: () => (
        <AvancesVista {...base({ cargado: false, errorCarga: 'Sin conexión. Revisa la red y vuelve a intentarlo.' })} />
      ),
    },
  ],
};
