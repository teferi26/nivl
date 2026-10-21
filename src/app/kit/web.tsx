// NIVL · Galería: la app web con su navegación real y datos de demo. SOLO
// DESARROLLO (y el preview web con EXPO_PUBLIC_GALERIA=1, src/lib/galeria.ts).
//
// /kit/web?mundo=<general|iron|focus|work>&quieto=1
// /kit/web?pantalla=planes
// &aviso=1 pone el aviso en pantalla del fin de un bloque de FOCUS (AvisosWeb).
//
// Pinta lo que se ve en el navegador a ese ancho de ventana: barra inferior,
// raíl o barra lateral (las de verdad, con props de mentira) y al lado la
// pantalla de inicio de cada mundo con su demo. Sin sesión ni Supabase: sirve
// para revisar el diseño web (capturas a 1440 × 900 y 390 × 844) sin cuenta.

import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { GALERIA } from '@/lib/galeria';
import { fijarQuieto } from '@/components/arena/quieto';
import { ESTADOS_WORK } from '@/components/economia/work/demo';
import { GALERIA_FOCUS } from '@/components/focus/demo';
import { DEMO as demoHoy } from '@/components/hoy/demo';
import { InicioIronDemo } from '@/components/ironmundo/demo';
import { NavRail } from '@/components/ui/NavRail';
import { nombreDestino, NAV_ITEMS } from '@/components/ui/navItems';
import { NavSidebar } from '@/components/ui/NavSidebar';
import { TabBar } from '@/components/ui/TabBar';
import { PlanesWeb } from '@/components/web/PlanesWeb';
import { huecoContenido, marcoDe } from '@/design/responsive';
import { ink, modoAcento } from '@/design/tokens';
import { TopeAncho } from '@/design/useSizeClass';
import { t } from '@/i18n';
import { avisarEnPantalla } from '@/lib/web/avisos';
import { MUNDOS } from '@/modos/rutasModo';
import { NOMBRE_MODO } from '@/modos/tipos';

type Mundo = 'general' | 'iron' | 'focus' | 'work';

interface Pestana {
  name: string;
  title: string;
}

/** Props de una barra de pestañas de verdad, sin navegador detrás. */
function propsNav(pestanas: Pestana[], activa: number): BottomTabBarProps {
  const routes = pestanas.map((p) => ({ key: p.name, name: p.name, params: undefined }));
  const descriptors = Object.fromEntries(pestanas.map((p) => [p.name, { options: { title: p.title } }]));
  const navigation = { emit: () => ({ defaultPrevented: true }), navigate: () => {} };
  return {
    state: { index: activa, routes, key: 'kit-web', routeNames: routes.map((r) => r.name), type: 'tab', stale: false, history: [] },
    descriptors,
    navigation,
    insets: { top: 0, right: 0, bottom: 0, left: 0 },
  } as unknown as BottomTabBarProps;
}

function pestanasDe(mundo: Mundo): Pestana[] {
  // El orden de (tabs)/_layout.tsx: Agenda justo detrás de Hoy.
  if (mundo === 'general') {
    return ['index', 'agenda', 'coach', 'habitos', 'mazmorras', 'perfil'].map((name) => ({ name, title: nombreDestino(NAV_ITEMS[name]!.destino) }));
  }
  return MUNDOS[mundo].pestanas.map((p) => ({ name: p.ruta, title: t(`mundos:pestana.${p.pestana}`) }));
}

function contenido(mundo: Mundo): { activa: number; pantalla: ReactNode } {
  if (mundo === 'focus') {
    const hoy = GALERIA_FOCUS[0]!;
    return { activa: 0, pantalla: (hoy.estados.find((e) => e.id === 'corriendo') ?? hoy.estados[0]!).render() };
  }
  if (mundo === 'iron') return { activa: 0, pantalla: <InicioIronDemo /> };
  if (mundo === 'work') return { activa: MUNDOS.work.pestanas.findIndex((p) => p.ruta === 'work-economia'), pantalla: ESTADOS_WORK[0]!.render() };
  const estado = demoHoy?.estados.find((e) => e.id === 'lleno') ?? demoHoy?.estados[0];
  return { activa: 0, pantalla: estado ? estado.render() : null };
}

export default function KitWeb() {
  const p = useLocalSearchParams<{ mundo?: string; pantalla?: string; quieto?: string; aviso?: string }>();
  const { width } = useWindowDimensions();
  fijarQuieto(p.quieto === '1');
  useEffect(() => () => fijarQuieto(false), []);
  const conAviso = GALERIA && p.aviso === '1';
  useEffect(() => {
    if (conAviso) avisarEnPantalla(t('focus:aviso.focoTitulo'), t('focus:aviso.focoCuerpo'), 'nivl.focus.fin');
  }, [conAviso]);
  if (!GALERIA) return <Redirect href="/" />;

  if (p.pantalla === 'planes') {
    return (
      <View style={styles.fondo}>
        <PlanesWeb userId={undefined} kind="general" onVolver={() => {}} />
      </View>
    );
  }

  const mundo: Mundo = p.mundo === 'iron' || p.mundo === 'focus' || p.mundo === 'work' ? p.mundo : 'general';
  const { sizeClass } = marcoDe(width);
  const hueco = huecoContenido(width).ancho;
  const { activa, pantalla } = contenido(mundo);
  const nav = propsNav(pestanasDe(mundo), activa);
  const acento = mundo === 'general' ? undefined : modoAcento[mundo];
  const marca = mundo === 'general' ? undefined : NOMBRE_MODO[mundo];

  return (
    <View style={[styles.fondo, sizeClass !== 'compact' && styles.fila]}>
      {sizeClass === 'expanded' ? <NavSidebar {...nav} acento={acento} marca={marca} /> : sizeClass === 'medium' ? <NavRail {...nav} acento={acento} /> : null}
      <View style={styles.lleno}>
        <TopeAncho.Provider value={hueco}>{pantalla}</TopeAncho.Provider>
      </View>
      {sizeClass === 'compact' ? <TabBar {...nav} acento={acento} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: ink.ink0 },
  fila: { flexDirection: 'row' },
  lleno: { flex: 1, minWidth: 0 },
});
