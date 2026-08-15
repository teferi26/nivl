// NIVL · El estudio del cazador.
//
// Aquí se convierte el historial en conclusiones. La diferencia importa: un
// modelo al que le sueltas 300 series sueltas puede sacar la cuenta, pero
// gasta contexto, se equivoca en la aritmética y no es reproducible. Un modelo
// al que le das "banca: e1RM 88 kg, +3,2 % en 4 semanas, RPE medio 7,1 →
// margen para subir" programa como un entrenador.
//
// Todo lo que hay aquí es determinista. La IA decide QUÉ hacer con estos
// números; los números no los inventa ella.

import type { Db } from './db.ts';

// ── Matemática ──────────────────────────────────────────────────────
//
// Estas tres funciones están duplicadas a propósito en `src/lib/bodymath.ts`.
// No se comparte el archivo porque esto corre en Deno y aquello en Hermes, y
// el empaquetado de la Edge Function no sube nada de fuera de `supabase/`.
// Las pruebas viven en `src/lib/__tests__/bodymath.test.ts`: si tocas una
// fórmula aquí, tócala allí y comprueba que los tests siguen en verde.

/**
 * 1RM estimado por la fórmula de Epley: peso × (1 + reps/30).
 *
 * Por encima de ~12 repeticiones deja de ser fiable (sobreestima mucho), así
 * que esas series no se usan para estimar fuerza máxima.
 */
export function e1rm(peso: number, reps: number): number | null {
  if (peso <= 0 || reps <= 0 || reps > 12) return null;
  return peso * (1 + reps / 30);
}

/**
 * Pendiente por mínimos cuadrados de una serie temporal, en unidades por día.
 * Se usa para el peso corporal: con básculas que oscilan ±1 kg de un día para
 * otro, mirar el último dato es ruido; la pendiente es la señal.
 */
export function pendientePorDia(puntos: { x: number; y: number }[]): number | null {
  const n = puntos.length;
  if (n < 3) return null;
  const mx = puntos.reduce((s, p) => s + p.x, 0) / n;
  const my = puntos.reduce((s, p) => s + p.y, 0) / n;
  let num = 0;
  let den = 0;
  for (const p of puntos) {
    num += (p.x - mx) * (p.y - my);
    den += (p.x - mx) ** 2;
  }
  if (den === 0) return null;
  return num / den;
}

