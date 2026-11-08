// NIVL · Mundo FOCUS: los efectos del inicio (useX del patrón useX + XVista).
//
// · Los datos de FOCUS (useFocusDatos) y las misiones del modo, del mismo Hoy
//   de NIVL (useHoy, que con el modo FOCUS activo ya filtra por etiqueta).
// · El pomodoro (usePomodoro) y lo que pasa al terminar un bloque de foco
//   ENTERO, una vez por bloque:
//     1. se registra la sesión (horas por asignatura; sin la 0076, nada);
//     2. UN SOLO GESTO (src/focus/actoEstudio.ts): con los minutos reales de hoy
//        se calculan las misiones cubiertas y se propaga el acto 'estudio'
//        (misión por complete_quest, regla y bloque del plan). El bloque no
//        paga nada por su cuenta: cero economía nueva;
//     3. si el bloque tenía tema, «¿Cómo te ha ido?» mueve el tema. La hoja
//        espera a que se vaya la pantalla de concentración (en iOS, un Modal
//        sobre otro que se va no se abre) y la celebración espera a la hoja.
// · El arranque guiado: asignaturas, primer examen, preferencias y misión.

import { router } from 'expo-router';
import { rutaFocus } from '@/components/modos/mundo/prestadoRutas';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useCelebracion } from '@/components/celebracion/contexto';
import { CompletarSheet } from '@/components/CompletarSheet';
import { useHoy } from '@/components/hoy/useHoy';
import { EmblemaMundo } from '@/components/modos/EmblemaMundo';
import { CabeceraMundo } from '@/components/modos/mundo/CabeceraMundo';
import { useMundo } from '@/components/modos/mundo/useMundo';
import { confirmar } from '@/components/ui';
import { vibrar } from '@/design/haptics';
import { reenviarEstudio, trasEstudiar, type ResultadoActoEstudio } from '@/focus/actoEstudio';
import { PLANTILLAS } from '@/focus/arranque';
import type { ResultadoBloque } from '@/focus/cierreBloque';
import { asegurarMisionFocus, cerrarBloqueTema, crearAsignaturas, crearExamen, crearTemas, guardarPrefs, marcarEntrega } from '@/focus/datos';
import { misionPropuesta } from '@/focus/mision';
import type { Cierre, ConfigPomodoro } from '@/focus/pomodoro';
import type { Tema } from '@/focus/tipos';
import { t } from '@/i18n';
import { useAuth } from '@/lib/auth';
import { dateKey } from '@/lib/dates';
import { XP_BY_DIFFICULTY } from '@/lib/game';
import type { FocusHoyVistaProps } from './FocusHoyVista';
import { HojaCierreBloque } from './HojaCierreBloque';
import { escucharPedidos, pedidoAtendido } from './pedido';
import { useFocusDatos } from './useFocusDatos';
import { useHojasFocus } from './useHojasFocus';
import { usePomodoro } from './usePomodoro';
import { conHeroe, vistaHoy, type MisionEnlazable } from './vistaHoy';

/** Lo que tarda en irse un Modal antes de poder presentar otro (iOS). */
const ESPERA_MODAL = 450;
/** Cada cuánto se reintenta lo que quedó sin enviar (sin nada pendiente, no toca la red). */
const REINTENTO_COLA = 45_000;

