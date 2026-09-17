import { View } from 'react-native';
import { colors } from '@/lib/theme';

interface Props {
  ratio: number;
  color?: string;
  trackColor?: string;
  height?: number;
}

export function XPBar({ ratio, color = colors.accent, trackColor = colors.track, height = 6 }: Props) {
  const pct = Math.min(100, Math.max(0, Math.round(ratio * 100)));
  return (
    <View style={{ height, backgroundColor: trackColor, overflow: 'hidden' }}>
      <View style={{ height, width: `${pct}%`, backgroundColor: color }} />
    </View>
  );
}
