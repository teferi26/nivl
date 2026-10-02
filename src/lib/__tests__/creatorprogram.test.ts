import {
  AVISO_GANANCIAS,
  AVISO_PUBLI,
  GUIONES,
  KIT_CLIPS,
  mesesHistorico,
  parseCreatorBoard,
  parseCreatorHistory,
  parseCreatorProgress,
  periodoTabla,
  PROHIBIDO,
  revisarTexto,
  RPC_PORTAL,
  vistaPanelCreador,
  type CreatorHistoryMonth,
  type DatosPanelCreador,
} from '../creatorprogram';
import type { CreatorPanel } from '../creators';

const UUID = '0f8fad5b-d9cb-469f-a165-70867728950e';

const PROGRESO_RPC = {
  alias: 'Alfa',
  code: 'AAA_TEST',
  role: 'clipper',
  rank: 'novato',
  pct: 25,
  base_cents: 10000,
  sales_90d: 3,
  months_active: 2,
  next_rank: 'pro',
  next_min_sales_90d: 5,
  next_min_months_active: 2,
  challenges: [
    { id: UUID, title: 'Reto de prueba', description: null, starts_at: '2026-10-01T00:00:00Z', ends_at: '2026-10-15T00:00:00Z', goal_sales: 3, prize: 'Premio de 100 €', role: null, sales: 1 },
    { id: UUID, title: 'Otro', description: 'Gana 50 euros', starts_at: '2026-10-01T00:00:00Z', ends_at: '2026-10-15T00:00:00Z', goal_sales: 2, prize: 'Sudadera', role: 'clipper', sales: 2 },
    null,
    { title: 'sin id' },
  ],
};

const PANEL: CreatorPanel = {
  alias: 'Alfa',
  code: 'AAA_TEST',
  rank: 'novato',
  pct: 25,
  baseCents: 10000,
  holdDays: 30,
  installs: 10,
  installsMonth: 4,
  sales: 3,
  salesMonth: 1,
  pendingCents: 2500,
  availableCents: 2500,
  clawbackCents: 2500,
  paidCents: 5000,
  monthlyFixedCents: 30000,
  position: 2,
  creators: 5,
  prize: 'Premio de 200 € al primero',
  payouts: [{ kind: 'comisiones', cents: 5000, at: '2026-09-01T00:00:00Z' }],
};

const HISTORICO: CreatorHistoryMonth[] = [
  { month: '2026-10', sales: 1, pendingCents: 2500, availableCents: 0, paidCents: 0, voidedCents: 0, clawbackCents: 0 },
  { month: '2026-09', sales: 2, pendingCents: 0, availableCents: 2500, paidCents: 2500, voidedCents: 2500, clawbackCents: 2500 },
];

const datos = (): DatosPanelCreador => ({
  panel: PANEL,
  progreso: parseCreatorProgress(PROGRESO_RPC),
  historico: HISTORICO,
  tabla: [
    { alias: 'Beta', sales: 2, pos: 1, isMe: false },
    { alias: 'Gana 500€ conmigo', sales: 1, pos: 2, isMe: false },
    { alias: 'Alfa', sales: 1, pos: 2, isMe: true },
  ],
});

