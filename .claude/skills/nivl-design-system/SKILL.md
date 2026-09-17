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

## Componentes canónicos (reusar, no reinventar)

- `SystemWindow` (src/components/SystemWindow.tsx): TODO panel va dentro de una. Por defecto es un marco recto de 1px (cut=0). El corte diagonal (`cut={14}`) queda reservado a momentos épicos (level-up, botín). Props color/fill para variantes (roja = alerta, acero = campaña).
- `Hexagon`: avatares y emblemas. `XPBar`: toda barra de progreso (altura 6-8). `SystemButton`: botones (solid blanco / outline / danger). `QuestItem`: filas de misión.
- Esquinas rectas en todo (borderRadius 0 salvo avatar circular). Bordes 1px. Sin sombras difusas ni degradados: la jerarquía se hace con el gris, no con blur.

## Perfiles de uso (`src/lib/kinds.ts`)

El perfil (`profiles.profile_kind`: emprendedor · deportista · estudiante · general) NO oculta nada: ordena. En Hoy van delante sus módulos (`modulesFor`) y el resto bajo "MÁS". Las campañas se llaman como diga `kindMeta(kind).campaignsLabel` (Proyectos, Bloques, Asignaturas, Campañas). La cabecera de perfil dice `kindMeta(kind).title` (EMPRENDEDOR · RANGO C). Si añades un módulo, añádelo a `MODULES` y decide en qué perfiles va delante. El coach recibe el mismo perfil desde `supabase/functions/_shared/kinds.ts` (duplicado a propósito; si tocas uno, toca el otro).

## Layout

Pantallas: SafeAreaView edges top → ScrollView padding 16, paddingBottom 32. Ventanas apiladas (SystemWindow trae marginBottom 12). Header de pantalla: título Outfit 700 espaciado o marca NIVL (Cinzel) + dato contextual a la derecha.

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
