# NIVL por dispositivo

Cómo llega NIVL a cada plataforma, por qué, y qué se ha comprobado de verdad. Escrito el 08/11/2026 sobre la rama adaptativa, con Expo SDK 54 (RN 0.81.5). Las fuentes están en §9.

Una aclaración sobre las fuentes: la URL `docs.expo.dev/versions/v54.0.0/` ya sirve el contenido de la v58 (comprobado en `config/app`, `sdk/notifications` y `sdk/haptics`). Para lo específico de SDK 54 mandan el esquema instalado (`node_modules/@expo/config-types`), los podspec instalados y el changelog de SDK 54. Lo que solo viene de la documentación actual está marcado.

## 1. Decisiones

| Plataforma | Decisión | Razón en una línea |
|---|---|---|
| iPhone, iPhone Duo, iPad | El mismo binario universal de iOS | `supportsTablet: true` y marco por ancho de ventana. El Duo no tiene idiom propio. |
| Mac | **«Designed for iPad» y, además, la web.** No Mac Catalyst | Es el mismo IPA, sin tocar CI ni firma. Catalyst pide un segundo producto que ni Expo ni EAS contemplan. |
| Vision Pro | **Compatible (app de iPad).** No nativo | Corre sin recompilar, comprobado en el simulador. Nativo no es viable con SDK 54. |
| Navegadores | Export estático SPA (`web.output: single`) en `app.nivl.app` | App privada con sesión, sin SEO: no necesita HTML por ruta. Lo que indexa es la landing. |
| `app.json` | **Sin cambios en esta fase** | Lo necesario ya está. Ver §8. |

**El hallazgo que condiciona todo lo del Duo:** el binario de tienda sale de GitHub Actions con `macos-15` y `latest-stable`, que según la imagen pública del runner llega como mucho a Xcode 26.3 (no confirmado en el log de un run). Con ese SDK **el Duo no enseña NIVL a pantalla completa**: la deja en una ventana centrada con proporción de iPhone. Todo el trabajo de 669 pt solo se verá con un binario compilado con el SDK de iOS 27 o superior. Ver §6.

## 2. Estado por plataforma

Regla de esta tabla: «verificado» es que alguien lo vio en una captura o en una ejecución real. Todo lo nativo se ejecutó en simulador, con un binario Debug compilado con Xcode 27.2 (SDK iphonesimulator 27.2, versión 1.0.11), contra Supabase simulado y una cuenta ficticia. **Ninguna prueba nativa se hizo en un dispositivo físico ni con un binario de tienda.**

