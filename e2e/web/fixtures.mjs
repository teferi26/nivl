// Datos ficticios del Supabase de mentira (mock-supabase.mjs). Ningún dato real:
// el repo es público. Se relee en cada petición, así que las fechas siempre
// caen en "hoy" y se puede ampliar sin reiniciar el simulado.
//
// El simulado solo entiende filtros `col=eq.valor` (e ignora una columna que la
// fila no tenga); `gte`, `in`, `or` y `order` no filtran ni ordenan. Por eso las
// filas ya van en orden de lectura y solo hay una fila cuando el código pide
// `.maybeSingle()` sin un `eq` que acote.

export const ID = '00000000-0000-4000-8000-000000000001';

const uid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const dia = (delta = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + delta);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const hace = (dias) => new Date(Date.now() - dias * 86_400_000).toISOString();
const SEMANA = [1, 2, 3, 4, 5, 6, 7]; // ISO: 7 es domingo (isoWeekday).

export const IDS = { campana: uid(101), hilo: uid(201), tema: uid(301), mazo: uid(401), cuenta: uid(501) };

function mision(n, title, stat, difficulty, extra = {}) {
  return {
    id: uid(10 + n),
    user_id: ID,
    title,
    stat,
    difficulty,
    days_of_week: SEMANA,
    requires_evidence: false,
    active: true,
    is_penalty: false,
    penalty_date: null,
    penalty_xp: null,
    is_bonus: false,
    acquired_at: null,
    acquired_streak: null,
    link: 'ninguno',
    modes: [],
    health_data: false,
    created_at: hace(40),
    ...extra,
  };
}

function crearCuerpo() {
  const gym_days = [1, 3, 5].map((d, i) => ({ id: uid(601 + i), user_id: ID, day_of_week: d, name: ['Empuje', 'Tirón', 'Pierna'][i] }));
  const nombres = [
    ['Press banca', 4, 8, 72.5],
    ['Press militar', 3, 10, 40],
    ['Fondos en paralelas', 3, 12, null],
  ];
  const gym_exercises = gym_days.flatMap((g, i) =>
    nombres.map(([name, sets, reps, weight], j) => ({ id: uid(620 + i * 10 + j), gym_day_id: g.id, user_id: ID, name, sets, reps, weight, position: j })),
  );
  const gym_sessions = [14, 11, 9, 7, 4, 2].map((d, i) => ({
    id: uid(660 + i),
    user_id: ID,
    date: dia(-d),
    gym_day_id: gym_days[i % 3].id,
    xp_awarded: 40,
    notes: null,
    created_at: hace(d),
  }));
  const gym_lifts = gym_sessions.flatMap((s, i) =>
    [0, 1, 2].map((set_index) => ({ id: uid(700 + i * 3 + set_index), session_id: s.id, user_id: ID, exercise_name: 'Press banca', weight: 67.5 + i * 2.5, reps: 8, rpe: 7 + (set_index % 3), set_index })),
  );
  const cardio_sessions = [12, 8, 5, 1].map((d, i) => ({
    id: uid(760 + i),
    user_id: ID,
    date: dia(-d),
    kind: i % 2 ? 'bici' : 'correr',
    distance_km: 6 + i,
    duration_min: 36 + i * 4,
    avg_hr: 148,
    rpe: 6,
    zone: 'Z2',
    notes: null,
    xp_awarded: 25,
  }));
  const body_metrics = [28, 21, 14, 7, 3, 0].map((d, i) => ({ id: uid(780 + i), user_id: ID, date: dia(-d), weight_kg: 81.4 - i * 0.3, notes: null, created_at: hace(d) }));
  const SLOTS = ['desayuno', 'comida', 'merienda', 'cena'];
  const PLATOS = ['Avena con plátano y nueces', 'Pollo con arroz y brócoli', 'Yogur con frutos rojos', 'Salmón con patata y ensalada'];
  const meal_slots = SEMANA.flatMap((d, i) =>
    SLOTS.map((slot, j) => ({ id: uid(800 + i * 4 + j), user_id: ID, day_of_week: d, slot, description: PLATOS[j], ingredients: 'Ingredientes de ejemplo', kcal: 450 + j * 50, protein_g: 25 + j * 5 })),
  );
  return {
    gym_days,
    gym_exercises,
    gym_sessions,
    gym_lifts,
    cardio_sessions,
    body_metrics,
    meal_slots,
    shopping_items: ['Pechuga de pollo', 'Arroz integral', 'Brócoli', 'Avena'].map((name, i) => ({ id: uid(840 + i), user_id: ID, name, qty: i ? '1 kg' : '2 kg', done: i === 3, created_at: hace(2) })),
    nutrition_targets: [{ id: uid(850), user_id: ID, from_date: dia(-20), kcal: 2500, protein_g: 170, carbs_g: 280, fat_g: 75, rationale: 'Mantenimiento con ligero superávit.' }],
    nutrition_logs: [{ id: uid(851), user_id: ID, date: dia(0), hit_kcal: true, hit_protein: false, kcal_est: 1480, protein_est: 92, notes: null, water_ml: 1250, free_meal: false }],
    training_prescriptions: nombres.map(([exercise_name, sets, reps, weight], position) => ({ id: uid(860 + position), user_id: ID, date: dia(0), exercise_name, sets, reps: String(reps), weight, rpe_target: 8, notes: null, position })),
    goals: [
      { id: uid(870), user_id: ID, title: 'Press banca a 100 kg', metric_type: 'ejercicio', exercise_name: 'Press banca', start_value: 70, target_value: 100, current_value: 80, unit: 'kg', deadline: dia(90), status: 'active', created_at: hace(30), achieved_at: null },
      { id: uid(871), user_id: ID, title: 'Bajar a 78 kg', metric_type: 'peso_corporal', exercise_name: null, start_value: 82, target_value: 78, current_value: 80.2, unit: 'kg', deadline: dia(120), status: 'active', created_at: hace(30), achieved_at: null },
    ],
    progress_photos: [],
  };
}

