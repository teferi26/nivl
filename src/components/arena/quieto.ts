// NIVL · Arena: «quieto», solo para la galería de desarrollo.
//
// /kit/pantallas?quieto=1 lo enciende para poder capturar con Chrome sin
// cabeza: Entrada, Contador y Barra pintan el valor final sin animar, como con
// «reducir movimiento». En producción `__DEV__` es false: fijarQuieto no hace
// nada y el hook devuelve lo mismo que useMovimientoReducido.

import { useMovimientoReducido } from '@/components/ui/motion';

let quieto = false;

/** La galería lo fija en cada render, antes de pintar las piezas. */
export function fijarQuieto(valor: boolean): void {
  if (__DEV__) quieto = valor;
}

/** Movimiento reducido del sistema, o forzado por la galería en desarrollo. */
export function useMovimientoArena(): boolean {
  const reducido = useMovimientoReducido();
  return reducido || (__DEV__ && quieto);
}

/** Lo mismo, fuera de un hook (Entrada en la web decide antes del FadeIn). */
export function estaQuieto(): boolean {
  return __DEV__ && quieto;
}
