import { Redirect, Tabs } from 'expo-router';
import { useEffect } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EmblemaBarra, useHayEmblema } from '@/components/modos/EmblemaMundo';
import { PruebaAuto } from '@/components/prueba/PruebaAuto';
import { NavRail } from '@/components/ui/NavRail';
import { nombreDestino } from '@/components/ui/navItems';
import { NavSidebar } from '@/components/ui/NavSidebar';
import { TabBar } from '@/components/ui/TabBar';
import { huecoContenido, marcoDe } from '@/design/responsive';
import { TopeAncho, useAnchoUtil } from '@/design/useSizeClass';
import { useModo } from '@/modos/ModoProvider';
import { destinoMundo, llegadaAlMundo, transitoMundo } from '@/modos/rutasModo';

// Navegación según la clase de tamaño (SISTEMA.md §3): barra inferior en
// compact, raíl de 72 en medium y barra lateral de 240 en expanded. Cambia en
// caliente al rotar o redimensionar la ventana. Iconos y rótulos: navItems.ts.
// La barra inferior pinta 5 destinos; el raíl y la barra lateral, los 6.
//
// La navegación se decide con el ancho de la ventana, pero las pantallas se
// miden con el hueco que les queda (ventana − raíl o barra lateral − inset
// izquierdo): se publica en `TopeAncho`. Sin esto, a 1024 `Screen` creía tener
// 1024, pintaba el panel de 320 y el contenido se quedaba en 368.
//
// Modos (cada modo es un mundo, src/modos/rutasModo.ts): esto es NIVL, el modo
// general. Con `modos_activos` encendido y otro modo activo (al arrancar o al
// leer el modo guardado), se va al inicio de su mundo. Apagado, nada cambia.
export default function TabsLayout() {
  const ventana = useAnchoUtil();
  const { sizeClass } = marcoDe(ventana);
  const { left } = useSafeAreaInsets();
  const hueco = huecoContenido(ventana, left).ancho;
  const modos = useModo();
  const hayEmblema = useHayEmblema();
  // Mientras el emblema cambia de mundo (irAlMundo) no se redirige por cuenta propia.
  const mundo = destinoMundo({ activo: modos.activo, cargado: modos.cargado, modo: modos.modo, transito: transitoMundo() }, 'general');
  const llegado = mundo === null && modos.activo && modos.modo === 'general';
  useEffect(() => {
    if (llegado) llegadaAlMundo('general');
  }, [llegado]);
  if (mundo && mundo !== 'esperar') return <Redirect href={mundo} />;
  return (
    <TopeAncho.Provider value={hueco}>
      <Tabs
        tabBar={(props) =>
          sizeClass === 'compact' ? (
            <TabBar {...props} centro={hayEmblema ? <EmblemaBarra /> : undefined} />
          ) : sizeClass === 'medium' ? (
            <NavRail {...props} />
          ) : (
            <NavSidebar {...props} />
          )
        }
        screenOptions={{ headerShown: false, tabBarPosition: sizeClass === 'compact' ? 'bottom' : 'left' }}
      >
        <Tabs.Screen name="index" options={{ title: nombreDestino('hoy') }} />
        {/* Justo detrás de Hoy: en compact no tiene pestaña (navItems.ts) y es
            su destino secundario; en el raíl y la barra lateral va segunda. */}
        <Tabs.Screen name="agenda" options={{ title: nombreDestino('agenda') }} />
        <Tabs.Screen name="coach" options={{ title: nombreDestino('coach') }} />
        <Tabs.Screen name="habitos" options={{ title: nombreDestino('habitos') }} />
        <Tabs.Screen name="mazmorras" options={{ title: nombreDestino('campanas') }} />
        <Tabs.Screen name="perfil" options={{ title: nombreDestino('perfil') }} />
      </Tabs>
      {/* Prueba automática de Élite (0069): nada con prueba_auto_activa apagado. */}
      <PruebaAuto />
    </TopeAncho.Provider>
  );
}
