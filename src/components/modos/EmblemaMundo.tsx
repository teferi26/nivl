// NIVL · Modos: el emblema conectado, tal como se pone en la app (decisión de
// Teferi: rueda P01 + mundos propios + marcas MK P07 + sonido P10).
//
//   · En la cabecera de cada mundo (CabeceraMundo, ranura `emblema`): la placa
//     del modo (EmblemaModo forma 'placa', como el HUD de la lámina 2 de la
//     P01) dentro del visor de su marca MK (MarcoVisor, esquinas de la P07).
//   · En el Hoy de NIVL: el disco con el oro de la base y los cuatro puntos de
//     los modos (lámina 1 de la P01). NIVL no tiene marca de modo.
//
// Tocar el emblema abre la rueda (se queda abierta); elegir un modo es
// `irAlMundo`: el cambio de modo y la navegación a su mundo van en un solo
// paso (rutasModo.ts, sin doble redirección). Con `modos_activos` apagado no
// pinta nada.
//
// El marco es decorativo y va DETRÁS del emblema (hermanos, no anidados): si el
// emblema fuera hijo del marco, el marco lo escondería del lector de pantalla.

import { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { EmblemaModo } from '@/components/modos/rueda/EmblemaModo';
import { MarcoVisor } from '@/components/modos/maestria/MarcoVisor';
import { useMaestria } from '@/components/modos/maestria/useMaestria';
import { LADO_RANURA } from '@/components/modos/mundo/CabeceraMundo';
import { acentoRueda } from '@/design/tokens';
import { useModo } from '@/modos/ModoProvider';
import { irAlMundo } from '@/modos/rutasModo';
import type { ModoEtiqueta, ModoId } from '@/modos/tipos';

/** Lado de la placa del emblema (el mínimo táctil). */
const LADO_EMBLEMA = 44;
/** Lado del visor de la marca, por fuera de la placa. */
export const LADO_MARCO = LADO_RANURA;

function useIrAlMundo() {
  const { cambiar } = useModo();
  return useCallback((m: ModoId) => irAlMundo(m, cambiar), [cambiar]);
}

/** El emblema de un mundo, en el visor de su marca de maestría. */
export function EmblemaMundo({ modo }: { modo: ModoEtiqueta }) {
  const { activo } = useModo();
  const { marca } = useMaestria(modo, { subidas: false });
  const ir = useIrAlMundo();
  if (!activo) return null;
  return (
    <View style={styles.caja}>
      <MarcoVisor marca={marca} color={acentoRueda[modo]} tamano={LADO_MARCO} style={StyleSheet.absoluteFill} />
      <EmblemaModo tamano={LADO_EMBLEMA} forma="placa" alCambiarModo={ir} />
    </View>
  );
}

/** El emblema en el Hoy de NIVL (sin marca). Solo con algún modo activado además de General. */
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
  caja: { width: LADO_MARCO, height: LADO_MARCO, alignItems: 'center', justifyContent: 'center' },
  fila: { flexDirection: 'row', alignItems: 'center', padding: 9 },
});
