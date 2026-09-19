# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v54.0.0/ before writing any code.

El proyecto está en **Expo SDK 54** (RN 0.81.5, React 19.1.0). Historial: 56→55→57→**54**. El motivo definitivo es que el Expo Go LIVE en la App Store de iOS es la **54.0.2** (verificado con `itunes.apple.com/lookup?bundleId=host.exp.Exponent`); Apple no ha aprobado versiones más nuevas. **En iOS el techo real es lo que hay LIVE en la App Store, NO lo último que Expo publica** en `api.expo.dev/v2/versions`. Para saberlo: iTunes lookup.

Trampas conocidas del SDK 54: `expo-sharing` no tiene config plugin (fuera de `app.json` plugins, funciona autolinkado). `StyleSheet.absoluteFill` no es spreadable en RN 0.81. Las **rutas tipadas solo se regeneran arrancando Metro** (`npx expo start`), no con `expo export`: si `tsc` falla por una ruta nueva, arranca Metro unos segundos y mátalo.

# NIVL — contexto del proyecto

App de hábitos de la gente de Franky (interfaz en español), gamificada como una arena de gladiador **con un coach de IA dentro que manda en el día del usuario**. Se entra con la cuenta de Franky (puente `supabase/functions/franky-auth`). Cada usuario tiene un **perfil de uso** (emprendedor · profesional (`trabajador`) · deportista · estudiante · general, `src/lib/kinds.ts`) que ordena módulos, hábitos propuestos y el énfasis del coach. El README explica el juego; el código manda.

## Mapa

- Pantallas `src/app/` (expo-router, 6 pestañas) · componentes `src/components/`
- **Motor de juego**: `src/lib/game.ts` (tablas puras) + `src/lib/closing.ts` (cierre puro) + `src/lib/engine.ts` (efectos)
- **Plan del día**: `src/lib/plan.ts` (puro) + `src/lib/dayplan.ts` (datos)
- **Coach**: `src/lib/coach.ts` (cliente) · `supabase/functions/coach/` (el agente) · `supabase/functions/ritual/` (lo que dispara el cron)
- **Cuerpo**: `src/lib/bodymath.ts` (puro) + `src/lib/bodywork.ts` (datos: cardio, nutrición, prescripciones) · `supabase/functions/_shared/analytics.ts` (el estudio que lee el coach) + `_shared/knowledge.ts` (la doctrina de entreno y dieta)
- **Dinero**: `src/lib/moneymath.ts` (puro) + `src/lib/money.ts` (datos) · `supabase/functions/_shared/finance.ts` (el estudio económico) · importadores en `scripts/import-revolut.mjs` (CSV) y `scripts/setup-banco.mjs` (open banking)
- **Avisos**: `src/lib/notifications.ts` + `src/lib/useNotificationRouting.ts`
- **Cuenta Franky**: `src/lib/frankyAuth.ts` (cliente) · `supabase/functions/franky-auth/` (el puente; se despliega con `--no-verify-jwt` y los secrets `FRANKY_SUPABASE_URL`, `FRANKY_SUPABASE_ANON_KEY`, `FRANKY_WEB_URL`). Las reglas de contraseña de `src/lib/validation.ts` son las de Franky (12+, sin composición): si Franky las cambia, cámbialas aquí.
- **Perfiles de uso**: `src/lib/kinds.ts` (puro, con tests) y su copia para el coach en `supabase/functions/_shared/kinds.ts`. Si tocas uno, toca el otro. Un perfil nuevo pide además migración del CHECK `profiles_profile_kind_check` (ver 0022).
- **NIVL Pro** (gratis = todo sin IA; Pro = el coach; `docs/PRECIOS.md`): `src/lib/proplans.ts` (puro: planes, precios, copy, energía) + `src/lib/pro.ts` (`fetchAiStatus`, y la capa de compra, hoy sin tienda: `purchasesAvailable()` devuelve false hasta cablear RevenueCat) · pantalla `src/app/pro.tsx` y pieza compartida `src/components/ProOffer.tsx` (también último paso del onboarding). El candado es del servidor (0020): la función `coach` responde 402/429 y `src/lib/coach.ts` lo lanza como `CoachAccessError` con `reason`; ninguna pantalla lo enseña como error. `subscription.ts` (Stripe, `EXPO_PUBLIC_PAYWALL`) queda solo para el Oráculo y la web.
- **La firma del onboarding**: `src/lib/compromiso.ts` (puro) construye el texto y `sealLetter` lo sella como carta; el objetivo escrito va a `events` como `onboarding_goal`.
- SQL en `supabase/migrations/`

