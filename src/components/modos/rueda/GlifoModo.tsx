// NIVL · Modos: el glifo de cada modo (emblema, rueda, recarga, barra).
//
// Los trazos de la propuesta P01 (caja de 24, trazo redondo): NIVL el escudo
// con la N, IRON la barra con sus discos, FOCUS la diana, WORK el maletín y
// FOUNDER el cohete. Decorativo: el lector lee el nombre del modo en el
// contenedor.

import { View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import type { ModoId } from '@/modos/tipos';

export interface GlifoModoProps {
  modo: ModoId;
  tamano: number;
  color: string;
  /** Grosor del trazo en la caja de 24 (la lámina: 1,8). */
  trazo?: number;
  /** Relleno del escudo de NIVL (por defecto, ninguno). */
  relleno?: string;
  /** Color y trazo de la N del escudo (la recarga dorada: N de oro). Por defecto, los del escudo. */
  colorN?: string;
  trazoN?: number;
}

export function GlifoModo({ modo, tamano, color, trazo = 1.8, relleno = 'none', colorN, trazoN }: GlifoModoProps) {
  const comun = { stroke: color, strokeWidth: trazo, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  return (
    <View
      style={{ width: tamano, height: tamano }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
    >
      <Svg width={tamano} height={tamano} viewBox="0 0 24 24">
        {modo === 'general' ? (
          <>
            <Path d="M12 2.2 19.6 4.3V12c0 4.9-3.2 8-7.6 9.8C7.6 20 4.4 16.9 4.4 12V4.3Z" {...comun} fill={relleno} />
            <Path d="M9.3 15.8V8.6l5.4 7.2V8.6" {...comun} stroke={colorN ?? color} strokeWidth={trazoN ?? trazo} />
          </>
        ) : null}
        {modo === 'iron' ? <Path d="M6.5 7v10M3.5 9.5v5M17.5 7v10M20.5 9.5v5M6.5 12h11" {...comun} /> : null}
        {modo === 'focus' ? (
          <>
            <Circle cx={12} cy={12} r={8.5} {...comun} />
            <Circle cx={12} cy={12} r={4.5} {...comun} />
            <Circle cx={12} cy={12} r={1} {...comun} fill={color} />
            <Path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3" {...comun} />
          </>
        ) : null}
        {modo === 'work' ? (
          <>
            <Rect x={3.5} y={7.5} width={17} height={12} rx={2} {...comun} />
            <Path d="M9 7.5V5h6v2.5M3.5 12.5h17M12 11.5v2" {...comun} />
          </>
        ) : null}
        {modo === 'founder' ? (
          <>
            <Path d="M12 2.5c3.3 2.2 5 6.4 3.9 11.2L14 16.5h-4l-1.9-2.8C7 8.9 8.7 4.7 12 2.5Z" {...comun} />
            <Circle cx={12} cy={9.3} r={1.6} {...comun} />
            <Path d="M10 16.5 8.5 21M14 16.5l1.5 4.5M8.3 13l-2.8 2.4v2.4l3.3-1.3M15.7 13l2.8 2.4v2.4l-3.3-1.3" {...comun} />
          </>
        ) : null}
      </Svg>
    </View>
  );
}
