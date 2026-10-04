// NIVL · Memoria: datos y efectos (patrón L-RADICAL §C, FASE3 G1). Cortado y
// pegado de la ruta sin reescribir: el dossier, los hechos anotados por el
// coach y el gasto del mes, con su carga al volver a la pantalla. El filtro
// por categoría y el dossier plegado son estado de la vista y viven aquí.
//
// Cada hecho se puede borrar (borrarHecho de src/lib/coach.ts): se confirma,
// se cierra por fila (un Set con los ids que se están borrando) y, si sale
// bien, se quita de la lista local sin recargar todo. El coach deja de usarlo
// desde su siguiente turno; lo que ya dijo en el chat, en el resumen del hilo
// o en el dossier no se reescribe (y la vista no lo promete).

import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { avisar, confirmar } from '@/components/ui/confirmar';
import { volver } from '@/components/ui/Screen';
import { vibrar } from '@/design/haptics';
import { borrarHecho, fetchDossier, fetchFacts, fetchMonthCost, type CoachFact } from '@/lib/coach';
import { ErrorVisible, mensajeSistema } from '@/lib/validation';
import { etiquetaCategoria, fechaCorta, type MemoriaVistaProps } from './MemoriaVista';

export function useMemoria(): MemoriaVistaProps {
  const [dossier, setDossier] = useState<{ content: string; version: number } | null>(null);
  const [hechos, setHechos] = useState<CoachFact[]>([]);
  const [gasto, setGasto] = useState<number | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtro, setFiltro] = useState('todo');
  const [dossierAbierto, setDossierAbierto] = useState(false);
  const [borrando, setBorrando] = useState<ReadonlySet<string>>(new Set());
  // El cerrojo por fila, síncrono: el estado llega tarde para un doble toque.
  const enCurso = useRef(new Set<string>());

  const cargar = useCallback(async () => {
    try {
      setError(null);
      const [d, h, g] = await Promise.all([fetchDossier(), fetchFacts(200), fetchMonthCost()]);
      setDossier(d);
      setHechos(h);
      setGasto(g);
    } catch (e) {
      setError(mensajeSistema(e));
    } finally {
      setCargando(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar]),
  );

  const soltar = (id: string) => {
    enCurso.current.delete(id);
    setBorrando((s) => {
      const n = new Set(s);
      n.delete(id);
      return n;
    });
  };

  const onBorrarHecho = async (h: CoachFact) => {
    if (enCurso.current.has(h.id)) return;
    const ok = await confirmar({
      titulo: 'Borrar recuerdo',
      mensaje: `«${h.content.length > 80 ? `${h.content.slice(0, 80)}…` : h.content}»

Se borra de los recuerdos del coach. Si también aparece en el dossier o en la conversación, ahí sigue hasta que se reescriban.`,
      confirmar: 'Borrar',
      destructivo: true,
    });
    if (!ok || enCurso.current.has(h.id)) return;
    enCurso.current.add(h.id);
    setBorrando((s) => new Set(s).add(h.id));
    try {
      await borrarHecho(h.id);
      vibrar('destructiva');
      // El detalle es un aviso modal: no puede seguir abierto al llegar aquí.
      setHechos((lista) => lista.filter((x) => x.id !== h.id));
    } catch (e) {
      vibrar('penalizacion');
      avisar(e instanceof ErrorVisible ? 'Memoria' : 'El sistema no responde', mensajeSistema(e));
      // Puede que ya no estuviera: se vuelve a leer la memoria.
      cargar();
    } finally {
      soltar(h.id);
    }
  };

  return {
    cargando,
    error,
    dossier,
    hechos,
    gasto,
    filtro,
    dossierAbierto,
    borrando,
    acciones: {
      onVolver: () => volver(router),
      onFiltro: setFiltro,
      onAlternarDossier: () => setDossierAbierto((v) => !v),
      onAbrirHecho: (h) => avisar(`${etiquetaCategoria(h.category)} · ${fechaCorta(h.date)}`, h.content),
      onBorrarHecho,
      onReintentar: () => {
        cargar();
      },
    },
  };
}
