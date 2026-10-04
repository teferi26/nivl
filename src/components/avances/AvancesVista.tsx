// NIVL · Avances: la vista (patrón L-RADICAL §C, FASE3 Lote F). Pura: todo
// llega por props desde useAvances (o desde la galería con datos de mentira).
// Los dos huecos con efectos propios (el aviso de salud y la fila de fotos)
// llegan hechos como `avisoSalud` y `fotos`; en la galería, null o un doble.
//
// De arriba abajo: el encabezado grabado («Progreso» / «AVANCES») con la
// acción SÓLIDA «Nueva meta» (la INVERSIÓN de la pantalla) y meandro; con
// salud aceptada, la franja Peso · Metas · Logradas (los récords cuentan en su sección), el pesaje
// (Campo + secondary «Pesar +5 XP», o «Corregir» si ya hay pesaje hoy) y la
// curva del peso (línea ink10 sobre pista ink4); las metas activas en
// tarjetas de contorno con su Barra estática (la que se puede reclamar, en
// grano); las conseguidas y los récords en filas con hairline. Lo pagado se
// anuncia con un Toast en el overlay.

import Ionicons from '@expo/vector-icons/Ionicons';
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import {
  Barra,
  Campo,
  CargaArena,
  EncabezadoArena,
  Entrada,
  ErrorSistema,
  FranjaCifras,
  TarjetaArena,
} from '@/components/arena';
import { TrendLine } from '@/components/TrendLine';
import { Button, EmptyState, Screen, Section, Toast } from '@/components/ui';
import { SIN_DATO } from '@/components/ui/sinDato';
import { ink, space, stroke, type as tipo } from '@/design/tokens';
import { WEIGH_IN_XP } from '@/lib/game';
import { numeroES } from '@/lib/pagoActo';
import type { BodyMetric, Goal } from '@/lib/types';

export interface ToastAvances {
  /** Lo que se ve: «Pesaje · +5 XP». */
  texto: string;
  /** Lo que oye el lector: el desglose entero de lo pagado. */
  anuncio: string;
}

/** Una meta activa con su valor actual ya resuelto (currentGoalValue). */
export interface MetaVista {
  goal: Goal;
  actual: number | null;
  /** 0..1 (goalProgress). */
  progreso: number;
}

export interface AvancesVistaProps {
  /** Hasta la primera carga buena se pintan huecos. */
  cargado: boolean;
  errorCarga: string | null;
  saludAceptada: boolean;
  weights: BodyMetric[];
  metas: MetaVista[];
  logradas: Goal[];
  prs: { exercise: string; weight: number }[];
  series: { exercise: string; values: number[] } | null;
  pesadoHoy: boolean;
  peso: string;
  errorPeso: string | null;
  pesando: boolean;
  refrescando: boolean;
  toast: ToastAvances | null;
  /** HealthConsentNotice (con su lógica intacta); solo sin salud aceptada. */
  avisoSalud: ReactNode;
  /** FilaFotosAvances; solo con salud aceptada. */
  fotos: ReactNode;
  acciones: {
    onVolver: () => void;
    onRefrescar: () => void;
    onReintentar: () => void;
    onPeso: (v: string) => void;
    onPesar: () => void;
    onNuevaMeta: () => void;
    onReclamar: (g: Goal) => void;
    onActualizar: (g: Goal) => void;
    onBorrar: (g: Goal) => void;
    onSerie: (exercise: string) => void;
    onToastHecho: () => void;
  };
}

const BOTON = 44;
const ALTO_CURVA = 90;
/** Etiqueta del Campo (16) + su hueco (8) + medio de la diferencia 48/44. */
const DESPEGUE_BOTON = 26;

const n = (v: number | null | undefined) => numeroES(v, 2);

