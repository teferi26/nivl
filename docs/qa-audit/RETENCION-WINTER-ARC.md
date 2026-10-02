# NIVL · Retención para el Winter Arc

> Chat 5 · subagente (c) activación y retención · base `bf32d28` · 2026-10-02.
> Propuestas, sin código. Cómo se mide cada una: `MEDICION.md`. Nada de esto promete cifras: primero 2 semanas de línea base.
>
> **Prohibido en todas:** premios que inflen el XP, presión dañina, spam de avisos, patrones oscuros y viralidad forzada. Compartir nunca da XP.

## 1. Qué le pasa HOY a quien vuelve tras 14 o 30 días

### 1.1 El recorrido en el código

1. Abre la app y Hoy llama a `processPendingDays` (`engine.ts`). Se cierran **todos** los días desde `last_day_processed + 1` hasta ayer. Ese límite no existe.
2. En cada día, `computeDayClose` (`closing.ts`) hace lo siguiente:
   - si hay pausa, el día no se juzga;
   - si el día no se cumple y quedan **piedras**, una piedra absorbe el día entero;
   - si no quedan piedras, `streak = 0` y se cobra el **25 por misión media** (50 × `PENALTY_FACTOR` 0,5), con un tope de **150 al día** (`DAILY_PENALTY_CAP`).
3. Las **reglas del contrato** se cobran aparte (`reglasIncumplidas`): 25 por regla y día, con **su propio** tope de 150. Las piedras no las absorben. Juntando misiones y reglas, el techo real es **300 al día**.
4. `apply_day_close` resta el total con `greatest(0, xp_total - p_penalty_xp)`: el XP **no baja de 0**.
5. Se crea **una** «Misión de penalización» con `penalty_xp = close.penaltyXp`, el total **calculado** y no el descontado. Si hubo reglas rotas, se crea además «Consecuencia: N reglas rotas». Las dos son `is_penalty` y solo valen el día de hoy.
6. En Hoy aparece una tarjeta roja, **ALERTA DEL SISTEMA**, con `voice.penaltyApplied(xp)` (por ejemplo: «Fallo registrado: −1750 XP. Redímete hoy o la pérdida será permanente.») y «Has perdido N niveles». La racha se ve a 0 con ×1.0. Las misiones de penalización salen las primeras de la lista y bajo la lista se lee «A medianoche, lo pendiente se penaliza.».
7. Tocar la misión de penalización la completa **en un toque**, sin foto y sin hoja (`onComplete`, rama `is_penalty`). Devuelve el XP entero. Si con eso cruza un nivel, se pinta `LevelUpOverlay` como si fuera una subida nueva.

### 1.2 Las cuentas en papel

Supuestos:

- 5 misiones medias al día, todos los días (25 de penalización cada una, 125 al día, por debajo del tope de 150).
- Sin evidencias.
- Variante con 3 reglas marcadas alguna vez: 75 al día, con tope propio.
- Persona A: un mes de uso perfecto, 30 días con multiplicador de racha: **8.750 XP, nivel 9**.
- Persona B: una semana de uso: **1.750 XP, nivel 5**.
- El cálculo se hizo con las fórmulas de `game.ts`: `xpCostForLevel`, `levelFromXp` y `streakMultiplier`.

| Ausencia | Piedras | Reglas | XP cobrado | A: XP y nivel tras volver | B: XP real perdido / lo que ofrece la recuperación |
|---|---|---|---|---|---|
| 14 días | 0 | 0 | −1.750 | 7.000 · N8 (−1 nivel) | 1.750 / 1.750 |
| 14 días | 3 | 0 | −1.375 (3 días absorbidos) | 7.375 · N8 (−1) | 1.375 / 1.375 |
| 14 días | 0 | 3 | −2.800 | 5.950 · N7 (−2) | 1.750 / **2.800 (+1.050 de más)** |
| 30 días | 0 | 0 | −3.750 | 5.000 · N7 (−2) | 1.750 / **3.750 (+2.000)** |
| 30 días | 3 | 0 | −3.375 | 5.375 · N7 (−2) | 1.750 / **3.375 (+1.625)** |
| 30 días | 0 | 3 | −6.000 | 2.750 · N5 (−4) | 1.750 / **6.000 (+4.250)** |

Las cifras en contexto:

- 1.750 XP equivalen a unos **7,8 días** de un día cumplido medio (225, el centro de 150–300).
- 3.750 XP equivalen a unos **16,7 días**.
- La racha vuelve a 0 y el multiplicador a ×1.0. Las piedras quedan en 0 si las había.

### 1.3 Problemas, por orden de gravedad

