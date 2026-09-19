import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  // Clipboard sigue en el núcleo de RN 0.81 (módulo nativo incluido). Está
  // marcado como obsoleto, pero la alternativa es una dependencia nueva y un
  // build nativo solo para copiar ocho letras. Si un día desaparece, `copiar`
  // cae al compartir del sistema, que también deja copiar.
  Clipboard,
  LayoutAnimation,
  Pressable,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Avatar } from '@/components/Avatar';
import { prepararDatosSemana, ShareSemanaModal, type DatosSemana } from '@/components/ShareCardSemana';
import { SystemButton } from '@/components/SystemButton';
import {
  Card,
  Chip,
  ChipWrap,
  EmptyState,
  FadeIn,
  Row,
  RowValue,
  Screen,
  ScreenHeader,
  Section,
  Skeleton,
  SkeletonRows,
  Stagger,
  Tag,
} from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { levelFromXp } from '@/lib/game';
import {
  fetchBoard,
  fetchRequests,
  fetchSocialSelf,
  removeFriend,
  requestFriend,
  respondRequest,
  setSocialVisible,
  type BoardEntry,
  type FriendRequest,
  type SocialSelf,
} from '@/lib/social';
import {
  clasificar,
  codigoLegible,
  DIAS_VENTANA,
  errorDeCodigo,
  etiquetaPosicion,
  formatoValor,
  LARGO_CODIGO,
  lineaRivalidad,
  mensajeInvitacion,
  METRICA_LABEL,
  normalizarCodigo,
  type Metrica,
  type Ventana,
} from '@/lib/socialmath';
import { colors, fonts } from '@/lib/theme';
import { useCountUp } from '@/lib/useCountUp';
import { mensajeSistema } from '@/lib/validation';

const VENTANAS: { key: Ventana; label: string }[] = [
  { key: 'semana', label: 'Semana' },
  { key: 'mes', label: 'Mes' },
];
const METRICAS: Metrica[] = ['xp', 'cumplimiento', 'racha'];


/** La cifra del ranking, que sube (o baja) hasta su valor al cambiar de métrica o de periodo. */
function ValorRanking({ valor, metrica, tone }: { valor: number | null; metrica: Metrica; tone: 'gold' | 'accent' | 'dim' }) {
  const mostrado = useCountUp(valor ?? 0, 600);
  return (
    <RowValue strong tone={tone}>
      {formatoValor(valor === null ? null : mostrado, metrica)}
    </RowValue>
  );
}

