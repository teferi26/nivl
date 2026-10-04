# 1.0.8 (build 23) en App Store Connect: qué cambia frente a lo que hay hoy y qué falta

Estado por GET el 04/10/2026: la versión rechazada se renombró a **1.0.8**, con la **build 23** asociada, PREPARE_FOR_SUBMISSION y publicación MANUAL. Envío `fb26cf6b…` en UNRESOLVED_ISSUES: un solo mensaje de Apple (29/09) y ninguna respuesta. Las notas de App Review de ASC siguen siendo las antiguas (3.975 caracteres).

Textos listos en esta carpeta:
- `apple-108-respuesta.md`: Resolution Center, con las marcas de tiempo del vídeo.
- `apple-108-notas.txt`: notas de App Review. 3.312 caracteres sin credenciales, unos 3.370 con ellas.
- `ficha-108.md`: descripción, subtítulo, palabras clave, promo y novedades.

## A. Lo que cambia en la ficha (lo que hay hoy en ASC → lo que tiene que haber)

| Campo | Hoy (GET del 02/10) | 1.0.8 | Bloquea el envío |
|---|---|---|---|
| **Build** | 18 | 23 (ya asociada) | Hecho |
| **Capturas iPhone 6,9"** | 7, del diseño viejo de la 1.0.7 (arena con rojo y oro) | 7 nuevas de la 23 en blanco y negro (workflow de capturas o a mano en TestFlight). Apple exige que muestren la app real (2.3.3) | **Sí**: las actuales ya no son la app que se envía |
| **Capturas iPad 13"** | No hay | **Obligatorias**, porque la 1.0.8 tiene `supportsTablet: true`. Sin ellas ASC no deja enviar | **Sí** |
| **Capturas de revisión de las 5 suscripciones** | Paywall antiguo («−36 %», «4 meses gratis») | 5 nuevas desde la 23 (flujo `pro-planes.yaml` con una cuenta sin Pro, o a mano) | Muy recomendable: ahora contradicen la app |
| **Descripción** | Versión 1.0.7, con la frase de Franky y URLs de nivl-web.vercel.app | `ficha-108.md` (2.673 caracteres): sin Franky, con voz, fotos 18+, ligas y duelos, compartir, iPad y URLs de nivl.app | **Sí**: la frase de Franky ya es falsa |
| **Subtítulo** | «Coach IA, misiones y rachas» | «Misiones, rachas y coach IA» (opcional; también vale el actual) | No |
| **Palabras clave** | La lista de la 1.0.7 | `ficha-108.md` (93/100 bytes) | No |
| **Texto promocional** | El de la 1.0.7 | `ficha-108.md` (152/170) | No (se cambia sin versión) |
| **Novedades** | (vacío en la primera versión) | `ficha-108.md` | No |
| **URL de soporte y marketing** | nivl-web.vercel.app | https://nivl.app/soporte y https://nivl.app | No (ambas responden), pero conviene unificarlas |
| **URL de privacidad** (información de la app) | https://nivl-web.vercel.app/privacidad | https://nivl.app/privacidad | No |
| **Clasificación por edad** | 17+ (legacy) | Revisar el cuestionario: la 1.0.8 añade fotos corporales y voz. Respuestas: contenido generado por usuarios = sí (alias, retratos y ligas, con denuncia y bloqueo); mensajería = no; salud o bienestar = sí, sin consejo médico; sin web libre. Mantener 17+/18+ es coherente con el mínimo de 16 de la app (más estricto) | Revisar antes de enviar |
| **App Privacy** | Publicada el 28/09 (no se ha podido leer entera) | Aplicar `declaraciones-privacidad-finales.md` (rama `winter/chat1-tiendas`): tracking = No; Purchases con Analytics; Contacts (grafo social); Customer Support; Other Data (edad y consentimientos); Photos (incluye fotos de progreso); Health y Fitness. Novedad 1.0.8: **Audio Data = No** si el dictado nunca envía audio a NIVL ni a terceros (lo procesa el reconocimiento de voz de Apple). **Lo confirma Seguridad antes de aplicarlo** | **Sí**: debe cuadrar con la app que se envía |
| **Mac / Vision Pro** | Elegible en Mac (`computedMinMacOsVersion` 12.0) | Desmarcar los dos en Precio y disponibilidad | Recomendado |
| **Notas de App Review** | Las antiguas | `apple-108-notas.txt`, con las credenciales de Pro y Élite | **Sí** |
| **Credenciales de acceso** (cuenta Gratis) | Cargadas | Comprobar que entra en la 23 con «ENTRAR» y que no ha gastado la prueba | **Sí** |

## B. Qué falta del lado del usuario

1. **Vídeo a resolución completa.** `videoCompletoNivl.mp4` mide 384 × 848 (comprimido). Hay que subir el **original del Carrete** del iPhone (la misma toma, así las marcas valen) como adjunto de la respuesta o en un enlace que se abra sin iniciar sesión.
2. **Modelo de iPhone, versión de iOS y fecha** de la grabación (`[DEVICE]`, `[IOS]`, `[DATE]`). Apple pidió «the latest operating system»: el 04/10/2026 es **iOS 27.0.1**. Si el iPhone tenía otra versión, decirlo y valorar repetir.
3. **Credenciales de Pro y Élite** en las notas de ASC, sin pasar por git. Las cuentas tienen que tener la concesión vigente al menos 60 días.
4. **Estado de comerciante DSA en la UE.** Sin él, NIVL no se publica en España aunque Apple la apruebe. Si se declara comerciante, la dirección, el teléfono y el correo se muestran públicamente en la ficha de la UE.
5. **Secretos de GitHub para las capturas** (`NIVL_SHOTS_EMAIL`/`PASSWORD` y, para las de suscripciones, una cuenta sin Pro), o hacer las capturas a mano en TestFlight sobre la 23: 7 de iPhone 6,9", 7 de iPad 13" y 5 de suscripciones.
6. **Revisar y aceptar** en ASC: App Privacy, clasificación por edad, Mac y Vision Pro, y descripción.

## C. Riesgos que conviene conocer antes de enviar (no son defectos señalados por Apple)

- **Sin compra sandbox en el vídeo.** Apple pidió «accessing paid content or features… including subscription flows». El vídeo muestra los 5 planes con título, duración y precio (3:00) y el acceso de pago con la prueba de 7 días (4:36), pero no una compra. La respuesta lo dice tal cual y ofrece la cuenta Gratis para comprar. Si se quiere blindar, un segundo vídeo corto con la compra sandbox y «Restaurar compras».
- **Enlaces legales del paywall.** Existen al pie de la pantalla de planes (`ProOffer.tsx:610-635`, con la EULA de Apple), pero en el vídeo se abren desde Perfil. La respuesta lo explica. Si el clip de compra se graba, que se vea el pie del paywall con los enlaces.
- **iPad.** Con `supportsTablet: true`, Apple puede revisar en iPad. La app está fijada en vertical. Desde iPadOS 26 tiene que verse bien al redimensionar la ventana. Juego y QA lo tiene en su lista física (B4/D-04). Sin probar.
- **Invitaciones.** «Tus invitados» promete una insignia que hoy no se puede ganar (invitaciones sin cablear). Un revisor no lo notará, pero es una promesa visible: Juego y QA o Compras lo cablean o lo ocultan.
