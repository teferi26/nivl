// NIVL · Proveedor de la cola de celebraciones (L3). Implementa CelebracionApi
// (contexto.ts) sobre el reductor puro de src/lib/celebracionCola.ts y pone lo
// que el reductor no puede: relojes, persistencia, vibración y pintura.
//
// - Claves vistas por usuario en AsyncStorage (`nivl:celebradas:${userId}`):
//   se cargan al cambiar de usuario; al cerrar sesión la memoria se vacía. Un
//   fallo de lectura cuenta como cargado y vacío. Sin sesión (la galería del
//   kit) la cola funciona solo en memoria.
// - Ventana por acción: se cierra con final:true o a los 2500 ms.
// - Vibra SOLO en los toasts (racha → 'rachaHito'). La ceremonia vibra por
//   fases ella misma (Ceremony.tsx).
// - Pinta <Ceremony> (Modal) y una capa raíz con el Toast y la hoja de
//   compartir. La hoja NUNCA va dentro de un Modal: en Android la captura
//   sale negra. Como no es un Modal, aquí se le pone lo que un Modal daría:
//   atrás de Android la cierra, el gesto de escape de VoiceOver también, y lo
//   de debajo queda oculto al lector de pantalla mientras está abierta.
// - El avatar y el nombre de la ceremonia se releen al llegar cada acción
//   (justo antes de que pueda salir una ceremonia), no una vez por usuario.
// - Fotos (L5): `puedeCompartirFotos` se calcula en cada apertura, solo si la
//   tarjeta lleva foto (`necesitaPermisoFotos`), leyendo 18+ y salud del
//   servidor en paralelo con la salida del Modal. Con la misma espera que el
//   código de amigo: la hoja abre con false y se enciende si llega a tiempo.
//   Ante error o retraso, false.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react';
import { BackHandler, StyleSheet, View } from 'react-native';
import { leerPuedeCompartirFotos, necesitaPermisoFotos } from '@/components/permisoFotos';
import { HojaCompartir } from '@/components/share/HojaCompartir';
import { Ceremony } from '@/components/ui/Ceremony';
import { Toast } from '@/components/ui/Toast';
import { vibrar } from '@/design/haptics';
import { useAuth } from '@/lib/auth';
import { estadoInicial, hayAlgo, lineasDe, reducir, textoToast, VENTANA_MS, type Momento } from '@/lib/celebracionCola';
import { signedUrlCached } from '@/lib/data';
import { dateKey } from '@/lib/dates';
import { rangoPorId, type Celebracion } from '@/lib/progression';
import { tarjetaDeCelebracion, type Tarjeta } from '@/lib/sharecard';
import { fetchAliasCompartir, fetchSocialSelf } from '@/lib/social';
import { supabase } from '@/lib/supabase';
import { CelebracionContext, type AccionCelebrable, type CelebracionApi, type OpcionesCompartir } from './contexto';

const claveAlmacen = (userId: string) => `nivl:celebradas:${userId}`;
/** Lo que tarda el Modal en irse antes de abrir la hoja (motion.slow). */
const ESPERA_HOJA_MS = 420;
/** El código de amigo no hace esperar a la hoja: entra si llega en este tiempo. */
const ESPERA_CODIGO_MS = 1500;
/** Mínimo entre dos relecturas del perfil (varias llegadas de una acción). */
const RELEER_YO_MS = 2000;

const espera = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** La tarjeta de una celebración; la de nivel se completa con el estado vigente. */
export function tarjetaDe(c: Celebracion, estado: Momento['estado']): Tarjeta | null {
  const t = tarjetaDeCelebracion(c);
  if (!t || t.tipo !== 'nivel' || !estado) return t;
  return {
    ...t,
    rango: t.rango ?? estado.rango,
    nombreRango: t.nombreRango ?? rangoPorId(estado.rango).nombre,
    progreso: t.progreso ?? (estado.xpSiguiente > 0 ? Math.min(1, estado.xpEnNivel / estado.xpSiguiente) : 1),
    rachaDias: t.rachaDias ?? (estado.racha > 0 ? estado.racha : undefined),
  };
}

/**
 * Alias para firmar la tarjeta (Chat 3, 0053): solo se pide al encender el
 * interruptor de la hoja. Llega el público, el aprobado o el genérico, nunca
 * el nombre real ni uno pendiente; null = sin firma.
 */
