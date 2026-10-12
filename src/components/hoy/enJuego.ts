// NIVL · La línea de lo que hay en juego hoy (RET-05). Puro, para testearlo.
//
// Sustituye al genérico «A medianoche, lo pendiente se penaliza» por algo
// concreto, con el mismo criterio que el cierre (closing.enJuegoHoy):
//   · racha en riesgo  → cuántas faltan para salvarla y lo que costaría;
//   · piedra           → que una piedra protegerá la racha (o, con la racha a
//                        cero, evitará la penalización) esta noche;
//   · sin riesgo       → lo pendiente y lo que costaría dejarlo.
//   · reglas           → las reglas del contrato sin marcar también cuestan
//                        (xpEnJuego ya las incluye, closing.enJuegoHoy).
// Todo hecho y nada más en juego → null (Hoy ya dice que el día está cerrado).

import { t } from '@/i18n';
import type { enJuegoHoy } from '@/lib/closing';

export type EnJuego = ReturnType<typeof enJuegoHoy>;

export interface LineaEnJuego {
  texto: string;
  /** La racha está en riesgo: la sección de misiones va en tono alerta. */
  alerta: boolean;
}

/** La frase con « Si no, −75 XP.» detrás, o tal cual si no cuesta XP. */
const conCoste = (frase: string, xp: number): string => (xp > 0 ? t('hoy:enJuego.conCoste', { frase, xp }) : frase);

export function lineaEnJuego(j: EnJuego, rachaDias: number): LineaEnJuego | null {
  if (j.pendientes <= 0) {
    // Misiones hechas, pero el contrato sigue sin marcar: es lo único que
    // queda en juego y se dice con su cifra.
    return j.xpEnJuego > 0 ? { texto: t('hoy:enJuego.soloReglas', { xp: j.xpEnJuego }), alerta: false } : null;
  }

  if (j.rachaEnRiesgo && j.faltanParaSalvar > 0) {
    const frase = t('hoy:enJuego.salvarRacha', {
      count: j.faltanParaSalvar,
      dias: t('hoy:enJuego.dias', { count: rachaDias }),
    });
    return {
      texto: conCoste(frase, j.xpEnJuego),
      alerta: true,
    };
  }

  if (j.gastariaPiedra) {
    // Con la racha a cero el cierre también gasta la piedra: lo que salva es
    // el XP, no una racha que no existe.
    // La piedra no absorbe las reglas: si cuestan algo, se dice aparte.
    const reglas = j.xpEnJuego > 0;
    const clave =
      rachaDias > 0
        ? reglas
          ? 'hoy:enJuego.piedraRachaReglas'
          : 'hoy:enJuego.piedraRacha'
        : reglas
          ? 'hoy:enJuego.piedraPenaReglas'
          : 'hoy:enJuego.piedraPena';
    return {
      texto: t(clave, { xp: j.xpEnJuego }),
      alerta: false,
    };
  }

  return {
    texto: conCoste(t('hoy:enJuego.pendientes', { count: j.pendientes }), j.xpEnJuego),
    alerta: false,
  };
}
