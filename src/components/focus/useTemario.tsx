// NIVL · Mundo FOCUS: los efectos de Temario y de Exámenes (useX + XVista).

import { useState } from 'react';
import { confirmar } from '@/components/ui';
import { vibrar } from '@/design/haptics';
import { archivarAsignatura, borrarClase } from '@/focus/datos';
import { diaSemana } from '@/focus/fechas';
import { t } from '@/i18n';
import { dateKey } from '@/lib/dates';
import type { ExamenesVistaProps } from './ExamenesVista';
import { horaClase } from './HojasFocus';
import { pedirEstudio } from './pedido';
import type { TemarioVistaProps } from './TemarioVista';
import { useFocusDatos } from './useFocusDatos';
import { vistaExamenes, vistaTemario } from './vistas';
import { useHojasFocus } from './useHojasFocus';

export function useTemario() {
  const fd = useFocusDatos();
  const hoy = dateKey();
  const [elegida, setElegida] = useState<string | null>(null);
  const [dia, setDia] = useState(() => diaSemana(hoy));
  const hojas = useHojasFocus({ datos: fd, hoy, onEstudiar: (asignaturaId, temaId) => pedirEstudio({ asignaturaId, temaId }) });
  const v = vistaTemario(fd.datos, hoy, elegida, dia);

  const vista: TemarioVistaProps = {
    ...v,
    estado: fd.estado,
    error: fd.error,
    disponible: fd.disponible,
    acciones: {
      onElegir: (id) => {
        vibrar('seleccion');
        setElegida(id);
      },
      onArchivar: async (a) => {
        const ok = await confirmar({ titulo: t('focus:temario.archivarTitulo', { nombre: a.nombre }), mensaje: t('focus:temario.archivarCuerpo'), confirmar: t('focus:temario.archivar') });
        if (!ok) return;
        await fd.hacer(() => archivarAsignatura(a.id));
        setElegida(null);
      },
      onAnadirAsignatura: hojas.abrir.asignatura,
      onAnadirTemas: () => v.elegida && hojas.abrir.temas(v.elegida),
      onAlternarTema: hojas.abrir.alternarTema,
      onBorrarTema: (x) => void hojas.abrir.borrarTema(x),
      onRepasar: hojas.abrir.repaso,
      onNuevoMazo: hojas.abrir.mazo,
      onNuevaTarjeta: hojas.abrir.tarjeta,
      onDia: setDia,
      onAnadirClase: () => hojas.abrir.clase(dia),
      onBorrarClase: async (c) => {
        const ok = await confirmar({ titulo: t('focus:temario.borrarClaseTitulo', { horas: horaClase(c) }), confirmar: t('focus:hojas.borrar'), destructivo: true });
        if (!ok) return;
        vibrar('destructiva');
        await fd.hacer(() => borrarClase(c.id));
      },
      onMetodo: (m) => hojas.abrir.metodo(m.id),
      onReintentar: () => void fd.recargar(),
    },
  };
  return { vista, extra: hojas.elemento };
}

export function useExamenes() {
  const fd = useFocusDatos();
  const hoy = dateKey();
  const hojas = useHojasFocus({ datos: fd, hoy, onEstudiar: (asignaturaId, temaId) => pedirEstudio({ asignaturaId, temaId }) });
  const vista: ExamenesVistaProps = {
    ...vistaExamenes(fd.datos, hoy),
    estado: fd.estado,
    error: fd.error,
    disponible: fd.disponible,
    acciones: {
      onExamen: hojas.abrir.detalle,
      onNuevoExamen: () => hojas.abrir.examen(),
      onAnadirAsignatura: hojas.abrir.asignatura,
      onNotas: hojas.abrir.notas,
      onNuevaNota: () => hojas.abrir.nota(),
      onMetodoAnteriores: () => hojas.abrir.metodo('anteriores'),
      onReintentar: () => void fd.recargar(),
    },
  };
  return { vista, extra: hojas.elemento };
}
