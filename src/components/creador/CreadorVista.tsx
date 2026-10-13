// NIVL · Panel de creador: la vista (patrón L-RADICAL §C, FASE3 G2). Pura:
// todo llega por props desde useCreador (o desde la galería con datos de
// mentira). Pantalla oculta: solo se llega desde la fila «Panel de creador»
// de Perfil, que solo sale si creator_panel() devuelve algo.
//
// Lo que se pinta sale de `vistaPanelCreador` (creatorprogram.ts, SISTEMA
// §10 bis). En la app de tienda (iOS/Android) NO hay dinero: rango y progreso,
// código, cuentas y ventas, retos, tabla e histórico de ventas, y una línea de
// texto plano que dice dónde se gestionan las ganancias (sin botón ni enlace).
// Fuera de tienda (web) se añade el dinero propio: retención, disponible,
// cobrado, fijo, reembolsos y pagos. De los demás creadores, alias y ventas;
// nunca su dinero (lo garantiza la RPC, no esta pantalla). Ningún botón
// mueve dinero ni lleva a un pago: solo compartir y copiar el código.
//
// En el portal de creadores (creadores.nivl.app, `src/lib/sitio.ts`) es la
// única pantalla con sesión: sin flecha de volver y con «Cerrar sesión» a la
// vista (R2 del Chat 3), en el encabezado y al pie.
//
// "Cuentas", no "instalaciones": sin SDK de atribución no se puede contar
// quién instaló por el enlace; se cuenta quién metió el código.
//
// De arriba abajo: el encabezado grabado (alias y rango), el código en una
// losa remachada, el rango con su Barra, cuentas y ventas en franjas, el
// dinero (solo web), los retos, la tabla del mes, las ventas por mes y los
// pagos (web) o la línea de dónde se gestionan las ganancias (tienda).
//
// INVERSIÓN única: «Compartir» en la losa del código.

import Ionicons from '@expo/vector-icons/Ionicons';
import { useRef } from 'react';
import { findNodeHandle, Platform, StyleSheet, Text, View } from 'react-native';
import {
  Barra,
  CargaArena,
  EncabezadoArena,
  Entrada,
  ErrorSistema,
  FranjaCifras,
  TarjetaArena,
  formatoMiles,
  type AccionArena,
} from '@/components/arena';
import { Button, EmptyState, Row, Screen, Section, Tag } from '@/components/ui';
import { ink, space, stroke, type as tipo } from '@/design/tokens';
import { t } from '@/i18n';
import {
  estadoReto,
  fechaPago,
  importe,
  lineaPosicion,
  lineaRango,
  pagoLabel,
  porVentaAnual,
  rangoLabel,
  ventasLabel,
} from '@/lib/creatormath';
import type { PanelCreadorVista, PanelCreadorWeb, RetoVista } from '@/lib/creatorprogram';

/** Claves de creador:mes (el mes corto del histórico: «sept», no «sep»). */
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'] as const;

/** «Creador novato» → «Novato»: el rol ya va delante en el subtítulo. */
function rangoSinRol(label: string): string {
  const r = label.replace(/^creador\s+/i, '');
  return r.charAt(0).toUpperCase() + r.slice(1);
}

/** 'AAAA-MM' → «sept 2026». */
function mesLabel(month: string): string {
  const [a, m] = month.split('-');
  const i = Number(m) - 1;
  const mes = MESES[i];
  return mes ? t('creador:historico.mes', { mes: t(`creador:mes.${mes}`), anio: a }) : month;
}

export interface CreadorVistaProps {
  /** Hasta la primera carga se pintan huecos. */
  cargado: boolean;
  /** Fallo de la última carga, ya escrito para el usuario. */
  error: string | null;
  /** null: no es creador (o la carga falló sin nada que enseñar). */
  vista: PanelCreadorVista | null;
  /** Días de retención de cada comisión (solo la rama web los dice). */
  holdDays: number;
  /** En el portal de creadores (SITIO_CREADORES): sin volver y con «Cerrar sesión». */
  portal: boolean;
  refrescando: boolean;
  copiado: boolean;
  cerrando: boolean;
  acciones: {
    onSalir: () => void;
    onRefrescar: () => void;
    onCerrarSesion: () => void;
    /** `anchor`: nodo del botón (solo iOS) para anclar la hoja en iPad. */
    onCompartir: (anchor?: number) => void;
    onCopiar: () => void;
  };
}

