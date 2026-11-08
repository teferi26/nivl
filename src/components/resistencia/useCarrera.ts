// NIVL · Resistencia: la carrera objetivo (efectos). Carga el objetivo activo y
// su plan, crea uno nuevo con `generarPlan` y borra. Los cerrojos son síncronos:
// un doble toque no puede crear dos objetivos.

import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { avisar, confirmar } from '@/components/ui/confirmar';
import { vibrar } from '@/design/haptics';
import { t } from '@/i18n';
import { useAuth } from '@/lib/auth';
import { dateKey } from '@/lib/dates';
import { generarPlan } from '@/lib/planCarrera';
import {
  borrarObjetivo,
  crearObjetivo,
  fetchObjetivoActivo,
  fetchPlanSesiones,
  type ObjetivoCarrera,
  type PlanSesionFila,
} from '@/lib/resistencia';
import { mensajeSistema } from '@/lib/validation';
import { vistaCarrera, type CarreraVistaProps } from './CarreraVista';
import {
  FORM_INICIAL,
  formDeObjetivo,
  previaPlan,
  SIN_ERRORES,
  validarObjetivo,
  type ErroresObjetivo,
  type FormObjetivo,
  type HojaObjetivoProps,
} from './HojaObjetivo';

export interface UseCarrera {
  vista: CarreraVistaProps;
  hoja: HojaObjetivoProps;
}

type Datos = { objetivo: ObjetivoCarrera | null; filas: PlanSesionFila[] };

/** ¿Quedaban menos de seis semanas cuando se creó el plan? No se guarda: se recalcula. */
function eraPlazoCorto(o: ObjetivoCarrera | null): boolean {
  if (!o) return false;
  return (
    generarPlan({
      tipo: o.tipo,
      fecha_prueba: o.fecha,
      hoy: dateKey(new Date(o.created_at)),
      horas_semana: o.horas_semana,
      nivel: o.nivel,
    }).aviso !== null
  );
}

export function useCarrera(): UseCarrera {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const hoy = dateKey();
  const [estado, setEstado] = useState<CarreraVistaProps['estado']>('cargando');
  const [error, setError] = useState<string | null>(null);
  const [datos, setDatos] = useState<Datos>({ objetivo: null, filas: [] });
  const [refreshing, setRefreshing] = useState(false);
  const [borrando, setBorrando] = useState(false);
  const [abierta, setAbierta] = useState(false);
  const [form, setForm] = useState<FormObjetivo>(FORM_INICIAL);
  const [errores, setErrores] = useState<ErroresObjetivo>(SIN_ERRORES);
  const [guardando, setGuardando] = useState(false);
  const turno = useRef(0);
  const cerrojo = useRef(false);
  const objetivoActual = useRef<ObjetivoCarrera | null>(null);
  objetivoActual.current = datos.objetivo;

  const cargar = useCallback(async () => {
    const mio = ++turno.current;
    try {
      const objetivo = await fetchObjetivoActivo();
      const filas = objetivo ? await fetchPlanSesiones(objetivo.id) : [];
      if (mio !== turno.current) return;
      setDatos({ objetivo, filas });
      setError(null);
      setEstado('listo');
    } catch (e) {
      if (mio !== turno.current) return;
      setError(mensajeSistema(e));
      // Con datos ya pintados, un fallo al refrescar no se los lleva.
      setEstado((previo) => (previo === 'listo' ? previo : 'error'));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void cargar();
      return () => {
        turno.current++;
      };
    }, [cargar]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void cargar().finally(() => setRefreshing(false));
  }, [cargar]);

  const onReintentar = useCallback(() => {
    // Con datos ya pintados, reintentar no se los lleva.
    setError(null);
    setEstado((previo) => (previo === 'listo' ? previo : 'cargando'));
    void cargar();
  }, [cargar]);

  const onObjetivo = useCallback(() => {
    setErrores(SIN_ERRORES);
    setForm(objetivoActual.current ? formDeObjetivo(objetivoActual.current) : FORM_INICIAL);
    setAbierta(true);
  }, []);

  const onCerrar = useCallback(() => {
    if (!cerrojo.current) setAbierta(false);
  }, []);

  const onCambiar = useCallback((cambios: Partial<FormObjetivo>) => {
    setForm((f) => ({ ...f, ...cambios }));
    setErrores(SIN_ERRORES);
  }, []);

  const onGuardar = useCallback(async () => {
    if (cerrojo.current || !userId) return;
    const v = validarObjetivo(form, hoy);
    if (!v.ok) {
      setErrores(v.errores);
      return;
    }
    cerrojo.current = true;
    setGuardando(true);
    try {
      const plan = generarPlan({
        tipo: v.nuevo.tipo,
        fecha_prueba: v.nuevo.fecha,
        hoy,
        horas_semana: v.nuevo.horas_semana,
        distancias: v.nuevo.tipo === 'otra' ? v.distancias : undefined,
        nivel: v.nuevo.nivel,
      });
      await crearObjetivo(userId, v.nuevo, plan);
      cerrojo.current = false;
      setAbierta(false);
      await cargar();
    } catch (e) {
      vibrar('penalizacion');
      setErrores({ ...SIN_ERRORES, servidor: mensajeSistema(e) });
    } finally {
      cerrojo.current = false;
      setGuardando(false);
    }
  }, [cargar, form, hoy, userId]);

  const objetivoId = datos.objetivo?.id ?? null;
  const onBorrar = useCallback(async () => {
    if (!objetivoId || cerrojo.current) return;
    const ok = await confirmar({
      titulo: t('resistenciaPlan:carrera.borrarTitulo'),
      mensaje: t('resistenciaPlan:carrera.borrarMensaje'),
      confirmar: t('resistenciaPlan:carrera.borrarConfirmar'),
      destructivo: true,
    });
    if (!ok || cerrojo.current) return;
    cerrojo.current = true;
    setBorrando(true);
    vibrar('destructiva');
    try {
      await borrarObjetivo(objetivoId);
      await cargar();
    } catch (e) {
      vibrar('penalizacion');
      avisar(t('comun:sistemaNoResponde'), mensajeSistema(e));
    } finally {
      cerrojo.current = false;
      setBorrando(false);
    }
  }, [cargar, objetivoId]);

  const onVerEntreno = useCallback((id: string) => {
    router.push(`/resistencia/${id}` as Href);
  }, []);

  const onVolver = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/resistencia' as Href);
  }, []);

  const vistos = useMemo(() => vistaCarrera(datos.objetivo, datos.filas), [datos]);
  const plazoCorto = useMemo(() => eraPlazoCorto(datos.objetivo), [datos.objetivo]);
  const previa = useMemo(() => (abierta ? previaPlan(form, hoy) : null), [abierta, form, hoy]);

  return {
    vista: {
      ...vistos,
      estado,
      error,
      hoy,
      plazoCorto,
      refreshing,
      borrando,
      onRefresh,
      onReintentar,
      onVolver,
      onObjetivo,
      onBorrar,
      onVerEntreno,
    },
    hoja: {
      visible: abierta,
      form,
      errores,
      previa,
      guardando,
      reemplaza: datos.objetivo !== null,
      onCambiar,
      onGuardar,
      onCerrar,
    },
  };
}
