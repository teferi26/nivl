// NIVL · Edge Function: LOS RITUALES.
//
// Esto es lo que convierte a NIVL en un coach que trabaja para ti y no en una
// app que abres. pg_cron la llama cada hora; ella mira qué hora es en la zona
// de cada gladiador y decide si le toca algo:
//
//   · brief          — a la hora de despertar, con el plan del día escrito
//   · revision       — domingo por la tarde
//   · cierre_mensual — el día 1
//   · escalada       — si lleva días en silencio (la carta con tres puertas)
//   · checkin        — (L6) si no le toca nada de lo anterior: una pregunta
//                      breve de seguimiento, con tope (ver _shared/checkin.ts)
//
// Después empuja el resultado por notificación push, con la política del
// servidor (_shared/pushpolicy.ts, espejo de src/lib/pushPolicy.ts): solo si
// abrió la app hace ≤6 días, dentro de su ventana despierto y 1 push al día
// como mucho. Si no hay token o la política calla, el ritual igual queda
// escrito y lo verá al abrir la app.
//
// Despliegue:
//   supabase functions deploy ritual --no-verify-jwt
//   supabase secrets set RITUAL_SECRET=<cadena larga al azar>

import { callClaude, CHEAP_MODEL, costMicroUsd, LlamadaFallida, type Usage } from '../_shared/anthropic.ts';
import { esColumnaInexistente, insertarRun } from '../_shared/telemetria.ts';
import { AI_SAFETY_RULES } from '../_shared/ai-safety.ts';
import { buildContextMinimo } from '../_shared/context.ts';
import { DATOS_ABRE, DATOS_CIERRA, neutralizarDatos, REGLA_DATOS } from '../_shared/prompt.ts';
import { pushDelServidorPermitido, type Momento } from '../_shared/pushpolicy.ts';
import {
  checkinPermitido,
  desdeParaMensajes,
  esMensajeDelGladiador,
  horaDelCheckin,
  KINDS_CON_PUSH,
  limpiarCheckin,
  MAX_CARACTERES_CHECKIN,
  pushesDeHoy,
} from '../_shared/checkin.ts';
import { consentimientoIa } from '../_shared/consent.ts';
import { sinGuiones } from '../_shared/singuiones.ts';
import { healthConsent, healthRevision, healthScopedClient, requireHealth } from '../_shared/health.ts';
import { adminClient, type Db } from '../_shared/db.ts';
import { espejarEntrada, espejoActivo } from '../_shared/notion.ts';

const EXPO_PUSH = 'https://exp.host/--/api/v2/push/send';

interface Perfil {
  id: string;
  name: string;
  timezone: string;
  wake_time: string;
  sleep_time: string;
  coach_mode: string;
  /** Última apertura de la app, fecha local (0048). null = cliente antiguo o migración sin aplicar. */
  last_open_on?: string | null;
}

/** El reloj del ritual. Los tests lo sustituyen para fijar la hora. */
export const relojRitual = { ahora: (): Date => new Date() };

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

/** Hora local del gladiador, sin librerías: Intl ya sabe de husos y de DST. */
function ahoraLocal(timezone: string): { fecha: string; hora: number; minuto: number; diaSemana: number } {
  const ahora = relojRitual.ahora();
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    weekday: 'short',
  });
  const partes = Object.fromEntries(fmt.formatToParts(ahora).map((p) => [p.type, p.value]));
  const dias: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
  return {
    fecha: `${partes.year}-${partes.month}-${partes.day}`,
    hora: Number(partes.hour) % 24,
    minuto: Number(partes.minute),
    diaSemana: dias[partes.weekday] ?? 1,
  };
}

/**
 * Compara el secreto del cron en tiempo constante. Con `!==` la comparación se
 * corta en el primer carácter distinto, y el tiempo de respuesta filtra
 * cuántos ha acertado quien prueba desde fuera (la función es pública:
 * --no-verify-jwt).
 */
export function secretoValido(recibido: string | null, esperado: string | undefined): boolean {
  if (!esperado || recibido === null) return false;
  const enc = new TextEncoder();
  const a = enc.encode(recibido);
  const b = enc.encode(esperado);
  let diff = a.length ^ b.length;
  for (let i = 0; i < b.length; i++) diff |= (a[i] ?? 0) ^ b[i];
  return diff === 0;
}

function horaDe(t: string): number {
  return Number(String(t).slice(0, 2));
}

