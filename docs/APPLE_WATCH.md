# NIVL en el Apple Watch

App acompañante en SwiftUI (watchOS 11 o superior) más una complicación de WidgetKit. El iPhone es la fuente de verdad: el reloj pinta lo que el teléfono le manda y solo **pide** cosas. Las reglas que pagan (XP, penalización, día cambiado, `propagarActo`) siguen en `src/lib/engine.ts`.

## Piezas

| Pieza | Dónde | Qué hace |
|---|---|---|
| Contrato | `src/watch/contrato.ts` (puro, con tests) | Tipos del estado del día y de las peticiones del reloj, y cómo se calculan desde Hoy, FOCUS e IRON. Su copia en Swift: `targets/watch/Contrato.swift`. Si tocas uno, toca el otro. |
| Puente JS | `src/watch/puente.ts` | Junta las partes que publican Hoy (`useHoy`), FOCUS (`usePomodoro`) e IRON (`useGym`) y las manda al reloj. Atiende lo que pide el reloj. Sin módulo nativo (Expo Go, web, Android) es un no-op. |
| Módulo nativo | `modules/nivl-watch` (Expo Modules API, Swift) | WatchConnectivity en el iPhone: `actualizarContexto`, cola de peticiones, `responder`. Lo enlaza el autolinking. |
| App del reloj | `targets/watch` (`@bacons/apple-targets`, tipo `watch`) | Cuatro páginas: Hoy, Racha y rango, FOCUS, Descanso IRON. Caché en el App Group para verse sin conexión. |
| Complicación | `targets/watch-complicacion` (tipo `watch-widget`) | Racha (circular, esquina, en línea) y misiones pendientes (rectangular). Lee el resumen que guarda la app del reloj. |

La carpeta de la complicación tiene que ordenarse **después** de `watch` (el plugin procesa los targets por orden alfabético y la extensión se embebe en la app del reloj que ya exista). Por eso se llama `watch-complicacion`.

## Cómo viajan los datos

- **iPhone → reloj**: `updateApplicationContext` con `{ estado: JSON }` (el último gana, llega aunque el reloj esté dormido). Se manda agrupado cada 400 ms y solo si cambia algo.
- **Reloj → iPhone**: `sendMessage` con `{ peticion: JSON }` si el iPhone está alcanzable (con respuesta `{ ok, premio | motivo }`); si no, `transferUserInfo` (en cola, sin respuesta: se aplica cuando JS la atiende).
- Peticiones: `completar` (id y fecha), `focus` (`empezar`, `pausar`, `parar`), `estado` (reenviar lo último).
- «Hecha» desde el reloj pasa por el mismo camino que «Completar» en `CompletarSheet`: el cerrojo por misión de Hoy y `finishQuest(quest, null)`. Antes, `motivoParaNoCompletar` rechaza lo que la muñeca no puede hacer (día cambiado, foto obligatoria, recuperación cerrada, ya hecha o guardándose).

## Lo que falta para producción (fuera de este frente)

1. **Firma y entrega**: dos bundles nuevos (`com.teferi.nivl.watchkitapp` y `com.teferi.nivl.watchkitapp.complicacion`) con el App Group `group.com.teferi.nivl`. Hay que darlos de alta en el portal de Apple, añadir `ios.appleTeamId` en `app.json` y revisar las credenciales de EAS para los targets nuevos. Es binario nuevo (no OTA).
2. **Peticiones con la app del iPhone cerrada**: el iPhone guarda la petición y la atiende cuando JS se apunta (al montar Hoy o FOCUS). Si el reloj pide en directo y el iPhone no tiene JS cargado, a los 8 s responde «Abre NIVL en el iPhone» y el reloj la deja en cola.
3. **Completar sin el iPhone** (opción b del plan): leer la sesión de Supabase desde un keychain compartido y llamar a una RPC nueva que haga en el servidor las validaciones que hoy hace `completeQuest` en el cliente. Es migración y despliegue: queda planificado, no hecho.
4. **FOCUS**: el reloj sigue y manda en el pomodoro del iPhone solo con FOCUS montado. Sin él, cuenta en el reloj como cronómetro que no registra sesión ni paga.
5. **IRON**: el reloj enseña la serie que toca y cuenta el descanso; las series se siguen apuntando en el iPhone. El descanso sale de las repeticiones (`descansoSugerido`, doctrina de `knowledge.ts`) porque la prescripción no guarda descanso.
6. **Ejecución extendida**: `WKBackgroundModes = mindfulness` (una sola clase por app). Se usa para FOCUS y para el descanso; si App Review lo discute para el gimnasio, la alternativa es un `HKWorkoutSession` (pide HealthKit y su revisión).
7. **Idioma**: la app del reloj está solo en español en la v1.

## Probarlo

```bash
export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer
npx expo prebuild -p ios --clean
# Solo el reloj (no necesita pods):
xcodebuild -project ios/NIVL.xcodeproj -target NivlReloj -configuration Debug -sdk watchsimulator CODE_SIGNING_ALLOWED=NO build
# Con datos de ejemplo, sin iPhone ni servidor (interruptor de demo):
xcrun simctl launch <udid-del-reloj> com.teferi.nivl.watchkitapp -nivlDemo YES [-nivlPagina racha|focus|descanso] [-nivlMision demo-1]
```

La app entera para el simulador de iPhone (embebe el reloj): `xcodebuild -workspace ios/NIVL.xcworkspace -scheme NIVL -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO IPHONEOS_DEPLOYMENT_TARGET=15.1 build`. Sin `-sdk iphonesimulator`: forzar el SDK compila también los targets del reloj contra iOS y fallan.
