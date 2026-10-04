# Fase 3 · Auditoría de conversión del onboarding y del paywall

Chat «NIVL - Compras», subagente A. 2026-10-04. Worktree `w2-chat2` (rama `winter2/chat2-monetizacion` @8138747). Objetivo: NIVL 1.0.8 (Expo SDK 54, diseño arena v2 en blanco y negro).

Alcance: texto, orden, momentos y prueba del coach, **sin patrones oscuros** (Apple 3.1.2 y 5.6; política de suscripciones de Google Play). Leído: `AGENTS.md`, `docs/PRECIOS.md`, `docs/payment-audit/{FASE2-PLAN,FASE2-L1,CLIENTE}.md`, `docs/design-v2/L-RADICAL.md` §B.5, `src/lib/{paywallmoment,pro,proplans}.ts`, `src/components/ProOffer.tsx`, `src/app/pro.tsx` y, solo para leer, `src/app/onboarding.tsx`, `src/components/onboarding/pasoOferta.ts` y `src/components/coach/*`.

No se inventan cifras: cada impacto esperado es un razonamiento y lleva al lado la métrica que lo confirmaría o lo tumbaría.

## Reglas anti patrón oscuro (la vara de medir)

| Regla | Qué exige |
|---|---|
| R1 Cierre visible | La salida gratis está a la vista desde el primer fotograma, con contraste y zona de 44. |
| R2 Precio cobrado | El `priceString` de la tienda es la cifra principal. Ningún «≈/mes» de un anual compite con él. |
| R3 Sin urgencias falsas | Sin cuentas atrás, ni «solo hoy», ni escasez inventada. El fundador es escaso de verdad: 100 plazas, oculto cuando se agotan. |
| R4 Sin preselección engañosa | Si hay un plan preseleccionado, el botón dice ese plan con su precio. No hay casillas de prueba activadas por defecto. |
| R5 Salida del mismo peso | «Seguir gratis» tiene el mismo alto que la acción de pago (lg, 52) y no es `ghost`. |
| R6 Veracidad | Solo se promete lo que existe. El modo profundo tiene límite mensual. El ludus se pide y se asigna a mano. La voz va con el coach. La prueba es del servidor: 7 días, 0,50 $, sin modo profundo. No hay oferta introductoria de tienda en 1.0.8. |

## 1. Recorrido real paso a paso

### 1.1 Onboarding: lo común

| Paso | Qué ve | Código |
|---|---|---|
| 0 | Portada «Entrar en la arena». | `onboarding.tsx:749` |
| 1 | Nombre y «¿Quién te trajo?», opcional. Mientras tanto se lee `ai_status` en segundo plano. | `:153-158` |
| 2 | Perfil de uso. | `:533` |
| 3 | Objetivo, con o sin salud. | `:569` |
| 4 | Misiones propuestas. | `:626` |
| 5 | Contrato y firma (mantener pulsado). Después, sello de 1,5 s. | `:662`, `:313` |

Cada paso deja estos rastros:

- Evento `onboarding_goal` (`:239`).
- Evento `commitment_signed` (`:308`).
- Quien ya tiene coach entra directo, sin oferta (`yaEsPro`, `:310`/`:319`).

### 1.2 Paso 6, la oferta tras la firma (`ofrecerSi('firma')`, `onboarding.tsx:409`)

Cabecera, siempre igual: «Firmado. Ahora, quién lo dirige.». Debajo, la pista (`:721`): «Tus hábitos, tu organización y tu progreso son gratis. Los planes de pago añaden el coach de IA y, con Élite, insignia y solicitud de plaza en un ludus.» Cuando es hoja, añade: «Decide ahora o más adelante: el compromiso vale igual.».