const pedirAlias = () => fetchAliasCompartir().then((a) => a?.alias ?? null);

export function CelebracionProvider({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  const userId = session?.user.id ?? null;
  const [estado, dispatch] = useReducer(reducir, undefined, estadoInicial);
  const [hoja, setHoja] = useState<{
    tarjeta: Tarjeta;
    codigo: string | null;
    retratoUri: string | null;
    puedeCompartirFotos: boolean;
  } | null>(null);
  const [yo, setYo] = useState<{ path: string | null; name: string }>({ path: null, name: 'Gladiador' });
  const relojes = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const avisos = useRef(0);
  const userRef = useRef(userId);
  userRef.current = userId;

  // Avatar y nombre de la ceremonia: se releen antes de cada posible
  // ceremonia (al llegar una acción), con un mínimo entre lecturas.
  const leidoYo = useRef(0);
  const releerYo = useCallback((uid: string | null, forzar = false) => {
    if (!uid) return;
    const ahora = Date.now();
    if (!forzar && ahora - leidoYo.current < RELEER_YO_MS) return;
    leidoYo.current = ahora;
    supabase
      .from('profiles')
      .select('name, avatar_url')
      .eq('id', uid)
      .single()
      .then(({ data }) => {
        const p = data as { name: string | null; avatar_url: string | null } | null;
        if (p && userRef.current === uid) setYo({ path: p.avatar_url, name: p.name || 'Gladiador' });
      }, () => {});
  }, []);

  const limpiarRelojes = useCallback(() => {
    relojes.current.forEach((t) => clearTimeout(t));
    relojes.current.clear();
  }, []);

  // Cada apertura de la hoja lleva su número: un código que llega tarde solo
  // rellena la hoja para la que se pidió.
  const aperturas = useRef(0);

  // Carga por usuario. Cambiar de usuario (o salir) vacía la memoria.
  useEffect(() => {
    if (loading) return;
    let vivo = true;
    dispatch({ tipo: 'vaciar' });
    limpiarRelojes();
    aperturas.current += 1;
    setHoja(null);
    setYo({ path: null, name: 'Gladiador' });
    if (!userId) {
      dispatch({ tipo: 'cargar', vistas: [] });
      return;
    }
    AsyncStorage.getItem(claveAlmacen(userId))
      .then((v) => {
        const x: unknown = v ? JSON.parse(v) : [];
        return Array.isArray(x) ? x.filter((k): k is string => typeof k === 'string') : [];
      })
      .catch(() => [] as string[])
      .then((vistas) => {
        if (vivo) dispatch({ tipo: 'cargar', vistas });
      });
    releerYo(userId, true);
    return () => {
      vivo = false;
    };
  }, [userId, loading, limpiarRelojes, releerYo]);

  useEffect(() => limpiarRelojes, [limpiarRelojes]);

  // Persistencia: cada vez que se marcan claves (al mostrar).
  useEffect(() => {
    if (!estado.cargado || !userId) return;
    AsyncStorage.setItem(claveAlmacen(userId), JSON.stringify([...estado.vistas])).catch(() => {});
  }, [estado.vistas, estado.cargado, userId]);

  // Vibración de los toasts: una por momento y solo por la principal. La
  // ceremonia vibra por fases en Ceremony.tsx.
  const vibrado = useRef<Momento | null>(null);
  const m = estado.mostrando;
  useEffect(() => {
    if (!m || vibrado.current === m) return;
    vibrado.current = m;
    if (m.forma === 'toast' && m.principal?.tipo === 'racha') vibrar('rachaHito');
  }, [m]);

  // Id por momento: dos toasts seguidos con el mismo texto deben reiniciarse.
  const ids = useRef(new WeakMap<Momento, number>());
  const siguienteId = useRef(0);
  const idDe = (x: Momento) => {
    let id = ids.current.get(x);
    if (id === undefined) {
      id = ++siguienteId.current;
      ids.current.set(x, id);
    }
    return id;
  };

  // Anuncio del toast: en la absorción toast a toast (misma acción), solo las
  // líneas nuevas; si no hay ninguna, nada. Siempre lo completo, no el texto
  // recortado del toast.
  // La absorción cambia el momento sin pasar por null: el anterior es el toast
  // que había en pantalla justo antes.
  const sucesion = useRef<{ actual: Momento | null; anterior: Momento | null }>({ actual: null, anterior: null });
  if (sucesion.current.actual !== m) sucesion.current = { actual: m, anterior: sucesion.current.actual };
  const anuncios = useRef(new WeakMap<Momento, string>());
  const anuncioDe = (x: Momento): string => {
    const hecho = anuncios.current.get(x);
    if (hecho !== undefined) return hecho;
    const previo = sucesion.current.actual === x ? sucesion.current.anterior : null;
    const absorbe = previo !== null && previo.forma === 'toast' && previo.accion !== null && previo.accion === x.accion;
    const lineas = lineasDe(x);
    const nuevas = absorbe ? lineas.filter((l) => !lineasDe(previo).includes(l)) : lineas;
    const anuncio = nuevas.join('. ');
    anuncios.current.set(x, anuncio);
    return anuncio;
  };

  const celebrar = useCallback(
    (a: AccionCelebrable) => {
      releerYo(userRef.current);
      const accion = { ...a, fecha: a.fecha ?? dateKey() };
      dispatch({ tipo: 'llega', a: accion });
      const r = relojes.current.get(a.accion);
      if (a.final) {
        if (r) clearTimeout(r);
        relojes.current.delete(a.accion);
      } else if (!r) {
        relojes.current.set(
          a.accion,
          setTimeout(() => {
            relojes.current.delete(a.accion);
            dispatch({ tipo: 'cerrar', accion: a.accion });
          }, VENTANA_MS),
        );
      }
    },
    [releerYo],
  );

  const avisarTexto = useCallback((texto: string) => {
    avisos.current += 1;
    dispatch({ tipo: 'avisar', id: `aviso:${avisos.current}`, texto });
  }, []);

  const mostrandoRef = useRef(m);
  mostrandoRef.current = m;

  const yoRef = useRef(yo);
  yoRef.current = yo;

  /**
   * Abre la hoja. `retrato` puede llegar tarde (la firma del avatar desde la
   * ceremonia): se pide en paralelo con la salida del Modal y no espera más
   * que el código de amigo.
   */
  const abrirHoja = useCallback((t: Tarjeta, retrato: Promise<string | null>) => {
    // Nada nuevo sale mientras la hoja está abierta.
    dispatch({ tipo: 'pausar', pausa: true });
    const vis = mostrandoRef.current;
    if (vis && vis.forma !== 'toast') dispatch({ tipo: 'ocultar' });
    const uid = userRef.current;
    const n = ++aperturas.current;
    // El código se pide YA, en paralelo con la salida del Modal; la hoja no
    // lo espera: se abre con null y se rellena cuando llegue (≤ 1500 ms).
    let codigoListo: string | null = null;
    const codigo: Promise<string | null> = uid
      ? fetchSocialSelf(uid).then(
          (s) => {
            codigoListo = s.friendCode || null;
            return codigoListo;
          },
          () => null,
        )
      : Promise.resolve(null);
    // Permiso de fotos: solo se pregunta si la tarjeta lleva foto; nunca se recuerda.
    let fotosListo = false;
    const fotos: Promise<boolean> =
      uid && necesitaPermisoFotos(t)
        ? leerPuedeCompartirFotos().then((v) => {
            fotosListo = v;
            return v;
          })
        : Promise.resolve(false);
    void (async () => {
      await espera(ESPERA_HOJA_MS);
      if (aperturas.current !== n) return;
      if (userRef.current !== uid) {
        dispatch({ tipo: 'pausar', pausa: false });
        return;
      }
      const retratoUri = await Promise.race([retrato, espera(ESPERA_CODIGO_MS).then(() => null)]);
      if (aperturas.current !== n) return;
      setHoja({ tarjeta: t, codigo: codigoListo, retratoUri, puedeCompartirFotos: fotosListo });
      if (!uid) return;
      // Lo que llegue tarde (código o permiso) entra si lo hace en ESPERA_CODIGO_MS.
      const limite = espera(ESPERA_CODIGO_MS);
      await Promise.all([
        codigoListo
          ? null
          : Promise.race([codigo, limite.then(() => null)]).then((tarde) => {
              if (aperturas.current !== n || userRef.current !== uid || !tarde) return;
              setHoja((h) => (h && h.tarjeta === t ? { ...h, codigo: tarde } : h));
            }),
        fotosListo
          ? null
          : Promise.race([fotos, limite.then(() => false)]).then((ok) => {
              if (aperturas.current !== n || userRef.current !== uid || !ok) return;
              setHoja((h) => (h && h.tarjeta === t ? { ...h, puedeCompartirFotos: true } : h));
            }),
      ]);
    })();
  }, []);

  const compartir = useCallback(
    (t: Tarjeta, opciones?: OpcionesCompartir) => abrirHoja(t, Promise.resolve(opciones?.retratoUri ?? null)),
    [abrirHoja],
  );

  // Desde la ceremonia: el retrato es el avatar que ya se relee (yo), firmado
  // al abrir (la firma dura un minuto: no se guarda de antes).
  const compartirDesdeCeremonia = useCallback(
    (t: Tarjeta) => {
      const path = yoRef.current.path;
      abrirHoja(t, path ? signedUrlCached('avatars', path).catch(() => null) : Promise.resolve(null));
    },
    [abrirHoja],
  );

  const cerrarHoja = useCallback(() => {
    aperturas.current += 1;
    setHoja(null);
    dispatch({ tipo: 'pausar', pausa: false });
  }, []);

  // Atrás de Android cierra la hoja (no es un Modal: nadie más lo haría).
  const hojaAbierta = hoja !== null;
  useEffect(() => {
    if (!hojaAbierta) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      cerrarHoja();
      return true;
    });
    return () => sub.remove();
  }, [hojaAbierta, cerrarHoja]);

  const ocultar = useCallback(() => dispatch({ tipo: 'ocultar' }), []);
  // La ceremonia no se presentó: sus claves no cuentan como vistas y su texto
  // sale en un toast.
  const fallida = useCallback(() => dispatch({ tipo: 'fallida' }), []);

  // También con la cola en pausa: la hoja se está abriendo o está abierta.
  const celebrando = hayAlgo(estado) || hojaAbierta || estado.pausa;
  const api = useMemo<CelebracionApi>(
    () => ({ celebrando, celebrar, avisar: avisarTexto, compartir }),
    [celebrando, celebrar, avisarTexto, compartir],
  );

  const ceremonia = m && m.forma !== 'toast' && m.principal ? m : null;
  const tarjeta = ceremonia?.principal ? tarjetaDe(ceremonia.principal, ceremonia.estado) : null;

  return (
    <CelebracionContext.Provider value={api}>
      <View style={styles.raiz}>
        {/* Con la hoja abierta, lo de debajo no existe para el lector de pantalla. */}
        <View
          style={styles.raiz}
          accessibilityElementsHidden={hojaAbierta}
          importantForAccessibility={hojaAbierta ? 'no-hide-descendants' : 'auto'}
        >
          {children}
        </View>
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          {m && m.forma === 'toast' ? (
            <Toast key={idDe(m)} message={textoToast(m)} anuncio={anuncioDe(m)} onDone={ocultar} />
          ) : null}
          {hoja ? (
            // HojaCompartir no acepta onAccessibilityEscape: lo pone esta envoltura.
            <View style={StyleSheet.absoluteFill} pointerEvents="box-none" onAccessibilityEscape={cerrarHoja}>
              <HojaCompartir
                visible
                onCerrar={cerrarHoja}
                tarjeta={hoja.tarjeta}
                contexto={{ puedeCompartirFotos: hoja.puedeCompartirFotos }}
                pedirAlias={pedirAlias}
                codigoAmigo={hoja.codigo}
                retratoUri={hoja.retratoUri}
              />
            </View>
          ) : null}
        </View>
      </View>
      <Ceremony
        celebracion={ceremonia?.principal ?? null}
        forma={ceremonia?.forma === 'ceremonia-epica' ? 'ceremonia-epica' : 'ceremonia-corta'}
        resumen={ceremonia?.resumen ?? []}
        siguiente={ceremonia?.estado?.siguienteRango ?? null}
        avatar={yo}
        onCerrar={ocultar}
        onFallida={fallida}
        onCompartir={tarjeta ? () => compartirDesdeCeremonia(tarjeta) : undefined}
      />
    </CelebracionContext.Provider>
  );
}

const styles = StyleSheet.create({
  raiz: { flex: 1 },
});
