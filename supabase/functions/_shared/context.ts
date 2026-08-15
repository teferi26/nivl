// NIVL · El estado real del cazador, tal y como lo ve el coach.
//
// Esto es lo VOLÁTIL del prompt y por eso va en el turno de usuario, nunca en
// el system: si cambiara el system se invalidaría la caché del dossier entero
// en cada llamada y el coste se multiplicaría.

import { construirEstudio } from './analytics.ts';
import type { Db } from './db.ts';

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

export async function buildContext(
  sb: Db,
  userId: string,
  today: string,
): Promise<BuiltContext> {
  const since14 = new Date(new Date(today).getTime() - 14 * 86400000).toISOString().slice(0, 10);
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
    dungeonsRes,
    eventsRes,
    factsRes,
  ] = await Promise.all([
    sb.from('profiles').select('*').eq('id', userId).maybeSingle(),
    sb.from('coach_dossier').select('content').eq('user_id', userId).maybeSingle(),
    sb.from('quests').select('*').eq('user_id', userId).eq('active', true),
    sb.from('completions').select('quest_id, date').eq('user_id', userId).gte('date', since14),
    sb.from('completions').select('quest_id').eq('user_id', userId).eq('date', today),
    sb.from('day_plans').select('id, date, brief, verdict, status').eq('user_id', userId).eq('date', today).maybeSingle(),
    sb.from('goals').select('*').eq('user_id', userId).eq('status', 'active'),
    sb.from('body_metrics').select('date, weight_kg').eq('user_id', userId).order('date', { ascending: false }).limit(8),
    sb.from('rules').select('id, text, consequence').eq('user_id', userId).eq('active', true),
    sb.from('rule_breaks').select('date, rule_id').eq('user_id', userId).gte('date', since60),
    sb.from('dungeons').select('id, title, rank, status, deadline').eq('user_id', userId).eq('status', 'active'),
    sb.from('calendar_events').select('title, date, time, notes').eq('user_id', userId).gte('date', today).order('date').limit(15),
    sb.from('coach_facts').select('date, category, content').eq('user_id', userId).order('date', { ascending: false }).limit(120),
  ]);

  const p = profileRes.data as Record<string, any> | null;
  if (!p) throw new Error('Perfil no encontrado');

  const level = levelFromXp(p.xp_total ?? 0);
  const doneToday = new Set((todayDoneRes.data ?? []).map((c: any) => c.quest_id));

  // Cuántas veces se completó cada misión en 14 días. No se calculan los días
  // programados aquí: el modelo tiene days_of_week y saca la conclusión solo.
  const counts = new Map<string, number>();
  for (const c of (completionsRes.data ?? []) as any[]) {
    counts.set(c.quest_id, (counts.get(c.quest_id) ?? 0) + 1);
  }

  const DIAS = ['', 'L', 'M', 'X', 'J', 'V', 'S', 'D'];
  const quests = ((questsRes.data ?? []) as any[]).filter((q) => !q.is_penalty);
  const penalties = ((questsRes.data ?? []) as any[]).filter((q) => q.is_penalty && q.penalty_date === today);

  const lines: string[] = [];
  const push = (s = '') => lines.push(s);

  push(`# ESTADO DEL CAZADOR · ${today}`);
  push();
  push(`Nombre: ${p.name} · Nivel ${level} · Rango ${rankForLevel(level)} · ${p.xp_total} XP totales`);
  push(`Racha: ${p.streak_days} días · Piedras de protección: ${p.protection_stones} · Puntos Bonus: ${p.bonus_points ?? 0}`);
  push(`Horarios pactados: despertar ${String(p.wake_time).slice(0, 5)} · dormir ${String(p.sleep_time).slice(0, 5)} · régimen ${p.coach_mode}`);
  if (p.freeze_until) push(`CONGELADO hasta ${p.freeze_until} (${p.freeze_reason ?? 'sin motivo'})`);
  push(`Stats: FUE ${p.xp_fue} · VIT ${p.xp_vit} · INT ${p.xp_int} · AGI ${p.xp_agi} · PER ${p.xp_per}`);
  push();

  push('## Misiones activas (últimos 14 días)');
  if (!quests.length) push('Ninguna. No tiene sistema todavía.');
  for (const q of quests) {
    const dias = (q.days_of_week ?? []).map((d: number) => DIAS[d]).join('') || '—';
    const tocaHoy = (q.days_of_week ?? []).includes(weekday);
    const estado = tocaHoy ? (doneToday.has(q.id) ? 'HECHA HOY' : 'PENDIENTE HOY') : 'hoy no toca';
    push(`- [${q.id}] "${q.title}" · ${q.stat} · ${q.difficulty} · días ${dias} · ${counts.get(q.id) ?? 0} veces en 14d · ${estado}${q.is_bonus ? ' · EXTRA (paga PB)' : ''}`);
  }
  push();

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

  if (rulesRes.data?.length) {
    const breaks = (breaksRes.data ?? []) as any[];
    push('## Contrato (reglas innegociables)');
    for (const r of rulesRes.data as any[]) {
      const n = breaks.filter((b) => b.rule_id === r.id).length;
      push(`- "${r.text}" → consecuencia: ${r.consequence}${n ? ` · rota ${n} veces en 60d` : ''}`);
    }
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
    const reciente = facts.filter((f) => f.category !== 'aprendizaje' && f.category !== 'regla').slice(0, 60);
    if (perdurable.length) {
      push('## Lo que has aprendido sobre él');
      for (const f of perdurable) push(`- (${f.date}) ${f.content}`);
      push();
    }
    if (reciente.length) {
      push('## Registro reciente');
      for (const f of reciente) push(`- (${f.date}) [${f.category}] ${f.content}`);
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

  // El estudio va al final: son las conclusiones sobre las que programa.
  const estudio = await construirEstudio(sb, userId, today);

  return {
    text: `${lines.join('\n')}\n\n${estudio}`,
    dossier: (dossierRes.data as any)?.content ?? '',
  };
}