/** Cifra en Cinzel con la unidad en Outfit (Cinzel no tiene minúsculas). */
function Cifra({ texto, unidad, tenue }: { texto: string; unidad?: string; tenue?: boolean }) {
  return (
    <Text style={[styles.cifra, tenue && styles.cifraTenue]} maxFontSizeMultiplier={1.2} numberOfLines={1}>
      {texto}
      {unidad ? <Text style={styles.unidad}>{unidad}</Text> : null}
    </Text>
  );
}

export function CreadorVista({
  cargado,
  error,
  vista,
  holdDays,
  portal,
  refrescando,
  copiado,
  cerrando,
  acciones,
}: CreadorVistaProps) {
  // Portal: sin flecha (no hay adónde volver) y con salida de la cuenta.
  const volver = portal ? undefined : acciones.onSalir;
  // iPad: la hoja apunta al botón. findNodeHandle solo en iOS (en web lanza).
  const botonCompartir = useRef<View>(null);
  const compartir = () => {
    const nodo = Platform.OS === 'ios' && botonCompartir.current ? findNodeHandle(botonCompartir.current) : null;
    acciones.onCompartir(nodo ?? undefined);
  };
  const accionSesion: AccionArena | undefined = portal
    ? { icono: 'log-out-outline', etiqueta: t('comun:cerrarSesion'), onPress: acciones.onCerrarSesion }
    : undefined;
  const pieSesion = portal ? (
    <Button
      title={t('comun:cerrarSesion')}
      icon="log-out-outline"
      variant="secondary"
      onPress={acciones.onCerrarSesion}
      loading={cerrando}
      style={styles.salirPortal}
    />
  ) : null;

  if (!cargado) {
    return (
      <Screen>
        <EncabezadoArena onVolver={volver} accion={accionSesion} eyebrow={t('creador:vista.eyebrow')} titulo={t('creador:vista.titulo')} meandro />
        <CargaArena
          etiqueta={t('creador:vista.cargando')}
          formas={['rotulo', 'tarjeta', 'rotulo', 'franja', 'rotulo', 'franja', 'filas']}
        />
      </Screen>
    );
  }

  if (!vista) {
    return (
      <Screen refreshing={refrescando} onRefresh={acciones.onRefrescar}>
        <EncabezadoArena onVolver={volver} accion={accionSesion} eyebrow={t('creador:vista.eyebrow')} titulo={t('creador:vista.titulo')} meandro />
        {error ? (
          <ErrorSistema mensaje={error} onReintentar={acciones.onRefrescar} reintentando={refrescando} />
        ) : portal ? (
          // Neutro: no dice nada de la cuenta más allá de que no tiene panel.
          <TarjetaArena variante="contorno">
            <EmptyState
              compact
              icon="megaphone-outline"
              title={t('creador:vista.portalSinPanelTitulo')}
              body={t('creador:vista.portalSinPanelCuerpo')}
            />
          </TarjetaArena>
        ) : (
          <TarjetaArena variante="contorno">
            <EmptyState
              compact
              icon="megaphone-outline"
              title={t('creador:vista.sinPanelTitulo')}
              body={t('creador:vista.sinPanelCuerpo')}
              action={{ label: t('comun:volver'), onPress: acciones.onSalir, variant: 'outline' }}
            />
          </TarjetaArena>
        )}
        {pieSesion}
      </Screen>
    );
  }

  const web: PanelCreadorWeb | null = vista.conImportes ? vista : null;
  const subtitulo = web ? lineaRango(web.rank, web.pct, web.baseCents) : `${vista.rolLabel} · ${rangoSinRol(vista.rangoLabel)}`;

  return (
    <Screen refreshing={refrescando} onRefresh={acciones.onRefrescar}>
      <Entrada indice={0}>
        <EncabezadoArena
          onVolver={volver}
          accion={accionSesion}
          eyebrow={t('creador:vista.eyebrow')}
          titulo={vista.alias || vista.code}
          subtitulo={subtitulo}
          meandro
        />
      </Entrada>

      {error ? (
        <Entrada indice={1}>
          <ErrorSistema
            compacto
            mensaje={t('creador:vista.errorConDatos', { error })}
            onReintentar={acciones.onRefrescar}
            reintentando={refrescando}
            style={styles.bloque}
          />
        </Entrada>
      ) : null}

      <Entrada indice={1}>
        <Section title={t('creador:codigo.titulo')}>
          <TarjetaArena variante="piedra" remaches zocalo>
            <Text
              style={styles.codigo}
              selectable
              accessibilityLabel={t('creador:codigo.a11y', { codigo: vista.code })}
              maxFontSizeMultiplier={1.2}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {vista.code}
            </Text>
            <Text style={styles.enlace} selectable numberOfLines={1} maxFontSizeMultiplier={1.35}>
              {vista.enlace}
            </Text>
            <View style={styles.botones}>
              <View ref={botonCompartir} collapsable={false} style={styles.boton}>
                <Button title={t('comun:compartir')} icon="share-social-outline" onPress={compartir} />
              </View>
              <Button
                title={copiado ? t('creador:codigo.copiado') : t('creador:codigo.copiar')}
                icon={copiado ? 'checkmark' : 'copy-outline'}
                variant="secondary"
                onPress={acciones.onCopiar}
                style={styles.boton}
              />
            </View>
          </TarjetaArena>
          <Text style={styles.nota} maxFontSizeMultiplier={1.35}>
            {t('creador:codigo.nota')}
          </Text>
        </Section>
      </Entrada>

      <Entrada indice={2}>
        <ProgresoRango vista={vista} />
      </Entrada>

      <Entrada indice={3}>
        <Section title={t('creador:cuentas.titulo')}>
          <View style={styles.franjas}>
            <FranjaCifras
              cifras={[
                { valor: formatoMiles(vista.installs), rotulo: t('creador:cuentas.cuentas') },
                { valor: formatoMiles(vista.sales), rotulo: t('creador:cuentas.ventas') },
              ]}
            />
            <View style={styles.franjaSegunda}>
              <FranjaCifras
                cifras={[
                  { valor: formatoMiles(vista.installsMonth), rotulo: t('creador:cuentas.cuentasMes') },
                  { valor: formatoMiles(vista.salesMonth), rotulo: t('creador:cuentas.ventasMes') },
                ]}
              />
            </View>
          </View>
          <Text style={styles.nota} maxFontSizeMultiplier={1.35}>
            {t('creador:cuentas.queEsVenta')}
          </Text>
          {web ? (
            <Text style={styles.nota} maxFontSizeMultiplier={1.35}>
              {t('creador:cuentas.comision', { importe: porVentaAnual(web.pct, web.baseCents), pct: Math.round(web.pct) })}
            </Text>
          ) : null}
        </Section>
      </Entrada>

      {web ? (
        <Entrada indice={4}>
          <DineroWeb web={web} holdDays={holdDays} />
        </Entrada>
      ) : null}

      {vista.retos.length > 0 ? (
        <Entrada indice={5}>
          <Section title={t('creador:retos.titulo')} meta={`${vista.retos.length}`}>
            <View style={styles.retos}>
              {vista.retos.map((r) => (
                <RetoCard key={r.id} reto={r} />
              ))}
            </View>
          </Section>
        </Entrada>
      ) : null}

      <Entrada indice={6}>
        <Section title={t('creador:tabla.titulo')}>
          <Text style={styles.posicion} maxFontSizeMultiplier={1.35}>
            {lineaPosicion(vista.position, vista.creators, vista.salesMonth)}
          </Text>
          {web?.prize ? (
            <TarjetaArena variante="grano" rotulo={t('creador:tabla.premio')} style={styles.premioBloque}>
              <Text style={styles.premio} maxFontSizeMultiplier={1.35}>
                {web.prize}
              </Text>
            </TarjetaArena>
          ) : null}
          {vista.tabla.length > 0 ? (
            <View style={styles.lista}>
              {vista.tabla.map((r, i) => (
                <Row
                  key={`${r.pos}-${r.alias}-${i}`}
                  first={i === 0}
                  leading={
                    <Text style={[styles.puesto, r.isMe && styles.puestoYo]} maxFontSizeMultiplier={1.2}>
                      {r.pos}
                    </Text>
                  }
                  title={r.isMe ? t('creador:tabla.nombreYo', { alias: r.alias }) : r.alias}
                  muted={!r.isMe && r.sales === 0}
                  trailing={
                    <Text style={[styles.ventas, r.isMe && styles.ventasYo]} maxFontSizeMultiplier={1.35}>
                      {ventasLabel(r.sales)}
                    </Text>
                  }
                  accessibilityLabel={t(r.isMe ? 'creador:tabla.a11yYo' : 'creador:tabla.a11y', {
                    pos: r.pos,
                    alias: r.alias,
                    ventas: ventasLabel(r.sales),
                  })}
                />
              ))}
            </View>
          ) : null}
        </Section>
      </Entrada>

      {vista.historico.length > 0 ? (
        <Entrada indice={7}>
          <Section title={t('creador:historico.titulo')}>
            <View style={styles.lista}>
              {vista.historico.map((h, i) => (
                <Row
                  key={h.month}
                  first={i === 0}
                  title={mesLabel(h.month)}
                  muted={h.sales === 0}
                  trailing={
                    <Text style={[styles.ventas, h.sales > 0 && styles.ventasYo]} maxFontSizeMultiplier={1.35}>
                      {ventasLabel(h.sales)}
                    </Text>
                  }
                />
              ))}
            </View>
          </Section>
        </Entrada>
      ) : null}

      {web ? (
        <Entrada indice={7}>
          <PagosWeb web={web} />
        </Entrada>
      ) : (
        // Texto plano: ni botón ni enlace (dictamen de tiendas, SISTEMA §10 bis).
        <Text style={styles.aviso} maxFontSizeMultiplier={1.35}>
          {vista.aviso}
        </Text>
      )}
      {pieSesion}
    </Screen>
  );
}