/**
 * Convierte el ritual entero en una línea para la notificación.
 *
 * Antes se cortaba por el carácter 240, que en un brief que empieza con
 * "**El veredicto: tu gasto no es el problema…**" daba una notificación con
 * asteriscos y partida a mitad de frase. Y una notificación es lo único que ves
 * si no abres la app: si no dice nada, el ritual no ha servido de nada.
 *
 * Lo hace Haiku porque resumir en una línea un texto que ya está escrito no
 * pide criterio, y con la tarifa del coach este resumen costaría más que
 * generar el brief. Si falla, se cae al recorte de siempre: quedarse sin push
 * por no tener titular sería peor.
 */
async function titular(sb: Db, userId: string, cuerpo: string): Promise<string> {
  await requireHealth(sb, userId);
  const plano = cuerpo.replace(/[*#_`]/g, '').replace(/\s+/g, ' ').trim();
  if (plano.length <= 180) return sinGuiones(plano);
  try {
    if ((await consentimientoIa(sb, userId)) !== true) return sinGuiones(plano.slice(0, 240));
    const turn = await callClaude({
      model: CHEAP_MODEL,
      signal: AbortSignal.timeout(30_000),
      system: [{
        type: 'text',
        text: 'Resumes en UNA sola frase de menos de 180 caracteres lo que un coach acaba de escribirle a su cliente. Tono seco y directo, en segunda persona, sin emojis, sin markdown, sin comillas. Si hay una cifra o una hora concretas, van dentro. Devuelves solo la frase.',
      }],
      messages: [{ role: 'user', content: [{ type: 'text', text: plano.slice(0, 6000) }] }],
      maxTokens: 200,
      effort: 'low',
    });
    // También esto cuesta y también va al libro: sin fila, el candado no lo
    // ve. (kind 'titular' necesita la propuesta c-coach-runs-kinds.sql; hasta
    // aplicarla el insert falla y queda en el log.)
    // Con telemetría de la 0047 si ya está aplicada; si no, sin ella.
    const { error: ledgerErr } = await insertarRun(sb, {
      user_id: userId,
      kind: 'titular',
      mode: 'estandar',
      model: turn.model,
      in_tokens: turn.usage.input_tokens ?? 0,
      cache_read_tokens: turn.usage.cache_read_input_tokens ?? 0,
      cache_write_tokens: turn.usage.cache_creation_input_tokens ?? 0,
      out_tokens: turn.usage.output_tokens ?? 0,
      cost_micro_usd: costMicroUsd(turn.model, turn.usage),
    }, { route: 'mecanica', tools_offered: 0, tool_calls: 0, iterations: 1 });
    if (ledgerErr) console.error('coach_runs insert failed (titular):', ledgerErr.message);
    const t = turn.content.filter((b) => b.type === 'text').map((b) => b.text ?? '').join('').trim();
    if (t) return sinGuiones(t.slice(0, 240));
  } catch (e) {
    console.error('titular failed');
  }
  return sinGuiones(plano.slice(0, 240));
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Aviso operativo de moderación (propuesta 0037_moderacion.sql).
 *
 * Al final de cada pasada del cron se pregunta a `moderation_digest()` (solo
 * service_role) cuántas denuncias o revisiones han entrado desde el último
 * aviso. Si hay alguna, se empuja un push a los dispositivos de las cuentas
 * owner que devuelve la propia RPC.
 *
 *   · Solo recuentos: NI una palabra del contenido de las denuncias.
 *   · No depende de los consentimientos de IA ni de salud: es operativo y no
 *     llama a ningún modelo.
 *   · Si la RPC aún no existe (42883 / PGRST202) se ignora con un aviso sin
 *     datos, para poder desplegar el ritual antes que la migración.
 *   · Nada de aquí puede tumbar el ritual: todo va dentro de un try.
 *
 * Devuelve a cuántos dispositivos se ha enviado (para los tests).
 */
export async function avisarModeracion(admin: Db): Promise<number> {
  try {
    const { data, error } = await admin.rpc('moderation_digest');
    if (error) {
      const code = (error as { code?: string }).code;
      if (code === '42883' || code === 'PGRST202') console.warn('moderation_digest todavía no existe: aviso omitido.');
      else console.warn('moderation_digest falló: aviso omitido.');
      return 0;
    }
    const d = data as { nuevos?: unknown; abiertos?: unknown; owners?: unknown } | null;
    const nuevos = Math.max(0, Math.trunc(Number(d?.nuevos) || 0));
    if (!nuevos) return 0;
    const abiertos = Math.max(nuevos, Math.trunc(Number(d?.abiertos) || 0));
    const owners = (Array.isArray(d?.owners) ? d!.owners : []).filter(
      (u): u is string => typeof u === 'string' && UUID.test(u),
    );
    if (!owners.length) return 0;

    const { data: filas, error: tokErr } = await admin.from('push_tokens').select('token').in('user_id', owners);
    if (tokErr) {
      console.warn('push_tokens de moderación no disponibles: aviso omitido.');
      return 0;
    }
    const tokens = [...new Set(((filas ?? []) as { token?: unknown }[]).map((t) => t.token).filter((t): t is string => typeof t === 'string' && !!t))];
    if (!tokens.length) return 0;

    const cuerpo = `${nuevos} ${nuevos === 1 ? 'denuncia o revisión nueva' : 'denuncias o revisiones nuevas'} · ${abiertos} ${abiertos === 1 ? 'abierta' : 'abiertas'}`;
    // Expo admite hasta 100 mensajes por petición.
    for (let i = 0; i < tokens.length; i += 100) {
      await fetch(EXPO_PUSH, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(
          tokens.slice(i, i + 100).map((to) => ({
            to,
            title: 'Moderación',
            body: cuerpo,
            sound: 'default',
            priority: 'high',
            channelId: 'sistema',
            // Sin pantalla de moderación en la app: Hoy (ruta en RUTAS_PERMITIDAS de voice.ts).
            data: { ruta: '/(tabs)' },
          })),
        ),
      }).catch(() => {});
    }
    return tokens.length;
  } catch (_e) {
    console.warn('aviso de moderación falló: omitido.');
    return 0;
  }
}

async function empujar(sb: Db, userId: string, titulo: string, cuerpo: string, ruta: string) {
  await requireHealth(sb, userId);
  const { data: tokens } = await sb.from('push_tokens').select('token').eq('user_id', userId);
  const lista = (tokens ?? []).map((t: { token: string }) => t.token);
  if (!lista.length) return;

  if (await healthConsent(sb, userId) !== true || await consentimientoIa(sb, userId) !== true) return;
  await fetch(EXPO_PUSH, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(
      lista.map((to) => ({
        to,
        title: titulo,
        body: cuerpo,
        sound: 'default',
        priority: 'high',
        channelId: 'sistema',
        data: { ruta },
      })),
    ),
  }).catch(() => {});
}

/**
 * El resumen del mes, automático el día 1. El semanal NO se genera solo: es un
 * momento y se pide cuando apetece verlo; el mensual llega sin pedirlo porque
 * si no, no se mira nunca.
 *
 * Devuelve null si no hubo fotos ese mes. En ese caso no se avisa de nada: un
 * push diciendo "no hay resumen" es peor que el silencio.
 */
async function resumenMensual(userJwt: string): Promise<number | null> {
  const url = `${Deno.env.get('SUPABASE_URL')}/functions/v1/coach`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${userJwt}`,
      apikey: Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ kind: 'resumen', periodo: 'mensual' }),
  });
  if (!res.ok) return null;
  const body = (await res.json().catch(() => ({}))) as { slides?: unknown[]; fotos?: number };
  return body.slides?.length ? (body.fotos ?? 0) : null;
}

/** Llama a la función `coach` como lo haría la app, pero desde el servidor. */
async function invocarCoach(userJwt: string, kind: string, message: string): Promise<string> {
  const url = `${Deno.env.get('SUPABASE_URL')}/functions/v1/coach`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${userJwt}`,
      apikey: Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ kind, message, stream: false }),
  });
  const body = (await res.json().catch(() => ({}))) as { text?: string; error?: string };
  if (!res.ok) throw new Error(body.error ?? `coach HTTP ${res.status}`);
  return body.text ?? '';
}

