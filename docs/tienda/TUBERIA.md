# Tubería de capturas y vídeos de tienda

Un comando saca, a partir de un commit, las capturas y los vídeos de la ficha. La app se captura con un arnés de datos ficticios (`scripts/tienda/harness/`): sin cuenta y sin red, con un bundle id aparte (`com.teferi.nivl.screenshots`) y sobre una copia temporal del commit. No toca `src/` ni el binario de producción, y no sube nada a App Store Connect.

Estado a 2026-11-08, probado contra el commit 47d2546 (versión 1.0.11).

## Comando

```bash
node scripts/tienda/tienda.mjs --commit <sha> [--muestra] [--objetivos a,b] [--sin-video] [--final] [--fuente-tv <sha>] [--fuente-watch <sha>]
```

También vale `npm run tienda -- --commit <sha> ...`. Código de salida: 0 correcto, 1 algo falló o no cumple, 2 error de uso.

| Opción | Efecto |
|---|---|
| `--commit` | Obligatoria. Sha o referencia de git. |
| `--muestra` | Solo las escenas Hoy y Coach (una en reloj, tres en TV), con vídeos si no se pide lo contrario. |
| `--objetivos` | Lista por id de objetivo o de salida: `iphone-69`, `iphone-63`, `ipad-13`, `duo`, `vision`, `mac`, `web`, `apple-tv`, `watch`. |
| `--sin-video` | Omite preview y vídeo largo. |
| `--final` | Exige todos los objetivos y vídeos. Es lo único que deja `final: true` en el informe, requisito de `asc.mjs` para subir. No admite `--muestra`, `--objetivos` ni `--sin-video`. |
| `--fuente-tv`, `--fuente-watch` | Commit de donde sale la app de tvOS o de reloj cuando el commit pedido aún no la trae. También con `NIVL_FUENTE_TV` y `NIVL_FUENTE_WATCH`. |

## Qué produce

Todo en `.tienda/` (gitignorado). Caché en `.tienda/cache/`.

```
.tienda/salida/<sha7>/
  crudas/<objetivo>/NN-escena.png     captura tal como sale del simulador o de Chrome
  tienda/<objetivo>/NN-escena.png     con titular y marco, al tamaño exacto de Apple
  videos/<objetivo>/preview.mp4       App Preview
  videos/<objetivo>/largo.mp4         gira de unos 58 s para web o redes; no se sube
  informe.json                        versión, simuladores, avisos, pendientes y sha256 de cada archivo
  asc-plan.json                       lo escribe asc.mjs
```

El reloj añade una subcarpeta por clase: `tienda/watch/<clase>/NN-escena.png`.

## Cómo reproducir la muestra

Fuera del sandbox de agentes, porque `simctl`, `xcodebuild` y Chrome sin cabeza no funcionan dentro.

```bash
node scripts/tienda/tienda.mjs --commit HEAD --muestra --fuente-tv d3ef098 --fuente-watch bf46158
node scripts/tienda/validar.mjs .tienda/salida/<sha7>/tienda/iphone-69 --objetivo iphone-69
node scripts/tienda/asc.mjs --commit <sha7>
node --test scripts/tienda/__tests__/
```

`asc.mjs` exige un sha, no acepta `HEAD`. Sin `--aplicar` solo escribe el plan y no contacta con Apple.

Duración de la tanda de muestra completa con la app ya en caché y el Mac muy cargado: unos 20 minutos. Compilar desde cero añade `npm ci`, `pod install` y `xcodebuild`.

## Requisitos del Mac

- Xcode 27.2 con los runtimes de simulador iOS 27.2, iOS 27.2 para iPhone Duo, tvOS 27.2, watchOS 27.2 y visionOS 27.2. Probado con 12 núcleos y 32 GB.
- Node 22 o posterior (probado con 26.13), CocoaPods y ffmpeg con libx264.
- Google Chrome instalado, para componer y para web y Mac. `NIVL_CHROME` cambia la ruta.
- Unos 6 GB libres para `.tienda/`.
- Maestro y Java no hacen falta. Tampoco cuenta, red de la app ni claves: el arnés elimina del entorno `EXPO_PUBLIC_*`, `EXPO_TOKEN` y `NIVL_SHOTS_*`.
- Solo crea simuladores con nombre `nivl-capturas-<algo>-<pid>` y solo borra los de su pid, también si la matan con una señal.

## Estado de cada objetivo

Resultado de la última tanda de muestra (2 escenas), validada con `validar.mjs`: todas las imágenes de `tienda/` al tamaño exacto y sin alfa, previews en H.264 High nivel 4.0, 30 fps, unos 10,96 Mbps, AAC estéreo 48 kHz a 240 kbps, 28 s.

