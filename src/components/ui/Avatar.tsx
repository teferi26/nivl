// NIVL · Avatar v2 (SISTEMA.md §5 y §7): foto circular con el marco de rango.
//
// Evoluciona la forma, nunca el color (RANK_THEME en tokens.ts):
//   · aro exterior blanco de `ring` pt;
//   · `doubleRing` → segundo aro ink6 por dentro;
//   · `notches` → remaches sobre el aro EXTERIOR (blancos con filo negro, para
//     que se vean encima del aro blanco). En S son rombos y hay un tercer aro:
//     A y S se distinguen sin depender del brillo;
//   · `marco` laurel_* → ramitas de laurel en el arco inferior (1 par en
//     laurel_simple, 2 en laurel_doble y laurel_corona), entre remache y remache;
//   · `crown` → casco, laurel o corona (Crown.tsx) a la mitad del tamaño del
//     avatar, centrada y con la base apoyada 1,5 pt dentro del aro. Por debajo
//     de 48 pt no se pinta (no se lee). Su altura se reserva arriba como
//     `paddingTop` (`alturaCorona`) para que no pise lo que haya encima;
//   · `shimmer` → una pasada de brillo por el aro interior cada 8 s. Quieto si
//     el usuario pide reducir movimiento.
// La foto la resuelve useRetrato (./useRetrato.ts), con el mismo
// comportamiento que el retrato antiguo (incluido `onReady` para compartir).

import { Image } from 'expo-image';
import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useRetrato } from './useRetrato';
import { ink, RANK_THEME, type Rank, type RankTheme } from '@/design/tokens';
import { fonts } from '@/lib/theme';
import { BASE_CORONA, Crown } from './Crown';
import { useMovimientoReducido } from './motion';

interface Props {
  size: number;
  /** `profiles.avatar_url`: la ruta en el bucket, no una URL firmada. */
  avatarPath: string | null;
  name: string;
  /** null = rango desconocido (p. ej. un amigo): marco liso y el lector no dice «rango». */
  rank?: Rank | null;
  /** Título vigente (tituloVigente() del Chat 5). Lo lee el lector de pantalla. */
  titulo?: string;
  /** Una vez, cuando el retrato es definitivo (foto pintada o inicial). */
  onReady?: () => void;
}

/** Separación entre aros y entre el marco y la foto (pt). */
const HUECO = 2;
const AROS_INTERIOR = 1;
const BRILLO_CADA_MS = 8000;
const BRILLO_DURA_MS = 1200;
/** Por debajo de este tamaño de avatar la corona no se lee y no se pinta. */
const CORONA_MIN_AVATAR = 48;
/** Cuánto entra la base de la corona en el aro (pt). */
const APOYO_CORONA = 1.5;

interface Geometria {
  c: number;
  rExterior: number;
  rInterior: number;
  /** Tercer aro (solo S). null si no hay. */
  rExtra: number | null;
  /** Distancia del borde del avatar a la foto. */
  margen: number;
  remaches: number;
  rRemache: number;
  /** Pares de ramitas de laurel en el arco inferior. */
  paresLaurel: number;
  hoja: { largo: number; ancho: number; trazo: number };
  /** Lado de la corona (0 = sin corona). */
  coronaTam: number;
  /** Y del borde exterior del aro, arriba. */
  topeAro: number;
}

function paresDe(marco: RankTheme['marco']): number {
  if (marco === 'laurel_simple') return 1;
  if (marco === 'laurel_doble' || marco === 'laurel_corona') return 2;
  return 0;
}

