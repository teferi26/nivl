// NIVL · Modo GENERAL: estados de demo para la galería /kit/general (solo
// desarrollo). Las vistas son puras: aquí se derivan los datos de mentira (los
// mismos de /kit/pantallas para Hoy y Campañas) y se pasan por props.
import { useMemo, useState, type ReactNode } from 'react';
import { HOY_DEMO, perfilDemo } from '@/components/arena/demoDatos';
import { baseAmigosDemo, filasAmigosDemo, RIVALES_DEMO, SOLICITUD_DEMO, YO_AMIGOS_DEMO } from '@/components/amigos/demo';
import { campanaDemo, detalleCampanaDemo, listaCampanasDemo, tareaDemo, TAREAS_DEMO } from '@/components/campanas/demo';
import { ACCIONES_PERFIL_DEMO, ajustesPerfilDemo, datosPerfilDemo } from '@/components/perfil/demo';
import type { Duelo } from '@/lib/competicionData';
import { ArenaGeneralVista } from './arena/ArenaGeneralVista';
import { CampanaGeneralVista } from './CampanaGeneralVista';
import { PerfilGeneralVista } from './PerfilGeneralVista';
import { derivarHoy, type EntradaHoy } from '@/components/hoy/derivarHoy';
import { baseHoyDemo, hechaDemo, todasDemo } from '@/components/hoy/demo';
import { ACHIEVEMENTS_VISIBLES } from '@/lib/achievements';
import { addDays } from '@/lib/dates';
import { estadoDe } from '@/lib/progression';
import type { Quest } from '@/lib/types';
import { nivelesDeModos } from '@/modos/niveles';
import { ArsenalModos } from './Arsenal';
import { AvanceVista, type SegmentoAvance } from './AvanceVista';
import { CampanasGeneralVista } from './CampanasGeneralVista';
import type { DatosAvance } from './derivarAvance';
import { HoyGeneralVista, type CampanaActivaHoy } from './HoyGeneralVista';
import type { DatosProgresion } from './useAvanceGeneral';

const nada = () => {};

const ARSENAL = (
  <ArsenalModos
    modos={['iron', 'focus', 'work', 'founder']}
    niveles={nivelesDeModos(['iron', 'focus', 'work', 'founder'], { iron: 2160 + 9000, focus: 3100, work: 5200, founder: 600 })}
    onEquipar={nada}
  />
);

const CAMPANA: CampanaActivaHoy = { id: 'c1', titulo: 'Winter Arc', hechas: 20, total: 90, plazo: '70 días', rango: 'A' };

function HoyDemo({ entrada, estado = 'listo', campana = CAMPANA }: { entrada: EntradaHoy; estado?: 'cargando' | 'listo'; campana?: CampanaActivaHoy | null }) {
  const [completions, setCompletions] = useState(entrada.completions);
  const datos = useMemo(() => derivarHoy({ ...entrada, completions }), [entrada, completions]);
  return (
    <HoyGeneralVista
      hoy={{
        estado,
        error: null,
        datos,
        ocupada: null,
        refrescando: false,
        preparandoTarjeta: false,
        acciones: {
          onCompletar: (q: Quest) => setCompletions((c) => ({ ...c, [q.id]: hechaDemo(q, 30) })),
          onAlternarBloque: nada,
          onCompartirDia: nada,
          onRefrescar: nada,
          onReintentar: nada,
        },
      }}
      arsenal={ARSENAL}
      campana={campana}
      ir={{ perfil: nada, progresion: nada, coach: nada, habitos: nada, campana: nada, campanas: nada, acceso: nada }}
    />
  );
}

const XP_SEMANAS = [820, 1140, 960, 1310, 1220, 1480, 1390, 1615];
const AVANCE: DatosAvance = {
  semanas: XP_SEMANAS.map((xp, i) => ({ inicio: addDays(HOY_DEMO, -7 * (7 - i) - 6), xp })),
  xpSemana: 1615,
  delta: 16,
  dias: Array.from({ length: 28 }, (_, i) => {
    const programadas = i % 7 === 6 ? 0 : 5;
    const hechas = programadas === 0 ? 0 : [5, 4, 5, 3, 5, 5, 2, 5, 4, 5][i % 10]!;
    return { fecha: addDays(HOY_DEMO, i - 27), hechas: i === 9 ? 0 : hechas, programadas };
  }),
  cumplimiento7: 86,
  cumplimiento28: 81,
  rachaActual: 20,
  rachaMejor: 34,
  diasActivos28: 23,
  stats: [
    { stat: 'FUE', total: 4120, semana: 420 },
    { stat: 'VIT', total: 2210, semana: 180 },
    { stat: 'INT', total: 3890, semana: 515 },
    { stat: 'AGI', total: 1460, semana: 260 },
    { stat: 'PER', total: 1980, semana: 240 },
  ],
};

