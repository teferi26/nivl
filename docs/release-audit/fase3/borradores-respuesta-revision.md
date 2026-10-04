# Borradores de respuesta si App Review contesta (1.0.8, build 24)

Enviado el 04/10/2026 a las 20:47 UTC (WAITING_FOR_REVIEW, publicación MANUAL). **Ninguno se envía sin leer antes el mensaje literal de Apple** y adaptarlo: estos borradores son para los casos previsibles. Lo envía el coordinador con el usuario.

## Caso A: rechazo o duda sobre las capturas de revisión de las suscripciones (2.1(b) / 2.3.10)

Las capturas de revisión de los 5 productos que hay en ASC son las del paywall antiguo y mencionan Google Play. Las nuevas están en `coordinacion-winter-arc/capturas-1.0.8/iap/` (1320 × 2868). No se pudieron sustituir porque el envío estaba abierto.

Acción: subir las 5 nuevas en cuanto ASC lo permita y responder:

> Hello App Review Team,
>
> Thank you for your feedback. We have replaced the App Store review screenshot of each of the five subscriptions (nivl_pro_mensual, nivl_pro_anual, nivl_elite_mensual, nivl_elite_anual and nivl_elite_fundador) with a current screenshot of the subscription screen in NIVL 1.0.8 (build 24). Each one shows the plan's title, duration and price, the renewal terms, "Restaurar compras" and the links to the Terms of Use, the Privacy Policy and Apple's standard EULA. The previous screenshots came from an earlier design and mentioned another store by mistake; the app itself shows only App Store wording on iOS.
>
> Thank you for reviewing NIVL.

## Caso B: no pueden comprar o ven «Las compras no están disponibles»

Comprobar antes de responder (GET y prueba en un iPhone con la 24): que la OTA vigente es la de producción (cb9ae001) y que la tienda está abierta. **No publicar OTA nuevas sin acordarlo:** la política de OTA lo prohíbe durante la revisión salvo para arreglar un fallo que la impida, y en ese caso se avisa a Apple.

> Hello App Review Team,
>
> Thank you for your message. [Causa real comprobada, en una frase.] We have [arreglo concreto] and verified on a physical iPhone with NIVL 1.0.8 (build 24) that the subscription screen shows the five plans with their App Store prices and that a sandbox purchase and "Restaurar compras" work with the Free review account. [Si hubo OTA: «The fix was delivered as an update of the app's JavaScript for build 24; no native code changed.»]

## Caso C: problemas con la cuenta demo (2.1(a))

Comprobar que la cuenta Gratis entra por «ENTRAR» con las credenciales de los campos de ASC y que la Élite de las notas tiene la concesión vigente (hasta el 15/01/2027). Si hace falta, crear una cuenta nueva y actualizar los campos.

> Hello App Review Team,
>
> Thank you for letting us know. The review credentials have been updated in the App Review Information section: [qué cuenta, sin escribir la contraseña en el mensaje]. On the access screen, stay on the "ENTRAR" tab, enter the email and password and tap "ENTRAR".

## Caso D: piden más información (2.1) sobre algo concreto

Responder solo a lo que pregunten, con hechos comprobados en el código o en la build y marcas de tiempo del vídeo si aplica. No prometer aprobaciones ni cambios que no estén hechos.

## Siempre

- Leer el mensaje entero, con fecha, guideline y adjuntos. Guardarlo literal en `docs/release-audit/fase3/` como hicimos con el del 29/09.
- No culpar a Apple ni discutir. Si hay desacuerdo razonable, explicarlo con hechos y, como último recurso, valorar la apelación con el usuario.
- Nada de OTA mientras la versión esté en revisión, salvo lo acordado en el caso B.
