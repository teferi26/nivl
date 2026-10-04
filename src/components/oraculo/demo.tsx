// Demo de la galería /kit/pantallas (solo desarrollo). FASE3 G1 · Oráculo.
//
// OraculoVista con datos de mentira: sin sesión, sin Supabase y sin IA. Las
// acciones no hacen nada.
import type { DemoPantalla } from '@/components/arena/galeria';
import type { ProposedQuest } from '@/lib/oracle';
import { HojaClave } from './HojaClave';
import { OraculoVista, type OraculoVistaProps } from './OraculoVista';

const nada = () => {};

const OBJETIVO = 'Correr 10 km en menos de 55 minutos antes de mayo.';

const PROPUESTAS: ProposedQuest[] = [
  {
    title: 'Rodaje suave de 5 km',
    stat: 'VIT',
    difficulty: 'media',
    days_of_week: [1, 3, 5],
    reasoning: 'Tres rodajes por semana construyen la base sin cargar las piernas.',
  },
  {
    title: 'Series: 6 × 800 m a ritmo de 10 km',
    stat: 'AGI',
    difficulty: 'dificil',
    days_of_week: [2],
    reasoning: 'Una sesión de calidad a la semana sube el umbral.',
  },
  {
    title: 'Tirada larga de 12 km',
    stat: 'VIT',
    difficulty: 'dificil',
    days_of_week: [7],
    reasoning: 'La distancia del objetivo y algo más, sin mirar el reloj.',
  },
  {
    title: 'Movilidad de cadera 10 minutos',
    stat: 'AGI',
    difficulty: 'facil',
    days_of_week: [1, 2, 3, 4, 5, 6, 7],
    reasoning: '',
  },
];

const RESUMEN =
  'Tienes **siete meses**. Basta con tres rodajes, una sesión de series y una tirada larga a la semana. El domingo es la prueba: si la tirada sale entera, la semana ha cumplido.';

function base(cambios: Partial<OraculoVistaProps> = {}): OraculoVistaProps {
  return {
    clavePropia: false,
    claveGuardada: false,
    objetivo: '',
    consultando: false,
    aceptando: false,
    pidePro: false,
    propuestas: [],
    seleccionadas: new Set(),
    resumen: '',
    errorConsulta: null,
    errorAceptar: null,
    acciones: {
      onVolver: nada,
      onObjetivo: nada,
      onConsultar: nada,
      onAlternar: nada,
      onAceptar: nada,
      onAbrirClave: nada,
      onVerPro: nada,
      onDenunciar: nada,
    },
    ...cambios,
  };
}

const VEREDICTO: Partial<OraculoVistaProps> = {
  objetivo: OBJETIVO,
  propuestas: PROPUESTAS,
  seleccionadas: new Set([0, 1, 2]),
  resumen: RESUMEN,
};

export const DEMO: DemoPantalla | null = {
  id: 'oraculo',
  titulo: 'Oráculo',
  marco: 'pila',
  estados: [
    { id: 'espera', titulo: 'Espera', render: () => <OraculoVista {...base()} /> },
    {
      id: 'deliberando',
      titulo: 'Deliberando',
      render: () => <OraculoVista {...base({ objetivo: OBJETIVO, consultando: true })} />,
    },
    { id: 'veredicto', titulo: 'Veredicto', render: () => <OraculoVista {...base(VEREDICTO)} /> },
    {
      id: 'sin-pro',
      titulo: 'Sin NIVL Pro',
      render: () => <OraculoVista {...base({ objetivo: OBJETIVO, pidePro: true })} />,
    },
    {
      id: 'error',
      titulo: 'Error al consultar',
      render: () => (
        <OraculoVista
          {...base({ objetivo: OBJETIVO, errorConsulta: 'Sin conexión. Revisa la red y vuelve a intentarlo.' })}
        />
      ),
    },
    {
      id: 'error-aceptar',
      titulo: 'Error al aceptar',
      render: () => (
        <OraculoVista
          {...base({ ...VEREDICTO, errorAceptar: 'El sistema ha fallado. Inténtalo de nuevo en un momento.' })}
        />
      ),
    },
    {
      id: 'clave-propia',
      titulo: 'Web · hoja de la clave propia',
      render: () => (
        <>
          <OraculoVista {...base({ clavePropia: true, claveGuardada: true })} />
          <HojaClave visible clave="" guardada onClave={nada} onGuardar={nada} onCerrar={nada} />
        </>
      ),
    },
  ],
};
