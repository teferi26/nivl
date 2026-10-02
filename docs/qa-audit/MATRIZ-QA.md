# Matriz de QA — NIVL Winter Arc

Chat 5 (QA, economía y retención). Fecha: 02/10/2026 (segunda tanda). Base: `fix/appstore-review-20260929` @ `bf32d2809b9f8f74fb8f165defbd01307477d48b`, que desciende del código de la build 20 (`8d22e544`). Rama de trabajo: `winter/chat5-qa`. **SHA actual de la columna automática: `d3dccae5ba74e67c4ec050847524000d9311677b`** (incluye `d0682a6` y `d3dccae`: `engine.ts`, `links.ts` y los tests `qa-*`).

La matriz dice **qué está probado, dónde, con qué build y con qué cuenta**. No es una lista de deseos. Cuando el coordinador entregue un SHA candidato integrado, se añade una columna «Auto @SHA candidato» y se repiten las pruebas afectadas. Un PASS en `bf32d28` no vale para otro SHA si ese SHA toca el flujo.

## Leyenda y reglas

| Valor | Significado |
|---|---|
| **PASS** | Ejecutado por quien firma y correcto. En la columna automática, solo lo que ejecutó el Chat 5 en el SHA indicado. |
| **FAIL** | Ejecutado y con fallo (enlazar defecto y dueño). |
| **NO PROBADO** (NP) | Nadie lo ha ejecutado en esa plataforma y build, o la evidencia no identifica build o dispositivo. |
| **NO APLICABLE** (NA) | La función no existe en esa plataforma (motivo en «Notas»). |

- **Evidencia automática:** Jest y `tsc` en el SHA. Solo cubren lógica pura y contratos de módulo. No prueban RPC reales, concurrencia, StoreKit ni pantallas en un dispositivo.
- **Evidencia emulada:** simulador iOS, emulador Android o navegador con build local o fixtures. No acredita el binario de tienda ni compras reales.
- **Evidencia física:** iPhone o Android reales con binario de TestFlight o de la pista interna de Play, anotando versión y build. Hoy **todo es NO PROBADO**: ningún archivo acredita un resultado físico con build identificada. Los 22 casos de `docs/appstore-review-2026-09-29/QA-FISICA.csv` siguen en PENDIENTE. El vídeo del 01/10 (`coordinacion-winter-arc/VIDEO-REVISION.md`) no identifica build, modelo ni iOS: **no se usa como PASS**.
- Un `npx expo export` no es un IPA o APK probado. Un mock de StoreKit, como el del arnés `chore/ios-screenshots-107`, no acredita una compra sandbox.

## Ejecución automática del Chat 5

| Comando | SHA | Árbol | Resultado |
|---|---|---|---|
| `npm run typecheck` (`tsc --noEmit`) | `bf32d28` | limpio (`git status` vacío antes y después) | **PASS** (exit 0) |
| `CI=true npx jest --ci --runInBand` | `bf32d28` | limpio | **PASS**: 29/29 suites, 392/392 tests, 32,7 s |
| `npm run typecheck` | **`d3dccae`** | código limpio (solo docs y e2e sin seguimiento) | **PASS** (exit 0) |
| `CI=true npx jest --ci --runInBand` | **`d3dccae`** | ídem | **PASS**: 32/32 suites, 418/418 tests. Incluye 1 `test.failing` (dos dispositivos), que Jest cuenta como pasado porque **sigue fallando** |
| `CI=true npm run lint` (`expo lint`) | **`d3dccae`** | ídem | **PASS** (exit 0, 0 avisos) |
| `npm run typecheck` | **`2ae57c4`** | código limpio | **PASS** |
| `CI=true npx jest --ci --runInBand` | **`2ae57c4`** | ídem | **PASS**: 33/33 suites, 432/432 tests (incluye `close_day_v2` con dos dispositivos y paridad app/coach) |
| `CI=true npm run lint` | **`2ae57c4`** | ídem | **PASS** (0 avisos) |
| `deno check functions/coach/index.ts` + `deno test tools_paridad_test.ts` con el parche del espejo | `2ae57c4` + parche | **copia aislada** en el scratchpad, no el repo | **PASS** (1/1) |

