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

## Arreglos del QA de F1 (`coordinacion-winter-arc/QA-F1-MODOS.md`)

Sobre 4c675b8, en commits pequeños (bbfd67d..HEAD). Sin push, deploy, OTA, EAS ni base real. **Con todos los flags apagados la app sigue siendo la 1.0.9**: cada cambio visible está detrás de `idiomas_activos`, `modos_activos`, `prueba_auto_activa` o `analitica_activa`, o deja el español igual letra por letra. Lo fijan `textosLibEs.test.ts` (foto del español sacada del código de antes de tocarlo) y `verificar-es`.

### Mayores

| QA | Qué se ha hecho | Dónde |
|---|---|---|
| M1 | La fecha de bienvenida, aviso y fin de la prueba Élite sale de `fechaLarga()` en el idioma de la interfaz. En es, la de siempre. | `pruebaAutomath.ts` (`fechaHoraLocal`) |
| M2 | Los precios de reserva (sin tienda) van con Intl en el idioma activo y siempre en euros: `eurosLocal()` («€29.99» en en, «29,99 €» en de). En es, `euros()` tal cual. Con tienda, el precio llega ya localizado y no se toca. | `proplans.ts` (`eurosLocal`), `pruebaAutomath.ts` (`preciosFin`) |
| M3 | El juramento se escribe y se sella en el idioma de la interfaz, con su fecha y sus plazos («3 years», «3 Jahre») desde `onboarding:compromiso`. En es, el texto es idéntico byte a byte. **Prueba del compromiso:** `commitment_signed` guarda `idioma` cuando no se firmó en español (en es, el evento de siempre, sin clave nueva). `esCompromiso()` reconoce la cabecera de los 6 idiomas, así que Contrato lo enseña como compromiso aunque luego se cambie de idioma. | `compromiso.ts`, `onboarding.tsx` |
| M4 | Dos namespaces nuevos, `juego` (86 textos) y `oferta` (36), más `onboarding:compromiso` (12), traducidos a en, fr, pt, de e it con el glosario (Endgegner, Beute, butin, espólio, boss finale; Élite y ludus sin traducir; tuteo; espacios finos en fr). Las tablas se siguen exportando igual (`STAT_LABEL`, `KINDS`, `MODULES`, `PRO_BENEFITS`...), con getters que leen el catálogo al usarlas (`src/lib/textosVivos.ts`): nunca `t()` al cargar el módulo. | `game.ts`, `kinds.ts`, `proplans.ts` |
| M5 | El selector de modo no corta pestañas: si caben, se reparten el ancho (con 5 modos, más compactas); si no, se desplaza con degradado y chevrón en el borde, y la activa se trae a la vista. Sin dependencias nativas nuevas. | `SelectorModo.tsx` |

Detalles de M4:
- **`game.ts`:** dificultades, nombres de atributo y una abreviatura que se pinta (`STAT_ABBR`: STR, FOR, STÄ, WAH...). El código `FUE`/`VIT`... sigue siendo el de la base. QuestForm, QuestItem, Agenda, Informe, Oráculo y Perfil pintan `STAT_ABBR`.
- **`kinds.ts`:** nombre, título, lema, descripción, campañas, ejemplo de objetivo, misiones propuestas, módulos de Hoy y un `enFrase` nuevo para incrustar el perfil en una frase («Propuestas para un deportista», el ludus de Amigos). `coachHint` se queda en español: no se pinta, es para el coach (igual que `_shared/kinds.ts`).
- **Misiones propuestas fuera del español:** el trigger `infer_link` (0019) solo entiende títulos en español, así que en otros idiomas la misión lleva su `link` explícito (Entrenar → gym, Diario → diario, Pesarse → peso, Comidas → nutricion). En es la fila que se inserta es la de antes (sin `link`; lo deduce el trigger).
- **`proplans.ts`:** lo que se ve en el paso del coach del onboarding: la potencia de cada nivel, los beneficios de Pro y Élite y la línea «Tu juramento está sellado... Ver NIVL Pro» (`COPY_UPSELL['firma.*']`). Cada beneficio lleva un `id` estable (su título en español) para que `beneficiosPorMotivo` case en cualquier idioma.
- En it, `onboarding:misiones.pista` pasa a «Proposte per il tuo profilo ({{para}})», porque «per un studente» no es correcto.

### Menores

