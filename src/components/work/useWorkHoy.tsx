// NIVL · WORK: los efectos de Hoy (useX del patrón useX + XVista).
//
// · Las misiones, el cierre y el orden del día son los de siempre (useHoy, que
//   con el modo WORK activo filtra por etiqueta); completar pasa por su misma
//   hoja y su mismo cerrojo.
// · Los proyectos, sesiones y eventos, de useWorkDatos.
// · El bloque (useBloque) y lo que pasa al terminar: cero XP propio. Paga la
//   misión por complete_quest y el acto por propagarActo (docs/modos/WORK.md).

import { router, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal } from 'react-native';
import { useCelebracion } from '@/components/celebracion/contexto';
import { CompletarSheet } from '@/components/CompletarSheet';
import { useHoy } from '@/components/hoy/useHoy';
import { EmblemaMundo } from '@/components/modos/EmblemaMundo';
import { CabeceraMundo } from '@/components/modos/mundo/CabeceraMundo';
import { useMundo } from '@/components/modos/mundo/useMundo';
import { OrdenDelDia } from '@/components/OrdenDelDia';
import { confirmar } from '@/components/ui';
import { useMovimientoReducido } from '@/components/ui/motion';
import { vibrar } from '@/design/haptics';
import { t } from '@/i18n';
import { useAuth } from '@/lib/auth';
import { ensureProfile, fetchQuests } from '@/lib/data';
import { dateKey } from '@/lib/dates';
import { completeQuest } from '@/lib/engine';
import { propagarActo } from '@/lib/links';
import type { Profile, Quest } from '@/lib/types';
import { aBloquePlan, aMision } from '@/work/adaptar';
import { cierreDe, terminar } from '@/work/bloque';
import { ejecutarCierre, type ResultadoBloque } from '@/work/cierreBloque';
import { registrarSesion, retirarPrioridadesCaducadas, soltarPrioridad, WorkNoDisponible } from '@/work/datos';
import { crearPrioridadesDelDia } from '@/work/datosGestion';
import { minutosLocal, sumarDias } from '@/work/fechas';
import { facturablePorDefecto, totalHoras } from '@/work/horas';
import { vistaBloque, vistaWorkHoy, type MisionEntrada } from '@/work/vistaHoy';
import { BloqueVista, type BloqueVistaProps } from './BloqueVista';
import { LineaEconomia, useLineaEconomia } from './LineaEconomia';
import { useBloque, type CerrarBloque } from './useBloque';
import { useWorkDatos } from './useWorkDatos';
import type { DestinoWork, WorkHoyVistaProps } from './WorkHoyVista';

/** Da tiempo a que la pantalla del bloque (un Modal) se vaya antes de la ceremonia, otro Modal. */
const ESPERA_CIERRE_MODAL = 420;

const RUTAS: Record<DestinoWork, Href> = {
  proyectos: '/work/proyectos',
  horas: '/work/horas',
  revision: '/work/revision',
  carga: '/work/revision?ver=carga',
};

