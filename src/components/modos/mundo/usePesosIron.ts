// NIVL · Mundo IRON: tus pesos y récords (efectos). Lee lo mismo que la
// ficha de técnica (iron/historialDatos.ts) y lo resume con la lógica pura de
// iron/pesos.ts, casando con el catálogo por el mismo `idDe` de «Ver técnica».
// Se relee al volver a la pantalla (tras registrar una sesión).

import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { textoIron } from '@/components/iron/texto';
import { ejercicioIronDe } from '@/iron/catalogo';
import { ejercicioPorId } from '@/iron/ejercicios';
import { fetchDatosHistorial } from '@/iron/historialDatos';
import { resumenPesos } from '@/iron/pesos';
import { dateKey } from '@/lib/dates';
import { mensajeSistema } from '@/lib/validation';

export interface FilaPeso {
  clave: string;
  /** En el idioma de la interfaz si casa con el catálogo; si no, como se escribió. */
  nombre: string;
  kg: number;
  /** Kilos ganados en 6 semanas; null sin dos sesiones en la ventana. */
  subida: number | null;
  record: boolean;
  /** 1RM estimado de la mejor marca. */
  e1rm: number | null;
  sesiones: number;
  onTecnica?: () => void;
}

export type EstadoPesos =
  | { readonly estado: 'cargando' }
  | { readonly estado: 'error'; readonly mensaje: string; readonly reintentar: () => void }
  | { readonly estado: 'listo'; readonly filas: readonly FilaPeso[] };

const idDe = (nombre: string) => ejercicioIronDe(nombre)?.id ?? null;

export function usePesosIron(): EstadoPesos {
  const [estado, setEstado] = useState<EstadoPesos>({ estado: 'cargando' });
  const vigente = useRef(0);

  const cargar = useCallback(() => {
    const turno = ++vigente.current;
    fetchDatosHistorial()
      .then((datos) => {
        if (turno !== vigente.current) return;
        const filas = resumenPesos(datos.filas, idDe, dateKey()).map((p): FilaPeso => {
          const ej = p.idCatalogo ? ejercicioPorId(p.idCatalogo) : undefined;
          return {
            clave: p.clave,
            nombre: ej ? textoIron(ej.nombre) : p.nombre,
            kg: p.ultimoKg,
            subida: p.subida,
            record: p.record,
            e1rm: p.mejor?.e1rm ?? null,
            sesiones: p.sesiones,
            onTecnica: ej ? () => router.push({ pathname: '/iron/[id]', params: { id: ej.id } }) : undefined,
          };
        });
        setEstado({ estado: 'listo', filas });
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
  }, []);

  useFocusEffect(
    useCallback(() => {
      cargar();
      return () => {
        vigente.current++;
      };
    }, [cargar]),
  );

  return estado;
}
