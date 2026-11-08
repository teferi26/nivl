// NIVL · Resistencia: el hub (efectos). Junta el entreno, el plan, el bienestar
// y la previsión; las cuentas son de los módulos puros (cargamath, mejorHora).
// La pantalla sale con lo suyo y la previsión llega después: es un extra y su
// fallo no tumba nada.

import { conCerrojoCardio } from '@/lib/cerrojoCardio';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { uuidV4 } from '@/components/fotos/modelo';
import { confirmar } from '@/components/ui/confirmar';
import { volver } from '@/components/ui/Screen';
import { vibrar } from '@/design/haptics';
import { t } from '@/i18n';
import { useAuth } from '@/lib/auth';
import { cargaSesion, estadoForma, serieCarga } from '@/lib/cargamath';
import { addDays, dateKey } from '@/lib/dates';
import { fetchPlan } from '@/lib/dayplan';
import { franjasOcupadas, tramoDelDia } from '@/lib/mejorHora';
import {
  fetchBienestar,
  fetchEntrenos,
  fetchObjetivoActivo,
  fetchPerfilEntreno,
  fetchPlanSesiones,
  fetchPrevision,
  guardarEntrenoMedido,
  saveBienestar,
  savePerfilEntreno,
  type Bienestar,
  type EntrenoFila,
  type ObjetivoCarrera,
  type PerfilEntreno,
  type PlanSesionFila,
  type PrevisionDia,
} from '@/lib/resistencia';
import { supabase } from '@/lib/supabase';
import { mensajeSistema } from '@/lib/validation';
import { textoRecord } from './DetalleVista';
import type { HojaBienestarProps } from './HojaBienestar';
import {
  FORM_ENTRENO_VACIO,
  prefillEntreno,
  SIN_ERRORES_ENTRENO,
  validarEntreno,
  type ErroresEntreno,
  type FormEntreno,
  type HojaEntrenoProps,
} from './HojaEntreno';
import { leerCiudades, type CiudadResultado, type HojaUbicacionProps } from './HojaUbicacion';
import { construirSalida, type HubVistaProps } from './HubVista';

/** Días de entrenos que se leen: 120 visibles en la curva y 42 para calentarla. */
const DIAS_HISTORIAL = 162;
const ENTRENOS_EN_HUB = 5;
/** Motivos técnicos de `normalizarEntreno`: nunca llegan a la pantalla. */
const MOTIVOS_TECNICOS = new Set(['no_es_objeto', 'origen', 'deporte', 'externo_id', 'fechas', 'duracion']);

interface Datos {
  entrenos: EntrenoFila[];
  perfil: PerfilEntreno | null;
  objetivo: ObjetivoCarrera | null;
  sesiones: PlanSesionFila[];
  bienestar: Bienestar | null;
  /** Los partes de los tres últimos días: de ahí sale el dolor vigente. */
  partes: Bienestar[];
  ocupadas: { desde: string; hasta: string }[];
  horario: { despertar: string | null; dormir: string | null };
}

const DATOS_VACIOS: Datos = { entrenos: [], perfil: null, objetivo: null, sesiones: [], bienestar: null, partes: [], ocupadas: [], horario: { despertar: null, dormir: null } };

function ahoraHhmm(d: Date = new Date()): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Sin ciudad consentida no hay ubicación, aunque quedara algo a medias. */
function ciudadDe(p: PerfilEntreno | null): string | null {
  return p && p.ubicacion_lat !== null && p.ubicacion_consentida_en ? (p.ubicacion_nombre ?? t('resistencia:salida.tuCiudad')) : null;
}

async function agendaOcupada(fecha: string): Promise<{ desde: string; hasta: string }[]> {
  try {
    const [plan, citas] = await Promise.all([fetchPlan(fecha), supabase.from('calendar_events').select('time').eq('date', fecha)]);
    return franjasOcupadas((plan?.bloques ?? []).filter((b) => !b.done), (citas.data ?? []) as { time: string | null }[]);
  } catch {
    // Accesorio: sin agenda se decide solo por el tiempo.
    return [];
  }
}

