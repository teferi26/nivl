# Auditoría final de directrices · NIVL 1.0.8 (build 23)

**Autor:** NIVL - Juego y QA (Chat 5) · 04/10/2026
**Directrices leídas en directo** en developer.apple.com/app-store/review/guidelines («Last Updated: June 8, 2026»).
**Material revisado:**
- código en `winter2/integracion` (build 23 = `8922888`; HEAD auditado `477c545`);
- el vídeo `videoCompletoNivl.mp4` (8:20);
- las cuentas demo, leídas en el servidor por el coordinador.

**Lo que NO se ha podido probar aquí** (y no se da por bueno):
- login de las cuentas demo en la build 23;
- compra sandbox (PAY-02/12);
- iPad (IPD-01/02);
- toda la lista física `docs/qa-audit/PRUEBA-108-BUILD23.md`.

Un `expo export` no equivale a una IPA probada.

## Dictamen provisional: **NO-GO**

Bloquean el envío:
1. **P0 · Tienda cerrada en el vídeo (2.1 / 3.1.1).** Pro muestra «Las compras no están disponibles en esta versión» (`ProOffer.tsx:441`) y no enseña los enlaces legales.
   - Causa (Compras): la OTA `01a1072d` se publicó sin `--environment production` y salió sin `EXPO_PUBLIC_RC_IOS_KEY`.
   - Arreglo: republicar la OTA con el entorno, pintar los enlaces legales también con la tienda cerrada (Compras) y volver a grabar el vídeo con la tienda abierta.
2. **1.2 · Ligas sin moderación.** El nombre de la liga no pasa filtro y no se puede denunciar. En el tablero no hay denunciar ni bloquear para quien no es amigo.
   - Propuesta pendiente de aprobación: ocultar las ligas en 1.0.8 por OTA y sacarlas en 1.0.9 con moderación.
3. **Sin resultados físicos** de la build 23 (lista P0, compras sandbox, iPad).

Pasa a **GO** si se cumplen las tres cosas:
- (1) y (2) arreglados y verificados en la build 23 con la OTA final;
- todos los P0 físicos ✅, junto con PAY-02, PAY-12 e IPD-01/02;
- los informes de los demás chats sin INCUMPLE abiertos.

El dictamen definitivo se emite por escrito cuando el coordinador reenvíe esos informes.

## Regresión automática

| Commit | Typecheck | Jest | Lint | SQL PGlite | Export |
|---|---|---|---|---|---|
| `8922888` (build 23) | PASS | 91/91 suites · 1530/1530 | 0 avisos | 57/57 | iOS · Android · web OK |
| `477c545` (HEAD) | PASS | 92/92 suites · 1536/1536 | 0 avisos | 57/57 | (en curso) |

`477c545` es posterior a la build 23. Arregla un cierre del onboarding cuando `health_data` es NULL, así que **necesita OTA antes de la revisión**: sin ella, el revisor puede dar con ese cierre (2.1).

## Tabla de directrices

