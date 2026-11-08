// NIVL · La oferta por modos (maqueta «Ronda 2», paso de pago). Pura: todo
// llega por props desde useOfertaModos o desde la demo.
//
// Reglas que no son de estilo:
//   · El importe que se factura es la cifra más grande de cada opción. Sin
//     equivalentes mensuales ni ahorros calculados: la tienda puede poner otro
//     precio en cada país.
//   · La prueba de 7 días solo se dice si la tienda la declara para esta cuenta.
//   · Con la tienda cerrada: lista de solo lectura, sin selector, ni restaurar,
//     ni letra de renovación, ni enlaces legales (AGENTS.md).
//   · Una sola inversión: el botón de compra. Lo elegido va por grosor de trazo.
//
// Partida en Cuerpo / Acciones / Legal para el pie fijo del onboarding.

import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ErrorSistema } from '@/components/arena';
import { Button } from '@/components/ui';
import { ink, space, stroke, type as tipo } from '@/design/tokens';
import { LEGAL_URLS } from '@/lib/proplans';
import {
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
  onPress,
  children,
}: {
  activa: boolean;
  rotulo?: string;
  titulo: string;
  precio: string | null;
  periodo: Periodo;
  nota: string;
  onPress: () => void;
  children?: ReactNode;
}) {
  return (
    <View style={[styles.opcion, activa && styles.opcionActiva]}>
      <Pressable
        onPress={onPress}
        accessibilityRole="radio"
        accessibilityState={{ selected: activa }}
        accessibilityLabel={`${titulo}. ${precio ? `${precio} ${periodoCorto(periodo)}.` : ''} ${nota}`} // i18n-ok: pantalla de compra, en español como ProOffer
      >
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
            <View style={styles.importe}>
              <Text style={styles.cifra} maxFontSizeMultiplier={1} adjustsFontSizeToFit numberOfLines={1}>
                {precio}
              </Text>
              <Text style={styles.porPeriodo} maxFontSizeMultiplier={1.35}>
                {periodoCorto(periodo)}
              </Text>
            </View>
          ) : (
            <View style={styles.huecoPrecio} />
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
  const filas: { titulo: string; cents: Record<Periodo, number> }[] = [
    { titulo: 'Un modo y su coach', cents: PRECIOS_CENTS.uno }, // i18n-ok: oferta
    { titulo: 'Los cuatro modos, con su coach', cents: PRECIOS_CENTS.todos }, // i18n-ok: oferta
  ];
  return (
    <View style={styles.lista}>
      {filas.map((f, i) => (
        <View key={f.titulo} style={[styles.listaFila, i > 0 && styles.listaSep]}>
          <Text style={styles.opcionTitulo}>{f.titulo}</Text>
          <Text style={styles.listaPrecio}>{`${importeTabla(f.cents.mensual)} ${periodoCorto('mensual')}`}</Text>
          <Text style={styles.listaPrecio}>{`${importeTabla(f.cents.anual)} ${periodoCorto('anual')}`}</Text>
        </View>
      ))}
      {/* i18n-ok: pantalla de compra, en español como ProOffer */}
      <Text style={styles.nota}>Las suscripciones no están disponibles en esta versión de la app.</Text>
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
        {/* i18n-ok: pantalla de compra, en español como ProOffer */}
        <Segmento activo={periodo === 'anual'} etiqueta="Anual" onPress={() => oferta.onPeriodo('anual')} />
        {/* i18n-ok: pantalla de compra, en español como ProOffer */}
        <Segmento activo={periodo === 'mensual'} etiqueta="Mensual" onPress={() => oferta.onPeriodo('mensual')} />
      </View>
      <Opcion
        activa={pack === 'todos'}
        rotulo="Los cuatro modos" // i18n-ok: pantalla de compra, en español como ProOffer
        titulo="Todos los modos" // i18n-ok: pantalla de compra, en español como ProOffer
        precio={oferta.precioDe('todos')}
        periodo={periodo}
        nota={notaAlcance('todos')}
        onPress={() => oferta.onPack('todos')}
      />
      <Opcion
        activa={pack === 'uno'}
        titulo={`Solo ${NOMBRE_MODO[modo]}`} // i18n-ok: pantalla de compra, en español como ProOffer
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
              <Text style={styles.pasoDia}>{p.dia}</Text>
              <Text style={styles.nota}>{p.texto}</Text>
            </View>
          ))}
        </View>
      ) : null}
      {oferta.catalogo === 'error' ? (
        // i18n-ok: pantalla de compra, en español como ProOffer
        <ErrorSistema compacto mensaje="No se han podido cargar los precios de la tienda." onReintentar={oferta.onReintentar} />
      ) : null}
    </View>
  );
}

