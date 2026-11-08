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
  estudio: ['estudio'],
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

export interface OpcionesActo {
  /**
   * Solo estas misiones (FOCUS: las que los minutos reales dejan cubiertas,
   * src/focus/mision.ts). Sin esto, todas las enlazadas al acto.
   */
  soloMisiones?: readonly string[];
  /** ¿El acto llega a lo que pide esta regla? Sin esto, cualquier acto la cumple. */
  cubreRegla?: (texto: string) => boolean;
  /** ¿Da para marcar un bloque de `minutos` con `yaMarcados` min de bloques ya hechos? */
  cubreBloque?: (minutos: number, yaMarcados: number) => boolean;
}

export async function propagarActo(profile: Profile, link: ActLink, date: string, opciones?: OpcionesActo): Promise<Propagado> {
  const out: Propagado = { xpMisiones: 0, xp: 0, marcadas: [], profile, leveledUp: false, newLevel: 0 };

  // Una lectura fallida no puede convertirse en "no había misión": el módulo
  // cobraría su base y la misión, marcada luego a mano, cobraría otra vez
  // (QA Chat 5, H2). Se reintenta una vez.
  const leer = () => Promise.all([fetchQuests(), fetchCompletionsForDate(date)]);
  const pagadoHoy = async (questId: string): Promise<number | null> => {
    for (let i = 0; i < 2; i++) {
      try {
        const c = (await fetchCompletionsForDate(date)).find((x) => x.quest_id === questId);
        return c ? c.xp_awarded : null;
      } catch {
        /* un reintento */
      }
    }
    return null;
  };

  try {
    const [quests, completions] = await leer().catch(leer);
    const hechas = new Map(completions.map((c) => [c.quest_id, c.xp_awarded]));
    const solo = opciones?.soloMisiones;
    const enlazadas = questsScheduledOn(quests, date).filter((q) => (solo ? solo.includes(q.id) : q.link === link));

    for (const q of enlazadas) {
      if (hechas.has(q.id)) {
        out.xpMisiones += hechas.get(q.id) ?? 0;
        continue;
      }
      try {
        const res = await completeQuest(out.profile, q, null);
        out.profile = res.profile;
        if (!res.awarded) {
          // Otro dispositivo (o un toque en Hoy) la completó entre la lectura
          // y la marca: ya está pagada, y lo pagado cuenta.
          out.xpMisiones += (await pagadoHoy(q.id)) ?? 0;
          continue;
        }
        out.xp += res.xp;
        out.xpMisiones += res.xp;
        out.marcadas.push(q.title);
        if (res.leveledUp) {
          out.leveledUp = true;
          out.newLevel = res.newLevel;
        }
      } catch {
        // La RPC pudo confirmar y perder la respuesta: se comprueba antes de
        // dejar que el módulo cobre lo que la misión ya pagó.
        const pagado = await pagadoHoy(q.id);
        if (pagado !== null) {
          out.xp += pagado;
          out.xpMisiones += pagado;
          out.marcadas.push(q.title);
        }
        /* si no, esa misión se queda pendiente y se puede marcar a mano */
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
      for (const r of rules.filter((x) => x.active && x.link === link && (opciones?.cubreRegla?.(x.text) ?? true))) {
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
      const bloques = plan?.bloques ?? [];
      const yaMarcados = bloques.reduce((s, b) => s + (b.done && kinds.includes(b.kind) ? b.end_min - b.start_min : 0), 0);
      for (const b of bloques) {
        if (!b.done && kinds.includes(b.kind)) {
          if (opciones?.cubreBloque && !opciones.cubreBloque(b.end_min - b.start_min, yaMarcados)) break;
          await setBlockDone(b.id, true);
          // Un día de estudio tiene varios bloques: un acto marca uno.
          if (link === 'estudio') break;
        }
      }
    } catch {
      /* ídem */
    }
  }

  return out;
}

/** La pantalla donde se demuestra cada acto: tocar la misión lleva allí. */
export const RUTA_DE_ACTO: Record<ActLink, '/gym' | '/cardio' | '/nutricion' | '/avances' | '/diario' | '/focus-hoy'> = {
  gym: '/gym',
  cardio: '/cardio',
  nutricion: '/nutricion',
  peso: '/avances',
  diario: '/diario',
  estudio: '/focus-hoy',
};

/** El módulo donde se registra cada acto, como se le llama en los botones. */
export const MODULO_DE_ACTO: Record<ActLink, string> = {
  gym: 'Gimnasio',
  cardio: 'Cardio',
  nutricion: 'Nutrición',
  peso: 'Avances',
  diario: 'Diario',
  estudio: 'FOCUS',
};

export const NOMBRE_DE_ACTO: Record<ActLink, string> = {
  gym: 'la sesión de gimnasio',
  cardio: 'la sesión de cardio',
  nutricion: 'el parte de comidas',
  peso: 'el pesaje',
  diario: 'el diario',
  estudio: 'el bloque de estudio',
};
