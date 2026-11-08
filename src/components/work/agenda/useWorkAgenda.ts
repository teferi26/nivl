// NIVL · WORK: la Agenda (efectos). Envuelve useAgenda sin tocarla y añade lo
// propio del trabajo: reunión o bloque en dos toques y el calendario del teléfono.
//
// Ningún gesto de aquí mueve XP.

import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Linking } from 'react-native';
import { useAgenda } from '@/components/agenda/useAgenda';
import { confirmar } from '@/components/ui/confirmar';
import { useWorkDatos } from '@/components/work/useWorkDatos';
import { vibrar } from '@/design/haptics';
import { t } from '@/i18n';
import { useAuth } from '@/lib/auth';
import { dateKey } from '@/lib/dates';
import { fetchPlan, minutosAhora, type PlanConBloques } from '@/lib/dayplan';
import { mensajeSistema } from '@/lib/validation';
import { aEvento } from '@/work/adaptar';
import {
  duracionDefecto,
  duracionesDe,
  leerHoraEscrita,
  ocupadosDelDia,
  propuestaInicial,
  tramo,
  type TipoRapido,
} from '@/work/agendaRapida';
import { estadoCalendario, puedeDesconectar, type PermisoCalendario } from '@/work/calendario';
import {
  calendarioDisponible,
  conectarCalendario,
  copiarAhora,
  copiarSiToca,
  desconectarCalendario,
  leerMarca,
  leerPermiso,
  type MarcaCalendario,
} from '@/work/calendarioDispositivo';
import { WorkNoDisponible } from '@/work/datos';
import { BloqueSinPermiso, crearBloque, crearReunion } from '@/work/datosCalendario';
import { minAHora, sumarDias } from '@/work/fechas';
import type { HojaCalendarioProps, HojaRapidaProps } from './HojasWorkAgenda';
import type { WorkAgendaVistaProps } from './WorkAgendaVista';

interface Rapida {
  tipo: TipoRapido;
  dia: string;
  hora: string;
  duracion: number;
  titulo: string;
}

const textoDeFallo = (e: unknown) => (e instanceof WorkNoDisponible ? t('trabajo:comun.noDisponibleCuerpo') : mensajeSistema(e));

