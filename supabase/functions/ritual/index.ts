// NIVL · Edge Function: LOS RITUALES.
//
// Esto es lo que convierte a NIVL en un coach que trabaja para ti y no en una
// app que abres. pg_cron la llama cada hora; ella mira qué hora es en la zona
// de cada cazador y decide si le toca algo:
//
//   · brief          — a la hora de despertar, con el plan del día escrito
//   · revision       — domingo por la tarde
//   · cierre_mensual — el día 1
//   · escalada       — si lleva días en silencio (la carta con tres puertas)
//
// Después empuja el resultado por notificación push. Si no hay token, el
// ritual igual queda escrito y lo verá al abrir la app.
//
// Despliegue:
//   supabase functions deploy ritual --no-verify-jwt
//   supabase secrets set RITUAL_SECRET=<cadena larga al azar>

import { callClaude, CHEAP_MODEL } from '../_shared/anthropic.ts';
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
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

/** Hora local del cazador, sin librerías: Intl ya sabe de husos y de DST. */
function ahoraLocal(timezone: string): { fecha: string; hora: number; minuto: number; diaSemana: number } {
  const ahora = new Date();
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
async function titular(cuerpo: string): Promise<string> {
  const plano = cuerpo.replace(/[*#_`]/g, '').replace(/\s+/g, ' ').trim();
  if (plano.length <= 180) return plano;
  try {
    const turn = await callClaude({
      model: CHEAP_MODEL,
      system: [{
        type: 'text',
        text: 'Resumes en UNA sola frase de menos de 180 caracteres lo que un coach acaba de escribirle a su cliente. Tono seco y directo, en segunda persona, sin emojis, sin markdown, sin comillas. Si hay una cifra o una hora concretas, van dentro. Devuelves solo la frase.',
      }],
      messages: [{ role: 'user', content: [{ type: 'text', text: plano.slice(0, 6000) }] }],
      maxTokens: 200,
      effort: 'low',
    });
    const t = turn.content.filter((b) => b.type === 'text').map((b) => b.text ?? '').join('').trim();
    if (t) return t.slice(0, 240);
  } catch (e) {
    console.error('titular falló, se recorta:', e);
  }
  return plano.slice(0, 240);
}

async function empujar(sb: Db, userId: string, titulo: string, cuerpo: string, ruta: string) {
  const { data: tokens } = await sb.from('push_tokens').select('token').eq('user_id', userId);
  const lista = (tokens ?? []).map((t: { token: string }) => t.token);
  if (!lista.length) return;

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
        titulo: 'El sistema te espera',
        ruta: '/(tabs)/coach',
      };
    }
  }

  return null;
}

Deno.serve(async (req) => {
  // Autenticación propia: la función va con --no-verify-jwt porque la llama
  // pg_cron, no un usuario. El secreto compartido es el candado.
  const secreto = Deno.env.get('RITUAL_SECRET');
  if (!secreto || req.headers.get('x-ritual-secret') !== secreto) {
    return json(401, { error: 'No autorizado' });
  }

  const sb = adminClient();
  const { data: perfiles } = await sb
    .from('profiles')
    .select('id, name, timezone, wake_time, sleep_time, coach_mode');

  const hechos: { user: string; kind: string }[] = [];
  const fallos: { user: string; error: string }[] = [];

  for (const p of (perfiles ?? []) as Perfil[]) {
    try {
      const decision = await decidir(sb, p);
      if (!decision) continue;

      const { data: usuario } = await sb.auth.admin.getUserById(p.id);
      const email = usuario?.user?.email;
      if (!email) continue;

      const jwt = await jwtDeUsuario(sb, email);
      if (!jwt) {
        fallos.push({ user: p.id, error: 'no se pudo abrir sesión' });
        continue;
      }

      const texto = await invocarCoach(jwt, decision.kind, decision.message);
      await empujar(
        sb,
        p.id,
        decision.titulo,
        await titular(texto || 'El sistema tiene algo para ti.'),
        decision.ruta,
      );

      // Espejo a la página del CEREBRO, para que el coach de escritorio lea lo
      // mismo. Solo los rituales que dejan huella: el brief diario cambia cada
      // día y llenaría la página de ruido.
      if (espejoActivo() && decision.kind !== 'brief' && texto) {
        await espejarEntrada(ahoraLocal(p.timezone).fecha, decision.titulo, texto);
      }

      hechos.push({ user: p.id, kind: decision.kind });
    } catch (e) {
      fallos.push({ user: p.id, error: e instanceof Error ? e.message : String(e) });
    }
  }

  return json(200, { hechos, fallos });
});
