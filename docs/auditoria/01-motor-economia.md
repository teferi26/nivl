# Motor de juego: economía, niveles y fechas

> Área ENG · auditoría de código NIVL · anclada al código real

Archivos auditados: `src/lib/game.ts`, `src/lib/closing.ts`, `src/lib/dates.ts`, `src/lib/engine.ts`, `src/lib/__tests__/game.test.ts`, `src/lib/__tests__/closing.test.ts`. Consumidores revisados: `src/app/(tabs)/index.tsx`, `src/app/(tabs)/perfil.tsx`, `src/components/LevelUpOverlay.tsx`.

## Bugs y riesgos

### CRIT-ENG-01 · La barra de XP se desborda al llegar al nivel tope (999) — `game.ts:46-54` · severidad alta
**Problema:** `levelFromXp` deja de restar al alcanzar `level < 999`. Al llegar a 999 el bucle termina pero `rest` conserva TODO el XP sobrante. Verificado: con XP enorme devuelve `{level:999, into:5_000_000_000, next:3_157_535}` → `into/next ≈ 1583`. Esa razón alimenta directamente `<XPBar ratio={lvl.into / lvl.next}>` en `index.tsx:217` y `perfil.tsx:225`, y el texto `{lvl.into}/{lvl.next} XP` (index.tsx:220, perfil.tsx:227) muestra cifras absurdas. La barra se renderiza con ratio >1.
**Arreglo:** al tope, fijar el estado terminal: `if (level >= 999) return { level: 999, into: 0, next: 0 };` antes del `return`, o marcar `maxed: true`. Los consumidores deben tratar `next === 0` como barra llena (clamp del ratio a `[0,1]`).

### CRIT-ENG-02 · `streakMultiplier` premia/penaliza sin clamp inferior: racha negativa reduce el XP — `game.ts:67-69` · severidad media
**Problema:** `Math.min(1.5, 1 + 0.1*Math.floor(streakDays/7))` solo acota por arriba. Verificado: `streakMultiplier(-1)=0.9`, `(-7)=0.9`, `(-14)=0.8`. Si `streak_days` llegara a ser negativo (corrupción de datos, migración, edición manual en Supabase, o un futuro decremento), `questXp` (game.ts:81) multiplicaría el XP base por <1 y otorgaría MENOS XP del nominal sin que nada lo impida. No hay invariante que garantice `streak_days >= 0` a nivel de tipo ni de motor.
**Arreglo:** clampear la entrada: `const weeks = Math.max(0, Math.floor(streakDays / 7));` y usar `Math.min(1.5, 1 + 0.1 * weeks)`. Equivale a un `Math.max(1, …)` defensivo.

### CRIT-ENG-03 · `statPoints` devuelve puntos negativos con XP de stat negativo — `game.ts:71-73` · severidad media
**Problema:** `Math.floor(statXp / 100)`. Verificado: `statPoints(-1) = -1`, `statPoints(-50) = -1`. Las columnas `xp_fue…xp_per` se incrementan en `engine.ts` con read-modify-write sin tope inferior; una penalización mal aplicada o un dato corrupto puede dejarlas negativas y entonces `perfil.tsx:268` y `perfil.tsx:382` pintarían "-1" puntos de stat. Además `statPoints` ignora el caso `NaN` (columna nula).
**Arreglo:** `return Math.max(0, Math.floor((statXp || 0) / 100));`.

### CRIT-ENG-04 · `xpCostForLevel(0)` y entradas no enteras producen coste degenerado — `game.ts:42-44` · severidad baja
**Problema:** `Math.round(100 * Math.pow(level, 1.5))`. Verificado: `xpCostForLevel(0) = 0`. Si por refactor `levelFromXp` arrancara en `level = 0`, el bucle `while (rest >= 0)` nunca avanzaría XP (coste 0) y subiría niveles infinitamente hasta el tope. Con `level` fraccionario `Math.pow` no falla pero da costes sin sentido. No hay guard de dominio (`level >= 1`, entero).
**Arreglo:** `if (!Number.isInteger(level) || level < 1) return Number.POSITIVE_INFINITY;` (o lanzar en dev). Documentar el contrato "level entero ≥ 1".

### CRIT-ENG-05 · `addDays` acepta `n` no entero y lo trunca en silencio — `dates.ts:13-17` · severidad baja
**Problema:** `date.setDate(date.getDate() + n)` con `n` fraccionario: verificado `addDays("2026-06-08", 0.5)` → `"2026-06-08"` (sin cambio). Cualquier llamador que pase un float por error (cálculo de offset) avanzará 0 días sin aviso, y en `engine.ts:37` (`addDays(last_day_processed, 1)`) o `index.tsx` un día "perdido" desplazaría todo el cierre.
**Arreglo:** normalizar: `date.setDate(date.getDate() + Math.trunc(n))` y, en dev, `console.warn` si `n !== Math.trunc(n)`.

### CRIT-ENG-06 · `parseKey` no valida el formato: claves corruptas dan `Invalid Date` silencioso — `dates.ts:8-11` · severidad media
**Problema:** `key.split('-').map(Number)` sin validar longitud ni `NaN`. Una clave mal formada (`"2026-6-8"` sin pad, `""`, `null` casteado, o un string venido de Supabase con hora) produce un `Date` inválido o desplazado, y `dateKey(Invalid Date)` devuelve `"NaN-NaN-NaN"`, que luego rompe comparaciones de string (`day < today` en closing.ts:48) silenciosamente. `weekdayOfKey` sobre fecha inválida da `NaN` → `days_of_week.includes(NaN)` siempre false → misiones nunca programadas.
**Arreglo:** validar con regex `^\d{4}-\d{2}-\d{2}$` y `Number.isFinite` los tres componentes; lanzar o devolver `null` controlado. Centralizar un `isValidKey()`.

### CRIT-ENG-07 · Cierre de día: races read-modify-write sobre el perfil (XP/racha/piedras) — `engine.ts:51-66` · severidad alta
**Problema:** `processPendingDays` lee `profile.xp_total`, calcula `newTotal = max(0, xp_total - penaltyXp)` y escribe el valor absoluto con `updateProfile` (engine.ts:52-66). En paralelo, `completeQuest` (engine.ts:138) y `awardXp` (engine.ts:173) hacen lo mismo: leen `profile.xp_total`, suman y escriben el absoluto. Si el cierre y una completación ocurren casi a la vez (app reabierta + tap rápido, o dos pantallas), la última escritura PISA a la otra: se pierde XP ganado o no se aplica la penalización. Lo mismo con `streak_days`, `protection_stones` y las columnas de stat. Es el "DATO CLAVE" del proyecto, y aquí se materializa en el motor.
**Arreglo:** mover las mutaciones a RPC atómicas en Postgres (`xp_total = xp_total + delta` con `GREATEST(0, …)`), o a un trigger que recalcule desde `completions`/eventos. Mientras tanto, serializar cierre y completación con un lock en cliente y revalidar el perfil antes de escribir.