/** La hora de levantarse y de acostarse. Sin dato, `tramoDelDia` pone las suyas. */
async function horarioDe(userId: string | undefined): Promise<Datos['horario']> {
  if (!userId) return { despertar: null, dormir: null };
  try {
    const { data } = await supabase.from('profiles').select('wake_time,sleep_time').eq('id', userId).maybeSingle();
    const p = data as { wake_time?: string | null; sleep_time?: string | null } | null;
    return { despertar: p?.wake_time ?? null, dormir: p?.sleep_time ?? null };
  } catch {
    return { despertar: null, dormir: null };
  }
}

/** Hasta la función `prevision`: el texto se manda solo tras aceptar en la hoja. */
async function buscarCiudad(consulta: string): Promise<CiudadResultado[]> {
  // En el cuerpo y no en la URL: los logs de la plataforma guardan las URLs.
  const { data, error } = await supabase.functions.invoke('prevision?accion=buscar', { body: { buscar: consulta }, timeout: 15000 });
  if (error) throw error;
  return leerCiudades(data);
}

function ordenarSesiones(s: readonly PlanSesionFila[]): PlanSesionFila[] {
  return [...s].sort((a, b) => Number(!!a.hecha_entreno_id) - Number(!!b.hecha_entreno_id) || Number(b.clave) - Number(a.clave));
}

export interface UseHub {
  vista: HubVistaProps;
  hojaEntreno: HojaEntrenoProps;
  hojaUbicacion: HojaUbicacionProps;
  hojaBienestar: HojaBienestarProps;
}