/**
 * Sesión de servidor para un usuario concreto. El coach ejecuta sus
 * herramientas con el JWT de quien llama para que RLS siga aplicando, así que
 * el cron necesita un token de verdad: se emite uno de un solo uso.
 */
async function jwtDeUsuario(sb: Db, email: string): Promise<string | null> {
  const { data, error } = await sb.auth.admin.generateLink({ type: 'magiclink', email });
  if (error || !data) return null;
  const hashed = (data.properties as { hashed_token?: string } | undefined)?.hashed_token;
  if (!hashed) return null;

  const url = `${Deno.env.get('SUPABASE_URL')}/auth/v1/verify?token=${encodeURIComponent(hashed)}&type=magiclink&redirect_to=${encodeURIComponent('http://localhost/')}`;
  const res = await fetch(url, {
    headers: { apikey: Deno.env.get('SUPABASE_ANON_KEY') ?? '' },
    redirect: 'manual',
  });
  const loc = res.headers.get('location') ?? '';
  return new URLSearchParams(loc.split('#')[1] ?? '').get('access_token');
}

// ── Política de push del servidor y checkin (L6) ─────────────────────────

/** El instante local de pared que entiende pushpolicy. */
function momentoLocal(timezone: string): Momento {
  const l = ahoraLocal(timezone);
  return { fecha: l.fecha, min: l.hora * 60 + l.minuto };
}

