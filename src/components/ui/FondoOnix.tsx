// NIVL · El fondo de Ónix: casi negro, un punto más claro arriba. Es el mismo
// en móvil, navegador y Mac. Va detrás de todo; no recibe toques.

import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet } from 'react-native';
import { FONDO_ONIX, FONDO_ONIX_PARADAS } from '@/design/tokens';

export function FondoOnix() {
  return (
    <LinearGradient
      pointerEvents="none"
      colors={[...FONDO_ONIX]}
      locations={[...FONDO_ONIX_PARADAS]}
      style={StyleSheet.absoluteFill}
    />
  );
}
