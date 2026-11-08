// NIVL · WORK: los efectos de Proyectos. Cerrar una entrega no paga; paga su misión.

import { router } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useCelebracion } from '@/components/celebracion/contexto';
import { confirmar, useAlVolver, volver } from '@/components/ui';
import { vibrar } from '@/design/haptics';
import { t } from '@/i18n';
import { useAuth } from '@/lib/auth';
import { dateKey } from '@/lib/dates';
import { borrarEntrega, borrarProyecto, fijarEstadoProyecto, guardarEntrega, guardarProyecto, marcarEntrega, type EdicionEntrega, type EdicionProyecto } from '@/work/datos';
import { cerrarMisionDeEntrega, retirarMisionDeEntrega, type MisionPagada } from '@/work/datosGestion';
import { editarRetiraMision } from '@/work/entregaMision';
import type { Entrega, EstadoProyecto, Proyecto } from '@/work/tipos';
import type { HojaProyecto, HojasProyectosProps } from './HojasProyectos';
import type { ProyectosVistaProps } from './ProyectosVista';
import { useWorkDatos } from '../useWorkDatos';
import { detalleProyecto, vistaProyectos } from './vistas';

export function useProyectos(): { vista: ProyectosVistaProps; hojas: HojasProyectosProps } {
  const { session } = useAuth();
  const uid = session?.user.id ?? null;
  const w = useWorkDatos();
  const { celebrar } = useCelebracion();
  const hoy = dateKey();
  const [hoja, setHoja] = useState<HojaProyecto | null>(null);
  const [guardando, setGuardando] = useState(false);
  const cerrojo = useRef(false);
  useAlVolver(() => void w.recargar());

  const vista = useMemo(() => vistaProyectos(w.datos, hoy), [w.datos, hoy]);
  const detalle = useMemo(() => (hoja?.tipo === 'detalle' ? detalleProyecto(hoja.proyectoId, w.datos, hoy) : null), [hoja, w.datos, hoy]);

  const conCerrojo = useCallback(async (fn: () => Promise<void>) => {
    if (cerrojo.current) return false;
    cerrojo.current = true;
    setGuardando(true);
    try {
      return await w.hacer(fn);
    } finally {
      cerrojo.current = false;
      setGuardando(false);
    }
  }, [w]);

  const tras = (h: HojaProyecto | null) => (ok: boolean) => {
    if (ok) setHoja(h);
  };
  const volverAlDetalle = (proyectoId: string | null): HojaProyecto | null => (proyectoId ? { tipo: 'detalle', proyectoId } : null);

  const guardarP = (p: EdicionProyecto) => {
    void conCerrojo(() => guardarProyecto(p)).then(tras(p.id ? { tipo: 'detalle', proyectoId: p.id } : null));
  };

  const guardarE = (e: EdicionEntrega) => {
    const anterior = hoja?.tipo === 'entrega' ? hoja.entrega : null;
    void conCerrojo(async () => {
      // Si cambia el título o la fecha, la misión pendiente ya no le corresponde;
      // la nueva la crea la relectura.
      if (anterior && editarRetiraMision(anterior, e)) await retirarMisionDeEntrega(anterior, hoy);
      await guardarEntrega(e);
    }).then(tras(volverAlDetalle(e.proyectoId)));
  };

  const marcar = (e: Entrega) => {
    let pagada: MisionPagada | null = null;
    void conCerrojo(async () => {
      await marcarEntrega(e.id, !e.hecha, hoy);
      if (!e.hecha && uid) pagada = await cerrarMisionDeEntrega(uid, e, hoy);
    }).then(() => {
      const p = pagada as MisionPagada | null;
      if (!p) return;
      vibrar('mision');
      celebrar({
        accion: `work:entrega:${e.id}`,
        perfilAntes: p.antes,
        perfilDespues: p.resultado.profile,
        fecha: hoy,
        resumen: [t('trabajogestion:proyectos.misionPagada', { titulo: p.titulo, xp: p.resultado.xp })],
        final: true,
      });
    });
  };

  const estadoP = (p: Proyecto, estado: EstadoProyecto) => {
    void conCerrojo(() => fijarEstadoProyecto(p.id, estado)).then(tras(null));
  };

  const borrarP = async (p: Proyecto) => {
    const ok = await confirmar({ titulo: t('trabajogestion:detalle.borrarTitulo'), mensaje: t('trabajogestion:detalle.borrarCuerpo'), confirmar: t('trabajogestion:comun.borrar'), destructivo: true });
    if (!ok) return;
    vibrar('destructiva');
    const propias = w.datos.entregas.filter((e) => e.proyectoId === p.id && !e.hecha);
    void conCerrojo(async () => {
      await Promise.all(propias.map((e) => retirarMisionDeEntrega(e, hoy)));
      await borrarProyecto(p.id);
    }).then(tras(null));
  };

  const borrarE = async (e: Entrega) => {
    const ok = await confirmar({ titulo: t('trabajogestion:entrega.borrarTitulo'), confirmar: t('trabajogestion:comun.borrar'), destructivo: true });
    if (!ok) return;
    vibrar('destructiva');
    void conCerrojo(async () => {
      if (!e.hecha) await retirarMisionDeEntrega(e, hoy);
      await borrarEntrega(e.id);
    }).then(tras(volverAlDetalle(e.proyectoId)));
  };

  return {
    vista: {
      estado: w.estado,
      error: w.error,
      disponible: w.disponible,
      onVolver: () => volver(router),
      onReintentar: () => void w.recargar(),
      vista,
      acciones: {
        onNuevoProyecto: () => setHoja({ tipo: 'proyecto', proyecto: null }),
        onNuevaEntrega: () => setHoja({ tipo: 'entrega', entrega: null, proyectoId: null }),
        onAbrir: (p) => setHoja({ tipo: 'detalle', proyectoId: p.id }),
        onMarcar: marcar,
        onEntrega: (e) => setHoja({ tipo: 'entrega', entrega: e, proyectoId: e.proyectoId }),
      },
    },
    hojas: {
      hoja,
      hoy,
      detalle,
      guardando,
      onCerrar: () => setHoja(null),
      onGuardarProyecto: guardarP,
      onGuardarEntrega: guardarE,
      onNuevaEntrega: (proyectoId) => setHoja({ tipo: 'entrega', entrega: null, proyectoId }),
      onEditarProyecto: (p) => setHoja({ tipo: 'proyecto', proyecto: p }),
      onEstadoProyecto: estadoP,
      onBorrarProyecto: (p) => void borrarP(p),
      onBorrarEntrega: (e) => void borrarE(e),
      onMarcar: marcar,
      onEntrega: (e) => setHoja({ tipo: 'entrega', entrega: e, proyectoId: e.proyectoId }),
    },
  };
}