| Objetivo | Tamaño | Vídeo | Fuente | Estado | Límites conocidos |
|---|---|---|---|---|---|
| `iphone-69` | 1320x2868 | preview 886x1920 y largo | App real con arnés | Correcto | Dentro de Coach, Perfil y Hábitos la barra marca Hoy. |
| `iphone-63` | 1206x2622 | preview 886x1920 y largo | App real con arnés | Correcto | Igual que `iphone-69`. `asc.mjs` sube solo la preview de `iphone-69` porque caen en el mismo tipo. |
| `ipad-13` | 2064x2752 | preview 1200x1600 y largo | App real con arnés | Correcto | La barra de estado pinta el día real en español, así que cambia con la fecha de ejecución. Se ve el asa de redimensionar de iPadOS. |
| `iphone-duo-exterior` | 1398x2034 | preview 886x1920 y largo, grabados en iPhone 17 Pro Max | App real con arnés | Correcto con reservas | La app corre en modo compatible, con una franja del sistema a la derecha. El vídeo no sale del simulador de Duo. La API de subida no tiene tipo para Duo: va a mano. |
| `iphone-duo-interior` | 2007x2853 | No | Ninguna | **Sin capturar** | El simulador arranca plegado, la pantalla interior sale negra y `simctl` no puede desplegarlo. Queda en `pendientes` del informe y hace fallar `--final`. |
| `vision-pro` | 3840x2160 | No: 3840x2160 no cabe en H.264 nivel 4.0, haría falta ProRes | App de iPad en el simulador de visionOS | No se sube | Es una ventana de iPad dentro del salón simulado de Apple. No hay objetivo visionOS: `asc.mjs` lo deja en `sinDestino` y Vision Pro usa las capturas de iPad. |
| `mac` | 2880x1800 | No | Web en escritorio | Material web, no se sube | No es una app nativa de Mac: `asc.mjs` lo deja en `sinDestino` y un Mac con Apple silicon usa las capturas de iPad. Hay defectos del escritorio web pendientes de la rama adaptativa (barra «Tu puesto» sobre el duelo en Arena, cabecera sin margen). |
| `web` | 2880x1800 | No | Web en escritorio | Correcto, sin reglas de Apple | Mismos defectos que `mac`. No pasa por `validar.mjs` porque no hay reglas que aplicar. |
| `apple-tv` | 3840x2160 | No | App SwiftUI desde `--fuente-tv` | Solo con fuente | Sin `--fuente-tv` se salta con su motivo, porque 47d2546 no trae `tv/`. La app es un prototipo sin icono de tienda. En la compuesta, el marco corta el botón SERIE HECHA. |
| `watch` | Ultra 4 422x514 en muestra; Series 12, Ultra 2, Series 9 y SE 3 sin `--muestra` | No lo admite Apple | App SwiftUI desde `--fuente-watch` | Solo con fuente | Sin fuente se salta con su motivo. No se puede fijar la hora. Series 3 no existe en watchOS 27.2. La tanda sin `--muestra` lleva de 7 a 8 minutos por clase. |

## Lo que falta antes de las capturas finales

- **`--final` no se ha ejecutado** y hoy saldría con 1 por `iphone-duo-interior`, y por TV y reloj si no se pasan las fuentes. Hay que decidir cómo aceptar esas faltas.
- **Paleta.** La app sale con dorado en iPhone, iPad y web (escudo, barra de nivel, botón Completar, pestaña activa). La regla del proyecto es solo blanco y negro y la ficha actual es monocroma. Viene de la app, no del arnés. Decisión pendiente.
- **Titulares nuevos** de `plantilla/textos.mjs` (todos menos los que ya estaban en la ficha) esperan visto bueno.
- **Las ramas de TV y reloj han avanzado** desde los commits de esta tanda (d3ef098 y bf46158). Antes de la final hay que pasar los commits nuevos, y esos sí compilan desde cero.
- **`asc.mjs` nunca ha hablado con Apple.** El flujo solo está probado con un servidor simulado, las rutas están deprecadas desde la 4.5 de la API y la tabla de resolución a tipo es suposición por nombre. Ver `docs/tienda/PLATAFORMAS.md`.
- Conviene grabar los vídeos finales con el Mac descargado: bajo carga los desplazamientos pueden ir menos fluidos.

## Mapa de archivos

| Archivo | Para qué |
|---|---|
| `scripts/tienda/tienda.mjs` | Orquestador e informe |
| `scripts/tienda/specs.mjs` | Tamaños y reglas de Apple, con lo no verificado marcado |
| `scripts/tienda/validar.mjs` | Comprueba imágenes y vídeos, también por CLI |
| `scripts/tienda/harness/` | Arnés de datos ficticios y control de la app |
| `scripts/tienda/objetivos/` | Un módulo por dispositivo o familia |
| `scripts/tienda/componer.mjs`, `plantilla/` | Diseño comercial: titular, marco y fondo |
| `scripts/tienda/video.mjs` | App Preview y vídeo largo |
| `scripts/tienda/asc.mjs` | Plan de subida; `--aplicar --confirmo-subida` lo lanza una persona |

## Cambiar el diseño comercial

Colores, tipos, nombre de marca y textos están en `scripts/tienda/plantilla/tema.mjs`. Para un rediseño no hace falta tocar la plantilla: se escribe un módulo con solo lo que cambia y se pasa su ruta en `NIVL_TIENDA_TEMA` (el formato está en la cabecera de `tema.mjs`). Los textos por escena de ese módulo tienen preferencia sobre `plantilla/textos.mjs`. La composición (márgenes, marco, arcos) sigue en `plantilla/maquetas.mjs`.

Las pantallas actuales van a cambiar con la 1.1: la tanda de esta rama es una prueba de la tubería y no material para subir.

## Tanda 1.1 (cc95408)

Tema Ónix en `plantilla/tema.mjs` (Playfair Display y Outfit, hilo de oro, sin arcos ni meandro). Escenas de ficha: Hoy, Coach, rueda, IRON, FOCUS, WORK, FOUNDER, Arena, Hábitos y Campañas. Quedan fuera Pro (con la tienda cerrada dice que no está disponible) y Avance (su rejilla de 28 días se pinta rota en la app: `celda` con ancho en % y `aspectRatio` en `AvanceVista.tsx`).

`--final` no exige lo que no se puede capturar y lo escribe en `informe.json` (`noCapturables`): Mac sin app nativa y pantalla interior del Duo. El Duo no graba vídeo: hacerlo en otro iPhone sería presentar otro dispositivo como Duo.
