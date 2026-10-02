// NIVL · Hoy: la vista (L-RADICAL §C). Pura: todo llega por props desde
// useHoy (o desde la galería con datos de mentira) y no carga nada.

import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { OrdenDelDia } from '@/components/OrdenDelDia';
import { QuestItem } from '@/components/QuestItem';
import {
  Button,
  Card,
  EmptyState,
  FadeIn,
  ProgressRing,
  Row,
  Screen,
  ScreenHeader,
  Section,
  Skeleton,
  SkeletonRows,
  Stagger,
} from '@/components/ui';
import { cabeAside } from '@/design/responsive';
import { ink, type as tipo } from '@/design/tokens';
import { useAnchoUtil, useNavActual } from '@/design/useSizeClass';
import type { DayBlock } from '@/lib/plan';
import { colors, fonts } from '@/lib/theme';
import { voice } from '@/lib/voice';
import type { Quest } from '@/lib/types';
import type { HoyDatos } from './derivarHoy';
import { PanelHoy } from './PanelHoy';
import { TarjetaRango } from './TarjetaRango';

export interface HoyVistaProps {
  /** Hasta la primera carga se pintan huecos, nunca «Nada programado». */
  estado: 'cargando' | 'listo';
  /** Fallo de la última carga, ya escrito para el usuario (mensajeSistema). */
  error: string | null;
  datos: HoyDatos;
  /** Misión con el cerrojo tomado (cámara u hoja abiertas, pago en vuelo). */
  ocupada: string | null;
  preparandoTarjeta: boolean;
  refrescando: boolean;
  /** Latido del anillo al cerrar el día perfecto. */
  pulso?: Animated.Value;
  acciones: {
    onCompletar: (q: Quest) => void;
    onAlternarBloque: (b: DayBlock) => void;
    onCompartirDia: () => void;
    onRefrescar: () => void;
    onReintentar: () => void;
  };
}

// Hueco de la rejilla de módulos y lado de referencia de un azulejo: cuatro
// por fila como poco, y más cuando la rejilla es ancha.
const HUECO_MODULOS = 8;
const LADO_MODULO = 112;

