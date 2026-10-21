# Modo GENERAL (NIVL) v2: el cuartel general

Encargo de Teferi (21/10/2026, FEEDBACK_TEFERI_1011_B33): «el general pese a que tiene todo lo mejor, organizadlo mejor: las campañas, las gráficas, las métricas del avance, los niveles, los rangos, los premios, la competición con amigos. Es lo que nos diferencia y si alguien quiere hacerlo todo desde el modo general debe poder». Referencia visual: lámina 4 de la P01 («NIVL: el cuartel general»), con las mismas piezas que los mundos IRON, FOCUS y WORK.

## Navegación: cuatro pestañas y el emblema, como los mundos

```
Hoy · Avance · [emblema NIVL] · Campañas · Arena
```

| Pestaña | Qué es | Ruta |
|---|---|---|
| **Hoy** | Nivel y rango, racha y piedras, LA siguiente acción, misiones, arsenal de modos, orden del día, campaña activa, duelo, coach y «Todo desde aquí» | `(tabs)/index` |
| **Avance** | Métricas (XP por semana, cumplimiento, racha histórica, FUE/VIT/INT/AGI/PER, informe semanal) y Progresión (nivel, camino de rangos E a S con días activos reales, logros y premios, botín de campañas, niveles de modo) | `(tabs)/avance` (`?ver=progresion`) |
| **Campañas** | Lista con cifras, tarjetas por campaña y botín; el detalle de siempre con la piel de NIVL | `(tabs)/mazmorras`, `dungeon/[id]` |
| **Arena** | Amigos: podio, ranking por constancia (abre en cumplimiento), duelos de la semana, solicitudes, código y ludus. Sin ligas (`LIGAS_VISIBLES = false`) | `(tabs)/arena` |

**Por qué así.** Teferi nombró siete cosas y todas caben en tres palabras: *avanzar* (gráficas, métricas, niveles, rangos, premios), *conquistar* (campañas) y *competir* (amigos). Cada una es una pestaña, y Hoy las resume. Los mundos ya enseñaron el patrón (cuatro destinos y el emblema en medio): General lo repite y el gesto es el mismo en toda la app.

**Lo que deja la barra y dónde queda.** El coach, los hábitos, la agenda y el perfil siguen siendo rutas de `(tabs)` (en el raíl y la barra lateral se ven los ocho), pero en el móvil se abren desde Hoy:

- **Coach**: la tarjeta del coach de Hoy (su última palabra y «Pregunta al coach»), como en la lámina y en los mundos.
- **Hábitos**: «Gestionar hábitos» bajo las misiones y el acceso «Hábitos».
- **Agenda**: el acceso «Agenda».
- **Perfil**: el botón de la cabecera (a la derecha, como el trofeo de la lámina).

Mientras se está en una de ellas, la barra deja Hoy encendida (`padre: 'index'` en `navItems.ts`).

## Todo desde General (sin modos)

«Todo desde aquí», en Hoy, abre las pantallas que ya existen sin cambiar de modo:

| Acceso | Pantalla |
|---|---|
| Gimnasio, Dieta, Cardio, Diario | `/gym`, `/dieta`, `/cardio`, `/diario` (las de siempre) |
| Foco (pomodoro), Exámenes | `/foco`, `/examenes` (y `/temario`): las de FOCUS, **prestadas** |
| Economía | `/finanzas`: la economía nueva de WORK y FOUNDER, **prestada** |
| Agenda, Hábitos | `(tabs)/agenda`, `(tabs)/habitos` |

**Pantallas prestadas** (`src/components/modos/mundo/Prestado.tsx`): la pantalla del mundo tal cual (misma lógica y datos), apilada sobre NIVL. Al ir prestada, la cabecera del mundo pone «volver» en la ranura del emblema y los saltos internos (Exámenes, Temario, el coach) van a las rutas prestadas, no a las del grupo del mundo (cuya puerta devolvería a NIVL).

## Cambiar de modo con UN toque (sin rueda)

- **Tu arsenal** (Hoy, Avance · Progresión y Perfil): una tarjeta por modo activado con su color, su glifo y su nivel. Un toque = `irAlMundo` con la firma de sonido y vibración del modo. Es el «toca para equipar» de la lámina 4.
- **La rueda** sigue igual: tocar el emblema la abre y tocar el modo elige; mantener y soltar es el atajo. Se ha blindado el toque sin arrastre: si el `Pan` de la rueda abierta no llega a activarse (un toque quieto y corto), el modo se elige en `onFinalize` (`RuedaModos.tsx`).

## Piezas

`src/components/general/`: `tema.ts` (oro de NIVL sobre los grises y medidas de IRON), `piezas.tsx` (tarjeta, rótulo, botón grande, segmentos, cifras, escudo, barras), `piel.tsx` (la piel de NIVL para Button, Chip, Sheet y Screen en lo reutilizado), `CabeceraGeneral.tsx` (HUD y héroe del nivel), `Arsenal.tsx` (arsenal y «Todo desde aquí»), `HoyGeneralVista`, `AvanceVista` (+ `useAvanceGeneral`, `derivarAvance` puro con test), `CampanasGeneralVista`, `demo.tsx` (galería `/kit/general`).

**Economía intacta**: nada de esto paga ni quita XP. Hoy usa `useHoy` (la misma hoja de completar y los mismos cerrojos); Avance solo lee (perfil, misiones, cumplimientos, logros, `sync_rank` y campañas).
