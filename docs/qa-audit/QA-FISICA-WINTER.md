# QA física Winter Arc: lista para ejecutar en iPhone, iPad y Android

Chat 5 (QA, economía y retención), 02/10/2026, segunda versión. Los casos están en [QA-FISICA-WINTER.csv](QA-FISICA-WINTER.csv) y salen de cuatro fuentes. La columna `origen` dice de dónde viene cada uno:

- **O-01 a O-22:** los 22 casos del expediente del 29/09, que siguen en PENDIENTE en [QA-FISICA.csv](../appstore-review-2026-09-29/QA-FISICA.csv).
- **A-11 y D-01 a D-04:** casos de la lista mínima del Chat 1 (`docs/release-audit/pruebas-fisicas-minimas.md` en su checkout) que no estaban ya en el CSV. El resto de su lista se ha enlazado a casos existentes, sin duplicarlos (tabla de abajo).
- **W-01 a W-20:** casos nuevos de Winter Arc. W-19 y W-20 prueban las correcciones de medianoche del commit `d0682a6`.
- **CH1-01 a CH4-01:** filas reservadas para los Chats 1–4.

**Estado actual: no hay ningún caso ejecutado.** Rellenar solo con lo que se vea en el dispositivo.

## Reglas para que un resultado cuente

1. **Anotar siempre dispositivo, SO, versión/build y cuenta** en cada fila. Si se publica una OTA, anotar también su `updateId`. Un resultado que no indica su build no cuenta. El vídeo del 01/10 no identifica la build y no se usa como PASS.
2. **Todas las pruebas que bloquean se hacen con la misma build `[BUILD]`** de TestFlight, con la OTA final aplicada si la hay. Es la build que se asocia al envío. En Android, el binario de la pista interna de Play. Un `npx expo export`, Expo Go, un simulador o un emulador **no son** un IPA/APK probado.
3. **Un mock de StoreKit o un catálogo simulado (como el del arnés de capturas) no acredita una compra sandbox.** Se compra en el dispositivo con la cuenta sandbox de Apple o con un tester de licencia de Play. Nunca con una tarjeta real.
4. **Usar cuentas de prueba** (las cuentas D y U2 y las de revisión de `cuentas-demo.md` del Chat 1). No borrar las cuentas de revisión ni las cinco del ludus de demostración. No aceptar consentimientos en su nombre salvo lo que indique el Chat 1. No escribir contraseñas, correos ni códigos en el CSV ni en el repositorio.
5. **Si cambia el código o llega otra OTA después de una prueba**, el coordinador decide qué se repite.
6. Si algo falla: marcar `FAIL`, escribir qué se vio y guardar la captura o el vídeo en una carpeta privada (`privado/`), nunca en el repositorio público.

En cada fila se marca `[x] PASS` o `[x] FAIL`. Si no se puede probar: `NO PROBADO` y el motivo. Si no aplica: `NO APLICABLE` (por ejemplo, W-18 en iPhone).

## Prioridades

| Prioridad | Significado | Casos |
|---|---|---|
| P0 | Bloquea el reenvío a Apple o puede romper el XP de los usuarios | 28 + D-03 condicional |
| P1 | Antes del lanzamiento público | 15 |
| P2 | Conviene, no bloquea | 3 |

P0: O-01, O-02, O-03, O-04, O-05, O-06, O-07, O-08, O-09, O-10, O-11, O-12, O-13, O-14, O-16, O-17, O-19, A-11, D-01, D-02, D-04, W-01, W-02, W-03, W-04, W-08, W-09, W-15.

**D-03 (iOS mínimo 15.1)** es P0 solo si hay un iPhone antiguo disponible. Si no lo hay, se anota NO PROBADO con el motivo y **no bloquea** (criterio del Chat 1).

## Trazabilidad con la lista mínima del Chat 1

Todos estos casos bloquean el reenvío (salvo B3, condicional).