function crearFocus() {
  const focus_subjects = ['Derecho civil', 'Matemáticas II', 'Historia del arte'].map((name, position) => ({ id: uid(300 + position * 10), user_id: ID, name, position, archived: false, created_at: hace(60) }));
  const focus_exams = focus_subjects.map((s, i) => ({ id: uid(350 + i), user_id: ID, subject_id: s.id, title: `Parcial de ${s.name}`, exam_date: dia(9 + i * 6), weight: 40 }));
  const estados = ['dominado', 'repasando', 'repasando', 'pendiente', 'pendiente'];
  const focus_topics = focus_subjects.flatMap((s, i) =>
    estados.map((status, j) => ({
      id: i === 0 && j === 0 ? IDS.tema : uid(360 + i * 10 + j),
      user_id: ID,
      subject_id: s.id,
      exam_id: focus_exams[i].id,
      name: `Tema ${j + 1}: contenido de ejemplo`,
      status,
      position: j,
      review_stage: status === 'pendiente' ? 0 : j + 1,
      review_due: status === 'pendiente' ? null : dia(j - 1),
      created_at: hace(30),
    })),
  );
  return {
    focus_subjects,
    focus_exams,
    focus_topics,
    focus_sessions: [6, 4, 3, 2, 1].map((d, i) => ({ id: uid(390 + i), user_id: ID, subject_id: focus_subjects[i % 3].id, topic_id: null, session_date: dia(-d), minutes: 50, method: 'pomodoro' })),
    focus_classes: focus_subjects.map((s, i) => ({ id: uid(395 + i), user_id: ID, subject_id: s.id, weekday: i + 1, start_min: 540 + i * 60, end_min: 630 + i * 60, room: `Aula ${i + 1}` })),
    focus_grades: focus_subjects.map((s, i) => ({ id: uid(398 + i), user_id: ID, subject_id: s.id, title: 'Práctica 1', score: 6.5 + i, max_score: 10, weight: 20, graded_on: dia(-15 + i) })),
    focus_decks: [{ id: IDS.mazo, user_id: ID, subject_id: focus_subjects[0].id, name: 'Conceptos clave', created_at: hace(20) }],
    focus_cards: ['Definición', 'Excepciones', 'Plazo'].map((front, i) => ({ id: uid(410 + i), user_id: ID, deck_id: IDS.mazo, front, back: 'Respuesta de ejemplo', stage: i, due: dia(i - 1) })),
  };
}

