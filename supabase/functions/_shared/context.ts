// NIVL · El estado real del gladiador, tal y como lo ve el coach.
//
// Esto es lo VOLÁTIL del prompt y por eso va en el turno de usuario, nunca en
// el system: si cambiara el system se invalidaría la caché del dossier entero
// en cada llamada y el coste se multiplicaría.

import { construirEstudio } from './analytics.ts';
import { construirEstudioEconomico } from './finance.ts';
import type { Db } from './db.ts';
import { kindLines } from './kinds.ts';
import { leerRegistros, lineasDelDia } from './comprobacion.ts';

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

// Espejo de NOMBRE_DE_ACTO en src/lib/links.ts.
const ENLACE: Record<string, string> = {
  gym: 'la sesión de gimnasio',
  cardio: 'el cardio',
  nutricion: 'el parte de comidas',
  peso: 'el pesaje',
  diario: 'el diario',
};

// Espejo de mantenimientoKcal en src/lib/bodymath.ts (allí están los tests).
const FACTOR_ACTIVIDAD: Record<string, number> = {
  sedentario: 1.2, ligero: 1.375, moderado: 1.55, alto: 1.725, muy_alto: 1.9,
};
function mantenimientoKcal(
  pesoKg: number,
  alturaCm: number | null,
  edad: number | null,
  sexo: string | null,
  actividad: string | null,
): { basal: number; mantenimiento: number } | null {
  if (!(pesoKg > 20) || !alturaCm || !edad || !sexo || !actividad || !FACTOR_ACTIVIDAD[actividad]) return null;
  const basal = 10 * pesoKg + 6.25 * alturaCm - 5 * edad + (sexo === 'hombre' ? 5 : -161);
  return { basal: Math.round(basal), mantenimiento: Math.round((basal * FACTOR_ACTIVIDAD[actividad]) / 10) * 10 };
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

import { requireHealth } from './health.ts';

// ── L4: recortes FIJOS del estado completo ──────────────────────────────
//
// Fijos a propósito: nunca dependen de la intención del mensaje ni del día, así
// el estado solo cambia cuando cambian los datos y la caché del segundo punto
// (prompt.ts) sobrevive entre turnos. Medido con datos sintéticos realistas en
// ia2_l4_contexto_test.ts (antes/después impreso allí). Lo recortado no se
// pierde: está en consultar_historial y, lo estable, en el dossier.
//
//   · Diario: 21 entradas enteras → 7 (3 en detalle, 4 en una línea), con la
//     tendencia de 7 contra 7 días calculada aún sobre 14 días de cifras.
//   · Hechos (coach_facts): 25 → 12 (hasta 6 perdurables —aprendizaje, regla—
//     y el resto los más recientes), recortados a 250 caracteres (antes 400).
//   · Agenda: 15 citas → 8, título a 120 y notas a 80 caracteres.
//   · Campañas: 40 tareas pendientes → 30, y 5 por campaña (antes 8) con el
//     número de las que quedan fuera.
//   · Sin cambio: misiones de 30 días (una línea por misión, es el núcleo del
//     juicio diario), plan de hoy, contrato, 14 días uno a uno, ficha y peso.
export const LIMITE_HECHOS = 12;
export const HECHOS_PERDURABLES = 6;
const CATEGORIAS_PERDURABLES = ['aprendizaje', 'regla'];
const TOPE_HECHO = 250;
export const DIARIO_EN_LINEAS = 7;
export const DIARIO_EN_DETALLE = 3;
export const LIMITE_AGENDA = 8;
const TAREAS_POR_CAMPANA = 5;

/** El texto de un dato de terceros o del usuario en una sola línea, sin etiquetas de datos y acotado. */
function enUnaLinea(texto: unknown, tope: number): string {
  return String(texto ?? '')
    .replace(/<\/?\s*datos_del_gladiador\s*>/gi, '')
    // Un correo escrito en un nombre (de liga, de campaña) no le sirve al coach.
    .replace(/[^\s@<>]+@[^\s@<>]+\.[a-z]{2,}/gi, '[correo]')
    // deno-lint-ignore no-control-regex
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, tope);
}

