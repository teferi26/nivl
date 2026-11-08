// iPhone Duo. El simulador tiene dos pantallas: LCD (id 1, exterior, 1398x2034) y
// LCD-1 (id 3, interior, 2007x2853). Arranca siempre plegado: todo se pinta en la
// exterior y la interior queda en negro. simctl no tiene orden para desplegar, y
// `simctl io <udid> screenConfig --display=1 power off` tampoco: apaga la exterior
// (su captura da «Timeout waiting for screen surfaces») y la interior sigue en
// negro. Así que la interior queda pendiente en informe.json, sin reescalar ninguna
// otra. Si un simulador futuro la enciende, sale sola: se comprueba en cada captura.
import { grabarVideos } from '../video.mjs';
import { TIPO, crearObjetivoIos } from './_apoyo/ios.mjs';

export default crearObjetivoIos({
  id: 'duo',
  familia: 'iphone-duo',
  tipo: `${TIPO}iPhone-Duo`,
  filtroRuntime: (r) => r.identifier.endsWith('-iPhone19-4'),
  pantallas: [
    { salida: 'iphone-duo-exterior', display: 1 },
    { salida: 'iphone-duo-interior', display: 3 },
  ],
  nota: 'La app no está optimizada para Duo: en la exterior corre en modo compatible, con una franja lateral del sistema a la derecha.',
  // Apple solo admite 886x1920 en Duo y el simulador no da esa proporción: se graba
  // en un iPhone 17 Pro Max, como decide video.mjs. Antes se libera el Duo.
  async grabar(ctx) {
    ctx.liberarSimuladores();
    ctx.aviso('el vídeo de Duo sale de un iPhone 17 Pro Max, no del simulador de Duo');
    return grabarVideos({ ...ctx, udid: undefined, salidaVideos: ctx.videosDe('iphone-duo-exterior') }, 'iphone-duo-exterior');
  },
});