export function HoyVista({ estado, error, datos: d, ocupada, preparandoTarjeta, refrescando, pulso, acciones }: HoyVistaProps) {
  const [showMore, setShowMore] = useState(false);
  // Ancho real de la rejilla de módulos (onLayout), no el de la ventana.
  const [anchoRejilla, setAnchoRejilla] = useState(0);
  const ancho = useAnchoUtil();
  // La Agenda se ofrece desde aquí solo con la barra inferior de verdad en
  // pantalla (sale del ancho de la ventana, no del hueco tras el raíl).
  const navActual = useNavActual();
  // Con el panel lateral (expanded), rango y rivalidad van ahí y no se repiten.
  const conPanel = cabeAside(ancho);
  const loaded = estado === 'listo';
  const profile = d.perfil;
  const loadError = error;
  const sorted = d.misiones;
  const modulos = d.modulos;
  const racha = d.racha;
  const enJuego = d.enJuego;
  // Cuatro por fila como poco (más si la rejilla es ancha), medido sobre el
  // ancho REAL de la rejilla (onLayout).
  const columnas = Math.max(4, Math.floor(anchoRejilla / LADO_MODULO));
  const tile = anchoRejilla > 0 ? Math.floor((anchoRejilla - HUECO_MODULOS * (columnas - 1)) / columnas) : 0;

  return (
    <Screen
      refreshing={refrescando}
      onRefresh={acciones.onRefrescar}
      aside={
        <PanelHoy
          loaded={loaded}
          profile={profile}
          rango={d.rango}
          // Con la línea RET-05 a la vista, la pista del panel tampoco se pinta
          // (faltan 0 = sin pista): darían dos números distintos.
          racha={enJuego ? { ...racha, faltan: 0 } : racha}
          rivalidad={d.rivalidad}
          esPro={d.esPro}
          diaPerfectoVisible={d.celebrando}
        />
      }
    >
      <Stagger>
        <FadeIn index={0}>
          <ScreenHeader
            eyebrow={d.fecha}
            title={d.saludo}
            subtitle={d.subtitulo}
            // En compact la Agenda no está en la barra inferior: se llega desde
            // aquí. En el raíl y la barra lateral es un destino propio.
            action={
              navActual === 'tabs'
                ? { icon: 'calendar-outline', label: 'Abrir la agenda', onPress: () => router.push('/(tabs)/agenda') }
                : undefined
            }
            right={
              sorted.length > 0 ? (
                <Animated.View style={pulso ? { transform: [{ scale: pulso }] } : undefined}>
                  <ProgressRing
                    ratio={d.hechas / d.total}
                    size={66}
                    stroke={4}
                    color={ink.ink10}
                    label={`${d.hechas}/${d.total}`}
                    sublabel="hoy"
                  />
                </Animated.View>
              ) : undefined
            }
          />
        </FadeIn>

        {loadError ? (
          <Card variant="outline">
            <EmptyState
              compact
              icon="cloud-offline-outline"
              title={profile ? 'No se ha podido actualizar' : 'El sistema no responde'}
              body={loadError}
              action={{ label: 'Reintentar', onPress: acciones.onReintentar }}
            />
          </Card>
        ) : null}

        {!loaded ? (
          <View accessibilityRole="progressbar" accessibilityLabel="Cargando tu día">
            {/* La tarjeta de rango va en el panel lateral cuando lo hay. */}
            {!conPanel ? <Skeleton height={132} style={styles.skCard} /> : null}
            <Skeleton height={11} width={120} style={styles.skEyebrow} />
            <Skeleton height={64} style={styles.skCard} />
            <Skeleton height={11} width={140} style={styles.skEyebrow} />
            <SkeletonRows rows={4} />
          </View>
        ) : null}

        {loaded && profile && !conPanel ? (
          <FadeIn index={1}>
            <TarjetaRango
              profile={profile}
              rango={d.rango}
              racha={racha}
              ocultarPista={!!enJuego}
              diaPerfectoVisible={d.celebrando}
            />
          </FadeIn>
        ) : null}

        {loaded && d.rivalidad && !conPanel ? (
          <FadeIn index={2}>
            <Card padded={false} style={styles.rivalCard}>
              <Row
                first
                chevron
                leading={<Ionicons name="people-outline" size={18} color={colors.textDim} />}
                title={d.rivalidad}
                onPress={() => router.push('/amigos')}
                accessibilityLabel={`${d.rivalidad} Abrir Amigos`}
              />
            </Card>
          </FadeIn>
        ) : null}

        {loaded && d.pausa ? (
          <FadeIn index={2}>
            <Card variant="outline" accent={colors.accentDim}>
              <Text style={styles.alertTitle}>
                <Ionicons name="snow-outline" size={12} color={colors.accentText} /> SISTEMA EN PAUSA
              </Text>
              <Text style={styles.alertBody}>{d.pausa}</Text>
            </Card>
          </FadeIn>
        ) : null}

        {loaded && d.cierre ? (
          <FadeIn index={2}>
            {/* Grano solo para el día perfecto: el informe sin alerta va en contorno. */}
            <Card variant={d.cierre.alerta ? 'alerta' : 'outline'}>
              <Text style={styles.alertTitle}>{d.cierre.alerta ? 'ALERTA DEL SISTEMA' : 'INFORME DEL CIERRE'}</Text>
              {d.cierre.lineas.map((l) => (
                <Text key={l} style={styles.alertBody}>
                  {l}
                </Text>
              ))}
            </Card>
          </FadeIn>
        ) : null}

        {loaded && d.orden ? (
          <FadeIn index={3}>
            <OrdenDelDia plan={d.orden.plan} bloques={d.orden.bloques} onToggle={acciones.onAlternarBloque} pro={d.orden.pro} />
          </FadeIn>
        ) : null}

        {d.celebrando ? (
          <FadeIn>
            <Card variant="logro">
              <Text style={styles.alertTitle}>DÍA PERFECTO</Text>
              <Text style={styles.alertBody}>Día perfecto. Racha {racha.valor}.</Text>
              <Button
                title="Compartir"
                icon="share-social-outline"
                variant="secondary"
                size="sm"
                onPress={acciones.onCompartirDia}
                loading={preparandoTarjeta}
                style={styles.compartir}
              />
            </Card>
          </FadeIn>
        ) : null}

        {loaded ? (
        <FadeIn index={4}>
          <Section
            title="Misiones de hoy"
            meta={sorted.length > 0 ? `${d.hechas}/${d.total}` : undefined}
            tone={d.tonoMisiones}
          >
            {sorted.length === 0 ? (
              // Con la carga fallida no se sabe si hay misiones: el aviso de
              // arriba ya lo dice y aquí no se afirma "Nada programado".
              loadError ? null : (
              <Card variant="outline">
                <EmptyState
                  compact
                  icon="repeat-outline"
                  title="Nada programado para hoy"
                  body={d.esPro === true ? 'Crea tus misiones en Hábitos o pídeselas al coach.' : 'Crea tus misiones en Hábitos.'}
                  action={{ label: 'Ir a Hábitos', onPress: () => router.push('/(tabs)/habitos') }}
                />
              </Card>
              )
            ) : (
              <Card padded={false} style={styles.questCard}>
                {sorted.map((m, i) => (
                  <QuestItem
                    key={m.quest.id}
                    first={i === 0}
                    quest={m.quest}
                    completed={m.hecha}
                    xpAwarded={m.xpPagado}
                    busy={ocupada === m.quest.id}
                    streakDays={racha.valor}
                    onComplete={acciones.onCompletar}
                    bloqueada={m.bloqueada}
                  />
                ))}
              </Card>
            )}
            {d.avisoRecuperacion ? (
              <Text style={styles.recuperacionAbierta} accessibilityRole="alert">
                La recuperación está abierta. Recupera lo perdido.
              </Text>
            ) : null}
            {sorted.length > 0 && d.pendientes === 0 ? (
              <Text style={styles.allDone}>{d.todoHecho ?? voice.allDone()}</Text>
            ) : null}
            {d.notaPendiente ? (
              <Text style={[styles.pendingNote, d.notaPendiente.alerta && styles.pendingAlerta]}>
                {d.notaPendiente.texto}
              </Text>
            ) : null}
            {/* Una sola línea, callada y DEBAJO de las misiones: lo gratis va
                primero y el coach se ofrece sin cortar el paso. */}
            {d.lineaPro ? (
              <Card padded={false} style={styles.proRow}>
                <Row
                  first
                  chevron
                  muted
                  leading={<Ionicons name="shield-half-outline" size={18} color={colors.textFaint} />}
                  title="El plan del día lo escribe el coach · NIVL Pro"
                  onPress={() => router.push('/pro')}
                  accessibilityLabel="El plan del día lo escribe el coach. Ver NIVL Pro"
                />
              </Card>
            ) : null}
          </Section>
        </FadeIn>
        ) : null}

        <FadeIn index={5}>
          <Section
            title="Módulos"
            action={
              modulos.secondary.length > 0
                ? {
                    label: showMore ? 'Menos' : `Más · ${modulos.secondary.length}`,
                    icon: showMore ? 'chevron-up' : 'chevron-down',
                    onPress: () => setShowMore((v) => !v),
                  }
                : undefined
            }
          >
            <View style={styles.moduleGrid} onLayout={(e) => setAnchoRejilla(e.nativeEvent.layout.width)}>
              {/* Hasta medir no se pintan: con un lado inventado saltaban. */}
              {tile > 0 &&
                [...modulos.primary, ...(showMore ? modulos.secondary : [])].map((m) => (
                  <Pressable
                    key={m.route}
                    onPress={() => router.push(m.route)}
                    style={({ pressed }) => [styles.module, { width: tile, height: tile }, pressed && styles.modulePressed]}
                    accessibilityRole="button"
                    accessibilityLabel={`Abrir ${m.label}`}
                  >
                    <Ionicons name={m.icon as never} size={22} color={colors.text} />
                    <Text style={styles.moduleLabel} numberOfLines={1}>
                      {m.label}
                    </Text>
                  </Pressable>
                ))}
            </View>
          </Section>
        </FadeIn>

        <FadeIn index={6}>
          <Text style={styles.motto}>UN 1 % MEJOR CADA DÍA</Text>
        </FadeIn>
      </Stagger>
    </Screen>
  );
}

