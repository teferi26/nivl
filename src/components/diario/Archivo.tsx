// NIVL · Diario: el Archivo, recordar (FASE3 Lote D).
//
// Tiene su propio sitio y se lee como un registro de vida: la franja de
// cifras, «Escribir hoy» si el día aún falta (LA inversión del Archivo), los
// recuerdos de esta misma fecha, la tendencia y después los días, uno por
// fila entre hairlines. A partir de `medium` va a dos columnas: tendencia y
// recuerdos a la izquierda, los días a la derecha (una sola con el texto muy
// grande).

import { useMemo, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { CargaArena, Entrada, FranjaCifras, TarjetaArena } from '@/components/arena';
import { Button, EmptyState, Section } from '@/components/ui';
import { ink, space, stroke } from '@/design/tokens';
import { useSizeClass } from '@/design/useSizeClass';
import { flashbacks, resumenTendencia, serieDe } from '@/lib/journalmath';
import type { JournalEntry } from '@/lib/types';
import { EntryCard } from './EntryCard';
import { Flashbacks } from './Flashbacks';
import { MoodTrend, cifrasTendencia } from './MoodTrend';

/** Filas por tanda: una lista de sesenta días de golpe es un muro, otra vez. */
const TANDA = 12;
/** Solo las más recientes cargan sus miniaturas sin que se pidan. */
const CON_FOTOS_AL_MONTAR = 5;
/** Con el texto por encima de esto, el Archivo vuelve a una columna. */
const ESCALA_DOS_COLUMNAS = 1.35;

interface Props {
  loaded: boolean;
  hoy: string;
  /** Recientes, de más nueva a más vieja. */
  entries: JournalEntry[];
  /** Las entradas de las fechas de `fechasFlashback`, que pueden no estar entre las recientes. */
  recuerdos: JournalEntry[];
  photoCounts: Map<string, number>;
  loadPhotos: (date: string) => Promise<string[]>;
  onOpen: (date: string) => void;
  onWriteToday: () => void;
}

export function Archivo({ loaded, hoy, entries, recuerdos, photoCounts, loadPhotos, onOpen, onWriteToday }: Props) {
  const [visibles, setVisibles] = useState(TANDA);
  const { sizeClass } = useSizeClass();
  const { fontScale } = useWindowDimensions();
  const dosColumnas = sizeClass !== 'compact' && fontScale <= ESCALA_DOS_COLUMNAS;

  const resumen = useMemo(() => resumenTendencia(entries, hoy), [entries, hoy]);
  const animo = useMemo(() => serieDe(entries, 'mood', 30), [entries]);
  const energia = useMemo(() => serieDe(entries, 'energy', 30), [entries]);
  const recuerdosDeHoy = useMemo(() => flashbacks(recuerdos, hoy), [recuerdos, hoy]);
  const faltaHoy = !entries.some((e) => e.date === hoy);

  if (!loaded) {
    return <CargaArena etiqueta="Cargando tu archivo" formas={['franja', 'tarjeta', 'rotulo', 'filas']} />;
  }

  if (entries.length === 0) {
    return (
      <Entrada indice={1}>
        <TarjetaArena variante="contorno" remaches padded={false}>
          <EmptyState
            icon="book-outline"
            title="Tu archivo empieza hoy"
            body="Cada día que cierres quedará aquí: cómo estabas, qué lograste, qué aprendiste. Dentro de un año querrás leerlo."
            action={{ label: 'Escribir hoy', onPress: onWriteToday, variant: 'solid' }}
          />
        </TarjetaArena>
      </Entrada>
    );
  }

  const tendencia = (
    <>
      {recuerdosDeHoy.length > 0 ? <Flashbacks items={recuerdosDeHoy} onOpen={onOpen} /> : null}
      <Section title="Tendencia" meta={`Últimas ${Math.min(entries.length, 30)}`}>
        <MoodTrend resumen={resumen} animo={animo} energia={energia} />
      </Section>
    </>
  );

  const dias = (
    <Section title="Días escritos" meta={`${entries.length}`}>
      {entries.slice(0, visibles).map((entry, i) => (
        <EntryCard
          key={entry.id}
          entry={entry}
          hoy={hoy}
          primera={i === 0}
          photoCount={photoCounts.get(entry.date) ?? 0}
          eagerPhotos={i < CON_FOTOS_AL_MONTAR}
          loadPhotos={loadPhotos}
          onOpen={onOpen}
        />
      ))}
      {visibles < entries.length ? (
        <Button
          title="Ver más días"
          variant="secondary"
          size="sm"
          icon="chevron-down"
          onPress={() => setVisibles((v) => v + TANDA)}
          style={styles.mas}
        />
      ) : null}
    </Section>
  );

  return (
    <>
      <Entrada indice={1} style={styles.franja}>
        <FranjaCifras cifras={cifrasTendencia(resumen, entries.length)} />
      </Entrada>

      {faltaHoy ? (
        <Entrada indice={2}>
          <Button title="Escribir hoy" icon="create-outline" size="lg" onPress={onWriteToday} style={styles.escribir} />
        </Entrada>
      ) : null}

      {dosColumnas ? (
        <Entrada indice={3} style={styles.columnas}>
          <View style={styles.columna}>{tendencia}</View>
          <View style={styles.columna}>{dias}</View>
        </Entrada>
      ) : (
        <>
          <Entrada indice={3}>{tendencia}</Entrada>
          <Entrada indice={4}>{dias}</Entrada>
        </>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  franja: {
    marginBottom: space.s6,
    paddingVertical: space.s3,
    borderTopWidth: stroke.hairline,
    borderBottomWidth: stroke.hairline,
    borderColor: ink.ink3,
  },
  escribir: { marginBottom: space.s6 },
  columnas: { flexDirection: 'row', alignItems: 'flex-start', gap: space.s8 },
  columna: { flex: 1, minWidth: 0 },
  mas: { marginTop: space.s4, alignSelf: 'center' },
});
