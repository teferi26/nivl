// NIVL · Maestro y detalle: lista a la izquierda y lo elegido a la derecha
// cuando el hueco da para dos paneles (≥ 640: el iPhone Duo abierto, el iPad,
// el Mac, el Vision Pro). Por debajo (cualquier iPhone, el Duo plegado) solo
// se pinta la lista y la pantalla navega como siempre: quien la usa decide con
// `useMaestroDetalle()` si un toque elige (dos paneles) o empuja una ruta.
//
// Puro respecto al ancho: decide con `useAnchoUtil` (el hueco que publica la
// navegación) y la escala de texto, nunca por modelo. Cada panel publica su
// propio `TopeAncho`, así la `Screen` de dentro mide su panel y no la ventana:
// márgenes, columnas y panel lateral salen solos.
//
// Plegar y desplegar no desmonta la lista: el árbol es el mismo con uno o dos
// paneles (solo cambia el estilo del contenedor y aparece el detalle), así
// que la búsqueda, el scroll y las hojas abiertas de la lista siguen ahí.
//
// La misma pieza sirve para «dos paneles» que no son lista (chat | plan del
// día, ranking | rango): `proporcion="mitad"` y el segundo panel en `detalle`.

import { useContext, type ReactNode } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { FILETE_PANELES, repartoPaneles, type Proporcion, type Reparto } from '@/design/responsive';
import { ink } from '@/design/tokens';
import { TopeAncho, useAnchoUtil } from '@/design/useSizeClass';

/** El reparto de esta pantalla en dos paneles, o null si va en uno (iPhone). */
export function useMaestroDetalle(proporcion: Proporcion = 'lista'): Reparto | null {
  const hueco = useAnchoUtil();
  const { fontScale } = useWindowDimensions();
  return repartoPaneles(hueco, proporcion, fontScale);
}

interface MaestroDetalleProps {
  /** La lista (o el panel principal). Siempre se pinta. */
  lista: ReactNode;
  /** Lo elegido. Solo con dos paneles; en uno, la pantalla navega. */
  detalle?: ReactNode;
  /** Con dos paneles y nada elegido. */
  vacio?: ReactNode;
  proporcion?: Proporcion;
  /** El reparto ya calculado (si la pantalla lo pidió antes con el hook). */
  reparto?: Reparto | null;
}

export function MaestroDetalle({ lista, detalle, vacio, proporcion = 'lista', reparto: dado }: MaestroDetalleProps) {
  const calculado = useMaestroDetalle(proporcion);
  const reparto = dado === undefined ? calculado : dado;
  const tope = useContext(TopeAncho);
  return (
    <View style={reparto ? styles.fila : styles.flex}>
      {/* El mismo nodo con uno y con dos paneles: la lista no se desmonta. */}
      <View style={reparto ? { width: reparto.izquierda } : styles.flex}>
        <TopeAncho.Provider value={reparto ? reparto.izquierda : tope}>{lista}</TopeAncho.Provider>
      </View>
      {reparto ? (
        <>
          <View style={styles.filete} />
          <View style={{ width: reparto.derecha }} accessibilityLiveRegion="polite">
            <TopeAncho.Provider value={reparto.derecha}>{detalle ?? vacio ?? null}</TopeAncho.Provider>
          </View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  fila: { flex: 1, flexDirection: 'row' },
  filete: { width: FILETE_PANELES, backgroundColor: ink.ink3 },
});