export function useWorkHoy() {
  const { session } = useAuth();
  const uid = session?.user.id ?? null;
  const wd = useWorkDatos();
  const { vista: nivl, hojas } = useHoy();
  const mundo = useMundo('work');
  const { celebrar } = useCelebracion();
  const reducido = useMovimientoReducido();
  const hoy = dateKey();

  // Lo último, para los callbacks que corren después de que el bloque acabe.
  const refs = useRef({ proyectos: wd.datos.proyectos, refrescar: nivl.acciones.onRefrescar, recargar: wd.recargar });
  refs.current = { proyectos: wd.datos.proyectos, refrescar: nivl.acciones.onRefrescar, recargar: wd.recargar };

  const cerrar: CerrarBloque = useCallback(
    async (c, actoHecho, fijarActoHecho) => {
      const dia = dateKey();
      if (!uid) return { minutos: c.minutos, guardado: false, cuenta: c.cuenta, xp: 0, marcadas: [], reintentar: true, antes: null, despues: null };
      const r = await ejecutarCierre<Profile, Quest>(c, dia, actoHecho, {
        registrar: async (x) => {
          const proyecto = refs.current.proyectos.find((p) => p.id === x.proyectoId) ?? null;
          try {
            await registrarSesion({
              clientId: x.clientId,
              tipo: 'bloque',
              proyectoId: x.proyectoId,
              entregaId: x.entregaId,
              questId: x.questId,
              fecha: x.fecha,
              inicioMin: x.inicioMin,
              minutos: x.minutos,
              facturable: facturablePorDefecto(proyecto),
            });
            return true;
          } catch (e) {
            // Sin la 0115 no hay dónde guardar: no es un fallo que reintentar.
            if (e instanceof WorkNoDisponible) return false;
            throw e;
          }
        },
        perfil: () => ensureProfile(uid),
        misiones: fetchQuests,
        completar: (p, q) => completeQuest(p, q, null),
        fijarActoHecho,
        propagar: async (p) => {
          const res = await propagarActo(p, 'trabajo', dia, c.bloquePlanId);
          return { xp: res.xp, marcadas: res.marcadas, profile: res.profile };
        },
      });
      if (r.xp > 0) vibrar('mision');
      refs.current.refrescar();
      await refs.current.recargar();
      return r;
    },
    [uid],
  );

  const bloque = useBloque(uid, cerrar);
  const [minutosElegidos, setMinutosElegidos] = useState<number | null>(null);

  // Las prioridades duran un día. Con Hoy ya cargado: el cierre de ayer va antes.
  const retirado = useRef<string | null>(null);
  const misionesRef = useRef(nivl.datos.misiones);
  misionesRef.current = nivl.datos.misiones;
  const hayError = nivl.error !== null;
  const cargado = nivl.estado === 'listo';
  useEffect(() => {
    if (!cargado || hayError || retirado.current === hoy) return;
    retirado.current = hoy;
    void retirarPrioridadesCaducadas(hoy).then(() => {
      // Con más de una semana sin abrir, una vieja cae en el día de la semana de hoy.
      if (misionesRef.current.some((m) => m.quest.work_day && m.quest.work_day < hoy)) refs.current.refrescar();
    });
  }, [cargado, hayError, hoy]);

  const fecha = new Date(bloque.ahora);
  const ahoraMin = minutosLocal(fecha);
  const misiones: MisionEntrada[] = useMemo(() => nivl.datos.misiones.map((m) => ({ ...aMision(m), bloqueada: m.bloqueada })), [nivl.datos.misiones]);
  const plan = useMemo(() => (nivl.datos.orden?.bloques ?? []).map(aBloquePlan), [nivl.datos.orden]);
  // El reloj cuenta por minutos: con la pantalla del bloque delante no hace falta rederivar Hoy cada segundo.
  const minutoBloque = Math.floor(bloque.ahora / 60_000);
  const v = useMemo(
    () =>
      vistaWorkHoy({
        fecha: hoy,
        ahoraMin,
        ahoraMs: minutoBloque * 60_000,
        misiones,
        plan,
        eventos: wd.datos.eventos,
        entregas: wd.datos.entregas,
        sesiones: wd.datos.sesiones,
        bloque: bloque.estado,
        disponible: wd.disponible,
        misionesFiables: !hayError,
      }),
    [hoy, ahoraMin, minutoBloque, misiones, plan, wd.datos.eventos, wd.datos.entregas, wd.datos.sesiones, bloque.estado, wd.disponible, hayError],
  );
  const minutos = minutosElegidos ?? v.duracionPropuesta;
  const porFacturar = useMemo(() => totalHoras(wd.datos.sesiones, wd.datos.proyectos, sumarDias(hoy, -60), hoy).porFacturarImporte ?? 0, [hoy, wd.datos.sesiones, wd.datos.proyectos]);
  const lineaEconomia = useLineaEconomia(porFacturar);

  const proyectoDe = (entregaId: string | null) => (entregaId ? (wd.datos.entregas.find((e) => e.id === entregaId)?.proyectoId ?? null) : null);

  const refrescarTodo = async () => {
    await Promise.resolve(nivl.acciones.onRefrescar());
    await wd.recargar();
  };

  const celebrarResultado = (r: ResultadoBloque | null) => {
    if (!r || !r.antes || !r.despues || r.xp <= 0) return;
    const { antes, despues } = r;
    // El resumen ya dijo la cifra: aquí solo nivel, racha y logros.
    setTimeout(() => celebrar({ accion: `work:${Date.now()}`, perfilAntes: antes, perfilDespues: despues, fecha: hoy, final: true }), ESPERA_CIERRE_MODAL);
  };

  const acciones: WorkHoyVistaProps['acciones'] = {
    onEmpezarAhora: () => {
      const a = v.ahora;
      bloque.empezar({ titulo: a.titulo, questId: a.questId, entregaId: a.entregaId, proyectoId: proyectoDe(a.entregaId), bloquePlanId: a.bloquePlanId, minutos });
      setMinutosElegidos(null);
    },
    onSeguirBloque: bloque.abrir,
    onMinutos: setMinutosElegidos,
    onEmpezarFila: (id) => {
      const f = v.prioridades.find((x) => x.id === id) ?? v.resto.find((x) => x.id === id);
      if (!f) return;
      bloque.empezar({ titulo: f.titulo, questId: f.id, entregaId: null, proyectoId: null, bloquePlanId: null, minutos });
      setMinutosElegidos(null);
    },
    onCompletar: (id) => {
      const m = nivl.datos.misiones.find((x) => x.quest.id === id);
      if (m) nivl.acciones.onCompletar(m.quest);
    },
    onSoltar: (id) => {
      void wd.hacer(() => soltarPrioridad(id, hoy)).then(() => refrescarTodo());
    },
    onPlanificar: async (titulos) => {
      if (!uid) return false;
      const ok = await wd.hacer(async () => {
        await crearPrioridadesDelDia(uid, titulos, hoy);
      });
      if (ok) await Promise.resolve(nivl.acciones.onRefrescar());
      return ok;
    },
    onIr: (d) => router.push(RUTAS[d]),
    onReintentar: () => void refrescarTodo(),
    onRefrescar: () => void refrescarTodo(),
  };

  const vista: WorkHoyVistaProps = {
    cabecera: <CabeceraMundo modo="work" nivel={mundo.nivel} emblema={<EmblemaMundo modo="work" />} />,
    estado: nivl.estado === 'cargando' || wd.estado === 'cargando' || !bloque.listo ? 'cargando' : 'listo',
    error: nivl.error ?? (wd.estado === 'error' ? wd.error : null),
    cierre: nivl.datos.cierre
      ? {
          alerta: nivl.datos.cierre.alerta,
          // El informe es el de NIVL; aquí se lee sin la metáfora de la arena.
          lineas: nivl.datos.cierre.lineas.map((l) => (l === t('hoy:derivar.puedesRecuperar') ? t('trabajo:hoy.recuperarCierre') : l)),
        }
      : null,
    vista: v,
    ocupada: nivl.ocupada,
    minutos,
    refrescando: nivl.refrescando,
    orden:
      nivl.datos.orden && nivl.datos.orden.bloques.length > 0 ? (
        <OrdenDelDia plan={nivl.datos.orden.plan} bloques={nivl.datos.orden.bloques} pro={nivl.datos.orden.pro} onToggle={nivl.acciones.onAlternarBloque} />
      ) : undefined,
    economia: lineaEconomia ? <LineaEconomia linea={lineaEconomia} onPress={() => router.navigate('/work-economia')} /> : undefined,
    acciones,
  };

  const pedirTerminar = async () => {
    const e = bloque.estado;
    if (!e) return;
    // Un bloque que ya cuenta, o por debajo de lo que se guarda, no hay nada que perder.
    const c = cierreDe(terminar(e, Date.now()));
    if (c && c.guardar && !c.cuenta) {
      const ok = await confirmar({
        titulo: t('trabajo:bloque.terminarTitulo'),
        mensaje: t(e.questId ? 'trabajo:bloque.terminarConMision' : 'trabajo:bloque.terminarSinMision', { minutos: c.minutos }),
        confirmar: t('trabajo:bloque.terminar'),
        cancelar: t('trabajo:bloque.seguirAqui'),
      });
      if (!ok) return;
    }
    bloque.terminar();
  };

  const vistaDeBloque: BloqueVistaProps | null = bloque.estado
    ? {
        vista: vistaBloque(bloque.estado, bloque.ahora),
        resultado: bloque.resultado,
        cerrando: bloque.cerrando,
        acciones: {
          onPausar: bloque.pausar,
          onSeguir: bloque.reanudar,
          onTerminar: () => void pedirTerminar(),
          onMinimizar: bloque.minimizar,
          onCerrar: () => celebrarResultado(bloque.cerrarResumen()),
        },
      }
    : null;

  const extra = (
    <>
      <CompletarSheet quest={hojas.quest} onElegir={hojas.onElegir} onClose={hojas.onClose} />
      <Modal
        visible={bloque.visible && vistaDeBloque !== null}
        animationType={reducido ? 'none' : 'fade'}
        presentationStyle="fullScreen"
        onRequestClose={() => {
          if (bloque.estado?.fase === 'terminado') {
            if (!bloque.cerrando) celebrarResultado(bloque.cerrarResumen());
          } else bloque.minimizar();
        }}
      >
        {vistaDeBloque ? <BloqueVista {...vistaDeBloque} /> : null}
      </Modal>
    </>
  );

  return { vista, extra };
}
