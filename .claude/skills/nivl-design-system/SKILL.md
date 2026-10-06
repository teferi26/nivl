---
name: nivl-design-system
description: Use when building or modifying ANY UI in NIVL (screens, components, animations, system copy). Encodes the monochrome "Mármol y tinta" system (ink0 to ink10 only, meaning carried by inversion, stroke weight, hatching and grain, never by colour), Cinzel titles and Outfit body from src/design/tokens.ts, the arena kit (@/components/arena), the useX + XVista + demo screen pattern, Sheet, loading/error states, the haptics table, accessibility, the voice of "el sistema", gladiator vocabulary, logo usage and the per-profile rules. Trigger on any edit under src/app or src/components, new screens, visual polish, or copy shown to the user.
---

# NIVL design system: «Mármol y tinta»

NIVL es una arena de gladiador con un coach dentro. Todo lo visible es piedra y tinta: negro, blanco y grises neutros, marcos de trazo fino, Cinzel grabada y Outfit para leer. Nada de neón, nada de color, nada de Solo Leveling.

Fuentes de verdad (esta skill es el resumen; ante duda, mandan ellas):
- `docs/design-v2/SISTEMA.md` (v2; §5 bis Arena, §10 bis Creadores, §12 bis Fase 3 cerrada)
- `docs/design-v2/L-RADICAL.md` (composición de las pantallas principales) y `docs/design-v2/FASE3.md` (patrón y vibraciones)
- `src/design/tokens.ts` (tokens, con test de contraste), `src/lib/theme.ts` (nombres viejos mapeados a ink), `src/components/arena/index.ts` (el kit arena)
- Manual de marca: `coordinacion-winter-arc/branding/index.html` (fuera del repo `nivl/`): esencia, logo, color, tipografía

## 1. Principio: solo blanco y negro

El significado no va en el color. Va en cuatro recursos:

| Recurso | Significa |
|---|---|
| **Inversión** (blanco con texto negro) | Lo activo, lo hecho, la acción principal. **Una sola superficie invertida por pantalla** (o por estado). |
| **Peso del trazo** (`stroke`: hairline 1 · rule 2 · frame 3) | Jerarquía y rango. |
| **Trama** (rayado a 45°, `Card alerta`, `TarjetaArena trama`, `Tag tone="alerta"`) | Alerta, penalización, bloqueado, peligro. Sustituye al rojo. |
| **Grano** (puntos finos, `Card logro`, `TarjetaArena grano`, `Tag tone="logro"`) | Logro, racha, Élite. Sustituye al oro. El texto nunca va encima de la textura. |

Reglas: una idea en blanco sólido por pantalla; lo importante del día a ≤ 2 toques; toda celebración se salta con un toque y respeta «reducir movimiento».

## 2. Color (`ink` de `src/design/tokens.ts`; no hay ink5 ni ink7)

| Token | Hex | Uso |
|---|---|---|
| `ink0` | #000000 | Fondo de la app |
| `ink1` | #0B0B0B | Superficie: tarjetas, hojas |
| `ink2` | #161616 | Superficie elevada, campo de texto |
| `ink3` | #242424 | Hairline, separadores (nunca texto) |
| `ink4` | #3A3A3A | Pista de barras, borde de control (nunca texto) |
| `ink6` | #8C8C8C | Texto terciario: metadatos, fechas, rótulos; también trama y grano |
| `ink8` | #BDBDBD | Texto secundario |
| `ink9` | #EDEDED | Texto principal |
| `ink10` | #FFFFFF | La inversión: CTA, lo activo, el número de nivel |

- Importa `ink` de `@/design/tokens`. `colors.*` de `theme.ts` sigue existiendo solo como mapa de compatibilidad: `red`, `gold`, `steel` valen grises o blanco; decir «alerta» o «logro» es trama o grano, no ese nombre.
- Prohibido: hex sueltos en pantallas, opacidad para texto (rompe el contraste), cualquier color fuera de la escala. Excepción: logotipos de terceros (Apple, Google) en botones de tienda.
- Sobre la inversión, el texto va en ink0 o ink3 (ink6 sobre blanco no llega a AA).
- Ya no existen: rojo #D8414F, oro #D6B76A, acero, el violeta de Franky. El manual de marca los guarda como **«acentos opcionales no aprobados»**; no se usan en ninguna pieza. `EliteBadge` es un laurel blanco.
- Fuera de la app, la marca usa además hueso #E9E3D5 (escudo y logotipo) y hierro #5E5E5E (filete del escudo, barra del logotipo). Ninguno de los dos es color de interfaz ni de texto.

## 3. Tipografía (`type` de `tokens.ts`)

