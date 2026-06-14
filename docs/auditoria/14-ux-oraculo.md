# UX/UI Oráculo IA

> Área ORA · auditoría de código NIVL · anclada al código real

Alcance leído: `src/app/oraculo.tsx` (pantalla completa), `src/lib/oracle.ts` (cliente IA), y para contexto `src/lib/data.ts` (`createQuest`/`QuestInput`), `src/lib/game.ts` (`XP_BY_DIFFICULTY`, `DIFFICULTY_LABEL`), `src/lib/types.ts` (`Stat`, `Difficulty`, `Quest`), `src/lib/theme.ts`, `src/components/SystemButton.tsx`, `src/components/SystemWindow.tsx`.

## Bugs y riesgos

### CRIT-ORA-01 · `output_config` no es un parámetro válido de la Messages API — `src/lib/oracle.ts:89` · severidad alta
**Problema:** el body manda `output_config: { format: { type: 'json_schema', schema: QUESTS_SCHEMA } }`. La API de Anthropic `/v1/messages` no reconoce ese campo (la salida estructurada vive en otra forma del API), así que la API ignora el campo desconocido y el modelo responde **prosa libre**, no JSON. Acto seguido `JSON.parse(text)` (`oracle.ts:108`) lanza `SyntaxError` sobre el texto en lenguaje natural. Resultado: el oráculo casi siempre cae al `catch` de `consult` (`oraculo.tsx:69`) con "El oráculo guarda silencio" y un mensaje de parseo incomprensible. La feature está rota de raíz.
**Arreglo:** dejar de depender de un campo inexistente. Forzar JSON por una vía soportada: (a) usar **tool use** con un único tool cuyo `input_schema` sea `QUESTS_SCHEMA` y `tool_choice: { type: 'tool', name: 'propose_quests' }`, leyendo el bloque `tool_use.input` (ya objeto, sin `JSON.parse`); o (b) instruir en el system prompt "responde SOLO con JSON que cumpla este schema" + extraer el primer bloque `{…}` con un parser tolerante. Quitar `output_config` del body.

### CRIT-ORA-02 · La respuesta de la IA no se valida contra los enums antes de tocar la BD — `src/lib/oracle.ts:108-112` · severidad alta
**Problema:** `const parsed = JSON.parse(text) as OracleResponse` es un **cast**, no una validación. Solo se comprueba que `quests` sea array no vacío. Si el modelo devuelve `stat: "STR"`, `difficulty: "hard"` o `days_of_week: [0, 8]`, esos valores entran tal cual en `proposals` y, al aceptar, en `createQuest` (`oraculo.tsx:92`). Como `Difficulty`/`Stat` son tipos sin validación en runtime y `QuestInput` no las verifica, se inserta basura en la tabla `quests`. Además rompe la UI (ver CRIT-ORA-03).
**Arreglo:** validar cada quest tras el parseo: `stat ∈ STATS`, `difficulty ∈ DIFFICULTIES`, `days_of_week` con enteros 1–7 únicos y no vacío, `title` string no vacío. Descartar (o corregir con defaults) las propuestas inválidas y, si tras filtrar no queda ninguna, lanzar el error de "no encontró misiones". Reutilizar `STATS`/`DIFFICULTIES` de `game.ts`.

### CRIT-ORA-03 · `XP_BY_DIFFICULTY[p.difficulty]` y `DIFFICULTY_LABEL[p.difficulty]` pueden ser `undefined` en pantalla — `src/app/oraculo.tsx:182` · severidad media
**Problema:** la fila de meta de cada propuesta renderiza `{p.stat} · {DIFFICULTY_LABEL[p.difficulty]} · {XP_BY_DIFFICULTY[p.difficulty]} XP`. Si `p.difficulty` no es una clave válida (consecuencia directa de CRIT-ORA-02), ambos accesos devuelven `undefined` y se muestra "INT · undefined · undefined XP". No crashea, pero comunica error y rompe la estética del sistema.
**Arreglo:** una vez aplicada la validación de CRIT-ORA-02 esto queda cubierto; defensivamente, usar `DIFFICULTY_LABEL[p.difficulty] ?? p.difficulty` y `XP_BY_DIFFICULTY[p.difficulty] ?? 0`, o no renderizar propuestas inválidas.

### CRIT-ORA-04 · `DAY_LABELS[d - 1]` produce `undefined` con días fuera de rango — `src/app/oraculo.tsx:185` · severidad media
**Problema:** `p.days_of_week.map((d) => DAY_LABELS[d - 1]).join(' ')`. `DAY_LABELS` tiene 7 entradas (índices 0–6). Si la IA devuelve `d = 0` → índice `-1` → `undefined`; si `d = 8` → índice `7` → `undefined`. El `join` imprime cadenas con huecos ("L  X  V") o "undefined". También `days_of_week` vacío imprime cadena vacía sin avisar.
**Arreglo:** validar `days_of_week` en origen (CRIT-ORA-02). En el render, filtrar: `.filter((d) => d >= 1 && d <= 7).map((d) => DAY_LABELS[d - 1])`, y si queda vacío mostrar un placeholder ("sin días").

### CRIT-ORA-05 · `fetch` sin timeout ni AbortController: la consulta puede colgarse para siempre — `src/lib/oracle.ts:77` · severidad media
**Problema:** la llamada a la API no pasa `signal` ni timeout (no hay `AbortController` en toda `src/lib`, verificado). En red móvil lenta o si el servidor no cierra, la promesa nunca resuelve, `busy` queda en `true` (`oraculo.tsx:62`) y el botón "Consultar al oráculo" se queda girando indefinidamente sin forma de cancelar.
**Arreglo:** crear `AbortController` con `setTimeout(() => controller.abort(), 30000)`, pasar `signal: controller.signal` al `fetch`, limpiar el timeout en `finally`, y mapear `AbortError` a un mensaje claro ("El oráculo tardó demasiado. Reintenta."). Idealmente exponer un botón "Cancelar" mientras `busy`.

### CRIT-ORA-06 · `setState` tras desmontar el componente en el `useEffect` de carga de key — `src/app/oraculo.tsx:37-44` · severidad baja
**Problema:** `getApiKey().then((k) => { setKey(k); setKeySaved(true); })` no cancela si el usuario sale de la pantalla antes de que resuelva AsyncStorage. Llamar `setKey`/`setKeySaved` sobre un componente desmontado provoca el warning de React y una fuga potencial.
**Arreglo:** usar bandera de montaje (`let alive = true; … if (alive) setKey(k); return () => { alive = false; }`) o envolver en un efecto con limpieza.

### CRIT-ORA-07 · Aceptación parcial sin rollback ni feedback de fallo por misión — `src/app/oraculo.tsx:88-99` · severidad baja
**Problema:** el bucle `for (const i of selected) { … await createQuest(...) }` inserta una a una. Si la 3ª de 5 falla (red, RLS), las 2 primeras ya quedaron creadas y el `catch` muestra "Error del sistema" genérico; el usuario no sabe cuántas se crearon y, al no resetear `proposals`, puede reintentar y **duplicar** las que sí entraron.
**Arreglo:** contar éxitos/fallos (`Promise.allSettled` sobre el `map`), informar "Se crearon X de Y; reintenta las que faltan", y quitar de `selected`/`proposals` las ya creadas para evitar duplicados al reintentar.

