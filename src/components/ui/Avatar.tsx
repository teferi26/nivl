// NIVL · Avatar v2 (SISTEMA.md §5 y §7): foto circular con el marco de rango.
//
// Evoluciona la forma, nunca el color (RANK_THEME en tokens.ts):
//   · aro exterior blanco de `ring` pt;
//   · `doubleRing` → segundo aro ink6 por dentro;
//   · `notches` → remaches blancos sobre el aro interior;
//   · `crown` → casco, laurel o corona (Crown.tsx) sobre el avatar;
//   · `shimmer` → una pasada de brillo por el aro interior cada 8 s. Quieto si
//     el usuario pide reducir movimiento.
// La foto la resuelve useRetrato (src/components/Avatar.tsx), con el mismo
// comportamiento que el retrato antiguo (incluido `onReady` para compartir).

import { Image } from 'expo-image';
import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useRetrato } from '@/components/Avatar';
import { ink, RANK_THEME, type Rank } from '@/design/tokens';
import { fonts } from '@/lib/theme';
import { Crown } from './Crown';
import { useMovimientoReducido } from './motion';

interface Props {
  size: number;
  /** `profiles.avatar_url`: la ruta en el bucket, no una URL firmada. */
  avatarPath: string | null;
  name: string;
  rank?: Rank;
  /** Una vez, cuando el retrato es definitivo (foto pintada o inicial). */
  onReady?: () => void;
}

/** Separación entre aros y entre el marco y la foto (pt). */
const HUECO = 2;
const AROS_INTERIOR = 1;
const BRILLO_CADA_MS = 8000;
const BRILLO_DURA_MS = 1200;

export function Avatar({ size, avatarPath, name, rank = 'E', onReady }: Props) {
  const tema = RANK_THEME[rank];
  const reducido = useMovimientoReducido();
  const { uri, fallida, alCargar, alFallar } = useRetrato(avatarPath, onReady);

  const c = size / 2;
  const rExterior = c - tema.ring / 2;
  const rInterior = rExterior - tema.ring / 2 - HUECO - AROS_INTERIOR / 2;
  const margen = tema.ring + HUECO + (tema.doubleRing ? AROS_INTERIOR + HUECO : 0);
  const foto = Math.max(0, size - margen * 2);
  const remaches = tema.doubleRing ? tema.notches : 0;
  const rRemache = Math.max(0.8, size / 80);
  const coronaTam = Math.round(size * 0.42);

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`${name}, rango ${rank}`}
      style={{ width: size, height: size }}
    >
      <Svg width={size} height={size} style={StyleSheet.absoluteFill} pointerEvents="none">
        <Circle cx={c} cy={c} r={rExterior} stroke={ink.ink10} strokeWidth={tema.ring} fill="none" />
        {tema.doubleRing ? (
          <Circle cx={c} cy={c} r={rInterior} stroke={ink.ink6} strokeWidth={AROS_INTERIOR} fill="none" />
        ) : null}
        {Array.from({ length: remaches }, (_, i) => {
          const a = (i / remaches) * Math.PI * 2 - Math.PI / 2;
          return <Circle key={i} cx={c + rInterior * Math.cos(a)} cy={c + rInterior * Math.sin(a)} r={rRemache} fill={ink.ink10} />;
        })}
      </Svg>

      {tema.shimmer && tema.doubleRing && !reducido ? <Brillo size={size} r={rInterior} /> : null}

      <View
        style={[
          styles.foto,
          { width: foto, height: foto, borderRadius: foto / 2, top: margen, left: margen },
        ]}
      >
        {uri && !fallida ? (
          <Image source={{ uri }} style={{ width: foto, height: foto }} contentFit="cover" onLoad={alCargar} onError={alFallar} />
        ) : avatarPath && !fallida ? null : (
          <Text allowFontScaling={false} style={[styles.letra, { fontSize: foto * 0.4 }]}>
            {name.charAt(0).toUpperCase()}
          </Text>
        )}
      </View>

      {tema.crown !== 'none' ? (
        <View pointerEvents="none" style={[styles.corona, { top: -coronaTam * 0.62, left: c - coronaTam / 2 }]}>
          <Crown kind={tema.crown} size={coronaTam} />
        </View>
      ) : null}
    </View>
  );
}

/** Arco blanco que recorre el aro interior una vez cada 8 s (solo rango S). */
function Brillo({ size, r }: { size: number; r: number }) {
  const giro = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(giro, { toValue: 1, duration: BRILLO_DURA_MS, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.delay(BRILLO_CADA_MS - BRILLO_DURA_MS),
        Animated.timing(giro, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [giro]);

  const c = size / 2;
  // Arco de 40° desde las 12 en punto.
  const a = (40 * Math.PI) / 180;
  const d = `M${c} ${c - r}A${r} ${r} 0 0 1 ${c + r * Math.sin(a)} ${c - r * Math.cos(a)}`;
  const rotate = giro.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const opacity = giro.interpolate({ inputRange: [0, 0.1, 0.9, 1], outputRange: [0, 1, 1, 0] });

  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity, transform: [{ rotate }] }]}>
      <Svg width={size} height={size}>
        <Path d={d} stroke={ink.ink10} strokeWidth={2} strokeLinecap="round" fill="none" />
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  foto: {
    position: 'absolute',
    overflow: 'hidden',
    backgroundColor: ink.ink2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  letra: { color: ink.ink10, fontFamily: fonts.brand },
  corona: { position: 'absolute' },
});
