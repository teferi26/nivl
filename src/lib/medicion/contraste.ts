// NIVL · Lo declarado frente a lo medido (puro, con tests).
//
// Solo informa: de aquí sale un sello y nada más. El estado JAMÁS cambia XP,
// racha ni penalización, y por eso ningún módulo del pago importa este archivo
// (medicion-fronteras.test.ts lo vigila). No existe un estado «no coincide»:
// nunca se afirma que alguien miente, y sin reloj el resultado es neutro.

import { dateKey, isValidKey } from '../dates';
import {
  esResistencia,
  externoManual,
  tipoCardioDe,
  type DeporteEntreno,
  type EntrenoMedido,
} from '../entrenoMedido';

export interface Declarado {
  tipo: 'cardio' | 'gym' | 'mision';
  deporte: DeporteEntreno | null;
  /** Clave local YYYY-MM-DD. */
  fecha: string;
  duracion_min: number | null;
  distancia_km: number | null;
}

/** La forma de `ventanaActividad` del módulo nativo. */
export interface ActividadVentana {
  kcal_activas: number | null;
  pasos: number | null;
  fc_media: number | null;
  fc_max: number | null;
  muestras_fc: number | null;
}

export interface DatosContraste {
  entrenos: readonly EntrenoMedido[];
  actividad: ActividadVentana | null;
}

export type EstadoContraste = 'medido' | 'coherente' | 'sin_datos';

/** Las claves de i18n que puede devolver `detalle.clave`. */
export const CLAVES_CONTRASTE = {
  medido: 'medicion:contraste.medido',
  introducidoAMano: 'medicion:contraste.introducidoAMano',
  cifrasAproximadas: 'medicion:contraste.cifrasAproximadas',
  actividad: 'medicion:contraste.actividad',
  sinDatos: 'medicion:contraste.sinDatos',
} as const;

export type ClaveContraste = (typeof CLAVES_CONTRASTE)[keyof typeof CLAVES_CONTRASTE];

export interface ResultadoContraste {
  estado: EstadoContraste;
  detalle: { clave: ClaveContraste; valores: Record<string, string> };
}

const TOLERANCIA_DURACION = 0.25;
const TOLERANCIA_DISTANCIA = 0.15;
// Umbrales altos a propósito: valen para un día entero y un error aquí solo
// deja un sello neutro. Una ventana corta suele entrar por el pulso.
const FC_ELEVADA = 110;
const MUESTRAS_FC_MINIMAS = 5;
const KCAL_ACTIVAS_ALTAS = 400;
const PASOS_ALTOS = 10000;
const KCAL_MAX = 30000;
const PASOS_MAX = 200000;

type Familia = 'cardio' | 'fuerza';

const familiaDe = (d: DeporteEntreno): Familia => (esResistencia(d) ? 'cardio' : 'fuerza');

/** Una misión sin deporte no tiene familia: la vale cualquier entreno. */
function familiaDeclarada(d: Declarado): Familia | null {
  if (d.tipo === 'gym') return 'fuerza';
  if (d.tipo === 'cardio') return 'cardio';
  return d.deporte === null ? null : familiaDe(d.deporte);
}

function deporteCompatible(declarado: DeporteEntreno | null, medido: DeporteEntreno): boolean {
  if (declarado === null || declarado === medido) return true;
  // Muchas apps exportan a Salud con un tipo genérico: `otro` no desmiente a nadie.
  if (declarado === 'otro' || medido === 'otro') return familiaDe(declarado) === familiaDe(medido);
  // Piscina y aguas abiertas son ambas «nadar» en lo que se apunta a mano.
  return tipoCardioDe(declarado) === tipoCardioDe(medido);
}

/** Un entreno que cruza medianoche pertenece a los dos días. */
function esDelDia(e: EntrenoMedido, fecha: string): boolean {
  return dateKey(new Date(e.inicio)) === fecha || dateKey(new Date(e.fin)) === fecha;
}

const cifraDeclarada = (x: number | null): number | null =>
  x !== null && Number.isFinite(x) && x > 0 ? x : null;

