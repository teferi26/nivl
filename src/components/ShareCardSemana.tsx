// NIVL · La tarjeta de la semana: una story 9:16 para sacar fuera de la app.
//
// Esta tarjeta ES el marketing: es lo único de NIVL que ve quien no la tiene.
// Por eso no enseña la interfaz sino un parte: quién eres, cuánto has subido
// esta semana, cuánto cumples y dónde te encuentran (nivl.app + tu código).
//
// Monocromo de arena: blanco sobre negro, hierro para la estructura y el oro
// SOLO en la racha y el título, como en el resto de la app. Todo se mide en
// unidades relativas al ancho (u) para que la vista previa del móvil y el PNG
// de 1080×1920 sean la misma pieza a distinta escala.

import Ionicons from '@expo/vector-icons/Ionicons';
import * as Sharing from 'expo-sharing';
import { useRef, useState, type Ref, type RefObject } from 'react';
import { Alert, Modal, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { Avatar } from '@/components/Avatar';
import { SystemButton } from '@/components/SystemButton';
import { levelFromXp, rankForLevel } from '@/lib/game';
import { kindMeta } from '@/lib/kinds';
import { fetchBoard, fetchSocialSelf, type BoardEntry } from '@/lib/social';
import { clasificar, codigoLegible, DIAS_VENTANA, DOMINIO_NIVL, posicionEntreAmigos } from '@/lib/socialmath';
import { colors, fonts } from '@/lib/theme';

export interface DatosSemana {
  name: string;
  avatarPath: string | null;
  equippedTitle: string | null;
  profileKind: unknown;
  xpTotal: number;
  streakDays: number;
  /** XP ganado con misiones en los últimos 7 días. */
  xpSemana: number;
  /** null = no tenía misiones programadas: se enseñan los días activos en su lugar. */
  compliancePct: number | null;
  daysActive: number;
  /** "2.º de 5", o null si todavía no hay amigos con los que medirse. */
  posicion: string | null;
  friendCode: string;
}

/**
 * Reúne lo que pinta la tarjeta. La tarjeta es SIEMPRE de los últimos 7 días y
 * por XP: si quien llama ya tiene el marcador semanal lo pasa y se ahorra la
 * lectura; si no, se pide aquí. La usan Amigos y el "día perfecto" de Hoy.
 */
export async function prepararDatosSemana(
  userId: string,
  opciones: { semana?: readonly BoardEntry[]; friendCode?: string } = {},
): Promise<DatosSemana> {
  const [semana, codigo] = await Promise.all([
    opciones.semana ? Promise.resolve(opciones.semana) : fetchBoard(DIAS_VENTANA.semana),
    opciones.friendCode ? Promise.resolve(opciones.friendCode) : fetchSocialSelf(userId).then((s) => s.friendCode),
  ]);
  const mio = semana.find((b) => b.isMe);
  if (!mio) throw new Error('El sistema no encuentra tu fila en el marcador.');
  return {
    name: mio.name,
    avatarPath: mio.avatarPath,
    equippedTitle: mio.equippedTitle,
    profileKind: mio.profileKind,
    xpTotal: mio.xpTotal,
    streakDays: mio.streakDays,
    xpSemana: mio.xpWindow,
    compliancePct: mio.compliancePct,
    daysActive: mio.daysActive,
    posicion: posicionEntreAmigos(clasificar(semana.filter((b) => b.visible), 'xp')),
    friendCode: codigo,
  };
}

const ANCHO_BASE = 360;
/** Salida en píxeles: el formato de story de Instagram, TikTok y WhatsApp. */
const SALIDA = { width: 1080, height: 1920 } as const;

interface CardProps {
  datos: DatosSemana;
  /** Ancho en pantalla; el alto sale solo (9:16). */
  width: number;
  ref?: Ref<View>;
  /** El retrato ya es definitivo (foto cargada o inicial): se puede capturar. */
  onReady?: () => void;
}

export function ShareCardSemana({ datos, width, ref, onReady }: CardProps) {
  const u = width / ANCHO_BASE;
  const height = (width * SALIDA.height) / SALIDA.width;
  const lvl = levelFromXp(datos.xpTotal);
  const rank = rankForLevel(lvl.level);
  const kind = kindMeta(datos.profileKind);
  const conRacha = datos.streakDays > 0;
  const pct = datos.compliancePct;
  // Sin XP esta semana (cuenta recién creada) el héroe no puede ser "+0 XP":
  // se enseña dónde está, no lo que no ha hecho.
  const sinXp = datos.xpSemana <= 0;

  const t = (size: number, extra?: object) => ({ fontSize: size * u, ...extra });
  // TODOS los <Text> llevan allowFontScaling={false}: la tarjeta es una imagen
  // de proporción fija. Con el texto grande del sistema se desbordaba el marco
  // y el PNG salía roto justo para quien más grande tiene la letra.

  return (
    // collapsable={false}: sin esto Android aplana la vista y view-shot no
    // encuentra nada que capturar.
    <View ref={ref} collapsable={false} style={[styles.card, { width, height }]}>
      {/* Una franja plana de panel arriba: la arena no usa degradados. */}
      <View style={[styles.franja, { height: height * 0.34 }]} />

      {/* Marco de hierro con las cuatro esquinas marcadas en blanco. */}
      <View style={[styles.marco, { top: 14 * u, left: 14 * u, right: 14 * u, bottom: 14 * u }]} />
      {(['tl', 'tr', 'bl', 'br'] as const).map((k) => (
        <View
          key={k}
          style={[
            styles.esquina,
            { width: 18 * u, height: 18 * u },
            k[0] === 't' ? { top: 14 * u, borderTopWidth: 1.5 } : { bottom: 14 * u, borderBottomWidth: 1.5 },
            k[1] === 'l' ? { left: 14 * u, borderLeftWidth: 1.5 } : { right: 14 * u, borderRightWidth: 1.5 },
          ]}
        />
      ))}

      <View style={[styles.contenido, { paddingHorizontal: 34 * u, paddingTop: 40 * u, paddingBottom: 36 * u }]}>
        <View style={styles.cabecera}>
          <Text allowFontScaling={false} style={[styles.marca, t(19, { letterSpacing: 9 * u })]}>NIVL</Text>
          <Text allowFontScaling={false} style={[styles.rotulo, t(9.5, { letterSpacing: 2.6 * u })]}>PARTE DE LA SEMANA</Text>
        </View>

        <View style={styles.identidad}>
          <Avatar size={86 * u} avatarPath={datos.avatarPath} name={datos.name} onReady={onReady} />
          <Text allowFontScaling={false} style={[styles.nombre, t(25, { marginTop: 14 * u, letterSpacing: -0.5 * u })]} numberOfLines={1}>
            {datos.name}
          </Text>
          {datos.equippedTitle ? (
            <Text allowFontScaling={false} style={[styles.titulo, t(10.5, { marginTop: 5 * u, letterSpacing: 2.2 * u })]} numberOfLines={1}>
              « {datos.equippedTitle.toUpperCase()} »
            </Text>
          ) : null}
          <Text allowFontScaling={false} style={[styles.rotulo, t(10, { marginTop: 7 * u, letterSpacing: 2.4 * u })]} numberOfLines={1}>
            {kind.title} · RANGO {rank} · NIVEL {lvl.level}
          </Text>
        </View>

        <View style={styles.heroe}>
          <Text allowFontScaling={false} style={[styles.xp, t(sinXp ? 52 : 66, { lineHeight: 74 * u })]} numberOfLines={1} adjustsFontSizeToFit>
            {sinXp ? `NIVEL ${lvl.level}` : `+${datos.xpSemana.toLocaleString('es-ES')}`}
          </Text>
          <Text allowFontScaling={false} style={[styles.rotuloClaro, t(11, { letterSpacing: 4 * u, marginTop: 2 * u })]}>
            {sinXp ? 'DÍA 1 EN LA ARENA' : 'XP ESTA SEMANA'}
          </Text>
        </View>

        <View>
          <View style={[styles.cifras, { paddingVertical: 16 * u }]}>
            <View style={styles.cifra}>
              <Text allowFontScaling={false} style={[styles.cifraValor, t(24)]}>{pct === null ? `${datos.daysActive}/7` : `${pct} %`}</Text>
              <Text allowFontScaling={false} style={[styles.rotulo, t(8.5, { letterSpacing: 1.8 * u, marginTop: 5 * u })]} numberOfLines={1} adjustsFontSizeToFit>
                {pct === null ? 'DÍAS ACTIVOS' : 'CUMPLIMIENTO'}
              </Text>
            </View>
            <View style={styles.divisor} />
            <View style={styles.cifra}>
              <View style={styles.rachaFila}>
                <Ionicons name="flame" size={17 * u} color={conRacha ? colors.gold : colors.textFaint} />
                <Text allowFontScaling={false} style={[styles.cifraValor, t(24), conRacha && styles.oro]}>{datos.streakDays}</Text>
              </View>
              <Text allowFontScaling={false} style={[styles.rotulo, t(8.5, { letterSpacing: 1.8 * u, marginTop: 5 * u })]} numberOfLines={1} adjustsFontSizeToFit>
                {datos.streakDays === 1 ? 'DÍA DE RACHA' : 'DÍAS DE RACHA'}
              </Text>
            </View>
            {datos.posicion ? (
              <>
                <View style={styles.divisor} />
                <View style={styles.cifra}>
                  <Text allowFontScaling={false} style={[styles.cifraValor, t(24)]}>{datos.posicion.split(' ')[0]}</Text>
                  <Text allowFontScaling={false} style={[styles.rotulo, t(8.5, { letterSpacing: 1.8 * u, marginTop: 5 * u })]} numberOfLines={1} adjustsFontSizeToFit>
                    PUESTO {datos.posicion.split(' ').slice(1).join(' ').toUpperCase()}
                  </Text>
                </View>
              </>
            ) : null}
          </View>
          {pct !== null ? (
            <View style={[styles.pista, { height: 3 * u, marginTop: 12 * u }]}>
              <View style={[styles.relleno, { width: `${Math.max(0, Math.min(100, pct))}%` }]} />
            </View>
          ) : null}
        </View>

        <Text allowFontScaling={false} style={[styles.lema, t(13.5, { letterSpacing: 3 * u })]}>UN 1 % MEJOR CADA DÍA</Text>

        <View style={[styles.llamada, { paddingVertical: 16 * u, paddingHorizontal: 16 * u }]}>
          <Text allowFontScaling={false} style={[styles.rotuloClaro, t(9.5, { letterSpacing: 3 * u })]}>MÍDETE CONMIGO</Text>
          <Text allowFontScaling={false} style={[styles.codigo, t(27, { letterSpacing: 5 * u, marginTop: 8 * u })]}>
            {codigoLegible(datos.friendCode)}
          </Text>
          <Text allowFontScaling={false} style={[styles.web, t(13, { letterSpacing: 2.5 * u, marginTop: 8 * u })]}>{DOMINIO_NIVL}</Text>
        </View>
      </View>
    </View>
  );
}

/**
 * Captura la tarjeta a 1080×1920 y abre el compartir del sistema. Reutilizable:
 * cualquier pantalla que monte una <ShareCardSemana ref={...}> puede llamarla.
 * Devuelve false si el dispositivo no sabe compartir archivos.
 */
export async function compartirSemana(ref: RefObject<View | null>): Promise<boolean> {
  if (!ref.current) throw new Error('La tarjeta todavía no está lista.');
  const uri = await captureRef(ref, { format: 'png', quality: 1, width: SALIDA.width, height: SALIDA.height });
  if (!(await Sharing.isAvailableAsync())) return false;
  await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Mi semana en NIVL', UTI: 'public.png' });
  return true;
}

interface ModalProps {
  visible: boolean;
  datos: DatosSemana | null;
  onClose: () => void;
}

/** Vista previa a pantalla completa + el botón que la saca fuera. */
export function ShareSemanaModal({ visible, datos, onClose }: ModalProps) {
  const lienzo = useRef<View>(null);
  const [ocupado, setOcupado] = useState(false);
  // No se exporta hasta que el retrato es definitivo: si no, el PNG salía con
  // el hexágono vacío cuando la foto aún viajaba.
  // Se recuerda PARA QUÉ datos está lista, no un booleano: cada apertura trae
  // un objeto nuevo y así no hace falta un efecto que lo reinicie (que además
  // correría después del aviso del hijo y lo pisaría).
  const [listaPara, setListaPara] = useState<DatosSemana | null>(null);
  const lista = datos !== null && listaPara === datos;
  const { width, height } = useWindowDimensions();
  // La tarjeta es 9:16 y debajo van dos botones: manda el lado que antes se acabe.
  const ancho = Math.floor(Math.min(width - 56, ((height - 230) * SALIDA.width) / SALIDA.height));

  const compartir = async () => {
    if (ocupado || !lista) return;
    setOcupado(true);
    try {
      const pudo = await compartirSemana(lienzo);
      if (!pudo) Alert.alert('No disponible', 'Este dispositivo no permite compartir archivos.');
    } catch {
      Alert.alert('Error del sistema', 'El sistema no ha podido generar la imagen.');
    } finally {
      setOcupado(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.telon}>
        {datos ? <ShareCardSemana ref={lienzo} datos={datos} width={ancho} onReady={() => setListaPara(datos)} /> : null}
        <View style={{ width: ancho }}>
          <SystemButton
            title="Compartir en redes"
            icon="share-social-outline"
            onPress={compartir}
            loading={ocupado || !lista}
            style={{ marginTop: 16 }}
          />
          <SystemButton title="Cerrar" variant="ghost" onPress={onClose} style={{ marginTop: 4 }} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.bg, overflow: 'hidden' },
  franja: { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: colors.panel },
  marco: { position: 'absolute', borderWidth: 1, borderColor: colors.line },
  esquina: { position: 'absolute', borderColor: colors.accent },
  contenido: { flex: 1, justifyContent: 'space-between' },
  cabecera: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  marca: { fontFamily: fonts.brand, color: colors.accent },
  rotulo: { fontFamily: fonts.heading, color: colors.textFaint, textAlign: 'center' },
  rotuloClaro: { fontFamily: fonts.heading, color: colors.accentText, textAlign: 'center' },
  identidad: { alignItems: 'center' },
  nombre: { fontFamily: fonts.heading, color: colors.text, textAlign: 'center' },
  titulo: { fontFamily: fonts.heading, color: colors.gold, textAlign: 'center' },
  heroe: { alignItems: 'center' },
  xp: { fontFamily: fonts.brand, color: colors.accent, textAlign: 'center' },
  cifras: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.line,
  },
  cifra: { flex: 1, alignItems: 'center', minWidth: 0 },
  cifraValor: { fontFamily: fonts.number, color: colors.text },
  rachaFila: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  oro: { color: colors.gold },
  divisor: { width: 1, alignSelf: 'stretch', backgroundColor: colors.line },
  pista: { backgroundColor: colors.track },
  relleno: { height: '100%', backgroundColor: colors.accent },
  lema: { fontFamily: fonts.number, color: colors.text, textAlign: 'center' },
  llamada: { borderWidth: 1, borderColor: colors.accentDim, alignItems: 'center', backgroundColor: colors.panelDeep },
  codigo: { fontFamily: fonts.brand, color: colors.accent, textAlign: 'center' },
  web: { fontFamily: fonts.heading, color: colors.text, textAlign: 'center' },
  telon: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
});
