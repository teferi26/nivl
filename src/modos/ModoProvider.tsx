// NIVL · Modos: el proveedor y `useModo()`.
//
// Con el interruptor `modos_activos` apagado (o sin proveedor, como en la
// galería y las pruebas) todo vale lo de hoy: modo General, sin modos
// activados, ninguna lectura de `user_modes` y ninguna cabecera al coach.
//
// Encendido:
//   · lee los modos activados de la cuenta (`user_modes`);
//   · recupera el modo que se dejó a la vista en este teléfono (si ya no está
//     activado, General);
//   · deja el modo para el coach (cabecera `x-nivl-modo`, modos/coach.ts).

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from '@/lib/auth';
import { useFlags } from '@/lib/flags';
import { fijarModoCoach } from './coach';
import { guardarActivados as escribirActivados, guardarModoActivo, leerActivados, leerModoActivo } from './datos';
import { modosDisponibles, modoValido, type ModoEtiqueta, type ModoId } from './tipos';

export interface ModoContexto {
  /** El interruptor `modos_activos`. Apagado: nada de modos en la interfaz. */
  activo: boolean;
  /** El modo a la vista. Con el interruptor apagado, siempre General. */
  modo: ModoId;
  /** Los modos activados de la cuenta (sin General). */
  activados: ModoEtiqueta[];
  /** Lo que ofrece el selector: General y los activados. */
  disponibles: ModoId[];
  /** Ya se han leído los modos de la cuenta (o no hacía falta). */
  cargado: boolean;
  /** La última lectura de `user_modes` salió bien (sin red o sin tabla, false). */
  leidos: boolean;
  cambiar: (modo: ModoId) => void;
  /** Guarda la elección en `user_modes` (onboarding) y la deja a la vista. */
  guardarActivados: (elegidos: readonly ModoEtiqueta[]) => Promise<void>;
  recargar: () => Promise<void>;
}

const APAGADO: ModoContexto = {
  activo: false,
  modo: 'general',
  activados: [],
  disponibles: ['general'],
  cargado: true,
  leidos: false,
  cambiar: () => {},
  guardarActivados: async () => {},
  recargar: async () => {},
};

const Contexto = createContext<ModoContexto>(APAGADO);

export function ModoProvider({ children }: { children: ReactNode }) {
  const { modos_activos: activo } = useFlags();
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const [activados, setActivados] = useState<ModoEtiqueta[]>([]);
  const [modo, setModo] = useState<ModoId>('general');
  const [cargado, setCargado] = useState(false);
  const [leidos, setLeidos] = useState(false);

  const recargar = useCallback(async () => {
    if (!activo || !userId) {
      setActivados([]);
      setModo('general');
      setLeidos(false);
      setCargado(true);
      return;
    }
    try {
      const [lista, guardado] = await Promise.all([leerActivados(userId), leerModoActivo(userId)]);
      setActivados(lista);
      setModo(modoValido(guardado, lista));
      setLeidos(true);
    } catch {
      // Sin tabla o sin red: General, como hoy.
      setActivados([]);
      setModo('general');
      setLeidos(false);
    } finally {
      setCargado(true);
    }
  }, [activo, userId]);

  useEffect(() => {
    setCargado(false);
    setLeidos(false);
    void recargar();
  }, [recargar]);

  const modoVisible: ModoId = activo ? modo : 'general';

  // El coach recibe el modo solo con el interruptor encendido.
  useEffect(() => {
    fijarModoCoach(activo ? modoVisible : null);
  }, [activo, modoVisible]);
  useEffect(() => () => fijarModoCoach(null), []);

  const cambiar = useCallback(
    (m: ModoId) => {
      if (!activo) return;
      const valido = m === 'general' ? 'general' : modoValido(m, activados);
      setModo(valido);
      if (userId) void guardarModoActivo(userId, valido);
    },
    [activo, activados, userId],
  );

  const guardarActivados = useCallback(
    async (elegidos: readonly ModoEtiqueta[]) => {
      if (!activo || !userId) return;
      await escribirActivados(userId, elegidos);
      const lista = [...elegidos];
      setActivados(lista);
      setLeidos(true);
      setModo((m) => (m === 'general' ? m : modoValido(m, lista)));
    },
    [activo, userId],
  );

  const valor = useMemo<ModoContexto>(
    () =>
      activo
        ? {
            activo: true,
            modo: modoVisible,
            activados,
            disponibles: modosDisponibles(activados),
            cargado,
            leidos,
            cambiar,
            guardarActivados,
            recargar,
          }
        : APAGADO,
    [activo, modoVisible, activados, cargado, leidos, cambiar, guardarActivados, recargar],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

/** El modo a la vista y los activados. Sin proveedor o con el interruptor apagado: General. */
export function useModo(): ModoContexto {
  return useContext(Contexto);
}
