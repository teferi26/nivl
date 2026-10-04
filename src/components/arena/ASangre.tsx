// NIVL · Arena: a sangre. Saca a su contenido del margen de la pantalla y lo
// lleva de borde a borde, con el margen negativo exacto que publica Screen en
// GutterContext (20 · 32 · 48, o 0 con `plain`).

import { useContext, type ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { GutterContext } from '@/components/ui/Screen';

export function ASangre({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const gutter = useContext(GutterContext);
  return <View style={[{ marginHorizontal: -gutter }, style]}>{children}</View>;
}
