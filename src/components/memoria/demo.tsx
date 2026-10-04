// Demo de la galería /kit/pantallas (solo desarrollo). FASE3 G1 · Memoria.
//
// MemoriaVista con datos de mentira: sin sesión ni Supabase. Las acciones no
// hacen nada.
import type { DemoPantalla } from '@/components/arena/galeria';
import type { CoachFact } from '@/lib/coach';
import { MemoriaVista, type MemoriaVistaProps } from './MemoriaVista';

const nada = () => {};

function hecho(n: number, date: string, category: string, content: string): CoachFact {
  return { id: `h${n}`, date, category, content, source: 'coach' };
}

const HECHOS: CoachFact[] = [
  hecho(1, '2026-10-01', 'venta', 'Cerró la propuesta de Ibérica: 4.800 € al año, pago trimestral.'),
  hecho(2, '2026-09-30', 'metrica', 'Peso en ayunas: 78,4 kg. Tendencia de 4 semanas: 0,3 kg menos por semana.'),
  hecho(3, '2026-09-28', 'aprendizaje', 'Las reuniones sin orden del día se le alargan el doble. Decide no ir a ninguna sin agenda.'),
  hecho(4, '2026-09-27', 'objetivo', 'Correr 10 km en menos de 55 minutos antes de mayo.'),
  hecho(5, '2026-09-25', 'regla', 'Pacta no mirar el móvil hasta después de entrenar.'),
  hecho(6, '2026-09-22', 'proyecto', 'Abandona la tienda de camisetas: no vende y le quita las tardes.'),
  hecho(7, '2026-09-20', 'perfil', 'Rinde mejor por la mañana; a partir de las 18:00 baja el foco.'),
  hecho(8, '2026-09-18', 'log', 'Semana con tres entrenos de cuatro: falló el jueves por un viaje.'),
];

const DOSSIER = {
  version: 7,
  content:
    '**Teferi**, emprendedor. Vende servicios a empresas y entrena cuatro días por semana.\n\n**Objetivo del año**: correr 10 km en menos de 55 minutos y cerrar 60.000 € de ventas.\n\n**Lo que funciona**: empezar el día por lo difícil, entrenar antes de abrir el correo, las semanas planificadas el domingo.\n\n**Lo que le cuesta**: las tardes, las reuniones sin agenda y dormir menos de siete horas cuando hay viaje.\n\n**Reglas pactadas**: nada de alcohol entre semana, el móvil después de entrenar.',
};

function base(cambios: Partial<MemoriaVistaProps> = {}): MemoriaVistaProps {
  return {
    cargando: false,
    error: null,
    dossier: DOSSIER,
    hechos: HECHOS,
    gasto: 1.87,
    filtro: 'todo',
    dossierAbierto: false,
    acciones: {
      onVolver: nada,
      onFiltro: nada,
      onAlternarDossier: nada,
      onAbrirHecho: nada,
      onReintentar: nada,
    },
    ...cambios,
  };
}

export const DEMO: DemoPantalla | null = {
  id: 'memoria',
  titulo: 'Memoria',
  marco: 'pila',
  estados: [
    { id: 'llena', titulo: 'Llena', render: () => <MemoriaVista {...base()} /> },
    { id: 'dossier-abierto', titulo: 'Dossier abierto', render: () => <MemoriaVista {...base({ dossierAbierto: true })} /> },
    { id: 'filtrada', titulo: 'Filtrada por ventas', render: () => <MemoriaVista {...base({ filtro: 'venta' })} /> },
    {
      id: 'vacia',
      titulo: 'Vacía',
      render: () => <MemoriaVista {...base({ dossier: null, hechos: [], gasto: 0 })} />,
    },
    { id: 'cargando', titulo: 'Cargando', render: () => <MemoriaVista {...base({ cargando: true })} /> },
    {
      id: 'error',
      titulo: 'Error',
      render: () => (
        <MemoriaVista
          {...base({ dossier: null, hechos: [], gasto: null, error: 'Sin conexión. Revisa la red y vuelve a intentarlo.' })}
        />
      ),
    },
  ],
};
