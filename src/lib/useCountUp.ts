// NIVL · Una cifra que sube hasta su valor en vez de saltar.
//
// La primera vez pinta el valor tal cual (una pantalla que carga no tiene nada
// que celebrar); a partir de ahí, cada cambio se recorre en `duration` ms con
// salida suave. Con "reducir movimiento" activado, salta.

import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

export function useCountUp(value: number, duration = 600): number {
  const [shown, setShown] = useState(value);
  const desde = useRef(value);
  const quieto = useRef(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then((r) => {
        quieto.current = r;
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const inicio = desde.current;
    if (inicio === value) return;
    if (quieto.current || duration <= 0) {
      desde.current = value;
      setShown(value);
      return;
    }
    let raf = 0;
    const t0 = Date.now();
    const paso = () => {
      const p = Math.min(1, (Date.now() - t0) / duration);
      const suave = 1 - Math.pow(1 - p, 3);
      const actual = Math.round(inicio + (value - inicio) * suave);
      desde.current = actual;
      setShown(actual);
      if (p < 1) raf = requestAnimationFrame(paso);
    };
    raf = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return shown;
}
