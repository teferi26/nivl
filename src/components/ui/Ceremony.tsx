// NIVL · Ceremonia v2 (SISTEMA.md §8): subida de rango, grado o nivel a
// pantalla completa, en negro. Sustituye a LevelUpOverlay.
//
//   · épica (rango), 1600 ms: sale la letra vieja (120), sube la nueva (420),
//     el avatar pasa del marco viejo al nuevo (500), baja la corona (300) y
//     aparecen el nombre, el lema y los botones.
//   · corta (grado o nivel), 900 ms: sale el número viejo, sube el nuevo en
//     `display` mientras la barra se llena; sin corona.
//   · «reducir movimiento»: estado final directo con un fundido de 180 ms.
//
// Un toque en cualquier parte la cierra; los botones se quedan su toque. La
// vibración la pone el proveedor (una sola, por la principal): aquí no.
// Es un Modal de RN: la hoja de compartir NO va aquí dentro (en Android la
// captura sale negra); `onCompartir` la abre fuera, en la capa raíz.

import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { ink, motion, RANK_THEME, sizeClass, space, type } from '@/design/tokens';
import { RANGOS, type Celebracion, type EstadoProgreso, type RangoId } from '@/lib/progression';
import { Avatar, alturaCorona } from './Avatar';
import { Button } from './Button';
import { Crown } from './Crown';
import { useMovimientoReducido } from './motion';

export type FormaCeremonia = 'ceremonia-epica' | 'ceremonia-corta';

export interface CeremonyProps {
  /** null = cerrada. */
  celebracion: Celebracion | null;
  forma: FormaCeremonia;
  resumen: string[];
  /** Próximo rango (estadoDe(...).siguienteRango); null en S o si no se sabe. */
  siguiente: EstadoProgreso['siguienteRango'];
  avatar: { path: string | null; name: string };
  onCerrar: () => void;
  /** Sin él no hay botón Compartir. */
  onCompartir?: () => void;
}

const ANCHO_MAX = 560;

/** Claves ya anunciadas al lector de pantalla (una vez por clave). */
const anunciadas = new Set<string>();

function romano(n: number): string {
  return n === 3 ? 'III' : n === 2 ? 'II' : 'I';
}

function rangoAnterior(r: RangoId): RangoId {
  const i = RANGOS.findIndex((x) => x.id === r);
  return RANGOS[Math.max(0, i - 1)]!.id;
}

/** Qué cifra sale y cuál entra, rótulos y texto para el lector. */
function piezas(c: Celebracion): { viejo: string; nuevo: string; eyebrow: string; titulo: string; anuncio: string } {
  switch (c.tipo) {
    case 'rango':
      return {
        viejo: rangoAnterior(c.rango),
        nuevo: c.rango,
        eyebrow: 'NUEVO RANGO',
        titulo: c.nombre,
        anuncio: `Nuevo rango: ${c.rango}, ${c.nombre}. ${c.lema}`,
      };
    case 'grado':
      return {
        viejo: romano(Math.max(1, c.grado - 1)),
        nuevo: romano(c.grado),
        eyebrow: 'NUEVO GRADO',
        titulo: `${c.nombre} ${romano(c.grado)}`,
        anuncio: `Nuevo grado: ${c.nombre} ${romano(c.grado)}`,
      };
    case 'nivel':
      return {
        viejo: String(Math.max(1, c.nivel - 1)),
        nuevo: String(c.nivel),
        eyebrow: 'SUBES DE NIVEL',
        titulo: `Nivel ${c.nivel}`,
        anuncio: `Subes al nivel ${c.nivel}`,
      };
    default:
      return { viejo: '', nuevo: '', eyebrow: '', titulo: '', anuncio: '' };
  }
}

export function Ceremony({ celebracion, forma, resumen, siguiente, avatar, onCerrar, onCompartir }: CeremonyProps) {
  const visible = celebracion !== null && (celebracion.tipo === 'rango' || celebracion.tipo === 'grado' || celebracion.tipo === 'nivel');
  return (
    <Modal visible={visible} transparent statusBarTranslucent animationType="none" onRequestClose={onCerrar}>
      {visible ? (
        <Contenido
          key={celebracion.clave}
          c={celebracion}
          forma={forma}
          resumen={resumen}
          siguiente={siguiente}
          avatar={avatar}
          onCerrar={onCerrar}
          onCompartir={onCompartir}
        />
      ) : null}
    </Modal>
  );
}

