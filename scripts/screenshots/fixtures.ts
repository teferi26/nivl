// Synthetic, local-only content for screenshots of the unchanged native UI.
// This module imports no application services, credentials, or network client.
export type ScreenshotRow = Record<string, unknown>;

const anchor = new Date();
export function screenshotDate(offset = 0): string {
  const d = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() + offset, 12);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const at = (offset = 0, time = '08:00:00') => `${screenshotDate(offset)}T${time}.000Z`;
const id = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
export const SCREENSHOT_USER_ID = id(1);
export const SCREENSHOT_TODAY = screenshotDate();
const user = SCREENSHOT_USER_ID;
const weekday = anchor.getDay() === 0 ? 7 : anchor.getDay();

export const screenshotProfile: ScreenshotRow = {
  id: user, name: 'Alex', avatar_url: null, xp_total: 9450,
  xp_fue: 2300, xp_vit: 1700, xp_int: 2600, xp_agi: 1500, xp_per: 1350,
  streak_days: 7, perfect_streak_days: 7, last_day_processed: screenshotDate(-1),
  protection_stones: 2, freeze_until: null, freeze_reason: null,
  equipped_title: 'El Persistente', bonus_points: 0, onboarding_done: true,
  wake_time: '07:00:00', sleep_time: '23:00:00', timezone: 'Europe/Madrid',
  coach_mode: 'A', profile_kind: 'general', friend_code: 'ALEXDEMO', social_visible: true,
  created_at: at(-90),
};

const questSpecs = [
  ['Leer 20 minutos', 'INT', 'facil', 'ninguno'],
  ['Preparar el día', 'AGI', 'facil', 'ninguno'],
  ['Ordenar mi espacio', 'AGI', 'facil', 'ninguno'],
  ['Entrenar fuerza', 'FUE', 'media', 'gym'],
  ['Avanzar en mi proyecto', 'INT', 'media', 'ninguno'],
  ['Escribir mi diario', 'PER', 'facil', 'diario'],
];
const quests: ScreenshotRow[] = questSpecs.map(([title, stat, difficulty, link], i) => ({
  id: id(100 + i), user_id: user, title, stat, difficulty, link,
  days_of_week: [1, 2, 3, 4, 5, 6, 7], requires_evidence: false,
  active: true, is_penalty: false, penalty_date: null, penalty_xp: null,
  is_bonus: false, acquired_at: null, acquired_streak: null, created_at: at(-45 + i),
}));
const completions: ScreenshotRow[] = [];
quests.forEach((q, i) => {
  const historyDays = [17, 13, 10, 7, 7, 7][i]!;
  for (let n = historyDays; n >= 1; n -= 1) {
    completions.push({ id: id(1000 + i * 100 + n), user_id: user, quest_id: q.id,
      date: screenshotDate(-n), completed_at: at(-n, '20:30:00'),
      xp_awarded: q.difficulty === 'media' ? 45 : 20, evidence_url: null });
  }
  if (i < 3) completions.push({ id: id(2000 + i), user_id: user, quest_id: q.id,
    date: screenshotDate(), completed_at: at(0, `07:${20 + i * 10}:00`), xp_awarded: 20, evidence_url: null });
});

const planId = id(300);
const blocks = [
  [420, 440, 'Leer 20 minutos', 'estudio', 'Un capítulo antes de empezar.', id(100), true],
  [450, 465, 'Preparar el día', 'ritual', 'Elige lo importante.', id(101), true],
  [480, 495, 'Ordenar mi espacio', 'libre', 'Todo listo para trabajar.', id(102), true],
  [570, 660, 'Avanzar en mi proyecto', 'deep_work', 'Primero, la tarea principal.', id(104), false],
  [780, 825, 'Pausa para comer', 'comida', null, null, false],
  [1080, 1140, 'Entrenar fuerza', 'gym', 'La rutina que has preparado.', id(103), false],
  [1290, 1300, 'Escribir mi diario', 'ritual', 'Qué has hecho y qué sigue.', id(105), false],
  [1380, 1440, 'Descansar', 'dormir', null, null, false],
].map(([start, end, title, kind, detail, quest, done], i) => ({
  id: id(320 + i), user_id: user, plan_id: planId, start_min: start, end_min: end,
  title, kind, detail, quest_id: quest, done, notify: false, position: i,
}));