Ejecutado el 02/10/2026 en Windows 11 con zona `Europe/Madrid` (el 25/10/2026 dura 25 h en esta máquina, así que el test de cambio de hora ejercita el DST real), en el worktree `winter-chat5`. No se ejecutaron `expo export`, Deno ni pruebas SQL: corresponden al coordinador en el SHA integrado.

**Qué valen los tests `qa-*`:** `qa-hipotesis.test.ts` ejecuta `engine.ts` y `links.ts` reales contra un **servidor simulado** (`__tests__/qa/servidor.ts`) que imita la semántica de las RPC desplegadas. Un PASS ahí es evidencia automática del cliente con servidor simulado. **No prueba el SQL real ni es evidencia física.** `qa-calendario.test.ts` cubre cambio de hora y zona en el espacio de claves de fecha. `qa-simulacion.test.ts` simula la progresión a 30 y 90 días y la vuelta en la semana 40.

**Aviso:** el SHA vigente de esta columna es `2ae57c4`. Para la regresión final se repite en el SHA integrado que entregue el coordinador.

**Hueco cerrado en `d3dccae`:** en `bf32d28` ningún test importaba `engine.ts` ni `links.ts`, y no había tests de cambio de hora. Ya los hay (servidor simulado). **Cerrado en `486b1cb`:** el cierre desde dos dispositivos usa `close_day_v2` (0035, aplicada en producción por el coordinador el 02/10/2026; validada por el Chat 3 en rollback, 33/33). En automático con servidor simulado: PASS. El riesgo solo persiste contra un servidor SIN 0035 (`test.failing` documental).

## Plataformas y builds

| Plataforma | Build que cuenta | Estado |
|---|---|---|
| iOS físico | NIVL 1.0.7 ([BUILD]) de TestFlight con la OTA final aplicada (`updateId`), en iPhone con iOS 27.0.1 o posterior. Hoy la última VALID es la 20 (no contiene `d0682a6`/`d3dccae`). La confirma el coordinador | Sin ejecuciones registradas |
| Android físico | APK/AAB de la pista interna de Play con versionCode anotado | **Sin build Android identificada** en el expediente; pedir al coordinador |
| Simulador iOS | Build local o arnés de capturas | Ninguna ejecución sobre `bf32d28` ni `d3dccae`. El arnés solo se ejecutó sobre el código `112109db` (build 18), con fixtures |
| Emulador Android | Build local | Ninguna ejecución |
| Web Chrome / Safari / Firefox / Edge | `expo export --platform web` del SHA | Ninguna ejecución del Chat 5. El coordinador exportó web el 01/10 sin navegar los flujos |
| iPad | `supportsTablet=false`: la app de iPhone corre en modo compatibilidad | NO PROBADO. Apple puede revisar en iPad: no es NA |

Cuentas (sin credenciales en el repo): **REV** = revisora de Apple (no borrar, no aceptar consentimientos); **DES** = desechable nueva; **ELI** = demo Élite/ludus (cinco ficticias, no borrar); **SBX** = cuenta sandbox de Apple o tester de licencia de Play.

## Matriz

Columnas: Auto = Jest/tsc/lint @`d3dccae` (si no se indica otra cosa) · SimI = simulador iOS · EmuA = emulador Android · iOS = iPhone físico · And = Android físico · Web = Chrome/Safari/Firefox/Edge (los cuatro iguales salvo nota).

### Acceso

