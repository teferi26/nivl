// NIVL · Modos: el modo que el coach recibe (puro, sin Supabase).
//
// coach.ts es una librería (no un componente): no puede leer el contexto de
// Modos. El ModoProvider deja aquí el modo activo cuando el interruptor
// `modos_activos` está encendido (null si está apagado), y coach.ts añade la
// cabecera `x-nivl-modo` con lo que haya. Con el interruptor apagado no se
// envía nada y el turno es idéntico al de hoy.

import { cabeceraModo, type ModoId } from './tipos';

let modoCoach: ModoId | null = null;

/** Solo ModoProvider (y las pruebas): null = interruptor apagado. */
export function fijarModoCoach(modo: ModoId | null): void {
  modoCoach = modo;
}

/** Las cabeceras de modo para el próximo turno del coach (vacías si no toca). */
export function cabecerasModoCoach(): Record<string, string> {
  return cabeceraModo(modoCoach, modoCoach !== null);
}