const INFORME =
  'Esta semana: 31 misiones y 1.615 XP. Un 16 % más que la anterior. Domina INT (Intelecto). Tu mejor día fue el martes con 340 XP.';

function progresion(): DatosProgresion {
  const logros = new Set(['first_quest', 'first_day', 'quests_10', 'quests_50', 'streak_7', 'rango_D', 'rango_C', 'rango_B']);
  return {
    estado: estadoDe(perfilDemo(), logros, 196),
    diasActivos: 196,
    logros: ACHIEVEMENTS_VISIBLES().slice(0, 12).map((a) => ({ code: a.code, nombre: a.name, desc: a.desc, titulo: a.title, ganado: logros.has(a.code) })),
    botin: [
      { id: 'c5', titulo: 'Primer cliente de pago', rango: 'C', xp: 300, fecha: '2026-09-21' },
      { id: 'c6', titulo: 'Cien días sin azúcar', rango: 'S', xp: 1500, fecha: '2026-08-30' },
    ],
    botinTotal: 1800,
    abiertas: 3,
  };
}

function AvanceDemo({ segmento: inicial, cargando = false }: { segmento: SegmentoAvance; cargando?: boolean }) {
  const [segmento, setSegmento] = useState(inicial);
  return (
    <AvanceVista
      segmento={segmento}
      onSegmento={setSegmento}
      cargado={!cargando}
      error={null}
      refrescando={false}
      avance={cargando ? null : AVANCE}
      informe={INFORME}
      progresion={cargando ? null : progresion()}
      arsenal={ARSENAL}
      acciones={{ onRefrescar: nada, onReintentar: nada, onInforme: nada, onCuerpo: nada, onCampanas: nada }}
    />
  );
}

// ── Arena ──
function duelo(p: Partial<Duelo> & { id: string; rival: string }): Duelo {
  return {
    soy_retador: true,
    week_start: addDays(HOY_DEMO, -3),
    status: 'accepted',
    mi_indice: 82,
    su_indice: 76,
    mis_dias: 4,
    sus_dias: 3,
    resultado: null,
    mi_suficiente: true,
    su_suficiente: true,
    semana_cerrada: false,
    ...p,
  };
}

function ArenaDemo({ vacia = false }: { vacia?: boolean }) {
  const board = vacia ? [YO_AMIGOS_DEMO] : [YO_AMIGOS_DEMO, ...RIVALES_DEMO];
  const a = baseAmigosDemo(board);
  return (
    <ArenaGeneralVista
      cargando={false}
      fallo={null}
      refrescando={false}
      refrescar={nada}
      subtitulo={a.subtitulo}
      numAmigos={a.numAmigos}
      ranking={filasAmigosDemo(board, 'cumplimiento')}
      ventana="semana"
      elegirVentana={nada}
      metrica="cumplimiento"
      elegirMetrica={nada}
      miCodigo="TFRK7Q2M"
      copiado={false}
      copiar={nada}
      invitar={nada}
      codigo=""
      setCodigo={nada}
      enviar={nada}
      enviando={false}
      avisoCodigo={null}
      entrantes={vacia ? [] : [SOLICITUD_DEMO]}
      salientes={[]}
      ocupada={null}
      responder={nada}
      retirar={nada}
      abrirSeguridad={nada}
      duelos={{
        disponible: true,
        listo: true,
        fallo: null,
        hoy: HOY_DEMO,
        ocupado: null,
        responder: nada,
        vista: vacia
          ? { porResponder: [], activos: [], enviados: [], cerrados: [], resueltos: [] }
          : {
              porResponder: [duelo({ id: 'd0', rival: 'Irene', status: 'pending', soy_retador: false, su_indice: null, sus_dias: null })],
              activos: [duelo({ id: 'd1', rival: 'Marcos' })],
              enviados: [],
              cerrados: [],
              resueltos: [
                duelo({ id: 'd2', rival: 'Lucía', status: 'done', resultado: 'pierdo', week_start: addDays(HOY_DEMO, -10), mi_indice: 71, su_indice: 90 }),
                duelo({ id: 'd3', rival: 'Dani', status: 'done', resultado: 'gano', week_start: addDays(HOY_DEMO, -17), mi_indice: 84, su_indice: 62 }),
              ],
            },
      }}
      onRetar={nada}
      amigos={RIVALES_DEMO.map((r) => ({ userId: r.userId, name: r.name }))}
      onAjustes={nada}
    />
  );
}