### CRIT-ENG-08 · `completeQuest` usa la racha PRE-cierre para el multiplicador y registra `level_up` con el total viejo — `engine.ts:127, 145-146` · severidad media
**Problema:** En `completeQuest`, `questXp` se llama con `streakDays: profile.streak_days` (engine.ts:127) y el cálculo de nivel usa `profile.xp_total` "before" (engine.ts:145-146). Si el usuario no ha disparado el cierre del día (no se ha abierto la home / `processPendingDays` no corrió), `profile.streak_days` puede estar desactualizado respecto al día real: se otorga XP con multiplicador de una racha que quizá ya se rompió, o se pierde el bonus de una racha que ya subió. No hay garantía de orden "cerrar antes de completar".
**Arreglo:** invocar/garantizar `processPendingDays` antes de permitir completar (o recargar el perfil), y derivar `streakDays` y el nivel del perfil ya cerrado. Idealmente, calcular el XP server-side donde la racha es la verdad.

### CRIT-ENG-09 · El bucle de cierre es O(días·misiones) sin cota y reevalúa `questsScheduledOn` cada día — `closing.ts:48-83` · severidad baja
**Problema:** `while (day < input.today)` itera un día por iteración desde `fromDate`. Verificado: un hueco de 6 años = 2356 iteraciones, y en cada una `questsScheduledOn` recorre TODAS las misiones (closing.ts:55) y `completedKeys.has` se evalúa por misión. Tras una desinstalación/pausa larga o `last_day_processed` muy antiguo, el cierre recorre cientos/miles de días en el hilo JS al abrir la app, con jank perceptible. No hay tope de "días a procesar de golpe".
**Arreglo:** acotar el horizonte (p.ej. procesar como mucho N días y colapsar el resto como "días perdidos" sin penalización retroactiva), o precomputar por día de la semana el set de misiones programadas (7 buckets) en vez de filtrar dentro del bucle.

### CRIT-ENG-10 · La expiración de la congelación queda atrapada por el guard `last_day_processed >= yesterday` — `engine.ts:33, 62-65` · severidad media
**Problema:** Si `last_day_processed >= yesterday`, `processPendingDays` retorna pronto (engine.ts:33-35) sin tocar `freeze_until`. La limpieza de la congelación vencida solo ocurre en el camino del cierre (engine.ts:62-65). Resultado: una congelación cuyo último día ya pasó pero cuyo `last_day_processed` ya está al día (porque el cierre corrió antes de que `freeze_until` venciera, o se editó a mano) puede quedar con `freeze_until` pasado sin limpiarse hasta el próximo día con hueco. La UI (`index.tsx:179`, `perfil.tsx:187`) usa `freeze_until >= today` para "frozen", así que el estado visual es correcto, pero el campo en BD queda sucio y `freeze_reason` persiste.
**Arreglo:** limpiar `freeze_until`/`freeze_reason` vencidos en una rama independiente del guard de días (al inicio de `processPendingDays`, siempre que `freeze_until && freeze_until < today`), no solo dentro del cierre.

### CRIT-ENG-11 · Cambio de día a medianoche / zona horaria: `dateKey` depende de la hora local del dispositivo sin congelar el "hoy" — `dates.ts:1-6`, `engine.ts:121` · severidad media
**Problema:** Todo el "hoy" sale de `dateKey(new Date())` en hora LOCAL. Dos riesgos reales: (1) si el usuario completa una misión a las 23:59:59 y la escritura llega tras medianoche, `today` en `completeQuest` (engine.ts:121) puede calcularse con el día ya cambiado, guardando la completación en el día equivocado y descuadrando el cierre. (2) Viajar de zona horaria mueve la frontera del día: una racha puede romperse o duplicarse según el huso. No hay un concepto de "día de juego" anclado (p.ej. medianoche local fija o un offset configurable).
**Arreglo:** capturar `today` una sola vez por operación y, a futuro, anclar el día de juego a una zona horaria persistida en el perfil (o a un "día empieza a las HH"). Documentar el contrato de medianoche.

### CRIT-ENG-12 · `freezeUntil` con formato/longitud distinta rompe la comparación `day <= freezeUntil` — `closing.ts:49` · severidad baja
**Problema:** La congelación se compara como string: `day <= input.freezeUntil` (closing.ts:49). Es correcto SOLO si ambos son `YYYY-MM-DD` con cero-padding idéntico. Si `freeze_until` llegara de Supabase como timestamp (`2026-06-10T00:00:00`) o sin pad, la comparación lexicográfica daría resultados erróneos (un timestamp `"2026-06-10T..."` es `>` que `"2026-06-10"`), congelando un día de más. No hay normalización al entrar.
**Arreglo:** normalizar `freezeUntil` a clave de 10 chars al construir `CloseInput` (`freezeUntil?.slice(0,10)`), o validar con la regex de CRIT-ENG-06.

## Mejoras

### ENG-001 · Estado terminal explícito de nivel
**Qué:** `levelFromXp` debe devolver `into:0, next:0` (o `maxed:true`) en el nivel 999 para que la barra no se desborde. **Dónde:** `game.ts:46-54`. **Impacto:** 5 · **Esfuerzo:** S

### ENG-002 · Clamp inferior del multiplicador de racha
**Qué:** Acotar `Math.max(0, Math.floor(streakDays/7))` para que una racha negativa nunca baje el XP de 1×. **Dónde:** `game.ts:67-69`. **Impacto:** 4 · **Esfuerzo:** S

### ENG-003 · `statPoints` no negativo y resistente a NaN
**Qué:** `Math.max(0, Math.floor((statXp||0)/100))`. **Dónde:** `game.ts:71-73`. **Impacto:** 3 · **Esfuerzo:** S

### ENG-004 · Guard de dominio en `xpCostForLevel`
**Qué:** Rechazar `level < 1` o no entero (devolver Infinity o lanzar en dev). **Dónde:** `game.ts:42-44`. **Impacto:** 3 · **Esfuerzo:** S

### ENG-005 · `addDays` trunca `n` y avisa
**Qué:** `Math.trunc(n)` + warn en dev si llega fraccionario. **Dónde:** `dates.ts:13-17`. **Impacto:** 3 · **Esfuerzo:** S

### ENG-006 · Validar formato en `parseKey`
**Qué:** Regex `^\d{4}-\d{2}-\d{2}$` y `Number.isFinite` de los componentes; lanzar/`null` controlado. **Dónde:** `dates.ts:8-11`. **Impacto:** 4 · **Esfuerzo:** S

### ENG-007 · Helper `isValidKey()` reutilizable
**Qué:** Centralizar la validación de claves de fecha y usarla en dates/closing/engine. **Dónde:** `dates.ts`. **Impacto:** 3 · **Esfuerzo:** S

### ENG-008 · Mutaciones de XP atómicas vía RPC
**Qué:** Sustituir read-modify-write por `xp_total = GREATEST(0, xp_total + delta)` server-side. **Dónde:** `engine.ts:52-66,138,173`. **Impacto:** 5 · **Esfuerzo:** L

### ENG-009 · Lock de cliente entre cierre y completación
**Qué:** Serializar `processPendingDays`/`completeQuest`/`awardXp` con un mutex en memoria mientras no haya RPC. **Dónde:** `engine.ts`. **Impacto:** 4 · **Esfuerzo:** M