- **P-1 · Faltar sale a cuenta (inflación).** Si `xp_total` es menor que la penalización, la base de datos recorta a 0, pero la misión de recuperación devuelve el total calculado. Una persona de la primera semana que falta 30 días y vuelve **gana hasta +4.250 XP de un toque**. Eso rompe el invariante 2 («exactamente al 100 %») por arriba y el presupuesto diario (14 veces el máximo). Ya estaba apuntado como ENG-028 en `docs/auditoria/01-motor-economia.md`, sin cerrar.
- **P-2 · La penalización es teatro o es definitiva, sin término medio.** Un toque devuelve de 8 a 17 días de presupuesto: si tocas, faltar no ha costado XP. Si abres tarde (a las 23:30) o no entiendes la misión, la pérdida se consolida a medianoche. Ninguna de las dos refuerza volver.
- **P-3 · Humilla a quien ya se había ido.** Un número rojo de cuatro cifras, «la pérdida será permanente» y «Has perdido 2 niveles» van contra PSI-006, NOT-011 y ONB-048. Justo después, la subida de nivel celebra recuperar lo propio como si fuera un logro nuevo.
- **P-4 · El tope de 150 no es el de verdad.** Misiones y reglas suman topes separados, así que el techo es 300 al día.
- **P-5 · El día del alta se juzga.** Quien termina el onboarding a las 22:00 con 5 misiones de todos los días pierde la racha y XP el día 1, en su primer cierre.
- **P-6 · El despertador no se apaga nunca.** `programarDespertador` usa un disparador `DAILY` con `timeSensitive`. En 30 días de ausencia suena 30 veces, siempre con el mismo tipo de copy, sin que se vaya espaciando.

## 2. Propuestas priorizadas

Escalas: impacto 1–5 · esfuerzo S/M/L · riesgo B/M/A.

Dueños:

- **C5**: módulos del Chat 5 (`game`, `closing`, `engine`, `links`, `habits`, `plan`, `dates`, `achievements`, `progress`).
- **C4**: interfaz y copy.
- **Coord**: SQL, migraciones o espejo Deno.
- **C3 / C1**: privacidad y tiendas.

**Toda propuesta que cambie la economía pasa por `nivl-game-balancer`. Las marcadas con ⚖ necesitan además una decisión explícita del dueño del producto.**

| # | Propuesta | Área | Imp. | Esf. | Riesgo | Dueño | Prioridad |
|---|---|---|---|---|---|---|---|
| RET-01 | La recuperación devuelve el XP **realmente descontado** | vuelta / economía | 5 | S | B | C5 | **P0** |
| RET-02 ⚖ | **Ventana de penalización por ausencia**: solo se cobran los 3 primeros días vacíos seguidos | vuelta | 5 | M | M | C5 (+C4 copy) | **P1** |
| RET-03 ⚖ | **Misión de regreso con acto real**, sin XP extra y sin culpa | vuelta | 4 | S–M | M | C5 + C4 | **P1** |
| RET-04 | **El día 1 no se juzga**: ninguna misión se juzga el día en que se creó | activación / primera misión | 4 | S | B | C5 | **P1** |
| RET-05 | **Lo que hay en juego esta noche**, visible antes de medianoche | claridad | 4 | S | B | C5 (pura) + C4 | **P1** |
| RET-06 | El despertador **caduca** tras 7 días sin abrir | vuelta / avisos | 3 | S | B | C4 (`notifications.ts`) | P2 |
| RET-07 | Recuperar no es «subir de nivel»: aviso de «nivel recuperado» | claridad | 3 | S | B | C5 (dato) + C4 | P2 |
| RET-08 ⚖ | Tope conjunto de 150 al día para misiones y reglas | vuelta / economía | 3 | S | B | C5 | P2 |
| RET-09 | Primera misión guiada, decidida con datos | primera misión | 3 | M | B | C4 (+`kinds.ts`, coord) | P2, tras línea base |
| RET-10 | Piedras explicadas en la vuelta | claridad | 2 | S | B | C4 | P3 |
| RET-11 | Compartir voluntario: medir sin premiar | compartir | 2 | S | B | C4 + C3/C1 | P3 |

### RET-01 · La recuperación devuelve lo realmente descontado (P0)

