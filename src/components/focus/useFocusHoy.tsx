// NIVL · Mundo FOCUS: los efectos del inicio (useX del patrón useX + XVista).
//
// · Los datos de FOCUS (useFocusDatos) y las misiones del modo, del mismo Hoy
//   de NIVL (useHoy, que con el modo FOCUS activo ya filtra por etiqueta).
// · El pomodoro (usePomodoro) y lo que pasa al terminar un bloque de foco
//   ENTERO, una vez por bloque:
//     1. se registra la sesión (horas por asignatura; sin la 0076, nada);
//     2. UN SOLO GESTO: si el bloque llevaba enlazada una misión de FOCUS de
//        hoy sin hacer, se completa por el camino de siempre (completeQuest →
//        complete_quest, que suma también el XP del modo). El bloque no paga
//        nada por su cuenta: cero economía nueva;
//     3. se marca hecho el primer bloque de estudio del plan del día.

import { router } from 'expo-router';
import { rutaFocus } from '@/components/modos/mundo/prestadoRutas';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useCelebracion } from '@/components/celebracion/contexto';
import { CompletarSheet } from '@/components/CompletarSheet';
import { useHoy } from '@/components/hoy/useHoy';
import { EmblemaMundo } from '@/components/modos/EmblemaMundo';
import { CabeceraMundo } from '@/components/modos/mundo/CabeceraMundo';
import { useMundo } from '@/components/modos/mundo/useMundo';
import { confirmar } from '@/components/ui';
import { vibrar } from '@/design/haptics';
import { registrarSesion } from '@/focus/datos';
import { cumpleMision, misionPropuesta } from '@/focus/mision';
import type { Cierre, ConfigPomodoro, Objetivo } from '@/focus/pomodoro';
import { t } from '@/i18n';
import { useAuth } from '@/lib/auth';
import { ensureProfile, fetchQuests } from '@/lib/data';
import { dateKey } from '@/lib/dates';
import { fetchPlan, setBlockDone } from '@/lib/dayplan';
import { completeQuest } from '@/lib/engine';
import { XP_BY_DIFFICULTY } from '@/lib/game';
import type { FocusHoyVistaProps } from './FocusHoyVista';
import { escucharPedidos, pedidoAtendido } from './pedido';
import { useFocusDatos } from './useFocusDatos';
import { useHojasFocus } from './useHojasFocus';
import { usePomodoro } from './usePomodoro';
import { vistaHoy, type MisionEnlazable } from './vistaHoy';

async function marcarBloqueDeEstudio(fecha: string): Promise<void> {
  try {
    const plan = await fetchPlan(fecha);
    const b = plan?.bloques.find((x) => !x.done && x.kind === 'estudio');
    if (b) await setBlockDone(b.id, true);
  } catch {
    // Best effort: el plan no puede tumbar un bloque ya hecho.
  }
}

