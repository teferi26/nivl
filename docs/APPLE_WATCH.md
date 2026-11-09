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
6. **Temporizadores (FOCUS y descanso)**: no usan ejecución extendida ni el modo `mindfulness` (guideline 2.5.4). Guardan cuándo acaban; con la muñeca bajada avisa una notificación local programada para ese instante, y sin permiso de notificaciones no hay aviso hasta abrir la app. Con la app delante o con un entreno en marcha vibra el propio reloj. Si se quiere vibración garantizada en el gimnasio, el camino es abrir un `HKWorkoutSession` de fuerza.
7. **Idioma**: la app del reloj está solo en español en la v1.

## Medición real (HealthKit, entrenos y GPS)

| Pieza | Dónde | Qué hace |
|---|---|---|
| Entreno en el reloj | `targets/watch/ServicioEntreno.swift`, `EntrenoPuro.swift`, `Vista*Entren*.swift` | `HKWorkoutSession` + `HKLiveWorkoutBuilder` para carrera, bici, piscina, aguas abiertas y fuerza. Ruta GPS, parciales, largos, auto-pausa propia y recuperación tras un cierre. |
| Sin iPhone | `targets/watch/BuzonEntrenos.swift` | El entreno queda en disco en el reloj y viaja con `transferFile` cuando puede. Se borra solo cuando el iPhone confirma. |
| iPhone | `modules/nivl-salud` | Permisos de HealthKit por categoría, resumen diario, importación con ancla y GPS en segundo plano. `EntrenoPuro.swift` es copia exacta del reloj (lo comprueba un test). |
| Recepción | `modules/nivl-watch`, `src/watch/puente.ts`, `src/lib/medicion/buzon.ts` | Buzón nativo, normalizado y duplicados entre orígenes (`fusion.ts`). |
| Contraste | `src/lib/medicion/contraste.ts`, `src/components/medicion/SelloMedicion.tsx` | `medido`, `coherente` o `sin_datos`. Informativo: no cambia XP ni racha. Con `sin_datos` no se pinta nada, para que quien no tiene reloj no vea una marca. |
| Servidor | migraciones `0110` (`salud_diaria`, `salud_preferencias`) y `0111` (activar la medición) | Sin aplicar. Enviar datos al coach es un interruptor aparte, apagado por defecto. |

**Quién paga.** `guardarEntrenoMedido` (`src/lib/resistencia.ts`, de IRON) guarda, deduplica y paga. La medición no llama a `propagarActo` ni a `awardXp`. Mientras no se enchufe con `fijarAlmacenEntrenos` en `src/lib/medicion/almacen.ts`, todo se retiene y no se paga nada: no publicar sin ese paso.

Reglas pactadas con nivl-game-balancer: solo paga lo de hoy (fecha local de `fin`), mínimo 5 minutos, mismos topes que el cardio a mano, nada de fuerza ni de `otro`. Propuesto a IRON y pendiente de confirmar: un entreno de Salud se guarda con 0 XP hasta que la persona lo confirme.

**En `ruta` y `fc_serie`, `t` son segundos en movimiento** desde `inicio`, el mismo reloj que `duracion_s`.

### Qué solo se puede validar con un reloj real

- Frecuencia cardiaca, calorías y distancia del builder: el simulador las inventa o no las da.
- Natación: largos (se cuenta un largo por evento `.lap`, sin confirmar con datos reales), brazadas, bloqueo de agua y GPS en aguas abiertas al emerger.
- Auto-pausa con movimiento de verdad y GPS con árboles o edificios.
- GPS del iPhone con la pantalla apagada durante una sesión larga.
- Recuperación tras un cierre (`handleActiveWorkoutRecovery`) y que la ruta aparezca en Salud sin duplicar puntos.
- Entrega de `transferFile` al iPhone y entrenos hechos sin iPhone que se sincronizan después.

### Qué se ha comprobado en simulador (8 nov, iOS y watchOS 27.2)

