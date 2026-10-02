# NIVL · Sistema de diseño v2 — «Mármol y tinta»

Fase 2 (1.0.8). Autoridad: Chat 4 (líder de UI). Tokens en `src/design/tokens.ts` (fuente única, con tests de contraste). Maquetas: artifact «NIVL Diseño v2» https://claude.ai/artifact/Gew7UaYjh3rvXweC2DYc62 (privado del dueño hasta que lo comparta).
Base: `winter2/integracion @99729ea`. Sustituye al sistema «arena» (`nivl-design-system`, paleta con rojo y oro).

## 0. Principio

**Solo blanco y negro.** No hay rojo, oro, acero ni violeta. El significado no se lleva en el color, sino en cuatro recursos que funcionan también para daltónicos y en lectores de pantalla:

| Recurso | Qué significa |
|---|---|
| **Inversión** (blanco con texto negro) | Lo activo, lo hecho, la acción principal. Hay **una** superficie invertida por pantalla. |
| **Peso del trazo** (hairline 1 · regla 2 · marco 3) | Jerarquía y estatus. El rango engorda el marco. |
| **Trama** (rayado a 45° o punteado) | Alerta, penalización, bloqueado, pendiente. Sustituye al rojo. |
| **Grano** (puntos finos sobre negro) | Logro, racha, Élite. Sustituye al oro. |

Tres reglas:
1. Cada pantalla tiene **una sola idea en blanco sólido**.
2. Lo que más importa del día está siempre a **≤ 2 toques**.
3. Toda celebración se puede saltar con un toque y respeta «reducir movimiento».

## 1. Color (tokens `ink`)

Escala neutra pura, sin tinte. Contrastes AA verificados en el test `tokens.test.ts`.

| Token | Hex | Uso | Contraste sobre `ink0` |
|---|---|---|---|
| `ink0` | #000000 | Fondo de la app | — |
| `ink1` | #0B0B0B | Superficie (tarjetas, hojas) | — |
| `ink2` | #161616 | Superficie elevada, campo de texto | — |
| `ink3` | #242424 | Hairline, separadores | — |
| `ink4` | #3A3A3A | Pista de barras, borde de control | (no es texto) |
| `ink6` | #8C8C8C | Texto terciario: metadatos, fechas | 6,25:1 · sobre `ink2` 5,38:1 |
| `ink8` | #BDBDBD | Texto secundario | 11,2:1 · sobre `ink2` 9,6:1 |
| `ink9` | #EDEDED | Texto principal | 17,9:1 · sobre `ink2` 15,5:1 |
| `ink10` | #FFFFFF | Acento: inversión, CTA, número de nivel | 21:1 |

Prohibido: hex sueltos en pantallas, opacidades para texto (rompen el contraste), y cualquier color que no sea esta escala. Excepción: los iconos de terceros dentro de su logotipo (Apple, Google) en los botones de tienda.

## 2. Tipografía

Se mantienen las familias ya cargadas (no se añaden dependencias): **Cinzel** (la piedra) y **Outfit** (la voz).

| Estilo | Familia | Tamaño / interlínea | Tracking | Uso |
|---|---|---|---|---|
| `display` | Cinzel 700 | 56/60 | 2 | Número de nivel en la ceremonia, marca |
| `rank` | Cinzel 700 | 32/36 | 4 | Letra de rango |
| `title` | Outfit 700 | 30/34 | −0,6 | Título de pantalla |
| `headline` | Outfit 700 | 20/26 | −0,2 | Título de tarjeta o hoja |
| `body` | Outfit 500 | 16/24 | 0 | Texto de lectura |
| `bodySm` | Outfit 500 | 14/20 | 0 | Detalle de fila |
| `label` | Outfit 700 | 12/16 | 2 MAYÚSCULAS | Rótulo de sección (eyebrow) |
| `number` | Cinzel 600 | 24/28 | 0 | Cifras en Stat |
| `micro` | Outfit 600 | 11/14 | 1 | Etiquetas (`Tag`). Mínimo absoluto |

Reglas: lectura ≥ 14; nada < 11; Cinzel solo en mayúsculas o cifras. Se respeta el tamaño dinámico del sistema hasta ×1,35 (`maxFontSizeMultiplier`), y por encima los layouts pasan a una columna.