| Estilo | Familia | Tamaño/interlínea | Tracking | Uso |
|---|---|---|---|---|
| `monumento` / `monumentoSm` | Cinzel 700 | 112/112 · 72/72 | 0 | Nivel del Hero (3 cifras en hueco < 360 → Sm) |
| `display` | Cinzel 700 | 56/60 | 2 | Ceremonia, marca |
| `rank` | Cinzel 700 | 32/36 | 4 | **Título de pantalla** (`EncabezadoArena`), letra de rango |
| `title` | Outfit 700 | 30/34 | -0,6 | Título grande en Outfit (hojas, pasos, paywall) |
| `headline` | Outfit 700 | 20/26 | -0,2 | Título de tarjeta u hoja |
| `body` | Outfit 500 | 16/24 | 0 | Lectura |
| `bodySm` | Outfit 500 | 14/20 | 0 | Detalle de fila. **Mínimo de lectura** |
| `label` | Outfit 700 | 12/16 | 2, MAYÚSCULAS | Rótulo de sección (eyebrow) |
| `inscripcion` | Cinzel 700 | 14/18 | 4, MAYÚSCULAS | Lo grabado: «RANGO A · HÉROE DE LA ARENA», sellos |
| `cifra` | Cinzel 600 | 32/36 | 0 | Números de una franja |
| `number` | Cinzel 600 | 24/28 | 0 | Cifras en Stat |
| `micro` | Outfit 600 | 11/14 | 1 | Etiquetas (`Tag`). Mínimo absoluto |

- **Títulos en Cinzel** mayúscula; **Outfit para todo lo que se lee**. Cinzel solo en mayúsculas o cifras, nunca en párrafos. Las cifras siempre en Cinzel 600.
- Lectura ≥ 14; nada < 11. Botones: Outfit 700 mayúsculas 15/2,5 · 14/2 · 12/1,5 (lg · md · sm), la única excepción a la escala.
- `label` (Outfit) para secciones de interfaz, `inscripcion` (Cinzel) para lo grabado; nunca los dos en el mismo bloque.
- Cifra vacía: `SIN_DATO` («-», en `@/components/ui/sinDato`, con `LEIDO_SIN_DATO` para el lector) o `CIFRA_VACIA` de `@/components/arena`. Miles con `formatoMiles` (1.840), no `toLocaleString`.

## 4. Espacio y forma

Base 4 (`space`: 4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 56 · 80). Margen lateral 20 / 32 / 48 (compact < 600 · medium 600 a 1023 · expanded ≥ 1024). Radio 0 en todo salvo avatar, `Check` y pastilla de chip. Sin sombras ni degradados (la profundidad es el `zocalo`). Verificar a 375, 430, 744, 1024 y 1440. `Sheet` se centra a 560 en medium y expanded.

## 5. El kit

**Arena** (`@/components/arena`, no desde `@/components/ui`): `EncabezadoArena` (título de pantalla en Cinzel `rank`, eyebrow, subtítulo, volver, acción de 44, `meandro` uno por pantalla) · `TarjetaArena` (variantes piedra · contorno · trama · grano · invertida; `remaches`, `zocalo`, `marco` 1 a 3, `rotulo`) · `FranjaCifras` (2 a 4 celdas «rótulo: valor») · `HeroRango` (`hoy` · `perfil`) · `Barra` (progreso, pista ink4) · `Contador` (máx. 4 por pantalla, nunca en filas) · `Entrada` · `ASangre` · `Campo` (inputs: etiqueta, ayuda, error sin rojo; `grande="rank"`) · `CargaArena` · `ErrorSistema` · motivos `Laurel`, `Columna`, `Arena`, `Meandro`, `Galea` (un trazo, ocultos al lector) · `formatoMiles`, `romano`, `ordinal`, `ratioSeguro`.

**Base** (`@/components/ui`): `Screen` (`plain` si gestiona su scroll; `overlay` para lo que flota), `Section` (`tone` default · alerta · logro), `Card` (surface · outline · inverse · alerta · logro), `Row` + `Check`, `Chip`/`Tag`, `Button` (primary = la inversión · secondary · ghost · danger con trama), `Interruptor`, `Sheet`, `Avatar` + `Crown` (marco y corona por rango, §7 de SISTEMA), `Toast`, `Ceremony`, `EmptyState`, `Skeleton`, `avisar`/`confirmar`, `useAnunciar`.

**En desuso** (`@deprecated` + aviso de `no-restricted-imports`):