| Plataforma | Verificado de verdad | Aproximado | No verificado |
|---|---|---|---|
| **iPhone Duo plegado** | Simulador, pantalla exterior de 466 pt: Hoy, Avance, Arena, Campañas, Agenda, Coach (General, IRON, FOCUS), rueda, IRON Hoy, FOCUS Hoy y Temario, WORK Hoy. Títulos a tamaño completo y campo del Coach libre del emblema tras sus arreglos (Arena, Campañas, Avance, Temario; Coach de General y FOCUS). Cifras de Arena: microscópicas en 4 de 4 arranques antes del arreglo, bien en 4 de 4 después. | | Perfil plegado; Hábitos, solo la parte de arriba (el diálogo de avisos tapa el resto). Otros textos autoajustados con alto de línea fijo (código de amigo, racha, totales de WORK) tienen la misma combinación que encogía títulos y cifras y no se han revisado uno a uno. Con el teclado abierto, en el login la contraseña queda tapada hasta desplazar (anotado, sin arreglar). Binario con SDK 26, el que previsiblemente sale hoy de CI (§6). |
| **iPhone Duo abierto** | Nada en nativo. | Ventana de iPad de 683 x 955, mismo camino de código: barra inferior y dos paneles. Tests del marco con 669. | **El Duo abierto en sí**: no se pudo desplegar sin interfaz. Pantalla interior de 669 x 951 solo leída del simulador. Insets reales, cambio plegado y abierto en caliente, Split View en el interior, barras verticales de iOS 27.1. |
| **iPad (1.1, 09/11/2026)** | Flujo Maestro `onboarding-11*.yaml` ejecutado entero y en verde contra el simulado en iPad Air 11 (M3) vertical, con cuenta sin onboarding y con cuenta ya hecha, y en iPad Pro 13 (M5) vertical y apaisado: portada, cuestionario, entrada, idioma, nombre con teclado, modos, misiones, plan de 90 días, oferta y Hoy, con tres reaperturas en frío. Capturas en Pro 13 en las dos orientaciones: Hoy Ónix, rueda, los cuatro mundos, `MundoCerrado` real sin pago, y `OfertaModosVista` con tienda abierta (galería, precios de demo). En apaisado la contraseña quedaba bajo el teclado en `/login`: arreglado. | | Compra real y oferta del onboarding con tienda abierta. Toque seco sobre un sector de la rueda (con toque sintético se resalta y no elige; con arrastre mínimo sí). Split View en mosaico. Dispositivo físico. Binario de tienda: se usó el nativo de simulador con el JS empotrado. |
| **Mac (app de iPad, 1.1)** | Nada ejecutado de la 1.1. Comprobado el 09/11/2026: 0 identidades de firma (`security find-identity -v -p codesigning`) y 0 perfiles en esta máquina. | Marco web en WebKit a 1280 y 1920, e iPad Pro 13 apaisado. Parecido, no igual: la web no pasa por el código nativo. | **Toda la ejecución en un Mac**: no se puede firmar aquí. Tamaño de ventana, márgenes, puntero, avisos, compra, dictado, enlaces. HealthKit, GPS en segundo plano y Watch no aplican en Mac. |
| **Vision Pro (compatible, 1.1)** | Instala y arranca la 1.1 en el simulador de visionOS 27.2 sin recompilar, en ventana de iPad con barra lateral. Vistas sin diálogo de avisos: Hoy, Avance, Coach con plan al lado, Perfil, Hábitos, `/pro`, IRON Hoy y `MundoCerrado` con su oferta de solo lectura. Sesión sembrada en AsyncStorage y ruta forzada en una copia del JS, porque el simulador no acepta entrada y cada `nivl://` abre un diálogo del sistema. | | Toda la interacción: toques, hojas, modales, teclado, onboarding, ventana redimensionada (el simulador no acepta entrada sintética). Compra. Oferta con tienda abierta. Mirada y gesto, tamaño de objetivo. Cámara. FOCUS, WORK y FOUNDER. HealthKit, GPS en segundo plano y Watch no aplican. Dispositivo físico. |
| **Chromium** | Build de producción con la CSP de `vercel.json` activa: 86 combinaciones de ruta y modo (58 rutas distintas) a 375, 768, 1280 y 1920, en Playwright 1194 y en Google Chrome instalado. Flujos: foto a JPG, tarjeta PNG, exportar JSON, importar, invitar. | | Vercel real, https y wss contra Supabase real. |
| **Safari** | WebKit 26 de Playwright, mismas 344 combinaciones. Foto, adjunto, exportar, importar. | WebKit de Playwright frente a Safari real: mismo motor, otro producto. | Safari real, iOS Safari, teclado virtual, 100dvh real, safe areas, hoja de compartir real con archivo. `backdrop-filter` de la rueda (WebKit headless no lo pinta). |
| **Edge** | Nada: no está instalado. | Es Chromium: se infiere de Chromium y Chrome. | Edge como producto. Con Edge instalado basta `--canal msedge`. |
| **Firefox** | **Nada: 0 combinaciones.** El Firefox de Playwright no arranca en este macOS y no hay Firefox.app. | | Todo. Lo escrito para él (`min-width`, `scrollbar-width`, `visibility`) está sin probar. |

