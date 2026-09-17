// NIVL · El estado real del gladiador, tal y como lo ve el coach.
//
// Esto es lo VOLÁTIL del prompt y por eso va en el turno de usuario, nunca en
// el system: si cambiara el system se invalidaría la caché del dossier entero
// en cada llamada y el coste se multiplicaría.

import { construirEstudio } from './analytics.ts';
import { construirEstudioEconomico } from './finance.ts';
import type { Db } from './db.ts';
import { kindLines } from './kinds.ts';

// Espejo de levelFromXp/rankForLevel de src/lib/game.ts. La fuente de verdad
// es game.ts: si allí cambia la curva, hay que tocar aquí. Se replica porque
// el coach habla de nivel y rango, no para calcular economía (eso lo hace la
// app y lo aplican las RPC).
function levelFromXp(xpTotal: number): number {
  let level = 1;
  let rest = Math.max(0, xpTotal);
  while (level < 999 && rest >= Math.round(100 * Math.pow(level, 1.5))) {
    rest -= Math.round(100 * Math.pow(level, 1.5));
    level += 1;
  }
  return level;
}

function rankForLevel(level: number): string {
  if (level <= 10) return 'E';
  if (level <= 25) return 'D';
  if (level <= 45) return 'C';
  if (level <= 70) return 'B';
  if (level <= 99) return 'A';
  return 'S';
}