| Regla | Estado | Prueba | Arreglo |
|---|---|---|---|
| **1.2** Ligas: nombre y tablero | **INCUMPLE** | El nombre de la liga es UGC visible para terceros y no pasa filtro ni se puede denunciar. El tablero muestra a quien no es amigo sin «…». | Ocultar las ligas en 1.0.8 (OTA, Experiencia). En 1.0.9: filtro de nombre, denunciar la liga, y denunciar y bloquear desde el tablero. |
| **1.2** Duelos | RIESGO | La fila de un duelo no tiene «…». Un ex amigo sigue visible en un duelo vivo. | Poner «…» (denunciar y bloquear) en la fila del duelo, y ocultar los duelos cuyo rival ya no es amigo. |
| **1.2** Invitaciones de liga | RIESGO | La fila de una invitación no tiene «…». | Poner «…» en la fila, o desaparece al ocultar las ligas. |
| **1.2** Amigos, perfil y compartir | CUMPLE | Denunciar, bloquear y desbloquear están en «Convivencia y seguridad». En el vídeo se ven denunciar y bloquear. | — (el caso 11 de la prueba física lo confirma en la build 23). |
| **1.2** Denuncias que sobreviven al borrado | RIESGO → CUMPLE con la 0062 | Antes, borrar la cuenta del denunciante borraba la denuncia en cascada. | `0062_denuncias_sobreviven.sql` (Seguridad, e914ef7): el denunciante pasa a NULL al borrarse. Falta aplicarla en producción (coordinador). |
| **1.2** Respuesta en 24 h | RIESGO | Hay un resumen de moderación cada hora por push; responde el dueño. | El usuario debe nombrar a un moderador suplente y escribir el SLA de 24 h en las notas de revisión. |
| **2.1** Tienda abierta | **INCUMPLE** (P0) | Vídeo: «Las compras no están disponibles…» y Pro sin enlaces legales. | Republicar la OTA con `--environment production`, mostrar los enlaces legales siempre y volver a grabar el vídeo. Lo verifica PAY-01 en la build 23. |
| **2.1** Funciones que no llegan | RIESGO | `settleMyInvites` no se llama nunca (`useAmigos.ts:187` solo llama a `fetchMyInvites`), así que la insignia Reclutador es imposible de conseguir. | **Arreglado en `7fddd80`** (Experiencia, revisado PASS): `settleMyInvites()` antes de `fetchMyInvites()`. Pendiente: OTA y GL-02. |
| **2.1** Texto de «próximamente» | RIESGO | Vídeo: «Los extractos del banco llegan pronto». | Quitar el texto o la entrada mientras no exista (Experiencia). |
| **2.1** Error al arrancar | RIESGO | Vídeo 0:02: el login enseña un error nada más abrir. | Reproducirlo en la build 23 y no pintar errores antes de que el usuario actúe (Experiencia). |
| **2.1** Coach sin indicador | RIESGO | Vídeo: unos 20 s sin indicador de carga. | Mostrar «pensando» o huecos mientras responde (Experiencia). |
| **2.1** Pie de diagnóstico | RIESGO | «VERSIÓN 1.0.8 (-) · CANAL · PAQUETE · BUSCAR ACTUALIZACIÓN» en login, registro y Perfil (`Version.tsx` en `PerfilAjustes.tsx:285` y `LoginVista.tsx:322`). | Ocultarlo en producción o dejar solo la versión (Experiencia). |
| **2.1** Cuentas demo | RIESGO (sin probar) | Leídas en el servidor: la Gratis no ha usado la prueba (`onboarding_done=false`); la Élite está activa hasta el 15/01/2027 con un ludus de 5. | Entrar con las dos en la build 23 antes de enviar (usuario) y ponerlas en las notas de App Store Connect (Tiendas). |
| **2.1** Cierre del onboarding | RIESGO | `health_data` NULL hace que el onboarding se cierre. Está arreglado en `477c545`, que es posterior a la build 23. | Publicar la OTA de `477c545` antes de la revisión. |
| **2.2** Beta o demo | CUMPLE | No hay textos de beta, demo ni prueba en la interfaz; todas las funciones son completas. | — |
| **2.3.1(a)** Funciones ocultas | RIESGO | Hay un panel oculto para creadores en `src/app/creador.tsx`. | **Documentado** en las notas (Tiendas, `562e92c`): panel de solo lectura para cuentas de creador dadas de alta a mano, sin compras ni importes. |
| **2.5.2** Código descargado | RIESGO | Ya se han publicado funciones nuevas por OTA. | **Documentado**: `politica-ota.md` (Tiendas, `562e92c`). Por OTA solo arreglos, textos y ajustes; funciones, compras, permisos y datos van en binario. Excepción avisada: republicar la OTA con `--environment production`. Ocultar las ligas es retirar, no añadir; reabrirlas, en 1.0.9. |
| **3.1.1 / 3.1.2** Prueba fuera de IAP | RIESGO | La prueba de 7 días la da el servidor, con «sin tarjeta» (`pro.tsx:346`). No es una oferta de introducción de StoreKit. | **Documentado** en las notas (Tiendas, `562e92c`): prueba única que da el servidor, sin pago, sin renovación y sin pasar a un plan de pago. Falta que Compras revise el texto «sin tarjeta». |
| **3.1.2** Datos de la suscripción | RIESGO (sin probar) | Con la tienda cerrada no se ven el periodo, la renovación ni los enlaces legales. | Igual que el P0; PAY-01 lo verifica. App Store Connect (Tiendas, GET del 04/10): los 5 productos en READY_TO_SUBMIT, con duraciones correctas y sin ofertas. **Pero las capturas de revisión de los productos son las del paywall viejo y dicen «App Store o Google Play»: hay que rehacerlas** con `e2e/maestro/pro-planes.yaml` (iap-review_nivl_*), con la tienda abierta en la build 23. |
| **3.2.2** Gamificación | CUMPLE | No hay cajas de botín ni azar pagado. El canje de PB es simbólico. El premio por invitar es cosmético (Reclutador, 0 XP). No se premia valorar la app. El XP no se compra. | — |
| **4.2** Funcionalidad mínima | CUMPLE | La app es nativa y completa: misiones, cierre, coach, cuerpo, amigos y fotos. | iPad (IPD-01/02) sin probar: si sale roto, pasa a RIESGO. |
| **5.1.1** Borrado de cuenta | CUMPLE (visto en el vídeo) | Se borra desde Perfil, confirmando dos veces. | El caso 12 de la prueba física lo confirma en la build 23. |

## El vídeo de la revisión (8:20)

**Qué se ve:**
- icono, registro, login, flujo principal, denunciar y bloquear, y borrado de cuenta;
- la tienda **cerrada**, que es el P0 de arriba.

**Privacidad:** salen el correo personal, el nombre real, el NIF, la dirección, la bandeja de Gmail y cifras de objetivos. Hay que **volver a grabarlo** con una cuenta de prueba, aunque solo sea por esto.

**Al regrabar**, con la build 23 y la OTA final:
1. La tienda abierta: los 5 planes, restaurar compras y los enlaces legales.
2. La compra sandbox.
3. Denunciar y bloquear.
4. El borrado de cuenta.
5. El coach con su indicador de carga.

Que no salgan el pie de diagnóstico ni ningún «llega pronto».

## Casos físicos nuevos (añadidos a la prueba de la build 23)

| # | Qué hacer | Qué debe pasar |
|---|---|---|
| GL-01 | Abre la app recién instalada, sin tocar nada. | El login no enseña ningún error. |
| GL-02 | Invita a alguien con tu enlace, que se registre y que complete su primer día. Abre Amigos. | La invitación cuenta y aparece la insignia Reclutador 1 (cuando se arregle `settleMyInvites`). |
| GL-03 | Mira Amigos y Competición tras la OTA. | No hay ligas, o cada liga, tablero e invitación tiene «…» con denunciar y bloquear. |
| GL-04 | Abre un duelo con un rival que ya no es tu amigo. | No se ve, o tiene «…». |
| GL-05 | Entra con la cuenta demo Gratis y con la Élite. | Las dos entran. La Gratis va al onboarding; la Élite ve el coach y su ludus. |
| GL-06 | Haz el onboarding con la salud rechazada. | No se cierra (arreglo de `477c545` por OTA). |
