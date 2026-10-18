// NIVL · Cuándo pedir la valoración de la tienda y cuándo la opinión interna
// (parte pura). Los efectos, en `peticiones.ts`. docs/modos/F1-analitica.md.
//
// Dos cosas INDEPENDIENTES:
//   · La valoración nativa (SKStoreReviewController / Play In-App Review): el
//     día 2-3 de uso, tras un momento bueno (misión completada o subida de
//     nivel); después, como mucho una vez cada 120 días. NUNCA depende de lo
//     que se haya contestado en la opinión interna ni de nada que mida si la
//     persona está contenta: Apple prohíbe el «review gating» (guía 5.6.1) y
//     Google lo mismo. Aquí ni siquiera se lee la opinión.
//   · La opinión interna («¿Qué te gusta? ¿Qué cambiarías?»): una sola vez,
//     el día 2-3, tras un momento bueno, y se puede cerrar.
// Si en el mismo momento tocan las dos, va la valoración y la opinión espera
// al siguiente momento bueno: dos ventanas seguidas serían un interrogatorio.

export const VENTANA_DIAS = { desde: 2, hasta: 3 } as const;
export const DIAS_ENTRE_VALORACIONES = 120;
const DIA_MS = 86_400_000;

export type MomentoPositivo = 'mision' | 'nivel';
export type Peticion = 'valoracion' | 'opinion';

export interface EstadoPeticiones {
  /**
   * Día local del primer momento bueno visto con los flags encendidos: de
   * aquí sale el «día 2-3». Es propio de esta pieza y NO depende de la
   * analítica (que solo existe con consentimiento): pedir opinión o
   * valoración no puede quedar atado a aceptar la medición.
   */
  primerDia: string | null;
  /** Última vez que se pidió la valoración nativa (ISO). */
  valoracionPedidaEn: string | null;
  /** Cuándo se enseñó la opinión interna (ISO). Una vez enseñada, no vuelve. */
  opinionVistaEn: string | null;
}

export const ESTADO_INICIAL: EstadoPeticiones = { primerDia: null, valoracionPedidaEn: null, opinionVistaEn: null };

export interface Contexto {
  /** Días desde el primer arranque (0 = el día de instalar). null = no se sabe. */
  diaDeUso: number | null;
  /** Flag `valoracion_activa` del servidor. */
  valoracionActiva: boolean;
  /** Flag `opinion_activa` del servidor. */
  opinionActiva: boolean;
  /** ¿Hay diálogo nativo en esta build? (expo-store-review enlazado y la tienda lo admite). */
  valoracionDisponible: boolean;
  ahora: number;
}

const enVentana = (dia: number | null) => dia !== null && dia >= VENTANA_DIAS.desde && dia <= VENTANA_DIAS.hasta;

export function tocaValoracion(estado: EstadoPeticiones, c: Contexto): boolean {
  if (!c.valoracionActiva || !c.valoracionDisponible) return false;
  if (!estado.valoracionPedidaEn) return enVentana(c.diaDeUso);
  const antes = Date.parse(estado.valoracionPedidaEn);
  if (!Number.isFinite(antes)) return enVentana(c.diaDeUso);
  return c.ahora - antes >= DIAS_ENTRE_VALORACIONES * DIA_MS;
}

export function tocaOpinion(estado: EstadoPeticiones, c: Contexto): boolean {
  return c.opinionActiva && !estado.opinionVistaEn && enVentana(c.diaDeUso);
}

/**
 * Lo que toca tras un momento bueno, y el estado que queda. Se marca al
 * decidir (no al terminar) para que un cierre de la app a mitad no repita.
 * El tipo de momento no cambia la decisión: misión y nivel valen igual.
 */
export function decidirPeticion(
  estado: EstadoPeticiones,
  c: Contexto,
): { peticion: Peticion | null; estado: EstadoPeticiones } {
  const iso = new Date(c.ahora).toISOString();
  if (tocaValoracion(estado, c)) return { peticion: 'valoracion', estado: { ...estado, valoracionPedidaEn: iso } };
  if (tocaOpinion(estado, c)) return { peticion: 'opinion', estado: { ...estado, opinionVistaEn: iso } };
  return { peticion: null, estado };
}

export function leerEstado(crudo: string | null): EstadoPeticiones {
  if (!crudo) return ESTADO_INICIAL;
  try {
    const v = JSON.parse(crudo) as Partial<EstadoPeticiones>;
    return {
      primerDia: typeof v.primerDia === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v.primerDia) ? v.primerDia : null,
      valoracionPedidaEn: typeof v.valoracionPedidaEn === 'string' ? v.valoracionPedidaEn : null,
      opinionVistaEn: typeof v.opinionVistaEn === 'string' ? v.opinionVistaEn : null,
    };
  } catch {
    return ESTADO_INICIAL;
  }
}

export const MAX_OPINION = 1000;

/** Lo que se manda de la opinión: recortado y con tope. null si no hay nada escrito. */
export function limpiarOpinion(gusta: string, cambiaria: string): { gusta: string | null; cambiaria: string | null } | null {
  const l = (s: string) => {
    const t = (s ?? '').trim().slice(0, MAX_OPINION);
    return t.length > 0 ? t : null;
  };
  const out = { gusta: l(gusta), cambiaria: l(cambiaria) };
  return out.gusta || out.cambiaria ? out : null;
}
