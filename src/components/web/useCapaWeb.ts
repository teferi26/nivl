// NIVL · Una capa a pantalla completa que no es un Modal, en la web.
//
// La hoja de compartir no puede ir en un Modal (en Android la captura sale
// negra), así que tampoco hereda lo que el Modal da en el navegador: el foco
// entra en la capa, Tab no se escapa a lo que queda debajo, Escape cierra y al
// cerrar el foco vuelve a donde estaba. En nativo no hace nada.

import { useEffect, useRef, type RefObject } from 'react';
import { Platform, type View } from 'react-native';

const ENFOCABLES = 'a[href],button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex="0"]';

let abiertas = 0;

/** ¿Hay una capa abierta? Quien escuche teclas en el documento debe callarse entonces. */
export function hayCapaWeb(): boolean {
  return abiertas > 0;
}

export function useCapaWeb(capa: RefObject<View | null>, visible: boolean, onCerrar: () => void): void {
  const cerrar = useRef(onCerrar);
  cerrar.current = onCerrar;

  useEffect(() => {
    if (Platform.OS !== 'web' || !visible || typeof document === 'undefined') return;
    abiertas += 1;
    const previo = document.activeElement as HTMLElement | null;
    const nodo = capa.current as unknown as HTMLElement | null;
    const enfocables = (): HTMLElement[] => (nodo ? Array.from(nodo.querySelectorAll<HTMLElement>(ENFOCABLES)).filter((n) => n.offsetParent !== null) : []);
    enfocables()[0]?.focus();

    const alPulsar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        cerrar.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const lista = enfocables();
      if (!lista.length) return;
      const primero = lista[0];
      const ultimo = lista[lista.length - 1];
      const activo = document.activeElement as HTMLElement | null;
      const dentro = !!activo && !!nodo?.contains(activo);
      if (e.shiftKey ? activo === primero || !dentro : activo === ultimo || !dentro) {
        e.preventDefault();
        (e.shiftKey ? ultimo : primero).focus();
      }
    };
    document.addEventListener('keydown', alPulsar, true);
    return () => {
      abiertas -= 1;
      document.removeEventListener('keydown', alPulsar, true);
      if (previo?.isConnected) previo.focus();
    };
  }, [capa, visible]);
}
