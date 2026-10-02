# Coach v2 · Plan del Chat 3 (fase 2)

Base `winter2/integracion @ 99729ea`, rama `winter2/chat3-ia`. Todo lo de servidor es **aditivo y compatible con 1.0.7** (firmas intactas, columnas nuevas con nulo/defecto, kinds nuevos solo del servidor). Nada de OTA a 1.0.7.

## Hechos medidos (02/10, solo lectura)

- **Coste**: 30 días, 67 turnos, media 0,23 $/turno (p90 0,33 $). **≈75 % es reescritura de caché**: un solo punto de caché al final del estado, TTL 5 min y turnos separados por horas → cada turno reescribe 50–70 k tokens a 1,25×. Datos de **1 usuario** (cuenta del dueño): patrón, no población.
- **Error de contabilidad**: `_shared/openai.ts:202` cuenta como entrada completa los tokens ya cacheados y además los cobra a 0,1× → DeepSeek (Pro) aparece más caro y **el candado de gasto descuenta de más a usuarios Pro**.
- **«Contradice sin comprobar» — causa raíz reproducida** (test en scratchpad, 5/5):
  1. El chat no manda `date` (`src/lib/coach.ts:221`) y el servidor usa la fecha UTC (`coach/guard.ts:71`); la app guarda el gym en hora local → de 00:00 a 02:00 en Madrid el coach vive en «ayer».
  2. `buildContext` no lee `gym_sessions` de hoy; el gym solo aparece vía e1RM (descarta peso 0 o >12 reps) o notas → unas dominadas sin notas no existen para el coach.
  3. Instrucciones asimétricas: `context.ts:302-305` «si dice que lo hizo y sigue PENDIENTE, es que no lo ha registrado»; `prompt.ts:21` verifica solo antes de **afirmar**; `consultar_historial` dice «no la uses para lo que ya tienes delante» y trunca lo más reciente.
- **Dato del dueño a todos**: el objetivo «IRONMAN 2029» está fijado en `analytics.ts:272` y `knowledge.ts:57` para cualquier usuario.

## Matriz de cobertura (hoy → objetivo)

| Módulo | Contexto | Lectura | Escritura | Falta |
|---|---|---|---|---|
| Misiones/hábitos, reglas, nutrición, peso, ficha, dinero, agenda | sí | sí | sí | — |
| Gimnasio | estudio 90 d | `consultar_historial gym` | rutina, prescripción | **hoy en contexto**; registrar sesión (economía → con Chat 5) |
| Cardio | estudio 56 d | sí | — | **hoy en contexto**; registrar (con Chat 5) |
| Diario | 21 entradas | sí | sí | recortar |
| Campañas | activas | — | crear/gestionar | leer tareas hechas |
| Fotos de progreso | — | — | — | metadatos (fecha, pose, peso vinculado); visión aparte |
| Amigos/ligas | — | — | — | tu posición y agregados (sin datos identificables de terceros) |

## Lotes (cada uno integrable: deno check/test, tsc, Jest, lint)