## 3. Retícula y espaciado

- Base **4 pt**. Escala `space`: 4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 56 · 80.
- Margen lateral: 20 (compacto), 32 (medio), 48 (expandido).
- Radio: **0** en todo, salvo el avatar (círculo), el `Check` (círculo) y las pastillas de chip (completo). Sin sombras ni degradados.
- Zona táctil ≥ 44×44 (con `hitSlop` si el glifo es menor).

### Clases de tamaño (responsive real)

| Clase | Ancho | Dispositivos | Navegación | Contenido |
|---|---|---|---|---|
| `compact` | < 600 | iPhone SE (375), mini, Pro Max (430), plegable cerrado | Barra inferior de 5 pestañas | 1 columna, máx. 560 |
| `medium` | 600–1023 | iPad mini (744), plegable abierto, iPad vertical (820) | **Raíl lateral** de 72 pt con iconos y rótulo | 2 columnas: lista + detalle, o 2 tarjetas |
| `expanded` | ≥ 1024 | iPad horizontal, iPad Pro, Mac, PC | Barra lateral de 240 pt con marca y rango | 3 zonas: navegación · contenido (máx. 720) · panel contextual (320: coach, rango, amigos) |

Verificación obligatoria de cada pantalla a **375, 430, 744, 1024 y 1440**. La web de la app usa las mismas clases. Las hojas (`Sheet`) son modales centrados de 560 en `medium` y `expanded`, nunca de ancho completo.

## 4. Iconografía

Ionicons outline de 20 (filas) y 24 (navegación), trazo de 1,5. El estado activo usa la variante sólida, no un color. Tres glifos propios en SVG: **galea** (el coach), **corona por rango** (§7) y **sello** (logros).

## 5. Componentes v2 (`src/components/ui`)

Se conserva la API del kit actual cuando se puede (para que la migración sea mecánica). Se marcan los cambios.

| Componente | Cambio v2 |
|---|---|
| `Screen` | Se mide con el **hueco real**, no con la ventana: dentro de las pestañas, `(tabs)/_layout.tsx` publica en `TopeAncho` la ventana menos el raíl (72) o la barra lateral (240) y el inset izquierdo (`huecoContenido` en `responsive.ts`). A 1024 el contenido mide 784 (`medium`). El panel contextual (320) solo se pinta si el hueco es `expanded` y le quedan al contenido 560 + 2·32 (`cabeAside`); si no, se oculta y el margen es 32. |
| `ScreenHeader` | Título `title`, eyebrow `label`, acción. En `expanded` el título se alinea con la retícula de contenido. |
| `Section` | El rótulo `label` va con una regla de 1 px que llega al borde. Sin `tone` de color: `tone` pasa a `default` · `alerta` (la regla es una banda de trama de 6) · `logro` (banda de grano). Acepta los valores viejos: `red` → `alerta`, `gold` → `logro`, el resto → `default`. |
| `Card` | Variantes `surface` (ink1), `outline` (hairline ink3), `inverse` (blanco con texto negro: solo una por pantalla; el contenido lo sabe por `SuperficieContext`), `alerta` (borde de trama ink6 de 3 alrededor de una placa ink1) y `logro` (marco de grano ink6 de 6 alrededor de una placa ink1: el texto nunca va encima de la textura). Trama y grano en ink6 (6,25:1); grano r 0,7 cada 4. |
| `Row` / `Check` | `Check` hecho = círculo blanco sólido con marca negra. Pendiente = aro ink4. Bloqueado = aro con trama y candado. |
| `Button` (antes `SystemButton`) | `primary` (blanco sólido), `secondary` (contorno blanco 1,5), `ghost`, `danger` (contorno con trama y texto blanco; el peligro es la trama, no el rojo). Alto 52 (lg), 44 (md), 36 (sm). Rótulo: Outfit 700 en mayúsculas, 15/2,5 · 14/2 · 12/1,5 (tamaño/tracking en lg · md · sm), la única excepción a la escala `type`. Desactivado: sin opacidad, borde ink4 y texto ink6. |
| `Chip` / `Tag` | Chip seleccionado = invertido. `Tag` = contorno; `Tag tone="alerta"` = pastilla con borde de trama y `tone="logro"` = con borde de grano, ambas con el texto `micro` ink9 sobre una placa ink0. |
| `Stat`, `ProgressRing`, `XPBar` | Barras con relleno blanco sobre ink4. Los segmentos se marcan con un corte de 2 px en negro. |
| `EmptyState`, `Skeleton` | Esqueleto ink2↔ink3 que respira (se para con «reducir movimiento»). |
| `Sheet` (nuevo) | La hoja inferior única (sustituye a los `Modal` sueltos): asa, eyebrow, título, botón «Cerrar» de 44, contenido con scroll, pie fijo. Safe area real en el móvil; en tablet, centrada y con pie de 16 (sin inset). Teclado: `padding` en iOS, `height` en Android. El gesto de escape del lector de pantalla la cierra. |
| `Avatar` (nuevo, sustituye a `Hexagon`) | Círculo con el **marco de rango** (§7). |
| `Toast` (nuevo, sustituye a `XpToast`) | Pastilla invertida arriba: «+50 XP · FUE». Máx. 90 % de ancho y 2 líneas. Se anuncia al lector una vez (`announceForAccessibility`, sin región viva). |
| `Ceremony` (nuevo) | Pantalla completa de subida de nivel y de rango (§8). |
| `ShareCard` (nuevo, con el Chat 1) | Plantillas 9:16 y 4:5 (§10). |
| `CoachMark` (nuevo) | La galea del coach a 16, 24 y 48. |

