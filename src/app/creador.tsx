// NIVL · Panel de creador. Pantalla oculta: solo se llega desde la fila
// "Panel de creador" de Perfil, que solo sale si creator_panel() devuelve algo.
//
// Enseña SOLO el dinero de quien mira: su código, sus cuentas y ventas, lo
// que tiene en retención, lo disponible y lo cobrado. De los demás creadores,
// alias y ventas del mes en el ranking; nunca su dinero (lo garantiza la RPC,
// no esta pantalla). La transferencia la hace el dueño fuera de la app.
//
// "Cuentas", no "instalaciones": sin SDK de atribución no se puede contar
// quién instaló por el enlace; se cuenta quién metió el código.

import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import {
  Alert,
  // Como en Amigos: Clipboard sigue en el núcleo de RN 0.81. Si falla, se cae
  // al compartir del sistema, que también deja copiar.
  Clipboard,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SystemButton } from '@/components/SystemButton';
import {
  Card,
  EmptyState,
  FadeIn,
  Row,
  RowValue,
  Screen,
  ScreenHeader,
  Section,
  Skeleton,
  Stagger,
  Stat,
  StatRow,
} from '@/components/ui';
import {
  enlaceCreador,
  euros,
  fechaPago,
  importe,
  lineaPosicion,
  lineaRango,
  mensajeInvitacionCreador,
  pagoLabel,
  porVentaAnual,
  ventasLabel,
} from '@/lib/creatormath';
import { fetchCreatorBoard, fetchCreatorPanel, type CreatorBoardRow, type CreatorPanel } from '@/lib/creators';
import { colors, fonts } from '@/lib/theme';
import { mensajeSistema } from '@/lib/validation';