### CRIT-ORA-08 · `secureTextEntry` se activa solo si la key venía guardada, no al guardarla en caliente — `src/app/oraculo.tsx:136` · severidad baja
**Problema:** el input usa `secureTextEntry={keySaved}`. `keySaved` arranca `false`; tras pegar y pulsar "Guardar", `saveKey` sí pone `keySaved` (`oraculo.tsx:48`), pero entre que se pega la key y se guarda, queda **en claro** en pantalla. Y si el usuario edita la key existente, vuelve a verse. Es una key secreta (`sk-ant-…`) visible a hombros.
**Arreglo:** ofrecer un toggle ojo/oculto independiente del estado guardado, y por defecto enmascarar siempre que haya contenido. Mostrar solo los últimos 4 caracteres como confirmación.

## Mejoras

### ORA-001 · Migrar a tool use para salida estructurada fiable
**Qué:** sustituir el `output_config` inexistente por un tool `propose_quests` con `input_schema = QUESTS_SCHEMA` y `tool_choice` forzado; leer `content` del tipo `tool_use`. **Dónde:** `src/lib/oracle.ts:84-108`. **Impacto:** 5 · **Esfuerzo:** M

### ORA-002 · Validador runtime de `ProposedQuest`
**Qué:** función `sanitizeQuest(raw): ProposedQuest | null` que valida `stat`/`difficulty`/`days_of_week`/`title` y descarta inválidas. **Dónde:** `src/lib/oracle.ts:108-112`. **Impacto:** 5 · **Esfuerzo:** S

### ORA-003 · Timeout + cancelación de la consulta
**Qué:** `AbortController` con timeout de 30 s y botón "Cancelar" visible mientras `busy`. **Dónde:** `src/lib/oracle.ts:77`, `src/app/oraculo.tsx:154-160`. **Impacto:** 4 · **Esfuerzo:** M

### ORA-004 · Guardar el bug de `setState` tras desmontaje
**Qué:** bandera de montaje en el `useEffect` de carga de key. **Dónde:** `src/app/oraculo.tsx:37-44`. **Impacto:** 2 · **Esfuerzo:** S

### ORA-005 · Aceptación atómica con reporte por misión
**Qué:** `Promise.allSettled` sobre las inserciones, contar éxitos/fallos, evitar duplicados al reintentar. **Dónde:** `src/app/oraculo.tsx:88-99`. **Impacto:** 4 · **Esfuerzo:** M

### ORA-006 · Toggle de visibilidad de la API key (ojo)
**Qué:** icono ojo para mostrar/ocultar; por defecto enmascarada, mostrar últimos 4. **Dónde:** `src/app/oraculo.tsx:128-139`. **Impacto:** 3 · **Esfuerzo:** S

### ORA-007 · Validar formato `sk-ant-` antes de guardar
**Qué:** rechazar keys que no empiecen por `sk-ant-` con aviso, en vez de guardar cualquier string. **Dónde:** `src/app/oraculo.tsx:46-50`, `src/lib/oracle.ts:28-34`. **Impacto:** 3 · **Esfuerzo:** S

### ORA-008 · Botón "Borrar key" explícito
**Qué:** acción para eliminar la key guardada (hoy solo se borra dejando el input vacío y pulsando Guardar, poco descubrible). **Dónde:** `src/app/oraculo.tsx:128-139`, `setApiKey` `oracle.ts:31`. **Impacto:** 2 · **Esfuerzo:** S

### ORA-009 · Estado vacío explicativo cuando no hay key
**Qué:** si `getApiKey()` es null, mostrar tarjeta "Necesitas una API key de Anthropic" con pasos, en vez de fallar al pulsar Consultar. **Dónde:** `src/app/oraculo.tsx:126-140`, `consult` `:54-61`. **Impacto:** 4 · **Esfuerzo:** S

### ORA-010 · Onboarding de la key con enlace a console.anthropic.com
**Qué:** botón/enlace `Linking.openURL('https://console.anthropic.com/settings/keys')` y mini-guía de 3 pasos. **Dónde:** `src/app/oraculo.tsx:126-140`. **Impacto:** 4 · **Esfuerzo:** S

### ORA-011 · Streaming de la respuesta del oráculo
**Qué:** usar `stream: true` y SSE para ir mostrando el `plan_summary` token a token; reduce sensación de espera. **Dónde:** `src/lib/oracle.ts:77-108`. **Impacto:** 4 · **Esfuerzo:** L

### ORA-012 · Indicador de progreso con copy del sistema
**Qué:** mientras `busy`, mostrar texto rotativo ("El sistema analiza tu objetivo…", "Forjando misiones…") en vez de solo el spinner del botón. **Dónde:** `src/app/oraculo.tsx:154-160`. **Impacto:** 3 · **Esfuerzo:** S

### ORA-013 · Mensajes de error mapeados por código HTTP completos
**Qué:** añadir 400 (objetivo malformado), 403, 500, y error de red (`TypeError: Network request failed`) al switch de errores. **Dónde:** `src/lib/oracle.ts:93-99`. **Impacto:** 3 · **Esfuerzo:** S

### ORA-014 · Distinguir error de red de error de API
**Qué:** envolver el `fetch` en try/catch para capturar fallo de conectividad y dar "Sin conexión" en vez de propagar `TypeError`. **Dónde:** `src/lib/oracle.ts:77`. **Impacto:** 3 · **Esfuerzo:** S

### ORA-015 · Reintento con backoff en 429/529
**Qué:** reintentar automáticamente 1–2 veces con espera exponencial ante saturación/límite. **Dónde:** `src/lib/oracle.ts:95-96`. **Impacto:** 3 · **Esfuerzo:** M

### ORA-016 · Honrar `retry-after` en 429
**Qué:** leer la cabecera `retry-after` de la respuesta y mostrar "Reintenta en N s". **Dónde:** `src/lib/oracle.ts:95`. **Impacto:** 2 · **Esfuerzo:** S

### ORA-017 · Editar el título de una propuesta antes de aceptar
**Qué:** permitir pulsar el título y editarlo inline (`TextInput`) antes de crear la misión. **Dónde:** `src/app/oraculo.tsx:179-188`. **Impacto:** 4 · **Esfuerzo:** M

### ORA-018 · Editar dificultad de una propuesta
**Qué:** selector de dificultad (chips) por propuesta para recalibrar XP antes de aceptar. **Dónde:** `src/app/oraculo.tsx:180-187`. **Impacto:** 4 · **Esfuerzo:** M

### ORA-019 · Editar stat de una propuesta
**Qué:** selector de stat (FUE/VIT/INT/AGI/PER) por propuesta. **Dónde:** `src/app/oraculo.tsx:180-187`. **Impacto:** 3 · **Esfuerzo:** M