**Patrón de arquitectura**: la lógica pura vive en un módulo sin imports de Supabase, y los efectos en otro. No es estética — importar `supabase` arrastra AsyncStorage y los tests de ese módulo dejan de arrancar.

## Patrones de interfaz que ya existen (úsalos, no los reinventes)

- **Cargando = huecos, no spinner ni estado vacío.** `Skeleton` / `SkeletonRows` (`@/components/ui`): un bloque de `panel` que respira y respeta "reducir movimiento". Una pantalla lleva un `loaded` que se pone en el `finally` de su `load`; hasta entonces pinta la cabecera y huecos, nunca "Nada programado" (referencias: Hoy, Amigos, `/pro`, Coach).
- **Lo que flota va en `<Screen overlay={…}>`**, no dentro del ScrollView: ahí un `position: 'absolute'` se ancla al contenido y con la lista desplazada queda fuera de la vista (era el bug del `XpToast`).
- **Completar una misión = `CompletarSheet`** (`src/components/CompletarSheet.tsx`): una hoja con Completar / Con foto / Registrar en {módulo}; siempre dos toques. La hoja solo devuelve la opción: el cerrojo síncrono por misión (`completing` en Hoy) lo toma `onComplete` y lo suelta exactamente una salida. Nada de `Alert.alert` encadenados para elegir.
- **Ningún `e.message` llega al usuario**: `mensajeSistema(e)` (`src/lib/validation.ts`, con tests) devuelve "sin conexión" o el fallo genérico. Un error de negocio ya escrito para el usuario se lanza como `ErrorVisible` y pasa tal cual (`requestFriend`).
- **Pie fijo para la acción principal** en flujos por pasos (onboarding): botón fuera del ScrollView con `borderTopColor: colors.line`. Y un solo mecanismo de teclado por pantalla: `KeyboardAvoidingView` **o** `automaticallyAdjustKeyboardInsets`, nunca los dos (iOS suma el teclado dos veces).
- **`SystemButton` reparte su `style`** con `splitStyle` (`ui/motion.tsx`): márgenes, `alignSelf`, `flex` y ancho van al Pressable; lo visual, a la vista que escala.
- **Hoy no siembra misiones.** `seedDefaultQuests` no se llama al cargar: pisaba el "Empezar sin misiones" del onboarding. La entrada tras login pasa por `/` (`src/app/index.tsx`), que es quien mira `onboarding_done`.
- **NIVL Pro con la tienda cerrada** (`purchasesAvailable() === false`): `ProOffer` enseña precios en lista de solo lectura y NO pinta selector, "Restaurar compras", letra de renovación ni enlaces legales. La pieza está partida en `useProOffer` + `ProOfferBody` / `ProOfferActions` / `ProOfferLegal` para poder poner los botones en un pie fijo.

## Reglas que no se negocian

- **Las migraciones aplicadas nunca se editan**: siempre un archivo nuevo numerado. Se aplican con `node scripts/apply-migrations.mjs` (detecta lo pendiente por huellas). Al añadir una, añade su huella en `HUELLAS` o se intentará aplicar en cada ejecución.
- **La economía solo se mueve por RPC** (`award_xp`, `complete_quest`, `apply_day_close`). El UPDATE directo sobre `xp_total`, `streak_days`, `protection_stones` y `bonus_points` está revocado desde la 0009. Si necesitas tocar puntos, es una RPC nueva, no un update.
- **Ojo con los topes de XP**: una misión de penalización devuelve de golpe lo perdido en toda una ausencia (hasta 150/día). Los límites del esquema son altos a propósito; bajarlos rompe recuperaciones reales.
- Las claves secret/service de Supabase **nunca** entran en el repo. El token de despliegue vive en `supabase-token.txt` (gitignorado).

## Un solo gesto (0019)

