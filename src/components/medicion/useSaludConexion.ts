// NIVL · Conexión con Salud: datos y efectos de SaludConexionVista.
//
// Sin el permiso de salud de NIVL no se toca HealthKit: la puerta de la ruta ya
// lo impide y aquí se comprueba otra vez. El fallo al leer la preferencia del
// coach va aparte: no debe tapar los permisos, que no dependen de la red.

import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { useHealthConsent } from '@/components/ConsentimientoSalud';
import { volver } from '@/components/ui/Screen';
import { t } from '@/i18n';
import { useAuth } from '@/lib/auth';
import { dateKey } from '@/lib/dates';
import { importarDeSalud } from '@/lib/medicion/buzon';
import { fijarEnviarACoach, leerEnviarACoach, subirResumenesSalud } from '@/lib/medicion/saludDiaria';
import {
  disponible,
  hayModuloSalud,
  hayQuePreguntar,
  pedirPermisos,
  resumenDia,
  type CategoriaSalud,
  type ResumenDia,
} from '@/lib/medicion/saludNativa';
import { mensajeSistema } from '@/lib/validation';
import { ORDEN_CATEGORIAS, motivoNoDisponible } from './puro';
import type { EstadoCategoria, SaludConexionVistaProps } from './SaludConexionVista';

// Nada marcado de inicio: quien elige qué se lee es la persona.
const SIN_MARCAR: EstadoCategoria = { preguntada: false, marcada: false };
const CATEGORIAS_INICIALES = Object.fromEntries(ORDEN_CATEGORIAS.map((c) => [c, SIN_MARCAR])) as Record<
  CategoriaSalud,
  EstadoCategoria
>;

export function useSaludConexion(): SaludConexionVistaProps {
  const { session } = useAuth();
  const userId = session?.user.id;
  const { accepted } = useHealthConsent();
  const noDisponible = motivoNoDisponible(Platform.OS, hayModuloSalud(), disponible());

  const [cargado, setCargado] = useState(false);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [categorias, setCategorias] = useState(CATEGORIAS_INICIALES);
  const [escribirEntrenos, setEscribirEntrenos] = useState(false);
  const [pidiendo, setPidiendo] = useState(false);
  const [avisoPermisos, setAvisoPermisos] = useState<string | null>(null);
  const [errorPermisos, setErrorPermisos] = useState<string | null>(null);
  const [resumenHoy, setResumenHoy] = useState<ResumenDia | null>(null);
  const [trayendo, setTrayendo] = useState(false);
  const [avisoTraer, setAvisoTraer] = useState<string | null>(null);
  const [errorTraer, setErrorTraer] = useState<string | null>(null);
  const [enviarACoach, setEnviarACoach] = useState<boolean | null>(null);
  const [guardandoCoach, setGuardandoCoach] = useState(false);
  const [errorCoach, setErrorCoach] = useState<string | null>(null);
  // Cerrojo síncrono: dos toques seguidos ven el mismo estado de React.
  const ocupado = useRef(false);
  const ocupadoCoach = useRef(false);

  const cargar = useCallback(async () => {
    if (noDisponible || !accepted || !userId) return;
    try {
      const pendientes = await Promise.all(ORDEN_CATEGORIAS.map((c) => hayQuePreguntar([c])));
      setCategorias((previas) => {
        const nuevas = { ...previas };
        ORDEN_CATEGORIAS.forEach((c, i) => {
          const preguntada = !pendientes[i];
          nuevas[c] = { preguntada, marcada: !preguntada && previas[c].marcada };
        });
        return nuevas;
      });
      setResumenHoy(pendientes.every(Boolean) ? null : await resumenDia(dateKey()));
      setErrorCarga(null);
      setCargado(true);
    } catch (e) {
      setErrorCarga(mensajeSistema(e));
    }
    try {
      setEnviarACoach(await leerEnviarACoach(userId));
      setErrorCoach(null);
    } catch (e) {
      setErrorCoach(mensajeSistema(e));
    }
  }, [noDisponible, accepted, userId]);

  useFocusEffect(
    useCallback(() => {
      void cargar();
    }, [cargar]),
  );

  const pedir = async () => {
    if (!accepted || !userId || ocupado.current) return;
    const elegidas = ORDEN_CATEGORIAS.filter((c) => !categorias[c].preguntada && categorias[c].marcada);
    // Solo escribir también necesita el diálogo, y va atado a entrenos.
    const aPreguntar: CategoriaSalud[] = elegidas.length ? elegidas : escribirEntrenos ? ['entrenos'] : [];
    if (!aPreguntar.length) return;
    ocupado.current = true;
    setPidiendo(true);
    setErrorPermisos(null);
    setAvisoPermisos(null);
    try {
      if (!(await pedirPermisos(aPreguntar, escribirEntrenos))) {
        setErrorPermisos(t('medicion:conexion.errorDialogo'));
        return;
      }
      setAvisoPermisos(t('medicion:conexion.dialogoHecho'));
      setEscribirEntrenos(false);
      await cargar();
      void subirResumenesSalud(userId);
    } catch (e) {
      setErrorPermisos(mensajeSistema(e));
    } finally {
      ocupado.current = false;
      setPidiendo(false);
    }
  };

  const traer = async () => {
    if (!accepted || !userId || ocupado.current) return;
    ocupado.current = true;
    setTrayendo(true);
    setErrorTraer(null);
    setAvisoTraer(null);
    try {
      const { procesados, completa, fallo } = await importarDeSalud(userId);
      if (fallo) setErrorTraer(t('medicion:conexion.traerFallo'));
      else if (!completa) setAvisoTraer(t('medicion:conexion.traerIncompleto'));
      else if (procesados === 0) setAvisoTraer(t('medicion:conexion.traerNada'));
      else setAvisoTraer(t('medicion:conexion.traerHecho', { count: procesados }));
    } catch (e) {
      setErrorTraer(mensajeSistema(e));
    } finally {
      ocupado.current = false;
      setTrayendo(false);
    }
  };

  const cambiarCoach = async (valor: boolean) => {
    if (!userId || ocupadoCoach.current) return;
    ocupadoCoach.current = true;
    const anterior = enviarACoach;
    setEnviarACoach(valor);
    setGuardandoCoach(true);
    setErrorCoach(null);
    try {
      await fijarEnviarACoach(userId, valor);
    } catch (e) {
      setEnviarACoach(anterior);
      setErrorCoach(mensajeSistema(e));
    } finally {
      ocupadoCoach.current = false;
      setGuardandoCoach(false);
    }
  };

  return {
    cargado,
    noDisponible,
    errorCarga,
    categorias,
    escribirEntrenos,
    pidiendo,
    avisoPermisos,
    errorPermisos,
    resumenHoy,
    trayendo,
    avisoTraer,
    errorTraer,
    enviarACoach,
    guardandoCoach,
    errorCoach,
    acciones: {
      onVolver: () => volver(router),
      onReintentar: () => void cargar(),
      onCategoria: (c) => setCategorias((p) => ({ ...p, [c]: { ...p[c], marcada: !p[c].marcada } })),
      onEscribirEntrenos: setEscribirEntrenos,
      onPedir: () => void pedir(),
      onTraer: () => void traer(),
      onEnviarACoach: (v) => void cambiarCoach(v),
    },
  };
}
