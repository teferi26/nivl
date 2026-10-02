// NIVL · La línea de lo que hay en juego hoy (RET-05). Puro, para testearlo.
//
// Sustituye al genérico «A medianoche, lo pendiente se penaliza» por algo
// concreto, con el mismo criterio que el cierre (closing.enJuegoHoy):
//   · racha en riesgo  → cuántas faltan para salvarla y lo que costaría;
//   · piedra           → que una piedra protegerá la racha (o, con la racha a
//                        cero, evitará la penalización) esta noche;
//   · sin riesgo       → lo pendiente y lo que costaría dejarlo.
// Todo hecho → null (Hoy ya dice que el día está cerrado).

import type { enJuegoHoy } from '@/lib/closing';

export type EnJuego = ReturnType<typeof enJuegoHoy>;

export interface LineaEnJuego {
  texto: string;
  /** La racha está en riesgo: la sección de misiones va en tono alerta. */
  alerta: boolean;
}

/** « Si no, −75 XP.», o nada si no cuesta XP. */
const coste = (xp: number): string => (xp > 0 ? ` Si no, −${xp} XP.` : '');

export function lineaEnJuego(j: EnJuego, rachaDias: number): LineaEnJuego | null {
  if (j.pendientes <= 0) return null;

  if (j.rachaEnRiesgo && j.faltanParaSalvar > 0) {
    const n = j.faltanParaSalvar;
    const verbo = n === 1 ? 'falta' : 'faltan';
    const misiones = n === 1 ? 'misión' : 'misiones';
    const dias = rachaDias === 1 ? 'día' : 'días';
    return {
      texto: `Te ${verbo} ${n} ${misiones} para salvar tu racha de ${rachaDias} ${dias}.${coste(j.xpEnJuego)}`,
      alerta: true,
    };
  }

  if (j.gastariaPiedra) {
    // Con la racha a cero el cierre también gasta la piedra: lo que salva es
    // el XP, no una racha que no existe.
    return {
      texto:
        rachaDias > 0
          ? 'Si no llegas, una piedra protegerá tu racha esta noche.'
          : 'Si no llegas, una piedra evitará la penalización esta noche.',
      alerta: false,
    };
  }

  const n = j.pendientes;
  return {
    texto: `${n} ${n === 1 ? 'pendiente' : 'pendientes'}.${coste(j.xpEnJuego)}`,
    alerta: false,
  };
}