- **Qué:** en `processPendingDays`, el `penalty_xp` de las misiones de recuperación debe ser `profile.xp_total − updated.xp_total`, lo que la RPC quitó de verdad, y no `close.penaltyXp + xpReglas`. Si hay misión y consecuencia, ese real se reparte en proporción, con el resto a la misión, para que la suma cuadre al XP. Si lo descontado es 0, no se crea misión de recuperación, porque no hay nada que recuperar. El evento `penalty` registra lo real (`xp`) y, si se quiere, lo calculado en `count`, que es clave permitida.
- **Archivos:** `src/lib/engine.ts`. Test en `src/lib/__tests__/`, con un perfil de 300 XP y 30 días de ausencia: la recuperación debe valer 300, no 3.750.
- **Invariantes:**
  1. Stats: sin cambio.
  2. Recuperable el mismo día al 100 %: se **arregla**, ahora es exacto.
  3. Sin cambio.
  4. Sin bonus ni multiplicador: sin cambio.
  5. Sin cambio.
  6. Lo restaurado queda en `completions.xp_awarded` igual que antes.
- **XP:** quita una fuente de inflación de hasta +4.250 por vuelta. No añade XP.
- **Coordinar con:** la hipótesis 3 del Chat 5 (dos penalizaciones equivalentes en el vídeo). RET-01 no evita un doble cierre, pero sí que el doble cierre **acuñe** XP de más.

### RET-02 ⚖ · Ventana de penalización por ausencia (P1)

- **Qué:**
  - Un **día vacío** es un día con misiones programadas, ninguna completada y ninguna regla marcada.
  - En una racha de días vacíos seguidos, se cobra la penalización normal solo de los **3 primeros**. El resto se marca como «fuera de la arena»: sin XP perdido, y la racha ya está a 0 desde el primero.
  - Los días con actividad parcial siguen las reglas de siempre: tolerancia del 30 % y cobro por misión.
  - Las piedras se gastan antes, como hoy.
  - Se aplica igual a misiones y a reglas.
- **Por qué:** pasado el tercer día, la penalización ya no cambia ninguna conducta, porque la persona no está mirando. Solo agranda el golpe al volver, y ese momento es el de mayor abandono (PEN-007, PSI-005, ONB-005). Lo que hace que faltar cueste sigue en pie: la racha a 0, el multiplicador a ×1.0 y la recuperación ganada con un acto (RET-03).
- **Con los mismos supuestos:**
  - 14 días: de −1.750 a **−375**.
  - 30 días: de −3.750 a **−375**.
  - Con 3 reglas, el techo baja de −6.000 a −600 (−375 − 225).
  - Persona A: 8.750 → 8.375 XP. Pasa de N9 a N8 porque el nivel 9 empieza en 8.406: se queda a 31 XP. Las pérdidas posibles de hoy, de −1 a −4 niveles, pasan a como mucho −1.
- **Archivos:** `src/lib/closing.ts`, una función pura con la constante nueva `DIAS_AUSENCIA_COBRADOS = 3` en `game.ts`, más los tests. `src/lib/engine.ts` pasa los días no cobrados en `DayCloseResult` (`diasFuera`) y en el evento `penalty` (`dias`, clave ya permitida por la 0030: no hace falta migración). Copy de la tarjeta: Chat 4.
- **Invariantes:**
  1. Stats: sin cambio.
  2. Lo cobrado se sigue pudiendo recuperar al 100 %.
  3. Racha y XP siguen siendo el máximo, nunca doble.
  4. Sin cambio.
  5. Día local, sin cambio.
  6. Auditable con el evento `penalty` (`xp` y `dias`).
- **XP:** solo **reduce** el castigo; no crea fuente nueva.
- **Riesgo:** quita tensión a las ausencias largas («10 días cuestan lo mismo que 3»). Se compensa porque la racha, el multiplicador y las piedras sí se pierden. Hace falta una **decisión explícita** del dueño, porque cambia el comportamiento del castigo, y `nivl-game-balancer` debe simular las semanas 1, 4 y 40.

### RET-03 ⚖ · Misión de regreso con acto real (P1)

- **Qué:**
  - Cuando el cierre detecta 4 o más días vacíos seguidos, la misión de recuperación se titula **«Regreso a la arena»** en lugar de «Misión de penalización».
  - Devuelve exactamente lo cobrado (RET-01 y RET-02) y nada más: **sin XP extra, sin bonus y sin multiplicador**.
  - **Condición:** para completarla hay que haber completado antes **una misión normal de hoy**. Así, volver es un acto, no un toque de cortesía. Si hoy no hay ninguna misión normal programada, no hay condición.
  - La tarjeta de Hoy cambia el tono, siguiendo NOT-011 y ONB-048. Por ejemplo: «Has estado fuera 14 días. El sistema ha cobrado 3: −375 XP. Cumple una misión de hoy y recupéralos.». Debajo, una sola acción y una línea de ayuda: «Si sabes que vas a faltar, pausa el sistema desde Perfil.».
  - Fuera: «la pérdida será permanente» y el recuento de niveles perdidos en rojo.