| Chat 1 | Caso en este CSV | Nota |
|---|---|---|
| A1 Arranque en frío | O-01 | iOS 27.0.1 o posterior |
| A2 Registro | O-02 | |
| A3 Login D + cuentas de revisión | O-03 (ampliado) | Ahora incluye las tres cuentas de revisión y la D |
| A4 Flujo típico (misión, hábito, campaña, agenda) | O-06 (con hábito) + O-07 | |
| A5 Salud e IA rechazadas y aceptadas; el coach responde | O-04 + O-05 + O-12 | O-12 sube a P0 |
| A6 Paywall: 5 planes y enlaces legales | O-09 | |
| A7 Compra sandbox → acceso en servidor | O-08 | |
| A8 Restaurar compras (misma cuenta) | O-10 | O-10 añade la reinstalación |
| A9 Denuncia, bloqueo y desbloqueo | O-13 | |
| A10 Borrado de la cuenta D con comprobación de servidor | O-16 | Comprobación de servidor por el Chat 3 o el coordinador |
| A11 Cuentas Pro y Élite de revisión sin comprar | **A-11** (nuevo) | |
| B1 iPhone pequeño | **D-01** (nuevo) | |
| B2 iPhone grande | **D-02** (nuevo) | |
| B3 iOS mínimo 15.1 | **D-03** (nuevo) | Condicional (ver arriba) |
| B4 iPad en modo compatibilidad | **D-04** (nuevo) | Apple puede revisar en iPad |
| B5 Modo avión al abrir y al comprar | O-17 (ampliado) | Se relaciona con W-09 (modo avión al registrar) |
| B6 Restaurar tras borrar y recrear la cuenta | O-11 | Obligatorio |
| B7 Notificaciones, cámara y fotos denegadas | O-19 | |

Fuera del mínimo del Chat 1 (su apartado C): Mac «Designed for iPhone», Android, tablet, plegable y web. Siguen en la matriz como NO PROBADO.

## Grabación única para Apple (iPhone físico)

Sigue el orden y las escenas del guion del Chat 1 (`docs/release-audit/apple-guion-video.md` en su checkout), que **sustituye** a `VIDEO-IPHONE.md` para este envío. Si el Chat 1 cambia el guion, manda el suyo. Apple pide (2.1, 29/09) un vídeo en un **dispositivo físico con el último iOS**, que **empiece abriendo la app** y que enseñe el flujo típico, el registro, el login, el borrado de cuenta, la denuncia y el bloqueo, y las suscripciones con título, duración y precio de cada plan y los enlaces a Términos y Privacidad. **El vídeo del 01/10 no basta.**

Se graba **en una sola toma** (unos 6–9 minutos) con la grabación de pantalla del iPhone.

**Ficha de la grabación** (rellenar y guardar junto al vídeo):

| Campo | Valor |
|---|---|
| Build | NIVL **1.0.7 ([BUILD])** de TestFlight. La confirma el coordinador; hoy la última VALID es la **20**. Es la misma que se asocia al envío y la misma de todas las pruebas P0 |
| OTA aplicada | `updateId` ______ (o «ninguna») |
| Modelo de iPhone | ______ |
| iOS | ______. Debe ser la última versión pública: el 02/10/2026 era la **27.0.1**. Comprobarlo el día de la grabación |
| Fecha y hora | ______ |
| Cuentas | D (desechable: se crea y se borra en cámara), U2 (para denunciar y bloquear), cuenta sandbox de Apple. **Nunca la cuenta personal** |

**Antes de grabar:** activar «No molestar». Usar cuentas de demostración sin proyectos, diarios, comidas, fotos ni nombres reales (el vídeo del 01/10 tenía datos personales). Iniciar sesión con la cuenta sandbox en Ajustes → App Store → Cuenta Sandbox. Preparar la relación entre U2 y D, como indica el guion del Chat 1. Ensayar el recorrido entero, incluida la compra (O-08), sin grabar. Por último, cerrar NIVL del todo.