### ORA-020 · Editar días de la semana de una propuesta
**Qué:** toggles L–D por propuesta para ajustar la recurrencia sugerida. **Dónde:** `src/app/oraculo.tsx:183-186`. **Impacto:** 4 · **Esfuerzo:** M

### ORA-021 · Toggle `requires_evidence` por propuesta
**Qué:** hoy se fuerza `requires_evidence: false` (`oraculo.tsx:97`); permitir marcarlo para misiones que dan +25% por evidencia. **Dónde:** `src/app/oraculo.tsx:97`. **Impacto:** 3 · **Esfuerzo:** S

### ORA-022 · Seleccionar/deseleccionar todas
**Qué:** botón "Todas / Ninguna" junto al contador `selected.size/proposals.length`. **Dónde:** `src/app/oraculo.tsx:170-173`. **Impacto:** 3 · **Esfuerzo:** S

### ORA-023 · Coste estimado visible de la consulta
**Qué:** tras responder, leer `usage.input_tokens`/`output_tokens` y mostrar coste aproximado en € según tarifa del modelo. **Dónde:** `src/lib/oracle.ts:101-104`, `src/app/oraculo.tsx:165-168`. **Impacto:** 4 · **Esfuerzo:** M

### ORA-024 · Exponer `usage` en `OracleResponse`
**Qué:** propagar `input_tokens`/`output_tokens` desde la respuesta para alimentar el coste visible. **Dónde:** `src/lib/oracle.ts:19-22,101-112`. **Impacto:** 3 · **Esfuerzo:** S

### ORA-025 · Historial de consultas al oráculo
**Qué:** persistir en AsyncStorage las últimas N consultas (objetivo + plan + propuestas) y listarlas para reabrir. **Dónde:** nuevo en `src/lib/oracle.ts`, UI en `src/app/oraculo.tsx`. **Impacto:** 4 · **Esfuerzo:** L

### ORA-026 · Reutilizar último objetivo
**Qué:** prellenar `goal` con la última consulta guardada para iterar rápido. **Dónde:** `src/app/oraculo.tsx:28-44`. **Impacto:** 2 · **Esfuerzo:** S

### ORA-027 · Fallback sin key con plantillas locales
**Qué:** si no hay key, ofrecer un set de misiones predefinidas por objetivo común (deporte, estudio, sueño) sin llamar a la API. **Dónde:** `src/app/oraculo.tsx:54-61`, nuevo módulo `oracle.ts`. **Impacto:** 4 · **Esfuerzo:** L

### ORA-028 · Selector de modelo (haiku/sonnet/opus)
**Qué:** dejar elegir el modelo; `MODEL` está hardcodeado (`oracle.ts:8`). Más músculo a cambio de coste. **Dónde:** `src/lib/oracle.ts:8`, UI en `oraculo.tsx`. **Impacto:** 3 · **Esfuerzo:** M

### ORA-029 · Persistir el modelo elegido
**Qué:** guardar la preferencia de modelo en AsyncStorage junto a la key. **Dónde:** `src/lib/oracle.ts:9`. **Impacto:** 2 · **Esfuerzo:** S

### ORA-030 · Incluir contexto del usuario en el prompt
**Qué:** pasar stats actuales y rachas para que el plan sea personalizado (p.ej. evitar saturar la stat más alta). **Dónde:** `src/lib/oracle.ts:76-88`. **Impacto:** 4 · **Esfuerzo:** M

### ORA-031 · Evitar duplicar misiones ya existentes
**Qué:** pasar al prompt los títulos de quests activas para que no proponga repetidos. **Dónde:** `src/lib/oracle.ts:88`, `src/app/oraculo.tsx`. **Impacto:** 3 · **Esfuerzo:** M

### ORA-032 · Mostrar XP semanal total del plan propuesto
**Qué:** sumar XP·frecuencia de las propuestas seleccionadas y mostrar "≈ X XP/semana". **Dónde:** `src/app/oraculo.tsx:170-198`. **Impacto:** 3 · **Esfuerzo:** S

### ORA-033 · Advertir si el plan es demasiado ambicioso
**Qué:** si muchas misiones son 7 días/semana o épicas, mostrar aviso de sostenibilidad alineado con la regla del prompt. **Dónde:** `src/app/oraculo.tsx:163-198`. **Impacto:** 3 · **Esfuerzo:** M

### ORA-034 · Limitar nº de misiones aceptables por consulta
**Qué:** tope (p.ej. 8) para no inundar de misiones; avisar si se supera. **Dónde:** `src/app/oraculo.tsx:85-99`. **Impacto:** 2 · **Esfuerzo:** S

### ORA-035 · Confirmación antes de aceptar muchas misiones
**Qué:** `Alert` de confirmación si `selected.size` ≥ 5 antes de crear. **Dónde:** `src/app/oraculo.tsx:85-87`. **Impacto:** 2 · **Esfuerzo:** S

### ORA-036 · Bloquear "Consultar" con objetivo demasiado corto
**Qué:** exigir un mínimo de caracteres (p.ej. 4) para evitar consultas vacías de sentido. **Dónde:** `src/app/oraculo.tsx:52-53`. **Impacto:** 2 · **Esfuerzo:** S

### ORA-037 · Contador de caracteres del objetivo
**Qué:** mostrar longitud y límite recomendado bajo el `goalInput`. **Dónde:** `src/app/oraculo.tsx:146-153`. **Impacto:** 1 · **Esfuerzo:** S

### ORA-038 · Ejemplos de objetivos como chips pulsables
**Qué:** convertir el placeholder de ejemplos en chips que rellenan `goal` al tocarlos. **Dónde:** `src/app/oraculo.tsx:142-153`. **Impacto:** 3 · **Esfuerzo:** S

### ORA-039 · Mensaje claro si `stop_reason` es `max_tokens`
**Qué:** si la respuesta se truncó por límite, avisar y sugerir reducir el objetivo; hoy `stop_reason` se lee pero no se usa. **Dónde:** `src/lib/oracle.ts:101-106`. **Impacto:** 3 · **Esfuerzo:** S

### ORA-040 · Subir `max_tokens` o hacerlo proporcional
**Qué:** 2000 puede quedarse corto con 6 misiones + reasoning largo; ajustar o calcular. **Dónde:** `src/lib/oracle.ts:86`. **Impacto:** 2 · **Esfuerzo:** S

### ORA-041 · Manejar `stop_reason: 'refusal'`
**Qué:** detectar negativa del modelo y mostrar copy específico en vez de "respuesta vacía". **Dónde:** `src/lib/oracle.ts:105-106`. **Impacto:** 2 · **Esfuerzo:** S

### ORA-042 · Trim defensivo de títulos/reasoning de la IA
**Qué:** recortar espacios y longitud máxima de `title`/`reasoning` antes de mostrar/guardar. **Dónde:** `src/lib/oracle.ts:108-112`. **Impacto:** 2 · **Esfuerzo:** S

### ORA-043 · Deduplicar propuestas idénticas devueltas por la IA
**Qué:** si la IA repite el mismo título, colapsar. **Dónde:** `src/lib/oracle.ts:109-112`. **Impacto:** 2 · **Esfuerzo:** S

