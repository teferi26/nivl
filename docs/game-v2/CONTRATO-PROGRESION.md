# Sistema de juego v2 · contrato de progresión y celebraciones

Chat 5, líder de lógica de juego. Rama `winter2/chat5-juego`. El código fuente de verdad es `src/lib/progression.ts`, un módulo puro con tests en `progression.test.ts`. Este documento lo resume para el Chat 4 (UI), el Chat 2 (oferta e invitaciones) y el Chat 3 (coach).

## 1. Modelo único

```
XP (game.ts, sin cambios) → nivel (curva 100·N^1,5, sin cambios)
  → rango E…S y grado I/II/III (nuevo)
    → título del rango + títulos de logros (equipables)
      → cosméticos: marco del avatar y corona
```

| Rango | Nombre | Niveles (grados I · II · III) | Llega hacia | Marco | Corona |
|---|---|---|---|---|---|
| E | Tiro | 1 · 2 · 3 | día 0 | `liso` | — |
| D | Gladiador | 5 · 6 · 8 | ~1 semana | `doble` | — |
| C | Veterano | 10 · 11 · 13 | ~6 semanas | `remachado` | — |
| B | Campeón | 15 · 17 · 19 | ~4 meses | `laurel_simple` | `casco` |
| A | Héroe de la arena | 22 · 25 · 28 | ~11 meses | `laurel_doble` | `laurel` |
| S | Leyenda | 30 · 35 · 40 | ~2 años | `laurel_corona` | `corona_arena` |

Los plazos son para un ritmo constante de unos 270 XP netos al día. Los rangos antiguos (A = nivel 71, S = nivel 100) tardaban 15 y 36 años en llegar. Ahora cada rango cae en un momento real, y cada grado da un hito cualitativo cada uno a tres meses **sin añadir XP**.

**Paleta: solo blanco y negro.** El marco y la corona se dibujan como monocromo. Lo que evoluciona con el rango es la forma, el grosor, el laurel y el grano o brillo, nunca un color.

**El rango no baja nunca.** Una penalización puede bajar el nivel, pero el rango alcanzado se registra como logro oculto `rango_X` (tabla `achievements`, sin SQL nuevo) y `estadoDe` usa el máximo. Si el nivel cae por debajo, el grado vuelve a I dentro del rango conservado.

Títulos:
- `titulosDisponibles(rango, titulosDeLogros)`.
- Hay tres renombrados, «Élite», «Despertado» y «Monarca»: `tituloVigente(equipped_title)` muestra el nombre nuevo a quien ya los llevaba puestos.
- `ACHIEVEMENTS_VISIBLES()` excluye los registros internos de rango de la vitrina.

## 2. API para pantallas

```ts
import { estadoDe, cosmeticosDe, celebrarCambio, colaDeCelebracion, type Celebracion } from '@/lib/progression';

// Cabecera / perfil / avatar
const e = estadoDe(profile, logrosDesbloqueados);   // { nivel, xpEnNivel, xpSiguiente, rango, grado, racha, piedras }
const { titulo, marco, corona } = cosmeticosDe(e.rango);

// Después de completar misión / registrar acto / cerrar el día
const lista = celebrarCambio({
  perfilAntes, perfilDespues,          // los perfiles de antes y de la RPC
  logrosAntes: fetchUnlocked(),        // Set de códigos
  logrosNuevos,                        // lo que devolvió unlockAchievements (codigo, nombre, desc, titulo)
  fecha: dateKey(),
  recuperadoXp,                        // si se acaba de completar una misión de penalización
});
const { principal, resto } = colaDeCelebracion(lista, clavesYaVistas);
```

Para que el rango quede registrado, llama a `evaluateAchievements({ level, unlocked, ... })`. Ya devuelve los `rango_X` pendientes; después, `unlockAchievements` como siempre.

## 3. Celebraciones (`Celebracion`)

| `tipo` | Campos | Intensidad | Clave (idempotente) |
|---|---|---|---|
| `rango` | `rango, nombre, titulo, marco, corona, lema` | **épica**: ceremonia a pantalla completa | `rango:D` |
| `grado` | `rango, nombre, grado` | media | `grado:C:2` |
| `nivel` | `nivel, xpEnNivel, xpSiguiente` | media | `nivel:12` |
| `racha` | `dias` (7, 14, 30, 60, 100, 180, 365) | suave por debajo de 30, media desde 30 | `racha:30:AAAA-MM-DD` |
| `logro` | `codigo, nombre, desc, titulo` | media si da título, si no suave | `logro:streak_30` |
| `insignia` | `insignia, nivel, nombre` | media; épica en el nivel 3 | `insignia:reclutador:2` |
| `recuperacion` | `xp` | suave | `recuperacion:AAAA-MM-DD` |
| `piedra` | `total` | suave | `piedra:AAAA-MM-DD:N` |

Reglas que ya garantiza la lógica (con tests):
- **Como mucho una épica por acción.** Si coinciden dos, la segunda baja a media.
- Un rango nuevo **absorbe** la celebración de nivel y la de grado. Subir varios niveles de golpe es **una** celebración de nivel, la del último.
- **Bajar de nivel no se celebra.** Lo cuenta la tarjeta de cierre, sin dramatizar.
- Recuperar un nivel perdido **no repite** la ceremonia de rango.
- Orden de la lista: rango, grado, nivel, racha, logro, insignia, recuperación, piedra.
- `colaDeCelebracion(lista, yaVistas)`: la `principal` se enseña sola y el `resto` va en un único resumen, **nunca una cascada de pantallas**. La UI guarda las claves vistas, con un `AsyncStorage` local por usuario, para no repetir entre recargas ni entre dispositivos.

Propuesta de mapa de vibración (lo decide el Chat 4 en su sistema de diseño):
- épica: `notificationAsync(Success)` más impacto `Heavy` al revelar el marco;
- media: `impactAsync(Medium)`;
- suave: `selectionAsync`.

Todo respeta «reducir movimiento»: sin animación, el mismo contenido con un fundido.

## 4. Momentos que consume el Chat 2 (oferta)

- **Primer día cumplido:** la celebración `logro` con `clave === 'logro:first_day'`. Se desbloquea cuando el cierre devuelve `DayCloseResult.diasCumplidos > 0` y Hoy pasa `evaluateAchievements({ diaCumplido: true, ... })`.
- **«Celebración en curso»:** es estado de UI. Hoy, y cualquier pantalla que celebre, expone `celebrando = principal !== null && visible`. `decidirOferta` nunca abre la hoja mientras `celebrando` sea true; espera a que se cierre la principal.

## 5. Lo que NO hace este sistema

- No añade XP. Las celebraciones solo leen el estado.
- No cambia la curva de niveles ni el XP de `game.ts`.
- Las insignias y los rangos no dan ventaja en rankings, duelos ni ligas.
- No se usa ningún color fuera del blanco y negro.

Pendiente para las siguientes entregas: competición (`competition.ts`), fotos de progreso (`progressPhotos.ts`), plan de avisos (`notifyPlan.ts`) y simulación a 30, 90 y 365 días con `nivl-game-balancer`.
