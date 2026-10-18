// NIVL · IRON · Demostración del motor (solo la galería /kit/iron).
//
// Los 5 ejercicios del prototipo en bucle, con selector, «Sustituir», los
// músculos trabajados y el mapa de cuerpo entero. Pura: el estado de la
// pantalla entra por props (la ruta lee los parámetros de la URL).

import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { EncabezadoArena, TarjetaArena } from '@/components/arena';
import { Button, Chip, ChipWrap } from '@/components/ui';
import { ink, space, type } from '@/design/tokens';
import { useAnchoUtil } from '@/design/useSizeClass';
import { t } from '@/i18n';
import { EJERCICIOS } from '@/iron/ejercicios';
import { sustituto } from '@/iron/sustituir';
import type { ClaveI18n, Ejercicio, MusculoId } from '@/iron/tipos';
import { ACENTO_IRON } from './estilo';
import { Maniqui } from './Maniqui';
import { MapaMuscular } from './MapaMuscular';
import { nombreIron, textoIron } from './texto';

export interface DemoIronProps {
  ejercicio: Ejercicio;
  alElegir: (id: string) => void;
  onVolver?: () => void;
  /** Instante fijo (capturas). */
  ms?: number;
}

function Punto({ principal }: { principal: boolean }) {
  return <View style={[styles.punto, { backgroundColor: ACENTO_IRON, opacity: principal ? 1 : 0.45 }]} />;
}

function ListaMusculos({ titulo, lista, principal }: { titulo: string; lista: readonly MusculoId[]; principal: boolean }) {
  if (lista.length === 0) return null;
  return (
    <View style={styles.bloque}>
      <Text style={styles.rotulo} maxFontSizeMultiplier={1.35}>
        {titulo}
      </Text>
      {lista.map((m) => (
        <View key={m} style={styles.filaMusculo}>
          <Punto principal={principal} />
          <Text style={styles.texto} maxFontSizeMultiplier={1.35}>
            {nombreIron('musculo', m)}
          </Text>
        </View>
      ))}
    </View>
  );
}

function Lista({ titulo, claves }: { titulo: string; claves: readonly ClaveI18n[] }) {
  return (
    <View style={styles.bloque}>
      <Text style={styles.rotulo} maxFontSizeMultiplier={1.35}>
        {titulo}
      </Text>
      {claves.map((c) => (
        <Text key={c} style={styles.texto} maxFontSizeMultiplier={1.35}>
          {`· ${textoIron(c)}`}
        </Text>
      ))}
    </View>
  );
}

