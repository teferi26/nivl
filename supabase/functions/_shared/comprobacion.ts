// NIVL · Lo registrado en un día, tal y como lo comprueba el coach.
//
// Una sola lectura para tres sitios (L1 «nunca contradecir sin comprobar»):
//   · la sección «Registrado hoy» del estado (context.ts),
//   · la herramienta de solo lectura `consultar_dia` (tools.ts),
//   · la comprobación determinista que el servidor adjunta cuando el gladiador
//     afirma haber hecho o registrado algo (coach/handler.ts).
//
// Si las tres leyeran cada una a su manera, el coach podría ver la sesión en un
// sitio y negarla en otro, que es justo el fallo que se arregla aquí.
//
// Reglas de la lectura:
//   · Con el cliente del USUARIO (RLS manda) y filtrada por su user_id.
//   · Acotada: cada consulta lleva limit.
//   · Las tablas de salud (gimnasio, cardio, peso, nutrición, diario) solo se
//     leen con el permiso de salud vigente. Sin él se dice «sin acceso por
//     consentimiento», nunca «ninguna sesión»: no haber mirado no es no haber.
//   · Un módulo que falla al leerse dice «no se ha podido leer», tampoco
//     «ninguno»: el coach no puede negar algo que no ha llegado a ver.

import type { Db } from './db.ts';
import { healthConsent } from './health.ts';

const SIN_CONSENTIMIENTO = 'sin acceso por consentimiento de salud (no se ha leído)';
const FALLO = 'no se ha podido leer ahora (no lo des por inexistente)';

type Fila = Record<string, unknown>;

interface Modulo<T> {
  estado: 'ok' | 'sin_consentimiento' | 'fallo';
  filas: T[];
}

export interface Registros {
  desde: string;
  hasta: string;
  gym: Modulo<{ date: string; dia: string | null; notas: string | null; ejercicios: { nombre: string; series: string[] }[] }>;
  cardio: Modulo<Fila>;
  peso: Modulo<Fila>;
  nutricion: Modulo<Fila>;
  diario: Modulo<{ date: string }>;
  completadas: Modulo<{ date: string; titulo: string }>;
}