### ORA-044 · No resetear `summary` al limpiar propuestas
**Qué:** al aceptar se limpian `proposals` pero `summary` queda obsoleto en estado; limpiarlo también o mostrar histórico. **Dónde:** `src/app/oraculo.tsx:103-104`. **Impacto:** 1 · **Esfuerzo:** S

### ORA-045 · Limpiar `selected` al recibir propuestas nuevas
**Qué:** se reinicializa `selected` con todos los índices (`:68`), pero si una consulta nueva trae menos, índices viejos podrían no existir; resetear explícito. **Dónde:** `src/app/oraculo.tsx:62-68`. **Impacto:** 2 · **Esfuerzo:** S

### ORA-046 · Evitar doble consulta concurrente
**Qué:** `consult` ya checa `busy`, pero el `disabled` del botón solo mira `goal.trim()`; añadir `|| busy` al `disabled`. **Dónde:** `src/app/oraculo.tsx:154-160`. **Impacto:** 2 · **Esfuerzo:** S

### ORA-047 · Deshabilitar input de objetivo mientras `busy`
**Qué:** bloquear edición de `goal` durante la consulta para coherencia. **Dónde:** `src/app/oraculo.tsx:146-153`. **Impacto:** 1 · **Esfuerzo:** S

### ORA-048 · Feedback visual en el botón Guardar key
**Qué:** estado "Guardada ✓" temporal en el botón en vez de solo el `Alert`. **Dónde:** `src/app/oraculo.tsx:138`. **Impacto:** 2 · **Esfuerzo:** S

### ORA-049 · `keyboardType` y `autoComplete` correctos en el input de key
**Qué:** `autoComplete="off"`, `autoCorrect={false}`, `spellCheck={false}`, `textContentType="password"` para no sugerir/autocorregir la key. **Dónde:** `src/app/oraculo.tsx:129-137`. **Impacto:** 2 · **Esfuerzo:** S

### ORA-050 · `autoCorrect`/`spellCheck` off en el objetivo
**Qué:** evitar autocorrección agresiva del objetivo (nombres propios, "INGP"). **Dónde:** `src/app/oraculo.tsx:146-153`. **Impacto:** 1 · **Esfuerzo:** S

### ORA-051 · `returnKeyType`/`blurOnSubmit` en inputs
**Qué:** definir comportamiento de teclado al enviar para fluidez. **Dónde:** `src/app/oraculo.tsx:129-137,146-153`. **Impacto:** 1 · **Esfuerzo:** S

### ORA-052 · `accessibilityLabel` en el botón atrás
**Qué:** el `Pressable` de `chevron-back` no tiene label accesible. **Dónde:** `src/app/oraculo.tsx:119-121`. **Impacto:** 2 · **Esfuerzo:** S

### ORA-053 · `accessibilityRole="checkbox"` + `accessibilityState` en propuestas
**Qué:** el `Pressable` que marca/desmarca debe anunciar su rol y estado checked. **Dónde:** `src/app/oraculo.tsx:175-189`. **Impacto:** 3 · **Esfuerzo:** S

### ORA-054 · `accessibilityLabel` rico por propuesta
**Qué:** etiqueta que lea título + stat + dificultad + XP + días en una frase, no campos sueltos. **Dónde:** `src/app/oraculo.tsx:179-188`. **Impacto:** 3 · **Esfuerzo:** S

### ORA-055 · Tamaño táctil del checkbox de propuesta
**Qué:** la caja es 20×20; ampliar `hitSlop` para cumplir 44×44 mínimo táctil. **Dónde:** `src/app/oraculo.tsx:175-178`. **Impacto:** 2 · **Esfuerzo:** S

### ORA-056 · Anunciar resultado de la consulta a lectores de pantalla
**Qué:** `AccessibilityInfo.announceForAccessibility('N misiones propuestas')` al recibir. **Dónde:** `src/app/oraculo.tsx:65-68`. **Impacto:** 2 · **Esfuerzo:** S

### ORA-057 · Soporte de fuentes grandes (Dynamic Type)
**Qué:** permitir `allowFontScaling` y revisar que los `fontSize` fijos no rompan con accesibilidad de texto grande. **Dónde:** `src/app/oraculo.tsx:207-258`. **Impacto:** 2 · **Esfuerzo:** M