### ENG-010 · Recargar perfil antes de escribir XP
**Qué:** Revalidar `xp_total`/`streak_days` justo antes del patch para reducir pérdidas por race. **Dónde:** `engine.ts:138-143,173-178`. **Impacto:** 3 · **Esfuerzo:** M

### ENG-011 · Garantizar cierre antes de completar
**Qué:** Llamar/forzar `processPendingDays` antes de permitir `completeQuest` para que la racha sea la del día real. **Dónde:** `engine.ts:115-127`. **Impacto:** 4 · **Esfuerzo:** M

### ENG-012 · Limpieza de congelación fuera del guard de días
**Qué:** Borrar `freeze_until/reason` vencidos al inicio de `processPendingDays`, no solo en el cierre. **Dónde:** `engine.ts:33,62-65`. **Impacto:** 3 · **Esfuerzo:** S

### ENG-013 · Normalizar `freezeUntil` a 10 caracteres
**Qué:** `freeze_until?.slice(0,10)` al construir `CloseInput` para comparación lexicográfica segura. **Dónde:** `engine.ts:48`, `closing.ts:49`. **Impacto:** 3 · **Esfuerzo:** S

### ENG-014 · Capturar `today` una sola vez por operación
**Qué:** Evitar múltiples `dateKey()` que podrían caer en días distintos al cruzar medianoche. **Dónde:** `engine.ts:27,121`. **Impacto:** 3 · **Esfuerzo:** S

### ENG-015 · Concepto de "día de juego" anclado a zona horaria
**Qué:** Persistir TZ/offset de inicio de día en el perfil y derivar el día de ahí. **Dónde:** `dates.ts`, `types.ts:Profile`. **Impacto:** 4 · **Esfuerzo:** L

### ENG-016 · Cota de días procesados por cierre
**Qué:** Limitar a N días por ejecución y colapsar el resto sin penalización retroactiva. **Dónde:** `closing.ts:48`. **Impacto:** 3 · **Esfuerzo:** M

### ENG-017 · Buckets de misiones por día de semana
**Qué:** Precomputar 7 listas (lun..dom) en vez de filtrar `questsScheduledOn` dentro del bucle. **Dónde:** `closing.ts:55`. **Impacto:** 3 · **Esfuerzo:** M

### ENG-018 · Tope inferior de XP a nivel de motor
**Qué:** Centralizar `GREATEST(0, …)` para todas las columnas (no solo `xp_total`) y evitar negativos. **Dónde:** `engine.ts:52,138,173`. **Impacto:** 4 · **Esfuerzo:** M

### ENG-019 · Penalización también debería restar de las columnas de stat
**Qué:** Hoy la penalización solo baja `xp_total` (engine.ts:52); las stats no se ajustan, así que `level` y "puntos de stat" se desincronizan. Decidir y unificar. **Dónde:** `engine.ts:52-66`. **Impacto:** 3 · **Esfuerzo:** M

### ENG-020 · Documentar invariante `streak_days >= 0`
**Qué:** Comentario + check en escritura: la racha nunca baja de 0. **Dónde:** `closing.ts:72`, `types.ts:17`. **Impacto:** 2 · **Esfuerzo:** S

### ENG-021 · Documentar invariante `0 <= stones <= MAX_STONES`
**Qué:** Asegurar el rango al escribir piedras; clamp defensivo. **Dónde:** `closing.ts:61-68`, `engine.ts:58`. **Impacto:** 2 · **Esfuerzo:** S

### ENG-022 · Clamp del ratio de la XPBar en consumidores
**Qué:** `Math.min(1, Math.max(0, into/next))` y guardar contra `next===0`. **Dónde:** `index.tsx:217`, `perfil.tsx:225`. **Impacto:** 4 · **Esfuerzo:** S

### ENG-023 · `rankForLevel` con fronteras como constantes
**Qué:** Extraer los umbrales (10/25/45/70/99) a una tabla declarativa reutilizable y testeable. **Dónde:** `game.ts:58-65`. **Impacto:** 2 · **Esfuerzo:** S

### ENG-024 · Coherencia rango-de-cazador vs rango-de-mazmorra
**Qué:** `Rank` (E..S por nivel) y `DungeonRank` (E..S) comparten letras pero significan cosas distintas; documentar o unificar el tipo. **Dónde:** `game.ts:56,93`, `types.ts:5`. **Impacto:** 2 · **Esfuerzo:** S

### ENG-025 · `questXp` debería redondear de forma consistente con la penalización
**Qué:** `questXp` usa `Math.round` (game.ts:81) y la penalización también (closing.ts:76); verificar que ganancia y devolución cuadran exactamente (evidencia cambia el base). **Dónde:** `game.ts:77-82`, `closing.ts:76`. **Impacto:** 3 · **Esfuerzo:** S

### ENG-026 · Penalización proporcional al XP realmente otorgado
**Qué:** La penalización es 50% del XP BASE por dificultad (closing.ts:76), pero la misión pudo otorgar más por evidencia/racha; decidir si el "daño" debe referirse al XP base o al ganado. **Dónde:** `closing.ts:74-79`. **Impacto:** 3 · **Esfuerzo:** M

### ENG-027 · Tope de daño diario configurable por rango/nivel
**Qué:** `DAILY_PENALTY_CAP` fijo en 150; escalar con el nivel para que a nivel alto no sea trivial. **Dónde:** `game.ts:86`. **Impacto:** 2 · **Esfuerzo:** M

### ENG-028 · Evitar penalización mayor que el XP disponible
**Qué:** `newTotal = max(0, …)` recorta, pero conviene reflejar en el resultado el daño REAL aplicado (no el calculado) para el mensaje. **Dónde:** `engine.ts:52,68-81`. **Impacto:** 3 · **Esfuerzo:** S

### ENG-029 · `levelsLost` puede ser engañoso si XP llega a 0
**Qué:** `Math.max(0, levelBefore - levelAfter)` (engine.ts:98) es correcto, pero a XP=0 el "nivel perdido" puede ser grande; mostrar con cuidado. **Dónde:** `engine.ts:98`. **Impacto:** 2 · **Esfuerzo:** S

### ENG-030 · Exponer `maxed` en `levelFromXp` para la UI
**Qué:** Bandera para que index/perfil muestren "NIVEL MÁX" en vez de "X/Y XP para nivel 1000". **Dónde:** `game.ts:46-54`, `index.tsx:220`, `perfil.tsx:227`. **Impacto:** 3 · **Esfuerzo:** S

### ENG-031 · Texto "para el nivel N+1" incorrecto al tope
**Qué:** En perfil.tsx:227 muestra `lvl.level + 1` → "nivel 1000" inexistente al tope. **Dónde:** `perfil.tsx:227`. **Impacto:** 3 · **Esfuerzo:** S

### ENG-032 · `DUNGEON_CLEAR_XP` y `XP_BY_DIFFICULTY` en una sola fuente de balance
**Qué:** Documentar la relación (botín S = 600 ≈ 2 días) como prueba de balance viva. **Dónde:** `game.ts:93-100`. **Impacto:** 2 · **Esfuerzo:** S

