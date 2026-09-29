// NIVL · Edge Function: Oráculo premium — proxy SEGURO de la API de Claude.
// La API key del dueño vive aquí como secret y JAMÁS llega al cliente. Solo
// responde a usuarios autenticados CON suscripción activa y dentro del cupo
// mensual. No es un proxy genérico: los prompts se construyen server-side.
// Despliegue:
//   supabase functions deploy oracle
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...

import { consentimientoIa, MENSAJE_SIN_CONSENTIMIENTO, SIN_CONSENTIMIENTO } from '../_shared/consent.ts';
import { healthConsent, healthRevision, healthScopedClient, HEALTH_REQUIRED } from '../_shared/health.ts';
import { adminClient, userClient } from '../_shared/db.ts';
import { AI_SAFETY_RULES } from '../_shared/ai-safety.ts';

const MODEL = 'claude-haiku-4-5';
const MONTHLY_CAP = 100; // consultas premium por usuario y mes (control de coste)

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

Deno.serve(async (req) => {
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

  // 2) Suscripción activa (el candado real: sin pagar no hay IA)
  const { data: sub } = await admin
    .from('subscriptions')
    .select('status, current_period_end')
    .eq('user_id', userId)
    .maybeSingle();
  const premium =
    sub &&
    (sub.status === 'active' || sub.status === 'trialing') &&
    (!sub.current_period_end || new Date(sub.current_period_end) > new Date());
  if (!premium) {
    return json(402, { error: 'El Oráculo es parte de NIVL Pro.', reason: 'sin_suscripcion' });
  }

  // 3) Cupo mensual
  const month = new Date().toISOString().slice(0, 7);
  const { data: usage } = await admin
    .from('oracle_usage')
    .select('count')
    .eq('user_id', userId)
    .eq('month', month)
    .maybeSingle();
  const used = usage?.count ?? 0;
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
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
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

  if (!res.ok) {
    console.error('anthropic error:', res.status);
    return json(502, { error: 'El oráculo no responde. Reintenta en un momento.' });
  }

  const data = (await res.json()) as { content: { type: string; text?: string }[] };
  const text = data.content.find((b) => b.type === 'text')?.text;
  if (!text) return json(502, { error: 'Respuesta vacía del oráculo.' });

  // 6) Contabiliza el uso (tras el éxito)
  await admin
    .from('oracle_usage')
    .upsert({ user_id: userId, month, count: used + 1 }, { onConflict: 'user_id,month' });

  if (await healthConsent(healthDb, userId) !== true) return json(403, { error: 'El permiso de salud ya no está activo.', reason: HEALTH_REQUIRED });
  return json(200, { result: JSON.parse(text), remaining: MONTHLY_CAP - used - 1 });
});
