// NIVL · IRON · Material: kettlebell (pierna, fase 2).
//
// El asa se agarra en el centro del puño; la campana cuelga hacia `abajo`
// (goblet: sujeta por los cuernos contra el pecho) o en la prolongación del
// antebrazo (swing). Un solo contorno (asa y campana) con la ventana del asa
// como agujero: el estilo de la carga pinta con evenodd.

import { dir, type Esqueleto, type Punto } from '../esqueleto';
import { poligono } from './trazo';

/** Radio de la campana y distancia del agarre a su centro, en unidades de cuerpo. */
export const KETTLEBELL = { radio: 5.6, asa: 3.6, centro: 8.6 } as const;

/** Dirección «hacia la campana» desde el agarre. */
export function bajadaKettlebell(e: Esqueleto, cuelga: 'abajo' | 'antebrazo'): Punto {
  'worklet';
  return cuelga === 'abajo' ? { x: 0, y: -1 } : dir(e.a.antebrazo_c);
}

/** Centro de la campana (para los tests de trayectoria). */
export function centroKettlebell(e: Esqueleto, cuelga: 'abajo' | 'antebrazo'): Punto {
  'worklet';
  const u = bajadaKettlebell(e, cuelga);
  const h = e.p.agarre_c;
  return { x: h.x + u.x * KETTLEBELL.centro, y: h.y + u.y * KETTLEBELL.centro };
}

export function kettlebell(e: Esqueleto, cuelga: 'abajo' | 'antebrazo'): string {
  'worklet';
  const u = bajadaKettlebell(e, cuelga);
  const v = { x: -u.y, y: u.x };
  const h = e.p.agarre_c;
  // Coordenadas locales: s de lado, d hacia la campana.
  const q = (s: number, d: number): Punto => ({ x: h.x + v.x * s + u.x * d, y: h.y + v.y * s + u.y * d });
  const R = KETTLEBELL.radio;
  const A = KETTLEBELL.asa;
  const C = KETTLEBELL.centro;
  const fuera: Punto[] = [];
  // Arco del asa, por encima del puño.
  for (let i = 0; i <= 8; i++) {
    const th = Math.PI + (i / 8) * Math.PI;
    fuera.push(q(A * Math.cos(th), A * Math.sin(th)));
  }
  // Cuerno derecho y campana (base plana), de vuelta al cuerno izquierdo.
  fuera.push(q(A, 2.6));
  const fr = Math.atan2(2.6 - C, A);
  const fl = Math.PI - fr;
  for (let i = 0; i <= 16; i++) {
    const f = fr + (i / 16) * (fl - fr);
    fuera.push(q(R * Math.cos(f), Math.min(C + R * Math.sin(f), C + R * 0.86)));
  }
  fuera.push(q(-A, 2.6));
  // La ventana del asa.
  const a = A - 1.3;
  const ventana: Punto[] = [];
  for (let i = 0; i <= 8; i++) {
    const th = Math.PI + (i / 8) * Math.PI;
    ventana.push(q(a * Math.cos(th), a * Math.sin(th)));
  }
  ventana.push(q(a, 2.4), q(-a, 2.4));
  return poligono(fuera) + poligono(ventana);
}
