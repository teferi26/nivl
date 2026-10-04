# Prueba final en dispositivo · NIVL 1.0.8 (build 23)

**Binario:** build **23** (1.0.8) de TestFlight, compilada desde `winter2/integracion @ 8922888` (GitHub Actions run 37203286033). Lleva todo lo nativo:
- bloqueo de capturas (`expo-screen-capture`);
- textos de permisos de micrófono, cámara y galería;
- sin alarmas exactas;
- soporte de iPad (`supportsTablet`).

**Sustituye** a las listas sobre la build 22 + OTA. Lo que falle aquí se arregla por OTA sobre la 23; solo si el arreglo es nativo hará falta la build 24.

**Reglas:**
- Usa **cuentas de prueba**, nunca la personal ni las de revisión de Apple.
- Lo que haya que borrar se borra solo en una cuenta **desechable** creada para la prueba.
- Las compras, siempre con una cuenta **sandbox** de Apple. Nunca un cargo real.
- Antes de empezar, anota el modelo, la versión de iOS (o de Android), la fecha y que TestFlight muestra **1.0.8 (23)**.
- Marca cada paso con ✅ (va bien), ❌ (falla: apunta qué ves) o ⏭ (no se pudo probar).

**Dictamen:** GO solo si **todos los P0** salen ✅ (o ⏭ con un motivo aceptado), y además PAY-02 y PAY-12 ✅ y el iPad (IPD-01/02) ✅.

## 1 · Críticos (P0) · iPhone

| # | Qué hacer | Qué debe pasar | ✅ ❌ ⏭ |
|---|---|---|---|
| 1 | Instala la build 23 desde TestFlight y ábrela desde el icono. | Llega a Acceso o a Hoy sin quedarse en blanco ni cerrarse. | |
| 2 | Con una cuenta desechable nueva: registro → abre el enlace del correo en el **mismo** iPhone → «CONFIRMAR CUENTA». Cierra sesión y vuelve a entrar. | Entra sola tras confirmar; el login funciona. | |
| 3 | En Hoy, completa una misión con un toque y otra con **doble toque** rápido. | Cada una suma su XP **una vez**; el aviso dice lo mismo que sube el XP en Perfil. | |
| 4 | Si sale una celebración (nivel, rango, logro), ciérrala. Repite pasando la app a segundo plano justo al aparecer. | Nunca queda una pantalla congelada; si iOS no llega a mostrarla, se cierra sola en ~1 s. | |
| 5 | Coach: dicta con el micrófono **con el teclado abierto** y envía. Pide que hable y cambia de pestaña mientras habla. | La primera vez pide el permiso de **micrófono** con un texto claro. El dictado funciona, la voz se para al salir del Coach y el teclado no tapa el botón. | |
| 6 | Perfil → privacidad / datos: abre la hoja de privacidad y ciérrala sin tocar nada. Después rechaza la salud y prueba «Probar el coach 7 días». | La hoja no cambia nada si no tocas. Con la salud rechazada, la prueba de 7 días **se inicia** igual. | |
| 7 | Fotos de progreso **sin** haber confirmado 18+. Después confirma 18+ y la salud, y haz una foto con la **cámara** y otra desde la **galería**. | Sin 18+ no deja hacer, subir ni ver fotos. Con 18+, pide el permiso de **cámara** o **fotos** con texto claro, y cada foto queda en su pose. (FOT-01/02/03) | |
| 8 | **Bloqueo de capturas:** con la pantalla de fotos abierta, haz una captura de pantalla y una grabación de pantalla. Sal de Fotos y haz una captura en Hoy. | En Fotos, la grabación sale en negro o sin la foto, y la captura sale bloqueada o en negro. Anota exactamente qué ves, porque iOS puede limitar las capturas. **Fuera de Fotos**, la captura funciona normal. | |
| 9 | Fotos en **modo avión**: haz una foto y vuelve a conectar. Cierra sesión y entra con otra cuenta. | Sin red, aviso claro sin perder ni duplicar la foto. La otra cuenta no ve ninguna foto de la primera. (FOT-04) | |
| 10 | Comparte el antes/después y un logro. Mira la hoja antes de compartir. | Todo lo opcional apagado al abrir (alias, foto, peso); la imagen no sale en negro; la corona corresponde a tu rango. (CMP-03, FOT-06) | |
| 11 | Amigos → «…» de un amigo → denunciar, y después bloquear. Desbloquea desde «Convivencia y seguridad». | Denunciar y bloquear funcionan; el bloqueado desaparece y vuelve al desbloquear. | |
| 12 | Con la cuenta desechable: «Eliminar cuenta» → confirmar dos veces → intenta entrar con ella. | La cuenta ya no entra. **Solo con la desechable.** | |