export function useWorkAgenda() {
  const { vista: agenda, hojaEvento, hojaDetalle } = useAgenda();
  const { session } = useAuth();
  const uid = session?.user.id ?? null;
  const { datos, recargar } = useWorkDatos();
  const hoy = dateKey();
  const modulo = useMemo(() => calendarioDisponible(), []);

  // ── Refresco ──────────────────────────────────────────────────────
  // useAgenda solo relee su plan al cambiar de día: el bloque recién reservado se trae aquí.
  const [planFresco, setPlanFresco] = useState<{ dia: string; plan: PlanConBloques | null } | null>(null);
  useEffect(() => setPlanFresco(null), [agenda.dia]);
  const plan = planFresco?.dia === agenda.dia ? planFresco.plan : agenda.plan;

  const refrescar = () => {
    agenda.acciones.onReintentar();
    void recargar();
  };

  // ── Calendario ────────────────────────────────────────────────────
  const [marca, setMarca] = useState<MarcaCalendario | null>(null);
  const [permiso, setPermiso] = useState<PermisoCalendario>('undetermined');
  const [hojaCal, setHojaCal] = useState(false);
  const [calOcupado, setCalOcupado] = useState(false);
  const [calError, setCalError] = useState<string | null>(null);
  const calCerrojo = useRef(false);

  useFocusEffect(
    useCallback(() => {
      if (!uid || !modulo) return;
      let vivo = true;
      void (async () => {
        const [m, p] = await Promise.all([leerMarca(uid), leerPermiso()]);
        if (!vivo) return;
        setMarca(m);
        setPermiso(p);
        if (m.conectado && p === 'granted' && (await copiarSiToca(uid, dateKey(), t('trabajoagenda:calendario.sinTitulo'), m.ultimaMs)) && vivo) {
          setMarca(await leerMarca(uid));
          refrescar();
        }
      })();
      return () => {
        vivo = false;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [uid, modulo]),
  );

  const hayImportados = datos.eventos.some((e) => e.origen === 'dispositivo');
  const estadoCal = modulo && marca ? estadoCalendario({ modulo, marcado: marca.conectado, hayImportados, permiso }) : 'oculto';

  const conCerrojo = async (fn: () => Promise<void>) => {
    if (calCerrojo.current) return;
    calCerrojo.current = true;
    setCalOcupado(true);
    setCalError(null);
    try {
      await fn();
    } catch (e) {
      vibrar('penalizacion');
      setCalError(textoDeFallo(e));
    } finally {
      calCerrojo.current = false;
      setCalOcupado(false);
    }
  };

  const conectar = () =>
    conCerrojo(async () => {
      if (!uid) return;
      const r = await conectarCalendario(uid, hoy, t('trabajoagenda:calendario.sinTitulo'));
      setPermiso(await leerPermiso());
      if (r !== 'conectado') return;
      setMarca(await leerMarca(uid));
      setHojaCal(false);
      refrescar();
    });

  const actualizar = () =>
    conCerrojo(async () => {
      if (!uid) return;
      await copiarAhora(uid, hoy, t('trabajoagenda:calendario.sinTitulo'));
      setMarca(await leerMarca(uid));
      setHojaCal(false);
      refrescar();
    });

  const desconectar = async () => {
    const ok = await confirmar({
      titulo: t('trabajoagenda:calendario.desconectar'),
      mensaje: t('trabajoagenda:calendario.confirmarDesconectar'),
      confirmar: t('trabajoagenda:calendario.desconectarBoton'),
      destructivo: true,
    });
    if (!ok) return;
    await conCerrojo(async () => {
      if (!uid) return;
      await desconectarCalendario(uid);
      vibrar('destructiva');
      setMarca({ conectado: false, ultimaMs: null });
      setHojaCal(false);
      refrescar();
    });
  };

  // ── Reunión o bloque en dos toques ────────────────────────────────
  const [rapida, setRapida] = useState<Rapida | null>(null);
  const [rapidaAbierta, setRapidaAbierta] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [errorHora, setErrorHora] = useState<string | null>(null);
  const [errorGuardar, setErrorGuardar] = useState<string | null>(null);
  const cerrojo = useRef(false);

  const abrirRapida = (tipo: TipoRapido) => {
    const duracion = duracionDefecto(tipo);
    const dia = agenda.dia < hoy ? hoy : agenda.dia;
    const eventos = agenda.events.map((e) => aEvento(e as Parameters<typeof aEvento>[0]));
    const bloques = dia === agenda.dia ? (plan?.bloques ?? []) : [];
    const p = propuestaInicial({ dia, hoy, ahoraMin: minutosAhora(), ocupados: ocupadosDelDia(eventos, bloques, dia), duracion });
    setRapida({ tipo, dia: p.dia, hora: minAHora(p.inicioMin), duracion, titulo: '' });
    setErrorHora(null);
    setErrorGuardar(null);
    setRapidaAbierta(true);
  };

  const cambiarRapida = (c: Partial<Rapida>) => {
    setErrorHora(null);
    setErrorGuardar(null);
    setRapida((r) => (r ? { ...r, ...c } : r));
  };

  const guardarRapida = async () => {
    if (!uid || !rapida || cerrojo.current) return;
    const t0 = tramo(leerHoraEscrita(rapida.hora), rapida.duracion);
    if (!t0) {
      setErrorHora(t('trabajoagenda:agenda.horaInvalida'));
      return;
    }
    cerrojo.current = true;
    setGuardando(true);
    setErrorGuardar(null);
    const fila = {
      titulo: rapida.titulo.trim() || t(rapida.tipo === 'reunion' ? 'trabajoagenda:agenda.tituloReunion' : 'trabajoagenda:agenda.tituloBloque'),
      fecha: rapida.dia,
      inicioMin: t0.inicio,
      finMin: t0.fin,
    };
    try {
      if (rapida.tipo === 'reunion') await crearReunion(uid, fila);
      else {
        await crearBloque(uid, fila);
        if (rapida.dia === agenda.dia) setPlanFresco({ dia: rapida.dia, plan: await fetchPlan(rapida.dia) });
      }
      setRapidaAbierta(false);
      refrescar();
    } catch (e) {
      vibrar('penalizacion');
      setErrorGuardar(e instanceof BloqueSinPermiso ? t('trabajoagenda:agenda.bloqueSinPermiso') : textoDeFallo(e));
    } finally {
      cerrojo.current = false;
      setGuardando(false);
    }
  };

  const vista: WorkAgendaVistaProps = {
    agenda: { ...agenda, plan, onVolver: undefined },
    barra: {
      estadoCalendario: estadoCal,
      onReunion: () => abrirRapida('reunion'),
      onBloque: () => abrirRapida('bloque'),
      onCalendario: () => {
        setCalError(null);
        setHojaCal(true);
      },
    },
  };

  const hojaRapida: HojaRapidaProps = {
    visible: rapidaAbierta,
    tipo: rapida?.tipo ?? 'reunion',
    hoy,
    manana: sumarDias(hoy, 1),
    dia: rapida?.dia ?? hoy,
    titulo: rapida?.titulo ?? '',
    hora: rapida?.hora ?? '',
    duracion: rapida?.duracion ?? duracionDefecto('reunion'),
    duraciones: duracionesDe(rapida?.tipo ?? 'reunion'),
    guardando,
    errorHora,
    errorGuardar,
    onTitulo: (titulo) => cambiarRapida({ titulo }),
    onDia: (dia) => cambiarRapida({ dia }),
    onHora: (hora) => cambiarRapida({ hora }),
    onDuracion: (duracion) => cambiarRapida({ duracion }),
    onGuardar: guardarRapida,
    onCerrar: () => setRapidaAbierta(false),
  };

  const hojaCalendario: HojaCalendarioProps = {
    visible: hojaCal,
    estado: estadoCal,
    puedeDesconectar: puedeDesconectar(estadoCal, hayImportados),
    ocupado: calOcupado,
    error: calError,
    onConectar: conectar,
    onActualizar: actualizar,
    onDesconectar: desconectar,
    onAjustes: () => {
      Linking.openSettings().catch(() => {});
    },
    onCerrar: () => setHojaCal(false),
  };

  return { vista, hojaEvento, hojaDetalle, hojaRapida, hojaCalendario };
}
