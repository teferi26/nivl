// NIVL · Resistencia: el detalle de un entreno (efectos). El entreno es lo que
// manda; el perfil de zonas y los récords son extras y su fallo no tumba nada.

import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { avisar, confirmar } from '@/components/ui/confirmar';
import { volver } from '@/components/ui/Screen';
import { vibrar } from '@/design/haptics';
import { t } from '@/i18n';
import { useAuth } from '@/lib/auth';
import { recordsPersonales, type Record_ } from '@/lib/entrenomath';
import {
  borrarEntrenoManual,
  fetchEntreno,
  fetchHistorialRecords,
  fetchPerfilEntreno,
  savePerfilEntreno,
  type EntrenoFila,
  type PerfilEntreno,
} from '@/lib/resistencia';
import { mensajeSistema } from '@/lib/validation';
import type { DetalleVistaProps } from './DetalleVista';
import type { HojaPulsoProps } from './HojaPulso';

async function recordsDe(e: EntrenoFila): Promise<Record_[]> {
  try {
    return recordsPersonales(await fetchHistorialRecords(e.deporte)).filter((r) => r.entreno_id === e.id);
  } catch {
    return [];
  }
}

export function useDetalle(id: string | undefined): DetalleVistaProps & { hojaPulso: HojaPulsoProps } {
  const { session } = useAuth();
  const userId = session?.user.id;
  const [entreno, setEntreno] = useState<EntrenoFila | null>(null);
  const [perfil, setPerfil] = useState<PerfilEntreno | null>(null);
  const [records, setRecords] = useState<Record_[]>([]);
  const [cargado, setCargado] = useState(false);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const turno = useRef(0);

  const cargar = useCallback(async () => {
    const vigente = ++turno.current;
    setErrorCarga(null);
    try {
      const fila = id ? await fetchEntreno(id) : null;
      if (vigente !== turno.current) return;
      setEntreno(fila);
      setCargado(true);
      if (!fila) return;
      const [p, r] = await Promise.all([fetchPerfilEntreno().catch(() => null), recordsDe(fila)]);
      if (vigente !== turno.current) return;
      setPerfil(p);
      setRecords(r);
    } catch (e) {
      if (vigente === turno.current) setErrorCarga(mensajeSistema(e));
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void cargar();
      return () => {
        turno.current++;
      };
    }, [cargar]),
  );

  // ── Borrar lo apuntado a mano ──
  const [borrando, setBorrando] = useState(false);
  const cerrojo = useRef(false);
  const borrar = useCallback(async () => {
    if (!userId || !entreno || cerrojo.current) return;
    const ok = await confirmar({
      titulo: t('resistencia:detalle.borrarTitulo'),
      mensaje: t('resistencia:detalle.borrarMensaje'),
      confirmar: t('resistencia:detalle.borrarConfirmar'),
      destructivo: true,
    });
    if (!ok || cerrojo.current) return;
    cerrojo.current = true;
    setBorrando(true);
    vibrar('destructiva');
    try {
      await borrarEntrenoManual(userId, entreno);
      volver(router);
    } catch (e) {
      vibrar('penalizacion');
      avisar(t('comun:sistemaNoResponde'), mensajeSistema(e));
    } finally {
      cerrojo.current = false;
      setBorrando(false);
    }
  }, [entreno, userId]);

  // ── Pulso máximo ──
  const [pulsoAbierta, setPulsoAbierta] = useState(false);
  const [pulso, setPulso] = useState('');
  const [errorPulso, setErrorPulso] = useState<string | null>(null);
  const [servidorPulso, setServidorPulso] = useState<string | null>(null);
  const [guardandoPulso, setGuardandoPulso] = useState(false);
  const guardarPulso = useCallback(async () => {
    if (!userId || guardandoPulso) return;
    const n = Number(pulso.trim());
    if (!Number.isInteger(n) || n < 100 || n > 240) {
      setErrorPulso(t('resistencia:pulso.error'));
      return;
    }
    setGuardandoPulso(true);
    setErrorPulso(null);
    setServidorPulso(null);
    try {
      await savePerfilEntreno(userId, { fc_max: n });
      setPerfil(await fetchPerfilEntreno().catch(() => null));
      setPulsoAbierta(false);
    } catch (e) {
      vibrar('penalizacion');
      setServidorPulso(mensajeSistema(e));
    } finally {
      setGuardandoPulso(false);
    }
  }, [guardandoPulso, pulso, userId]);

  return {
    cargado,
    errorCarga,
    entreno,
    perfil,
    records,
    borrando,
    acciones: {
      onVolver: () => volver(router),
      onReintentar: () => void cargar(),
      onBorrar: () => void borrar(),
      onIndicarPulso: () => {
        setPulso('');
        setErrorPulso(null);
        setServidorPulso(null);
        setPulsoAbierta(true);
      },
    },
    hojaPulso: {
      visible: pulsoAbierta,
      valor: pulso,
      guardando: guardandoPulso,
      error: errorPulso,
      servidor: servidorPulso,
      onCambio: (v) => {
        setPulso(v);
        setErrorPulso(null);
      },
      onGuardar: () => void guardarPulso(),
      onCerrar: () => {
        if (!guardandoPulso) setPulsoAbierta(false);
      },
    },
  };
}
