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
// recibe en `x-nivl-modo` (ModoProvider → modos/coach.ts). Mientras el emblema
// cambia de mundo (`irAlMundo`), la puerta no redirige por su cuenta.
//
// La subida de marca (P07) se vigila aquí, UNA vez por mundo: useMaestria
// relee al cambiar de pestaña y <SubidaMarca> cubre la ventana entera con la
// firma de sonido del modo (P10, la misma de la rueda).

import { Redirect, Tabs, usePathname } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArranqueCargando } from '@/components/acceso/Arranque';
import { EmblemaBarra } from '@/components/modos/EmblemaMundo';
import { SubidaMarca } from '@/components/modos/maestria/SubidaMarca';
import { useMaestria } from '@/components/modos/maestria/useMaestria';
import { GlifoModo } from '@/components/modos/rueda/GlifoModo';
import { sonarModo } from '@/components/modos/rueda/sonido';
import { NavRail } from '@/components/ui/NavRail';
import { NavSidebar } from '@/components/ui/NavSidebar';
import { TabBar } from '@/components/ui/TabBar';
import { huecoContenido, marcoDe } from '@/design/responsive';
import { modoAcento } from '@/design/tokens';
import { TopeAncho, useAnchoUtil } from '@/design/useSizeClass';
import { t } from '@/i18n';
import { useModo } from '@/modos/ModoProvider';
import { destinoMundo, llegadaAlMundo, MS_TRANSITO, MUNDOS, transitoMundo } from '@/modos/rutasModo';
import { NOMBRE_MODO, type ModoEtiqueta } from '@/modos/tipos';

export function LayoutMundo({ modo }: { modo: ModoEtiqueta }) {
  const modos = useModo();
  const ventana = useAnchoUtil();
  const { sizeClass } = marcoDe(ventana);
  const { left } = useSafeAreaInsets();
  const hueco = huecoContenido(ventana, left).ancho;
  const acento = modoAcento[modo];
  const ruta = usePathname();
  const maestria = useMaestria(modo, { relectura: ruta });

  const transito = transitoMundo();
  const destino = destinoMundo({ activo: modos.activo, cargado: modos.cargado, modo: modos.modo, transito }, modo);
  const llegado = destino === null && modos.modo === modo;
  useEffect(() => {
    if (llegado) llegadaAlMundo(modo);
  }, [llegado, modo]);
  // Red de seguridad: si se espera a un tránsito que no llega, al caducar se
  // vuelve a decidir sin él.
  const [, setCaducado] = useState(0);
  const esperandoTransito = destino === 'esperar' && transito !== null;
  useEffect(() => {
    if (!esperandoTransito) return;
    const reloj = setTimeout(() => setCaducado((n) => n + 1), MS_TRANSITO + 50);
    return () => clearTimeout(reloj);
  }, [esperandoTransito]);

  if (destino === 'esperar') return <ArranqueCargando />;
  if (destino) return <Redirect href={destino} />;

  return (
    <View style={styles.lleno}>
      <TopeAncho.Provider value={hueco}>
        <Tabs
          tabBar={(props) =>
            sizeClass === 'compact' ? (
              <TabBar {...props} acento={acento} centro={modos.activo ? <EmblemaBarra /> : undefined} />
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
      <SubidaMarca
        marca={maestria.subida}
        modo={modo}
        color={acento}
        emblema={<GlifoModo modo={modo} tamano={36} color={acento} />}
        onFin={maestria.cerrarSubida}
        onSonido={() => sonarModo(modo)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  lleno: { flex: 1 },
});
