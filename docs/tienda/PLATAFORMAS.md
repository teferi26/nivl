# Plataformas: qué va en cada tienda

Comprobado el 2026-11-08 contra la ayuda oficial. Lo que no se pudo comprobar lleva la marca **[sin verificar]**.

Situación de NIVL: un registro en App Store Connect (`ascAppId` 6801825007, bundle `com.teferi.nivl`) con la plataforma iOS. La app es Expo SDK 54 y corre en iPhone y en iPad (`supportsTablet: true` en `app.json`). Android va por Google Play con el flujo `.github/workflows/screenshots-android.yml`. La web pública vive en el repo privado `teferi26/nivl-web`.

## Resumen

| Plataforma | Hoy en NIVL | ¿Obligatorio hoy? | ¿Alta aparte? | Compilación y versión | Capturas | App Preview |
|---|---|---|---|---|---|---|
| iPhone | Publicada | **Sí**: al menos una captura de Dynamic Island medio (1206x2622 o 1179x2556) | No, es la plataforma iOS del registro | La de iOS | 1 a 10 por tamaño. Grande 1320x2868 recomendado, medio obligatorio | Opcional, 886x1920 |
| iPad | Publicada, va en el mismo binario | **Sí**, porque la app corre en iPad: al menos una de 13" (2064x2752) | No, misma plataforma iOS | La de iOS | 1 a 10 | Opcional, 1200x1600 |
| iPhone Duo | Corre como app de iPhone **[sin verificar el modo de compatibilidad]** | No hoy. Desde abril de 2027, para apps con SDK iOS 27.1 o posterior | No, misma plataforma iOS | La de iOS; hay que compilar con Xcode 27.1 para optimizarla | Exterior 1398x2034, interior 2007x2853. Dan la insignia «Made for iPhone Duo» | Opcional, 886x1920, sin tipo propio en el API antiguo |
| Apple Watch | No existe | No, solo si hay app de reloj | No: va dentro de la app de iPhone, en el registro iOS | Mismo proyecto de Xcode que la app de iPhone | Una sola clase de reloj, por ejemplo 416x496 | No admite |
| Mac (nativa) | No existe | No, solo si se añade la plataforma | Sí: se añade macOS al mismo registro | Propias, desde un target aparte | 2880x1800 u otro 16:10 | Opcional, 1920x1080, solo apaisado |
| Mac (app de iPad) | Disponible por defecto si no se ha desactivado **[comprobar en la ficha]** | No | No | La de iOS | La ayuda no pide capturas propias **[sin verificar]** | No aplica |
| Apple TV | No existe | No, solo si se añade la plataforma | Sí: se añade tvOS al mismo registro | Propias, desde un target aparte | 3840x2160 o 1920x1080 | Opcional, 1920x1080, solo apaisado |
| Vision Pro (nativa) | No existe | No, solo si se añade la plataforma | Sí: se añade visionOS al mismo registro | Propias, desde un target aparte | 3840x2160 | Opcional, 3840x2160, solo apaisado |
| Vision Pro (app de iPad) | Disponible por defecto si no se ha desactivado **[comprobar en la ficha]** | No | No | La de iOS | La ayuda no pide capturas propias **[sin verificar]** | No aplica |
| Android (móvil) | En Google Play | Sí en Play Console | Sí: Google Play es otra tienda, con otra cuenta y otra ficha | AAB propio | Al menos 2 entre tipos de dispositivo, hasta 8 por tipo. Lado largo no mayor que el doble del corto. Icono 512x512 y gráfico 1024x500 | Opcional, enlace de YouTube |
| Web | `nivl.app` | No hay tienda | No hay alta | Despliegue propio en Vercel | No aplica | No aplica |

Regla general de capturas: si la interfaz es igual entre tamaños, basta el mayor requerido y App Store Connect reduce el resto. Formato PNG o JPEG, sin canal alfa. App Preview: 15 a 30 segundos, hasta 3 por tamaño e idioma, 500 MB como máximo.

## Cómo se reparte en App Store Connect

- **Un solo registro.** iOS, macOS, tvOS y visionOS se añaden al mismo registro, con el mismo Apple ID, SKU y bundle ID. El rol necesario es Account Holder, Admin o App Manager.
- **El reloj no es una plataforma aparte.** La app de watchOS va dentro de la app de iPhone y se sube desde el mismo proyecto de Xcode. Una app solo de reloj no puede ser compra universal.
- **Compilación propia por plataforma.** macOS, tvOS y visionOS se suben desde un target de Xcode aparte, y pueden llevar número de versión y de build distintos a iOS.
- **Metadatos.** Al añadir una plataforma se copian los de la existente, salvo texto promocional, descripción y capturas. Esos tres hay que escribirlos otra vez.
- **Compra universal.** Se activa cuando App Review aprueba al menos dos plataformas. Después no se puede retirar una plataforma del registro. Antes solo se puede borrar una plataforma si nunca se subió una compilación para ella.
- **No se fusionan registros.** Si una plataforma ya estuviera en otro registro, habría que retirarla de la venta y añadirla a este; las valoraciones no se trasladan.
- **App de iPad en Mac y en Vision Pro.** Las apps de iPhone e iPad están disponibles por defecto en Mac con Apple silicon y en Vision Pro, salvo que se desmarque en Precio y disponibilidad. El ajuste vale para todas las versiones. Con compra universal y plataforma nativa desaparece esa opción, y la app nativa de Mac sustituye a la de iOS en el Mac App Store.

