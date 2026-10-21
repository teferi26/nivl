// NIVL · Modos: el emblema conectado, tal como se pone en la app (decisión de
// Teferi: rueda P01 + mundos propios + sonido P10).
//
//   · En la cabecera de cada mundo (CabeceraMundo, ranura `emblema`): la placa
//     del modo (EmblemaModo forma 'placa'), como el HUD de la lámina 2 de la P01.
//   · En el centro de la barra inferior (TabBar, ranura `centro`), en NIVL y en
//     cada mundo: el disco con el acento del modo y los cuatro puntos de los
//     modos, levantado sobre la barra (láminas 1 a 4 de la P01). De ahí nace
//     el gesto. Con raíl o barra lateral no hay barra inferior: en NIVL el disco
//     va en el Hoy (EmblemaNivl) y en los mundos queda la placa de la cabecera.
//
// Tocar el emblema abre la rueda (se queda abierta); elegir un modo es
// `irAlMundo`: el cambio de modo y la navegación a su mundo van en un solo
// paso (rutasModo.ts, sin doble redirección). Con `modos_activos` apagado no
// pinta nada. La marca MK no va en la cabecera (no está en la lámina): la
// cuentan la subida de marca y Perfil.

import { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { EmblemaModo } from '@/components/modos/rueda/EmblemaModo';
import { LADO_RANURA } from '@/components/modos/mundo/CabeceraMundo';
import { useModo } from '@/modos/ModoProvider';
import { irAlMundo } from '@/modos/rutasModo';
import type { ModoEtiqueta, ModoId } from '@/modos/tipos';

function useIrAlMundo() {
  const { cambiar } = useModo();
  return useCallback((m: ModoId) => irAlMundo(m, cambiar), [cambiar]);
}

/** El emblema de un mundo: la placa de su modo, que abre la rueda. */
export function EmblemaMundo({ modo }: { modo: ModoEtiqueta }) {
  const { activo } = useModo();
  const ir = useIrAlMundo();
  if (!activo) return null;
  // `modo` fija qué mundo es; el emblema lee el modo activo, que es el mismo.
  void modo;
  return (
    <View style={styles.caja}>
      <EmblemaModo tamano={LADO_RANURA} forma="placa" alCambiarModo={ir} />
    </View>
  );
}

/** ¿Va el emblema? Con `modos_activos` y algún modo activado además de General. */
export function useHayEmblema(): boolean {
  const { activo, disponibles } = useModo();
  return activo && disponibles.length > 1;
}

/** El disco del centro de la barra inferior. Pintarlo solo si useHayEmblema(). */
export function EmblemaBarra() {
  const ir = useIrAlMundo();
  return <EmblemaModo tamano={56} forma="disco" alCambiarModo={ir} />;
}

/** El emblema en el Hoy de NIVL (raíl y barra lateral). Solo con algún modo activado además de General. */
export function EmblemaNivl() {
  const { activo, disponibles } = useModo();
  const ir = useIrAlMundo();
  if (!activo || disponibles.length < 2) return null;
  return (
    <View style={styles.fila}>
      <EmblemaModo tamano={56} forma="disco" alCambiarModo={ir} />
    </View>
  );
}

const styles = StyleSheet.create({
  caja: { width: LADO_RANURA, height: LADO_RANURA, alignItems: 'center', justifyContent: 'center' },
  fila: { flexDirection: 'row', alignItems: 'center', padding: 9 },
});