Resultado de las 344 combinaciones por motor: 0 errores de consola, 0 de página, 0 de red, 0 redirecciones, 0 scroll horizontal e interacción 28 de 28. Quedan 3 solapes, todos del emblema flotante a 375 sobre contenido desplazado (decisión de diseño que va al rediseño 1.1), y elipsis por `numberOfLines`.

## 3. Qué necesita el dueño

Nada de esto lo puede hacer un agente.

**Para Mac y Vision Pro** (App Store Connect, la app, Pricing and Availability)
1. **Para la salida de la 1.1, desmarcar «Make this app available on Mac» y «Make this app available on Apple Vision Pro»** (recomendación del 09/11/2026). Apple las ofrece activadas por defecto, así que hay que apagarlas a mano; su estado actual no se ha podido mirar desde aquí. Se vuelven a activar sin binario nuevo. Motivo: en Mac la 1.1 no se ha ejecutado nunca, y en Vision solo se ha visto arrancar y pintar, sin un solo toque ni compra.
2. Instalar la versión de TestFlight en un Mac con Apple Silicon y probarla: ventana, compra de sandbox, avisos, dictado, enlaces. Es la única forma de pasar el Mac de «no verificado» a «verificado» y de reactivar su casilla. Para Vision, lo mismo con unas gafas o a mano en el simulador.

**Para el iPhone Duo**

3. Decidir si el próximo binario sale con Xcode 27.1 o superior (§6). Sin eso, en el Duo abierto se ve la app con proporción de iPhone.
4. Probar a mano el Duo abierto: en Device Hub, con la ventana visible en un escritorio normal, usar los controles de abrir y cerrar. Y una ventana de Vision redimensionada, por el mismo camino.

**Para la web** (`docs/web/APP-WEB.md` §6, sigue en preview)

5. Dar el OK de producción: dominio, DNS, Redirect URLs de Supabase Auth y `PRODUCCION=1`. Después, confirmar la CSP real en `app.nivl.app`.
6. Instalar Firefox y Edge y repetir el arnés (`node e2e/web/recorrer.mjs --motor firefox --sin-galeria --base …` y `--canal msedge`). Abrir la web en un Safari y en un iPhone reales.

## 4. Mac: «Designed for iPad», no Catalyst

**Cómo llega.** El mismo IPA que se sube a TestFlight. Apple lo ofrece en Mac con Apple Silicon sin recompilar y dice que compras, suscripciones y capacidades siguen funcionando. Los Mac Intel no lo reciben: para ellos, y para quien prefiera no instalar, está la web.

**Ventana.** Apple dice que un iPad con multitarea y que se adapte corre en ventana redimensionable, y que las apps de iPhone o sin multitarea quedan en tamaño fijo. NIVL cumple lo primero: `UIRequiresFullScreen` false y las cuatro orientaciones (leído del Info.plist del binario), más escenas por `plugins/withEscenas.js`. El marco ya reparte por ancho de ventana.

**Por qué no Catalyst.**
- **EAS no lo contempla.** La referencia de `eas.json` solo tiene iOS y Android, en Build y en Submit. El flujo de `ios-testflight.yml` (`eas build --local` y `eas submit`) produce un IPA; un binario de Mac necesitaría otra vía de firma, otro perfil y otra subida, fuera de EAS.
- **Expo no lo soporta como destino.** Su guía de plataformas adicionales dice que solo macOS y tvOS, y el esquema de SDK 54 solo admite `android | ios | web`. El proyecto usa CNG (no hay `ios/` en el repo), así que activar Catalyst sería un config plugin más, sobre el `.xcodeproj` y el Podfile, que se rompería en silencio con cada subida de SDK.
- **Las dependencias.** Casi todo declara solo `:ios` (tabla abajo). RN 0.81 tiene parches de Catalyst en CocoaPods (`mac_catalyst_enabled`), pero que cada pod compile está sin demostrar, y los de mayor riesgo son los que no se pueden perder: `react-native-purchases` con su framework precompilado, `expo-notifications` y `expo-speech-recognition`. No se ha intentado compilar.
- **Coste frente a ganancia.** Catalyst daría menús y ventanas más propias de Mac. A cambio, dos binarios que probar y un riesgo de cruzar OTA entre ellos. El rediseño 1.1 aún no está decidido; no compensa.