function dentroDe(declarado: number, medido: number, tolerancia: number): boolean {
  return Math.abs(declarado - medido) <= medido * tolerancia;
}

/** Lo que no se puede comparar (cinta sin distancia, cifra sin apuntar) no desmiente. */
function cifrasCasan(d: Declarado, e: EntrenoMedido): boolean {
  const minutos = cifraDeclarada(d.duracion_min);
  if (minutos !== null) {
    const segundos = minutos * 60;
    // Quien apunta a mano suele contar las pausas; `duracion_s` no las incluye.
    const reloj = (Date.parse(e.fin) - Date.parse(e.inicio)) / 1000;
    const casa =
      dentroDe(segundos, e.duracion_s, TOLERANCIA_DURACION) ||
      (reloj > 0 && dentroDe(segundos, reloj, TOLERANCIA_DURACION));
    if (!casa) return false;
  }
  const km = cifraDeclarada(d.distancia_km);
  if (km !== null && e.distancia_m !== null && e.distancia_m > 0) {
    return dentroDe(km * 1000, e.distancia_m, TOLERANCIA_DISTANCIA);
  }
  return true;
}

function enRango(x: number | null, min: number, max: number): x is number {
  return x !== null && Number.isFinite(x) && x >= min && x <= max;
}

function motivoActividad(a: ActividadVentana | null, familia: Familia | null): string | null {
  if (!a) return null;
  if (
    enRango(a.fc_media, FC_ELEVADA, 250) &&
    enRango(a.muestras_fc, MUESTRAS_FC_MINIMAS, Number.MAX_SAFE_INTEGER)
  ) {
    return 'fc';
  }
  if (enRango(a.kcal_activas, KCAL_ACTIVAS_ALTAS, KCAL_MAX)) return 'kcal';
  // Una sesión de fuerza apenas da pasos, y muchos pasos no dicen nada de ella.
  if (familia !== 'fuerza' && enRango(a.pasos, PASOS_ALTOS, PASOS_MAX)) return 'pasos';
  return null;
}

const SIN_DATOS: ResultadoContraste = {
  estado: 'sin_datos',
  detalle: { clave: CLAVES_CONTRASTE.sinDatos, valores: {} },
};

const prefijoManual = externoManual('');

export function contrastar(declarado: Declarado, datos: DatosContraste | null): ResultadoContraste {
  if (!isValidKey(declarado.fecha)) return SIN_DATOS;
  const familia = familiaDeclarada(declarado);
  const delDia = (datos?.entrenos ?? []).filter(
    (e) =>
      // La fila que nació de este mismo apunte no puede confirmarse a sí misma.
      !(e.origen === 'manual' && e.externo_id.startsWith(prefijoManual)) &&
      esDelDia(e, declarado.fecha) &&
      (familia === null || familiaDe(e.deporte) === familia) &&
      deporteCompatible(declarado.deporte, e.deporte),
  );
  const casan = delDia.filter((e) => cifrasCasan(declarado, e));
  const valoresDe = (e: EntrenoMedido) => ({ origen: e.origen, deporte: e.deporte });

  const medido = casan.find((e) => e.origen !== 'manual');
  if (medido) {
    return { estado: 'medido', detalle: { clave: CLAVES_CONTRASTE.medido, valores: valoresDe(medido) } };
  }
  // `manual` con UUID de Salud: alguien lo tecleó en otra app, no lo midió un sensor.
  if (casan[0]) {
    return {
      estado: 'coherente',
      detalle: { clave: CLAVES_CONTRASTE.introducidoAMano, valores: valoresDe(casan[0]) },
    };
  }
  if (delDia[0]) {
    return {
      estado: 'coherente',
      detalle: { clave: CLAVES_CONTRASTE.cifrasAproximadas, valores: valoresDe(delDia[0]) },
    };
  }
  const motivo = motivoActividad(datos?.actividad ?? null, familia);
  if (motivo) {
    return { estado: 'coherente', detalle: { clave: CLAVES_CONTRASTE.actividad, valores: { motivo } } };
  }
  return SIN_DATOS;
}
