// NIVL · Modos: qué modos tiene la cuenta, para los mundos y la pantalla de
// pago. Una sola lectura compartida por toda la app; se repite al entrar en un
// mundo (como mucho una vez por minuto) y justo después de comprar.
//
// Solo informa a la interfaz: el candado está en el servidor (`ai_modos`, 0140).

import { useEffect, useSyncExternalStore } from 'react';
import { useAuth } from '@/lib/auth';
import { fetchDerechosModos, type DerechosModos } from '@/lib/pro';

const REFRESCO_MS = 60_000;

let estado: { usuario: string | null; leido: boolean; derechos: DerechosModos | null } = {
  usuario: null,
  leido: false,
  derechos: null,
};
let ultima = 0;
const oyentes = new Set<() => void>();

function fijar(nuevo: typeof estado) {
  estado = nuevo;
  oyentes.forEach((o) => o());
}

/** Vuelve a leer al momento. Sin red deja `derechos` en null: la puerta no se cierra por eso. */
export async function recargarDerechos(usuario: string | null = estado.usuario): Promise<void> {
  ultima = Date.now();
  let derechos: DerechosModos | null = null;
  try {
    derechos = usuario ? await fetchDerechosModos() : null;
  } catch {
    derechos = null;
  }
  if (usuario === estado.usuario) fijar({ usuario, leido: true, derechos });
}

export function useDerechos(): { leido: boolean; derechos: DerechosModos | null } {
  const { session } = useAuth();
  const usuario = session?.user.id ?? null;
  const actual = useSyncExternalStore(
    (o) => {
      oyentes.add(o);
      return () => oyentes.delete(o);
    },
    () => estado,
  );

  useEffect(() => {
    if (usuario !== estado.usuario) {
      fijar({ usuario, leido: false, derechos: null });
      void recargarDerechos(usuario);
    } else if (Date.now() - ultima > REFRESCO_MS) {
      void recargarDerechos(usuario);
    }
  }, [usuario]);

  // Otro usuario en el primer fotograma: aún no se sabe nada suyo.
  return actual.usuario === usuario ? { leido: actual.leido, derechos: actual.derechos } : { leido: false, derechos: null };
}
