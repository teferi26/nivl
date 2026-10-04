// Demo de la galería /kit/pantallas (solo desarrollo): Hoy con datos de
// mentira (arena/demoDatos). La vista no carga nada: aquí se derivan los
// datos con derivarHoy y se le pasan por props. Tocar una misión la marca en
// local, para ver cómo la inversión pasa a la siguiente.
import { useMemo, useState } from 'react';
import { HOY_DEMO, misionDemo, perfilDemo, YO_DEMO } from '@/components/arena/demoDatos';
import type { DemoPantalla } from '@/components/arena/galeria';
import type { DayCloseResult } from '@/lib/engine';
import type { DayBlock, PlanConBloques } from '@/lib/plan';
import type { BoardEntry } from '@/lib/social';
import type { Completion, Quest } from '@/lib/types';
import { derivarHoy, type EntradaHoy } from './derivarHoy';
import { HoyVista } from './HoyVista';

const nada = () => {};
/** «Yo» (YO_DEMO): nivel 23 con 9.300 de 11.030 XP (84 %), rango A, como en Main.dc. */
const perfil = perfilDemo;
/** 16:10: el bloque de las 16:00 es el de ahora. */
const AHORA = 16 * 60 + 10;

const hecha = (q: Quest, xp: number): Completion => ({
  id: `c-${q.id}`,
  user_id: 'demo-usuario',
  quest_id: q.id,
  date: HOY_DEMO,
  completed_at: `${HOY_DEMO}T08:30:00Z`,
  xp_awarded: xp,
  evidence_url: null,
});

const entrenar = misionDemo({ title: 'Entrenar · empuje', stat: 'FUE', difficulty: 'dificil', link: 'gym' });
const leer = misionDemo({ title: 'Leer 20 páginas', stat: 'INT' });
const diario = misionDemo({ title: 'Escribir el diario', stat: 'PER', difficulty: 'facil', link: 'diario' });
const propuesta = misionDemo({ title: 'Enviar la propuesta a dos clientes', stat: 'AGI', requires_evidence: true });
const paseo = misionDemo({ title: 'Paseo largo sin móvil', stat: 'VIT', is_bonus: true });
const flexiones = misionDemo({
  title: '20 flexiones',
  stat: 'AGI',
  is_penalty: true,
  penalty_xp: 204,
  penalty_date: HOY_DEMO,
  days_of_week: [],
});

const bloque = (id: string, ini: string, fin: string, title: string, kind: DayBlock['kind'], p: Partial<DayBlock> = {}): DayBlock => {
  const min = (h: string) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3));
  return {
    id,
    plan_id: 'demo-plan',
    start_min: min(ini),
    end_min: min(fin),
    title,
    kind,
    detail: null,
    quest_id: null,
    notify: false,
    done: false,
    position: Number(id),
    ...p,
  };
};

const PLAN: PlanConBloques = {
  plan: {
    id: 'demo-plan',
    date: HOY_DEMO,
    status: 'activo',
    verdict: 'Dormiste 6 h 10. Lo exigente, antes de las 14:00.',
    brief: null,
    generated_at: `${HOY_DEMO}T06:40:00Z`,
  },
  bloques: [
    bloque('1', '07:00', '08:15', 'Entreno · empuje', 'gym', { done: true }),
    bloque('2', '09:30', '12:00', 'Bloque profundo · propuesta', 'deep_work', { done: true }),
    bloque('3', '16:00', '17:30', 'Llamadas a clientes', 'ventas', { detail: 'Dos llamadas y cierra la de Ruiz.' }),
    bloque('4', '22:00', '22:30', 'Diario y cierre', 'ritual'),
  ],
};

const fila = (p: Partial<BoardEntry> & { userId: string; name: string }): BoardEntry => ({
  isMe: false,
  xpWindow: 0,
  compliancePct: 80,
  completed: 0,
  streakDays: 0,
  xpTotal: 0,
  friendshipId: 'demo',
  visible: true,
  avatarPath: null,
  equippedTitle: null,
  profileKind: null,
  daysActive: 0,
  scheduled: 0,
  windowDays: 7,
  ...p,
});

const MARCADOR: BoardEntry[] = [
  fila({ userId: YO_DEMO.id, name: YO_DEMO.nombre, isMe: true, friendshipId: null, xpWindow: 860 }),
  fila({ userId: 'marta', name: 'Marta', xpWindow: 910 }),
  fila({ userId: 'luis', name: 'Luis', xpWindow: 540 }),
];