interface RunLigero {
  kind?: unknown;
  created_at?: unknown;
  error?: unknown;
}

/**
 * Los rituales y checkins de los últimos 8 días (para contar push del día y
 * topes del checkin). Se filtra otra vez en código: la consulta solo acota.
 */
async function ritualesRecientes(sb: Db, userId: string): Promise<RunLigero[]> {
  const desde = new Date(relojRitual.ahora().getTime() - 8 * 86_400_000).toISOString();
  const { data, error } = await sb
    .from('coach_runs')
    .select('kind, created_at, error')
    .eq('user_id', userId)
    .in('kind', [...KINDS_CON_PUSH])
    .gte('created_at', desde)
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw new Error('coach_runs no disponible');
  return (data ?? []) as RunLigero[];
}

/** ¿Puede el servidor empujar un push ahora? (pushpolicy, la regla del Chat 5). */
function politicaPush(p: Perfil, pushesHoy: number) {
  return pushDelServidorPermitido(
    { ultimaApertura: p.last_open_on ?? null, wakeTime: p.wake_time, sleepTime: p.sleep_time, pushesHoy },
    momentoLocal(p.timezone),
  );
}

/** Lo que devuelve `ai_begin_turn` (0020/0024). */
interface Puerta {
  allowed?: boolean;
  reason?: string;
  turn_budget?: number;
  remaining?: number;
}

/** Por debajo de esto (1 céntimo) no se abre un checkin: cuesta ~0,002 $. */
const MIN_PRESUPUESTO_CHECKIN = 10_000;

const SISTEMA_CHECKIN = `Eres "el sistema" de NIVL: el coach de un gladiador, dentro de su móvil. Ahora le escribes TÚ, sin que él haya preguntado: un mensaje proactivo y breve en su chat.
- Como mucho ${MAX_CARACTERES_CHECKIN} caracteres. Segunda persona, tuteo, sin emojis, sin markdown, sin saludos de relleno.
- Termina en UNA sola pregunta concreta de seguimiento sobre algo de sus datos: una misión pendiente de hoy o un objetivo abierto. Nómbralo tal cual aparece.
- Voz del sistema: seca, firme, de quien lleva la cuenta. Nunca culpa, reproche, sarcasmo ni humillación: si algo va atrás, preguntas qué hace falta para moverlo, no se lo echas en cara.
- No inventes nada que no esté en los datos. No escribes en su plan ni puedes marcar nada: solo preguntas.
- Devuelves solo el mensaje.`;

/** Los objetivos abiertos (máximo 3) para que la pregunta pueda apuntar a uno. */
async function objetivosAbiertos(sb: Db, userId: string): Promise<string[]> {
  const { data, error } = await sb
    .from('goals')
    .select('title, deadline')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(3);
  if (error) return [];
  return ((data ?? []) as { title?: unknown; deadline?: unknown }[])
    .filter((g) => typeof g.title === 'string' && g.title.trim())
    .map((g) => `- "${String(g.title).slice(0, 120)}"${typeof g.deadline === 'string' ? ` · fecha límite ${g.deadline}` : ''}`);
}

