// NIVL · Idiomas: en las carpetas ya migradas no queda ningún texto suelto.
//
// Una carpeta está migrada cuando su src/i18n/es/<ns>.json deja de estar
// vacío: desde entonces, 0 literales (jsx, props visibles, cadenas que
// parecen humanas). Y en todo el código de Experiencia, 0 llamadas a t() a
// nivel de módulo (el idioma puede cambiar después de cargar). Un texto que
// no se traduce a propósito lleva `// i18n-ok` en su línea o en la anterior.
//
// El inventario es el de scripts/i18n/inventario.mjs (el mismo que usa
// verificar-es.mjs): se ejecuta con node y se lee su JSON.
import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

const RAIZ = path.resolve(__dirname, '..', '..', '..');
const SCRIPT = path.join(RAIZ, 'scripts', 'i18n', 'inventario.mjs');

interface Registro {
  ns: string;
  archivo: string;
  linea: number;
  tipo: string;
  texto: string;
}

function inventario(raiz = RAIZ): Registro[] {
  const salida = execFileSync(process.execPath, [SCRIPT, '--json', '--raiz', raiz], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  return JSON.parse(salida) as Registro[];
}

const mostrar = (r: Registro) => `${r.archivo}:${r.linea} ${r.tipo} «${r.texto}»`;

describe('el inventario detecta lo que tiene que detectar', () => {
  let dir: string;
  beforeAll(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nivl-i18n-'));
    const carpeta = path.join(dir, 'src', 'components', 'perfil');
    fs.mkdirSync(carpeta, { recursive: true });
    fs.writeFileSync(
      path.join(carpeta, 'Prueba.tsx'),
      [
        "import { Text } from 'react-native';",
        "import { t } from '@/i18n';",
        "const MAL = t('comun:cancelar');",
        '// i18n-ok',
        "const PERMITIDO = 'Esto es un texto permitido';",
        "const TAMBIEN = 'Otro texto con permiso'; // i18n-ok",
        'export function Prueba() {',
        "  const bien = t('comun:guardar');",
        '  return (',
        '    <Text accessibilityLabel="Hola mundo">',
        '      Texto suelto {bien} {MAL} {PERMITIDO} {TAMBIEN}',
        '    </Text>',
        '  );',
        '}',
        "export const AVISO = 'Sin conexión, vuelve a intentarlo.';",
        '',
      ].join('\n'),
    );
    // Lo que no es de Experiencia no se mira.
    fs.mkdirSync(path.join(dir, 'src', 'lib'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'src', 'lib', 'otro.ts'), "export const X = 'Un texto de otro equipo';\n");
  });
  afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('literales, props, jsx, t() de módulo e i18n-ok', () => {
    const r = inventario(dir);
    const textos = r.map((x) => `${x.tipo}|${x.texto}`);
    expect(textos).toContain("t-modulo|t('comun:cancelar')");
    expect(textos).toContain('prop:accessibilityLabel|Hola mundo');
    expect(textos).toContain('jsx|Texto suelto');
    expect(textos).toContain('lit|Sin conexión, vuelve a intentarlo.');
    expect(textos.join('\n')).not.toMatch(/permitido|con permiso|comun:guardar|otro equipo/);
    expect(r.every((x) => x.ns === 'perfil')).toBe(true);
  });
});

describe('carpetas migradas', () => {
  const migrados = fs
    .readdirSync(path.join(RAIZ, 'src', 'i18n', 'es'))
    .filter((f) => f.endsWith('.json') && f !== 'comun.json')
    .filter((f) => Object.keys(JSON.parse(fs.readFileSync(path.join(RAIZ, 'src', 'i18n', 'es', f), 'utf8'))).length > 0)
    .map((f) => f.slice(0, -5));

  let registros: Registro[];
  beforeAll(() => {
    registros = inventario();
  });

  it('el inventario ve el código de Experiencia', () => {
    // Si esto da 0, el inventario no está leyendo nada y el resto no prueba nada.
    expect(registros.length).toBeGreaterThan(1000);
  });

  it('0 textos sueltos en las carpetas con catálogo', () => {
    const sueltos = registros.filter((r) => migrados.includes(r.ns) && r.tipo !== 't-modulo').map(mostrar);
    expect(sueltos).toEqual([]);
  });

  it('0 llamadas a t() a nivel de módulo', () => {
    expect(registros.filter((r) => r.tipo === 't-modulo').map(mostrar)).toEqual([]);
  });
});