/**
 * L5 · Liga: tu puesto en cada liga privada, con `my_league_standing()` (0048)
 * y el cliente del USUARIO. La RPC solo devuelve las ligas propias, sin uuid de
 * nadie más y con el nombre ya acotado en SQL; aquí además se descarta el id de
 * la liga y el nombre se trata como dato (una línea, sin etiquetas). Si falla
 * (sin migración, sin sesión) no hay línea.
 */
async function lineaLiga(sb: Db): Promise<string | null> {
  try {
    const { data, error } = await sb.rpc('my_league_standing');
    if (error || !Array.isArray(data) || !data.length) return null;
    const partes = (data as Record<string, unknown>[]).slice(0, 10).map((l) =>
      `«${enUnaLinea(l.nombre, 40)}» ${Number(l.puesto) || '?'}.º de ${Number(l.miembros) || '?'}` +
      (l.indice === null || l.indice === undefined ? '' : ` (índice ${Number(l.indice)})`)
    );
    return `Ligas privadas (tu puesto, solo agregados): ${partes.join(' · ')}.`;
  } catch {
    return null;
  }
}

/**
 * L5 · Fotos de progreso: cuántas hay y la fecha de la última, con
 * `my_progress_photos_meta()` (0050) y el cliente del USUARIO. Solo metadatos
 * (nunca id, ruta ni URL). Sin permiso de salud, sin 18+ o con borrado
 * pendiente, la RPC da 42501 y no hay línea: el coach no sugiere fotos a quien
 * no puede tenerlas.
 */
async function lineaFotos(sb: Db): Promise<string | null> {
  try {
    const { data, error } = await sb.rpc('my_progress_photos_meta', { p_from: null });
    if (error || !Array.isArray(data)) return null;
    const fotos = data as { fecha?: unknown; pose?: unknown }[];
    if (!fotos.length) return 'Fotos de progreso: ninguna todavía.';
    const ultima = fotos[0];
    const pose = ['frente', 'lado', 'espalda'].includes(String(ultima.pose)) ? ` (${ultima.pose})` : '';
    return `Fotos de progreso: ${fotos.length}${fotos.length >= 200 ? '+' : ''} · la última del ${enUnaLinea(ultima.fecha, 10)}${pose}. Solo metadatos; tú no ves las imágenes.`;
  } catch {
    return null;
  }
}

