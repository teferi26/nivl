// La voz del sistema: banco de mensajes. Dramatismo sobrio, segunda persona,
// frases cortas. El sistema constata; la calidez solo en momentos ganados.

function pick(lines: string[]): string {
  return lines[Math.floor(Math.random() * lines.length)] ?? lines[0] ?? '';
}

export const voice = {
  allDone: () =>
    pick([
      'Todas las misiones completadas. El sistema está satisfecho.',
      'Día cerrado sin bajas. Continúa así, cazador.',
      'Objetivos del día neutralizados. Descansa: lo has ganado.',
      'El sistema registra un día impecable.',
    ]),
  levelUp: () =>
    pick([
      'Tu poder ha aumentado.',
      'El sistema reconoce tu progreso.',
      'Has roto tu límite anterior.',
      'Los débiles esperan. Tú avanzas.',
    ]),
  penaltyApplied: (xp: number) =>
    pick([
      `El sistema ha aplicado −${xp} XP. La misión de penalización espera.`,
      `Fallo registrado: −${xp} XP. Redímete hoy o la pérdida será permanente.`,
      `−${xp} XP. El sistema no olvida, pero ofrece redención.`,
    ]),
  stoneUsed: () =>
    pick([
      'Una Piedra de Protección se ha hecho añicos en tu lugar. La racha sobrevive.',
      'El sistema ha consumido una Piedra de Protección. Sin daño esta vez.',
    ]),
  stoneEarned: () =>
    pick([
      'Semana impecable: has forjado una Piedra de Protección.',
      'El sistema te concede una Piedra de Protección. Guárdala para el mal día.',
    ]),
  frozen: (reason: string) =>
    pick([
      `Sistema en pausa (${reason}). Sin misiones, sin penalizaciones, sin juicio.`,
      `Modo ${reason} activo. El sistema protege tu retirada.`,
    ]),
  morningNotif: () =>
    pick([
      'El sistema ha asignado tus misiones de hoy. Complétalas antes de medianoche.',
      'Nuevas misiones disponibles. El día es una mazmorra: entra primero.',
      'Tus misiones esperan. Cada una completada te acerca al siguiente rango.',
    ]),
  eveningNotif: () =>
    pick([
      'Quedan pocas horas. Las misiones incompletas serán penalizadas a medianoche.',
      'El cierre se acerca. Revisa tus misiones pendientes.',
      'Última llamada del sistema: completa lo pendiente antes del cierre.',
    ]),
  dungeonCleared: (title: string) =>
    pick([
      `Mazmorra "${title}" despejada. El botín es tuyo.`,
      `"${title}" ha caído. El sistema registra tu victoria.`,
    ]),
  pr: (exercise: string) =>
    pick([
      `Nuevo récord en ${exercise}. Tu límite anterior ya no existe.`,
      `${exercise}: marca personal superada. FUE responde.`,
    ]),
  achievement: () =>
    pick([
      'Logro desbloqueado.',
      'El sistema certifica tu hazaña.',
      'Nueva entrada en tu leyenda.',
    ]),
};
