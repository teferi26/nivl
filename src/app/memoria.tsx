import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { Alert, StyleSheet, View } from 'react-native';
import { TextoSistema } from '@/components/TextoSistema';
import {
  Card,
  Chip,
  ChipRow,
  EmptyState,
  FadeIn,
  Row,
  RowValue,
  Screen,
  ScreenHeader,
  Section,
  Stagger,
  Stat,
  StatRow,
  Tag,
} from '@/components/ui';
import {
  fetchDossier,
  fetchFacts,
  fetchMonthCost,
  type CoachFact,
} from '@/lib/coach';
import { colors } from '@/lib/theme';

const CATEGORIAS: { clave: string; etiqueta: string }[] = [
  { clave: 'todo', etiqueta: 'Todo' },
  { clave: 'aprendizaje', etiqueta: 'Aprendizajes' },
  { clave: 'venta', etiqueta: 'Ventas' },
  { clave: 'metrica', etiqueta: 'Métricas' },
  { clave: 'log', etiqueta: 'Registro' },
  { clave: 'objetivo', etiqueta: 'Objetivos' },
  { clave: 'proyecto', etiqueta: 'Proyectos' },
  { clave: 'regla', etiqueta: 'Reglas' },
  { clave: 'perfil', etiqueta: 'Perfil' },
];

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** "2026-09-14" → "14 sep". Si no parece una fecha, se devuelve tal cual. */
function fechaCorta(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${Number(m[3])} ${MESES[Number(m[2]) - 1] ?? ''}`;
}

function etiquetaCategoria(clave: string): string {
  return CATEGORIAS.find((c) => c.clave === clave)?.etiqueta ?? clave;
}

export default function MemoriaScreen() {
  const [dossier, setDossier] = useState<{ content: string; version: number } | null>(null);
  const [hechos, setHechos] = useState<CoachFact[]>([]);
  const [gasto, setGasto] = useState<number | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtro, setFiltro] = useState('todo');
  const [dossierAbierto, setDossierAbierto] = useState(false);

  const cargar = useCallback(async () => {
    try {
      setError(null);
      const [d, h, g] = await Promise.all([fetchDossier(), fetchFacts(200), fetchMonthCost()]);
      setDossier(d);
      setHechos(h);
      setGasto(g);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo leer la memoria.');
    } finally {
      setCargando(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar]),
  );

  const visibles = filtro === 'todo' ? hechos : hechos.filter((h) => h.category === filtro);

  if (cargando) {
    return (
      <Screen>
        <ScreenHeader onBack={() => router.back()} eyebrow="El sistema recuerda" title="Memoria" />
        <EmptyState icon="library-outline" title="Leyendo la memoria" body="Un momento." />
      </Screen>
    );
  }

  const subtitulo = error
    ? 'La memoria no responde.'
    : hechos.length === 0
      ? 'Todavía no hay nada anotado. Se escribe sola mientras hablas con el coach.'
      : `${hechos.length} ${hechos.length === 1 ? 'hecho anotado' : 'hechos anotados'} · dossier v${dossier?.version ?? 0}`;

  return (
    <Screen>
      <Stagger>
        <FadeIn index={0}>
          <ScreenHeader onBack={() => router.back()} eyebrow="El sistema recuerda" title="Memoria" subtitle={subtitulo} />
        </FadeIn>

        {error ? (
          <FadeIn index={1}>
            <Card variant="outline" accent={colors.red}>
              <EmptyState
                compact
                icon="alert-circle-outline"
                title="No se pudo leer la memoria"
                body={error}
                action={{ label: 'Reintentar', onPress: () => cargar() }}
              />
            </Card>
          </FadeIn>
        ) : null}

        <FadeIn index={1}>
          <Card>
            <StatRow>
              <Stat value={hechos.length} label="Hechos" />
              <Stat value={`v${dossier?.version ?? 0}`} label="Dossier" />
              <Stat value={gasto === null ? '—' : gasto.toFixed(2).replace('.', ',')} unit={gasto === null ? undefined : '$'} label="Este mes" />
            </StatRow>
          </Card>
        </FadeIn>

        <FadeIn index={2}>
          <Section
            title="Quién eres para el sistema"
            tone="accent"
            action={
              dossier?.content
                ? {
                    label: dossierAbierto ? 'Contraer' : 'Leer todo',
                    icon: dossierAbierto ? 'chevron-up' : 'chevron-down',
                    onPress: () => setDossierAbierto((v) => !v),
                  }
                : undefined
            }
          >
            {dossier?.content ? (
              <Card>
                <View style={!dossierAbierto && styles.dossierPlegado}>
                  <TextoSistema texto={dossier.content} />
                </View>
                {!dossierAbierto ? <View style={styles.dossierVelo} pointerEvents="none" /> : null}
              </Card>
            ) : (
              <Card variant="outline">
                <EmptyState
                  compact
                  icon="library-outline"
                  title="Sin memoria estable aún"
                  body="Se escribe sola cuando algo estructural cambia: un objetivo nuevo, un proyecto que muere, una regla que pactas."
                />
              </Card>
            )}
          </Section>
        </FadeIn>

        <FadeIn index={3}>
          <Section title="Hechos" meta={visibles.length > 0 ? `${visibles.length}` : undefined}>
            {hechos.length > 0 ? (
              <ChipRow style={styles.filtros}>
                {CATEGORIAS.map((c) => {
                  const n = c.clave === 'todo' ? hechos.length : hechos.filter((h) => h.category === c.clave).length;
                  if (!n && c.clave !== 'todo') return null;
                  return (
                    <Chip
                      key={c.clave}
                      small
                      label={`${c.etiqueta} · ${n}`}
                      selected={filtro === c.clave}
                      onPress={() => setFiltro(c.clave)}
                      accessibilityLabel={`Filtrar por ${c.etiqueta}, ${n}`}
                    />
                  );
                })}
              </ChipRow>
            ) : null}

            {visibles.length > 0 ? (
              <Card padded={false} style={styles.lista}>
                {visibles.map((h, i) => (
                  <Row
                    key={h.id}
                    first={i === 0}
                    title={h.content}
                    detail={filtro === 'todo' ? <Tag>{etiquetaCategoria(h.category)}</Tag> : undefined}
                    trailing={<RowValue>{fechaCorta(h.date)}</RowValue>}
                    onPress={() => Alert.alert(`${etiquetaCategoria(h.category)} · ${h.date}`, h.content)}
                    accessibilityLabel={`${etiquetaCategoria(h.category)}, ${h.date}: ${h.content}`}
                  />
                ))}
              </Card>
            ) : (
              <Card variant="outline">
                <EmptyState
                  compact
                  icon="time-outline"
                  title={hechos.length === 0 ? 'Nada anotado todavía' : 'Nada en esta categoría'}
                  body={
                    hechos.length === 0
                      ? 'Cada cifra, venta, aprendizaje o regla que le cuentes al coach queda aquí con su fecha.'
                      : 'Prueba otra categoría.'
                  }
                />
              </Card>
            )}
          </Section>
        </FadeIn>
      </Stagger>
    </Screen>
  );
}

const styles = StyleSheet.create({
  dossierPlegado: { maxHeight: 168, overflow: 'hidden' },
  dossierVelo: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 28, backgroundColor: colors.panel, opacity: 0.85 },
  filtros: { marginBottom: 12 },
  lista: { paddingHorizontal: 16, paddingVertical: 2 },
});