export function DemoIron({ ejercicio: ej, alElegir, onVolver, ms }: DemoIronProps) {
  const [pausado, setPausado] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const ancho = Math.min(useAnchoUtil() - 2 * space.s5, 560);
  const nombre = textoIron(ej.nombre);

  const sustituir = () => {
    const s = sustituto(ej.id);
    if (!s) {
      setAviso(t('iron:demo.sinSustituto'));
      return;
    }
    const otro = textoIron(s.ejercicio.nombre);
    setAviso(s.motivo === 'elegido' ? t('iron:demo.sustitutoElegido', { nombre: otro }) : t('iron:demo.sustitutoGrupo', { nombre: otro }));
    alElegir(s.ejercicio.id);
  };

  return (
    <View style={styles.pila}>
      <EncabezadoArena eyebrow={t('iron:demo.eyebrow')} titulo={t('iron:demo.titulo')} subtitulo={t('iron:demo.subtitulo')} onVolver={onVolver} />

      <Text style={styles.rotulo} maxFontSizeMultiplier={1.35}>
        {t('iron:demo.elegir')}
      </Text>
      <ChipWrap>
        {EJERCICIOS.map((e) => (
          <Chip
            key={e.id}
            label={textoIron(e.nombre)}
            selected={e.id === ej.id}
            onPress={() => {
              setAviso(null);
              alElegir(e.id);
            }}
          />
        ))}
      </ChipWrap>

      <TarjetaArena variante="contorno" rotulo={nombreIron('grupo', ej.grupo)} meta={t(`iron:nivel.${ej.nivel}`)}>
        <Text style={styles.titulo} maxFontSizeMultiplier={1.35}>
          {nombre}
        </Text>
        <View style={styles.escenario}>
          <Maniqui ejercicio={ej} ancho={ancho - 2 * space.s4} ms={ms} pausado={pausado} accessibilityLabel={t('iron:demo.animacion', { nombre })} />
        </View>
        <View style={styles.botones}>
          <Button title={t('iron:demo.sustituir')} icon="swap-horizontal-outline" variant="secondary" size="sm" onPress={sustituir} />
          <Button
            title={pausado ? t('iron:demo.seguir') : t('iron:demo.pausar')}
            icon={pausado ? 'play-outline' : 'pause-outline'}
            variant="ghost"
            size="sm"
            onPress={() => setPausado((p) => !p)}
          />
        </View>
        {aviso ? (
          <Text style={styles.aviso} maxFontSizeMultiplier={1.35}>
            {aviso}
          </Text>
        ) : null}
      </TarjetaArena>

      <TarjetaArena rotulo={t('iron:demo.musculos')}>
        <View style={styles.musculos}>
          <View style={styles.columna}>
            <ListaMusculos titulo={t('iron:demo.principales')} lista={ej.musculos.principales} principal />
            <ListaMusculos titulo={t('iron:demo.secundarios')} lista={ej.musculos.secundarios} principal={false} />
          </View>
        </View>
        <View style={styles.mapa}>
          <MapaMuscular musculos={ej.musculos} ancho={Math.min(340, ancho - 2 * space.s4)} etiqueta={t('iron:demo.mapa', { nombre })} />
        </View>
        <View style={styles.bloque}>
          <Text style={styles.rotulo} maxFontSizeMultiplier={1.35}>
            {t('iron:demo.material')}
          </Text>
          <Text style={styles.texto} maxFontSizeMultiplier={1.35}>
            {ej.material.map((m) => nombreIron('material', m)).join(' · ')}
          </Text>
        </View>
      </TarjetaArena>

      <TarjetaArena rotulo={t('iron:demo.tecnica')}>
        <Lista titulo={t('iron:demo.tecnica')} claves={ej.cues} />
        <Lista titulo={t('iron:demo.errores')} claves={ej.errores} />
      </TarjetaArena>
    </View>
  );
}

/** Solo el escenario, sin nada alrededor: para grabar los vídeos. */
export function EscenarioIron({ ejercicio, ancho, ms }: { ejercicio: Ejercicio; ancho: number; ms?: number }) {
  return (
    <View style={styles.solo} nativeID="iron-escenario">
      <Maniqui ejercicio={ejercicio} ancho={ancho} ms={ms} accessibilityLabel={t('iron:demo.animacion', { nombre: textoIron(ejercicio.nombre) })} />
    </View>
  );
}

const styles = StyleSheet.create({
  pila: { gap: space.s4, paddingBottom: space.s8 },
  escenario: { alignItems: 'center', marginVertical: space.s3, backgroundColor: ink.ink0 },
  botones: { flexDirection: 'row', gap: space.s3, flexWrap: 'wrap' },
  musculos: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s4, justifyContent: 'space-between' },
  columna: { flex: 1, minWidth: 150, gap: space.s3 },
  mapa: { alignItems: 'center', marginTop: space.s4 },
  bloque: { gap: space.s1, marginTop: space.s2 },
  filaMusculo: { flexDirection: 'row', alignItems: 'center', gap: space.s2 },
  punto: { width: 10, height: 10, borderRadius: 5 },
  solo: { backgroundColor: ink.ink0, alignSelf: 'flex-start' },
  titulo: {
    fontFamily: type.headline.family,
    fontSize: type.headline.size,
    lineHeight: type.headline.lineHeight,
    letterSpacing: type.headline.tracking,
    color: ink.ink9,
  },
  rotulo: {
    fontFamily: type.label.family,
    fontSize: type.label.size,
    lineHeight: type.label.lineHeight,
    letterSpacing: type.label.tracking,
    color: ink.ink6,
    textTransform: 'uppercase',
  },
  texto: { fontFamily: type.bodySm.family, fontSize: type.bodySm.size, lineHeight: type.bodySm.lineHeight, color: ink.ink8 },
  aviso: { fontFamily: type.bodySm.family, fontSize: type.bodySm.size, lineHeight: type.bodySm.lineHeight, color: ink.ink9, marginTop: space.s2 },
});
