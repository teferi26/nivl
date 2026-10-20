// NIVL · Modos: el emblema conectado, tal como se pone en la app (decisión de
// Teferi: gesto de la rueda P01 + mundos propios + marcas MK P07 + sonido P10).
//
//   · En la cabecera de cada mundo (CabeceraMundo, ranura `emblema`): el
//     EmblemaModo dentro del MarcoEmblema de su marca (useMaestria del modo).
//   · En el Hoy de NIVL: el EmblemaModo solo. NIVL no tiene marca de modo
//     (su progreso es el rango del Hero), así que no lleva marco.
//
// Elegir un modo en la rueda es `irAlMundo`: el cambio de modo y la navegación
// a su mundo van en un solo paso (rutasModo.ts, sin doble redirección).
// Con `modos_activos` apagado no pinta nada.
//
// El marco es decorativo y va DETRÁS del emblema (hermanos, no anidados): si el
// emblema fuera hijo del marco, el marco lo escondería del lector de pantalla.

import { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { EmblemaModo } from '@/components/modos/rueda/EmblemaModo';
import { MarcoEmblema } from '@/components/modos/maestria/MarcoEmblema';
import { useMaestria } from '@/components/modos/maestria/useMaestria';
import { modoAcento } from '@/design/tokens';
import { useModo } from '@/modos/ModoProvider';
import { irAlMundo } from '@/modos/rutasModo';
import type { ModoEtiqueta, ModoId } from '@/modos/tipos';

/** Lado del emblema (el mínimo táctil). */
const LADO_EMBLEMA = 44;
/** Lado del marco: el aro (0,32 × lado) queda por fuera de los puntos del emblema. */
export const LADO_MARCO = 72;

function useIrAlMundo() {
  const { cambiar } = useModo();
  return useCallback((m: ModoId) => irAlMundo(m, cambiar), [cambiar]);
}

/** El emblema de un mundo, con el marco de su marca de maestría. */
export function EmblemaMundo({ modo }: { modo: ModoEtiqueta }) {
  const { activo } = useModo();
  const { marca } = useMaestria(modo, { subidas: false });
  const ir = useIrAlMundo();
  if (!activo) return null;
  return (
    <View style={styles.caja}>
      <MarcoEmblema marca={marca} color={modoAcento[modo]} tamano={LADO_MARCO} style={StyleSheet.absoluteFill} />
      <EmblemaModo tamano={LADO_EMBLEMA} alCambiarModo={ir} />
    </View>
  );
}

/** El emblema en el Hoy de NIVL (sin marco). Solo con algún modo activado además de General. */
export function EmblemaNivl() {
  const { activo, disponibles } = useModo();
  const ir = useIrAlMundo();
  if (!activo || disponibles.length < 2) return null;
  return (
    <View style={styles.fila}>
      <EmblemaModo tamano={56} alCambiarModo={ir} />
    </View>
  );
}

const styles = StyleSheet.create({
  caja: { width: LADO_MARCO, height: LADO_MARCO, alignItems: 'center', justifyContent: 'center' },
  fila: { flexDirection: 'row', alignItems: 'center' },
});
