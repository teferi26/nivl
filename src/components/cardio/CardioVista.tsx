// NIVL · Cardio: la vista (patrón L-RADICAL §C, FASE3 Lote E1). Pura: todo
// llega por props desde useCardio (o desde la galería con datos de mentira).
//
// De arriba abajo: el encabezado grabado («Cuerpo» / «CARDIO») con la acción
// SÓLIDA «Registrar sesión» (la INVERSIÓN de la pantalla) y meandro; el
// anuncio de la última sesión (lo que pagó de verdad, ver useCardio); la
// franja km · sesiones · min de 28 días; la arena en óvalo a lo ancho con la
// regla del 10 %; y las sesiones en filas con hairline: icono, tipo, Tag de
// zona y cifras en Cinzel. Mantener pulsada una fila la borra (también como
// acción del lector de pantalla).

import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  Arena,
  CargaArena,
  EncabezadoArena,
  Entrada,
  ErrorSistema,
  FranjaCifras,
  TarjetaArena,
} from '@/components/arena';
import { DescargoSalud } from '@/components/DescargoSalud';
import { EmptyState, Screen, Section, Tag } from '@/components/ui';
import { ink, space, stroke, type as tipo } from '@/design/tokens';
import { paceOf } from '@/lib/bodymath';
import type { CardioSession } from '@/lib/bodywork';
import { addDays } from '@/lib/dates';
import { kmES, numeroES } from '@/lib/pagoActo';
import { ETIQUETA, ICONO, ZONA, fechaCorta } from './tipos';

export interface AnuncioCardio {
  /** El texto de anuncioCardio: lo que entró de verdad, o por qué no entró nada. */
  texto: string;
  /** Entró XP (misión enlazada o módulo): la tarjeta es de logro. */
  pagado: boolean;
}

export interface CardioVistaProps {
  /** Hasta la primera carga buena se pintan huecos. */
  cargado: boolean;
  errorCarga: string | null;
  /** «Hoy» (AAAA-MM-DD): de él salen los 28 días. */
  hoy: string;
  sesiones: CardioSession[];
  anuncio: AnuncioCardio | null;
  acciones: {
    onVolver: () => void;
    onReintentar: () => void;
    onRegistrar: () => void;
    onBorrar: (s: CardioSession) => void;
    onCerrarAnuncio: () => void;
  };
}

const ALTO_ARENA = 112;
const BOTON = 44;

