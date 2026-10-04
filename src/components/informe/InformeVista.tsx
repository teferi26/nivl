// NIVL · Informe: la vista (patrón L-RADICAL §C, FASE3 Lote F). Pura: todo
// llega por props desde useInforme (o desde la galería con datos de
// mentira); las cuentas, de derivarInforme.
//
// De arriba abajo: el encabezado grabado («Progreso» / «INFORME») con
// meandro; la franja XP · Misiones · Vs. previa y la Barra de evidencia; la lectura
// semanal; «El sistema se ajusta» (sin análisis, la INVERSIÓN de la
// pantalla es «Pedir análisis al oráculo»; con análisis, filas con hairline
// y «Aplicar»/«Crear» en contorno); el XP por estadística con Barra estática
// (la dominante en blanco, el resto en ink8) y el mapa de 13 semanas en la
// escala de tinta.

import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import {
  Barra,
  CargaArena,
  EncabezadoArena,
  Entrada,
  ErrorSistema,
  FranjaCifras,
  TarjetaArena,
} from '@/components/arena';
import { Heatmap } from '@/components/Heatmap';
import { Button, EmptyState, Screen, Section } from '@/components/ui';
import { SIN_DATO } from '@/components/ui/sinDato';
import { ink, space, stroke, type as tipo } from '@/design/tokens';
import { DIFFICULTY_LABEL, STAT_LABEL, STATS } from '@/lib/game';
import type { WeeklyAdvice } from '@/lib/oracle';
import type { DatosInforme } from './derivarInforme';

export interface InformeVistaProps {
  /** Hasta la primera carga buena se pintan huecos. */
  cargado: boolean;
  errorCarga: string | null;
  /** «Hoy» (AAAA-MM-DD): el último día del mapa. */
  hoy: string;
  datos: DatosInforme;
  advice: WeeklyAdvice | null;
  /** Ids de ajustes aplicados y claves `new-<i>` de misiones creadas. */
  aplicados: Set<string>;
  /** Los que están en curso (cerrojo por clave): su botón muestra la carga. */
  aplicando: Set<string>;
  consultando: boolean;
  /** El silencio del Oráculo, ya escrito para el usuario. */
  errorOraculo: string | null;
  refrescando: boolean;
  acciones: {
    onVolver: () => void;
    onRefrescar: () => void;
    onReintentar: () => void;
    onConsultar: () => void;
    onAplicar: (adj: WeeklyAdvice['adjustments'][number]) => void;
    onCrear: (q: WeeklyAdvice['new_quests'][number], key: string) => void;
  };
}

const BOTON = 44;

function FilaAjuste({
  icono,
  titulo,
  detalle,
  hecho,
  rotuloBoton,
  primera,
  cargando,
  onPress,
}: {
  icono: keyof typeof Ionicons.glyphMap;
  titulo: string;
  detalle: string;
  hecho: boolean;
  rotuloBoton: string;
  primera: boolean;
  cargando: boolean;
  onPress: () => void;
}) {
  return (
    <View style={[styles.fila, !primera && styles.conRegla]}>
      <View style={styles.icono}>
        <Ionicons name={icono} size={18} color={hecho ? ink.ink6 : ink.ink9} />
      </View>
      <View style={styles.filaTexto} accessible accessibilityLabel={`${titulo}. ${detalle}${hecho ? '. Hecho' : ''}`}>
        <Text style={[styles.filaTitulo, hecho && styles.hecho]} numberOfLines={2} maxFontSizeMultiplier={1.35}>
          {titulo}
        </Text>
        <Text style={styles.filaDetalle} maxFontSizeMultiplier={1.6}>
          {detalle}
        </Text>
      </View>
      {hecho ? (
        <View style={styles.marcaHecho} accessibilityElementsHidden importantForAccessibility="no">
          <Ionicons name="checkmark-circle" size={22} color={ink.ink10} />
        </View>
      ) : (
        <Button
          title={rotuloBoton}
          variant="secondary"
          size="sm"
          loading={cargando}
          accessibilityLabel={`${rotuloBoton}: ${titulo}`}
          onPress={onPress}
        />
      )}
    </View>
  );
}

