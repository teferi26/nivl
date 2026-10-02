// Demo de la galería /kit/pantallas (solo desarrollo). Lo rellena el encargo
// de esta pantalla del rediseño L-RADICAL (docs/design-v2/L-RADICAL.md §C).
//
// CoachVista con datos de mentira: sin sesión, sin Supabase, sin voz real.
// Las acciones no hacen nada; «Pro» y «Memoria» navegan como en la app.
import { router } from 'expo-router';
import type { DemoPantalla } from '@/components/arena/galeria';
import { CoachVista, type BurbujaVista, type CoachVistaProps } from './CoachVista';
import type { Dictado } from './Dictado';

const nada = () => {};

// Copia de src/app/kit.tsx (no se importa de una ruta).
const dictadoDemo = (grabando: boolean): Dictado => ({
  grabando, preparando: false, parcial: grabando ? 'Hoy he hecho sentadilla a cien kilos' : '', ms: 4200,
  cancelaria: false, empezar: async () => false, mover: nada, soltar: nada, alternar: nada, cancelar: nada,
});

const AHORA = Date.now();
const ayer = new Date(AHORA - 86400000).toISOString();
const hoy = new Date(AHORA).toISOString();
const voz = { estado: 'quieto' as const, onEscuchar: nada, onParar: nada };

const HILO: BurbujaVista[] = [
  { id: 'u1', role: 'user', text: '¿Qué toca mañana?', acciones: [], cita: null, fecha: ayer },
  {
    id: 'c1',
    role: 'assistant',
    text: 'Mañana toca tirón. Remo con barra, dominadas y curl. Acuéstate antes de las doce.',
    acciones: [{ texto: 'Bloque de entreno movido a las 18:30', ok: true }],
    cita: 'Consultado: tu historial',
    fecha: ayer,
    voz,
    onDenunciar: nada,
  },
  { id: 'u2', role: 'user', text: 'Te he subido el gimnasio de hoy.', acciones: [], cita: null, fecha: hoy },
  {
    id: 'c2',
    role: 'assistant',
    text: 'Visto. Banca 82,5 kg por 5: récord, +25 XP. La misión «Entrenar» se marcó sola. Mañana toca tirón: no repitas pecho.',
    acciones: [{ texto: 'Misión completada: Entrenar', ok: true }],
    cita: 'Consultado: tu historial y tu registro del día',
    fecha: hoy,
    voz,
    onDenunciar: nada,
  },
];

function base(cambios: Partial<CoachVistaProps> = {}): CoachVistaProps {
  return {
    cargando: false,
    sinPro: false,
    vacio: false,
    kind: 'deportista',
    ofertaCerrado: null,
    falloCarga: false,
    onReintentar: nada,
    consultas: 2,
    profundo: false,
    burbujas: HILO,
    enCurso: null,
    error: null,
    onAtajo: nada,
    adjuntas: 0,
    onQuitarAdjuntas: nada,
    energia: null,
    potencia: null,
    compositor: {
      texto: '',
      onCambiarTexto: nada,
      onTeclear: nada,
      puedeEnviar: false,
      onEnviar: nada,
      ocupado: false,
      conDictado: true,
      grabando: false,
      dictado: dictadoDemo(false),
      avisoDictado: null,
      onAdjuntar: nada,
    },
    onPro: () => router.push('/pro'),
    onMemoria: () => router.push('/memoria'),
    ...cambios,
  };
}

const compositor = base().compositor;

export const DEMO: DemoPantalla | null = {
  id: 'coach',
  titulo: 'Coach',
  estados: [
    {
      id: 'conversacion',
      titulo: 'Conversación',
      render: () => (
        <CoachVista
          {...base({
            profundo: true,
            potencia: { modo: 'profundo', profundoAbierto: true, linea: 'Te quedan 3 turnos profundos este mes.', onElegir: nada },
            compositor: { ...compositor, texto: 'Y mañana, ¿cuánto peso en remo?', puedeEnviar: true },
          })}
        />
      ),
    },
    {
      // El hilo empezado con el cuadro vacío: se ven las píldoras de acción
      // rápida y el micrófono fijo junto a enviar (Pro, sin grabar, sin turno).
      id: 'conversacion-lista',
      titulo: 'Conversación lista',
      render: () => <CoachVista {...base({ burbujas: HILO.slice(0, 2) })} />,
    },
    {
      id: 'vacio-pro',
      titulo: 'Vacío con Pro',
      render: () => <CoachVista {...base({ vacio: true, burbujas: [], consultas: 0 })} />,
    },
    {
      id: 'bloqueado',
      titulo: 'Bloqueado',
      render: () => <CoachVista {...base({ sinPro: true, vacio: true, burbujas: [], consultas: 0, ofertaCerrado: 'pro' })} />,
    },
    {
      id: 'pensando',
      titulo: 'Pensando',
      render: () => (
        <CoachVista
          {...base({
            burbujas: [...HILO, { id: 'u3', role: 'user', text: 'Planifica el resto de mi día de hoy.', acciones: [], cita: null }],
            enCurso: { texto: '', pensando: true, acciones: [], cita: null },
            compositor: { ...compositor, ocupado: true },
          })}
        />
      ),
    },
    {
      id: 'energia',
      titulo: 'Energía agotada',
      render: () => (
        <CoachVista
          {...base({
            energia: {
              texto: 'La energía del coach de este mes se ha agotado. Se recarga el día 1.',
              ofertaTier: 'elite',
              avisoAparte: null,
            },
          })}
        />
      ),
    },
    {
      id: 'cargando',
      titulo: 'Cargando',
      render: () => <CoachVista {...base({ cargando: true })} />,
    },
    {
      id: 'grabando',
      titulo: 'Grabando',
      render: () => (
        <CoachVista {...base({ compositor: { ...compositor, grabando: true, dictado: dictadoDemo(true) } })} />
      ),
    },
  ],
};
