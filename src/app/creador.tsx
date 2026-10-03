// NIVL · Panel de creador. Pantalla oculta: solo se llega desde la fila
// "Panel de creador" de Perfil, que solo sale si creator_panel() devuelve algo.
//
// Lo que se pinta sale de `vistaPanelCreador` (creatorprogram.ts, SISTEMA
// §10 bis). En la app de tienda (iOS/Android) NO hay dinero: rango y progreso,
// código, cuentas y ventas, retos, tabla e histórico de ventas, y una línea de
// texto plano que dice dónde se gestionan las ganancias (sin botón ni enlace).
// Fuera de tienda (web) se añade el dinero propio: retención, disponible,
// cobrado, fijo, reembolsos y pagos. De los demás creadores, alias y ventas;
// nunca su dinero (lo garantiza la RPC, no esta pantalla).
//
// En el portal de creadores (creadores.nivl.app, `src/lib/sitio.ts`) es la
// única pantalla con sesión: sin flecha de volver y con «Cerrar sesión» a la
// vista (R2 del Chat 3). Al cerrar se borra el estado del panel antes de soltar
// la sesión, y la puerta del layout lleva al login.
//
// "Cuentas", no "instalaciones": sin SDK de atribución no se puede contar
// quién instaló por el enlace; se cuenta quién metió el código.

import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import {
  // Como en Amigos: Clipboard sigue en el núcleo de RN 0.81. Si falla, se cae
  // al compartir del sistema, que también deja copiar.
  Clipboard,
  Platform,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  avisar,
  Button,
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
  Tag,
} from '@/components/ui';
import { vibrar } from '@/design/haptics';
import { cerrarSoloSesion } from '@/lib/authFlow';
import { ink, space, stroke, type as tipo } from '@/design/tokens';
import {
  estadoReto,
  euros,
  fechaPago,
  importe,
  lineaPosicion,
  lineaRango,
  mensajeInvitacionCreador,
  pagoLabel,
  porVentaAnual,
  rangoLabel,
  ventasLabel,
} from '@/lib/creatormath';
import {
  vistaPanelCreador,
  type PanelCreadorVista,
  type PanelCreadorWeb,
  type RetoVista,
} from '@/lib/creatorprogram';
import {
  fetchCreatorBoard,
  fetchCreatorBoardPeriod,
  fetchCreatorHistory,
  fetchCreatorPanel,
  fetchCreatorProgress,
  type CreatorPanel,
} from '@/lib/creators';
import { SITIO_CREADORES } from '@/lib/sitio';
import { mensajeSistema } from '@/lib/validation';

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'];

/** «Creador novato» → «Novato»: el rol ya va delante en el subtítulo. */
function rangoSinRol(label: string): string {
  const r = label.replace(/^creador\s+/i, '');
  return r.charAt(0).toUpperCase() + r.slice(1);
}

/** 'AAAA-MM' → «sept 2026». */
function mesLabel(month: string): string {
  const [a, m] = month.split('-');
  const i = Number(m) - 1;
  return MESES[i] ? `${MESES[i]} ${a}` : month;
}

