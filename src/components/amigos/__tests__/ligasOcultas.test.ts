// Las ligas no existen como producto (FICHA-1011 §0): «Crear liga», «Liga
// privada», sus invitaciones y su tablero no pueden verse en Amigos. Todo eso
// cuelga de LIGAS_VISIBLES en <Competicion>; si alguien lo enciende, esto falla.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LIGAS_VISIBLES } from '../flags';

test('las ligas siguen apagadas', () => {
  expect(LIGAS_VISIBLES).toBe(false);
});

test('en Competicion, toda entrada a las ligas pasa por LIGAS_VISIBLES', () => {
  const fuente = readFileSync(join(__dirname, '..', 'Competicion.tsx'), 'utf8');
  // El botón «Crear liga» y la hoja (eyebrow «Liga privada») van dentro de un bloque con LIGAS_VISIBLES.
  const boton = fuente.indexOf("t('amigos:liga.crear')");
  const hoja = fuente.indexOf('<CrearLigaSheet');
  expect(boton).toBeGreaterThan(-1);
  expect(hoja).toBeGreaterThan(-1);
  for (const pos of [boton, hoja]) {
    const antes = fuente.slice(Math.max(0, pos - 200), pos);
    expect(antes).toContain('LIGAS_VISIBLES');
  }
});
