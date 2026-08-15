import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack } from 'expo-router';
import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SystemWindow } from '@/components/SystemWindow';
import {
  fetchDossier,
  fetchFacts,
  fetchMonthCost,
  type CoachFact,
} from '@/lib/coach';
import { colors, fonts } from '@/lib/theme';

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

  return (
    <SafeAreaView style={styles.screen} edges={['bottom']}>
      <Stack.Screen options={{ title: 'Memoria del sistema' }} />
      {cargando ? (
        <View style={styles.centro}>
          <ActivityIndicator color={colors.cyan} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.contenido}>
          {error ? (
            <SystemWindow color={colors.redDim} fill={colors.redPanel}>
              <Text style={styles.error}>{error}</Text>
            </SystemWindow>
          ) : null}

          <SystemWindow>
            <Text style={styles.seccion}>ESTADO DE LA MEMORIA</Text>
            <View style={styles.kpis}>
              <View style={styles.kpi}>
                <Text style={styles.kpiNumero}>{hechos.length}</Text>
                <Text style={styles.kpiEtiqueta}>hechos</Text>
              </View>
              <View style={styles.kpi}>
                <Text style={styles.kpiNumero}>v{dossier?.version ?? 0}</Text>
                <Text style={styles.kpiEtiqueta}>dossier</Text>
              </View>
              <View style={styles.kpi}>
                <Text style={styles.kpiNumero}>
                  {gasto === null ? '—' : `${gasto.toFixed(2)}$`}
                </Text>
                <Text style={styles.kpiEtiqueta}>este mes</Text>
              </View>
            </View>
          </SystemWindow>

          <SystemWindow>
            <Pressable
              onPress={() => setDossierAbierto((v) => !v)}
              style={styles.cabeceraDossier}
              accessibilityRole="button"
              accessibilityLabel={dossierAbierto ? 'Contraer el dossier' : 'Desplegar el dossier'}
            >
              <Text style={styles.seccion}>QUIÉN ERES PARA EL SISTEMA</Text>
              <Ionicons
                name={dossierAbierto ? 'chevron-up' : 'chevron-down'}
                size={16}
                color={colors.cyanText}
              />
            </Pressable>
            {dossier?.content ? (
              <Text
                style={styles.dossier}
                numberOfLines={dossierAbierto ? undefined : 6}
              >
                {dossier.content}
              </Text>
            ) : (
              <Text style={styles.vacio}>
                El sistema aún no tiene memoria estable. Se escribe sola cuando algo estructural
                cambia: un objetivo nuevo, un proyecto que muere, una regla que pactas.
              </Text>
            )}
          </SystemWindow>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filtros}
          >
            {CATEGORIAS.map((c) => {
              const n = c.clave === 'todo' ? hechos.length : hechos.filter((h) => h.category === c.clave).length;
              if (!n && c.clave !== 'todo') return null;
              const activo = filtro === c.clave;
              return (
                <Pressable
                  key={c.clave}
                  onPress={() => setFiltro(c.clave)}
                  style={[styles.filtro, activo && styles.filtroActivo]}
                  accessibilityRole="button"
                  accessibilityLabel={`Filtrar por ${c.etiqueta}`}
                  accessibilityState={{ selected: activo }}
                >
                  <Text style={[styles.filtroTexto, activo && styles.filtroTextoActivo]}>
                    {c.etiqueta} {n}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {visibles.length ? (
            visibles.map((h) => (
              <SystemWindow key={h.id} style={styles.hecho}>
                <View style={styles.hechoCabecera}>
                  <Text style={styles.hechoFecha}>{h.date}</Text>
                  <Text style={styles.hechoCategoria}>{h.category.toUpperCase()}</Text>
                </View>
                <Text style={styles.hechoTexto}>{h.content}</Text>
              </SystemWindow>
            ))
          ) : (
            <SystemWindow>
              <Text style={styles.vacio}>Nada registrado en esta categoría todavía.</Text>
            </SystemWindow>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  contenido: { padding: 16, paddingBottom: 32 },
  seccion: {
    fontFamily: fonts.heading,
    fontSize: 13,
    letterSpacing: 2.5,
    color: colors.cyanText,
    marginBottom: 10,
  },
  kpis: { flexDirection: 'row', gap: 20 },
  kpi: { minWidth: 0 },
  kpiNumero: {
    fontFamily: fonts.number,
    fontSize: 20,
    color: colors.text,
  },
  kpiEtiqueta: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.textDim,
    marginTop: 2,
  },
  cabeceraDossier: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dossier: {
    fontFamily: fonts.body,
    fontSize: 12.5,
    lineHeight: 19,
    color: colors.textDim,
  },
  vacio: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 20,
    color: colors.textDim,
  },
  filtros: { gap: 8, paddingBottom: 12 },
  filtro: {
    borderWidth: 1,
    borderColor: colors.line,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  filtroActivo: { borderColor: colors.cyan, backgroundColor: colors.cyanFaint },
  filtroTexto: {
    fontFamily: fonts.body,
    fontSize: 11.5,
    color: colors.textDim,
  },
  filtroTextoActivo: { color: colors.cyanText },
  hecho: { marginBottom: 8 },
  hechoCabecera: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  hechoFecha: {
    fontFamily: fonts.number,
    fontSize: 11,
    color: colors.textFaint,
  },
  hechoCategoria: {
    fontFamily: fonts.semibold,
    fontSize: 10,
    letterSpacing: 1.5,
    color: colors.cyanDim,
  },
  hechoTexto: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 19,
    color: colors.text,
  },
  error: { fontFamily: fonts.body, fontSize: 13, color: colors.red },
});
