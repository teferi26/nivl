# Matriz de plataformas: NIVL 1.1.0

Fecha: 9 de noviembre de 2026. Base: commit `cc95408` (rama `claude/tienda-1-1-b4864e`), con `app.json` en 1.1.0.

**Cómo se ha comprobado.** Código del repo, más `expo prebuild` real para iOS y Android en una copia desechable (no queda nada en el repo), API pública de GitHub Actions sin credenciales y páginas oficiales leídas hoy. No se ha compilado ningún binario, ni se ha entrado en App Store Connect, Google Play, RevenueCat o EAS. Lo que depende de esas cuentas va como **sin verificar**.

Los archivos de normas que se pidió leer (`normas-apple.md`, `normas-google.md`) no existían en el scratchpad. Las medidas de este documento salen directamente de las páginas oficiales enlazadas en «Fuentes».

## Lo que hay que saber antes de nada

1. **El binario 1.1 no ha compilado todavía.** El run [42538054025](https://github.com/teferi26/nivl/actions/runs/42538054025) (commit `dae3887`), el que cita `docs/rediseno-1.1/INFORME-INTEGRACION.md:34` como «build lanzado», **falló en el preflight** (paso «Backend tests») y el trabajo `build` se saltó. El run siguiente, [42592144091](https://github.com/teferi26/nivl/actions/runs/42592144091) sobre `7940dc2`, pasó el preflight y **falló al firmar**. Detalle en «Estado del run», al final.
2. **El Watch va dentro del IPA y sus credenciales ya han tumbado el build entero, iPhone incluido.** Ver «Apple Watch».
3. **Android no tiene GPS, HealthKit, reloj ni permiso de ubicación.** La ficha de Google no puede prometerlos, y Google no pide vídeo de ubicación en segundo plano.
4. **Las gafas Meta no son publicables y el módulo no entra en ningún binario.**

## Matriz

| Plataforma | ¿Se publica en 1.1? | Cómo se da de alta | Capturas y vídeo que exige hoy | Estado real de prueba |
|---|---|---|---|---|
| **iPhone** | **Sí**, cuando haya run verde, credenciales y prueba física | Nada nuevo: versión 1.1.0 en el registro existente (`ascAppId` 6801825007, `eas.json:62`). Pasos abajo | **Obligatoria:** al menos una de Dynamic Island medio, 1206x2622 o 1179x2556. Recomendada: 1320x2868. De 1 a 10 por tamaño. App Preview opcional, 886x1920 | **Simulador**, Debug, Xcode 27.2, contra servidor falso (`INFORME-INTEGRACION.md:48-53`). Release, compra real, correo real, IA real: nada (`:59`) |
| **iPad** | **Sí, sin opción**: `supportsTablet: true` (`app.json:13`) y `TARGETED_DEVICE_FAMILY = "1,2"` en el prebuild | Mismo binario y misma versión | **Obligatoria:** 2064x2752 (o 2048x2732). App Preview opcional, 1200x1600 | **Simulador solo sobre 1.0.11**, rama adaptativa (`docs/DISPOSITIVOS.md:27`). Con la 1.1 Ónix: nada (`INFORME-INTEGRACION.md:59`). Físico: nada |
| **Mac** (Designed for iPad) | **Condicional.** Solo si el dueño lo prueba en un Mac; si no, se desmarca | Sin binario ni alta. Casilla en Precio y disponibilidad. Sin Catalyst | Sin capturas propias: la tabla oficial las pide «para apps de Mac» y no aclara las de iPad (**sin verificar**) | **Nada** en un Mac real. Solo se vio que Xcode ofrece el destino (`DISPOSITIVOS.md:28`) |
| **Apple Watch** | **Condicional**: si se crean identificadores y perfiles, hay capturas y se prueba con reloj real. Va dentro del IPA | Sin registro aparte. Tres pasos en Apple Developer y credenciales en EAS. Abajo | **Obligatorias al llevar reloj:** un solo tamaño en todas las localizaciones: 422x514, 410x502, 416x496, 396x484, 368x448 o 312x390. Sin App Preview | **Simulador**, modo demo y una sesión real de `HKWorkoutSession` (`docs/APPLE_WATCH.md:60-68`). En la 1.1 arranca y sigue vivo con Hoy vacío (`INFORME:57`). Entrega reloj a iPhone: **nada**, exige reloj real |
| **Apple TV** | **No.** Faltan piezas que impiden subirla y la ruta del iPhone | Proyecto aparte (`tv/`). Pasos abajo | Si algún día: 3840x2160 o 1920x1080. App Preview opcional, 1920x1080 | **Simulador** y servidor local (`tv/README.md:78`). Dentro del binario 1.1: nada. Apple TV físico: nada |
| **iPhone Duo** | **Corre, sin ficha propia.** Con SDK 26 va en modo compatible | Sin alta: es la plataforma iOS | No obligatorias: lo serán desde abril de 2027 para apps con SDK iOS 27.1 o superior. Exterior 1398x2034, interior 2007x2853. **No subirlas** en 1.1 (motivo abajo) | **Simulador, solo portada** (`INFORME:57`). Pantalla interior: nada, `simctl` no lo despliega |
| **Vision Pro** (compatible) | **Condicional**, igual que Mac | Sin binario. Casilla en Precio y disponibilidad. Nativo no viable con SDK 54 | Sin capturas propias: reutiliza metadatos (**sin verificar** en la tabla oficial, ver `specs.mjs`) | **Simulador sobre 1.0.11**: instala y arranca (`DISPOSITIVOS.md:29`). 1.1 y físico: nada |
| **Android** (teléfono) | **Sí, a prueba cerrada**; a producción si la cuenta cumple 12 testers durante 14 días | AAB a mano en Play Console. Sección propia abajo | Mínimo 2 capturas, hasta 8 por tipo; lados entre 320 y 3840; lado largo no mayor que el doble del corto; recomendado 1080x1920. Icono 512x512, gráfico 1024x500 | **Nada en 1.1** (`INFORME:59`). Prebuild real hoy: correcto. AAB de 1.0.11 sí compiló el 08/11 |
| **Web** | **Landing sí; app web no** | `nivl.app` vive en el repo privado `nivl-web`. La app web del repo está en preview | No aplica | Chrome y WebKit de Playwright con Supabase simulado (`DISPOSITIVOS.md:30-31`, `INFORME:46`). `app.nivl.app` responde 404 hoy |
| **Gafas Meta** | **No publicables por ahora** | No hay alta posible | No aplica | Solo Mock Device Kit en simulador (`docs/GAFAS-META.md:345-355`) |

Wear OS y Android TV: **no**. El manifiesto no declara nada de ninguna de las dos y no hay proyecto para ellas.

Reglas comunes de capturas de Apple: PNG o JPEG sin alfa, de 1 a 10 por tamaño. App Preview: 15 a 30 s, 500 MB como máximo, hasta 3 por tamaño e idioma, H.264 de 10 a 12 Mbps hasta High 4.0, 30 fps, AAC 256 kbps estéreo.

## Xcode y SDK

| | Dato | Evidencia |
|---|---|---|
| Runner | `macos-15`, Xcode `latest-stable` | `.github/workflows/ios-testflight.yml:58,84-86` |
| Versión real en CI | **Xcode 26.3.0 (17C529)**, medida hoy | Log del job 129077398885, paso `setup-xcode` |
| Requisito vigente | Xcode 26 y SDK 26 o superior desde el 28/04/2026; iOS 13 como mínimo de despliegue desde el 09/09/2026 | [Upcoming requirements](https://developer.apple.com/news/upcoming-requirements/) |
| ¿Lo cumple? | **Sí.** El binario apunta a iOS 15.1 | Prebuild: `IPHONEOS_DEPLOYMENT_TARGET = 15.1` |
| Próximo requisito | Desde abril de 2027: SDK 27 en todas las plataformas e iOS 15 o superior | [Submitting](https://developer.apple.com/app-store/submitting/) |
| Versiones hoy | Xcode 27.2 estable, **27.3 en beta**, sin candidata anunciada. Xcode 27 exige macOS Tahoe 26.6: `macos-15` no llega | [System requirements](https://developer.apple.com/xcode/system-requirements/) |

**Riesgo real.** `plugins/withEscenas.js` y los targets de reloj solo se han compilado con Xcode 27.2 en simulador (`DISPOSITIVOS.md:199`, `APPLE_WATCH.md:60`). Con Xcode 26.3 en Release nunca: el run de hoy murió antes de llegar a `xcodebuild`, así que sigue sin probarse. No usar la 27.3 beta para tienda.

## iPhone: alta

1. Run verde de `ios-testflight.yml`, con credenciales al día (ver Watch).
2. Instalar desde TestFlight en un iPhone físico y hacer la prueba y el vídeo (`CAPTURAS.md`).
3. App Store Connect: versión 1.1.0, elegir el build, capturas, notas, etiquetas de privacidad nuevas (salud y ubicación) y suscripciones.

El dueño envía a revisión. Ningún agente.

## iPad

Comprobado en el prebuild: `UIRequiresFullScreen` false, cuatro orientaciones en `~ipad`, retrato en iPhone y `UIApplicationSceneManifest` de una sola escena. El marco reparte por ancho de ventana. No hay nada que marcar. Falta **ver la 1.1 Ónix en un iPad**: la app se revisa también ahí y el informe lo da como no verificado.

## Mac: Designed for iPad, sin Catalyst

Es el mismo IPA. Catalyst queda descartado (`DISPOSITIVOS.md:61-65`). Qué hacer:

1. App Store Connect, la app, **Precio y disponibilidad**: mirar si está marcada «Make this app available on Mac». No se ha podido ver.
2. Instalar el build de TestFlight en un Mac con Apple Silicon y probar ventana, compra sandbox, avisos, dictado y enlaces.
3. **Recomendación:** si esa prueba no se hace antes de publicar, **desmarcar la casilla** y volver a marcarla después. El ajuste es reversible y vale para todas las versiones. Publicar en Mac sin haberla abierto nunca en uno no compensa: HealthKit, GPS en segundo plano y reloj no aplican igual allí, y `huecoSuperiorVentana` se aplica a ciegas (`DISPOSITIVOS.md:77`).

Vision Pro: mismo razonamiento y misma casilla, «Make this app available on Apple Vision Pro».

## Apple Watch: alta y firma

**Qué sale del prebuild real.** El target `NIVL` embebe `NivlReloj.app` («Embed Watch Content») y `NivlReloj` embebe `NivlComplicacion.appex`. Bundles `com.teferi.nivl.watchkitapp` y `com.teferi.nivl.watchkitapp.complicacion`, watchOS 11.0, `WKCompanionAppBundleIdentifier = com.teferi.nivl`. El plugin deja los dos targets en `extra.eas.build.experimental.ios.appExtensions`, que es lo que lee EAS para firmarlos. Es decir: **el flujo `eas build --local` sí intenta firmar los targets, y necesita un perfil para cada uno.**

**Lo que eso exige** (sin verificar si ya está hecho, depende de cuentas):

1. **Apple Developer, Identifiers:**
   - App ID explícito `com.teferi.nivl.watchkitapp`: capacidades **HealthKit** y **App Groups**.
   - App ID explícito `com.teferi.nivl.watchkitapp.complicacion`: **App Groups**.
   - App Group `group.com.teferi.nivl`, asignado a esos dos.
   - En `com.teferi.nivl`: activar **HealthKit** (`app.json:41`).
2. **EAS, perfiles nuevos.** EAS tiene una clave de App Store Connect y con ella registra bundles y crea perfiles aunque el build sea `--non-interactive`. El log de hoy lo demuestra: dio de alta `com.teferi.nivl.watchkitapp.complicacion` y **falló al activar App Groups** con un error del API de Apple sobre el formato de la petición («not a valid request document»). Es decir, ese identificador ya existe en la cuenta y esa capacidad, no. Salida, por este orden: activar las capacidades a mano en el portal (punto 1) y volver a lanzar con `EXPO_NO_CAPABILITY_SYNC=1` en el paso «Compilar» de `ios-testflight.yml` (lo propone el propio mensaje de EAS). Alternativa o complemento: subir `eas-cli`, fijado en 21.2.0 (`ios-testflight.yml:90`) cuando hay 27.5.0. Sin el sync, HealthKit en `com.teferi.nivl` ya no se activa solo: el perfil tiene que regenerarse después de marcarlo (`npx eas-cli credentials --platform ios`).
3. **`ios.appleTeamId` falta en `app.json`.** El prebuild avisa de que los builds pueden fallar. Es una línea, y `docs/APPLE_WATCH.md:26` ya la pide.
4. **App Store Connect:** sin alta aparte. La sección de reloj aparece al asociar un build que lo lleve, y pide capturas. Etiquetas de privacidad y notas sobre `UIBackgroundModes: location`.

**Pendiente del producto:**

- **Fuentes Cinzel residuales**, contra la regla Ónix: `targets/watch/Estilo.swift:24,29`, `targets/watch/Info.plist:9-10`, `targets/watch-complicacion/NivlComplicacion.swift:90,103,125` y `Info.plist:14`. Colores en «Mármol y tinta». `INFORME:79` lo deja pendiente. Va en binario, así que o entra ahora o espera al siguiente.
- `fijarAlmacenEntrenos` ya está enchufado (`src/app/_layout.tsx:142`): esa condición de `APPLE_WATCH.md:45` está cumplida.
- Solo en español (`APPLE_WATCH.md:32`).
- **Prueba con reloj real:** `transferFile`, buzón del iPhone y acuse. El simulador no llama al delegado (`APPLE_WATCH.md:66`).

**Cada intento gasta un número de build** (hoy, de 37 a 38), aunque muera antes de compilar. No es grave, pero el número en TestFlight saltará.

**Si no da tiempo:** la salida es sacar `@bacons/apple-targets` del binario y dejar el reloj para la 1.1.1. Es un cambio de `app.json` y una decisión del dueño, no se ha hecho.

## Apple TV: por qué no va en la 1.1

**Es un proyecto aparte** (`tv/NIVLTV.xcodeproj`, SwiftUI, tvOS 17, bundle `com.teferi.nivl.tv`). No puede ir en el binario: tvOS es otra compilación, y RN exigiría el fork `react-native-tvos` (`tv/README.md:39`). El CI no lo cubre: se archiva a mano en Xcode (`tv/PORTAL_APPLE.md:80-81`).

**Falta, comprobado en el código:**

- `src/app/tv/[codigo].tsx` **no existe**. El QR `nivl://tv/XXXX-XXXX` cae en `+not-found`. Antes de copiar la plantilla hacen falta dos piezas de seguridad que no están: «Televisores enlazados» en Perfil y aviso a la cuenta (`tv/integracion/INSTRUCCIONES.md:18-21`).
- Sin icono en capas: `Assets.xcassets` solo trae `AccentColor`. Sin Top Shelf (2320x720 y 4640x1440). La validación de subida fallará.
- `MARKETING_VERSION = 0.1.0` (`project.pbxproj:364,388`).
- Sigue con Cinzel y «Mármol y tinta» (`tv/NIVLTV/Diseno/Tema.swift`).
- `https://nivl.app/tv/CODIGO` da 404: no hay alternativa web al iPhone. Riesgo de guidelines 4.2.3 y 2.4.3 (`PORTAL_APPLE.md:73`).

**Para darla de alta en el mismo registro** (camino B de `PORTAL_APPLE.md`):

1. Cambiar `PRODUCT_BUNDLE_IDENTIFIER` a `com.teferi.nivl` (`project.pbxproj:365,389`): la compra universal exige mismo bundle, Apple ID y SKU. Elegir equipo.
2. App Store Connect, la app, **añadir plataforma tvOS**. Se copian metadatos salvo texto promocional, descripción y capturas.
3. Icono, Top Shelf, versión, `Servidor.local.xcconfig` y archivar en Xcode 26 o superior.
4. Ruta del iPhone, con sus dos requisitos, por OTA tras el binario 1.1.
5. Vídeo del enlace con iPhone y TV y cuenta de prueba en las notas.

**Compra universal:** se activa cuando App Review aprueba dos plataformas y **después no se puede retirar una sola**. `PORTAL_APPLE.md:19` recomienda el registro propio (`com.teferi.nivl.tv`) porque la TV no vende nada. Esa recomendación sigue siendo razonable. Decide el dueño, y es casi irreversible en los dos sentidos.

## iPhone Duo

Es el plegable de Apple: pantalla exterior e interior, sin idiom propio (`DISPOSITIVOS.md:105`). Con SDK 26, lo previsible de CI, abierto se ve en ventana centrada con proporción de iPhone (`DISPOSITIVOS.md:111-117`). Para verlo bien hacen falta Xcode 27.1 o superior y una máquina con Tahoe 26.6.

**No subir capturas de Duo en la 1.1.** Dan la insignia de la ficha, y enseñarían algo optimizado que este binario no entrega, además de que la interior no se puede capturar y el vídeo sale de otro simulador (`scripts/tienda/objetivos/duo.mjs:1-7`). Solo se ha visto la portada en la 1.1.

## Web

| | |
|---|---|
| `nivl.app` | Landing, repo privado `nivl-web`. Responde. Su AASA solo cubre `/c/*`. |
| App web de este repo | `web.output: single`, destino `app.nivl.app`. **Hoy 404**, `DEPLOYMENT_NOT_FOUND`. Sigue en preview a la espera de OK (`docs/web/APP-WEB.md`). |
| Pagos | Sin pagos: `/pro` en web es «Planes» de solo lectura (`src/components/web/PlanesWeb.tsx:3-8`). Stripe no existe en iOS ni Android aunque el interruptor esté mal puesto (`src/lib/storepolicy.ts`). |
| Pega de copy | «Planes» dice que se contrata en la app de iPhone: con Android publicado queda corto. |

## Gafas Meta: no publicables por ahora

**Por qué.** Meta documenta que no admite publicar en App Store con su SDK y que ExternalAccessory provocará el rechazo. No hay calendario, y las funciones experimentales no pueden ir en producción sin permiso escrito (`docs/GAFAS-META.md:18-23,67,221-222`). En Google Play no hay veto expreso, pero los envíos de Meta no están abiertos (`:224-225`). Además, obligaría a subir toda la app a iOS 17.2, y Display no se vende en España.

**¿Entra en un binario? No. Comprobado:**

- `modules/nivl-meta` no tiene `expo-module.config.json`; solo `expo-module.config.interno.json`.
- `expo-modules-autolinking search`, apple y android: lista `nivl-salud` y `nivl-watch` en Apple, y ninguno `nivl-*` en Android. Nunca `nivl-meta`.
- Ninguna ruta de `src/` lo importa.
- Info.plist del prebuild: sin `MWDAT`, `UISupportedExternalAccessoryProtocols`, Bluetooth ni red local. `UIBackgroundModes` es solo `location`.

No hay hallazgo 2.3.1 por este lado.

## Android: AAB y comandos

### Qué se ha comprobado

| Punto | Resultado | Evidencia |
|---|---|---|
| `expo prebuild --platform android --no-install` | **Correcto** en copia desechable | Hoy |
| `eas.json` | `app-bundle`, `autoIncrement`, `appVersionSource: remote`, Node 22.14.0, canal y entorno production | `eas.json:4,45-55` |
| `eas-cli config` | **Pide login: sin verificar** | Hoy |
| targetSdk | 36, compileSdk 36, minSdk 24, AGP 8.11, Gradle 8.14.3, NDK 27.1 | `node_modules/react-native/gradle/libs.versions.toml:3-9`; prebuild |
| Requisito de Google | API 36 para altas y actualizaciones desde el 31/08/2026. **Lo cumple** | [Target SDK](https://developer.android.com/google/play/requirements/target-sdk) |
| 16 KB | RN, expo-modules-core, reanimated y worklets pasan la bandera de páginas flexibles; `useLegacyPackaging=false`. Sin AAB no se puede medir. **Sin verificar.** Google lo exige para actualizaciones desde el 01/02/2027 | [Page sizes](https://developer.android.com/guide/practices/page-sizes) |
| `nivl-salud`, `nivl-watch` | Sin `android/` y `platforms: ["apple"]`: no se enlazan. El JS los trata como ausentes (`saludNativa.ts:85`, `puente.ts:51`) | Autolinking hoy |
| `nivl-meta` | Fuera | Autolinking hoy |
| `expo-speech-recognition` | `RECORD_AUDIO` y `queries`. Enlaza | Prebuild |
| `react-native-maps` | Se enlaza y **no necesita clave**: en Android nunca se pinta `MapView`, sale el SVG (`moduloMapas.ts`, `RutaMapa.tsx:97`) | Código |
| GPS y Salud | Solo iOS: `useCardio.ts:256`, `puro.ts:26`. **Sin permisos de ubicación** en el manifiesto | Prebuild |
| `EXPO_PUBLIC_RC_ANDROID_KEY` en EAS | **No aparece.** Los logs listan `EXPO_PUBLIC_RC_IOS_KEY`, `EXPO_PUBLIC_SUPABASE_KEY` y `EXPO_PUBLIC_SUPABASE_URL`, y ninguna más. Sin ella `purchasesAvailable()` da false y **el AAB saldrá con la tienda cerrada** (`pro.ts:209`). Solo no se ve una variable de visibilidad «secret» | Log del AAB 1.0.11 (run 42479127095) y del iOS de hoy |
| Keystore y contador en EAS | Credenciales remotas correctas y `versionCode` de 11 a 12 en el último AAB (08/11, 70 MB) | Log del run 42479127095 |
| Productos en Google Play | **Sin verificar** | |
| Nativos nuevos desde 1.0.11 | `expo-calendar`, `react-native-maps`, `expo-keep-awake`: Gradle aún no los ha compilado | |

**Preflight.** Es el mismo `ci.yml`: falló en `dae3887` y **pasó entero en `7940dc2`** (run 42592144091, typecheck, tests, lint y los dos pasos de backend). Ese commit no está en esta rama, cuyo `cc95408` lleva todavía los dos tests rotos: lanzar el AAB desde `7940dc2` o posterior.

### Permisos que declarará y que conviene revisar

`INTERNET`, `POST_NOTIFICATIONS`, `READ_CALENDAR`, `WRITE_CALENDAR`, `RECORD_AUDIO`, `VIBRATE`, `CAMERA` (la añade `expo-image-picker`), `READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE` y **`SYSTEM_ALERT_WINDOW`**. Este último viene de la plantilla y la app no lo usa: mejor añadirlo a `blockedPermissions` (`app.json:76`). El manifiesto fusionado solo se ve con el AAB: `bundletool dump manifest --bundle=nivl.aab`.

### Enlaces

`https://nivl.app/.well-known/assetlinks.json` tiene hoy la huella `PENDIENTE_SHA256_FINGERPRINT`. Con `autoVerify` en `/c/`, los enlaces de creador **no se verificarán** y abrirán el navegador. Hay que poner el SHA-256 de la firma de Google Play, en `nivl-web`.

### Comandos (no lanzados)

**GitHub Actions**, cualquiera de los dos:

```bash
# A mano. El archivo ya está en la rama por defecto (feat/coach).
gh workflow run android-play.yml --repo teferi26/nivl --ref claude/integracion-1-1-90cd1f

# O por push a una rama android/**.
git push origin 7940dc2:refs/heads/android/1.1.0
```

Exige: secreto `EXPO_TOKEN`, preflight verde y runner `ubuntu-24.04` (90 min). Consume: ningún crédito de build de EAS (es `--local`), minutos de Actions gratis por ser repo público, y **un `versionCode`** del contador remoto. No publica nada en Google Play: no hay cuenta de servicio y `eas submit` no sirve aquí. El push a `android/**` lo lanza solo: es una acción sobre el repo.

**El artefacto `nivl-aab` queda 3 días y lo puede bajar cualquiera con cuenta de GitHub** (repo público, `android-play.yml:127-132`). Lleva lo mismo que recibe un tester: JS y claves públicas `EXPO_PUBLIC_*`, sin la clave de firma. Se baja con `gh run download <run-id> --repo teferi26/nivl --name nivl-aab`.

**Local:**

```bash
eas build --platform android --profile production --local --non-interactive --output nivl.aab
```

Exige: `eas-cli` 21.2.0 o compatible, sesión de Expo o `EXPO_TOKEN`, Java 17, Android SDK y NDK 27.1, Node 22.14.0 y memoria para Gradle (`android-play.yml:67-72`). Consume: un `versionCode` remoto y ningún crédito. No publica nada. Deja el AAB en el directorio actual: `.gitignore` no lo cubre, así que no debe subirse al repo.

**Después, comprobar 16 KB** antes de subirlo:

```bash
bundletool dump config --bundle=nivl.aab | grep alignment
bundletool build-apks --bundle=nivl.aab --output=nivl.apks --mode=universal
unzip -o nivl.apks universal.apk
zipalign -c -P 16 -v 4 universal.apk
```

**Play Console**, a mano y por el dueño: prueba cerrada, subir AAB, ficha, Data safety y productos. Las cuentas personales creadas tras el 13/11/2023 necesitan 12 testers durante 14 días seguidos antes de pedir producción ([ayuda](https://support.google.com/googleplay/android-developer/answer/14151465)). Cómo va ese contador: sin verificar.

## Estado del run

Leído el 09/11/2026 a las 09:22 UTC.

| Run | Commit | Preflight | Build iOS |
|---|---|---|---|
| 42538054025 | `dae3887` | **Falló** en «Backend tests» | Saltado |
| 42592144091 | `7940dc2` | **Pasó** | **Falló** en «Compilar», a los 16 s, en la firma: App Groups de la complicación |

No hay IPA de la 1.1 ni nada en TestFlight por estos dos runs. Lo que sí queda hecho fuera del repo como efecto del run: el identificador de la complicación registrado en Apple y el contador de build en 38. `onboarding-qa` seguía en marcha a esa hora.

## Fuentes (leídas el 09/11/2026)

- [Capturas, Apple](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/)
- [App Preview, Apple](https://developer.apple.com/help/app-store-connect/reference/app-information/app-preview-specifications/)
- [Requisitos próximos, Apple](https://developer.apple.com/news/upcoming-requirements/) y [envío](https://developer.apple.com/app-store/submitting/)
- [Requisitos de Xcode](https://developer.apple.com/xcode/system-requirements/)
- [Recursos gráficos, Google Play](https://support.google.com/googleplay/android-developer/answer/9866151)
- [Target SDK](https://developer.android.com/google/play/requirements/target-sdk), [16 KB](https://developer.android.com/guide/practices/page-sizes)
- [Ubicación en segundo plano, Google Play](https://support.google.com/googleplay/android-developer/answer/9799150)
- Del repo: `docs/tienda/PLATAFORMAS.md`, `docs/tienda/TUBERIA.md`, `docs/DISPOSITIVOS.md`, `docs/APPLE_WATCH.md`, `docs/GAFAS-META.md`, `tv/PORTAL_APPLE.md`
