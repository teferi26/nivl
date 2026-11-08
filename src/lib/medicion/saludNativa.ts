// NIVL · Envoltura tipada del módulo nativo `NivlSalud` (modules/nivl-salud).
//
// Sin módulo (Expo Go, web, Android, binarios anteriores) todo responde «no
// disponible» sin lanzar, y un fallo nativo cuenta igual: ninguna pantalla debe
// caerse porque HealthKit o el GPS no estén. HealthKit no dice si se concedió
// la lectura; solo si ya se preguntó.

import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';
import type { DeporteEntreno, Parcial } from '@/lib/entrenoMedido';

export type CategoriaSalud = 'peso' | 'pasos' | 'energia' | 'fc' | 'sueno' | 'entrenos';
export const CATEGORIAS_SALUD: readonly CategoriaSalud[] = ['peso', 'pasos', 'energia', 'fc', 'sueno', 'entrenos'];

export interface ResumenDia {
  fecha: string;
  pasos: number | null;
  kcal_activas: number | null;
  fc_media: number | null;
  fc_max: number | null;
  fc_reposo: number | null;
  sueno_min: number | null;
  peso_kg: number | null;
}

export interface VentanaActividad {
  kcal_activas: number | null;
  pasos: number | null;
  fc_media: number | null;
  fc_max: number | null;
  muestras_fc: number;
}

export interface LoteSalud {
  entrenos: string[];
  ancla: string | null;
  /** Salud no ha respondido: distinto de no tener nada nuevo. */
  fallo?: boolean;
}

export interface ResultadoParar {
  /** El módulo ha fallado: distinto de una sesión demasiado corta. */
  fallo: boolean;
  /** El JSON del EntrenoMedido; null si fue muy corto o no hay puntos. */
  json: string | null;
}

export type PermisoGps = 'sin_decidir' | 'denegado' | 'en_uso' | 'siempre';
export type DeporteGps = Extract<DeporteEntreno, 'carrera' | 'bici'>;

export interface EstadoGps {
  deporte: DeporteGps;
  fase: 'midiendo' | 'pausa_auto' | 'pausa';
  interrumpido: boolean;
  inicio: string;
  duracion_s: number;
  distancia_m: number;
  ritmo_s_km: number | null;
  precision_m: number | null;
  desnivel_m: number | null;
  parciales: Parcial[];
}

interface ModuloNivlSalud {
  disponible(): boolean;
  pedirPermisos(categorias: string[], escribirEntrenos: boolean): Promise<void>;
  hayQuePreguntar(categorias: string[]): Promise<boolean>;
  resumenDia(fecha: string): Promise<ResumenDia>;
  ventanaActividad(inicioISO: string, finISO: string): Promise<VentanaActividad>;
  entrenosNuevos(limite: number): Promise<LoteSalud>;
  confirmarAncla(ancla: string): void;
  reiniciarAncla(): void;
  gpsPermiso(): PermisoGps;
  gpsPedirPermiso(): Promise<string>;
  gpsEmpezar(deporte: DeporteGps, autoPausa: boolean): Promise<void>;
  gpsPausar(): void;
  gpsReanudar(): void;
  gpsParar(conSalud: boolean): Promise<string | null>;
  gpsDescartar(): void;
  gpsEstado(): EstadoGps | null;
  addListener(evento: 'onGps', fn: (estado: EstadoGps) => void): { remove: () => void };
}

const nativo: ModuloNivlSalud | null =
  Platform.OS === 'ios' ? requireOptionalNativeModule<ModuloNivlSalud>('NivlSalud') : null;

/** ¿Existe el módulo en este binario? El GPS no necesita que haya HealthKit. */
export function hayModuloSalud(): boolean {
  return nativo !== null;
}

export function disponible(): boolean {
  try {
    return nativo?.disponible() === true;
  } catch {
    return false;
  }
}

/** true si el diálogo se resolvió, que no significa que se concediera nada. */
export async function pedirPermisos(categorias: CategoriaSalud[], escribirEntrenos: boolean): Promise<boolean> {
  if (!nativo || !disponible()) return false;
  try {
    await nativo.pedirPermisos(categorias, escribirEntrenos);
    return true;
  } catch {
    return false;
  }
}