| ID | Flujo | Auto | SimI | EmuA | iOS | And | Web | Cuenta | Caso físico | Notas |
|---|---|---|---|---|---|---|---|---|---|---|
| A1 | Arranque en frío | NP | NP | NP | NP | NP | NP | cualquiera | O-01 | Sin pruebas de arranque. Solo `tsc` limpio |
| A2 | Registro y confirmación | PASS (unidad: `validation.test.ts`, reglas de contraseña) | NP | NP | NP | NP | NP | DES | O-02 | La unidad no prueba el puente `franky-auth` ni el correo |
| A3 | Login cuenta revisora | NP | NP | NP | NP | NP | NP | REV | O-03 | El 29/09 se comprobó login HTTP 200 contra el servidor (AUDITORIA.md). Es evidencia de servidor, no de cliente físico |
| A4 | Declaración de edad y onboarding | PASS (unidad: `age.test.ts`, `compromiso.test.ts`, `kinds.test.ts`) | NP | NP | NP | NP | NP | DES | O-06 | |
| A5 | Cuentas Pro y Élite de revisión ven sus funciones sin comprar | NP | NP | NA | NP | NA | NP | REV Pro/Élite | A-11 (Chat1-A11) | |

### Primera misión y progreso

| ID | Flujo | Auto | SimI | EmuA | iOS | And | Web | Cuenta | Caso físico | Notas |
|---|---|---|---|---|---|---|---|---|---|---|
| M1 | Crear y completar la primera misión; XP en Perfil | PASS (unidad: `game.test.ts`, tablas de XP y nivel) | NP | NP | NP | NP | NP | DES | O-06 | `completeQuest` (RPC) sin test en esta base |
| M2 | Doble toque al completar | PASS (automático, servidor simulado: `qa-hipotesis`, «doble toque: la segunda llamada no paga») | NP | NP | NP | NP | NP | DES | W-08 | Cerrojo `completing` en Hoy y RPC transaccional: sin prueba |
| M3 | Campaña y agenda | PASS (unidad: `plan.test.ts`, `timeline.test.ts`) | NP | NP | NP | NP | NP | DES | O-07 | |
| M4 | Hábitos | PASS (unidad: `habits.test.ts`) | NP | NP | NP | NP | NP | DES | — | |

### Sincronización y XP