function fechaCorta(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

/** Mide el ancho del padre para las curvas (el hueco real, no la ventana). */
function useAncho(): [number, (e: LayoutChangeEvent) => void] {
  const [ancho, setAncho] = useState(0);
  return [ancho, (e) => setAncho(Math.round(e.nativeEvent.layout.width))];
}

function TarjetaMeta({ m, acciones }: { m: MetaVista; acciones: AvancesVistaProps['acciones'] }) {
  const { goal: g, actual, progreso } = m;
  const hecha = progreso >= 1;
  const pct = Math.round(progreso * 100);
  return (
    <TarjetaArena variante={hecha ? 'grano' : 'contorno'} style={styles.meta}>
      <View style={styles.metaCabecera}>
        <Text style={styles.metaTitulo} numberOfLines={2} maxFontSizeMultiplier={1.35}>
          {g.title}
        </Text>
        <Text style={styles.metaPct} maxFontSizeMultiplier={1.2}>
          {pct} %
        </Text>
      </View>
      <View style={styles.metaBarra}>
        <Barra ratio={progreso} alto={6} etiqueta={`Progreso de ${g.title}`} />
      </View>
      <View style={styles.metaFila}>
        <Text
          style={styles.metaDetalle}
          maxFontSizeMultiplier={1.35}
          accessibilityLabel={`Empezó en ${n(g.start_value)}, va por ${actual === null ? 'sin dato' : n(actual)}, objetivo ${n(g.target_value)} ${g.unit}`}
        >
          {n(g.start_value)} → <Text style={styles.metaActual}>{actual === null ? SIN_DATO : n(actual)}</Text> →{' '}
          {n(g.target_value)} {g.unit}
        </Text>
        <Pressable
          onPress={() => acciones.onBorrar(g)}
          style={({ pressed }) => [styles.papelera, pressed && styles.pulsado]}
          accessibilityRole="button"
          accessibilityLabel={`Eliminar meta ${g.title}`}
        >
          <Ionicons name="trash-outline" size={18} color={ink.ink6} />
        </Pressable>
      </View>
      {hecha ? (
        <Button
          title="Reclamar"
          variant="secondary"
          size="sm"
          icon="ribbon-outline"
          onPress={() => acciones.onReclamar(g)}
          style={styles.metaBoton}
        />
      ) : g.metric_type === 'libre' ? (
        <Button
          title="Actualizar"
          variant="secondary"
          size="sm"
          onPress={() => acciones.onActualizar(g)}
          style={styles.metaBoton}
        />
      ) : null}
    </TarjetaArena>
  );
}

export function AvancesVista(p: AvancesVistaProps) {
  const { cargado, errorCarga, saludAceptada, weights, metas, logradas, prs, series, acciones } = p;
  const [anchoPeso, medirPeso] = useAncho();
  const [anchoSerie, medirSerie] = useAncho();

  const latestWeight = weights.length > 0 ? weights[weights.length - 1]!.weight_kg : null;
  const firstWeight = weights.length > 0 ? weights[0]!.weight_kg : null;
  const deltaPeso =
    latestWeight !== null && firstWeight !== null ? Math.round((latestWeight - firstWeight) * 10) / 10 : null;

  const subtitulo = !cargado
    ? undefined
    : !saludAceptada
      ? 'Tus metas generales, en una sola vista.'
      : latestWeight === null
        ? 'Registra tu primer pesaje: es tu línea de salida.'
        : `Último pesaje: ${n(latestWeight)} kg${
            deltaPeso !== null && deltaPeso !== 0
              ? ` (${deltaPeso > 0 ? '+' : ''}${n(deltaPeso)} kg en ${weights.length} pesajes)`
              : ''
          }.`;

  const encabezado = (
    <Entrada indice={0}>
      <EncabezadoArena
        onVolver={acciones.onVolver}
        eyebrow="Progreso"
        titulo="Avances"
        subtitulo={subtitulo}
        accion={{ icono: 'add', etiqueta: 'Nueva meta', onPress: acciones.onNuevaMeta, solida: true }}
        meandro
      />
    </Entrada>
  );

  const overlay = <Toast message={p.toast?.texto ?? null} anuncio={p.toast?.anuncio} onDone={acciones.onToastHecho} />;

  if (!cargado) {
    return (
      <Screen overlay={overlay}>
        {encabezado}
        {errorCarga ? (
          <ErrorSistema mensaje={errorCarga} onReintentar={acciones.onReintentar} />
        ) : (
          <CargaArena etiqueta="Cargando tus avances" formas={['franja', 'tarjeta', 'rotulo', 'filas']} />
        )}
      </Screen>
    );
  }

  return (
    <Screen refreshing={p.refrescando} onRefresh={acciones.onRefrescar} overlay={overlay}>
      {encabezado}

      {errorCarga ? (
        <ErrorSistema compacto mensaje={errorCarga} onReintentar={acciones.onReintentar} style={styles.bloque} />
      ) : null}

      {saludAceptada ? null : <View style={styles.bloque}>{p.avisoSalud}</View>}

      {saludAceptada ? (
        <Entrada indice={1} style={styles.cuerpo}>
          <FranjaCifras
            cifras={[
              latestWeight === null
                ? { valor: SIN_DATO, rotulo: 'Peso', etiqueta: 'Peso: sin pesajes todavía' }
                : { valor: n(latestWeight), sufijo: 'kg', rotulo: 'Peso', etiqueta: `Peso: ${n(latestWeight)} kilos` },
              { valor: metas.length, rotulo: 'Metas' },
              { valor: logradas.length, rotulo: 'Logradas' },
            ]}
          />

          <View style={styles.pesaje}>
            <Campo
              etiqueta="Peso de hoy (kg)"
              value={p.peso}
              onChangeText={acciones.onPeso}
              keyboardType="decimal-pad"
              placeholder="78,4"
              accessibilityLabel="Peso de hoy en kilogramos"
              error={p.errorPeso}
              estiloBloque={styles.pesajeCampo}
            />
            <View style={styles.pesajeBoton}>
              <Button
                title={p.pesadoHoy ? 'Corregir' : `Pesar · hasta +${WEIGH_IN_XP} XP`}
                variant="secondary"
                onPress={acciones.onPesar}
                loading={p.pesando}
              />
            </View>
          </View>

          {weights.length > 1 ? (
            <View style={styles.curva} onLayout={medirPeso}>
              <Text style={styles.rotulo} maxFontSizeMultiplier={1.35}>
                Peso · {weights.length} pesajes
              </Text>
              {anchoPeso > 0 ? (
                <TrendLine values={weights.map((w) => w.weight_kg)} width={anchoPeso} height={ALTO_CURVA} />
              ) : null}
            </View>
          ) : null}

          {p.fotos}
        </Entrada>
      ) : null}

      <Entrada indice={2}>
        <Section title="Metas" meta={metas.length > 0 ? `${metas.length} activas` : undefined}>
          {metas.length === 0 ? (
            <TarjetaArena variante="contorno">
              <EmptyState
                compact
                icon="flag-outline"
                title="Sin metas fijadas"
                body="Una meta es un número con fecha: leer doce libros, terminar cuatro cursos. Ponle cifra a tu objetivo."
                action={{ label: 'Fijar la primera', onPress: acciones.onNuevaMeta }}
              />
            </TarjetaArena>
          ) : (
            <View style={styles.metas}>
              {metas.map((m) => (
                <TarjetaMeta key={m.goal.id} m={m} acciones={acciones} />
              ))}
            </View>
          )}
        </Section>
      </Entrada>

      {logradas.length > 0 ? (
        <Entrada indice={3}>
          <Section title="Conseguidas" meta={`${logradas.length}`} tone="logro">
            {logradas.map((g, i) => (
              <View
                key={g.id}
                style={[styles.fila, i > 0 && styles.conRegla]}
                accessible
                accessibilityLabel={`${g.title}, conseguida${g.achieved_at ? ` el ${fechaCorta(g.achieved_at)}` : ''}. ${n(g.target_value)} ${g.unit}`}
              >
                <View style={styles.icono}>
                  <Ionicons name="ribbon-outline" size={18} color={ink.ink8} />
                </View>
                <View style={styles.filaTexto}>
                  <Text style={styles.filaTitulo} numberOfLines={2} maxFontSizeMultiplier={1.35}>
                    {g.title}
                  </Text>
                  {g.achieved_at ? (
                    <Text style={styles.filaDetalle} maxFontSizeMultiplier={1.35}>
                      Conseguida el {fechaCorta(g.achieved_at)}
                    </Text>
                  ) : null}
                </View>
                <Text style={styles.cifra} maxFontSizeMultiplier={1.35}>
                  {n(g.target_value)} {g.unit}
                </Text>
              </View>
            ))}
          </Section>
        </Entrada>
      ) : null}

      {saludAceptada ? (
        <Entrada indice={4}>
          <Section title="Récords personales" meta={prs.length > 0 ? `${prs.length}` : undefined}>
            {prs.length === 0 ? (
              <TarjetaArena variante="contorno">
                <EmptyState
                  compact
                  icon="barbell-outline"
                  title="Sin récords todavía"
                  body="Aparecen aquí al registrar sesiones de gimnasio con peso."
                />
              </TarjetaArena>
            ) : (
              prs.map((r, i) => {
                const abierta = series?.exercise === r.exercise;
                return (
                  <Pressable
                    key={r.exercise}
                    onPress={() => acciones.onSerie(r.exercise)}
                    style={({ pressed }) => [styles.fila, i > 0 && styles.conRegla, pressed && styles.pulsado]}
                    accessibilityRole="button"
                    accessibilityLabel={`${r.exercise}: ${n(r.weight)} kilos. Ver progresión`}
                    accessibilityState={{ expanded: abierta }}
                  >
                    {abierta ? <View style={styles.marcaAbierta} /> : null}
                    <View style={styles.filaTexto}>
                      <Text style={styles.filaTitulo} numberOfLines={1} maxFontSizeMultiplier={1.35}>
                        {r.exercise}
                      </Text>
                      {abierta ? (
                        <Text style={styles.filaDetalle} maxFontSizeMultiplier={1.35}>
                          Progresión abierta
                        </Text>
                      ) : null}
                    </View>
                    <Text style={styles.cifra} maxFontSizeMultiplier={1.35}>
                      {n(r.weight)} kg
                    </Text>
                    <Ionicons name="chevron-forward" size={18} color={ink.ink6} />
                  </Pressable>
                );
              })
            )}
            {series ? (
              <TarjetaArena variante="piedra" rotulo={`Progresión · ${series.exercise}`} style={styles.serie}>
                <View onLayout={medirSerie}>
                  {anchoSerie > 0 ? <TrendLine values={series.values} width={anchoSerie} height={ALTO_CURVA} /> : null}
                </View>
              </TarjetaArena>
            ) : null}
          </Section>
        </Entrada>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  bloque: { marginBottom: space.s6 },
  cuerpo: { marginBottom: space.s8, gap: space.s6 },
  pesaje: { flexDirection: 'row', alignItems: 'flex-start', gap: space.s3 },
  pesajeCampo: { flex: 1, minWidth: 0 },
  pesajeBoton: { paddingTop: DESPEGUE_BOTON },
  curva: { paddingTop: space.s4, borderTopWidth: stroke.hairline, borderTopColor: ink.ink3 },
  rotulo: {
    fontFamily: tipo.micro.family,
    fontSize: tipo.micro.size,
    lineHeight: tipo.micro.lineHeight,
    letterSpacing: tipo.micro.tracking,
    textTransform: 'uppercase',
    color: ink.ink6,
    marginBottom: space.s3,
  },
  metas: { gap: space.s3 },
  meta: { marginBottom: 0 },
  metaCabecera: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: space.s3 },
  metaTitulo: {
    flex: 1,
    minWidth: 0,
    fontFamily: tipo.headline.family,
    fontSize: 17,
    lineHeight: 22,
    letterSpacing: tipo.headline.tracking,
    color: ink.ink9,
  },
  metaPct: { fontFamily: tipo.number.family, fontSize: 20, lineHeight: 24, color: ink.ink10 },
  metaBarra: { marginTop: space.s3 },
  metaFila: { flexDirection: 'row', alignItems: 'center', gap: space.s2, marginTop: space.s1, marginBottom: -space.s2 },
  metaDetalle: {
    flex: 1,
    minWidth: 0,
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink8,
  },
  metaActual: { fontFamily: 'Outfit_700Bold', color: ink.ink10 },
  metaBoton: { alignSelf: 'flex-start', marginTop: space.s3 },
  papelera: { width: BOTON, height: BOTON, alignItems: 'center', justifyContent: 'center', marginRight: -space.s3 },
  pulsado: { backgroundColor: ink.ink2 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: space.s3, minHeight: 56, paddingVertical: space.s2 },
  conRegla: { borderTopWidth: stroke.hairline, borderTopColor: ink.ink3 },
  marcaAbierta: { position: 'absolute', left: -space.s3, top: space.s2, bottom: space.s2, width: stroke.rule, backgroundColor: ink.ink10 },
  icono: {
    width: BOTON,
    height: BOTON,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: stroke.hairline,
    borderColor: ink.ink4,
  },
  filaTexto: { flex: 1, minWidth: 0, gap: 2 },
  filaTitulo: { fontFamily: 'Outfit_600SemiBold', fontSize: 16, lineHeight: 22, color: ink.ink9 },
  filaDetalle: {
    fontFamily: tipo.micro.family,
    fontSize: tipo.micro.size,
    lineHeight: tipo.micro.lineHeight,
    letterSpacing: tipo.micro.tracking,
    textTransform: 'uppercase',
    color: ink.ink6,
  },
  cifra: { fontFamily: 'Cinzel_600SemiBold', fontSize: 15, lineHeight: 20, color: ink.ink10 },
  serie: { marginTop: space.s4 },
});