export function useFocusHoy() {
  const { session } = useAuth();
  const uid = session?.user.id ?? null;
  const fd = useFocusDatos();
  const { vista: nivl, hojas: hojasNivl } = useHoy();
  const mundo = useMundo('focus');
  const { celebrar, avisar } = useCelebracion();
  const hoy = dateKey();
  const pagados = useRef(new Set<string>());
  const datosRef = useRef(fd.datos);
  datosRef.current = fd.datos;
  const [enArranque, setEnArranque] = useState(false);
  const [huecoVisto, setHuecoVisto] = useState(false);
  const cerrojoArranque = useRef(false);

  // La hoja «¿Cómo te ha ido?».
  const [cierreTema, setCierreTema] = useState<Tema | null>(null);
  const [cierreVisible, setCierreVisible] = useState(false);
  const cierreAbierto = useRef(false);
  const trasCierre = useRef<(() => void) | null>(null);
  const relojCierre = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (relojCierre.current) clearTimeout(relojCierre.current);
    },
    [],
  );

  const cerrarCierre = useCallback(() => {
    if (!cierreAbierto.current) return;
    cierreAbierto.current = false;
    setCierreVisible(false);
    if (relojCierre.current) clearTimeout(relojCierre.current);
    relojCierre.current = setTimeout(() => {
      const f = trasCierre.current;
      trasCierre.current = null;
      f?.();
    }, ESPERA_MODAL);
  }, []);

  const misiones: MisionEnlazable[] | null =
    nivl.estado === 'cargando'
      ? null
      : nivl.datos.misiones.map((m) => ({
          id: m.quest.id,
          titulo: m.quest.title,
          hecha: m.hecha,
          xp: XP_BY_DIFFICULTY[m.quest.difficulty] ?? 0,
          penalizacion: m.quest.is_penalty,
          link: m.quest.link,
          modos: m.quest.modes ?? [],
        }));

  const refrescarNivl = nivl.acciones.onRefrescar;
  const recargar = fd.recargar;

  const alAcabar = useCallback(
    (cierre: Cierre, _c: ConfigPomodoro) => {
      const foco = cierre.focoCompleto;
      if (!foco || !uid || pagados.current.has(foco.idFase)) return;
      pagados.current.add(foco.idFase);
      // El día en que arrancó: abrir la app mañana no lo apunta a mañana.
      const fecha = foco.fecha;
      const tema = foco.objetivo.temaId ? (datosRef.current.temas.find((x) => x.id === foco.objetivo.temaId) ?? null) : null;
      if (tema) {
        cierreAbierto.current = true;
        setCierreTema(tema);
        if (relojCierre.current) clearTimeout(relojCierre.current);
        relojCierre.current = setTimeout(() => setCierreVisible(true), ESPERA_MODAL);
      }
      void (async () => {
        const r = await trasEstudiar({
          uid,
          sesiones: [
            {
              clientId: foco.idFase,
              asignaturaId: foco.objetivo.asignaturaId,
              temaId: foco.objetivo.temaId,
              misionId: foco.objetivo.misionId,
              fecha,
              minutos: foco.minutos,
              metodo: foco.objetivo.simulacro ? 'anteriores' : 'pomodoro',
              salidas: foco.salidas,
            },
          ],
          asignaturas: datosRef.current.asignaturas,
        });
        const premiar = () => {
          if (r && r.propagado.xp > 0) {
            vibrar('mision');
            celebrar({
              accion: `focus:${foco.idFase}`,
              perfilAntes: r.antes,
              perfilDespues: r.propagado.profile,
              fecha,
              resumen: [t('focus:fin.resumen', { xp: r.propagado.xp, titulo: r.propagado.marcadas.join(', ') })],
              final: true,
            });
          } else {
            avisar(t('focus:fin.bloque', { count: foco.minutos }));
          }
        };
        if (cierreAbierto.current) trasCierre.current = premiar;
        else premiar();
        refrescarNivl();
        await recargar();
      })();
    },
    [uid, celebrar, avisar, refrescarNivl, recargar],
  );

  // En frío el bloque acabado fuera espera a los datos: sin ellos no hay tema ni asignaturas.
  const datosListos = fd.estado === 'listo';
  const pomodoro = usePomodoro(uid, alAcabar, datosListos);
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

  const trasActo = useCallback(
    (r: ResultadoActoEstudio | null) => {
      if (r && r.propagado.xp > 0) {
        vibrar('mision');
        celebrar({
          accion: `focus:repaso:${r.propagado.marcadas.join(',')}`,
          perfilAntes: r.antes,
          perfilDespues: r.propagado.profile,
          fecha: dateKey(),
          resumen: [t('focus:fin.resumen', { xp: r.propagado.xp, titulo: r.propagado.marcadas.join(', ') })],
          final: true,
        });
      }
      refrescarNivl();
    },
    [celebrar, refrescarNivl],
  );

  // Lo que quedó sin enviar (sin red al acabar el bloque): al abrir, al volver y cada rato.
  useEffect(() => {
    if (!uid || !datosListos) return;
    const reintentar = () => {
      void reenviarEstudio(uid, datosRef.current.asignaturas).then((r) => {
        if (r.enviadas === 0 && !r.acto) return;
        trasActo(r.acto);
        void recargar();
      });
    };
    reintentar();
    const reloj = setInterval(reintentar, REINTENTO_COLA);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') reintentar();
    });
    return () => {
      clearInterval(reloj);
      sub.remove();
    };
  }, [uid, datosListos, trasActo, recargar]);

  // En frío sin red no hay datos: al volver se intenta otra vez (el bloque acabado espera).
  useEffect(() => {
    if (fd.estado !== 'error') return;
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void recargar();
    });
    return () => sub.remove();
  }, [fd.estado, recargar]);

  const hojas = useHojasFocus({
    datos: fd,
    hoy,
    pomodoro,
    misiones: misiones ?? [],
    onEstudiar: (asignaturaId, temaId) => fijarObjetivo({ ...pomo.objetivo, asignaturaId, temaId }),
    onActo: trasActo,
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

  const nombreDe = (id: string | null) => (id ? (fd.datos.asignaturas.find((a) => a.id === id)?.nombre ?? null) : null);

  const elegirCierre = (r: ResultadoBloque) => {
    const tema = cierreTema;
    cerrarCierre();
    if (!tema || r === 'sin_acabar') return;
    vibrar('seleccion');
    void fd.hacer(() => cerrarBloqueTema(tema, r, dateKey()));
  };

  const acciones: FocusHoyVistaProps['acciones'] = {
    onEmpezar: () => {
      if (pomo.pausaRestante !== null || pomo.fase !== 'foco') {
        pomodoro.empezar();
        return;
      }
      const toca = v.toca;
      if (toca.tipo === 'repasar') {
        hojas.abrir.repaso();
        return;
      }
      pomodoro.empezar(
        {
          asignaturaId: toca.asignaturaId,
          temaId: toca.temaId,
          misionId: pomo.objetivo.misionId ?? misionPropuesta(misiones ?? [], nombreDe(toca.asignaturaId))?.id ?? null,
          ...(toca.tipo === 'simulacro' ? { simulacro: true } : {}),
        },
        toca.tipo === 'simulacro' ? toca.minutos : undefined,
      );
    },
    onPausar: pomodoro.pausar,
    onSaltar: pomodoro.saltar,
    onParar: async () => {
      if (pomo.fase === 'foco' && (pomo.finEn !== null || pomo.pausaRestante !== null)) {
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
      if (b.tipo === 'repasar') {
        hojas.abrir.repaso();
        return;
      }
      fijarObjetivo({
        asignaturaId: b.asignaturaId,
        temaId: b.temaId,
        misionId: pomo.objetivo.misionId ?? misionPropuesta(misiones ?? [], b.asignatura)?.id ?? null,
      });
    },
    onElegirAsignatura: (id) => {
      vibrar('seleccion');
      const misionId = pomo.objetivo.misionId;
      if (pomo.objetivo.asignaturaId === id) {
        fijarObjetivo({ asignaturaId: null, temaId: null, misionId });
        return;
      }
      const delPlan = v.plan.bloques.find((f) => f.bloque.asignaturaId === id && f.bloque.tipo === 'estudiar')?.bloque;
      fijarObjetivo({ asignaturaId: id, temaId: delPlan?.temaId ?? null, misionId });
    },
    onEntregaHecha: (id) => {
      vibrar('seleccion');
      void fd.hacer(() => marcarEntrega(id, hoy));
    },
    onRepasar: () => hojas.abrir.repaso(),
    onRetomarHueco: () => {
      if (v.hueco) hojas.abrir.repasoDe(v.hueco.temaIds);
    },
    onCerrarHueco: () => setHuecoVisto(true),
    onAnadirTemas: (asignaturaId) => hojas.abrir.temas(asignaturaId),
    onCompletarMision: (id) => {
      const m = nivl.datos.misiones.find((x) => x.quest.id === id);
      if (m) nivl.acciones.onCompletar(m.quest);
    },
    onCoach: () => router.navigate(rutaFocus('coach')),
    onAnadirAsignatura: hojas.abrir.asignatura,
    onAnadirExamen: () => hojas.abrir.examen(),
    onArranqueAsignaturas: (nombres) => {
      setEnArranque(true);
      return fd.hacer(() => crearAsignaturas(nombres, 0));
    },
    onArranqueFin: async (perfil, examen, titulo) => {
      if (cerrojoArranque.current) return;
      cerrojoArranque.current = true;
      try {
        if (examen) {
          const ok = await fd.hacer(async () => {
            await crearExamen({ asignaturaId: examen.asignaturaId, titulo, fecha: examen.fecha, peso: null, temas: [] }, 0);
            // Temario general: cuenta para cualquier examen de la asignatura.
            if (examen.temas.length > 0) await crearTemas(examen.asignaturaId, examen.temas, null, 0);
          });
          if (!ok) return;
        }
        await fd.hacer(() => guardarPrefs({ ...fd.datos.prefs, perfil, minutosDia: PLANTILLAS[perfil].minutosDia, arranqueHecho: true }));
        if (uid) {
          try {
            await asegurarMisionFocus(uid, t('focus:hoyArranque.mision'));
            refrescarNivl();
          } catch {
            // Sin misión se estudia igual: no tumba el arranque.
          }
        }
        setEnArranque(false);
      } finally {
        cerrojoArranque.current = false;
      }
    },
    onReintentar: () => void fd.recargar(),
    onRefrescar: () => {
      setRefrescando(true);
      refrescarNivl();
      void fd.recargar().finally(() => setRefrescando(false));
    },
  };

  const vista: FocusHoyVistaProps = {
    ...v,
    arranque: v.arranque || enArranque,
    hueco: huecoVisto ? null : v.hueco,
    hoy,
    // Con héroe, el nivel va en su escudo; en los demás estados, en la cabecera.
    cabecera: (
      <CabeceraMundo
        modo="focus"
        nivel={mundo.nivel}
        emblema={<EmblemaMundo modo="focus" />}
        conNivel={!conHeroe({ estado: fd.estado, disponible: fd.disponible, arranque: v.arranque || enArranque, sinAsignaturas: v.sinAsignaturas })}
      />
    ),
    nivel: mundo.nivel,
    estado: fd.estado,
    error: fd.error,
    disponible: fd.disponible,
    refrescando,
    acciones,
  };

  const extra = (
    <>
      {hojas.elemento}
      <HojaCierreBloque visible={cierreVisible} tema={cierreTema?.nombre ?? ''} onElegir={elegirCierre} onClose={cerrarCierre} />
      <CompletarSheet quest={hojasNivl.quest} onElegir={hojasNivl.onElegir} onClose={hojasNivl.onClose} />
    </>
  );

  return { vista, extra };
}