export default function Amigos() {
  const { session } = useAuth();
  const userId = session?.user.id;

  const [yo, setYo] = useState<SocialSelf | null>(null);
  const [board, setBoard] = useState<BoardEntry[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [ventana, setVentana] = useState<Ventana>('semana');
  const [metrica, setMetrica] = useState<Metrica>('xp');
  const [cargando, setCargando] = useState(true);
  const [fallo, setFallo] = useState<string | null>(null);
  const [refrescando, setRefrescando] = useState(false);
  // Entre que se toca Semana/Mes y llegan las cifras nuevas, el ranking viejo
  // se atenúa: sin esto el chip cambiaba y la lista no, y parecía roto.
  const [cambiando, setCambiando] = useState(false);

  const [codigo, setCodigo] = useState('');
  const [avisoCodigo, setAvisoCodigo] = useState<{ texto: string; error: boolean } | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [ocupada, setOcupada] = useState<string | null>(null);

  const [tarjeta, setTarjeta] = useState<DatosSemana | null>(null);
  const [preparando, setPreparando] = useState(false);
  const lock = useRef(false);
  // La ventana pedida más reciente: si tocas Semana → Mes → Semana deprisa, la
  // respuesta lenta de "Mes" no debe pisar la de "Semana".
  const ventanaViva = useRef<Ventana>('semana');
  const hayRanking = useRef(false);

  const load = useCallback(
    async (v: Ventana) => {
      if (!userId) return;
      ventanaViva.current = v;
      try {
        const [self, filas, pendientes] = await Promise.all([
          fetchSocialSelf(userId),
          fetchBoard(DIAS_VENTANA[v]),
          fetchRequests(),
        ]);
        if (ventanaViva.current !== v) return;
        // Si el orden cambia con los datos nuevos, las filas se recolocan con
        // una transición. En la primera carga no hay nada que mover.
        if (hayRanking.current) LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        hayRanking.current = true;
        setYo(self);
        setBoard(filas);
        setRequests(pendientes);
        setFallo(null);
      } catch (e) {
        setFallo(mensajeSistema(e));
      } finally {
        setCargando(false);
        if (ventanaViva.current === v) setCambiando(false);
      }
    },
    [userId],
  );

  useFocusEffect(
    useCallback(() => {
      load(ventana);
    }, [load, ventana]),
  );

  const refrescar = async () => {
    setRefrescando(true);
    await load(ventana);
    setRefrescando(false);
  };

  const visibles = useMemo(() => board.filter((b) => b.visible), [board]);
  const ocultos = useMemo(() => board.filter((b) => !b.visible && !b.isMe), [board]);
  const ranking = useMemo(() => clasificar(visibles, metrica), [visibles, metrica]);
  const numAmigos = board.filter((b) => !b.isMe).length;

  const elegirVentana = (v: Ventana) => {
    if (v === ventana) return;
    Haptics.selectionAsync().catch(() => {});
    setCambiando(true);
    setVentana(v);
  };
  const elegirMetrica = (m: Metrica) => {
    if (m === metrica) return;
    Haptics.selectionAsync().catch(() => {});
    // Otro criterio, otro orden: las filas se recolocan, no saltan.
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setMetrica(m);
  };
  const entrantes = requests.filter((r) => r.direction === 'incoming');
  const salientes = requests.filter((r) => r.direction === 'outgoing');

  // ── Mi código ─────────────────────────────────────────────────────
  const invitar = async () => {
    if (!yo) return;
    try {
      await Share.share({ message: mensajeInvitacion(yo.friendCode) });
    } catch (e) {
      Alert.alert('Error del sistema', mensajeSistema(e));
    }
  };

  const copiar = () => {
    if (!yo) return;
    try {
      Clipboard.setString(yo.friendCode);
      Haptics.selectionAsync();
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      invitar();
    }
  };

  // ── Añadir por código ─────────────────────────────────────────────
  const enviar = async () => {
    if (lock.current) return;
    // Se valida aquí antes de llamar: el servidor cuenta cada intento (30/hora)
    // y un dedo torpe no debería gastarlos.
    const problema = errorDeCodigo(codigo, yo?.friendCode);
    if (problema) {
      setAvisoCodigo({ texto: problema, error: true });
      return;
    }
    lock.current = true;
    setEnviando(true);
    setAvisoCodigo(null);
    try {
      const r = await requestFriend(normalizarCodigo(codigo));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setCodigo('');
      setAvisoCodigo({
        texto:
          r.status === 'accepted'
            ? `${r.name} ya te había buscado. Ya sois rivales.`
            : `Solicitud enviada a ${r.name}. Falta su respuesta.`,
        error: false,
      });
      await load(ventana);
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      // Los errores de negocio (código desconocido, ya sois amigos, tope) llegan
      // como ErrorVisible y pasan tal cual; lo demás, con la voz del sistema.
      setAvisoCodigo({ texto: mensajeSistema(e), error: true });
    } finally {
      lock.current = false;
      setEnviando(false);
    }
  };

  // ── Solicitudes ───────────────────────────────────────────────────
  const responder = async (r: FriendRequest, aceptar: boolean) => {
    if (lock.current) return;
    lock.current = true;
    setOcupada(r.friendshipId);
    try {
      await respondRequest(r.friendshipId, aceptar);
      if (aceptar) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await load(ventana);
    } catch (e) {
      Alert.alert('Error del sistema', mensajeSistema(e));
    } finally {
      lock.current = false;
      setOcupada(null);
    }
  };

  const quitar = (friendshipId: string, titulo: string, cuerpo: string, accion: string) => {
    Alert.alert(titulo, cuerpo, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: accion,
        style: 'destructive',
        onPress: async () => {
          if (lock.current) return;
          lock.current = true;
          try {
            await removeFriend(friendshipId);
            await load(ventana);
          } catch (e) {
            Alert.alert('Error del sistema', mensajeSistema(e));
          } finally {
            lock.current = false;
          }
        },
      },
    ]);
  };

  const quitarAmigo = (b: BoardEntry) => {
    if (!b.friendshipId) return;
    quitar(
      b.friendshipId,
      'Quitar amigo',
      `${b.name} saldrá de tu ranking y tú del suyo. Para volver hará falta otra solicitud.`,
      'Quitar',
    );
  };

  // ── Privacidad ────────────────────────────────────────────────────
  const cambiarVisible = async (visible: boolean) => {
    if (!userId || !yo) return;
    const antes = yo;
    setYo({ ...yo, socialVisible: visible });
    try {
      await setSocialVisible(userId, visible);
    } catch (e) {
      setYo(antes);
      Alert.alert('Error del sistema', mensajeSistema(e));
    }
  };

  // ── Compartir la semana ───────────────────────────────────────────
  // La tarjeta es SIEMPRE de los últimos 7 días y por XP, mire lo que mire el
  // ranking: si está en "Mes" se pide la semana aparte en vez de rotular como
  // semanal una cifra de treinta días.
  const abrirTarjeta = async () => {
    if (!yo || !userId || preparando) return;
    setPreparando(true);
    try {
      setTarjeta(
        await prepararDatosSemana(userId, {
          semana: ventana === 'semana' ? board : undefined,
          friendCode: yo.friendCode,
        }),
      );
    } catch (e) {
      Alert.alert('Error del sistema', mensajeSistema(e));
    } finally {
      setPreparando(false);
    }
  };

  const subtitulo =
    numAmigos === 0
      ? 'Nadie mejora igual cuando alguien le mira el marcador.'
      : `${numAmigos} ${numAmigos === 1 ? 'rival' : 'rivales'} en tu arena${entrantes.length > 0 ? ` · ${entrantes.length} por responder` : ''}.`;

  return (
    <Screen refreshing={refrescando} onRefresh={refrescar}>
      <Stagger>
        <FadeIn index={0}>
          <ScreenHeader
            onBack={() => router.back()}
            eyebrow="Arena"
            title="Amigos"
            subtitle={subtitulo}
            action={yo ? { icon: 'share-social-outline', label: 'Compartir mi semana', onPress: abrirTarjeta } : undefined}
          />
        </FadeIn>

        {cargando ? (
          <View accessibilityLabel="Cargando la arena" accessibilityRole="progressbar">
            <Skeleton height={168} style={styles.huecoTarjeta} />
            <Skeleton height={11} width={150} style={styles.huecoRotulo} />
            <Skeleton height={50} style={styles.huecoTarjeta} />
            <Skeleton height={11} width={90} style={styles.huecoRotulo} />
            <SkeletonRows rows={4} />
          </View>
        ) : fallo && !yo ? (
          <Card variant="outline" accent={colors.redDim}>
            <EmptyState
              compact
              icon="cloud-offline-outline"
              title="La arena no responde"
              body={fallo}
              action={{ label: 'Reintentar', onPress: refrescar }}
            />
          </Card>
        ) : yo ? (
          <>
            {fallo ? (
              <Card variant="outline" accent={colors.redDim}>
                <Text style={styles.falloLinea} accessibilityRole="alert">
                  No se ha podido actualizar: {fallo}
                </Text>
              </Card>
            ) : null}

            <FadeIn index={1}>
              <Card>
                <Text style={styles.eyebrow}>Tu código</Text>
                <Text
                  style={styles.codigo}
                  selectable
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  accessibilityLabel={`Tu código de amigo: ${yo.friendCode.split('').join(' ')}`}
                >
                  {codigoLegible(yo.friendCode)}
                </Text>
                <Text style={styles.hint}>
                  Quien lo tenga puede pedirte amistad. Verá tu nivel, tu racha y tu cumplimiento; nunca tu salud, tu
                  dinero ni tu diario.
                </Text>
                <View style={styles.botones}>
                  <View style={styles.boton}>
                    <SystemButton
                      title={copiado ? 'Copiado' : 'Copiar'}
                      icon={copiado ? 'checkmark' : 'copy-outline'}
                      variant="outline"
                      onPress={copiar}
                    />
                  </View>
                  <View style={styles.boton}>
                    {/* Un sólido por pantalla: sin amigos, el sólido es "Invitar al
                        primero" del ranking vacío y este baja a contorno. */}
                    <SystemButton
                      title="Invitar"
                      icon="paper-plane-outline"
                      variant={numAmigos === 0 ? 'outline' : 'solid'}
                      onPress={invitar}
                    />
                  </View>
                </View>
              </Card>
            </FadeIn>

            <FadeIn index={2}>
              <Section title="Añadir por código">
                <View style={styles.anadirFila}>
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    value={codigo}
                    onChangeText={(v) => {
                      setCodigo(normalizarCodigo(v));
                      setAvisoCodigo(null);
                    }}
                    placeholder="ABCD2345"
                    placeholderTextColor={colors.textFaint}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    maxLength={LARGO_CODIGO}
                    returnKeyType="send"
                    onSubmitEditing={enviar}
                    accessibilityLabel="Código de amigo, ocho caracteres"
                  />
                  <SystemButton
                    title="Enviar"
                    variant="outline"
                    onPress={enviar}
                    loading={enviando}
                    disabled={codigo.length === 0}
                  />
                </View>
                {avisoCodigo ? (
                  <Text
                    style={[styles.aviso, avisoCodigo.error && styles.avisoError]}
                    accessibilityRole={avisoCodigo.error ? 'alert' : undefined}
                    accessibilityLiveRegion="polite"
                  >
                    {avisoCodigo.texto}
                  </Text>
                ) : null}
              </Section>
            </FadeIn>

            {requests.length > 0 ? (
              <FadeIn index={3}>
                <Section title="Solicitudes" meta={entrantes.length > 0 ? `${entrantes.length}` : undefined}>
                  <Card padded={false} style={styles.lista}>
                    {entrantes.map((r, i) => (
                      <Row
                        key={r.friendshipId}
                        first={i === 0}
                        leading={<Ionicons name="person-add-outline" size={18} color={colors.accent} />}
                        title={r.name}
                        detail={`Nivel ${r.level} · quiere medirse contigo`}
                        // Aceptar a la derecha y rechazar como un aspa: dos chips
                        // con texto dejaban al nombre en dos letras a 375 px.
                        trailing={
                          ocupada === r.friendshipId ? (
                            <ActivityIndicator size="small" color={colors.accent} />
                          ) : (
                            <View style={styles.respuestas}>
                              <Chip
                                label="Aceptar"
                                small
                                selected
                                onPress={() => responder(r, true)}
                                accessibilityLabel={`Aceptar la solicitud de ${r.name}`}
                              />
                              <Pressable
                                onPress={() => responder(r, false)}
                                hitSlop={10}
                                style={({ pressed }) => [styles.rechazar, pressed && styles.pulsado]}
                                accessibilityRole="button"
                                accessibilityLabel={`Rechazar la solicitud de ${r.name}`}
                              >
                                <Ionicons name="close" size={18} color={colors.textDim} />
                              </Pressable>
                            </View>
                          )
                        }
                      />
                    ))}
                    {salientes.map((r, i) => (
                      <Row
                        key={r.friendshipId}
                        first={entrantes.length === 0 && i === 0}
                        leading={<Ionicons name="hourglass-outline" size={18} color={colors.textFaint} />}
                        title={r.name}
                        muted
                        detail={`Nivel ${r.level} · esperando su respuesta`}
                        trailing={
                          <Chip
                            label="Retirar"
                            small
                            onPress={() =>
                              quitar(r.friendshipId, 'Retirar solicitud', `${r.name} dejará de verla.`, 'Retirar')
                            }
                            accessibilityLabel={`Retirar la solicitud enviada a ${r.name}`}
                          />
                        }
                      />
                    ))}
                  </Card>
                </Section>
              </FadeIn>
            ) : null}

            <FadeIn index={4}>
              <Section title="Ranking" meta={numAmigos > 0 ? `${visibles.length}` : undefined}>
                {numAmigos === 0 ? (
                  <Card variant="outline">
                    <EmptyState
                      icon="people-outline"
                      title="Tu arena está vacía"
                      body="A solas se afloja. Con un rival mirando, el día que ibas a saltarte se cumple. Pásale tu código a quien te apriete de verdad: basta uno."
                      action={{ label: 'Invitar al primero', onPress: invitar, variant: 'solid' }}
                    />
                  </Card>
                ) : (
                  <>
                    <View style={styles.segmento} accessibilityRole="radiogroup" accessibilityLabel="Periodo del ranking">
                      {VENTANAS.map((v) => (
                        <Chip
                          key={v.key}
                          label={v.label}
                          selected={ventana === v.key}
                          onPress={() => elegirVentana(v.key)}
                          style={styles.segmentoChip}
                          accessibilityLabel={`Ranking de ${v.key === 'semana' ? 'los últimos 7 días' : 'los últimos 30 días'}`}
                        />
                      ))}
                    </View>
                    <ChipWrap style={styles.metricas}>
                      {METRICAS.map((m) => (
                        <Chip
                          key={m}
                          label={METRICA_LABEL[m]}
                          small
                          tone={m === 'racha' ? 'gold' : 'accent'}
                          selected={metrica === m}
                          onPress={() => elegirMetrica(m)}
                          accessibilityLabel={`Ordenar por ${METRICA_LABEL[m]}`}
                        />
                      ))}
                    </ChipWrap>

                    <Text style={styles.rivalidad} accessibilityLiveRegion="polite">
                      {lineaRivalidad(ranking, metrica, ventana)}
                    </Text>

                    <Card padded={false} style={[styles.lista, cambiando && styles.atenuado]}>
                      {ranking.map((c, i) => {
                        const b = c.competidor;
                        const nivel = levelFromXp(b.xpTotal).level;
                        const valor = formatoValor(c.valor, metrica);
                        return (
                          <Row
                            key={b.userId}
                            first={i === 0}
                            style={b.isMe ? styles.miFila : undefined}
                            leading={
                              <View style={styles.puesto}>
                                <Text style={[styles.puestoTexto, c.posicion === 1 && c.valor !== null && styles.oro]}>
                                  {c.valor === null ? '—' : etiquetaPosicion(c.posicion)}
                                </Text>
                                <Avatar size={38} avatarPath={b.avatarPath} name={b.name} />
                              </View>
                            }
                            title={b.isMe ? `${b.name} · tú` : b.name}
                            detail={
                              <View style={styles.detalle}>
                                <Text style={styles.detalleTexto} numberOfLines={1}>
                                  Nivel {nivel}
                                  {metrica !== 'racha' && b.streakDays > 0 ? ` · racha ${b.streakDays}` : ''}
                                </Text>
                                {b.equippedTitle ? <Tag tone="gold">{b.equippedTitle}</Tag> : null}
                              </View>
                            }
                            trailing={
                              <ValorRanking
                                valor={c.valor}
                                metrica={metrica}
                                tone={metrica === 'racha' && (c.valor ?? 0) > 0 ? 'gold' : b.isMe ? 'accent' : 'dim'}
                              />
                            }
                            onLongPress={b.isMe ? undefined : () => quitarAmigo(b)}
                            accessibilityLabel={`${c.valor === null ? 'Sin puesto' : `Puesto ${c.posicion}`}. ${b.isMe ? 'Tú' : b.name}, nivel ${nivel}, ${valor}.${b.isMe ? '' : ' Mantén pulsado para quitar.'}`}
                          />
                        );
                      })}
                    </Card>
                    <Text style={styles.hint}>
                      {metrica === 'xp'
                        ? 'XP ganado con misiones en el periodo. Las de penalización no cuentan: recuperar no es adelantar.'
                        : metrica === 'cumplimiento'
                          ? 'Misiones cumplidas sobre programadas. Lo de hoy solo suma cuando lo cumples.'
                          : 'Días seguidos cerrados. Es la única cifra que no depende del periodo.'}{' '}
                      Mantén pulsado a alguien para quitarle.
                    </Text>
                    <SystemButton
                      title="Compartir mi semana"
                      icon="share-social-outline"
                      variant="outline"
                      onPress={abrirTarjeta}
                      loading={preparando}
                      style={{ marginTop: 14 }}
                    />
                  </>
                )}
              </Section>
            </FadeIn>

            {ocultos.length > 0 ? (
              <FadeIn index={5}>
                <Section title="Fuera del ranking" meta={`${ocultos.length}`}>
                  <Card padded={false} style={styles.lista}>
                    {ocultos.map((b, i) => (
                      <Row
                        key={b.userId}
                        first={i === 0}
                        leading={<Ionicons name="eye-off-outline" size={18} color={colors.textFaint} />}
                        title={b.name}
                        muted
                        detail="Ha ocultado su marcador. Sigue siendo tu amigo."
                        onLongPress={() => quitarAmigo(b)}
                        accessibilityLabel={`${b.name}, fuera del ranking. Mantén pulsado para quitar.`}
                      />
                    ))}
                  </Card>
                </Section>
              </FadeIn>
            ) : null}

            <FadeIn index={6}>
              <Section title="Privacidad">
                <Card padded={false} style={styles.lista}>
                  <Row
                    first
                    leading={<Ionicons name={yo.socialVisible ? 'eye-outline' : 'eye-off-outline'} size={18} color={colors.textDim} />}
                    title="Aparecer en los rankings"
                    detail={
                      yo.socialVisible
                        ? 'Tus amigos ven tu nivel, tu racha, tu XP del periodo y tu cumplimiento. Nada más.'
                        : 'Estás fuera: tus amigos no ven tus cifras ni tu retrato. Tú sigues viendo las suyas.'
                    }
                    trailing={
                      <Switch
                        value={yo.socialVisible}
                        onValueChange={cambiarVisible}
                        trackColor={{ false: colors.track, true: colors.accentDim }}
                        thumbColor={yo.socialVisible ? colors.accent : colors.textFaint}
                        ios_backgroundColor={colors.track}
                        accessibilityLabel="Aparecer en los rankings de tus amigos"
                      />
                    }
                  />
                </Card>
              </Section>
            </FadeIn>
          </>
        ) : null}
      </Stagger>

      <ShareSemanaModal visible={tarjeta !== null} datos={tarjeta} onClose={() => setTarjeta(null)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  lista: { paddingHorizontal: 16, paddingVertical: 2 },
  huecoTarjeta: { marginBottom: 26 },
  huecoRotulo: { marginBottom: 12 },
  atenuado: { opacity: 0.45 },
  rechazar: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.line },
  pulsado: { opacity: 0.6 },
  falloLinea: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.redText },
  eyebrow: {
    fontFamily: fonts.heading,
    fontSize: 11,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    color: colors.textFaint,
  },
  codigo: {
    fontFamily: fonts.brand,
    fontSize: 38,
    letterSpacing: 6,
    color: colors.accent,
    marginTop: 10,
  },
  hint: { fontFamily: fonts.body, fontSize: 12, color: colors.textFaint, marginTop: 10, lineHeight: 17 },
  botones: { flexDirection: 'row', gap: 8, marginTop: 16 },
  boton: { flex: 1 },
  anadirFila: { flexDirection: 'row', gap: 8, alignItems: 'stretch' },
  input: {
    borderWidth: 1,
    borderColor: colors.accentDim,
    backgroundColor: colors.bg,
    color: colors.text,
    fontFamily: fonts.number,
    fontSize: 17,
    letterSpacing: 3,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  aviso: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.accentText, marginTop: 10 },
  avisoError: { color: colors.red },
  respuestas: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  segmento: { flexDirection: 'row', gap: 8 },
  segmentoChip: { flex: 1, justifyContent: 'center' },
  metricas: { marginTop: 10 },
  rivalidad: {
    fontFamily: fonts.semibold,
    fontSize: 14.5,
    lineHeight: 21,
    color: colors.text,
    marginTop: 16,
    marginBottom: 12,
  },
  // Mi fila: un fondo un punto más claro que sangra hasta los bordes de la
  // tarjeta (la lista lleva 16 de padding) y un filo blanco a la izquierda.
  miFila: {
    backgroundColor: colors.accentFaint,
    marginHorizontal: -16,
    paddingHorizontal: 14,
    borderLeftWidth: 2,
    borderLeftColor: colors.accent,
  },
  puesto: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  puestoTexto: { width: 30, fontFamily: fonts.number, fontSize: 13, color: colors.textDim },
  oro: { color: colors.gold },
  detalle: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  detalleTexto: { fontFamily: fonts.body, fontSize: 12.5, color: colors.textFaint },
});
