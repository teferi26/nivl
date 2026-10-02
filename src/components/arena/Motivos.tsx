// NIVL · Arena: los motivos (SISTEMA.md §5 bis).
//
// Laurel, columna, arena, meandro y galea. Un solo trazo, sin relleno, extremos
// redondos: decoración pura. Ninguno se anuncia al lector ni recibe toques.
// Los colores son de la escala ink: el laurel en ink6 (se lee), la columna y el
// meandro en ink4 (estructura) y la arena en ink3 (fondo, casi no se ve).

import { View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, Path, Pattern, Rect } from 'react-native-svg';
import { useIdSeguro } from '@/components/ui/Texture';
import { ink } from '@/design/tokens';
import { LAUREL_ALTO, LAUREL_ANCHO, MEANDRO_UNIDAD, PATH_MEANDRO, pathArena, pathColumna, pathLaurel } from './geometria';

export { Crown as Galea } from '@/components/ui/Crown';

/** Props comunes para que el motivo no exista para el lector ni para el dedo. */
const OCULTO = {
  accessibilityElementsHidden: true,
  importantForAccessibility: 'no-hide-descendants',
  pointerEvents: 'none',
} as const;

interface LaurelProps {
  alto: number;
  /** izq: rama izquierda de la corona (curva hacia fuera a la izquierda). der: su espejo. */
  lado: 'izq' | 'der';
  color?: string;
  trazo?: number;
}

export function Laurel({ alto, lado, color = ink.ink6, trazo = 1.5 }: LaurelProps) {
  const ancho = (alto * LAUREL_ANCHO) / LAUREL_ALTO;
  return (
    <View {...OCULTO} style={[{ width: ancho, height: alto }, lado === 'der' && { transform: [{ scaleX: -1 }] }]}>
      <Svg width={ancho} height={alto} viewBox={`0 0 ${ancho} ${alto}`}>
        <Path
          d={pathLaurel(alto)}
          stroke={color}
          strokeWidth={trazo}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </Svg>
    </View>
  );
}

interface ColumnaProps {
  alto: number;
  ancho?: number;
  color?: string;
}

export function Columna({ alto, ancho = 24, color = ink.ink4 }: ColumnaProps) {
  return (
    <View {...OCULTO} style={{ width: ancho, height: alto }}>
      <Svg width={ancho} height={alto} viewBox={`0 0 ${ancho} ${alto}`}>
        <Path d={pathColumna(alto, ancho)} stroke={color} strokeWidth={1.5} strokeLinecap="round" fill="none" />
      </Svg>
    </View>
  );
}

interface ArenaProps {
  ancho: number;
  alto: number;
  variante: 'arco' | 'ovalo';
  gradas?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
}

/** El graderío (`arco`, de frente) o la planta (`ovalo`). Fondo: hairline ink3. */
export function Arena({ ancho, alto, variante, gradas = 3, color = ink.ink3, style }: ArenaProps) {
  return (
    <View {...OCULTO} style={[{ width: ancho, height: alto }, style]}>
      <Svg width={ancho} height={alto} viewBox={`0 0 ${ancho} ${alto}`}>
        <Path
          d={pathArena(ancho, alto, gradas, variante)}
          stroke={color}
          strokeWidth={1}
          strokeLinecap="round"
          fill="none"
        />
      </Svg>
    </View>
  );
}

interface MeandroProps {
  alto?: 8 | 12;
  color?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * Greca que llena el ancho del padre. Es un Pattern: el id sale de
 * `useIdSeguro` para que `url(#…)` funcione en la web.
 */
export function Meandro({ alto = 8, color = ink.ink4, style }: MeandroProps) {
  const id = useIdSeguro('meandro');
  const escala = alto / MEANDRO_UNIDAD;
  return (
    <View {...OCULTO} style={[{ height: alto, alignSelf: 'stretch', overflow: 'hidden' }, style]}>
      <Svg width="100%" height={alto}>
        <Defs>
          <Pattern
            id={id}
            patternUnits="userSpaceOnUse"
            width={MEANDRO_UNIDAD}
            height={MEANDRO_UNIDAD}
            patternTransform={`scale(${escala})`}
          >
            {/* El trazo se escala con el patrón: se compensa para que mida 1 pt. */}
            <Path d={PATH_MEANDRO} stroke={color} strokeWidth={1 / escala} strokeLinecap="square" fill="none" />
          </Pattern>
        </Defs>
        <Rect x={0} y={0} width="100%" height={alto} fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}