/** Rango y progreso hacia el siguiente: ventas de 90 días, sin dinero. */
function ProgresoRango({ vista }: { vista: PanelCreadorVista }) {
  const p = vista.progreso;
  const meses = vista.monthsActive;
  return (
    <Section title={t('creador:rango.titulo')} meta={vista.rangoLabel}>
      <View style={styles.franjas}>
        <FranjaCifras
          cifras={[
            { valor: formatoMiles(vista.sales90d), rotulo: t('creador:rango.ventas90') },
            // El rótulo va sin la cifra (la pinta la franja): dos rótulos, no un plural con count.
            { valor: formatoMiles(meses), rotulo: meses === 1 ? t('creador:rango.mesSeguido') : t('creador:rango.mesesSeguidos') },
          ]}
        />
      </View>
      {p.siguiente && p.umbral != null ? (
        <View style={styles.progreso}>
          <Barra
            ratio={p.fraccion}
            alto={6}
            etiqueta={t('creador:rango.haciaA11y', { rango: rangoLabel(p.siguiente), ventas: vista.sales90d, umbral: p.umbral })}
          />
          <Text style={styles.lineaProgreso} maxFontSizeMultiplier={1.35}>
            {p.faltan
              ? t('creador:rango.faltan', { rango: rangoLabel(p.siguiente), umbral: p.umbral, faltan: p.faltan })
              : t('creador:rango.cumples', { rango: rangoLabel(p.siguiente) })}
          </Text>
        </View>
      ) : (
        <Text style={[styles.lineaProgreso, styles.progreso]} maxFontSizeMultiplier={1.35}>
          {t('creador:rango.sinSiguiente')}
        </Text>
      )}
    </Section>
  );
}