### ORA-058 · Contraste del placeholder
**Qué:** `colors.textFaint` (#56698A) sobre `colors.bg` puede no llegar a AA; verificar/ajustar. **Dónde:** `src/app/oraculo.tsx:134,151`. **Impacto:** 2 · **Esfuerzo:** S

### ORA-059 · `accessibilityViewIsModal`/foco al aparecer propuestas
**Qué:** mover el foco de accesibilidad al bloque de veredicto cuando llega la respuesta. **Dónde:** `src/app/oraculo.tsx:163-168`. **Impacto:** 2 · **Esfuerzo:** M

### ORA-060 · Estado de carga accesible en el botón
**Qué:** cuando `loading`, el `ActivityIndicator` del `SystemButton` no anuncia "cargando"; añadir `accessibilityState={{ busy: true }}`. **Dónde:** `src/components/SystemButton.tsx:29-30` (consumido en `oraculo.tsx`). **Impacto:** 2 · **Esfuerzo:** S

### ORA-061 · `key` de lista no debe ser el índice
**Qué:** `key={i}` en `proposals.map` (`:175`) provoca reconciliación incorrecta si se reordena/edita; usar un id estable (hash de título). **Dónde:** `src/app/oraculo.tsx:174-175`. **Impacto:** 2 · **Esfuerzo:** S

### ORA-062 · Extraer fila de propuesta a componente `ProposalRow`
**Qué:** el JSX de cada propuesta es denso; aislarlo facilita añadir edición inline y tests. **Dónde:** `src/app/oraculo.tsx:174-190`. **Impacto:** 2 · **Esfuerzo:** M

### ORA-063 · Extraer panel de API key a componente `ApiKeyPanel`
**Qué:** encapsular input + guardar + toggle ojo + validación en su propio componente reutilizable. **Dónde:** `src/app/oraculo.tsx:126-140`. **Impacto:** 2 · **Esfuerzo:** M

### ORA-064 · Hook `useApiKey()`
**Qué:** centralizar carga/guardado/estado de la key en un hook en vez de estado disperso en la pantalla. **Dónde:** `src/app/oraculo.tsx:28-50`, `src/lib/oracle.ts:24-34`. **Impacto:** 2 · **Esfuerzo:** M

### ORA-065 · Hook `useOracle()` para la consulta
**Qué:** mover `busy`/`proposals`/`summary`/`consult` a un hook reutilizable y testeable. **Dónde:** `src/app/oraculo.tsx:31-74`. **Impacto:** 2 · **Esfuerzo:** M

### ORA-066 · Constante compartida `DAY_LABELS`
**Qué:** `DAY_LABELS` se define local (`:112`) y `DAY_LABELS` también se necesita en otras pantallas (agenda/misiones); moverlo a `game.ts`/`dates.ts`. **Dónde:** `src/app/oraculo.tsx:112`. **Impacto:** 2 · **Esfuerzo:** S

### ORA-067 · Mover `SYSTEM_PROMPT` y schema a archivo de prompts
**Qué:** separar prompts/schema del cliente para versionarlos e iterarlos sin tocar lógica. **Dónde:** `src/lib/oracle.ts:36-74`. **Impacto:** 1 · **Esfuerzo:** S

### ORA-068 · Tipar la respuesta cruda de la API
**Qué:** el cast de `data` (`oracle.ts:101`) asume forma; definir tipo `AnthropicMessage` y validar `content` array. **Dónde:** `src/lib/oracle.ts:101-104`. **Impacto:** 2 · **Esfuerzo:** S

### ORA-069 · Manejar `content` ausente o no-array
**Qué:** si `data.content` no existe, `.find` lanza; proteger con guarda. **Dónde:** `src/lib/oracle.ts:105`. **Impacto:** 2 · **Esfuerzo:** S

### ORA-070 · Limitar tamaño del cuerpo de error mostrado
**Qué:** `body.slice(0, 200)` (`:98`) puede filtrar HTML/JSON ruidoso al usuario; parsear `error.message` de la API si viene en JSON. **Dónde:** `src/lib/oracle.ts:97-98`. **Impacto:** 2 · **Esfuerzo:** S

### ORA-071 · No exponer detalles crudos del 500 al usuario
**Qué:** mensaje amable para 5xx genérico, log técnico aparte. **Dónde:** `src/lib/oracle.ts:97-98`. **Impacto:** 2 · **Esfuerzo:** S

### ORA-072 · Tests de `generateQuests` (happy path)
**Qué:** test con `fetch` mockeado devolviendo JSON válido → parsea quests. **Dónde:** nuevo `src/lib/oracle.test.ts`. **Impacto:** 3 · **Esfuerzo:** M

### ORA-073 · Tests de errores HTTP (401/429/529/500)
**Qué:** verificar el mapeo de cada status a su mensaje. **Dónde:** `src/lib/oracle.ts:93-99`. **Impacto:** 3 · **Esfuerzo:** S

### ORA-074 · Test de respuesta no-JSON
**Qué:** asegurar que un body en prosa no crashea y da error legible (cubre CRIT-ORA-01). **Dónde:** `src/lib/oracle.ts:108`. **Impacto:** 3 · **Esfuerzo:** S

### ORA-075 · Test de quests con enums inválidos
**Qué:** asegurar que `stat`/`difficulty` inválidos se filtran (cubre CRIT-ORA-02). **Dónde:** `src/lib/oracle.ts:109-112`. **Impacto:** 3 · **Esfuerzo:** S

### ORA-076 · Test de `setApiKey`/`getApiKey`
**Qué:** guardar/leer/borrar con AsyncStorage mockeado, incluido trim y string vacío. **Dónde:** `src/lib/oracle.ts:24-34`. **Impacto:** 2 · **Esfuerzo:** S

### ORA-077 · Test de timeout/abort
**Qué:** verificar que el `AbortController` produce el error de timeout esperado (tras ORA-003). **Dónde:** `src/lib/oracle.ts:77`. **Impacto:** 2 · **Esfuerzo:** S

### ORA-078 · Persistir borrador del objetivo en AsyncStorage
**Qué:** que no se pierda lo escrito si se cierra la app a mitad. **Dónde:** `src/app/oraculo.tsx:30,149`. **Impacto:** 2 · **Esfuerzo:** S

### ORA-079 · `Pressable` con feedback de pulsado en propuestas
**Qué:** la fila no cambia de opacidad al pulsar; añadir `style={({pressed})…}`. **Dónde:** `src/app/oraculo.tsx:175`. **Impacto:** 2 · **Esfuerzo:** S

### ORA-080 · Animar la aparición de propuestas
**Qué:** `LayoutAnimation`/fade-in al renderizar el bloque de veredicto y misiones para reforzar el momento "el sistema responde". **Dónde:** `src/app/oraculo.tsx:163-200`. **Impacto:** 3 · **Esfuerzo:** M

### ORA-081 · Animar el check de selección
**Qué:** transición al marcar/desmarcar la caja (`boxOn`). **Dónde:** `src/app/oraculo.tsx:176-178`. **Impacto:** 2 · **Esfuerzo:** S

### ORA-082 · Scroll automático al bloque de propuestas
**Qué:** al recibir respuesta, hacer `scrollTo` al veredicto para que el usuario lo vea sin desplazar. **Dónde:** `src/app/oraculo.tsx:117,163`. **Impacto:** 3 · **Esfuerzo:** S

### ORA-083 · Feedback háptico al recibir propuestas y al aceptar
**Qué:** `expo-haptics` en éxito de consulta y de aceptación, coherente con feedback de juego. **Dónde:** `src/app/oraculo.tsx:65,100`. **Impacto:** 2 · **Esfuerzo:** S

### ORA-084 · Mostrar el objetivo consultado junto al veredicto
**Qué:** recordar qué objetivo generó el plan ("Plan para: correr una 10K"). **Dónde:** `src/app/oraculo.tsx:165-168`. **Impacto:** 2 · **Esfuerzo:** S

### ORA-085 · Botón "Nueva consulta" tras aceptar
**Qué:** acción explícita para limpiar y empezar otra, en vez de borrado implícito. **Dónde:** `src/app/oraculo.tsx:100-104`. **Impacto:** 2 · **Esfuerzo:** S

### ORA-086 · Permitir reconsultar conservando lo no aceptado
**Qué:** "Pídele más" que añada misiones nuevas sin perder las ya propuestas. **Dónde:** `src/app/oraculo.tsx:52-74`. **Impacto:** 3 · **Esfuerzo:** M

### ORA-087 · Vincular propuestas a una mazmorra (proyecto)
**Qué:** opción de crear las misiones dentro de una mazmorra/proyecto existente en lugar de misiones sueltas. **Dónde:** `src/app/oraculo.tsx:88-99`. **Impacto:** 3 · **Esfuerzo:** L

### ORA-088 · Botón flotante "Consultar al oráculo" desde otras pantallas
**Qué:** entrada rápida al oráculo desde misiones/sistema, no solo navegando al stack. **Dónde:** integración con `src/app/(tabs)`. **Impacto:** 2 · **Esfuerzo:** M

### ORA-089 · Recordar dispositivo: aviso de que la key no se sincroniza
**Qué:** nota visible "esta key vive solo aquí; si reinstalas, vuelve a pegarla". **Dónde:** `src/app/oraculo.tsx:127`. **Impacto:** 2 · **Esfuerzo:** S

### ORA-090 · Migrar key a almacenamiento seguro (expo-secure-store)
**Qué:** AsyncStorage no cifra; mover la API key a `expo-secure-store` (Keychain/Keystore). **Dónde:** `src/lib/oracle.ts:24-34`. **Impacto:** 4 · **Esfuerzo:** M

### ORA-091 · No prerellenar el input con la key completa
**Qué:** al cargar, en vez de `setKey(k)` con la key entera (`:40`), mostrar máscara y solo permitir reemplazo; reduce exposición. **Dónde:** `src/app/oraculo.tsx:38-42`. **Impacto:** 3 · **Esfuerzo:** S

### ORA-092 · Validar `apiKey` no vacío en `consult` con mensaje específico
**Qué:** unificar el chequeo de key con el de objetivo y enfocar el campo correcto. **Dónde:** `src/app/oraculo.tsx:52-61`. **Impacto:** 2 · **Esfuerzo:** S

### ORA-093 · Constante de URL y versión de API
**Qué:** extraer `'https://api.anthropic.com/v1/messages'` y `'2023-06-01'` a constantes nombradas. **Dónde:** `src/lib/oracle.ts:77,81`. **Impacto:** 1 · **Esfuerzo:** S

### ORA-094 · Centralizar el modelo y su tarifa
**Qué:** mapa `MODEL → {label, pricing}` para coste visible y selector. **Dónde:** `src/lib/oracle.ts:8`. **Impacto:** 2 · **Esfuerzo:** S

### ORA-095 · `anthropic-version` actualizable
**Qué:** revisar/centralizar la versión del header para futuras features (structured output). **Dónde:** `src/lib/oracle.ts:81`. **Impacto:** 1 · **Esfuerzo:** S

### ORA-096 · Telemetría local de consultas (contador)
**Qué:** llevar cuenta de cuántas consultas y coste acumulado del mes en AsyncStorage. **Dónde:** nuevo en `src/lib/oracle.ts`. **Impacto:** 2 · **Esfuerzo:** M

### ORA-097 · Aviso de coste estimado antes de consultar
**Qué:** mini-texto "cada consulta cuesta ~céntimos con tu key" cerca del botón. **Dónde:** `src/app/oraculo.tsx:154-160`. **Impacto:** 2 · **Esfuerzo:** S

### ORA-098 · Modo "explicar más" por propuesta
**Qué:** expandir el `reasoning` a una explicación más larga bajo demanda (segunda llamada). **Dónde:** `src/app/oraculo.tsx:187`. **Impacto:** 2 · **Esfuerzo:** L

### ORA-099 · Tono del sistema en errores
**Qué:** unificar todos los `Alert` con la voz sobria ("EL SISTEMA", mayúsculas) como en aceptación. **Dónde:** `src/app/oraculo.tsx:49,56,70,100,106`. **Impacto:** 2 · **Esfuerzo:** S

### ORA-100 · Reemplazar `Alert` nativos por `SystemWindow` modal
**Qué:** los `Alert.alert` rompen la estética; usar un modal propio con estilo NIVL. **Dónde:** `src/app/oraculo.tsx:49,56,70,100,106`. **Impacto:** 3 · **Esfuerzo:** L

### ORA-101 · Estado de error inline en vez de Alert efímero
**Qué:** mostrar el error de consulta en una `SystemWindow` roja persistente con botón "Reintentar". **Dónde:** `src/app/oraculo.tsx:69-71`. **Impacto:** 3 · **Esfuerzo:** M

### ORA-102 · Botón "Reintentar" tras error
**Qué:** acción directa para relanzar `consult` con el mismo objetivo. **Dónde:** `src/app/oraculo.tsx:69-71`. **Impacto:** 3 · **Esfuerzo:** S

### ORA-103 · Deshabilitar "Aceptar" mientras se aceptan
**Qué:** ya hay flag `accepting`, pero el `disabled` solo mira `selected.size`; añadir `|| accepting`. **Dónde:** `src/app/oraculo.tsx:191-196`. **Impacto:** 2 · **Esfuerzo:** S

### ORA-104 · Texto del botón Aceptar con singular/plural correcto
**Qué:** "Aceptar 1 misión" vs "Aceptar 3 misiones" en vez de "misión(es)". **Dónde:** `src/app/oraculo.tsx:192`. **Impacto:** 1 · **Esfuerzo:** S

### ORA-105 · Pluralización en el Alert de éxito
**Qué:** mismo arreglo de plural en "nueva(s) misión(es)". **Dónde:** `src/app/oraculo.tsx:100`. **Impacto:** 1 · **Esfuerzo:** S

### ORA-106 · Mostrar XP por propuesta de forma más legible
**Qué:** separar XP en su propio badge en vez de inline con puntos medios. **Dónde:** `src/app/oraculo.tsx:181-186`. **Impacto:** 2 · **Esfuerzo:** S

### ORA-107 · Color de stat en la propuesta
**Qué:** colorear el `stat` con el color asociado a esa stat para lectura rápida. **Dónde:** `src/app/oraculo.tsx:181`. **Impacto:** 2 · **Esfuerzo:** S

### ORA-108 · Iconografía por stat
**Qué:** icono pequeño junto al stat (pesa, manzana, libro…) para reconocimiento. **Dónde:** `src/app/oraculo.tsx:181`. **Impacto:** 2 · **Esfuerzo:** M

### ORA-109 · Vista previa del nivel/curva de XP del plan
**Qué:** mini-gráfico de cuánto XP/semana aporta el plan respecto al ritmo actual. **Dónde:** `src/app/oraculo.tsx:163-198`. **Impacto:** 3 · **Esfuerzo:** L

### ORA-110 · Indicar misiones que requieren evidencia con icono
**Qué:** si se habilita ORA-021, marcar visualmente las que dan bonus por evidencia. **Dónde:** `src/app/oraculo.tsx:179-188`. **Impacto:** 1 · **Esfuerzo:** S

### ORA-111 · Empty state cuando la IA no devuelve misiones
**Qué:** hoy se lanza error genérico (`oracle.ts:110`); mostrar UI amable "Reformula tu objetivo" con ejemplos. **Dónde:** `src/app/oraculo.tsx:69-71`. **Impacto:** 3 · **Esfuerzo:** S

### ORA-112 · Skeleton de propuestas mientras carga
**Qué:** mostrar placeholders de filas mientras `busy` para reducir salto de layout. **Dónde:** `src/app/oraculo.tsx:163`. **Impacto:** 2 · **Esfuerzo:** M

### ORA-113 · Persistir propuestas sin aceptar entre sesiones
**Qué:** si el usuario cierra la app con propuestas en pantalla, recuperarlas al volver. **Dónde:** `src/app/oraculo.tsx:31-33`. **Impacto:** 2 · **Esfuerzo:** M

### ORA-114 · Soporte de idioma del objetivo
**Qué:** instruir al modelo a responder en español aunque el objetivo venga en otro idioma (ya implícito, hacerlo explícito y robusto). **Dónde:** `src/lib/oracle.ts:67-74`. **Impacto:** 1 · **Esfuerzo:** S

### ORA-115 · Few-shot examples en el prompt
**Qué:** incluir 1–2 ejemplos objetivo→misiones para estabilizar formato y calidad. **Dónde:** `src/lib/oracle.ts:67-74`. **Impacto:** 3 · **Esfuerzo:** M

### ORA-116 · Recordar al modelo el tope de XP/día (150) en penalización
**Qué:** contextualizar la economía para que no proponga planes que choquen con los topes del juego. **Dónde:** `src/lib/oracle.ts:67-74`. **Impacto:** 2 · **Esfuerzo:** S

### ORA-117 · Prompt: pedir variedad de stats
**Qué:** instruir a no concentrar todas las misiones en una sola stat salvo que el objetivo lo exija. **Dónde:** `src/lib/oracle.ts:69-74`. **Impacto:** 2 · **Esfuerzo:** S

### ORA-118 · Prompt: rango de días coherente con la dificultad
**Qué:** evitar "épica 7 días/semana"; guiar frecuencia inversamente a la dureza. **Dónde:** `src/lib/oracle.ts:72-73`. **Impacto:** 2 · **Esfuerzo:** S

### ORA-119 · Cachear última respuesta por objetivo idéntico
**Qué:** si se reconsulta el mismo objetivo en X minutos, reutilizar sin gastar API. **Dónde:** `src/lib/oracle.ts:76`. **Impacto:** 2 · **Esfuerzo:** M

### ORA-120 · Debounce/disable mientras se teclea el objetivo
**Qué:** evitar renders innecesarios y permitir validación en vivo del largo mínimo. **Dónde:** `src/app/oraculo.tsx:149`. **Impacto:** 1 · **Esfuerzo:** S

### ORA-121 · `testID` en elementos clave para E2E
**Qué:** añadir `testID` a input de key, objetivo, botón consultar/aceptar y filas. **Dónde:** `src/app/oraculo.tsx:129,146,154,175,191`. **Impacto:** 2 · **Esfuerzo:** S

### ORA-122 · Memoizar `proposals.map`
**Qué:** envolver la lista en `useMemo`/`React.memo` por fila para no recomputar al teclear. **Dónde:** `src/app/oraculo.tsx:174-190`. **Impacto:** 1 · **Esfuerzo:** S

### ORA-123 · `useCallback` en `toggle`/`accept`/`consult`
**Qué:** estabilizar handlers para evitar re-render de hijos. **Dónde:** `src/app/oraculo.tsx:52,76,85`. **Impacto:** 1 · **Esfuerzo:** S

### ORA-124 · Evitar recrear `DAY_LABELS` en cada render
**Qué:** está dentro del componente (`:112`); sacarlo a módulo. **Dónde:** `src/app/oraculo.tsx:112`. **Impacto:** 1 · **Esfuerzo:** S

### ORA-125 · `keyboardShouldPersistTaps` ya está; añadir `keyboardDismissMode`
**Qué:** cerrar teclado al hacer scroll para ver propuestas largas. **Dónde:** `src/app/oraculo.tsx:117`. **Impacto:** 1 · **Esfuerzo:** S

### ORA-126 · Ajuste de `KeyboardAvoidingView` en Android
**Qué:** `behavior` es `undefined` en Android (`:116`); evaluar `height`/offset para que el botón no quede tapado. **Dónde:** `src/app/oraculo.tsx:116`. **Impacto:** 2 · **Esfuerzo:** S

### ORA-127 · Respetar safe area inferior
**Qué:** `edges={['top']}` solo; en dispositivos con gesture bar el contenido inferior puede pegarse. **Dónde:** `src/app/oraculo.tsx:115`. **Impacto:** 2 · **Esfuerzo:** S

### ORA-128 · Manejar foco al volver con la key ya cargada
**Qué:** si hay key, enfocar directamente el objetivo al entrar. **Dónde:** `src/app/oraculo.tsx:37-44`. **Impacto:** 2 · **Esfuerzo:** S

### ORA-129 · Indicar visualmente que la key está activa
**Qué:** badge "Key activa" cuando `keySaved`, para que el usuario sepa que puede consultar. **Dónde:** `src/app/oraculo.tsx:126-140`. **Impacto:** 2 · **Esfuerzo:** S

### ORA-130 · Mostrar el modelo en uso en la UI
**Qué:** texto discreto "Modelo: Haiku" para transparencia de coste/calidad. **Dónde:** `src/app/oraculo.tsx:142-161`. **Impacto:** 1 · **Esfuerzo:** S

### ORA-131 · Limitar longitud del objetivo enviado
**Qué:** truncar/avisar si el objetivo es enorme para no inflar tokens de entrada. **Dónde:** `src/lib/oracle.ts:88`, `src/app/oraculo.tsx:53`. **Impacto:** 2 · **Esfuerzo:** S

### ORA-132 · Sanitizar el objetivo (saltos de línea, control chars)
**Qué:** limpiar el `goal` antes de mandarlo. **Dónde:** `src/app/oraculo.tsx:65`, `src/lib/oracle.ts:88`. **Impacto:** 1 · **Esfuerzo:** S

### ORA-133 · Manejar JSON parcial/truncado con reparación
**Qué:** si `stop_reason='max_tokens'` y el JSON quedó cortado, intentar reparación tolerante antes de fallar. **Dónde:** `src/lib/oracle.ts:108`. **Impacto:** 2 · **Esfuerzo:** M

### ORA-134 · Limitar concurrencia de inserciones
**Qué:** si ORA-005 usa `allSettled`, evitar saturar Supabase enviando en lotes pequeños. **Dónde:** `src/app/oraculo.tsx:89-99`. **Impacto:** 1 · **Esfuerzo:** S

### ORA-135 · Mostrar progreso al aceptar varias misiones
**Qué:** indicador "Creando 3 de 5…" en vez de solo spinner del botón. **Dónde:** `src/app/oraculo.tsx:191-197`. **Impacto:** 2 · **Esfuerzo:** M

### ORA-136 · Deshacer la última aceptación
**Qué:** ofrecer "Deshacer" tras crear misiones (borrar las recién creadas). **Dónde:** `src/app/oraculo.tsx:100-104`. **Impacto:** 2 · **Esfuerzo:** M

### ORA-137 · Confirmar salida con propuestas sin aceptar
**Qué:** avisar al pulsar atrás si hay propuestas pendientes para no perderlas. **Dónde:** `src/app/oraculo.tsx:119`. **Impacto:** 2 · **Esfuerzo:** S

### ORA-138 · Documentar el contrato del oráculo en el módulo
**Qué:** ampliar el comentario de cabecera con el formato esperado y los modos de fallo. **Dónde:** `src/lib/oracle.ts:4-9`. **Impacto:** 1 · **Esfuerzo:** S

### ORA-139 · Tipar `days_of_week` como tupla validada
**Qué:** introducir un tipo/branding `DayOfWeek = 1..7` y validador para no usar `number[]` crudo. **Dónde:** `src/lib/oracle.ts:15`, `src/lib/types.ts`. **Impacto:** 2 · **Esfuerzo:** M

### ORA-140 · Normalizar y ordenar `days_of_week`
**Qué:** ordenar ascendente y eliminar duplicados antes de mostrar/guardar. **Dónde:** `src/lib/oracle.ts:109-112`, `src/app/oraculo.tsx:183-185`. **Impacto:** 2 · **Esfuerzo:** S

### ORA-141 · Mostrar "todos los días" también con 6/7 cercanos
**Qué:** copy más natural ("L–V", "fines de semana") en vez de listar letras siempre. **Dónde:** `src/app/oraculo.tsx:183-185`. **Impacto:** 2 · **Esfuerzo:** M

### ORA-142 · Soporte de tema/colores desde `theme.ts` sin literales
**Qué:** revisar que ningún color esté hardcodeado en estilos (actualmente usa `colors`, mantenerlo al añadir features). **Dónde:** `src/app/oraculo.tsx:207-258`. **Impacto:** 1 · **Esfuerzo:** S

### ORA-143 · Manejar key con espacios/pegada con saltos
**Qué:** `setApiKey` ya hace `trim()`, pero el input puede traer saltos internos al pegar; limpiar todos los whitespace. **Dónde:** `src/lib/oracle.ts:29-32`. **Impacto:** 2 · **Esfuerzo:** S

### ORA-144 · Evitar Alert de "Guardada" si no cambió nada
**Qué:** no mostrar confirmación si la key guardada es idéntica a la previa. **Dónde:** `src/app/oraculo.tsx:46-50`. **Impacto:** 1 · **Esfuerzo:** S

### ORA-145 · Distinguir "guardar" de "borrar" en el Alert
**Qué:** si el input está vacío, el Alert "Guardada" miente (borra); mensaje correcto según caso. **Dónde:** `src/app/oraculo.tsx:48-49`. **Impacto:** 2 · **Esfuerzo:** S

### ORA-146 · Mensaje cuando la API key es de formato correcto pero revocada
**Qué:** 401 ya da mensaje; añadir matiz "revocada o sin crédito" y enlace a facturación. **Dónde:** `src/lib/oracle.ts:94`. **Impacto:** 2 · **Esfuerzo:** S

### ORA-147 · Manejar 402/insufficient_quota específicamente
**Qué:** si la cuenta no tiene crédito, mensaje y enlace a billing en lugar del genérico. **Dónde:** `src/lib/oracle.ts:93-99`. **Impacto:** 2 · **Esfuerzo:** S

### ORA-148 · Registrar errores del oráculo para depurar
**Qué:** `console.warn`/log estructurado del status y cuerpo recortado para soporte. **Dónde:** `src/lib/oracle.ts:97-98`. **Impacto:** 1 · **Esfuerzo:** S

### ORA-149 · Evitar enviar `additionalProperties:false` si rompe el endpoint
**Qué:** tras migrar a tool use (ORA-001), revisar que el schema sea compatible con `input_schema`. **Dónde:** `src/lib/oracle.ts:36-65`. **Impacto:** 2 · **Esfuerzo:** S

### ORA-150 · Botón "Copiar plan" del veredicto
**Qué:** permitir copiar el `plan_summary` al portapapeles. **Dónde:** `src/app/oraculo.tsx:165-168`. **Impacto:** 1 · **Esfuerzo:** S

### ORA-151 · Compartir el plan
**Qué:** `Share.share` del resumen + misiones como texto. **Dónde:** `src/app/oraculo.tsx:165-198`. **Impacto:** 1 · **Esfuerzo:** S

### ORA-152 · Marcar visualmente propuestas ya existentes como duplicadas
**Qué:** si el título coincide con una quest activa, avisar antes de crear duplicado. **Dónde:** `src/app/oraculo.tsx:174-190`. **Impacto:** 3 · **Esfuerzo:** M

### ORA-153 · Permitir reordenar/priorizar propuestas
**Qué:** arrastrar para ordenar antes de aceptar (define orden de creación). **Dónde:** `src/app/oraculo.tsx:174-190`. **Impacto:** 1 · **Esfuerzo:** L

### ORA-154 · Tooltip/ayuda sobre qué es cada stat
**Qué:** info accesible explicando FUE/VIT/INT/AGI/PER al editar el stat de una propuesta. **Dónde:** `src/app/oraculo.tsx:181`. **Impacto:** 2 · **Esfuerzo:** S

### ORA-155 · Modo offline detectado
**Qué:** si no hay conexión (NetInfo), desactivar "Consultar" y avisar antes de intentar. **Dónde:** `src/app/oraculo.tsx:52-74`. **Impacto:** 2 · **Esfuerzo:** M

### ORA-156 · Limpiar timeout/listeners en desmontaje
**Qué:** tras añadir timeout/abort/streaming, garantizar limpieza en `useEffect`/al desmontar. **Dónde:** `src/app/oraculo.tsx:37`, `src/lib/oracle.ts:77`. **Impacto:** 2 · **Esfuerzo:** S

### ORA-157 · Evitar `JSON.stringify` pesado en cada consulta
**Qué:** memoizar el body estático (system/schema) para no reconstruirlo siempre. **Dónde:** `src/lib/oracle.ts:84-90`. **Impacto:** 1 · **Esfuerzo:** S

### ORA-158 · Validar que `selected` no contiene índices obsoletos al aceptar
**Qué:** `proposals[i]` ya se protege con `if (!p) continue`, pero conviene filtrar `selected` contra el length actual. **Dónde:** `src/app/oraculo.tsx:89-91`. **Impacto:** 1 · **Esfuerzo:** S

### ORA-159 · Mensaje de éxito con XP total ganado potencial
**Qué:** en el Alert de aceptación, indicar el XP/semana que suman las misiones creadas. **Dónde:** `src/app/oraculo.tsx:100`. **Impacto:** 2 · **Esfuerzo:** S

### ORA-160 · Internacionalizar strings a un módulo `copy`
**Qué:** centralizar los textos (hoy literales en JSX) para consistencia y futura edición de voz del sistema. **Dónde:** `src/app/oraculo.tsx` (varios). **Impacto:** 1 · **Esfuerzo:** M

### ORA-161 · Animación de "escaneo" del sistema al consultar
**Qué:** efecto visual temático (líneas de escaneo) durante `busy` para reforzar la fantasía Solo Leveling. **Dónde:** `src/app/oraculo.tsx:154-160`. **Impacto:** 2 · **Esfuerzo:** M

### ORA-162 · Sonido sutil al recibir el veredicto
**Qué:** efecto de sonido opcional al aparecer las propuestas, coherente con notificaciones del sistema. **Dónde:** `src/app/oraculo.tsx:65`. **Impacto:** 1 · **Esfuerzo:** M

### ORA-163 · Indicar número máximo recomendado de misiones activas
**Qué:** avisar si al aceptar se superaría un total saludable de misiones activas. **Dónde:** `src/app/oraculo.tsx:85-99`. **Impacto:** 2 · **Esfuerzo:** M

### ORA-164 · Validar `userId` antes de mostrar el bloque de aceptar
**Qué:** si no hay sesión, ocultar/deshabilitar "Aceptar" con aviso, no solo retornar en silencio (`:86`). **Dónde:** `src/app/oraculo.tsx:86,191-196`. **Impacto:** 2 · **Esfuerzo:** S

### ORA-165 · Probar comportamiento con `session` ausente
**Qué:** test de que la pantalla no crashea y guía al login si `userId` es undefined. **Dónde:** `src/app/oraculo.tsx:25-26`. **Impacto:** 2 · **Esfuerzo:** S

Total: 165 mejoras, 8 bugs.