export function InformeVista({
  cargado,
  errorCarga,
  hoy,
  datos,
  advice,
  aplicados,
  aplicando,
  consultando,
  errorOraculo,
  refrescando,
  acciones,
}: InformeVistaProps) {
  const [anchoMapa, setAnchoMapa] = useState(0);
  const medirMapa = (e: LayoutChangeEvent) => setAnchoMapa(Math.round(e.nativeEvent.layout.width));

  const encabezado = (
    <Entrada indice={0}>
      <EncabezadoArena
        onVolver={acciones.onVolver}
        eyebrow="Progreso"
        titulo="Informe"
        subtitulo={cargado ? datos.subtitulo : undefined}
        meandro
      />
    </Entrada>
  );

  if (!cargado) {
    return (
      <Screen>
        {encabezado}
        {errorCarga ? (
          <ErrorSistema mensaje={errorCarga} onReintentar={acciones.onReintentar} />
        ) : (
          <CargaArena etiqueta="Cargando el informe" formas={['franja', 'rotulo', 'tarjeta', 'filas']} />
        )}
      </Screen>
    );
  }

  const { delta, xpByStat, topStat } = datos;
  const pendientes = advice
    ? advice.adjustments.filter((a) => !aplicados.has(a.quest_id)).length +
      advice.new_quests.filter((_, i) => !aplicados.has(`new-${i}`)).length
    : 0;
  const maxStat = Math.max(1, xpByStat[topStat]);
  const hayMapa = Object.keys(datos.byDay).length > 0;

  const falloOraculo = errorOraculo ? (
    <ErrorSistema
      compacto
      rotulo="El oráculo guarda silencio"
      mensaje={errorOraculo}
      onReintentar={acciones.onConsultar}
      reintentando={consultando}
      style={styles.falloOraculo}
    />
  ) : null;

  return (
    <Screen refreshing={refrescando} onRefresh={acciones.onRefrescar}>
      {encabezado}

      {errorCarga ? (
        <ErrorSistema compacto mensaje={errorCarga} onReintentar={acciones.onReintentar} style={styles.bloque} />
      ) : null}

      <Entrada indice={1} style={styles.bloque}>
        <FranjaCifras
          cifras={[
            { valor: datos.xpWeek, rotulo: 'XP · 7 días' },
            { valor: datos.misiones, rotulo: 'Misiones' },
            delta === null
              ? { valor: SIN_DATO, rotulo: 'Vs. previa', etiqueta: 'Frente a la semana previa: sin dato' }
              : {
                  valor: `${delta >= 0 ? '+' : ''}${delta}`,
                  sufijo: '%',
                  rotulo: 'Vs. previa',
                  etiqueta: `Frente a la semana previa: ${delta >= 0 ? 'más' : 'menos'} ${Math.abs(delta)} %`,
                },
          ]}
        />
        <View style={styles.evidencia}>
          <View style={styles.evidenciaCabecera}>
            <Text style={styles.evidenciaRotulo} maxFontSizeMultiplier={1.35}>
              Misiones con evidencia
            </Text>
            <Text style={styles.evidenciaCifra} maxFontSizeMultiplier={1.35}>
              {datos.evidencePct} %
            </Text>
          </View>
          <Barra ratio={datos.evidencePct / 100} alto={4} etiqueta="Misiones de la semana con evidencia" />
        </View>
      </Entrada>

      <Entrada indice={2}>
        <Section title="Lectura semanal">
          <Text style={styles.lectura} maxFontSizeMultiplier={1.6}>
            {datos.narrative}
          </Text>
        </Section>
      </Entrada>

      <Entrada indice={3}>
        <Section title="El sistema se ajusta" meta={pendientes > 0 ? `${pendientes} por aplicar` : undefined}>
          {!advice ? (
            <TarjetaArena variante="contorno">
              <EmptyState
                compact
                icon="sparkles-outline"
                title="Sin análisis todavía"
                body="El oráculo lee tus últimos 14 días y propone ajustes: bajar lo que siempre falla, subir lo que ya es trivial, cubrir huecos."
              />
              <Button
                title="Pedir análisis al oráculo"
                onPress={acciones.onConsultar}
                loading={consultando}
                icon="sparkles-outline"
              />
              {falloOraculo}
            </TarjetaArena>
          ) : (
            <View style={styles.pila}>
              <TarjetaArena variante="contorno" rotulo="Lectura del oráculo">
                <Text style={styles.lectura} maxFontSizeMultiplier={1.6}>
                  {advice.analysis}
                </Text>
              </TarjetaArena>
              {advice.adjustments.length > 0 || advice.new_quests.length > 0 ? (
                <View>
                  {advice.adjustments.map((adj, i) => (
                    <FilaAjuste
                      key={adj.quest_id}
                      primera={i === 0}
                      icono={adj.action === 'desactivar' ? 'pause-circle-outline' : 'swap-vertical-outline'}
                      titulo={adj.quest_title}
                      detalle={`${
                        adj.action === 'desactivar'
                          ? 'Desactivar'
                          : `Dificultad → ${adj.new_difficulty ? DIFFICULTY_LABEL[adj.new_difficulty] : ''}`
                      } · ${adj.reasoning}`}
                      hecho={aplicados.has(adj.quest_id)}
                      rotuloBoton="Aplicar"
                      cargando={aplicando.has(adj.quest_id)}
                      onPress={() => acciones.onAplicar(adj)}
                    />
                  ))}
                  {advice.new_quests.map((q, i) => {
                    const key = `new-${i}`;
                    return (
                      <FilaAjuste
                        key={key}
                        primera={advice.adjustments.length === 0 && i === 0}
                        icono="add-circle-outline"
                        titulo={q.title}
                        detalle={`Nueva · ${q.stat} · ${DIFFICULTY_LABEL[q.difficulty]} · ${q.reasoning}`}
                        hecho={aplicados.has(key)}
                        rotuloBoton="Crear"
                        cargando={aplicando.has(key)}
                        onPress={() => acciones.onCrear(q, key)}
                      />
                    );
                  })}
                </View>
              ) : null}
              {advice.advice ? (
                <Text style={styles.consejo} maxFontSizeMultiplier={1.6}>
                  {advice.advice}
                </Text>
              ) : null}
              <Button
                title="Nuevo análisis"
                variant="secondary"
                onPress={acciones.onConsultar}
                loading={consultando}
                icon="refresh-outline"
              />
              {falloOraculo}
            </View>
          )}
        </Section>
      </Entrada>

      <Entrada indice={4}>
        <Section title="XP por estadística" meta="7 días">
          {STATS.map((s, i) => {
            const dominante = s === topStat && xpByStat[s] > 0;
            return (
              <View key={s} style={[styles.stat, i > 0 && styles.conRegla]}>
                <View style={styles.statCabecera}>
                  <Text style={[styles.statAbbr, dominante && styles.statTop]} maxFontSizeMultiplier={1.35}>
                    {s}
                    <Text style={styles.statNombre}> · {STAT_LABEL[s]}</Text>
                  </Text>
                  {dominante ? (
                    <Text style={styles.dominante} maxFontSizeMultiplier={1.35}>
                      Dominante
                    </Text>
                  ) : null}
                  <Text style={[styles.statXp, dominante && styles.statTop]} maxFontSizeMultiplier={1.35}>
                    {xpByStat[s]} XP
                  </Text>
                </View>
                <Barra
                  ratio={xpByStat[s] / maxStat}
                  alto={4}
                  tono={dominante ? 'blanco' : 'ink8'}
                  etiqueta={`${STAT_LABEL[s]}: ${xpByStat[s]} XP esta semana`}
                />
              </View>
            );
          })}
        </Section>
      </Entrada>

      <Entrada indice={5}>
        <Section title="Mapa de actividad" meta="13 semanas">
          {hayMapa ? (
            <View onLayout={medirMapa}>
              {anchoMapa > 0 ? <Heatmap counts={datos.byDay} hoy={hoy} ancho={anchoMapa} /> : null}
            </View>
          ) : (
            <TarjetaArena variante="contorno">
              <EmptyState compact icon="grid-outline" title="Todavía en blanco" body="Cada misión completada enciende un día." />
            </TarjetaArena>
          )}
        </Section>
      </Entrada>
    </Screen>
  );
}