| Estado de la cuenta | Tienda abierta (1.0.8 con clave RC) | Tienda cerrada (Expo Go, web o sin clave) |
|---|---|---|
| Gratis y puede empezar la prueba | **Hoja** (`ProOfferBody compact` con `motivo="firma"`). Contexto: «Tu juramento está sellado…». Chips Pro/Élite. Beneficios a dos columnas, avisos de energía y lista de 5 productos con título, duración y `priceString`. **Desde hoy**, también las condiciones de la prueba. Pie: «Probar el coach 7 días» (primary lg), compra directa «Activar NIVL Pro anual · {precio} al año» (ghost sm) y «Seguir gratis por ahora» (secondary lg). Después, Restaurar, letra de renovación y enlaces. | **Antes**: solo una línea `ProUpsellLine` y «Entrar en la arena». La prueba, que no necesita tienda, no se ofrecía. **Ahora**: hoja con la lista de referencia, las condiciones de la prueba, «Probar el coach 7 días» y «Seguir gratis por ahora». Sin Restaurar ni letra de renovación (no hay compra). |
| Gratis, sin prueba (ya la usó) | Hoja con «Activar {plan} · {precio}» como principal y «Seguir gratis por ahora». | Línea más «Entrar en la arena». |
| Firma repetida con los topes gastados | Línea. | Línea. |
| En prueba, Pro, Élite o dueño | No ve el paso: entra tras el sello. | Igual. |
| Sin red, o lectura de más de 4 s | Entra sin oferta (`DECISION_SALTAR`). | Igual. |

### 1.3 Después del onboarding: dónde vuelve a aparecer la oferta

| Superficie | Quién | Estado en el código |
|---|---|---|
| Pestaña Coach sin acceso (`CoachBloqueado.tsx:85`) | Gratis | Línea `coach_cerrado`, fija y sin topes. Si no hay decisión, el botón «Ver NIVL Pro». |
| Energía agotada (`CoachVista.tsx:463`) | Prueba → Pro; Pro → Élite | Línea `energia_agotada`. |
| `primer_dia`, tras cerrar la celebración `logro:first_day` | Gratis | **Sin cablear.** Nadie llama a `ofrecerSi('primer_dia')`. El momento (b) de D1 no existe en la app. |
| `coach_profundo`, junto al selector de potencia | Gratis y Pro → Élite | **Sin cablear.** El selector solo se pinta si el plan incluye el modo profundo (`CoachVista.tsx:479`), así que un Pro nunca ve que existe. |
| `analisis_foto` | Pro → Élite | Sin cablear (prioridad baja). |
| Fin de la prueba | Ex-prueba ya en gratis | **No existía.** Al acabar la prueba, la cuenta pasa a gratis y la pestaña Coach enseña la misma línea genérica que a quien nunca la probó. Momento nuevo `fin_prueba` (ver §3). |
| Hoy, Perfil, Oráculo, Resumen, Informe, Economía | Gratis | `router.push('/pro')` sin motivo, así que la cabecera es genérica. |

### 1.4 La pantalla `/pro`

| Estado | Qué ve |
|---|---|
| Gratis | Cabecera «NIVL Pro / Un coach que manda en tu día.» con el subtítulo de lo gratis. **Ahora**, con motivo, eyebrow y título del momento (B.5 e), y si puede probar: «Pruébalo 7 días, sin tarjeta.». Debajo, `ProOffer` completo: con la tienda abierta, planes arriba y beneficios debajo; con la tienda cerrada, «Avísame cuando abra» y la lista de referencia. Salida: «Seguir gratis». |
| En prueba | «El coach está contigo.». Subtítulo de la prueba (**ahora** dice que no se cobra nada y que no se renueva). Energía en %, «Activo hasta» y «Suscribirme» (secondary), que abre `ProOffer compact` con «Seguir con la prueba». |
| Pro de tienda | Plan, renovación, recarga y «Gestionar o cancelar suscripción». «Ver NIVL Élite» solo si `puedeMejorarEnTienda`. |
| Pro por Stripe o plan heredado | Nota de que se gestiona fuera. Sin oferta de Élite (no hay segundo cobro). |
| Élite o dueño | Su plan y sus turnos profundos. Ninguna oferta. |

## 2. Fricciones encontradas