function RetoCard({ reto }: { reto: RetoVista }) {
  const e = estadoReto(reto, reto.sales);
  const cumplido = e.fase === 'cumplido';
  return (
    <TarjetaArena variante={cumplido ? 'grano' : 'contorno'}>
      <View style={styles.retoCabeza}>
        <Text style={styles.retoTitulo} numberOfLines={2} maxFontSizeMultiplier={1.35}>
          {reto.title}
        </Text>
        {cumplido ? <Tag tone="logro">{t('creador:retos.cumplido')}</Tag> : null}
      </View>
      {reto.description ? (
        <Text style={styles.retoTexto} maxFontSizeMultiplier={1.35}>
          {reto.description}
        </Text>
      ) : null}
      <View style={styles.retoCifra}>
        {/* i18n-ok: dos cifras */}
        <Cifra texto={`${reto.sales}/${reto.goalSales}`} unidad={` ${t('creador:retos.unidadVentas')}`} />
      </View>
      <Barra ratio={e.fraccion} alto={4} etiqueta={t('creador:retos.a11y', { titulo: reto.title, ventas: reto.sales, meta: reto.goalSales })} />
      <Text style={styles.retoTexto} maxFontSizeMultiplier={1.35}>
        {e.linea}
      </Text>
      {reto.prize ? (
        <Text style={styles.retoPremio} maxFontSizeMultiplier={1.35}>
          {t('creador:retos.premio', { premio: reto.prize })}
        </Text>
      ) : null}
    </TarjetaArena>
  );
}

// ── Solo web (conImportes): el dinero propio ────────────────────────

