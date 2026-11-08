import { describe, expect, test } from '@jest/globals';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { contrastar, type Declarado } from '../medicion/contraste';

const RAIZ = join(__dirname, '..', '..', '..');
const leer = (ruta: string) => readFileSync(join(RAIZ, ruta), 'utf8');

// El contraste solo informa. Quien mueve la economía o da contexto al coach no
// puede ni importarlo: si no lo ve, no puede cambiar XP ni discutir un registro.
const SIN_CONTRASTE = [
  'src/lib/medicion/pagoMedido.ts',
  'src/lib/medicion/actoMedido.ts',
  'src/lib/medicion/buzon.ts',
  'src/lib/medicion/almacen.ts',
  'src/lib/resistencia.ts',
  'src/lib/pagoActo.ts',
  'src/lib/links.ts',
  'src/lib/engine.ts',
  'src/lib/closing.ts',
  'supabase/functions/_shared/tools.ts',
  'supabase/functions/_shared/context.ts',
  'supabase/functions/_shared/comprobacion.ts',
];

const PUROS = ['rutaGps', 'fusion', 'contraste'].map((m) => `src/lib/medicion/${m}.ts`);

describe('la regla de contraste', () => {
  test.each(SIN_CONTRASTE.filter((r) => existsSync(join(RAIZ, r))))('%s no lo importa', (ruta) => {
    const fuente = leer(ruta);
    expect(fuente).not.toMatch(/medicion\/contraste|\.\/contraste['"]/);
    expect(fuente).not.toMatch(/\bcontrastar\s*\(/);
  });

  test('el resultado solo trae estado y detalle: nada que pagar', () => {
    const declarado: Declarado = { tipo: 'cardio', deporte: 'carrera', fecha: 'x', duracion_min: 30, distancia_km: 5 };
    expect(Object.keys(contrastar(declarado, null)).sort()).toEqual(['detalle', 'estado']);
  });
});

describe('módulos puros', () => {
  test.each(PUROS)('%s no arrastra Supabase ni efectos', (ruta) => {
    const imports = [...leer(ruta).matchAll(/from '([^']+)'/g)].map((m) => m[1]);
    for (const origen of imports) expect(['../dates', '../entrenoMedido']).toContain(origen);
  });

  test.each(PUROS)('%s no lleva guion largo', (ruta) => {
    expect(leer(ruta)).not.toMatch(/[–—]/);
  });
});