function geometria(size: number, rank: Rank): Geometria {
  const tema = RANK_THEME[rank];
  const c = size / 2;
  const remaches = tema.notches;
  const rRemache = Math.max(1.5, size / 32);
  const paresLaurel = paresDe(tema.marco);
  const hoja = { largo: size * 0.13, ancho: size * 0.055, trazo: Math.max(1, size / 64) };
  // Lo que sobresale del eje del aro hacia fuera: el propio aro, un remache con
  // su filo o media hoja. El aro se mete hacia dentro para que nada se corte.
  const borde = Math.max(
    tema.ring / 2,
    remaches > 0 ? rRemache + 0.5 : 0,
    paresLaurel > 0 ? hoja.ancho / 2 + hoja.trazo / 2 : 0,
  );
  const rExterior = c - borde;
  const rInterior = rExterior - tema.ring / 2 - HUECO - AROS_INTERIOR / 2;
  const extra = tema.marco === 'laurel_corona';
  const rExtra = extra ? rInterior - AROS_INTERIOR - HUECO : null;
  const margen =
    borde +
    tema.ring / 2 +
    HUECO +
    (tema.doubleRing ? AROS_INTERIOR + HUECO : 0) +
    (extra ? AROS_INTERIOR + HUECO : 0);
  const coronaTam = tema.crown !== 'none' && size >= CORONA_MIN_AVATAR ? Math.round(size * 0.5) : 0;
  return {
    c,
    rExterior,
    rInterior,
    rExtra,
    margen,
    remaches,
    rRemache,
    paresLaurel,
    hoja,
    coronaTam,
    topeAro: borde - tema.ring / 2,
  };
}

/** Cuánto sube la corona por encima del borde superior del círculo (pt). */
function sobresaleCorona(g: Geometria): number {
  if (g.coronaTam === 0) return 0;
  const baseEnCorona = (g.coronaTam * BASE_CORONA) / 24;
  return Math.max(0, baseEnCorona - g.topeAro - APOYO_CORONA);
}

/**
 * Alto que la corona ocupa por encima del círculo del avatar (pt, entero; 0 sin
 * corona o por debajo de 48). El Avatar ya lo reserva como `paddingTop`: la
 * vista mide `size + alturaCorona(size, rank)`. Sirve para alinear vecinos.
 */
export function alturaCorona(size: number, rank: Rank = 'E'): number {
  return Math.ceil(sobresaleCorona(geometria(size, rank)));
}

const f = (n: number) => n.toFixed(2);

/** Hoja de laurel (dos cuadráticas) centrada en (x, y) y orientada a `a` rad. */
function hojaPath(x: number, y: number, a: number, largo: number, ancho: number): string {
  const dx = Math.cos(a) * (largo / 2);
  const dy = Math.sin(a) * (largo / 2);
  const nx = -Math.sin(a) * ancho;
  const ny = Math.cos(a) * ancho;
  return (
    `M${f(x - dx)} ${f(y - dy)}` +
    `Q${f(x + nx)} ${f(y + ny)} ${f(x + dx)} ${f(y + dy)}` +
    `Q${f(x - nx)} ${f(y - ny)} ${f(x - dx)} ${f(y - dy)}Z`
  );
}

/** Rombo (tachuela) centrado en (x, y) con un vértice hacia fuera del aro. */
function rombo(x: number, y: number, a: number, r: number): string {
  const ux = Math.cos(a) * r;
  const uy = Math.sin(a) * r;
  const vx = -Math.sin(a) * r * 0.75;
  const vy = Math.cos(a) * r * 0.75;
  return `M${f(x + ux)} ${f(y + uy)}L${f(x + vx)} ${f(y + vy)}L${f(x - ux)} ${f(y - uy)}L${f(x - vx)} ${f(y - vy)}Z`;
}

