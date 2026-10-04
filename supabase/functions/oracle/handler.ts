// NIVL · Edge Function: Oráculo premium — proxy SEGURO de la API de Claude.
// La API key del dueño vive aquí como secret y JAMÁS llega al cliente. Solo
// responde a usuarios autenticados con la IA contratada (ai_begin_turn, el
// mismo candado que el coach) y dentro del cupo mensual. No es un proxy
// genérico: los prompts se construyen server-side.
// Despliegue:
//   supabase functions deploy oracle
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...

import { consentimientoIa, MENSAJE_SIN_CONSENTIMIENTO, SIN_CONSENTIMIENTO } from '../_shared/consent.ts';
import { healthConsent, healthRevision, healthScopedClient, HEALTH_REQUIRED } from '../_shared/health.ts';
import { adminClient, userClient, type Db } from '../_shared/db.ts';
import { AI_SAFETY_RULES } from '../_shared/ai-safety.ts';
import { costMicroUsd, type Usage } from '../_shared/anthropic.ts';
import { sinGuionesProfundo } from '../_shared/singuiones.ts';

const MODEL = 'claude-haiku-4-5';
const MONTHLY_CAP = 100; // consultas premium por usuario y mes (control de coste)
const PLAZO_ORACULO_MS = 60_000;

const admin = adminClient();

const GENERATE_SYSTEM = `Eres "el sistema" de NIVL, una app de hábitos con una estética de arena. El usuario te da un objetivo y tú lo conviertes en misiones diarias/semanales recurrentes y realistas.

Reglas:
- Genera entre 3 y 6 misiones recurrentes que, mantenidas en el tiempo, lleven al objetivo.
- Stats: FUE (ejercicio físico), VIT (nutrición/sueño/salud), INT (estudio/trabajo mental), AGI (constancia/organización), PER (reflexión/mentalidad).
- Dificultad por esfuerzo de UNA sesión: trivial (≤5 min), facil (≤20 min), media (~45 min), dificil (1-2 h), epica (medio día). XP: 10/25/50/100/250.
- Sé realista con la frecuencia: nadie aguanta 7 días/semana de todo.
- Títulos cortos y accionables, en español. Sin emojis.
${AI_SAFETY_RULES}`;

const WEEKLY_SYSTEM = `Eres "el sistema" de NIVL. Analizas la semana real del gladiador y propones AJUSTES CONCRETOS: misión que falla siempre → bajar dificultad o desactivar; misión trivial al 100% → subir dificultad; huecos → como mucho 1-2 misiones nuevas. Sé conservador: nunca más de 4 ajustes. Voz sobria, español, sin sermones.
${AI_SAFETY_RULES}`;

const QUEST_ITEM_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    stat: { type: 'string', enum: ['FUE', 'VIT', 'INT', 'AGI', 'PER'] },
    difficulty: { type: 'string', enum: ['trivial', 'facil', 'media', 'dificil', 'epica'] },
    days_of_week: { type: 'array', items: { type: 'integer', enum: [1, 2, 3, 4, 5, 6, 7] } },
    reasoning: { type: 'string' },
  },
  required: ['title', 'stat', 'difficulty', 'days_of_week', 'reasoning'],
  additionalProperties: false,
};

const GENERATE_SCHEMA = {
  type: 'object',
  properties: {
    quests: { type: 'array', items: QUEST_ITEM_SCHEMA },
    plan_summary: { type: 'string' },
  },
  required: ['quests', 'plan_summary'],
  additionalProperties: false,
};