const gymDays = ['Tren superior', 'Pierna y core', 'Cuerpo completo'].map((name, i) => ({
  id: id(400 + i), user_id: user, name, day_of_week: ((weekday - 1 + i * 2) % 7) + 1,
}));
const exerciseSpecs = [
  ['Press banca', 3, 8, 60], ['Remo con mancuerna', 3, 10, 22], ['Press de hombro', 3, 10, 16],
  ['Sentadilla', 3, 8, 70], ['Peso muerto rumano', 3, 10, 60], ['Plancha', 3, 1, null],
  ['Press inclinado', 3, 10, 22], ['Remo en polea', 3, 10, 45], ['Zancadas', 3, 10, 14],
];
const exercises = exerciseSpecs.map(([name, sets, reps, weight], i) => ({
  id: id(420 + i), gym_day_id: gymDays[Math.floor(i / 3)]!.id, user_id: user,
  name, sets, reps, weight, position: i % 3,
}));
const sessions = [23, 20, 17, 14, 11, 8, 5, 2].map((days, i) => ({
  id: id(450 + i), user_id: user, date: screenshotDate(-days), gym_day_id: gymDays[i % 3]!.id,
  xp_awarded: 50, notes: null, created_at: at(-days, '18:45:00'),
}));
const lifts = sessions.flatMap((session, i) => [
  { id: id(470 + i * 3), user_id: user, session_id: session.id, exercise_name: 'Press banca', weight: [55, 55, 57.5, 57.5, 60, 60, 60, 60][i], reps: 8, rpe: 7, set_index: 0 },
  { id: id(471 + i * 3), user_id: user, session_id: session.id, exercise_name: 'Sentadilla', weight: 70, reps: 8, rpe: 7, set_index: 0 },
  { id: id(472 + i * 3), user_id: user, session_id: session.id, exercise_name: 'Remo con mancuerna', weight: 22, reps: 10, rpe: 7, set_index: 0 },
]);