- Compila el binario completo con los módulos nativos, y la app abre en iOS 27 con `withEscenas`.
- El diálogo real de permisos de Salud sale en el reloj.
- Interfaz del reloj en 40, 42, 44, 46 y 49 mm en modo demo.
- **Sesión real en el reloj** (`HKWorkoutSession` + `HKLiveWorkoutBuilder`, con permisos de Salud y ubicación aceptados a mano y ruta simulada con `simctl location`): 47 s, 128 m por GPS, 29 puntos de ruta, 8 muestras de pulso (sintéticas del simulador), guardada con UUID de `HKWorkout`. El JSON pasa `normalizarEntreno` sin rechazos.
- `transferFile` termina sin error y el JSON llega al simulador del iPhone, **pero Apple documenta que el simulador no llama a `session(_:didReceive:)`**. El buzón nativo del iPhone, el drenado desde JS y el acuse al reloj solo se pueden validar con un iPhone y un reloj reales. Es la primera prueba que hay que hacer con hardware.
- Sin probar en simulador: el GPS solo con iPhone y la pantalla de conexión con Salud, porque piden iniciar sesión y aceptar el permiso de salud con una cuenta de prueba.
- Importación de Salud sin datos reales: en iOS 27 el diálogo de Salud pregunta cuánto historial compartir, así que lo anterior a lo elegido puede no llegar.

Para repetir la sesión: `xcrun simctl location <reloj> start --speed=3 --interval=1 <puntos>` y lanzar con `-nivlAuto carrera -nivlAutoSegundos 45` (solo DEBUG). Con `-nivlBuzonPrueba YES`, solo el envío del reloj.

### Lista de salida 1.1 (P5, P6, P9, CON-16, PLAT-07)

- P5: `PrivacyInfo.xcprivacy` en reloj (UserDefaults y marcas de fecha de ficheros) y complicación (App Group). Se confirma al subir: sin aviso ITMS-91053.
- P6: solo `NSLocationWhenInUseUsageDescription`, y el permiso que se pide es «al usarse». Se confirma con una carrera real y el indicador azul.
- P9: sin `mindfulness`. Con reloj real hay que comprobar que la notificación llega con la muñeca bajada.
- CON-16: `Demo.swift` solo existe en DEBUG. Las capturas de reloj de la tienda deben salir de un build Debug.
- PLAT-07: Ónix (fondo #09090B, botón #EDEAE3, oro #C9A961 y Playfair) en app y complicación. Las complicaciones reales cogen el tinte de la esfera; se ven en un reloj real.

### Qué hay que dar de alta en Apple

1. Capability **HealthKit** en `com.teferi.nivl` y `com.teferi.nivl.watchkitapp`, y regenerar los perfiles de EAS.
2. Los bundles y el App Group de la lista de arriba, e `ios.appleTeamId` en `app.json`.
3. En App Store Connect: etiquetas de privacidad de salud y ubicación, URL de política que mencione HealthKit, y justificar `UIBackgroundModes: location` en las notas de revisión.
4. Apple no permite usar datos de HealthKit para publicidad ni venderlos. Enviarlos a un proveedor de IA requiere el consentimiento expreso que ya pide el interruptor del coach.

Antes de publicar: aplicar `0110` y `0111` antes de que salga el binario. La `0111` **no** sube la versión del permiso de salud: nadie vuelve a aceptarlo y la 1.0.11 sigue igual.

**Activar la medición (0111).** HealthKit, GPS y reloj están apagados hasta que la persona los activa, con su aceptación antigua o sin ella. La primera vez que conecta Salud o abre el GPS se le explica qué se lee y para qué (`ExplicacionMedicion`), además del permiso del sistema, y `activar_medicion()` lo deja en `health_consents` con la versión `2026-11-09-medicion-v1`. Hasta entonces no se toca HealthKit, el buzón no corre y lo del reloj espera en su buzón nativo (Hoy avisa con una tarjeta). Las políticas de `salud_diaria` y `entrenos_medidos` lo exigen también en el servidor; apuntar a mano no. Retirar el permiso de salud obliga a activar de nuevo. El permiso de IA va aparte. Prueba: `scripts/test-medicion-permiso.mjs`.

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

Ojo (QA, 7 nov): compilada en local con el SDK de iOS 27, la app del iPhone se cierra nada más abrirse en los simuladores iOS 27.2 (`_UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption`: iOS 27 exige el ciclo de vida UIScene y el AppDelegate de Expo no lo adopta). No es de este frente (pasa igual sin el reloj), pero impide probar de punta a punta iPhone + reloj en local: el reloj solo se ha visto en modo demo y en «sin datos». Las capturas del QA están en red-de-clips/cuentas/_estilos_nivl/recursos_app/dispositivos/watch/.