| Dependencia real (podspec instalado) | iOS | macOS | tvOS | visionOS |
|---|---|---|---|---|
| `react-native` 0.81.5 | sí | no | no | no |
| `expo-modules-core` 3.0.30 (de ella cuelgan todos los `expo-*`) | sí | sí | sí | **no** |
| `expo-notifications`, `expo-speech`, `expo-image-picker` | sí | no | no | **no** |
| `expo-speech-recognition` 3.1.3 | sí | no | no | **no** |
| `react-native-purchases` 10.16 (`PurchasesHybridCommon` 19.17.0) | sí | no | sí | **no** |
| `reanimated`, `worklets`, `svg`, `gesture-handler`, `async-storage` | sí | sí | sí | sí |
| `react-native-screens` | sí | no | sí | sí |

**Pendiente de medir en un Mac real.** El margen superior de 12 pt y el hueco de 26 pt de controles de ventana (`huecoSuperiorVentana`) se aplican a ciegas: desde JS un Mac es indistinguible de un iPad, y se decide por tamaño. Si la ventana no llena la pantalla sobra aire arriba, nada se rompe. Intro no envía en el Coach con teclado físico (solo en web). Apple añade por su cuenta alternativas de teclado a los gestos táctiles.

**Dos claves que no se añaden todavía:** `UILaunchToFullScreenByDefaultOnMac` y `UISupportsTrueScreenSizeOnMac`. Apple las ofrece para arrancar a pantalla completa y admitir cualquier resolución, pero cambian lo que se ve en un Mac y nadie lo ha probado. Se deciden con la app delante.

## 5. Vision Pro: compatible, no nativo

**Cómo llega.** El mismo binario, como ventana de iPad. Apple lo hace disponible por defecto. Comprobado que instala y arranca sin recompilar.

**Por qué no nativo.**
- `react-native` 0.81.5 no compila para visionOS; hace falta el fork de Callstack, cuya última versión encontrada es la 0.79.6, por debajo de la que usa el proyecto (dato de un agregador; conviene mirarlo en npm).
- `expo-modules-core` no declara visionOS, y arrastra a todos los módulos `expo-*`. Expo no documenta visionOS ni en la guía de plataformas ni en SDK 54.
- `react-native-purchases`, `expo-notifications` y `expo-speech-recognition` solo declaran iOS (y tvOS la tienda). Sin ellas no hay compra, avisos ni dictado.
- Apple reserva lo nativo para quien quiera apariencia del sistema, 3D o experiencias inmersivas. NIVL no necesita ninguna.

**Lo que Apple avisa y cómo queda en NIVL.**

| Aviso de Apple | En NIVL |
|---|---|
| No hay cámaras del dispositivo | Con la cámara sin permiso, `hacerFoto` cae a la galería (comprobado). Con permiso concedido, sin probar. |
| Los hápticos pasan a audio | La llamada resuelve (comprobado). Lo que se oye, sin probar. |
| Máximo de dos toques simultáneos | La rueda y las tiras son de un dedo. |
| Avisos y voz: comprobar autorización y disponibilidad | Voz disponible por `isRecognitionAvailable` (comprobado). Avisos, sin comprobar. |
| App en ventana, apariencia de iPad | Barra lateral a 1194. |

Los `Pressable` de RN no son `UIControl`, así que probablemente no se iluminan con la mirada (sin comprobar: falta entrada en el simulador). Es la limitación más probable para usarla cómodamente, y solo se arregla con un binario nativo que hoy no es viable.

## 6. iPhone Duo e iPad

