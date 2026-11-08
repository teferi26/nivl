import { describe, expect, test } from '@jest/globals';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const RAIZ = join(__dirname, '..', '..', '..');
const RELOJ = join(RAIZ, 'targets/watch/EntrenoPuro.swift');
const IPHONE = join(RAIZ, 'modules/nivl-salud/ios/EntrenoPuro.swift');

// Reloj e iPhone compilan por separado: la auto-pausa, la distancia y los
// parciales tienen que ser el mismo código byte a byte, sin ignorar nada.
// Se salta solo mientras no exista ninguna de las dos: con una sola, falla.
const probar = existsSync(RELOJ) || existsSync(IPHONE) ? test : test.skip;

describe('EntrenoPuro.swift', () => {
  probar('el reloj y el iPhone llevan la misma copia', () => {
    expect(existsSync(RELOJ)).toBe(true);
    expect(existsSync(IPHONE)).toBe(true);
    expect(readFileSync(RELOJ, 'utf8')).toBe(readFileSync(IPHONE, 'utf8'));
  });
});
