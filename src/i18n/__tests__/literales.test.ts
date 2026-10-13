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

function ejecutar<T>(modo: '--json' | '--archivos', raiz = RAIZ): T {
  const salida = execFileSync(process.execPath, [SCRIPT, modo, '--raiz', raiz], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  return JSON.parse(salida) as T;
}

const inventario = (raiz = RAIZ) => ejecutar<Registro[]>('--json', raiz);
const archivosRecorridos = () => ejecutar<{ archivo: string; ns: string }[]>('--archivos');

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

  // Hasta la tanda 7 esto pedía más de 1000 textos sueltos: si daba 0, el
  // inventario no leía nada y el resto no probaba nada. Desde la tanda 8 lo
  // normal ES 0 textos, así que se mira otra cosa: que el inventario sigue
  // recorriendo los archivos de Experiencia (237 al cerrar la 1.0.10; si un
  // cambio de rutas lo deja ciego, baja de golpe), que la línea base de
  // 40abdbe está entera (2520 textos) y que cada namespace que tenía textos
  // allí tiene ya su catálogo. Que el inventario detecta un literal lo prueba
  // el árbol de prueba de arriba.
  it('el inventario ve el código de Experiencia', () => {
    const archivos = archivosRecorridos();
    expect(archivos.length).toBeGreaterThan(200);
    const porNs = new Set(archivos.map((a) => a.ns));
    for (const ns of ['raiz', 'ui', 'hoy', 'perfil', 'coach', 'gym', 'diario', 'amigos', 'voz', 'avisos']) {
      expect(porNs).toContain(ns);
    }
  });

  it('la línea base está entera y todos sus namespaces tienen catálogo', () => {
    const base = fs
      .readFileSync(path.join(RAIZ, 'docs', 'i18n', 'textos-es.base.tsv'), 'utf8')
      .split(/\r?\n/)
      .filter((l) => l && !l.startsWith('#'));
    expect(base.length).toBeGreaterThan(2000);
    const sinCatalogo = [...new Set(base.map((l) => l.split('\t')[0]!))].filter((ns) => !migrados.includes(ns));
    expect(sinCatalogo).toEqual([]);
  });

  it('0 textos sueltos en las carpetas con catálogo', () => {
    const sueltos = registros.filter((r) => migrados.includes(r.ns) && r.tipo !== 't-modulo').map(mostrar);
    expect(sueltos).toEqual([]);
  });

  it('0 llamadas a t() a nivel de módulo', () => {
    expect(registros.filter((r) => r.tipo === 't-modulo').map(mostrar)).toEqual([]);
  });
});