### ENG-033 · `dungeonTaskXp` no aplica `Math.round`
**Qué:** Devuelve producto entero (ok hoy), pero si `BOSS_MULTIPLIER` se hiciera fraccionario daría decimales; blindar con round. **Dónde:** `game.ts:103-105`. **Impacto:** 1 · **Esfuerzo:** S

### ENG-034 · Validar `difficulty` desconocida en `XP_BY_DIFFICULTY`
**Qué:** Acceso por índice sin fallback: una dificultad fuera del enum da `undefined` → `NaN` en cálculos. **Dónde:** `game.ts:79,104`, `closing.ts:76`. **Impacto:** 3 · **Esfuerzo:** S

### ENG-035 · `questXp` para penalización: `penalty_xp ?? 0` silencioso
**Qué:** Si `is_penalty` y `penalty_xp` es null, otorga 0 sin avisar; loggear/validar el dato. **Dónde:** `game.ts:78`. **Impacto:** 2 · **Esfuerzo:** S

### ENG-036 · `EVIDENCE_BONUS`/`PENALTY_FACTOR` como porcentaje documentado
**Qué:** Añadir JSDoc con el significado y rango esperado (0..1). **Dónde:** `game.ts:39-40`. **Impacto:** 1 · **Esfuerzo:** S

### ENG-037 · Constante para el separador de `completedKeys`
**Qué:** `${date}|${id}` aparece en engine.ts:39 y closing.ts:56; extraer `keyFor(date,id)` para evitar drift. **Dónde:** `engine.ts:39`, `closing.ts:56`. **Impacto:** 3 · **Esfuerzo:** S

### ENG-038 · Riesgo de colisión en la clave `date|questId`
**Qué:** Si un título o id contuviera `|` no hay colisión hoy (ids UUID), pero documentar el supuesto. **Dónde:** `closing.ts:56`. **Impacto:** 1 · **Esfuerzo:** S

### ENG-039 · `isoWeekday` testear el domingo
**Qué:** Asegurar con test que `getDay()===0` → 7. **Dónde:** `dates.ts:20-22`. **Impacto:** 2 · **Esfuerzo:** S

### ENG-040 · `weekdayOfKey` robusto ante clave inválida
**Qué:** Hoy devuelve NaN; decidir comportamiento (lanzar) tras ENG-006. **Dónde:** `dates.ts:24-26`. **Impacto:** 2 · **Esfuerzo:** S

### ENG-041 · `formatLongDate` fija locale 'es-ES'
**Qué:** Extraer locale a constante para futura i18n aunque hoy sea mono-idioma. **Dónde:** `dates.ts:28-31`. **Impacto:** 1 · **Esfuerzo:** S

### ENG-042 · `dateKey` aceptar fecha inválida con guard
**Qué:** Si `d` es Invalid Date, hoy produce "NaN-NaN-NaN"; devolver error controlado. **Dónde:** `dates.ts:1-6`. **Impacto:** 2 · **Esfuerzo:** S

### ENG-043 · Función `daysBetween(a,b)` reutilizable
**Qué:** Calcular distancia en días sin bucle (para cota de cierre y métricas). **Dónde:** `dates.ts`. **Impacto:** 2 · **Esfuerzo:** S

### ENG-044 · `addDays` negativo testeado
**Qué:** `engine.ts:30` usa `addDays(today,-1)`; cubrir n negativos y cruce de mes/año. **Dónde:** `dates.ts:13-17`. **Impacto:** 2 · **Esfuerzo:** S

### ENG-045 · Memoizar `xpCostForLevel`
**Qué:** `levelFromXp` lo llama O(level) veces por render; cachear costes acumulados. **Dónde:** `game.ts:42-54`. **Impacto:** 2 · **Esfuerzo:** M

### ENG-046 · `levelFromXp` por búsqueda binaria sobre prefijos
**Qué:** Sustituir el bucle lineal por tabla de XP acumulado + binaria → O(log n). **Dónde:** `game.ts:46-54`. **Impacto:** 3 · **Esfuerzo:** M

### ENG-047 · Tabla de XP acumulado precomputada
**Qué:** Generar al cargar el array de XP total por nivel (1..999) una vez. **Dónde:** `game.ts`. **Impacto:** 2 · **Esfuerzo:** M

### ENG-048 · Exponer `xpForLevel(level)` (XP total para alcanzar un nivel)
**Qué:** Útil para "te faltan X para nivel N" y para tests de curva. **Dónde:** `game.ts`. **Impacto:** 2 · **Esfuerzo:** S

### ENG-049 · Validar monotonía de la curva en runtime (dev assert)
**Qué:** Assert en dev de que `xpCostForLevel` es creciente (hoy solo en test hasta 60). **Dónde:** `game.ts:42-44`. **Impacto:** 1 · **Esfuerzo:** S

### ENG-050 · Test de curva hasta el tope 999
**Qué:** El test de monotonía solo cubre 1..60 (game.test.ts:41); extender a 999. **Dónde:** `game.test.ts:40-44`. **Impacto:** 3 · **Esfuerzo:** S

### ENG-051 · Test del estado terminal de nivel
**Qué:** Cubrir `levelFromXp(XP_enorme)` → `level=999, into/next acotados`. **Dónde:** `game.test.ts`. **Impacto:** 4 · **Esfuerzo:** S

### ENG-052 · Test de `levelFromXp` con XP negativo
**Qué:** `levelFromXp(-100)` debe dar nivel 1, into 0 (hoy lo hace por `Math.max(0,…)` pero sin test). **Dónde:** `game.test.ts`. **Impacto:** 3 · **Esfuerzo:** S

### ENG-053 · Test de `streakMultiplier` con racha negativa
**Qué:** Fijar contrato (≥1) tras ENG-002. **Dónde:** `game.test.ts:69-78`. **Impacto:** 3 · **Esfuerzo:** S

### ENG-054 · Test de fronteras exactas del multiplicador (días 6/7/13/14)
**Qué:** Cubrir off-by-one del `Math.floor(streakDays/7)` en cada salto. **Dónde:** `game.test.ts:69-78`. **Impacto:** 3 · **Esfuerzo:** S

### ENG-055 · Test del tope ×1,5 justo en 35 y 36 días
**Qué:** Asegurar que en 35 ya está al tope y no sube en 36+. **Dónde:** `game.test.ts:75`. **Impacto:** 2 · **Esfuerzo:** S

### ENG-056 · Test de `statPoints` negativo y NaN
**Qué:** Cubrir entradas <0 y null tras ENG-003. **Dónde:** `game.test.ts:112-118`. **Impacto:** 3 · **Esfuerzo:** S

### ENG-057 · Test de `rankForLevel` en niveles 0 y >999
**Qué:** Comportamiento en `level=0` (hoy 'E') y `level=1000` ('S'); fijar contrato. **Dónde:** `game.test.ts:53-67`. **Impacto:** 2 · **Esfuerzo:** S

### ENG-058 · Test de `questXp` con evidencia + racha al tope
**Qué:** Combinar `evidence:true, streakDays:35` y verificar redondeo. **Dónde:** `game.test.ts:80-98`. **Impacto:** 3 · **Esfuerzo:** S