export function Avatar({ size, avatarPath, name, rank: rankProp = 'E', titulo, onReady }: Props) {
  const rank: Rank = rankProp ?? 'E';
  const conRango = rankProp !== null;
  const tema = RANK_THEME[rank];
  const reducido = useMovimientoReducido();
  const { uri, fallida, alCargar, alFallar } = useRetrato(avatarPath, onReady);

  const g = geometria(size, rank);
  const { c, rExterior, rInterior, rExtra, margen, remaches, rRemache, paresLaurel, hoja, coronaTam } = g;
  const foto = Math.max(0, size - margen * 2);
  const alto = alturaCorona(size, rank);
  // Arriba de la corona dentro de la vista: 0 o una fracción por el redondeo.
  const coronaTop = alto - sobresaleCorona(g);
  const rombos = tema.marco === 'laurel_corona';

  // Remaches repartidos desde las 12 en punto sobre el eje del aro exterior.
  const pasoRemache = remaches > 0 ? (Math.PI * 2) / remaches : 0;
  const puntosRemache = Array.from({ length: remaches }, (_, i) => {
    const a = i * pasoRemache - Math.PI / 2;
    return { x: c + rExterior * Math.cos(a), y: c + rExterior * Math.sin(a), a };
  });

  // Ramitas: a medio camino entre remaches, simétricas respecto a las 6 y
  // orientadas por la tangente hacia arriba, como una corona de laurel.
  const paso = pasoRemache > 0 ? pasoRemache : Math.PI / 6;
  const hojas: string[] = [];
  for (let k = 0; k < paresLaurel; k++) {
    const off = (k + 0.5) * paso;
    for (const lado of [1, -1] as const) {
      const phi = Math.PI / 2 - lado * off; // lado 1: derecha
      const x = c + rExterior * Math.cos(phi);
      const y = c + rExterior * Math.sin(phi);
      const a = lado === 1 ? phi - Math.PI / 2 : phi + Math.PI / 2;
      hojas.push(hojaPath(x, y, a, hoja.largo, hoja.ancho));
    }
  }

  const base = conRango ? `${name}, rango ${rank}` : name;
  const etiqueta = titulo ? `${base}, ${titulo}` : base;

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={etiqueta}
      style={{ width: size, height: size + alto, paddingTop: alto }}
    >
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size} style={StyleSheet.absoluteFill} pointerEvents="none">
          <Circle cx={c} cy={c} r={rExterior} stroke={ink.ink10} strokeWidth={tema.ring} fill="none" />
          {tema.doubleRing ? (
            <Circle cx={c} cy={c} r={rInterior} stroke={ink.ink6} strokeWidth={AROS_INTERIOR} fill="none" />
          ) : null}
          {rExtra != null ? (
            <Circle cx={c} cy={c} r={rExtra} stroke={ink.ink10} strokeWidth={AROS_INTERIOR} fill="none" />
          ) : null}
          {hojas.map((d, i) => (
            <Path key={`h${i}`} d={d} fill={ink.ink0} stroke={ink.ink10} strokeWidth={hoja.trazo} strokeLinejoin="round" />
          ))}
          {puntosRemache.map((p, i) =>
            rombos ? (
              <Path
                key={`r${i}`}
                d={rombo(p.x, p.y, p.a, rRemache * 1.35)}
                fill={ink.ink10}
                stroke={ink.ink0}
                strokeWidth={0.75}
                strokeLinejoin="round"
              />
            ) : (
              <Circle key={`r${i}`} cx={p.x} cy={p.y} r={rRemache} fill={ink.ink10} stroke={ink.ink0} strokeWidth={0.75} />
            ),
          )}
        </Svg>

        {tema.shimmer && tema.doubleRing && !reducido ? <Brillo size={size} r={rInterior} /> : null}

        <View style={[styles.foto, { width: foto, height: foto, borderRadius: foto / 2, top: margen, left: margen }]}>
          {uri && !fallida ? (
            <Image source={{ uri }} style={{ width: foto, height: foto }} contentFit="cover" onLoad={alCargar} onError={alFallar} />
          ) : avatarPath && !fallida ? null : (
            <Text allowFontScaling={false} style={[styles.letra, { fontSize: foto * 0.4 }]}>
              {name.charAt(0).toUpperCase()}
            </Text>
          )}
        </View>
      </View>

      {coronaTam > 0 && tema.crown !== 'none' ? (
        <View pointerEvents="none" style={[styles.corona, { top: coronaTop, left: c - coronaTam / 2 }]}>
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
