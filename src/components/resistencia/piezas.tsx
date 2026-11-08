// NIVL · Resistencia: las piezas de IRON con la letra que aquí hace falta leer.
// La lámina de IRON llega a 10 pt; Resistencia explica cosas (una derivación, una
// sesión), así que el texto corrido va a 14/20 y las etiquetas no bajan de 11.

import { StyleSheet } from 'react-native';
import { estilosIron as base, RotuloIron as RotuloBase, type RotuloIronProps } from '@/components/ironmundo/piezas';
import { C, F, fs } from '@/components/ironmundo/tema';

const lectura = StyleSheet.create({
  cuerpo: { fontFamily: F.r, fontSize: 14, lineHeight: 20, color: C.claro },
  detalle: { fontFamily: F.r, fontSize: 14, lineHeight: 20, color: C.suave },
  meta: { fontFamily: F.r, fontSize: 14, lineHeight: 20, color: C.meta, marginTop: 2 },
  etiqueta: { ...base.etiqueta, fontSize: fs(9.5), letterSpacing: fs(9.5) * 0.14 },
  error: { ...base.error, fontSize: 14, lineHeight: 20 },
  kgUnidad: { ...base.kgUnidad, fontSize: fs(9.5) },
});

export const estilosIron = { ...base, ...lectura };

export function RotuloIron(p: RotuloIronProps) {
  return <RotuloBase {...p} legible />;
}