**Cómo llega.** Binario universal. El Duo no tiene `UIUserInterfaceIdiom` propio: para el código es un iPhone con cualquier combinación de clases de tamaño. Por eso `responsive.ts` decide por ancho de ventana y nunca por modelo, que es lo que Apple pide (usar el espacio disponible, y no tomar «regular» por iPad). La única lectura de `Platform.isPad` está en `useHuecoControlesVentana`, para los controles de ventana.

RN toma el ancho de `RCTDeviceInfo` desde `RCTKeyWindow().bounds`, la ventana, que es correcto en el Duo. El `screen` de ese mismo módulo sale de `UIScreen.mainScreen`, que Apple considera ambiguo con dos pantallas, pero NIVL solo lo usa dentro de la rama de iPad.

**El SDK manda.** Lo que dice Apple:

| Compilado con | Duo abierto | Duo plegado |
|---|---|---|
| iOS 26 o anterior | Ventana centrada con espacio vacío alrededor, proporción de iPhone | A la izquierda de la barra de estado y la cámara |
| iOS 27 | Llena casi todo, sin invadir la barra de estado a la derecha | |
| iOS 27.1 o superior | Borde a borde, con barras en vertical bajo la barra de estado | Borde a borde |

**Dónde está NIVL.** `ios-testflight.yml` corre en `macos-15` con `latest-stable`. La imagen pública de ese runner (24/08/2026) llega como mucho a Xcode 26.3, que cumple el mínimo de Apple (Xcode 26 desde el 28/04/2026) pero da el SDK 26: **fila 1 de la tabla**. No se ha leído el log de un run real para confirmar la versión exacta.

**Qué haría falta para la fila 3.**
1. Xcode 27.1 o superior, que exige macOS Tahoe 26.6. `macos-15` queda descartado; `macos-26` tampoco lo traía instalado en su imagen del 26/10/2026 (solo como vista previa anunciada). O bien `eas build --local` desde un Mac con Xcode 27, sin gastar cupo.
2. Expo solo documenta Xcode 27 desde SDK 58 y SDK 54 no consta. Lo que sí hay es una prueba propia: el binario Debug de simulador compila y corre con Xcode 27.2 gracias a `withEscenas.js`, sin el cual la app muere al arrancar. Falta un Release de dispositivo.
3. Antes de publicar con 27.1, comprobar el Duo abierto (Apple avisa de las barras verticales; la barra de NIVL es propia, no se adapta sola).

Hay presión de calendario: Apple no ha anunciado un mínimo de SDK 27 en su página de requisitos a esta fecha, pero una guía de terceros habla de abril de 2027 y el patrón es anual. Choca con el techo de SDK 54 de `AGENTS.md`, y conviene decidirlo con tiempo.

**Orientación.** `orientation: portrait` se queda para el iPhone. Según el Tech Talk de Apple, la pantalla exterior respeta las orientaciones declaradas y la interior no. El marco ya va por tamaño, así que no hace falta tocarla.

**Clases de tamaño que aplica NIVL** (`src/design/tokens.ts`, `responsive.ts`), por ancho de ventana en pt:

| Ancho | Clase | Navegación | Margen / máximo |
|---|---|---|---|
| menos de 600 | `compact` | barra inferior | 20 / 560 |
| 600 a 719 | `medium` | barra inferior (el raíl no compensa) | 32 / 640 |
| 720 a 1023 | `medium` | raíl de 72 | 32 / 640 |
| 1024 o más | `expanded` | barra lateral de 240 | 48 / 720 |

Dentro de la pantalla manda el **hueco** (ventana menos navegación), no la ventana: dos paneles desde 640 y escala de texto hasta 1,35; panel lateral de 320 solo si cabe.