export function OfertaModosAcciones({
  oferta,
  etiquetaSalida,
  onSalir,
  saliendo,
}: {
  oferta: EstadoOfertaModos;
  etiquetaSalida: string;
  onSalir: () => void;
  saliendo?: boolean;
}) {
  const { disponible, catalogo, precio, producto, periodoGratis, esActual, busy, aviso, sinPermiso } = oferta;
  const titulo = esActual
    ? 'Ya es tu plan' // i18n-ok: pantalla de compra, en español como ProOffer
    : precio
      ? textoBotonCompra(producto.id, precio, periodoGratis)
      : catalogo === 'cargando'
        ? 'Cargando precios de la tienda' // i18n-ok: pantalla de compra, en español como ProOffer
        : 'No disponible ahora'; // i18n-ok: pantalla de compra, en español como ProOffer
  return (
    <View style={styles.acciones}>
      {aviso ? (
        <Text style={styles.aviso} accessibilityRole="alert">
          {aviso}
        </Text>
      ) : null}
      {/* i18n-ok: pantalla de compra, en español como ProOffer */}
      {sinPermiso ? <Button title="Revisar el permiso" variant="secondary" size="md" onPress={oferta.onRevisarPermiso} /> : null}
      {disponible ? (
        <Button title={titulo} size="lg" onPress={oferta.onComprar} disabled={!oferta.puedeComprar || (busy !== null && busy !== 'compra')} loading={busy === 'compra'} />
      ) : null}
      <Button title={etiquetaSalida} variant="ghost" size="md" onPress={onSalir} loading={saliendo} disabled={busy !== null} />
      {oferta.hoja}
    </View>
  );
}

function Enlace({ etiqueta, onPress, rol = 'link', cargando }: { etiqueta: string; onPress: () => void; rol?: 'link' | 'button'; cargando?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={cargando} hitSlop={{ top: 0, bottom: 0, left: 8, right: 8 }} style={styles.enlaceHit} accessibilityRole={rol} accessibilityLabel={etiqueta}>
      <Text style={styles.enlace} maxFontSizeMultiplier={1.35}>
        {etiqueta}
      </Text>
    </Pressable>
  );
}