const transactions: ScreenshotRow[] = [];
// Four complete sample months prevent a misleading runway based on a single day.
// These are manually entered demonstration movements, not bank integration.
for (let monthOffset = -3; monthOffset <= 0; monthOffset += 1) {
  const month = new Date(anchor.getFullYear(), anchor.getMonth() + monthOffset, 1);
  const ym = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`;
  const sample: [number, string, number, string][] = [
    [1, 'Ingreso del mes', 2200, 'ingreso_nomina'], [2, 'Alquiler', -650, 'vivienda'],
    [4, 'Compra semanal', -68, 'super'], [6, 'Transporte', -28, 'transporte'],
    [8, 'Curso de diseño', -45, 'formacion'], [10, 'Compra semanal', -62, 'super'],
    [12, 'Luz e internet', -82, 'suministros'], [16, 'Comida con amigos', -34, 'restaurante'],
    [18, 'Compra semanal', -64, 'super'], [21, 'Gimnasio', -35, 'gimnasio'],
    [23, 'Libros', -26, 'formacion'], [25, 'Compra semanal', -66, 'super'],
    [26, 'Ahorro del mes', -300, 'ahorro'],
  ];
  sample.forEach(([day, description, amount, category], i) => {
    if (monthOffset === 0 && day > anchor.getDate()) return;
    transactions.push({ id: id(600 + (monthOffset + 3) * 20 + i), user_id: user,
      account_id: id(580), date: `${ym}-${String(day).padStart(2, '0')}`, amount,
      currency: 'EUR', description, counterparty: null, category, source: 'manual',
      is_internal: false, notes: 'Dato de ejemplo' });
  });
}

const threadId = id(700);
export const screenshotAiStatus = {
  entitled: true, tier: 'pro', plan: 'pro_mensual', budget: 3000000,
  spent: 360000, remaining: 2640000, renews: screenshotDate(22), trial: false,
  deep_allowed: false, deep_remaining: 0, deep_turns: 0, trial_available: false,
};

export const screenshotTables: Record<string, ScreenshotRow[]> = {
  profiles: [screenshotProfile], quests, completions,
  day_plans: [{ id: planId, user_id: user, date: screenshotDate(), status: 'activo',
    verdict: null, brief: 'Un bloque para tu proyecto. Tiempo para entrenar. Un cierre tranquilo.', generated_at: at(0, '07:00:00') }],
  day_blocks: blocks,
  calendar_events: [
    { id: id(350), user_id: user, title: 'Revisión del proyecto', date: screenshotDate(), time: '11:30:00', notes: null, created_at: at(-3) },
    { id: id(351), user_id: user, title: 'Clase de fotografía', date: screenshotDate(2), time: '19:00:00', notes: null, created_at: at(-3) },
  ],
  dungeons: [
    { id: id(360), user_id: user, title: 'Crear mi portfolio', rank: 'C', description: 'Dar forma a mis mejores proyectos.', stat: 'INT', deadline: screenshotDate(21), status: 'active', created_at: at(-10), cleared_at: null },
    { id: id(361), user_id: user, title: 'Leer tres libros', rank: 'D', description: 'Leer y guardar una idea de cada capítulo.', stat: 'INT', deadline: screenshotDate(40), status: 'active', created_at: at(-15), cleared_at: null },
  ],
  dungeon_tasks: ['Elegir los proyectos', 'Escribir la presentación', 'Preparar las imágenes', 'Publicar el portfolio'].map((title, i) => ({
    id: id(370 + i), user_id: user, dungeon_id: id(360), title, is_boss: i === 3,
    difficulty: i === 3 ? 'dificil' : 'facil', done: i < 2, done_at: i < 2 ? at(-1) : null,
    due_date: screenshotDate(i === 2 ? 0 : 7), position: i,
  })),
  gym_days: gymDays, gym_exercises: exercises, gym_sessions: sessions, gym_lifts: lifts,
  // No fixture claims that the coach prescribed a workout or took a tool action.
  training_prescriptions: [],
  body_metrics: [75.8, 75.9, 75.7, 75.8, 75.9, 75.8, 75.8, 75.9].map((weight, i) => ({
    id: id(510 + i), user_id: user, date: screenshotDate(-21 + i * 3),
    weight_kg: weight, notes: null, created_at: at(-21 + i * 3),
  })),
  body_profile: [],
  goals: [
    { id: id(530), user_id: user, title: 'Leer 12 libros este año', metric_type: 'libre', exercise_name: null,
      start_value: 0, target_value: 12, current_value: 8, unit: 'libros', deadline: screenshotDate(90), status: 'active', created_at: at(-70), achieved_at: null },
    { id: id(531), user_id: user, title: 'Press banca: mi próxima marca', metric_type: 'ejercicio', exercise_name: 'Press banca',
      start_value: 50, target_value: 70, current_value: null, unit: 'kg', deadline: screenshotDate(60), status: 'active', created_at: at(-60), achieved_at: null },
  ],
  money_accounts: [{ id: id(580), user_id: user, name: 'Mi cuenta', provider: 'Registro manual', currency: 'EUR', balance: 2850, balance_at: at(), active: true }],
  transactions,
  money_plan: [{ id: id(590), user_id: user, from_date: screenshotDate().slice(0, 7) + '-01', active: true,
    income_target: 2200, spend_cap: 1500, savings_target: 300, runway_target_months: 3,
    currency: 'EUR', rationale: 'Plan personal de ejemplo.' }],
  budgets: [['super', 320], ['ocio', 120], ['formacion', 100]].map(([category, limit], i) => ({
    id: id(595 + i), user_id: user, category, monthly_limit: limit, active: true, rationale: null,
  })),
  category_rules: [],
  coach_threads: [{ id: threadId, user_id: user, title: 'Conversación de ejemplo', archived: false, created_at: at(-1), last_message_at: at(0, '09:35:00') }],
  coach_messages: [
    { id: id(710), user_id: user, thread_id: threadId, role: 'user', created_at: at(0, '09:34:00'),
      content: [{ type: 'text', text: 'Ejemplo: tengo 90 minutos para avanzar en mi portfolio. ¿Por dónde empiezo?' }] },
    { id: id(711), user_id: user, thread_id: threadId, role: 'assistant', created_at: at(0, '09:35:00'),
      content: [{ type: 'text', text: 'Elige un solo proyecto.\n\n20 min: reúne el material.\n50 min: escribe qué hiciste y por qué.\n20 min: revisa y deja el siguiente paso.\n\nUn bloque. Un resultado concreto.' }] },
  ],
  coach_dossier: [], coach_facts: [], coach_runs: [],
  rules: [], rule_checks: [], rule_breaks: [],
  events: completions.filter((c) => c.date === screenshotDate()).map((c, i) => ({
    id: id(740 + i), user_id: user, type: 'quest_complete', created_at: c.completed_at,
    payload: { title: quests[i]?.title, xp: c.xp_awarded },
  })),
  achievements: ['first_quest', 'quests_10', 'quests_50', 'streak_7', 'first_pr'].map((code, i) => ({
    id: id(750 + i), user_id: user, code, unlocked_at: at(-7 + i),
  })),
  journal_entries: [{ id: id(780), user_id: user, date: screenshotDate(-1), mood: 4, energy: 4,
    text: 'Dejé preparado el primer bloque de mañana. Tener un paso concreto me ayudó a empezar.',
    plan: 'Escribir la presentación del portfolio.', emotions: ['calma'],
    wins: ['Terminé un capítulo', 'Dejé mi espacio preparado'], lesson: 'Un paso pequeño es más fácil de empezar.',
    gratitude: 'Una conversación con un amigo.', sleep_hours: 7.5, created_at: at(-1, '21:30:00') }],
  journal_photos: [], quest_photos: [], recaps: [], letters: [], bonus_redemptions: [],
  cardio_sessions: [], nutrition_targets: [], nutrition_logs: [], meal_slots: [], shopping_items: [],
  push_tokens: [], subscriptions: [], ai_consents: [], age_confirmations: [],
};

export const screenshotBoard: ScreenshotRow[] = [
  { user_id: id(2), name: 'Lucía', xp_total: 10300, xp_window: 1170, streak_days: 12, completed: 40, scheduled: 42 },
  { user_id: user, name: 'Alex', xp_total: 9450, xp_window: 1080, streak_days: 7, completed: 39, scheduled: 42 },
  { user_id: id(3), name: 'Dani', xp_total: 7200, xp_window: 995, streak_days: 6, completed: 35, scheduled: 42 },
  { user_id: id(4), name: 'Marta', xp_total: 6400, xp_window: 910, streak_days: 9, completed: 33, scheduled: 42 },
].map((p, i) => ({ ...p, friendship_id: p.user_id === user ? null : id(810 + i),
  is_me: p.user_id === user, visible: true, avatar_url: null, equipped_title: null,
  profile_kind: 'general', days_active: 7, compliance_pct: Math.round(Number(p.completed) / Number(p.scheduled) * 100), window_days: 7,
}));

export const screenshotUser = {
  id: user, aud: 'authenticated', role: 'authenticated', email: 'alex.screenshot@example.com',
  email_confirmed_at: at(-90), phone: '', confirmed_at: at(-90), last_sign_in_at: at(),
  app_metadata: { provider: 'email', providers: ['email'] },
  user_metadata: { name: 'Alex', screenshot_fixture: true }, identities: [], created_at: at(-90), updated_at: at(),
};
export const screenshotSession = {
  access_token: 'screenshot-local-token-not-a-credential', refresh_token: 'screenshot-local-refresh-not-a-credential',
  token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user: screenshotUser,
};
