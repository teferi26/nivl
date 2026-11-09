# Capturas y vídeos de la 1.1 (para nivl-capturas)

Fecha: 9 de noviembre de 2026. Medidas tomadas hoy de las páginas oficiales (enlaces en `MATRIZ-PLATAFORMAS.md`). Compatible con `scripts/tienda/tienda.mjs`: los nombres son `NN-escena` y los ids de objetivo son los de `scripts/tienda/objetivos/`.

**La tubería no se ha ejecutado contra la 1.1.** Se probó sobre `47d2546`, versión 1.0.11 (`docs/tienda/TUBERIA.md:5`). Antes de la tanda final hay que cerrar lo de la sección siguiente.

## Lo que hay que preparar en la tubería

| # | Falta | Dónde | Qué hacer |
|---|---|---|---|
| 1 | Texto retirado: «Con NIVL Pro o Élite» y «NIVL Pro» | `plantilla/textos.mjs:17` y la entrada `pro` | Sustituir por `textos` del módulo `NIVL_TIENDA_TEMA`. Élite ya no se vende: publicarlo sería engañoso |
| 2 | Tema anterior: Cinzel y grises | `plantilla/tema.mjs` | Módulo de tema Ónix: fondo #09090B, hueso #EDEAE3, oro #C9A961 solo en hilos y cifras, Playfair Display en titulares |
| 3 | Lista fija de 9 escenas, sin modos ni rueda | `tienda.mjs:29` (`ESCENAS_TIENDA`) | Cambiar la lista por la de abajo |
| 4 | Sin escenas de los modos | `harness/app/escenas.json` | Añadir las rutas marcadas «nueva» |
| 5 | Sin interruptores ni derechos de modos | `harness/app/fixtures.ts`: `app_flags` devuelve `{}` y no hay `mis_modos` | Fixture con `modos_activos: true` y `mis_modos` con los cuatro modos. Revisar también lo nuevo que pida Hoy (pausa del coach, activación de medición, tarjetas de primer uso) |
| 6 | Titulares de escenas nuevas | Si no los hay, `textoDe` lanza error | Añadirlos en `textos` del tema, por id |
| 7 | La gira de vídeo no pasa por los modos | `giras` en `escenas.json` | Rehacer `corta` y `larga` |
| 8 | `--final` no puede terminar | `iphone-duo-interior` queda pendiente (`TUBERIA.md:74,83`) y `asc.mjs` exige `final: true` | Hay que aceptar esa falta: hoy no se puede generar el informe final. Las de Duo no se suben en 1.1 |
| 9 | Watch y TV sin Ónix | `targets/watch/Estilo.swift`, `tv/NIVLTV/Diseno/Tema.swift` | Las capturas de reloj saldrán con Cinzel hasta que se cambie el código |

## Datos a mostrar (todas las plataformas)

Solo los ficticios del arnés: usuario «Alex», amigos inventados, racha y cifras de `fixtures.ts`. Nada de datos reales, correos, nombres del dueño ni de testers. El arnés corre sin cuenta ni red y con bundle aparte (`TUBERIA.md:3`).

- La hora del reloj la fija `harness/app/reloj.js`. En iPad la barra de estado pinta el día real (`TUBERIA.md:72`).
- Cifras realistas, sin promesas de resultado. Sin precios en los titulares.
- **Coach:** la respuesta de la captura es un texto fijo. Sin consejo médico, de inversión ni fiscal. El titular debe decir que el coach va con suscripción.
- **Sin escenas de salud** con diagnósticos ni recomendaciones clínicas.
- Las capturas enseñan la app en uso: portada y acceso no van solas (guideline 2.3.3).

## Idiomas

**es-ES.** El arnés fuerza español en el simulador (`objetivos/_apoyo/ios.mjs`) y la tubería no tiene otro idioma. La interfaz en otros idiomas depende del interruptor `idiomas_activos`, cuyo valor en producción está sin verificar. Si la ficha se abre en otras lenguas, hasta que haya capturas traducidas App Store Connect usa las de la localización principal. Las del reloj llevan el mismo tamaño en todas.

## iPhone, `iphone-69` e `iphone-63`

Obligatoria **`iphone-63`, 1206x2622**. **`iphone-69`, 1320x2868**, recomendada. Vertical. Hasta 10.

