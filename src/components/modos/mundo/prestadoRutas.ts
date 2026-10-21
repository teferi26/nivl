// NIVL · Modos: el estado y las rutas de una pantalla prestada a General
// (Prestado.tsx). Sin React: lo usa también pedido.ts, que navega fuera de React.

let prestadas = 0;

export function entrarPrestado(): void {
  prestadas += 1;
}

export function salirPrestado(): void {
  prestadas = Math.max(0, prestadas - 1);
}

/** ¿Hay una pantalla prestada a la vista? */
export function enPrestado(): boolean {
  return prestadas > 0;
}

export type DestinoFocus = 'hoy' | 'examenes' | 'temario' | 'coach';

/** Las rutas de FOCUS según se esté dentro del mundo o prestado a General. */
export function rutaFocus(destino: DestinoFocus): '/focus-hoy' | '/focus-examenes' | '/focus-temario' | '/focus-coach' | '/foco' | '/examenes' | '/temario' | '/(tabs)/coach' {
  if (!enPrestado()) return destino === 'hoy' ? '/focus-hoy' : destino === 'examenes' ? '/focus-examenes' : destino === 'temario' ? '/focus-temario' : '/focus-coach';
  return destino === 'hoy' ? '/foco' : destino === 'examenes' ? '/examenes' : destino === 'temario' ? '/temario' : '/(tabs)/coach';
}
