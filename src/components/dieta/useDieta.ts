// NIVL · Dieta: datos, efectos y cerrojos (L-RADICAL §C, FASE3 Oleada 2,
// lote E2). Cortado y pegado de la ruta: la carga, el guardado de una comida,
// quitarla y generar la lista son los de antes. Devuelve las props de
// DietaVista (pura) y las de la hoja de la comida, que se queda en la ruta.
//
// Añadidos, todos de forma y sin tocar datos:
//   · `cargado` y `errorCarga`: hasta la primera carga se pintan huecos y un
//     fallo se enseña con ErrorSistema (antes, un aviso y la semana vacía).
//   · Los fallos de la hoja van en línea (`errorHoja`), no en un aviso encima
//     de una hoja abierta; guardar ya no deja una promesa rechazada suelta y
//     lleva cerrojo (`guardando`) para no duplicar con dos toques.
//   · Vibraciones de la tabla de FASE3: `destructiva` tras quitar una comida
//     confirmada y `penalizacion` si falla una acción del usuario.

import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { avisar, volver } from '@/components/ui';
import { confirmar } from '@/components/ui/confirmar';
import { vibrar } from '@/design/haptics';
import { mensajeSistema } from '@/lib/validation';
import { useAuth } from '@/lib/auth';
import {
  addShoppingItems,
  deleteMealSlot,
  fetchMealSlots,
  ingredientsFromPlan,
  upsertMealSlot,
} from '@/lib/body';
import { isoWeekday } from '@/lib/dates';
import type { MealSlot, MealSlotName } from '@/lib/types';
import type { DietaVistaProps } from './DietaVista';
import type { HojaComidaProps } from './HojaComida';

export function useDieta(): { vista: DietaVistaProps; hoja: HojaComidaProps } {
  const { session } = useAuth();
  const userId = session?.user.id;

  const [slots, setSlots] = useState<MealSlot[]>([]);
  const [day, setDay] = useState(isoWeekday(new Date()));
  const [editing, setEditing] = useState<{ slot: MealSlotName; existing: MealSlot | null } | null>(null);
  // La hoja se cierra con `abierta`; `editing` se queda puesto para que el
  // título no se vacíe durante la salida.
  const [abierta, setAbierta] = useState(false);
  const [description, setDescription] = useState('');
  const [ingredients, setIngredients] = useState('');
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [errorHoja, setErrorHoja] = useState<string | null>(null);
  const guardandoRef = useRef(false);
  const [guardando, setGuardando] = useState(false);
  const [quitando, setQuitando] = useState(false);

  const load = useCallback(async () => {
    try {
      setSlots(await fetchMealSlots());
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

  const daySlots = slots.filter((s) => s.day_of_week === day);

  const openEditor = (slotName: MealSlotName) => {
    const existing = daySlots.find((s) => s.slot === slotName) ?? null;
    setDescription(existing?.description ?? '');
    setIngredients(existing?.ingredients ?? '');
    setErrorHoja(null);
    setEditing({ slot: slotName, existing });
    setAbierta(true);
  };

  const cerrar = () => setAbierta(false);

  const save = async () => {
    if (!userId || !editing || !description.trim() || guardandoRef.current) return;
    guardandoRef.current = true;
    setGuardando(true);
    setErrorHoja(null);
    try {
      await upsertMealSlot(userId, {
        id: editing.existing?.id,
        day_of_week: day,
        slot: editing.slot,
        description: description.trim(),
        ingredients: ingredients.trim() || null,
      });
      setAbierta(false);
      await load();
    } catch (e) {
      vibrar('penalizacion');
      setErrorHoja(mensajeSistema(e));
    } finally {
      guardandoRef.current = false;
      setGuardando(false);
    }
  };

  const removeSlot = async () => {
    if (!editing?.existing) return;
    const ok = await confirmar({ titulo: 'Quitar comida', mensaje: editing.existing.description, confirmar: 'Quitar', destructivo: true });
    if (!ok) return;
    setQuitando(true);
    setErrorHoja(null);
    try {
      await deleteMealSlot(editing.existing.id);
      vibrar('destructiva');
      setAbierta(false);
      await load();
    } catch (e) {
      vibrar('penalizacion');
      setErrorHoja(mensajeSistema(e));
    } finally {
      setQuitando(false);
    }
  };

  const generateList = async () => {
    if (!userId || busy) return;
    const items = ingredientsFromPlan(slots);
    if (items.length === 0) {
      avisar(
        'Sin ingredientes',
        'Añade ingredientes a tus comidas (separados por comas) y el sistema generará la lista.',
      );
      return;
    }
    setBusy(true);
    try {
      await addShoppingItems(userId, items.map((name) => ({ name })));
      setBusy(false);
      const ver = await confirmar({
        titulo: 'Lista generada',
        mensaje: `${items.length} ingredientes enviados a la lista de la compra.`,
        confirmar: 'Ver lista',
        cancelar: 'Entendido',
      });
      if (ver) router.push('/compra');
    } catch (e) {
      vibrar('penalizacion');
      avisar('Error del sistema', mensajeSistema(e));
    } finally {
      setBusy(false);
    }
  };

  return {
    vista: {
      cargado: loaded,
      errorCarga,
      slots,
      dia: day,
      hoy: isoWeekday(new Date()),
      generando: busy,
      acciones: {
        onVolver: () => volver(router),
        onDia: setDay,
        onComida: openEditor,
        onGenerar: generateList,
        onCompra: () => router.push('/compra'),
        onReintentar: () => {
          load();
        },
      },
    },
    hoja: {
      visible: abierta,
      slot: editing?.slot ?? null,
      existe: !!editing?.existing,
      dia: day,
      descripcion: description,
      ingredientes: ingredients,
      guardando,
      quitando,
      error: errorHoja,
      onDescripcion: setDescription,
      onIngredientes: setIngredients,
      onGuardar: save,
      onQuitar: removeSlot,
      onCerrar: cerrar,
    },
  };
}
