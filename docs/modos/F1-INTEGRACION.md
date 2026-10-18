# Modos F1 · Integración

Rama `integ/modos-f1`, que parte de 659714e. Solo hay commits locales: no se ha hecho push, deploy, OTA ni EAS, no se han aplicado migraciones en producción y no se ha tocado la base real.

## Merges (`git merge --no-ff`, en este orden)

| # | Rama | SHA | Merge |
|---|---|---|---|
| 1 | `modos-f1/servidor` | 1c4748d | 9c16754 |
| 2 | `modos-f1/cliente` | 2f60a09 | 29efb26 |
| 3 | `modos-f1/idiomas` | a28a175 | 0fddbd7 |
| 4 | `modos-f1/motor` | 9451103 | 7cd593e |
| 5 | `modos-f1/analitica` | 67888d1 | d8d0d83 |

La analítica no estaba en el encargo inicial porque estaba en revisión legal. Entró después, cuando el coordinador avisó de que ya tenía el consentimiento LSSI.

Commits propios después de los merges:
- **6810d04**: traducciones de modos, prueba e iron, idioma en el primer paso del onboarding, `flagsEstado.ts` y textos de iron aceptados;
- **03806f5**: traducciones de la analítica y pruebas de BD con la exportación v9;
- este informe.

## Conflictos y cómo se resolvieron

### Servidor y cliente
Entraron sin conflictos.

### Idiomas
- **`src/lib/flags.ts`.** Manda la versión de cliente: caché en memoria y en el teléfono, refresco al volver a primer plano y apagado si falta la función. De la de idiomas se conserva `flagActivo(k)`, la lectura síncrona que usa `cabeceraIdioma()` en `lib/coach.ts`, junto con el tipo `FlagBooleano`.
  - Después hubo que sacar el estado en memoria a **`src/lib/flagsEstado.ts`** (sin AsyncStorage ni Supabase). Con la `flags.ts` de cliente, `coach.ts` arrastraba AsyncStorage y cinco suites de Jest (coach, sec-coach-*, singuiones, interfaz) morían con «NativeModule: AsyncStorage is null».
  - Ahora `coach.ts` importa `flagActivo` de `flagsEstado`, y `flags.ts` reexporta todo, así que la API pública no cambia.
- **`src/lib/__tests__/flags.test.ts`.** Es el de cliente, más una prueba de `flagActivo`: apagado hasta que el servidor diga `true`, y se vuelve a apagar si falta la función. `interfaz.test.ts` pasa a usar `fijarFlags` de `flagsEstado`.
- **`src/components/idioma/SelectorIdioma.tsx`.** Gana el de idiomas. El de cliente era un stub con la misma firma, y el de idiomas añade `ocupado?`.
- **`src/lib/coach.ts`.** `authHeaders()` lleva las dos cabeceras: `...cabecerasModoCoach()` y `...cabeceraIdioma()`. Cada una solo va con su interruptor.
- **`perfil.json` (es), `perfil.tsx` y `textos-es.aceptados.tsv`.** Se unieron las dos partes (`planes.pruebaAuto` + `idiomaApp.*`, `HojaIdiomaApp` en el import y los dos bloques del tsv).
- **`recursos.ts` y `onboarding.json`.** No dieron conflicto: git los mezcló solo.

### Motor
- **`src/i18n/recursos.ts`.** Unión de los namespaces `modos`, `prueba` e `iron`.
- **`src/components/iron/estilo.ts`.** Ahora es `ACENTO_IRON = modoAcento.iron` (de `design/tokens.ts`). Se mantiene el nombre exportado para no tocar `DemoIron` ni `FichaIron`.
- **`iron.json`.** Se queda en `src/i18n/es/`, donde están todos los catálogos (no existe `locales/`).
- **`textos-es.aceptados.tsv`.** Faltaban los 98 textos de `iron` (el motor no los había apuntado). Se añadieron en un bloque propio y `verificar-es` vuelve a 0.

