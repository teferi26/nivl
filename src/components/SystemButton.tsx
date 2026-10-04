// NIVL · SystemButton: envoltorio de compatibilidad sobre el Button v2
// (src/components/ui/Button.tsx). Se mantiene para no tocar sus imports; el
// código nuevo usa `Button` desde '@/components/ui'.
//   solid → primary · outline → secondary · ghost → ghost · danger → danger (trama).

import type Ionicons from '@expo/vector-icons/Ionicons';
import type { StyleProp, ViewStyle } from 'react-native';
import { Button, type ButtonVariant } from '@/components/ui/Button';

interface Props {
  title: string;
  onPress: () => void;
  /** solid: blanco con texto negro (la acción principal, una por pantalla).
   *  outline: contorno blanco. ghost: solo texto. danger: contorno con trama. */
  variant?: 'solid' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  icon?: keyof typeof Ionicons.glyphMap;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}

const VARIANTE: Record<NonNullable<Props['variant']>, ButtonVariant> = {
  solid: 'primary',
  outline: 'secondary',
  ghost: 'ghost',
  danger: 'danger',
};

/**
 * @deprecated Usa `Button` de '@/components/ui'. Solo lo conservan las puertas
 * (ConsentimientoIAVista) porque las pruebas de Seguridad simulan este módulo.
 */
export function SystemButton({ variant = 'solid', ...rest }: Props) {
  return <Button variant={VARIANTE[variant]} {...rest} />;
}