const CIERRE_PENA: DayCloseResult = {
  penaltyXp: 204,
  penaltyReglas: 0,
  missedTitles: ['Leer 20 páginas', 'Escribir el diario'],
  streakLost: true,
  levelsLost: 0,
  stonesUsed: 0,
  stonesEarned: 0,
  diasSinCobrar: 0,
  diasCumplidos: 0,
};

const base = (p: Partial<EntradaHoy> = {}): EntradaHoy => ({
  hoy: HOY_DEMO,
  hora: 16,
  profile: perfil(),
  rango: YO_DEMO.rango,
  tituloEquipado: null,
  quests: [entrenar, leer, diario, propuesta, paseo],
  completions: { [entrenar.id]: hecha(entrenar, 75) },
  dayResult: null,
  plan: PLAN,
  esPro: true,
  board: MARCADOR,
  rotosPrevios: 0,
  diaPerfecto: false,
  avisoRecuperacion: false,
  ...p,
});

/** Hoy con estado local: tocar una misión la completa (sin hoja ni red). */
function HoyDemo({ entrada, estado = 'listo', error = null }: { entrada: EntradaHoy; estado?: 'cargando' | 'listo'; error?: string | null }) {
  const [completions, setCompletions] = useState(entrada.completions);
  const [diaPerfecto, setDiaPerfecto] = useState(entrada.diaPerfecto);
  const [plan, setPlan] = useState(entrada.plan);
  const datos = useMemo(
    () => derivarHoy({ ...entrada, completions, diaPerfecto, plan }),
    [entrada, completions, diaPerfecto, plan],
  );
  const completar = (q: Quest) => {
    const siguientes = { ...completions, [q.id]: hecha(q, 30) };
    setCompletions(siguientes);
    if (entrada.quests.every((x) => siguientes[x.id])) setDiaPerfecto(true);
  };
  const alternar = (b: DayBlock) =>
    setPlan((p) => (p ? { ...p, bloques: p.bloques.map((x) => (x.id === b.id ? { ...x, done: !x.done } : x)) } : p));
  return (
    <HoyVista
      estado={estado}
      error={error}
      datos={datos}
      ocupada={null}
      preparandoTarjeta={false}
      refrescando={false}
      desde={{ nivel: 0, xpRatio: 0, racha: 0 }}
      ahora={AHORA}
      acciones={{ onCompletar: completar, onAlternarBloque: alternar, onCompartirDia: nada, onRefrescar: nada, onReintentar: nada }}
    />
  );
}

const todas = [entrenar, leer, diario, propuesta, paseo];

export const DEMO: DemoPantalla | null = {
  id: 'hoy',
  titulo: 'Hoy',
  estados: [
    { id: 'lleno', titulo: 'Lleno', render: () => <HoyDemo entrada={base()} /> },
    {
      id: 'penalizacion',
      titulo: 'Penalización',
      render: () => (
        <HoyDemo
          entrada={base({
            profile: perfil({ streak_days: 0, protection_stones: 0 }),
            quests: [flexiones, entrenar, leer, diario],
            completions: {},
            dayResult: CIERRE_PENA,
            esPro: false,
            plan: null,
            board: null,
          })}
        />
      ),
    },
    {
      id: 'perfecto',
      titulo: 'Día perfecto',
      render: () => (
        <HoyDemo
          entrada={base({
            hora: 21,
            quests: todas,
            completions: Object.fromEntries(todas.map((q) => [q.id, hecha(q, 40)])),
            diaPerfecto: true,
          })}
        />
      ),
    },
    {
      id: 'vacio',
      titulo: 'Vacío',
      render: () => (
        <HoyDemo
          entrada={base({
            profile: perfilDemo({ xp_total: 420, streak_days: 0, protection_stones: 0, name: 'Ana' }),
            rango: 'E',
            hora: 9,
            quests: [],
            completions: {},
            plan: null,
            esPro: false,
            board: null,
          })}
        />
      ),
    },
    {
      id: 'pausa',
      titulo: 'Pausa',
      render: () => (
        <HoyDemo
          entrada={base({
            profile: perfil({ freeze_until: '2026-10-06', freeze_reason: 'viaje' }),
            dayResult: { ...CIERRE_PENA, penaltyXp: 0, streakLost: false, stonesUsed: 1 },
          })}
        />
      ),
    },
    { id: 'cargando', titulo: 'Cargando', render: () => <HoyDemo entrada={base()} estado="cargando" /> },
    {
      id: 'error',
      titulo: 'Error',
      render: () => (
        <HoyDemo
          entrada={base({ profile: null, rango: null, quests: [], completions: {}, plan: null, esPro: null, board: null })}
          error="Sin conexión. El sistema lo intentará de nuevo al volver."
        />
      ),
    },
  ],
};
