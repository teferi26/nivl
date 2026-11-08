# Gafas Meta y NIVL

Estado de lo que se puede hacer con las gafas de Meta desde NIVL. Fecha de consulta de todas las fuentes: **8/11/2026**. Las páginas de Meta cambian a menudo y muchas no llevan fecha: hay que volver a comprobarlas antes de decidir nada.

**Cómo leer las etiquetas**

| Etiqueta | Significado |
|---|---|
| **Documentado** | Lo dice expresamente la fuente enlazada. |
| **Inferido** | Deducción nuestra a partir de las fuentes. Puede ser falsa y no está probada. |
| **Desconocido** | Ninguna fuente consultada lo aclara. |
| **[no oficial]** | La fuente no es de Meta (prensa, paquete comunitario, usuario en un foro). Se suma a cualquiera de las anteriores. |

Si una fuente oficial es un foro y no documentación, se indica. Los nombres de capacidad y las versiones van como los escribe Meta.

## 1. Resumen

**Veredicto:** el SDK de Meta, Wearables Device Access Toolkit (DAT) 1.0.1, no puede llegar hoy a usuarios de iOS por la App Store. Sí se puede desarrollar y probar sin gafas en una build interna: Meta lo documenta para apps nativas, y en NIVL lo hemos comprobado solo en el Simulador (apartado final). Por eso el módulo `modules/nivl-meta` queda fuera del binario de producción: va inactivo por defecto, sin autolinking de Expo, y ninguna pantalla de `src/` lo importa.

