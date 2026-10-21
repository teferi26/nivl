# FOCUS: el mundo del estudiante

Rama `nivl-1011/focus-v2`. Encargo: punto 5 de `coordinacion-winter-arc/FEEDBACK_TEFERI_1011_B32.md`, fiel a la lámina 3 de la P01 (notas de fidelidad en `coordinacion-winter-arc/propuestas_modos/fidelidad/focus-NOTAS.md`).

## Mapa

- Pestañas (`src/modos/rutasModo.ts`, como la lámina): **Hoy · Temario · Exámenes · Coach** (`src/app/(focus)/focus-*.tsx`). Agenda y Diario salen del mundo FOCUS (siguen en NIVL).
- Lógica pura con tests en `src/focus/` (`pomodoro`, `planEstudio`, `repaso`, `notas`, `horario`, `mision`, `metodos`, `resumen`, `fechas`; tests en `src/focus/__tests__/`).
- Datos en `src/focus/datos.ts` (efectos) y el reloj fuera de pantalla en `src/focus/temporizador.ts`.
- Pantallas en `src/components/focus/` con el patrón useX + XVista + demo. Galería: `/kit/focus`.
- Migración **0076** (`supabase/migrations/0076_focus.sql`; nació como 0075 y se renumeró al integrar WORK, que se quedó la 0075), escrita y NO aplicada, con su huella en `scripts/apply-migrations.mjs`. Sin ella la app no se rompe: FOCUS pinta «FOCUS se está preparando» y el temporizador funciona igual.

## Economía (skill nivl-game-design)

**Cero economía nueva.** Ningún bloque, repaso, nota ni tarjeta da XP. Un bloque de foco terminado ENTERO completa la misión de FOCUS que llevaba enlazada (si es de hoy y no está hecha) por `completeQuest` → `complete_quest`, que ya suma el XP del modo (0068). Es el «un solo gesto» de `src/lib/links.ts` para el estudio: el mismo acto no paga dos veces (unique por misión y día en BD; `pagados` por id de bloque en el cliente). La sesión además marca hecho el primer bloque `estudio` del plan del día. Invariantes: nada cambia en rachas, penalizaciones ni topes; las misiones de penalización no se enlazan; saltar o terminar un bloque a medias no paga.

## Hecho

| Qué | Dónde |
|---|---|
| Pomodoro 25/5 configurable (5 a 90 de foco), descanso largo cada 4 (configurable), encadenar fases | `pomodoro.ts`, `usePomodoro.ts`, hoja de ajustes |
| El reloj sobrevive a segundo plano y a cerrar la app (se guarda cuándo acaba, no cuenta segundos) | `pomodoro.ts`, `temporizador.ts` |
| Notificación local al acabar aunque la app esté en segundo plano (`avisarEn`, un id fijo, se cancela al pausar o parar) | `temporizador.ts` |
| Campana de fin con la app delante (expo-audio cargado al primer uso, respeta el silencio de iOS), sintetizada con ffmpeg | `assets/sonidos/focus/fin.m4a`, `scripts/sonidos-focus.sh`, `sonidoFin.ts` |
| «Móvil en silencio al empezar»: recordatorio honesto con los pasos de iOS y Android (no se bloquea nada) | `HojaNoMolestar` |
| Registro de horas por asignatura (sesión idempotente por id de bloque) y horas de la semana | `registrarSesion`, `horasDeLaSemana` |
| Asignaturas (alta y archivado), temario con estado pendiente / repasando / dominado | Temario |
| Exámenes con fecha (escrita a mano: 2/11, 2/11/2026), peso y temas que entran | `HojaExamen`, `leerFechaEs` |
| Plan de estudio automático hacia cada examen: lo nuevo repartido en los días que quedan (equilibrado por peso), repasos a +1 y +3 días, simulacro el último día; plan de hoy con horas tras la última clase | `planEstudio.ts`, `resumen.ts` |
| Horario de clases (día, horas, aula), siguiente clase y solapes | `horario.ts`, Temario |
| Notas con media simple o ponderada (las que no llevan peso se reparten lo que falta hasta 100) y qué nota hace falta para el 5 | `notas.ts`, Exámenes |
| Repetición espaciada 1, 3, 7, 14, 30 días para temas y flashcards (bien sube, dudosa repite, mal vuelve a mañana) | `repaso.ts`, `HojaRepaso` |
| Flashcards: mazos, tarjetas y repaso con el mismo calendario | Temario |
| Métodos explicados y aplicables: recuerdo activo, repetición espaciada, Feynman, flashcards, mapas mentales, exámenes anteriores, pomodoro (qué es, pasos, por qué funciona, botón que lo pone en marcha) | `metodos.ts`, `HojaMetodo` |
| Misiones de FOCUS en Hoy (la misma hoja de completar de NIVL) y misión que paga el bloque, propuesta sola por el nombre de la asignatura | `mision.ts`, `useFocusHoy.ts` |
| Coach FOCUS: el chat de siempre con el modo FOCUS (pestaña Coach); en Hoy, una línea del sistema según el día | `vistaHoy.ts → fraseCoach` |
| Seis idiomas (es, en, de, fr, it, pt) | `src/i18n/*/focus.json` |
| Tablas con RLS de dueño, referencias de la misma cuenta, dueño fijo, topes por cuenta, exportación v11 y borrado en cascada | 0076 (probada en PGlite con `scripts/test-export-full-schema.mjs`) |

## No hecho (y por qué)

- **Bloquear distracciones de verdad**: en iOS exige la API de Screen Time (Family Controls, con permiso especial de Apple y binario nuevo). Se ofrece el recordatorio honesto de No molestar.
- **Sonido propio en la notificación**: pide registrar el archivo en `app.json` (binario nuevo). La notificación suena con el sonido del sistema; la campana propia suena con la app delante.
- **Que el coach lea temario, exámenes y notas**: tocar el coach por dentro (contexto y herramientas en `supabase/functions/`) estaba fuera de este encargo. Siguiente paso natural: un estudio `_shared/estudio.ts` con exámenes, progreso del temario, horas y repasos pendientes, y una herramienta para marcar temas.
- **Importar el temario desde un PDF o una foto**: útil, pero es trabajo de IA con coste; mejor detrás del coach.
- **Calendario del sistema y avisos de clase**: el horario vive en FOCUS; avisar antes de cada clase pediría otra familia de avisos en `notifications.ts`.
- **Widget o Live Activity con el reloj**: nativo, binario nuevo.
- **Estadísticas largas (horas por mes, rachas de estudio)**: la lógica de días seguidos está (`diasSeguidos`), falta pantalla; sin XP.
- **Compartir mazos entre compañeros**: social, con moderación: fuera de alcance.

## Riesgos

- La 0076 redefine `export_my_data` como v11 = v10 de la 0075 (WORK) + FOCUS: es la versión única que exporta todo. Si otra migración posterior la redefine, tiene que partir de esta.
- Numeración en la integración v3: 0075 WORK, 0076 FOCUS, 0077 IRON (agua y comida libre).
- La cabecera del mundo y la barra inferior son de otros equipos: la fidelidad final depende también de ellos.
