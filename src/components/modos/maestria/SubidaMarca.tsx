// NIVL · Modos: el momento de subida de marca (MK II a MK V). 1,2 s como mucho.
//
// Una capa a pantalla completa (va en `<Screen overlay>` o en la capa raíz):
// velo negro, el marco de la marca anterior que cede al nuevo y, debajo,
// «MK III» en Cinzel con el acento del modo y una línea en voz del sistema.
// Un toque en cualquier sitio lo cierra antes.
//
//   0 ms     velo y marco anterior (motion.quick, 180)
//   180 ms   el marco nuevo entra creciendo de 0,82 a 1 (motion.base, 260),
//            vibración `rango` (el mismo doble golpe que la subida de rango)
//   960 ms   todo se funde (240) → onFin a los 1.200 ms
// Con «reducir movimiento»: sin crecer ni cruzar marcos; fundido de entrada y
// de salida y el mismo tope de 1,2 s.
//
// Sistema de celebración (src/components/celebracion): NO se pinta encima de
// una ceremonia o un toast de la cola. Mientras `useCelebracion().celebrando`
// sea true, espera; arranca cuando la cola queda libre. El texto se anuncia al
// lector (useAnunciar) y la vibración pasa por `vibrar`, como el resto.
//
// Sonido: `onSonido` es el enganche de la firma de sonido de la P10. El
// layout de cada mundo (LayoutMundo) le pasa la del modo, la misma de la rueda
// (rueda/sonido.ts, expo-audio: pide binario nuevo).

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { useMovimientoArena } from '@/components/arena/quieto';
import { useCelebracion } from '@/components/celebracion/contexto';
import { useAnunciar } from '@/components/ui/useAnunciar';
import { vibrar } from '@/design/haptics';
import { ink, motion, space, type as tipo } from '@/design/tokens';
import { t } from '@/i18n';
import { romanoMarca, type Marca } from '@/modos/maestria';
import { NOMBRE_MODO, type ModoEtiqueta } from '@/modos/tipos';
import { MarcoEmblema } from './MarcoEmblema';

/** Duración total del momento (ms). Tope de la propuesta: 1,2 s. */
export const DURACION_SUBIDA_MS = 1200;
const ENTRA_NUEVO_MS = motion.quick; // 180
const SALE_MS = 240;
const TAMANO = 132;

export interface SubidaMarcaProps {
  /** La marca a la que se sube; null = nada que enseñar. */
  marca: Marca | null;
  modo: ModoEtiqueta;
  /** El acento del modo (`modoAcento[modo]`). */
  color: string;
  /** El emblema del modo, dentro del marco. */
  emblema?: ReactNode;
  /** Se llama una vez, al terminar o al tocar. */
  onFin: () => void;
  /** Enganche para el sonido de la marca (P10). */
  onSonido?: (marca: Marca) => void;
}

export function SubidaMarca({ marca, modo, color, emblema, onFin, onSonido }: SubidaMarcaProps) {
  const { celebrando } = useCelebracion();
  const reducido = useMovimientoArena();
  const [enCurso, setEnCurso] = useState<Marca | null>(null);
  const velo = useRef(new Animated.Value(0)).current;
  const nuevo = useRef(new Animated.Value(0)).current;
  const fin = useRef(onFin);
  fin.current = onFin;
  const sonido = useRef(onSonido);
  sonido.current = onSonido;
  const cerrado = useRef(false);

  // Arranca cuando hay marca y la cola de celebraciones está libre.
  useEffect(() => {
    if (marca === null) {
      setEnCurso(null);
      return;
    }
    if (celebrando || enCurso === marca) return;
    cerrado.current = false;
    setEnCurso(marca);
  }, [marca, celebrando, enCurso]);

  useEffect(() => {
    if (enCurso === null) return;
    velo.setValue(0);
    nuevo.setValue(reducido ? 1 : 0);
    vibrar('rango');
    sonido.current?.(enCurso);
    const entrada = reducido
      ? Animated.timing(velo, { toValue: 1, duration: motion.quick, useNativeDriver: true })
      : Animated.sequence([
          Animated.timing(velo, { toValue: 1, duration: ENTRA_NUEVO_MS, useNativeDriver: true }),
          Animated.timing(nuevo, {
            toValue: 1,
            duration: motion.base,
            easing: Easing.out(Easing.back(1.6)),
            useNativeDriver: true,
          }),
        ]);
    const salida = Animated.timing(velo, {
      toValue: 0,
      duration: SALE_MS,
      delay: DURACION_SUBIDA_MS - SALE_MS - (reducido ? motion.quick : ENTRA_NUEVO_MS + motion.base),
      useNativeDriver: true,
    });
    const anim = Animated.sequence([entrada, salida]);
    anim.start();
    const reloj = setTimeout(cerrar, DURACION_SUBIDA_MS);
    return () => {
      clearTimeout(reloj);
      anim.stop();
    };
    // `cerrar` solo lee refs.
  }, [enCurso, reducido, velo, nuevo]);

  function cerrar() {
    if (cerrado.current) return;
    cerrado.current = true;
    fin.current();
  }

  const nombre = NOMBRE_MODO[modo];
  const n = enCurso ? romanoMarca(enCurso) : '';
  useAnunciar(enCurso ? t('modos:maestria.subida.a11y', { modo: nombre, n: enCurso }) : null);

  if (enCurso === null) return null;
  const anterior = (enCurso > 1 ? enCurso - 1 : 1) as Marca;
  const escala = nuevo.interpolate({ inputRange: [0, 1], outputRange: [0.82, 1] });
  const viejo = nuevo.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });

  return (
    <Animated.View style={[styles.capa, { opacity: velo }]} pointerEvents="box-none">
      <Pressable
        style={styles.toque}
        onPress={cerrar}
        accessibilityRole="button"
        accessibilityLabel={t('modos:maestria.subida.saltarA11y')}
      >
        <View style={styles.marcos} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          {!reducido ? (
            <Animated.View style={[styles.superpuesto, { opacity: viejo }]}>
              <MarcoEmblema marca={anterior} color={color} tamano={TAMANO}>
                {emblema}
              </MarcoEmblema>
            </Animated.View>
          ) : null}
          <Animated.View style={[styles.superpuesto, { opacity: nuevo, transform: [{ scale: escala }] }]}>
            <MarcoEmblema marca={enCurso} color={color} tamano={TAMANO}>
              {emblema}
            </MarcoEmblema>
          </Animated.View>
        </View>
        <Text style={[styles.marca, { color }]} maxFontSizeMultiplier={1}>
          {t('modos:maestria.marca', { n })}
        </Text>
        <Text style={styles.linea} maxFontSizeMultiplier={1.35}>
          {t('modos:maestria.subida.cuerpo', { modo: nombre })}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  capa: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.9)', zIndex: 50 }, // i18n-ok: color
  toque: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.s6 },
  marcos: { width: TAMANO, height: TAMANO },
  superpuesto: { ...StyleSheet.absoluteFillObject },
  marca: {
    marginTop: space.s5,
    fontFamily: tipo.rank.family,
    fontSize: tipo.rank.size,
    lineHeight: tipo.rank.lineHeight,
    letterSpacing: tipo.rank.tracking,
  },
  linea: {
    marginTop: space.s2,
    color: ink.ink8,
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    textAlign: 'center',
  },
});