const WEEKLY_SCHEMA = {
  type: 'object',
  properties: {
    analysis: { type: 'string' },
    adjustments: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          quest_id: { type: 'string' },
          quest_title: { type: 'string' },
          action: { type: 'string', enum: ['ajustar_dificultad', 'desactivar'] },
          new_difficulty: { type: 'string', enum: ['trivial', 'facil', 'media', 'dificil', 'epica'] },
          reasoning: { type: 'string' },
        },
        required: ['quest_id', 'quest_title', 'action', 'reasoning'],
        additionalProperties: false,
      },
    },
    new_quests: { type: 'array', items: QUEST_ITEM_SCHEMA },
    advice: { type: 'string' },
  },
  required: ['analysis', 'adjustments', 'new_quests', 'advice'],
  additionalProperties: false,
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json(405, { error: 'Método no permitido' });

  // 1) Autenticación: JWT de Supabase del usuario
  const authHeader = req.headers.get('authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) return json(401, { error: 'No autenticado' });
  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData.user) return json(401, { error: 'Sesión inválida' });
  const userId = userData.user.id;
  if (await healthConsent(admin, userId) !== true) return json(403, { error: 'Activa el permiso de salud en Perfil antes de usar el oráculo.', reason: HEALTH_REQUIRED });
  const revision = await healthRevision(admin, userId);
  const healthDb = healthScopedClient(userClient(token, revision), revision);

  // 1b) Consentimiento para la IA (0028): sin él, ni una llamada al modelo.
  const consiente = await consentimientoIa(admin, userId);
  if (consiente === null) return json(503, { error: 'El oráculo no puede comprobar tu consentimiento ahora mismo.' });
  if (!consiente) return json(403, { error: MENSAJE_SIN_CONSENTIMIENTO, reason: SIN_CONSENTIMIENTO });

  // 2) El candado de gasto de la IA (0020/0024), el MISMO que el coach.
  //
  // Antes el Oráculo miraba `subscriptions` por su cuenta y llevaba su cupo
  // en oracle_usage leyendo y escribiendo `count + 1` DESPUÉS de llamar al
  // modelo: una ráfaga de peticiones a la vez pasaba entera con el cupo a 99
  // (probado: 8 de 8 llegaban al proveedor) y nada de lo gastado constaba en
  // coach_runs. Ahora: derecho y presupuesto por ai_state, y el cerrojo de un
  // turno a la vez por usuario, que además serializa el cupo de abajo.
  const { data: puerta, error: puertaErr } = await admin.rpc('ai_begin_turn', { p_user: userId, p_mode: 'estandar' });
  if (puertaErr) {
    console.error('ai_begin_turn failed:', puertaErr.message);
    return json(503, { error: 'El oráculo no puede comprobar tu plan ahora mismo.' });
  }
  const estado = puerta as { allowed?: boolean; reason?: string } | null;
  if (!estado || estado.allowed !== true) {
    const reason = estado?.reason ?? 'sin_suscripcion';
    if (reason === 'turno_en_curso') {
      return json(429, { error: 'El sistema todavía está respondiendo a tu petición anterior.', reason });
    }
    if (reason === 'presupuesto_agotado') {
      return json(402, { error: 'Has agotado la IA de este mes.', reason });
    }
    return json(402, { error: 'El Oráculo es parte de NIVL Pro.', reason: 'sin_suscripcion' });
  }

  try {
    return await consultar(req, userId, healthDb);
  } finally {
    await admin.rpc('ai_end_turn', { p_user: userId }).then(
      () => {},
      () => {},
    );
  }
}