export default function Creador() {
  const [vista, setVista] = useState<PanelCreadorVista | null>(null);
  // El panel en bruto solo lo usa la rama web (días de retención).
  const [panel, setPanel] = useState<CreatorPanel | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [cerrando, setCerrando] = useState(false);
  const copiadoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    try {
      // La tabla es accesoria: sin ella el panel sale igual (vacía).
      const [p, board] = await Promise.all([fetchCreatorPanel(), fetchCreatorBoard().catch(() => [])]);
      // Lo de la 0046 es accesorio: si falla, el panel sale igual con lo de la 0025.
      const [progreso, historico, tabla] = await Promise.all([
        fetchCreatorProgress().catch(() => null),
        fetchCreatorHistory(12).catch(() => []),
        fetchCreatorBoardPeriod('mes').catch(() => null),
      ]);
      setPanel(p);
      setVista(vistaPanelCreador(Platform.OS, { panel: p, progreso, historico, tabla: tabla ?? board }));
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

  // Portal: sin flecha (no hay adónde volver) y con salida de la cuenta.
  const volver = SITIO_CREADORES ? undefined : salir;
  const cerrarSesion = async () => {
    if (cerrando) return;
    setCerrando(true);
    setVista(null);
    setPanel(null);
    setError(null);
    try {
      // Solo este navegador: la sesión de la app en el móvil sigue abierta.
      await cerrarSoloSesion('local');
    } finally {
      setCerrando(false);
    }
  };
  const accionSesion = SITIO_CREADORES
    ? { icon: 'log-out-outline' as const, label: 'Cerrar sesión', onPress: cerrarSesion }
    : undefined;
  const pieSesion = SITIO_CREADORES ? (
    <Button
      title="Cerrar sesión"
      icon="log-out-outline"
      variant="secondary"
      onPress={cerrarSesion}
      loading={cerrando}
      style={styles.salirPortal}
    />
  ) : null;

  const compartir = async () => {
    if (!vista?.code) return;
    try {
      await Share.share({ message: mensajeInvitacionCreador(vista.code) });
    } catch (e) {
      avisar('Error del sistema', mensajeSistema(e));
    }
  };

  const copiar = () => {
    if (!vista?.code) return;
    try {
      Clipboard.setString(vista.code);
      vibrar('seleccion');
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
        <ScreenHeader onBack={volver} action={accionSesion} eyebrow="Programa de creadores" title="Tu panel" />
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

  if (!vista) {
    return (
      <Screen refreshing={refreshing} onRefresh={refrescar}>
        <ScreenHeader onBack={volver} action={accionSesion} eyebrow="Programa de creadores" title="Tu panel" />
        {error ? (
          <EmptyState
            icon="cloud-offline-outline"
            title="El sistema no responde"
            body={error}
            action={{ label: 'Reintentar', onPress: refrescar }}
          />
        ) : SITIO_CREADORES ? (
          // Neutro: no dice nada de la cuenta más allá de que no tiene panel.
          <EmptyState
            icon="megaphone-outline"
            title="Este panel es para creadores del programa"
            body="Con esta cuenta no hay panel que mostrar."
          />
        ) : (
          <EmptyState
            icon="megaphone-outline"
            title="Este panel es de los creadores"
            body="Tu cuenta no está en el programa de creadores."
            action={{ label: 'Volver', onPress: salir, variant: 'outline' }}
          />
        )}
        {pieSesion}
      </Screen>
    );
  }

  const web: PanelCreadorWeb | null = vista.conImportes ? vista : null;
  const subtitulo = web ? lineaRango(web.rank, web.pct, web.baseCents) : `${vista.rolLabel} · ${rangoSinRol(vista.rangoLabel)}`;

  return (
    <Screen refreshing={refreshing} onRefresh={refrescar}>
      <Stagger>
        <FadeIn index={0}>
          <ScreenHeader
            onBack={volver}
            action={accionSesion}
            eyebrow="Programa de creadores"
            title={vista.alias || vista.code}
            subtitle={subtitulo}
          />
        </FadeIn>

        {error ? (
          <FadeIn index={1}>
            <Card variant="alerta">
              <Text style={styles.textoAviso}>{error} Lo que ves puede no estar al día.</Text>
            </Card>
          </FadeIn>
        ) : null}

        <FadeIn index={1}>
          <Section title="Tu código">
            <Card>
              <Text style={styles.codigo} selectable accessibilityLabel={`Tu código: ${vista.code}`}>
                {vista.code}
              </Text>
              <Text style={styles.enlace} selectable numberOfLines={1}>
                {vista.enlace}
              </Text>
              <View style={styles.botones}>
                <Button title="Compartir" icon="share-social-outline" onPress={compartir} style={styles.boton} />
                <Button
                  title={copiado ? 'Copiado' : 'Copiar código'}
                  icon={copiado ? 'checkmark' : 'copy-outline'}
                  variant="secondary"
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
          <ProgresoRango vista={vista} />
        </FadeIn>

        <FadeIn index={3}>
          <Section title="Cuentas y ventas">
            <Card>
              <StatRow>
                <Stat value={vista.installs} label="Cuentas con tu código" style={styles.celda} />
                <Stat value={vista.sales} label="Ventas" style={styles.celda} />
              </StatRow>
              <StatRow style={styles.filaMes}>
                <Stat value={vista.installsMonth} label="Cuentas este mes" size="sm" style={styles.celda} />
                <Stat value={vista.salesMonth} label="Ventas este mes" size="sm" style={styles.celda} />
              </StatRow>
            </Card>
            <Text style={styles.nota}>Una venta es una cuenta tuya que paga por primera vez.</Text>
            {web ? (
              <Text style={styles.nota}>
                Por venta anual cobras {porVentaAnual(web.pct, web.baseCents)}; en mensual, tu {Math.round(web.pct)} % de lo
                que entra cada mes hasta llegar a lo mismo.
              </Text>
            ) : null}
          </Section>
        </FadeIn>

        {web ? (
          <FadeIn index={4}>
            <DineroWeb web={web} holdDays={panel?.holdDays ?? 0} />
          </FadeIn>
        ) : null}

        {vista.retos.length > 0 ? (
          <FadeIn index={5}>
            <Section title="Retos" meta={`${vista.retos.length}`}>
              {vista.retos.map((r) => (
                <RetoCard key={r.id} reto={r} />
              ))}
            </Section>
          </FadeIn>
        ) : null}

        <FadeIn index={6}>
          <Section title="Tabla del mes">
            <Text style={styles.posicion}>{lineaPosicion(vista.position, vista.creators, vista.salesMonth)}</Text>
            {web?.prize ? (
              <Card variant="logro">
                <Text style={styles.premioEyebrow}>PREMIO DEL PRIMERO</Text>
                <Text style={styles.premio}>{web.prize}</Text>
              </Card>
            ) : null}
            {vista.tabla.length > 0 ? (
              <Card padded={false} style={styles.lista}>
                {vista.tabla.map((r, i) => (
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

        {vista.historico.length > 0 ? (
          <FadeIn index={7}>
            <Section title="Ventas por mes">
              <Card padded={false} style={styles.lista}>
                {vista.historico.map((h, i) => (
                  <Row
                    key={h.month}
                    first={i === 0}
                    title={mesLabel(h.month)}
                    muted={h.sales === 0}
                    trailing={<RowValue strong={h.sales > 0}>{ventasLabel(h.sales)}</RowValue>}
                  />
                ))}
              </Card>
            </Section>
          </FadeIn>
        ) : null}

        {web ? (
          <FadeIn index={8}>
            <PagosWeb web={web} />
          </FadeIn>
        ) : (
          // Texto plano: ni botón ni enlace (dictamen de tiendas, SISTEMA §10 bis).
          <Text style={styles.aviso}>{vista.aviso}</Text>
        )}
        {pieSesion}
      </Stagger>
    </Screen>
  );
}

/** Rango y progreso hacia el siguiente: ventas de 90 días, sin dinero. */
function ProgresoRango({ vista }: { vista: PanelCreadorVista }) {
  const p = vista.progreso;
  const meses = vista.monthsActive;
  return (
    <Section title="Tu rango" meta={vista.rangoLabel}>
      <Card>
        <StatRow>
          <Stat value={vista.sales90d} label="Ventas en 90 días" size="sm" />
          <Stat value={meses} label={meses === 1 ? 'Mes seguido' : 'Meses seguidos'} size="sm" />
        </StatRow>
        {p.siguiente && p.umbral != null ? (
          <>
            <Barra
              fraccion={p.fraccion}
              etiqueta={`Hacia ${rangoLabel(p.siguiente)}`}
              ventas={vista.sales90d}
              meta={p.umbral}
            />
            <Text style={styles.lineaProgreso}>
              {p.faltan
                ? `${rangoLabel(p.siguiente)}: ${p.umbral} ventas en 90 días. Te faltan ${p.faltan}.`
                : `Cumples lo de ${rangoLabel(p.siguiente)}. El cambio de rango lo aplica el equipo.`}
            </Text>
          </>
        ) : (
          <Text style={styles.lineaProgreso}>No hay un rango por encima con regla fijada.</Text>
        )}
      </Card>
    </Section>
  );
}

/** Barra de progreso B/N: pista ink3, relleno ink10. Sin porcentajes en el estilo. */
function Barra({ fraccion, etiqueta, ventas, meta }: { fraccion: number; etiqueta: string; ventas: number; meta: number }) {
  const f = Math.max(0, Math.min(1, fraccion));
  return (
    <View
      style={styles.pista}
      accessibilityRole="progressbar"
      accessibilityLabel={etiqueta}
      accessibilityValue={{ text: `${ventas} de ${meta} ventas` }}
    >
      <View style={[styles.relleno, { flex: f }]} />
      <View style={{ flex: 1 - f }} />
    </View>
  );
}

function RetoCard({ reto }: { reto: RetoVista }) {
  const e = estadoReto(reto, reto.sales);
  return (
    <Card>
      <View style={styles.retoCabeza}>
        <Text style={styles.retoTitulo} numberOfLines={2}>
          {reto.title}
        </Text>
        {e.fase === 'cumplido' ? <Tag tone="logro">Cumplido</Tag> : null}
      </View>
      {reto.description ? <Text style={styles.retoTexto}>{reto.description}</Text> : null}
      <Text style={styles.retoCifra}>
        {reto.sales}/{reto.goalSales} ventas
      </Text>
      <Barra fraccion={e.fraccion} etiqueta={`Reto ${reto.title}`} ventas={reto.sales} meta={reto.goalSales} />
      <Text style={styles.retoTexto}>{e.linea}</Text>
      {reto.prize ? <Text style={styles.retoPremio}>Premio: {reto.prize}</Text> : null}
    </Card>
  );
}

// ── Solo web (conImportes): el dinero propio ────────────────────────

function DineroWeb({ web, holdDays }: { web: PanelCreadorWeb; holdDays: number }) {
  const conClawback = web.clawbackCents > 0;
  return (
    <Section title="Tu dinero">
      <Card>
        <StatRow>
          <Stat value={importe(web.pendingCents)} unit="€" label="En retención" size="sm" />
          <Stat value={importe(web.availableCents)} unit="€" label="Disponible" size="sm" tone="accent" />
          <Stat value={importe(web.paidCents)} unit="€" label="Cobrado" size="sm" />
        </StatRow>
      </Card>
      {conClawback || web.monthlyFixedCents > 0 ? (
        <Card padded={false} style={styles.lista}>
          {web.monthlyFixedCents > 0 ? (
            <Row first title="Fijo mensual" trailing={<RowValue strong>{euros(web.monthlyFixedCents)}</RowValue>} />
          ) : null}
          {conClawback ? (
            <Row
              first={web.monthlyFixedCents <= 0}
              title="A descontar"
              detail="Reembolsos de comisiones ya cobradas"
              trailing={
                <RowValue tone="accent" strong>
                  −{euros(web.clawbackCents)}
                </RowValue>
              }
            />
          ) : null}
        </Card>
      ) : null}
      <Text style={styles.nota}>
        Cada comisión espera {holdDays} días por si hay un reembolso; entonces pasa a disponible y se paga en la
        siguiente liquidación. Si la tienda devuelve el dinero, la comisión se anula.
      </Text>
    </Section>
  );
}

function PagosWeb({ web }: { web: PanelCreadorWeb }) {
  return (
    <Section title="Pagos recibidos">
      {web.payouts.length > 0 ? (
        <Card padded={false} style={styles.lista}>
          {web.payouts.map((p, i) => (
            <Row
              key={`${p.at}-${i}`}
              first={i === 0}
              leading={<Ionicons name="cash-outline" size={18} color={ink.ink9} />}
              title={pagoLabel(p.kind)}
              detail={fechaPago(p.at)}
              trailing={<RowValue strong>{euros(p.cents)}</RowValue>}
            />
          ))}
        </Card>
      ) : (
        <Card variant="outline">
          <EmptyState compact icon="cash-outline" title="Aún sin pagos" body="Aquí aparece cada liquidación cuando se haga." />
        </Card>
      )}
    </Section>
  );
}

const styles = StyleSheet.create({
  hueco: { marginBottom: 14 },
  salirPortal: { marginTop: space.s4, marginBottom: space.s6 },
  huecoLinea: { marginBottom: 12 },
  codigo: { fontFamily: tipo.number.family, fontSize: 30, letterSpacing: 4, color: ink.ink10 },
  enlace: { fontFamily: tipo.bodySm.family, fontSize: 13, color: ink.ink8, marginTop: 6 },
  botones: { flexDirection: 'row', gap: 10, marginTop: 16 },
  boton: { flex: 1 },
  celda: { flex: 1 },
  filaMes: { marginTop: space.s4, paddingTop: space.s4, borderTopWidth: stroke.hairline, borderTopColor: ink.ink3 },
  lista: { paddingHorizontal: 16, paddingVertical: 2 },
  nota: { fontFamily: tipo.bodySm.family, fontSize: 12, lineHeight: 17, color: ink.ink6, marginTop: 4 },
  textoAviso: { fontFamily: tipo.bodySm.family, fontSize: tipo.bodySm.size, lineHeight: tipo.bodySm.lineHeight, color: ink.ink9 },
  posicion: { fontFamily: tipo.bodySm.family, fontSize: 14, lineHeight: 20, color: ink.ink9, marginBottom: 10 },
  premioEyebrow: {
    fontFamily: tipo.label.family,
    fontSize: tipo.label.size,
    letterSpacing: tipo.label.tracking,
    color: ink.ink9,
    marginBottom: 6,
  },
  premio: { fontFamily: tipo.bodySm.family, fontSize: 14, lineHeight: 20, color: ink.ink9 },
  puesto: { fontFamily: tipo.number.family, fontSize: 16, color: ink.ink8, minWidth: 22, textAlign: 'center' },
  puestoYo: { color: ink.ink10 },
  pista: {
    flexDirection: 'row',
    height: 6,
    backgroundColor: ink.ink3,
    marginTop: space.s4,
    overflow: 'hidden',
  },
  relleno: { backgroundColor: ink.ink10 },
  lineaProgreso: {
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink8,
    marginTop: space.s2,
  },
  retoCabeza: { flexDirection: 'row', alignItems: 'center', gap: space.s2 },
  retoTitulo: {
    flex: 1,
    fontFamily: tipo.headline.family,
    fontSize: 16,
    lineHeight: 22,
    color: ink.ink9,
  },
  retoTexto: {
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink8,
    marginTop: space.s1,
  },
  retoCifra: { fontFamily: tipo.number.family, fontSize: 18, color: ink.ink10, marginTop: space.s2 },
  retoPremio: {
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink9,
    marginTop: space.s2,
    paddingTop: space.s2,
    borderTopWidth: stroke.hairline,
    borderTopColor: ink.ink3,
  },
  aviso: {
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink8,
    marginTop: space.s2,
    marginBottom: space.s6,
  },
});