### ENG-059 · Test de `questXp` para cada dificultad
**Qué:** Hoy solo media/épica (game.test.ts:82-83); cubrir trivial/facil/dificil. **Dónde:** `game.test.ts:80-84`. **Impacto:** 3 · **Esfuerzo:** S

### ENG-060 · Test de `dungeonTaskXp` para todas las dificultades y jefe
**Qué:** Cubrir la matriz dificultad × isBoss. **Dónde:** `game.test.ts:100-110`. **Impacto:** 2 · **Esfuerzo:** S

### ENG-061 · Test de monotonía de `DUNGEON_CLEAR_XP`
**Qué:** Verificar E<D<C<B<A<S explícitamente (hoy solo E<S). **Dónde:** `game.test.ts:106-109`. **Impacto:** 2 · **Esfuerzo:** S

### ENG-062 · Test: penalización exacta = mitad del base por dificultad
**Qué:** Para cada dificultad, `round(base*0.5)` y su tope. **Dónde:** `closing.test.ts:93-107`. **Impacto:** 3 · **Esfuerzo:** S

### ENG-063 · Test del tope de daño con mezcla de dificultades
**Qué:** Hoy solo 3 épicas (closing.test.ts:126-140); probar combinaciones que rocen 150. **Dónde:** `closing.test.ts:126-140`. **Impacto:** 3 · **Esfuerzo:** S

### ENG-064 · Test: piedra NO suma racha pero la mantiene
**Qué:** Verificar que tras usar piedra `streak` no incrementa (closing.ts:65-69). **Dónde:** `closing.test.ts:109-124`. **Impacto:** 3 · **Esfuerzo:** S

### ENG-065 · Test: varios días fallados consecutivos sin piedras
**Qué:** Penalización acumulada día a día y racha a 0 desde el primero. **Dónde:** `closing.test.ts`. **Impacto:** 3 · **Esfuerzo:** S

### ENG-066 · Test: día sin misiones programadas no toca racha
**Qué:** `scheduled.length===0` (closing.ts:58) ni suma ni rompe; falta cobertura. **Dónde:** `closing.test.ts`. **Impacto:** 4 · **Esfuerzo:** S

### ENG-067 · Test: forja de piedra al cruzar 14, 21 días
**Qué:** Hoy solo el día 7 (closing.test.ts:66); cubrir múltiplos sucesivos y el tope. **Dónde:** `closing.test.ts:66-91`. **Impacto:** 3 · **Esfuerzo:** S

### ENG-068 · Test: piedra ganada y gastada en el mismo cierre
**Qué:** Secuencia perfecto(×7)→fallo; ver `stonesEarned` y `stonesUsed` juntos. **Dónde:** `closing.test.ts`. **Impacto:** 3 · **Esfuerzo:** S

### ENG-069 · Test: congelación parcial (algunos días dentro, otros fuera)
**Qué:** `freezeUntil` a mitad del rango: días previos congelados, posteriores evaluados. **Dónde:** `closing.test.ts:142-155`. **Impacto:** 4 · **Esfuerzo:** S

### ENG-070 · Test: `freezeUntil` exactamente igual a un día (`day <= freezeUntil`)
**Qué:** Verificar inclusividad del límite. **Dónde:** `closing.test.ts:142-155`. **Impacto:** 3 · **Esfuerzo:** S

### ENG-071 · Test: penalización pendiente fallada no genera otra (regresión)
**Qué:** Reforzar closing.test.ts:172-190 con racha y piedras presentes. **Dónde:** `closing.test.ts:172-190`. **Impacto:** 2 · **Esfuerzo:** S

### ENG-072 · Test: misión inactiva en medio del rango
**Qué:** `q.active===false` no cuenta ningún día (closing.ts:11). **Dónde:** `closing.test.ts:42-46`. **Impacto:** 2 · **Esfuerzo:** S

### ENG-073 · Test de `questsScheduledOn` para los 7 días de la semana
**Qué:** Matriz completa lun..dom incluida la frontera domingo=7. **Dónde:** `closing.test.ts:28-46`. **Impacto:** 3 · **Esfuerzo:** S

### ENG-074 · Test: `fromDate === today` no itera (cero días)
**Qué:** Caso límite del bucle `while (day < today)`. **Dónde:** `closing.test.ts`. **Impacto:** 2 · **Esfuerzo:** S

### ENG-075 · Test: rango que cruza cambio de mes y de año
**Qué:** `fromDate` 2025-12-30 → today 2026-01-02 con misiones diarias. **Dónde:** `closing.test.ts`. **Impacto:** 3 · **Esfuerzo:** S

### ENG-076 · Test: rango sobre 29-feb (año bisiesto)
**Qué:** Cierre que incluye 2024-02-29; verificar que no se salta ni duplica el día. **Dónde:** `closing.test.ts`. **Impacto:** 3 · **Esfuerzo:** S

### ENG-077 · Tests de `dates.ts` (no existen)
**Qué:** Crear `dates.test.ts` cubriendo dateKey/parseKey/addDays/isoWeekday/weekdayOfKey. **Dónde:** `src/lib/__tests__/`. **Impacto:** 4 · **Esfuerzo:** M

### ENG-078 · Test: `addDays` cruza DST (si TZ lo aplica)
**Qué:** Verificar que sumar días no se desplaza una hora en cambios de horario. **Dónde:** `dates.test.ts`. **Impacto:** 3 · **Esfuerzo:** M

### ENG-079 · Test: `dateKey` de medianoche local
**Qué:** Fechas a 23:59 y 00:00 dan el día esperado. **Dónde:** `dates.test.ts`. **Impacto:** 3 · **Esfuerzo:** S

### ENG-080 · Tests de `engine.ts` con Supabase mockeado
**Qué:** No hay tests de `processPendingDays`/`completeQuest`/`awardXp`; mockear `data.ts`/`supabase`. **Dónde:** `src/lib/__tests__/`. **Impacto:** 5 · **Esfuerzo:** L

### ENG-081 · Test: `processPendingDays` con `last_day_processed` null (primer arranque)
**Qué:** Verificar que solo fija `last_day_processed=ayer` y no penaliza. **Dónde:** `engine.ts:29-32`. **Impacto:** 3 · **Esfuerzo:** S

### ENG-082 · Test: `last_day_processed >= yesterday` retorna sin cambios
**Qué:** Idempotencia del cierre el mismo día. **Dónde:** `engine.ts:33-35`. **Impacto:** 3 · **Esfuerzo:** S

### ENG-083 · Test: doble ejecución de cierre el mismo día no duplica penalización
**Qué:** Llamar dos veces seguidas y verificar una sola misión de penalización. **Dónde:** `engine.ts:22-105`. **Impacto:** 4 · **Esfuerzo:** M

### ENG-084 · Test: `newTotal` nunca baja de 0
**Qué:** Penalización > xp_total deja 0 (engine.ts:52). **Dónde:** `engine.ts:52`. **Impacto:** 3 · **Esfuerzo:** S

### ENG-085 · Test: `levelsLost` correcto al cruzar fronteras de nivel
**Qué:** Penalización que baja exactamente un nivel. **Dónde:** `engine.ts:98`. **Impacto:** 2 · **Esfuerzo:** S