describe('parseo defensivo de las RPC 0046', () => {
  it('creator_progress', () => {
    const p = parseCreatorProgress(PROGRESO_RPC)!;
    expect(p).toMatchObject({ code: 'AAA_TEST', role: 'clipper', rank: 'novato', sales90d: 3, monthsActive: 2, nextRank: 'pro', nextMinSales90d: 5 });
    expect(p.challenges).toHaveLength(2);
    expect(p.challenges[1].role).toBe('clipper');
  });

  it('null, arrays, rangos y roles raros', () => {
    expect(parseCreatorProgress(null)).toBeNull();
    expect(parseCreatorProgress([])).toBeNull();
    expect(parseCreatorProgress({ alias: 'x' })).toBeNull();
    const p = parseCreatorProgress({ code: 'X_1', rank: 'dios', role: 'jefe', next_rank: null, next_min_sales_90d: null, challenges: 'no' })!;
    expect(p).toMatchObject({ rank: 'novato', role: 'creador', nextRank: null, nextMinSales90d: null, challenges: [] });
  });

  it('histórico y tabla', () => {
    expect(parseCreatorHistory([{ month: '2026-10', sales: '2', pending_cents: '2500' }, { month: 'x' }, null])).toEqual([
      { month: '2026-10', sales: 2, pendingCents: 2500, availableCents: 0, paidCents: 0, voidedCents: 0, clawbackCents: 0 },
    ]);
    expect(parseCreatorHistory(null)).toEqual([]);
    expect(parseCreatorBoard([{ alias: 'A', sales: '3', pos: 1, is_me: 'true' }, { sales: 1 }])).toEqual([
      { alias: 'A', sales: 3, pos: 1, isMe: false },
    ]);
  });

  it('periodos y meses', () => {
    expect(periodoTabla('mes')).toBe('mes');
    expect(periodoTabla(`reto:${UUID.toUpperCase()}`)).toBe(`reto:${UUID}`);
    expect(periodoTabla('reto:1; drop')).toBeNull();
    expect(periodoTabla('semana')).toBeNull();
    expect(periodoTabla(null)).toBeNull();
    expect([mesesHistorico(100), mesesHistorico(0), mesesHistorico('x'), mesesHistorico(6)]).toEqual([24, 1, 12, 6]);
  });

  it('el contrato del portal nombra las RPC de verdad', () => {
    expect(RPC_PORTAL).toEqual({
      panel: 'creator_panel',
      progreso: 'creator_progress',
      historico: 'creator_sales_history',
      tabla: 'creator_board_period',
    });
  });
});

describe('vistaPanelCreador: en tienda, ni un importe', () => {
  const CLAVES_DINERO = /cents|pct|base|paid|payout|fixed|pending|available|clawback|voided/i;

  it.each(['ios', 'android'])('%s: sin €, sin céntimos, sin %% y con el aviso informativo', (plataforma) => {
    const v = vistaPanelCreador(plataforma, datos())!;
    expect(v.conImportes).toBe(false);
    const json = JSON.stringify(v);
    expect(json).not.toMatch(/€|\beuros?\b|\$/i);
    expect(json).not.toMatch(/ %|"pct"/);
    const claves: string[] = [];
    JSON.stringify(v, (k, val) => {
      if (k) claves.push(k);
      return val;
    });
    expect(claves.filter((k) => CLAVES_DINERO.test(k))).toEqual([]);
    // Lo que sí: rango, ventas, retos, tabla.
    expect(v).toMatchObject({ rank: 'novato', rangoLabel: 'Creador novato', sales: 3, salesMonth: 1, sales90d: 3, installs: 10 });
    expect(v.retos).toHaveLength(2);
    expect(v.retos[0].prize).toBeNull();
    expect(v.retos[1].prize).toBe('Sudadera');
    expect(v.retos[1].description).toBeNull();
    expect(v.tabla.map((r) => r.alias)).toEqual(['Beta', 'Creador', 'Alfa']);
    expect(v.historico).toEqual([
      { month: '2026-10', sales: 1 },
      { month: '2026-09', sales: 2 },
    ]);
    expect(v.aviso).toBe(AVISO_GANANCIAS);
    expect(v.aviso).toBe('Tus ganancias se gestionan en nivl.app.');
    expect(v.enlaceAviso).toBe('https://nivl.app');
    expect(v.enlace).toBe('https://nivl.app/c/AAA_TEST');
  });

  it('un alias propio con dinero cae en el código en tienda', () => {
    const v = vistaPanelCreador('ios', { panel: { ...PANEL, alias: 'Gana 1000 euros' }, progreso: null })!;
    expect(v.alias).toBe('AAA_TEST');
  });

  it.each([
    '+10 % de comisión',
    'Sube tu comisión',
    'Cobras al instante',
    'Pago doble este mes',
    'Te pagamos el viaje',
    'Más dinero',
    'Ganancias x2',
  ])('reto con vocabulario de cobro («%s») no llega a la tienda', (texto) => {
    const base = parseCreatorProgress({
      ...PROGRESO_RPC,
      challenges: [{ ...PROGRESO_RPC.challenges[1], title: texto, description: texto, prize: texto }],
    });
    const v = vistaPanelCreador('ios', { panel: PANEL, progreso: base })!;
    expect(v.retos[0]).toMatchObject({ title: 'Reto', description: null, prize: null });
  });

  it('textos neutros pasan en tienda', () => {
    const base = parseCreatorProgress({
      ...PROGRESO_RPC,
      challenges: [{ ...PROGRESO_RPC.challenges[1], title: 'Reto de octubre: 5 altas', description: 'Página de tu código', prize: 'Sudadera' }],
    });
    const v = vistaPanelCreador('android', { panel: PANEL, progreso: base })!;
    expect(v.retos[0]).toMatchObject({ title: 'Reto de octubre: 5 altas', description: 'Página de tu código', prize: 'Sudadera' });
  });

  it('web: con importes', () => {
    const v = vistaPanelCreador('web', datos())!;
    expect(v.conImportes).toBe(true);
    if (!v.conImportes) throw new Error('web sin importes');
    expect(v).toMatchObject({ pct: 25, pendingCents: 2500, availableCents: 2500, clawbackCents: 2500, paidCents: 5000, prize: PANEL.prize });
    expect(v.historico).toEqual(HISTORICO);
    expect(v.retos[0].prize).toBe('Premio de 100 €');
  });

  it('no creador: null', () => {
    expect(vistaPanelCreador('ios', { panel: null, progreso: null })).toBeNull();
  });

  it('progreso de rango sin datos de dinero', () => {
    const v = vistaPanelCreador('android', datos())!;
    expect(v.progreso).toEqual({ merecido: 'novato', siguiente: 'pro', umbral: 5, faltan: 2, fraccion: 0.6 });
  });
});

