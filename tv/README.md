# NIVL TV (Apple TV · modo salón)

Esta es una app nativa en SwiftUI para tvOS 17 o superior, con su propio bundle `com.teferi.nivl.tv`. Vive en esta carpeta y **no toca la app de React Native**: no hay dependencias nuevas, el `package-lock.json` sigue igual y la release de iOS no se ve afectada. De momento es un **prototipo de solo lectura con datos de demostración** (`NIVLTV/Nucleo/Demo.swift`, con el mismo enfoque que los `demo.tsx`), así que funciona en el simulador sin cuenta y sin servidor.

## Qué hace

| Pestaña | Contenido | Mando |
|---|---|---|
| **Entreno** | Entrenamiento de IRON del día: la rutina, el ejercicio con su figura y la técnica, y debajo series × repeticiones × carga prescrita con un reloj enorme. Al acabar el descanso suena un aviso (el mismo sonido que el fin de bloque de FOCUS). | Clic: serie hecha, o saltar el descanso. Play/Pausa: congela el descanso. |
| **Arena** | La tabla de amigos (`friends_board`, ya ordenada por el servidor), con el rango registrado, el laurel de Élite y una ficha del gladiador que tiene el foco. Debajo, tu ludus (`elite_group_board`), sin puestos ni XP. | Arriba y abajo para recorrer la tabla. |
| **Semana** | Racha, piedras, XP ganado, misiones hechas y falladas por día (las falladas en trama), el mapa de 12 semanas y la tendencia de peso con la recta del estudio. | Solo lectura. |

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

Los 16 tests de `NIVLTVTests` cubren la máquina de la sesión (descanso, pausa, saltar, cambio de ejercicio, fin), la curva de nivel copiada de `game.ts`, los formatos (1.840, 2:30, −0,43) y que ninguna cadena lleve guion largo.

Para hacer capturas, el simulador de tvOS no simula el mando, así que hay dos argumentos de arranque:

```bash
xcrun simctl launch <udid> com.teferi.nivl.tv -pestana arena      # entreno | arena | semana
xcrun simctl launch <udid> com.teferi.nivl.tv -estado descanso    # sesión en el primer descanso
xcrun simctl launch <udid> com.teferi.nivl.tv -estado serie       # primera serie en marcha
xcrun simctl launch <udid> com.teferi.nivl.tv -estado fin         # sesión cerrada
```

## Lo que falta (v2) y por qué no está

1. **Datos reales con supabase-swift.** Cada modelo de `Modelos.swift` calca una lectura que ya existe: `friends_board`, `fetchEliteBadges`, `elite_group_board`, la sesión de gym del día y los estudios de `analytics.ts`. La TV no calcula nada; solo traduce el XP a nivel, igual que la app.
2. **Login en la TV por código de dispositivo.** La TV enseña un código y un QR, el usuario abre `nivl.app/tv` en el móvil ya identificado y lo confirma, y la TV recibe una sesión de solo lectura. Para eso hace falta **una Edge Function nueva** (`tv-device-code`: emitir, confirmar y canjear) y una tabla de códigos que caduquen. Eso es migración y despliegue, que estaban **prohibidos en este frente**: queda planificado, no hecho. La sesión de la TV debería tener un alcance reducido (sin escribir economía).
3. **Sincronizar con la SesionEnCurso del iPhone** por realtime, para que el clic en la TV marque la serie en el teléfono. Hoy la TV lleva su propio reloj y el registro se sigue haciendo en el iPhone, donde `propagarActo` marca la misión enlazada.
4. **Icono y Top Shelf.** tvOS pide un icono por capas (imagestack) y la imagen de la estantería superior. Sin ellos compila y corre en el simulador, pero no pasa la validación de la tienda.
5. **Entrega.** La firma, el App ID `com.teferi.nivl.tv` y la ficha en App Store Connect los hace el dueño. Aquí no se han tocado ni EAS ni Actions.