| ID | Flujo | Auto | SimI | EmuA | iOS | And | Web | Cuenta | Caso físico | Notas |
|---|---|---|---|---|---|---|---|---|---|---|
| X1 | Cierre de día: racha, piedras, penalización | PASS (unidad: `closing.test.ts`, `computeDayClose`, tolerancia, reglas) | NP | NP | NP | NP | NP | DES | W-02 | Cubre el cálculo puro. El efecto, en X2 |
| X2 | Una sola «Misión de penalización» por día (cambio de pestaña rápido tras medianoche) | **PASS** (automático, servidor simulado: H3 «mismo dispositivo: una sola penalización y una sola recuperación») | NP | NP | NP | NP | NP | DES | W-02 | Corregido en cliente (`d0682a6`). Falta el teléfono |
| X3 | Cierre simultáneo en dos dispositivos | **PASS** (`2ae57c4`, servidor simulado con semántica `close_day_v2`); SQL real: Chat 3 33/33 en rollback | NP | NP | NP | NP | NP | DES | W-01 | Requiere build u OTA con `486b1cb` + 0035 en servidor (aplicada). Dueño: Chat 5 |
| X4 | Recuperación: completar la misión de penalización devuelve XP una vez | **PASS** (automático, servidor simulado: H3 «devuelve exactamente lo perdido»; RET-01 «topada en 0»: con 120 XP y 200 de penalización devuelve 120) | NP | NP | NP | NP | NP | DES | W-15 | |
| X5 | Fallo entre cierre y creación de la recuperación (¿XP irrecuperable?) | **PASS** (automático, servidor simulado: H1 «fallo transitorio… no deja XP irrecuperable», «el fallo se ve y queda auditado») | NA | NA | NA | NA | NA | — | — | Solo reproducible con inyección de fallo. Recuperación ante fallo de red resuelta en `d0682a6` |
| X6 | Misión enlazada: gimnasio | **PASS** (automático, servidor simulado: H2 «paga la misión y el módulo solo la diferencia», «respuesta perdida», «fallo transitorio al leer», «completada en otro dispositivo») | NP | NP | NP | NP | NP | DES | W-03 | Doble pago por fallo de red corregido en `d0682a6`. En el teléfono, comparar el XP total |
| X7 | Misión enlazada: diario | PASS parcial (mismo `propagarActo` que X6; H2 solo ejercita `gym`) | NP | NP | NP | NP | NP | DES | W-04 | `journalmath.test.ts` no cubre el pago. `restoDelModulo` se ejercita en H2 con el gimnasio. La revisión del vídeo explica +15 = misión 10 + resto 5 por lectura de código, sin prueba |
| X8 | Misión enlazada: cardio | PASS parcial (mismo `propagarActo`; H2 solo ejercita `gym`) | NP | NP | NP | NP | NP | DES | W-05 | |
| X9 | Misión enlazada: nutrición | PASS parcial (mismo `propagarActo`; H2 solo ejercita `gym`) | NP | NP | NP | NP | NP | DES | W-06 | |
| X10 | Misión enlazada: peso | PASS parcial (mismo `propagarActo`; H2 solo ejercita `gym`) | NP | NP | NP | NP | NP | DES | W-07 | |
| X11 | Offline / modo avión al registrar y reconectar | PASS parcial (unidad: `validation.test.ts`, `mensajeSistema` «sin conexión»; `account.test.ts`, «network interruption keeps the local session») | NP | NP | NP | NP | NP | DES | O-17, W-09 | La unidad solo cubre el mensaje |
| X12 | Ausencia de 14 días | PASS (automático: `qa-simulacion`, «14 días fuera: pérdida topada, recuperable exacta») | NP | NP | NP | NP | NP | DES | W-11 | |
| X13 | Ausencia de 30 días | PASS (automático: `qa-simulacion`, «30 días fuera…») | NP | NP | NP | NP | NP | DES | W-12 | |

### Tiempo: medianoche, cambio de hora y zona

| ID | Flujo | Auto | SimI | EmuA | iOS | And | Web | Cuenta | Caso físico | Notas |
|---|---|---|---|---|---|---|---|---|---|---|
| T1 | Medianoche: completar a las 23:59 y a las 00:01 | PASS (automático, servidor simulado: «medianoche · Hoy cargada ayer y tocada hoy») | NP | NP | NP | NP | NP | DES | W-13 | |
| T2 | Cambio de hora 25/10/2026 (03:00 CEST → 02:00 CET) | PASS (automático: `qa-calendario`, con DST real de `Europe/Madrid`) | NP | NP | NP | NP | NP | DES | W-10 | Prueba las claves de fecha y el cierre que cruza el 25/10, no los recordatorios |
| T3 | Cambio de zona horaria (viaje) | PASS parcial (automático: `qa-calendario`, en el espacio de claves; hacia el este se adelanta el cierre, comportamiento documentado) | NP | NP | NP | NP | NP | DES | W-14 | `profiles.timezone` frente a la zona del dispositivo: sin prueba |
| T4 | Hoy abierta antes de medianoche, misión tocada después → «El día ha cambiado» y no se paga | PASS (automático, servidor simulado: «una misión que hoy no toca no se completa con la fecha de hoy») | NP | NP | NP | NP | NP | DES | W-19 | `d0682a6` |
| T5 | Penalización de ayer tocada hoy → aviso de caducada, no se paga | PASS (automático, servidor simulado: «la penalización de ayer ya no se cobra después de medianoche») | NP | NP | NP | NP | NP | DES | W-20 | `d0682a6` |

### IA y consentimientos

