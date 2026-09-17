import { Text, View } from 'react-native';
import Svg, { Circle, Polyline } from 'react-native-svg';
import { colors, fonts } from '@/lib/theme';

interface Props {
  values: number[];
  width?: number;
  height?: number;
  color?: string;
  unit?: string;
}

// Gráfica de línea minimalista (sin librerías): evolución de peso o de un PR.
export function TrendLine({ values, width = 300, height = 90, color = colors.accent, unit = 'kg' }: Props) {
  if (values.length === 0) {
    return (
      <Text style={{ fontFamily: fonts.body, fontSize: 12, color: colors.textFaint }}>
        Sin datos todavía.
      </Text>
    );
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pad = 6;
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;

  const points = values.map((v, i) => {
    const x = pad + (values.length === 1 ? innerW / 2 : (i / (values.length - 1)) * innerW);
    const y = pad + innerH - ((v - min) / span) * innerH;
    return { x, y };
  });

  const last = points[points.length - 1]!;
  const first = values[0]!;
  const latest = values[values.length - 1]!;
  const delta = latest - first;

  return (
    <View>
      <Svg width={width} height={height}>
        <Polyline
          points={points.map((p) => `${p.x},${p.y}`).join(' ')}
          fill="none"
          stroke={color}
          strokeWidth={2}
        />
        <Circle cx={last.x} cy={last.y} r={3.5} fill={color} />
      </Svg>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
        <Text style={{ fontFamily: fonts.body, fontSize: 11, color: colors.textFaint }}>
          mín {min} · máx {max} {unit}
        </Text>
        <Text
          style={{
            fontFamily: fonts.heading,
            fontSize: 11,
            color: delta === 0 ? colors.textDim : color,
          }}
        >
          {delta > 0 ? '+' : ''}
          {Math.round(delta * 10) / 10} {unit}
        </Text>
      </View>
    </View>
  );
}
