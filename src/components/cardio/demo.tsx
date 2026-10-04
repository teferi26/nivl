// Demo de la galería /kit/pantallas (solo desarrollo). FASE3 Lote E1.
//
// CardioVista con datos de mentira: sin sesión ni Supabase. Hoy es el día fijo
// de la galería (HOY_DEMO); las sesiones van hacia atrás desde él. Las
// acciones no hacen nada.
import type { DemoPantalla } from '@/components/arena/galeria';
import { HOY_DEMO } from '@/components/arena/demoDatos';
import type { CardioSession } from '@/lib/bodywork';
import { addDays } from '@/lib/dates';
import { CARDIO_DAILY_CAP } from '@/lib/game';
import { anuncioCardio } from '@/lib/pagoActo';
import { CardioVista, type CardioVistaProps } from './CardioVista';
import { HojaCardio, type HojaCardioProps } from './HojaCardio';

const nada = () => {};

function sesion(n: number, cambios: Partial<CardioSession>): CardioSession {
  return {
    id: `c${n}-${cambios.kind ?? 'correr'}`,
    date: addDays(HOY_DEMO, -n),
    kind: 'correr',
    distance_km: null,
    duration_min: 30,
    avg_hr: null,
    rpe: null,
    zone: 'Z2',
    notes: null,
    xp_awarded: 0,
    ...cambios,
  };
}

const SESIONES: CardioSession[] = [
  sesion(0, { distance_km: 5.2, duration_min: 31, avg_hr: 142, rpe: 6, xp_awarded: 20 }),
  sesion(2, { kind: 'nadar', distance_km: 1.5, duration_min: 40, zone: 'Z3', rpe: 7, xp_awarded: 25, notes: 'Series de 100 con 20 s de pausa. El hombro, bien.' }),
  sesion(3, { kind: 'bici', distance_km: 32.4, duration_min: 75, avg_hr: 131, xp_awarded: 25 }),
  sesion(5, { distance_km: 8, duration_min: 44.5, zone: 'intervalos', rpe: 8.5, avg_hr: 158, xp_awarded: 25, notes: '6 × 800 a ritmo de 10 km.' }),
  sesion(6, { kind: 'caminar', distance_km: 6.1, duration_min: 70, zone: 'Z1', xp_awarded: 10 }),
  sesion(9, { kind: 'remo', distance_km: 5, duration_min: 24, zone: 'Z4', rpe: 8, xp_awarded: 0 }),
  sesion(12, { distance_km: 10.5, duration_min: 62, avg_hr: 145, rpe: 6, xp_awarded: 25 }),
  sesion(16, { kind: 'otro', duration_min: 45, zone: 'libre', notes: 'Clase de spinning.', xp_awarded: 20 }),
  sesion(33, { distance_km: 4, duration_min: 25, xp_awarded: 20 }),
];

function base(cambios: Partial<CardioVistaProps> = {}): CardioVistaProps {
  return {
    cargado: true,
    errorCarga: null,
    hoy: HOY_DEMO,
    sesiones: SESIONES,
    anuncio: null,
    acciones: {
      onVolver: nada,
      onReintentar: nada,
      onRegistrar: nada,
      onBorrar: nada,
      onCerrarAnuncio: nada,
    },
    ...cambios,
  };
}

const HOJA: HojaCardioProps = {
  visible: true,
  kind: 'correr',
  zone: 'Z2',
  duracion: '',
  distancia: '5,2',
  rpe: '12',
  pulso: '',
  notas: '',
  guardando: false,
  errores: {
    duracion: 'Falta la duración. Sin minutos no hay sesión que registrar.',
    distancia: null,
    rpe: null,
    servidor: null,
  },
  onKind: nada,
  onZone: nada,
  onDuracion: nada,
  onDistancia: nada,
  onRpe: nada,
  onPulso: nada,
  onNotas: nada,
  onGuardar: nada,
  onCerrar: nada,
};

export const DEMO: DemoPantalla | null = {
  id: 'cardio',
  titulo: 'Cardio',
  marco: 'pila',
  estados: [
    {
      id: 'vacio',
      titulo: 'Vacío',
      render: () => <CardioVista {...base({ sesiones: [] })} />,
    },
    {
      id: 'lleno',
      titulo: 'Lleno',
      render: () => <CardioVista {...base()} />,
    },
    {
      id: 'anuncio',
      titulo: 'Recién registrada',
      render: () => (
        <CardioVista
          {...base({
            anuncio: {
              texto: anuncioCardio({
                xpMision: 15,
                marcadas: ['Correr 5 km'],
                xpModulo: 5,
                pedidoModulo: 5,
                misionYaPagada: false,
                esCorreccion: false,
                topeDiario: CARDIO_DAILY_CAP,
              }),
              pagado: true,
            },
          })}
        />
      ),
    },
    {
      id: 'hoja',
      titulo: 'Hoja con un fallo',
      render: () => (
        <>
          <CardioVista {...base()} />
          <HojaCardio {...HOJA} />
        </>
      ),
    },
    {
      id: 'cargando',
      titulo: 'Cargando',
      render: () => <CardioVista {...base({ cargado: false })} />,
    },
    {
      id: 'error',
      titulo: 'Error al cargar',
      render: () => (
        <CardioVista {...base({ cargado: false, errorCarga: 'Sin conexión. Revisa la red y vuelve a intentarlo.' })} />
      ),
    },
  ],
};
