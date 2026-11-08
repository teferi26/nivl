// NIVL · Mundo FOCUS: los efectos de Temario y de Exámenes (useX + XVista).

import { useEffect, useState } from 'react';
import { confirmar } from '@/components/ui';
import { vibrar } from '@/design/haptics';
import { archivarAsignatura, empezarVuelta, marcarEntrega } from '@/focus/datos';
import { diaSemana, lunesDe, sumarDias } from '@/focus/fechas';
import { CONFIG_POR_DEFECTO } from '@/focus/pomodoro';
import { leerConfig } from '@/focus/temporizador';
import { t } from '@/i18n';
import { useAuth } from '@/lib/auth';
import { dateKey } from '@/lib/dates';
import type { ExamenesVistaProps } from './ExamenesVista';
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
      onEditarTema: (x) => hojas.abrir.editarTema(x.id),
      onVuelta: async (a) => {
        const n = a.vuelta + 1;
        const ok = await confirmar({ titulo: t('focus:fondo.temas.vueltaTitulo', { n }), mensaje: t('focus:fondo.temas.vueltaCuerpo'), confirmar: t('focus:fondo.temas.vueltaOk', { n }) });
        if (!ok) return;
        vibrar('seleccion');
        await fd.hacer(() => empezarVuelta(a.id, a.vuelta));
      },
      onRepasar: hojas.abrir.repaso,
      onNuevoMazo: hojas.abrir.mazo,
      onNuevaTarjeta: hojas.abrir.tarjeta,
      onPegarTarjetas: hojas.abrir.tarjetasLote,
      onTarjetasIa: hojas.abrir.tarjetasIa,
      onHoras: hojas.abrir.horas,
      onDia: setDia,
      onAnadirClase: () => hojas.abrir.clase(dia),
      onEditarClase: (c) => hojas.abrir.clase(c.dia, c.id),
      onCopiarDia: () => hojas.abrir.copiarDia(dia),
      onMetodo: (m) => hojas.abrir.metodo(m.id),
      onReintentar: () => void fd.recargar(),
    },
  };
  return { vista, extra: hojas.elemento };
}

export function useExamenes() {
  const fd = useFocusDatos();
  const hoy = dateKey();
  const [lunes, setLunes] = useState(() => lunesDe(hoy));
  const uid = useAuth().session?.user.id ?? null;
  // El bloque de esta persona: con él, el plan del examen casa con el de Hoy.
  const [config, setConfig] = useState(CONFIG_POR_DEFECTO);
  useEffect(() => {
    if (!uid) return;
    let vivo = true;
    void leerConfig(uid).then((c) => {
      if (vivo) setConfig(c);
    });
    return () => {
      vivo = false;
    };
  }, [uid]);
  const hojas = useHojasFocus({ datos: fd, hoy, configPlan: config, onEstudiar: (asignaturaId, temaId) => pedirEstudio({ asignaturaId, temaId }) });
  const ahora = new Date();
  const vista: ExamenesVistaProps = {
    ...vistaExamenes(fd.datos, hoy, { lunes, config, ahoraMin: ahora.getHours() * 60 + ahora.getMinutes() }),
    estado: fd.estado,
    error: fd.error,
    disponible: fd.disponible,
    acciones: {
      onSemana: (delta) => {
        vibrar('seleccion');
        setLunes((l) => (delta === 0 ? lunesDe(hoy) : sumarDias(l, 7 * delta)));
      },
      onExamen: hojas.abrir.detalle,
      onNuevoExamen: () => hojas.abrir.examen(),
      onEntrega: hojas.abrir.entrega,
      onMarcarEntrega: (id, hecha) => {
        vibrar('seleccion');
        void fd.hacer(() => marcarEntrega(id, hecha ? hoy : null));
      },
      onAnadirAsignatura: hojas.abrir.asignatura,
      onNotas: hojas.abrir.notas,
      onNuevaNota: () => hojas.abrir.nota(),
      onSimulacro: () => hojas.abrir.simulacro(),
      onMetodoAnteriores: () => hojas.abrir.metodo('anteriores'),
      onReintentar: () => void fd.recargar(),
    },
  };
  return { vista, extra: hojas.elemento };
}