function hhmm(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

export interface BuiltContext {
  text: string;
  dossier: string;
}

/**
 * Tolerancia del día, la misma que aplica el cierre en el móvil (closing.ts).
 *
 * Duplicada a propósito, como el resto de fórmulas de este lado: el empaquetado
 * de la Edge Function no sube nada de fuera de supabase/. Si se toca una, se
 * toca la otra.
 */
const TOLERANCIA_DIA = 0.3;
const fallosPermitidos = (programadas: number) => Math.floor(programadas * TOLERANCIA_DIA);

const diaSemana = (fecha: string) => ((new Date(fecha).getDay() + 6) % 7) + 1;

/**
 * Adherencia real: cuántas veces TOCABA cada misión y cuántas se hizo.
 *
 * Antes aquí solo iba un contador suelto ("6 veces en 14d") y se dejaba que el
 * modelo dedujera el denominador de days_of_week. Eso es aritmética, y la
 * aritmética con el historial no la hace la IA: la hace este módulo y la IA
 * decide qué hacer con el resultado. Sin denominador, "6 veces" puede ser un
 * 100% o un 20% y el coach no distinguía una misión sana de una muerta.
 *
 * Solo se cuentan los días en que la misión ya existía: una creada anteayer no
 * puede figurar con un 7% de adherencia sobre treinta días.
 */
function adherencia(
  quests: Record<string, any>[],
  completions: { quest_id: string; date: string }[],
  desde: string,
  hasta: string,
) {
  const hechasPorMision = new Map<string, Set<string>>();
  for (const c of completions) {
    if (!hechasPorMision.has(c.quest_id)) hechasPorMision.set(c.quest_id, new Set());
    hechasPorMision.get(c.quest_id)!.add(c.date);
  }

  const dias: string[] = [];
  for (let d = new Date(desde); d < new Date(hasta); d.setDate(d.getDate() + 1)) {
    dias.push(d.toISOString().slice(0, 10));
  }

  return quests.map((q) => {
    const nacida = String(q.created_at ?? '').slice(0, 10);
    const suyos = dias.filter(
      (d) => (q.days_of_week ?? []).includes(diaSemana(d)) && (!nacida || d >= nacida),
    );
    const hechas = hechasPorMision.get(q.id) ?? new Set();
    const cumplidos = suyos.filter((d) => hechas.has(d));
    const ultima = [...hechas].sort().pop() ?? null;
    return {
      q,
      programadas: suyos.length,
      completadas: cumplidos.length,
      pct: suyos.length ? Math.round((cumplidos.length / suyos.length) * 100) : null,
      ultima,
      diasSinHacer: ultima
        ? Math.round((new Date(hasta).getTime() - new Date(ultima).getTime()) / 86400000)
        : null,
    };
  });
}

/** Día a día: qué tocaba, qué se hizo y si el día contó para la racha. */
function diarioDeDias(
  quests: Record<string, any>[],
  completions: { quest_id: string; date: string }[],
  desde: string,
  hasta: string,
) {
  const hechas = new Set(completions.map((c) => `${c.date}|${c.quest_id}`));
  const NOMBRES = ['', 'L', 'M', 'X', 'J', 'V', 'S', 'D'];
  const filas: string[] = [];
  for (let d = new Date(desde); d < new Date(hasta); d.setDate(d.getDate() + 1)) {
    const dia = d.toISOString().slice(0, 10);
    const toca = quests.filter(
      (q) =>
        (q.days_of_week ?? []).includes(diaSemana(dia)) &&
        String(q.created_at ?? '').slice(0, 10) <= dia,
    );
    if (!toca.length) continue;
    const ok = toca.filter((q) => hechas.has(`${dia}|${q.id}`)).length;
    const fallos = toca.length - ok;
    const veredicto =
      fallos === 0 ? 'PERFECTO' : fallos <= fallosPermitidos(toca.length) ? 'cumplido' : 'FALLADO';
    filas.push(`${NOMBRES[diaSemana(dia)]} ${dia.slice(5)} · ${ok}/${toca.length} · ${veredicto}`);
  }
  return filas;
}

export async function buildContext(
  sb: Db,
  userId: string,
  today: string,
): Promise<BuiltContext> {
  const since14 = new Date(new Date(today).getTime() - 14 * 86400000).toISOString().slice(0, 10);
  const since30 = new Date(new Date(today).getTime() - 30 * 86400000).toISOString().slice(0, 10);
  const since60 = new Date(new Date(today).getTime() - 60 * 86400000).toISOString().slice(0, 10);
  const weekday = ((new Date(today).getDay() + 6) % 7) + 1; // 1=lunes … 7=domingo

  const [
    profileRes,
    dossierRes,
    questsRes,
    completionsRes,
    todayDoneRes,
    planRes,
    goalsRes,
    weightRes,
    rulesRes,
    breaksRes,
    checksRes,
    dungeonsRes,
    eventsRes,
    factsRes,
    diarioRes,
  ] = await Promise.all([
    sb.from('profiles').select('*').eq('id', userId).maybeSingle(),
    sb.from('coach_dossier').select('content').eq('user_id', userId).maybeSingle(),
    sb.from('quests').select('*').eq('user_id', userId).eq('active', true),
    sb.from('completions').select('quest_id, date').eq('user_id', userId).gte('date', since30),
    sb.from('completions').select('quest_id').eq('user_id', userId).eq('date', today),
    sb.from('day_plans').select('id, date, brief, verdict, status').eq('user_id', userId).eq('date', today).maybeSingle(),
    sb.from('goals').select('*').eq('user_id', userId).eq('status', 'active'),
    sb.from('body_metrics').select('date, weight_kg').eq('user_id', userId).order('date', { ascending: false }).limit(8),
    sb.from('rules').select('id, text, consequence').eq('user_id', userId).eq('active', true),
    sb.from('rule_breaks').select('date, rule_id').eq('user_id', userId).gte('date', since60),
    // Marcas diarias del contrato (0016): sin esto el coach no sabía si hoy
    // las está cumpliendo, solo si las rompió en el pasado.
    sb.from('rule_checks').select('rule_id, date').eq('user_id', userId).gte('date', since14),
    sb.from('dungeons').select('id, title, rank, status, deadline').eq('user_id', userId).eq('status', 'active'),
    sb.from('calendar_events').select('title, date, time, notes').eq('user_id', userId).gte('date', today).order('date').limit(15),
    // 40 y no 120: los hechos son la parte más gorda del estado (8.700 fichas
    // con 46 filas) y se pagan en cada turno. Lo estable de verdad vive en el
    // dossier, que para eso se destila.
    sb.from('coach_facts').select('date, category, content').eq('user_id', userId).order('date', { ascending: false }).limit(25),
    // El diario es donde de verdad se conoce a alguien: ánimo, energía y sus
    // propias palabras sobre cómo fue el día. Sin esto el coach solo veía qué
    // hizo, nunca cómo lo llevó, y ese es justo el dato que permite ajustar
    // antes de que algo se rompa.
    sb.from('journal_entries').select('date, mood, energy, text, plan').eq('user_id', userId)
      .order('date', { ascending: false }).limit(10),
  ]);

  const p = profileRes.data as Record<string, any> | null;
  if (!p) throw new Error('Perfil no encontrado');

  const level = levelFromXp(p.xp_total ?? 0);
  const doneToday = new Set((todayDoneRes.data ?? []).map((c: any) => c.quest_id));

  const DIAS = ['', 'L', 'M', 'X', 'J', 'V', 'S', 'D'];
  // Un hábito consolidado sigue activo pero ya no se programa: si entrara en la
  // lista de misiones, el coach lo daría por pendiente y lo reclamaría todos los
  // días, que es justo lo contrario de la recompensa.
  const todasQuests = ((questsRes.data ?? []) as any[]).filter((q) => !q.is_penalty);
  const quests = todasQuests.filter((q) => !q.acquired_at);
  const adquiridos = todasQuests.filter((q) => q.acquired_at);
  const penalties = ((questsRes.data ?? []) as any[]).filter((q) => q.is_penalty && q.penalty_date === today);

  const lines: string[] = [];
  const push = (s = '') => lines.push(s);

  push(`# ESTADO DEL GLADIADOR · ${today}`);
  push();
  push(`Nombre: ${p.name} · Nivel ${level} · Rango ${rankForLevel(level)} · ${p.xp_total} XP totales`);
  for (const l of kindLines(p.profile_kind)) push(l);
  push(
    `Racha: ${p.streak_days} días (perfectos seguidos: ${p.perfect_streak_days ?? 0}) · ` +
      `Piedras de protección: ${p.protection_stones} · Puntos Bonus: ${p.bonus_points ?? 0}`,
  );
  push(`Horarios pactados: despertar ${String(p.wake_time).slice(0, 5)} · dormir ${String(p.sleep_time).slice(0, 5)} · régimen ${p.coach_mode}`);
  if (p.freeze_until) push(`CONGELADO hasta ${p.freeze_until} (${p.freeze_reason ?? 'sin motivo'})`);
  push(`Stats: FUE ${p.xp_fue} · VIT ${p.xp_vit} · INT ${p.xp_int} · AGI ${p.xp_agi} · PER ${p.xp_per}`);
  push();

  push('## Misiones activas · adherencia real de 30 días');
  if (!quests.length) push('Ninguna. No tiene sistema todavía.');
  // Peor primero: lo que está fallando tiene que ser lo primero que lea, no
  // algo que encuentre al final de una lista ordenada por antigüedad.
  const adherencias = adherencia(quests, (completionsRes.data ?? []) as any[], since30, today);
  for (const a of [...adherencias].sort((x, y) => (x.pct ?? 101) - (y.pct ?? 101))) {
    const q = a.q;
    const dias = (q.days_of_week ?? []).map((d: number) => DIAS[d]).join('') || '—';
    const tocaHoy = (q.days_of_week ?? []).includes(weekday);
    const estado = tocaHoy ? (doneToday.has(q.id) ? 'HECHA HOY' : 'PENDIENTE HOY') : 'hoy no toca';
    const adh =
      a.pct === null
        ? 'sin días programados aún'
        : `${a.completadas}/${a.programadas} = ${a.pct}%`;
    const abandono =
      a.diasSinHacer === null
        ? ' · NUNCA se ha hecho'
        : a.diasSinHacer >= 7
          ? ` · ${a.diasSinHacer} días sin hacerse`
          : '';
    push(
      `- [${q.id}] "${q.title}" · ${q.stat} · ${q.difficulty} · días ${dias} · adherencia ${adh}${abandono} · ${estado}${q.is_bonus ? ' · EXTRA (paga PB)' : ''}`,
    );
  }
  push();

  push('## Los últimos 14 días, uno a uno');
  const bitacora = diarioDeDias(quests, (completionsRes.data ?? []) as any[], since14, today);
  if (!bitacora.length) push('Sin días con misiones programadas.');
  for (const fila of bitacora) push(`- ${fila}`);
  push(
    'PERFECTO = todo hecho · cumplido = falló poco y la racha aguanta · FALLADO = racha rota. ' +
      'Un día sin ninguna marca es un día en que no abrió la app, no un día en que lo hizo mal: ' +
      'son cosas distintas y se tratan distinto.',
  );
  push();

  if (adquiridos.length) {
    push('## Hábitos ya adquiridos');
    for (const q of adquiridos) {
      push(`- "${q.title}" · consolidado tras ${q.acquired_streak ?? '?'} días seguidos`);
    }
    push(
      'Estos NO se le piden ni cuentan para la racha: se los ganó. No se los reclames ni los ' +
        'metas en el plan del día como obligación. Si ves que uno se ha caído de verdad, ' +
        'menciónalo una vez y deja que decida él.',
    );
    push();
  }

  if (penalties.length) {
    push('## Misiones de penalización pendientes hoy');
    for (const q of penalties) push(`- [${q.id}] "${q.title}" · recupera ${q.penalty_xp} XP`);
    push();
  }

  if (planRes.data) {
    const plan = planRes.data as any;
    const { data: blocks } = await sb
      .from('day_blocks')
      .select('start_min, end_min, title, kind, detail, done')
      .eq('plan_id', plan.id)
      .order('position');
    push(`## Plan de hoy (${plan.status})`);
    for (const b of (blocks ?? []) as any[]) {
      push(`- ${hhmm(b.start_min)}-${hhmm(b.end_min)} ${b.title} [${b.kind}]${b.done ? ' HECHO' : ''}${b.detail ? ` — ${b.detail}` : ''}`);
    }
    push();
  } else {
    push('## Plan de hoy');
    push('NO HAY PLAN PARA HOY.');
    push();
  }

  if (dungeonsRes.data?.length) {
    push('## Mazmorras activas');
    for (const d of dungeonsRes.data as any[]) {
      push(`- [${d.id}] "${d.title}" rango ${d.rank}${d.deadline ? ` · límite ${d.deadline}` : ''}`);
    }
    push();
  }

  if (goalsRes.data?.length) {
    push('## Metas');
    for (const g of goalsRes.data as any[]) {
      push(`- "${g.title}": ${g.start_value} → ${g.target_value} ${g.unit}${g.deadline ? ` (límite ${g.deadline})` : ''}`);
    }
    push();
  }

  if (weightRes.data?.length) {
    push('## Peso (más reciente primero)');
    push((weightRes.data as any[]).map((w) => `${w.date}: ${w.weight_kg} kg`).join(' · '));
    push();
  }

  const diario = (diarioRes.data ?? []) as any[];
  if (diario.length) {
    push('## Diario del gladiador (lo más reciente primero)');
    for (const d of diario) {
      const cabecera = [
        d.date,
        d.mood ? `ánimo ${d.mood}/5` : null,
        d.energy ? `energía ${d.energy}/5` : null,
      ].filter(Boolean).join(' · ');
      // Recortado a 500: una entrada larga por sí sola puede pesar más que
      // todo el resto del estado, y se paga en cada turno.
      const cuerpo = [d.text, d.plan].filter(Boolean).join(' | ').slice(0, 500);
      push(`- ${cabecera}${cuerpo ? `
  ${cuerpo}` : ''}`);
    }
    push(
      'Lectura: el ánimo y la energía anticipan lo que los números confirman una semana después. ' +
        'Dos días seguidos por debajo de 3 son una señal, no una queja. Y lo que escribe con sus ' +
        'palabras vale más que cualquier métrica para saber qué le mueve y qué le hunde.',
    );
    push();
  }

  if (rulesRes.data?.length) {
    const breaks = (breaksRes.data ?? []) as any[];
    const checks = (checksRes.data ?? []) as any[];
    const hoyMarcadas = new Set(checks.filter((c) => c.date === today).map((c) => c.rule_id));
    // Días distintos con marca, para saber si de verdad las está marcando.
    const diasConMarcas = new Set(checks.map((c) => c.date)).size;

    push('## Contrato (reglas innegociables)');
    for (const r of rulesRes.data as any[]) {
      const n = breaks.filter((b) => b.rule_id === r.id).length;
      const cumplidas = checks.filter((c) => c.rule_id === r.id).length;
      push(
        `- "${r.text}" → consecuencia: ${r.consequence}` +
          `${hoyMarcadas.has(r.id) ? ' · CUMPLIDA HOY' : ' · pendiente hoy'}` +
          ` · cumplida ${cumplidas} de los últimos 14 días` +
          `${n ? ` · rota ${n} veces en 60d` : ''}`,
      );
    }
    push(
      'Las reglas se marcan cada día y lo que quede sin marcar al cerrar cuenta como roto, ' +
        'con su consecuencia al día siguiente. ' +
        (diasConMarcas === 0
          ? 'AVISO: no ha marcado ninguna regla ningún día. O no sabe que hay que marcarlas, o el contrato está muerto. Pregúntaselo antes de castigarle por ello.'
          : 'Si una lleva días sin marcarse pero él dice cumplirla, el problema es el registro, no la conducta.'),
    );
    push();
  }

  if (eventsRes.data?.length) {
    push('## Agenda próxima');
    for (const e of eventsRes.data as any[]) {
      push(`- ${e.date}${e.time ? ` ${e.time}` : ''} · ${e.title}${e.notes ? ` (${e.notes})` : ''}`);
    }
    push();
  }

  const facts = (factsRes.data ?? []) as any[];
  if (facts.length) {
    // Lo perdurable no caduca; lo demás, solo lo reciente.
    const perdurable = facts.filter((f) => f.category === 'aprendizaje' || f.category === 'regla');
    const reciente = facts.filter((f) => f.category !== 'aprendizaje' && f.category !== 'regla').slice(0, 15);

    // Recortados a 400 caracteres. Un hecho importado del coach anterior puede
    // ocupar 1.500 y son decenas: sin recorte, el registro solo ya se comía
    // varios miles de fichas en CADA turno, y eso es lo que hacía que un "hola"
    // tardase minutos. Lo que no quepa aquí está entero en el dossier.
    const corto = (t: string) => (t.length > 400 ? `${t.slice(0, 400)}…` : t);

    if (perdurable.length) {
      push('## Lo que has aprendido sobre él');
      for (const f of perdurable.slice(0, 12)) push(`- (${f.date}) ${corto(f.content)}`);
      push();
    }
    if (reciente.length) {
      push('## Registro reciente');
      for (const f of reciente) push(`- (${f.date}) [${f.category}] ${corto(f.content)}`);
      push();
    }
  }

  // El entreno prescrito para hoy, para que sepa qué le tocaba antes de juzgar.
  const { data: prescHoy } = await sb
    .from('training_prescriptions')
    .select('exercise_name, sets, reps, weight, rpe_target, notes')
    .eq('user_id', userId)
    .eq('date', today)
    .order('position');
  if (prescHoy?.length) {
    push('## Entreno prescrito para hoy');
    for (const p of prescHoy as any[]) {
      push(
        `- ${p.exercise_name}: ${p.sets}×${p.reps}` +
          (p.weight ? ` @ ${p.weight} kg` : '') +
          (p.rpe_target ? ` · RPE ${p.rpe_target}` : '') +
          (p.notes ? ` — ${p.notes}` : ''),
      );
    }
    push();
  }

  // Los estudios van al final: son las conclusiones sobre las que programa.
  // En paralelo porque son dos barridos independientes de tablas distintas y
  // encadenarlos añade su latencia entera a cada turno.
  const [estudio, economia] = await Promise.all([
    construirEstudio(sb, userId, today),
    construirEstudioEconomico(sb, userId, today),
  ]);

  return {
    text: `${lines.join('\n')}\n\n${estudio}\n\n${economia}`,
    dossier: (dossierRes.data as any)?.content ?? '',
  };
}
