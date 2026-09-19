// NIVL · Un solo gesto.
//
// Registrar el acto real —la sesión del gimnasio, el cardio, el parte de
// comidas, el peso, el diario— marca solo todo lo que lo estaba pidiendo: la
// misión enlazada, la regla del contrato y el bloque del plan. Antes había que
// decir "he entrenado" en cuatro pantallas, y cada una pagaba por su lado.
//
// Se llama DESPUÉS de guardar el acto, y es best-effort a propósito: que falle
// un check no puede tumbar una sesión ya registrada, y una misión pagada sin
// sesión detrás sería XP regalado.

import { questsScheduledOn } from './closing';
import { fetchRules, marcarReglaCumplida } from './contract';
import { fetchCompletionsForDate, fetchQuests } from './data';
import { fetchPlan, setBlockDone } from './dayplan';
import { completeQuest } from './engine';
import type { BlockKind } from './plan';
import { supabase } from './supabase';
import type { ActLink, Profile } from './types';

// 'comida' no entra: un día tiene varios bloques de comida y el parte de
// nutrición es uno solo, al final. Marcarlos todos sería mentir.
const BLOQUES: Partial<Record<ActLink, BlockKind[]>> = {
  gym: ['gym'],
  cardio: ['aerobico'],
};

export interface Propagado {
  /**
   * XP que las misiones enlazadas han pagado HOY por este acto, se marcaran
   * ahora o a mano antes. El módulo paga solo la diferencia hasta su base: el
   * mismo acto no cobra dos veces, y una misión trivial no le quita al entreno
   * lo que valía sin ella.
   */
  xpMisiones: number;
  /** XP pagado ahora mismo, por las misiones que se acaban de marcar. */
  xp: number;
  /** Títulos de lo que se ha marcado solo, para contárselo. */
  marcadas: string[];
  profile: Profile;
  leveledUp: boolean;
  newLevel: number;
}

/** Lo que le queda por pagar al módulo una vez descontado lo que pagó la misión. */
export function restoDelModulo(base: number, eco: Pick<Propagado, 'xpMisiones'> | null): number {
  return Math.max(0, base - (eco?.xpMisiones ?? 0));
}

export async function propagarActo(profile: Profile, link: ActLink, date: string): Promise<Propagado> {
  const out: Propagado = { xpMisiones: 0, xp: 0, marcadas: [], profile, leveledUp: false, newLevel: 0 };

  try {
    const [quests, completions] = await Promise.all([fetchQuests(), fetchCompletionsForDate(date)]);
    const hechas = new Map(completions.map((c) => [c.quest_id, c.xp_awarded]));
    const enlazadas = questsScheduledOn(quests, date).filter((q) => q.link === link);

    for (const q of enlazadas) {
      if (hechas.has(q.id)) {
        out.xpMisiones += hechas.get(q.id) ?? 0;
        continue;
      }
      try {
        const res = await completeQuest(out.profile, q, null);
        out.profile = res.profile;
        out.xp += res.xp;
        out.xpMisiones += res.xp;
        out.marcadas.push(q.title);
        if (res.leveledUp) {
          out.leveledUp = true;
          out.newLevel = res.newLevel;
        }
      } catch {
        /* esa misión se queda pendiente y se puede marcar a mano */
      }
    }
  } catch {
    /* sin misiones a la vista paga el módulo, como antes de enlazar nada */
  }

  try {
    // El juicio diario de las reglas arranca con la PRIMERA marca
    // (closing.ts → reglasIncumplidas): a partir de ahí, lo no marcado cuenta
    // como roto. Una marca automática no puede ser la que lo arranque — le
    // empezaría a cobrar todas las demás reglas a alguien que nunca ha usado
    // las casillas. Solo se marca sola si él ya marca por su cuenta.
    const { count } = await supabase.from('rule_checks').select('id', { count: 'exact', head: true });
    if ((count ?? 0) > 0) {
      const rules = await fetchRules();
      for (const r of rules.filter((x) => x.active && x.link === link)) {
        await marcarReglaCumplida(profile.id, r.id, date);
      }
    }
  } catch {
    /* ídem */
  }

  const kinds = BLOQUES[link];
  if (kinds) {
    try {
      const plan = await fetchPlan(date);
      for (const b of plan?.bloques ?? []) {
        if (!b.done && kinds.includes(b.kind)) await setBlockDone(b.id, true);
      }
    } catch {
      /* ídem */
    }
  }

  return out;
}

/** La pantalla donde se demuestra cada acto: tocar la misión lleva allí. */
export const RUTA_DE_ACTO: Record<ActLink, '/gym' | '/cardio' | '/nutricion' | '/avances' | '/diario'> = {
  gym: '/gym',
  cardio: '/cardio',
  nutricion: '/nutricion',
  peso: '/avances',
  diario: '/diario',
};

export const NOMBRE_DE_ACTO: Record<ActLink, string> = {
  gym: 'la sesión de gimnasio',
  cardio: 'la sesión de cardio',
  nutricion: 'el parte de comidas',
  peso: 'el pesaje',
  diario: 'el diario',
};
