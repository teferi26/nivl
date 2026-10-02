# Pruebas físicas mínimas antes de reenviar (Tiendas → Chat 5)

Es el **mínimo que exige el reenvío**, derivado del mensaje de Apple del 29/09/2026 y de la Guideline 2.1 («Apps are reviewed on physical devices… Test the app on each supported device platform»). No sustituye la matriz completa del Chat 5, que es el dueño de los resultados y del GO/NO-GO. Los casos sin evidencia real se quedan en **NO PROBADO**. Ninguno se da por PASS solo por el vídeo del 01/10.

Todas las pruebas se hacen con la **misma build `[BUILD]`** instalada desde TestFlight, y con la OTA final ya aplicada si la hay (anotar el `updateId`). En cada fila se anotan dispositivo, iOS, build, fecha, resultado y evidencia (marca de tiempo del vídeo o captura en `privado/`).

## A. Imprescindibles para Apple (el vídeo los muestra)

| # | Caso | Dispositivo | Origen | Resultado |
|---|---|---|---|---|
| A1 | Arranque en frío desde el icono hasta la pantalla de acceso, sin cierres | iPhone con iOS 27.0.1 o posterior | Mensaje: «begin with launching the app»; Guideline 2.1 | NO PROBADO |
| A2 | Registro de NIVL (Supabase Auth propio, sin Franky) y confirmación | Ídem | «Account registration» | NO PROBADO |
| A3 | Login de la cuenta D y de las 3 cuentas de revisión por la ruta de acceso final | Ídem | «login»; «credentials for each type» | NO PROBADO |
| A4 | Flujo típico: misión completada, hábito, campaña y evento de agenda | Ídem | «typical user flow» | NO PROBADO |
| A5 | Salud e IA rechazadas: las funciones generales siguen disponibles. Aceptadas: el coach responde | Ídem | Notas y respuesta, punto 3 | NO PROBADO |
| A6 | Paywall: los 5 planes con título, duración y precio de StoreKit, y enlaces a Términos y Privacidad que abren y vuelven | Ídem | «title, length, and price of each subscription… links» | NO PROBADO |
| A7 | Compra sandbox → acceso concedido en el servidor (comprobado en NIVL, no solo la hoja de Apple) | Ídem | «Accessing paid content» | NO PROBADO |
| A8 | «Restaurar compras» devuelve el acceso (misma cuenta) | Ídem | Respuesta, punto 7 | NO PROBADO |
| A9 | Denuncia de U2 registrada, bloqueo (desaparece), desbloqueo | Ídem | «reporting and blocking mechanisms» | NO PROBADO |
| A10 | Borrado de la cuenta D: vuelve a la pantalla de acceso, no reaparecen datos y el servidor confirma Auth, BD y Storage limpios (comprobación de servidor por el Chat 3) | Ídem | «account deletion» | NO PROBADO |
| A11 | Cuentas Pro y Élite de revisión: ven sus funciones sin comprar | Ídem | «multiple account types» | NO PROBADO |

## B. Necesarias para no fallar en revisión (Guideline 2.1, bugs)

| # | Caso | Dispositivo | Resultado |
|---|---|---|---|
| B1 | iPhone pequeño (pantalla de 4,7–6,1") con iOS 27: paywall, consentimientos y hoja de borrado sin texto cortado ni botones tapados | iPhone SE o mini | NO PROBADO |
| B2 | iPhone grande (6,7–6,9"): las mismas pantallas | Pro Max o Plus | NO PROBADO |
| B3 | iOS mínimo realista disponible (la build declara minOS 15.1): arranque y login. Solo bloquea si hay un dispositivo antiguo disponible; si no lo hay, se queda NO PROBADO con el motivo y no bloquea | El iPhone más antiguo disponible | NO PROBADO |
| B4 | **iPad en modo compatibilidad iPhone** (`supportsTablet=false`): Apple puede revisar en iPad. Arranque, login, paywall y compra sin bloqueos | Cualquier iPad | NO PROBADO |
| B5 | Modo avión al abrir la app y al comprar: error recuperable, sin pantalla bloqueada | iPhone | NO PROBADO |
| B6 | Restauración tras borrar la cuenta y crearla de nuevo con el mismo Apple ID sandbox (caso obligatorio de COORDINACION.md) | iPhone | NO PROBADO |
| B7 | Notificaciones, cámara y fotos denegadas: nada se bloquea | iPhone | NO PROBADO |

## C. Fuera del mínimo de Apple (matriz del Chat 5)

Modo «Designed for iPhone» en Mac, Android, tablet, plegable y web: ver [matriz-dispositivos.md](matriz-dispositivos.md). No bloquean el reenvío de iOS salvo que la ficha prometa ese soporte. Mac y Vision Pro se desmarcan en ASC (decisión del 02/10), así que no se prueban.

Relación con `docs/appstore-review-2026-09-29/QA-FISICA.csv`: los 22 casos de ese archivo siguen siendo válidos y están cubiertos o ampliados aquí. A1–A11 y B1–B7 son el subconjunto que bloquea el reenvío.