function crearDinero() {
  const money_accounts = [
    { id: IDS.cuenta, user_id: ID, name: 'Cuenta principal', provider: 'banco', currency: 'EUR', opening_balance: 3200, opening_date: dia(-120), sort_order: 0, active: true },
    { id: uid(502), user_id: ID, name: 'Ahorro', provider: 'banco', currency: 'EUR', opening_balance: 8000, opening_date: dia(-120), sort_order: 1, active: true },
  ];
  const conceptos = [
    ['Nómina empresa ficticia', 2400, 'ingreso_nomina', 'Empresa Ficticia SL'],
    ['Alquiler', -850, 'vivienda', 'Inmobiliaria Ejemplo'],
    ['Supermercado', -64.3, 'super', 'Super Ejemplo'],
    ['Cena con amigos', -38.5, 'restaurante', 'Restaurante Ejemplo'],
    ['Abono transporte', -40, 'transporte', 'Transporte Ejemplo'],
    ['Suscripción de música', -10.99, 'suscripciones', 'Música Ejemplo'],
    ['Factura de luz', -72.4, 'suministros', 'Luz Ejemplo'],
    ['Gimnasio', -35, 'gimnasio', 'Gimnasio Ejemplo'],
  ];
  const transactions = [0, 1, 2, 3].flatMap((mes) =>
    conceptos.map(([description, amount, category, counterparty], i) => ({
      id: uid(520 + mes * 10 + i),
      user_id: ID,
      date: dia(-(mes * 30 + i + 1)),
      amount,
      description,
      counterparty,
      category,
      is_internal: false,
      account_id: IDS.cuenta,
      transfer_id: null,
      recurring_id: null,
      user_category_id: null,
      currency: 'EUR',
      source: 'manual',
      notes: null,
    })),
  );
  return {
    money_accounts,
    transactions,
    money_recurring: [
      { id: uid(570), user_id: ID, account_id: IDS.cuenta, kind: 'gasto', name: 'Alquiler', amount: 850, day_of_month: 1, category: 'vivienda', user_category_id: null, start_date: dia(-120), end_date: null, generated_through: null, active: true },
      { id: uid(571), user_id: ID, account_id: IDS.cuenta, kind: 'gasto', name: 'Suscripción de música', amount: 10.99, day_of_month: 12, category: 'suscripciones', user_category_id: null, start_date: dia(-120), end_date: null, generated_through: null, active: true },
    ],
    money_categories: [{ id: uid(575), user_id: ID, name: 'Mascotas', kind: 'gasto', base_category: 'otros', active: true }],
    money_plan: [{ id: uid(576), user_id: ID, from_date: dia(-30), income_target: 2400, spend_cap: 1600, savings_target: 500, runway_target_months: 6, currency: 'EUR', rationale: 'Plan de ejemplo.' }],
    money_briefs: [],
    budgets: [
      { id: uid(577), user_id: ID, category: 'restaurante', monthly_limit: 150, amount: 150, active: true },
      { id: uid(578), user_id: ID, category: 'super', monthly_limit: 300, amount: 300, active: true },
    ],
    category_rules: [{ id: uid(579), user_id: ID, pattern: 'super ejemplo', category: 'super', priority: 1, active: true }],
  };
}

