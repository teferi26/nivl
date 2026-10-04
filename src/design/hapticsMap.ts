// NIVL · Mapa único de vibraciones (SISTEMA.md §9). Puro, sin React Native,
// para poder testearlo. Lo ejecuta `vibrar()` en src/design/haptics.ts.
//
// Ninguna pantalla elige el estilo por su cuenta: pide un evento.
// Nunca se usa la notificación de error: el sistema no castiga con el cuerpo.

export type EventoVibracion =
  | 'seleccion'
  | 'mision'
  | 'misionExtra'
  | 'diaPerfecto'
  | 'nivel'
  | 'rango'
  | 'rachaHito'
  | 'penalizacion'
  | 'destructiva'
  | 'recuperacion';

export interface Paso {
  /** seleccion = selectionAsync; success/warning = notificationAsync; el resto, impactAsync. */
  tipo: 'seleccion' | 'success' | 'warning' | 'light' | 'medium' | 'heavy' | 'rigid';
  /** Retardo desde el inicio del evento (ms). */
  tras: number;
}

export const VIBRACIONES: Record<EventoVibracion, readonly Paso[]> = {
  // Toque en chip, pestaña o selector.
  seleccion: [{ tipo: 'seleccion', tras: 0 }],
  // Misión completada.
  mision: [{ tipo: 'success', tras: 0 }],
  // Misión con foto o bonus.
  misionExtra: [
    { tipo: 'success', tras: 0 },
    { tipo: 'light', tras: 120 },
  ],
  // Día perfecto: tres golpes medios a 90 ms.
  diaPerfecto: [
    { tipo: 'medium', tras: 0 },
    { tipo: 'medium', tras: 90 },
    { tipo: 'medium', tras: 180 },
  ],
  // Subida de nivel: al aparecer el número.
  nivel: [{ tipo: 'heavy', tras: 0 }],
  // Subida de rango: el segundo golpe con la corona.
  rango: [
    { tipo: 'heavy', tras: 0 },
    { tipo: 'heavy', tras: 140 },
  ],
  // Racha hito (7, 30, 100). §9 no fija el retardo: 120 ms, como misionExtra,
  // porque dos llamadas simultáneas se funden en una en iOS.
  rachaHito: [
    { tipo: 'success', tras: 0 },
    { tipo: 'medium', tras: 120 },
  ],
  // Penalización o error: aviso, nunca Error.
  penalizacion: [{ tipo: 'warning', tras: 0 }],
  // Acción destructiva confirmada.
  destructiva: [{ tipo: 'rigid', tras: 0 }],
  // Recuperación abierta (RET-03).
  recuperacion: [{ tipo: 'success', tras: 0 }],
};
