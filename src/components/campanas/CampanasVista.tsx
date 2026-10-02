// NIVL · La vista de la lista de campañas (L-RADICAL §B.7 y §C): pura, solo
// props. Los datos y los efectos viven en useCampanas; la galería
// (/kit/pantallas) la pinta con datos de mentira (demo.tsx).
//
// Composición de la arena: encabezado grabado con el meandro, franja de
// cifras (Abiertas · Despejadas · Botín), cada campaña abierta como una losa
// de piedra con zócalo y su estandarte, y las despejadas como inscripciones
// bajo el rótulo de logro. La única inversión de la pantalla es «Abrir
// campaña»: el botón del encabezado si hay abiertas o, si no hay ninguna, el
// botón sólido del vacío (nunca los dos a la vez).

import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Barra, EncabezadoArena, Entrada, FranjaCifras, Meandro, TarjetaArena, formatoMiles } from '@/components/arena';
import { Button, EmptyState, Screen, Section, Skeleton, Tag } from '@/components/ui';
import { ink, space, stroke, type as tipo } from '@/design/tokens';
import { useAnchoUtil } from '@/design/useSizeClass';
import { DUNGEON_CLEAR_XP } from '@/lib/game';
import type { Dungeon } from '@/lib/types';
import { Estandarte, grosorDeRango } from './Estandarte';
import { diasHasta, fechaCorta } from './plazo';

export interface CampanaResumen extends Dungeon {
  total: number;
  doneCount: number;
}

export interface CampanasVistaProps {
  /** Hasta la primera carga: encabezado y huecos. */
  cargado: boolean;
  error: string | null;
  /** `kindMeta(kind).campaignsLabel`: «Proyectos», «Asignaturas»… null = aún
   *  no se sabe el perfil de uso: el título va en hueco (no salta de
   *  CAMPAÑAS a PROYECTOS al cargar). */
  titulo: string | null;
  subtitulo: string;
  campanas: CampanaResumen[];
  onNueva: () => void;
  onAbrir: (id: string) => void;
  onReintentar: () => void;
}

/** Desde este hueco útil, las losas abiertas van a dos columnas. */
const ANCHO_DOS_COLUMNAS = 700;
/** Losas con entrada animada; el resto aparece en su sitio. */
const TOPE_ENTRADA = 8;

