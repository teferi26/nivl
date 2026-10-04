// Demo de la galería /kit/pantallas (solo desarrollo). FASE3 Lote F.
//
// La lista (ResumenVista) y el pase (PaseVista) con datos de mentira: sin
// sesión, sin Supabase y sin URL firmadas. La foto de evidencia es un PNG
// diminuto en línea (un damero gris), para ver la columna 9:16 a cualquier
// ancho. El pase de la galería no avanza solo: la barra se queda donde se
// le dice. Las acciones no hacen nada.
import { Animated } from 'react-native';
import type { DemoPantalla } from '@/components/arena/galeria';
import { HOY_DEMO } from '@/components/arena/demoDatos';
import { addDays } from '@/lib/dates';
import type { Recap, Slide } from '@/lib/photos';
import { PaseVista, type PaseVistaProps } from './PaseVista';
import { ResumenVista, type ResumenVistaProps } from './ResumenVista';

const nada = () => {};

const FOTO =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACQAAABACAIAAAD9B0KDAAAAXklEQVR42u3YsQkAIAwEQMdxEkd0XgcISAoV0UstXiH/EEsLU8OsOlNgsCm27+p4BgabY0IN0413YD0xsHNY5qkz2LKcwT7GhBqmG2Ew3QjTjbeG2pprp4bB/Dc+gg2+bF4y3g4KHQAAAABJRU5ErkJggg==';

const SLIDES: Slide[] = [
  { tipo: 'portada', titulo: 'Semana del 21 de septiembre', texto: 'Cinco días de siete. Esto es lo que dejaste escrito.' },
  { tipo: 'dato', dato: '12', titulo: 'Misiones con evidencia', texto: 'El doble que la semana anterior: tu palabra, respaldada.' },
  {
    tipo: 'foto',
    foto: 'demo/1.jpg',
    titulo: 'Martes, 7:05',
    texto: 'Sentadilla a 100 kg. La primera vez que el número redondo cae.',
  },
  { tipo: 'duro', titulo: 'El jueves no apareciste', texto: 'Ni gimnasio ni diario. No pasa nada si el viernes vuelves; y volviste.' },
  { tipo: 'cierre', titulo: 'La semana queda escrita', texto: 'Lo siguiente lo decides mañana a las siete.' },
];

function recap(n: number, cambios: Partial<Recap> = {}): Recap {
  const inicio = addDays(HOY_DEMO, -7 * n - 4);
  return {
    id: `r${n}`,
    kind: 'semanal',
    period_start: inicio,
    period_end: addDays(inicio, 6),
    slides: SLIDES,
    photo_count: 4,
    seen_at: `${addDays(inicio, 7)}T10:00:00Z`,
    created_at: `${addDays(inicio, 7)}T08:00:00Z`,
    ...cambios,
  };
}

const RECAPS: Recap[] = [
  recap(0, { seen_at: null }),
  recap(1),
  recap(2, { photo_count: 2 }),
  recap(4, { kind: 'mensual', period_start: '2026-09-01', period_end: '2026-09-30', photo_count: 17 }),
];

function lista(cambios: Partial<ResumenVistaProps> = {}): ResumenVistaProps {
  return {
    cargado: true,
    errorCarga: null,
    recaps: RECAPS,
    generando: false,
    aviso: null,
    pidePro: false,
    refrescando: false,
    acciones: {
      onVolver: nada,
      onRefrescar: nada,
      onReintentar: nada,
      onGenerar: nada,
      onVerPro: nada,
      onAbrir: nada,
    },
    ...cambios,
  };
}

function pase(i: number, cambios: Partial<PaseVistaProps> = {}): PaseVistaProps {
  return {
    recap: RECAPS[0]!,
    i,
    foto: SLIDES[i]?.foto ? FOTO : undefined,
    progreso: new Animated.Value(0.4),
    auto: true,
    pausado: false,
    compartiendo: false,
    onAnterior: nada,
    onSiguiente: nada,
    onPausar: nada,
    onSeguir: nada,
    onCompartir: nada,
    onSalir: nada,
    ...cambios,
  };
}

export const DEMO: DemoPantalla | null = {
  id: 'resumen',
  titulo: 'Recuerdos',
  marco: 'pila',
  estados: [
    {
      id: 'lista',
      titulo: 'Lista (uno sin ver)',
      render: () => <ResumenVista {...lista()} />,
    },
    {
      id: 'sin-pro',
      titulo: 'Sin NIVL Pro',
      render: () => (
        <ResumenVista
          {...lista({
            pidePro: true,
            aviso:
              'El pase de la semana lo monta el coach, y el coach es parte de NIVL Pro. Tus fotos y tus recuerdos guardados siguen aquí.',
          })}
        />
      ),
    },
    {
      id: 'generando',
      titulo: 'Generando',
      render: () => <ResumenVista {...lista({ generando: true })} />,
    },
    {
      id: 'vacio',
      titulo: 'Vacío',
      render: () => <ResumenVista {...lista({ recaps: [], aviso: 'Sin fotos esta semana.' })} />,
    },
    {
      id: 'cargando',
      titulo: 'Cargando',
      render: () => <ResumenVista {...lista({ cargado: false, recaps: [] })} />,
    },
    {
      id: 'error',
      titulo: 'Error al cargar',
      render: () => (
        <ResumenVista {...lista({ recaps: [], errorCarga: 'Sin conexión. Revisa la red y vuelve a intentarlo.' })} />
      ),
    },
    {
      id: 'pase-portada',
      titulo: 'Pase: portada',
      render: () => <PaseVista {...pase(0)} />,
    },
    {
      id: 'pase-dato',
      titulo: 'Pase: el dato, en pausa',
      render: () => <PaseVista {...pase(1, { pausado: true })} />,
    },
    {
      id: 'pase-foto',
      titulo: 'Pase: foto (columna 9:16)',
      render: () => <PaseVista {...pase(2)} />,
    },
    {
      id: 'pase-quieto',
      titulo: 'Pase: lo duro, sin avance solo',
      render: () => <PaseVista {...pase(3, { auto: false })} />,
    },
    {
      id: 'pase-cierre',
      titulo: 'Pase: cierre',
      render: () => <PaseVista {...pase(4, { auto: false })} />,
    },
  ],
};