## 5 bis. Arena (`src/components/arena`, rediseño L-RADICAL)

La base que hace que la app se lea como una arena y no como un recoloreado. Se importa desde `@/components/arena` (no desde `@/components/ui`). Plan completo y reparto: `docs/design-v2/L-RADICAL.md`.

**Tokens nuevos** (`tokens.ts`): `type.monumento` (Cinzel 700 112/112), `type.monumentoSm` (72/72, el nivel de 3 cifras cuando el hueco de texto baja de 360), `type.cifra` (Cinzel 600 32/36, los números de una franja), `type.inscripcion` (Cinzel 700 14/18, tracking 4, los rótulos grabados) y `motion.escalon` (55 ms entre bloques de una entrada en cascada).

| Pieza | Qué es |
|---|---|
| Motivos (`Laurel`, `Columna`, `Arena`, `Meandro`, `Galea`) | Un trazo, sin relleno, extremos redondos, ocultos al lector y sin toques. Laurel ink6 (rama de 24 × 64 escalada; `der` es el espejo), columna dórica ink4, arena ink3 (`arco`: graderío de 3 gradas con 15 arcadas; `ovalo`: planta con eje), meandro ink4 de 8 o 12 que llena el ancho (Pattern con `useIdSeguro`), galea = `Crown`. Geometría pura en `arena/geometria.ts` (con test). |
| `Contador` | Cifra que cuenta (700 ms, salida cúbica) en el hilo de UI con Reanimated; el lector oye el valor final. Máximo 4 por pantalla y nunca en filas de lista. |
| `Barra` | Pista ink4, relleno blanco o ink8 escalado en X desde la izquierda (muelle damping 18), cortes de 2 en ink0 si hay ≤ 30 segmentos. `progressbar` con valor 0-100. No sustituye a `XPBar`. |
| `Entrada` | Fundido de 260 y subida de 14 en 320 con cascada de 55 ms, tope en el octavo. Solo bloques de pantalla y los 8 primeros de una lista; nunca `layout`. |
| `TarjetaArena` | Card con `remaches` (4 cuadrados de 3 en las esquinas), `zocalo` (segunda losa hairline ink3 desplazada 4: profundidad sin sombra), `marco` 1-3 en ink10 y `rotulo` grabado. Variantes: piedra · contorno · trama · grano · invertida. |
| `EncabezadoArena` | Título de pantalla en Cinzel mayúscula (`type.rank`), eyebrow, subtítulo, volver, acción de 44 (sólida = la inversión) y meandro opcional. |
| `FranjaCifras` | 2 a 4 celdas con hairlines verticales ink3: cifra en `type.cifra` y rótulo `micro` ink6. Cada celda se lee «rótulo: valor». |
| `HeroRango` | `hoy`: a sangre, nivel monumental entre laureles con la arena detrás, rango grabado, línea, barra de 10 segmentos, franja y meandro de cierre. `perfil`: avatar de 120 sobre el óvalo, nombre, título grabado, franja, barra y borde inferior de 3. El lector oye un resumen; avatar y agenda son botones aparte. |
| `ASangre` | Saca el contenido al borde con el margen que publica `Screen` en `GutterContext` (0 con `plain`). |

