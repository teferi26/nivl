// NIVL · WORK: los efectos de Horas. Las horas no pagan XP.

import { router } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { confirmar, useAlVolver, volver } from '@/components/ui';
import { vibrar } from '@/design/haptics';
import { t } from '@/i18n';
import { dateKey } from '@/lib/dates';
import { borrarSesion, marcarFacturadas, registrarSesion } from '@/work/datos';
import type { ApunteNuevo, HojaApuntarProps, HorasVistaProps } from './HorasVista';
import { useWorkDatos } from '../useWorkDatos';
import { idApunte, vistaHoras, type Apunte, type FilaPorFacturar } from './vistas';

export function useHoras(): { vista: HorasVistaProps; hoja: HojaApuntarProps } {
  const w = useWorkDatos();
  const hoy = dateKey();
  const [abierta, setAbierta] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const cerrojo = useRef(false);
  // Se genera al abrir: reintentar la misma hoja no apunta dos veces.
  const idHoja = useRef('');
  useAlVolver(() => void w.recargar());

  const vista = useMemo(() => vistaHoras(w.datos, hoy), [w.datos, hoy]);
  const proyectos = useMemo(() => w.datos.proyectos.filter((p) => p.estado === 'activo'), [w.datos.proyectos]);

  const apuntar = () => {
    idHoja.current = idApunte(Date.now(), Math.random());
    setAbierta(true);
  };

  const guardar = (a: ApunteNuevo) => {
    if (cerrojo.current) return;
    cerrojo.current = true;
    setGuardando(true);
    void w
      .hacer(() =>
        registrarSesion({ clientId: idHoja.current, tipo: 'manual', proyectoId: a.proyectoId, entregaId: null, questId: null, fecha: a.fecha, inicioMin: null, minutos: a.minutos, facturable: a.facturable }),
      )
      .then((ok) => {
        if (ok) setAbierta(false);
      })
      .finally(() => {
        cerrojo.current = false;
        setGuardando(false);
      });
  };

  const facturado = async (f: FilaPorFacturar) => {
    const ok = await confirmar({
      titulo: t('trabajogestion:horas.marcarTitulo', { nombre: f.nombre ?? t('trabajogestion:horas.sinProyecto') }),
      mensaje: t('trabajogestion:horas.marcarCuerpo'),
      confirmar: t('trabajogestion:horas.marcar'),
    });
    if (ok) void w.hacer(() => marcarFacturadas(f.ids, hoy));
  };

  const borrar = async (a: Apunte) => {
    const ok = await confirmar({ titulo: t('trabajogestion:horas.borrarTitulo'), confirmar: t('trabajogestion:comun.borrar'), destructivo: true });
    if (!ok) return;
    vibrar('destructiva');
    void w.hacer(() => borrarSesion(a.sesion.id));
  };

  return {
    vista: {
      estado: w.estado,
      error: w.error,
      disponible: w.disponible,
      onVolver: () => volver(router),
      onReintentar: () => void w.recargar(),
      vista,
      hoy,
      acciones: { onApuntar: apuntar, onMarcarFacturado: (f) => void facturado(f), onBorrar: (a) => void borrar(a) },
    },
    hoja: { visible: abierta, hoy, proyectos, guardando, onCerrar: () => setAbierta(false), onGuardar: guardar },
  };
}
