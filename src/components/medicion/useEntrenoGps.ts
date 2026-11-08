// NIVL · Entreno con GPS: datos y efectos de EntrenoGpsVista.
//
// La verdad de la sesión está en el módulo nativo, que sigue midiendo aunque se
// salga de la pantalla: al volver se pregunta `gpsEstado` y se retoma donde
// esté. El tiempo entre eventos lo cuenta la pantalla para que el reloj no vaya
// a saltos. Aquí no se paga nada: `entregarEntreno` escribe en disco y quien
// guarda decide.

import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking, Platform } from 'react-native';
import { useHealthConsent } from '@/components/ConsentimientoSalud';
import { confirmar } from '@/components/ui/confirmar';
import { volver } from '@/components/ui/Screen';
import { t } from '@/i18n';
import { useAuth } from '@/lib/auth';
import { dateKey } from '@/lib/dates';
import { normalizarEntreno, type EntrenoMedido } from '@/lib/entrenoMedido';
import { entregarEntreno } from '@/lib/medicion/buzon';
import {
  escucharGps,
  gpsDescartar,
  gpsEmpezar,
  gpsEstado,
  gpsParar,
  gpsPausar,
  gpsPedirPermiso,
  gpsPermiso,
  gpsReanudar,
  hayModuloSalud,
  type DeporteGps,
  type EstadoGps,
} from '@/lib/medicion/saludNativa';
import type { EntrenoGpsVistaProps, PantallaGps } from './EntrenoGpsVista';
import { esDeOtroDia, motivoNoDisponible } from './puro';

type Interno =
  | { fase: 'permiso'; denegado: boolean }
  | { fase: 'listo' }
  | { fase: 'activa'; estado: EstadoGps; marca: number }
  | { fase: 'guardando' }
  | { fase: 'corta' }
  | { fase: 'resumen'; entreno: EntrenoMedido; pendiente: boolean; duplicada: boolean; deOtroDia: boolean };

const activa = (estado: EstadoGps): Interno => ({ fase: 'activa', estado, marca: Date.now() });

/** Sin sesión en marcha: pedir permiso o elegir deporte. */
function sinSesion(): Interno {
  const permiso = gpsPermiso();
  return permiso === 'en_uso' || permiso === 'siempre' ? { fase: 'listo' } : { fase: 'permiso', denegado: permiso === 'denegado' };
}

function leerEstado(): Interno {
  const e = gpsEstado();
  return e ? activa(e) : sinSesion();
}

function leerEntreno(json: string): EntrenoMedido | null {
  try {
    const r = normalizarEntreno(JSON.parse(json));
    return r.ok ? r.entreno : null;
  } catch {
    return null;
  }
}

