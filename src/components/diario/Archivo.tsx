// NIVL · Diario — el Archivo: recordar.
//
// Antes las entradas viejas eran una lista de dos líneas al fondo de la
// pantalla de escribir. Aquí tienen su propio sitio y se leen como un registro
// de vida: primero los recuerdos de esta misma fecha, luego la tendencia y
// después los días, uno por tarjeta.

import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { SystemButton } from '@/components/SystemButton';
import { Card, EmptyState, FadeIn, Section, Skeleton, Stagger } from '@/components/ui';
import { flashbacks, resumenTendencia, serieDe } from '@/lib/journalmath';
import type { JournalEntry } from '@/lib/types';
import { EntryCard } from './EntryCard';
import { Flashbacks } from './Flashbacks';
import { MoodTrend } from './MoodTrend';

/** Tarjetas por tanda: una lista de sesenta días de golpe es un muro, otra vez. */
const TANDA = 12;
/** Solo las más recientes cargan sus miniaturas sin que se pidan. */
const CON_FOTOS_AL_MONTAR = 5;

interface Props {
  loaded: boolean;
  hoy: string;
  /** Recientes, de más nueva a más vieja. */
  entries: JournalEntry[];
  /** Las entradas de las fechas de `fechasFlashback`, que pueden no estar entre las recientes. */
  recuerdos: JournalEntry[];
  photoCounts: Map<string, number>;
  loadPhotos: (date: string) => Promise<string[]>;
  /** Ancho útil dentro de una tarjeta (pantalla menos paddings). */
  chartWidth: number;
  onOpen: (date: string) => void;
  onWriteToday: () => void;
}

export function Archivo({ loaded, hoy, entries, recuerdos, photoCounts, loadPhotos, chartWidth, onOpen, onWriteToday }: Props) {
  const [visibles, setVisibles] = useState(TANDA);

  const resumen = useMemo(() => resumenTendencia(entries, hoy), [entries, hoy]);
  const animo = useMemo(() => serieDe(entries, 'mood', 30), [entries]);
  const energia = useMemo(() => serieDe(entries, 'energy', 30), [entries]);
  const recuerdosDeHoy = useMemo(() => flashbacks(recuerdos, hoy), [recuerdos, hoy]);

  if (!loaded) {
    return (
      <View accessibilityRole="progressbar" accessibilityLabel="Cargando tu archivo">
        <Skeleton height={120} style={{ marginBottom: 26 }} />
        <Skeleton height={150} style={{ marginBottom: 10 }} />
        <Skeleton height={150} />
      </View>
    );
  }

  if (entries.length === 0) {
    return (
      <Card variant="outline">
        <EmptyState
          icon="book-outline"
          title="Tu archivo empieza hoy"
          body="Cada día que cierres quedará aquí: cómo estabas, qué lograste, qué aprendiste. Dentro de un año querrás leerlo."
          action={{ label: 'Escribir el primero', onPress: onWriteToday }}
        />
      </Card>
    );
  }

  return (
    <Stagger>
      {recuerdosDeHoy.length > 0 ? (
        <FadeIn index={0}>
          <Flashbacks items={recuerdosDeHoy} onOpen={onOpen} />
        </FadeIn>
      ) : null}

      <FadeIn index={1}>
        <Section title="Tendencia" meta={`Últimas ${Math.min(entries.length, 30)}`}>
          <MoodTrend resumen={resumen} animo={animo} energia={energia} width={chartWidth} />
        </Section>
      </FadeIn>

      <FadeIn index={2}>
        <Section title="Entradas" meta={`${entries.length}`}>
          {entries.slice(0, visibles).map((entry, i) => (
            <EntryCard
              key={entry.id}
              entry={entry}
              photoCount={photoCounts.get(entry.date) ?? 0}
              eagerPhotos={i < CON_FOTOS_AL_MONTAR}
              loadPhotos={loadPhotos}
              onOpen={onOpen}
            />
          ))}
          {visibles < entries.length ? (
            <SystemButton
              title="Ver más días"
              variant="outline"
              size="sm"
              icon="chevron-down"
              onPress={() => setVisibles((v) => v + TANDA)}
              style={{ marginTop: 6, alignSelf: 'center' }}
            />
          ) : null}
        </Section>
      </FadeIn>
    </Stagger>
  );
}
