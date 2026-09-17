import * as Haptics from 'expo-haptics';
import { useEffect, useRef } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SystemWindow } from '@/components/SystemWindow';
import { rankForLevel } from '@/lib/game';
import { colors, fonts } from '@/lib/theme';
import { voice } from '@/lib/voice';

interface Props {
  level: number | null;
  onClose: () => void;
}

/**
 * Un anillo que nace en el centro, crece y se apaga. Tres en cascada dan la
 * onda expansiva del level-up sin un solo degradado: solo trazos de un píxel
 * sobre negro.
 */
function Anillo({ delay, size = 220 }: { delay: number; size?: number }) {
  const scale = useRef(new Animated.Value(0.5)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(scale, { toValue: 2.6, duration: 2200, useNativeDriver: true }),
          Animated.sequence([
            Animated.timing(opacity, { toValue: 0.5, duration: 300, useNativeDriver: true }),
            Animated.timing(opacity, { toValue: 0, duration: 1900, useNativeDriver: true }),
          ]),
        ]),
        Animated.timing(scale, { toValue: 0.5, duration: 0, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [scale, opacity, delay]);

  return (
    <Animated.View
      style={[styles.anillo, { width: size, height: size, borderRadius: size / 2, opacity, transform: [{ scale }] }]}
      pointerEvents="none"
    />
  );
}

/**
 * La celebración de subir de nivel. Es el único sitio donde el marco con las
 * esquinas cortadas tiene permiso: un momento ganado, no una pantalla más.
 */
export function LevelUpOverlay({ level, onClose }: Props) {
  const scale = useRef(new Animated.Value(0.7)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const numero = useRef(new Animated.Value(1.6)).current;
  const numeroOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (level === null) return;
    scale.setValue(0.7);
    opacity.setValue(0);
    numero.setValue(1.6);
    numeroOpacity.setValue(0);
    // Impacto fuerte: el par háptico del hito, como manda el sistema.
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 6, tension: 60 }),
      Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.sequence([
        Animated.delay(140),
        Animated.parallel([
          Animated.spring(numero, { toValue: 1, useNativeDriver: true, friction: 5, tension: 70 }),
          Animated.timing(numeroOpacity, { toValue: 1, duration: 180, useNativeDriver: true }),
        ]),
      ]),
    ]).start();
  }, [level, scale, opacity, numero, numeroOpacity]);

  const rango = level !== null ? rankForLevel(level) : '';

  return (
    <Modal visible={level !== null} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" accessibilityLabel="Continuar">
        {level !== null ? (
          <View style={styles.capaAnillos} pointerEvents="none">
            <Anillo delay={0} />
            <Anillo delay={700} />
            <Anillo delay={1400} />
          </View>
        ) : null}

        <Animated.View style={[styles.marco, { transform: [{ scale }], opacity }]}>
          <SystemWindow cut={14} color={colors.accent} fill={colors.panel} style={styles.ventana} contentStyle={styles.contenido}>
            <Text style={styles.aviso}>HAS SUBIDO DE NIVEL</Text>

            <View style={styles.escenario}>
              <View style={styles.orbita} pointerEvents="none" />
              <View style={styles.orbitaInterior} pointerEvents="none" />
              <Animated.Text
                style={[styles.nivel, { opacity: numeroOpacity, transform: [{ scale: numero }] }]}
                accessibilityLabel={`Nivel ${level ?? 0}`}
              >
                {level ?? 0}
              </Animated.Text>
            </View>

            <View style={styles.laurel} />
            <Text style={styles.rango}>GLADIADOR · RANGO {rango}</Text>
            <Text style={styles.frase}>{level !== null ? voice.levelUp() : ''}</Text>
            <Text style={styles.pista}>Toca para continuar</Text>
          </SystemWindow>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.94)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  capaAnillos: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  anillo: { position: 'absolute', borderWidth: 1, borderColor: colors.accent },
  marco: { width: '82%', maxWidth: 360 },
  ventana: { marginBottom: 0 },
  contenido: { alignItems: 'center', paddingVertical: 34, paddingHorizontal: 28 },
  aviso: { fontFamily: fonts.heading, fontSize: 12, letterSpacing: 4.5, color: colors.accentText },
  escenario: { width: 176, height: 176, alignItems: 'center', justifyContent: 'center', marginTop: 18 },
  orbita: { ...StyleSheet.absoluteFillObject, borderRadius: 88, borderWidth: 1, borderColor: colors.accentDim },
  orbitaInterior: {
    position: 'absolute',
    left: 14,
    right: 14,
    top: 14,
    bottom: 14,
    borderRadius: 74,
    borderWidth: 1,
    borderColor: colors.line,
  },
  nivel: {
    fontFamily: fonts.brand,
    fontSize: 96,
    lineHeight: 108,
    color: colors.accent,
    includeFontPadding: false,
    textAlign: 'center',
  },
  laurel: { width: 44, height: 1, backgroundColor: colors.gold, marginTop: 18 },
  rango: { fontFamily: fonts.heading, fontSize: 13, letterSpacing: 3, color: colors.text, marginTop: 14 },
  frase: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 19, color: colors.textDim, marginTop: 10, textAlign: 'center' },
  pista: { fontFamily: fonts.heading, fontSize: 10, letterSpacing: 2, color: colors.textFaint, marginTop: 22 },
});
