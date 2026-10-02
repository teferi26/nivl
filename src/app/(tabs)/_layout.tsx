import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NavRail } from '@/components/ui/NavRail';
import { NavSidebar } from '@/components/ui/NavSidebar';
import { TabBar } from '@/components/ui/TabBar';
import { huecoContenido, marcoDe } from '@/design/responsive';
import { TopeAncho, useAnchoUtil } from '@/design/useSizeClass';

// Navegación según la clase de tamaño (SISTEMA.md §3): barra inferior en
// compact, raíl de 72 en medium y barra lateral de 240 en expanded. Cambia en
// caliente al rotar o redimensionar la ventana. Iconos y rótulos: navItems.ts.
//
// La navegación se decide con el ancho de la ventana, pero las pantallas se
// miden con el hueco que les queda (ventana − raíl o barra lateral − inset
// izquierdo): se publica en `TopeAncho`. Sin esto, a 1024 `Screen` creía tener
// 1024, pintaba el panel de 320 y el contenido se quedaba en 368.
export default function TabsLayout() {
  const ventana = useAnchoUtil();
  const { sizeClass } = marcoDe(ventana);
  const { left } = useSafeAreaInsets();
  const hueco = huecoContenido(ventana, left).ancho;
  return (
    <TopeAncho.Provider value={hueco}>
      <Tabs
        tabBar={(props) =>
          sizeClass === 'compact' ? (
            <TabBar {...props} />
          ) : sizeClass === 'medium' ? (
            <NavRail {...props} />
          ) : (
            <NavSidebar {...props} />
          )
        }
        screenOptions={{ headerShown: false, tabBarPosition: sizeClass === 'compact' ? 'bottom' : 'left' }}
      >
        <Tabs.Screen name="index" options={{ title: 'Hoy' }} />
        <Tabs.Screen name="coach" options={{ title: 'Coach' }} />
        <Tabs.Screen name="habitos" options={{ title: 'Hábitos' }} />
        <Tabs.Screen name="mazmorras" options={{ title: 'Campañas' }} />
        <Tabs.Screen name="agenda" options={{ title: 'Agenda' }} />
        <Tabs.Screen name="perfil" options={{ title: 'Perfil' }} />
      </Tabs>
    </TopeAncho.Provider>
  );
}