**Tres excepciones deliberadas** a lo anterior:
1. **Títulos de pantalla en Cinzel mayúscula** (`EncabezadoArena`). Hasta aquí Cinzel era solo marca y cifras; en las pantallas rediseñadas el título es una inscripción.
2. **Grano ink3 de fondo en los Hero** (rango B en adelante). Es decoración de bajo contraste, no significa «logro»: el grano de logro sigue siendo ink6 y en marco.
3. **La inversión puede ser una fila de una lista** («lo activo»): la siguiente misión de Hoy, mi fila en el ranking. Sigue habiendo una sola por pantalla.

Galería de verificación (solo desarrollo): `/kit/pantallas?pantalla=<id>&estado=<estado>&ancho=375|430|744|1024|1440`. La página «arena» enseña cada pieza; cada pantalla lee su `src/components/<carpeta>/demo.tsx`.

## 6. Estados

| Estado | Cómo se ve |
|---|---|
| Cargando | `Skeleton` con la forma final; nunca spinner suelto ni vacío antes de tiempo. |
| Vacío | Icono suelto + frase en voz del sistema + una acción. Explica qué hacer, no culpa. |
| Error | `Card outline` + «El sistema no responde» + `mensajeSistema(e)` + «Reintentar». |
| Sin conexión | Banda fina arriba con trama: «Sin conexión. Lo que hagas se guarda al volver.» (solo si la acción admite cola; si no, se desactiva con explicación). |
| Bloqueado | Trama + candado + la razón en una línea (patrón RET-03). |
| Hecho | Inversión (Check blanco) y texto ink6 con tachado fino. |

## 7. Rango: el tema que evoluciona dentro del blanco y negro

Los datos son del **Chat 5**: `src/lib/progression.ts` y `docs/game-v2/CONTRATO-PROGRESION.md`. Rangos E–S con grados I/II/III, umbrales ligados a momentos reales y un rango que **nunca baja**. Aquí solo se fija cómo se ve (`RANK_THEME` en `tokens.ts`). Evoluciona la forma o el grano, nunca el color.

| Rango (desde nivel) | Marco (`marco`) | Corona | Acento de la interfaz | Título |
|---|---|---|---|---|
| E (1) | liso: aro hairline 1 | — | Plano | Tiro |
| D (5, ~1 semana) | doble: aro 2 + aro ink6 | — | Plano | Gladiador |
| C (10, ~6 semanas) | remachado: doble aro con 8 remaches | — | Regla de sección de 2 px | Veterano |
| B (15, ~4 meses) | laurel simple, aro 3 | **Casco** (galea de un trazo) | Grano suave en la tarjeta de nivel | Campeón |
| A (22, ~11 meses) | laurel doble | Laurel | Grano en la cabecera y la barra de XP | Héroe de la arena |
| S (30, ~2 años) | laurel con corona y brillo (una pasada cada 8 s; quieto si se reduce el movimiento) | Corona de la arena (`corona_arena`) | Grano + borde de 3 en la tarjeta de perfil | Leyenda |

- El título que se pinta es siempre `tituloVigente()`.
- La vitrina de logros sale de `ACHIEVEMENTS_VISIBLES()`.
- Las celebraciones vienen de `colaDeCelebracion()`: una principal y un resumen, nunca una cascada.
- El cliente guarda las claves vistas por usuario y expone `celebrando`; con ella el Chat 2 sabe que no debe abrir la oferta encima de una ceremonia.
- Coronas y marcos son SVG de un solo trazo blanco en `src/components/ui/Crown.tsx` y `Avatar.tsx`.

**Medidas del marco y la corona** (`Avatar.tsx`):

