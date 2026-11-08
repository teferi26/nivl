// Apple Vision Pro: el .app de iOS instala y corre como compatible con iPad, en su
// ventana dentro del salón simulado. El simulador da 3840x2160 sin reescalar.
import { TIPO, crearObjetivoIos } from './_apoyo/ios.mjs';

export default crearObjetivoIos({
  id: 'vision',
  familia: 'vision',
  tipo: `${TIPO}Apple-Vision-Pro-4K`,
  filtroRuntime: (r) => r.identifier.includes('.xrOS-'),
  pantallas: [{ salida: 'vision-pro' }],
  vision: true,
  sinVideo: true,
  nota: 'Es la app de iPad en modo compatible, en una ventana dentro del entorno simulado de visionOS.',
});