export function useEntrenoGps(): EntrenoGpsVistaProps {
  const { session } = useAuth();
  const userId = session?.user.id;
  const { accepted: saludAceptada } = useHealthConsent();
  const motivo = motivoNoDisponible(Platform.OS, hayModuloSalud(), true);

  const [interno, setInterno] = useState<Interno | null>(() => (motivo ? null : leerEstado()));
  const [deporte, setDeporte] = useState<DeporteGps>('carrera');
  const [autoPausa, setAutoPausa] = useState(true);
  const [pidiendo, setPidiendo] = useState(false);
  const [empezando, setEmpezando] = useState(false);
  const [terminando, setTerminando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ahora, setAhora] = useState(() => Date.now());
  // Mientras para, ni eventos ni la vuelta a primer plano pueden repintar la sesión.
  const parando = useRef(false);

  useEffect(() => {
    if (motivo) return;
    const quitar = escucharGps((estado) => {
      if (!parando.current) setInterno(activa(estado));
    });
    const estadoApp = AppState.addEventListener('change', (s) => {
      if (s !== 'active' || parando.current) return;
      // Un resumen en pantalla no se pisa; lo demás puede haber cambiado fuera
      // (el permiso en Ajustes, la sesión muerta por el sistema).
      setInterno((previo) => (previo?.fase === 'resumen' || previo?.fase === 'corta' || previo?.fase === 'guardando' ? previo : leerEstado()));
    });
    return () => {
      quitar();
      estadoApp.remove();
    };
  }, [motivo]);

  const midiendo = interno?.fase === 'activa' && interno.estado.fase === 'midiendo' && !interno.estado.interrumpido;
  useEffect(() => {
    if (!midiendo) return;
    const reloj = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(reloj);
  }, [midiendo]);

  const pedirPermiso = useCallback(async () => {
    setPidiendo(true);
    setError(null);
    try {
      const r = await gpsPedirPermiso();
      setInterno(r === 'en_uso' || r === 'siempre' ? { fase: 'listo' } : { fase: 'permiso', denegado: r === 'denegado' });
    } finally {
      setPidiendo(false);
    }
  }, []);

  const empezar = async () => {
    if (empezando) return;
    setEmpezando(true);
    setError(null);
    try {
      if (!(await gpsEmpezar(deporte, autoPausa))) {
        setError(t('medicion:gps.errorEmpezar'));
        return;
      }
      // El primer evento puede tardar: se arranca desde cero hasta que llegue.
      setInterno(
        activa(
          gpsEstado() ?? {
            deporte,
            fase: 'midiendo',
            interrumpido: false,
            inicio: new Date().toISOString(),
            duracion_s: 0,
            distancia_m: 0,
            ritmo_s_km: null,
            precision_m: null,
            desnivel_m: null,
            parciales: [],
          },
        ),
      );
    } finally {
      setEmpezando(false);
    }
  };

  const conFase = (fase: EstadoGps['fase']) => {
    setInterno((previo) => {
      if (previo?.fase !== 'activa') return previo;
      // La sesión reanudada ya no está interrumpida aunque el evento aún no haya llegado.
      return activa({ ...(gpsEstado() ?? previo.estado), fase, interrumpido: false });
    });
  };

  const terminar = async () => {
    if (!userId || parando.current) return;
    const seguir = await confirmar({
      titulo: t('medicion:gps.confirmarFinTitulo'),
      mensaje: t('medicion:gps.confirmarFinMensaje'),
      confirmar: t('medicion:gps.fin'),
    });
    if (!seguir) return;
    parando.current = true;
    setTerminando(true);
    setError(null);
    try {
      const { fallo, json } = await gpsParar(saludAceptada);
      if (fallo) {
        setError(t('medicion:gps.errorParar'));
        setInterno(leerEstado());
        return;
      }
      if (!json) {
        setInterno({ fase: 'corta' });
        return;
      }
      const entreno = leerEntreno(json);
      if (!entreno) {
        setError(t('medicion:gps.errorLeer'));
        setInterno(sinSesion());
        return;
      }
      setInterno({ fase: 'guardando' });
      // «retenido» no es un fallo: ya está en disco y el buzón lo reintenta.
      const r = await entregarEntreno(userId, json).catch(() => 'retenido' as const);
      setInterno({
        fase: 'resumen',
        entreno,
        pendiente: r === 'retenido',
        duplicada: r === 'duplicado',
        deOtroDia: esDeOtroDia(entreno.fin, dateKey()),
      });
    } finally {
      parando.current = false;
      setTerminando(false);
    }
  };

  const descartar = async () => {
    const seguir = await confirmar({
      titulo: t('medicion:gps.confirmarDescartarTitulo'),
      mensaje: t('medicion:gps.confirmarDescartarMensaje'),
      confirmar: t('medicion:gps.descartar'),
      destructivo: true,
    });
    if (!seguir) return;
    gpsDescartar();
    setInterno(sinSesion());
  };

  const pantalla = ((): PantallaGps => {
    if (motivo || !interno) return { fase: 'no_disponible', motivo: motivo ?? 'sin_modulo' };
    switch (interno.fase) {
      case 'permiso':
        return { fase: 'permiso', denegado: interno.denegado, pidiendo, error };
      case 'listo':
        return { fase: 'listo', deporte, autoPausa, empezando, error };
      case 'activa': {
        if (interno.estado.interrumpido) return { fase: 'interrumpida', estado: interno.estado, terminando, error };
        const extra = interno.estado.fase === 'midiendo' ? Math.max(0, Math.floor((ahora - interno.marca) / 1000)) : 0;
        return { fase: 'marcha', estado: interno.estado, segundos: interno.estado.duracion_s + extra, terminando, error };
      }
      default:
        return interno;
    }
  })();

  return {
    pantalla,
    acciones: {
      onVolver: () => volver(router),
      onPedirPermiso: () => void pedirPermiso(),
      onAbrirAjustes: () => void Linking.openSettings().catch(() => {}),
      onDeporte: setDeporte,
      onAutoPausa: setAutoPausa,
      onEmpezar: () => void empezar(),
      onPausar: () => {
        gpsPausar();
        conFase('pausa');
      },
      onReanudar: () => {
        gpsReanudar();
        conFase('midiendo');
      },
      onTerminar: () => void terminar(),
      onDescartar: () => void descartar(),
      onNuevaSesion: () => setInterno(leerEstado()),
    },
  };
}
