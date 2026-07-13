import { useEffect, useRef } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Hexagon } from '@/components/Hexagon';
import { rankForLevel } from '@/lib/game';
import { colors, fonts } from '@/lib/theme';
import { voice } from '@/lib/voice';

interface Props {
  level: number | null;
  onClose: () => void;
}

function Ring({ delay }: { delay: number }) {
  const scale = useRef(new Animated.Value(0.7)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(scale, { toValue: 2.1, duration: 1600, useNativeDriver: true }),
          Animated.sequence([
            Animated.timing(opacity, { toValue: 0.55, duration: 250, useNativeDriver: true }),
            Animated.timing(opacity, { toValue: 0, duration: 1350, useNativeDriver: true }),
          ]),
        ]),
        Animated.timing(scale, { toValue: 0.7, duration: 0, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [scale, opacity, delay]);

  return (
    <Animated.View style={[styles.ring, { opacity, transform: [{ scale }] }]} pointerEvents="none">
      <Hexagon size={170} fill="transparent" color={colors.cyan} />
    </Animated.View>
  );
}

export function LevelUpOverlay({ level, onClose }: Props) {
  const scale = useRef(new Animated.Value(0.6)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (level !== null) {
      scale.setValue(0.6);
      opacity.setValue(0);
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 5 }),
        Animated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();
    }
  }, [level, scale, opacity]);

  return (
    <Modal visible={level !== null} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        {level !== null ? (
          <View style={styles.ringLayer} pointerEvents="none">
            <Ring delay={0} />
            <Ring delay={550} />
          </View>
        ) : null}
        <Animated.View style={[styles.panel, { transform: [{ scale }], opacity }]}>
          <Text style={styles.notice}>HAS SUBIDO DE NIVEL</Text>
          <Text style={styles.level}>{level ?? 0}</Text>
          <Text style={styles.rank}>CAZADOR · RANGO {level !== null ? rankForLevel(level) : ''}</Text>
          <Text style={styles.flavor}>{level !== null ? voice.levelUp() : ''}</Text>
          <Text style={styles.hint}>Toca para continuar</Text>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 14, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
  },
  panel: {
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.cyan,
    backgroundColor: colors.panel,
    paddingVertical: 36,
    paddingHorizontal: 44,
  },
  notice: {
    fontFamily: fonts.heading,
    fontSize: 14,
    letterSpacing: 4,
    color: colors.cyanText,
  },
  level: {
    fontFamily: fonts.brand,
    fontSize: 84,
    color: colors.cyan,
    marginVertical: 6,
  },
  rank: {
    fontFamily: fonts.heading,
    fontSize: 14,
    letterSpacing: 3,
    color: colors.text,
  },
  flavor: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.textDim,
    marginTop: 10,
  },
  hint: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textFaint,
    marginTop: 16,
  },
});
