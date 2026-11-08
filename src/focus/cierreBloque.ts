// NIVL · FOCUS: del «¿Cómo te ha ido?» al estado del tema (puro, con tests).
//
//   · «Sin acabar»: nada cambia, el plan lo vuelve a proponer.
//   · «Lo repaso»: pasa a repasando y entra en la repetición espaciada.
//   · «Lo domino»: pasa a dominado y su repaso se aleja.
//
// Primera vez: «lo repaso» arranca el calendario (mañana); «lo domino» arranca
// una etapa más arriba. Si ya tenía calendario (otra vuelta, o estudiado a mano)
// cuenta como un repaso: «lo repaso» repite la etapa, «lo domino» la sube.
// repaso.ts sigue siendo el único calendario. Nada de esto paga XP.

import { primerRepaso, programar } from './repaso';
import type { EstadoTema, Tema } from './tipos';

export type ResultadoBloque = 'sin_acabar' | 'lo_repaso' | 'lo_domino';

export const RESULTADOS_BLOQUE: readonly ResultadoBloque[] = ['sin_acabar', 'lo_repaso', 'lo_domino'];

export interface CambioTema {
  estado: EstadoTema;
  etapa: number;
  repasoEl: string | null;
}

/** El estado en que queda el tema; null si no cambia nada. */
export function cierreBloque(tema: Pick<Tema, 'estado' | 'etapa' | 'repasoEl'>, resultado: ResultadoBloque, hoy: string): CambioTema | null {
  if (resultado === 'sin_acabar') return null;
  const yaTiene = tema.repasoEl !== null;
  if (resultado === 'lo_repaso') {
    const p = yaTiene ? programar(tema.etapa, 'dudosa', hoy) : primerRepaso(hoy);
    return { estado: 'repasando', etapa: p.etapa, repasoEl: p.vence };
  }
  const p = programar(yaTiene ? tema.etapa : primerRepaso(hoy).etapa, 'bien', hoy);
  return { estado: 'dominado', etapa: p.etapa, repasoEl: p.vence };
}