### ENG-086 · Test: `completeQuest` otorga XP y sube nivel
**Qué:** Verificar `leveledUp`/`newLevel` y patch de columna de stat. **Dónde:** `engine.ts:115-163`. **Impacto:** 3 · **Esfuerzo:** M

### ENG-087 · Test: `completeQuest` de penalización no toca columnas de stat
**Qué:** `is_penalty` salta el incremento de stat (engine.ts:139-142). **Dónde:** `engine.ts:139`. **Impacto:** 3 · **Esfuerzo:** S

### ENG-088 · Test: `awardXp` con `stat=null` solo suma total
**Qué:** Mazmorra/diario sin stat asociada. **Dónde:** `engine.ts:166-187`. **Impacto:** 2 · **Esfuerzo:** S

### ENG-089 · Test: expiración de congelación limpia `freeze_until/reason`
**Qué:** Cubrir engine.ts:62-65 y el caso atrapado de CRIT-ENG-10. **Dónde:** `engine.ts:62-65`. **Impacto:** 3 · **Esfuerzo:** S

### ENG-090 · Mensaje del sistema cuando se forja una piedra en el cierre
**Qué:** `stonesEarned>0` ya emite evento (engine.ts:85); asegurar feedback visible al usuario. **Dónde:** `engine.ts:85-87`, `index.tsx`. **Impacto:** 3 · **Esfuerzo:** S

### ENG-091 · Diferenciar visualmente "piedra usada" de "racha perdida"
**Qué:** El cierre puede usar piedra (racha sobrevive) o perderla; el resultado debe comunicar ambos claramente. **Dónde:** `engine.ts:92-102`, `index.tsx`. **Impacto:** 3 · **Esfuerzo:** S

### ENG-092 · `DayCloseResult` incluir `stonesEarned` en la condición de retorno
**Qué:** Hoy `result` es no-null solo si hubo penalización/racha/piedra usada (engine.ts:93); ganar una piedra no dispara el resumen. **Dónde:** `engine.ts:92-102`. **Impacto:** 3 · **Esfuerzo:** S

### ENG-093 · `DayCloseResult` exponer `frozenDays`
**Qué:** Comunicar cuántos días se congelaron al volver de una pausa larga. **Dónde:** `engine.ts:10-17,92-102`. **Impacto:** 2 · **Esfuerzo:** S

### ENG-094 · Registrar evento al expirar la congelación
**Qué:** No hay evento cuando `freeze_until` se limpia (engine.ts:62-65); añadir `freeze_expired`. **Dónde:** `engine.ts:62-65`. **Impacto:** 2 · **Esfuerzo:** S

### ENG-095 · `setFreeze`: validar que `until >= hoy`
**Qué:** Permitir solo fechas futuras; hoy acepta cualquier string. **Dónde:** `engine.ts:190-198`. **Impacto:** 3 · **Esfuerzo:** S

### ENG-096 · `setFreeze`: validar formato de `until`
**Qué:** Asegurar `YYYY-MM-DD` para que las comparaciones de closing.ts funcionen. **Dónde:** `engine.ts:190-198`. **Impacto:** 3 · **Esfuerzo:** S

### ENG-097 · Tope máximo de duración de congelación
**Qué:** Evitar pausas indefinidas que vacíen la motivación (p.ej. máx 30 días). **Dónde:** `engine.ts:190-198`. **Impacto:** 2 · **Esfuerzo:** S

### ENG-098 · Penalización por abandonar mazmorra
**Qué:** `Dungeon.status='abandoned'` existe (types.ts:59) pero el motor no aplica consecuencia; definir. **Dónde:** `engine.ts`, `types.ts:59`. **Impacto:** 2 · **Esfuerzo:** M

### ENG-099 · XP por deadline de mazmorra cumplido/incumplido
**Qué:** `Dungeon.deadline` (types.ts:58) no influye en XP; bonus por entregar a tiempo. **Dónde:** `game.ts`, `types.ts:58`. **Impacto:** 2 · **Esfuerzo:** M

### ENG-100 · Bonus de racha también en mazmorras (opcional/ajustable)
**Qué:** Hoy `dungeonTaskXp` ignora racha y evidencia (game.ts:103) por anti-inflación; documentar la decisión como invariante. **Dónde:** `game.ts:103-105`. **Impacto:** 2 · **Esfuerzo:** S

### ENG-101 · Curva de nivel parametrizable
**Qué:** Extraer `100` y `1.5` a constantes nombradas (`LEVEL_BASE`, `LEVEL_EXP`) para tunear balance. **Dónde:** `game.ts:43`. **Impacto:** 2 · **Esfuerzo:** S

### ENG-102 · Documentar el presupuesto de XP por día
**Qué:** El comentario "150-300 XP/día" (game.ts:85) debería ser una constante usada por los tests de balance. **Dónde:** `game.ts:84-86`. **Impacto:** 2 · **Esfuerzo:** S

### ENG-103 · Test de balance: día normal cae en 150-300 XP
**Qué:** Property test que sume misiones típicas y verifique el rango. **Dónde:** `game.test.ts`. **Impacto:** 3 · **Esfuerzo:** M

### ENG-104 · Test de balance: penalización máxima diaria ≤ 150
**Qué:** Verificar el tope con N misiones épicas falladas. **Dónde:** `closing.test.ts:126-140`. **Impacto:** 3 · **Esfuerzo:** S

### ENG-105 · Garantizar que ganancia ≥ posible penalización por la misma misión
**Qué:** Invariante de balance: completar nunca debe rentar menos que el daño por fallarla. **Dónde:** `game.ts:77-82`, `closing.ts:74-79`. **Impacto:** 3 · **Esfuerzo:** S

### ENG-106 · Stat points como función pura testeada por nivel
**Qué:** Documentar que 100 XP = 1 punto y validar contra la curva de nivel para coherencia. **Dónde:** `game.ts:71-73`. **Impacto:** 2 · **Esfuerzo:** S

### ENG-107 · Evitar recomputar nivel dos veces en `completeQuest`
**Qué:** `levelFromXp(profile.xp_total)` y `+xp` (engine.ts:145-146) recorren la curva 2×; reutilizar. **Dónde:** `engine.ts:145-146`. **Impacto:** 2 · **Esfuerzo:** S

### ENG-108 · Evitar recomputar nivel dos veces en `awardXp`
**Qué:** Igual que ENG-107 en engine.ts:180-181. **Dónde:** `engine.ts:180-181`. **Impacto:** 2 · **Esfuerzo:** S

### ENG-109 · `processPendingDays`: calcular nivel antes/después una sola pasada
**Qué:** engine.ts:51-53 recorre la curva dos veces; con tabla acumulada es O(log n). **Dónde:** `engine.ts:51-53`. **Impacto:** 2 · **Esfuerzo:** S

### ENG-110 · Cachear `levelFromXp` en perfil.tsx/index.tsx por render
**Qué:** Ambas pantallas lo llaman; memoizar con `useMemo(profile.xp_total)`. **Dónde:** `index.tsx:178`, `perfil.tsx:183`. **Impacto:** 2 · **Esfuerzo:** S

