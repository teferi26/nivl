// NIVL · IRON · Remo en máquina con apoyo de pecho (de palanca).
//
// Sentado con el pecho en el apoyo; las asas van en el extremo de una
// palanca que gira sobre su eje, así la mano describe un arco. El apoyo deja
// la zona lumbar descansada: todo el trabajo es de la espalda alta.
// Biomecánica (src/iron/__tests__/espalda.test.ts):
// · La mano sigue el arco de la palanca (distancia al eje constante).
// · Al final el codo pasa la línea de la espalda.
// · El tronco no se mueve.

import type { Ejercicio } from '../../tipos';
import { desde, sobreTronco } from './_pose';
import { anclaSentado, poseSentado, sentado, type Sentado } from './_sentado';

const S: Sentado = { cadera: { x: 0, y: 30 }, tobillo: { x: 24, y: 4 }, pie: 0 };
const TRONCO = 78;
const EJE = { x: 26, y: 84 } as const;
const RADIO = Math.hypot(12, 38);
const E = { brazo: 0.95, antebrazo: 0.97 };

const enArco = (grados: number) => desde(EJE, grados, RADIO);
const DELANTE = sentado(S, TRONCO, enArco(-72.5), E, true, 84);
const M1 = sentado(S, TRONCO, enArco(-84), E, true, 84);
const M2 = sentado(S, TRONCO, enArco(-96), E, true, 84);
const FIN = sentado(S, TRONCO, enArco(-107.5), E, true, 84);

const PECHO = sobreTronco(S.cadera, TRONCO, 0.8, 8.4);

export const remoMaquina: Ejercicio = {
  id: 'remo-maquina',
  nombre: 'iron-espalda:ejercicios.remo-maquina.nombre',
  grupo: 'espalda',
  nivel: 'principiante',
  tipo: 'dinamico',
  material: ['maquina'],
  musculos: {
    principales: ['espalda_alta', 'dorsal'],
    secundarios: ['trapecio', 'deltoides_posterior', 'biceps', 'antebrazo'],
  },
  sustitutos: ['remo-polea-sentado', 'remo-barra', 'remo-mancuernas'],
  vista: 'lateral',
  ancla: anclaSentado(S, TRONCO),
  poses: [
    poseSentado(0, DELANTE, E),
    poseSentado(400, DELANTE, E),
    poseSentado(750, M1, E),
    poseSentado(1050, M2, E),
    poseSentado(1350, FIN, E),
    poseSentado(1700, FIN, E),
    poseSentado(2250, M2, E),
    poseSentado(2800, M1, E),
  ],
  cicloMs: 3500,
  esfuerzo: [{ desde: 400, hasta: 1350 }],
  msFicha: 200,
  carga: { tipo: 'palanca', pivote: EJE, lados: ['cerca'] },
  escenario: [
    {
      tipo: 'asiento',
      x: 0,
      alto: 23,
      ancho: 16,
      pecho: { x: PECHO.x, y0: PECHO.y - 10, y1: PECHO.y + 6 },
      eje: EJE,
      capa: 'medio',
    },
  ],
  encuadre: { x: -28, y: -4, ancho: 84, alto: 96 },
  cues: [
    'iron-espalda:ejercicios.remo-maquina.cues.pecho',
    'iron-espalda:ejercicios.remo-maquina.cues.codos',
    'iron-espalda:ejercicios.remo-maquina.cues.vuelta',
  ],
  errores: [
    'iron-espalda:ejercicios.remo-maquina.errores.despegar',
    'iron-espalda:ejercicios.remo-maquina.errores.encoger',
  ],
};
