// NIVL · Idiomas (Modos F1): los catálogos traducidos son el español con otras palabras.
//   · cada idioma de src/i18n/<lng> (junto a es/) tiene los mismos namespaces que es;
//   · exactamente las mismas claves (y los bancos de `voz` con las mismas frases);
//   · las mismas interpolaciones, con su formato ({{count, miles}}), y las mismas <b>;
//   · ningún texto con raya ni guion medio (U+2014, U+2013), ni vacío, ni con
//     exclamaciones (la voz del sistema constata, no grita);
//   · los nombres de modo (NIVL, IRON, FOCUS, WORK, FOUNDER) no se traducen.
import fs from 'fs';
import path from 'path';
import { IDIOMAS_TRADUCIDOS, RECURSOS_LOCALES } from '@/i18n/traducidos';
import { NAMESPACES, RECURSOS_ES } from '@/i18n/recursos';

const DIR_I18N = path.resolve(__dirname, '..');

type Arbol = { [clave: string]: string | string[] | Arbol };

function aplanar(arbol: Arbol, prefijo = '', out: Record<string, string> = {}): Record<string, string> {
  for (const [k, v] of Object.entries(arbol)) {
    const clave = prefijo ? `${prefijo}.${k}` : k;
    if (typeof v === 'string') out[clave] = v;
    else if (v && typeof v === 'object') aplanar(v as Arbol, clave, out);
    else throw new Error(`${clave}: valor que no es texto`);
  }
  return out;
}

/** Las interpolaciones tal cual (con su formato), ordenadas: «{{count, miles}}», «{{titulo}}». */
const interpolaciones = (s: string) => [...s.matchAll(/\{\{[^}]*\}\}/g)].map((m) => m[0].replace(/\s+/g, ' ')).sort();
const negritas = (s: string) => [...s.matchAll(/<\/?b>/g)].map((m) => m[0]).join('');
const anidados = (s: string) => [...s.matchAll(/\$t\([^)]*\)/g)].map((m) => m[0]).sort();

const ES: Record<string, Record<string, string>> = {};
for (const ns of NAMESPACES) ES[ns] = aplanar(RECURSOS_ES[ns] as Arbol);

const MODOS = ['NIVL', 'IRON', 'FOCUS', 'WORK', 'FOUNDER'];

it('hay carpeta para cada idioma traducido y nada más', () => {
  const carpetas = fs
    .readdirSync(DIR_I18N)
    .filter((d) => d !== 'es' && d !== '__tests__' && fs.statSync(path.join(DIR_I18N, d)).isDirectory())
    .sort();
  expect(carpetas).toEqual([...IDIOMAS_TRADUCIDOS].sort());
});

describe.each(IDIOMAS_TRADUCIDOS)('%s', (lng) => {
  const dir = path.join(DIR_I18N, lng);
  const recursos = RECURSOS_LOCALES[lng] as Record<string, Arbol>;
  const plano: Record<string, Record<string, string>> = {};
  for (const ns of Object.keys(recursos)) plano[ns] = aplanar(recursos[ns]!);

  it('los mismos namespaces que es (en disco y registrados)', () => {
    const archivos = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.json'))
      .map((f) => f.slice(0, -5))
      .sort();
    expect(archivos).toEqual([...NAMESPACES].sort());
    expect(Object.keys(recursos).sort()).toEqual([...NAMESPACES].sort());
  });

  it('exactamente las mismas claves que es', () => {
    const diferencias: string[] = [];
    for (const ns of NAMESPACES) {
      const es = Object.keys(ES[ns]!);
      const otro = Object.keys(plano[ns] ?? {});
      for (const k of es) if (!otro.includes(k)) diferencias.push(`falta ${ns}:${k}`);
      for (const k of otro) if (!es.includes(k)) diferencias.push(`sobra ${ns}:${k}`);
    }
    expect(diferencias).toEqual([]);
  });

  it('las mismas interpolaciones, negritas y anidados que es', () => {
    const malos: string[] = [];
    for (const ns of NAMESPACES) {
      for (const [k, v] of Object.entries(plano[ns] ?? {})) {
        const es = ES[ns]![k];
        if (es === undefined) continue;
        if (interpolaciones(v).join() !== interpolaciones(es).join()) malos.push(`${ns}:${k} interpolaciones`);
        if (negritas(v) !== negritas(es)) malos.push(`${ns}:${k} <b>`);
        if (anidados(v).join() !== anidados(es).join()) malos.push(`${ns}:${k} $t()`);
      }
    }
    expect(malos).toEqual([]);
  });

  it('sin raya ni guion medio, sin exclamaciones, sin vacíos ni espacios en los bordes', () => {
    const malos: string[] = [];
    for (const ns of NAMESPACES) {
      for (const [k, v] of Object.entries(plano[ns] ?? {})) {
        if (/[—–]/.test(v)) malos.push(`${ns}:${k} raya`);
        if (/[!¡]/.test(v) && !/[!¡]/.test(ES[ns]![k] ?? '')) malos.push(`${ns}:${k} exclamación`);
        if (!v.trim() || v !== v.trim()) malos.push(`${ns}:${k} vacío o con espacios`);
      }
    }
    expect(malos).toEqual([]);
  });

  it('los nombres de modo y la marca no se traducen', () => {
    const malos: string[] = [];
    for (const ns of NAMESPACES) {
      for (const [k, es] of Object.entries(ES[ns]!)) {
        const v = plano[ns]?.[k] ?? '';
        for (const m of MODOS) {
          const veces = (s: string) => s.split(new RegExp(`\\b${m}\\b`)).length - 1;
          if (veces(v) < veces(es)) malos.push(`${ns}:${k} ${m}`);
        }
      }
    }
    expect(malos).toEqual([]);
  });
});