- Remaches sobre el aro **exterior**, r = max(1,5; tamaño/32), blancos con filo negro de 0,75. En S son rombos.
- Ramitas de laurel en el arco inferior, entre remaches: 1 par en `laurel_simple` (B), 2 en `laurel_doble` (A) y `laurel_corona` (S).
- S lleva además un tercer aro hairline blanco por dentro: A y S se distinguen sin el brillo.
- Corona: lado = round(tamaño × 0,5), centrada, con la línea base (y = 20 de la retícula de 24) apoyada 1,5 pt dentro del aro. No se pinta por debajo de 48 pt de avatar. Su altura por encima del círculo la da `alturaCorona(tamaño, rango)` y el Avatar la reserva como `paddingTop`.
- Grosor del trazo de la corona en unidades de la retícula: 2 (≤ 16), 1,5 (≤ 24), 1,25 (≤ 48), 1 (más grande).
- El `accessibilityLabel` es «{nombre}, rango {R}, {título}».

## 8. Movimiento

| Token | Duración | Curva | Uso |
|---|---|---|---|
| `instant` | 100 | lineal | Pulsado, check |
| `quick` | 180 | ease-out | Chips, toasts |
| `base` | 260 | ease-out | Entradas (FadeIn), hojas |
| `slow` | 420 | spring (damping 18) | Barras de XP, anillos |
| `ceremony` | 1600 en total | secuencia | Subida de nivel o rango |

**Ceremonia de nivel** (pantalla completa, negro):
1. El número viejo se rompe en 6 fragmentos (120 ms).
2. El nuevo sube desde abajo en `display` (420 ms) mientras la barra se llena.
3. Si cambia el rango (celebración `rango`, épica): el marco cambia de forma (500 ms), el casco o la corona baja sobre el avatar y aparece el título nuevo. Las de `grado` y `nivel` son una versión corta de 900 ms, sin corona.
4. CTA «Compartir» (blanco) y «Seguir» (ghost).

Con «reducir movimiento»: corte directo al estado final y fundido de 180 ms. Se salta con un toque. El sonido es opcional, está apagado por defecto y se activa en Perfil.

## 9. Vibraciones (mapa único, `src/design/haptics.ts`)

Una sola función `vibrar(evento)` para que ninguna pantalla elija el estilo por su cuenta. Se respeta un ajuste de Perfil para apagarlas.

| Evento | expo-haptics |
|---|---|
| Toque en chip, pestaña o selector | `selectionAsync` |
| Misión completada | `notificationAsync(Success)` |
| Misión con foto o bonus | `Success` + `impactAsync(Light)` a 120 ms |
| Día perfecto | `impactAsync(Medium)` ×3 a 90 ms |
| Subida de nivel | `impactAsync(Heavy)` al aparecer el número |
| Subida de rango | `Heavy` + `Heavy` a 140 ms con la corona |
| Racha hito (7, 30, 100) | `Success` + `Medium` |
| Penalización o error | `notificationAsync(Warning)` (nunca `Error`: el sistema no castiga con el cuerpo) |
| Acción destructiva confirmada | `impactAsync(Rigid)` |
| Recuperación abierta (RET-03) | `Success` |

## 9 bis. Coach: galea y voz (con el Chat 3)

- **Glifo propio: la galea.** Un casco de gladiador de un solo trazo, en negro sobre un círculo blanco. Se reconoce a 16, 24 y 96 px. No es un emoji del sistema.
- **Escuchar:** cada respuesta del coach lleva «Escuchar», que usa `hablar()` de `src/lib/voice/` (Chat 3). «Parar» aparece mientras habla. Nunca habla en segundo plano: al salir de la app, `parar()`.
- **Dictar:** se mantiene pulsado el botón del micrófono del compositor. El permiso de micrófono se pide la PRIMERA vez que se pulsa, nunca en el onboarding.
  - Mientras graba, se ve una franja «● GRABANDO 0:04 · suelta para enviar, desliza para cancelar» (guía 2.5.14 de Apple).
  - El lector de pantalla anuncia el inicio y el fin.