describe('kit de clips', () => {
  it('guiones de 15, 30 y 60 s, todos con #publi', () => {
    expect(GUIONES.map((g) => g.segundos)).toEqual([15, 30, 60]);
    for (const g of GUIONES) expect(g.tramos.some(([, t]) => t.includes(AVISO_PUBLI))).toBe(true);
    expect(KIT_CLIPS.prohibido).toBe(PROHIBIDO);
    expect(PROHIBIDO.map((p) => p.id).sort()).toEqual(
      ['gratis_para_siempre', 'incentivo_valoracion', 'precio_inventado', 'promesa_resultados', 'sin_publi'],
    );
  });

  it('el kit no lleva ni un precio inventado', () => {
    const todo = [...KIT_CLIPS.ganchos, ...KIT_CLIPS.guiones.flatMap((g) => g.tramos.map(([, t]) => t)), ...KIT_CLIPS.marca].join('\n');
    expect(revisarTexto(`${AVISO_PUBLI} ${todo}`).faltas).toEqual([]);
  });

  it('un guion limpio pasa', () => {
    expect(revisarTexto('#publi Llevo 30 días sin fallar. Pro anual a 99,99 €. Mi código: AAA_TEST')).toEqual({ ok: true, faltas: [] });
    expect(revisarTexto('#publi El Élite sale a 24,92 € al mes con el anual.').ok).toBe(true);
  });

  it('atrapa lo prohibido', () => {
    const ids = (t: string) => revisarTexto(t).faltas.map((f) => f.id);
    expect(ids('Descárgala ya')).toEqual(['sin_publi']);
    expect(ids('#publi Solo 4,99 € al mes')).toEqual(['precio_inventado']);
    expect(ids('#publi Es gratis para siempre')).toEqual(['gratis_para_siempre']);
    expect(ids('#publi Resultados garantizados')).toEqual(['promesa_resultados']);
    expect(ids('#publi Pierdes 5 kg en un mes')).toEqual(['promesa_resultados']);
    expect(ids('#publi Déjale 5 estrellas y entras en el sorteo')).toEqual(['incentivo_valoracion']);
    expect(ids('#publi Descárgala y te regalo un mes')).toEqual(['incentivo_valoracion']);
  });
});
