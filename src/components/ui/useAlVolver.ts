// NIVL · Recargar al volver a la app.
//
// Una pestaña montada no se vuelve a cargar sola: si dejas la app en segundo
// plano y vuelves al día siguiente, Hábitos o la Agenda siguen enseñando el
// día de ayer. Este gancho llama a `cb` al volver a primer plano y también si,
// sin salir, ha cambiado el día (lo comprueba en cada vuelta).

import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { dateKey } from '@/lib/dates';

/**
 * Decisión pura: ¿hay que recargar? Sí al pasar de segundo plano/inactiva a
 * activa, y también si la clave del día ya no es la de la última carga.
 */
export function debeRecargar(previo: AppStateStatus | string, siguiente: AppStateStatus | string, diaAnterior: string, diaActual: string): boolean {
  if (siguiente !== 'active') return false;
  if (previo === 'background' || previo === 'inactive') return true;
  return diaAnterior !== diaActual;
}

export function useAlVolver(cb: () => void): void {
  const ref = useRef(cb);
  ref.current = cb;
  useEffect(() => {
    let estado: AppStateStatus = AppState.currentState;
    let dia = dateKey();
    const sub = AppState.addEventListener('change', (siguiente) => {
      const hoy = dateKey();
      const recargar = debeRecargar(estado, siguiente, dia, hoy);
      estado = siguiente;
      if (recargar) {
        dia = hoy;
        ref.current();
      }
    });
    return () => sub.remove();
  }, []);
}