function crearCoach() {
  const texto = (text) => [{ type: 'text', text }];
  return {
    coach_threads: [{ id: IDS.hilo, user_id: ID, title: 'Plan de la semana', last_message_at: hace(0.05), kind: 'general', created_at: hace(3) }],
    coach_messages: [
      { id: uid(211), thread_id: IDS.hilo, user_id: ID, role: 'user', content: texto('¿Qué me toca hoy?'), created_at: hace(0.06) },
      { id: uid(212), thread_id: IDS.hilo, user_id: ID, role: 'assistant', content: texto('Hoy toca empuje a las 18:00. Antes, dos bloques de trabajo profundo. Respuesta de ejemplo del simulado.'), created_at: hace(0.05) },
    ],
    coach_dossier: [{ user_id: ID, content: 'Dossier de ejemplo: gladiador ficticio que entrena tres días por semana.', version: 3 }],
    coach_facts: [{ id: uid(220), user_id: ID, date: dia(-3), category: 'entreno', content: 'Prefiere entrenar por la tarde.', source: 'chat' }],
    coach_runs: [{ id: uid(230), user_id: ID, kind: 'chat', cost_micro_usd: 1800, created_at: hace(0.1) }],
    day_plans: [{ id: uid(240), user_id: ID, date: dia(0), status: 'activo', verdict: 'Día sólido', brief: 'Prioriza el bloque de la mañana y no te saltes el empuje.', generated_at: hace(0.2) }],
    day_blocks: [
      [420, 450, 'Despertar y ritual', 'ritual', true],
      [540, 660, 'Trabajo profundo', 'deep_work', true],
      [840, 900, 'Comida', 'comida', false],
      [1080, 1170, 'Gimnasio: empuje', 'gym', false],
      [1380, 1410, 'A dormir', 'dormir', false],
    ].map(([start_min, end_min, title, kind, done], position) => ({ id: uid(250 + position), plan_id: uid(240), user_id: ID, start_min, end_min, title, kind, detail: null, quest_id: null, notify: true, done, position })),
    recaps: [],
    letters: [{ id: uid(260), user_id: ID, body: 'Carta de ejemplo a mi yo futuro.', sealed_at: hace(30), open_at: dia(60), opened_at: null }],
  };
}

/**
 * Escenarios del simulado (los elige el correo de entrada, ver mock-supabase.mjs):
 *   · completo: gladiador con todo pagado y datos llenos.
 *   · sin-onboarding: cuenta recién creada, sin pagar, sin permisos de salud ni IA.
 *   · sin-pago: onboarding hecho y modos activados, pero sin pagar ninguno
 *     (la puerta MundoCerrado y la oferta por modos).
 */
export const ESCENARIOS = ['completo', 'sin-onboarding', 'sin-pago'];

