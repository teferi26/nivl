// NIVL · Proveedor de la cola de celebraciones (L3). Implementa CelebracionApi
// (contexto.ts) sobre el reductor puro de src/lib/celebracionCola.ts y pone lo
// que el reductor no puede: relojes, persistencia, vibración y pintura.
//
// - Claves vistas por usuario en AsyncStorage (`nivl:celebradas:${userId}`):
//   se cargan al cambiar de usuario; al cerrar sesión la memoria se vacía. Un
//   fallo de lectura cuenta como cargado y vacío. Sin sesión (la galería del
//   kit) la cola funciona solo en memoria.
// - Ventana por acción: se cierra con final:true o a los 2500 ms.
// - Vibra SOLO por la principal de cada momento.
// - Pinta <Ceremony> (Modal) y una capa raíz con el Toast y la hoja de
//   compartir. La hoja NUNCA va dentro de un Modal: en Android la captura
//   sale negra.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { HojaCompartir } from '@/components/share/HojaCompartir';
import { Ceremony } from '@/components/ui/Ceremony';
import { Toast } from '@/components/ui/Toast';
import { vibrar } from '@/design/haptics';
import { useAuth } from '@/lib/auth';
import { estadoInicial, hayAlgo, reducir, textoToast, VENTANA_MS, type Momento } from '@/lib/celebracionCola';
import { dateKey } from '@/lib/dates';
import { rangoPorId, type Celebracion } from '@/lib/progression';
import { tarjetaDeCelebracion, type Tarjeta } from '@/lib/sharecard';
import { fetchSocialSelf } from '@/lib/social';
import { supabase } from '@/lib/supabase';
import { CelebracionContext, type AccionCelebrable, type CelebracionApi } from './contexto';

const claveAlmacen = (userId: string) => `nivl:celebradas:${userId}`;
/** Lo que tarda el Modal en irse antes de abrir la hoja (motion.slow). */
const ESPERA_HOJA_MS = 420;

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

export function CelebracionProvider({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  const userId = session?.user.id ?? null;
  const [estado, dispatch] = useReducer(reducir, undefined, estadoInicial);
  const [hoja, setHoja] = useState<{ tarjeta: Tarjeta; codigo: string | null } | null>(null);
  const [yo, setYo] = useState<{ path: string | null; name: string }>({ path: null, name: 'Gladiador' });
  const relojes = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const avisos = useRef(0);
  const userRef = useRef(userId);
  userRef.current = userId;

  const limpiarRelojes = useCallback(() => {
    relojes.current.forEach((t) => clearTimeout(t));
    relojes.current.clear();
  }, []);

  // Carga por usuario. Cambiar de usuario (o salir) vacía la memoria.
  useEffect(() => {
    if (loading) return;
    let vivo = true;
    dispatch({ tipo: 'vaciar' });
    limpiarRelojes();
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
    supabase
      .from('profiles')
      .select('name, avatar_url')
      .eq('id', userId)
      .single()
      .then(({ data }) => {
        const p = data as { name: string | null; avatar_url: string | null } | null;
        if (vivo && p) setYo({ path: p.avatar_url, name: p.name || 'Gladiador' });
      }, () => {});
    return () => {
      vivo = false;
    };
  }, [userId, loading, limpiarRelojes]);

  useEffect(() => limpiarRelojes, [limpiarRelojes]);

  // Persistencia: cada vez que se marcan claves (al mostrar).
  useEffect(() => {
    if (!estado.cargado || !userId) return;
    AsyncStorage.setItem(claveAlmacen(userId), JSON.stringify([...estado.vistas])).catch(() => {});
  }, [estado.vistas, estado.cargado, userId]);

  // Vibración: una por momento y solo por la principal.
  const vibrado = useRef<Momento | null>(null);
  const m = estado.mostrando;
  useEffect(() => {
    if (!m || vibrado.current === m) return;
    vibrado.current = m;
    const t = m.principal?.tipo;
    if (t === 'rango') vibrar('rango');
    else if (t === 'grado' || t === 'nivel') vibrar('nivel');
    else if (t === 'racha') vibrar('rachaHito');
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

  const celebrar = useCallback((a: AccionCelebrable) => {
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
  }, []);

  const avisarTexto = useCallback((texto: string) => {
    avisos.current += 1;
    dispatch({ tipo: 'avisar', id: `aviso:${avisos.current}`, texto });
  }, []);

  const mostrandoRef = useRef(m);
  mostrandoRef.current = m;

  const compartir = useCallback((t: Tarjeta) => {
    // Nada nuevo sale mientras la hoja está abierta.
    dispatch({ tipo: 'pausar', pausa: true });
    const vis = mostrandoRef.current;
    if (vis && vis.forma !== 'toast') dispatch({ tipo: 'ocultar' });
    const uid = userRef.current;
    void (async () => {
      await espera(ESPERA_HOJA_MS);
      let codigo: string | null = null;
      if (uid) codigo = await fetchSocialSelf(uid).then((s) => s.friendCode || null, () => null);
      if (userRef.current !== uid) {
        dispatch({ tipo: 'pausar', pausa: false });
        return;
      }
      setHoja({ tarjeta: t, codigo });
    })();
  }, []);

  const cerrarHoja = useCallback(() => {
    setHoja(null);
    dispatch({ tipo: 'pausar', pausa: false });
  }, []);

  const ocultar = useCallback(() => dispatch({ tipo: 'ocultar' }), []);

  const celebrando = hayAlgo(estado) || hoja !== null;
  const api = useMemo<CelebracionApi>(
    () => ({ celebrando, celebrar, avisar: avisarTexto, compartir }),
    [celebrando, celebrar, avisarTexto, compartir],
  );

  const ceremonia = m && m.forma !== 'toast' && m.principal ? m : null;
  const tarjeta = ceremonia?.principal ? tarjetaDe(ceremonia.principal, ceremonia.estado) : null;

  return (
    <CelebracionContext.Provider value={api}>
      <View style={styles.raiz}>
        {children}
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          {m && m.forma === 'toast' ? <Toast key={idDe(m)} message={textoToast(m)} onDone={ocultar} /> : null}
          {hoja ? (
            <HojaCompartir
              visible
              onCerrar={cerrarHoja}
              tarjeta={hoja.tarjeta}
              contexto={{ puedeCompartirFotos: false }}
              alias={null}
              codigoAmigo={hoja.codigo}
            />
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
        onCompartir={tarjeta ? () => compartir(tarjeta) : undefined}
      />
    </CelebracionContext.Provider>
  );
}

const styles = StyleSheet.create({
  raiz: { flex: 1 },
});
