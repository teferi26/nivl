// Orden del dueño (02/10/2026): ningún texto de la IA con «—» ni «–».
import { readFileSync } from 'fs';
import { join } from 'path';
import { sinGuionesEnMensaje } from '../coach';
import { sinGuiones, tieneGuiones } from '../singuiones';

jest.mock('expo/fetch', () => ({ fetch: jest.fn() }));
jest.mock('../supabase', () => ({ supabase: {} }));
jest.mock('../health', () => ({ requireHealthConsent: jest.fn() }));

test('la copia del cliente es idéntica a la del servidor', () => {
  const raiz = join(__dirname, '..', '..', '..');
  const cliente = readFileSync(join(raiz, 'src/lib/singuiones.ts'), 'utf8').replace(/\r\n/g, '\n');
  const servidor = readFileSync(join(raiz, 'supabase/functions/_shared/singuiones.ts'), 'utf8').replace(/\r\n/g, '\n');
  expect(cliente).toBe(servidor);
});

test('mensajes antiguos del coach se pintan sin guiones; los del usuario, tal cual', () => {
  const coach = sinGuionesEnMensaje({
    id: 'a', role: 'assistant', created_at: '', content: [{ type: 'text', text: 'Hoy toca pierna — sin excusas. Series 8–12.' } as never],
  });
  const texto = (coach.content[0] as unknown as { text: string }).text;
  expect(texto).toBe('Hoy toca pierna, sin excusas. Series 8-12.');
  expect(tieneGuiones(texto)).toBe(false);
  const usuario = sinGuionesEnMensaje({ id: 'u', role: 'user', created_at: '', content: [{ type: 'text', text: 'yo — escribo así' } as never] });
  expect((usuario.content[0] as unknown as { text: string }).text).toBe('yo — escribo así');
});

test('sinGuiones en el cliente', () => {
  expect(sinGuiones('La racha — 12 días — sigue.')).toBe('La racha, 12 días, sigue.');
});
