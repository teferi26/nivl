// NIVL · Mundo IRON: tus pesos y récords (efectos). Lee lo mismo que la ficha
// de técnica (iron/historialDatos → `gym_lifts`) y lo resume con la lógica
// pura de iron/pesos.ts (con la serie de la gráfica), casando con el catálogo
// por el mismo `idDe` de «Ver técnica». Se relee al volver a la pantalla.
// Nació del antiguo usePesosIron del mundo (ya borrado) con la serie de cada ejercicio para la gráfica.

import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { textoIron } from '@/components/iron/texto';
import { ejercicioIronDe } from '@/iron/catalogo';
import { ejercicioPorId } from '@/iron/ejercicios';
import { fetchDatosHistorial } from '@/iron/historialDatos';
import { resumenPesos } from '@/iron/pesos';
import { dateKey } from '@/lib/dates';
import { mensajeSistema } from '@/lib/validation';

export interface PesoIron {
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
  /** La carga más alta de cada una de las últimas sesiones (la gráfica). */
  serie: readonly number[];
  ultimaFecha: string;
  onTecnica?: () => void;
}

export type EstadoPesosIron =
  | { readonly estado: 'cargando' }
  | { readonly estado: 'error'; readonly mensaje: string; readonly reintentar: () => void }
  | { readonly estado: 'listo'; readonly filas: readonly PesoIron[] };

const idDe = (nombre: string) => ejercicioIronDe(nombre)?.id ?? null;

export function usePesos(): EstadoPesosIron {
  const [estado, setEstado] = useState<EstadoPesosIron>({ estado: 'cargando' });
  const vigente = useRef(0);

  const cargar = useCallback(() => {
    const turno = ++vigente.current;
    fetchDatosHistorial()
      .then((datos) => {
        if (turno !== vigente.current) return;
        const filas = resumenPesos(datos.filas, idDe, dateKey()).map((p): PesoIron => {
          const ej = p.idCatalogo ? ejercicioPorId(p.idCatalogo) : undefined;
          return {
            clave: p.clave,
            nombre: ej ? textoIron(ej.nombre) : p.nombre,
            kg: p.ultimoKg,
            subida: p.subida,
            record: p.record,
            e1rm: p.mejor?.e1rm ?? null,
            sesiones: p.sesiones,
            serie: p.serie,
            ultimaFecha: p.ultimaFecha,
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