## Qué hay que decidir antes de ampliar

- **Mac, TV, Vision y reloj nativos no existen en este proyecto.** Añadirlos es desarrollo con compilaciones propias, no un trabajo de capturas. Que Expo SDK 54 pueda generar esos binarios está **[sin verificar]**. Las capturas de esas plataformas solo tienen sentido el día que exista la compilación. Por eso `asc.mjs` no planifica Mac ni Vision Pro (`SIN_BINARIO`): las PNG de Mac son la web y las de Vision Pro son la app de iPad, y subirlas enseñaría un producto que no es el que se instala (guideline 2.3).
- **Fecha que condiciona lo demás.** Desde abril de 2027, lo subido a App Store Connect debe estar compilado con el SDK de iOS y iPadOS 27 o posterior y apuntar a iOS 15 o superior. En esa misma fecha entra el requisito de capturas de Duo para las apps con SDK iOS 27.1 o posterior. Hay que comprobar qué SDK usa la compilación de GitHub Actions cuando se acerque.
- **Texto de Apple sobre Dynamic Island medio.** La misma página dice que hace falta al menos una captura de ese tamaño y, en la fila de ese tamaño, que si no se aportan se usan las de Face ID grande reducidas. El coordinador la leyó como reducción desde el tamaño grande. Por prudencia, `asc.mjs` avisa si no hay capturas de medio y conviene subirlas.

## Subida con `scripts/tienda/asc.mjs`

`node scripts/tienda/asc.mjs --commit <sha>` solo escribe el plan en `.tienda/salida/<sha7>/asc-plan.json`. Para subir hace falta `--aplicar --confirmo-subida`, las variables `ASC_KEY_ID`, `ASC_ISSUER_ID` y `ASC_KEY_PATH` (la clave `.p8` fuera del repo), y un informe con `final: true` y validación OK. Si la versión ya tiene material se para, salvo con `--reemplazar`.

Limitaciones que hay que conocer antes de la primera subida:

1. **El API usado está deprecado.** Desde la versión 4.5, Apple marca `appScreenshotSets`, `appScreenshots`, `appPreviewSets` y `appPreviews` como deprecados en favor de App Asset Library. No publica fecha de retirada ni confirma hasta cuándo funcionan. El script nunca se ha ejecutado contra Apple; su flujo solo está probado con un servidor simulado en `scripts/tienda/__tests__/asc.test.mjs`.
2. **Sin destino para iPhone Duo.** El enumerado `ScreenshotDisplayType` no tiene valor de Duo; solo App Asset Library tiene `IPHONE_DUO`. El plan lo deja en «sin destino» y se sube a mano o tras migrar.
3. **Tabla de resoluciones.** Apple no publica qué resolución corresponde a cada tipo del API antiguo. Las de iPhone e iPad salen de fastlane (`deliver/lib/deliver/app_screenshot.rb`). Las de TV y reloj se deducen del nombre del tipo **[sin verificar]**.
4. **Estados editables.** La lista de estados en los que se permite subir es criterio propio **[sin verificar]**. Apple solo nombra `PREPARE_FOR_SUBMISSION` como superficie editable.
5. **Orden en la ficha.** Se sube en orden `NN-escena` confiando en que se conserva el orden de creación **[sin verificar]**.

## Fuentes

- [Especificaciones de capturas](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/)
- [Especificaciones de App Preview](https://developer.apple.com/help/app-store-connect/reference/app-information/app-preview-specifications/)
- [Añadir una app nueva](https://developer.apple.com/help/app-store-connect/create-an-app-record/add-a-new-app/)
- [Añadir plataformas](https://developer.apple.com/help/app-store-connect/create-an-app-record/add-platforms/)
- [Información de versión por plataforma](https://developer.apple.com/help/app-store-connect/reference/app-information/platform-version-information/)
- [Apps de iPhone e iPad en Mac con Apple silicon](https://developer.apple.com/help/app-store-connect/manage-your-apps-availability/manage-availability-of-iphone-and-ipad-apps-on-macs-with-apple-silicon/)
- [Apps de iPhone e iPad en Vision Pro](https://developer.apple.com/help/app-store-connect/manage-your-apps-availability/manage-availability-of-iphone-and-ipad-apps-on-apple-vision-pro/)
- [Requisitos de envío (SDK mínimo)](https://developer.apple.com/app-store/submitting/)
- [iPhone Duo](https://developer.apple.com/iphone-duo/)
- [Subir recursos con el API](https://developer.apple.com/documentation/appstoreconnectapi/uploading-assets-to-app-store-connect)
- [Migrar a App Asset Library](https://developer.apple.com/documentation/appstoreconnectapi/migrating-to-the-app-asset-library)
- [ScreenshotDisplayType](https://developer.apple.com/documentation/appstoreconnectapi/screenshotdisplaytype)
- [PreviewType](https://developer.apple.com/documentation/appstoreconnectapi/previewtype)
- [Tokens del API](https://developer.apple.com/documentation/appstoreconnectapi/generating-tokens-for-api-requests)
- [Recursos gráficos en Google Play](https://support.google.com/googleplay/android-developer/answer/9866151)
