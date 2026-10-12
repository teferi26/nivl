import { describe, expect, test } from '@jest/globals';
import { conEscuchar } from '../coach/vozCoach';

describe('«Escuchar» en los mensajes del coach', () => {
  test('con el coach en español y voz disponible, se ofrece', () => {
    expect(conEscuchar(true, 'Hoy toca pierna.', 'es')).toBe(true);
  });

  test('con el coach en otro idioma, no: la voz lee en es-ES', () => {
    for (const idioma of ['en', 'fr', 'de', 'pt', 'it'] as const) {
      expect(conEscuchar(true, 'Leg day today.', idioma)).toBe(false);
    }
  });

  test('sin voz en el dispositivo o sin texto, no', () => {
    expect(conEscuchar(false, 'Hoy toca pierna.', 'es')).toBe(false);
    expect(conEscuchar(true, '', 'es')).toBe(false);
  });
});