| # | Fricción | Efecto en la conversión | ¿Patrón oscuro? |
|---|---|---|---|
| F1 | Con la tienda cerrada, la prueba (del servidor) quedaba detrás de una línea en el onboarding. | Se pierde la única conversión posible en esa build, en el momento de más intención (recién firmado). | No, pero se callaba algo gratis y real. |
| F2 | Las condiciones de la prueba («sin tarjeta, sin cobro») solo salían con la tienda abierta. | Sin saber que no hay cobro, el miedo a la tarjeta frena el toque. | Riesgo R6: ofrecer una prueba sin decir qué es. |
| F3 | Mirando Élite, el botón grande decía «Probar el coach 7 días», pero la prueba es de Pro, estándar y sin modo profundo. | Expectativa falsa. Al probar no hay modo profundo: decepción y menos paso a pago. | **Sí, R6/R4**: el contexto visual (Élite) y la acción (prueba Pro) no casaban. |
| F4 | En prueba se ofrecía la firma o el primer día con un copy que vende el coach que ya tiene («El coach puede escribir el plan de mañana»). Igual con fotos y voz. | Ruido. Erosiona la confianza en el sistema. | Copy inexacto (R6). |
| F5 | Al acabar la prueba no había ningún momento propio. | El momento de más intención de una prueba sin renovación automática es su final. Sin él, la conversión depende de que el usuario vuelva a `/pro` por su cuenta. | No. |
| F6 | `energia_agotada.elite` decía «Élite tiene su propio presupuesto mensual», como si diera más energía. Con Sonnet, 2,50 $ de bolsillo estándar compran **menos** turnos que 1,50 $ con DeepSeek (`PRECIOS.md`). | Un Pro que sube por quedarse sin energía puede quedarse antes sin ella: reembolso y reseña mala. | **Sí, R6.** |
| F7 | El brief de ejemplo llevaba semiguion (U+2013) en los horarios (prohibido por `AGENTS.md`) y «Quedan 12 días», que en un paywall se lee como cuenta atrás. | Menor. | R3 por apariencia. Regla del dueño. |
| F8 | `primer_dia` y `coach_profundo` sin cablear (§1.3). | Se pierden el segundo momento de valor (D1 b) y el escaparate del modo profundo para el Pro. | No. |
| F9 | Volver con el gesto del sistema desde `/pro` no apunta «cerrada» (límite conocido de L1). | La espera de 72 h no se activa. Como mucho, otra hoja dentro de los topes. | No, pero insiste un poco más de lo debido. |
| F10 | Las entradas a `/pro` desde Hoy, Perfil, etc. no llevan motivo. | Cabecera genérica. No se puede medir qué superficie convierte. | No. |
| F11 | No hay telemetría de oferta: el historial `nivl.ofertas.v1` vive solo en el dispositivo. | No se puede medir vista → toque → prueba → pago. | No. |

## 3. Mejoras priorizadas

Prioridad: P0 = lanzamiento 1.0.8 (veracidad o conversión directa); P1 = conversión clara; P2 = medición o pulido. «Hecho» = implementado en esta tanda.

