// NIVL · WORK: los datos del mundo, compartidos por sus pestañas (efectos).
//
// Un almacén por cuenta (Hoy, Agenda y las pantallas de gestión leen lo mismo y
// una escritura en una se ve en las otras). Hasta la primera lectura, 'cargando'
// (huecos); sin la 0115 en el servidor, 'listo' con `disponible: false` (estado
// vacío, nunca error rojo); un fallo de red, 'error'.
//
// `hacer(fn)` envuelve cada escritura: fallo en voz del sistema (mensajeSistema),
// aviso tranquilo si la migración aún no está, y relectura.

import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { avisar } from '@/components/ui';
import { vibrar } from '@/design/haptics';
import { t } from '@/i18n';
import { useAuth } from '@/lib/auth';
import { dateKey } from '@/lib/dates';
import { mensajeSistema } from '@/lib/validation';
import { leerWork, WorkNoDisponible } from '@/work/datos';
import { programarMisionesDeEntregas } from '@/work/datosGestion';
import { sumarDias } from '@/work/fechas';
import { DATOS_VACIOS, type DatosWork } from '@/work/tipos';

export interface EstadoWork {
  estado: 'cargando' | 'listo' | 'error';
  datos: DatosWork;
  disponible: boolean;
  error: string | null;
}

const INICIAL: EstadoWork = { estado: 'cargando', datos: DATOS_VACIOS, disponible: true, error: null };

let dueno: string | null = null;
let actual: EstadoWork = INICIAL;
let enVuelo: Promise<void> | null = null;
let generacion = 0;
const oyentes = new Set<() => void>();

function fijar(e: EstadoWork) {
  actual = e;
  for (const o of oyentes) o();
}

async function cargar(uid: string): Promise<void> {
  const gen = ++generacion;
  try {
    const hoy = dateKey();
    const r = await leerWork({ desdeSesiones: sumarDias(hoy, -60), desdeEventos: sumarDias(hoy, -14), hastaEventos: sumarDias(hoy, 14) });
    if (gen !== generacion || dueno !== uid) return;
    fijar({ estado: 'listo', datos: r.datos, disponible: r.disponible, error: null });
    // Las entregas que ya están a una semana o menos pasan a ser misiones.
    if (r.disponible) void programarMisionesDeEntregas(uid, r.datos.entregas, hoy);
  } catch (e) {
    if (gen !== generacion || dueno !== uid) return;
    // Con datos ya pintados, un fallo al releer no los borra.
    fijar({ ...actual, estado: actual.estado === 'listo' ? 'listo' : 'error', error: mensajeSistema(e) });
  }
}

function recargarDe(uid: string): Promise<void> {
  if (dueno !== uid) {
    dueno = uid;
    generacion++;
    fijar(INICIAL);
  }
  enVuelo = cargar(uid).finally(() => {
    enVuelo = null;
  });
  return enVuelo;
}

const suscribir = (o: () => void) => {
  oyentes.add(o);
  return () => {
    oyentes.delete(o);
  };
};
const leer = () => actual;

export interface UseWorkDatos extends EstadoWork {
  recargar: () => Promise<void>;
  /** Ejecuta una escritura y relee. Devuelve true si salió bien. */
  hacer: (fn: () => Promise<void>) => Promise<boolean>;
}

export function useWorkDatos(): UseWorkDatos {
  const { session } = useAuth();
  const uid = session?.user.id ?? null;
  const estado = useSyncExternalStore(suscribir, leer, leer);

  useEffect(() => {
    if (!uid) return;
    if (dueno !== uid || (actual.estado !== 'listo' && !enVuelo)) void recargarDe(uid);
  }, [uid]);

  const recargar = useCallback(async () => {
    if (uid) await recargarDe(uid);
  }, [uid]);

  const hacer = useCallback(
    async (fn: () => Promise<void>) => {
      try {
        await fn();
        return true;
      } catch (e) {
        if (e instanceof WorkNoDisponible) {
          avisar(t('trabajo:comun.noDisponibleTitulo'), t('trabajo:comun.noDisponibleCuerpo'));
        } else {
          vibrar('penalizacion');
          avisar(t('comun:sistemaNoResponde'), mensajeSistema(e));
        }
        return false;
      } finally {
        if (uid) await recargarDe(uid);
      }
    },
    [uid],
  );

  return { ...(uid && dueno === uid ? estado : INICIAL), recargar, hacer };
}
