// NIVL · Ónix: el escudo con una letra o una cifra. La única imagen de marca.

import Svg, { Path, Text as SvgText } from 'react-native-svg';
import { ink, oro } from '@/design/tokens';

export function Escudo({ ancho = 104, texto = 'N' }: { ancho?: number; texto?: string }) {
  return (
    <Svg width={ancho} height={(ancho * 138) / 120} viewBox="0 0 120 138" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Path d="M60 4 L114 20 V62 C114 100 88 122 60 134 C32 122 6 100 6 62 V20 Z" fill={ink.ink1} stroke={oro.hilo} strokeWidth={3} />
      <SvgText x="60" y="88" textAnchor="middle" fontSize="56" fontWeight="700" fill={oro.claro} fontFamily="PlayfairDisplay_700Bold">
        {texto}
      </SvgText>
    </Svg>
  );
}
