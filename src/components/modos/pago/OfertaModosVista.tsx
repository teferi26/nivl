// NIVL · La oferta por modos en Ónix (maqueta «Embudo», paso de pago). Pura:
// todo llega por props desde useOfertaModos o desde la demo.
//
// Reglas que no son de estilo:
//   · El importe que se factura es la cifra destacada de cada opción. Sin
//     equivalentes mensuales ni ahorros calculados: la tienda puede poner otro
//     precio en cada país.
//   · La prueba de 7 días solo se dice si la tienda la declara para esta cuenta.
//   · Con la tienda cerrada: lista de solo lectura, sin selector, ni restaurar,
//     ni letra de renovación, ni enlaces legales (AGENTS.md).
//   · Lo elegido va con hilo de oro; el hueso es para el botón de compra, el
//     periodo elegido y la etiqueta de los cuatro modos.
//
// Partida en Cuerpo / Acciones / Legal para el pie fijo del onboarding.

import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ErrorSistema } from '@/components/arena';
import { Button } from '@/components/ui';
import { ink, oro, radio, space, stroke, type as tipo, vidrio } from '@/design/tokens';
import { t } from '@/i18n';
import { LEGAL_URLS } from '@/lib/proplans';
import {
  importeConPeriodo,
  importeTabla,
  legalModo,
  MODOS_DE_PAGO,
  notaAlcance,
  pasosPrueba,
  periodoCorto,
  PRECIOS_CENTS,
  textoBotonCompra,
  type ModoDePago,
  type Periodo,
  type ProductoModo,
} from '@/lib/planesmodo';
import { NOMBRE_MODO } from '@/modos/tipos';

export interface EstadoOfertaModos {
  disponible: boolean;
  catalogo: 'cargando' | 'listo' | 'error';
  periodo: Periodo;
  pack: 'todos' | 'uno';
  modo: ModoDePago;
  producto: ProductoModo;
  precio: string | null;
  precioDe: (alcance: ModoDePago | 'todos') => string | null;
  periodoGratis: string | null;
  esActual: boolean;
  /** Comprar esto sustituye a la suscripción que hay: se dice antes de cobrar. */
  avisoCambio?: string | null;
  puedeComprar: boolean;
  busy: 'compra' | 'restaurar' | null;
  aviso: string | null;
  sinPermiso: boolean;
  avisoEnlace: boolean;
  plataforma: string;
  onPeriodo: (p: Periodo) => void;
  onPack: (p: 'todos' | 'uno') => void;
  onModo: (m: ModoDePago) => void;
  onComprar: () => void;
  onRestaurar: () => void;
  onReintentar: () => void;
  onRevisarPermiso: () => void;
  onAbrir: (url: string) => void;
  hoja: ReactNode;
}

function Segmento({ activo, etiqueta, onPress }: { activo: boolean; etiqueta: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.segmento, activo && styles.segmentoActivo]}
      accessibilityRole="radio"
      accessibilityState={{ selected: activo }}
    >
      <Text style={[styles.segmentoTexto, activo && styles.segmentoTextoActivo]} maxFontSizeMultiplier={1.35}>
        {etiqueta}
      </Text>
    </Pressable>
  );
}

function Opcion({
  activa,
  rotulo,
  titulo,
  precio,
  periodo,
  nota,
  grande,
  onPress,
  children,
}: {
  activa: boolean;
  rotulo?: string;
  titulo: string;
  precio: string | null;
  periodo: Periodo;
  nota: string;
  /** La cifra de los cuatro modos va más grande que la de un modo. */
  grande?: boolean;
  onPress: () => void;
  children?: ReactNode;
}) {
  const etiquetaA11y = precio
    ? t('oferta:pago.a11yOpcion', { titulo, precio, porPeriodo: periodoCorto(periodo), nota })
    : t('oferta:pago.a11yOpcionSinPrecio', { titulo, nota });
  return (
    <View style={[styles.opcion, activa && styles.opcionActiva]}>
      <Pressable onPress={onPress} style={styles.opcionPulsable} accessibilityRole="radio" accessibilityState={{ selected: activa }} accessibilityLabel={etiquetaA11y}>
        {rotulo ? (
          <Text style={styles.rotulo} maxFontSizeMultiplier={1.35}>
            {rotulo}
          </Text>
        ) : null}
        <View style={styles.opcionFila}>
          <Text style={styles.opcionTitulo} maxFontSizeMultiplier={1.35}>
            {titulo}
          </Text>
          {precio ? (
            <Text style={[styles.cifra, grande && styles.cifraGrande]} maxFontSizeMultiplier={1} adjustsFontSizeToFit numberOfLines={1}>
              {importeConPeriodo(precio, periodo)}
            </Text>
          ) : (
            <View style={[styles.huecoPrecio, grande && styles.huecoPrecioGrande]} />
          )}
        </View>
        <Text style={styles.nota} maxFontSizeMultiplier={1.35}>
          {nota}
        </Text>
      </Pressable>
      {children}
    </View>
  );
}