// ── Detalle de campaña ──
const TAREAS_HECHAS = TAREAS_DEMO.map((x) => ({ ...x, done: true }));
const WINTER = campanaDemo({ id: 'w', title: 'Winter Arc', rank: 'A', stat: 'VIT', deadline: null });
const TAREAS_WINTER = ['Dormir 8 horas', 'Entrenar', 'Sin azúcar', 'Leer 20 páginas', 'Ducha fría'].map((title, i) => tareaDemo({ title, dungeon_id: 'w', done: i < 2 }));

// ── Perfil ──
function PerfilDemo() {
  const datos = datosPerfilDemo();
  return (
    <PerfilGeneralVista
      datos={datos}
      error={null}
      desde={null}
      nombre={datos.profile.name}
      subiendoFoto={false}
      acciones={ACCIONES_PERFIL_DEMO}
      ajustes={ajustesPerfilDemo(datos)}
      nivelesModo={ARSENAL}
      onVolver={nada}
      onProgresion={nada}
    />
  );
}

export interface EstadoGeneral {
  id: string;
  titulo: string;
  /** La pestaña que se enciende en la barra de la captura. */
  pestana: 'hoy' | 'avance' | 'campanas' | 'arena' | null;
  render: () => ReactNode;
}

export const ESTADOS_GENERAL: EstadoGeneral[] = [
  { id: 'hoy', titulo: 'Hoy · lleno', pestana: 'hoy', render: () => <HoyDemo entrada={baseHoyDemo()} /> },
  {
    id: 'hoy-perfecto',
    titulo: 'Hoy · día perfecto',
    pestana: 'hoy',
    render: () => (
      <HoyDemo
        entrada={baseHoyDemo({ hora: 21, quests: todasDemo, completions: Object.fromEntries(todasDemo.map((q) => [q.id, hechaDemo(q, 40)])), diaPerfecto: true })}
      />
    ),
  },
  {
    id: 'hoy-vacio',
    titulo: 'Hoy · cuenta nueva',
    pestana: 'hoy',
    render: () => (
      <HoyDemo
        entrada={baseHoyDemo({ profile: perfilDemo({ xp_total: 420, streak_days: 0, protection_stones: 0, name: 'Ana' }), rango: 'E', hora: 9, quests: [], completions: {}, plan: null, esPro: false, board: null })}
        campana={null}
      />
    ),
  },
  { id: 'hoy-cargando', titulo: 'Hoy · cargando', pestana: 'hoy', render: () => <HoyDemo entrada={baseHoyDemo()} estado="cargando" /> },
  { id: 'avance', titulo: 'Avance · métricas', pestana: 'avance', render: () => <AvanceDemo segmento="metricas" /> },
  { id: 'avance-progresion', titulo: 'Avance · progresión', pestana: 'avance', render: () => <AvanceDemo segmento="progresion" /> },
  { id: 'avance-cargando', titulo: 'Avance · cargando', pestana: 'avance', render: () => <AvanceDemo segmento="metricas" cargando /> },
  { id: 'campanas', titulo: 'Campañas · lista', pestana: 'campanas', render: () => <CampanasGeneralVista {...listaCampanasDemo({ titulo: null })} /> },
  {
    id: 'campanas-vacio',
    titulo: 'Campañas · vacío',
    pestana: 'campanas',
    render: () => <CampanasGeneralVista {...listaCampanasDemo({ titulo: null, campanas: [] })} />,
  },
  { id: 'campana', titulo: 'Campaña · en curso con jefe', pestana: null, render: () => <CampanaGeneralVista {...detalleCampanaDemo()} /> },
  { id: 'campana-botin', titulo: 'Campaña · botín disponible', pestana: null, render: () => <CampanaGeneralVista {...detalleCampanaDemo({ tareas: TAREAS_HECHAS })} /> },
  { id: 'campana-winter', titulo: 'Campaña · Winter Arc (sin jefe ni meta)', pestana: null, render: () => <CampanaGeneralVista {...detalleCampanaDemo({ campana: WINTER, tareas: TAREAS_WINTER })} /> },
  { id: 'arena', titulo: 'Arena · llena', pestana: 'arena', render: () => <ArenaDemo /> },
  { id: 'arena-vacia', titulo: 'Arena · vacía', pestana: 'arena', render: () => <ArenaDemo vacia /> },
  { id: 'perfil', titulo: 'Perfil', pestana: null, render: () => <PerfilDemo /> },
];
