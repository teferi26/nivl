# Integración 1.1 y rediseño Ónix: informe

Rama `claude/integracion-1-1-90cd1f`. Nada está subido, aplicado ni desplegado.

## Qué está integrado

UIScene (Xcode 27), cobro por modos con Haiku 5.5, pausa del coach, primer uso, adaptativo web, WORK, IRON, Watch, FOCUS y gafas Meta. Sin fusionar: **TV** (`claude/tv-datos-reales-a490b3`), que sigue en obras; sus migraciones 0125 a 0128 pueden cambiar.

## Migraciones pendientes, por orden

0105, 0106, 0107, 0108, 0109 (IRON) · 0110, 0111 (Watch, renumeradas: antes 0100 y 0101) · 0112 (FOCUS) · 0115 a 0118 (WORK) · 0135 (pausa) · 0136 (un solo modelo) · 0140 (cobro) · **0113 (FOCUS), al final y solo después de que la OTA esté adoptada**.

```bash
node scripts/apply-migrations.mjs --hasta=0112
```

Dos arreglos sobre migraciones sin aplicar:

- La 0108 reescribe `export_my_data` y el borrado de salud: las de Watch van después para no perder `salud_diaria`.
- La 0113 y la 0117 reescribían `link` y `health_row` con listas fijas: ahora valen en cualquier orden y conservan `trabajo` y `estudio`.

**Decisión del dueño antes de aplicar:** la 0111 obliga a todas las personas a volver a aceptar el permiso de salud.

## Orden de salida

Migraciones → funciones (`coach`, `prevision`, `ritual`, `revenuecat-webhook`) → productos en tiendas → binario → OTA → 0113.

**Hace falta binario nuevo:** `expo-calendar`, `react-native-maps`, `expo-keep-awake`, HealthKit, ubicación en segundo plano, targets de Watch, UIScene. Sube `version` en `app.json` y regenera el lockfile con npm 10.9.2 si cambia alguna dependencia. Playfair Display por sí sola no pedía binario.

## Verificación

`npm run typecheck`, `npm test` (6562), `npm run lint` (0 errores), `npx expo export --platform ios` y `deno check` de `coach`, `prevision` y `ritual`.

Capturas fuera del repo, en la carpeta de notas de la sesión (`capturas-onix/`, a 390 y 1440 px), con datos de demo. Los pasos con sesión del onboarding se recorrieron de verdad contra un servidor falso local.

**No verificado:** simulador iOS, dispositivo real, Supabase real, compra real, correo real, VoiceOver y la entrega Watch a iPhone (exige reloj). La suite Deno completa no llegó a correr en este entorno (solo `deno check`).

## La entrada, en orden

`/empezar` (portada con aviso de salud y edad, cuestionario, «Voy a ser crudo contigo», curva) → cuenta (correo, contraseña, casilla) → confirmación de correo → edad y medición → nombre → modos → permiso de salud si hace falta → misiones → plan de 90 días → oferta → Hoy. La firma pasa a `/firma` y se ofrece en Hoy cuando ya se ha hecho algo.

Las respuestas viven solo en el teléfono hasta que hay cuenta. Una meta de salud sin permiso no se guarda. El detalle del cuestionario va en la clave `reason` de `onboarding_goal`, sin migración nueva.

## Para decidir (dueño)

1. Copys de la maqueta que se han suavizado por no poder cumplirlos: «en 2 minutos» (el recorrido real llega a 24 pantallas), «Otra persona» en el día 90, «Preparando a tu coach» y «Para eso estoy yo».
2. El plan de 90 días llega tras el correo. Se puede adelantar a antes de la cuenta: la maqueta lo pone después.
3. Quien rechaza salud y es deportista empieza sin misiones (6 de 6 piden permiso). Ahora la acción principal es revisar el permiso.
4. La letra de compra traducida necesita revisión legal por idioma.
5. La cara «ya tienes plan» de `/pro`, `copyUpsell` y parte del catálogo de oferta siguen con Pro y Élite o solo en español.
6. Nota de IRON sobre la cabecera y FOUNDER: cifras reales (hechas, racha, XP) en lugar de las inventadas en la maqueta.

## Pendiente

- Skill `nivl-design-system` (no se puede escribir desde aquí): sustituir paleta, tipos (Playfair y Outfit, sin Cinzel), «esquinas rectas», `SystemWindow` y el vocabulario por Ónix, según `docs/design-v2/SISTEMA.md`.
- **Watch y TV (SwiftUI)**: llevar fondo #09090B, botón hueso #EDEAE3, oro #C9A961 en cifras y detalles, cifras en Playfair y radios de 22, con el mismo orden que Hoy (héroe, coach, ahora, tres cifras).
- FOCUS en escritorio va en una columna: al fusionar se perdió `DosColumnas`.
- Auditoría UX: hallazgos altos corregidos. Sin aplicar: rotular el veredicto como «Tu punto de partida» (se deja «El veredicto», pedido en la maqueta) y ocultar el código de creador salvo enlace (es dato protegido).