/** Sin módulo es true: no consta que se haya preguntado, así que nada se lee. */
export async function hayQuePreguntar(categorias: CategoriaSalud[]): Promise<boolean> {
  if (!nativo || !disponible()) return true;
  try {
    return await nativo.hayQuePreguntar(categorias);
  } catch {
    return true;
  }
}

function numero(x: unknown, min: number, max: number, decimales = 0): number | null {
  if (typeof x !== 'number' || !Number.isFinite(x)) return null;
  const factor = 10 ** decimales;
  const v = Math.round(x * factor) / factor;
  return v >= min && v <= max ? v : null;
}

/** Deja un día en los rangos de la tabla: un sensor raro no tumba la subida. */
export function limpiarResumen(fecha: string, r: Partial<ResumenDia> | null | undefined): ResumenDia {
  return {
    fecha,
    pasos: numero(r?.pasos, 0, 300000),
    kcal_activas: numero(r?.kcal_activas, 0, 30000),
    fc_media: numero(r?.fc_media, 25, 250),
    fc_max: numero(r?.fc_max, 25, 250),
    fc_reposo: numero(r?.fc_reposo, 25, 250),
    sueno_min: numero(r?.sueno_min, 0, 1440),
    peso_kg: numero(r?.peso_kg, 20.01, 399.99, 2),
  };
}

export async function resumenDia(fecha: string): Promise<ResumenDia | null> {
  if (!nativo || !disponible()) return null;
  try {
    return limpiarResumen(fecha, await nativo.resumenDia(fecha));
  } catch {
    return null;
  }
}

export async function ventanaActividad(inicioISO: string, finISO: string): Promise<VentanaActividad | null> {
  if (!nativo || !disponible()) return null;
  try {
    return await nativo.ventanaActividad(inicioISO, finISO);
  } catch {
    return null;
  }
}

export async function entrenosNuevos(limite: number): Promise<LoteSalud> {
  if (!nativo || !disponible()) return { entrenos: [], ancla: null };
  try {
    return await nativo.entrenosNuevos(limite);
  } catch {
    return { entrenos: [], ancla: null, fallo: true };
  }
}

export function confirmarAncla(ancla: string): void {
  try {
    nativo?.confirmarAncla(ancla);
  } catch {
    // Sin ancla nueva se releen los mismos: guardar es idempotente.
  }
}

export function reiniciarAncla(): void {
  try {
    nativo?.reiniciarAncla();
  } catch {
    // Nada que reiniciar.
  }
}

export function gpsPermiso(): PermisoGps {
  try {
    return nativo?.gpsPermiso() ?? 'denegado';
  } catch {
    return 'denegado';
  }
}

export async function gpsPedirPermiso(): Promise<PermisoGps> {
  if (!nativo) return 'denegado';
  try {
    return (await nativo.gpsPedirPermiso()) as PermisoGps;
  } catch {
    return 'denegado';
  }
}

/** false si la sesión no ha arrancado. */
export async function gpsEmpezar(deporte: DeporteGps, autoPausa: boolean): Promise<boolean> {
  if (!nativo) return false;
  try {
    await nativo.gpsEmpezar(deporte, autoPausa);
    return true;
  } catch {
    return false;
  }
}

export function gpsPausar(): void {
  try {
    nativo?.gpsPausar();
  } catch {
    // Si no hay sesión, no hay nada que pausar.
  }
}

export function gpsReanudar(): void {
  try {
    nativo?.gpsReanudar();
  } catch {
    // Si no hay sesión, no hay nada que reanudar.
  }
}

/** `conSalud` false: sin permiso de salud no se lee pulso ni se escribe en Salud. */
export async function gpsParar(conSalud: boolean): Promise<ResultadoParar> {
  if (!nativo) return { fallo: true, json: null };
  try {
    return { fallo: false, json: await nativo.gpsParar(conSalud) };
  } catch {
    return { fallo: true, json: null };
  }
}

export function gpsDescartar(): void {
  try {
    nativo?.gpsDescartar();
  } catch {
    // Si no hay sesión, no hay nada que descartar.
  }
}

export function gpsEstado(): EstadoGps | null {
  try {
    return nativo?.gpsEstado() ?? null;
  } catch {
    return null;
  }
}

export function escucharGps(fn: (estado: EstadoGps) => void): () => void {
  if (!nativo) return () => {};
  try {
    const sub = nativo.addListener('onGps', fn);
    return () => sub.remove();
  } catch {
    return () => {};
  }
}