**Manda el acto real.** Una misión o una regla lleva un `link` (`gym · cardio · nutricion · peso · diario · ninguno`) que un trigger de Postgres deduce del título (`infer_link`, conservador a propósito). Al registrar la sesión, el cardio, el parte de comidas, el peso o el diario, `src/lib/links.ts → propagarActo` marca sola la misión enlazada, la regla del contrato y el bloque del plan. Si había misión enlazada programada hoy, **paga ella y el módulo no cobra su XP base** (los récords del gym sí): el mismo acto no paga dos veces. El coach tiene su espejo en `_shared/tools.ts` (`propagarActo`, `completarMision`, con las tablas de XP copiadas de `game.ts`: si tocas una, toca la otra). Al añadir un módulo que registre actos, engánchalo aquí en vez de crear otro check.

La **ficha física** (`body_profile`: altura, año, sexo, actividad, experiencia, lesiones, salud, comida, material) la escribe el coach con `fijar_ficha` y la lee en el estado junto al mantenimiento estimado (`mantenimientoKcal`, en `bodymath.ts` con tests y espejo en `context.ts`).

## Herramientas del coach

Las define `supabase/functions/_shared/tools.ts` (hoy son 25). Dos límites de la API que ya nos han mordido:

1. **Sin `strict: true`**: pasando de doce herramientas el compilador de esquemas responde "Schema is too complex". La validación real la hacen los CHECK de Postgres y el ejecutor.
2. **Nada de tipos unión**: `{ type: ['string','null'] }` junto a un `enum` se rechaza, y hay un tope de 16 parámetros con uniones en todo el conjunto. Lo opcional se expresa con **cadena vacía** como centinela (`opt` / `enumOpt`), no con null.

El coach elige **dificultad**, nunca puntos: el XP sale de `game.ts`.

El modelo es **`claude-sonnet-5`** (`COACH_MODEL` en `_shared/anthropic.ts`), por coste medido: con Opus el turno salía a 0,42 $ en frío. No lo subas a Opus sin una razón medida, y no lo bajes a Haiku: con veinte herramientas y 50.000 tokens de contexto es donde se eligen herramientas equivocadas, y aquí eso son cargas de gimnasio y dinero. Si tocas el modelo, añade su tarifa a `PRICE_PER_MTOK` o el freno de gasto contará mal.

**Regla de reparto: si la tarea es leer y transformar, va con `CHEAP_MODEL` (Haiku); si es decidir, con el coach.** Hoy son de Haiku la clasificación de movimientos (`_shared/clasificar.ts`), el titular del push (`ritual/index.ts`) y el Oráculo. Al añadir una tarea mecánica, sácala **antes** de `buildContext`: lo caro no es la tarifa del modelo, es arrastrar 50.000 fichas de dossier y estudios para responder algo que cabe en una línea. Ese es el patrón del atajo `kind: 'clasificar'` en `coach/index.ts`, que va aparte de `KINDS` justo por eso.

## El coach como entrenador y como contable

La IA no hace aritmética con el historial en bruto: `analytics.ts` y `finance.ts` le entregan estudios ya calculados (e1RM por Epley, tendencia de peso por mínimos cuadrados, ritmo por zona, adherencia; y gasto por categoría, cargos recurrentes, ritmo de gasto, meses de aire) y `knowledge.ts` la doctrina para interpretarlos. Regla de oro: **los números son deterministas y la IA solo decide qué hacer con ellos**. Si añades una métrica, va en el módulo con su test en `src/lib/__tests__/`, no en el prompt.

Las fórmulas están duplicadas a propósito entre el lado Deno (`analytics.ts`, `finance.ts`) y el lado Hermes (`bodymath.ts`, `moneymath.ts`): el empaquetado de la Edge Function no sube nada de fuera de `supabase/`. Si tocas una, toca la otra.

Con el dinero hay tres líneas que el coach no cruza, escritas en `knowledge.ts` y que no se relajan: **no da consejo de inversión, no mueve dinero y no entra en fiscalidad concreta**. Informa, mide y avisa; ejecutar es del usuario.

Convención de signo en todo lo económico: **negativo es gasto, positivo es ingreso**, como en el extracto. Los traspasos entre cuentas propias llevan `is_internal` y no cuentan ni como gasto ni como ingreso. Todo movimiento importado lleva `dedup_hash` con índice único: reimportar el mismo extracto veinte veces no duplica ni un cargo.

