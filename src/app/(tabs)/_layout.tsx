import { Tabs } from 'expo-router';
import { TabBar } from '@/components/ui/TabBar';

// Los iconos y las etiquetas viven en TabBar (src/components/ui/TabBar.tsx).
export default function TabsLayout() {
  return (
    <Tabs tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: 'Hoy' }} />
      <Tabs.Screen name="coach" options={{ title: 'Coach' }} />
      <Tabs.Screen name="habitos" options={{ title: 'Hábitos' }} />
      <Tabs.Screen name="mazmorras" options={{ title: 'Campañas' }} />
      <Tabs.Screen name="agenda" options={{ title: 'Agenda' }} />
      <Tabs.Screen name="perfil" options={{ title: 'Perfil' }} />
    </Tabs>
  );
}
