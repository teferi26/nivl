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
  | 'recuperacion'
  // La rueda de modos (P01 + firmas de la P10): se abre, y cada modo encaja con
  // su firma durante la recarga (600 ms) y un golpe fuerte al final.
  | 'ruedaAbre'
  | 'modoGeneral'
  | 'modoIron'
  | 'modoFocus'
  | 'modoWork'
  | 'modoFounder';

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
  // La rueda se abre (tiempo bala): golpe medio.
  ruedaAbre: [{ tipo: 'medium', tras: 0 }],
  // NIVL: tres pulsos que suben y el cerrojo.
  modoGeneral: [
    { tipo: 'light', tras: 0 },
    { tipo: 'medium', tras: 150 },
    { tipo: 'heavy', tras: 300 },
    { tipo: 'heavy', tras: 600 },
  ],
  // IRON: un golpe seco con el clank del disco y el cerrojo.
  modoIron: [
    { tipo: 'heavy', tras: 130 },
    { tipo: 'heavy', tras: 600 },
  ],
  // FOCUS: dos pulsos suaves (la campana) y el cerrojo.
  modoFocus: [
    { tipo: 'light', tras: 0 },
    { tipo: 'light', tras: 160 },
    { tipo: 'heavy', tras: 600 },
  ],
  // WORK: el tic seco del interruptor (dos clics) y el cerrojo.
  modoWork: [
    { tipo: 'rigid', tras: 0 },
    { tipo: 'rigid', tras: 60 },
    { tipo: 'heavy', tras: 600 },
  ],
  // FOUNDER: la ignición, una vibración que crece, y el cerrojo.
  modoFounder: [
    { tipo: 'light', tras: 0 },
    { tipo: 'light', tras: 100 },
    { tipo: 'medium', tras: 200 },
    { tipo: 'medium', tras: 300 },
    { tipo: 'heavy', tras: 420 },
    { tipo: 'heavy', tras: 600 },
  ],
};
