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
| `Screen` | Recibe la clase de tamaño. En `medium`/`expanded` coloca el raíl o la barra lateral y el panel contextual. Margen según la clase. |
| `ScreenHeader` | Título `title`, eyebrow `label`, acción. En `expanded` el título se alinea con la retícula de contenido. |
| `Section` | El rótulo `label` va con una regla de 1 px que llega al borde. Sin `tone` de color: `tone` pasa a `default` · `alerta` (rótulo con trama) · `logro` (rótulo con grano). |
| `Card` | Variantes `surface` (ink1), `outline` (hairline ink3), `inverse` (blanco con texto negro: solo una por pantalla), `alerta` (borde con trama) y `logro` (fondo con grano). |
| `Row` / `Check` | `Check` hecho = círculo blanco sólido con marca negra. Pendiente = aro ink4. Bloqueado = aro con trama y candado. |
| `Button` (antes `SystemButton`) | `primary` (blanco sólido), `secondary` (contorno blanco 1,5), `ghost`, `danger` (contorno con trama y texto blanco; el peligro es la trama, no el rojo). Alto 52 (lg), 44 (md), 36 (sm). |
| `Chip` / `Tag` | Chip seleccionado = invertido. `Tag` = contorno; `Tag tone="alerta"` = trama. |
| `Stat`, `ProgressRing`, `XPBar` | Barras con relleno blanco sobre ink4. Los segmentos se marcan con un corte de 2 px en negro. |
| `EmptyState`, `Skeleton` | Esqueleto ink2↔ink3 que respira (se para con «reducir movimiento»). |
| `Sheet` (nuevo) | La hoja inferior única (sustituye a los `Modal` sueltos): asa, eyebrow, título, contenido con scroll, pie fijo. Safe area real. Centrada en tablet. |
| `Avatar` (nuevo, sustituye a `Hexagon`) | Círculo con el **marco de rango** (§7). |
| `Toast` (nuevo, sustituye a `XpToast`) | Pastilla invertida arriba: «+50 XP · FUE». Se anuncia al lector. |
| `Ceremony` (nuevo) | Pantalla completa de subida de nivel y de rango (§8). |
| `ShareCard` (nuevo, con el Chat 1) | Plantillas 9:16 y 4:5 (§10). |
| `CoachMark` (nuevo) | La galea del coach a 16, 24 y 48. |

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
| A (22, ~11 meses) | laurel doble | Casco | Grano en la cabecera y la barra de XP | Héroe de la arena |
| S (30, ~2 años) | laurel con corona y brillo (una pasada cada 8 s; quieto si se reduce el movimiento) | Corona de laurel | Grano + borde de 3 en la tarjeta de perfil | Leyenda |

- El título que se pinta es siempre `tituloVigente()`.
- La vitrina de logros sale de `ACHIEVEMENTS_VISIBLES()`.
- Las celebraciones vienen de `colaDeCelebracion()`: una principal y un resumen, nunca una cascada.
- El cliente guarda las claves vistas por usuario y expone `celebrando`; con ella el Chat 2 sabe que no debe abrir la oferta encima de una ceremonia.
- Coronas y marcos son SVG de un solo trazo blanco en `src/components/ui/Crown.tsx` y `Avatar.tsx`.

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
