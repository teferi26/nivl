// NIVL · Web: la navegación principal en las pantallas de la pila.
//
// Las pestañas llevan su barra lateral o su raíl porque son un Tabs; las
// secundarias con ruta propia (/pro, /gym, /amigos…) son hermanas suyas en el
// Stack y en escritorio se quedaban con una flecha de volver en una ventana
// vacía, sin forma de saltar a otro destino. Aquí se pintan LA MISMA barra y el
// mismo raíl, con los destinos del mundo en el que se está. La pone ColumnaWeb
// (src/app/_layout.tsx) en la ranura fija de antes del Stack: no lo remonta.
//
// NavRail y NavSidebar hablan con un navegador de pestañas: se les da uno mínimo
// que convierte «ir a esta pestaña» en una ruta. Ninguna fila va marcada: se
// está en una pantalla que no es ninguno de esos destinos.

import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { router, type Href } from 'expo-router';
import { NAV_ITEMS, nombreDestino } from '@/components/ui/navItems';
import { NavRail } from '@/components/ui/NavRail';
import { NavSidebar } from '@/components/ui/NavSidebar';
import { acentoRueda, modoAcento } from '@/design/tokens';
import { t } from '@/i18n';
import { useModo } from '@/modos/ModoProvider';
import { MUNDOS } from '@/modos/rutasModo';
import { NOMBRE_MODO, type ModoEtiqueta } from '@/modos/tipos';

interface Destino {
  name: string;
  titulo: string;
  href: Href;
}

function destinosGeneral(): Destino[] {
  return Object.entries(NAV_ITEMS).map(([name, d]) => ({
    name,
    titulo: nombreDestino(d.destino),
    href: (name === 'index' ? '/(tabs)' : `/(tabs)/${name}`) as Href,
  }));
}

function destinosMundo(modo: ModoEtiqueta): Destino[] {
  return MUNDOS[modo].pestanas.map((p) => ({ name: p.ruta, titulo: t(`mundos:pestana.${p.pestana}`), href: `/${p.ruta}` as Href }));
}

function propsDeNavegacion(destinos: Destino[]): BottomTabBarProps {
  const props = {
    state: { index: -1, routes: destinos.map((d) => ({ key: d.name, name: d.name })) },
    descriptors: Object.fromEntries(destinos.map((d) => [d.name, { options: { title: d.titulo } }])),
    navigation: {
      emit: () => ({ defaultPrevented: false }),
      // dismissTo: vuelve a las pestañas que hay debajo en vez de apilar otras
      // encima a cada salto. Entrando por enlace directo no hay nada debajo, y
      // con push el botón Atrás del navegador sigue devolviendo a esta pantalla.
      navigate: (name: string) => {
        const destino = destinos.find((d) => d.name === name);
        if (!destino) return;
        if (router.canDismiss()) router.dismissTo(destino.href);
        else router.push(destino.href);
      },
    },
  };
  return props as unknown as BottomTabBarProps;
}

export function NavSecundariaWeb({ nav }: { nav: 'rail' | 'sidebar' }) {
  const { activo, modo } = useModo();
  const mundo = activo && modo !== 'general' ? modo : null;
  const props = propsDeNavegacion(mundo ? destinosMundo(mundo) : destinosGeneral());
  const acento = mundo ? modoAcento[mundo] : acentoRueda.general;
  if (nav === 'rail') return <NavRail {...props} acento={acento} />;
  return <NavSidebar {...props} acento={acento} marca={mundo ? NOMBRE_MODO[mundo] : undefined} />;
}
