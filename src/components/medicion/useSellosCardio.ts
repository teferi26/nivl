// NIVL · Cardio: el sello de cada sesión del historial.
//
// Aparte de useCardio a propósito: el contraste es solo informativo y no debe
// compartir módulo con el pago de XP. Un fallo aquí deja las filas sin sello,
// que es exactamente lo mismo que no tener reloj: nunca acusa de nada.

import { useEffect, useState } from 'react';
import { useHealthConsent } from '@/components/ConsentimientoSalud';
import { useAuth } from '@/lib/auth';
import type { CardioSession } from '@/lib/bodywork';
import { almacenEntrenos } from '@/lib/medicion/almacen';
import { contrastar, type ResultadoContraste } from '@/lib/medicion/contraste';
import { deporteDeCardio } from './puro';

export function useSellosCardio(sesiones: CardioSession[]): Record<string, ResultadoContraste> {
  const { session } = useAuth();
  const userId = session?.user.id;
  const { accepted } = useHealthConsent();
  const [sellos, setSellos] = useState<Record<string, ResultadoContraste>>({});

  useEffect(() => {
    if (!userId || !accepted || sesiones.length === 0) {
      setSellos({});
      return;
    }
    let vigente = true;
    const desde = sesiones.reduce((min, s) => (s.date < min ? s.date : min), sesiones[0]!.date);
    (async () => {
      try {
        const entrenos = await almacenEntrenos().listarRecientes(userId, desde);
        const nuevos: Record<string, ResultadoContraste> = {};
        for (const s of sesiones) {
          nuevos[s.id] = contrastar(
            {
              tipo: 'cardio',
              deporte: deporteDeCardio(s.kind),
              fecha: s.date,
              duracion_min: Number(s.duration_min),
              distancia_km: s.distance_km === null ? null : Number(s.distance_km),
            },
            { entrenos, actividad: null },
          );
        }
        if (vigente) setSellos(nuevos);
      } catch {
        if (vigente) setSellos({});
      }
    })();
    return () => {
      vigente = false;
    };
  }, [userId, accepted, sesiones]);

  return sellos;
}