## Skills del proyecto (`.claude/skills/`)

- **nivl-design-system** — OBLIGATORIA antes de tocar UI o copy: paleta monocroma y tipos (Cinzel + Outfit) desde `theme.ts`, paneles en `SystemWindow`, voz del "sistema", vocabulario (gladiador, campañas; nunca cazador/mazmorras en UI) y reglas por perfil.
- **nivl-game-design** — OBLIGATORIA antes de tocar XP/rachas/penalizaciones o crear mecánicas.
- **nivl-backlog** — para planificar: backlog en `docs/mejoras/`, plan por fases en `docs/ROADMAP.md`.

Agentes (`.claude/agents/`): `nivl-planner`, `nivl-ux-auditor`, `nivl-game-balancer`.

## Cómo sale un cambio: OTA casi siempre, binario solo si hay nativo

**Si el cambio es solo JavaScript/TypeScript o assets, sale por OTA. Gratis, en un minuto, sin build:**

```bash
npx eas-cli update --channel production --platform ios --message "…" --non-interactive
```

Comprobado el 2026-09-19 en el móvil del dueño: llega. Se descarga en un arranque y se aplica en el siguiente (a veces tarda un par de aperturas).

**La regla que lo hace funcionar: NO subas `version` en `app.json` para un cambio de JS.** `runtimeVersion.policy` es `appVersion`, así que una OTA solo llega a los binarios de su MISMA versión. En agosto se concluyó que "las OTA no llegan a este móvil" (commit 4113e44) y se abandonaron; la causa más probable es que cada tanda subía la versión y la OTA se publicaba para un runtime que no tenía ningún binario instalado. La versión solo se sube cuando sale un binario nuevo.

**Hace falta binario nuevo solo si cambia lo nativo:** una dependencia con código nativo (p. ej. RevenueCat), plugins o permisos en `app.json`, el SDK de Expo, iconos o splash. Y entonces, después del binario, las OTA vuelven a publicarse para la versión nueva.

**El binario no se compila en EAS Build** (15 builds de iOS al mes en el plan gratuito; se agotaron). Se compila en GitHub Actions: `.github/workflows/ios-testflight.yml`, a mano desde la pestaña Actions del repo `teferi26/nivl`. Usa `eas build --local` (no gasta cupo) y `eas submit`; necesita el secreto `EXPO_TOKEN`. Mientras el repo sea público los minutos de macOS son ilimitados; en privado cuentan ×10.

Antes de publicar una OTA: la misma verificación mínima de siempre, y si el cambio necesita una migración o un despliegue de Edge Function, eso va PRIMERO — la OTA llega a los móviles en minutos y no espera al servidor.

## El lockfile se genera con npm 10, no con npm 11

EAS Build ejecuta `npm ci`, y `npm ci` exige que el lockfile case exactamente con el resolutor que lo escribió. Con npm 11 (el que trae Node 24) las dependencias entre pares de `@napi-rs/wasm-runtime` quedan anidadas; con npm 10 quedan arriba. EAS corre npm 10 y el build muere en «Install dependencies» con *Missing: @emnapi/core from lock file*, un error que no dice nada del motivo real.

Si tocas dependencias, regenera así:

```bash
npx npm@10.9.2 install --package-lock-only
```

`eas.json` fija `node: 22.14.0` en el perfil `base` y los demás lo heredan con `extends`: la 22 trae npm 10.9 —el que casa con el lockfile— y además cumple el `engines: node>=22` que declara `@supabase/supabase-js`, que con la 20 por defecto de EAS avisaba en cada build.

**`eas.json` no admite claves libres**, ni siquiera `"//"` para comentar: el esquema las rechaza y el build ni siquiera arranca. Los porqués van aquí, no ahí. Tras tocar ese archivo, valídalo sin gastar un build:

```bash
npx eas-cli config --platform ios --profile production
```

## Verificación mínima de todo cambio

`npm run typecheck` · `npm test` · `npm run lint` · `npx expo export --platform ios`

Si tocas Edge Functions: `npx deno check supabase/functions/<nombre>/index.ts` y despliega. Para probar el coach de verdad: `node scripts/smoke-coach.mjs "…"`.