| Dispositivo | Ventana | Clase de ventana | Navegación | Dos paneles |
|---|---|---|---|---|
| iPhone | hasta 430 | compact | barra inferior | no |
| Duo plegado | 466 | compact | barra inferior | no |
| Duo abierto, SDK 27.1 | 669 | medium | barra inferior | sí (mitades) |
| iPad mini vertical | 744 | medium | raíl | sí (hueco 672) |
| iPad Pro 13 vertical | 1032 | expanded | barra lateral | sí (hueco 792) |
| Vision Pro por defecto | 1194 | expanded | barra lateral | sí |
| iPad Pro 13 apaisado | 1376 | expanded | barra lateral | sí |

Las clases de Apple son otra escala: el interior del Duo es regular en horizontal y en vertical, y en NIVL cae en `medium`. No hay contradicción, porque NIVL no lee los rasgos de UIKit.

## 7. Web

**Cómo llega.** `expo export --platform web` con `web.output: single`: un `index.html` y un SPA, con la reescritura de todas las rutas que pide la documentación de Expo (`scripts/web/vercel.json`). No se usa `static`: la app va tras sesión y con `noindex`, y prerrenderizar no aporta. Despliegue, seguridad y pasos de producción, en `docs/web/APP-WEB.md`. **`app.nivl.app` sigue en preview**, a la espera del OK de producción. La web no usa OTA: se despliega aparte.

**Qué degrada** (tabla completa en `docs/web/APP-WEB.md` §1). Ninguna función debe dejar un botón mudo.

| Función nativa | En web |
|---|---|
| Compras | «Planes» de solo lectura, sin cobrar nada |
| Push y avisos programados | No hay. Aviso en pantalla y notificación del navegador al acabar un bloque de FOCUS |
| Hápticos, interruptor de vibraciones | No hay, y el interruptor no se pinta |
| Cámara y galería | Selector del navegador, rehecho a JPG sin metadatos (`elegirFoto`). Expo no aplica `quality` ni `exif` en web, de ahí el lienzo |
| Compartir texto | Hoja del navegador, o se copia y se avisa |
| Tarjeta de compartir | html2canvas; a la hoja si admite archivos, si no se descarga |
| Dictado | Web Speech API donde exista; si no, `disponibleDictado()` da false. El camino sin API no se ha visto en un navegador real sin ella |
| Pulsación larga | Clic derecho o tecla de menú |
| Clave propia del Oráculo | No se ofrece |

**Motores.**

| Navegador | Motor | Estado | Cómo se llegó |
|---|---|---|---|
| Chrome | Blink | Verificado | Google Chrome instalado y Chromium 1194, build de producción |
| Edge | Blink | Inferido | Es Chromium; no instalado, no ejecutado |
| Safari en Mac | WebKit | Aproximado | WebKit 26 de Playwright, no Safari real |
| Safari en iPhone y iPad | WebKit | No verificado | Sin teclado virtual, 100dvh ni safe areas |
| Firefox | Gecko | No verificado | 0 combinaciones; no arranca en este macOS |

Detalle que puede morder en navegadores antiguos: cancelar el selector de archivos depende del evento `cancel` del input (Chrome y Edge 113+, Firefox 91+, Safari 16.4+). Antes de eso el botón se queda en carga.

Otro, en Safari de iPhone y iPad: para que la página no se amplíe al enfocar un campo, `public/index.html` fija todos los campos a 16 px, también los de cifra grande (importes). Solo afecta a esos navegadores y está sin ver en uno real.

## 8. `app.json`, binario y OTA

**No se cambia nada en esta fase.** Revisado clave por clave:

| Clave | Estado | Motivo |
|---|---|---|
| `ios.supportsTablet: true` | Se queda | Es lo que hace la app universal. Sin ella no hay iPad, y en Mac sería una app de iPhone de ventana fija. |
| `UIRequiresFullScreen: false` y orientaciones `~ipad` | Se quedan | Expo las escribe solas con `supportsTablet` (`RequiresFullScreen.js`); en `app.json` son redundantes pero inocuas. Apple ha deprecado la clave en favor de quitarla (TN3192); con valor false no bloquea nada. |
| `orientation: portrait` | Se queda | §6. |
| `web.output: single` | Se queda | §7. |
| `runtimeVersion: appVersion` | Se queda | Regla de `AGENTS.md`. |
| Claves de Mac | No se añaden | §4. |

