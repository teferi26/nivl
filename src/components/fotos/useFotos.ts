// NIVL · Fotos de progreso: los efectos de la pantalla /fotos (L5 · A).
//
// Devuelve las props de FotosVista y el estado de las dos hojas (nueva foto y
// ver foto). Reglas:
//   - Solo se lee y se firma con el acceso abierto (salud + 18+). Si se
//     cierra, se vacían fotos y firmas de la memoria.
//   - Se firman las fotos de las semanas visibles (8 de cada vez) y las del
//     par de Comparar; una firma caducada se renueva una sola vez por foto.
//   - Compartir: solo con `permisos.compartir` y fuera de la web. Firma de
//     nuevo, baja copias temporales con nombre fijo y abre la hoja de
//     compartir de la capa raíz; CompararFotos borra las copias al desmontar.
//   - Al salir se limpia la caché de memoria de expo-image.

import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { useCelebracion } from '@/components/celebracion/contexto';
import { useHealthConsent } from '@/components/ConsentimientoSalud';
import { usePermisoFotos } from '@/components/permisoFotos';
import { avisar, confirmar } from '@/components/ui/confirmar';
import { volver } from '@/components/ui/Screen';
import { confirmarMayorDeEdad } from '@/lib/age';
import { useAuth } from '@/lib/auth';
import { dateKey } from '@/lib/dates';
import { fetchWeights } from '@/lib/progress';
import { lineaTemporal, type FotoConPeso, type FotoProgreso, type ParAntesDespues, type PesoDia } from '@/lib/progressPhotos';
import { mensajeSistema } from '@/lib/validation';
import { borrarFoto, descargarParaCompartir, firmar, listarFotos, TEMP_ANTES, TEMP_DESPUES } from './datos';
import { SEMANAS_POR_PAGINA, type FotosVistaProps } from './FotosVista';
import { fechaCorta, mensajeErrorFotos, NOMBRE_POSE, tarjetaAntesDespues } from './modelo';

