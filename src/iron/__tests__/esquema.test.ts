// NIVL · IRON · El esquema de los ejercicios: cada archivo de datos cumple
// las reglas que el tipo `Ejercicio` no puede expresar solo.
import fs from 'fs';
import path from 'path';
import { RECURSOS_ES } from '@/i18n/recursos';
import { dibujar, ranuras } from '../dibujo';
import { EJERCICIOS, ejercicioPorId } from '../ejercicios';
import { FORMAS_FRONTAL, FORMAS_LATERAL, GRUPO_DE_MUSCULO, MUSCULOS } from '../musculos';
import { ARTICULACIONES, type Ejercicio, type Material, type Pose } from '../tipos';

const DIR = path.resolve(__dirname, '..', 'ejercicios');
const MATERIALES: Material[] = [
  'barra',
  'mancuerna',
  'banco',
  'peso_corporal',
  'polea',
  'maquina',
  'kettlebell',
  'banda',
  // pierna
  'rack',
  'cajon',
];

/** Los ejercicios de la fase 2 van en una carpeta por grupo (ejercicios/<grupo>/<id>.ts). */
function archivosDeEjercicios(dir: string): string[] {
  const out: string[] = [];
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) out.push(...archivosDeEjercicios(p));
    else if (f.endsWith('.ts') && f !== 'index.ts') out.push(f.slice(0, -3));
  }
  return out;
}

/** Resuelve «iron:a.b.c» (o «iron-<grupo>:a.b.c») en el catálogo español; undefined si no existe. */
function texto(clave: string): string | undefined {
  const [ns, ruta] = clave.split(':');
  if (!/^iron(-[a-z]+)?$/.test(ns ?? '') || !ruta) return undefined;
  let nodo: unknown = (RECURSOS_ES as Record<string, unknown>)[ns];
  for (const parte of ruta.split('.')) {
    if (!nodo || typeof nodo !== 'object') return undefined;
    nodo = (nodo as Record<string, unknown>)[parte];
  }
  return typeof nodo === 'string' ? nodo : undefined;
}