| Orden | Archivo | Escena | Ruta | ¿Existe en el arnés? |
|---|---|---|---|---|
| 1 | `01-hoy` | Hoy con misiones, racha y coach | `/(tabs)` | Sí |
| 2 | `02-coach` | Conversación con el plan del día | `/(tabs)/coach` | Sí |
| 3 | `03-rueda` | Rueda de modos abierta | Hoy, con la rueda abierta | **Nueva** |
| 4 | `04-iron-hoy` | IRON: sesión del día | `/(iron)/iron-hoy` | **Nueva** |
| 5 | `05-focus-hoy` | FOCUS: bloque y temario | `/(focus)/focus-hoy` | **Nueva** |
| 6 | `06-work-hoy` | WORK: bloques y proyectos | `/(work)/work-hoy` | **Nueva** |
| 7 | `07-founder-hoy` | FOUNDER: día y economía | `/(founder)/founder-hoy` | **Nueva** |
| 8 | `08-avance` | Evolución y cifras | `/(tabs)/avance` | Sí |
| 9 | `09-arena` | Clasificación entre amigos | `/(tabs)/arena` | Sí |
| 10 | `10-habitos` | Hábitos y contrato | `/(tabs)/habitos` | Sí |

Fuera de la ficha: `/pro` con la tienda cerrada. El arnés no tiene tienda (`harness/app/purchases.ts`) y enseñaría una lista que no es lo que ve quien compra. `amigos-seguridad` tampoco va: es para revisión. No enseñar HealthKit, GPS ni reloj como función si el binario final no los lleva.

## iPad, `ipad-13`

**Obligatoria 2064x2752**, vertical, mismas 10 escenas y mismo orden, con el marco adaptativo real. Comprobar el asa de redimensionar (`TUBERIA.md:72`). El simulador sirve.

## App Preview (opcional)

| Objetivo | Medida | Fuente | Nota |
|---|---|---|---|
| `iphone-69` | 886x1920 | Gira `corta` en simulador | `asc.mjs` sube solo esta para iPhone |
| `ipad-13` | 1200x1600 | Gira `corta` en simulador | |

Entre 15 y 30 s (la herramienta corta en 29,5 s), H.264 High 4.0, 10 a 12 Mbps, 30 fps, AAC 256 kbps estéreo. Solo imagen real de la app, sin marcos ni rótulos. La gira debe pasar por Hoy, Coach, rueda y un modo. Grabar con el Mac descargado.

## Apple Watch, `watch`

Solo si el reloj va en el binario, y entonces **obligatorio**. Un único tamaño: **Series 12, 416x496** (`series-12`). Es el que tiene equivalente en la API según `specs.mjs`; 422x514 no lo tiene. Ojo: la clase `series-3` del objetivo no sirve, la app pide watchOS 11. A pantalla completa y sin marco, con `-nivlDemo`.

| Orden | Archivo | Escena | Argumentos | ¿Existe? |
|---|---|---|---|---|
| 1 | `01-hoy` | Misiones de hoy | ninguno | Sí |
| 2 | `02-racha` | Racha y rango | `-nivlPagina racha` | Sí |
| 3 | `03-focus` | Pomodoro | `-nivlPagina focus` | Sí |
| 4 | `04-descanso` | Descanso IRON | `-nivlPagina descanso` | Sí |
| 5 | `05-mision` | Marcar misión | `-nivlMision demo-1` | Sí |

Salen en `tienda/watch/series-12/`. Si se quiere vender la medición, añadir escenas de entrenar y resumen con datos de demo.

## Android (no pasa por `tienda.mjs`)

Lo hace `.github/workflows/screenshots-android.yml`, con Maestro y `e2e/maestro/capturas-108.yaml`, **un flujo de la 1.0.8 que hay que rehacer para Ónix y modos**. Usa la cuenta demo de los secretos `NIVL_SHOTS_*` y deja artefacto 3 días en repo público: solo datos ficticios.

| Recurso | Medida | Notas |
|---|---|---|
| Capturas de teléfono | 1080x1920 (perfil `pixel_2`) | Mínimo 2, hasta 8; se recomiendan 4 o más. JPEG o PNG de 24 bits, sin alfa |
| Orden | Hoy, Coach, rueda, IRON, FOCUS, WORK, FOUNDER, Avance | Máximo 8 |
| Icono | 512x512, PNG de 32 bits, hasta 1024 KB | |
| Gráfico destacado | 1024x500, sin alfa | Pieza nueva, en Ónix |
| Vídeo | Opcional, enlace de YouTube público o sin listar, sin anuncios | Solo se reproducen solos los primeros 30 s |