## 2 · Compras (sandbox) · obligatorias para el reenvío

| # | Qué hacer | Qué debe pasar | ✅ ❌ ⏭ |
|---|---|---|---|
| PAY-01 | Perfil → «NIVL Pro» con una cuenta **sin** Pro. | Los 5 planes, con título, periodo y precio. No aparece «Algún plan no está disponible». Restaurar y los enlaces legales se ven. | |
| PAY-02 | Compra **Pro anual** en sandbox con una cuenta desechable. | «Activa» en ≤12 s (o «pendiente» y se activa al volver). | |
| PAY-12 | Con esa suscripción viva: borra la cuenta → crea otra → «Restaurar compras». | Acceso en la cuenta nueva; la vieja ya no existe; no se cobra dos veces. | |

## 3 · Avisos (pueden tardar días: anota la fecha)

| # | Qué hacer | Qué debe pasar | ✅ ❌ ⏭ |
|---|---|---|---|
| AV-01 | Un día con racha en riesgo y un duelo aceptado; deja el móvil hasta la noche. | Como mucho 2 avisos del sistema en el día, con al menos 3 h entre ellos y dentro de tu horario. | |
| AV-02 | Con misiones que romperían la racha, espera a ~90 min antes de dormir. | Llega el aviso de racha y **no** el de «El cierre del día se acerca». | |
| AV-06 | No abras la app durante 7 días (si puedes). | El despertador deja de sonar desde el día 7; ese día solo llega «La arena sigue aquí». | |
| FOT-08 | El domingo, con alguna foto previa y la semana incompleta. | «Fotos de la semana» a las 11:00, que lleva a Fotos. | |

## 4 · iPad (si tienes uno; si no, simulador iPad 13" con la build 23)

| # | Qué hacer | Qué debe pasar | ✅ ❌ ⏭ |
|---|---|---|---|
| IPD-01 | Abre NIVL en ventana redimensionable y en **Split View**. Haz login, abre Pro, comparte y borra una cuenta desechable. | Nada cortado ni roto en ningún tamaño; los flujos funcionan. **Si se ve roto, Apple puede rechazar por la 4.2.** | |
| IPD-02 | Gira el iPad en Hoy, Coach y Pro. | La app se adapta o se mantiene vertical sin cortes ni pantallas en blanco. | |

## 5 · Android (si tienes uno, con la misma versión)

| # | Qué hacer | Qué debe pasar | ✅ ❌ ⏭ |
|---|---|---|---|
| A1 | Pasos 1, 3, 7 y 10 en Android. | Igual que en iPhone. En Fotos, la captura sale **negra** (FLAG_SECURE); compartir no sale en negro (CMP-05). | |

## Lo que ya está comprobado en automático (sin valor físico)

Regresión de `8922888` (NIVL - Juego y QA, worktree aparte sin cambios, 04/10/2026): typecheck PASS · Jest 91/91 suites, 1530/1530 tests · lint con 0 avisos · arnés SQL PGlite (0048, 0051, 0052 y 0055) 57/57 · `expo export` iOS, Android y web OK · app.json 1.0.8, `supportsTablet: true`, `orientation: portrait`.

Al terminar, pasa la tabla (con ✅, ❌ o ⏭ y lo que veas en cada ❌) a «NIVL - Juego y QA»: actualiza la matriz y emite el GO/NO-GO de la 1.0.8.
