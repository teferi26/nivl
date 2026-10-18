// NIVL · IRON · Material de pierna (fase 2): el punto de entrada desde
// src/iron/dibujo.ts. Escenario fijo (cajón, rack y bancadas de las
// máquinas) y carga que se mueve con el cuerpo (kettlebell, carro de la
// prensa, palanca de la extensión y el curl femoral, almohadillas de la
// abductora).

import type { Esqueleto, Punto } from '../esqueleto';
import type { CargaPierna, Escenario } from '../tipos';
import { almohadilla, almohadillas, bancadaAbductora } from './abductora';
import { cajon } from './cajon';
import { centroKettlebell, kettlebell } from './kettlebell';
import { bancadaCurlFemoral, bancadaExtension, palanca, rodilloPalanca } from './palanca';
import { bancadaPrensa, carroPrensa } from './prensa';
import { rack } from './rack';

export function escenarioPierna(b: Escenario): string {
  'worklet';
  if (b.tipo === 'cajon') return cajon(b);
  if (b.tipo === 'rack') return rack(b);
  if (b.tipo === 'prensa') return bancadaPrensa(b);
  if (b.tipo === 'extension') return bancadaExtension(b);
  if (b.tipo === 'curl_femoral') return bancadaCurlFemoral(b);
  if (b.tipo === 'abductora') return bancadaAbductora(b);
  return '';
}

/**
 * La carga de pierna en cada lado. La kettlebell, la palanca y las
 * almohadillas de la abductora van delante de todo (lado cercano); el carro
 * de la prensa, detrás de la pierna lejana (la planta de los dos pies se
 * apoya en la plataforma).
 */
export function cargaPierna(e: Esqueleto, carga: CargaPierna, lado: 'c' | 'l'): string {
  'worklet';
  if (carga.tipo === 'kettlebell') return lado === 'c' ? kettlebell(e, carga.cuelga) : '';
  if (carga.tipo === 'prensa') return lado === 'l' ? carroPrensa(e, carga.angulo) : '';
  if (carga.tipo === 'abductora') return lado === 'c' ? almohadillas(e, carga.ejeY) : '';
  return lado === 'c' ? palanca(e, carga.eje, carga.cara) : '';
}

/** El punto de la carga que siguen los tests de trayectoria. */
export function centroCargaPierna(e: Esqueleto, carga: CargaPierna): Punto {
  'worklet';
  if (carga.tipo === 'kettlebell') return centroKettlebell(e, carga.cuelga);
  if (carga.tipo === 'prensa') return e.p.tobillo_c;
  if (carga.tipo === 'abductora') return almohadilla(e, 'c');
  return rodilloPalanca(e, carga.cara);
}