### ENG-111 · `streakMultiplier` redondeo de presentación
**Qué:** `toFixed(1)` en index.tsx:224 y perfil.tsx:319; centralizar el formato para evitar "×1.30000001". **Dónde:** `index.tsx:224`, `perfil.tsx:319`. **Impacto:** 2 · **Esfuerzo:** S

### ENG-112 · Mostrar progreso hacia el siguiente salto de racha
**Qué:** "Te faltan N días para ×1,3"; deriva de `streakDays % 7`. **Dónde:** `game.ts:67-69`, `perfil.tsx:319`. **Impacto:** 3 · **Esfuerzo:** S

### ENG-113 · Indicar el tope de racha alcanzado (×1,5)
**Qué:** A partir de 35 días el multiplicador no sube; comunicarlo para gestionar expectativas. **Dónde:** `perfil.tsx:319`. **Impacto:** 2 · **Esfuerzo:** S

### ENG-114 · Accesibilidad: la XPBar necesita `accessibilityValue`
**Qué:** Exponer min/max/now a lectores de pantalla (hoy es decorativa). **Dónde:** `index.tsx:217`, `perfil.tsx:225`. **Impacto:** 3 · **Esfuerzo:** S

### ENG-115 · Accesibilidad: anunciar nivel y rango como texto leíble
**Qué:** "Nivel 12, rango D" con `accessibilityLabel` en lugar de fragmentos sueltos. **Dónde:** `index.tsx:207-208`, `perfil.tsx:184`. **Impacto:** 2 · **Esfuerzo:** S

### ENG-116 · Localizar/pluralizar "días" de racha
**Qué:** "1 día" vs "2 días" en index.tsx:224 y perfil.tsx:387. **Dónde:** `index.tsx:224`. **Impacto:** 1 · **Esfuerzo:** S

### ENG-117 · `last_day_processed` debería poder reconstruirse
**Qué:** Si se corrompe, no hay forma de recomputar desde `completions`; añadir recálculo de respaldo. **Dónde:** `engine.ts:29-37`. **Impacto:** 3 · **Esfuerzo:** L

### ENG-118 · Recalcular `xp_total` desde eventos/completions (fuente de verdad)
**Qué:** Hoy es un acumulador mutable; un job de reconciliación detectaría drift por races. **Dónde:** `engine.ts`. **Impacto:** 4 · **Esfuerzo:** L

### ENG-119 · Idempotencia de `completeQuest` por (quest,date)
**Qué:** Si se completa dos veces el mismo día, se insertan dos completions y doble XP; falta unique/constraint y guard. **Dónde:** `engine.ts:129-136`. **Impacto:** 4 · **Esfuerzo:** M

### ENG-120 · Manejar error de subida de evidencia sin perder XP
**Qué:** `uploadEvidence` (engine.ts:124) puede fallar tras calcular XP; definir orden y rollback. **Dónde:** `engine.ts:122-136`. **Impacto:** 3 · **Esfuerzo:** M

### ENG-121 · `completeQuest`: el XP se calcula con evidencia pero la inserción puede fallar
**Qué:** Si `insert` de completion falla (engine.ts:136) tras subir evidencia, queda evidencia huérfana. **Dónde:** `engine.ts:122-136`. **Impacto:** 2 · **Esfuerzo:** M

### ENG-122 · Validar que `quest.difficulty` exista antes de `questXp`
**Qué:** Defensa ante datos viejos sin dificultad válida. **Dónde:** `engine.ts:127`, `game.ts:79`. **Impacto:** 2 · **Esfuerzo:** S

### ENG-123 · `awardXp` no acepta XP negativo accidental
**Qué:** No hay guard de signo; un `amount` negativo restaría XP saltándose el flujo de penalización. **Dónde:** `engine.ts:166-178`. **Impacto:** 3 · **Esfuerzo:** S

### ENG-124 · `awardXp`/`completeQuest` deberían clamp `xp_total` a 0
**Qué:** Solo el cierre aplica `Math.max(0,…)`; unificar el tope inferior. **Dónde:** `engine.ts:138,173`. **Impacto:** 3 · **Esfuerzo:** S

### ENG-125 · Evitar `level_up` falso por race (nivel calculado con XP viejo)
**Qué:** `before/after` usan `profile.xp_total` en memoria; si está obsoleto, el `level_up` puede ser incorrecto. **Dónde:** `engine.ts:145-146,180-181`. **Impacto:** 3 · **Esfuerzo:** M

### ENG-126 · Evento `level_down` al perder nivel por penalización
**Qué:** Hoy se reporta `levelsLost` pero no se emite evento; útil para el historial. **Dónde:** `engine.ts:88-90,98`. **Impacto:** 2 · **Esfuerzo:** S

### ENG-127 · Constantes de evento en un enum/tipo
**Qué:** Strings sueltos ('penalty','stone_used','level_up'…) sin tipo; centralizar para evitar typos. **Dónde:** `engine.ts:80-89,147,153,182`. **Impacto:** 2 · **Esfuerzo:** S

### ENG-128 · Tipar el `payload` de `insertEvent`
**Qué:** `Record<string,unknown>` pierde forma; definir uniones por tipo de evento. **Dónde:** `engine.ts:166-187`. **Impacto:** 2 · **Esfuerzo:** M

### ENG-129 · `processPendingDays` debería devolver también días procesados
**Qué:** Exponer cuántos días cerró para depuración y telemetría. **Dónde:** `engine.ts:92-104`. **Impacto:** 1 · **Esfuerzo:** S

### ENG-130 · Cierre resistente a misiones creadas durante el hueco
**Qué:** Una misión creada hoy se evalúa para días pasados si su `days_of_week` coincide; debería respetar `created_at`. **Dónde:** `closing.ts:8-15`. **Impacto:** 4 · **Esfuerzo:** M

### ENG-131 · Cierre resistente a misiones desactivadas a posteriori
**Qué:** Una misión desactivada hoy no penaliza días pasados en los que estaba activa (usa estado actual). Decidir semántica. **Dónde:** `closing.ts:10`. **Impacto:** 3 · **Esfuerzo:** M

### ENG-132 · `questsScheduledOn` ignora cambios históricos de `days_of_week`
**Qué:** Si el usuario cambió los días, el cierre usa los actuales para el pasado; documentar o versionar. **Dónde:** `closing.ts:8-15`. **Impacto:** 2 · **Esfuerzo:** L

### ENG-133 · Penalización por misión con evidencia obligatoria sin evidencia
**Qué:** `requires_evidence` (types.ts:34) no se valida en el motor: se puede completar sin evidencia y cobrar el bonus es opcional, pero ¿debería bloquear? Definir. **Dónde:** `engine.ts:127`, `types.ts:34`. **Impacto:** 3 · **Esfuerzo:** M

### ENG-134 · `EVIDENCE_BONUS` solo aplica si `requires_evidence` o siempre
**Qué:** Hoy cualquier evidencia da +25% aunque la misión no la requiera (engine.ts:127); aclarar la regla. **Dónde:** `engine.ts:127`, `game.ts:80`. **Impacto:** 3 · **Esfuerzo:** S

