# Matriz de dispositivos · NIVL 1.0.7

Redactado el 02/10/2026 por el subagente (b) Google Play/Android del Chat 1 · Tiendas. Base: `winter/chat1-tiendas` @ `bf32d28`.
Regla: **NO PROBADO** salvo que haya una prueba real registrada en el repo o en `privado/`. Una prueba en simulador, en Expo Go o un `expo export` **no acredita** un dispositivo físico (COORDINACION.md:67,73).

## Configuración que manda

| Parámetro | Valor | Evidencia |
|---|---|---|
| Orientación | `portrait` | `app.json:6` |
| iPad nativo | **No** (`supportsTablet: false`) | `app.json:13` |
| iOS mínimo | 15.1 | Expo SDK 54 (https://docs.expo.dev/versions/v54.0.0/, 02/10/2026); build 18 en ASC: `minOsVersion "15.1"` (`privado/asc-chat1-readonly-20261002.json:119`) |
| Mac / visionOS | ASC calcula `computedMinMacOsVersion "12.0"` y `computedMinVisionOsVersion "1.0"` para la build 18 | `privado/asc-chat1-readonly-20261002.json:121-122`: Apple la considera instalable en Mac con Apple silicon y en Vision Pro como app de iPhone |
| Android minSdk / targetSdk | 24 (Android 7.0) / 36 (Android 16) | Expo SDK 54 (misma fuente); sin `expo-build-properties` |
| Android en pantallas grandes | Con target 36, en `sw ≥ 600dp` se **ignora** `portrait` y la app ocupa toda la ventana | https://developer.android.com/about/versions/16/behavior-changes-16 (02/10/2026) |
| Android edge-to-edge | Obligatorio con target 36 | misma fuente |
| Web | `web.output: "single"` (`app.json:52-53`). El export web se completó el 01/10/2026 (COORDINACION.md:87), pero **no hay ninguna app web desplegada**. `nivl-web.vercel.app` es una web estática (landing, /privacidad, /soporte, /terminos, /c) | `nivl-web/` |

## Evidencia de pruebas existente (toda insuficiente para dar PASS en físico)

- Simulador de iPhone 16 Pro Max con iOS 18.5 (Release, datos ficticios): `privado/health-native-qa-20260927.md:9`. Es un **simulador** y no cuenta como dispositivo.
- Capturas de App Store sacadas de un build de simulador iOS: `privado/appstore-capturas-1.0.7/README.md`.
- Grabación con interfaz de iPhone y una sesión real (`coordinacion-winter-arc/VIDEO-REVISION.md:11`): **no constan el modelo, el sistema operativo ni la build**, así que no acredita el candidato. Apple exige un dispositivo físico con el último sistema (`00-apple-rechazo-literal.md`).
- Android: hubo 8 builds de EAS en septiembre (`privado/estado-1.0.7-verificado.md:86`), pero **no hay ningún registro de prueba en un Android físico**.

## Matriz

| Fila | Soporte configurado | Qué significa | Estado de prueba | ¿Necesario para el lanzamiento? |
|---|---|---|---|---|
| **iPhone pequeño** (SE 2.ª/3.ª gen, 4,7", o iPhone 13 mini) con iOS 15.1-último | iPhone, portrait, iOS ≥ 15.1 | Nativo optimizado (es el objetivo de diseño) | NO PROBADO | **Sí (P0)**: es el peor caso de altura. Revisar teclado (`QuestForm`), pies fijos de `ProOffer` y textos en Cinzel |
| **iPhone grande** (Pro Max / Plus) con el último iOS | Igual | Nativo optimizado | NO PROBADO en físico (solo simulador 16 Pro Max con iOS 18.5) | **Sí (P0)**: Apple exige el vídeo en un dispositivo físico con el último sistema |
| **iOS mínimo** (un dispositivo con 15.x) | `minOsVersion 15.1` | Nativo | NO PROBADO | P1: si no se puede probar, asumir el riesgo y documentarlo |
| **iPad** | `supportsTablet: false`: la app se instala en iPad en **modo de compatibilidad de iPhone** (ventana de iPhone escalada, en vertical) | Compatibilidad, **no** nativo | NO PROBADO | **Sí (P1)**: Apple puede revisar en iPad las apps solo para iPhone. Comprobar que arranca, que el login, el pago y el borrado funcionan y que nada se corta |
| **Mac con Apple silicon** («Designed for iPhone») | No hay opción de excluirlo en el binario; ASC lo calcula como instalable (macOS ≥ 12.0) | Compatibilidad sin optimizar: ventana de iPhone, sin cámara trasera ni hápticos, notificaciones distintas | NO PROBADO | **No**. Ver la PROPUESTA M |
| **Apple Vision Pro** (app de iPhone) | Calculado por ASC (visionOS ≥ 1.0) | Compatibilidad sin optimizar | NO PROBADO | **No**. Ver la PROPUESTA M |
| **Android de gama media** (p. ej. Galaxy A1x/A3x o Redmi Note, 4-6 GB) con el Android más reciente disponible (≥ 15/16) | minSdk 24 / target 36, portrait | Nativo | NO PROBADO | **Sí (P0)** para Play: rendimiento con Reanimated, edge-to-edge y barra de gestos, teclado (`KeyboardAvoidingView` sin `behavior` en Android, `docs/auditoria/15-design-system.md:209`), notificación de las 21:30 con `SCHEDULE_EXACT_ALARM` denegado por defecto en Android 14+ |
| **Android mínimo** (7.0-8.x, API 24-26) | minSdk 24 | Nativo, en teoría | NO PROBADO | P1: al menos un emulador con API 24 (no acredita físico). Si no se puede probar, valorar subir minSdk (PROPUESTA A2) |
| **Tablet Android** (sw ≥ 600dp) | Play la distribuye por defecto. Con target 36, `portrait` **se ignora** y la app se puede girar a apaisado o estirarse | Compatibilidad **forzada por el sistema**, no optimizado | NO PROBADO | P1. Ver la PROPUESTA A1 |
| **Plegable** (tipo Galaxy Z Fold: cerrado < 600dp y abierto ≥ 600dp) | Cerrado: teléfono en portrait. Abierto: igual que la tablet (sin restricción de orientación). Cambio de configuración al plegar o desplegar | Compatibilidad | NO PROBADO | P2: comprobar que no se pierde estado al plegar o desplegar (formularios, coach) |
| **Web, escritorio** (Chrome, Edge, Firefox, Safari macOS) | Solo la web estática `nivl-web.vercel.app`. La app Expo web **no está publicada** | Web responsive (landing y páginas legales); la app **no está soportada** en web | NO PROBADO (las URL legales responden 200 a curl el 02/10/2026, lo que no es una prueba visual) | **Sí, para las páginas legales, /soporte, la futura /borrar-cuenta y /c** (Apple y Google las enlazan). La app web no es necesaria |
| **Web, móvil** (Safari iOS, Chrome Android) | Igual | Web responsive de las páginas estáticas; `/c/:code` es el destino de los enlaces de invitación cuando no se abre la app | NO PROBADO | **Sí** para las páginas legales y `/c` |

## Qué no se debe prometer

- **No** decir «disponible para iPad» ni «optimizada para tablet» en las fichas, en las capturas ni en las notas de revisión. En Play, no subir capturas de tablet.
- **No** decir «app de Mac» ni «versión web» de la app. La web pública es informativa y legal.

## PROPUESTAS (las decide el coordinador con el usuario; no aplicadas)

**PROPUESTA I · iPad.** Mantener `supportsTablet: false` en 1.0.7: activarlo obligaría a hacer capturas de iPad y una revisión de diseño de tablet. En las notas de revisión de Apple, decirlo de forma explícita: «NIVL is designed for iPhone. On iPad it runs in iPhone compatibility mode; it has been checked on iPad [modelo/iPadOS] for launch, login, purchase and account deletion». **Solo** se escribe si esa comprobación se hace de verdad. Si no se hace, dejar la frase sin la parte de «checked on…».

**PROPUESTA M · Mac y Vision Pro.** En App Store Connect → Precios y disponibilidad → «Apps de iPhone y iPad en Mac con Apple silicon», **desmarcar la disponibilidad en Mac** mientras no se pruebe (cámara, notificaciones, compras en macOS). Lo mismo en «Apple Vision Pro». Es un cambio de consola que solo puede hacer el usuario y no requiere una build nueva. La disponibilidad actual en Mac de `privado/asc-availability-applied.json` es una disponibilidad por territorio (`MAC` = Macao), **no** se refiere a la plataforma Mac. No hay que confundirlas.

**PROPUESTA A1 · Tablets y plegables Android en el lanzamiento.** Hay dos opciones:
1. Probar en una tablet o plegable y aceptar la compatibilidad (la app se estira y gira). Opción recomendada si hay un dispositivo disponible.
2. Para el lanzamiento, excluir las tablets en Play Console → Catálogo de dispositivos (filtrar por formato o pantalla) hasta validar el diseño en pantallas grandes. La exclusión temporal por manifiesto (`PROPERTY_COMPAT_ALLOW_RESTRICTED_RESIZABILITY`) necesitaría un *config plugin* y **caduca con target 37**, así que no compensa.

**PROPUESTA A2 · minSdk.** Si no se puede probar Android 7-8, valorar subir minSdk a 26-28 con `expo-build-properties` (`android.minSdkVersion`). Es un cambio de `app.json` y de dependencias, así que lo decide el coordinador. La cuota de Android 7-8 es residual, pero el cambio también reduce la superficie que no se ha probado.

## Lista mínima de pruebas físicas para dar el lanzamiento por bueno

1. iPhone físico con el último iOS (P0, Apple): flujo completo y vídeo (login, borrado, UGC con denuncia y bloqueo, compra con título, duración, precio y enlaces legales).
2. iPhone pequeño (P0): teclado, pies fijos, textos.
3. Android físico de gama media con Android 15/16 (P0, Play): instalación desde la pista interna, login, notificaciones, cámara y galería, compra con *license tester*, borrado de cuenta, denuncia de respuesta de IA (cuando exista).
4. iPad en modo de compatibilidad (P1).
5. Páginas legales en Safari iOS y Chrome Android (P0, solo visual).
6. Tablet o plegable Android (P1/P2), según la PROPUESTA A1.

Cada prueba se registra con modelo, versión del sistema operativo, build (versionCode/buildNumber), fecha, quién la hizo y resultado PASS/FAIL.