| Lote | Qué | Archivos | Verificación |
|---|---|---|---|
| **L0 Medición** | Corregir doble cuenta de caché en `openai.ts`; columnas de telemetría en `coach_runs` (ruta, intención, herramientas ofrecidas/llamadas, iteraciones, tamaño del estado) y `coach_threads.summary`; script de coste p50/p90 por ruta | `openai.ts`, `coach/handler.ts`, SQL nuevo (pido número), `scripts/coste-coach.mjs` (pido adjudicación) | línea base guardada; test de contabilidad DeepSeek |
| **L1 Nunca contradecir** (prioridad del usuario) | `date` local desde el cliente; si falta, `profiles.timezone` (arregla también 1.0.7); sección «Registrado hoy» (gym con ejercicios/series, cardio, peso, nutrición, diario, completadas); herramienta `consultar_dia` (fecha y la anterior); comprobación determinista del servidor cuando el usuario afirma haber hecho/registrado algo; prompt simétrico «antes de afirmar **o negar**, consulta y cita»; quitar las frases que empujan a negar | `src/lib/coach.ts`, `context.ts`, `tools.ts`, `prompt.ts`, `knowledge.ts`, `coach/handler.ts`, nuevos `_shared/intencion.ts`, `_shared/comprobacion.ts` | regresión `sec_coach_gym_hoy_test.ts`: fecha, contexto con y sin datos, de punta a punta «te he subido el gym» con lectura antes de cualquier escritura; smoke real tras desplegar |
| **L2 Caché en dos escalones** | punto de caché tras la parte fija (herramientas+voz+conocimiento+reglas) y otro tras el estado; mantener herramientas en la última llamada | `prompt.ts`, `coach/handler.ts` | test de posición de `cache_control`; escritura de caché por turno 68 k → <35 k |
| **L3 Ruta barata «registro»** | intención `registro` → modelo barato (`routes.registro` o Haiku), contexto mínimo y pack fijo de 4 herramientas; rituales con packs fijos; el chat general conserva todas (cambiar el conjunto por intención rompe la caché) | `coach/handler.ts`, `_shared/packs.ts`, `context.ts` | turno de registro <0,005 $; batería sin herramientas equivocadas |
| **L4 Contexto más pequeño + resumen incremental** | diario 21→7, hechos 25→12, resumen del hilo con Haiku cada 12 mensajes; quitar IRONMAN del dueño | `context.ts`, `_shared/resumenhilo.ts`, `knowledge.ts`, parche `analytics.ts` (coordinador) | tamaño del estado −40 %; batería sin pérdida |
| **L5 Módulos nuevos** | `consultar_historial` + `fotos` (solo metadatos), `liga` (posición/índices vía RPC del Chat 5), `tareas`; una línea por módulo en contexto | `tools.ts`, `context.ts` | `sec_coach_social_test.ts`: sin emails, URLs ni datos de terceros |
| **L6 Proactivo con tope** | kind `checkin` (barato, contexto mínimo); como mucho 1/día y 3/semana, nunca si escribió en 6 h o en horas de sueño, se retira tras 2 ignorados; en chat, una sola pregunta de seguimiento | `_shared/checkin.ts`, `ritual/handler.ts` | tests de tope; coste <0,003 $ |
| **L7 Identidad y voz** | `src/lib/voice/`: `paraVoz()` puro (sin markdown, «×»→«por»), TTS `expo-speech@~14.0.8`, dictado `expo-speech-recognition@3.1.3` (on-device si el móvil lo permite), carga opcional para no romper OTA; especificación de voz y emoji para el Chat 4 | `src/lib/voice/**`; PROPUESTA de dependencias y `app.json` al coordinador | tests de `paraVoz`; export iOS; dispositivo (1.0.8) |

Dependencias nativas (al coordinador): `expo-speech@~14.0.8`, `expo-speech-recognition@3.1.3` (plugin con textos de permiso), y en `app.json`: quitar `RECORD_AUDIO` de `android.blockedPermissions` y dar texto a `microphonePermission` de `expo-image-picker` (si no, borra `NSMicrophoneUsageDescription`). Voz premium Élite: más adelante, por OTA, con consentimiento propio y desactivada por defecto.

Fuera de 1.0.8: visión de IA sobre fotos corporales (requiere consentimiento específico y tope; lote de seguridad aparte), escrituras sociales del coach, voz premium.

## Seguridad de lo nuevo (revisor)

Requisitos MUST por función y pruebas de aceptación en `docs/ia-v2/requisitos-seguridad.md` (fotos corporales, visión, compartir, referidos, ligas/duelos, voz). Reviso cada entrega de los demás chats contra esa lista antes de que el coordinador integre.

## Riesgos

- El clasificador de intención se equivoca → conservador; si duda, ruta completa.
- Bajar contexto pierde matices → batería fija de 10 frases antes/después.
- DeepSeek con 25 herramientas → solo rutas estrechas hasta medirlo.
- Todo lo de voz está sin probar en dispositivo.
