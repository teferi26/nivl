// NIVL · Modos: el layout de un mundo (src/app/(iron), (focus), (work),
// (founder)). La misma navegación responsive que NIVL, `(tabs)/_layout.tsx`:
// barra inferior en compact, raíl en medium y barra lateral en expanded, con
// el acento del modo en lo activo y su nombre arriba de la barra lateral.
//
// La puerta (rutasModo.ts → destinoMundo): el modo activo decide el mundo.
//   · `modos_activos` apagado: este mundo no existe, a NIVL.
//   · Aún sin leer el modo: la planta de la arena (ArranqueCargando).
//   · El modo activo es otro: a su inicio.
// Así, dentro de un mundo el modo activo es SIEMPRE el suyo, y el coach lo
// recibe en `x-nivl-modo` (ModoProvider → modos/coach.ts).

import { Redirect, Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArranqueCargando } from '@/components/acceso/Arranque';
import { NavRail } from '@/components/ui/NavRail';
import { NavSidebar } from '@/components/ui/NavSidebar';
import { TabBar } from '@/components/ui/TabBar';
import { huecoContenido, marcoDe } from '@/design/responsive';
import { modoAcento } from '@/design/tokens';
import { TopeAncho, useAnchoUtil } from '@/design/useSizeClass';
import { t } from '@/i18n';
import { useModo } from '@/modos/ModoProvider';
import { destinoMundo, MUNDOS } from '@/modos/rutasModo';
import { NOMBRE_MODO, type ModoEtiqueta } from '@/modos/tipos';

export function LayoutMundo({ modo }: { modo: ModoEtiqueta }) {
  const modos = useModo();
  const ventana = useAnchoUtil();
  const { sizeClass } = marcoDe(ventana);
  const { left } = useSafeAreaInsets();
  const hueco = huecoContenido(ventana, left).ancho;
  const acento = modoAcento[modo];

  const destino = destinoMundo({ activo: modos.activo, cargado: modos.cargado, modo: modos.modo }, modo);
  if (destino === 'esperar') return <ArranqueCargando />;
  if (destino) return <Redirect href={destino} />;

  return (
    <TopeAncho.Provider value={hueco}>
      <Tabs
        tabBar={(props) =>
          sizeClass === 'compact' ? (
            <TabBar {...props} acento={acento} />
          ) : sizeClass === 'medium' ? (
            <NavRail {...props} acento={acento} />
          ) : (
            <NavSidebar {...props} acento={acento} marca={NOMBRE_MODO[modo]} />
          )
        }
        screenOptions={{ headerShown: false, tabBarPosition: sizeClass === 'compact' ? 'bottom' : 'left' }}
      >
        {MUNDOS[modo].pestanas.map((p) => (
          <Tabs.Screen key={p.ruta} name={p.ruta} options={{ title: t(`mundos:pestana.${p.pestana}`) }} />
        ))}
      </Tabs>
    </TopeAncho.Provider>
  );
}