export function useFocusHoy() {
  const { session } = useAuth();
  const uid = session?.user.id ?? null;
  const fd = useFocusDatos();
  const { vista: nivl, hojas: hojasNivl } = useHoy();
  const mundo = useMundo('focus');
  const { celebrar, avisar } = useCelebracion();
  const hoy = dateKey();
  const pagados = useRef(new Set<string>());

  const misiones: MisionEnlazable[] | null =
    nivl.estado === 'cargando'
      ? null
      : nivl.datos.misiones.map((m) => ({
          id: m.quest.id,
          titulo: m.quest.title,
          hecha: m.hecha,
          xp: XP_BY_DIFFICULTY[m.quest.difficulty] ?? 0,
          penalizacion: m.quest.is_penalty,
        }));

  const refrescarNivl = nivl.acciones.onRefrescar;
  const recargar = fd.recargar;

  const alAcabar = useCallback(
    (cierre: Cierre, _c: ConfigPomodoro) => {
      const foco = cierre.focoCompleto;
      if (!foco || !uid || pagados.current.has(foco.idFase)) return;
      pagados.current.add(foco.idFase);
      const fecha = dateKey();
      void (async () => {
        try {
          await registrarSesion({
            clientId: foco.idFase,
            asignaturaId: foco.objetivo.asignaturaId,
            temaId: foco.objetivo.temaId,
            misionId: foco.objetivo.misionId,
            fecha,
            minutos: foco.minutos,
            metodo: 'pomodoro',
          });
        } catch {
          // Sin la 0076 (FocusNoDisponible) o sin red: la sesión no queda
          // guardada, pero el bloque se hizo y la misión sigue abajo.
        }

        let pagado = 0;
        if (cumpleMision(foco, foco.objetivo.misionId)) {
          try {
            const q = (await fetchQuests()).find((x) => x.id === foco.objetivo.misionId);
            if (q && !q.is_penalty) {
              const antes = await ensureProfile(uid);
              const r = await completeQuest(antes, q, null);
              if (r.awarded) {
                pagado = r.xp;
                vibrar('mision');
                celebrar({
                  accion: `focus:${foco.idFase}`,
                  perfilAntes: antes,
                  perfilDespues: r.profile,
                  fecha,
                  resumen: [t('focus:fin.resumen', { xp: r.xp, titulo: q.title })],
                  final: true,
                });
              }
            }
          } catch {
            // Día cambiado, sin red o ya pagada en otro sitio: la misión queda
            // para marcarla a mano. Nunca se paga dos veces (unique en BD).
          }
        }
        if (pagado === 0) avisar(t('focus:fin.bloque', { count: foco.minutos }));
        await marcarBloqueDeEstudio(fecha);
        refrescarNivl();
        await recargar();
      })();
    },
    [uid, celebrar, avisar, refrescarNivl, recargar],
  );

  const pomodoro = usePomodoro(uid, alAcabar);
  const { fijarObjetivo, estado: pomo } = pomodoro;

  // «Estudiar esto ahora» desde Temario o Exámenes.
  useEffect(
    () =>
      escucharPedidos((p) => {
        if (!pomodoro.listo) return;
        const nombre = fd.datos.asignaturas.find((a) => a.id === p.asignaturaId)?.nombre ?? null;
        fijarObjetivo({ asignaturaId: p.asignaturaId, temaId: p.temaId, misionId: misionPropuesta(misiones ?? [], nombre)?.id ?? pomo.objetivo.misionId });
        pedidoAtendido();
      }),
    // misiones cambia en cada render; el encargo solo se atiende una vez.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pomodoro.listo, fijarObjetivo, fd.datos],
  );

  const hojas = useHojasFocus({
    datos: fd,
    hoy,
    pomodoro,
    misiones: misiones ?? [],
    onEstudiar: (asignaturaId, temaId) => fijarObjetivo({ ...pomo.objetivo, asignaturaId, temaId }),
  });

  const ahora = new Date(pomodoro.ahora);
  const v = vistaHoy({
    datos: fd.datos,
    hoy,
    ahoraMin: ahora.getHours() * 60 + ahora.getMinutes(),
    ahora: pomodoro.ahora,
    config: pomodoro.config,
    pomodoro: pomo,
    misiones,
  });

  const [refrescando, setRefrescando] = useState(false);

  const objetivoParaEmpezar = (): Objetivo => {
    if (pomo.objetivo.asignaturaId || pomo.pausaRestante !== null || pomo.fase !== 'foco') return pomo.objetivo;
    const b = v.plan.find((x) => x.tipo !== 'simulacro') ?? v.plan[0];
    const asignaturaId = b?.asignaturaId ?? null;
    const nombre = asignaturaId ? (fd.datos.asignaturas.find((a) => a.id === asignaturaId)?.nombre ?? null) : null;
    return {
      asignaturaId,
      temaId: b?.temaId ?? null,
      misionId: pomo.objetivo.misionId ?? misionPropuesta(misiones ?? [], nombre)?.id ?? null,
    };
  };

  const acciones: FocusHoyVistaProps['acciones'] = {
    onEmpezar: () => pomodoro.empezar(objetivoParaEmpezar()),
    onPausar: pomodoro.pausar,
    onSaltar: pomodoro.saltar,
    onParar: async () => {
      if (pomo.fase === 'foco' && pomo.finEn !== null) {
        const ok = await confirmar({ titulo: t('focus:hoy.pararTitulo'), mensaje: t('focus:hoy.pararCuerpo'), confirmar: t('focus:hoy.parar') });
        if (!ok) return;
      }
      pomodoro.parar();
    },
    onAjustes: hojas.abrir.ajustes,
    onElegirMision: hojas.abrir.mision,
    onNoMolestar: hojas.abrir.noMolestar,
    onExamenes: () => router.navigate(rutaFocus('examenes')),
    onExamen: hojas.abrir.detalle,
    onTemario: () => router.navigate(rutaFocus('temario')),
    onAlternarTema: (id) => {
      const tema = fd.datos.temas.find((x) => x.id === id);
      if (tema) hojas.abrir.alternarTema(tema);
    },
    onBloque: (b) => {
      vibrar('seleccion');
      fijarObjetivo({
        asignaturaId: b.asignaturaId,
        temaId: b.temaId,
        misionId: pomo.objetivo.misionId ?? misionPropuesta(misiones ?? [], b.asignatura)?.id ?? null,
      });
    },
    onCompletarMision: (id) => {
      const m = nivl.datos.misiones.find((x) => x.quest.id === id);
      if (m) nivl.acciones.onCompletar(m.quest);
    },
    onCoach: () => router.navigate(rutaFocus('coach')),
    onAnadirAsignatura: hojas.abrir.asignatura,
    onAnadirExamen: () => hojas.abrir.examen(),
    onReintentar: () => void fd.recargar(),
    onRefrescar: () => {
      setRefrescando(true);
      refrescarNivl();
      void fd.recargar().finally(() => setRefrescando(false));
    },
  };

  const vista: FocusHoyVistaProps = {
    ...v,
    cabecera: <CabeceraMundo modo="focus" nivel={mundo.nivel} emblema={<EmblemaMundo modo="focus" />} />,
    estado: fd.estado,
    error: fd.error,
    disponible: fd.disponible,
    refrescando,
    acciones,
  };

  const extra = (
    <>
      {hojas.elemento}
      <CompletarSheet quest={hojasNivl.quest} onElegir={hojasNivl.onElegir} onClose={hojasNivl.onClose} />
    </>
  );

  return { vista, extra };
}
