import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  Platform,
  KeyboardAvoidingView,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SystemButton } from '@/components/SystemButton';
import { SystemWindow } from '@/components/SystemWindow';
import { useAuth } from '@/lib/auth';
import { clasificarMovimientos } from '@/lib/coach';
import { addDays, dateKey } from '@/lib/dates';
import {
  CATEGORIAS,
  fetchAccounts,
  fetchBudgets,
  fetchMoneyPlan,
  fetchTransactions,
  NOMBRE_CATEGORIA,
  recategorizar,
  registrarEfectivo,
  type Budget,
  type Categoria,
  type MoneyAccount,
  type MoneyPlan,
  type Transaction,
} from '@/lib/money';
import {
  detectarSuscripciones,
  diasDelMes,
  mesDe,
  mesesDeAire,
  porCategoria,
  proyeccionMes,
  resumenPorMes,
  ritmoPresupuesto,
  tasaAhorro,
} from '@/lib/moneymath';
import { colors, fonts } from '@/lib/theme';

const eur = (n: number, dec = 0) =>
  `${n.toLocaleString('es-ES', { minimumFractionDigits: dec, maximumFractionDigits: dec })} €`;

export default function Economia() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const hoy = dateKey();

  const [movs, setMovs] = useState<Transaction[]>([]);
  const [cuentas, setCuentas] = useState<MoneyAccount[]>([]);
  const [plan, setPlan] = useState<MoneyPlan | null>(null);
  const [presupuestos, setPresupuestos] = useState<Budget[]>([]);
  const [editando, setEditando] = useState<Transaction | null>(null);
  const [nuevoAbierto, setNuevoAbierto] = useState(false);
  const [importe, setImporte] = useState('');
  const [concepto, setConcepto] = useState('');
  const [catNueva, setCatNueva] = useState<Categoria>('otros');
  const [guardando, setGuardando] = useState(false);
  const [clasificando, setClasificando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const [t, c, p, b] = await Promise.all([
        fetchTransactions(addDays(hoy, -180)),
        fetchAccounts(),
        fetchMoneyPlan(),
        fetchBudgets(),
      ]);
      setMovs(t);
      setCuentas(c);
      setPlan(p);
      setPresupuestos(b);
    } catch (e) {
      Alert.alert('Error del sistema', e instanceof Error ? e.message : 'Fallo desconocido');
    }
  }, [hoy]);

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar]),
  );

  const vista = useMemo(() => {
    const mesActual = mesDe(hoy);
    const dia = Number(hoy.slice(8, 10));
    const totalDias = diasDelMes(mesActual);
    const resumen = resumenPorMes(movs);
    const esteMes = resumen.find((r) => r.mes === mesActual) ?? {
      mes: mesActual, ingresos: 0, gastos: 0, apartado: 0, neto: 0, movimientos: 0,
    };
    const cerrados = resumen.filter((r) => r.mes !== mesActual);
    const gastoMedio = cerrados.length
      ? cerrados.reduce((a, r) => a + r.gastos, 0) / cerrados.length
      : esteMes.gastos;
    const saldo = cuentas.reduce((a, c) => a + Number(c.balance ?? 0), 0);
    const delMes = movs.filter((m) => mesDe(m.date) === mesActual);

    return {
      mesActual, dia, totalDias, esteMes, cerrados, gastoMedio, saldo,
      categorias: porCategoria(delMes),
      suscripciones: detectarSuscripciones(movs),
      sinClasificar: movs.filter((m) => m.category === 'sin_clasificar' && m.amount < 0),
      aire: mesesDeAire(saldo, gastoMedio),
      proyeccion: proyeccionMes(esteMes.gastos, dia, totalDias),
      ritmo: plan?.spend_cap ? ritmoPresupuesto(esteMes.gastos, Number(plan.spend_cap), dia, totalDias) : null,
      gastadoPorCat: new Map(porCategoria(delMes).map((c) => [c.categoria, c.total])),
    };
  }, [movs, cuentas, plan, hoy]);

  // Pasa por Haiku, no por el coach: leer "MERCADONA 4471" y decir que es
  // supermercado no pide criterio, y hacerlo con el modelo del coach costaría
  // cien veces más por arrastrar todo su contexto para nada.
  const clasificarTodo = async () => {
    if (clasificando) return;
    setClasificando(true);
    try {
      const r = await clasificarMovimientos();
      await cargar();
      Alert.alert(r.clasificados ? 'El sistema ha clasificado' : 'Sin cambios', r.texto);
    } catch (e) {
      Alert.alert('Error del sistema', e instanceof Error ? e.message : 'Fallo desconocido');
    } finally {
      setClasificando(false);
    }
  };

  const aplicarCategoria = async (cat: Categoria) => {
    if (!editando || !userId) return;
    try {
      const n = await recategorizar(userId, editando, cat, true);
      setEditando(null);
      await cargar();
      if (n > 1) {
        Alert.alert(
          'El sistema aprende',
          `${n} movimientos clasificados. A partir de ahora lo hace solo.`,
        );
      }
    } catch (e) {
      Alert.alert('Error del sistema', e instanceof Error ? e.message : 'Fallo desconocido');
    }
  };

  const guardarEfectivo = async () => {
    if (!userId || guardando) return;
    const n = Number(importe.replace(',', '.'));
    if (!Number.isFinite(n) || n === 0) {
      Alert.alert('Importe inválido', 'Escribe el importe. Negativo si es gasto, positivo si es ingreso.');
      return;
    }
    if (!concepto.trim()) {
      Alert.alert('Falta el concepto', 'Dentro de un mes no vas a recordar qué fue.');
      return;
    }
    setGuardando(true);
    try {
      await registrarEfectivo(userId, {
        date: hoy,
        amount: n,
        description: concepto.trim(),
        category: catNueva,
      });
      setNuevoAbierto(false);
      setImporte('');
      setConcepto('');
      await cargar();
    } catch (e) {
      Alert.alert('Error del sistema', e instanceof Error ? e.message : 'Fallo desconocido');
    } finally {
      setGuardando(false);
    }
  };

  const tasa = tasaAhorro(vista.esteMes.ingresos, vista.esteMes.gastos);
  const maxCat = vista.categorias[0]?.total ?? 1;

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Volver">
          <Ionicons name="chevron-back" size={24} color={colors.accent} />
        </Pressable>
        <Text style={styles.title}>ECONOMÍA</Text>
        <Pressable
          onPress={() => setNuevoAbierto(true)}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Registrar movimiento en efectivo"
        >
          <Ionicons name="add" size={24} color={colors.accent} />
        </Pressable>
      </View>

      {movs.length === 0 ? (
        <ScrollView automaticallyAdjustKeyboardInsets keyboardShouldPersistTaps="handled" contentContainerStyle={styles.contenido}>
          <SystemWindow>
            <Text style={styles.windowTitle}>SIN DATOS</Text>
            <Text style={styles.vacio}>
              El sistema no ve tu dinero todavía. Exporta el extracto de Revolut en formato Excel
              o CSV (Menú → Extractos) e impórtalo desde el ordenador con{'\n\n'}
              <Text style={styles.mono}>node scripts/import-revolut.mjs extracto.csv</Text>
              {'\n\n'}
              Hasta entonces el coach no te dirá en qué se te va: no lo sabe, y no se lo va a
              inventar.
            </Text>
          </SystemWindow>
        </ScrollView>
      ) : (
        <ScrollView automaticallyAdjustKeyboardInsets keyboardShouldPersistTaps="handled" contentContainerStyle={styles.contenido}>
          <SystemWindow color={colors.accentDim}>
            <Text style={styles.windowTitle}>
              ESTE MES · DÍA {vista.dia} DE {vista.totalDias}
            </Text>
            <View style={styles.kpis}>
              <View>
                <Text style={styles.kpiNum}>{eur(vista.esteMes.ingresos)}</Text>
                <Text style={styles.kpiLabel}>entrado</Text>
              </View>
              <View>
                <Text style={[styles.kpiNum, { color: colors.red }]}>{eur(vista.esteMes.gastos)}</Text>
                <Text style={styles.kpiLabel}>gastado</Text>
              </View>
              <View>
                <Text style={styles.kpiNum}>{tasa === null ? '—' : `${tasa.toFixed(0)} %`}</Text>
                <Text style={styles.kpiLabel}>ahorro</Text>
              </View>
            </View>
            <Text style={styles.linea}>
              Al ritmo actual cierras el mes en {eur(vista.proyeccion)} de gasto.
            </Text>
            {vista.ritmo !== null && plan?.spend_cap ? (
              <Text style={[styles.linea, vista.ritmo > 1.1 && styles.alerta]}>
                Ritmo contra tu tope de {eur(Number(plan.spend_cap))}: ×{vista.ritmo.toFixed(2)}
                {vista.ritmo > 1.1 ? ' — vas desbordado' : vista.ritmo < 0.9 ? ' — vas sobrado' : ' — en el guion'}
              </Text>
            ) : null}
            {plan?.income_target ? (
              <Text style={styles.linea}>
                {vista.esteMes.ingresos >= Number(plan.income_target)
                  ? `Objetivo de ${eur(Number(plan.income_target))} cumplido.`
                  : `Para tu objetivo de ${eur(Number(plan.income_target))} faltan ${eur(Number(plan.income_target) - vista.esteMes.ingresos)} en ${vista.totalDias - vista.dia} días.`}
              </Text>
            ) : null}
          </SystemWindow>

          <SystemWindow>
            <Text style={styles.windowTitle}>MESES DE AIRE</Text>
            {vista.aire === null ? (
              <Text style={styles.vacio}>Sin saldo o sin gasto medio: no hay cuenta atrás que dar.</Text>
            ) : (
              <>
                <Text style={styles.aireNum}>{vista.aire.toFixed(1)}</Text>
                <Text style={styles.linea}>
                  {eur(vista.saldo)} de saldo entre {eur(vista.gastoMedio)} de gasto medio al mes.
                </Text>
                {plan?.runway_target_months ? (
                  <Text style={[styles.linea, vista.aire < Number(plan.runway_target_months) && styles.alerta]}>
                    {vista.aire >= Number(plan.runway_target_months)
                      ? `Por encima del colchón pactado de ${plan.runway_target_months} meses.`
                      : `Por debajo del colchón pactado de ${plan.runway_target_months} meses.`}
                  </Text>
                ) : null}
              </>
            )}
          </SystemWindow>

          {vista.sinClasificar.length > 0 ? (
            <SystemWindow color={colors.goldDim}>
              <Text style={styles.windowTitle}>SIN CLASIFICAR · {vista.sinClasificar.length}</Text>
              <Text style={styles.hint}>
                Este dinero no aparece en ningún presupuesto. Toca uno para decirle qué era: el
                sistema aprende la regla y no vuelve a preguntártelo.
              </Text>
              <SystemButton
                title="Que los clasifique el sistema"
                onPress={clasificarTodo}
                loading={clasificando}
                style={{ marginBottom: 6 }}
              />
              {vista.sinClasificar.slice(0, 8).map((m) => (
                <Pressable
                  key={m.id}
                  onPress={() => setEditando(m)}
                  style={styles.movRow}
                  accessibilityRole="button"
                  accessibilityLabel={`Clasificar ${m.description} de ${Math.abs(m.amount)} euros`}
                >
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.movDesc} numberOfLines={1}>{m.description}</Text>
                    <Text style={styles.movFecha}>{m.date}</Text>
                  </View>
                  <Text style={styles.movImporte}>{eur(Math.abs(m.amount), 2)}</Text>
                </Pressable>
              ))}
            </SystemWindow>
          ) : null}

          <SystemWindow>
            <Text style={styles.windowTitle}>EN QUÉ SE VA</Text>
            {vista.categorias.length === 0 ? (
              <Text style={styles.vacio}>Sin gastos este mes.</Text>
            ) : (
              vista.categorias.map((c) => {
                const tope = presupuestos.find((b) => b.category === c.categoria);
                const pasado = tope ? c.total > Number(tope.monthly_limit) : false;
                return (
                  <View key={c.categoria} style={styles.catRow}>
                    <View style={styles.catCabecera}>
                      <Text style={styles.catNombre}>{NOMBRE_CATEGORIA[c.categoria] ?? c.categoria}</Text>
                      <Text style={[styles.catTotal, pasado && styles.alerta]}>
                        {eur(c.total)}
                        {tope ? ` / ${eur(Number(tope.monthly_limit))}` : ''}
                      </Text>
                    </View>
                    <View style={styles.barra}>
                      <View
                        style={[
                          styles.barraRelleno,
                          { width: `${Math.min(100, (c.total / maxCat) * 100)}%` },
                          pasado && { backgroundColor: colors.red },
                        ]}
                      />
                    </View>
                  </View>
                );
              })
            )}
          </SystemWindow>

          <SystemWindow>
            <Text style={styles.windowTitle}>CARGOS RECURRENTES</Text>
            {vista.suscripciones.length === 0 ? (
              <Text style={styles.vacio}>
                Ninguno detectado. Hacen falta tres meses de histórico para verlos.
              </Text>
            ) : (
              <>
                {vista.suscripciones.slice(0, 10).map((s) => (
                  <View key={s.cobrador} style={styles.subRow}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.movDesc} numberOfLines={1}>{s.cobrador}</Text>
                      <Text style={styles.movFecha}>
                        {eur(s.importeMedio, 2)}/mes · {s.meses} meses · último {s.ultimo}
                      </Text>
                    </View>
                    <Text style={styles.subAnual}>{eur(s.anual)}/año</Text>
                  </View>
                ))}
                <Text style={styles.hint}>
                  Son {eur(vista.suscripciones.reduce((a, s) => a + s.anual, 0))} al año que se
                  cobran solos. Cancelar lo que no usas es el único ahorro que no exige disciplina.
                </Text>
              </>
            )}
          </SystemWindow>

          {vista.cerrados.length > 0 ? (
            <SystemWindow>
              <Text style={styles.windowTitle}>MESES CERRADOS</Text>
              {vista.cerrados.slice(-5).reverse().map((r) => (
                <Text key={r.mes} style={styles.linea}>
                  {r.mes} · entró {eur(r.ingresos)} · gastó {eur(r.gastos)}
                  {r.ingresos > 0 ? ` · ahorro ${(((r.ingresos - r.gastos) / r.ingresos) * 100).toFixed(0)} %` : ''}
                </Text>
              ))}
            </SystemWindow>
          ) : null}
        </ScrollView>
      )}

      <Modal visible={editando !== null} transparent animationType="slide" onRequestClose={() => setEditando(null)}>
        <KeyboardAvoidingView
          style={styles.backdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setEditando(null)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.sheetTitle}>¿QUÉ FUE ESTO?</Text>
            <Text style={styles.sheetSub} numberOfLines={2}>
              {editando?.description} · {editando ? eur(Math.abs(editando.amount), 2) : ''}
            </Text>
            <ScrollView automaticallyAdjustKeyboardInsets keyboardShouldPersistTaps="handled" style={{ maxHeight: 320 }}>
              <View style={styles.chips}>
                {CATEGORIAS.filter((c) => c !== 'sin_clasificar').map((c) => (
                  <Pressable
                    key={c}
                    onPress={() => aplicarCategoria(c)}
                    style={styles.chip}
                    accessibilityRole="button"
                    accessibilityLabel={NOMBRE_CATEGORIA[c]}
                  >
                    <Text style={styles.chipText}>{NOMBRE_CATEGORIA[c]}</Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={nuevoAbierto} transparent animationType="slide" onRequestClose={() => setNuevoAbierto(false)}>
        <KeyboardAvoidingView
          style={styles.backdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setNuevoAbierto(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.sheetTitle}>MOVIMIENTO EN EFECTIVO</Text>
            <Text style={styles.sheetSub}>
              Lo que el banco no ve. Negativo si es gasto, positivo si es un cobro en mano.
            </Text>
            <TextInput
              style={styles.input}
              value={importe}
              onChangeText={setImporte}
              placeholder="-25,00"
              placeholderTextColor={colors.textFaint}
              keyboardType="numbers-and-punctuation"
              accessibilityLabel="Importe en euros"
            />
            <TextInput
              style={styles.input}
              value={concepto}
              onChangeText={setConcepto}
              placeholder="Qué fue"
              placeholderTextColor={colors.textFaint}
              accessibilityLabel="Concepto"
            />
            <ScrollView automaticallyAdjustKeyboardInsets keyboardShouldPersistTaps="handled" horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
              <View style={styles.chipsFila}>
                {CATEGORIAS.filter((c) => c !== 'sin_clasificar').map((c) => (
                  <Pressable
                    key={c}
                    onPress={() => setCatNueva(c)}
                    style={[styles.chip, catNueva === c && styles.chipOn]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: catNueva === c }}
                    accessibilityLabel={NOMBRE_CATEGORIA[c]}
                  >
                    <Text style={[styles.chipText, catNueva === c && styles.chipTextOn]}>
                      {NOMBRE_CATEGORIA[c]}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
            <SystemButton title="Registrar" onPress={guardarEfectivo} loading={guardando} style={{ marginTop: 16 }} />
          </Pressable>
        </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  title: { fontFamily: fonts.heading, fontSize: 15, letterSpacing: 3, color: colors.text },
  contenido: { padding: 16, paddingBottom: 32 },
  windowTitle: {
    fontFamily: fonts.heading,
    fontSize: 12,
    letterSpacing: 2.5,
    color: colors.accentText,
    marginBottom: 10,
  },
  kpis: { flexDirection: 'row', gap: 26, flexWrap: 'wrap', marginBottom: 10 },
  kpiNum: { fontFamily: fonts.number, fontSize: 17, color: colors.text },
  kpiLabel: { fontFamily: fonts.body, fontSize: 11, color: colors.textDim },
  aireNum: { fontFamily: fonts.number, fontSize: 30, color: colors.accent, marginBottom: 4 },
  linea: { fontFamily: fonts.body, fontSize: 12.5, lineHeight: 18, color: colors.textDim, marginTop: 3 },
  alerta: { color: colors.red },
  vacio: { fontFamily: fonts.body, fontSize: 13, lineHeight: 20, color: colors.textDim },
  mono: { fontFamily: fonts.semibold, color: colors.accentText, fontSize: 12.5 },
  hint: {
    fontFamily: fonts.body,
    fontSize: 11.5,
    lineHeight: 16,
    color: colors.textFaint,
    marginTop: 8,
  },
  movRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 9,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  movDesc: { fontFamily: fonts.semibold, fontSize: 13, color: colors.text },
  movFecha: { fontFamily: fonts.body, fontSize: 11, color: colors.textFaint, marginTop: 1 },
  movImporte: { fontFamily: fonts.number, fontSize: 13, color: colors.red },
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 9,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  subAnual: { fontFamily: fonts.number, fontSize: 13, color: colors.gold },
  catRow: { marginBottom: 12 },
  catCabecera: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  catNombre: { fontFamily: fonts.semibold, fontSize: 13, color: colors.text },
  catTotal: { fontFamily: fonts.number, fontSize: 12.5, color: colors.accentText },
  barra: { height: 5, backgroundColor: colors.track, overflow: 'hidden' },
  barraRelleno: { height: 5, backgroundColor: colors.accent },
  backdrop: { flex: 1, backgroundColor: 'rgba(2, 6, 14, 0.85)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.panel,
    borderTopWidth: 1.5,
    borderTopColor: colors.accentDim,
    padding: 20,
    paddingBottom: 34,
  },
  sheetTitle: {
    fontFamily: fonts.heading,
    fontSize: 13,
    letterSpacing: 2.5,
    color: colors.accentText,
    marginBottom: 6,
  },
  sheetSub: { fontFamily: fonts.body, fontSize: 12.5, color: colors.textDim, marginBottom: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chipsFila: { flexDirection: 'row', gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: colors.accentFaint,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  chipOn: { borderColor: colors.accent, backgroundColor: colors.accentFaint },
  chipText: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.textDim },
  chipTextOn: { color: colors.text },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bg,
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 11,
    marginTop: 8,
  },
});