const styles = StyleSheet.create({
  alertTitle: {
    fontFamily: fonts.heading,
    fontSize: 11,
    letterSpacing: 2.5,
    color: ink.ink9,
    marginBottom: 6,
  },
  alertBody: {
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: colors.text,
    marginBottom: 4,
  },
  questCard: { paddingHorizontal: 16, paddingVertical: 4 },
  allDone: {
    fontFamily: fonts.semibold,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink9,
    marginTop: 4,
  },
  recuperacionAbierta: {
    fontFamily: fonts.semibold,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: colors.text,
    marginTop: 10,
  },
  // RET-05: bodySm (14/20) en ink8.
  pendingNote: {
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink8,
    marginTop: 4,
  },
  pendingAlerta: { fontFamily: fonts.semibold, color: ink.ink9 },
  moduleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: HUECO_MODULOS },
  // El lado del azulejo se calcula con el ancho medido de la rejilla (ver `tile`).
  module: {
    backgroundColor: colors.panel,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  modulePressed: { backgroundColor: colors.accentFaint },
  moduleLabel: { fontFamily: fonts.semibold, fontSize: 11, color: colors.textDim, paddingHorizontal: 4 },
  skCard: { marginBottom: 26 },
  skEyebrow: { marginBottom: 12 },
  rivalCard: { paddingHorizontal: 16, paddingVertical: 2 },
  proRow: { paddingHorizontal: 16, paddingVertical: 2, marginTop: 12, marginBottom: 0 },
  compartir: { alignSelf: 'flex-start', marginTop: 8 },
  motto: {
    fontFamily: fonts.heading,
    fontSize: 11,
    letterSpacing: 2.7,
    color: colors.textFaint,
    textAlign: 'center',
    marginTop: 8,
  },
});
