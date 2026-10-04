// NIVL · Lista de la compra: datos, efectos y cerrojos (L-RADICAL §C, FASE3
// Oleada 2, lote E2). Cortado y pegado de la ruta: añadir, marcar (optimista,
// con vuelta atrás si no se guarda) y vaciar lo comprado son los de antes.
// Devuelve las props de CompraVista (pura).
//
// Añadidos, de forma:
//   · `errorCarga`: un fallo de carga se enseña con ErrorSistema (antes, un
//     aviso y la lista vacía, que se leía como «nada pendiente»).
//   · Marcar un artículo vibra `seleccion`; un fallo de una acción del
//     usuario, `penalizacion` (tabla de vibraciones de FASE3).
//   · `anadiendo`: cerrojo para que dos toques no dupliquen el artículo.

import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { avisar, volver } from '@/components/ui';
import { vibrar } from '@/design/haptics';
import { useAuth } from '@/lib/auth';
import { addShoppingItems, clearDoneShopping, fetchShoppingItems, setShoppingDone } from '@/lib/body';
import type { ShoppingItem } from '@/lib/types';
import { mensajeSistema } from '@/lib/validation';
import type { CompraVistaProps } from './CompraVista';

export function useCompra(): CompraVistaProps {
  const { session } = useAuth();
  const userId = session?.user.id;

  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [newItem, setNewItem] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const anadiendoRef = useRef(false);
  const [anadiendo, setAnadiendo] = useState(false);
  const [vaciando, setVaciando] = useState(false);

  const load = useCallback(async () => {
    try {
      setItems(await fetchShoppingItems());
      setErrorCarga(null);
    } catch (e) {
      setErrorCarga(mensajeSistema(e));
    } finally {
      setLoaded(true);
    }
  }, []);

  // Al volver a la pantalla, no solo al montarla: estas dos se alimentan de
  // datos que cambian desde otras pantallas.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const add = async () => {
    if (!userId || !newItem.trim() || anadiendoRef.current) return;
    anadiendoRef.current = true;
    setAnadiendo(true);
    try {
      await addShoppingItems(userId, [{ name: newItem.trim() }]);
      setNewItem('');
      await load();
    } catch (e) {
      vibrar('penalizacion');
      avisar('Error del sistema', mensajeSistema(e));
    } finally {
      anadiendoRef.current = false;
      setAnadiendo(false);
    }
  };

  const toggle = async (item: ShoppingItem) => {
    vibrar('seleccion');
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, done: !i.done } : i)));
    try {
      await setShoppingDone(item.id, !item.done);
    } catch (e) {
      // Optimista: si no se guarda, vuelve a como estaba.
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, done: item.done } : i)));
      vibrar('penalizacion');
      avisar('Error del sistema', mensajeSistema(e));
    }
  };

  const clearDone = async () => {
    if (vaciando) return;
    setVaciando(true);
    try {
      await clearDoneShopping();
      await load();
    } catch (e) {
      vibrar('penalizacion');
      avisar('Error del sistema', mensajeSistema(e));
    } finally {
      setVaciando(false);
    }
  };

  return {
    cargado: loaded,
    errorCarga,
    items,
    nuevo: newItem,
    anadiendo,
    vaciando,
    acciones: {
      onVolver: () => volver(router),
      onNuevo: setNewItem,
      onAnadir: add,
      onMarcar: toggle,
      onVaciar: clearDone,
      onDieta: () => router.push('/dieta'),
      onReintentar: () => {
        load();
      },
    },
  };
}