| Viejo | Usa |
|---|---|
| `ScreenHeader` | `EncabezadoArena` |
| `FadeIn` / `Stagger` | `Entrada` |
| `Stat` / `StatRow` | `FranjaCifras` |
| `XPBar` | `Barra` |
| `SystemButton` | `Button` |
| `SystemWindow` (borrado) | `Section` + `TarjetaArena` |
| `Card` con `accent` o `raised`/`tinted` | `TarjetaArena` |
| `Hexagon` y el Avatar viejo (borrados) | `Avatar` del kit (`useRetrato` en `ui/useRetrato.ts`) |
| `Modal` suelto | `Sheet` |
| `TextInput` a mano | `Campo` (salvo celdas compactas de tabla y el compositor del coach) |

Excepción a propósito: las puertas de salud e IA (`ScreenHeader inscrito`, `SystemButton`, `HojaPuerta`) porque las pruebas de Seguridad simulan esos módulos.

Excepciones deliberadas de la arena: títulos de pantalla en Cinzel; grano ink3 de fondo en los Hero (decoración, no «logro»); la inversión puede ser una fila («lo activo»: la siguiente misión, mi fila del ranking).

## 6. Patrón de pantalla

**Una pantalla = `useX()` + `XVista` + `demo.tsx`.**
- `useX` lleva los efectos (Supabase, cerrojos, guardas, `celebrar()`), movidos sin reescribir.
- `XVista` es pura: recibe datos y acciones; importa módulos con efectos solo con `import type`. Lo que lee un contexto entra como hueco `ReactNode`.
- La ruta de `src/app` queda en ~30 líneas con sus hojas debajo.
- `demo.tsx` rellena `DEMO` con los estados (vacío, lleno, cargando, error, hojas). Galería solo en desarrollo: `/kit/pantallas?pantalla=<id>&estado=<e>&ancho=<w>&quieto=1&solo=1`.

Estados:
- Cargando: `CargaArena` con la forma final (`franja`, `rotulo`, `tarjeta`, `filas`). Nunca spinner suelto ni vacío antes de tiempo.
- Error de carga: `ErrorSistema` (rótulo **«El sistema no responde»**, `mensajeSistema(e)`, «Reintentar» secondary; no gasta la inversión).
- Fallo de una acción: `avisar('El sistema no responde', mensajeSistema(e))` o el error en línea de la hoja. Ningún `e.message` llega al usuario.
- Vacío: `EmptyState` (icono, frase en voz del sistema, una acción). Bloqueado: trama + candado + razón. Hecho: Check blanco y texto ink6 tachado.

Formularios en `Sheet` (asa, eyebrow, título, contenido con scroll, pie fijo con la acción). Una inversión por estado; lo demás secondary, ghost o danger.

## 7. Movimiento y vibraciones

`motion`: instant 100 · quick 180 · base 260 · slow 420 · ceremony 1600 · escalon 55. `Entrada` (fundido 260, subida 14) **solo en los bloques 0 a 7** de una pantalla o los 8 primeros de una lista; nunca `layout` de Reanimated, nunca `Entrada`/`Contador` en filas. Todo respeta «reducir movimiento».

Vibraciones: una sola función `vibrar(evento)` (`src/design/haptics.ts`); ninguna pantalla llama a expo-haptics a mano.

| Gesto | Vibración | Movimiento |
|---|---|---|
| Elegir chip, pestaña, día o paso | `seleccion` (ya dentro de Chip, Interruptor y pestañas) | ninguno |
| Marcar un elemento | `seleccion` | rebote del Check 180 ms (nada con reducir movimiento) |
| Guardar con XP o firmar | `mision` (`misionExtra` con foto o bonus); nada si abre ceremonia | Contador o Barra en la cifra que cambia |
| Guardar sin XP | ninguna | cierre de la hoja |
| Borrado confirmado | `destructiva` justo tras `confirmar` | ninguno |
| Fallo de una acción del usuario | `penalizacion` en el catch de la acción principal (no en cargas) | ninguno |
| Llegar al final de algo que se mira | ninguna | ninguno |
| Entrar en una pantalla | ninguna | `Entrada` bloques 0 a 7, escalón 55 ms |

Además: `diaPerfecto`, `nivel`, `rango`, `rachaHito`, `recuperacion` (los disparan ceremonia y celebraciones). Nunca la notificación de error: el sistema no castiga con el cuerpo.

## 8. Accesibilidad, zona segura y teclado