- **Archivos:**
  - `src/lib/engine.ts`: el título al crearla, y en `completeQuest`, si `is_penalty` y no hay ninguna completada normal hoy, lanzar `ErrorVisible` con el texto de la condición.
  - Chat 4: estado bloqueado de la misión en `QuestItem` y Hoy, copy en `voice.ts` y la tarjeta.
  - Sin SQL.
- **Invariantes:**
  - El 2 se mantiene: recuperable **el mismo día** al 100 %. La condición se cumple ese mismo día con una misión ya programada. Aun así es un cambio de **cómo** se recupera, y por eso lleva ⚖.
  - 3 y 4: sin cambio.
  - 6: lo restaurado sigue en `completions`.
- **XP:** cero XP nuevo.
- **Riesgo:** fricción. Sin la UI del Chat 4 se vería un error al tocar. **No se publica la parte de `engine.ts` sin la UI.**

### RET-04 · El día 1 no se juzga (P1)

- **Qué:** en `computeDayClose` y `reglasIncumplidas`, una misión o regla no se juzga en el día local de su `created_at`. Arregla P-5 (el onboarding nocturno) y también «creé una misión a las 23:55 y me penalizó». Completarla ese día sigue pagando con normalidad.
- **Archivos:** `src/lib/closing.ts`. `Quest.created_at` ya existe en `types.ts`; para las reglas hay que comprobar el campo en `contract.ts`. Tests: alta a las 22:00 con 5 misiones; el cierre siguiente no penaliza ni rompe la racha.
- **Invariantes:**
  - 1–4 y 6: sin cambio.
  - 5: día local con `dateKey(new Date(created_at))` en el dispositivo, seguro frente al cambio de hora porque `dates.ts` usa constructores locales.
- **XP:** solo reduce penalización. Abuso posible: borrar y recrear misiones a diario para no ser juzgado nunca. Es poco probable, porque se pierde el historial y la racha no suma. Se vigila con la consulta 3.4 de MEDICION.

### RET-05 · Lo que hay en juego esta noche (P1)

- **Qué:** una función pura `enJuegoHoy(questsHoy, completadas, piedras)` en `closing.ts`, con el mismo criterio que el cierre (tolerancia, piedra y tope). Devuelve `{ xpEnRiesgo, rachaEnRiesgo, piedraLaSalva }`. Hoy sustituye «A medianoche, lo pendiente se penaliza.» por algo exacto, como «Si cierras así: −50 XP, recuperables mañana. La racha se salva.» (ONB-015, PEN-022).
- **Archivos:** `closing.ts` y su test (C5); `src/app/(tabs)/index.tsx` (C4).
- **Invariantes:** solo lee. **XP:** 0.

### RET-06 · El despertador caduca (P2)

- **Qué:** cambiar el `DAILY` de `programarDespertador` por disparadores `DATE` para los **próximos 7 días**, que se reprograman en cada apertura. Tras una semana sin abrir, silencio, sin servidor y sin spam (ONB-027 en su versión mínima).
- **A verificar aparte, no lo he comprobado:** si `supabase/functions/ritual` sigue enviando push a una persona Pro que lleva semanas sin abrir. Si es así, aplicarle el mismo criterio.
- **Dueño:** C4, o quien sea dueño de `notifications.ts`. **XP:** 0. **Riesgo:** bajo; lo que hay que probar es que reabrir reprograma.

### RET-07 · Recuperar no es subir de nivel (P2)

- **Qué:** `CompleteResult` gana `recuperado: boolean` cuando `wasPenalty` y el nivel vuelve a uno que ya se tuvo. Hoy enseña «Nivel recuperado» en un toast discreto, no `LevelUpOverlay`. Los logros de nivel no se tocan: ya se habían ganado.
- **Archivos:** `engine.ts` (C5); `index.tsx` (C4). **XP:** 0.

### RET-08 ⚖ · Un solo tope diario (P2)

- **Qué:** `reglasIncumplidas` recibe como tope `DAILY_PENALTY_CAP − penalización de misiones ese día`, de modo que el máximo diario sea 150 de verdad, como dice `game.ts` («el tope evita la espiral»).
- **Archivos:** `closing.ts` y `engine.ts`. **XP:** reduce. Lleva ⚖ porque cambia cuánto cuesta romper reglas.

### RET-09 · Primera misión guiada (P2, después de medir)