export async function buildContext(
  sb: Db,
  userId: string,
  today: string,
): Promise<BuiltContext> {
  await requireHealth(sb, userId);
  const since14 = new Date(new Date(today).getTime() - 14 * 86400000).toISOString().slice(0, 10);
  const since30 = new Date(new Date(today).getTime() - 30 * 86400000).toISOString().slice(0, 10);
  const since60 = new Date(new Date(today).getTime() - 60 * 86400000).toISOString().slice(0, 10);
  const weekday = ((new Date(today).getDay() + 6) % 7) + 1; // 1=lunes … 7=domingo

  // Lo registrado hoy, módulo a módulo, con la MISMA lectura que consultar_dia
  // y que la comprobación del servidor (comprobacion.ts). En paralelo con el
  // resto: son consultas pequeñas y acotadas.
  const registradoHoyP = leerRegistros(sb, userId, today, today);
  // L5: una línea por módulo social/fotos, con las RPC acotadas del servidor
  // (nunca leen datos de terceros). En paralelo; si fallan, no hay línea.
  const ligaP = lineaLiga(sb);
  const fotosP = lineaFotos(sb);

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
    fichaRes,
    origenRes,
    tareasRes,
    hechosRes,
    diarioDetalleRes,
  ] = await Promise.all([
    sb.from('profiles').select('*').eq('id', userId).maybeSingle(),
    sb.from('coach_dossier').select('content').eq('user_id', userId).maybeSingle(),
    sb.from('quests').select('*').eq('user_id', userId).eq('active', true),
    sb.from('completions').select('quest_id, date').eq('user_id', userId).gte('date', since30),
    sb.from('completions').select('quest_id').eq('user_id', userId).eq('date', today),
    sb.from('day_plans').select('id, date, brief, verdict, status').eq('user_id', userId).eq('date', today).maybeSingle(),
    sb.from('goals').select('*').eq('user_id', userId).eq('status', 'active'),
    sb.from('body_metrics').select('date, weight_kg').eq('user_id', userId).order('date', { ascending: false }).limit(8),
    sb.from('rules').select('id, text, consequence, link').eq('user_id', userId).eq('active', true),
    sb.from('rule_breaks').select('date, rule_id').eq('user_id', userId).gte('date', since60),
    // Marcas diarias del contrato (0016): sin esto el coach no sabía si hoy
    // las está cumpliendo, solo si las rompió en el pasado.
    sb.from('rule_checks').select('rule_id, date').eq('user_id', userId).gte('date', since14),
    sb.from('dungeons').select('id, title, rank, status, deadline').eq('user_id', userId).eq('status', 'active'),
    // L4: 8 citas (antes 15), notas recortadas abajo. Lo más lejano se
    // consulta con consultar_historial('eventos') si hace falta.
    sb.from('calendar_events').select('id, title, date, time, notes').eq('user_id', userId).gte('date', today).order('date').limit(LIMITE_AGENDA),
    // L4: 12 hechos (antes 25). coach_facts no tiene columna de "importante":
    // lo más parecido son las categorías perdurables (aprendizaje y regla), que
    // van aparte para que un mes de registros sueltos no las expulse. Lo
    // estable de verdad vive en el dossier, que para eso se destila; lo demás,
    // consultar_historial('hechos').
    sb.from('coach_facts').select('date, category, content').eq('user_id', userId)
      .in('category', CATEGORIAS_PERDURABLES).order('date', { ascending: false }).limit(HECHOS_PERDURABLES),
    // El diario es donde de verdad se conoce a alguien: ánimo, energía y sus
    // propias palabras sobre cómo fue el día. Sin esto el coach solo veía qué
    // hizo, nunca cómo lo llevó, y ese es justo el dato que permite ajustar
    // antes de que algo se rompa.
    //
    // L4: dos lecturas en vez de 21 entradas enteras. Las cifras (ánimo,
    // energía, sueño, emociones) de 14 días, que son baratas y sostienen la
    // tendencia de 7 contra 7; y el texto solo de las 3 últimas. Se pintan 7
    // entradas: 3 en detalle y 4 en una línea.
    sb.from('journal_entries')
      .select('date, mood, energy, sleep_hours, emotions')
      .eq('user_id', userId)
      .order('date', { ascending: false }).limit(14),
    sb.from('body_profile').select('*').eq('user_id', userId).maybeSingle(),
    // Lo que escribió y firmó el día que entró: para qué está aquí y a cuántos
    // años se comprometió. En una cuenta nueva es TODO lo que el coach sabe de
    // sus motivos, y sin ello el primer brief sería genérico.
    sb.from('events').select('type, payload, created_at').eq('user_id', userId)
      .in('type', ['onboarding_goal', 'commitment_signed']).order('created_at', { ascending: false }).limit(4),
    // L4: 30 tareas pendientes (antes 40) y 5 por campaña (antes 8).
    sb.from('dungeon_tasks').select('id, dungeon_id, title, is_boss, due_date').eq('user_id', userId)
      .eq('done', false).order('position').limit(30),
    sb.from('coach_facts').select('date, category, content').eq('user_id', userId)
      .not('category', 'in', `(${CATEGORIAS_PERDURABLES.join(',')})`)
      .order('date', { ascending: false }).limit(LIMITE_HECHOS),
    sb.from('journal_entries')
      .select('date, wins, text, lesson, gratitude, plan')
      .eq('user_id', userId)
      .order('date', { ascending: false }).limit(DIARIO_EN_DETALLE),
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

  {
    const origen = (origenRes.data ?? []) as { type: string; payload: Record<string, any> }[];
    const meta = origen.find((e) => e.type === 'onboarding_goal')?.payload;
    const firma = origen.find((e) => e.type === 'commitment_signed')?.payload;
    if (meta || firma) {
      push('## Para qué está aquí (lo escribió y lo firmó al entrar)');
      if (meta) {
        const partes = [meta.goal, meta.target ? `cifra: ${meta.target}` : '', meta.deadline ? `fecha: ${meta.deadline}` : '']
          .filter(Boolean)
          .join(' · ');
        push(`Objetivo: ${String(partes).slice(0, 400)}`);
      }
      if (firma) push(`Compromiso firmado a ${firma.years} años (vence el ${firma.open_at}).`);
      push('Todo lo que le mandes tiene que poder explicarse como un paso hacia esto. Si su sistema no lo refleja, arréglalo.');
      push();
    }
  }

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
      `- [${q.id}] "${q.title}" · ${q.stat} · ${q.difficulty} · días ${dias} · adherencia ${adh}${abandono} · ${estado}${q.is_bonus ? ' · EXTRA (paga PB)' : ''}${ENLACE[q.link] ? ` · se marca sola al registrar ${ENLACE[q.link]}` : ''}`,
    );
  }
  // L4: las notas de lectura fijas (un solo gesto, bitácora, diario, contrato)
  // viven en knowledge.ts («Cómo se lee el estado»): son iguales para todos y
  // allí van en la parte fija cacheada, no en el estado de cada turno.
  push();

  push(`## Registrado hoy (${today})`);
  for (const l of lineasDelDia(await registradoHoyP, today)) push(`- ${l}`);
  push(
    'Esto es lo que consta hoy, leído al construir este estado. Si dice haber hecho algo que no ' +
      'aparece aquí, compruébalo con consultar_dia (también mira el día anterior) antes de negarlo.',
  );
  push();

  push('## Los últimos 14 días, uno a uno');
  const bitacora = diarioDeDias(quests, (completionsRes.data ?? []) as any[], since14, today);
  if (!bitacora.length) push('Sin días con misiones programadas.');
  for (const fila of bitacora) push(`- ${fila}`);
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
      const suyas = ((tareasRes.data ?? []) as any[]).filter((t) => t.dungeon_id === d.id);
      for (const t of suyas.slice(0, TAREAS_POR_CAMPANA)) {
        push(`  · [${t.id}] ${t.title}${t.is_boss ? ' (JEFE)' : ''}${t.due_date ? ` · ${t.due_date}` : ''}`);
      }
      if (suyas.length > TAREAS_POR_CAMPANA) push(`  · (+${suyas.length - TAREAS_POR_CAMPANA} pendientes más)`);
    }
    push();
  }

  if (goalsRes.data?.length) {
    push('## Metas');
    for (const g of goalsRes.data as any[]) {
      push(`- [${g.id}] "${g.title}": ${g.start_value} → ${g.target_value} ${g.unit}${g.deadline ? ` (límite ${g.deadline})` : ''}`);
    }
    push();
  }

  if (weightRes.data?.length) {
    push('## Peso (más reciente primero)');
    push((weightRes.data as any[]).map((w) => `${w.date}: ${w.weight_kg} kg`).join(' · '));
    push();
  }

  {
    const [liga, fotos] = await Promise.all([ligaP, fotosP]);
    if (liga || fotos) {
      push('## Fotos y ligas');
      if (fotos) push(fotos);
      if (liga) push(liga);
      push('El detalle, con consultar_historial (fotos, liga). De las ligas solo ves tu puesto: nunca datos de los demás.');
      push();
    }
  }

  {
    const f = fichaRes.data as Record<string, any> | null;
    const pesoActual = Number((weightRes.data as any[] | null)?.[0]?.weight_kg) || 0;
    push('## Ficha física');
    if (!f) {
      push(
        'VACÍA. Sin altura, edad, sexo, actividad, lesiones, material y gustos de comida estás ' +
          'prescribiendo para un usuario medio que no existe. Antes de programar entreno o dieta, ' +
          'pregúntale lo que falte (de una en una) y guárdalo con fijar_ficha.',
      );
    } else {
      const edad = f.birth_year ? new Date(today).getFullYear() - f.birth_year : null;
      push(
        [
          f.height_cm ? `${f.height_cm} cm` : null,
          edad ? `${edad} años` : null,
          f.sex,
          f.activity ? `actividad ${f.activity}` : null,
          f.experience ? `experiencia ${f.experience}` : null,
        ].filter(Boolean).join(' · ') || 'Sin datos básicos.',
      );
      if (f.goal) push(`Objetivo físico: ${f.goal}`);
      if (f.injuries) push(`LESIONES Y MOLESTIAS: ${f.injuries}`);
      if (f.health_notes) push(`Salud: ${f.health_notes}`);
      if (f.food_notes) push(`Comida: ${f.food_notes}`);
      if (f.equipment) push(`Material: ${f.equipment}`);
      const m = mantenimientoKcal(pesoActual, f.height_cm, edad, f.sex, f.activity);
      if (m) {
        push(
          `Mantenimiento estimado (Mifflin-St Jeor): basal ${m.basal} kcal · mantenimiento ~${m.mantenimiento} kcal ` +
            `con ${pesoActual} kg. Es un punto de partida con ±10 % de error: en cuanto haya tres semanas de ` +
            'pesajes manda la pendiente real del peso, no esta fórmula.',
        );
      }
      const faltan = [
        !f.height_cm && 'altura', !f.birth_year && 'año de nacimiento', !f.sex && 'sexo',
        !f.activity && 'actividad', !f.experience && 'experiencia', !f.injuries && 'lesiones (o "ninguna")',
        !f.food_notes && 'comida', !f.equipment && 'material',
      ].filter(Boolean);
      if (faltan.length) push(`Falta por saber: ${faltan.join(', ')}. Pregúntalo cuando venga a cuento y guárdalo.`);
    }
    push();
  }

  const diario = (diarioRes.data ?? []) as any[];
  if (diario.length) {
    push('## Diario del gladiador (lo más reciente primero)');

    // La tendencia antes que las entradas: 7 días contra los 7 anteriores. Es
    // lo que convierte el diario en una medición de su proceso y no en prosa
    // suelta. Con menos de 3 datos en una ventana no hay media que valga.
    const dia = (n: number) => new Date(new Date(today).getTime() - n * 86400000).toISOString().slice(0, 10);
    const media = (filas: any[], campo: string) => {
      const v = filas.map((f) => Number(f[campo])).filter((x) => Number.isFinite(x) && x > 0);
      return v.length >= 3 ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null;
    };
    const ultimos = diario.filter((d) => d.date > dia(7));
    const previos = diario.filter((d) => d.date <= dia(7) && d.date > dia(14));
    const tendencia: string[] = [];
    for (const [campo, nombre, unidad] of [['mood', 'ánimo', '/5'], ['energy', 'energía', '/5'], ['sleep_hours', 'sueño', ' h']]) {
      const a = media(ultimos, campo);
      const b = media(previos, campo);
      if (a === null) continue;
      tendencia.push(`${nombre} ${a}${unidad}${b !== null ? ` (antes ${b}${unidad})` : ''}`);
    }
    const frecuencia = new Map<string, number>();
    for (const d of diario.filter((x) => x.date > dia(14))) {
      for (const e of (d.emotions ?? []) as string[]) frecuencia.set(e, (frecuencia.get(e) ?? 0) + 1);
    }
    const top = [...frecuencia.entries()].sort((x, y) => y[1] - x[1]).slice(0, 4);
    if (tendencia.length) push(`Últimos 7 días: ${tendencia.join(' · ')} · escribió ${ultimos.length} de 7 días.`);
    if (top.length) push(`Emociones más repetidas en 14 días: ${top.map(([e, n]) => `${e} ×${n}`).join(', ')}.`);

    // L4: 7 entradas; las 3 últimas en detalle (su texto llega en una lectura
    // aparte) y las otras 4 solo con sus cifras. El resto, en la tendencia y
    // en consultar_historial('diario').
    const detalle = new Map(((diarioDetalleRes.data ?? []) as any[]).map((d) => [String(d.date), d]));
    for (const [i, base] of diario.slice(0, DIARIO_EN_LINEAS).entries()) {
      const d = { ...base, ...(i < DIARIO_EN_DETALLE ? detalle.get(String(base.date)) ?? {} : {}) };
      const cabecera = [
        d.date,
        d.mood ? `ánimo ${d.mood}/5` : null,
        d.energy ? `energía ${d.energy}/5` : null,
        d.sleep_hours ? `durmió ${d.sleep_hours} h` : null,
        (d.emotions ?? []).length ? `se sintió: ${(d.emotions as string[]).join(', ')}` : null,
      ].filter(Boolean).join(' · ');
      // Recortado: una entrada larga por sí sola puede pesar más que todo el
      // resto del estado, y se paga en cada turno.
      const lineas = [
        (d.wins ?? []).length ? `Victorias: ${(d.wins as string[]).join(' · ').slice(0, 300)}` : null,
        d.text ? `Vivido: ${String(d.text).slice(0, 300)}` : null,
        d.lesson ? `Aprendió: ${String(d.lesson).slice(0, 200)}` : null,
        d.gratitude ? `Agradece: ${String(d.gratitude).slice(0, 120)}` : null,
        d.plan ? `Mañana, lo primero: ${String(d.plan).slice(0, 160)}` : null,
      ].filter(Boolean);
      push(`- ${cabecera}${lineas.map((l) => `\n  ${l}`).join('')}`);
    }
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
        `- [${r.id}] "${r.text}" → consecuencia: ${r.consequence}` +
          `${ENLACE[r.link] ? ` · se marca sola al registrar ${ENLACE[r.link]}` : ''}` +
          `${hoyMarcadas.has(r.id) ? ' · CUMPLIDA HOY' : ' · pendiente hoy'}` +
          ` · cumplida ${cumplidas} de los últimos 14 días` +
          `${n ? ` · rota ${n} veces en 60d` : ''}`,
      );
    }
    // La lectura general del contrato está en knowledge.ts; aquí, solo el
    // aviso que depende de SUS datos.
    if (diasConMarcas === 0) {
      push('AVISO: no ha marcado ninguna regla ningún día. O no sabe que hay que marcarlas, o el contrato está muerto. Pregúntaselo antes de castigarle por ello.');
    }
    push();
  }

  if (eventsRes.data?.length) {
    push('## Agenda próxima');
    for (const e of eventsRes.data as any[]) {
      const notas = e.notes ? String(e.notes).slice(0, 80) + (String(e.notes).length > 80 ? '…' : '') : '';
      push(`- [${e.id}] ${e.date}${e.time ? ` ${e.time}` : ''} · ${String(e.title).slice(0, 120)}${notas ? ` (${notas})` : ''}`);
    }
    push();
  }

  // Lo perdurable no caduca; lo demás, solo lo reciente. Entre los dos, como
  // mucho LIMITE_HECHOS (L4). Se vuelve a filtrar por categoría aquí: las dos
  // lecturas pueden solaparse y el estado no debe repetir un hecho.
  const esPerdurable = (f: any) => CATEGORIAS_PERDURABLES.includes(f.category);
  const perdurable = ((factsRes.data ?? []) as any[]).filter(esPerdurable).slice(0, HECHOS_PERDURABLES);
  const reciente = ((hechosRes.data ?? []) as any[]).filter((f) => !esPerdurable(f))
    .slice(0, LIMITE_HECHOS - perdurable.length);
  if (perdurable.length || reciente.length) {
    // Recortados a TOPE_HECHO caracteres. Un hecho importado del coach anterior
    // puede ocupar 1.500 y son decenas: sin recorte, el registro solo ya se
    // comía varios miles de fichas en CADA turno, y eso es lo que hacía que un
    // "hola" tardase minutos. Lo que no quepa aquí está entero en el dossier o
    // en consultar_historial('hechos').
    const corto = (t: string) => (t.length > TOPE_HECHO ? `${t.slice(0, TOPE_HECHO)}…` : t);

    if (perdurable.length) {
      push('## Lo que has aprendido sobre él');
      for (const f of perdurable) push(`- (${f.date}) ${corto(f.content)}`);
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

/**
 * El estado MÍNIMO de la ruta estrecha «registro» (coach v2, L3): quién es,
 * qué misiones y reglas tocan HOY y cómo van, y lo registrado hoy (la misma
 * lectura que consultar_dia y la comprobación del servidor). Nada de dossier,
 * hechos, diario, estudios ni historial largo: para apuntar un parte no hacen
 * falta y son la parte cara del estado completo (~50 k fichas frente a ~1 k).
 *
 * Mismo permiso que buildContext: sin consentimiento de salud vigente, no se
 * construye (y leerRegistros, además, no lee las tablas de salud sin él).
 */
export async function buildContextMinimo(sb: Db, userId: string, today: string): Promise<BuiltContext> {
  await requireHealth(sb, userId);
  const weekday = diaSemana(today);
  const registradoHoyP = leerRegistros(sb, userId, today, today);

  const [profileRes, questsRes, todayDoneRes, rulesRes, checksRes] = await Promise.all([
    sb.from('profiles').select('name, profile_kind, streak_days').eq('id', userId).maybeSingle(),
    sb.from('quests').select('id, title, days_of_week, link, is_penalty, penalty_date, acquired_at, is_bonus')
      .eq('user_id', userId).eq('active', true).limit(60),
    sb.from('completions').select('quest_id').eq('user_id', userId).eq('date', today).limit(100),
    sb.from('rules').select('id, text, link').eq('user_id', userId).eq('active', true).limit(30),
    sb.from('rule_checks').select('rule_id').eq('user_id', userId).eq('date', today).limit(60),
  ]);

  const p = profileRes.data as Record<string, any> | null;
  if (!p) throw new Error('Perfil no encontrado');

  const hechas = new Set(((todayDoneRes.data ?? []) as any[]).map((c) => String(c.quest_id)));
  const todas = (questsRes.data ?? []) as any[];
  const deHoy = todas.filter((q) => !q.is_penalty && !q.acquired_at && (q.days_of_week ?? []).includes(weekday));
  const penalizaciones = todas.filter((q) => q.is_penalty && q.penalty_date === today);

  const lines: string[] = [];
  const push = (s = '') => lines.push(s);

  push(`# PARTE DEL GLADIADOR · ${today}`);
  push(`Nombre: ${p.name ?? 'gladiador'} · racha ${p.streak_days ?? 0} días`);
  push(kindLines(p.profile_kind)[0]);
  push();

  push('## Misiones de hoy');
  if (!deHoy.length && !penalizaciones.length) push('Ninguna programada hoy.');
  for (const q of [...deHoy, ...penalizaciones]) {
    push(
      `- [${q.id}] "${q.title}" · ${hechas.has(String(q.id)) ? 'HECHA HOY' : 'PENDIENTE HOY'}` +
        `${q.is_penalty ? ' · penalización' : ''}${q.is_bonus ? ' · extra' : ''}` +
        `${ENLACE[q.link] ? ` · se marca sola al registrar ${ENLACE[q.link]}` : ''}`,
    );
  }
  push();

  const reglas = (rulesRes.data ?? []) as any[];
  if (reglas.length) {
    const cumplidas = new Set(((checksRes.data ?? []) as any[]).map((c) => String(c.rule_id)));
    push('## Reglas del contrato hoy');
    for (const r of reglas) {
      push(
        `- [${r.id}] "${r.text}" · ${cumplidas.has(String(r.id)) ? 'CUMPLIDA HOY' : 'pendiente hoy'}` +
          `${ENLACE[r.link] ? ` · se marca sola al registrar ${ENLACE[r.link]}` : ''}`,
      );
    }
    push();
  }

  push(`## Registrado hoy (${today})`);
  for (const l of lineasDelDia(await registradoHoyP, today)) push(`- ${l}`);
  push(
    'Lo que pone "se marca sola" no se marca a mano: registrar el acto real la marca. Si dice haber ' +
      'hecho algo que no aparece aquí, compruébalo con consultar_dia (mira también el día anterior) antes de negarlo.',
  );

  return { text: lines.join('\n'), dossier: '' };
}
