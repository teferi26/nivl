---
name: nivl-design-system
description: Use when building or modifying ANY UI in NIVL (screens, components, animations, system copy) — encodes the "arena" monochrome visual language (black, bone white, iron grey, one drop of blood red, laurel gold), exact palette and typography from theme.ts, SystemWindow patterns, motion rules, the voice of "el sistema", and the per-profile (emprendedor/deportista/estudiante/general) rules. Trigger on any edit under src/app or src/components, new screens, visual polish, or copy shown to the user.
---

# NIVL design system — "la arena"

NIVL es la app de hábitos de la gente de Franky: un gladiador que quiere ser un 1 % mejor cada día. Todo lo visible debe sentirse como piedra tallada sobre negro: marcos de un píxel, blanco hueso, hierro, y color solo cuando significa algo. Nada de neón, nada de azul cazador, nada de Solo Leveling.

## Paleta (única fuente: `src/lib/theme.ts` — importa SIEMPRE de ahí, nunca hex sueltos)

| Token | Hex | Uso |
|---|---|---|
| bg / panel / panelDeep | #050505 / #0D0D0D / #090909 | fondo de pantalla, relleno de ventana, relleno hundido |
| accent | #FFFFFF | el idioma: nivel, XP, CTAs, activo, iconos de módulo |
| accentDim | #5A5A5A | bordes de ventana estándar (hierro) |
| accentFaint | #191919 | fills sutiles (checkbox done, KPI, chip activo) |
| accentText | #CFCBC2 | texto acento secundario, enlaces |
| steel / steelDim / steelPanel / steelText | #B9B9B9 / #454545 / #0B0B0B / #D8D8D8 | SOLO campañas (proyectos) |
| red / redDim / redPanel / redText | #D8414F / #6B242B / #140A0B / #E8C9CD | SOLO alertas y penalización |
| gold / goldDim | #D6B76A / #4A3E1E | SOLO rachas y hitos (el laurel) |
| text / textDim / textFaint | #ECE9E2 / #A5A29A / #7A776F | jerarquía de texto |
| line, track | #262626 / #1C1C1C | separadores, pistas de barras |
| franky | #8B5CF6 | SOLO la marca "by Franky" y el botón de cuenta Franky. Nunca como color de interfaz |

Regla de color: el blanco es el idioma; acero, rojo y oro son palabras reservadas con un solo significado cada una. No introducir colores nuevos sin añadirlos a theme.ts. Un botón sólido es blanco con texto negro.

## Tipografía (de `theme.ts → fonts`)

- `brand` Cinzel 700: SOLO marca NIVL, letra de rango y momentos épicos. Nunca en párrafos. Cinzel no tiene minúsculas: úsala en mayúsculas.
- `number` Cinzel 600: cifras destacadas (nivel, KPIs).
- `heading` Outfit 700 + letterSpacing 1.5–4 + MAYÚSCULAS: títulos de ventana ("MISIONES DE HOY"). Outfit es la familia de Franky: la app y la web se sienten el mismo producto.
- `semibold` Outfit 600: texto principal de items.
- `body` Outfit 500: secundario/hints.
- Mínimos: 11px; texto de lectura ≥13px.

## El kit (`src/components/ui`, importa desde `@/components/ui`)

La pantalla es editorial: cabecera grande, secciones con rótulo pequeño y SIN caja, y tarjetas solo para lo que es una unidad (una misión, una campaña, un aviso). Referencias hechas: `src/app/(tabs)/index.tsx` (Hoy), `habitos.tsx`, `mazmorras.tsx`, `coach.tsx`.

