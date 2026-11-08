// NIVL · WORK: de los tipos de la app a los del núcleo (puro).

import { XP_BY_DIFFICULTY } from '@/lib/game';
import type { DayBlock } from '@/lib/plan';
import type { CalendarEvent, Quest } from '@/lib/types';
import { horaAMin } from './fechas';
import type { BloquePlan, EventoTrabajo, MisionTrabajo } from './tipos';

export function aMision(m: { quest: Quest; hecha: boolean }): MisionTrabajo {
  const q = m.quest;
  return {
    id: q.id,
    titulo: q.title,
    hecha: m.hecha,
    penalizacion: q.is_penalty,
    xp: XP_BY_DIFFICULTY[q.difficulty] ?? 0,
    diaPrioridad: q.work_day ?? null,
    rango: q.work_rank ?? null,
    creadaEn: q.created_at ?? null,
  };
}

export function aBloquePlan(b: DayBlock): BloquePlan {
  return { id: b.id, inicio: b.start_min, fin: b.end_min, titulo: b.title, tipo: b.kind, hecho: b.done, questId: b.quest_id };
}

export function aEvento(e: Pick<CalendarEvent, 'id' | 'title' | 'date' | 'time'> & { end_time?: string | null; source?: string | null }): EventoTrabajo {
  return {
    id: e.id,
    titulo: e.title,
    fecha: e.date.slice(0, 10),
    inicio: horaAMin(e.time),
    fin: horaAMin(e.end_time),
    origen: e.source === 'dispositivo' ? 'dispositivo' : 'manual',
  };
}
