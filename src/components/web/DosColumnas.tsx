// NIVL · Web: dos columnas en escritorio, una en todo lo demás.
//
// En el navegador, a partir de un hueco de contenido de MIN_DOS_COLUMNAS (la
// ventana menos la barra lateral), lo principal va a la izquierda y lo de
// consulta (coach, orden del día) a la derecha, cada uno con su altura. Por
// debajo, y SIEMPRE en el móvil nativo, se apilan en el mismo orden que antes:
// primero lo principal y luego lo lateral, así el lector de pantalla y el
// teclado recorren lo mismo en las dos composiciones.
//
// Va con `<Screen amplio>`: sin él, la columna de la pantalla se queda en 720
// y no hay sitio para dos.

import type { ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { space } from '@/design/tokens';
import { useAnchoUtil } from '@/design/useSizeClass';

/** Hueco mínimo (pt) para partir en dos: a 1280 de ventana ya caben. */
export const MIN_DOS_COLUMNAS = 1000;

export function useDosColumnas(): boolean {
  const ancho = useAnchoUtil();
  return Platform.OS === 'web' && ancho >= MIN_DOS_COLUMNAS;
}

export function DosColumnas({ principal, lateral }: { principal: ReactNode; lateral: ReactNode }) {
  const dos = useDosColumnas();
  if (!dos) {
    return (
      <>
        {principal}
        {lateral}
      </>
    );
  }
  return (
    <View style={styles.fila}>
      <View style={styles.principal}>{principal}</View>
      <View style={styles.lateral}>{lateral}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'flex-start', gap: space.s8 },
  principal: { flex: 3, minWidth: 0 },
  lateral: { flex: 2, minWidth: 0 },
});
