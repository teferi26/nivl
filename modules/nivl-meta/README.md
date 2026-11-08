# nivl-meta

Puente opcional entre NIVL y las gafas Meta, sobre el Wearables Device Access Toolkit (DAT) 1.0.1. Pinta una tarjeta en la pantalla de 600x600 de Meta Ray-Ban Display, prepara una versión hablada para gafas sin pantalla y convierte una transcripción en una misión candidata. La voz real aún no tiene fuente nativa: `hablarTexto` y el evento `transcripcion` no están implementados en Swift.

**Está apagado.** No forma parte del binario de producción y ninguna pantalla de `src/` lo importa.

## Por qué está apagado

- Meta avisa de que hoy no se puede publicar en la App Store una app que integre el DAT: usa ExternalAccessory, y eso provoca rechazo. La distribución es solo por canales privados de prueba, sin fecha para abrirla.
- Exige iOS 17.2 y Xcode 26.4 o superior, y no hay SDK oficial para React Native.
- Display es el único modelo con pantalla y no se vende en España. «Hey Meta» solo abre la app y es experimental.

## Cómo se mantiene apagado

Expo solo enlaza un módulo local si encuentra `expo-module.config.json`. Ese archivo no existe aquí: la configuración se guarda como `expo-module.config.interno.json`. Sin él, el autolinking no ve el módulo y el binario no cambia.

En JavaScript, `requireOptionalNativeModule('NivlMeta')` devuelve null, `disponible()` es false y todas las funciones son no-op. `__tests__/noop.test.ts` falla si aparece `expo-module.config.json` o si algo de `src/` empieza a citar el módulo.

## Qué hay

| Archivo | Qué hace |
|---|---|
| `src/tipos.ts` | El contrato: estado de las gafas, tarjeta, candidatas, eventos. |
| `src/tarjetas.ts` | Puro. Serie, cardio, misión y estudio, con sus límites y su versión hablada. |
| `src/voz.ts` | Puro y sin IA. De la transcripción a una candidata, y el sí o el no. |
| `src/index.ts` | La fachada sobre el nativo. |
| `ios/`, `harness/` | El puente en Swift y su banco de pruebas con Mock Device Kit. |

`LIMITES` en `tarjetas.ts` es una estimación propia: Meta no publica cuántos caracteres caben en cada estilo. Hay que ajustarla con la vista previa de Display del Mock Device Kit.

## La economía no pasa por aquí

El módulo solo propone. `candidataDeVoz` devuelve como mucho `{ tipo: 'confirmar', mision }`, y solo `interpretarRespuesta` puede decir `'si'`; un no, el silencio o una duda nunca completan. El botón «Hecho» solo emite un evento. Completar una misión sigue siendo la vía existente (`complete_quest`, `propagarActo`), en la app y tras confirmación explícita.

## Cómo se activa, solo en la variante interna

Nunca en la rama de producción ni en un commit.

1. En una copia de trabajo o un paso de CI desechables:
   `cp modules/nivl-meta/expo-module.config.interno.json modules/nivl-meta/expo-module.config.json`
2. Sube ahí el mínimo de iOS a 17.2 y compila con Xcode 26.4 o superior.
3. Distribuye solo por el canal privado de Meta. Nada de App Store.

Si `expo-module.config.json` se queda en el repo, los tests lo detectan.

## Cómo se prueba

```bash
npx jest modules/nivl-meta
```

Estos tests cubren la lógica y la fachada con un nativo simulado. No demuestran nada sobre unas gafas reales: la parte nativa se prueba en el Simulador de iOS con Mock Device Kit (`harness/`), y el comportamiento con hardware sigue sin comprobar.