| P | Mejora | Impacto esperado (razonado) | Qué medir | Dueño | Anti patrón oscuro |
|---|---|---|---|---|---|
| P0 | **Hecho.** Botón y texto de la prueba según el nivel: «Probar Pro 7 días» mirando Élite, con «es del coach estándar de Pro, sin modo profundo». | Cero expectativas falsas, menos abandonos en la prueba y menos «no era lo que pensaba» al pagar. | Prueba → pago, separado por el nivel mirado al empezar (evento propuesto `paywall_answer.tier`). | Compras (`proplans.ts` `tituloBotonPrueba`/`textoPrueba`, `ProOffer.tsx`) | R6, R4 |
| P0 | **Hecho.** Condiciones de la prueba siempre que se ofrece, con la tienda abierta o cerrada: «coach estándar y energía limitada, sin tarjeta y sin cobro. No se renueva sola». | Quita el miedo al cobro, la primera objeción de una prueba. | Toques en «Probar» / vistas de hoja (`trial_started` contra `paywall_shown`). | Compras | R6 |
| P0 | **Hecho.** `energia_agotada.elite` ya no promete más energía: «Élite cambia la potencia: modelo de primera línea y modo profundo, cada uno con su límite mensual». | Evita subidas por un motivo falso, con sus reembolsos. Puede bajar las subidas desde este momento, y es lo correcto. | `store_events` de subida Pro→Élite en los 3 días tras `energia_agotada`, y reembolsos a 30 días. | Compras (`proplans.ts`) | R6 |
| P0 | **Hecho.** Brief de ejemplo sin semiguion (U+2013) y sin «Quedan N días». Barrido automático de todos los textos de Compras (test nuevo `paywall-copy.test.ts`). | Cumple la regla del dueño y la R3. | No aplica. | Compras | R3 |
| P1 | **Hecho.** Con la tienda cerrada **y la prueba disponible**, la firma y el primer día abren hoja (con sus topes), no línea. La prueba es del servidor y se puede empezar sin tienda. | En builds sin tienda (web, Expo Go o una clave mal puesta), la prueba pasa de estar escondida a ser la acción principal del momento de más intención. | Pruebas por cada 100 `commitment_signed` con la tienda cerrada, antes y después. | Compras (`paywallmoment.ts`) | R1, R5: la salida «Seguir gratis por ahora» sigue igual. |
| P1 | **Hecho.** Momento nuevo **`fin_prueba`**: una hoja una vez en la vida cuando la cuenta vuelve a gratis tras la prueba (o una cortesía). Con la tienda cerrada o los topes gastados, línea. Copy: «Tu prueba ha terminado y no se ha cobrado nada. Tus misiones, tu racha y tus datos siguen; Pro mantiene el coach que has probado.». Se detecta por el historial (respuesta `prueba`) o por `opts.pruebaTerminada` (servidor). `/pro` apunta ahora el inicio de la prueba también sin motivo. | Es el punto natural de decisión de una prueba sin renovación automática. Hoy no existe. | Pago en los 7 días tras el fin de la prueba, con y sin la hoja `fin_prueba` vista. | Compras (lógica y copy); **Experiencia** (cablearlo en el Coach) | R1, R3 (sin cuenta atrás: se dice al acabar, no antes), R6 («no se ha cobrado nada») |
| P1 | **Hecho.** En prueba no se ofrece lo ya incluido: ni firma, ni primer día, ni fotos, ni voz. Sí el modo profundo (Élite) y la energía agotada. | Menos ruido y más confianza. El impulso a pagar se concentra en `fin_prueba` y en «Suscribirme» de `/pro`. | Vistas de línea por usuario en prueba (deberían bajar) frente a prueba → pago (no debería bajar). | Compras (`paywallmoment.ts`) | R6 |
| P1 | **Hecho.** Cabecera de `/pro` por motivo (`eyebrow` y `titulo` en `COPY_UPSELL`, B.5 e). Subtítulo con «Pruébalo 7 días, sin tarjeta.» si la cuenta puede. En prueba: «Al acabar no se cobra nada: no se renueva sola». | La pantalla continúa el gesto que la abrió, en vez de empezar de cero. | Compra o prueba por apertura de `/pro`, con y sin motivo. | Compras (`proplans.ts`, `pro.tsx`) | R3 (sin urgencias; test) |
| P1 | Cablear `primer_dia` al cerrar la celebración `logro:first_day` (contrato en FASE2-L1 §2). | Segundo momento de valor: el usuario acaba de ganar algo y la oferta llega después, nunca encima. | Prueba o pago en las 24 h tras la hoja `primer_dia`; D7 de quien la vio frente a quien no. | **Experiencia** (`celebracion/CelebracionProvider.tsx`) | R1: nunca encima de la celebración (ya garantizado por la lógica). |
| P1 | Cablear `fin_prueba` en la pestaña Coach antes de `coach_cerrado`. | Ver la fila de `fin_prueba`. | Ver la fila de `fin_prueba`. | **Experiencia** (`coach/useCoach.ts:264-280`) | Ídem |
| P2 | Selector de potencia visible para Pro, con «Profundo» desactivado y la línea `coach_profundo` debajo. | Es el escaparate del único diferencial funcional de Élite, donde se usa. Hoy un Pro no sabe que existe. | Toques en la línea `coach_profundo` → `/pro?tier=elite` → subida. | **Experiencia** (`CoachVista.tsx:479`) | Línea no modal: lo gratis no se bloquea. |
| P2 | Entradas a `/pro` con motivo: Hoy («El plan del día lo escribe el coach»), Perfil y Oráculo → `rutaOferta('coach_cerrado','pro')`. | Cabecera coherente y medición por superficie. | Aperturas de `/pro` por superficie. | **Experiencia** | R6 |
| P2 | Apuntar «cerrada» también al salir de `/pro` por gesto o botón del sistema (F9). | Respeta mejor la espera de 72 h. | Hojas por usuario y semana (debería bajar un poco). | Compras: necesita `beforeRemove`/`usePreventRemove` en `pro.tsx`. Es cambio de navegación, no de texto: se deja para el kit v2. | R1 |
| P2 | Telemetría propia en `events` (nada de terceros): `paywall_shown {momento, forma, tier, tienda, prueba}`, `paywall_answer {momento, respuesta, tier}`, `upsell_tap {momento, tier}`. Best effort como `pro_interest`. | Sin esto no se puede atribuir nada de lo anterior. | No aplica. | Compras (desde `anotarOferta`/`ofrecerSi`), **con decisión del dueño** sobre privacidad: `events` ya se exporta y es de la persona. | No aplica |

