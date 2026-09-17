// NIVL · El resumen: la semana o el mes contados como un pase de diapositivas.
//
// La motivación a la semana cuarenta no la sostiene un número. La sostiene
// acordarse: la foto del gimnasio a las 6:00 de un martes que costó levantarse,
// el día que todo se torció y aun así se cerró el diario. Esto convierte los
// datos del periodo en una historia con esas fotos dentro.
//
// Dos reglas de diseño que no se negocian:
//
//  1. SIN FOTOS NO HAY RESUMEN. Un pase de diapositivas vacío no motiva: lo que
//     hace es recordarte que no registraste nada. Se avisa y punto.
//  2. NO SE INVENTA NADA. Las cifras se calculan aquí y se le dan hechas; el
//     modelo redacta. Un resumen con datos falsos es peor que ninguno, porque
//     mina la confianza en todo lo demás que dice el sistema.

import { callClaude, COACH_MODEL, type Usage } from './anthropic.ts';
import type { Db } from './db.ts';

export interface Slide {
  tipo: 'portada' | 'dato' | 'foto' | 'duro' | 'cierre';
  titulo: string;
  texto: string;
  dato?: string;
  foto?: string;
}

export interface Resultado {
  slides: Slide[];
  fotos: number;
  usage: Usage;
  model: string;
  motivo?: string;
}

const SISTEMA = `Escribes el resumen de un periodo para el gladiador de NIVL, una app que gamifica la vida real con la estética de Solo Leveling.

La voz es la del SISTEMA: español, segunda persona, frases cortas, sobrio. Constata, no suplica. Nada de emojis, nada de signos de exclamación dobles. La calidez está permitida aquí —es un momento ganado— pero se gana con precisión, no con adjetivos.

Recibes datos ya calculados y una lista de fotos. Devuelves ÚNICAMENTE un array JSON de diapositivas, sin markdown ni texto alrededor:

[{"tipo":"portada","titulo":"...","texto":"...","dato":"..."}]

Tipos y cómo se usan:
- portada: una sola, la primera. El titular del periodo.
- dato: una cifra que importe, con contexto. "dato" es la cifra suelta y grande.
- foto: SIEMPRE lleva "foto" con la ruta EXACTA que te dieron. El texto cuenta qué pasaba ese día, usando la misión y la fecha. Una diapositiva por foto que merezca la pena.
- duro: el día o el momento que costó. Solo si los datos lo respaldan (un día fallado, ánimo bajo en el diario, una racha rota). Sin dramatizar y sin culpar.
- cierre: una sola, la última. Qué se lleva del periodo y qué viene ahora.

Reglas duras:
- Entre 5 y 10 diapositivas. Todas las fotos que te den deben aparecer, salvo que haya más de 8: entonces eliges las 8 mejores por lo que cuenten.
- Solo cifras que estén en los datos. Si algo no está, no existe.
- Títulos de 2 a 5 palabras. Textos de una o dos frases.`;

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