export function useHub(): UseHub {
  const { session } = useAuth();
  const userId = session?.user.id;

  const [datos, setDatos] = useState<Datos>(DATOS_VACIOS);
  const [cargado, setCargado] = useState(false);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [refrescando, setRefrescando] = useState(false);
  const [horas, setHoras] = useState<PrevisionDia | null | undefined>(undefined);
  const [anuncio, setAnuncio] = useState<string | null>(null);
  const [anuncioLogro, setAnuncioLogro] = useState(false);
  const turno = useRef(0);
  const cache = useRef<{ clave: string; horas: PrevisionDia } | null>(null);

  const pedirPrevision = useCallback(async (perfil: PerfilEntreno | null, vigente: number) => {
    if (!ciudadDe(perfil)) return;
    // Una por ciudad y hora: volver del detalle no vuelve a preguntar al tiempo.
    const clave = `${perfil?.ubicacion_lat},${perfil?.ubicacion_lon},${dateKey()},${new Date().getHours()}`;
    if (cache.current?.clave === clave) {
      setHoras(cache.current.horas);
      return;
    }
    setHoras(undefined);
    const res = await fetchPrevision();
    if (vigente !== turno.current) return;
    if (res) cache.current = { clave, horas: res };
    setHoras(res);
  }, []);

  const cargar = useCallback(async () => {
    const vigente = ++turno.current;
    const hoy = dateKey();
    try {
      const [entrenos, perfil, objetivo, bienestares, ocupadas, horario] = await Promise.all([
        fetchEntrenos(addDays(hoy, -DIAS_HISTORIAL)),
        fetchPerfilEntreno(),
        fetchObjetivoActivo(),
        fetchBienestar(addDays(hoy, -2)),
        agendaOcupada(hoy),
        horarioDe(userId),
      ]);
      const sesiones = objetivo ? await fetchPlanSesiones(objetivo.id, hoy, hoy) : [];
      if (vigente !== turno.current) return;
      setDatos({ entrenos, perfil, objetivo, sesiones: ordenarSesiones(sesiones), bienestar: bienestares.find((b) => b.fecha === hoy) ?? null, partes: bienestares, ocupadas, horario });
      setErrorCarga(null);
      setCargado(true);
      void pedirPrevision(perfil, vigente);
    } catch (e) {
      if (vigente === turno.current) setErrorCarga(mensajeSistema(e));
    } finally {
      if (vigente === turno.current) setRefrescando(false);
    }
  }, [pedirPrevision, userId]);

  useFocusEffect(
    useCallback(() => {
      void cargar();
      return () => {
        turno.current++;
      };
    }, [cargar]),
  );

  // ── Hoja de entreno ──
  const [hojaAbierta, setHojaAbierta] = useState(false);
  const [form, setForm] = useState<FormEntreno>(FORM_ENTRENO_VACIO);
  const [erroresEntreno, setErroresEntreno] = useState<ErroresEntreno>(SIN_ERRORES_ENTRENO);
  const [guardandoEntreno, setGuardandoEntreno] = useState(false);
  const idManual = useRef('');
  const cerrojoEntreno = useRef(false);

  const abrirEntreno = useCallback(() => {
    idManual.current = uuidV4();
    setForm({ ...FORM_ENTRENO_VACIO, ...prefillEntreno(datos.sesiones) });
    setErroresEntreno(SIN_ERRORES_ENTRENO);
    setHojaAbierta(true);
  }, [datos.sesiones]);

  // Progreso manda aquí a registrar: abre la hoja una vez, ya con el plan leído.
  const { registrar } = useLocalSearchParams<{ registrar?: string }>();
  useEffect(() => {
    if (registrar !== '1' || !cargado) return;
    router.setParams({ registrar: undefined });
    abrirEntreno();
  }, [abrirEntreno, cargado, registrar]);

  const guardarEntreno = useCallback(async () => {
    if (!userId || cerrojoEntreno.current) return;
    const v = validarEntreno(form, new Date(), idManual.current);
    if (!v.ok) {
      setErroresEntreno(v.errores);
      return;
    }
    cerrojoEntreno.current = true;
    try {
      // La hora suele ir a ojo: mismo día y deporte se pregunta, como el coach.
      const fechaNueva = dateKey(new Date(v.entrada.inicio));
      const coincide = datos.entrenos.some((e) => e.fecha === fechaNueva && e.deporte === v.entrada.deporte);
      if (coincide) {
        const esOtra = await confirmar({
          titulo: t('resistencia:hoja.otraSesionTitulo', { deporte: t(`resistencia:deporte.${v.entrada.deporte}`) }),
          mensaje: t('resistencia:hoja.otraSesionCuerpo'),
          confirmar: t('resistencia:hoja.otraSesionConfirmar'),
        });
        if (!esOtra) return;
      }
      setGuardandoEntreno(true);
      setErroresEntreno(SIN_ERRORES_ENTRENO);
      const res = await conCerrojoCardio(userId, () => guardarEntrenoMedido(userId, v.entrada, { rpe: v.rpe, notas: v.notas, esOtraSesion: coincide }));
      if (!res.ok) {
        vibrar('penalizacion');
        setErroresEntreno({ ...SIN_ERRORES_ENTRENO, servidor: MOTIVOS_TECNICOS.has(res.motivo) ? t('resistencia:hoja.errorGuardar') : res.motivo });
        return;
      }
      if (res.records.length > 0) vibrar('misionExtra');
      else if (res.pagado > 0) vibrar('mision');
      setHojaAbierta(false);
      const [primero, ...demas] = res.records;
      const record = !primero
        ? null
        : demas.length > 0
          ? t('resistencia:hub.anuncioRecordMas', { record: textoRecord(primero), count: demas.length })
          : t('resistencia:hub.anuncioRecord', { record: textoRecord(primero) });
      setAnuncioLogro(primero !== undefined);
      setAnuncio([res.anuncio ?? t('resistencia:hub.anuncioGuardado'), record].filter(Boolean).join(' '));
      void cargar();
    } finally {
      cerrojoEntreno.current = false;
      setGuardandoEntreno(false);
    }
  }, [cargar, datos.entrenos, form, userId]);

  // ── Hoja de ubicación ──
  const [ubicacionAbierta, setUbicacionAbierta] = useState(false);
  const [acepta, setAcepta] = useState(false);
  const [consulta, setConsulta] = useState('');
  const [resultados, setResultados] = useState<CiudadResultado[]>([]);
  const [sinResultados, setSinResultados] = useState(false);
  const [elegida, setElegida] = useState<CiudadResultado | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [guardandoUbicacion, setGuardandoUbicacion] = useState(false);
  const [errorUbicacion, setErrorUbicacion] = useState<string | null>(null);

  const abrirUbicacion = useCallback(() => {
    setAcepta(false);
    setConsulta('');
    setResultados([]);
    setSinResultados(false);
    setElegida(null);
    setErrorUbicacion(null);
    setUbicacionAbierta(true);
  }, []);

  const buscar = useCallback(async () => {
    const q = consulta.trim();
    if (!acepta || q.length < 2 || buscando) return;
    setBuscando(true);
    setErrorUbicacion(null);
    setElegida(null);
    try {
      const lista = await buscarCiudad(q);
      setResultados(lista);
      setSinResultados(lista.length === 0);
    } catch (e) {
      setResultados([]);
      setSinResultados(false);
      setErrorUbicacion(mensajeSistema(e));
    } finally {
      setBuscando(false);
    }
  }, [acepta, buscando, consulta]);

  const escribirUbicacion = useCallback(
    async (cambios: Partial<PerfilEntreno>) => {
      if (!userId) return;
      setGuardandoUbicacion(true);
      setErrorUbicacion(null);
      try {
        await savePerfilEntreno(userId, cambios);
        cache.current = null;
        setUbicacionAbierta(false);
        void cargar();
      } catch (e) {
        vibrar('penalizacion');
        setErrorUbicacion(mensajeSistema(e));
      } finally {
        setGuardandoUbicacion(false);
      }
    },
    [cargar, userId],
  );

  // ── Hoja de bienestar ──
  const [bienestarAbierta, setBienestarAbierta] = useState(false);
  const [sueno, setSueno] = useState('');
  const [fatiga, setFatiga] = useState<number | null>(null);
  const [dolor, setDolor] = useState(false);
  const [zona, setZona] = useState('');
  const [guardandoBienestar, setGuardandoBienestar] = useState(false);
  const [erroresBienestar, setErroresBienestar] = useState<HojaBienestarProps['errores']>({ sueno: null, servidor: null });

  const abrirBienestar = useCallback(() => {
    const b = datos.bienestar;
    setSueno(b?.sueno_h !== null && b?.sueno_h !== undefined ? String(b.sueno_h).replace('.', ',') : '');
    setFatiga(b?.fatiga ?? null);
    setDolor(b?.dolor ?? false);
    setZona(b?.dolor_zona ?? '');
    setErroresBienestar({ sueno: null, servidor: null });
    setBienestarAbierta(true);
  }, [datos.bienestar]);

  const guardarBienestar = useCallback(async () => {
    if (!userId || guardandoBienestar) return;
    const texto = sueno.trim().replace(',', '.');
    const horasSueno = texto === '' ? null : Number(texto);
    if (horasSueno !== null && (!Number.isFinite(horasSueno) || horasSueno < 0 || horasSueno > 24)) {
      setErroresBienestar({ sueno: t('resistencia:bienestar.errorSueno'), servidor: null });
      return;
    }
    setGuardandoBienestar(true);
    setErroresBienestar({ sueno: null, servidor: null });
    const previo = datos.bienestar;
    try {
      // Lo que midió el reloj hoy (VFC, pulso en reposo, calidad) no se pisa.
      await saveBienestar(userId, {
        fecha: dateKey(),
        sueno_h: horasSueno,
        fatiga,
        dolor,
        dolor_zona: dolor ? zona.trim().slice(0, 120) || null : null,
        calidad: previo?.calidad ?? null,
        vfc_ms: previo?.vfc_ms ?? null,
        fc_reposo: previo?.fc_reposo ?? null,
        origen: previo?.origen ?? 'manual',
      });
      setBienestarAbierta(false);
      void cargar();
    } catch (e) {
      vibrar('penalizacion');
      setErroresBienestar({ sueno: null, servidor: mensajeSistema(e) });
    } finally {
      setGuardandoBienestar(false);
    }
  }, [cargar, datos.bienestar, dolor, fatiga, guardandoBienestar, sueno, userId, zona]);

  // ── Lo que se pinta ──
  const hoy = dateKey();
  const forma = useMemo(() => {
    const p = datos.perfil;
    const perfilCarga = { fc_max: p?.fc_max ?? null, fc_reposo: p?.fc_reposo ?? null, umbral: p?.fc_umbral ?? null };
    const cargas = datos.entrenos.map((e) => ({
      fecha: e.fecha,
      carga: cargaSesion({ fecha: e.fecha, deporte: e.deporte, duracion_s: e.duracion_s, fc_media: e.fc_media, rpe: e.rpe }, perfilCarga),
    }));
    return estadoForma(serieCarga(cargas, hoy));
  }, [datos.entrenos, datos.perfil, hoy]);

  const ciudad = ciudadDe(datos.perfil);
  const tramo = tramoDelDia({ esHoy: true, ahora: ahoraHhmm(), despertar: datos.horario.despertar, dormir: datos.horario.dormir });
  const salida = construirSalida({
    hoy,
    ahora: tramo.desde,
    hasta: tramo.hasta,
    bienestar: datos.bienestar,
    partes: datos.partes,
    ciudad,
    sesiones: datos.sesiones,
    horas,
    estadoForma: forma.estado,
    ocupadas: datos.ocupadas,
  });

  return {
    vista: {
      cargado,
      errorCarga,
      refrescando,
      hoy,
      objetivo: datos.objetivo,
      sesiones: datos.sesiones,
      salida,
      bienestar: datos.bienestar,
      forma,
      entrenos: datos.entrenos.slice(0, ENTRENOS_EN_HUB),
      anuncio,
      anuncioLogro,
      acciones: {
        onVolver: () => volver(router),
        onReintentar: () => {
          setErrorCarga(null);
          void cargar();
        },
        onRefrescar: () => {
          setRefrescando(true);
          cache.current = null;
          void cargar();
        },
        onRegistrar: abrirEntreno,
        onUbicacion: abrirUbicacion,
        onBienestar: abrirBienestar,
        onCarrera: () => router.push('/resistencia/carrera'),
        onProgreso: () => router.push('/resistencia/progreso'),
        onEntreno: (id) => router.push({ pathname: '/resistencia/[id]', params: { id } }),
        onCerrarAnuncio: () => setAnuncio(null),
      },
    },
    hojaEntreno: {
      visible: hojaAbierta,
      form,
      guardando: guardandoEntreno,
      errores: erroresEntreno,
      onCambio: (c) => {
        setForm((f) => ({ ...f, ...c }));
        setErroresEntreno(SIN_ERRORES_ENTRENO);
      },
      onGuardar: () => void guardarEntreno(),
      onCerrar: () => {
        if (!cerrojoEntreno.current) setHojaAbierta(false);
      },
    },
    hojaUbicacion: {
      visible: ubicacionAbierta,
      actual: ciudad,
      acepta,
      consulta,
      resultados,
      sinResultados,
      elegida,
      buscando,
      guardando: guardandoUbicacion,
      error: errorUbicacion,
      onAcepta: setAcepta,
      onConsulta: setConsulta,
      onBuscar: () => void buscar(),
      onElegir: setElegida,
      onGuardar: () => {
        if (!acepta || !elegida) return;
        void escribirUbicacion({
          ubicacion_lat: elegida.lat,
          ubicacion_lon: elegida.lon,
          ubicacion_nombre: elegida.nombre,
          ubicacion_consentida_en: new Date().toISOString(),
        });
      },
      onRetirar: () =>
        void escribirUbicacion({ ubicacion_lat: null, ubicacion_lon: null, ubicacion_nombre: null, ubicacion_consentida_en: null }),
      onCerrar: () => {
        if (!guardandoUbicacion) setUbicacionAbierta(false);
      },
    },
    hojaBienestar: {
      visible: bienestarAbierta,
      sueno,
      fatiga,
      dolor,
      zona,
      guardando: guardandoBienestar,
      errores: erroresBienestar,
      onSueno: setSueno,
      onFatiga: setFatiga,
      onDolor: setDolor,
      onZona: setZona,
      onGuardar: () => void guardarBienestar(),
      onCerrar: () => {
        if (!guardandoBienestar) setBienestarAbierta(false);
      },
    },
  };
}