export default function Creador() {
  const [panel, setPanel] = useState<CreatorPanel | null>(null);
  const [board, setBoard] = useState<CreatorBoardRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const copiadoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    try {
      const [p, b] = await Promise.all([fetchCreatorPanel(), fetchCreatorBoard()]);
      setPanel(p);
      setBoard(b);
      setError(null);
    } catch (e) {
      setError(mensajeSistema(e));
    } finally {
      setLoaded(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
      return () => {
        if (copiadoTimer.current) clearTimeout(copiadoTimer.current);
      };
    }, [load]),
  );

  const refrescar = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const salir = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/perfil');
  };

  const compartir = async () => {
    if (!panel) return;
    try {
      await Share.share({ message: mensajeInvitacionCreador(panel.code) });
    } catch (e) {
      Alert.alert('Error del sistema', mensajeSistema(e));
    }
  };

  const copiar = () => {
    if (!panel) return;
    try {
      Clipboard.setString(panel.code);
      Haptics.selectionAsync().catch(() => {});
      setCopiado(true);
      if (copiadoTimer.current) clearTimeout(copiadoTimer.current);
      copiadoTimer.current = setTimeout(() => setCopiado(false), 2000);
    } catch {
      compartir();
    }
  };

  if (!loaded) {
    return (
      <Screen>
        <ScreenHeader onBack={salir} eyebrow="Programa de creadores" title="Tu panel" />
        <View accessibilityRole="progressbar" accessibilityLabel="Cargando el panel de creador">
          <Skeleton height={96} style={styles.hueco} />
          <Skeleton height={72} style={styles.hueco} />
          <Skeleton height={72} style={styles.hueco} />
          <Skeleton height={14} width="70%" style={styles.huecoLinea} />
          <Skeleton height={14} width="55%" style={styles.huecoLinea} />
        </View>
      </Screen>
    );
  }

  if (!panel) {
    return (
      <Screen refreshing={refreshing} onRefresh={refrescar}>
        <ScreenHeader onBack={salir} eyebrow="Programa de creadores" title="Tu panel" />
        {error ? (
          <EmptyState
            icon="cloud-offline-outline"
            title="No se ha podido cargar"
            body={error}
            action={{ label: 'Reintentar', onPress: refrescar }}
          />
        ) : (
          <EmptyState
            icon="megaphone-outline"
            title="Este panel es de los creadores"
            body="Tu cuenta no está en el programa de creadores."
            action={{ label: 'Volver', onPress: salir, variant: 'outline' }}
          />
        )}
      </Screen>
    );
  }

  const conClawback = panel.clawbackCents > 0;

  return (
    <Screen refreshing={refreshing} onRefresh={refrescar}>
      <Stagger>
        <FadeIn index={0}>
          <ScreenHeader
            onBack={salir}
            eyebrow="Programa de creadores"
            title={panel.alias}
            subtitle={lineaRango(panel.rank, panel.pct, panel.baseCents)}
          />
        </FadeIn>

        {error ? (
          <FadeIn index={1}>
            <Card variant="outline" accent={colors.red}>
              <Text style={styles.nota}>{error} Lo que ves puede no estar al día.</Text>
            </Card>
          </FadeIn>
        ) : null}

        <FadeIn index={1}>
          <Section title="Tu código">
            <Card>
              <Text style={styles.codigo} selectable accessibilityLabel={`Tu código: ${panel.code}`}>
                {panel.code}
              </Text>
              <Text style={styles.enlace} selectable numberOfLines={1}>
                {enlaceCreador(panel.code)}
              </Text>
              <View style={styles.botones}>
                <SystemButton title="Compartir" icon="share-social-outline" onPress={compartir} style={styles.boton} />
                <SystemButton
                  title={copiado ? 'Copiado' : 'Copiar código'}
                  icon={copiado ? 'checkmark' : 'copy-outline'}
                  variant="outline"
                  onPress={copiar}
                  style={styles.boton}
                />
              </View>
            </Card>
            <Text style={styles.nota}>
              Quien lo escribe en «¿Quién te trajo?» en sus primeros días queda contigo para siempre. El enlace solo
              abre la app si ya la tiene instalada.
            </Text>
          </Section>
        </FadeIn>

        <FadeIn index={2}>
          <Section title="Cuentas y ventas" meta={`Este mes: ${panel.installsMonth} · ${panel.salesMonth}`}>
            <Card>
              <StatRow>
                <Stat value={panel.installs} label="Cuentas con tu código" />
                <Stat value={panel.sales} label="Ventas" />
              </StatRow>
            </Card>
            <Text style={styles.nota}>
              Una venta es una cuenta tuya que paga por primera vez. Por venta anual cobras{' '}
              {porVentaAnual(panel.pct, panel.baseCents)}; en mensual, tu {Math.round(panel.pct)} % de lo que entra cada
              mes hasta llegar a lo mismo.
            </Text>
          </Section>
        </FadeIn>

        <FadeIn index={3}>
          <Section title="Tu dinero">
            <Card>
              <StatRow>
                <Stat value={importe(panel.pendingCents)} unit="€" label="En retención" size="sm" />
                <Stat value={importe(panel.availableCents)} unit="€" label="Disponible" size="sm" tone="accent" />
                <Stat value={importe(panel.paidCents)} unit="€" label="Cobrado" size="sm" />
              </StatRow>
            </Card>
            {conClawback || panel.monthlyFixedCents > 0 ? (
              <Card padded={false} style={styles.lista}>
                {panel.monthlyFixedCents > 0 ? (
                  <Row first title="Fijo mensual" trailing={<RowValue strong>{euros(panel.monthlyFixedCents)}</RowValue>} />
                ) : null}
                {conClawback ? (
                  <Row
                    first={panel.monthlyFixedCents <= 0}
                    title="A descontar"
                    detail="Reembolsos de comisiones ya cobradas"
                    trailing={
                      <RowValue tone="red" strong>
                        −{euros(panel.clawbackCents)}
                      </RowValue>
                    }
                  />
                ) : null}
              </Card>
            ) : null}
            <Text style={styles.nota}>
              Cada comisión espera {panel.holdDays} días por si hay un reembolso; entonces pasa a disponible y se paga en
              la siguiente liquidación. Si la tienda devuelve el dinero, la comisión se anula.
            </Text>
          </Section>
        </FadeIn>

        <FadeIn index={4}>
          <Section title="Ranking del mes">
            <Text style={styles.posicion}>{lineaPosicion(panel.position, panel.creators, panel.salesMonth)}</Text>
            {panel.prize ? (
              <Card variant="outline" accent={colors.gold}>
                <Text style={styles.premioEyebrow}>PREMIO DEL PRIMERO</Text>
                <Text style={styles.premio}>{panel.prize}</Text>
              </Card>
            ) : null}
            {board.length > 0 ? (
              <Card padded={false} style={styles.lista}>
                {board.map((r, i) => (
                  <Row
                    key={`${r.pos}-${r.alias}-${i}`}
                    first={i === 0}
                    leading={<Text style={[styles.puesto, r.isMe && styles.puestoYo]}>{r.pos}</Text>}
                    title={r.isMe ? `${r.alias} · tú` : r.alias}
                    muted={!r.isMe && r.sales === 0}
                    trailing={
                      <RowValue tone={r.isMe ? 'accent' : 'dim'} strong={r.isMe}>
                        {ventasLabel(r.sales)}
                      </RowValue>
                    }
                  />
                ))}
              </Card>
            ) : null}
          </Section>
        </FadeIn>

        <FadeIn index={5}>
          <Section title="Pagos recibidos">
            {panel.payouts.length > 0 ? (
              <Card padded={false} style={styles.lista}>
                {panel.payouts.map((p, i) => (
                  <Row
                    key={`${p.at}-${i}`}
                    first={i === 0}
                    leading={<Ionicons name="cash-outline" size={18} color={colors.text} />}
                    title={pagoLabel(p.kind)}
                    detail={fechaPago(p.at)}
                    trailing={<RowValue strong>{euros(p.cents)}</RowValue>}
                  />
                ))}
              </Card>
            ) : (
              <Card variant="outline">
                <EmptyState
                  compact
                  icon="cash-outline"
                  title="Aún sin pagos"
                  body="Aquí aparece cada liquidación cuando se haga."
                />
              </Card>
            )}
          </Section>
        </FadeIn>
      </Stagger>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hueco: { marginBottom: 14 },
  huecoLinea: { marginBottom: 12 },
  codigo: { fontFamily: fonts.number, fontSize: 30, letterSpacing: 4, color: colors.accent },
  enlace: { fontFamily: fonts.body, fontSize: 13, color: colors.accentText, marginTop: 6 },
  botones: { flexDirection: 'row', gap: 10, marginTop: 16 },
  boton: { flex: 1 },
  lista: { paddingHorizontal: 16, paddingVertical: 2 },
  nota: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.textFaint, marginTop: 4 },
  posicion: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 20, color: colors.text, marginBottom: 10 },
  premioEyebrow: { fontFamily: fonts.heading, fontSize: 11, letterSpacing: 2.5, color: colors.gold, marginBottom: 6 },
  premio: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 20, color: colors.text },
  puesto: { fontFamily: fonts.number, fontSize: 16, color: colors.textDim, minWidth: 22, textAlign: 'center' },
  puestoYo: { color: colors.accent },
});
