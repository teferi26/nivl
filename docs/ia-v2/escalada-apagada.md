# Escalada del ritual: apagada de hecho (bug conocido, se deja así hasta medir)

Estado: **decisión del coordinador (02/10/2026)** — se mantiene apagada en 1.0.8. Tarea abierta para encenderla con medición después de la 1.0.8.

## Qué pasa

`supabase/functions/ritual/handler.ts` → `decidir()`, rama «4) Escalada»: a las 11:00 locales, si el gladiador no ha escrito al coach en 4 días, el ritual lanza `kind: 'escalada'` («El sistema te espera»).

Para saber si «ha escrito», cuenta filas de `coach_messages` con `role = 'user'` en los últimos 4 días. Pero el propio cron escribe mensajes de rol `user` en el hilo cada vez que dispara un ritual (el prompt del brief diario: «Es AAAA-MM-DD. Dicta el brief de hoy…», «[ritual: …]»). Con el brief de cada mañana siempre hay un mensaje «del usuario» reciente, así que la escalada **probablemente no se dispara nunca**.

## Cómo se arreglaría

Contar solo los mensajes del gladiador, excluyendo los prompts del cron, con el mismo criterio que ya usa el check-in (L6) para decidir si un check-in quedó sin respuesta (`esMensajeDelGladiador` en `_shared/checkin.ts`).

## Por qué no se arregla ahora

Encenderla de golpe activaría la escalada para muchos usuarios a la vez: más push (ahora acotados por la política de 1 al día, prioridad escalada > mensual > brief > check-in) y más coste de IA (un turno completo del coach por usuario en silencio). Sin línea base medida, es un cambio de comportamiento a ciegas.

## Plan para encenderla (después de la 1.0.8)

1. Aplicar el criterio `esMensajeDelGladiador` en la rama de escalada.
2. Medir antes (D7: cuántos usuarios llevan ≥4 días sin escribir) y estimar coste por turno con `scripts/coste-coach.mjs`.
3. Encender por fases o para un porcentaje y comparar retención D7/D30 (Chat 5) frente a quejas o bajas de notificaciones.
4. Mantener la prioridad del push del día y el tope de 1 push diario.