| ID | Flujo | Auto | SimI | EmuA | iOS | And | Web | Cuenta | Caso físico | Notas |
|---|---|---|---|---|---|---|---|---|---|---|
| C1 | Rechazar salud e IA: funciones generales accesibles | PASS (unidad: `consentguard.test.ts`, `health.test.ts`) | NP | NP | NP | NP | NP | DES | O-04 | El arnés de capturas lo ejecutó en simulador con fixtures sobre `112109db` (build 18). No cuenta para `bf32d28` ni para `d3dccae` |
| C2 | Aceptar salud e IA por separado | PASS (unidad: `consentmath.test.ts`, `consentguard.test.ts`) | NP | NP | NP | NP | NP | DES | O-05 | |
| C3 | Retirar IA: sin nuevas llamadas | PASS parcial (unidad: `consentguard.test.ts`) | NP | NP | NP | NP | NP | DES | O-14 | La versión de consentimiento 2026-09-29 la exige el servidor (0034): sin prueba de cliente |
| C4 | Retirar y borrar salud | PASS parcial (unidad: `health.test.ts`, retirada en otro dispositivo; `health-completions.test.ts`, fotos ocultas sin perder XP) | NP | NP | NP | NP | NP | DES | O-14 | |
| C5 | Coach: respuesta real no sensible | PASS parcial (unidad: `routing.test.ts`, elección de modelo; no llama al proveedor) | NP | NP | NP | NP | NP | DES | O-12 | |

### Compra y restauración

| ID | Flujo | Auto | SimI | EmuA | iOS | And | Web | Cuenta | Caso físico | Notas |
|---|---|---|---|---|---|---|---|---|---|---|
| P1 | Planes: título, duración, precio y enlaces legales | PASS (unidad: `prooffer.test.ts`, `proplans.test.ts`, `storepolicy.test.ts`) | NP | NP | NP | NP | NA (web sin tienda nativa; `subscription.ts` es Stripe y solo para el Oráculo) | DES/REV | O-09 | El arnés `pro-review.yaml` usa un catálogo ficticio: no prueba precios reales |
| P2 | Compra sandbox y acceso por servidor | PASS (unidad: `pro-purchases.test.ts`, con mocks) | NA (StoreKit real) | NA | NP | NP | NA | DES+SBX | O-08 | Un mock no acredita la compra |
| P3 | Restaurar tras reinstalar | PASS parcial (unidad: `pro-purchases.test.ts`, mock) | NA | NA | NP | NP | NA | DES+SBX | O-10 | |
| P4 | **Restaurar tras borrar y recrear cuenta** | NP | NA | NA | NP | NP | NA | DES+SBX | O-11 | Obligatorio. Depende de Restore Behavior de RevenueCat (sin leer del panel) |
| P5 | Cancelación, renovación, caducidad y devolución | NP | NA | NA | NP | NP | NA | DES+SBX | O-22 | |
| P6 | Android: compra y restauración en Play | NP | NA | NA | NA | NP | NA | DES+SBX | W-18 | |

### Social, fotos, datos y cuenta

| ID | Flujo | Auto | SimI | EmuA | iOS | And | Web | Cuenta | Caso físico | Notas |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 | Denuncia y bloqueo (amigos y ludus) | PASS (unidad: `socialSafety.test.ts`, `socialmath.test.ts`, `elite.test.ts`) | NP | NP | NP | NP | NP | 2×DES / ELI | O-13 | AUDITORIA: 11 escenarios SQL/RLS en el servidor. No es una prueba de cliente |
| F1 | Subida de foto (avatar o evidencia) | PASS (unidad: `avatar-storage.test.ts`) | NP | NP | NP | NP | NP | DES | O-16 (pre) | |
| F2 | Exportación de datos | NP | NP | NP | NP | NP | NP | DES | O-15 | |
| F3 | Borrado de cuenta: Auth, BD y archivos de Storage | PASS (unidad: `account.test.ts`) | NP | NP | NP | NP | NP | DES | O-16 | AUDITORIA: QA real de servidor con dos cuentas ficticias (archivos no accesibles a los 218 s). Falta el cliente físico |
| F4 | Permisos de cámara, fotos y notificaciones denegados | NP | NP | NP | NP | NP | NA | DES | O-19 | |

