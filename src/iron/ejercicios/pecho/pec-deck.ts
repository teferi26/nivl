// NIVL · IRON · Pecho · Pec deck, vista frontal.
//
// Vista frontal, sentado: brazo horizontal a la altura del hombro y antebrazo
// vertical contra la almohadilla. Las palancas giran en ejes sobre los hombros.
// Biomecánica comprobada en src/iron/__tests__/biomecanica-pecho.test.ts.

import type { Ejercicio } from '../../tipos';
import { PIVOTE_PEC_DECK, maquinaPecDeck } from './_familias';

export const pecDeck: Ejercicio = {
  id: 'pec-deck',
  nombre: 'iron-pecho:ejercicios.pec-deck.nombre',
  grupo: 'pecho',
  nivel: 'principiante',
  tipo: 'dinamico',
  material: ['maquina'],
  musculos: {
    principales: ['pectoral'],
    secundarios: ['deltoides_anterior'],
  },
  sustitutos: ['aperturas-mancuerna', 'aperturas-suelo-mancuerna', 'press-banca-mancuerna'],
  vista: 'frontal',
  ...maquinaPecDeck(),
  carga: { tipo: 'pec_deck', pivote: PIVOTE_PEC_DECK },
  cues: [
    'iron-pecho:ejercicios.pec-deck.cues.asiento',
    'iron-pecho:ejercicios.pec-deck.cues.cierre',
    'iron-pecho:ejercicios.pec-deck.cues.vuelta',
  ],
  errores: [
    'iron-pecho:ejercicios.pec-deck.errores.espalda',
    'iron-pecho:ejercicios.pec-deck.errores.choque',
    'iron-pecho:ejercicios.pec-deck.errores.hombros',
  ],
};