const styles = StyleSheet.create({
  bloque: { marginBottom: space.s8 },
  pila: { gap: space.s4 },
  evidencia: { marginTop: space.s5, gap: space.s2 },
  evidenciaCabecera: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: space.s3 },
  evidenciaRotulo: {
    fontFamily: tipo.micro.family,
    fontSize: tipo.micro.size,
    lineHeight: tipo.micro.lineHeight,
    letterSpacing: tipo.micro.tracking,
    textTransform: 'uppercase',
    color: ink.ink6,
  },
  evidenciaCifra: { fontFamily: 'Cinzel_600SemiBold', fontSize: 14, lineHeight: 20, color: ink.ink10 },
  lectura: { fontFamily: tipo.body.family, fontSize: tipo.body.size, lineHeight: tipo.body.lineHeight, color: ink.ink9 },
  consejo: { fontFamily: tipo.bodySm.family, fontSize: tipo.bodySm.size, lineHeight: tipo.bodySm.lineHeight, color: ink.ink8 },
  falloOraculo: { marginTop: space.s4 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: space.s3, paddingVertical: space.s3, minHeight: 64 },
  conRegla: { borderTopWidth: stroke.hairline, borderTopColor: ink.ink3 },
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
  hecho: { color: ink.ink6, textDecorationLine: 'line-through' },
  filaDetalle: { fontFamily: tipo.bodySm.family, fontSize: tipo.bodySm.size, lineHeight: tipo.bodySm.lineHeight, color: ink.ink6 },
  marcaHecho: { width: BOTON, height: BOTON, alignItems: 'center', justifyContent: 'center' },
  stat: { paddingVertical: space.s3, gap: space.s2 },
  statCabecera: { flexDirection: 'row', alignItems: 'baseline', gap: space.s2 },
  statAbbr: { flex: 1, minWidth: 0, fontFamily: 'Cinzel_600SemiBold', fontSize: 14, lineHeight: 20, letterSpacing: 1, color: ink.ink8 },
  statTop: { color: ink.ink10 },
  statNombre: { fontFamily: tipo.bodySm.family, fontSize: 13, letterSpacing: 0, color: ink.ink6 },
  dominante: {
    fontFamily: tipo.micro.family,
    fontSize: tipo.micro.size,
    lineHeight: tipo.micro.lineHeight,
    letterSpacing: tipo.micro.tracking,
    textTransform: 'uppercase',
    color: ink.ink8,
  },
  statXp: { fontFamily: 'Cinzel_600SemiBold', fontSize: 14, lineHeight: 20, color: ink.ink8 },
});