### Notificaciones, enlaces y accesibilidad

| ID | Flujo | Auto | SimI | EmuA | iOS | And | Web | Cuenta | Caso físico | Notas |
|---|---|---|---|---|---|---|---|---|---|---|
| N1 | Recordatorio llega y abre la ruta correcta | NP (`routing.test.ts` prueba el enrutado de modelos del coach, no las notificaciones) | NP | NP | NP | NP | NA (sin push web) | DES | W-17 | |
| N2 | Enlace profundo con app cerrada; vuelta desde segundo plano | NP | NP | NP | NP | NP | NP | DES | O-21 | |
| N3 | Enlaces legales y segundo arranque | NP | NP | NP | NP | NP | NP | DES | O-18 | |
| N4 | Texto grande y VoiceOver/TalkBack | NP | NP | NP | NP | NP | NP | DES | O-20 | |

«PASS (unidad: …)» significa que esas suites pasaron en `bf32d28` y en `d3dccae`. «Servidor simulado» significa `engine.ts`/`links.ts` reales contra `__tests__/qa/servidor.ts`, no contra el SQL real. **No significa que el flujo funcione en un dispositivo.** Para cerrar una fila hace falta la columna física.

### Dispositivos iOS (lista mínima del Chat 1)

| ID | Flujo | Dispositivo | Resultado | Caso físico | Notas |
|---|---|---|---|---|---|
| D1 | Paywall, consentimientos y hoja de borrado sin texto cortado | iPhone pequeño (SE/mini), iOS 27 | NP | D-01 (Chat1-B1) | |
| D2 | Mismas pantallas | iPhone grande (Pro Max/Plus), iOS 27 | NP | D-02 (Chat1-B2) | |
| D3 | Arranque y login en iOS mínimo (minOS 15.1) | iPhone más antiguo disponible | NP | D-03 (Chat1-B3) | Si no hay dispositivo: NP con motivo y no bloquea |
| D4 | Arranque, login, paywall y compra en modo compatibilidad | iPad (`supportsTablet=false`) | NP | D-04 (Chat1-B4) | Apple puede revisar en iPad |
| D5 | «Designed for iPhone» en Mac | Mac Apple Silicon | NP | — | Fuera del mínimo (Chat 1, apartado C). Disponible por defecto en ASC: probarlo o desactivarlo |

## GO / NO-GO

**Dictamen a 02/10/2026 (SHA `2ae57c4`): NO-GO para reenviar a Apple.** Todos los bloqueantes siguen en NO PROBADO en el binario final; no hay binario ni OTA integrados que contengan las correcciones. No queda ningún FAIL automático abierto en economía.

Los identificadores `Chat1-A#` y `Chat1-B#` son los de la lista mínima del Chat 1 (`docs/release-audit/pruebas-fisicas-minimas.md`). No hay que confundirlos con las filas A1–A5 de la matriz. **Cada bloqueante necesita PASS físico** con la misma build `[BUILD]` de TestFlight, con la OTA final aplicada si la hay, y anotando `updateId`, dispositivo e iOS. Ninguno puede quedar en NO PROBADO ni en FAIL.

### Bloqueantes de Apple (en el vídeo): Chat1-A1 a A11

