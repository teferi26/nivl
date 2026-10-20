// NIVL · IRON · Efectos del historial de un ejercicio en /iron/[id]: trae lo
// que guarda Gimnasio (historialDatos.ts) y lo resume con la lógica pura de
// historial.ts, casando por el mismo casado de «Ver técnica». Se recarga al
// volver a la pantalla (tras registrar una sesión, por ejemplo).

import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ejercicioIronDe } from '@/iron/catalogo';
import { resumenHistorial, type ResumenHistorial } from '@/iron/historial';
import { fetchDatosHistorial } from '@/iron/historialDatos';
import type { Ejercicio } from '@/iron/tipos';
import { dateKey } from '@/lib/dates';
import { mensajeSistema } from '@/lib/validation';

export type EstadoHistorialIron =
  | { readonly estado: 'cargando' }
  | { readonly estado: 'error'; readonly mensaje: string; readonly reintentar: () => void }
  | { readonly estado: 'listo'; readonly resumen: ResumenHistorial };

const idDe = (nombre: string) => ejercicioIronDe(nombre)?.id ?? null;

export function useHistorialIron(ejercicio: Ejercicio | undefined): EstadoHistorialIron {
  const [estado, setEstado] = useState<EstadoHistorialIron>({ estado: 'cargando' });
  const vigente = useRef(0);

  const cargar = useCallback(() => {
    if (!ejercicio) return;
    const turno = ++vigente.current;
    fetchDatosHistorial()
      .then((datos) => {
        if (turno !== vigente.current) return;
        setEstado({ estado: 'listo', resumen: resumenHistorial(ejercicio, datos, idDe, dateKey()) });
      })
      .catch((e: unknown) => {
        if (turno !== vigente.current) return;
        setEstado({
          estado: 'error',
          mensaje: mensajeSistema(e),
          reintentar: () => {
            setEstado({ estado: 'cargando' });
            cargar();
          },
        });
      });
  }, [ejercicio]);

  useFocusEffect(
    useCallback(() => {
      cargar();
      return () => {
        // Lo que llegue después de salir no pinta nada.
        vigente.current++;
      };
    }, [cargar]),
  );

  return estado;
}
