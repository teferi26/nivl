// NIVL · Panel de creador: datos y efectos (patrón L-RADICAL §C, FASE3 G2).
// Cortado y pegado de la ruta: la carga (panel + progreso + histórico +
// tabla, con lo accesorio que puede fallar sin tumbar el panel), el selector
// `vistaPanelCreador` de creatorprogram.ts (lista blanca sin dinero en tienda),
// compartir y copiar el código, salir y cerrar la sesión del portal.
//
// Toda cifra, texto de saldo o pago sale de src/lib/creators.ts,
// creatorprogram.ts y creatormath.ts y aquí solo se consume. Ningún botón
// mueve dinero ni lleva a un pago.
//
// Cambios de presentación respecto a la ruta vieja: el fallo de compartir
// avisa con «El sistema no responde» y vibra `penalizacion` (la tabla de
// FASE3); el portal (SITIO_CREADORES) llega a la vista como `portal`, para
// que la galería pueda pintar los dos modos.

import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import {
  // Como en Amigos: Clipboard sigue en el núcleo de RN 0.81. Si falla, se cae
  // al compartir del sistema, que también deja copiar.
  Clipboard,
  Platform,
  Share,
} from 'react-native';
import { avisar } from '@/components/ui/confirmar';
import { vibrar } from '@/design/haptics';
import { cerrarSoloSesion } from '@/lib/authFlow';
import { mensajeInvitacionCreador } from '@/lib/creatormath';
import { vistaPanelCreador, type PanelCreadorVista } from '@/lib/creatorprogram';
import {
  fetchCreatorBoard,
  fetchCreatorBoardPeriod,
  fetchCreatorHistory,
  fetchCreatorPanel,
  fetchCreatorProgress,
  type CreatorPanel,
} from '@/lib/creators';
import { SITIO_CREADORES } from '@/lib/sitio';
import { mensajeSistema } from '@/lib/validation';
import type { CreadorVistaProps } from './CreadorVista';

export function useCreador(): CreadorVistaProps {
  const [vista, setVista] = useState<PanelCreadorVista | null>(null);
  // El panel en bruto solo lo usa la rama web (días de retención).
  const [panel, setPanel] = useState<CreatorPanel | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [cerrando, setCerrando] = useState(false);
  const copiadoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    try {
      // La tabla es accesoria: sin ella el panel sale igual (vacía).
      const [p, board] = await Promise.all([fetchCreatorPanel(), fetchCreatorBoard().catch(() => [])]);
      // Lo de la 0046 es accesorio: si falla, el panel sale igual con lo de la 0025.
      const [progreso, historico, tabla] = await Promise.all([
        fetchCreatorProgress().catch(() => null),
        fetchCreatorHistory(12).catch(() => []),
        fetchCreatorBoardPeriod('mes').catch(() => null),
      ]);
      setPanel(p);
      setVista(vistaPanelCreador(Platform.OS, { panel: p, progreso, historico, tabla: tabla ?? board }));
      setError(null);
    } catch (e) {
      setError(mensajeSistema(e));
    } finally {
      setLoaded(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
      return () => {
        if (copiadoTimer.current) clearTimeout(copiadoTimer.current);
      };
    }, [load]),
  );

  const refrescar = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const salir = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/perfil');
  };

  const cerrarSesion = async () => {
    if (cerrando) return;
    setCerrando(true);
    try {
      // Solo este navegador: la sesión de la app en el móvil sigue abierta.
      await cerrarSoloSesion('local');
      // La vista se limpia DESPUÉS: si el cierre falla, el panel sigue ahí.
      setVista(null);
      setPanel(null);
      setError(null);
    } catch (e) {
      avisar('El sistema no responde', mensajeSistema(e));
    } finally {
      setCerrando(false);
    }
  };

  const compartir = async () => {
    if (!vista?.code) return;
    try {
      await Share.share({ message: mensajeInvitacionCreador(vista.code) });
    } catch (e) {
      vibrar('penalizacion');
      avisar('El sistema no responde', mensajeSistema(e));
    }
  };

  const copiar = () => {
    if (!vista?.code) return;
    try {
      Clipboard.setString(vista.code);
      vibrar('seleccion');
      setCopiado(true);
      if (copiadoTimer.current) clearTimeout(copiadoTimer.current);
      copiadoTimer.current = setTimeout(() => setCopiado(false), 2000);
    } catch {
      compartir();
    }
  };

  return {
    cargado: loaded,
    error,
    vista,
    holdDays: panel?.holdDays ?? 0,
    portal: SITIO_CREADORES,
    refrescando: refreshing,
    copiado,
    cerrando,
    acciones: {
      onSalir: salir,
      onRefrescar: refrescar,
      onCerrarSesion: cerrarSesion,
      onCompartir: compartir,
      onCopiar: copiar,
    },
  };
}