async function consultar(req: Request, userId: string, healthDb: Db): Promise<Response> {
  // 3) Cupo mensual. Con el cerrojo tomado, leer y luego escribir ya no es
  // una carrera: solo hay una consulta en vuelo por usuario.
  const month = new Date().toISOString().slice(0, 7);
  const { data: usage } = await admin
    .from('oracle_usage')
    .select('count')
    .eq('user_id', userId)
    .eq('month', month)
    .maybeSingle();
  const used = Number(usage?.count ?? 0);
  if (used >= MONTHLY_CAP) {
    return json(429, { error: `Cupo mensual del Oráculo agotado (${MONTHLY_CAP}). Se renueva el mes próximo.` });
  }

  // 4) Petición acotada (NUNCA un proxy genérico)
  let body: { kind?: string; goal?: string; weeklyInput?: unknown };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'Cuerpo inválido' });
  }

  let system: string;
  let userContent: string;
  let schema: unknown;
  if (body.kind === 'generate') {
    const goal = String(body.goal ?? '').slice(0, 500).trim();
    if (!goal) return json(400, { error: 'Falta el objetivo' });
    system = GENERATE_SYSTEM;
    userContent = `Mi objetivo: ${goal}`;
    schema = GENERATE_SCHEMA;
  } else if (body.kind === 'weekly') {
    const input = JSON.stringify(body.weeklyInput ?? {}).slice(0, 8000);
    system = WEEKLY_SYSTEM;
    userContent = `Datos de mis últimos 14 días:\n${input}`;
    schema = WEEKLY_SCHEMA;
  } else {
    return json(400, { error: 'kind debe ser generate o weekly' });
  }

  // 5) Llamada a Anthropic con la key del servidor
  const consienteAlEnviar = await consentimientoIa(admin, userId);
  if (consienteAlEnviar === null) return json(503, { error: 'El oráculo no puede comprobar tu consentimiento ahora mismo.' });
  if (!consienteAlEnviar) return json(403, { error: MENSAJE_SIN_CONSENTIMIENTO, reason: SIN_CONSENTIMIENTO });
  if (await healthConsent(healthDb, userId) !== true) return json(403, { error: 'El permiso de salud ya no está activo.', reason: HEALTH_REQUIRED });

  let res: Response;
  try {
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      // Con plazo: sin él, un proveedor colgado retiene el cerrojo hasta que
      // la plataforma mata la función.
      signal: AbortSignal.timeout(PLAZO_ORACULO_MS),
      headers: {
        'x-api-key': Deno.env.get('ANTHROPIC_API_KEY') ?? '',
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2500,
        system,
        messages: [{ role: 'user', content: userContent }],
        output_config: { format: { type: 'json_schema', schema } },
      }),
    });
  } catch (e) {
    console.error('oracle provider unreachable:', e instanceof Error ? e.name : 'error');
    return json(502, { error: 'El oráculo no responde. Reintenta en un momento.' });
  }

  if (!res.ok) {
    console.error('anthropic error:', res.status);
    return json(502, { error: 'El oráculo no responde. Reintenta en un momento.' });
  }

  let data: { content?: { type: string; text?: string }[]; usage?: Usage; model?: string };
  try {
    data = await res.json();
  } catch {
    return json(502, { error: 'El oráculo no responde. Reintenta en un momento.' });
  }

  // 6) Contabiliza el uso en cuanto el proveedor ha cobrado, salga bien o no
  // lo que viene detrás: en el cupo propio y en coach_runs, que es lo que mira
  // el candado. (kind 'oracle' necesita la propuesta c-coach-runs-kinds.sql;
  // hasta aplicarla, el insert falla y queda en el log.)
  const modelo = data.model ?? MODEL;
  const u: Usage = data.usage ?? {};
  await admin
    .from('oracle_usage')
    .upsert({ user_id: userId, month, count: used + 1 }, { onConflict: 'user_id,month' });
  const { error: ledgerErr } = await admin.from('coach_runs').insert({
    user_id: userId,
    kind: 'oracle',
    mode: 'estandar',
    model: modelo,
    in_tokens: u.input_tokens ?? 0,
    cache_read_tokens: u.cache_read_input_tokens ?? 0,
    cache_write_tokens: u.cache_creation_input_tokens ?? 0,
    out_tokens: u.output_tokens ?? 0,
    cost_micro_usd: costMicroUsd(modelo, u),
  });
  if (ledgerErr) console.error('coach_runs insert failed (oracle):', ledgerErr.message);

  const text = data.content?.find((b) => b.type === 'text')?.text;
  if (!text) return json(502, { error: 'Respuesta vacía del oráculo.' });
  let result: unknown;
  try {
    // Orden del dueño: sin «—» ni «–» en ningún texto del oráculo.
    result = sinGuionesProfundo(JSON.parse(text));
  } catch {
    return json(502, { error: 'El oráculo no responde. Reintenta en un momento.' });
  }

  if (await healthConsent(healthDb, userId) !== true) return json(403, { error: 'El permiso de salud ya no está activo.', reason: HEALTH_REQUIRED });
  return json(200, { result, remaining: MONTHLY_CAP - used - 1 });
}