## 4. Qué medir (D1/D7, prueba y pago)

Con lo que **ya existe** en el servidor:

| Métrica | Fuente |
|---|---|
| Alta → firma | `profiles` (alta) y `events.type='commitment_signed'` |
| Firma → onboarding terminado | `profiles.onboarding_done` |
| Firma → prueba | `events.type='trial_started'` (0024) en los 15 min tras `commitment_signed` (prueba desde el onboarding) o más tarde (desde `/pro`) |
| Interés con la tienda cerrada | `events.type='pro_interest'` |
| Prueba → pago | `store_events` (RevenueCat: compra inicial) o `subscriptions.plan` de pago en los 14 días tras `trial_started` |
| Pago directo sin prueba | Compra en `store_events` sin `trial_started` previo |
| Reembolsos | `store_events` (`CANCELLATION` + `CUSTOMER_SUPPORT`) |
| D1 / D7 | `completions` o `events` del día 1 y del día 7 desde el alta, por cohorte: (a) empezó la prueba en el onboarding, (b) siguió gratis, (c) pagó |

**Propuestos** (P2 de §3): `paywall_shown`, `paywall_answer` y `upsell_tap`. El fin de la prueba se calcula en servidor: `subscriptions.plan='cortesia'` con `current_period_end < now()`. No hace falta evento.

Lectura mínima para decidir en la primera semana tras el lanzamiento: (1) pruebas por cada 100 firmas; (2) prueba → pago a 14 días; (3) D7 de (a) frente a (b). Si (3) sale muy por encima en (a), la prueba vale más como retención que como venta, y lo prudente es no endurecerla.

## 5. Propuestas para Experiencia (archivo:línea)

Son solo propuestas: los archivos son de Experiencia y no se han tocado.

1. **`src/app/onboarding.tsx:721`**, pista del paso 6. Con prueba disponible, añadir «Puedes probar el coach 7 días, sin tarjeta.». Hoy la pista habla de «planes de pago» antes de mencionar que hay una prueba sin cobro.
2. **`src/app/onboarding.tsx:738`**, la línea de firma: si `decisionOferta.prueba`, pasar a `/pro?motivo=firma` igual. La cabecera de `/pro` ya lo dice. Con la regla nueva, la línea solo sale sin prueba.
3. **`src/app/onboarding.tsx:409`**: nada que cambiar. Con la tienda cerrada y la prueba disponible, `ofrecerSi('firma')` devuelve ahora `forma: 'hoja'` y `prueba: true`. Conviene comprobar en la galería que el pie (`:773-779`) con la lista de referencia de 2-3 filas cabe en 667 pt.
4. **`src/components/coach/useCoach.ts:264-280`**: antes de `ofrecerSi('coach_cerrado', …)`, llamar a `ofrecerSi('fin_prueba', estado, { celebrando, pruebaTerminada })`. Así:
   - si es **hoja**: `router.push(rutaOferta('fin_prueba', d.tier))`;
   - si es **línea**: `<ProUpsellLine momento="fin_prueba" tier={d.tier} />` en lugar de la de `coach_cerrado`.

   `pruebaTerminada` puede salir de `fetchSubscription()`: `plan === 'cortesia'` y `current_period_end` vencido. Sin ese dato, se deduce del historial.
