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
  // Mensaje motivacional de racha para el perfil: lo primero que ve el cazador.
  streakHype: (days: number) => {
    if (days <= 0) {
      return pick([
        'Hoy es el día perfecto para encender la racha. El sistema observa.',
        'Racha a cero. Los grandes cazadores también empezaron aquí. Enciéndela hoy.',
      ]);
    }
    if (days < 3) {
      return pick([
        'La racha está encendida. Los primeros días forjan al cazador.',
        'La cadena ha empezado. Protégela: hoy solo tienes que no romperla.',
      ]);
    }
    if (days < 7) {
      return pick([
        `${days} días seguidos. La cadena crece — que no seas tú quien la rompa.`,
        `${days} días. El sistema empieza a fiarse de ti. Sigue.`,
      ]);
    }
    if (days < 14) {
      return pick([
        'Una semana entera en pie. Tu multiplicador ya paga: cada misión vale más.',
        `${days} días. Esto ya se parece a la disciplina que prometiste.`,
      ]);
    }
    if (days < 30) {
      return pick([
        `${days} días seguidos. Esto ya no es suerte: es quién eres.`,
        `${days} días. Los que te rodean aún no lo saben, pero estás cambiando.`,
      ]);
    }
    return pick([
      `${days} días. Los rangos S se construyen así: un día más, cada día. Imparable.`,
      `${days} días de racha. El cazador que escribió aquella carta estaría orgulloso.`,
    ]);
  },
};