/** El día anterior a una fecha YYYY-MM-DD. */
export function diaAnterior(fecha: string): string {
  return new Date(Date.parse(`${fecha}T12:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
}

const num = (v: unknown): string => {
  const n = Number(v);
  return Number.isFinite(n) ? String(Math.round(n * 100) / 100) : '?';
};

async function filas(q: PromiseLike<{ data: unknown; error: unknown }>): Promise<Fila[] | null> {
  try {
    const { data, error } = await q;
    return error ? null : ((data ?? []) as Fila[]);
  } catch {
    return null;
  }
}

function modulo<T>(f: T[] | null): Modulo<T> {
  return f === null ? { estado: 'fallo', filas: [] } : { estado: 'ok', filas: f };
}

const vedado = <T>(): Modulo<T> => ({ estado: 'sin_consentimiento', filas: [] });

/** Lee lo registrado entre `desde` y `hasta` (ambos incluidos, pocos días). */
export async function leerRegistros(sb: Db, userId: string, desde: string, hasta: string): Promise<Registros> {
  const salud = (await healthConsent(sb, userId)) === true;

  const completadasP = (async () => {
    const hechas = await filas(
      sb.from('completions').select('quest_id, date').eq('user_id', userId).gte('date', desde).lte('date', hasta).limit(100),
    );
    if (hechas === null) return modulo<{ date: string; titulo: string }>(null);
    const ids = [...new Set(hechas.map((c) => String(c.quest_id)))];
    const titulos = new Map<string, string>();
    if (ids.length) {
      const qs = await filas(sb.from('quests').select('id, title').eq('user_id', userId).in('id', ids).limit(100));
      for (const q of qs ?? []) titulos.set(String(q.id), String(q.title ?? ''));
    }
    return modulo(
      hechas.map((c) => ({ date: String(c.date), titulo: titulos.get(String(c.quest_id)) || `misión ${c.quest_id}` })),
    );
  })();

  if (!salud) {
    return {
      desde,
      hasta,
      gym: vedado(),
      cardio: vedado(),
      peso: vedado(),
      nutricion: vedado(),
      diario: vedado(),
      completadas: await completadasP,
    };
  }

  const gymP = (async () => {
    const sesiones = await filas(
      sb.from('gym_sessions').select('id, date, gym_day_id, notes').eq('user_id', userId)
        .gte('date', desde).lte('date', hasta).order('date', { ascending: false }).limit(10),
    );
    if (sesiones === null) return modulo<Registros['gym']['filas'][number]>(null);
    if (!sesiones.length) return modulo<Registros['gym']['filas'][number]>([]);
    const ids = sesiones.map((s) => String(s.id));
    const diasIds = [...new Set(sesiones.map((s) => s.gym_day_id).filter(Boolean).map(String))];
    const [series, dias] = await Promise.all([
      filas(
        sb.from('gym_lifts').select('session_id, exercise_name, weight, reps, set_index').eq('user_id', userId)
          .in('session_id', ids).limit(300),
      ),
      diasIds.length
        ? filas(sb.from('gym_days').select('id, name').eq('user_id', userId).in('id', diasIds).limit(20))
        : Promise.resolve([] as Fila[]),
    ]);
    // Sin las series no se puede decir qué hizo, pero la sesión existe: se
    // cuenta como leída a medias, nunca como inexistente.
    const nombreDia = new Map((dias ?? []).map((d) => [String(d.id), String(d.name ?? '')]));
    return modulo(
      sesiones.map((s) => {
        const suyas = (series ?? [])
          .filter((l) => String(l.session_id) === String(s.id))
          .sort((a, b) => (Number(a.set_index) || 0) - (Number(b.set_index) || 0));
        const porEjercicio = new Map<string, string[]>();
        for (const l of suyas) {
          const nombre = String(l.exercise_name ?? '?');
          if (!porEjercicio.has(nombre)) porEjercicio.set(nombre, []);
          // Peso 0 es peso corporal (dominadas, fondos): se enseña igual. El
          // estudio de e1RM lo descarta, y por eso estas sesiones "no existían".
          porEjercicio.get(nombre)!.push(`${num(l.weight)}×${num(l.reps)}`);
        }
        return {
          date: String(s.date),
          dia: s.gym_day_id ? nombreDia.get(String(s.gym_day_id)) || null : null,
          notas: s.notes ? String(s.notes).slice(0, 200) : null,
          ejercicios: series === null
            ? [{ nombre: '(series no leídas)', series: [] }]
            : [...porEjercicio.entries()].map(([nombre, ss]) => ({ nombre, series: ss })),
        };
      }),
    );
  })();

  const [gym, cardio, peso, nutricion, diario, completadas] = await Promise.all([
    gymP,
    filas(
      sb.from('cardio_sessions').select('date, kind, distance_km, duration_min, zone').eq('user_id', userId)
        .gte('date', desde).lte('date', hasta).limit(20),
    ).then(modulo),
    filas(
      sb.from('body_metrics').select('date, weight_kg').eq('user_id', userId).gte('date', desde).lte('date', hasta).limit(10),
    ).then(modulo),
    filas(
      sb.from('nutrition_logs').select('date, hit_kcal, hit_protein, kcal_est, protein_est').eq('user_id', userId)
        .gte('date', desde).lte('date', hasta).limit(10),
    ).then(modulo),
    filas(
      sb.from('journal_entries').select('date').eq('user_id', userId).gte('date', desde).lte('date', hasta).limit(10),
    ).then((f) => modulo(f === null ? null : f.map((x) => ({ date: String(x.date) })))),
    completadasP,
  ]);

  return { desde, hasta, gym, cardio, peso, nutricion, diario, completadas };
}

/** Las líneas de UN día, módulo a módulo. Cada módulo dice algo, también si está vacío. */
export function lineasDelDia(r: Registros, fecha: string): string[] {
  const del = <T extends { date?: unknown }>(m: Modulo<T>) => m.filas.filter((f) => String(f.date) === fecha);
  const linea = <T extends { date?: unknown }>(
    nombre: string,
    m: Modulo<T>,
    vacio: string,
    pinta: (f: T[]) => string,
  ): string => {
    if (m.estado === 'sin_consentimiento') return `${nombre}: ${SIN_CONSENTIMIENTO}.`;
    if (m.estado === 'fallo') return `${nombre}: ${FALLO}.`;
    const suyas = del(m);
    return suyas.length ? `${nombre}: ${pinta(suyas)}` : `${nombre}: ${vacio} con fecha ${fecha}.`;
  };

  return [
    linea('Gimnasio', r.gym, 'ninguna sesión', (ss) =>
      ss.map((s) => {
        const cabeza = s.dia ? `sesión «${s.dia}»` : 'sesión';
        const cuerpo = s.ejercicios.length
          ? s.ejercicios.map((e) => `${e.nombre} ${e.series.join(', ')}`.trim()).join(' · ')
          : 'sin series anotadas';
        return `${cabeza} — ${cuerpo}${s.notas ? ` (notas: ${s.notas})` : ''}`;
      }).join(' | '),
    ),
    linea('Cardio', r.cardio, 'ningún cardio', (cs) =>
      cs.map((c) =>
        [c.kind, c.distance_km ? `${num(c.distance_km)} km` : null, c.duration_min ? `${num(c.duration_min)} min` : null, c.zone]
          .filter(Boolean).join(' '),
      ).join(' · '),
    ),
    linea('Peso', r.peso, 'ningún pesaje', (ps) => ps.map((p) => `${num(p.weight_kg)} kg`).join(' · ')),
    linea('Nutrición', r.nutricion, 'ningún parte de comidas', (ns) =>
      ns.map((n) =>
        [
          n.kcal_est ? `~${num(n.kcal_est)} kcal` : null,
          n.protein_est ? `${num(n.protein_est)} g de proteína` : null,
          `calorías ${n.hit_kcal ? 'cumplidas' : 'no cumplidas'}`,
          `proteína ${n.hit_protein ? 'cumplida' : 'no cumplida'}`,
        ].filter(Boolean).join(', '),
      ).join(' · '),
    ),
    linea('Diario', r.diario, 'no hay entrada', () => 'sí, hay entrada.'),
    linea('Misiones completadas', r.completadas, 'ninguna', (cs) => cs.map((c) => `"${c.titulo}"`).join(', ')),
  ];
}

/** Texto compacto de una fecha Y la anterior: lo que devuelve `consultar_dia`. */
export async function leerDiaYAnterior(sb: Db, userId: string, fecha: string): Promise<string> {
  const ayer = diaAnterior(fecha);
  const r = await leerRegistros(sb, userId, ayer, fecha);
  return [
    `Registrado el ${fecha}:`,
    ...lineasDelDia(r, fecha).map((l) => `- ${l}`),
    `Registrado el ${ayer} (día anterior):`,
    ...lineasDelDia(r, ayer).map((l) => `- ${l}`),
  ].join('\n');
}

/**
 * El bloque que el servidor pega al mensaje del gladiador cuando afirma haber
 * hecho o registrado algo. Solo viaja en ESTE turno: no se guarda en el hilo.
 */
export async function bloqueComprobacion(sb: Db, userId: string, fecha: string): Promise<string> {
  const lectura = await leerDiaYAnterior(sb, userId, fecha);
  return [
    `## Comprobación del sistema (${fecha})`,
    'El gladiador afirma haber hecho o registrado algo. Esto es lo que consta, leído ahora mismo:',
    lectura,
    'Cita lo que ves (ejercicio, kg×reps, fecha). Si no aparece, di qué fechas has mirado y pregúntale dónde lo registró; no le acuses ni discutas.',
  ].join('\n');
}