| Pregunta | Respuesta hoy | Etiqueta y fuente |
|---|---|---|
| ¿Publicar en App Store una app con el DAT? | **No.** Meta dice que no está soportado y que ExternalAccessory provocará el rechazo. | **Documentado**: [guía de integración iOS v1.0](https://wearables.developer.meta.com/llms.txt?product=all&version=1.0&document=products/dat/sections/guides/build-integration-ios) |
| ¿Hay fecha para que se abra? | **No** hay calendario público. | **Documentado** en foro oficial: [discusión 339](https://github.com/meta/meta-wearables-dat-ios/discussions/339) |
| ¿Probar sin gafas? | **Sí**, con Mock Device Kit en el Simulador de iOS, para apps nativas. Con límites (apartado 6). En NIVL es prueba propia, no documentación de Meta (apartado final). | **Documentado**: [AGENTS.md del repo iOS](https://raw.githubusercontent.com/meta/meta-wearables-dat-ios/main/AGENTS.md) |
| ¿Mostrar algo en la pantalla de las gafas? | **Sí, pero solo en Meta Ray-Ban Display**, y con sesión que inicia el usuario. | **Documentado**: [Display overview](https://wearables.developer.meta.com/llms.txt?product=all&version=1.0&document=products/dat/sections/guides/display-overview) |
| ¿Comprar Meta Ray-Ban Display en España? | **No** figura entre los países soportados. | **Documentado**: [ayuda de Meta, países](https://www.meta.com/help/ai-glasses/4961066940605960/) |
| ¿"Hey Meta, marca mi misión"? | **Por el DAT, no**: una invocación solo abre la app, y es experimental. Meta AI Connectors podría acercarse, pero está en preview y sin probar. | **Documentado**: [voice invocations](https://wearables.developer.meta.com/llms.txt?product=all&version=1.0&document=products/dat/sections/guides/voice-invocations) y [changelog iOS](https://raw.githubusercontent.com/meta/meta-wearables-dat-ios/main/CHANGELOG.md) |
| ¿Completar una misión con la voz? | **En una build de prueba, sí**, abriendo NIVL y escuchando por el micrófono Bluetooth, con confirmación. Sin probar. | **Inferido**: [micrófonos y altavoces](https://wearables.developer.meta.com/llms.txt?product=all&version=1.0&document=products/dat/sections/guides/microphones-and-speakers) |
| ¿Hay SDK oficial para React Native o Expo? | **No** consta ninguno. | **Inferido** por ausencia: [Setup](https://wearables.developer.meta.com/docs/getting-started-toolkit) |
| ¿Que un aviso de NIVL aparezca solo en las gafas? | No hay canal documentado para terceros. Si un push del iPhone se reflejará, no se sabe. | **Desconocido**: [blog de Meta, 23/09/2026](https://www.meta.com/blog/meta-ray-ban-display-more-useful-more-people/) |

## 2. Modelos

Todos requieren, con el SDK 1.0.1, Meta AI V292 y firmware V128. **Documentado**: [tabla de dependencias](https://wearables.developer.meta.com/docs/develop/dat/version-dependencies/). Las capacidades varían por dispositivo. **Documentado**: [FAQ](https://developers.meta.com/wearables/faq/).

| | Ray-Ban Meta (Gen 1, Gen 2, Optics) | Oakley Meta (HSTN, Vanguard) | Meta Ray-Ban Display |
|---|---|---|---|
| En la lista del DAT | **Documentado**: [Setup v1.0](https://wearables.developer.meta.com/llms.txt?product=all&version=1.0&document=products/dat/sections/guides/getting-started-toolkit) | **Documentado**: [Setup v1.0](https://wearables.developer.meta.com/llms.txt?product=all&version=1.0&document=products/dat/sections/guides/getting-started-toolkit) | **Documentado**: [Setup v1.0](https://wearables.developer.meta.com/llms.txt?product=all&version=1.0&document=products/dat/sections/guides/getting-started-toolkit) |
| Cámara y audio por DAT | **Inferido**: están en la lista, pero no se ha revisado una matriz por modelo | **Inferido**: igual | **Inferido**: igual |
| Pantalla | No tiene. **Inferido**: la API de pantalla solo se documenta para Display | No tiene. **Inferido**: igual | Sí, 600x600. **Documentado**: [Display overview](https://wearables.developer.meta.com/llms.txt?product=all&version=1.0&document=products/dat/sections/guides/display-overview) |
| Web Apps | No. **Documentado**: [Web Apps](https://wearables.developer.meta.com/docs/develop/webapps/) | No. **Documentado**: [Web Apps](https://wearables.developer.meta.com/docs/develop/webapps/) | Sí. **Documentado**: [Web Apps](https://wearables.developer.meta.com/docs/develop/webapps/) |
| Neural Band | No se documenta | No se documenta | Sí, pero Display no está soportada en España (fila siguiente). **Documentado**: [ayuda de Display](https://www.meta.com/help/ai-glasses/1541544971106476/) |
| Soportadas en España | Sí. **Documentado**: [ayuda de países](https://www.meta.com/help/ai-glasses/4961066940605960/) | Sí. **Documentado**: [ayuda de países](https://www.meta.com/help/ai-glasses/4961066940605960/) | **No.** Solo Canadá, Francia, Alemania, Italia, Reino Unido y EE. UU. **Documentado**: [ayuda de países](https://www.meta.com/help/ai-glasses/4961066940605960/) |
| Precio en España | Desde 449 €. **Documentado**: [tienda es-ES](https://www.meta.com/es/ai-glasses/ray-ban-meta/) | Vanguard desde 549 €. **Documentado**: [tienda es-ES](https://www.meta.com/es/ai-glasses/oakley-meta-vanguard/). HSTN: **Desconocido**, [la ficha](https://www.meta.com/es/ai-glasses/oakley-meta-hstn/) capturada no traía precio | Sin precio en España. Desde 899 € en Francia, Italia y Alemania. **Documentado [no oficial]**: [MIXED](https://mixed-news.com/en/meta-ray-ban-display-uk-749-germany-899-five-markets/) |
| Fecha para España | No aplica | No aplica | **Desconocido**: sin anuncio en [Meta](https://www.meta.com/blog/meta-ray-ban-display-more-useful-more-people/) ni en [prensa](https://mixed-news.com/en/meta-ray-ban-display-uk-749-germany-899-five-markets/) **[no oficial]** |

Notas:

- **Documentado**: Meta glasses también están en la lista del DAT y soportadas en España ([Setup](https://wearables.developer.meta.com/llms.txt?product=all&version=1.0&document=products/dat/sections/guides/getting-started-toolkit), [ayuda de países](https://www.meta.com/help/ai-glasses/4961066940605960/)). Un investigador leyó Meta Glasses Nova desde 309 € en la [comparativa de la tienda es-ES](https://www.meta.com/es/ai-glasses/meta-ray-ban-display/), que otro no pudo abrir; si Nova es parte de esa familia no consta.
- **Documentado**: en Vanguard, las métricas deportivas en tiempo real necesitan un Garmin aparte. [Tienda es-ES](https://www.meta.com/es/ai-glasses/oakley-meta-vanguard/).
- **Desconocido**: si Ray-Ban Meta Audio, sin cámara, tendrá soporte DAT. [Página principal del DAT](https://wearables.developer.meta.com/docs/develop/dat/).
- **Desconocido**: si unas Display compradas fuera funcionan con cuenta y Meta AI en España. [Ayuda de países](https://www.meta.com/help/ai-glasses/4961066940605960/).

## 3. SDK (DAT)

### Versión y estado

- **Documentado**: la última versión es la 1.0.1, del 9/10/2026, en iOS y Android, sin nada posterior. [Changelog iOS](https://raw.githubusercontent.com/meta/meta-wearables-dat-ios/main/CHANGELOG.md), [changelog Android](https://raw.githubusercontent.com/meta/meta-wearables-dat-android/main/CHANGELOG.md), [Maven](https://repo1.maven.org/maven2/com/meta/wearable/mwdat-core/maven-metadata.xml) y [tags](https://github.com/meta/meta-wearables-dat-ios/tags).
- **Documentado**: en iOS la 1.0.1 no trae cambios para desarrolladores; en Android corrige HEVC y rendimiento de Stream. [Changelog iOS](https://raw.githubusercontent.com/meta/meta-wearables-dat-ios/main/CHANGELOG.md), [changelog Android](https://raw.githubusercontent.com/meta/meta-wearables-dat-android/main/CHANGELOG.md).
- **Documentado**: Meta da la 1.0 por estable, con despliegue desde el 30/09/2026. Estable no significa publicable. [FAQ](https://developers.meta.com/wearables/faq/).
- **Documentado**: los repos pasaron a la organización `meta`; las URL de `facebook` redirigen y la documentación las sigue usando para Swift Package Manager. [Repo iOS](https://github.com/facebook/meta-wearables-dat-ios).
- **Documentado**: no es código abierto. La licencia remite a los términos de desarrollador y a la política de uso, y el SDK iOS son xcframework cerrados. [LICENSE](https://raw.githubusercontent.com/meta/meta-wearables-dat-ios/main/LICENSE).
- **Documentado**: una app compilada con un SDK demasiado antiguo recibe `insufficientSDKVersion`, un error terminal que obliga a sacar versión nueva. [Changelog iOS](https://raw.githubusercontent.com/meta/meta-wearables-dat-ios/main/CHANGELOG.md).

### Qué expone

Experimental significa que se puede compilar y probar, pero las apps que lo usan no pueden publicarse todavía, y puede cambiar entre versiones menores. **Documentado**: [changelog iOS](https://raw.githubusercontent.com/meta/meta-wearables-dat-ios/main/CHANGELOG.md). Tampoco pueden ir en builds de producción sin permiso escrito de Meta. **Documentado**: [Terms](https://wearables.developer.meta.com/terms).

Sin esa etiqueta no significa publicable: hoy los envíos no están abiertos y en iOS sigue el bloqueo general.

| Capacidad | Qué da | Permiso | Estado | Fuente (**Documentado** salvo la columna Permiso del audio, que es **Inferido**) |
|---|---|---|---|---|
| Sesiones (`DeviceSession`) | Estados started, paused y stopped; una sesión por dispositivo. El usuario pausa o para con toques, quitándose las gafas o plegándolas | No aplica | Sin etiqueta | [Lifecycle](https://wearables.developer.meta.com/llms.txt?product=all&version=1.0&document=products/dat/sections/guides/lifecycle-events) |
| Estado del dispositivo | Batería, carga, puesto o quitado, bisagra y nivel térmico, sin sesión | Ninguno | Sin etiqueta | [Device state](https://wearables.developer.meta.com/llms.txt?product=all&version=1.0&document=products/dat/sections/guides/device-state) |
| Stream de vídeo | 720x1280, 504x896 o 360x640; 2, 7, 15, 24 o 30 fps; raw o hvc1; foto durante el stream; transporte Wi-Fi desde la 0.8 | Cámara, vía Meta AI | Sin etiqueta | [Streaming](https://wearables.developer.meta.com/llms.txt?product=all&version=1.0&document=products/dat/sections/guides/streaming) |
| Foto independiente | Hasta 4032x3024, JPEG o HEIC | Cámara, vía Meta AI | **Experimental** | [Captura](https://wearables.developer.meta.com/llms.txt?product=all&version=1.0&document=products/dat/sections/guides/camera-capture) |
| Audio HFP y A2DP | Bluetooth estándar con APIs del sistema. HFP bidireccional, voz mono a 16 u 8 kHz, con beamforming. A2DP solo salida. Son excluyentes | El del sistema | Sin etiqueta | [Micrófonos y altavoces](https://wearables.developer.meta.com/llms.txt?product=all&version=1.0&document=products/dat/sections/guides/microphones-and-speakers) |
| Audio PCM en el stream | 16, 44,1 o 48 kHz, sin beamforming | No recogido | **Experimental** | [Micrófonos y altavoces](https://wearables.developer.meta.com/llms.txt?product=all&version=1.0&document=products/dat/sections/guides/microphones-and-speakers) |
| Speech | Transcripción en las gafas, parcial y final, con confianza. Deja de informar al minuto, sin error | Micrófono, vía Meta AI | **Experimental** | [Speech](https://wearables.developer.meta.com/llms.txt?product=all&version=1.0&document=products/dat/sections/guides/speech) |
| Voice invocations | Hey Meta más el nombre de la app la abre o la trae al frente. Solo `LaunchApp` | Se configura en el Developer Center | **Experimental** | [Voice invocations](https://wearables.developer.meta.com/llms.txt?product=all&version=1.0&document=products/dat/sections/guides/voice-invocations) |
| Inputs | Eventos semánticos: nav, select, botones de acción y captura, arrastre con Neural Band. El evento Back aún no llega desde gafas reales | Ninguno | **Experimental** | [Inputs](https://wearables.developer.meta.com/llms.txt?product=all&version=1.0&document=products/dat/sections/guides/inputs) |
| Motion | Acelerómetro, giroscopio, magnetómetro y orientación. En gafas sin pantalla llega rotado 90 grados por un fallo conocido | Ninguno | **Experimental** | [Motion](https://wearables.developer.meta.com/llms.txt?product=all&version=1.0&document=products/dat/sections/guides/motion) |
| Display | Apartado 4 | Sesión iniciada por el usuario | Sin etiqueta | [Display overview](https://wearables.developer.meta.com/llms.txt?product=all&version=1.0&document=products/dat/sections/guides/display-overview) |

Más límites:

- **Documentado**: aun con las versiones correctas, Meta activa algunas capacidades por usuario desde servidor y pueden devolver `CAPABILITY_DENIED`. [Dependencias](https://wearables.developer.meta.com/llms.txt?product=all&version=1.0&document=products/dat/sections/guides/version-dependencies).
- **Inferido**: el DAT no da acceso a Meta AI como modelo o conversación. [Recap de Connect](https://developers.meta.com/blog/meta-connect-recap-ai-glasses/).
- **Desconocido**: el segundo plano. El changelog dice que hvc1 continúa y raw se pausa (0.5.0), pero la guía de streaming no fija la regla, y la [muestra CameraAccess](https://raw.githubusercontent.com/meta/meta-wearables-dat-ios/main/samples/CameraAccess/README.md) cierra la sesión al pasar a segundo plano. Hay que probarlo. [Changelog iOS](https://raw.githubusercontent.com/meta/meta-wearables-dat-ios/main/CHANGELOG.md).

### Requisitos

- **Documentado**: iOS 17.2 o superior, Xcode 26.4 o superior; Android 10 o superior con Kotlin 2.2 o superior. Swift y Kotlin, con puente Objective-C. [Setup v1.0](https://wearables.developer.meta.com/llms.txt?product=all&version=1.0&document=products/dat/sections/guides/getting-started-toolkit).
- **Documentado**: el mínimo de iOS subió de 15.2 a 17.2 en la 0.9.0. [Changelog iOS](https://raw.githubusercontent.com/meta/meta-wearables-dat-ios/main/CHANGELOG.md).
- **Documentado**: los binarios 1.0.1 están compilados con Swift 6.3.3. [swiftinterface](https://raw.githubusercontent.com/meta/meta-wearables-dat-ios/1.0.1/MWDATCore.xcframework/ios-arm64/MWDATCore.framework/Modules/MWDATCore.swiftmodule/arm64-apple-ios.swiftinterface).
- **Documentado**: en iOS se instala como Swift Package; ocho productos (Core, Camera, Display, Inputs, Motion, Speech, MockDevice y MockDeviceTestClient). `Package.swift` solo existe en los tags. [Package.swift 1.0.1](https://raw.githubusercontent.com/meta/meta-wearables-dat-ios/1.0.1/Package.swift).
- **Documentado**: en Android, Maven Central, `com.meta.wearable`, sin token. [README Android](https://raw.githubusercontent.com/meta/meta-wearables-dat-android/main/README.md).
- **Inferido**: descargar el SDK iOS no pide token ni cuenta. [Package.swift 1.0.1](https://raw.githubusercontent.com/meta/meta-wearables-dat-ios/1.0.1/Package.swift).
- **Documentado**: Info.plist necesita esquema de URL, diccionario `MWDAT` (AppLinkURLScheme, MetaAppID, ClientToken, TeamID), `UISupportedExternalAccessoryProtocols` con `com.meta.ar.wearable`, y descripciones de Bluetooth y red local con Bonjour. `UIBackgroundModes` incluye processing, bluetooth-central, bluetooth-peripheral y external-accessory. [getting-started.mdc](https://raw.githubusercontent.com/meta/meta-wearables-dat-ios/main/.cursor/rules/getting-started.mdc).
- **Documentado**: Meta AI es obligatoria con gafas reales; empareja, registra y concede permisos por salto de app y callback. [permissions-registration.mdc](https://raw.githubusercontent.com/meta/meta-wearables-dat-ios/main/.cursor/rules/permissions-registration.mdc).

### Encaje con Expo y NIVL

- **Inferido**: el SDK no tiene versión oficial para React Native ni Expo; la documentación solo trata iOS y Android. [Setup](https://wearables.developer.meta.com/docs/getting-started-toolkit) y [FAQ](https://developers.meta.com/wearables/faq/).
- **Inferido**: integrarlo pide binario nuevo, no OTA, y no funciona en Expo Go. [Guía iOS](https://wearables.developer.meta.com/llms.txt?product=all&version=1.0&document=products/dat/sections/guides/build-integration-ios).
- **Inferido**: obligaría a subir el mínimo de toda la app a iOS 17.2, frente al 15.1 de RN 0.81. No se ha encontrado una forma documentada de enlazarlo solo en 17.2 o superior. [helpers.rb de RN 0.81](https://raw.githubusercontent.com/facebook/react-native/0.81-stable/packages/react-native/scripts/cocoapods/helpers.rb).
- **Inferido**: Expo SDK 54 pide Xcode 16.1 y recomienda 26, así que el rango admite 26.4, pero nadie documenta esa combinación compilada. [Changelog SDK 54](https://expo.dev/changelog/sdk-54).
- **Desconocido**: si el flujo actual de GitHub Actions (macos-15 con Xcode latest-stable) llega a Xcode 26.4. [Setup](https://wearables.developer.meta.com/docs/getting-started-toolkit) da el requisito; el resto no se ha comprobado.
- **Documentado [no oficial]**: hereda el bloqueo de App Store y solo declara verificadas las Ray-Ban Meta. El wrapper comunitario más al día es `@chrisgocode/expo-meta-wearables-dat` 2.2.0, del 3/10/2026, sobre DAT 1.0. Declara Expo 52+, RN 0.76+, iOS 17.2+, sin Expo Go, y New Architecture y Display sin probar. Su README pide Xcode 16+, por debajo de lo que exige Meta. [npm](https://registry.npmjs.org/@chrisgocode%2fexpo-meta-wearables-dat).
- **Inferido [no oficial]**: su plugin parece quedarse corto en Info.plist. Sirve de referencia para `spm_dependency`, no como dependencia. [Podspec](https://raw.githubusercontent.com/chrisgocode/expo-meta-wearables-dat/HEAD/ios/EMWDAT.podspec) y [plugin](https://raw.githubusercontent.com/chrisgocode/expo-meta-wearables-dat/HEAD/plugin/src/index.ts).
- **Documentado [no oficial]**: otras opciones sirven menos: `expo-meta-wearables-dat`, cuya ficha de la 1.2.0 estaba en DAT 0.6 (la 1.3.0 no se ha comprobado) ([npm](https://registry.npmjs.org/expo-meta-wearables-dat), [libraries.io](https://libraries.io/npm/expo-meta-wearables-dat)) y `react-native-nitro-glasses` 0.2.0 no conecta con gafas reales ([npm](https://registry.npmjs.org/react-native-nitro-glasses), [pkgstats](https://www.pkgstats.com/pkg:react-native-nitro-glasses)).
- **Desconocido**: si algún wrapper funciona con Expo SDK 54 y RN 0.81. No hay prueba en ninguna fuente. [npm](https://registry.npmjs.org/@chrisgocode%2fexpo-meta-wearables-dat) **[no oficial]**.

## 4. Pantalla: DAT Display y Web Apps

Las dos vías existen desde el 14/05/2026 y solo sirven en Meta Ray-Ban Display. **Documentado**: [blog de Meta](https://developers.meta.com/blog/build-for-display-glasses/). Ese modelo no está soportado en España. **Documentado**: [ayuda de países](https://www.meta.com/help/ai-glasses/4961066940605960/).

| | DAT Display | Web Apps |
|---|---|---|
| Qué es | La app del móvil envía layouts declarativos por Bluetooth (`MWDATDisplay`, `mwdat-display`). **Documentado**: [overview](https://wearables.developer.meta.com/llms.txt?product=all&version=1.0&document=products/dat/sections/guides/display-overview) | HTML, CSS y JS independientes, sin app nativa ni SDK. **Documentado**: [Build](https://wearables.developer.meta.com/docs/develop/webapps/build/) |
| Superficie | 600x600, con control exclusivo durante la sesión. **Documentado**: [overview](https://wearables.developer.meta.com/llms.txt?product=all&version=1.0&document=products/dat/sections/guides/display-overview) | 600x600 fijo sin scroll, pantalla aditiva, entrada como flechas y Enter. **Documentado**: [Build](https://wearables.developer.meta.com/docs/develop/webapps/build/) |
| Contenido | FlexBox, Text, Image, Button, ButtonGroup, Icon y VideoPlayer. **Documentado**: [overview](https://wearables.developer.meta.com/llms.txt?product=all&version=1.0&document=products/dat/sections/guides/display-overview) y [swiftinterface de Display](https://raw.githubusercontent.com/meta/meta-wearables-dat-ios/1.0.1/MWDATDisplay.xcframework/ios-arm64/MWDATDisplay.framework/Modules/MWDATDisplay.swiftmodule/arm64-apple-ios.swiftinterface) | Web normal, con sensores, geolocalización del móvil, 5 MB de almacenamiento, Service Workers, fetch y WebSocket. **Documentado**: [Build](https://wearables.developer.meta.com/docs/develop/webapps/build/) y [página de Web Apps](https://developers.meta.com/wearables/web-apps/) |
| Lo que no puede | No hay API de dibujo. Cada envío reemplaza toda la vista, solo scroll vertical. **Documentado**: [guía iOS](https://wearables.developer.meta.com/llms.txt?product=all&version=1.0&document=products/dat/sections/guides/display-ios) | Sin cámara, micrófono ni notificaciones. **Documentado**: [Build](https://wearables.developer.meta.com/docs/develop/webapps/build/) |
| Requisitos | Meta AI y firmware del SDK, toolkit instalado en las gafas, modo desarrollador. **Documentado**: [overview](https://wearables.developer.meta.com/llms.txt?product=all&version=1.0&document=products/dat/sections/guides/display-overview) | Gafas v125+, Meta AI v272+, URL HTTPS pública. **Documentado**: [Web Apps](https://wearables.developer.meta.com/docs/develop/webapps/) |
| Instalación | Canal Beta o modo desarrollador (apartado 7) | Enlace profundo, QR o `navigator.install()`; aparece como no verificada. **Documentado**: [Web Apps](https://wearables.developer.meta.com/docs/develop/webapps/) |
| Presupuesto | Imágenes grandes generan lag. **Documentado**: [guía iOS](https://wearables.developer.meta.com/llms.txt?product=all&version=1.0&document=products/dat/sections/guides/display-ios) | Arranque por debajo de 300 KB y menos de 15 peticiones. **Documentado**: [kit oficial](https://github.com/facebookincubator/meta-wearables-webapp) |

Detalles de DAT Display:

- **Documentado**: las imágenes no son solo por URL. El binario iOS 1.0.1 expone `Image(uri:)` e `Image(image: UIImage)`, y Android admite `Bitmap` local. El vídeo sí es solo por URI, MP4 con límites de 400 px por lado y 70.000 píxeles. [swiftinterface de Display](https://raw.githubusercontent.com/meta/meta-wearables-dat-ios/1.0.1/MWDATDisplay.xcframework/ios-arm64/MWDATDisplay.framework/Modules/MWDATDisplay.swiftmodule/arm64-apple-ios.swiftinterface), [changelog Android](https://raw.githubusercontent.com/meta/meta-wearables-dat-android/main/CHANGELOG.md) y [guía iOS](https://wearables.developer.meta.com/llms.txt?product=all&version=1.0&document=products/dat/sections/guides/display-ios).
- **Inferido**: una imagen generada en el móvil funcionaría como lienzo de hecho, con coste de lag y sin actualización parcial. Sin probar. [Changelog Android](https://raw.githubusercontent.com/meta/meta-wearables-dat-android/main/CHANGELOG.md).
- **Documentado**: tres estilos de texto (heading, body, meta) y dos colores semánticos. [Guía iOS](https://wearables.developer.meta.com/llms.txt?product=all&version=1.0&document=products/dat/sections/guides/display-ios).
- **Documentado**: la sesión la inicia el usuario de forma explícita y el sistema puede interrumpirla. Se atenúa a los 20 s y duerme a los 25 s, sin cerrarse. Las gafas no guardan estado: la fuente de verdad es el móvil. [Overview](https://wearables.developer.meta.com/llms.txt?product=all&version=1.0&document=products/dat/sections/guides/display-overview) y [guía iOS](https://wearables.developer.meta.com/llms.txt?product=all&version=1.0&document=products/dat/sections/guides/display-ios).
- **Inferido**: un coach no puede colocar un aviso sin sesión abierta: la API solo ofrece start, stop, send, clearDisplay y sendVideoStop. Con sesión abierta la app decide cuándo enviar. [Swiftinterface de Display](https://raw.githubusercontent.com/meta/meta-wearables-dat-ios/1.0.1/MWDATDisplay.xcframework/ios-arm64/MWDATDisplay.framework/Modules/MWDATDisplay.swiftmodule/arm64-apple-ios.swiftinterface).
- **Desconocido**: si la sesión de Display sigue viva con la app en segundo plano o el iPhone bloqueado. [Overview](https://wearables.developer.meta.com/llms.txt?product=all&version=1.0&document=products/dat/sections/guides/display-overview).
- **Documentado**: la Neural Band llega traducida por el sistema; no aparece señal EMG cruda en lo consultado (es ausencia, no negación expresa). [Overview](https://wearables.developer.meta.com/llms.txt?product=all&version=1.0&document=products/dat/sections/guides/display-overview).
- **Documentado**: el soporte de pantalla llegó en la 0.7.0; en enero de 2026 aún no existía. [Discusión 57](https://github.com/facebook/meta-wearables-dat-ios/discussions/57), foro oficial.

Detalles de Web Apps y avisos:

- **Inferido**: la vía de menor coste sería una Web App ligera aparte (misiones de hoy, marcar hecho). Solo alcanzaría a gafas compradas fuera de España: sería un experimento, no una función. Falta validar el inicio de sesión. [Página de Web Apps](https://developers.meta.com/wearables/web-apps/).
- **Documentado**: los avisos del móvil reflejados en la pantalla estaban anunciados como próximos a 23/09/2026. No se ha encontrado confirmación oficial de su salida. [Blog de Meta](https://www.meta.com/blog/meta-ray-ban-display-more-useful-more-people/).
- **Inferido [no oficial]**: la prensa describe un reflejo opcional anterior, lo que choca en parte con ese anuncio. [UploadVR](https://www.uploadvr.com/meta-ray-ban-display-gets-new-features-online-ordering-international-launch/).
- **Documentado**: los proveedores de avisos que Meta nombra son Messenger, WhatsApp, Instagram y el teléfono; ninguna app de terceros. El artículo es general de gafas y no trata Display en concreto. [Ayuda de Meta](https://www.meta.com/help/ai-glasses/493802475697609/).
- **Inferido [no oficial]**: en iOS, según un portavoz en 2025, llegaban llamadas y SMS o iMessage, sin grupos. El dato puede estar superado. [Gizmodo](https://gizmodo.com/meta-ray-ban-display-imessage-iphone-2000662934).
- **Desconocido**: si un push de NIVL en iPhone aparecerá en la pantalla. [Blog de Meta](https://www.meta.com/blog/meta-ray-ban-display-more-useful-more-people/).

## 5. Voz y completar misión

Nada mueve economía desde este módulo: solo propone una misión candidata. Completarla es la vía actual (`complete_quest` y `propagarActo`) y tras confirmación explícita. El casado de texto con misión debe ser determinista, porque el plan gratis no tiene IA.

| Vía | Qué hace | ¿"Dilo y se marca"? | Publicable hoy | Español | Etiqueta y fuente |
|---|---|---|---|---|---|
| Audio HFP y reconocimiento en el iPhone | El micrófono de las gafas funciona como Bluetooth estándar; `AVAudioSession` con `.allowBluetoothHFP` | No: el usuario abre NIVL y confirma | Aún no: exige binario nuevo y un módulo aparte, fuera de `nivl-meta`. Es la única candidata futura porque no enlazaría el DAT. Sin probar | Depende del reconocedor del iPhone, sin probar | **Inferido**: [micrófonos y altavoces](https://wearables.developer.meta.com/llms.txt?product=all&version=1.0&document=products/dat/sections/guides/microphones-and-speakers) |
| Hey Meta (`LaunchApp`) | Abre o trae al frente la app; sin frases ni intenciones propias | No | No: experimental | **Desconocido** | **Documentado**: [guía](https://wearables.developer.meta.com/llms.txt?product=all&version=1.0&document=products/dat/sections/guides/voice-invocations) y [changelog](https://raw.githubusercontent.com/meta/meta-wearables-dat-ios/main/CHANGELOG.md) |
| Speech del DAT | Transcribe en las gafas; se corta al minuto | No por sí solo | No: experimental | **Desconocido** | **Documentado**: [guía](https://wearables.developer.meta.com/llms.txt?product=all&version=1.0&document=products/dat/sections/guides/speech) y [known issues](https://wearables.developer.meta.com/docs/develop/dat/knownissues) |
| Meta AI Connectors | Meta AI llama a una API o MCP de NIVL | Valoración propia (**Inferido**): sería lo más cercano a decirlo y que se marque; Meta no habla de voz en la FAQ | Preview con registro | **Desconocido**, también en la UE | **Documentado**: [FAQ](https://developers.meta.com/wearables/faq/) y [recap](https://developers.meta.com/blog/meta-connect-recap-ai-glasses/) |
| WebMCP | Herramientas de una Web App invocables por voz; solo Display. Según la documentación general, apagado por defecto | Solo con Display | Preview | **Desconocido** | **Documentado**: [recap](https://developers.meta.com/blog/meta-connect-recap/), [recap gafas](https://developers.meta.com/blog/meta-connect-recap-ai-glasses/) |

Precisiones:

- **Documentado**: Hey Meta se configura en el Developer Center, no en Info.plist; Meta recomienda evitar AI en el nombre y que sea fonéticamente claro. Una Web App con WebMCP en primer plano tiene prioridad. [Voice invocations](https://wearables.developer.meta.com/llms.txt?product=all&version=1.0&document=products/dat/sections/guides/voice-invocations).
- **Desconocido**: cómo se reconocería "NIVL" hablado, si Hey Meta entiende la frase en español y si Meta AI verbaliza el `actionOutput`. [Voice invocations](https://wearables.developer.meta.com/llms.txt?product=all&version=1.0&document=products/dat/sections/guides/voice-invocations).
- **Documentado**: el binario iOS de Speech expone `locale` y `localePublisher` de solo lectura, y `addSpeech()` no recibe parámetros: en iOS no se elige idioma por esa vía. [swiftinterface de Speech](https://raw.githubusercontent.com/meta/meta-wearables-dat-ios/1.0.1/MWDATSpeech.xcframework/ios-arm64/MWDATSpeech.framework/Modules/MWDATSpeech.swiftmodule/arm64-apple-ios.swiftinterface).
- **Desconocido**: qué idiomas admite Speech. Android tiene `SpeechConfiguration`, sin inspeccionar. Con gafas, la app podría leer qué locale informa. [Referencia de Speech](https://wearables.developer.meta.com/llms.txt?product=all&version=1.0&document=products/dat/sections/ios-api/mwdatspeech_speech).
- **Documentado**: al activar el micrófono por HFP, la salida baja a calidad de voz. [Micrófonos y altavoces](https://wearables.developer.meta.com/llms.txt?product=all&version=1.0&document=products/dat/sections/guides/microphones-and-speakers).

**Flujo interno viable (Inferido, sin probar):** Hey Meta abre NIVL, la app escucha por HFP, el texto se casa con una misión y, tras confirmar, se completa por la vía actual. Solo en build interna, porque Hey Meta es experimental. Configurar la invocación se hace en el Developer Center; si Developer Mode evita ese paso es **Desconocido**. [Voice invocations](https://wearables.developer.meta.com/llms.txt?product=all&version=1.0&document=products/dat/sections/guides/voice-invocations).

## 6. Simulador y pruebas sin gafas

| Se puede probar sin gafas | Etiqueta y fuente |
|---|---|
| Compilar y ejecutar en el Simulador de iOS con MockDeviceKit, sin iPhone físico | **Documentado**: [AGENTS.md del repo iOS](https://raw.githubusercontent.com/meta/meta-wearables-dat-ios/main/AGENTS.md) |
| Gafas simuladas: emparejado, encendido, plegado, puesta y retirada, batería, carga, temperatura, touchpad, cámara desde archivo (h.265) o del móvil, foto, permisos y registro | **Documentado**: [mockdevice-testing.mdc](https://raw.githubusercontent.com/meta/meta-wearables-dat-ios/main/.cursor/rules/mockdevice-testing.mdc) |
| Kits de foto, inputs, motion, speech e invocaciones de voz, desde la 1.0.0 | **Documentado**: [changelog iOS](https://raw.githubusercontent.com/meta/meta-wearables-dat-ios/main/CHANGELOG.md) |
| Display: `MockDisplayKit`, `metaRayBanDisplay`, `createPreviewView` y `sendClick`; vista previa 600x600 en la app o en una extensión de Chrome | **Documentado**: [simulación de Display](https://wearables.developer.meta.com/llms.txt?product=all&version=1.0&document=products/dat/sections/guides/display-simulation) |
| Inyectar invocaciones de voz | **Documentado**: [voice invocations](https://wearables.developer.meta.com/llms.txt?product=all&version=1.0&document=products/dat/sections/guides/voice-invocations) |
| Sin Meta AI: arranca registrado y con permisos, y `MockPermissions` los controla | **Documentado**: [mockdevice-testing.mdc](https://raw.githubusercontent.com/meta/meta-wearables-dat-ios/main/.cursor/rules/mockdevice-testing.mdc) |
| Sin cuenta de Meta: ninguna guía la pide, pero tampoco lo afirma | **Inferido**: [testing-mdk-ios](https://wearables.developer.meta.com/docs/develop/dat/testing-mdk-ios/) |
| XCUITest en simuladores de CI | **Documentado**: [testing-mdk-ios](https://wearables.developer.meta.com/docs/develop/dat/testing-mdk-ios/) |
| Web Apps: extensión Display Simulator de Chrome, `npm run preview` con flechas y Enter, control headless a 600x600 | **Documentado**: [Build](https://wearables.developer.meta.com/docs/develop/webapps/build/) |

| No se puede probar sin gafas, o hay límites | Etiqueta y fuente |
|---|---|
| En iOS la vista en Chrome exige ejecutar en el Simulador; no vale en iPhone físico | **Documentado**: [simulación de Display](https://wearables.developer.meta.com/llms.txt?product=all&version=1.0&document=products/dat/sections/guides/display-simulation) |
| La vista previa en la app no debe ir en producción, y en Display solo se inyectan clics | **Documentado**: [simulación de Display](https://wearables.developer.meta.com/llms.txt?product=all&version=1.0&document=products/dat/sections/guides/display-simulation) |
| Español, latencia y Bluetooth reales, segundo plano, firmware y capacidades activadas desde servidor | **Inferido**: el mock no los reproduce. [Dependencias](https://wearables.developer.meta.com/llms.txt?product=all&version=1.0&document=products/dat/sections/guides/version-dependencies) |
| Prueba final: Meta la pide en hardware | **Documentado**: [simulación de Display](https://wearables.developer.meta.com/llms.txt?product=all&version=1.0&document=products/dat/sections/guides/display-simulation) |
| Expo Go: no sirve, hace falta development build en simulador | **Inferido** para NIVL: código nativo; lo mismo declara el [wrapper, no oficial](https://registry.npmjs.org/@chrisgocode%2fexpo-meta-wearables-dat) |

La [página general de Mock Device Kit](https://wearables.developer.meta.com/docs/develop/dat/mock-device-kit/) aún solo nombra Ray-Ban Meta; la vista previa de Display del changelog la supera (apartado 10).

## 7. Cuenta, inscripción y publicación

### Probar con gafas propias (Developer Mode)

- **Documentado**: se activa en Meta AI con cinco toques sobre el número de versión, y permite registrar una app no publicada. [Setup](https://wearables.developer.meta.com/docs/getting-started-toolkit).
- **Documentado**: en Developer Mode, `MetaAppID` puede ir vacío o en 0 y el SDK omite la atestación. [permissions-registration.mdc](https://raw.githubusercontent.com/meta/meta-wearables-dat-ios/main/.cursor/rules/permissions-registration.mdc).
- **Documentado**: solo una app de terceros registrada a la vez; registrar otra desregistra la anterior. [Permisos](https://wearables.developer.meta.com/llms.txt?product=all&version=1.0&document=products/dat/sections/guides/permissions-requests).
- **Documentado**: sin cuenta se puede descargar el SDK y probar con la cuenta personal de Meta AI. Procede de un hilo de diciembre de 2025 cuyo autor no consta como empleado de Meta; la FAQ actual lo respalda solo en parte. [Discusión 9](https://github.com/facebook/meta-wearables-dat-android/discussions/9), foro oficial.

### Cuenta de desarrollador y proyecto

- **Documentado**: entrar en el Wearables Developer Center, registrar la integración y compartirla exige una Managed Meta Account dentro de una organización. Una sola organización por empresa, con su nombre oficial. [Onboarding](https://wearables.developer.meta.com/docs/develop/dat/onboarding-and-organization-management).
- **Desconocido**: si un autónomo o persona física puede crear la organización, y si hay verificación de empresa. Se comprueba intentando el alta o preguntando a Meta. [Onboarding](https://wearables.developer.meta.com/docs/develop/dat/onboarding-and-organization-management).
- **Documentado**: quien acepta los términos declara tener autoridad legal para vincular a la organización. [Terms](https://wearables.developer.meta.com/terms).
- **Documentado [no oficial]**: un usuario informa de un fallo en el alta de la cuenta gestionada, con página en blanco en el paso de 2FA. [Issue 172](https://github.com/facebook/meta-wearables-dat-android/issues/172).
- **Documentado**: el proyecto recoge los datos de la app, nombre e icono visibles en Meta AI, y justificación por permiso de cámara, micrófono o invocación por voz. Cada versión genera una app en unos 10 minutos, hasta 30. [Manage projects](https://wearables.developer.meta.com/docs/develop/dat/manage-projects/).
- **Documentado**: en iOS, fuera de Developer Mode, hace falta un Universal Link HTTPS; los esquemas propios no valen. [Manage projects](https://wearables.developer.meta.com/docs/develop/dat/manage-projects/). **Inferido**: para NIVL implicaría `nivl.app`, no `nivl://`.
- **Documentado**: en producción hacen falta `MetaAppID`, `ClientToken`, Team ID de Apple y que el usuario esté en el canal adecuado. [permissions-registration.mdc](https://raw.githubusercontent.com/meta/meta-wearables-dat-ios/main/.cursor/rules/permissions-registration.mdc).

### Canal Beta

- **Documentado**: un canal privado por integración, una versión a la vez, con invitación por correo y confirmación en Meta AI. Las cuentas gestionadas no sirven como tester, y el desarrollador con cuenta gestionada y el tester con cuenta normal son cuentas distintas. [Canales](https://wearables.developer.meta.com/docs/develop/dat/set-up-release-channels/).
- **Documentado**: las versiones anteriores a la 1.0 no funcionan con builds del SDK 1.0. [Canales](https://wearables.developer.meta.com/docs/develop/dat/set-up-release-channels/).
- **Desconocido**: el límite vigente de testers; solo se ve en el panel. Los 100 de mayo de 2026 son de la etapa preview y no deben darse por vigentes. [Blog de mayo](https://developers.meta.com/blog/build-for-display-glasses/).

### Publicación

- **Documentado**: App Store no soportada; ExternalAccessory provocará el rechazo por MFi y manifiesto de privacidad. [Guía iOS](https://wearables.developer.meta.com/llms.txt?product=all&version=1.0&document=products/dat/sections/guides/build-integration-ios). **Decisión**: el SDK no entra en el binario de producción de NIVL.
- **Documentado**: sin calendario. Un colaborador del repo no pudo confirmar TestFlight externo, Apple Business Manager ni Enterprise (29/10/2026). Foro oficial, no documentación. [Discusión 339](https://github.com/meta/meta-wearables-dat-ios/discussions/339).
- **Documentado [no oficial]**: un usuario afirma que TestFlight externo funciona, sin pruebas. No debe darse por válido. [Discusión 339](https://github.com/meta/meta-wearables-dat-ios/discussions/339).
- **Inferido**: en Google Play no hay veto expreso. El límite viene de que los Terms exigen Integration Review y los envíos no están abiertos. [Terms](https://wearables.developer.meta.com/terms).
- **Documentado**: los envíos a las superficies de Meta no están abiertos, sin fecha. [FAQ](https://developers.meta.com/wearables/faq/) y [recap](https://developers.meta.com/blog/meta-connect-recap-ai-glasses/).
- **Documentado**: el objetivo original era abrir en 2026; no se ha confirmado ni retirado. [Anuncio de 2025](https://developers.meta.com/blog/introducing-meta-wearables-device-access-toolkit/).
- **Documentado**: las superficies previstas son el catálogo de Meta AI y la app Explore de Display, con selección curada. [Explore](https://developers.meta.com/wearables/explore/).
- **Documentado**: Integration Review a discreción de Meta y revisión continua, con posible retirada sin aviso. [Terms](https://wearables.developer.meta.com/terms) y [guía de uso aceptable](https://wearables.developer.meta.com/llms.txt?product=all&version=1.0&document=products/dat/sections/guides/acceptable-use).
- **Documentado**: la documentación alude a un canal de producción, sin decir cómo acceder a él. [Manage projects](https://wearables.developer.meta.com/docs/develop/dat/manage-projects/).
- **Documentado**: Meta puede cancelar el acceso a APIs sin uso durante 90 días. [Terms](https://wearables.developer.meta.com/terms).
- **Inferido [no oficial]**: que Explore acabe siendo una tienda completa es especulación de prensa. [UploadVR](https://www.uploadvr.com/meta-ray-ban-display-gets-new-features-online-ordering-international-launch/).
- **Documentado**: en la página de Web Apps hay un botón para compartir la tuya con Meta, sin criterios de revisión; no es un proceso de publicación. [Web Apps](https://developers.meta.com/wearables/web-apps/).

## 8. España, UE y privacidad

### España

- **Documentado**: cualquiera puede descargar el SDK, pero el acceso completo y el Developer Center se limitan a países con soporte de gafas con IA. [FAQ](https://developers.meta.com/wearables/faq/).
- **Inferido**: España debería tener acceso, porque figura en la lista de soporte de consumo. Ninguna fuente oficial nombra a España o la UE para el DAT, ni aclara si cuenta el país del desarrollador, de la cuenta o del dispositivo. Se confirma solo intentando el alta. [Ayuda de países](https://www.meta.com/help/ai-glasses/4961066940605960/).
- **Documentado [no oficial]**: las funciones de Meta pueden depender del país, según un gestor de Meta en un foro de consumo (caso Garmin y Strava en Portugal, 2025). No prueba restricciones del SDK. [Foro de la comunidad](https://communityforums.atmeta.com/troubleshooting-20/my-meta-vanguard-ai-glasses-don-t-have-neither-garmin-or-strava-on-app-connections-175328).
- **Documentado**: Meta AI llegó a Ray-Ban Meta en España el 18/11/2024, en español. Preguntar por lo que se ve se anunció para la UE en abril de 2025; esa frase no nombra a España. [Nota de Meta](https://about.fb.com/news/2025/04/meta-ai-begins-roll-out-on-ray-ban-meta-glasses-to-even-more-countries-in-the-eu/).

### Política de uso y términos

- **Documentado**: prohibido identificar personas por voz o cara salvo excepción aprobada, grabar de forma encubierta y eludir el LED de captura. [Política de uso](https://wearables.developer.meta.com/acceptable-use-policy).
- **Inferido**: un gimnasio con vestuarios podría contar como ubicación sensible; la política no lo nombra. [Política de uso](https://wearables.developer.meta.com/acceptable-use-policy).
- **Inferido**: una app de hábitos y deporte encaja, porque el seguimiento de actividad figura entre los usos fomentados, siempre que no se presente como médica. [Guía de uso aceptable](https://wearables.developer.meta.com/llms.txt?product=all&version=1.0&document=products/dat/sections/guides/acceptable-use).
- **Documentado**: la tecnología no es un dispositivo médico y el desarrollador responde de los problemas de salud y seguridad. [Terms](https://wearables.developer.meta.com/terms).
- **Documentado**: procesar Protected Health Information exige antes un Healthcare Addendum y un Business Associate Agreement. Está planteado en términos de HIPAA. [Terms](https://wearables.developer.meta.com/terms).
- **Documentado**: no se pueden vender ni licenciar los datos, ni usarlos para vigilancia. Hace falta política de privacidad y borrado a petición. [Terms](https://wearables.developer.meta.com/terms).
- **Documentado**: ley de California, tribunales de California y responsabilidad de Meta limitada a 1.000 dólares. [Terms](https://wearables.developer.meta.com/terms).
- **Documentado**: la guía recomienda propósito acotado, retención corta y uso evidente para quienes están alrededor. [Guía de uso aceptable](https://wearables.developer.meta.com/llms.txt?product=all&version=1.0&document=products/dat/sections/guides/acceptable-use).

### Telemetría y RGPD

- **Documentado**: el SDK envía telemetría operativa con identificadores de dispositivo, firmware y duración de sesión, activada por defecto, con opt-out en Info.plist. Meta dice no acceder a fotos, vídeo o audio transferidos directamente a la app. [Telemetría](https://wearables.developer.meta.com/llms.txt?product=all&version=1.0&document=products/dat/sections/guides/telemetry) y [README iOS](https://raw.githubusercontent.com/meta/meta-wearables-dat-ios/main/README.md).
- **Desconocido**: qué queda tras el opt-out. Preguntado sin respuesta. [Discusión 368](https://github.com/meta/meta-wearables-dat-ios/discussions/368).
- **Documentado [no oficial]**: la autoridad de Hamburgo concluyó que estas gafas no podrían en general grabar a personas fuera del círculo cercano conforme al RGPD. Solo se ha leído un resumen, no el informe. [MLex](https://www.mlex.com/mlex/articles/2523664).
- **Inferido**: voz y datos físicos pueden entrar en el artículo 9 del RGPD como datos de salud. Es criterio propio, a validar con asesoría. [Guía de uso aceptable](https://wearables.developer.meta.com/llms.txt?product=all&version=1.0&document=products/dat/sections/guides/acceptable-use).
- **Desconocido**: si la AEPD o la DPC irlandesa han actuado sobre estas gafas. Las búsquedas no dieron nada, pero sus sitios no se consultaron directamente; no prueba que no exista.

## 9. Lo que falta del usuario

Salvo el enlace indicado, esta lista es una propuesta nuestra a partir de los requisitos citados arriba.

**Para arrancar sin gafas**

1. Visto bueno a una build interna, separada de producción, con otro bundle id e iOS 17.2. El módulo solo se activaría ahí, poniendo el archivo interno con su nombre real.
2. Mac o CI con Xcode 26.4 o superior. [Setup](https://wearables.developer.meta.com/docs/getting-started-toolkit).

**Para probar con hardware**

3. Gafas con cámara. Ray-Ban Meta desde 449 € sería la opción de menor riesgo. [Tienda es-ES](https://www.meta.com/es/ai-glasses/ray-ban-meta/). Meta Ray-Ban Display, unos 899 € fuera de España, solo si se quiere validar la pantalla real. [MIXED](https://mixed-news.com/en/meta-ray-ban-display-uk-749-germany-899-five-markets/) **[no oficial]**.
4. iPhone con iOS 17.2 o superior, Meta AI V292 o superior, firmware V128 o superior, y Developer Mode activado con su cuenta personal de Meta. [Dependencias](https://wearables.developer.meta.com/docs/develop/dat/version-dependencies/). Si se quiere probar Hey Meta real, puede hacer falta además el Developer Center (puntos 5 a 7); no consta si Developer Mode lo evita.

**Para el canal Beta**

5. Decidir la entidad titular (NIVL, no Franky) y crear la organización con Managed Meta Account. [Onboarding](https://wearables.developer.meta.com/docs/develop/dat/onboarding-and-organization-management).
6. Leer y aceptar en persona los términos y la política de uso, con autoridad legal. Ningún agente puede aceptarlos. [Terms](https://wearables.developer.meta.com/terms) y [política de uso](https://wearables.developer.meta.com/acceptable-use-policy).
7. Crear el proyecto en el Developer Center y facilitar `MetaAppID`, `ClientToken`, Team ID de Apple y la justificación de cada permiso. [Manage projects](https://wearables.developer.meta.com/docs/develop/dat/manage-projects/).
8. Configurar un Universal Link HTTPS en `nivl.app`, en el repo privado de la web. [Manage projects](https://wearables.developer.meta.com/docs/develop/dat/manage-projects/).
9. Correos de testers con cuenta Meta normal, no gestionada. [Canales](https://wearables.developer.meta.com/docs/develop/dat/set-up-release-channels/).

**Decisiones**

10. Si se registra para el acceso anticipado a Connectors. [FAQ](https://developers.meta.com/wearables/faq/).
11. Si pregunta a Meta por TestFlight y por permiso escrito para funciones experimentales. [Discusión 339](https://github.com/meta/meta-wearables-dat-ios/discussions/339) y [Terms](https://wearables.developer.meta.com/terms).
12. Asesoría RGPD para voz y datos de salud y, si se usa cámara, fotos de terceros en el gimnasio. [MLex](https://www.mlex.com/mlex/articles/2523664) **[no oficial]**.
13. Si desactiva la telemetría del SDK. [Telemetría](https://wearables.developer.meta.com/llms.txt?product=all&version=1.0&document=products/dat/sections/guides/telemetry).
14. Cuando Meta abra la publicación: porcentaje de usuarios por debajo de iOS 17.2, antes de subir el mínimo de toda la app. [helpers.rb de RN 0.81](https://raw.githubusercontent.com/facebook/react-native/0.81-stable/packages/react-native/scripts/cocoapods/helpers.rb).

## 10. Contradicciones entre fuentes oficiales y preguntas abiertas

### Contradicciones

| Tema | Una fuente dice | Otra dice | Criterio de este documento |
|---|---|---|---|
| Estado del SDK | La 1.0 es estable y salió de preview: [FAQ](https://developers.meta.com/wearables/faq/) | Sigue en developer preview: [README iOS](https://raw.githubusercontent.com/meta/meta-wearables-dat-ios/main/README.md) | **Inferido**: el README parece desfasado. En ningún caso significa publicable |
| Mock y Display | El kit no soporta gafas con pantalla: [FAQ](https://developers.meta.com/wearables/faq/) | `MockDisplayKit` y `metaRayBanDisplay` existen desde la 1.0.0: [changelog iOS](https://raw.githubusercontent.com/meta/meta-wearables-dat-ios/main/CHANGELOG.md) | **Inferido**: la FAQ parece desfasada. Pendiente de compilar la muestra |
| Imágenes en Display | Por URL: [guía iOS](https://wearables.developer.meta.com/llms.txt?product=all&version=1.0&document=products/dat/sections/guides/display-ios) | También `UIImage` local: [swiftinterface](https://raw.githubusercontent.com/meta/meta-wearables-dat-ios/1.0.1/MWDATDisplay.xcframework/ios-arm64/MWDATDisplay.framework/Modules/MWDATDisplay.swiftmodule/arm64-apple-ios.swiftinterface) | **Documentado**: manda el binario |
| Gesto Back en Display | Volver desde la vista raíz termina la sesión: [overview](https://wearables.developer.meta.com/llms.txt?product=all&version=1.0&document=products/dat/sections/guides/display-overview) | Un toque con dos dedos en la patilla la termina: [guía iOS](https://wearables.developer.meta.com/llms.txt?product=all&version=1.0&document=products/dat/sections/guides/display-ios) | **Inferido**: asumir que puede cerrarla |
| Invocaciones de voz | La guía no lleva aviso beta: [guía](https://wearables.developer.meta.com/llms.txt?product=all&version=1.0&document=products/dat/sections/guides/voice-invocations) | Experimental, no publicable: [changelog iOS](https://raw.githubusercontent.com/meta/meta-wearables-dat-ios/main/CHANGELOG.md) | **Documentado**: manda el changelog |
| Web Apps y Developer Mode | El usuario debe activarlo y añadir por URL: [FAQ](https://developers.meta.com/wearables/faq/) | Lo describe como lo que desbloquea cargar y recargar, sin exigirlo en deeplink o QR: [Web Apps](https://wearables.developer.meta.com/docs/develop/webapps/) | **Desconocido**: probar con hardware |
| Segundo plano de la cámara | La 0.9.0 dice a la vez que la muestra graba en segundo plano y que termina la sesión de vista previa: [changelog iOS](https://raw.githubusercontent.com/meta/meta-wearables-dat-ios/main/CHANGELOG.md) | La muestra cierra la sesión: [README CameraAccess](https://raw.githubusercontent.com/meta/meta-wearables-dat-ios/main/samples/CameraAccess/README.md) | **Desconocido**: probar con hardware |
| Foto y audio en la 1.0 | Experimentales: [README iOS](https://github.com/facebook/meta-wearables-dat-ios) | La FAQ da el toolkit por salido de preview: [FAQ](https://developers.meta.com/wearables/faq/) | **Documentado**: siguen en la lista experimental del changelog |
| Frecuencia de HFP | 8 kHz en el overview | 16 u 8 kHz en la guía: [micrófonos y altavoces](https://wearables.developer.meta.com/llms.txt?product=all&version=1.0&document=products/dat/sections/guides/microphones-and-speakers) | **Inferido**: manda la guía específica |
| Ruta a Developer Mode | Cinco toques en App Info: [Setup](https://wearables.developer.meta.com/docs/getting-started-toolkit) | Otra ruta de menús: [getting-started.mdc](https://raw.githubusercontent.com/meta/meta-wearables-dat-ios/main/.cursor/rules/getting-started.mdc) | **Inferido**: una está desfasada |
| Mock y modelos | Solo nombra Ray-Ban Meta: [Mock Device Kit](https://wearables.developer.meta.com/docs/develop/dat/mock-device-kit/) | Incluye Display: [simulación de Display](https://wearables.developer.meta.com/llms.txt?product=all&version=1.0&document=products/dat/sections/guides/display-simulation) | **Inferido**: manda la guía específica |

### Preguntas abiertas (todas **Desconocido**)

**Publicación**

- ¿Cuándo abre Meta la App Store y los envíos, y bajo qué criterios? [Discusión 339](https://github.com/meta/meta-wearables-dat-ios/discussions/339).
- ¿Hará falta aprobación de Meta para que una app de App Store o Google Play conecte con usuarios generales? [Terms](https://wearables.developer.meta.com/terms).
- ¿Qué capacidades serán publicables cuando abra? [Changelog iOS](https://raw.githubusercontent.com/meta/meta-wearables-dat-ios/main/CHANGELOG.md).
- ¿Llegarán Inputs a producción? Sin respuesta en la [discusión 373](https://github.com/meta/meta-wearables-dat-ios/discussions/373).

**Técnica en NIVL**

- ¿Compila Expo SDK 54 con Xcode 26.4 y Swift 6.3 y enlaza el DAT? Hace falta un build de ensayo. [Changelog SDK 54](https://expo.dev/changelog/sdk-54).
- ¿Funciona `spm_dependency` con `eas build --local`? [Podspec comunitario](https://raw.githubusercontent.com/chrisgocode/expo-meta-wearables-dat/HEAD/ios/EMWDAT.podspec) **[no oficial]**.
- ¿Debe seguir la app en primer plano durante una sesión de Display? [Overview](https://wearables.developer.meta.com/llms.txt?product=all&version=1.0&document=products/dat/sections/guides/display-overview).
- ¿Qué autenticación funciona en una Web App (sesión de Supabase, OAuth, enlace)? [Build](https://wearables.developer.meta.com/docs/develop/webapps/build/).

**Voz e idioma**

- ¿Reconocen Speech y Hey Meta el español, y cómo se pronuncia NIVL? [Voice invocations](https://wearables.developer.meta.com/llms.txt?product=all&version=1.0&document=products/dat/sections/guides/voice-invocations).
- ¿Están los Connectors disponibles en la UE y en español? [FAQ](https://developers.meta.com/wearables/faq/).

**Mercado y legal**

- ¿Llegará Meta Ray-Ban Display a España? [Ayuda de países](https://www.meta.com/help/ai-glasses/4961066940605960/).
- ¿Han salido las notificaciones reflejadas, y cubren iOS y apps de terceros? [Blog de Meta](https://www.meta.com/blog/meta-ray-ban-display-more-useful-more-people/).
- ¿Cómo tratar en el RGPD las fotos de terceros tomadas con las gafas? [MLex](https://www.mlex.com/mlex/articles/2523664) **[no oficial]**.

## Estado del módulo modules/nivl-meta

Estado a 8/11/2026. Todo esto son pruebas propias de NIVL, no documentación de Meta.

**Qué es.** Módulo opcional: tarjetas para las gafas (siguiente serie, ritmo, misión del día, bloque de estudio), casado determinista de una transcripción con una misión, y puente Swift sobre DAT 1.0.1 para mostrar una tarjeta y recibir el botón Hecho. El módulo solo propone: completar seguiría siendo `complete_quest` y `propagarActo`, tras un sí explícito.

**Por qué no afecta a producción.** No existe `expo-module.config.json` (solo `expo-module.config.interno.json`), así que Expo no lo enlaza; `noop.test.ts` lo vigila en CI. Ninguna pantalla lo importa, y `app.json` y `package.json` no cambian. `scripts/variante-interna.mjs` lo activa solo en una copia desechable fuera del repo.

| Comprobado | Resultado |
|---|---|
| TypeScript, ESLint y Jest del repo con el módulo | Sin errores |
| Autolinking de Expo, apple y android | No lista `nivl-meta`; con el archivo de activación en un proyecto de control, sí |
| Bundle de `expo export` para iOS | Sin código del módulo |
| Puente Swift con Mock Device Kit en Simulador iOS 27.2, Xcode 27.2 | 21 de 21 tests en la última pasada. Una pasada anterior falló con la máquina muy cargada; tras endurecer las esperas pasó dos veces, sin poder separar causa |
| Variante interna Expo 54 y RN 0.81 con DAT, Release, Simulador | Compila, arranca y muestra una tarjeta en el mock; el clic en Hecho inyectado vuelve a JS como evento |

**Lo que hizo falta en la variante.** Añadir el paquete de DAT también al target de la app, porque el pod estático enlaza los frameworks pero no los empotra. Adoptar UIScene, porque con el SDK de iOS 27 la plantilla de Expo 54 cae al arrancar. Firma ad hoc con `keychain-access-groups` para `Wearables.configure()`. Target 17.2 en todos los pods.

**Sin comprobar.** Gafas reales y dispositivo físico. Registro real con Meta AI y su vuelta por URL. Atestación con un `MetaAppID` real. Pausa de sesión y sueño a los 25 s, que el mock no reproduce. Build Debug con Metro. Compilación con un SDK anterior al de iOS 27. La copia limpia final del script se generó y coincide con la compilada, pero no se recompiló. Los límites de caracteres de las tarjetas son una estimación propia.

**Sin implementar.** La voz nativa: `hablarTexto` y el evento `transcripcion` no tienen código en Swift, así que completar con la voz solo está probado como lógica pura. Android.