- **Qué:** si las consultas 3.3 y 3.4 de MEDICION muestran mucho tiempo hasta la primera misión o mucha gente que arranca con 5 o más misiones, el onboarding:
  - preselecciona 3 misiones como máximo (ONB-008 suave, sin bloqueo duro);
  - garantiza una trivial o fácil que se pueda hacer hoy (ONB-021).
  En Hoy, la primera vez (sin completadas), se destaca esa misión.
- **Dueños:** C4 (onboarding y Hoy); `kinds.ts` tiene espejo Deno, así que lo integra el coordinador. **XP:** 0. **No se hace a ciegas:** primero los datos.

### RET-10 · Piedras explicadas en la vuelta (P3)

- **Qué:** cuando las piedras absorben días, decir cuántos: «Tus 3 Piedras absorbieron 3 días». Hoy solo hay un mensaje genérico de una línea. **No** se propone una congelación retroactiva nueva: las piedras ya son la válvula ganada y retroactiva, y otra más sería regalarla. Lo que falta es que se entienda.
- **Dueño:** C4 (el dato ya está en `DayCloseResult.stonesUsed`). **XP:** 0.

### RET-11 · Compartir voluntario (P3)

- **Ya existe:** la tarjeta de la semana (`ShareCardSemana`, desde Día perfecto), la tarjeta de Perfil y el código de amigo. La tarjeta de la semana no lleva títulos de misión, solo nombre, nivel, racha, cumplimiento y código: compatible con SOC-028.
- **Propuesta:** no añadir avisos para compartir, ni premios por hacerlo, ni tarjetas de regreso (nadie debe sentirse empujado a publicar que volvió). Si el Chat 3 y el Chat 1 lo aprueban, medir `share_abierto` (MEDICION, sección 6) para saber si se usa.
- **XP:** 0. Compartir **nunca** da XP ni PB.

## 3. Lo que se descarta, y por qué

| Idea del backlog | Motivo |
|---|---|
| ONB-028 Cristal de Retorno (anula todas las penalizaciones) | Regala el perdón. RET-02 y RET-03 lo sustituyen con un tope y un acto real. |
| ONB-006 bendición del novato +X % XP · SOC-017 300 XP por reclutar · SOC-004 +10 % por verificar | Inflación: nuevas fuentes de XP fuera de presupuesto. |
| SOC-005 duelos con XP en depósito · SOC-029 ligas | Presión social y apuestas de XP; fuera del alcance del Winter Arc. |
| NOT-004 y PEN-039 escaladas de «racha en peligro» | Riesgo de spam. Antes hay que poner presupuesto de avisos (NOT-017). |
| ONB-049 Nueva Partida+ (reinicio con título) | Útil a medio plazo, pero esfuerzo M y requiere decisiones de identidad. Después de medir 3.6. |
| Pausa retroactiva o «congelación ganada» nueva | Las piedras ya cumplen ese papel; una segunda válvula retroactiva se regala. Ver RET-10. |

## 4. Qué necesita cada chat

- **Chat 5 (propietario):** RET-01 ya. RET-04 y RET-05, la parte pura y los tests. Después de la decisión ⚖, RET-02, RET-03 (motor) y RET-08. RET-07 (dato). Simulación con `nivl-game-balancer` en las semanas 1, 4 y 40.
- **Chat 4:** la UI y el copy de RET-03 (estado bloqueado y tarjeta de regreso), RET-05 (la línea en Hoy), RET-06 (`notifications.ts`), RET-07 (aviso de recuperación), RET-09 (onboarding, después de los datos) y RET-10. Interruptor «Ayudar a mejorar NIVL» si se aprueba la sección 6 de MEDICION.
- **Chat 3:** revisar los eventos nuevos de MEDICION (sección 6) y su base legal. Avisos por lectura de código (MEDICION, sección 1): `freeze_on.reason` como dato general, y `trial_started`, `creator_referral` y `pro_interest`, que podrían fallar sin consentimiento de salud por el trigger de la 0030 (hay que reproducirlo).
- **Chat 1:** declarar en App Privacy y Data Safety los eventos que el Chat 3 apruebe, antes de activarlos.
- **Chat 2:** si se reproduce lo de `trial_started`, la prueba de 7 días está rota para quien no aceptó el consentimiento de salud.
- **Coordinador:** la migración de la sección 6 de MEDICION (tipos en la lista general de la 0030, topes por día, borrado con `pg_cron`) y el espejo de `kinds.ts` si se toca RET-09. Ninguna de las propuestas RET-01 a RET-08 necesita SQL.
- **Dueño del producto:** decidir RET-02, RET-03 y RET-08 (⚖).