interface ContenidoProps extends Omit<CeremonyProps, 'celebracion'> {
  c: Celebracion;
}

function Contenido({ c, forma, resumen, siguiente, avatar, onCerrar, onCompartir }: ContenidoProps) {
  const { width } = useWindowDimensions();
  const reducido = useMovimientoReducido();
  const epica = forma === 'ceremonia-epica' && c.tipo === 'rango';
  const p = piezas(c);
  const tam = sizeClass(width) === 'compact' ? 128 : 160;
  const nuevo: RangoId = c.tipo === 'rango' ? c.rango : 'E';
  const viejoRango = rangoAnterior(nuevo);

  const raiz = useRef(new Animated.Value(reducido ? 0 : 1)).current;
  const viejoOp = useRef(new Animated.Value(1)).current;
  const viejoY = useRef(new Animated.Value(0)).current;
  const nuevoOp = useRef(new Animated.Value(0)).current;
  const nuevoY = useRef(new Animated.Value(32)).current;
  const mezcla = useRef(new Animated.Value(0)).current;
  const coronaY = useRef(new Animated.Value(-tam * 0.4)).current;
  const coronaOp = useRef(new Animated.Value(0)).current;
  const resto = useRef(new Animated.Value(0)).current;
  const barra = useRef(new Animated.Value(0)).current;
  const [terminado, setTerminado] = useState(false);

  // Barra de la corta: el nivel se completa; en un grado, el tramo del rango.
  const llenado = c.tipo === 'grado' ? c.grado / 3 : 1;

  useEffect(() => {
    if (!anunciadas.has(c.clave)) {
      anunciadas.add(c.clave);
      AccessibilityInfo.announceForAccessibility(p.anuncio);
    }
    // Solo al montar: cada clave monta un Contenido nuevo (key).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const finales = () => {
      viejoOp.setValue(0);
      nuevoOp.setValue(1);
      nuevoY.setValue(0);
      mezcla.setValue(1);
      coronaY.setValue(0);
      coronaOp.setValue(1);
      resto.setValue(1);
      barra.setValue(llenado);
    };
    if (reducido) {
      finales();
      setTerminado(true);
      const a = Animated.timing(raiz, { toValue: 1, duration: motion.quick, useNativeDriver: true });
      a.start();
      return () => a.stop();
    }
    const sale = Animated.parallel([
      Animated.timing(viejoOp, { toValue: 0, duration: 120, useNativeDriver: true }),
      Animated.timing(viejoY, { toValue: -16, duration: 120, useNativeDriver: true }),
    ]);
    const sube = Animated.parallel([
      Animated.timing(nuevoOp, { toValue: 1, duration: motion.slow, useNativeDriver: true }),
      Animated.timing(nuevoY, { toValue: 0, duration: motion.slow, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]);
    const anim = epica
      ? Animated.sequence([
          sale,
          sube,
          Animated.timing(mezcla, { toValue: 1, duration: 500, useNativeDriver: true }),
          Animated.parallel([
            Animated.timing(coronaY, { toValue: 0, duration: 300, easing: Easing.out(Easing.quad), useNativeDriver: true }),
            Animated.timing(coronaOp, { toValue: 1, duration: 300, useNativeDriver: true }),
          ]),
          // 120 + 420 + 500 + 300 + 260 = 1600 (motion.ceremony).
          Animated.timing(resto, { toValue: 1, duration: motion.base, useNativeDriver: true }),
        ])
      : Animated.sequence([
          sale,
          Animated.parallel([
            sube,
            Animated.timing(barra, { toValue: llenado, duration: motion.slow, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
          ]),
          // 120 + 420 + 360 = 900.
          Animated.timing(resto, { toValue: 1, duration: 360, useNativeDriver: true }),
        ]);
    anim.start(({ finished }) => {
      if (finished) setTerminado(true);
    });
    return () => anim.stop();
    // La secuencia corre una vez por clave (key en el padre).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const alto = alturaCorona(tam, nuevo);
  const altoViejo = alturaCorona(tam, viejoRango);
  const tieneCorona = RANK_THEME[nuevo].crown !== 'none';
  const coronaTam = Math.round(tam * 0.5);
  const mostrarSiguiente = epica && siguiente !== null && nuevo !== 'S';
  const faltanDias = siguiente?.faltanDias ?? null;

  return (
    <Animated.View style={[styles.fondo, { opacity: raiz }]} accessibilityViewIsModal>
      {/* El toque en cualquier parte: detrás, no envolviendo los botones
          (un botón dentro de otro rompe la web y el lector de pantalla). */}
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={onCerrar}
        accessibilityRole="button"
        accessibilityLabel="Cerrar la celebración"
      />
      <View style={styles.toque} pointerEvents="box-none">
        <View style={styles.columna} pointerEvents="box-none">
          <View style={styles.arriba} pointerEvents="none">
          <Animated.Text style={[styles.eyebrow, { opacity: epica ? 1 : resto }]}>{p.eyebrow}</Animated.Text>

          {epica ? (
            <View
              style={{ width: tam, height: tam + alto, marginTop: space.s6 }}
              accessible
              accessibilityRole="image"
              accessibilityLabel={`${avatar.name}, rango ${nuevo}`}
            >
              {terminado ? (
                <Avatar size={tam} avatarPath={avatar.path} name={avatar.name} rank={nuevo} />
              ) : (
                <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={StyleSheet.absoluteFill}>
                  {/* Marco viejo, alineado por el círculo. */}
                  <Animated.View
                    style={[styles.capa, { top: alto - altoViejo, opacity: mezcla.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }]}
                  >
                    <Avatar size={tam} avatarPath={avatar.path} name={avatar.name} rank={viejoRango} />
                  </Animated.View>
                  {/* Marco nuevo, solo el círculo: la corona baja aparte. */}
                  <Animated.View style={[styles.capa, styles.recorte, { top: alto, width: tam, height: tam, opacity: mezcla }]}>
                    <View style={{ marginTop: -alto }}>
                      <Avatar size={tam} avatarPath={avatar.path} name={avatar.name} rank={nuevo} />
                    </View>
                  </Animated.View>
                  {tieneCorona && RANK_THEME[nuevo].crown !== 'none' ? (
                    <Animated.View
                      style={[styles.capa, { left: tam / 2 - coronaTam / 2, opacity: coronaOp, transform: [{ translateY: coronaY }] }]}
                    >
                      <Crown kind={RANK_THEME[nuevo].crown as 'casco' | 'laurel' | 'corona_arena'} size={coronaTam} />
                    </Animated.View>
                  ) : null}
                </View>
              )}
            </View>
          ) : null}

          {/* La cifra: la vieja sale y la nueva sube en el mismo sitio. */}
          <View style={[styles.cifras, epica ? styles.cifrasRango : styles.cifrasDisplay]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Animated.Text
              allowFontScaling={false}
              style={[epica ? styles.letra : styles.display, styles.cifra, { opacity: viejoOp, transform: [{ translateY: viejoY }] }]}
            >
              {p.viejo}
            </Animated.Text>
            <Animated.Text
              allowFontScaling={false}
              style={[epica ? styles.letra : styles.display, styles.cifra, { opacity: nuevoOp, transform: [{ translateY: nuevoY }] }]}
            >
              {p.nuevo}
            </Animated.Text>
          </View>

          {!epica ? (
            <View style={styles.pista} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <Animated.View style={[styles.relleno, { transform: [{ scaleX: barra }] }]} />
            </View>
          ) : null}

          </View>

          <Animated.View style={[styles.textos, { opacity: resto }]} pointerEvents="box-none">
            <View style={styles.arriba} pointerEvents="none">
            <Text style={styles.headline} accessibilityRole="header">
              {p.titulo}
            </Text>
            {c.tipo === 'rango' ? <Text style={styles.lema}>{c.lema}</Text> : null}
            {mostrarSiguiente && siguiente ? (
              <View style={styles.siguiente}>
                <Text style={styles.sigTexto}>
                  Siguiente: {siguiente.nombre} en el nivel {siguiente.nivel}
                </Text>
                <Text style={styles.sigTexto}>
                  Faltan {siguiente.faltan} {siguiente.faltan === 1 ? 'nivel' : 'niveles'}
                  {faltanDias !== null && faltanDias > 0 ? ` y ${faltanDias} ${faltanDias === 1 ? 'día activo' : 'días activos'}` : ''}
                </Text>
              </View>
            ) : null}
            {resumen.length > 0 ? <Text style={styles.resumen}>{resumen.join(' · ')}</Text> : null}
            </View>

            <View style={styles.botones}>
              {onCompartir ? <Button title="Compartir" size="lg" onPress={onCompartir} /> : null}
              <Button title="Seguir" variant="ghost" size="lg" onPress={onCerrar} />
            </View>
            <Text style={styles.micro} pointerEvents="none">
              Toca en cualquier parte para saltar
            </Text>
          </Animated.View>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: ink.ink0 },
  toque: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.s5 },
  columna: { width: '100%', maxWidth: ANCHO_MAX, alignItems: 'center' },
  arriba: { alignSelf: 'stretch', alignItems: 'center' },
  eyebrow: {
    fontFamily: type.label.family,
    fontSize: type.label.size,
    lineHeight: type.label.lineHeight,
    letterSpacing: type.label.tracking,
    color: ink.ink6,
    textAlign: 'center',
  },
  capa: { position: 'absolute', left: 0 },
  recorte: { overflow: 'hidden', borderRadius: 9999 },
  cifras: { alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  cifrasRango: { height: type.rank.lineHeight + space.s2, marginTop: space.s4 },
  cifrasDisplay: { height: type.display.lineHeight + space.s2, marginTop: space.s6 },
  cifra: { position: 'absolute', textAlign: 'center' },
  letra: {
    fontFamily: type.rank.family,
    fontSize: type.rank.size,
    lineHeight: type.rank.lineHeight,
    letterSpacing: type.rank.tracking,
    color: ink.ink10,
  },
  display: {
    fontFamily: type.display.family,
    fontSize: type.display.size,
    lineHeight: type.display.lineHeight,
    letterSpacing: type.display.tracking,
    color: ink.ink10,
  },
  pista: { width: '70%', height: 4, backgroundColor: ink.ink3, marginTop: space.s4, overflow: 'hidden' },
  relleno: { width: '100%', height: '100%', backgroundColor: ink.ink10, transformOrigin: 'left' },
  textos: { alignSelf: 'stretch', alignItems: 'center', marginTop: space.s4 },
  headline: {
    fontFamily: type.headline.family,
    fontSize: type.headline.size,
    lineHeight: type.headline.lineHeight,
    letterSpacing: type.headline.tracking,
    color: ink.ink10,
    textAlign: 'center',
  },
  lema: {
    fontFamily: type.body.family,
    fontSize: type.body.size,
    lineHeight: type.body.lineHeight,
    color: ink.ink8,
    textAlign: 'center',
    marginTop: space.s3,
  },
  siguiente: { marginTop: space.s5, gap: space.s1, alignItems: 'center' },
  sigTexto: {
    fontFamily: type.bodySm.family,
    fontSize: type.bodySm.size,
    lineHeight: type.bodySm.lineHeight,
    color: ink.ink8,
    textAlign: 'center',
  },
  resumen: {
    fontFamily: type.bodySm.family,
    fontSize: type.bodySm.size,
    lineHeight: type.bodySm.lineHeight,
    color: ink.ink6,
    textAlign: 'center',
    marginTop: space.s4,
  },
  botones: { alignSelf: 'stretch', gap: space.s2, marginTop: space.s8 },
  micro: {
    fontFamily: type.micro.family,
    fontSize: type.micro.size,
    lineHeight: type.micro.lineHeight,
    letterSpacing: type.micro.tracking,
    color: ink.ink6,
    textAlign: 'center',
    marginTop: space.s4,
  },
});