| QA | Qué se ha hecho |
|---|---|
| 1 | Los días de la bienvenida salen de `current_period_end` (`diasRestantes`: hacia arriba, con el interruptor como tope). 40 h son 2 días; 20 h, 1. |
| 2 | Al aceptar la medición en el onboarding se espera a que la decisión y `consentimiento_analitica` estén en la cola, y entonces se apunta `onboarding_paso` 0 y se sigue. Orden en la cola: consentimiento, paso 0, paso 1. |
| 3 | Con PGRST202 o 42883 (falta `registrar_evento`) la cola se queda como está y no se vuelve a intentar hasta la próxima apertura: ya no se reenvía el primer evento en cada paso. |
| 4 | Recargar a mitad del onboarding no vuelve a pedir el idioma: además de la marca de sesión, cuenta la preferencia guardada si ya es un idioma concreto (una cuenta nueva arranca en `auto`). |
| 6 | El rótulo de `Button` que salta de línea va centrado y dentro del botón (`textAlign: 'center'`, `flexShrink: 1`). En una línea no cambia nada. |
| 8 | «NIVEL n» de los niveles por modo escala hasta 1,35, como el resto. |
| 10 | La «d» de la racha del Hero sale de `arena:heroRango.unidadDia` (de T, fr j, it g; en y pt d). |
| 13 | La fecha de Hoy salta a dos líneas fuera del español en vez de cortarse. En es, una línea como siempre. |

### Verificación (sobre la última SHA de esta tanda)

| Verificación | Resultado |
|---|---|
| `npx tsc --noEmit` | 0 errores |
| `npx eslint .` | 0 problemas |
| `CI=true npx jest --ci` | 121 suites y 1932 pruebas en verde. Nuevas: `textosLibEs.test.ts` (el español de las librerías, igual que antes) y `textosLibIdiomas.test.ts` (en otros idiomas, enlaces de misiones, compromiso reconocido en todos, plantilla a salvo de lo que escribe el usuario). `qa-hipotesis.test.ts` falló una vez por tiempo con toda la suite cargada; sola y en la siguiente pasada entera, en verde. |
| `node scripts/i18n/verificar-es.mjs` | «El español dice lo mismo que la línea base» (los textos movidos de `src/lib` van como `+` en `textos-es.aceptados.tsv`, con su nota) |
| `node scripts/test-modos-f1.mjs <pglite>` | PASS, 126 comprobaciones |
| `node scripts/analitica/probar-migraciones.mjs <pglite>` | PASS, 65 comprobaciones |

### Pendiente tras el QA

- **Revisión legal en cada idioma (no se ha tocado):** en `proplans.ts`, `COACH_USAGE_NOTICE`, `ELITE_USAGE_NOTICE`, `textoPrueba`, `LINEA_PRUEBA`, `tituloBotonPrueba`, `legalText`, `textoGestionTienda`, `duracionPlan`, `tituloPlan`, `pitchVisible`, `textoIntro` y `planLabel`; los literales de `ProOffer.tsx` y `pro.tsx` (condiciones de compra, «al mes», «Activar...»); `lib/consent.ts` (`DESCARGO_SALUD`, `LINEA_CRISIS`) y las puertas de salud e IA; el resto de `COPY_UPSELL` (los momentos que no son la firma). Con `idiomas_activos` encendido, el paso del coach del onboarding sigue enseñando en español los avisos de uso y la letra de la oferta.
- **Sin cerrar aún (no legales, fuera de este encargo):** `achievements` (logros y títulos como «HÉROE DE LA ARENA»), `PRO_EMPHASIS`, `PRO_TODAY` y `PRO_SAMPLE_BRIEF` de `proplans.ts` (Coach y `/pro`), `lineaProfundos` y `lineaLudus` (`elite.ts`).
- **Revisión nativa:** los textos nuevos de `juego`, `oferta` y `onboarding:compromiso`, sobre todo el juramento en de («{{plazo}} später ist es ein anderes Leben») y los nombres de perfil en de («Berufstätig», «Studium»); y lo que ya señalaba el QA (menor 7): pt «experiência» y de «Test» para la prueba, pt-BR con pt-PT.
- **QA visual otra vez** con `node_modules` real: selector de modo a 375 y 360 (con 5 modos y con texto grande), botones de la hoja de modos y del fin de la prueba en fr y de, fecha de Hoy en pt a 360, onboarding en en con el juramento, Contrato tras firmar en en y volver a es.
- **Menores del QA no tocados** porque no estaban en el encargo: 5 (contador VII → IX), 9 (enlace de privacidad de la hoja de opinión en español), 11 y 12 (de la 1.0.10, previstos).

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
4. **Lo que idiomas dejó en español:** `game`, `kinds`, `compromiso` y lo visible de `proplans` en el onboarding ya están en catálogos (ver «Arreglos del QA»). Quedan los textos legales y de compra, `consent.ts`, las puertas y `achievements`, y hay que cerrarlos antes de encender `idiomas_activos` en producción.
5. **Orden de despliegue** (lo hace el coordinador):
   - migraciones 0066 a 0073 por orden;
   - después, la función `coach`;
   - después, OTA o binario;
   - y al final, encender interruptores uno a uno.

   La 0068 tiene que estar antes de `modos_activos`.
