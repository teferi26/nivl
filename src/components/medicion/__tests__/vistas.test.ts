// NIVL · Medición: cada fase de las pantallas se pinta sin caerse y sin afirmar
// lo que el sensor no da.
import { createElement, type ReactElement } from 'react';
// @ts-expect-error jest-expo lo trae, sin tipos.
import { act, create } from 'react-test-renderer';
import type { EntrenoMedido } from '@/lib/entrenoMedido';
import type { EstadoGps } from '@/lib/medicion/saludNativa';
import type { ResultadoContraste } from '@/lib/medicion/contraste';
import { EntrenoGpsVista, type EntrenoGpsVistaProps, type PantallaGps } from '../EntrenoGpsVista';
import { SaludConexionVista, type SaludConexionVistaProps } from '../SaludConexionVista';
import { SelloMedicion } from '../SelloMedicion';

jest.mock('@/design/haptics', () => ({ vibrar: jest.fn() }));
jest.mock('@/lib/supabase', () => ({ supabase: {} }));

const nada = () => {};
const acciones = new Proxy({}, { get: () => nada });

const ESTADO: EstadoGps = {
  deporte: 'carrera',
  fase: 'midiendo',
  interrumpido: false,
  inicio: '2026-11-08T10:00:00.000Z',
  duracion_s: 125,
  distancia_m: 400,
  ritmo_s_km: null,
  precision_m: null,
  desnivel_m: null,
  parciales: [{ n: 1, tipo: 'km', distancia_m: 1000, duracion_s: 300, fc_media: null, desnivel_m: null }],
};

const ENTRENO: EntrenoMedido = {
  origen: 'iphone_gps',
  externo_id: 'x',
  deporte: 'bici',
  inicio: '2026-11-08T10:00:00.000Z',
  fin: '2026-11-08T10:30:00.000Z',
  duracion_s: 1800,
  distancia_m: 15000,
  kcal: null,
  fc_media: null,
  fc_max: null,
  desnivel_m: null,
  ruta: null,
  parciales: [],
  largo_piscina_m: null,
};

function textoDe(elemento: ReactElement): string {
  let raiz: { toJSON: () => unknown; unmount: () => void };
  act(() => {
    raiz = create(elemento);
  });
  const textos: string[] = [];
  const andar = (n: unknown) => {
    if (typeof n === 'string') textos.push(n);
    else if (Array.isArray(n)) n.forEach(andar);
    else if (n && typeof n === 'object' && 'children' in n) andar((n as { children: unknown }).children);
  };
  andar(raiz!.toJSON());
  act(() => raiz!.unmount());
  return textos.join(' ');
}

const gps = (pantalla: PantallaGps) =>
  textoDe(createElement(EntrenoGpsVista, { pantalla, acciones: acciones as EntrenoGpsVistaProps['acciones'] }));

const CATEGORIAS = Object.fromEntries(
  ['peso', 'pasos', 'energia', 'fc', 'sueno', 'entrenos'].map((c) => [c, { preguntada: c === 'entrenos', marcada: false }]),
) as SaludConexionVistaProps['categorias'];

const BASE: SaludConexionVistaProps = {
  cargado: true,
  noDisponible: null,
  errorCarga: null,
  categorias: CATEGORIAS,
  escribirEntrenos: false,
  pidiendo: false,
  avisoPermisos: null,
  errorPermisos: null,
  resumenHoy: { fecha: '2026-11-08', pasos: null, kcal_activas: 300, fc_media: null, fc_max: null, fc_reposo: null, sueno_min: null, peso_kg: null },
  trayendo: false,
  avisoTraer: null,
  errorTraer: null,
  enviarACoach: false,
  guardandoCoach: false,
  errorCoach: null,
  acciones: acciones as SaludConexionVistaProps['acciones'],
};

describe('EntrenoGpsVista', () => {
  it('sin módulo dice por qué', () => {
    expect(gps({ fase: 'no_disponible', motivo: 'android' })).toContain('Android');
    expect(gps({ fase: 'no_disponible', motivo: 'web' })).toContain('iPhone');
  });
  it('en marcha: tiempo, distancia, parciales y sin dato donde no hay', () => {
    const texto = gps({ fase: 'marcha', estado: ESTADO, segundos: 130, terminando: false, error: null });
    expect(texto).toContain('2:10');
    expect(texto).toContain('0,40');
    expect(texto).toContain('Parcial 1');
    expect(texto).toContain('-');
  });
  it('la sesión interrumpida ofrece reanudar y dice el hueco', () => {
    const texto = gps({ fase: 'interrumpida', estado: { ...ESTADO, interrumpido: true }, terminando: false, error: null });
    expect(texto).toMatch(/REANUDAR|Reanudar/);
    expect(texto).toContain('no se midió nada');
  });
  it('el resumen no promete puntos y avisa de otro día', () => {
    const normal = gps({ fase: 'resumen', entreno: ENTRENO, pendiente: false, deOtroDia: false });
    expect(normal).not.toMatch(/XP/);
    expect(gps({ fase: 'resumen', entreno: ENTRENO, pendiente: false, deOtroDia: true })).toContain('no cuenta para aquel día');
    expect(gps({ fase: 'resumen', entreno: ENTRENO, pendiente: true, deOtroDia: false })).toContain('a salvo');
    expect(gps({ fase: 'resumen', entreno: ENTRENO, pendiente: false, duplicada: true, deOtroDia: false })).toContain('Ya la teníamos');
  });
  it('el resto de fases se pinta', () => {
    expect(gps({ fase: 'permiso', denegado: true, pidiendo: false, error: null })).toContain('Ajustes');
    expect(gps({ fase: 'listo', deporte: 'bici', autoPausa: true, empezando: false, error: null })).toContain('Bici');
    expect(gps({ fase: 'corta' })).toContain('30 segundos');
  });
});

describe('SaludConexionVista', () => {
  it('explica las categorías y deja claro que el coach es otra aceptación', () => {
    const texto = textoDe(createElement(SaludConexionVista, BASE));
    expect(texto).toContain('Frecuencia cardiaca');
    expect(texto).toContain('otra aceptación');
    expect(texto).toContain('Lo que marques allí es lo que vale');
  });
  it('sin Salud dice por qué, sin pedir nada', () => {
    const texto = textoDe(createElement(SaludConexionVista, { ...BASE, noDisponible: 'sin_modulo' }));
    expect(texto).toContain('no trae la conexión');
    expect(texto).not.toContain('Frecuencia cardiaca');
  });
});

describe('SelloMedicion', () => {
  const con = (estado: ResultadoContraste['estado']): ResultadoContraste => ({
    estado,
    detalle: { clave: 'medicion:contraste.sinDatos', valores: {} },
  });
  it('sin datos no pinta nada: sin reloj no se marca ninguna sesión', () => {
    expect(textoDe(createElement(SelloMedicion, { resultado: con('sin_datos') }))).toBe('');
    expect(textoDe(createElement(SelloMedicion, { resultado: undefined }))).toBe('');
  });
  it('los sellos son neutros', () => {
    expect(textoDe(createElement(SelloMedicion, { resultado: con('medido') }))).toContain('Medido');
    expect(textoDe(createElement(SelloMedicion, { resultado: con('coherente') }))).toContain('Coherente');
  });
});