### Analítica
- **`scripts/apply-migrations.mjs`.** Están las huellas de 0070 a 0073 y de 0066 a 0069, en orden descendente.
- **`src/app/onboarding.tsx`.** Se suman las dos piezas:
  - el paso del idioma (-1) y el de modos (2,5) de cliente;
  - la pregunta de medición de analítica, que es un subestado del paso 0, tras la portada. Al decidir se sigue con `tras(0)` en vez de un `1` fijo.
  - Con todo encendido, el orden es: idioma, portada, medición, nombre, para qué, modos, y el resto.
  - `onboarding_paso` solo se registra en los pasos enteros de 0 a 6. Son los del panel, y el validador del evento solo acepta enteros. El -1 y el 2,5 no se miden.
- **`src/app/(tabs)/index.tsx`.** El selector de modo de cliente y, a la vez, `HojaOpinion` y `PreguntaMedicionUso` de analítica.
- **`perfil.json` (es) y `textos-es.aceptados.tsv`.** Unión.
- **`src/lib/flagsServidor.ts`** (la lectura de flags propia de analítica) se ha dejado tal cual. Es independiente y con un fallo apaga todo. Unificarlo con `flags.ts` queda pendiente.

## Trabajo de integración (además de los conflictos)

### Idioma en el primer paso del onboarding
Cliente ya lo había dejado montado con `idiomas_activos` y el `SelectorIdioma`. Al integrar, aparecieron dos fallos y se corrigieron:
1. **Bucle del idioma.** Elegir un idioma distinto cambia la interfaz, y la raíz remonta el árbol (`key={interfaz}` en `_layout.tsx`). El `useRef` que recordaba «idioma contestado» se perdía, así que el onboarding volvía a empezar por el idioma.
   - Ahora es una variable de módulo (`idiomaOnboardingContestado`), y se marca ANTES de `fijarPreferencia`.
2. **Destello de la portada.** Si los interruptores ya están en la caché del teléfono al montar, el paso inicial es directamente el idioma, sin pasar un instante por la portada.

Además, el selector recibe `ocupado={busy}` mientras se guarda.

### Traducciones a en, fr, pt, de e it
Se tradujeron con el tono y el glosario de los catálogos existentes: Élite y ludus sin traducir; streak/série/sequência/Serie/serie; brief; tuteo; sin exclamaciones ni rayas. En francés, U+00A0 delante de `: ; ?`, como el resto del catálogo. `traducidos.ts` se regeneró con `scripts/i18n/registrar-traducidos.mjs`.

| Bloque | Claves por idioma |
|---|---:|
| `modos` (nuevo) | 30 |
| `prueba` (nuevo) | 34 |
| `iron` (nuevo) | 98 |
| `onboarding:idioma.*` | 3 |
| `perfil:planes.pruebaAuto` | 1 |
| `hoy:opinion.*` (analítica) | 11 |
| `perfil:medicion.*` (analítica) | 12 |

Ahora cada idioma tiene 36 namespaces y las mismas claves que `es`.

### Pruebas de BD con la exportación v9
- **`scripts/test-modos-f1.mjs`.** Con la 0072 en el repo, espera:
  - la exportación `version: 9`, con `funnel_events`, `app_feedback` y `admins` vacíos para un usuario 1.0.9;
  - las semillas de `app_flags()` con `analitica_activa` y `opinion_activa` apagados;
  - 8 filas públicas en `app_config`.

  Sin la 0072, comprueba lo de antes.
- **`scripts/probar-f1-servidor.sql`.** El paso 14 acepta la v8 o una posterior.
- **`scripts/test-export-full-schema.mjs`.** Pasa de v8 a v9.

## Verificación (sobre 03806f5)

| Verificación | Resultado |
|---|---|
| `npx tsc --noEmit` | 0 errores |
| `npx eslint .` | 0 problemas |
| `CI=true npx jest --ci` | 119 suites y 1922 pruebas en verde, entre ellas `traducidos.test.ts` en los 5 idiomas |
| `node scripts/i18n/verificar-es.mjs` | «El español dice lo mismo que la línea base» |
| `node scripts/test-modos-f1.mjs <pglite>` | PASS, 126 comprobaciones (1.0.9 idéntica antes y después, XP por modo, RLS, flags, prueba automática y tienda) |
| `node scripts/analitica/probar-migraciones.mjs <pglite>` | PASS, 65 comprobaciones |
| `node scripts/test-export-full-schema.mjs <pglite>` | PASS (v9) |
| `npx deno test --allow-env --allow-read --no-check supabase/functions` | 269 en verde, 0 fallos y 2 ignorados |
| `npx deno check supabase/functions/coach/index.ts` | OK |