**Un cambio nativo pide binario, y ya hay uno en camino.** Respecto a `release/1.0.11`, esta rama trae `./plugins/withEscenas.js`, que cambia el Info.plist y el AppDelegate. Eso no viaja por OTA. Consecuencias:
- El resto del trabajo adaptativo es JS y puede salir por OTA a binarios 1.0.11, y el mismo paquete llega a iPhone, iPad, Mac y Vision. Antes, la verificación mínima de `AGENTS.md`.
- Las escenas solo llegan con un binario nuevo. Como `runtimeVersion` va por `appVersion`, si ya hay un 1.0.11 en la calle ese binario debe subir `version`, y las OTA se publican entonces para la versión nueva. Hoy `app.json` sigue en 1.0.11 y no se toca hasta que se decida ese binario.
- Un binario con el SDK 26 (el de CI hoy) no mejora el Duo abierto (§6). Además, las escenas solo se han probado con el SDK 27.2: que `withEscenas.js` compile y arranque con Xcode 26 en CI está sin comprobar, y conviene mirarlo en el primer TestFlight.

## 9. Fuentes (consultadas el 08/11/2026)

**Apple**
- iOS en Mac: https://developer.apple.com/documentation/apple-silicon/running-your-ios-apps-in-macos
- visionOS compatible: https://developer.apple.com/documentation/visionos/determining-whether-to-bring-your-app-to-visionos
- Preparar para iPhone Duo: https://developer.apple.com/iphone-duo/prepare/
- Tech Talk: https://developer.apple.com/videos/play/tech-talks/111461/
- Resumen del laboratorio del Duo (foro; se contradice en la orientación del interior, manda el Tech Talk): https://developer.apple.com/forums/thread/847644
- Requisitos: https://developer.apple.com/news/upcoming-requirements/
- Requisitos de Xcode: https://developer.apple.com/xcode/system-requirements
- TN3192, conocida por el título y citas de terceros, sin leer entera: https://developer.apple.com/documentation/technotes/tn3192-Migrating-your-app-from-the-deprecated-UIRequiresFullScreen-key

**Expo**
- Configuración (sirve v58): https://docs.expo.dev/versions/v54.0.0/config/app/
- SDK 54: https://expo.dev/changelog/sdk-54
- Plataformas adicionales: https://docs.expo.dev/modules/additional-platform-support/
- `eas.json`: https://docs.expo.dev/eas/json/
- Web: https://docs.expo.dev/guides/publishing-websites/
- Xcode 27: https://expo.dev/blog/xcode-27-device-hub-expo-device-hub
- `expo-image-picker`: https://docs.expo.dev/versions/v54.0.0/sdk/imagepicker/

**Otras**
- Imágenes de GitHub Actions: https://github.com/actions/runner-images (`images/macos/macos-15-Readme.md`, `macos-26-arm64-Readme.md`)
- Fork de visionOS (agregador, a contrastar): https://packages.ecosyste.ms/registries/npmjs.org/packages/@callstack%2Freact-native-visionos
- Plazo de SDK 27 (terceros, no es de Apple): https://useffect.sh/en/xcode-27-app-store-requirement

**Del propio repo:** `node_modules` (podspec, `@expo/config-types`, `@expo/config-plugins`), Info.plist del binario de prueba, `.github/workflows/ios-testflight.yml`, y los informes del arnés de la QA adaptativa.

## Android (1.1)

Escrito el 09/11/2026 sobre la integración 1.1. Compilado en este Mac con Android SDK 36 y NDK 27.1, y ejecutado en un emulador Pixel 7 (Android 16, arm64) contra Supabase simulado con cuentas ficticias. **Ningún dispositivo físico, ninguna firma real y ninguna compra.**