- `Screen` — SafeArea + ScrollView con padding 20 y pull-to-refresh (`refreshing`, `onRefresh`). `plain` para pantallas que gestionan su propio scroll (chat).
- `ScreenHeader` — `eyebrow` (rótulo pequeño: fecha, sección), `title` (Outfit 30, tracking negativo; `compact` para 22), `subtitle` (una línea de contexto), `action` ({icon,label,onPress,solid}) o `right` (un anillo, una cifra), `onBack` en pantallas fuera de las pestañas.
- `Section` — `title` (eyebrow), `meta` ("2/6"), `action` ({label,onPress}), `tone` (dim|accent|gold|red|steel). Debajo, el contenido sin caja. `Rule` para un separador fino.
- `Card` — `variant` raised (superficie #0D0D0D sin borde, lo normal) | outline (marco, para avisos y vacíos) | tinted (activo/hecho). `accent` pinta una barra izquierda de 2 px (rojo alerta, oro hito). `onPress` la hace pulsable con encogido. `padded={false}` + `style={{paddingHorizontal:16, paddingVertical:2}}` para listas de `Row`.
- `Row` + `Check` + `RowValue` — la fila de lista: `leading` (un `Check` redondo de 26, un icono, una letra), `title`, `detail` (texto o nodo), `trailing` (`RowValue` con tono), `done` (tachado), `muted`, `first` (sin línea superior), `chevron`, `onPress`/`onLongPress`.
- `Chip`, `ChipRow` (desplazable, sangra el padding), `ChipWrap` (envuelve), `Tag` (etiqueta de estado sin interacción: PENALIZACIÓN, JEFE, HOY).
- `Stat` + `StatRow` — cifras en Cinzel con rótulo: `value`, `label`, `unit`, `size` sm|md|lg, `tone`.
- `ProgressRing` — anillo SVG animado: `ratio`, `size`, `label`, `sublabel`.
- `EmptyState` — icono suelto + título + frase + `action`. `compact` dentro de una Card outline.
- `Skeleton` / `SkeletonRows` — el estado de carga: bloques de `panel` que respiran (0,4↔0,8) y respetan "reducir movimiento". Sustituyen al spinner suelto y al estado vacío pintado antes de tiempo. Dentro de un contenedor con `accessibilityRole="progressbar"`.
- `Screen overlay={…}` — lo que flota sobre la pantalla (el aviso de XP) va aquí, nunca dentro del scroll.
- `CompletarSheet` (`src/components`) — la hoja inferior de completar misión; patrón para cualquier elección de 2–3 opciones en vez de `Alert.alert`.
- `FadeIn` / `Stagger` / `PressScale` — entrada al montar con `index` para la cascada; envuelve cada bloque de una pantalla en `<FadeIn index={i}>` dentro de un `<Stagger>`.
- `SystemButton` — `variant` solid (blanco, UNA por pantalla) | outline | ghost | danger; `size` sm|md|lg; `icon`.
- `XPBar` — barra animada; `segments` para marcar tramos (los 21 días de un hábito).
- `TabBar` — la barra de pestañas propia (línea blanca arriba en la activa).
- `SystemWindow` sigue existiendo para compatibilidad, pero en pantallas nuevas o rediseñadas NO se usa: sustituir por `Section` + `Card`.
- `Hexagon` para avatares y emblemas. Esquinas rectas en todo (borderRadius 0 salvo `Check`, avatar y el emblema del coach). Sin sombras difusas ni degradados.

### Anatomía de una pantalla rediseñada

```tsx
<Screen refreshing={r} onRefresh={load}>
  <Stagger>
    <FadeIn index={0}><ScreenHeader eyebrow="Cuerpo" title="Gimnasio" subtitle="Hoy toca empuje." action={{icon:'add',label:'Nueva sesión',onPress,solid:true}} /></FadeIn>
    <FadeIn index={1}><Card><StatRow><Stat value={3} label="Sesiones" /><Stat value="72,5" unit="kg" label="Banca 1RM" /></StatRow></Card></FadeIn>
    <FadeIn index={2}><Section title="Rutina de hoy" meta="4 ejercicios"><Card padded={false} style={{paddingHorizontal:16,paddingVertical:2}}>{items.map((it,i)=><Row key={it.id} first={i===0} leading={<Check checked={it.done}/>} title={it.name} detail="3×8" trailing={<RowValue>72,5 kg</RowValue>} onPress={...}/>)}</Card></Section></FadeIn>
    <FadeIn index={3}><Section title="Historial"><EmptyState compact icon="barbell-outline" title="Sin sesiones aún" body="..." /></Section></FadeIn>
  </Stagger>
</Screen>
```

Reglas: una acción sólida por pantalla; los formularios en hoja inferior (`Modal` + `sheet` como en `mazmorras.tsx`) con `sheetHandle`, eyebrow, título grande y chips; los inputs con borde `accentDim` sobre `bg`; los estados vacío/cargando/error SIEMPRE definidos; textos largos con `numberOfLines`/`minWidth: 0`.

## Perfiles de uso (`src/lib/kinds.ts`)

El perfil (`profiles.profile_kind`: emprendedor · deportista · estudiante · general) NO oculta nada: ordena. En Hoy van delante sus módulos (`modulesFor`) y el resto bajo "MÁS". Las campañas se llaman como diga `kindMeta(kind).campaignsLabel` (Proyectos, Bloques, Asignaturas, Campañas). La cabecera de perfil dice `kindMeta(kind).title` (EMPRENDEDOR · RANGO C). Si añades un módulo, añádelo a `MODULES` y decide en qué perfiles va delante. El coach recibe el mismo perfil desde `supabase/functions/_shared/kinds.ts` (duplicado a propósito; si tocas uno, toca el otro).

## Layout

Pantallas: `Screen` (padding horizontal 20, inferior 40) → `ScreenHeader` → secciones (`Section`, margen inferior 26) con sus tarjetas (`Card`, margen inferior 10). Cabecera: eyebrow + título grande + subtítulo, acción a la derecha. Nada de títulos en mayúsculas espaciadas como cabecera de pantalla: eso es solo para eyebrows y rótulos de sección.

## La voz del sistema (copy)

- Español, segunda persona, frases cortas, dramatismo sobrio: "El sistema ha aplicado −38 XP." / "El sistema está satisfecho."
- El sistema nunca suplica ni usa signos de exclamación dobles; constata. La calidez se permite solo en momentos ganados (level-up, racha hito).
- Términos fijos: misiones (no "tareas" en UI de hábitos), campañas (proyectos; en las herramientas del coach y en las rutas siguen llamándose mazmorra/dungeon), gladiador (usuario), cierre (medianoche), evidencia, penalización, racha. Nada de "cazador", "sistema de Solo Leveling", "despertar como jugador".
- Sin emojis en la UI; iconos Ionicons/MaterialCommunityIcons outline.
- La cuenta es de Franky: en pantallas de acceso se dice "tu cuenta de Franky", nunca "tu proyecto de Supabase".

## Motion y juice

- Animated/Reanimated, 150–300ms, spring para entradas (LevelUpOverlay como referencia).
- Todo logro visible tiene par háptico: éxito → `Haptics.notificationAsync(Success)`; level-up → impacto fuerte.
- Nunca bloquear el gesto del usuario por una animación; las celebraciones se pueden saltar con un tap.

## Checklist antes de dar por buena una UI

1. ¿Colores y fuentes importados de theme.ts? 2. ¿Paneles en SystemWindow? 3. ¿Copy con la voz del sistema y sin vocabulario de cazador? 4. ¿Funciona con textos largos (numberOfLines/minWidth 0)? 5. ¿Estados vacío/cargando/error definidos? 6. ¿Tiene sentido para los cuatro perfiles? 7. `npm run typecheck` limpio.