**Android no puede enseñar:** GPS, HealthKit, reloj ni mapa nativo. La ruta sale en SVG.

## No se suben en la 1.1

| Objetivo | Motivo |
|---|---|
| `duo` (exterior 1398x2034, interior 2007x2853) | Modo compatible con SDK 26. La interior no se puede capturar |
| `mac` (2880x1800) | Es la web, no la app |
| `vision` (3840x2160) | Es la app de iPad en un salón simulado |
| `apple-tv` (3840x2160) | La app de TV no se publica en 1.1 |

## Lo que un simulador no puede dar

| Material | Quién | Por qué |
|---|---|---|
| Vídeo de demostración para Apple, en iPhone físico | **Solo el dueño, con su iPhone** | App Review pidió grabación de dispositivo físico (`docs/appstore-review-2026-09-29/AUDITORIA.md:11`) y `VIDEO-IPHONE.md` lo deja claro: los vídeos de la tubería no sirven |
| GPS en segundo plano, pantalla apagada | **Solo el dueño**, saliendo a correr o en bici | El simulador no lo reproduce. Justifica `UIBackgroundModes: location` |
| HealthKit real | **Solo el dueño** | Datos reales de Salud; el simulador los inventa |
| Reloj real y entrega al iPhone | **Solo el dueño, con Apple Watch** | El simulador no llama al delegado |
| Compra sandbox y restauración | **Solo el dueño** | StoreKit real, tienda abierta |
| Captura de revisión de cada suscripción nueva | **Dueño**, en iPhone con tienda abierta | El arnés no tiene tienda. Tamaño exacto sin verificar |
| Duo abierto | Dueño, a mano en Device Hub | `simctl` no lo despliega |
| App en Mac | Dueño, Mac con Apple Silicon | Sin firma en la máquina de pruebas |
| Android real | Dueño o testers | La 1.1 no se ha ejecutado en Android |

## Vídeo de demostración para Apple

`VIDEO-IPHONE.md` está escrito para la 1.0.11 y **no vale tal cual**: ha cambiado la entrada (`/empezar`, cuestionario, plan de 90 días), la firma va en `/firma`, Élite ya no se vende y los productos son por modo. Hay que rehacer los rótulos con la 1.1 delante. Una sola toma, sin montaje y con el build que se envía. Cuentas de prueba, sin datos personales ni contraseñas visibles. Debe añadir a lo que ya pide:

1. Oferta por modos: precios reales de la tienda, compra sandbox de un modo, restaurar.
2. Pausa del coach, si aparece.
3. Conectar Salud: explicación propia de NIVL, activación de la medición y hoja del sistema.
4. GPS: permiso, salida con pantalla apagada y ruta guardada. Decirlo en voz alta: solo durante la sesión que la persona arranca.
5. Reloj, si va en el binario: emparejado, abrir, completar misión.

Anotar modelo, iOS, versión, build y fecha. El enlace debe abrirse sin pedir permisos.

## Vídeo de ubicación en segundo plano para Google

**No hace falta con este binario.** Google lo pide cuando el manifiesto incluye `ACCESS_BACKGROUND_LOCATION` en una app con SDK 29 o superior, y el prebuild de la 1.1 no declara ningún permiso de ubicación: el GPS es solo iOS (`src/components/cardio/useCardio.ts:256`). Sin el AAB, el manifiesto fusionado queda por confirmar: `bundletool dump manifest --bundle=nivl.aab | grep -i location` debe salir vacío.

Si algún día Android mide con GPS en segundo plano: vídeo de la app de Android, en dispositivo real y grabado por el dueño, recomendado de 30 s o menos, con el aviso destacado propio, la petición de permiso del sistema, cómo se activa y la función en marcha en segundo plano. Enlace de YouTube o de Drive accesible.

## Comandos

```bash
# Fuera del sandbox de agentes (simctl, xcodebuild, Chrome). Sin subir nada.
NIVL_TIENDA_TEMA=/ruta/tema-onix.mjs node scripts/tienda/tienda.mjs --commit <sha> --objetivos iphone-69,iphone-63,ipad-13,watch
node scripts/tienda/validar.mjs .tienda/salida/<sha7>/tienda/iphone-63 --objetivo iphone-63
node scripts/tienda/asc.mjs --commit <sha7>   # solo plan; no contacta con Apple
```

`asc.mjs` nunca ha hablado con Apple y usa rutas deprecadas (`docs/tienda/PLATAFORMAS.md:47`). Sin `--final` no deja subir: lo previsible es subirlas a mano.
