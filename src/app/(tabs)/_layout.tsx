import { Tabs } from 'expo-router';
import { NavRail } from '@/components/ui/NavRail';
import { NavSidebar } from '@/components/ui/NavSidebar';
import { TabBar } from '@/components/ui/TabBar';
import { useSizeClass } from '@/design/useSizeClass';

// Navegación según la clase de tamaño (SISTEMA.md §3): barra inferior en
// compact, raíl de 72 en medium y barra lateral de 240 en expanded. Cambia en
// caliente al rotar o redimensionar la ventana. Iconos y rótulos: navItems.ts.
export default function TabsLayout() {
  const { sizeClass } = useSizeClass();
  return (
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
  );
}