function DineroWeb({ web, holdDays }: { web: PanelCreadorWeb; holdDays: number }) {
  const conClawback = web.clawbackCents > 0;
  return (
    <Section title={t('creador:dinero.titulo')}>
      {/* Filas y no franja: un importe con céntimos no cabe en un tercio a 375. */}
      <View style={styles.lista}>
        <Row first title={t('creador:dinero.retencion')} trailing={<Cifra texto={importe(web.pendingCents)} unidad=" €" />} />
        <Row title={t('creador:dinero.disponible')} trailing={<Cifra texto={importe(web.availableCents)} unidad=" €" />} />
        <Row title={t('creador:dinero.cobrado')} trailing={<Cifra texto={importe(web.paidCents)} unidad=" €" />} />
        {web.monthlyFixedCents > 0 ? (
          <Row title={t('creador:dinero.fijo')} trailing={<Cifra texto={importe(web.monthlyFixedCents)} unidad=" €" />} />
        ) : null}
        {conClawback ? (
          <Row
            title={t('creador:dinero.descontar')}
            detail={t('creador:dinero.descontarDetalle')}
            // i18n-ok: el signo y la cifra
            trailing={<Cifra texto={`−${importe(web.clawbackCents)}`} unidad=" €" />}
          />
        ) : null}
      </View>
      <Text style={styles.nota} maxFontSizeMultiplier={1.35}>
        {t('creador:dinero.retencionNota', { dias: holdDays })}
      </Text>
    </Section>
  );
}

function PagosWeb({ web }: { web: PanelCreadorWeb }) {
  return (
    <Section title={t('creador:pagos.titulo')}>
      {web.payouts.length > 0 ? (
        <View style={styles.lista}>
          {web.payouts.map((p, i) => (
            <Row
              key={`${p.at}-${i}`}
              first={i === 0}
              leading={<Ionicons name="cash-outline" size={18} color={ink.ink6} />}
              title={pagoLabel(p.kind)}
              detail={fechaPago(p.at)}
              trailing={<Cifra texto={importe(p.cents)} unidad=" €" />}
            />
          ))}
        </View>
      ) : (
        <TarjetaArena variante="contorno">
          <EmptyState
            compact
            icon="cash-outline"
            title={t('creador:pagos.vacioTitulo')}
            body={t('creador:pagos.vacioCuerpo')}
          />
        </TarjetaArena>
      )}
    </Section>
  );
}

const styles = StyleSheet.create({
  bloque: { marginBottom: space.s6 },
  salirPortal: { marginTop: space.s4, marginBottom: space.s6 },
  codigo: {
    fontFamily: tipo.rank.family,
    fontSize: tipo.rank.size,
    lineHeight: tipo.rank.lineHeight,
    letterSpacing: tipo.rank.tracking,
    color: ink.ink10,
  },
  enlace: {
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink8,
    marginTop: space.s2,
  },
  botones: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s3, marginTop: space.s5 },
  boton: { flexGrow: 1, flexBasis: 140 },
  franjas: {
    paddingVertical: space.s3,
    borderTopWidth: stroke.hairline,
    borderBottomWidth: stroke.hairline,
    borderColor: ink.ink3,
  },
  franjaSegunda: {
    marginTop: space.s3,
    paddingTop: space.s3,
    borderTopWidth: stroke.hairline,
    borderTopColor: ink.ink3,
  },
  // Filas sobre hairlines, sin tarjeta.
  lista: { borderTopWidth: stroke.hairline, borderBottomWidth: stroke.hairline, borderColor: ink.ink3 },
  nota: {
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink6,
    marginTop: space.s3,
  },
  progreso: { marginTop: space.s4 },
  lineaProgreso: {
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink8,
    marginTop: space.s2,
  },
  cifra: {
    fontFamily: tipo.number.family,
    fontSize: 16,
    lineHeight: 20,
    color: ink.ink10,
    fontVariant: ['tabular-nums'],
  },
  cifraTenue: { color: ink.ink8 },
  // Cinzel no tiene minúsculas: la unidad va en Outfit.
  unidad: { fontFamily: tipo.micro.family, fontSize: tipo.micro.size, letterSpacing: tipo.micro.tracking, color: ink.ink6 },
  posicion: {
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink9,
    marginBottom: space.s3,
  },
  premioBloque: { marginBottom: space.s4 },
  premio: {
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink9,
  },
  puesto: {
    fontFamily: tipo.number.family,
    fontSize: 16,
    lineHeight: 20,
    color: ink.ink6,
    minWidth: 28,
    textAlign: 'center',
  },
  puestoYo: { color: ink.ink10 },
  ventas: { fontFamily: tipo.bodySm.family, fontSize: tipo.bodySm.size, color: ink.ink8 },
  ventasYo: { fontFamily: 'Outfit_600SemiBold', color: ink.ink10 },
  retos: { gap: space.s3 },
  retoCabeza: { flexDirection: 'row', alignItems: 'center', gap: space.s2 },
  retoTitulo: {
    flex: 1,
    minWidth: 0,
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
    marginTop: space.s2,
  },
  retoCifra: { marginTop: space.s3, marginBottom: space.s2 },
  retoPremio: {
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink9,
    marginTop: space.s3,
    paddingTop: space.s3,
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
