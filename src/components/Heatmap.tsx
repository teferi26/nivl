import { Text, View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { addDays, dateKey } from '@/lib/dates';
import { colors, fonts } from '@/lib/theme';

interface Props {
  counts: Record<string, number>;
  weeks?: number;
}

const CELL = 11;
const GAP = 3;

function cellColor(count: number): string {
  if (count <= 0) return colors.track;
  if (count <= 2) return colors.accentFaint;
  if (count <= 4) return colors.accentDim;
  return colors.accent;
}

// Heatmap de actividad estilo GitHub: columnas = semanas, filas = L→D.
export function Heatmap({ counts, weeks = 13 }: Props) {
  const today = dateKey();
  const [y, m, d] = today.split('-').map(Number);
  const todayDate = new Date(y!, m! - 1, d!);
  const todayIso = todayDate.getDay() === 0 ? 7 : todayDate.getDay();

  const lastMonday = addDays(today, -(todayIso - 1));
  const start = addDays(lastMonday, -(weeks - 1) * 7);

  const width = weeks * (CELL + GAP);
  const height = 7 * (CELL + GAP);

  const cells: { x: number; y: number; color: string }[] = [];
  for (let w = 0; w < weeks; w++) {
    for (let dow = 0; dow < 7; dow++) {
      const day = addDays(start, w * 7 + dow);
      if (day > today) continue;
      cells.push({
        x: w * (CELL + GAP),
        y: dow * (CELL + GAP),
        color: cellColor(counts[day] ?? 0),
      });
    }
  }

  return (
    <View>
      <Svg width={width} height={height}>
        {cells.map((c, i) => (
          <Rect key={i} x={c.x} y={c.y} width={CELL} height={CELL} fill={c.color} />
        ))}
      </Svg>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 }}>
        <Text style={{ fontFamily: fonts.body, fontSize: 11, color: colors.textFaint }}>Menos</Text>
        {[colors.track, colors.accentFaint, colors.accentDim, colors.accent].map((c) => (
          <View key={c} style={{ width: 10, height: 10, backgroundColor: c }} />
        ))}
        <Text style={{ fontFamily: fonts.body, fontSize: 11, color: colors.textFaint }}>Más</Text>
      </View>
    </View>
  );
}
