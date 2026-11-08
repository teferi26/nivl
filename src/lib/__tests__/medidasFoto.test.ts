import { LADO_MAX_FOTO_WEB, medidasFotoWeb } from '../web/medidasFoto';

test('sin recorte y más pequeña que el tope: la foto queda igual', () => {
  expect(medidasFotoWeb(800, 600)).toEqual({ sx: 0, sy: 0, sw: 800, sh: 600, ancho: 800, alto: 600 });
});

test('reduce por el lado mayor y nunca amplía', () => {
  const m = medidasFotoWeb(4032, 3024);
  expect(m?.ancho).toBe(LADO_MAX_FOTO_WEB);
  expect(m?.alto).toBe(1536);
  expect(medidasFotoWeb(100, 50, null, 2048)?.ancho).toBe(100);
});

test('recorta al centro a la proporción pedida (foto apaisada a 3:4)', () => {
  expect(medidasFotoWeb(1600, 900, [3, 4])).toEqual({ sx: 462.5, sy: 0, sw: 675, sh: 900, ancho: 675, alto: 900 });
});

test('recorta al centro a la proporción pedida (foto vertical a cuadrado)', () => {
  expect(medidasFotoWeb(600, 1000, [1, 1])).toEqual({ sx: 0, sy: 200, sw: 600, sh: 600, ancho: 600, alto: 600 });
});

test('una imagen sin medidas no se puede redibujar', () => {
  expect(medidasFotoWeb(0, 0)).toBeNull();
  expect(medidasFotoWeb(100, Number.NaN)).toBeNull();
});