PGlite: `C:\temp\nivl-age-sql-check\node_modules\@electric-sql\pglite\dist\index.js`. Deno 2.9.6, el de `node_modules`, vía `npx --no-install deno`.

## Todos los flags apagados = 1.0.9

Se comprueba con tests y leyendo el código. **No se ha abierto la galería `/kit` en un navegador**: en este worktree `node_modules` es un enlace y Metro no sirve el punto de entrada, como ya avisaba cliente.

- **Onboarding.** Son 7 pasos:
  - `pasos.test.ts`: con los dos interruptores apagados, la secuencia es 0..6 y avanzar es sumar uno;
  - el paso inicial es 0, porque `flagsActuales()` está apagado;
  - la medición solo se pregunta con `analitica_activa` (`useConsentimientoAnalitica.preguntar`). Si no, «Entrar» va a `tras(0)`, que es 1.
- **Hoy:**
  - `derivarHoyModos.test.ts`: sin modo, la salida es idéntica a la de General;
  - el `SelectorModo` solo aparece con `modos.activo` y más de un modo;
  - `PreguntaMedicionUso` solo con `analitica_activa` y sin decisión;
  - `HojaOpinion` solo con sus flags (`usePeticiones`).
- **Perfil:**
  - `NivelesModo` no pinta nada con `modos_activos` apagado;
  - «Idioma» de Ajustes solo con `idiomas_activos`, y sin él sigue «Idioma del coach»;
  - `MedicionUsoSection` devuelve null sin el flag y sin una decisión previa.
- **Textos.** `verificar-es` da 0 diferencias. Todo lo nuevo en español está en `textos-es.aceptados.tsv` y solo se pinta con su flag. `interfaz.test.ts` comprueba que la interfaz queda en `es` con `idiomas_activos` apagado.
- **Coach.** `coach-modo.test.ts`: con los interruptores apagados van las cabeceras de siempre. En el servidor, sin cabeceras, el prompt es idéntico byte a byte (test con hash de servidor, en `deno test`).
- **Prueba automática.** No se lee ni se pinta nada sin `prueba_auto_activa`, y la 0069 no crea la prueba con el interruptor apagado (`test-modos-f1`: «con el interruptor apagado no nace prueba»).
- **IRON.** Solo en `/kit/iron`, que redirige a la raíz con `__DEV__` en false.

## Lo que queda

1. **QA visual en un móvil o en la web con `node_modules` real**:
   - onboarding de 7 pasos con todo apagado;
   - con `idiomas_activos`, elegir English en el primer paso: tiene que recargar en inglés y seguir en la portada, no volver al idioma;
   - Hoy y Perfil con `modos_activos`;
   - la medición con `analitica_activa`.
2. **Revisión nativa** de las traducciones nuevas, en especial:
   - el consentimiento de medición y el aviso de la hoja de opinión, que además necesitan **revisión legal en cada idioma**;
   - los nombres de músculos y material de `iron`;
   - las longitudes en alemán y francés del selector de modos y de la pantalla de fin de prueba.
3. **Unificar `src/lib/flagsServidor.ts`** (analítica) con `flags.ts` / `flagsEstado.ts`. Hoy son dos lecturas de `app_flags()` con cachés distintas. Las dos apagan ante un fallo, así que no es un riesgo, pero sí duplicación. `Flags` de `flagsmath.ts` tampoco conoce `analitica_activa` ni `opinion_activa`.
4. **Lo que idiomas dejó en español** (`proplans`, `consent.ts`, puertas, `achievements`…) hay que cerrarlo antes de encender `idiomas_activos` en producción.
5. **Orden de despliegue** (lo hace el coordinador):
   - migraciones 0066 a 0073 por orden;
   - después, la función `coach`;
   - después, OTA o binario;
   - y al final, encender interruptores uno a uno.

   La 0068 tiene que estar antes de `modos_activos`.