| Escena (guion Chat 1) | Qué enseñar | Casos |
|---|---|---|
| 0 Identificación (opcional) | Ajustes → General → Información (modelo e iOS, sin número de serie ni IMEI) y la ficha de TestFlight con «1.0.7 ([BUILD])» | Ficha |
| 1 Lanzamiento | Pantalla de inicio → icono → carga → Acceso | O-01 / A1 |
| 2 Registro y login | «CREAR CUENTA» con D (contraseña oculta) → casilla de términos → «Crear cuenta Franky» → confirmación. Cerrar sesión y volver a entrar con D. Enseñar, sin usarlo, «¿Cuenta antigua de NIVL? Entrar con ella» | O-02 / A2, O-03 / A3 (parcial) |
| 3 Flujo típico | Edad y onboarding → crear misión o hábito → completarlo en Hoy (XP y racha) → Hábitos, campaña, evento de Agenda → módulo de salud: casilla desmarcada → «Ahora no» → todo sigue funcionando → Perfil → «Salud y bienestar» → «Revisar permiso de salud» → marcar → «Aceptar y activar salud» | O-06, O-07 / A4, O-04, O-05 / A5 |
| 4 Coach e IA | «NIVL Pro» → «Probar el coach 7 días» si corresponde → consentimiento de IA → «Acepto y activo el coach» → Coach: «Ayúdame a organizar mi día de mañana» → respuesta | O-05, O-12 / A5 |
| 5 Suscripciones | **Siempre desde Perfil → «NIVL Pro» (/pro)**, no desde el onboarding. Comprobación previa sin grabar: si aparece «Algún plan no está disponible…», es FAIL de A6 y NO se graba. Los **cinco planes** (Pro mensual y anual; Élite mensual, anual y fundador), unos 2 s cada uno → renovación automática y aviso de energía → abrir **Términos** y volver → abrir **Privacidad** y volver → compra sandbox → acceso activo en NIVL → «Restaurar compras» | O-09 / A6, O-08 / A7, O-10 / A8 (sin reinstalar) |
| 6 Denuncia y bloqueo | Amigos → U2 → tres puntos → motivo → «Enviar denuncia» → confirmación → «Bloquear usuario» → «Bloquear» → desaparece → «Convivencia y seguridad» → «Desbloquear» y «Contactar con soporte» | O-13 / A9 |
| 7 Datos y borrado | «Exportar mis datos» (cancelar la hoja de compartir) → «Envío de datos al coach» → enseñar «Retirar» → con D: «Eliminar cuenta» → «Eliminar para siempre» (hoja) → «Eliminar para siempre» (alerta) → Acceso → intentar entrar con D. El borrado de la cuenta Franky depende de la decisión del usuario (ver guion) | O-15, O-14 (parcial), O-16 / A10 |
| 8 Cierre | Pantalla de acceso → parar la grabación | — |

Si algo falla, **no montar el vídeo**: avisar al coordinador y repetir la toma completa en la build corregida. Entregar el original del Carrete (MOV/MP4) y anotar la marca de tiempo de cada escena.

**Fuera del vídeo**, en la lista general y con la misma `[BUILD]`:

- A-11 (cuentas Pro y Élite de revisión) y O-03 completo;
- O-10 con reinstalación y O-11 (restaurar tras recrear cuenta, obligatorio);
- D-01 a D-04 (tamaños, iOS mínimo, iPad);
- O-17, O-19 a O-22 y todos los W.

Android, dos dispositivos, el cambio de hora del 25/10 y las ausencias no se graban.

## Casos Winter Arc: por qué existen

Salen de la revisión del vídeo del 01/10 (`coordinacion-winter-arc/VIDEO-REVISION.md`) y del código de la base:

- **W-01 y W-02 (doble penalización).** En el vídeo hay dos «Misión de penalización» iguales con +204 XP. En `src/lib/engine.ts` el cierre del día (`applyDayCloseRpc`) y la creación de la misión de penalización son operaciones separadas. Según la revisión, la RPC no comprueba `last_day_processed` y no hay una clave única que impida dos misiones equivalentes. En `d3dccae`, con servidor simulado: el cierre concurrente en **el mismo dispositivo** está corregido y pasa (`qa-hipotesis.test.ts`). El de **dos dispositivos** sigue abierto (`test.failing`) hasta que llegue el SQL del servidor. No está demostrado que el vídeo se deba a esto. W-02 comprueba en el teléfono la corrección del mismo dispositivo. W-01 seguramente fallará mientras no se despliegue el SQL: si falla, es el defecto conocido y no uno nuevo.
- **W-03 a W-07 (misiones enlazadas).** El vídeo muestra +25 XP en la confirmación del gimnasio y +50 XP en la misión enlazada, y +15 frente a +10 en el diario. Puede ser correcto: récord más misión, o el resto hasta el mínimo del diario. Por eso se compara el **XP total del Perfil** antes y después, no las etiquetas.
- **W-08, W-09 y W-15:** doble toque, modo avión y recuperación. Comprueban que no se pierde ni se duplica XP.
- **W-10.** El domingo 25/10/2026 a las 03:00 los relojes de Europa/Madrid vuelven a las 02:00. Ese día dura 25 horas.
- **W-11 a W-14:** ausencias, medianoche y cambio de zona.
- **W-16 a W-18:** cobertura Android, que no había en el expediente de Apple.
- **W-19 y W-20 (medianoche, commit `d0682a6`).** `completeQuest` rechaza ahora completar una misión que no toca hoy: con Hoy cargada ayer, avisa de que «El día ha cambiado». Si es la de penalización de ayer, avisa de que caducó. En ninguno de los dos casos paga. En W-19 hay que usar una misión que **no** toque hoy: una diaria sí se completa con la fecha nueva, y es correcto. Los tests automáticos de `qa-hipotesis.test.ts` lo cubren con un servidor simulado; estos casos lo comprueban en el dispositivo. **Necesitan una build u OTA que contenga `d0682a6`**: la build 20 no lo contiene y en ella fallarían por diseño.

Para W-01 hacen falta dos teléfonos con la misma cuenta y días pendientes. Para W-11 o W-12, si no se quiere esperar 14 o 30 días, el coordinador puede preparar una cuenta desechable con el estado antiguo en el servidor. El Chat 5 no lo hace desde aquí.

## Huecos para los Chats 1–4

El Chat 1 ya ha aportado su lista mínima (fusionada arriba: A-11, D-01 a D-04 y la columna `origen`). El CSV reserva una fila por chat (`CH1-01` a `CH4-01`). Cada chat añade sus casos con el prefijo `CHn-` y numeración correlativa, la misma columna «dueño» y prioridad P0/P1/P2. Si un caso tiene que entrar en la grabación de Apple, se avisa al coordinador para incluirlo en la tabla de arriba.

| Chat | Qué se espera que añada |
|---|---|
| 1 · Tiendas | Capturas frente al binario final, ficha de privacidad frente a lo que hace la app, territorios |
| 2 · Compras | Casos de compras de sus correcciones (precio cambiado, pago pendiente, red caída durante la compra) |
| 3 · Seguridad | Borrado con archivos, consentimientos con versión nueva, recuperación de contraseña |
| 4 · Experiencia | Pantallas cambiadas en Winter Arc, web en móvil, accesibilidad |

## Dueños

«Usuario» ejecuta la prueba en el teléfono. El chat indicado recibe el FAIL y lo corrige: 2 compras, 3 seguridad y datos, 4 pantallas y notificaciones, 5 XP, cierre del día y misiones enlazadas. El coordinador integra, compila, decide qué se repite tras cada cambio y hace las comprobaciones de servidor (por ejemplo, Storage vacío tras O-16).

## Añadidos del 02/10/2026 (tarde)

- **W-21 / W-22 (P0):** la prueba Pro, la compra y la restauración con el consentimiento de salud **rechazado**. Por código, el trigger de `events` de la 0030 hacía fallar `start_trial` a quien rechazaba la salud. El Chat 2 lo confirmó por código y la 0035 lo corrige en SQL. Falta la prueba en el teléfono.
- **CAP-01 a CAP-05 (P0, pedidas por el Chat 1):** una captura de revisión por suscripción (`nivl_pro_mensual`, `nivl_pro_anual`, `nivl_elite_mensual`, `nivl_elite_anual`, `nivl_elite_fundador`), en el paywall real con StoreKit sandbox, a 1320×2868. Se hacen cuando el Chat 2 entregue el SHA del paywall final. Las de App Store Connect muestran hoy el paywall antiguo.
- Los casos W-01, W-02, W-19 y W-20 necesitan una build u OTA que contenga `486b1cb`. En la build 20 fallarían por diseño.

- **A6 y CAP-01 a CAP-05 (Chat 1, guion @8f5cbe4):** se graban y capturan siempre en Perfil → «NIVL Pro», con el paywall candidato del Chat 2 (@b11c2d2). Antes de grabar se hace una comprobación: si sale «Algún plan no está disponible…», es FAIL y no se graba.
