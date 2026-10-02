# Build y reenvío de la 1.0.7: PROPUESTA para el coordinador

Estado leído por GET el 02/10/2026 (`nivl/privado/asc-chat1-readonly-20261002.json` y `asc-chat1-buildinfo-20261002.mjs`):

| Dato | Valor |
|---|---|
| Versión 1.0.7 | REJECTED; build asociada **18**; lanzamiento AFTER_APPROVAL |
| Build 20 | VALID, subida el 29/09/2026, minOS 15.1, SDK 23C57 (iOS 26.2), arm64, `usesNonExemptEncryption=false`. Disponible en Mac a partir de macOS 12 («Designed for iPhone») |
| Build 18 | VALID, el mismo SDK. Es la rechazada y no lleva las correcciones del 29/09 |
| Envío `fb26cf6b-…` | UNRESOLVED_ISSUES. 7 elementos: grupo + 5 suscripciones READY_FOR_REVIEW + versión |
| Notas de App Review | 3.975/4.000 caracteres (versión anterior) |
| Territorios | 175 → 173 (CHN y RUS retirados por el coordinador el 02/10). Pendiente la propuesta de retirar 8 más (ver más abajo) |

Requisito de SDK: Apple exige compilar con el SDK de iOS 26 o posterior desde el 28/04/2026 ([Upcoming requirements](https://developer.apple.com/news/upcoming-requirements/), consultado el 02/10/2026). La 23C57 lo cumple. Cualquier build nueva que haga EAS tiene que conservar un Xcode 26.x o posterior.

## Qué build enviar

- **Si los cambios integrados de los chats 2, 3 y 4 son solo JS/OTA:** enviar la **20** y publicar antes la OTA en el canal de producción de ese binario. Riesgo: el revisor puede abrir la app sin conexión o antes de que se descargue la actualización, y ver el JS que venía en el binario. Con Expo Updates por defecto, la OTA se aplica en el **segundo** arranque. Por eso el vídeo y las pruebas físicas tienen que hacerse con la OTA ya aplicada, y conviene comprobar en «Información» o en los registros el `updateId` que se está ejecutando. **Recomendación: si la OTA cambia el paywall, el borrado o la denuncia, que es lo que Apple mira, compilar una build nueva en lugar de depender de la OTA.**
- **Si hay cualquier cambio nativo** (app.json, plugins, permisos, dependencias nativas, versión de runtime): build nueva **21 o superior**, con la misma 1.0.7. Antes de sustituir la build, debe estar VALID y en TestFlight interno.

## Pasos para reenviar (los hace el coordinador con el usuario; Chat 1 no los ejecuta)

1. Página de la versión 1.0.7 → sección Compilación → quitar la 18 y añadir `[BUILD]`. Verificarlo después con GET: `appStoreVersions/{id}/build`.
2. App Review Information: pegar [apple-notas-revisor.txt](apple-notas-revisor.txt) ya completado (menos de 4.000 caracteres) y comprobar que los campos de acceso tienen las credenciales de la cuenta Gratis.
3. Exportación y cifrado: la build declara `usesNonExemptEncryption=false`. Si la build nueva cambia algo de cifrado, revisarlo de nuevo.
4. Comprobar que las 5 suscripciones siguen en el envío y READY. Si se crea un envío nuevo, añadirlas otra vez (Guideline 3.1.1: «In-App Purchase products should be configured and submitted alongside the app»).
5. Revisar los cambios de App Privacy si el Chat 1 los propone después de cerrar el inventario con el Chat 3 ([apple-privacidad-datos.md](apple-privacidad-datos.md)).
6. Resolution Center → responder con [apple-respuesta-resolution-center.md](apple-respuesta-resolution-center.md) ya completado y el vídeo adjunto. La respuesta y el reenvío son dos acciones distintas: responder no reenvía.
7. «Volver a enviar a revisión de apps».
8. Después: GET de `reviewSubmissions` hasta WAITING_FOR_REVIEW. Guardar la evidencia en `privado/`.

## Condiciones previas (puertas de COORDINACION.md)

- [ ] Todas las Edge Functions redesplegadas desde `[SHA_INTEGRADO]` (incluidos el borrado del suscriptor de RevenueCat y la seudonimización de `store_events`); `franky-auth` y los secretos `FRANKY_*` retirados. Anotar SHA y versiones.
- [ ] El dueño confirma COACH_BASE_URL = DeepSeek, sin integraciones publicitarias en RevenueCat y sin EAS Insights → App Privacy y Data Safety sin tracking y sin Franky.

- [ ] Vídeo nuevo grabado con `[BUILD]` en iOS de última versión ([apple-guion-video.md](apple-guion-video.md)).
- [ ] Pruebas físicas mínimas en PASS sobre `[BUILD]` ([pruebas-fisicas-minimas.md](pruebas-fisicas-minimas.md)).
- [ ] Resuelto el borrado de la cuenta Franky, o asumido el riesgo por escrito por el usuario.
- [ ] Paywall con los 5 planes y enlaces legales confirmado por el Chat 2 en `[BUILD]`.
- [ ] Territorios decididos y `[N]` sustituido.
- [ ] Cuentas Pro y Élite con la concesión vigente ([cuentas-demo.md](cuentas-demo.md)).
- [ ] Capturas coherentes con la build final ([apple-ficha-capturas-productos.md](apple-ficha-capturas-productos.md)).

## Territorios: propuesta pendiente de decisión del usuario

La [lista oficial de regiones de la API de Anthropic](https://www.anthropic.com/supported-countries) (consultada el 02/10/2026) no incluye estos territorios, que siguen habilitados:

- **Propuesta firme:** Hong Kong (HKG), Macao (MAC), Bielorrusia (BLR), Venezuela (VEN), Myanmar (MMR), Afganistán (AFG), Yemen (YEM) y Kosovo (XKS). El coach de Élite usa Anthropic.
- **A decidir:** los territorios británicos de ultramar AIA, BMU, VGB, CYM, MSR y TCA no aparecen por separado en la lista. Es ambiguo: no está claro si quedan cubiertos por Reino Unido.

China ya está retirada. Además del proveedor, Apple retiró en 2023 apps de IA generativa sin licencia del MIIT de la tienda china ([TechNode, 02/08/2023](https://technode.com/2023/08/02/apple-widely-removing-generative-ai-apps-from-chinas-app-store/); fuente secundaria). DeepSeek, que usan Pro y la prueba, procesa los datos en la República Popular China: eso no depende del territorio de la tienda y ya lo explica el consentimiento de IA.

## Mac y Apple Vision Pro: casillas que hay que desmarcar (PROPUESTA aprobada por el coordinador el 02/10; la ejecuta el coordinador con el usuario)

La página de Precio y disponibilidad de ASC no se ha podido leer desde Chrome (el renderizador se colgaba). Por eso no sé el estado actual de las casillas. Por la API, la build 20 tiene `computedMinMacOsVersion` 12.0, es decir, puede instalarse en Mac. Los pasos salen de la ayuda oficial de Apple (consultada el 02/10/2026):

1. ASC → NIVL → **Precio y disponibilidad** → bajar a **«iPhone and iPad Apps on Apple Silicon Mac»** → en **«Apple Silicon Mac Availability»**, desmarcar **«Make this app available»** ([Apple: Macs with Apple silicon](https://developer.apple.com/help/app-store-connect/manage-your-apps-availability/manage-availability-of-iphone-and-ipad-apps-on-macs-with-apple-silicon/)).
2. En la misma página, en **«Apple Vision Pro Availability»**, desmarcar **«Make this app available on Apple Vision Pro»** ([Apple: Apple Vision Pro](https://developer.apple.com/help/app-store-connect/manage-your-apps-availability/manage-availability-of-iphone-and-ipad-apps-on-apple-vision-pro/)).
3. Guardar y hacer una captura de evidencia en `privado/`.

La interfaz de ASC está en español, así que los rótulos pueden estar traducidos («Disponibilidad en Mac con Apple silicon», «Hacer que esta app esté disponible»…).

El iPad **no** se desmarca: con `supportsTablet=false` la app corre en modo compatibilidad iPhone y Apple puede revisarla así (prueba B4).

## P0 de publicación en la UE: estado de comerciante (DSA)

Por GET del 02/10/2026, los 27 países de la UE, incluida España, aparecen como `TRADER_STATUS_NOT_PROVIDED`. Según Apple, desde el 17/02/2025 las apps sin estado de comerciante se retiran de la App Store en la UE hasta que se aporte y se verifique ([Apple Developer News](https://developer.apple.com/news/?id=einwn76m)). **Aunque Apple apruebe la versión, NIVL no se podría publicar en España.**

Lo hace el titular de la cuenta (Account Holder) en ASC → Información de la app / Business → Digital Services Act. Ojo: si se declara comerciante, que es lo esperable al vender suscripciones, Apple **muestra públicamente en la ficha de la UE** la dirección, el teléfono y el correo verificados. Con una cuenta de persona física, el usuario debe decidir qué datos de contacto usar (por ejemplo, una dirección y un teléfono profesionales) **antes** de enviarlo. Después, Chat 1 comprueba por GET que el estado ya no es `TRADER_STATUS_NOT_PROVIDED`.
