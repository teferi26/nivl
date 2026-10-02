// NIVL · La línea de lo que hay en juego hoy (RET-05). Puro, para testearlo.
//
// Sustituye al genérico «A medianoche, lo pendiente se penaliza» por algo
// concreto, con el mismo criterio que el cierre (closing.enJuegoHoy):
//   · racha en riesgo  → cuántas faltan para salvarla y lo que costaría;
//   · piedra           → que una piedra la protegerá esta noche;
//   · sin riesgo       → lo pendiente y lo que costaría dejarlo.
// Todo hecho → null (Hoy ya dice que el día está cerrado).

import type { enJuegoHoy } from '@/lib/closing';

export type EnJuego = ReturnType<typeof enJuegoHoy>;

export interface LineaEnJuego {
  texto: string;
  /** La racha está en riesgo: la sección de misiones va en tono alerta. */
  alerta: boolean;
}

/** « · dejarla te costaría 75 XP», o nada si no cuesta XP. */
const coste = (xp: number, objeto: string): string => (xp > 0 ? ` · ${objeto} te costaría ${xp} XP` : '');

export function lineaEnJuego(j: EnJuego, rachaDias: number): LineaEnJuego | null {
  if (j.pendientes <= 0) return null;

  if (j.rachaEnRiesgo && j.faltanParaSalvar > 0) {
    const n = j.faltanParaSalvar;
    const verbo = n === 1 ? 'falta' : 'faltan';
    const dias = rachaDias === 1 ? 'día' : 'días';
    return {
      texto: `Te ${verbo} ${n} para salvar la racha de ${rachaDias} ${dias}${coste(j.xpEnJuego, 'dejarlo')}`,
      alerta: true,
    };
  }

  if (j.gastariaPiedra) {
    return { texto: 'Si no llegas, una piedra protegerá tu racha esta noche', alerta: false };
  }

  const plural = j.pendientes !== 1;
  return {
    texto: `${j.pendientes} ${plural ? 'pendientes' : 'pendiente'}${coste(j.xpEnJuego, plural ? 'dejarlas' : 'dejarla')}`,
    alerta: false,
  };
}