export function crear(escenario = 'completo') {
  const ahora = new Date().toISOString();
  const usuario = {
    id: ID,
    aud: 'authenticated',
    role: 'authenticated',
    email: 'gladiador@nivl.test',
    email_confirmed_at: ahora,
    created_at: ahora,
    updated_at: ahora,
    app_metadata: { provider: 'email' },
    user_metadata: {},
  };
  const perfil = {
    id: ID,
    user_id: ID,
    username: 'gladiador',
    display_name: 'Gladiador',
    name: 'Gladiador',
    avatar_url: null,
    onboarding_done: true,
    profile_kind: 'general',
    xp_total: 4200,
    xp_fue: 1200,
    xp_vit: 900,
    xp_int: 800,
    xp_agi: 700,
    xp_per: 600,
    streak_days: 12,
    perfect_streak_days: 5,
    last_day_processed: dia(-1),
    protection_stones: 1,
    freeze_until: null,
    freeze_reason: null,
    equipped_title: null,
    bonus_points: 40,
    wake_time: '07:00:00',
    sleep_time: '23:30:00',
    timezone: 'Europe/Madrid',
    coach_mode: 'A',
    locale: 'es',
    friend_code: 'GLAD1234',
    social_visible: true,
    created_at: hace(90),
  };
  const modos = ['iron', 'focus', 'work', 'founder'].map((mode) => ({ user_id: ID, mode, enabled: true, created_at: ahora }));

  const quests = [
    mision(1, 'Entrenar según el plan', 'FUE', 'media', { link: 'gym', modes: ['iron'] }),
    mision(2, 'Registrar lo que como', 'VIT', 'facil', { link: 'nutricion', modes: ['iron'] }),
    mision(3, 'Leer veinte minutos', 'INT', 'facil'),
    mision(4, 'Dos bloques de estudio', 'INT', 'dificil', { modes: ['focus'] }),
    mision(5, 'Trabajo profundo sin móvil', 'PER', 'dificil', { modes: ['work', 'founder'] }),
    mision(6, 'Revisar cuentas de la semana', 'PER', 'facil', { modes: ['work', 'founder'] }),
    mision(7, 'Caminar treinta minutos', 'AGI', 'trivial'),
    mision(8, 'Escribir en el diario', 'PER', 'facil', { link: 'diario' }),
  ];
  const completadas = [
    { id: uid(50), user_id: ID, quest_id: quests[2].id, date: dia(0), completed_at: hace(0.1), xp_awarded: 15, evidence_url: null },
    ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].flatMap((d, i) =>
      quests.slice(0, 5).map((q, j) => ({ id: uid(1000 + i * 10 + j), user_id: ID, quest_id: q.id, date: dia(-d), completed_at: hace(d), xp_awarded: 25, evidence_url: null })),
    ),
  ];

  const dungeon = { id: IDS.campana, user_id: ID, title: 'Preparar la media maratón', rank: 'B', description: 'Campaña de ejemplo: doce semanas de plan.', stat: 'AGI', deadline: dia(60), status: 'active', created_at: hace(14), cleared_at: null };
  const tareas = ['Comprar zapatillas', 'Rodaje de 10 km', 'Tirada larga de 16 km', 'Jefe final: la carrera'].map((title, position) => ({
    id: uid(110 + position),
    dungeon_id: IDS.campana,
    user_id: ID,
    title,
    is_boss: position === 3,
    difficulty: position === 3 ? 'epica' : 'media',
    done: position === 0,
    done_at: position === 0 ? hace(3) : null,
    due_date: dia(position * 12),
    position,
  }));

  const rules = ['No móvil en la primera hora', 'Dormir antes de medianoche', 'Nada de alcohol entre semana'].map((text, position) => ({ id: uid(140 + position), user_id: ID, position, text, consequence: 'Misión de penalización al día siguiente', active: true, link: 'ninguno', health_data: false, created_at: hace(30) }));

  const journal_entries = [0, 1, 2, 3, 4].map((d, i) => ({
    id: uid(160 + i),
    user_id: ID,
    date: dia(-d),
    mood: 3 + (i % 3),
    energy: 3 + ((i + 1) % 3),
    text: 'Entrada de ejemplo del diario. Día tranquilo con buen ritmo.',
    plan: 'Empezar por lo difícil.',
    emotions: [],
    wins: ['Terminé el bloque de la mañana'],
    lesson: 'Preparar la bolsa la noche anterior.',
    gratitude: 'Un buen rato con amigos.',
    sleep_hours: 7.5,
    created_at: hace(d),
  }));

  const calendar_events = [0, 1, 3, 6].map((d, i) => ({ id: uid(170 + i), user_id: ID, title: ['Dentista', 'Reunión de equipo', 'Cumpleaños de ejemplo', 'Revisión del coche'][i], date: dia(d), time: i % 2 ? '10:30:00' : '17:00:00', notes: null, created_at: hace(5) }));

  const amigo = (n, name, xp_total, racha) => ({
    user_id: uid(900 + n),
    friendship_id: uid(950 + n),
    is_me: false,
    visible: true,
    name,
    avatar_url: null,
    xp_total,
    streak_days: racha,
    equipped_title: null,
    profile_kind: 'general',
    xp_window: 300 + n * 40,
    days_active: 5,
    scheduled: 30,
    completed: 22 + n,
    compliance_pct: 72 + n,
    window_days: 7,
  });
  const tablero = [
    { ...amigo(1, 'Lucio', 6100, 30) },
    { ...amigo(0, 'Gladiador', perfil.xp_total, perfil.streak_days), user_id: ID, friendship_id: null, is_me: true },
    { ...amigo(2, 'Marcia', 3100, 7) },
    { ...amigo(3, 'Tito', 1500, 2) },
  ];

  const salidaBase = {
    usuario,
    ESCENARIOS,
    tablas: {
      profiles: [perfil],
      user_modes: modos,
      mode_xp: modos.map((m, i) => ({ user_id: ID, mode: m.mode, xp: 300 * (i + 1) })),
      quests,
      dungeons: [dungeon],
      dungeon_tasks: tareas,
      rules,
      rule_checks: [],
      rule_breaks: [],
      journal_entries,
      journal_photos: [],
      calendar_events,
      achievements: [{ id: uid(180), user_id: ID, code: 'primera_mision', unlocked_at: hace(60) }],
      evidence: [],
      quest_photos: [],
      events: [],
      subscriptions: [],
      push_tokens: [],
      bonus_redemptions: [],
      ...crearCuerpo(),
      ...crearFocus(),
      ...crearDinero(),
      ...crearCoach(),
    },
    rpc: {
      app_flags: {
        // Claves de la 1.0.11 (CLAVE_SERVIDOR en flagsmath.ts).
        modos_1011: true,
        idiomas_1011: true,
        prueba_auto_1011: false,
        valoracion_1011: false,
        prueba_auto_dias: 2,
        prueba_ia_mensajes_dia: 20,
      },
      // Las dos puertas (EdadMinimaGuard y HealthConsentGuard) abiertas de salida.
      my_age_confirmation: true,
      confirm_minimum_age: true,
      my_adult_confirmation: true,
      my_health_consent: { accepted: true, version: '2026-09-27-salud-v1', current_version: '2026-09-27-salud-v1', revision: 1, erasure_pending: false },
      accept_health_consent: { ok: true },
      my_ai_consent: { current_version: '2026-09-29', granted: true, action: 'accept', version: '2026-09-29', at: hace(30) },
      accept_ai_consent: { ok: true },
      // Cobro por modos (0140): el servidor dice qué mundos abre la cuenta.
      mis_modos: { modos: ['iron', 'focus', 'work', 'founder'], plan: 'modos_todos_anual', producto: 'nivl_modos_todos_anual', expira: dia(200), trial: false },
      ai_status: {
        entitled: true,
        plan: 'elite_mensual',
        tier: 'elite',
        budget: 20_000_000,
        spent: 2_000_000,
        remaining: 18_000_000,
        renews: dia(20),
        trial: false,
        deep_allowed: true,
        deep_remaining: 5_000_000,
        deep_turns: 12,
        trial_available: false,
        vision: true,
        ia: null,
      },
      founder_seats_left: 40,
      my_completions: completadas,
      my_completion_stats: { total: completadas.length, with_evidence: 0 },
      my_referral: { alias: null, since: null, claimable: true },
      my_invites: { activos: 1, pendientes: 1, caducadas: 0, tope: 10, insignias: [], invitado: false },
      settle_my_invites: { ok: true, activos: 1, pendientes: 1, nuevas_insignias: [] },
      friends_board: tablero,
      friends_ranks: [],
      friend_requests_safe: [{ friendship_id: uid(990), user_id: uid(991), direction: 'incoming', name: 'Julia', level: 7, created_at: hace(1) }],
      elite_badges: [{ user_id: uid(901) }],
      my_elite_group: { eligible: true, group: null, requested: false, requested_goal: null },
      elite_group_board: [],
      my_share_alias: { alias: 'gladiador', aprobado: true },
      social_blocked_users: [],
      my_progress_photos_meta: [],
      es_admin: true,
      touch_open: null,
      sync_rank: null,
      registrar_evento: null,
    },
    funciones: {},
  };

  if (escenario === 'sin-onboarding' || escenario === 'sin-pago') {
    const gratis = { entitled: false, plan: null, tier: 'free', budget: 0, spent: 0, remaining: 0, trial: false, deep_allowed: false, deep_remaining: 0, deep_turns: 0, trial_available: true, vision: false, ia: null };
    salidaBase.rpc.ai_status = gratis;
    salidaBase.rpc.mis_modos = { modos: [], plan: null, producto: null, expira: null, trial: false };
    salidaBase.rpc.my_ai_consent = { current_version: '2026-09-29', granted: false, action: null, version: null, at: null };
  }
  if (escenario === 'sin-onboarding') {
    Object.assign(salidaBase.tablas.profiles[0], {
      onboarding_done: false,
      name: 'Gladiador',
      display_name: 'Gladiador',
      xp_total: 0,
      xp_fue: 0,
      xp_vit: 0,
      xp_int: 0,
      xp_agi: 0,
      xp_per: 0,
      streak_days: 0,
      perfect_streak_days: 0,
      bonus_points: 0,
      protection_stones: 0,
    });
    salidaBase.tablas.quests = [];
    salidaBase.tablas.user_modes = [];
    salidaBase.tablas.mode_xp = [];
    salidaBase.rpc.my_completions = [];
    salidaBase.rpc.my_completion_stats = { total: 0, with_evidence: 0 };
    salidaBase.rpc.my_health_consent = { accepted: false, version: null, current_version: '2026-09-27-salud-v1', revision: 0, erasure_pending: false };
  }
  return salidaBase;
}