export function CampanasVista(p: CampanasVistaProps) {
  const ancho = useAnchoUtil();
  const abiertas = p.campanas.filter((d) => d.status === 'active');
  const despejadas = p.campanas.filter((d) => d.status === 'cleared');
  const botinTotal = despejadas.reduce((s, d) => s + DUNGEON_CLEAR_XP[d.rank], 0);
  const caido = p.cargado && p.error != null && p.campanas.length === 0;
  const listo = p.cargado && !caido;
  const dosColumnas = ancho >= ANCHO_DOS_COLUMNAS;
  // Con el perfil «general» el título ya es «Campañas»: el eyebrow sobra.
  const eyebrow = p.titulo != null && p.titulo.toLowerCase() === 'campañas' ? undefined : 'Campañas';
  // Sin campañas no hay nada que contar: la franja de 0 · 0 · 0 no se pinta.
  const conFranja = p.campanas.length > 0;
  // Una recarga ha fallado pero hay campañas de antes: se enseñan con aviso.
  const avisoRecarga = listo && p.error != null;

  return (
    <Screen>
      <Entrada indice={0}>
        {p.titulo == null ? (
          <EncabezadoCargando />
        ) : (
          <EncabezadoArena
            eyebrow={eyebrow}
            titulo={p.titulo}
            subtitulo={p.subtitulo}
            meandro
            accion={{
              icono: 'flag-outline',
              etiqueta: 'Abrir una campaña nueva',
              onPress: p.onNueva,
              // La inversión: con el vacío a la vista, la lleva su botón.
              solida: listo && abiertas.length > 0,
            }}
          />
        )}
      </Entrada>

      {!p.cargado ? (
        <View accessibilityRole="progressbar" accessibilityLabel="Cargando tus campañas">
          <Skeleton height={52} style={styles.skFranja} />
          <Skeleton height={11} width={90} style={styles.skEyebrow} />
          <Skeleton height={132} style={styles.skCard} />
          <Skeleton height={132} style={styles.skCard} />
        </View>
      ) : null}

      {caido ? (
        <TarjetaArena variante="contorno">
          <EmptyState
            compact
            icon="cloud-offline-outline"
            title="El sistema no responde"
            body={p.error ?? undefined}
            action={{ label: 'Reintentar', onPress: p.onReintentar }}
          />
        </TarjetaArena>
      ) : null}

      {listo ? (
        <>
          {avisoRecarga ? (
            <View style={styles.aviso} accessibilityRole="alert">
              <Ionicons name="cloud-offline-outline" size={14} color={ink.ink6} />
              <Text style={[styles.micro, styles.avisoTexto]} maxFontSizeMultiplier={1.35} numberOfLines={2}>
                La última recarga ha fallado: puede que no esté al día.
              </Text>
              <Pressable
                onPress={p.onReintentar}
                accessibilityRole="button"
                accessibilityLabel="Reintentar la carga"
                hitSlop={12}
              >
                <Text style={[styles.micro, styles.avisoAccion]} maxFontSizeMultiplier={1.35}>
                  REINTENTAR
                </Text>
              </Pressable>
            </View>
          ) : null}

          {conFranja ? (
            <Entrada indice={1} style={styles.franja}>
              <FranjaCifras
                cifras={[
                  { valor: abiertas.length, rotulo: 'Abiertas' },
                  { valor: despejadas.length, rotulo: 'Despejadas' },
                  {
                    valor: botinTotal,
                    rotulo: 'Botín',
                    sufijo: ' XP',
                    etiqueta: `Botín ganado: ${formatoMiles(botinTotal)} XP`,
                  },
                ]}
              />
            </Entrada>
          ) : null}

          <Section title="Abiertas" meta={abiertas.length > 0 ? `${abiertas.length}` : undefined}>
            {abiertas.length === 0 ? (
              <Entrada indice={2}>
                <TarjetaArena variante="contorno" remaches>
                  {/* El estandarte sin letra: el paño espera su campaña. */}
                  <View style={styles.vacio}>
                    <Estandarte letra="" ancho={72} grosor={1} />
                    <Text style={styles.vacioTitulo} accessibilityRole="header" maxFontSizeMultiplier={1.35}>
                      Ninguna campaña abierta
                    </Text>
                    <Text style={styles.vacioTexto}>
                      Cada proyecto u objetivo grande es una campaña: tareas, un jefe final y una fecha. Al despejarla hay
                      botín.
                    </Text>
                    <Button title="Abrir la primera" icon="flag-outline" onPress={p.onNueva} style={styles.vacioBoton} />
                  </View>
                </TarjetaArena>
              </Entrada>
            ) : (
              <View style={dosColumnas ? styles.rejilla : undefined}>
                {abiertas.map((d, i) => {
                  const celda = dosColumnas ? styles.celdaRejilla : styles.celda;
                  const losa = <LosaCampana campana={d} onPress={() => p.onAbrir(d.id)} />;
                  // Solo las 8 primeras entran en cascada (L-RADICAL, riesgo 1).
                  return i < TOPE_ENTRADA ? (
                    <Entrada key={d.id} indice={2 + i} style={celda}>
                      {losa}
                    </Entrada>
                  ) : (
                    <View key={d.id} style={celda}>
                      {losa}
                    </View>
                  );
                })}
              </View>
            )}
          </Section>

          {despejadas.length > 0 ? (
            <Entrada indice={3}>
              <Section
                title="Despejadas"
                meta={`${despejadas.length} · ${formatoMiles(botinTotal)} XP`}
                tone="logro"
              >
                {despejadas.map((d, i) => (
                  <FilaDespejada key={d.id} campana={d} primera={i === 0} onPress={() => p.onAbrir(d.id)} />
                ))}
              </Section>
            </Entrada>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}

/** El encabezado mientras no se sabe el perfil de uso: huecos, sin título que salte. */
function EncabezadoCargando() {
  return (
    <View style={styles.encabezado}>
      <Skeleton height={12} width={90} style={styles.skEyebrow} />
      <Skeleton height={tipo.rank.lineHeight} width={200} />
      <Skeleton height={14} width="80%" style={styles.skSubtitulo} />
      <Meandro alto={8} style={styles.skMeandro} />
    </View>
  );
}

/** Una campaña abierta: losa de piedra con zócalo, estandarte y su avance. */
function LosaCampana({ campana: d, onPress }: { campana: CampanaResumen; onPress: () => void }) {
  const plazo = diasHasta(d.deadline);
  const ratio = d.total > 0 ? d.doneCount / d.total : 0;
  const pct = Math.round(ratio * 100);
  const botin = DUNGEON_CLEAR_XP[d.rank];
  return (
    <TarjetaArena
      variante="piedra"
      zocalo
      onPress={onPress}
      accessibilityLabel={`Abrir la campaña ${d.title}, rango ${d.rank}. ${d.doneCount} de ${d.total} tareas${plazo ? `, ${plazo.texto}` : ''}.`}
    >
      <View style={styles.losaFila}>
        <Estandarte letra={d.rank} ancho={40} grosor={grosorDeRango(d.rank)} />
        <View style={styles.losaCuerpo}>
          <Text style={styles.losaTitulo} numberOfLines={2}>
            {d.title}
          </Text>
          <View style={styles.losaMeta}>
            <Text style={styles.micro}>
              {d.doneCount}/{d.total} tareas · {d.stat}
            </Text>
            {plazo ? (
              plazo.urgente ? (
                <Tag tone="alerta">{plazo.texto}</Tag>
              ) : (
                <View style={styles.plazo}>
                  <Ionicons name="time-outline" size={12} color={ink.ink6} />
                  <Text style={styles.micro}>{plazo.texto}</Text>
                </View>
              )
            ) : null}
          </View>
        </View>
        <Ionicons name="chevron-forward" size={18} color={ink.ink6} />
      </View>
      <View style={styles.avance}>
        <Barra ratio={ratio} alto={4} etiqueta={`Avance de la campaña ${d.title}`} />
        <View style={styles.avancePie}>
          <Text style={styles.pct} maxFontSizeMultiplier={1.35}>
            {pct}%
          </Text>
          <Text style={[styles.micro, styles.mayus]}>Botín {formatoMiles(botin)} XP</Text>
        </View>
      </View>
    </TarjetaArena>
  );
}

/** Una campaña despejada: inscripción con su estandarte fino y el botín cobrado. */
function FilaDespejada({ campana: d, primera, onPress }: { campana: CampanaResumen; primera: boolean; onPress: () => void }) {
  const botin = DUNGEON_CLEAR_XP[d.rank];
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${d.title}, despejada. Botín: ${formatoMiles(botin)} XP.`}
      style={({ pressed }) => [styles.fila, !primera && styles.filaRegla, pressed && styles.pulsada]}
    >
      <Estandarte letra={d.rank} ancho={40} grosor={1} />
      <View style={styles.filaCuerpo}>
        <Text style={styles.filaTitulo} numberOfLines={2}>
          {d.title}
        </Text>
        {fechaCorta(d.cleared_at) ? <Text style={styles.micro}>Despejada el {fechaCorta(d.cleared_at)}</Text> : null}
      </View>
      <Text style={styles.botinCobrado} maxFontSizeMultiplier={1.35}>
        +{formatoMiles(botin)}
        <Text style={styles.botinXp}> XP</Text>
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  skFranja: { marginBottom: space.s6 },
  encabezado: { marginBottom: space.s6 },
  skSubtitulo: { marginTop: space.s3 },
  skMeandro: { marginTop: space.s4 },
  aviso: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s2,
    paddingVertical: space.s2,
    marginBottom: space.s4,
    borderTopWidth: stroke.hairline,
    borderBottomWidth: stroke.hairline,
    borderColor: ink.ink3,
  },
  avisoTexto: { flex: 1, minWidth: 0 },
  avisoAccion: { color: ink.ink9 },
  skEyebrow: { marginBottom: space.s3 },
  skCard: { marginBottom: space.s4 },
  franja: { marginBottom: space.s6 },
  vacio: { alignItems: 'center', paddingVertical: space.s4, paddingHorizontal: space.s2 },
  vacioTitulo: {
    fontFamily: tipo.inscripcion.family,
    fontSize: tipo.inscripcion.size,
    lineHeight: tipo.inscripcion.lineHeight,
    letterSpacing: tipo.inscripcion.tracking,
    textTransform: 'uppercase',
    color: ink.ink9,
    textAlign: 'center',
    marginTop: space.s5,
  },
  vacioTexto: {
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink8,
    textAlign: 'center',
    marginTop: space.s2,
    maxWidth: 420,
  },
  vacioBoton: { marginTop: space.s5, alignSelf: 'center' },
  rejilla: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s4 },
  celda: { marginBottom: space.s4 },
  celdaRejilla: { width: '48%', flexGrow: 1 },
  losaFila: { flexDirection: 'row', alignItems: 'flex-start', gap: space.s4 },
  losaCuerpo: { flex: 1, minWidth: 0, paddingTop: 2 },
  losaTitulo: { fontFamily: tipo.micro.family, fontSize: 16, lineHeight: 21, color: ink.ink10 },
  losaMeta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space.s3, marginTop: space.s2 },
  micro: {
    fontFamily: tipo.micro.family,
    fontSize: tipo.micro.size,
    lineHeight: tipo.micro.lineHeight,
    letterSpacing: tipo.micro.tracking,
    color: ink.ink6,
  },
  mayus: { textTransform: 'uppercase' },
  plazo: { flexDirection: 'row', alignItems: 'center', gap: space.s1 },
  avance: { marginTop: space.s4 },
  avancePie: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: space.s2 },
  pct: { fontFamily: tipo.number.family, fontSize: 14, lineHeight: 18, color: ink.ink10 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: space.s4, paddingVertical: space.s3, minHeight: 64 },
  filaRegla: { borderTopWidth: stroke.hairline, borderTopColor: ink.ink3 },
  pulsada: { opacity: 0.6 },
  filaCuerpo: { flex: 1, minWidth: 0, gap: 2 },
  filaTitulo: { fontFamily: tipo.bodySm.family, fontSize: 14, lineHeight: 20, color: ink.ink8 },
  botinCobrado: { fontFamily: tipo.number.family, fontSize: 16, lineHeight: 20, color: ink.ink10 },
  botinXp: { fontFamily: tipo.micro.family, fontSize: tipo.micro.size, letterSpacing: tipo.micro.tracking, color: ink.ink6 },
});
