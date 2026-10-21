// NIVL · Mundo IRON: los iconos de trazo de la lámina 2 (24 × 24, trazo 1,8,
// puntas redondas). Los mismos caminos que `propuesta.html` (P e NI). Son
// decorativos: el texto de al lado o la etiqueta del botón dicen qué son.

import Svg, { Circle, Path } from 'react-native-svg';

const CAMINOS = {
  pesa: 'M6.5 7v10M3.5 9.5v5M17.5 7v10M20.5 9.5v5M6.5 12h11',
  casa: 'M4 11 12 4l8 7v9h-5.5v-6h-5v6H4Z',
  lista: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  grafica: 'M4 20V4M4 20h16M8 16l4-5 3 3 5-7',
  chat: 'M4 5h16v11H9l-5 4Z',
  flecha: 'M5 12h14M13 6l6 6-6 6',
  mas: 'M12 5v14M5 12h14',
  atras: 'M15 5l-7 7 7 7',
  gota: 'M12 3.5c3.2 4 5.5 7.2 5.5 10.2a5.5 5.5 0 0 1-11 0c0-3 2.3-6.2 5.5-10.2Z',
  plato: 'M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z',
  pulso: 'M3 12h4l2.5-5 4 10 2.5-5H21',
  bascula: 'M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1ZM8.5 9a5 5 0 0 1 7 0M12 9.5l1.5-2',
  check: 'm6 12.5 4 4 8-9',
} as const;

export type Glifo = keyof typeof CAMINOS | 'buscar';

/**
 * La sentadilla de trazo de la lámina (`squat()` de propuesta.html, sin las
 * sombras): el icono de «Añadir ejercicio». Decorativa.
 */
export function FiguraSentadilla({ lado, color, suelo }: { lado: number; color: string; suelo: string }) {
  const sh = [48, 48];
  const hip = [34, 70];
  const knee = [61, 74];
  return (
    <Svg width={lado} height={lado} viewBox="0 0 100 100" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Path d="M18 93.5H86" stroke={suelo} strokeWidth={1.5} />
      <Circle cx={sh[0]! + 2} cy={sh[1]! - 9} r={5} fill={color} />
      <Path
        d={`M${sh[0]} ${sh[1]} L${hip[0]} ${hip[1]} L${knee[0]} ${knee[1]} L50 92 L60 92`}
        stroke={color}
        strokeWidth={3.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <Path d={`M${sh[0]! - 14} ${sh[1]! - 1} L${sh[0]! + 16} ${sh[1]! - 1}`} stroke={color} strokeWidth={3.6} strokeLinecap="round" />
      <Path d={`M${sh[0]! - 19} ${sh[1]! - 8}h5v14h-5Z M${sh[0]! + 15} ${sh[1]! - 8}h5v14h-5Z`} fill={color} />
      <Path d="M86 30V70" stroke={color} strokeWidth={1.4} strokeDasharray="3 3" />
      <Path d="M82 64 86 71 90 64" stroke={color} strokeWidth={1.4} fill="none" />
    </Svg>
  );
}

export function GlifoIron({ nombre, lado = 20, color, grosor = 1.8 }: { nombre: Glifo; lado?: number; color: string; grosor?: number }) {
  return (
    <Svg
      width={lado}
      height={lado}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={grosor}
      strokeLinecap="round"
      strokeLinejoin="round"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {nombre === 'buscar' ? (
        <>
          <Circle cx={11} cy={11} r={7} />
          <Path d="m20 20-4-4" />
        </>
      ) : (
        <Path d={CAMINOS[nombre]} />
      )}
    </Svg>
  );
}
