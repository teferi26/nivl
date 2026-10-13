// NIVL · Idiomas: los catálogos están sanos.
//   · cada namespace registrado tiene su es/<ns>.json y al revés;
//   · toda clave que el código pide con t('ns:clave') existe en español;
//   · ningún texto lleva raya ni guion medio (U+2014, U+2013);
//   · los plurales tienen _one y _other, con las mismas {{variables}};
//   · otro idioma (desde 1.1.0) tiene las mismas variables que el español.
import fs from 'fs';
import path from 'path';
import { NAMESPACES, RECURSOS_ES } from '@/i18n/recursos';

const RAIZ = path.resolve(__dirname, '..', '..', '..');
const DIR_I18N = path.join(RAIZ, 'src', 'i18n');
const SUFIJOS = ['zero', 'one', 'two', 'few', 'many', 'other'];
const RE_PLURAL = new RegExp(`^(.*)_(${SUFIJOS.join('|')})$`);

type Arbol = { [clave: string]: string | string[] | Arbol };

/** { 'a.b': 'texto' } a partir del árbol del JSON. */
function aplanar(arbol: Arbol, prefijo = '', out: Record<string, string> = {}): Record<string, string> {
  for (const [k, v] of Object.entries(arbol)) {
    const clave = prefijo ? `${prefijo}.${k}` : k;
    if (typeof v === 'string') out[clave] = v;
    else if (v && typeof v === 'object') aplanar(v as Arbol, clave, out);
    else throw new Error(`${clave}: valor que no es texto`);
  }
  return out;
}

const variables = (s: string) =>
  [...s.matchAll(/\{\{\s*([^,}\s]+)[^}]*\}\}/g)].map((m) => m[1]).sort().filter((v, i, a) => a.indexOf(v) === i);

const ES: Record<string, Record<string, string>> = {};
for (const ns of NAMESPACES) ES[ns] = aplanar(RECURSOS_ES[ns] as Arbol);

function archivosFuente(dir: string, out: string[] = []): string[] {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) {
      if (f !== 'node_modules' && f !== '__tests__') archivosFuente(p, out);
    } else if (/\.(ts|tsx)$/.test(f) && !/\.d\.ts$/.test(f)) out.push(p);
  }
  return out;
}

describe('registro', () => {
  it('cada namespace tiene su es/<ns>.json y cada JSON está registrado', () => {
    const archivos = fs
      .readdirSync(path.join(DIR_I18N, 'es'))
      .filter((f) => f.endsWith('.json'))
      .map((f) => f.slice(0, -5))
      .sort();
    expect([...NAMESPACES].sort()).toEqual(archivos);
  });

  it('comun tiene las claves comunes de la tanda 0', () => {
    for (const k of ['cancelar', 'reintentar', 'guardar', 'cerrar', 'sistemaNoResponde', 'sinConexion']) {
      expect(ES.comun[k]).toBeTruthy();
    }
    expect(ES.comun.sistemaNoResponde).toBe('El sistema no responde');
  });
});

describe('textos', () => {
  it('sin raya ni guion medio', () => {
    const malos: string[] = [];
    for (const [ns, claves] of Object.entries(ES)) {
      for (const [k, v] of Object.entries(claves)) if (/[\u2014\u2013]/.test(v)) malos.push(`${ns}:${k}`);
    }
    expect(malos).toEqual([]);
  });

  it('sin textos vacíos ni espacios sobrantes en los bordes', () => {
    const malos: string[] = [];
    for (const [ns, claves] of Object.entries(ES)) {
      for (const [k, v] of Object.entries(claves)) if (!v.trim() || v !== v.trim()) malos.push(`${ns}:${k}`);
    }
    expect(malos).toEqual([]);
  });

  it('los plurales tienen _one y _other y las mismas variables (salvo count en _one)', () => {
    const malos: string[] = [];
    for (const [ns, claves] of Object.entries(ES)) {
      const grupos = new Map<string, string[]>();
      for (const k of Object.keys(claves)) {
        const m = RE_PLURAL.exec(k);
        if (m) grupos.set(m[1]!, [...(grupos.get(m[1]!) ?? []), m[2]!]);
      }
      for (const [base, formas] of grupos) {
        if (!formas.includes('one') || !formas.includes('other')) malos.push(`${ns}:${base} sin _one o _other`);
        if (base in claves) malos.push(`${ns}:${base} existe a la vez sin sufijo`);
        const otras = variables(claves[`${base}_other`] ?? '');
        if (!otras.includes('count')) malos.push(`${ns}:${base}_other sin {{count}}`);
        for (const f of formas) {
          const vs = variables(claves[`${base}_${f}`]!).filter((v) => f !== 'one' || v !== 'count');
          const esperadas = otras.filter((v) => f !== 'one' || v !== 'count');
          if (f === 'one' ? vs.join() !== esperadas.join() : variables(claves[`${base}_${f}`]!).join() !== otras.join()) {
            malos.push(`${ns}:${base}_${f} con otras variables`);
          }
        }
      }
    }
    expect(malos).toEqual([]);
  });

  it('otro idioma, si lo hay, usa las mismas variables que el español', () => {
    const malos: string[] = [];
    const idiomas = fs
      .readdirSync(DIR_I18N)
      .filter((d) => d !== 'es' && d !== '__tests__' && fs.statSync(path.join(DIR_I18N, d)).isDirectory());
    for (const lng of idiomas) {
      for (const f of fs.readdirSync(path.join(DIR_I18N, lng)).filter((x) => x.endsWith('.json'))) {
        const ns = f.slice(0, -5);
        const otro = aplanar(JSON.parse(fs.readFileSync(path.join(DIR_I18N, lng, f), 'utf8')));
        for (const [k, v] of Object.entries(otro)) {
          if (/[\u2014\u2013]/.test(v)) malos.push(`${lng}/${ns}:${k} con raya`);
          const m = RE_PLURAL.exec(k);
          const enEs = ES[ns]?.[k] ?? (m ? ES[ns]?.[`${m[1]}_other`] : undefined);
          if (enEs === undefined) {
            malos.push(`${lng}/${ns}:${k} no existe en es`);
            continue;
          }
          const quitarCount = (vs: string[]) => (m ? vs.filter((x) => x !== 'count') : vs);
          if (quitarCount(variables(v)).join() !== quitarCount(variables(enEs)).join()) malos.push(`${lng}/${ns}:${k} con otras variables`);
        }
      }
    }
    expect(malos).toEqual([]);
  });
});

describe('claves que pide el código', () => {
  it("toda t('ns:clave') existe en español", () => {
    const faltan: string[] = [];
    const re = /(?<![\w.$])t\(\s*(['"`])([^'"`$]+)\1/g;
    for (const archivo of archivosFuente(path.join(RAIZ, 'src'))) {
      // Sin comentarios: la documentación cita claves de ejemplo («t('ns:clave')»).
      const fuente = fs
        .readFileSync(archivo, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/(^|[^:'"])\/\/.*$/gm, '$1');
      for (const m of fuente.matchAll(re)) {
        const completa = m[2]!;
        const [ns, clave] = completa.includes(':') ? (completa.split(/:(.*)/s) as [string, string]) : ['comun', completa];
        const claves = ES[ns];
        // Un banco de frases (array de `voz`, con returnObjects) se aplana como clave.0, clave.1...
        const existe =
          !!claves && (clave in claves || `${clave}_other` in claves || `${clave}.0` in claves);
        if (!existe) faltan.push(`${path.relative(RAIZ, archivo).split(path.sep).join('/')}: ${completa}`);
      }
    }
    expect(faltan).toEqual([]);
  });
});
