// Datos ficticios deterministas de la cuenta de ejemplo. Personas, amigos,
// conversaciones, entrenos y dinero son inventados. Sin imágenes remotas.
import { AI_CONSENT_VERSION } from '@/lib/consentmath';
import { HEALTH_CONSENT_VERSION } from '@/lib/healthmath';

export type Fila = Record<string, unknown>;

const ancla = new Date();
export function fecha(desfase = 0): string {
  const d = new Date(ancla.getFullYear(), ancla.getMonth(), ancla.getDate() + desfase, 12);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const en = (desfase = 0, hora = '08:00:00') => `${fecha(desfase)}T${hora}.000Z`;
const id = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const YO = id(1);
const diaSemana = ancla.getDay() === 0 ? 7 : ancla.getDay();
const lunes = fecha(1 - diaSemana);
const TODOS = [1, 2, 3, 4, 5, 6, 7];

const perfil: Fila = {
  id: YO, name: 'Alex', avatar_url: null,
  // Nivel 26: Héroe de la arena, grado II.
  xp_total: 138400, xp_fue: 34200, xp_vit: 25100, xp_int: 38600, xp_agi: 22300, xp_per: 18200,
  streak_days: 128, perfect_streak_days: 41, last_day_processed: fecha(-1),
  protection_stones: 3, freeze_until: null, freeze_reason: null,
  equipped_title: 'Héroe de la arena', bonus_points: 340, onboarding_done: true,
  wake_time: '07:00:00', sleep_time: '23:00:00', timezone: 'Europe/Madrid',
  coach_mode: 'A', profile_kind: 'general', friend_code: 'ALEX7K2Q', social_visible: true,
  locale: 'es', created_at: en(-430),
};

const misiones: [string, string, string, string][] = [
  ['Leer 20 minutos', 'INT', 'facil', 'ninguno'],
  ['Preparar el día', 'AGI', 'facil', 'ninguno'],
  ['Caminar 8.000 pasos', 'VIT', 'facil', 'ninguno'],
  ['Bloque de trabajo profundo', 'INT', 'dificil', 'ninguno'],
  ['Entrenar fuerza', 'FUE', 'media', 'gym'],
  ['Ordenar mi espacio', 'AGI', 'facil', 'ninguno'],
  ['Escribir mi diario', 'PER', 'facil', 'diario'],
];
const quests: Fila[] = misiones.map(([title, stat, difficulty, link], i) => ({
  id: id(100 + i), user_id: YO, title, stat, difficulty, link, modes: [],
  days_of_week: i === 4 ? [1, 2, 4, 6] : TODOS, requires_evidence: false,
  active: true, is_penalty: false, penalty_date: null, penalty_xp: null,
  is_bonus: false, acquired_at: null, acquired_streak: null, health_data: false, created_at: en(-300 + i),
}));

const XP: Record<string, number> = { facil: 30, media: 60, dificil: 110 };
const completions: Fila[] = [];
quests.forEach((q, i) => {
  for (let n = 180; n >= 1; n -= 1) {
    // La racha alcanza 128 días: antes hay algún hueco, como en la vida real.
    if (n > 128 && (n * 7 + i * 5) % 11 === 0) continue;
    if (n <= 128 && i >= 5 && (n * 3 + i) % 9 === 0) continue;
    completions.push({
      id: id(10000 + i * 1000 + n), user_id: YO, quest_id: q.id, date: fecha(-n),
      completed_at: en(-n, '20:30:00'), xp_awarded: XP[String(q.difficulty)] ?? 30, evidence_url: null,
    });
  }
  if (i < 3) {
    completions.push({
      id: id(9000 + i), user_id: YO, quest_id: q.id, date: fecha(),
      completed_at: en(0, `07:${20 + i * 10}:00`), xp_awarded: 45, evidence_url: null,
    });
  }
});

const PLAN = id(300);
const bloques: Fila[] = ([
  [420, 440, 'Leer 20 minutos', 'estudio', 'Un capítulo antes de empezar.', id(100), true],
  [450, 465, 'Preparar el día', 'ritual', 'Elige lo importante.', id(101), true],
  [510, 540, 'Caminar 8.000 pasos', 'libre', 'Ida al trabajo a pie.', id(102), true],
  [570, 690, 'Bloque de trabajo profundo', 'deep_work', 'La tarea principal, sin móvil.', id(103), false],
  [810, 855, 'Comer con calma', 'comida', null, null, false],
  [1080, 1140, 'Entrenar fuerza', 'gym', 'Tren superior. Press banca primero.', id(104), false],
  [1260, 1275, 'Ordenar mi espacio', 'libre', null, id(105), false],
  [1290, 1305, 'Escribir mi diario', 'ritual', 'Qué has hecho y qué sigue.', id(106), false],
  [1380, 1440, 'Descansar', 'dormir', null, null, false],
] as const).map(([start, end, title, kind, detail, quest, done], i) => ({
  id: id(320 + i), user_id: YO, plan_id: PLAN, start_min: start, end_min: end,
  title, kind, detail, quest_id: quest, done, notify: false, position: i,
}));

const diasGym = ['Tren superior', 'Pierna y core', 'Cuerpo completo'].map((name, i) => ({
  id: id(400 + i), user_id: YO, name, day_of_week: [1, 2, 4][i],
}));
const ejercicios = ([
  ['Press banca', 4, 8, 82.5], ['Remo con barra', 4, 8, 70], ['Press militar', 3, 10, 42.5],
  ['Sentadilla', 4, 6, 110], ['Peso muerto rumano', 3, 10, 90], ['Plancha', 3, 1, null],
  ['Dominadas', 4, 8, 10], ['Press inclinado', 3, 10, 30], ['Zancadas', 3, 12, 22],
] as const).map(([name, sets, reps, weight], i) => ({
  id: id(420 + i), gym_day_id: diasGym[Math.floor(i / 3)]!.id, user_id: YO, name, sets, reps, weight, position: i % 3,
}));
const sesiones = [24, 22, 20, 17, 15, 13, 10, 8, 6, 3, 2].map((d, i) => ({
  id: id(450 + i), user_id: YO, date: fecha(-d), gym_day_id: diasGym[i % 3]!.id,
  xp_awarded: 60, notes: null, created_at: en(-d, '18:45:00'),
}));
const series = sesiones.flatMap((s, i) => ([
  ['Press banca', 75 + i * 0.75, 8], ['Sentadilla', 100 + i, 6], ['Remo con barra', 62.5 + i * 0.75, 8],
] as const).map(([exercise_name, weight, reps], j) => ({
  id: id(480 + i * 3 + j), user_id: YO, session_id: s.id, exercise_name, weight, reps, rpe: 8, set_index: 0,
  gym_sessions: { date: s.date },
})));

const transacciones: Fila[] = [];
for (let m = -3; m <= 0; m += 1) {
  const mes = new Date(ancla.getFullYear(), ancla.getMonth() + m, 1);
  const ym = `${mes.getFullYear()}-${String(mes.getMonth() + 1).padStart(2, '0')}`;
  ([
    [1, 'Nómina', 2400, 'ingreso_nomina'], [2, 'Alquiler', -720, 'vivienda'],
    [4, 'Compra semanal', -68, 'super'], [6, 'Transporte', -28, 'transporte'],
    [8, 'Curso de diseño', -45, 'formacion'], [10, 'Compra semanal', -62, 'super'],
    [12, 'Luz e internet', -82, 'suministros'], [16, 'Cena con amigos', -34, 'restaurante'],
    [18, 'Compra semanal', -64, 'super'], [21, 'Gimnasio', -35, 'gimnasio'],
    [23, 'Libros', -26, 'formacion'], [25, 'Compra semanal', -66, 'super'],
    [26, 'Ahorro del mes', -300, 'ahorro'],
  ] as [number, string, number, string][]).forEach(([dia, description, amount, category], i) => {
    if (m === 0 && dia > ancla.getDate()) return;
    transacciones.push({
      id: id(600 + (m + 3) * 20 + i), user_id: YO, account_id: id(580),
      date: `${ym}-${String(dia).padStart(2, '0')}`, amount, currency: 'EUR', description,
      counterparty: null, category, source: 'manual', is_internal: false, notes: null,
    });
  });
}

const HILO = id(700);
const texto = (t: string) => [{ type: 'text', text: t }];
const chat: [string, string, string][] = [
  ['user', '09:34:00', 'Tengo 90 minutos antes de comer y mucho por hacer. ¿Por dónde empiezo?'],
  ['assistant', '09:35:00', 'Por lo que más pesa: el bloque de trabajo profundo. Llevas tres mañanas haciéndolo antes de las 12 y es cuando mejor rindes.\n\n20 min: deja el material listo.\n60 min: una sola tarea, sin móvil.\n10 min: escribe el siguiente paso.\n\nTu racha va por 128 días. Hoy no la pones en juego por un correo.'],
  ['user', '09:38:00', 'Vale. ¿Y el gimnasio? Ayer dormí poco.'],
  ['assistant', '09:39:00', 'Mantén el press banca a 82,5 kg, pero quita una serie. Con menos de 7 horas de sueño tu rendimiento baja un 6 % en tus últimas sesiones.\n\nA las 18:00, tren superior. A las 23:00, a dormir.'],
];

const nombresTareas: [string, boolean][] = [
  ['Elegir los proyectos', true], ['Escribir la presentación', true], ['Preparar las imágenes', true],
  ['Revisar con un mentor', false], ['Publicar el portfolio', false],
];

export const tablasArnes: Record<string, Fila[]> = {
  profiles: [perfil], quests, completions,
  day_plans: [{
    id: PLAN, user_id: YO, date: fecha(), status: 'activo', verdict: null,
    brief: 'Un bloque para tu proyecto. Tiempo para entrenar. Un cierre tranquilo.', generated_at: en(0, '07:00:00'),
  }],
  day_blocks: bloques,
  calendar_events: [
    { id: id(350), user_id: YO, title: 'Revisión del proyecto', date: fecha(), time: '11:30:00', notes: null, created_at: en(-3) },
    { id: id(351), user_id: YO, title: 'Café con Lucía', date: fecha(1), time: '17:00:00', notes: null, created_at: en(-3) },
    { id: id(352), user_id: YO, title: 'Clase de fotografía', date: fecha(2), time: '19:00:00', notes: null, created_at: en(-3) },
    { id: id(353), user_id: YO, title: 'Dentista', date: fecha(5), time: '10:15:00', notes: null, created_at: en(-3) },
  ],
  dungeons: [
    { id: id(360), user_id: YO, title: 'Crear mi portfolio', rank: 'B', description: 'Dar forma a mis mejores proyectos.', stat: 'INT', deadline: fecha(21), status: 'active', created_at: en(-10), cleared_at: null },
    { id: id(361), user_id: YO, title: 'Leer doce libros', rank: 'C', description: 'Un libro al mes y una idea de cada capítulo.', stat: 'INT', deadline: fecha(49), status: 'active', created_at: en(-60), cleared_at: null },
    { id: id(362), user_id: YO, title: 'Correr 10 km', rank: 'A', description: 'De cero a la carrera popular.', stat: 'VIT', deadline: fecha(70), status: 'active', created_at: en(-30), cleared_at: null },
    { id: id(363), user_id: YO, title: 'Ordenar mis finanzas', rank: 'D', description: 'Presupuesto y fondo de tres meses.', stat: 'PER', deadline: null, status: 'cleared', created_at: en(-120), cleared_at: en(-40) },
  ],
  dungeon_tasks: [
    ...nombresTareas.map(([title, done], i) => ({
      id: id(370 + i), user_id: YO, dungeon_id: id(360), title, is_boss: i === 4,
      difficulty: i === 4 ? 'dificil' : 'media', done, done_at: done ? en(-1 - i) : null,
      due_date: fecha(i === 3 ? 0 : 7), position: i,
    })),
    ...['Enero a marzo', 'Abril a junio', 'Julio a septiembre', 'Octubre a diciembre'].map((title, i) => ({
      id: id(380 + i), user_id: YO, dungeon_id: id(361), title, is_boss: i === 3, difficulty: 'media',
      done: i < 3, done_at: i < 3 ? en(-20) : null, due_date: fecha(30), position: i,
    })),
    ...['5 km sin parar', '7 km a ritmo suave', '10 km de prueba', 'La carrera'].map((title, i) => ({
      id: id(390 + i), user_id: YO, dungeon_id: id(362), title, is_boss: i === 3, difficulty: 'dificil',
      done: i < 1, done_at: i < 1 ? en(-5) : null, due_date: fecha(30 + i * 10), position: i,
    })),
    { id: id(399), user_id: YO, dungeon_id: id(363), title: 'Crear el presupuesto', is_boss: true, difficulty: 'media', done: true, done_at: en(-40), due_date: null, position: 0 },
  ],
  gym_days: diasGym, gym_exercises: ejercicios, gym_sessions: sesiones, gym_lifts: series,
  training_prescriptions: [],
  body_metrics: [76.9, 76.7, 76.6, 76.4, 76.5, 76.2, 76.1, 75.9].map((weight_kg, i) => ({
    id: id(510 + i), user_id: YO, date: fecha(-21 + i * 3), weight_kg, notes: null, created_at: en(-21 + i * 3),
  })),
  body_profile: [],
  goals: [
    { id: id(530), user_id: YO, title: 'Leer 12 libros este año', metric_type: 'libre', exercise_name: null, start_value: 0, target_value: 12, current_value: 10, unit: 'libros', deadline: fecha(49), status: 'active', created_at: en(-200), achieved_at: null },
    { id: id(531), user_id: YO, title: 'Press banca a 100 kg', metric_type: 'ejercicio', exercise_name: 'Press banca', start_value: 60, target_value: 100, current_value: null, unit: 'kg', deadline: fecha(120), status: 'active', created_at: en(-160), achieved_at: null },
  ],
  money_accounts: [{ id: id(580), user_id: YO, name: 'Cuenta principal', provider: 'Registro manual', currency: 'EUR', balance: 6480, balance_at: en(), active: true }],
  transactions: transacciones,
  money_plan: [{
    id: id(590), user_id: YO, from_date: `${fecha().slice(0, 7)}-01`, active: true, income_target: 2400,
    spend_cap: 1500, savings_target: 300, runway_target_months: 6, currency: 'EUR', rationale: 'Plan de ejemplo.',
  }],
  budgets: ([['super', 320], ['ocio', 120], ['formacion', 100]] as const).map(([category, monthly_limit], i) => ({
    id: id(595 + i), user_id: YO, category, monthly_limit, active: true, rationale: null,
  })),
  category_rules: [], money_categories: [], money_recurring: [], money_briefs: [],
  coach_threads: [{ id: HILO, user_id: YO, title: 'Hoy', archived: false, created_at: en(-1), last_message_at: en(0, '09:39:00') }],
  coach_messages: chat.map(([role, hora, t], i) => ({
    id: id(710 + i), user_id: YO, thread_id: HILO, role, created_at: en(0, hora), content: texto(t),
  })),
  coach_dossier: [], coach_facts: [], coach_runs: [],
  rules: [], rule_checks: [], rule_breaks: [],
  events: [],
  achievements: [
    'first_quest', 'first_day', 'quests_10', 'quests_50', 'quests_100', 'quests_500', 'streak_7', 'streak_30', 'streak_100',
    'level_5', 'level_10', 'level_25', 'first_dungeon', 'first_pr', 'first_journal', 'journal_30', 'dias_100', 'dias_200', 'dias_365',
    'rango_D', 'rango_C', 'rango_B', 'rango_A',
  ].map((code, i) => ({ id: id(750 + i), user_id: YO, code, unlocked_at: en(-300 + i * 12) })),
  journal_entries: [{
    id: id(780), user_id: YO, date: fecha(-1), mood: 4, energy: 4,
    text: 'Dejé preparado el primer bloque de mañana. Tener un paso concreto me ayudó a empezar.',
    plan: 'Escribir la presentación del portfolio.', emotions: ['calma'],
    wins: ['Terminé un capítulo', 'Dejé mi espacio preparado'], lesson: 'Un paso pequeño es más fácil de empezar.',
    gratitude: 'Una conversación con un amigo.', sleep_hours: 7.5, created_at: en(-1, '21:30:00'),
  }],
  journal_photos: [], quest_photos: [], recaps: [], letters: [], bonus_redemptions: [],
  cardio_sessions: [], nutrition_targets: [], nutrition_logs: [], meal_slots: [], shopping_items: [],
  progress_photos: [], push_tokens: [], subscriptions: [], app_feedback: [],
  user_modes: [], mode_xp: [],
  focus_subjects: [], focus_topics: [], focus_decks: [], focus_cards: [], focus_sessions: [], focus_exams: [], focus_classes: [], focus_grades: [],
};

const tablero: Fila[] = ([
  [id(2), 'Lucía', 151200, 2130, 164, 49, 50],
  [YO, 'Alex', 138400, 1995, 128, 40, 46],
  [id(3), 'Dani', 112700, 1720, 73, 41, 50],
  [id(4), 'Marta', 98300, 1510, 52, 37, 50],
  [id(5), 'Hugo', 76500, 1240, 31, 33, 50],
  [id(6), 'Nerea', 54100, 980, 18, 28, 50],
] as const).map(([user_id, name, xp_total, xp_window, streak_days, completed, scheduled], i) => ({
  user_id, name, xp_total, xp_window, streak_days, completed, scheduled,
  friendship_id: user_id === YO ? null : id(810 + i), is_me: user_id === YO, visible: true,
  avatar_url: null, equipped_title: null, profile_kind: 'general', days_active: 7,
  compliance_pct: Math.round((completed / scheduled) * 100), window_days: 7,
}));

const duelos: Fila[] = [
  {
    id: id(830), soy_retador: true, rival: 'Lucía', week_start: lunes, status: 'accepted', mi_indice: 96, su_indice: 91,
    mis_dias: 4, sus_dias: 4, resultado: null, mi_suficiente: true, su_suficiente: true, semana_cerrada: false,
  },
  {
    id: id(831), soy_retador: false, rival: 'Dani', week_start: fecha(1 - diaSemana - 7), status: 'done', mi_indice: 94, su_indice: 82,
    mis_dias: 7, sus_dias: 6, resultado: 'gano', mi_suficiente: true, su_suficiente: true, semana_cerrada: true,
  },
];

const IA_PAGA = {
  entitled: true, tier: 'pro', plan: 'pro_mensual', budget: 3000000, spent: 360000, remaining: 2640000,
  renews: fecha(22), trial: false, deep_allowed: false, deep_remaining: 0, deep_turns: 0, trial_available: false, vision: true,
};
const IA_GRATIS = {
  entitled: false, tier: 'free', plan: null, budget: 0, spent: 0, remaining: 0,
  trial: false, deep_allowed: false, deep_remaining: 0, deep_turns: 0, trial_available: false, vision: null,
};

/** El resultado de cada RPC; undefined = sin fixture (como función inexistente). */
export function rpcArnes(nombre: string, args: Fila): unknown {
  switch (nombre) {
    case 'app_flags': return {};
    case 'my_age_confirmation': return true;
    case 'my_adult_confirmation': return true;
    case 'my_health_consent':
      return { accepted: true, version: HEALTH_CONSENT_VERSION, current_version: HEALTH_CONSENT_VERSION, revision: 1, erasure_pending: false };
    case 'my_ai_consent':
      return { current_version: AI_CONSENT_VERSION, granted: true, action: 'accept', version: AI_CONSENT_VERSION, at: en(-30) };
    case 'ai_status':
      return (globalThis as { __TIENDA__?: { plan?: string | null } }).__TIENDA__?.plan === 'free' ? IA_GRATIS : IA_PAGA;
    case 'my_completions':
      return completions.filter((c) => (!args.p_from || String(c.date) >= String(args.p_from)) && (!args.p_until || String(c.date) <= String(args.p_until)));
    case 'my_completion_stats': return { total: completions.length, with_evidence: 412 };
    case 'friends_board': return tablero;
    case 'friend_requests_safe': return [];
    case 'friends_ranks': return [
      { user_id: id(2), rango: 'A' }, { user_id: id(3), rango: 'B' }, { user_id: id(4), rango: 'B' },
      { user_id: id(5), rango: 'C' }, { user_id: id(6), rango: 'C' },
    ];
    case 'my_duels': return duelos;
    case 'my_league_standing': return [];
    case 'my_league_invites': return [];
    case 'social_blocked_users': return [];
    case 'elite_badges': return [];
    case 'my_elite_group': return { eligible: false, group: null, requested: false, requested_goal: null };
    case 'elite_group_board': return [];
    case 'my_referral': return null;
    case 'my_share_alias': return null;
    case 'my_invites': return { activos: 0, pendientes: 0, caducadas: 0, tope: 5, invites: [] };
    case 'settle_my_invites': return { ok: true, activos: 0, pendientes: 0, nuevas_insignias: [] };
    case 'my_progress_photos_meta': return [];
    case 'founder_seats_left': return 0;
    case 'es_admin': return false;
    case 'creator_panel': return null;
    case 'sync_rank': return { nuevos: [], dias_activos: 412 };
    case 'touch_open':
    case 'registrar_evento':
    case 'claim_push_token':
    case 'olvidar_instalacion':
      return { ok: true };
    default:
      return undefined;
  }
}

export const usuarioArnes = {
  id: YO, aud: 'authenticated', role: 'authenticated', email: 'alex@example.com',
  email_confirmed_at: en(-430), phone: '', confirmed_at: en(-430), last_sign_in_at: en(),
  app_metadata: { provider: 'email', providers: ['email'] },
  user_metadata: { name: 'Alex' }, identities: [], created_at: en(-430), updated_at: en(),
};
export const sesionArnes = {
  access_token: 'arnes-local-no-es-una-credencial', refresh_token: 'arnes-local-no-es-una-credencial',
  token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user: usuarioArnes,
};
