---
name: nivl-design-system
description: Use when building or modifying ANY UI in NIVL (screens, components, animations, system copy) — encodes the Solo Leveling-inspired visual language, exact palette, typography, SystemWindow patterns, motion rules and the voice of "el sistema". Trigger on any edit under src/app or src/components, new screens, visual polish, or copy shown to the user.
---

# NIVL design system — "la ventana del sistema"

Todo lo visible en NIVL debe sentirse como la UI del sistema de Solo Leveling: ventanas técnicas flotando sobre oscuridad, azul cazador, tipografía angular. Inspiración sí, assets/nombres del anime no (copyright).

## Paleta (única fuente: `src/lib/theme.ts` — importa SIEMPRE de ahí, nunca hex sueltos)

| Token | Hex | Uso |
|---|---|---|
| bg | #060B16 | fondo de toda pantalla |
| panel | #0A1322 | relleno de ventanas |
| cyan | #37C8F0 | acento principal: nivel, XP, CTAs, activo |
| cyanDim | #1E6E96 | bordes de ventana estándar |
| cyanFaint | #11304A | fills sutiles (checkbox done, KPI) |
| cyanText | #8FD9F2 | texto acento secundario |
| purple/purpleDim | #8A76E8/#5A48B8 | SOLO mazmorras/proyectos |
| red/redDim/redPanel | #FF5C6B/#A8333F/#170D14 | SOLO alertas y penalización |
| amber | #FFB02E | SOLO rachas (llama) |
| text/textDim/textFaint | #EAF5FF/#7A8CA6/#56698A | jerarquía de texto |
| line, track | #14233A/#13233B | separadores, pistas de barras |

Regla de color: cian es el idioma; púrpura, rojo y ámbar son palabras reservadas con un solo significado cada una. No introducir colores nuevos sin añadirlos a theme.ts.

## Tipografía (de `theme.ts → fonts`)

- `brand` Orbitron 800: SOLO marca NIVL, números de nivel y momentos épicos. Nunca en párrafos.
- `number` Orbitron 700: cifras destacadas (KPIs).
- `heading` Rajdhani 700 + letterSpacing 1.5–4 + MAYÚSCULAS: títulos de ventana ("MISIONES DE HOY").
- `semibold` Rajdhani 600: texto principal de items.
- `body` Rajdhani 500: secundario/hints.
- Mínimos: 11px; texto de lectura ≥13px.

## Componentes canónicos (reusar, no reinventar)

- `SystemWindow` (src/components/SystemWindow.tsx): TODO panel va dentro de una. Esquinas cortadas (cut 14) vía SVG. Props color/fill para variantes (roja = alerta, púrpura = mazmorra).
- `Hexagon`: avatares y emblemas. `XPBar`: toda barra de progreso (altura 6-8). `SystemButton`: botones (solid cian / outline / danger). `QuestItem`: filas de misión.
- Esquinas rectas en todo lo demás (borderRadius 0 salvo avatar circular). Bordes 1–1.5px. Sin sombras difusas: la "luz" se hace con color, no con blur.

## Layout

Pantallas: SafeAreaView edges top → ScrollView padding 16, paddingBottom 32. Ventanas apiladas (SystemWindow trae marginBottom 12). Header de pantalla: título Rajdhani 700 espaciado o marca NIVL + dato contextual a la derecha.

## La voz del sistema (copy)

- Español, segunda persona, frases cortas, dramatismo sobrio de IA imperial: "El sistema ha aplicado −38 XP." / "El sistema está satisfecho."
- El sistema nunca suplica ni usa signos de exclamación dobles; constata. La calidez se permite solo en momentos ganados (level-up, racha hito).
- Términos fijos: misiones (no "tareas" en UI de hábitos), mazmorras (proyectos), cazador (usuario), cierre (medianoche), evidencia, penalización, racha.
- Sin emojis en la UI; iconos Ionicons/MaterialCommunityIcons outline.

## Motion y juice

- Animated/Reanimated, 150–300ms, spring para entradas (LevelUpOverlay como referencia).
- Todo logro visible tiene par háptico: éxito → `Haptics.notificationAsync(Success)`; level-up → impacto fuerte.
- Nunca bloquear el gesto del usuario por una animación; las celebraciones se pueden saltar con un tap.

## Checklist antes de dar por buena una UI

1. ¿Colores y fuentes importados de theme.ts? 2. ¿Paneles en SystemWindow? 3. ¿Copy con la voz del sistema? 4. ¿Funciona con textos largos (numberOfLines/minWidth 0)? 5. ¿Estados vacío/cargando/error definidos? 6. `npm run typecheck` limpio.