function FilaCardio({ s, primera, onBorrar }: { s: CardioSession; primera: boolean; onBorrar: () => void }) {
  const ritmo = paceOf(s.distance_km, s.duration_min);
  const cifras = [
    s.distance_km ? kmES(Number(s.distance_km)) : null,
    `${numeroES(Number(s.duration_min), 1)} min`,
    ritmo ? `${ritmo} min/km` : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const extra = [s.rpe ? `RPE ${numeroES(Number(s.rpe), 1)}` : null, s.avg_hr ? `${s.avg_hr} ppm` : null]
    .filter(Boolean)
    .join(' · ');
  const leido = `${ETIQUETA[s.kind]} del ${fechaCorta(s.date)}, zona ${ZONA[s.zone]}. ${cifras}${extra ? `. ${extra}` : ''}${
    s.xp_awarded > 0 ? `. Más ${s.xp_awarded} XP` : ''
  }. Mantén pulsado para eliminar.`;
  return (
    <Pressable
      onLongPress={onBorrar}
      accessibilityLabel={leido}
      accessibilityActions={[{ name: 'longpress', label: 'Eliminar' }]}
      onAccessibilityAction={(e) => {
        if (e.nativeEvent.actionName === 'longpress') onBorrar();
      }}
      style={({ pressed }) => [styles.fila, !primera && styles.conRegla, pressed && styles.pulsado]}
    >
      <View style={styles.icono}>
        <Ionicons name={ICONO[s.kind]} size={20} color={ink.ink10} />
      </View>
      <View style={styles.filaTexto}>
        <View style={styles.tituloFila}>
          <Text style={styles.titulo} numberOfLines={1} maxFontSizeMultiplier={1.35}>
            {ETIQUETA[s.kind]}
          </Text>
          <Tag>{ZONA[s.zone]}</Tag>
        </View>
        <Text style={styles.cifras} maxFontSizeMultiplier={1.35}>
          {cifras}
        </Text>
        {extra ? (
          <Text style={styles.extra} maxFontSizeMultiplier={1.35}>
            {extra}
          </Text>
        ) : null}
        {s.notes ? (
          <Text style={styles.notas} numberOfLines={2} maxFontSizeMultiplier={1.6}>
            {s.notes}
          </Text>
        ) : null}
      </View>
      <View style={styles.derecha}>
        <Text style={styles.fecha} maxFontSizeMultiplier={1.35}>
          {fechaCorta(s.date)}
        </Text>
        {s.xp_awarded > 0 ? (
          <Text style={styles.xp} maxFontSizeMultiplier={1.35}>
            +{s.xp_awarded} XP
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

export function CardioVista({ cargado, errorCarga, hoy, sesiones, anuncio, acciones }: CardioVistaProps) {
  const [anchoArena, setAnchoArena] = useState(0);

  const ultimas28 = sesiones.filter((s) => s.date >= addDays(hoy, -28));
  const km28 = ultimas28.reduce((a, s) => a + Number(s.distance_km ?? 0), 0);
  const min28 = ultimas28.reduce((a, s) => a + Number(s.duration_min ?? 0), 0);

  const subtitulo = !cargado
    ? undefined
    : sesiones.length === 0
      ? 'Nada registrado aún. Cada sesión ajusta la siguiente.'
      : `${numeroES(km28, 1)} km y ${ultimas28.length} ${ultimas28.length === 1 ? 'sesión' : 'sesiones'} en 28 días.`;

  const encabezado = (
    <Entrada indice={0}>
      <EncabezadoArena
        onVolver={acciones.onVolver}
        eyebrow="Cuerpo"
        titulo="Cardio"
        subtitulo={subtitulo}
        accion={{ icono: 'add', etiqueta: 'Registrar sesión', onPress: acciones.onRegistrar, solida: true }}
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
          <CargaArena etiqueta="Cargando el cardio" formas={['franja', 'tarjeta', 'rotulo', 'filas']} />
        )}
      </Screen>
    );
  }

  return (
    <Screen>
      {encabezado}

      {errorCarga ? (
        <ErrorSistema compacto mensaje={errorCarga} onReintentar={acciones.onReintentar} style={styles.bloque} />
      ) : null}

      {anuncio ? (
        <TarjetaArena
          variante={anuncio.pagado ? 'grano' : 'contorno'}
          rotulo="Sesión registrada"
          style={styles.bloque}
        >
          <View style={styles.anuncio}>
            <Text style={styles.anuncioTexto} maxFontSizeMultiplier={1.6}>
              {anuncio.texto}
            </Text>
            <Pressable
              onPress={acciones.onCerrarAnuncio}
              style={({ pressed }) => [styles.cerrar, pressed && styles.pulsado]}
              accessibilityRole="button"
              accessibilityLabel="Cerrar el aviso"
            >
              <Ionicons name="close" size={20} color={ink.ink8} />
            </Pressable>
          </View>
        </TarjetaArena>
      ) : null}

      <Entrada indice={1}>
        <FranjaCifras
          cifras={[
            // Cadena (no número): la coma decimal no la pone el Contador.
            { valor: numeroES(km28, 1), rotulo: 'Km · 28 días', etiqueta: `${numeroES(km28, 1)} kilómetros en 28 días` },
            { valor: ultimas28.length, rotulo: 'Sesiones' },
            { valor: Math.round(min28), rotulo: 'Min en marcha' },
          ]}
        />
      </Entrada>

      <Entrada indice={2} style={styles.arenaBloque}>
        <View
          style={styles.arena}
          onLayout={(e) => setAnchoArena(Math.round(e.nativeEvent.layout.width))}
          accessible
          accessibilityLabel="El volumen semanal no debe subir más de un 10 %."
        >
          {anchoArena > 0 ? (
            <Arena ancho={anchoArena} alto={ALTO_ARENA} variante="ovalo" style={styles.arenaFondo} />
          ) : null}
          <Text style={styles.regla} maxFontSizeMultiplier={1.2}>
            +10 % POR SEMANA
          </Text>
          <Text style={styles.reglaPie} maxFontSizeMultiplier={1.2}>
            COMO MUCHO
          </Text>
        </View>
        <Text style={styles.nota} maxFontSizeMultiplier={1.6}>
          El volumen semanal no debe subir más de un 10 %. El sistema lo vigila y ajusta tus órdenes con estos datos.
        </Text>
      </Entrada>

      <Entrada indice={3}>
        <Section title="Sesiones" meta={sesiones.length > 0 ? `${sesiones.length}` : undefined}>
          {sesiones.length === 0 ? (
            <TarjetaArena variante="contorno">
              <EmptyState
                compact
                icon="pulse-outline"
                title="Nada registrado"
                body="Cada carrera y cada largo que anotes aquí es lo que el sistema usa para calcular tu ritmo y ajustar lo siguiente."
                action={{ label: 'Registrar la primera', onPress: acciones.onRegistrar }}
              />
            </TarjetaArena>
          ) : (
            sesiones.map((s, i) => (
              <FilaCardio key={s.id} s={s} primera={i === 0} onBorrar={() => acciones.onBorrar(s)} />
            ))
          )}
        </Section>
      </Entrada>

      <DescargoSalud />
    </Screen>
  );
}

const styles = StyleSheet.create({
  bloque: { marginBottom: space.s5 },
  anuncio: { flexDirection: 'row', alignItems: 'flex-start', gap: space.s2 },
  anuncioTexto: {
    flex: 1,
    minWidth: 0,
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink9,
    paddingTop: space.s1,
  },
  cerrar: { width: BOTON, height: BOTON, alignItems: 'center', justifyContent: 'center', marginTop: -space.s3, marginRight: -space.s3 },
  pulsado: { backgroundColor: ink.ink2 },
  arenaBloque: { marginTop: space.s6, marginBottom: space.s8, gap: space.s3 },
  arena: { height: ALTO_ARENA, alignItems: 'center', justifyContent: 'center' },
  arenaFondo: { position: 'absolute', top: 0, left: 0 },
  regla: {
    fontFamily: tipo.inscripcion.family,
    fontSize: tipo.inscripcion.size,
    lineHeight: tipo.inscripcion.lineHeight,
    letterSpacing: tipo.inscripcion.tracking,
    color: ink.ink9,
  },
  reglaPie: {
    fontFamily: tipo.micro.family,
    fontSize: tipo.micro.size,
    lineHeight: tipo.micro.lineHeight,
    letterSpacing: tipo.micro.tracking,
    color: ink.ink6,
    marginTop: 2,
  },
  nota: {
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink8,
    textAlign: 'center',
  },
  fila: { flexDirection: 'row', alignItems: 'flex-start', gap: space.s3, paddingVertical: space.s3, minHeight: 64 },
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
  tituloFila: { flexDirection: 'row', alignItems: 'center', gap: space.s2 },
  titulo: { flexShrink: 1, fontFamily: 'Outfit_600SemiBold', fontSize: 16, lineHeight: 22, color: ink.ink9 },
  cifras: { fontFamily: 'Cinzel_600SemiBold', fontSize: 14, lineHeight: 20, color: ink.ink8 },
  extra: {
    fontFamily: tipo.micro.family,
    fontSize: tipo.micro.size,
    lineHeight: tipo.micro.lineHeight,
    letterSpacing: tipo.micro.tracking,
    textTransform: 'uppercase',
    color: ink.ink6,
  },
  notas: {
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink6,
    marginTop: 2,
  },
  derecha: { alignItems: 'flex-end', gap: 2 },
  fecha: { fontFamily: 'Cinzel_600SemiBold', fontSize: 14, lineHeight: 20, color: ink.ink9 },
  xp: {
    fontFamily: tipo.micro.family,
    fontSize: tipo.micro.size,
    lineHeight: tipo.micro.lineHeight,
    letterSpacing: tipo.micro.tracking,
    color: ink.ink6,
  },
});
