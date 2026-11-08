# NIVL TV (Apple TV · modo salón)

Esta es una app nativa en SwiftUI para tvOS 17 o superior, con su propio bundle `com.teferi.nivl.tv`. Vive en esta carpeta y **no toca la app de React Native**: no hay dependencias nuevas, el `package-lock.json` sigue igual y la release de iOS no se ve afectada. Lee los datos reales de la cuenta, en **solo lectura**: desde la TV no se escribe ni XP, ni racha, ni ningún registro.

## Qué hace

| Pestaña | Contenido | Mando |
|---|---|---|
| **Entreno** | Entrenamiento de IRON del día: la rutina, el ejercicio con su figura y la técnica, y debajo series × repeticiones × carga prescrita con un reloj enorme. Al acabar el descanso suena un aviso (el mismo sonido que el fin de bloque de FOCUS). | Clic: serie hecha, o saltar el descanso. Play/Pausa: congela el descanso. |
| **Arena** | La tabla de amigos (`friends_board`, ya ordenada por el servidor), con el rango registrado, el laurel de Élite y una ficha del gladiador que tiene el foco. Debajo, tu ludus (`elite_group_board`), sin puestos ni XP. | Arriba y abajo para recorrer la tabla. |
| **Semana** | Racha, piedras, XP ganado, misiones hechas y falladas por día (las falladas en trama), el mapa de 12 semanas y la tendencia de peso con la recta del estudio. | Solo lectura. |
| **Cuenta** | Quién está enlazado, última sincronización, Sincronizar ahora y Cerrar sesión con confirmación. | Arriba y abajo entre los botones. |

## Enlace y sesión

Contrato con el servidor: `CONTRATO.md`. La TV enseña un código y un QR (`nivl://tv/XXXX-XXXX`), la persona confirma en su iPhone y la TV recibe un token opaco. Nada de teclado ni contraseña.

- **Token** en el Llavero: no sincronizable, solo en este aparato, legible tras el primer desbloqueo (`Nucleo/Almacenes.swift`).
- **Caché** del último paquete en Caches, para abrir sin red. Con datos que no son de ahora, un sello arriba a la derecha dice de cuándo son.
- **Solo `sesion_invalida` borra la sesión.** Un fallo de red o un HTTP 5xx nunca. Cerrar sesión borra Llavero y caché en el acto, haya red o no.
- **Lógica pura** en `Nucleo/MaquinaApp.swift` (estados, transiciones, política de sondeo) y `Nucleo/Contrato.swift` (decodificación). `ModeloApp` solo ejecuta los efectos. Sondeo tras recibir la respuesta anterior y parado en segundo plano; refresco cada 5 minutos, como mucho uno por minuto. Las peticiones en vuelo no se cancelan: un canje aprobado no se pierde.

## Configuración del servidor

La URL y la clave pública no entran en el repo. `Config/Servidor.xcconfig` incluye el gitignorado `Config/Servidor.local.xcconfig`:

```bash
cp tv/Config/Servidor.ejemplo.xcconfig tv/Config/Servidor.local.xcconfig   # y rellénalo
```

En un xcconfig `//` empieza un comentario: la URL va como `https:/$()/proyecto.supabase.co`. **Release sin configurar no compila** (fase «Comprobar servidor»). Si un binario llegara a ejecutarse sin configuración, enseña «Servicio no disponible». ATS permite la red local solo en Debug (`Config/Info-Debug.plist`).

El diseño sigue «Mármol y tinta» (`docs/design-v2/SISTEMA.md`): solo blanco y negro, Cinzel para los títulos y las cifras, Outfit para el texto, que se registran en tiempo de ejecución, y radio 0. El foco se marca con **escala ×1,1 y un marco blanco**, nunca con hover. El encargo hablaba de «negro y dorado», pero el repo prohíbe el oro fuera de la rueda de modos (AGENTS.md: «Paleta solo blanco y negro»), así que manda la regla del repo. Los tokens copian `src/design/tokens.ts`, con escala de TV: el texto mínimo de lectura es de 30 pt.

## Por qué SwiftUI aparte y no react-native-tvos

Para tvOS haría falta cambiar `react-native` por el fork `react-native-tvos@0.81.x`. Eso altera todo el árbol y el lockfile, y deja fuera dependencias nativas que no compilan en tvOS (image-picker, speech-recognition, view-shot, screen-capture, notificaciones). Reanimated 4 y worklets son frágiles en tvOS. Por eso no puede ir en `release/1.0.11`. Este prototipo en SwiftUI compila a la primera con Xcode 27.2 y no hereda ninguno de esos riesgos.

## Compilar y probar

```bash
export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer
cd tv
xcodebuild -project NIVLTV.xcodeproj -scheme NIVLTV \
  -destination 'platform=tvOS Simulator,name=Apple TV 4K (4th generation)' \
  -derivedDataPath .build CODE_SIGNING_ALLOWED=NO test
```

Los 65 tests de `NIVLTVTests` cubren la máquina de la sesión de entreno, la curva de nivel copiada de `game.ts`, los formatos, el contrato (`SesionTests.swift`: decodificación, fechas de Postgres, transiciones, formato del código y QR) y que ninguna cadena lleve guion largo.

**Con el simulador hay que firmar ad hoc para que funcione el Llavero.** Con `CODE_SIGNING_ALLOWED=NO` compila y pasan los tests, pero `SecItemAdd` falla y la app se queda en «no ha podido guardar la sesión»:

```bash
xcodebuild ... CODE_SIGN_IDENTITY=- CODE_SIGN_STYLE=Manual build
```

### Demo y servidor local (solo Debug o simulador)

En Release para aparato este camino no se compila. La demo no usa red, Llavero ni caché, y solo se enseña con `-nivlDemo 1`:

```bash
xcrun simctl launch <udid> com.teferi.nivl.tv -nivlDemo 1 -pestana arena     # entreno | arena | semana | cuenta
xcrun simctl launch <udid> com.teferi.nivl.tv -nivlDemo 1 -estado descanso   # descanso | serie | fin
xcrun simctl launch <udid> com.teferi.nivl.tv -nivlServidor http://127.0.0.1:54399 -nivlClave clave-publica-local
```

`herramientas/` tiene un servidor de pruebas con el SQL real de las migraciones sobre PGlite, varias cuentas y órdenes para simular el iPhone y los fallos, y el scheme `NIVLTVPuntaAPunta` hace el camino completo con el mando (`herramientas/README.md`).

## Lo que falta (v2) y por qué no está

1. **Sincronizar con la SesionEnCurso del iPhone** por realtime, para que el clic en la TV marque la serie en el teléfono. Hoy la TV lleva su propio reloj y el registro se sigue haciendo en el iPhone, donde `propagarActo` marca la misión enlazada.
2. **Icono y Top Shelf.** tvOS pide un icono por capas (imagestack) y la imagen de la estantería superior. Sin ellos compila y corre en el simulador, pero no pasa la validación de la tienda.
3. **Entrega.** La firma, el App ID `com.teferi.nivl.tv` y la ficha en App Store Connect los hace el dueño. Aquí no se han tocado ni EAS ni Actions.