export function OfertaModosLegal({ oferta }: { oferta: EstadoOfertaModos }) {
  if (!oferta.disponible) return null;
  const letra = legalModo(oferta.producto.id, oferta.precio, oferta.periodoGratis, oferta.plataforma);
  return (
    <View style={styles.legal}>
      {letra ? <Text style={styles.letra}>{letra}</Text> : null}
      <View style={styles.enlaces}>
        {/* i18n-ok: pantalla de compra, en español como ProOffer */}
        <Enlace etiqueta="Restaurar compras" rol="button" onPress={oferta.onRestaurar} cargando={oferta.busy !== null} />
        {/* i18n-ok: pantalla de compra, en español como ProOffer */}
        <Enlace etiqueta="Términos" onPress={() => oferta.onAbrir(LEGAL_URLS.terminos)} />
        {/* i18n-ok: pantalla de compra, en español como ProOffer */}
        <Enlace etiqueta="Privacidad" onPress={() => oferta.onAbrir(LEGAL_URLS.privacidad)} />
        {/* i18n-ok: pantalla de compra, en español como ProOffer */}
        {oferta.plataforma === 'ios' ? <Enlace etiqueta="EULA de Apple" onPress={() => oferta.onAbrir(LEGAL_URLS.eulaApple)} /> : null}
      </View>
      {oferta.avisoEnlace ? (
        <Text style={styles.aviso} accessibilityRole="alert">
          {/* i18n-ok: pantalla de compra, en español como ProOffer */}
          No se ha podido abrir el enlace.
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
  return (
    <View>
      <OfertaModosCuerpo oferta={oferta} />
      <OfertaModosAcciones oferta={oferta} etiquetaSalida={etiquetaSalida} onSalir={onSalir} />
      <OfertaModosLegal oferta={oferta} />
    </View>
  );
}

const lectura = { fontFamily: tipo.bodySm.family, fontSize: tipo.bodySm.size, lineHeight: tipo.bodySm.lineHeight } as const;

const styles = StyleSheet.create({
  cuerpo: { gap: space.s3 },
  segmentos: { flexDirection: 'row', gap: space.s2 },
  segmento: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderWidth: stroke.hairline, borderColor: ink.ink4 },
  segmentoActivo: { borderWidth: stroke.rule, borderColor: ink.ink10 },
  segmentoTexto: { fontFamily: tipo.headline.family, fontSize: 15, lineHeight: 20, color: ink.ink8 },
  segmentoTextoActivo: { color: ink.ink10 },
  opcion: { padding: space.s4, backgroundColor: ink.ink1, borderWidth: stroke.hairline, borderColor: ink.ink4 },
  opcionActiva: { borderWidth: stroke.frame, borderColor: ink.ink10, padding: space.s4 - 2 },
  rotulo: { fontFamily: tipo.label.family, fontSize: tipo.label.size, lineHeight: tipo.label.lineHeight, letterSpacing: tipo.label.tracking, color: ink.ink6, textTransform: 'uppercase', marginBottom: space.s1 },
  opcionFila: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: space.s3 },
  opcionTitulo: { flex: 1, minWidth: 0, fontFamily: tipo.headline.family, fontSize: tipo.headline.size, lineHeight: tipo.headline.lineHeight, color: ink.ink9 },
  importe: { alignItems: 'flex-end', maxWidth: '55%' },
  cifra: { fontFamily: tipo.cifra.family, fontSize: tipo.cifra.size, lineHeight: tipo.cifra.lineHeight, color: ink.ink10 },
  porPeriodo: { ...lectura, color: ink.ink8 },
  huecoPrecio: { width: 96, height: 36, backgroundColor: ink.ink2 },
  nota: { ...lectura, color: ink.ink8, marginTop: space.s1 },
  chips: { flexDirection: 'row', gap: space.s2, marginTop: space.s3 },
  chip: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderWidth: stroke.hairline, borderColor: ink.ink4, paddingHorizontal: 2 },
  chipActivo: { borderWidth: stroke.rule, borderColor: ink.ink10 },
  chipTexto: { fontFamily: tipo.headline.family, fontSize: 12, lineHeight: 16, color: ink.ink8 },
  chipTextoActivo: { color: ink.ink10 },
  pasos: { flexDirection: 'row', gap: space.s3 },
  paso: { flex: 1 },
  pasoDia: { fontFamily: tipo.headline.family, fontSize: 16, lineHeight: 22, color: ink.ink9 },
  acciones: { gap: space.s2, marginTop: space.s4 },
  aviso: { ...lectura, color: ink.ink9, borderLeftWidth: 2, borderLeftColor: ink.ink6, paddingLeft: 10 },
  legal: { marginTop: space.s3 },
  letra: { ...lectura, color: ink.ink6 },
  enlaces: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', columnGap: space.s4, marginTop: space.s2 },
  enlaceHit: { minHeight: 44, justifyContent: 'center' },
  enlace: { ...lectura, color: ink.ink8, textDecorationLine: 'underline' },
  lista: { gap: space.s2 },
  listaFila: { paddingVertical: space.s3 },
  listaSep: { borderTopWidth: stroke.hairline, borderTopColor: ink.ink3 },
  listaPrecio: { ...lectura, color: ink.ink8 },
});