| Chat 1 | Bloqueante | Filas matriz | Caso físico | Estado |
|---|---|---|---|---|
| A1 | Arranque en frío desde el icono, iPhone con iOS 27.0.1 o posterior | A1 | O-01 | NP |
| A2 | Registro y confirmación | A2 | O-02 | NP |
| A3 | Login de la cuenta D y de las 3 cuentas de revisión | A3 | O-03 | NP (solo el login HTTP 200 de la revisora contra el servidor, del 29/09) |
| A4 | Flujo típico: misión, hábito, campaña y agenda | M1, M3, M4 | O-06, O-07 | NP |
| A5 | Salud e IA rechazadas y aceptadas; el coach responde | C1, C2, C5 | O-04, O-05, O-12 | NP |
| A6 | Paywall: 5 planes con título, duración y precio, y enlaces legales | P1 | O-09 | NP |
| A7 | Compra sandbox → acceso concedido por el servidor | P2 | O-08 | NP |
| A8 | Restaurar compras (misma cuenta) | P3 | O-10 | NP |
| A9 | Denuncia, bloqueo y desbloqueo | S1 | O-13 | NP |
| A10 | Borrado de la cuenta D con Auth, BD y Storage limpios en el servidor | F3 | O-16 | NP |
| A11 | Cuentas Pro y Élite de revisión sin comprar | A5 | A-11 | NP |
| — | El vídeo en sí: una toma, iPhone físico, último iOS, empieza abriendo la app | — | «Grabación única» en QA-FISICA-WINTER.md | NP (el vídeo del 01/10 no basta) |

### Bloqueantes de revisión (Guideline 2.1, bugs): Chat1-B1 a B7

| Chat 1 | Bloqueante | Filas matriz | Caso físico | Estado |
|---|---|---|---|---|
| B1 | iPhone pequeño | D1 | D-01 | NP |
| B2 | iPhone grande | D2 | D-02 | NP |
| B3 | iOS mínimo (15.1) | D3 | D-03 | NP. **Condicional:** solo bloquea si hay un dispositivo antiguo. Si no lo hay, se queda en NO PROBADO con el motivo y no bloquea |
| B4 | **iPad en modo compatibilidad** | D4 | D-04 | NP. Bloquea: Apple puede revisar en iPad |
| B5 | Modo avión al abrir y al comprar | X11 | O-17 | NP |
| B6 | **Restaurar tras borrar y recrear la cuenta** | P4 | O-11 | NP. Obligatorio |
| B7 | Notificaciones, cámara y fotos denegadas | F4 | O-19 | NP |

### Otros bloqueantes del reenvío (COORDINACION.md)

| # | Bloqueante | Filas / casos | Estado |
|---|---|---|---|
| G1 | Retirar consentimientos (IA y salud) en el binario final | C3, C4 / O-14 | NP |
| G2 | Ningún P0/P1 abierto en el alcance de lanzamiento | X3 / W-01, W-21 | **Abierto en físico**: economía PASS en automático (X2, X3 con 0035). Falta W-01/W-02 en teléfono con build u OTA que contenga `486b1cb`. P0 de prueba Pro sin consentimiento de salud: corregido en SQL 0035 (Chat 3), falta W-21 en teléfono |

Para el **lanzamiento público** (no para responder a Apple) también bloquean los casos físicos de economía: W-01 a W-04, W-08, W-09, W-15, W-19 y W-20. Las filas X1–X7, M2, T1, T4 y T5 ya pasan en automático con servidor simulado, **pero eso no es evidencia física**. Si se publica en Play, también bloquea el arranque y el login en Android físico (W-16).

El GO se emite cuando:

1. el coordinador fija un SHA candidato, la `[BUILD]` y la OTA;
2. todos los bloqueantes de arriba quedan en PASS físico en esa build (D-03 puede quedar en NO PROBADO con motivo);
3. el Chat 5 repite typecheck, Jest y lint en ese SHA;
4. el SQL del cierre (G2) está desplegado y revisado;
5. ningún cambio posterior invalida los resultados.

Ninguna auditoría garantiza la decisión de Apple.

## Pendiente de este documento

- Repetir la columna automática en el SHA candidato integrado (hoy está en `d3dccae`).
- Pasar a esta matriz los resultados que el usuario anote en [QA-FISICA-WINTER.csv](QA-FISICA-WINTER.csv), con build y cuenta.
- Columna emulada: el arnés Maestro portado (`e2e/maestro/`, ver [MAESTRO-PORT.md](MAESTRO-PORT.md)) se puede ejecutar contra un dev client o una build de simulador del SHA candidato. Mientras no se ejecute, sigue en NP.
