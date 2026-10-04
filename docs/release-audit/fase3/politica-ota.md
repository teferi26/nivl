# Política de actualizaciones por OTA (Expo Updates) desde la 1.0.8

NIVL - Tiendas, 04/10/2026, a petición de NIVL - Juego y QA (auditoría de directrices, 2.5.2).

## Por qué

Apple permite actualizar el JavaScript de una app sin pasar por revisión, pero con límites:
- **Guideline 2.5.2:** las apps no pueden descargar código que cambie sus funciones.
- **Licencia del Apple Developer Program (§3.3.1(B), código interpretado):** el código que se descarga no puede cambiar el propósito principal de la app ni añadir funciones que no estuvieran en la versión revisada.

En la práctica, una OTA que añade una función nueva o cambia lo que vio el revisor puede acabar en rechazo o en retirada. Lo que vio el revisor es la build más las OTA vigentes cuando la revisó.

## Regla

**Por OTA (al runtime publicado) SÍ:**
- arreglos de errores;
- textos, traducciones y avisos legales;
- ajustes visuales que no cambian qué hace la pantalla;
- configuración y límites que ya existían (precios mostrados desde la tienda, topes del coach, umbrales);
- desactivar o esconder algo que falla.

**Por OTA NO; van en build nueva y pasan por revisión:**
- funciones nuevas (pantallas, módulos, tipos de tarjeta, ligas nuevas, integraciones);
- cambios en compras: productos, precios propios, ofertas, la pantalla de planes en lo esencial, el flujo de prueba;
- cambios en permisos, datos que se recogen o envían, proveedores de IA o consentimientos;
- cualquier cosa que contradiga las notas de revisión o la ficha.

## Mientras haya una versión en revisión

- No se publica ninguna OTA al runtime de la versión en revisión, salvo para arreglar un fallo que impida la revisión. En ese caso se avisa a App Review en el Resolution Center.
- Antes de pulsar «Volver a enviar», la OTA vigente es la que se ha probado en el iPhone y la que sale en el vídeo.
- Cada OTA publicada se anota (SHA, runtime, canal, fecha y motivo) en el estado del coordinador.

## Excepción ya vista en la 1.0.8

Publicar la OTA con el entorno correcto (`--environment production`) para que la tienda de la 23 esté abierta **es un arreglo**: devuelve la app a lo que se ha descrito a Apple. Debe hacerse **antes** de grabar el vídeo nuevo y de reenviar.