### ENG-135 · Centralizar el cálculo de "nivel del perfil"
**Qué:** `levelFromXp(profile.xp_total).level` se repite en 5 sitios; helper `levelOf(profile)`. **Dónde:** `engine.ts`, `index.tsx`, `perfil.tsx`. **Impacto:** 2 · **Esfuerzo:** S

### ENG-136 · Helper `rankOf(profile)`
**Qué:** Encapsular `rankForLevel(levelFromXp(xp).level)` usado en varias pantallas. **Dónde:** `index.tsx:207`, `perfil.tsx:184`, `LevelUpOverlay.tsx:67`. **Impacto:** 2 · **Esfuerzo:** S

### ENG-137 · `LevelUpOverlay` con `level=null` muestra rango vacío
**Qué:** `level !== null ? rankForLevel(level) : ''` (LevelUpOverlay.tsx:67) deja "RANGO " colgando. **Dónde:** `LevelUpOverlay.tsx:67`. **Impacto:** 2 · **Esfuerzo:** S

### ENG-138 · Animación de subida de nivel respetando reduce-motion
**Qué:** El overlay debe degradar a estático si el usuario pidió menos movimiento. **Dónde:** `LevelUpOverlay.tsx`. **Impacto:** 2 · **Esfuerzo:** S

### ENG-139 · Constantes mágicas de rango duplicadas entre game.ts y UI
**Qué:** Los umbrales de rango no se comparten con ninguna leyenda de UI; fuente única. **Dónde:** `game.ts:58-65`. **Impacto:** 2 · **Esfuerzo:** S

### ENG-140 · Documentar por qué `into/next` puede pasar de 1 hoy
**Qué:** Hasta arreglar CRIT-ENG-01, dejar comentario de advertencia en el cálculo de la barra. **Dónde:** `index.tsx:217`, `perfil.tsx:225`. **Impacto:** 1 · **Esfuerzo:** S

### ENG-141 · `dateKey` sin dependencia de `new Date()` por defecto en cálculos
**Qué:** Inyectar el reloj (parámetro `now`) para testear cruces de día de forma determinista. **Dónde:** `dates.ts:1`, `engine.ts:27,121`. **Impacto:** 3 · **Esfuerzo:** M

### ENG-142 · Reloj inyectable en `processPendingDays`/`completeQuest`
**Qué:** Pasar `today` como argumento opcional para tests y para fijar el día de juego. **Dónde:** `engine.ts:27,121`. **Impacto:** 3 · **Esfuerzo:** M

### ENG-143 · `addDays` evitar mutar el `Date` intermedio
**Qué:** `date.setDate(...)` muta; encapsular para claridad (no es bug, es estilo). **Dónde:** `dates.ts:13-17`. **Impacto:** 1 · **Esfuerzo:** S

### ENG-144 · Tipar el retorno de `levelFromXp` como interfaz nombrada
**Qué:** Exportar `interface LevelInfo` para reutilizar en UI y tests. **Dónde:** `game.ts:46`. **Impacto:** 1 · **Esfuerzo:** S

### ENG-145 · `Rank` exportado pero rango de mazmorra no comparte type-guard
**Qué:** Añadir `isRank`/`isDungeonRank` para validación de datos entrantes. **Dónde:** `game.ts:56,101`. **Impacto:** 2 · **Esfuerzo:** S

### ENG-146 · Validación de `days_of_week` (1..7, sin duplicados)
**Qué:** El motor confía en datos correctos; un 0 u 8 nunca casaría con `isoWeekday`. **Dónde:** `closing.ts:13`, `types.ts:32`. **Impacto:** 3 · **Esfuerzo:** S

### ENG-147 · Feature: piedras con caducidad o coste de oportunidad
**Qué:** Hoy se acumulan hasta 3 sin merma; explorar mecánica de gasto/decay para tensión. **Dónde:** `game.ts:87-88`, `closing.ts:61-68`. **Impacto:** 2 · **Esfuerzo:** M

### ENG-148 · Feature: bonus de fin de semana perfecta (más allá de la piedra)
**Qué:** Recompensa adicional por semana 7/7 además de forjar piedra. **Dónde:** `closing.ts:61-64`. **Impacto:** 2 · **Esfuerzo:** M

### ENG-149 · Feature: "media racha" que avisa antes de romperse
**Qué:** Estado de gracia (1 día) con aviso fuerte antes de aplicar penalización. **Dónde:** `closing.ts:70-80`. **Impacto:** 3 · **Esfuerzo:** M

### ENG-150 · Feature: multiplicador de racha con curva configurable
**Qué:** Permitir +0,1/7d o variantes (logarítmica) desde una constante de diseño. **Dónde:** `game.ts:67-69`. **Impacto:** 2 · **Esfuerzo:** M

### ENG-151 · Feature: prestigio al alcanzar nivel 999
**Qué:** Reinicio opcional con marca permanente en vez de quedar atascado al tope. **Dónde:** `game.ts:49`. **Impacto:** 2 · **Esfuerzo:** L

### ENG-152 · Feature: XP decae si hay inactividad prolongada (opcional)
**Qué:** Mecánica anti-abandono suave; debe convivir con la congelación. **Dónde:** `engine.ts`, `game.ts`. **Impacto:** 2 · **Esfuerzo:** L

### ENG-153 · Telemetría de balance: registrar XP medio diario
**Qué:** Evento agregando XP/día para validar el presupuesto 150-300 en datos reales. **Dónde:** `engine.ts:147,182`. **Impacto:** 2 · **Esfuerzo:** M

### ENG-154 · `DAILY_PENALTY_CAP` y `MAX_STONES` configurables por perfil
**Qué:** Permitir afinar dificultad personal sin tocar código. **Dónde:** `game.ts:86-88`. **Impacto:** 2 · **Esfuerzo:** M

### ENG-155 · Sanitizar `penalty_xp` negativo o nulo en el cierre
**Qué:** El motor genera la misión de penalización con `penalty_xp = close.penaltyXp` (engine.ts:78); validar ≥0. **Dónde:** `engine.ts:69-79`. **Impacto:** 2 · **Esfuerzo:** S

### ENG-156 · Verificación: typecheck + export tras tocar el motor
**Qué:** Asegurar en CI `npm run typecheck` y `npx expo export` (regla del proyecto) sobre cambios de game/closing/engine. **Dónde:** `package.json`, `game.ts`/`closing.ts`/`engine.ts`. **Impacto:** 3 · **Esfuerzo:** S

### ENG-157 · Cobertura mínima de los módulos del motor en jest
**Qué:** Exigir umbral de cobertura para `game.ts`/`closing.ts`/`dates.ts`/`engine.ts`. **Dónde:** configuración jest. **Impacto:** 3 · **Esfuerzo:** S

### ENG-158 · Property-based testing de la curva e invariantes
**Qué:** Usar fast-check para monotonía, no-negatividad y topes en lugar de casos sueltos. **Dónde:** `game.test.ts`, `closing.test.ts`. **Impacto:** 3 · **Esfuerzo:** M

Total: 158 mejoras, 12 bugs.