/** El hilo principal (el que abre la app: el más reciente sin archivar); si no hay, se crea. */
async function hiloPrincipal(sb: Db, userId: string): Promise<string | null> {
  const { data: existente } = await sb
    .from('coach_threads')
    .select('id')
    .eq('user_id', userId)
    .eq('archived', false)
    .order('last_message_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const id = (existente as { id?: unknown } | null)?.id;
  if (typeof id === 'string' && id) return id;
  const { data: creado, error } = await sb
    .from('coach_threads')
    .insert({ user_id: userId, title: 'El sistema' })
    .select('id')
    .single();
  if (error) return null;
  return (creado as { id?: string } | null)?.id ?? null;
}

/**
 * El checkin (L6): un mensaje proactivo breve del coach, con tope.
 *
 * Solo llega aquí quien ya pasó los consentimientos de IA y de salud (bucle
 * del handler) y no tiene ningún ritual en esta pasada. Orden de las llaves:
 *   1. la hora del checkin (antes de tocar la base: se mira cada hora);
 *   2. topes de checkin.ts (1/día, 3/semana, 6 h, sueño, retiro);
 *   3. la política de push: caducada (7+ días sin abrir) o fuera de la
 *      ventana → nada; tope de push del día → se escribe en el hilo SIN push;
 *   4. el candado de gasto (ai_begin_turn/ai_end_turn), como un turno más.
 * Haiku sin herramientas y con el contexto mínimo; el coste va a coach_runs.
 *
 * Devuelve el motivo (para los logs y los tests). Puede lanzar: quien llama lo
 * recoge sin tumbar el ritual.
 */
export async function intentarCheckin(admin: Db, sb: Db, p: Perfil): Promise<string> {
  if (p.coach_mode === 'pausa') return 'pausa';
  const ahora = momentoLocal(p.timezone);
  // Llave barata primero: fuera de su hora, ni una consulta.
  if (Math.floor(ahora.min / 60) !== horaDelCheckin(p.wake_time, p.sleep_time)) return 'hora';

  const ahoraMs = relojRitual.ahora().getTime();
  const runs = await ritualesRecientes(sb, p.id);
  const deCheckin = runs.filter((r) => r.kind === 'checkin' && typeof r.created_at === 'string');
  const intentos = deCheckin.map((r) => String(r.created_at));
  const checkins = deCheckin.filter((r) => !r.error).map((r) => String(r.created_at));

  const { data: suyos, error: msgErr } = await sb
    .from('coach_messages')
    .select('created_at, tipo:content->0->>type, texto:content->0->>text')
    .eq('user_id', p.id)
    .eq('role', 'user')
    .gte('created_at', desdeParaMensajes(checkins, ahoraMs))
    .order('created_at', { ascending: false })
    .limit(300);
  if (msgErr) throw new Error('coach_messages no disponible');
  const mensajesGladiador = ((suyos ?? []) as { created_at?: unknown; tipo?: unknown; texto?: unknown }[])
    .filter((m) => typeof m.created_at === 'string' && esMensajeDelGladiador(m.tipo, m.texto))
    .map((m) => String(m.created_at));

  const regla = checkinPermitido({
    ahora, ahoraMs, timezone: p.timezone, wakeTime: p.wake_time, sleepTime: p.sleep_time,
    checkins, intentos, mensajesGladiador,
  });
  if (!regla.ok) return regla.motivo;

  const politica = politicaPush(p, pushesDeHoy(runs, ahora.fecha, p.timezone));
  // Caducada (lleva 7+ días sin abrir: las vueltas son locales) o fuera de su
  // ventana: ni se genera. Con el push del día ya gastado, se escribe en el
  // hilo y lo verá al abrir.
  if (!politica.ok && politica.motivo !== 'tope') return `push_${politica.motivo}`;

  // El candado de gasto manda también aquí: suscripción, presupuesto y ningún
  // otro turno en marcha. Si NO se concede, no se suelta (soltar liberaría el
  // turno en curso de otro).
  const { data: puerta, error: puertaErr } = await admin.rpc('ai_begin_turn', { p_user: p.id, p_mode: 'estandar' });
  if (puertaErr) return 'candado_no_disponible';
  const estado = puerta as Puerta | null;
  if (!estado || estado.allowed !== true) return `candado_${estado?.reason ?? 'cerrado'}`;

  let uso: Usage = {};
  let modelo = CHEAP_MODEL;
  let fallo: string | null = null;
  let llamado = false;
  let stateChars = 0;
  try {
    if ((Number(estado.turn_budget ?? estado.remaining) || 0) < MIN_PRESUPUESTO_CHECKIN) return 'candado_presupuesto';

    const ctx = await buildContextMinimo(sb, p.id, ahora.fecha);
    const objetivos = await objetivosAbiertos(sb, p.id);
    const datos = [
      ctx.text.slice(0, 3500),
      '',
      '## Objetivos abiertos',
      ...(objetivos.length ? objetivos : ['Ninguno.']),
    ].join('\n');
    stateChars = datos.length;
    const hhmm = `${String(Math.floor(ahora.min / 60)).padStart(2, '0')}:${String(ahora.min % 60).padStart(2, '0')}`;

    if ((await consentimientoIa(admin, p.id)) !== true) return 'sin_consentimiento';
    llamado = true;
    let texto = '';
    try {
      const turn = await callClaude({
        model: CHEAP_MODEL,
        signal: AbortSignal.timeout(30_000),
        system: [{ type: 'text', text: `${SISTEMA_CHECKIN}\n\n${AI_SAFETY_RULES}\n\n${REGLA_DATOS}` }],
        messages: [{
          role: 'user',
          content: [{
            type: 'text',
            text: `${DATOS_ABRE}\n${neutralizarDatos(datos)}\n${DATOS_CIERRA}\n\nEscribe el mensaje de seguimiento de hoy (${ahora.fecha}, ${hhmm}).`,
          }],
        }],
        maxTokens: 200,
        // Sin herramientas: el checkin no escribe nada.
      });
      uso = turn.usage;
      modelo = turn.model;
      texto = turn.content.filter((b) => b.type === 'text').map((b) => b.text ?? '').join('').trim();
    } catch (e) {
      if (e instanceof LlamadaFallida) {
        uso = e.usage;
        modelo = e.model;
      }
      fallo = 'checkin_failed';
      return 'modelo_fallo';
    }

    const limpio = limpiarCheckin(texto);
    if (!limpio) {
      fallo = 'sin_pregunta';
      return 'sin_pregunta';
    }

    // El consentimiento pudo retirarse mientras el modelo escribía.
    await requireHealth(sb, p.id);
    if ((await consentimientoIa(admin, p.id)) !== true) {
      fallo = 'sin_consentimiento';
      return 'sin_consentimiento';
    }

    const hilo = await hiloPrincipal(sb, p.id);
    if (!hilo) {
      fallo = 'sin_hilo';
      return 'sin_hilo';
    }
    const { error: msgInsErr } = await sb.from('coach_messages').insert({
      thread_id: hilo,
      user_id: p.id,
      role: 'assistant',
      content: [{ type: 'text', text: limpio }],
    });
    if (msgInsErr) {
      fallo = 'sin_mensaje';
      return 'sin_mensaje';
    }
    await sb.from('coach_threads').update({ last_message_at: relojRitual.ahora().toISOString() }).eq('id', hilo);

    if (politica.ok) {
      await empujar(sb, p.id, 'Una pregunta del coach', limpio, '/(tabs)/coach');
      return 'enviado';
    }
    return 'escrito_sin_push';
  } finally {
    if (llamado) {
      // Al libro SIEMPRE que se llamó al modelo, también si falló: el candado
      // tiene que ver lo gastado. Con error, no cuenta para los topes.
      const { error: ledgerErr } = await insertarRun(admin, {
        user_id: p.id,
        kind: 'checkin',
        mode: 'estandar',
        model: modelo,
        in_tokens: uso.input_tokens ?? 0,
        cache_read_tokens: uso.cache_read_input_tokens ?? 0,
        cache_write_tokens: uso.cache_creation_input_tokens ?? 0,
        out_tokens: uso.output_tokens ?? 0,
        cost_micro_usd: costMicroUsd(modelo, uso),
        error: fallo,
      }, { route: 'checkin', tools_offered: 0, tool_calls: 0, iterations: 1, state_chars: stateChars });
      if (ledgerErr) console.error('coach_runs insert failed (checkin):', ledgerErr.message);
    }
    await admin.rpc('ai_end_turn', { p_user: p.id }).then(() => {}, () => {});
  }
}

interface Decision {
  kind: string;
  message: string;
  titulo: string;
  ruta: string;
}

async function decidir(sb: Db, p: Perfil): Promise<Decision | null> {
  const local = ahoraLocal(p.timezone);

  // En pausa no se le persigue: es una de las tres puertas.
  if (p.coach_mode === 'pausa') return null;

  const yaHecho = async (kind: string, desde: string) => {
    const { data } = await sb
      .from('coach_runs')
      .select('id')
      .eq('user_id', p.id)
      .eq('kind', kind)
      .is('error', null)
      .gte('created_at', desde)
      .limit(1);
    return !!data?.length;
  };

  const inicioDia = `${local.fecha}T00:00:00Z`;

  // 1) Cierre mensual: el día 1, a la hora de despertar.
  if (local.fecha.endsWith('-01') && local.hora === horaDe(p.wake_time)) {
    const mes = local.fecha.slice(0, 7);
    if (!(await yaHecho('cierre_mensual', `${mes}-01T00:00:00Z`))) {
      return {
        kind: 'cierre_mensual',
        message: 'Cierra el mes.',
        titulo: 'Cierre del mes',
        ruta: '/(tabs)/coach',
      };
    }
  }

  // 2) Revisión semanal: domingo a las 20:00 locales.
  if (local.diaSemana === 7 && local.hora === 20) {
    const hace6dias = new Date(Date.now() - 6 * 86400000).toISOString();
    if (!(await yaHecho('revision_semanal', hace6dias))) {
      return {
        kind: 'revision_semanal',
        message: 'Haz la revisión de la semana.',
        titulo: 'Revisión de la semana',
        ruta: '/(tabs)/coach',
      };
    }
  }

  // 3) Brief diario, a la hora de despertar.
  if (local.hora === horaDe(p.wake_time)) {
    if (!(await yaHecho('brief', inicioDia))) {
      return {
        kind: 'brief',
        message: `Es ${local.fecha}. Dicta el brief de hoy y escribe el plan.`,
        titulo: 'Órdenes del día',
        ruta: '/(tabs)',
      };
    }
  }

  // 4) Escalada: cuatro días sin que él diga nada, a media mañana.
  if (local.hora === 11) {
    const hace4dias = new Date(Date.now() - 4 * 86400000).toISOString();
    const { data: suyos } = await sb
      .from('coach_messages')
      .select('id')
      .eq('user_id', p.id)
      .eq('role', 'user')
      .gte('created_at', hace4dias)
      .limit(1);
    const hace7dias = new Date(Date.now() - 7 * 86400000).toISOString();
    if (!suyos?.length && !(await yaHecho('escalada', hace7dias))) {
      return {
        kind: 'escalada',
        message: 'Lleva cuatro días en silencio.',
        titulo: 'Tu coach te ha escrito',
        ruta: '/(tabs)/coach',
      };
    }
  }

  return null;
}

export async function handler(req: Request): Promise<Response> {
  // Autenticación propia: la función va con --no-verify-jwt porque la llama
  // pg_cron, no un usuario. El secreto compartido es el candado.
  if (!secretoValido(req.headers.get('x-ritual-secret'), Deno.env.get('RITUAL_SECRET'))) {
    return json(401, { error: 'No autorizado' });
  }

  const admin = adminClient();
  // last_open_on llega con la 0048; si aún no está, se lee sin ella (null =
  // cliente antiguo, que la política trata como abierta hoy).
  let { data: perfiles, error: perfilesErr } = await admin
    .from('profiles')
    .select('id, name, timezone, wake_time, sleep_time, coach_mode, last_open_on');
  if (perfilesErr && esColumnaInexistente(perfilesErr)) {
    ({ data: perfiles } = await admin
      .from('profiles')
      .select('id, name, timezone, wake_time, sleep_time, coach_mode'));
  }

  const hechos: { user: string; kind: string }[] = [];
  const fallos: { user: string; error: string }[] = [];

  for (const p of (perfiles ?? []) as Perfil[]) {
    // La sesión que se abre por el gladiador (magic link) se cierra al acabar
    // con él: antes se quedaba viva, con su refresh token, una por ritual.
    let jwt: string | null = null;
    try {
      if (await healthConsent(admin, p.id) !== true || await consentimientoIa(admin, p.id) !== true) continue;
      const revision = await healthRevision(admin, p.id);
      const sb = healthScopedClient(adminClient(revision), revision);
      const decision = await decidir(sb, p);
      if (!decision) {
        // Sin ritual en esta pasada: quizá un checkin (L6). Su fallo nunca
        // tumba el ritual ni el resto de usuarios.
        try {
          const motivo = await intentarCheckin(admin, sb, p);
          if (motivo === 'enviado' || motivo === 'escrito_sin_push') hechos.push({ user: p.id, kind: 'checkin' });
        } catch (_e) {
          fallos.push({ user: p.id, error: 'checkin_failed' });
        }
        continue;
      }

      // Sin IA contratada (o con la del mes agotada) no hay ritual. El coach
      // lo rechazaría igual —el candado está allí—, pero así ni se fabrica la
      // sesión ni se apunta como fallo algo que es lo esperado en una cuenta
      // gratuita.
      const { data: ia } = await sb.rpc('ai_state', { p_user: p.id });
      const estadoIa = ia as { entitled?: boolean; remaining?: number; tier?: string } | null;
      if (!estadoIa?.entitled || (estadoIa.remaining ?? 0) < 20000) continue;

      // Sin consentimiento vigente para la IA (0028), ni ritual ni push: el
      // coach lo rechazaría igual, pero así no se abre una sesión para nada.
      // Retirarlo en Perfil tiene que parar TAMBIÉN lo que dispara el cron.
      if ((await consentimientoIa(sb, p.id)) !== true) continue;

      const { data: usuario } = await sb.auth.admin.getUserById(p.id);
      const email = usuario?.user?.email;
      if (!email) continue;

      // Push del día ANTES de que el coach apunte este ritual (si no, se
      // contaría a sí mismo). Si la política calla, el ritual se escribe
      // igual y se ve al abrir la app.
      const pushesHoy = pushesDeHoy(await ritualesRecientes(sb, p.id).catch(() => []), ahoraLocal(p.timezone).fecha, p.timezone);
      const puedeEmpujar = politicaPush(p, pushesHoy).ok;

      jwt = await jwtDeUsuario(sb, email);
      if (!jwt) {
        fallos.push({ user: p.id, error: 'no se pudo abrir sesión' });
        continue;
      }

      const texto = await invocarCoach(jwt, decision.kind, decision.message);

      // El brief tiene que dejar el plan del dia escrito. Se le dice en su
      // instruccion con todas las letras, y aun asi hay dias que no lo hace:
      // se le acaba el sitio antes de llegar a la llamada, o simplemente
      // decide que no. El precio de ese fallo lo paga el usuario levantandose
      // sin nada que hacer, y sin ningun error que lo explique.
      //
      // Asi que no se confia en que lo haya hecho: se comprueba. Si no hay
      // plan, se pide aparte, que es un turno corto y con un solo trabajo.
      if (decision.kind === 'brief') {
        await requireHealth(sb, p.id);
        const hoy = ahoraLocal(p.timezone).fecha;
        const { count } = await sb
          .from('day_plans')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', p.id)
          .eq('date', hoy);
        if (!count) {
          await invocarCoach(jwt, 'plan', `Es ${hoy}. Escribe el plan del dia completo.`).catch(
            () => fallos.push({ user: p.id, error: 'fallback_plan_failed' }),
          );
        }
      }

      if ((await consentimientoIa(sb, p.id)) !== true) continue;

      // El día 1 el único push del día es el del mes (prioridad acordada:
      // escalada > mensual > brief > check-in). Si hay pase de fotos, sale
      // «Tu mes en imágenes» y el cierre queda en el hilo; si no, el cierre.
      const fotosMes = decision.kind === 'cierre_mensual' ? await resumenMensual(jwt).catch(() => null) : null;
      if (fotosMes && puedeEmpujar) {
        await empujar(
          sb,
          p.id,
          'Tu mes en imágenes',
          `${fotosMes} ${fotosMes === 1 ? 'foto' : 'fotos'}. El sistema ha montado el pase y cerrado el mes: toca para verlo.`,
          '/resumen',
        );
      } else if (puedeEmpujar) {
        const tituloPush = await titular(sb, p.id, texto || 'El sistema tiene algo para ti.');
        if ((await consentimientoIa(sb, p.id)) !== true) continue;
        await empujar(
          sb,
          p.id,
          decision.titulo,
          tituloPush,
          decision.ruta,
        );
      }

      // Espejo a la página del CEREBRO, para que el coach de escritorio lea lo
      // mismo. Solo los rituales que dejan huella: el brief diario cambia cada
      // día y llenaría la página de ruido.
      // SOLO la cuenta del dueño: la página del CEREBRO es suya y privada. Sin
      // este filtro se copiaban ahí las revisiones y cierres de todos los
      // usuarios (fuga de datos personales a un tercero, Notion).
      if (espejoActivo() && estadoIa?.tier === 'owner' && decision.kind !== 'brief' && texto && await healthConsent(sb, p.id) === true && await consentimientoIa(sb, p.id) === true) {
        await espejarEntrada(ahoraLocal(p.timezone).fecha, decision.titulo, texto);
      }

      hechos.push({ user: p.id, kind: decision.kind });
    } catch (_e) {
      fallos.push({ user: p.id, error: 'ritual_failed' });
    } finally {
      if (jwt) await admin.auth.admin.signOut(jwt, 'local').catch(() => {});
    }
  }

  // Aviso operativo de moderación: al final, con el cliente de servicio y
  // fuera de cualquier consentimiento. Nunca lanza.
  await avisarModeracion(admin);

  return json(200, { hechos, fallos });
}