describe('catálogo', () => {
  it('cada archivo de ejercicios/ está registrado, con id = nombre del archivo', () => {
    const archivos = archivosDeEjercicios(DIR).sort();
    expect(EJERCICIOS.map((e) => e.id).sort()).toEqual(archivos);
    for (const id of archivos) expect(ejercicioPorId(id)?.id).toBe(id);
  });

  it('ids únicos y en minúsculas con guiones', () => {
    const ids = EJERCICIOS.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it('el prototipo tiene los 5 ejercicios pedidos, los primeros del catálogo', () => {
    expect(EJERCICIOS.slice(0, 5).map((e) => e.id)).toEqual([
      'sentadilla-barra',
      'press-banca',
      'remo-mancuerna',
      'curl-biceps-mancuerna',
      'plancha',
    ]);
  });
});

describe.each(EJERCICIOS.map((e) => [e.id, e] as const))('%s', (_id, ej: Ejercicio) => {
  it('textos: nombre, cues y errores existen en es/iron.json (o es/iron-<grupo>.json), sin raya ni guion medio', () => {
    const claves = [ej.nombre, ...ej.cues, ...ej.errores];
    for (const c of claves) {
      expect(c.startsWith(`iron:ejercicios.${ej.id}.`) || c.startsWith(`iron-${ej.grupo}:ejercicios.${ej.id}.`)).toBe(true);
      const t = texto(c);
      expect(t).toBeTruthy();
      expect(t).not.toMatch(/[—–]/);
    }
    expect(ej.cues.length).toBeGreaterThanOrEqual(2);
    expect(ej.cues.length).toBeLessThanOrEqual(4);
    expect(ej.errores.length).toBeGreaterThanOrEqual(1);
  });

  it('cues breves (≤ 90 caracteres)', () => {
    for (const c of ej.cues) expect((texto(c) ?? '').length).toBeLessThanOrEqual(90);
  });

  it('músculos válidos, sin repetir, y el grupo es el del primer principal', () => {
    const { principales, secundarios } = ej.musculos;
    expect(principales.length).toBeGreaterThan(0);
    for (const m of [...principales, ...secundarios]) expect(MUSCULOS).toContain(m);
    expect(principales.filter((m) => secundarios.includes(m))).toEqual([]);
    expect(new Set([...principales, ...secundarios]).size).toBe(principales.length + secundarios.length);
    expect(GRUPO_DE_MUSCULO[principales[0]]).toBe(ej.grupo);
  });

  it('material válido y no vacío', () => {
    expect(ej.material.length).toBeGreaterThan(0);
    for (const m of ej.material) expect(MATERIALES).toContain(m);
    if (ej.carga?.tipo === 'barra') expect(ej.material).toContain('barra');
    if (ej.carga?.tipo === 'mancuerna') expect(ej.material).toContain('mancuerna');
    if (ej.escenario?.some((e) => e.tipo === 'banco')) expect(ej.material).toContain('banco');
  });

  it('sustitutos: existen y no es él mismo', () => {
    for (const s of ej.sustitutos) {
      expect(s).not.toBe(ej.id);
      expect(ejercicioPorId(s)).toBeDefined();
    }
  });

  it('poses: al menos dos, la primera en 0, en orden y dentro del ciclo', () => {
    expect(ej.poses.length).toBeGreaterThanOrEqual(2);
    expect(ej.poses[0].ms).toBe(0);
    for (let i = 1; i < ej.poses.length; i++) expect(ej.poses[i].ms).toBeGreaterThan(ej.poses[i - 1].ms);
    expect(ej.poses[ej.poses.length - 1].ms).toBeLessThan(ej.cicloMs);
    expect(ej.cicloMs).toBeGreaterThanOrEqual(1500);
    expect(ej.cicloMs).toBeLessThanOrEqual(8000);
  });

  it('ángulos finitos y escorzo entre 0 y 1', () => {
    for (const p of ej.poses) {
      expect(Number.isFinite(p.cuello)).toBe(true);
      for (const lado of [p.cerca, p.lejos ?? p.cerca]) for (const a of ARTICULACIONES) expect(Number.isFinite(lado[a])).toBe(true);
      for (const v of Object.values(p.escorzo ?? {})) {
        expect(v).toBeGreaterThan(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });

  it('límites anatómicos en las articulaciones que no salen del plano', () => {
    const enPlano = (p: Pose, seg: 'brazo_c' | 'antebrazo_c' | 'brazo_l' | 'antebrazo_l') => (p.escorzo?.[seg] ?? 1) >= 0.9;
    for (const p of ej.poses) {
      expect(p.cuello).toBeGreaterThanOrEqual(-30);
      expect(p.cuello).toBeLessThanOrEqual(45);
      for (const [lado, sufijo] of [
        [p.cerca, 'c'],
        [p.lejos ?? p.cerca, 'l'],
      ] as const) {
        expect(lado.rodilla).toBeGreaterThanOrEqual(-5);
        expect(lado.rodilla).toBeLessThanOrEqual(150);
        expect(lado.cadera).toBeGreaterThanOrEqual(-30);
        expect(lado.cadera).toBeLessThanOrEqual(150);
        expect(lado.tobillo).toBeGreaterThanOrEqual(-50);
        expect(lado.tobillo).toBeLessThanOrEqual(45);
        if (enPlano(p, `brazo_${sufijo}`) && enPlano(p, `antebrazo_${sufijo}`)) {
          expect(lado.codo).toBeGreaterThanOrEqual(-5);
          expect(lado.codo).toBeLessThanOrEqual(150);
          expect(lado.hombro).toBeGreaterThanOrEqual(-60);
          expect(lado.hombro).toBeLessThanOrEqual(180);
        }
      }
    }
  });

  it('msFicha, si está, cae dentro del ciclo', () => {
    if (ej.msFicha !== undefined) {
      expect(ej.msFicha).toBeGreaterThanOrEqual(0);
      expect(ej.msFicha).toBeLessThan(ej.cicloMs);
    }
  });

  it('fase de esfuerzo: al menos una, dentro del ciclo y en orden', () => {
    expect(ej.esfuerzo.length).toBeGreaterThan(0);
    for (const f of ej.esfuerzo) {
      expect(f.desde).toBeGreaterThanOrEqual(0);
      expect(f.hasta).toBeLessThanOrEqual(ej.cicloMs);
      expect(f.hasta).toBeGreaterThan(f.desde);
    }
  });

  it('todos los músculos se dibujan siempre (los que no trabaja, en su capa gris)', () => {
    const r = ranuras(ej.vista);
    const capas = dibujar(ej, 0);
    const de = (clave: string) => capas[r.findIndex((x) => x.clave === clave)];
    // Tronco, muslo y brazo cercanos llevan piezas musculares en alguna de sus tres capas.
    for (const seg of ['tronco', 'muslo_c', 'brazo_c']) {
      expect(`${de(`${seg}:m`)}${de(`${seg}:s`)}${de(`${seg}:p`)}`.length).toBeGreaterThan(0);
    }
    // El principal siempre se ve en la capa del acento.
    expect(r.some((x, i) => x.estilo === 'principal' && capas[i].length > 0)).toBe(true);
  });

  it('isométrico = todas las poses iguales; dinámico = alguna distinta', () => {
    const firma = (p: Pose) => JSON.stringify({ c: p.cerca, l: p.lejos, n: p.cuello, e: p.escorzo, a: p.angulo });
    const distintas = new Set(ej.poses.map(firma)).size;
    if (ej.tipo === 'isometrico') expect(distintas).toBe(1);
    else expect(distintas).toBeGreaterThan(1);
  });

  it('el dibujo tiene una capa por ranura y ningún número roto', () => {
    const r = ranuras(ej.vista);
    for (const ms of [0, ej.cicloMs / 3, ej.cicloMs / 2, ej.cicloMs - 1]) {
      const capas = dibujar(ej, ms);
      expect(capas).toHaveLength(r.length);
      expect(capas.join(' ')).not.toMatch(/NaN|Infinity|undefined/);
    }
  });
});

describe('mapa muscular', () => {
  it('cada músculo tiene forma lateral y frontal, y se ve por delante o por detrás', () => {
    for (const m of MUSCULOS) {
      expect(FORMAS_LATERAL[m].length).toBeGreaterThan(0);
      expect(FORMAS_FRONTAL[m].length).toBeGreaterThan(0);
    }
  });

  it('cada músculo y cada grupo tiene nombre en el catálogo', () => {
    for (const m of MUSCULOS) {
      expect(texto(`iron:musculo.${m}`)).toBeTruthy();
      expect(texto(`iron:grupo.${GRUPO_DE_MUSCULO[m]}`)).toBeTruthy();
    }
    for (const m of MATERIALES) expect(texto(`iron:material.${m}`)).toBeTruthy();
  });
});

describe('el tipo es estricto', () => {
  it('rechaza un ejercicio incompleto o con valores fuera del esquema (lo comprueba tsc)', () => {
    // @ts-expect-error falta todo lo obligatorio salvo el id
    const incompleto: Ejercicio = { id: 'x' };
    const malo: Pick<Ejercicio, 'material' | 'grupo'> = {
      // @ts-expect-error material que no existe
      material: ['pesa_rusa'],
      grupo: 'pierna',
    };
    // @ts-expect-error clave de texto sin el namespace iron:
    const nombre: Ejercicio['nombre'] = 'ejercicios.x.nombre';
    expect([incompleto, malo, nombre]).toHaveLength(3);
  });
});