function ListaSoloLectura() {
  const filas: { id: string; titulo: string; cents: Record<Periodo, number> }[] = [
    { id: 'uno', titulo: t('oferta:pago.filaUno'), cents: PRECIOS_CENTS.uno },
    { id: 'todos', titulo: t('oferta:pago.filaTodos'), cents: PRECIOS_CENTS.todos },
  ];
  return (
    <View style={styles.lista}>
      {filas.map((f, i) => (
        <View key={f.id} style={[styles.listaFila, i > 0 && styles.listaSep]}>
          <Text style={styles.opcionTitulo}>{f.titulo}</Text>
          <View style={styles.listaPrecios}>
            <Text style={styles.listaPrecio}>{importeConPeriodo(importeTabla(f.cents.anual), 'anual')}</Text>
            <Text style={styles.listaPrecio}>{importeConPeriodo(importeTabla(f.cents.mensual), 'mensual')}</Text>
          </View>
        </View>
      ))}
      <Text style={styles.nota}>{t('oferta:pago.noDisponible')}</Text>
      <Text style={styles.nota}>{t('oferta:pago.legal.avisoIa')}</Text>
    </View>
  );
}

export function OfertaModosCuerpo({ oferta }: { oferta: EstadoOfertaModos }) {
  if (!oferta.disponible) return <ListaSoloLectura />;
  const { periodo, pack, modo, periodoGratis } = oferta;
  const pasos = pasosPrueba(periodoGratis);
  return (
    <View style={styles.cuerpo} accessibilityRole="radiogroup">
      <View style={styles.segmentos}>
        <Segmento activo={periodo === 'anual'} etiqueta={t('oferta:pago.periodo.anual')} onPress={() => oferta.onPeriodo('anual')} />
        <Segmento activo={periodo === 'mensual'} etiqueta={t('oferta:pago.periodo.mensual')} onPress={() => oferta.onPeriodo('mensual')} />
      </View>
      <Opcion
        activa={pack === 'todos'}
        rotulo={t('oferta:pago.losCuatroModos')}
        titulo={t('oferta:pago.todosLosModos')}
        precio={oferta.precioDe('todos')}
        periodo={periodo}
        nota={notaAlcance('todos')}
        grande
        onPress={() => oferta.onPack('todos')}
      />
      <Opcion
        activa={pack === 'uno'}
        titulo={t('oferta:pago.soloModo', { modo: NOMBRE_MODO[modo] })}
        precio={oferta.precioDe(modo)}
        periodo={periodo}
        nota={notaAlcance(modo)}
        onPress={() => oferta.onPack('uno')}
      >
        {pack === 'uno' ? (
          <View style={styles.chips}>
            {MODOS_DE_PAGO.map((m) => (
              <Pressable
                key={m}
                onPress={() => oferta.onModo(m)}
                style={[styles.chip, m === modo && styles.chipActivo]}
                accessibilityRole="radio"
                accessibilityState={{ selected: m === modo }}
                accessibilityLabel={NOMBRE_MODO[m]}
              >
                <Text style={[styles.chipTexto, m === modo && styles.chipTextoActivo]} maxFontSizeMultiplier={1.2} numberOfLines={1} adjustsFontSizeToFit>
                  {NOMBRE_MODO[m]}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </Opcion>
      {pasos.length ? (
        <View style={styles.pasos}>
          {pasos.map((p) => (
            <View key={p.dia} style={styles.paso}>
              <Text style={styles.pasoDia} maxFontSizeMultiplier={1.35}>
                {p.dia}
              </Text>
              <Text style={styles.pasoTexto} maxFontSizeMultiplier={1.35}>
                {p.texto}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
      {oferta.catalogo === 'error' ? (
        <ErrorSistema compacto mensaje={t('oferta:pago.errorPrecios')} onReintentar={oferta.onReintentar} />
      ) : null}
    </View>
  );
}

export function OfertaModosAcciones({
  oferta,
  etiquetaSalida,
  onSalir,
  saliendo,
  salidaEnLegal,
}: {
  oferta: EstadoOfertaModos;
  etiquetaSalida: string;
  onSalir: () => void;
  saliendo?: boolean;
  /** La salida la pinta OfertaModosLegal en su fila: aquí no se repite. */
  salidaEnLegal?: boolean;
}) {
  const { disponible, catalogo, precio, producto, periodoGratis, esActual, busy, aviso, sinPermiso } = oferta;
  const titulo = esActual
    ? t('oferta:pago.cta.actual')
    : precio
      ? textoBotonCompra(producto.id, precio, periodoGratis)
      : catalogo === 'cargando'
        ? t('oferta:pago.cta.cargando')
        : t('oferta:pago.cta.noDisponible');
  return (
    <View style={styles.acciones}>
      {oferta.avisoCambio ? <Text style={styles.aviso}>{oferta.avisoCambio}</Text> : null}
      {aviso ? (
        <Text style={styles.aviso} accessibilityRole="alert">
          {aviso}
        </Text>
      ) : null}
      {sinPermiso ? <Button title={t('oferta:pago.cta.revisarPermiso')} variant="secondary" size="md" onPress={oferta.onRevisarPermiso} /> : null}
      {disponible ? (
        <Button title={titulo} size="lg" onPress={oferta.onComprar} disabled={!oferta.puedeComprar || (busy !== null && busy !== 'compra')} loading={busy === 'compra'} />
      ) : null}
      {salidaEnLegal ? null : <Button title={etiquetaSalida} variant="ghost" size="md" onPress={onSalir} loading={saliendo} disabled={busy !== null} />}
      {oferta.hoja}
    </View>
  );
}

function Enlace({
  etiqueta,
  a11y,
  onPress,
  rol = 'link',
  cargando,
}: {
  etiqueta: string;
  a11y?: string;
  onPress: () => void;
  rol?: 'link' | 'button';
  cargando?: boolean;
}) {
  return (
    <Pressable onPress={onPress} disabled={cargando} hitSlop={{ top: 0, bottom: 0, left: 8, right: 8 }} style={styles.enlaceHit} accessibilityRole={rol} accessibilityLabel={a11y ?? etiqueta}>
      <Text style={styles.enlace} maxFontSizeMultiplier={1.35}>
        {etiqueta}
      </Text>
    </Pressable>
  );
}

export function OfertaModosLegal({
  oferta,
  salida,
}: {
  oferta: EstadoOfertaModos;
  /** La salida como un enlace más de la fila (la oferta entera, sin pie fijo). */
  salida?: { etiqueta: string; onPress: () => void };
}) {
  if (!oferta.disponible) return null;
  // Sin precio confirmado no hay letra de renovación, pero el aviso de IA sigue.
  const letra = legalModo(oferta.producto.id, oferta.precio, oferta.periodoGratis, oferta.plataforma) ?? t('oferta:pago.legal.avisoIa');
  return (
    <View style={styles.legal}>
      <Text style={styles.letra} maxFontSizeMultiplier={1.35}>
        {letra}
      </Text>
      <View style={styles.enlaces}>
        <Enlace etiqueta={t('oferta:pago.enlace.restaurar')} a11y={t('oferta:pago.enlace.restaurarA11y')} rol="button" onPress={oferta.onRestaurar} cargando={oferta.busy !== null} />
        <Enlace etiqueta={t('oferta:pago.enlace.terminos')} onPress={() => oferta.onAbrir(LEGAL_URLS.terminos)} />
        <Enlace etiqueta={t('oferta:pago.enlace.privacidad')} onPress={() => oferta.onAbrir(LEGAL_URLS.privacidad)} />
        {oferta.plataforma === 'ios' ? <Enlace etiqueta={t('oferta:pago.enlace.eula')} onPress={() => oferta.onAbrir(LEGAL_URLS.eulaApple)} /> : null}
        {salida ? <Enlace etiqueta={salida.etiqueta} rol="button" onPress={salida.onPress} cargando={oferta.busy !== null} /> : null}
      </View>
      {oferta.avisoEnlace ? (
        <Text style={styles.aviso} accessibilityRole="alert">
          {t('oferta:pago.enlace.error')}
        </Text>
      ) : null}
    </View>
  );
}

export function OfertaModosVista({
  oferta,
  etiquetaSalida,
  onSalir,
}: {
  oferta: EstadoOfertaModos;
  etiquetaSalida: string;
  onSalir: () => void;
}) {
  // Con la tienda cerrada no hay fila de enlaces: la salida sigue siendo un botón.
  return (
    <View>
      <OfertaModosCuerpo oferta={oferta} />
      <OfertaModosAcciones oferta={oferta} etiquetaSalida={etiquetaSalida} onSalir={onSalir} salidaEnLegal={oferta.disponible} />
      <OfertaModosLegal oferta={oferta} salida={{ etiqueta: etiquetaSalida, onPress: onSalir }} />
    </View>
  );
}

const lectura = { fontFamily: tipo.bodySm.family, fontSize: tipo.bodySm.size, lineHeight: tipo.bodySm.lineHeight } as const;
const tituloOpcion = { fontFamily: tipo.headline.family, fontSize: 17, lineHeight: 22 } as const;
const PADDING_OPCION = { vertical: space.s3, horizontal: 14 } as const;

const styles = StyleSheet.create({
  cuerpo: { gap: space.s2 },
  segmentos: { flexDirection: 'row', gap: space.s2 },
  segmento: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderWidth: stroke.hairline, borderColor: vidrio.borde, borderRadius: radio.control },
  segmentoActivo: { backgroundColor: ink.ink10, borderColor: ink.ink10 },
  segmentoTexto: { fontFamily: tipo.headline.family, fontSize: 15, lineHeight: 20, color: ink.ink9 },
  segmentoTextoActivo: { color: ink.ink0 },
  // El borde de la elegida es 1 pt más grueso: el relleno lo compensa y la tarjeta no salta.
  opcion: { paddingVertical: PADDING_OPCION.vertical, paddingHorizontal: PADDING_OPCION.horizontal, borderWidth: stroke.hairline, borderColor: vidrio.borde, borderRadius: radio.tarjeta },
  opcionActiva: {
    borderWidth: stroke.rule,
    borderColor: oro.claro,
    backgroundColor: vidrio.tarjeta,
    paddingVertical: PADDING_OPCION.vertical - 1,
    paddingHorizontal: PADDING_OPCION.horizontal - 1,
  },
  opcionPulsable: { gap: 3 },
  rotulo: { alignSelf: 'flex-start', backgroundColor: ink.ink10, color: ink.ink0, fontFamily: tipo.label.family, fontSize: tipo.micro.size, lineHeight: tipo.micro.lineHeight, letterSpacing: tipo.micro.tracking, textTransform: 'uppercase', paddingVertical: space.s1, paddingHorizontal: 9, borderRadius: 9, overflow: 'hidden' },
  opcionFila: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: space.s2 },
  opcionTitulo: { ...tituloOpcion, flex: 1, minWidth: 0, color: ink.ink9 },
  cifra: { flexShrink: 1, maxWidth: '62%', fontFamily: tipo.number.family, fontSize: tipo.number.size, lineHeight: tipo.number.lineHeight, color: oro.claro },
  cifraGrande: { fontSize: 30, lineHeight: 34 },
  huecoPrecio: { width: 96, height: tipo.number.lineHeight, borderRadius: radio.chip, backgroundColor: vidrio.campo },
  huecoPrecioGrande: { height: 34 },
  nota: { ...lectura, color: ink.ink8 },
  chips: { flexDirection: 'row', gap: 6, marginTop: space.s3 },
  chip: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderWidth: stroke.hairline, borderColor: vidrio.borde, borderRadius: radio.chip, paddingHorizontal: 2 },
  chipActivo: { borderWidth: stroke.rule, borderColor: oro.claro, backgroundColor: vidrio.tarjeta },
  chipTexto: { fontFamily: tipo.headline.family, fontSize: 12, lineHeight: 16, color: ink.ink8 },
  chipTextoActivo: { color: ink.ink9 },
  pasos: { flexDirection: 'row', gap: space.s2, paddingVertical: 2 },
  paso: { flex: 1, alignItems: 'center' },
  pasoDia: { ...tituloOpcion, color: ink.ink9, textAlign: 'center' },
  pasoTexto: { fontFamily: tipo.bodySm.family, fontSize: 12, lineHeight: 16, color: ink.ink8, textAlign: 'center' },
  acciones: { gap: space.s2, marginTop: space.s3 },
  aviso: { ...lectura, color: ink.ink9, borderLeftWidth: stroke.rule, borderLeftColor: oro.borde, paddingLeft: 10 },
  legal: { marginTop: space.s3 },
  letra: { fontFamily: tipo.bodySm.family, fontSize: 12, lineHeight: 16, color: ink.ink8, textAlign: 'center' },
  enlaces: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', columnGap: space.s4, marginTop: space.s1 },
  enlaceHit: { minHeight: 44, justifyContent: 'center' },
  enlace: { fontFamily: tipo.micro.family, fontSize: 12, lineHeight: 16, color: ink.ink8 },
  lista: { gap: space.s2, padding: space.s4, borderWidth: stroke.hairline, borderColor: vidrio.borde, borderRadius: radio.tarjeta, backgroundColor: vidrio.suave },
  listaFila: { paddingVertical: space.s2, gap: space.s1 },
  listaSep: { borderTopWidth: stroke.hairline, borderTopColor: vidrio.linea, paddingTop: space.s3 },
  listaPrecios: { flexDirection: 'row', flexWrap: 'wrap', columnGap: space.s4 },
  listaPrecio: { fontFamily: tipo.number.family, fontSize: 18, lineHeight: 24, color: oro.claro },
});