- Zona táctil ≥ 44 × 44 (`hitSlop` si el glifo es menor).
- `maxFontSizeMultiplier={1.35}` en rótulos y texto; `1` en monumentos y cifras de franja (con `adjustsFontSizeToFit`). Con `fontScale > 1.35`, una columna.
- VoiceOver no lee `accessibilityRole="alert"` ni las regiones vivas en iOS: lo que aparece y hay que oír (errores, avisos) pasa por `useAnunciar(texto)`.
- Pulsación larga siempre con alternativa: `accessibilityActions={[{ name: 'longpress', label: '…' }]}` + `onAccessibilityAction`. Lo decorativo, oculto (`accessibilityElementsHidden`, `importantForAccessibility="no-hide-descendants"`). Grupos (Hero, celdas de franja) con un resumen legible.
- **Un solo mecanismo de teclado por pantalla**: `KeyboardAvoidingView` o `automaticallyAdjustKeyboardInsets`, nunca los dos. `Sheet` ya lo hace: dentro, sin KAV propio. Un KAV dentro de `Screen plain` lleva `keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}` (el padre empieza bajo la zona segura; ver `CoachVista`, `DiarioVista`).
- Zona segura real con `useSafeAreaInsets`; pie fijo fuera del ScrollView para la acción principal en flujos por pasos.

## 9. Logo

El emblema es **el escudo con la N** (contorno hueso, filete interior de hierro, N de Cinzel); el logotipo es «NIVL» en Cinzel 700 espaciada con barra de hierro. Versiones: horizontal (principal), vertical, escudo solo (icono, avatar, favicon), logotipo solo (plantillas de compartir con `nivl.app` abajo). Solo hueso, hierro y negro; positivo, negativo y monocromo. Área de respeto x = H/4. Mínimos en pantalla: escudo 24 px de alto, horizontal 32, vertical 64, logotipo solo 80 de ancho, avatar 110, icono iOS 29 pt. Nunca estirar, girar, recolorear, sombrear, perfilar ni recomponer. Archivos en `branding/fuentes/logo/`. Para todo lo demás, el manual de marca.

## 10. Voz del sistema y vocabulario

- Español, tú, presente, frases cortas, dramatismo sobrio. El sistema constata, no suplica: «Tus misiones de hoy están listas. La primera es la que cuesta.» La calidez solo en momentos ganados (nivel, rango, racha hito).
- Sin exclamaciones dobles, sin emojis en la interfaz, sin mayúsculas para gritar, sin prometer resultados, sin culpar al volver.
- **Nunca guion largo ni guion medio** (U+2014, U+2013) en ningún texto visible (rangos con «a»: «6 A 12 OCT»; el servidor lo filtra además en la IA).
- XP que el servidor puede recortar (topes, multiplicadores, racha): **«hasta +N XP»**; la cifra exacta solo cuando la devuelve el servidor (Toast, ceremonia).
- Vocabulario fijo: gladiador (usuario), misiones (no «tareas»), campañas (no «mazmorras»; en rutas y herramientas del coach siguen `mazmorras`/`dungeon`), ludus (no «escuadra»), cierre (medianoche), racha, evidencia, penalización, arena. **Nunca** «cazador», «mazmorra», «Solo Leveling», «despertar como jugador».
- La cuenta es de Franky: «tu cuenta de Franky».

## 11. Perfiles de uso (`src/lib/kinds.ts`)

El perfil (`profiles.profile_kind`: emprendedor · trabajador (profesional) · deportista · estudiante · general) NO oculta nada: ordena. En Hoy van delante sus módulos (`modulesFor(kind).primary`) y el resto bajo «Más». Las campañas se llaman como diga `kindMeta(kind).campaignsLabel` (Proyectos, Objetivos, Bloques, Asignaturas, Campañas) con `campaignsHint`. La cabecera de perfil usa `kindMeta(kind).title`. Un módulo nuevo va en `MODULES` y se decide en qué perfiles va delante. El coach tiene la copia en `supabase/functions/_shared/kinds.ts`: si tocas uno, toca el otro.

## 12. Checklist antes de dar por buena una UI

1. Solo `ink` (sin hex ni opacidad en texto) y `type`; títulos Cinzel, lectura Outfit ≥ 14.
2. Una inversión por estado; alerta con trama, logro con grano.
3. Kit arena y nada de lo que está en desuso; formularios en `Sheet` con `Campo`.
4. `useX` + `XVista` + `demo.tsx`, con todos los estados en la galería a 375, 744, 1024 y 1440.
5. Cargando con `CargaArena`, error con `ErrorSistema`, vacío con `EmptyState`.
6. Vibraciones según la tabla; `Entrada` solo en bloques 0 a 7.
7. 44 pt, `maxFontSizeMultiplier`, `useAnunciar`, `accessibilityActions` en pulsación larga, un solo mecanismo de teclado.
8. Copy en voz del sistema, sin guion largo ni medio, vocabulario de gladiador, «hasta +N XP» si el servidor puede recortar, cifra vacía «-».
9. Tiene sentido para los cinco perfiles.
10. `npx tsc --noEmit`, `npx eslint src --quiet`, `CI=true npx jest --ci`, `npx expo export --platform ios` (y web si tocas base o animación); `rg -n "[\x{2014}\x{2013}]"` sobre tus archivos.
