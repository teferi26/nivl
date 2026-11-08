// NIVL · Moderación: datos y efectos de la bandeja y del detalle (solo admin).
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { vibrar } from '@/design/haptics';
import {
  descartarDenuncia,
  fetchBandeja,
  fetchEsAdmin,
  levantarSuspension,
  marcarRevisado,
  resolverDenuncia,
  suspenderPerfil,
} from '@/lib/moderacion';
import {
  buscarElemento,
  fraseRechazo,
  type AccionModeracion,
  type Bandeja,
  type ElementoModeracion,
  type RespuestaAccion,
} from '@/lib/moderacionmath';
import { mensajeSistema } from '@/lib/validation';

export type Acceso = 'cargando' | 'admin' | 'negado';

function useCarga() {
  const [acceso, setAcceso] = useState<Acceso>('cargando');
  const [bandeja, setBandeja] = useState<Bandeja | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refrescando, setRefrescando] = useState(false);

  const cargar = useCallback(async () => {
    setRefrescando(true);
    try {
      if (!(await fetchEsAdmin())) {
        setAcceso('negado');
        return;
      }
      setBandeja(await fetchBandeja());
      setAcceso('admin');
      setError(null);
    } catch (e) {
      setError(mensajeSistema(e));
      setAcceso((a) => (a === 'cargando' ? 'admin' : a));
    } finally {
      setRefrescando(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar]),
  );
  return { acceso, bandeja, error, refrescando, cargar };
}

export function useBandeja() {
  const c = useCarga();
  return {
    acceso: c.acceso,
    bandeja: c.bandeja,
    error: c.error,
    refrescando: c.refrescando,
    onRefrescar: c.cargar,
    onSalir: () => (router.canGoBack() ? router.back() : router.replace('/(tabs)')),
    onAbrir: (e: ElementoModeracion) => router.push(`/moderacion/${e.clave}` as never),
  };
}

function ejecutar(e: ElementoModeracion, a: AccionModeracion, nota: string): Promise<RespuestaAccion> {
  switch (a) {
    case 'descartar':
    case 'resolver': {
      if (e.clase !== 'denuncia_perfil' && e.clase !== 'denuncia_ia') break;
      const tipo = e.clase === 'denuncia_perfil' ? 'perfil' : 'ia';
      return a === 'descartar' ? descartarDenuncia(tipo, e.id, nota) : resolverDenuncia(tipo, e.id, nota);
    }
    case 'suspender':
      if (e.clase === 'denuncia_perfil' && e.denunciado.id) return suspenderPerfil(e.denunciado.id, nota, e.id);
      if (e.clase === 'perfil') return suspenderPerfil(e.userId, nota, null);
      break;
    case 'levantar':
      if (e.clase === 'suspendido') return levantarSuspension(e.userId, e.version, nota);
      break;
    case 'revisar':
      if (e.clase === 'perfil') return marcarRevisado(e.userId, e.version, nota);
      break;
  }
  return Promise.resolve({ ok: false });
}

export function useDetalle(clave: string) {
  const c = useCarga();
  const [hoja, setHoja] = useState<AccionModeracion | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);

  const elemento = c.bandeja ? buscarElemento(c.bandeja, clave) : null;
  const onSalir = () => (router.canGoBack() ? router.back() : router.replace('/moderacion'));

  const confirmar = async (nota: string) => {
    if (!elemento || !hoja || enviando) return;
    setEnviando(true);
    setFallo(null);
    try {
      const r = await ejecutar(elemento, hoja, nota.trim());
      if (r.ok) {
        if (hoja === 'suspender') vibrar('destructiva');
        setHoja(null);
        onSalir();
        return;
      }
      vibrar('penalizacion');
      setFallo(fraseRechazo(r.motivo));
      c.cargar();
    } catch (e) {
      vibrar('penalizacion');
      setFallo(mensajeSistema(e));
    } finally {
      setEnviando(false);
    }
  };

  return {
    acceso: c.acceso,
    cargado: c.bandeja !== null,
    error: c.error,
    refrescando: c.refrescando,
    onRefrescar: c.cargar,
    elemento,
    hoja,
    enviando,
    fallo,
    onSalir,
    onAccion: (a: AccionModeracion) => {
      setFallo(null);
      setHoja(a);
    },
    onCerrarHoja: () => setHoja(null),
    onConfirmar: confirmar,
  };
}