- **Cita:** si el coach ha consultado datos, su respuesta empieza con una línea discreta en `bodySm` ink6 con regla izquierda de 2 px: «Consultado: …».
- **Denunciar respuesta:** se mantiene, junto a «Escuchar».

## 10. Compartir (con el Chat 1)

Plantillas en negro puro con la marca NIVL (Cinzel) arriba y el dominio `nivl.app` abajo. Siempre se elige qué compartir: nada de datos de salud ni de dinero por defecto.

- **Nivel/rango** (9:16): avatar con su corona, número `display`, título y «Día N de racha».
- **Racha** (4:5): número enorme y una retícula de 30 días con los cuadros hechos invertidos.
- **Antes/después** (9:16 y 4:5): dos fotos en B/N (el filtro se aplica al generar), fecha y Δ de peso solo si el usuario lo activa.
- **Logro**: sello y frase.

## 10 bis. Creadores (con el Chat 2)

En las apps de tienda (iOS y Android), el panel de creador **no muestra importes en euros**. Muestra:
- rango y progreso;
- ventas atribuidas (número);
- retos;
- tabla del periodo;
- y la línea «Tus ganancias se gestionan en nivl.app», sin botón de cobro.

Los importes (pendiente, disponible, pagado) solo están en el portal web. La vista sale de `vistaPanelCreador(plataforma, datos)` del Chat 2.

## 11. Voz del sistema y notificaciones

Segunda persona, frases cortas, sin exclamaciones dobles ni emojis en la interfaz. El coach sí tiene un glifo propio (la galea, `CoachMark`). En las notificaciones del coach (texto plano) se firma con el prefijo «⛉ » (U+26C9) solo si el usuario activa «firma del coach»; por defecto, sin símbolo.

| Notificación | Título | Cuerpo |
|---|---|---|
| Mañana | NIVL | «Tus misiones de hoy están listas. La primera es la que cuesta.» |
| Tarde (pendientes) | NIVL | «Quedan {n} misiones. A medianoche se cierra el día.» |
| Racha en riesgo | NIVL | «Tu racha de {n} días termina hoy si no completas una misión.» |
| Regreso (3+ días fuera) | NIVL | «La arena sigue abierta. Una misión basta para volver.» |
| Recuperación abierta | NIVL | «Has vuelto a la arena. Puedes recuperar lo perdido hoy.» |
| Subida de nivel (si la app está cerrada) | NIVL | «Nivel {n}. Tu límite anterior ya no existe.» |
| Coach | Coach | Titular generado por el servidor (Chat 3), máx. 90 caracteres. |
| Amigo te supera | NIVL | «{nombre} te ha pasado esta semana. Quedan {d} días.» |

La lógica de cuándo (tope diario, silencio nocturno) es del Chat 5.

## 12. Reparto de la implementación

| Lote | Contenido | Archivos |
|---|---|---|
| L1 | Tokens, `theme.ts` mapeado a v2 (para que todo cambie de golpe), haptics y kit base (`Screen` con clases de tamaño, `Card`, `Button`, `Sheet`, `Avatar`, `Crown`, `Toast`) | `src/design/**`, `src/components/ui/**`, `theme.ts` |
| L2 | Hoy, Hábitos, Campañas, Agenda, navegación responsive | `(tabs)/**`, `_layout.tsx` |
| L3 | Perfil, rango, ceremonia, compartir y amigos/competición | `perfil`, `amigos`, `LevelUpOverlay`, nuevos |
| L4 | Coach (galea y voz, con el Chat 3), Oráculo, onboarding y paywall (con el Chat 2) | `coach`, `oraculo`, `onboarding` |
| L5 | Cuerpo (gym y fotos de progreso), diario, dinero, resto | resto de `src/app` |
| L6 | Web pública en el mismo lenguaje | `nivl-web` |

Cada lote se cierra con `nivl-ux-auditor` y capturas a 375, 744 y 1440.

## 13. Qué NO cambia

- La economía (Chat 5).
- La autoridad del servidor.
- Los consentimientos separados.
- El borrado.
- Las reglas de `AGENTS.md` sobre `mensajeSistema`, el cerrojo de completar y un solo mecanismo de teclado.
- El vocabulario: gladiador, misiones, campañas, ludus, cierre, racha.
