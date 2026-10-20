# Modos: cada modo es un mundo

Decisión de Teferi (20/10/2026, propuesta P01 «Rueda», `coordinacion-winter-arc/propuestas_modos/RANKING.md`). Solo existe con el interruptor `modos_activos` encendido; apagado, la app es la de siempre.

## La regla

**El modo activo decide el mundo.** Cada grupo de expo-router tiene su layout (`LayoutMundo`) y mira el modo de `ModoProvider`: si no es el suyo, redirige al inicio del que toca (`destinoMundo` en `src/modos/rutasModo.ts`, puro y con test). Por eso, dentro de un mundo el modo activo es siempre el suyo y el coach lo recibe en `x-nivl-modo` sin hacer nada más.

- Cambiar de mundo: `irAlMundo(modo, cambiar)` (cambia el modo y hace `router.replace(rutaInicioDe(modo))`). Lo usan el selector de Hoy de NIVL, el botón «NIVL» de la cabecera y lo usará la rueda.
- Al arrancar: `src/app/index.tsx` va a `rutaDeArranque(...)`; si el modo se lee más tarde, `(tabs)/_layout.tsx` lleva a su mundo.
- Un mundo no tiene hábitos, campañas ni Winter Arc: viven en NIVL.

## Qué ve cada mundo

| Mundo | Barra | Inicio |
|---|---|---|
| NIVL `(tabs)` | Hoy · Agenda · Coach · Hábitos · Campañas · Perfil | La app de siempre |
| IRON `(iron)` | Hoy · Rutinas · Pesos · Coach | Cabecera IRON con su nivel; entreno de hoy con «Empezar entreno» (useGym; la sesión se hace ahí mismo); tus pesos y récords (3, «Ver todo»); rutinas en una fila con «Nueva»; catálogo con técnica animada (`/iron/catalogo` → `/iron/[id]`); dieta de hoy (objetivo y parte, enlaces a Dieta y Nutrición); coach IRON |
| FOCUS `(focus)` | Hoy · Agenda · Diario · Coach | Misiones etiquetadas FOCUS («Tu foco de hoy»), orden del día (bloques de foco), coach FOCUS |
| WORK `(work)` | Hoy · Agenda · Diario · Coach | Misiones WORK («Prioridades de hoy»), orden del día, coach WORK |
| FOUNDER `(founder)` | Hoy · Agenda · Economía · Coach | Misiones FOUNDER («La única cosa de hoy»), orden del día, coach FOUNDER |

Rutinas es Gimnasio entero; Pesos es `iron/pesos.ts` (puro, con test) sobre lo que ya guarda Gimnasio; Agenda, Diario y Economía son las pantallas de siempre sin flecha de volver. El coach es el mismo chat (`PantallaCoach`) en todos.

Todos los inicios usan `useHoy` (el de NIVL): cierra los días pendientes, recoloca los avisos y da el informe del cierre, que se pinta arriba. En FOCUS, WORK y FOUNDER también da las misiones, ya filtradas por `quests.modes`.

## Piezas

- `src/modos/rutasModo.ts`: `MUNDOS`, `rutaInicioDe`, `rutaCoachDe`, `destinoMundo`, `rutaDeArranque`, `irAlMundo`.
- `src/components/modos/mundo/`: `LayoutMundo`, `CabeceraMundo` (ranura `emblema` para el EmblemaModo de la rueda, nivel del modo y botón «NIVL»), `IronHoyVista`, `PesosIronVista`, `MundoHoyVista`, `PantallasMundo`, hooks.
- Navegación: `TabBar`, `NavRail` y `NavSidebar` aceptan `acento` (y la barra lateral `marca`); los iconos de los mundos están en `NAV_MUNDO` (`navItems.ts`).
- Textos: namespace `mundos` (6 idiomas).