/** Lunes de la semana de `hoy`, y el domingo anterior a ese lunes. */
export function periodoSemanal(hoy: string): { desde: string; hasta: string } {
  const d = new Date(`${hoy}T00:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7; // 0 = lunes
  const lunes = new Date(d.getTime() - dow * 86400000);
  return { desde: iso(lunes), hasta: iso(new Date(lunes.getTime() + 6 * 86400000)) };
}

/** Mes natural ANTERIOR al de `hoy`: el resumen mensual se hace del mes cerrado. */
export function periodoMensual(hoy: string): { desde: string; hasta: string } {
  const [a, m] = hoy.slice(0, 7).split('-').map(Number);
  const primero = new Date(Date.UTC(a!, m! - 2, 1));
  const ultimo = new Date(Date.UTC(a!, m! - 1, 0));
  return { desde: iso(primero), hasta: iso(ultimo) };
}

export async function construirResumen(
  sb: Db,
  userId: string,
  kind: 'semanal' | 'mensual',
  hoy: string,
): Promise<Resultado> {
  const { desde, hasta } = kind === 'semanal' ? periodoSemanal(hoy) : periodoMensual(hoy);

  const [fotosRes, compRes, diarioRes, gymRes, cardioRes, perfilRes, logrosRes] = await Promise.all([
    sb.from('quest_photos').select('date, path, caption, quest_id').eq('user_id', userId)
      .gte('date', desde).lte('date', hasta).order('date'),
    sb.from('completions').select('date, xp_awarded, quest_id').eq('user_id', userId)
      .gte('date', desde).lte('date', hasta),
    sb.from('journal_entries').select('date, mood, energy, text').eq('user_id', userId)
      .gte('date', desde).lte('date', hasta).order('date'),
    sb.from('gym_sessions').select('date').eq('user_id', userId).gte('date', desde).lte('date', hasta),
    sb.from('cardio_sessions').select('date, kind, distance_km').eq('user_id', userId)
      .gte('date', desde).lte('date', hasta),
    sb.from('profiles').select('name, xp_total, streak_days').eq('id', userId).maybeSingle(),
    sb.from('achievements').select('code, unlocked_at').eq('user_id', userId)
      .gte('unlocked_at', `${desde}T00:00:00Z`).lte('unlocked_at', `${hasta}T23:59:59Z`),
  ]);

  const fotos = (fotosRes.data ?? []) as { date: string; path: string; caption: string | null; quest_id: string | null }[];
  if (!fotos.length) {
    return {
      slides: [],
      fotos: 0,
      usage: {},
      model: COACH_MODEL,
      motivo:
        kind === 'semanal'
          ? 'No has subido ninguna foto esta semana. El resumen se construye con ellas: sin fotos no hay nada que recordar.'
          : 'No hay fotos de este mes. El resumen visual necesita al menos una.',
    };
  }

  // Los títulos de las misiones, para que cada foto sepa a qué acompañaba.
  const ids = [...new Set(fotos.map((f) => f.quest_id).filter(Boolean))] as string[];
  const titulos = new Map<string, string>();
  if (ids.length) {
    const { data } = await sb.from('quests').select('id, title').in('id', ids);
    for (const q of (data ?? []) as { id: string; title: string }[]) titulos.set(q.id, q.title);
  }

  const comps = (compRes.data ?? []) as { date: string; xp_awarded: number }[];
  const porDia = new Map<string, number>();
  for (const c of comps) porDia.set(c.date, (porDia.get(c.date) ?? 0) + 1);
  const mejorDia = [...porDia.entries()].sort((a, b) => b[1] - a[1])[0];
  const xpGanado = comps.reduce((a, c) => a + Number(c.xp_awarded ?? 0), 0);

  const diario = (diarioRes.data ?? []) as { date: string; mood: number | null; energy: number | null; text: string | null }[];
  const conAnimo = diario.filter((d) => d.mood !== null);
  const peorDia = conAnimo.slice().sort((a, b) => (a.mood ?? 9) - (b.mood ?? 9))[0];
  const cardio = (cardioRes.data ?? []) as { kind: string; distance_km: number | null }[];
  const km = cardio.reduce((a, c) => a + Number(c.distance_km ?? 0), 0);
  const perfil = perfilRes.data as { name: string; xp_total: number; streak_days: number } | null;

  const datos = [
    `PERIODO: ${desde} → ${hasta} (${kind})`,
    `Gladiador: ${perfil?.name ?? 'Gladiador'} · ${perfil?.xp_total ?? 0} XP totales · racha actual ${perfil?.streak_days ?? 0} días`,
    `Misiones completadas: ${comps.length} · XP ganado en el periodo: ${xpGanado}`,
    `Días con actividad: ${porDia.size}`,
    mejorDia ? `Mejor día: ${mejorDia[0]} con ${mejorDia[1]} misiones` : null,
    `Sesiones de gimnasio: ${(gymRes.data ?? []).length}`,
    cardio.length ? `Cardio: ${cardio.length} sesiones, ${km.toFixed(1)} km` : 'Cardio: ninguno',
    (logrosRes.data ?? []).length ? `Logros desbloqueados: ${(logrosRes.data as { code: string }[]).map((l) => l.code).join(', ')}` : null,
    peorDia ? `Día más bajo según el diario: ${peorDia.date}, ánimo ${peorDia.mood}/5${peorDia.text ? ` — escribió: "${peorDia.text.slice(0, 200)}"` : ''}` : null,
    conAnimo.length ? `Ánimo medio: ${(conAnimo.reduce((a, d) => a + (d.mood ?? 0), 0) / conAnimo.length).toFixed(1)}/5` : null,
    '',
    'FOTOS (usa la ruta exacta en el campo "foto"):',
    ...fotos.map(
      (f) =>
        `- ruta: ${f.path} · fecha: ${f.date}` +
        (f.quest_id && titulos.get(f.quest_id) ? ` · misión: ${titulos.get(f.quest_id)}` : '') +
        (f.caption ? ` · escribió: "${f.caption}"` : ''),
    ),
  ]
    .filter((l) => l !== null)
    .join('\n');

  const turn = await callClaude({
    system: [{ type: 'text', text: SISTEMA }],
    messages: [{ role: 'user', content: [{ type: 'text', text: datos }] }],
    maxTokens: 3000,
    effort: 'medium',
  });

  const texto = turn.content.filter((b) => b.type === 'text').map((b) => b.text ?? '').join('');
  const json = texto.slice(texto.indexOf('['), texto.lastIndexOf(']') + 1);

  let slides: Slide[];
  try {
    slides = JSON.parse(json) as Slide[];
  } catch {
    throw new Error('El resumen no vino en el formato esperado.');
  }

  // Red de seguridad: si inventa una ruta de foto, la diapositiva se queda sin
  // imagen en vez de romper la pantalla con un hueco negro.
  const rutas = new Set(fotos.map((f) => f.path));
  slides = slides
    .filter((s) => s && typeof s.titulo === 'string')
    .map((s) => (s.foto && !rutas.has(s.foto) ? { ...s, foto: undefined } : s));

  return { slides, fotos: fotos.length, usage: turn.usage, model: turn.model };
}
