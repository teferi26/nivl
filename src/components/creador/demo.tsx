// Demo de la galería /kit/pantallas (solo desarrollo). FASE3 G2 · Creador.
//
// CreadorVista con un creador de mentira: sin sesión ni Supabase. La vista se
// construye con el mismo selector que la pantalla (`vistaPanelCreador` de
// creatorprogram.ts): con 'ios' sale la de tienda (sin un céntimo ni un %) y
// con 'web' la del portal y nivl.app (con el dinero propio). El portal
// (SITIO_CREADORES) se simula con `portal`. Las acciones no hacen nada.
import type { DemoPantalla } from '@/components/arena/galeria';
import { vistaPanelCreador, type CreatorHistoryMonth, type CreatorProgress } from '@/lib/creatorprogram';
import type { CreatorBoardRow, CreatorPanel } from '@/lib/creators';
import { CreadorVista, type CreadorVistaProps } from './CreadorVista';

const nada = () => {};

const PANEL: CreatorPanel = {
  alias: 'Marta Fit',
  code: 'MARTAFIT',
  rank: 'pro',
  pct: 35,
  baseCents: 10000,
  holdDays: 30,
  installs: 184,
  installsMonth: 23,
  sales: 41,
  salesMonth: 6,
  pendingCents: 21000,
  availableCents: 8750,
  clawbackCents: 3500,
  paidCents: 64500,
  monthlyFixedCents: 15000,
  position: 2,
  creators: 14,
  prize: 'Sudadera NIVL edición arena para el primero del mes',
  payouts: [
    { kind: 'comisiones', cents: 24500, at: '2026-09-05T10:00:00Z' },
    { kind: 'fijo_mensual', cents: 15000, at: '2026-09-05T10:00:00Z' },
    { kind: 'premio', cents: 10000, at: '2026-08-05T10:00:00Z' },
    { kind: 'comisiones', cents: 15000, at: '2026-08-05T10:00:00Z' },
  ],
};

const PROGRESO: CreatorProgress = {
  alias: 'Marta Fit',
  code: 'MARTAFIT',
  role: 'creador',
  rank: 'pro',
  pct: 35,
  baseCents: 10000,
  sales90d: 17,
  monthsActive: 4,
  nextRank: 'elite',
  nextMinSales90d: 30,
  nextMinMonthsActive: 3,
  challenges: [
    {
      id: 'r1',
      title: 'Octubre en la arena',
      description: '10 ventas en el mes y entras en el sorteo del viaje del equipo.',
      startsAt: '2026-10-01T00:00:00Z',
      endsAt: '2030-01-01T00:00:00Z',
      goalSales: 10,
      prize: 'Plaza en el viaje del equipo',
      role: null,
      sales: 6,
    },
    {
      id: 'r2',
      title: 'Primeras cinco',
      description: null,
      startsAt: '2026-06-01T00:00:00Z',
      endsAt: '2030-01-01T00:00:00Z',
      goalSales: 5,
      prize: null,
      role: null,
      sales: 5,
    },
  ],
};

function mesH(month: string, sales: number): CreatorHistoryMonth {
  return { month, sales, pendingCents: 0, availableCents: 0, paidCents: 0, voidedCents: 0, clawbackCents: 0 };
}

const HISTORICO: CreatorHistoryMonth[] = [
  mesH('2026-10', 6),
  mesH('2026-09', 9),
  mesH('2026-08', 7),
  mesH('2026-07', 4),
  mesH('2026-06', 0),
];

const TABLA: CreatorBoardRow[] = [
  { alias: 'Dani Calistenia', sales: 9, pos: 1, isMe: false },
  { alias: 'Marta Fit', sales: 6, pos: 2, isMe: true },
  { alias: 'Estudia con Leo', sales: 4, pos: 3, isMe: false },
  { alias: 'Runner Bea', sales: 0, pos: 4, isMe: false },
];

const DATOS = { panel: PANEL, progreso: PROGRESO, historico: HISTORICO, tabla: TABLA };

const ERROR = 'Sin conexión. Revisa la red y vuelve a intentarlo.';

function base(cambios: Partial<CreadorVistaProps> = {}, plataforma = 'ios'): CreadorVistaProps {
  return {
    cargado: true,
    error: null,
    vista: vistaPanelCreador(plataforma, DATOS),
    holdDays: PANEL.holdDays,
    portal: false,
    refrescando: false,
    copiado: false,
    cerrando: false,
    acciones: {
      onSalir: nada,
      onRefrescar: nada,
      onCerrarSesion: nada,
      onCompartir: nada,
      onCopiar: nada,
    },
    ...cambios,
  };
}

export const DEMO: DemoPantalla | null = {
  id: 'creador',
  titulo: 'Creador',
  marco: 'pila',
  estados: [
    { id: 'tienda', titulo: 'App de tienda (sin dinero)', render: () => <CreadorVista {...base()} /> },
    { id: 'web', titulo: 'Web (con el dinero propio)', render: () => <CreadorVista {...base({}, 'web')} /> },
    { id: 'portal', titulo: 'Portal de creadores', render: () => <CreadorVista {...base({ portal: true }, 'web')} /> },
    {
      id: 'novato',
      titulo: 'Recién llegado (tienda)',
      render: () => (
        <CreadorVista
          {...base({
            copiado: true,
            vista: vistaPanelCreador('ios', {
              panel: { ...PANEL, rank: 'novato', installs: 3, installsMonth: 3, sales: 0, salesMonth: 0, position: null, payouts: [] },
              progreso: { ...PROGRESO, rank: 'novato', sales90d: 0, monthsActive: 0, nextRank: 'pro', nextMinSales90d: 10, challenges: [] },
              historico: [],
              tabla: [],
            }),
          })}
        />
      ),
    },
    {
      id: 'web-sin-pagos',
      titulo: 'Web sin pagos todavía',
      render: () => (
        <CreadorVista
          {...base({
            vista: vistaPanelCreador('web', {
              ...DATOS,
              panel: { ...PANEL, paidCents: 0, clawbackCents: 0, monthlyFixedCents: 0, prize: null, payouts: [] },
            }),
          })}
        />
      ),
    },
    { id: 'cargando', titulo: 'Cargando', render: () => <CreadorVista {...base({ cargado: false })} /> },
    { id: 'error', titulo: 'Error al cargar', render: () => <CreadorVista {...base({ vista: null, error: ERROR })} /> },
    { id: 'error-con-datos', titulo: 'Error al refrescar', render: () => <CreadorVista {...base({ error: ERROR })} /> },
    { id: 'sin-panel', titulo: 'No es creador (app)', render: () => <CreadorVista {...base({ vista: null })} /> },
    {
      id: 'portal-sin-panel',
      titulo: 'No es creador (portal)',
      render: () => <CreadorVista {...base({ vista: null, portal: true })} />,
    },
  ],
};
