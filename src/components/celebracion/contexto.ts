// NIVL · Contrato de la cola de celebraciones (L3). Las pantallas solo
// dependen de esto; el proveedor (CelebracionProvider) lo implementa. Con el
// valor por defecto (no-op) todo compila y nada celebra.

import { createContext, useContext } from 'react';
import type { Celebracion, LogroInfo } from '@/lib/progression';
import type { Tarjeta } from '@/lib/sharecard';

export interface PerfilEco {
  xp_total: number;
  streak_days: number;
  protection_stones: number;
}

export interface AccionCelebrable {
  /** Id de la acción, p. ej. `mision:${id}:${Date.now()}`: agrupa lo que llega por separado. */
  accion: string;
  perfilAntes?: PerfilEco;
  perfilDespues?: PerfilEco;
  logrosAntes?: Iterable<string>;
  logrosNuevos?: LogroInfo[];
  /** Fecha local (dateKey), nunca toISOString. */
  fecha?: string;
  recuperadoXp?: number;
  /** Celebraciones ya construidas, p. ej. celebracionInsignia(...). */
  extra?: Celebracion[];
  /** Líneas de resumen: «+50 XP · FUE», «+1 PB». */
  resumen?: string[];
  /** Cierra la ventana de la acción. */
  final?: boolean;
  /** Días activos de sincronizarRangoDetalle(): da la cifra del «siguiente rango». */
  diasActivos?: number | null;
}

export interface CelebracionApi {
  /** true mientras hay ceremonia o toast: la oferta Pro no se abre encima (Chat 2). */
  celebrando: boolean;
  celebrar(a: AccionCelebrable): void;
  /** Toast suelto, por la misma cola: nunca dos a la vez. */
  avisar(texto: string): void;
  /**
   * Abre HojaCompartir en la capa raíz (pausa la cola mientras está abierta).
   * `retratoUri`: el retrato del usuario para la tarjeta (p. ej. la de rango en Perfil).
   */
  compartir(t: Tarjeta, opciones?: OpcionesCompartir): void;
}

export interface OpcionesCompartir {
  retratoUri?: string | null;
}

const NOOP: CelebracionApi = { celebrando: false, celebrar: () => {}, avisar: () => {}, compartir: () => {} };

export const CelebracionContext = createContext<CelebracionApi>(NOOP);

export function useCelebracion(): CelebracionApi {
  return useContext(CelebracionContext);
}