5. **`src/components/coach/CoachVista.tsx:479`**: pintar el selector de potencia también a quien tiene coach sin modo profundo, con «Profundo» desactivado y debajo `<ProUpsellLine momento="coach_profundo" tier="elite" />` (si `ofrecerSi('coach_profundo')` dice `mostrar`).
6. **`src/components/celebracion/CelebracionProvider.tsx`**: al **cerrar** la celebración `logro:first_day`, llamar a `ofrecerSi('primer_dia', estado, { celebrando: colaVisible })`. Contrato completo en `FASE2-L1.md` §2.
7. **`src/components/hoy/HoyVista.tsx:178`**, **`src/components/perfil/PerfilVista.tsx:164`** y **`src/app/oraculo.tsx:214`**: `router.push(rutaOferta('coach_cerrado', 'pro'))` en vez de `'/pro'`, para la cabecera del momento y para medir.
8. **Kit v2 de `/pro`** (B.5): `eyebrow` y `titulo` ya están en `COPY_UPSELL` para los 8 momentos × 2 niveles. «Seguir gratis» se mantiene secondary lg (R5), no ghost como dice la maqueta.

## 6. Cambios hechos en esta tanda (Compras)

| Archivo | Cambio |
|---|---|
| `src/lib/paywallmoment.ts` | Momento `fin_prueba` y `ContextoOferta.pruebaTerminada`. En prueba, no ofrecer firma, primer día, fotos, voz ni `fin_prueba`. Con la tienda cerrada y la prueba disponible, hoja (con topes) en vez de línea. |
| `src/lib/proplans.ts` | `textoPrueba(tier)` y `tituloBotonPrueba(tier)`. `CopyUpsell.eyebrow` y `titulo` para todos los momentos. Copy de `fin_prueba.{pro,elite}`. `energia_agotada.elite` veraz. Brief de ejemplo sin semiguion (U+2013) ni «Quedan N días». Comentario de la voz al día. |
| `src/lib/pro.ts` | `OpcionesOferta.pruebaTerminada`, que pasa a `decidirOferta`. Dos comentarios sin guion largo (U+2014). |
| `src/components/ProOffer.tsx` | Solo texto: condiciones de la prueba siempre que se ofrece (el mismo `Text` y estilo de antes) y botón de prueba según el nivel. Sin tocar estilos. |
| `src/app/pro.tsx` | Solo texto y apunte: cabecera por motivo, «Pruébalo 7 días, sin tarjeta.», subtítulo de la prueba sin renovación, y apunte de la prueba sin motivo (línea `coach_cerrado`, no gasta topes). |
| Tests | Nuevo `paywall-copy.test.ts`: barrido de guion largo (U+2014) y semiguion (U+2013) en los 5 archivos, de «gratis para siempre», «ilimitado», «sin límite» y cuentas atrás en el código sin comentarios, y de todos los textos generados (más de 150), sin exclamaciones. Ampliados `paywallmoment` (prueba, tienda cerrada, `fin_prueba`, cabeceras, energía Élite), `prooffer` (prueba con la tienda cerrada, prueba mirando Élite, sin prueba no se nombra) y `pro-purchases` (`fin_prueba` por historial y por servidor). |

Todo es JS/TS: sale con el binario 1.0.8 y por OTA a la 1.0.8. Sin servidor ni SQL.

## 7. Resultados

2026-10-04, en el worktree compartido (con B y C trabajando en docs y en `creators`):

- `npm run typecheck`: sin errores.
- `CI=true npx jest --ci --runInBand src/lib/__tests__`: 65 suites, 1226 tests, todos en verde.
- `CI=true npm run lint`: salida 0, sin avisos.
- No ejecutado: `npx expo export` ni prueba en dispositivo. **NO PROBADO** en TestFlight, sandbox ni Play.