export function useFotos() {
  const { session } = useAuth();
  const uid = session?.user.id ?? null;
  const health = useHealthConsent();
  const permiso = usePermisoFotos();
  const { compartir: abrirHoja } = useCelebracion();
  const abierto = permiso.estado === 'abierto';
  const hoy = dateKey();

  const [fotos, setFotos] = useState<FotoProgreso[]>([]);
  const [pesos, setPesos] = useState<PesoDia[]>([]);
  const [cargado, setCargado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [semanasVisibles, setSemanasVisibles] = useState(SEMANAS_POR_PAGINA);
  const [nueva, setNueva] = useState(false);
  const [vista, setVista] = useState<FotoConPeso | null>(null);
  const [borrando, setBorrando] = useState(false);
  const [compartiendo, setCompartiendo] = useState(false);
  const [confirmandoEdad, setConfirmandoEdad] = useState(false);
  const [errorEdad, setErrorEdad] = useState<string | null>(null);

  const vivo = useRef(true);
  const pedidas = useRef(new Set<string>());
  const renovadas = useRef(new Set<string>());
  const serie = useRef(0);
  useEffect(() => {
    vivo.current = true;
    return () => {
      vivo.current = false;
      void Image.clearMemoryCache().catch(() => {});
    };
  }, []);

  // Sin acceso, nada de fotos en memoria.
  useEffect(() => {
    if (abierto) return;
    serie.current++;
    setFotos([]);
    setPesos([]);
    setUrls({});
    setCargado(false);
    setError(null);
    pedidas.current.clear();
    renovadas.current.clear();
  }, [abierto]);

  // Las dos funciones son estables (useCallback en su origen): `gate` también.
  const refrescarSalud = health.refresh;
  const recargarEdad = permiso.recargar;
  const gate = useCallback(() => {
    void refrescarSalud();
    void recargarEdad();
  }, [refrescarSalud, recargarEdad]);

  const cargar = useCallback(async () => {
    if (!abierto) return;
    const n = ++serie.current;
    try {
      const [fs, ws] = await Promise.all([listarFotos(), fetchWeights(400).catch(() => [])]);
      if (!vivo.current || n !== serie.current) return;
      setFotos(fs);
      setPesos(ws.map((w) => ({ fecha: w.date, kg: w.weight_kg })));
      setError(null);
    } catch (e) {
      if (!vivo.current || n !== serie.current) return;
      const m = mensajeErrorFotos(e);
      setError(m.mensaje);
      if (m.refrescar) gate();
    } finally {
      if (vivo.current && n === serie.current) setCargado(true);
    }
  }, [abierto, gate]);

  useFocusEffect(
    useCallback(() => {
      void cargar();
    }, [cargar]),
  );

  const pedirFirmas = useCallback(
    (ids: string[]) => {
      const nuevas = ids.filter((id) => !pedidas.current.has(id));
      if (!uid || !abierto || nuevas.length === 0) return;
      nuevas.forEach((id) => pedidas.current.add(id));
      const n = serie.current;
      firmar(uid, nuevas).then(
        (r) => {
          if (vivo.current && n === serie.current) setUrls((u) => ({ ...u, ...r }));
        },
        (e) => {
          nuevas.forEach((id) => pedidas.current.delete(id));
          if (mensajeErrorFotos(e).refrescar) gate();
        },
      );
    },
    [uid, abierto, gate],
  );

  // Firmas de las semanas visibles.
  useEffect(() => {
    if (!abierto || fotos.length === 0) return;
    const ids = lineaTemporal(fotos)
      .slice(0, semanasVisibles)
      .flatMap((s) => s.fotos.map((f) => f.id));
    pedirFirmas(ids);
  }, [abierto, fotos, semanasVisibles, pedirFirmas]);

  // Firma caducada (60 s): se renueva una vez por foto.
  const fallo = useCallback(
    (id: string) => {
      if (renovadas.current.has(id)) return;
      renovadas.current.add(id);
      pedidas.current.delete(id);
      setUrls((u) => {
        const { [id]: _fuera, ...resto } = u;
        return resto;
      });
      pedirFirmas([id]);
    },
    [pedirFirmas],
  );

  const confirmarEdad = async () => {
    if (confirmandoEdad) return;
    setConfirmandoEdad(true);
    setErrorEdad(null);
    try {
      await confirmarMayorDeEdad();
      await recargarEdad();
    } catch (e) {
      if (vivo.current) setErrorEdad(mensajeSistema(e));
    } finally {
      if (vivo.current) setConfirmandoEdad(false);
    }
  };

  const compartir = async (par: ParAntesDespues, conPeso: boolean) => {
    if (!uid || compartiendo || Platform.OS === 'web' || !permiso.permisos.compartir) return;
    setCompartiendo(true);
    try {
      // Firmas recién hechas: las de la pantalla pueden haber caducado.
      const r = await firmar(uid, [par.antes.id, par.despues.id]);
      const [a, d] = await Promise.all([
        r[par.antes.id] ? descargarParaCompartir(r[par.antes.id], TEMP_ANTES) : Promise.resolve(null),
        r[par.despues.id] ? descargarParaCompartir(r[par.despues.id], TEMP_DESPUES) : Promise.resolve(null),
      ]);
      if (!a || !d) {
        avisar('No se ha podido preparar', 'Las fotos no se han descargado. Vuelve a intentarlo con conexión.');
        return;
      }
      abrirHoja(tarjetaAntesDespues(par, a, d, conPeso));
    } catch (e) {
      const m = mensajeErrorFotos(e);
      avisar('No se ha podido compartir', m.mensaje);
      if (m.refrescar) gate();
    } finally {
      if (vivo.current) setCompartiendo(false);
    }
  };

  const borrar = async (f: FotoConPeso) => {
    if (!uid || borrando) return;
    const ok = await confirmar({
      titulo: 'Borrar foto',
      mensaje: `${NOMBRE_POSE[f.pose]} del ${fechaCorta(f.fecha, hoy)}. Se borra de NIVL para siempre.`,
      confirmar: 'Borrar',
      destructivo: true,
    });
    if (!ok) return;
    setBorrando(true);
    try {
      await borrarFoto(uid, f.id);
      if (!vivo.current) return;
      setFotos((xs) => xs.filter((x) => x.id !== f.id));
      setUrls((u) => {
        const { [f.id]: _fuera, ...resto } = u;
        return resto;
      });
      setVista(null);
    } catch (e) {
      const m = mensajeErrorFotos(e);
      avisar('No se ha podido borrar', m.mensaje);
      if (m.refrescar) gate();
    } finally {
      if (vivo.current) setBorrando(false);
    }
  };

  const vistaProps: FotosVistaProps = {
    acceso: permiso.estado,
    cargado,
    error,
    hoy,
    fotos,
    pesos,
    urls,
    semanasVisibles,
    puedeCompartir: permiso.permisos.compartir && Platform.OS !== 'web',
    compartiendo,
    confirmandoEdad,
    errorEdad: errorEdad ?? permiso.error,
    acciones: {
      onVolver: () => volver(router),
      onNueva: () => setNueva(true),
      onVerMas: () => setSemanasVisibles((n) => n + SEMANAS_POR_PAGINA),
      onAbrir: (f) => {
        pedirFirmas([f.id]);
        setVista(f);
      },
      onFallo: fallo,
      onPedirFirmas: pedirFirmas,
      onCompartir: (par, conPeso) => void compartir(par, conPeso),
      onConfirmarEdad: () => void confirmarEdad(),
      onAhoraNo: () => volver(router),
      onRevisarSalud: health.ask,
      onReintentar: () => {
        setCargado(false);
        void cargar();
      },
    },
  };

  return {
    vista: vistaProps,
    uid,
    hoy,
    nueva: {
      visible: nueva && abierto,
      cerrar: () => setNueva(false),
      guardada: (f: FotoProgreso) => {
        setFotos((xs) => [f, ...xs]);
        void cargar();
      },
      gate,
    },
    ver: {
      foto: abierto ? vista : null,
      url: vista ? urls[vista.id] : undefined,
      cerrar: () => setVista(null),
      borrar: () => (vista ? void borrar(vista) : undefined),
      borrando,
      fallo,
    },
  };
}