| Punto | Estado | Evidencia |
|---|---|---|
| AAB de release, cuatro arquitecturas | **Compila**: 72 MB, Gradle correcto | `bundleRelease` local, sin copias manuales. Firmado con la clave de depuración: la firma real la pone EAS |
| Nativos nuevos (`expo-calendar`, `react-native-maps`, `expo-keep-awake`) | **Compilan** | La misma compilación |
| P11, servicios en primer plano | **Confirmado en el manifiesto fusionado**: ningún permiso `FOREGROUND_SERVICE*` ni servicio con `foregroundServiceType` | `bundletool dump manifest` |
| P12, `SYSTEM_ALERT_WINDOW` y almacenamiento | **Confirmado**: sin `SYSTEM_ALERT_WINDOW`; lectura hasta API 32 y escritura hasta API 28 | Igual. No se bloquean del todo: `expo-image-picker` pide escritura para la cámara por debajo de Android 10 |
| Ubicación, salud, alarmas exactas, `READ_MEDIA_*`, `AD_ID` | Ausentes | `scripts/ci/comprobar-aab.mjs` sobre el AAB |
| `targetSdk` y 16 KB | 36; `zipalign -P 16` correcto en el APK universal | `bundletool` y `zipalign` |
| Ónix, onboarding completo, Hoy, Coach, Hábitos | **Visto en el emulador** | Maestro hasta el plan de 90 días, a mano el resto |
| Rueda de modos, IRON, WORK; FOCUS elegido en la rueda | **Visto**, salvo FOUNDER | Pulsación larga y toque |
| Oferta y mundo cerrado sin clave de RevenueCat | **Visto**: precios en solo lectura y «no disponibles» | Sin la clave no hay venta (PLAT-03) |

**Tres arreglos que solo aparecieron al ejecutarlo:**
- **Teclado.** Con `targetSdk` 36 la app va de borde a borde y `adjustResize` ya no encoge la ventana: el teclado tapaba el botón de continuar del onboarding y el campo del Coach. `src/components/ui/HuecoTecladoAndroid.tsx` deja un hueco en la raíz, solo en Android, y `TabBar` se oculta con el teclado abierto. Visto en onboarding, login, Coach y hojas.
- **`reanimated` no enlazaba.** Busca `libworklets.so` en una carpeta que AGP 8.11 no rellena: la compilación moría en ninja. `plugins/withAndroidWorkletsPublicado.js` la publica ahí. Solo actúa al compilar en local: en CI la copia rompía el enlace («undefined symbol: worklets::…», run 42701320246) y la 1.0.11 había compilado allí sin ella.
- **Permisos y servicios** (P11 y P12), arriba.

**El flujo del AAB** (`.github/workflows/android-play.yml`) falla si el AAB no está firmado, usa la clave de depuración, no llega a `targetSdk` 36, declara permisos prohibidos o conserva servicios con `foregroundServiceType`. Avisa si falta `EXPO_PUBLIC_RC_ANDROID_KEY`.

**Sin verificar:** el run real en Linux y la firma de EAS, Google Play Billing, push (FCM), cámara, dictado y calendario reales, Android antiguo (minSdk 24), tablets y plegables Android.

**Detalles anotados, sin arreglar:** en el mundo cerrado el botón Atrás del sistema no hace nada, aunque está «Volver a NIVL»; el Coach sin pagar sigue hablando de «NIVL Pro» aunque el cobro ya es por modos.

**Para producción (cuenta personal):** 12 testers inscritos 14 días seguidos en la prueba cerrada, y después la revisión de Google. Última constancia en las notas internas, del 07/11/2026: la prueba cerrada existe y hay **0 de 12**. No se ha podido abrir Play Console para confirmarlo, así que lo que pide hoy la consola está sin verificar. Según la documentación preparada faltan: ficha, Data safety, clasificación, productos, `EXPO_PUBLIC_RC_ANDROID_KEY` en EAS y la huella SHA-256 de Play en `assetlinks.json`.