/** Ritmo en minutos por kilómetro, formateado como 5:42. */
export function ritmo(distanciaKm: number, duracionMin: number): string | null {
  if (distanciaKm <= 0 || duracionMin <= 0) return null;
  const minPorKm = duracionMin / distanciaKm;
  const m = Math.floor(minPorKm);
  const s = Math.round((minPorKm - m) * 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function dias(desde: string, hasta: string): number {
  return Math.round((new Date(hasta).getTime() - new Date(desde).getTime()) / 86400000);
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function haceDias(hoy: string, n: number): string {
  return iso(new Date(new Date(hoy).getTime() - n * 86400000));
}

// ── El informe ──────────────────────────────────────────────────────

interface Lift {
  exercise_name: string;
  weight: number;
  reps: number;
  rpe: number | null;
  session_id: string;
}

/**
 * Construye el bloque de análisis que ve el coach. Devuelve texto plano
 * porque va directo al prompt: cualquier estructura que el modelo tenga que
 * volver a interpretar es contexto desperdiciado.
 */
export async function construirEstudio(sb: Db, userId: string, hoy: string): Promise<string> {
  const hace28 = haceDias(hoy, 28);
  const hace56 = haceDias(hoy, 56);
  const hace90 = haceDias(hoy, 90);

  const [sesionesRes, pesoRes, cardioRes, nutriLogRes, nutriObjRes, prescRes] = await Promise.all([
    sb.from('gym_sessions').select('id, date').eq('user_id', userId).gte('date', hace90).order('date'),
    sb.from('body_metrics').select('date, weight_kg').eq('user_id', userId).gte('date', hace56).order('date'),
    sb.from('cardio_sessions').select('*').eq('user_id', userId).gte('date', hace56).order('date'),
    sb.from('nutrition_logs').select('date, hit_kcal, hit_protein').eq('user_id', userId).gte('date', hace28),
    sb.from('nutrition_targets').select('*').eq('user_id', userId).eq('active', true).order('from_date', { ascending: false }).limit(1),
    sb.from('training_prescriptions').select('*').eq('user_id', userId).gte('date', hace28).order('date'),
  ]);

  const sesiones = (sesionesRes.data ?? []) as { id: string; date: string }[];
  const fechaSesion = new Map(sesiones.map((s) => [s.id, s.date]));

  const lineas: string[] = ['# ESTUDIO DEL CAZADOR'];
  const push = (s = '') => lineas.push(s);

  // ── Fuerza ──────────────────────────────────────────────────────
  if (sesiones.length) {
    const { data: lifts } = await sb
      .from('gym_lifts')
      .select('exercise_name, weight, reps, rpe, session_id')
      .eq('user_id', userId)
      .in('session_id', sesiones.map((s) => s.id));

    const porEjercicio = new Map<string, { fecha: string; e1rm: number; rpe: number | null; peso: number; reps: number }[]>();
    for (const l of ((lifts ?? []) as Lift[])) {
      const fecha = fechaSesion.get(l.session_id);
      const est = e1rm(Number(l.weight), Number(l.reps));
      if (!fecha || est === null) continue;
      const arr = porEjercicio.get(l.exercise_name) ?? [];
      arr.push({ fecha, e1rm: est, rpe: l.rpe === null ? null : Number(l.rpe), peso: Number(l.weight), reps: Number(l.reps) });
      porEjercicio.set(l.exercise_name, arr);
    }

    if (porEjercicio.size) {
      push();
      push('## Fuerza (1RM estimado, Epley)');
      for (const [ejercicio, series] of porEjercicio) {
        series.sort((a, b) => a.fecha.localeCompare(b.fecha));
        // Mejor serie de cada día: la que más 1RM estimado da.
        const porDia = new Map<string, { e1rm: number; rpe: number | null; peso: number; reps: number }>();
        for (const s of series) {
          const prev = porDia.get(s.fecha);
          if (!prev || s.e1rm > prev.e1rm) porDia.set(s.fecha, s);
        }
        const dias28 = [...porDia.entries()].filter(([f]) => f >= hace28);
        if (!dias28.length) continue;

        const ultimo = dias28[dias28.length - 1]!;
        const primero = dias28[0]!;
        const delta = primero[1].e1rm > 0 ? ((ultimo[1].e1rm - primero[1].e1rm) / primero[1].e1rm) * 100 : 0;
        const conRpe = dias28.map(([, v]) => v.rpe).filter((r): r is number => r !== null);
        const rpeMedio = conRpe.length ? conRpe.reduce((a, b) => a + b, 0) / conRpe.length : null;

        push(
          `- ${ejercicio}: e1RM ${ultimo[1].e1rm.toFixed(1)} kg ` +
            `(último trabajo ${ultimo[1].peso}×${ultimo[1].reps}, ${ultimo[0]}) · ` +
            `${delta >= 0 ? '+' : ''}${delta.toFixed(1)} % en 28 días · ` +
            `${dias28.length} sesiones · ` +
            (rpeMedio === null ? 'sin RPE registrado' : `RPE medio ${rpeMedio.toFixed(1)}`),
        );
      }
      push(
        'Lectura: RPE medio ≤7 con progreso plano = margen para subir carga. ' +
          'RPE ≥9 sostenido sin progreso = fatiga acumulada, toca descarga.',
      );
    }
  }

  // ── Peso corporal ───────────────────────────────────────────────
  const pesos = (pesoRes.data ?? []) as { date: string; weight_kg: number }[];
  if (pesos.length >= 3) {
    const base = pesos[0]!.date;
    const puntos = pesos.map((p) => ({ x: dias(base, p.date), y: Number(p.weight_kg) }));
    const recientes = puntos.filter((p) => p.x >= dias(base, hace28));
    const porDia = pendientePorDia(recientes.length >= 3 ? recientes : puntos);
    const actual = pesos[pesos.length - 1]!;
    push();
    push('## Peso corporal');
    push(`- Último: ${actual.weight_kg} kg (${actual.date}) · ${pesos.length} pesajes en 56 días`);
    if (porDia !== null) {
      const porSemana = porDia * 7;
      push(
        `- Tendencia: ${porSemana >= 0 ? '+' : ''}${porSemana.toFixed(2)} kg/semana ` +
          `(regresión sobre los últimos 28 días, no sobre el último dato)`,
      );
      push(
        '- Referencia pactada: bajar entre 0,5 y 1 kg por semana. Más rápido come músculo; ' +
          'plano dos semanas seguidas significa que el déficit ya no existe.',
      );
    }
  } else if (pesos.length) {
    push();
    push('## Peso corporal');
    push(`- Solo ${pesos.length} pesaje(s) en 56 días: no hay tendencia que leer. Pídele que se pese a diario.`);
  }

  // ── Cardio ──────────────────────────────────────────────────────
  const cardio = (cardioRes.data ?? []) as {
    date: string; kind: string; distance_km: number | null; duration_min: number;
    zone: string; rpe: number | null; avg_hr: number | null;
  }[];
  if (cardio.length) {
    push();
    push('## Cardio');
    const tipos = [...new Set(cardio.map((c) => c.kind))];
    for (const tipo of tipos) {
      const s = cardio.filter((c) => c.kind === tipo);
      const km28 = s.filter((c) => c.date >= hace28).reduce((a, c) => a + Number(c.distance_km ?? 0), 0);
      const kmPrevios = s
        .filter((c) => c.date < hace28 && c.date >= haceDias(hoy, 56))
        .reduce((a, c) => a + Number(c.distance_km ?? 0), 0);
      const cambio = kmPrevios > 0 ? ((km28 - kmPrevios) / kmPrevios) * 100 : null;

      push(
        `- ${tipo}: ${s.filter((c) => c.date >= hace28).length} sesiones y ${km28.toFixed(1)} km en 28 días` +
          (cambio === null ? '' : ` · ${cambio >= 0 ? '+' : ''}${cambio.toFixed(0)} % vs los 28 anteriores`),
      );

      // El ritmo solo se compara dentro de la misma zona: un Z2 y unos
      // intervalos no son la misma prueba.
      const z2 = s.filter((c) => c.zone === 'Z2' && c.distance_km && Number(c.distance_km) > 0);
      if (z2.length >= 2) {
        const primero = z2[0]!;
        const ultimo = z2[z2.length - 1]!;
        push(
          `  Ritmo en Z2: ${ritmo(Number(primero.distance_km), primero.duration_min)} (${primero.date}) → ` +
            `${ritmo(Number(ultimo.distance_km), ultimo.duration_min)} (${ultimo.date}) min/km`,
        );
      }
    }
    push(
      'Lectura: el volumen semanal no debería subir más de un 10 % de una semana a otra. ' +
        'Mismo ritmo con RPE más bajo, o mismo RPE más rápido, es progreso aeróbico real.',
    );
  } else {
    push();
    push('## Cardio');
    push('- Sin sesiones registradas en 56 días. Con un IRONMAN en 2029, esto es el agujero más grande.');
  }

  // ── Nutrición ───────────────────────────────────────────────────
  const objetivo = ((nutriObjRes.data ?? []) as Record<string, unknown>[])[0];
  const logs = (nutriLogRes.data ?? []) as { date: string; hit_kcal: boolean; hit_protein: boolean }[];
  push();
  push('## Nutrición');
  if (objetivo) {
    push(
      `- Objetivo vigente: ${objetivo.kcal} kcal · ${objetivo.protein_g} g de proteína` +
        (objetivo.carbs_g ? ` · ${objetivo.carbs_g} g carbo` : '') +
        (objetivo.fat_g ? ` · ${objetivo.fat_g} g grasa` : '') +
        (objetivo.rationale ? `\n  Motivo: ${objetivo.rationale}` : ''),
    );
  } else {
    push('- SIN objetivo nutricional fijado. Fíjalo tú con fijar_nutricion antes de exigir adherencia.');
  }
  if (logs.length) {
    const kcal = logs.filter((l) => l.hit_kcal).length;
    const prot = logs.filter((l) => l.hit_protein).length;
    push(
      `- Adherencia en 28 días: ${logs.length} partes · calorías ${Math.round((kcal / logs.length) * 100)} % · ` +
        `proteína ${Math.round((prot / logs.length) * 100)} %`,
    );
    push(
      'Lectura: si el peso no se mueve y la adherencia declarada es alta, el objetivo está mal calculado, ' +
        'no es que él mienta. Ajusta las calorías antes de apretar.',
    );
  } else {
    push('- Sin partes de nutrición en 28 días: no se puede juzgar la dieta.');
  }

  // ── Adherencia al entreno prescrito ─────────────────────────────
  const presc = (prescRes.data ?? []) as { date: string; exercise_name: string }[];
  if (presc.length) {
    const fechasHechas = new Set(sesiones.filter((s) => s.date >= hace28).map((s) => s.date));
    const fechasPrescritas = [...new Set(presc.map((p) => p.date))];
    const cumplidas = fechasPrescritas.filter((f) => fechasHechas.has(f)).length;
    push();
    push('## Adherencia al programa');
    push(
      `- Sesiones prescritas en 28 días: ${fechasPrescritas.length} · realizadas: ${cumplidas} ` +
        `(${fechasPrescritas.length ? Math.round((cumplidas / fechasPrescritas.length) * 100) : 0} %)`,
    );
  }

  return lineas.join('\n');
}
