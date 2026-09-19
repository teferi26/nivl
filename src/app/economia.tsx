import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SystemButton } from '@/components/SystemButton';
import { XPBar } from '@/components/XPBar';
import {
  Card,
  Chip,
  ChipRow,
  ChipWrap,
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
} from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { accessNotice, clasificarMovimientos, CoachAccessError } from '@/lib/coach';
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

const num = (n: number, dec = 0) =>
  n.toLocaleString('es-ES', { minimumFractionDigits: dec, maximumFractionDigits: dec });
const eur = (n: number, dec = 0) => `${num(n, dec)} €`;
/** Con signo: negativo es gasto, positivo ingreso. El signo es la información. */
const eurSigno = (n: number) => `${n < 0 ? '−' : '+'}${eur(Math.abs(n), 2)}`;

const CATEGORIAS_ELEGIBLES = CATEGORIAS.filter((c) => c !== 'sin_clasificar');

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
  const [cargado, setCargado] = useState(false);
  const [refrescando, setRefrescando] = useState(false);

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
    } finally {
      setCargado(true);
    }
  }, [hoy]);

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar]),
  );

  const refrescar = async () => {
    setRefrescando(true);
    await cargar();
    setRefrescando(false);
  };

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
      if (e instanceof CoachAccessError) {
        // La clasificación automática es IA y pasa por el mismo candado que el
        // coach. No es un error: clasificar a mano sigue funcionando, y quien
        // quiera la automática tiene el camino a Pro.
        Alert.alert(
          e.reason === 'sin_suscripcion' ? 'Clasificación automática' : 'El sistema',
          e.reason === 'sin_suscripcion'
            ? 'Que el sistema clasifique por ti es parte de NIVL Pro. Puedes seguir clasificando a mano: toca un movimiento y el sistema aprende la regla.'
            : accessNotice(e),
          e.reason === 'sin_suscripcion'
            ? [
                { text: 'Ahora no', style: 'cancel' },
                { text: 'Ver NIVL Pro', onPress: () => router.push('/pro') },
              ]
            : [{ text: 'Entendido' }],
        );
      } else {
        Alert.alert('Error del sistema', e instanceof Error ? e.message : 'Fallo desconocido');
      }
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
  const tope = plan?.spend_cap ? Number(plan.spend_cap) : null;
  const objetivoIngresos = plan?.income_target ? Number(plan.income_target) : null;
  const colchon = plan?.runway_target_months ? Number(plan.runway_target_months) : null;
  const desbordado = vista.ritmo !== null && vista.ritmo > 1.1;
  const ritmoTexto =
    vista.ritmo === null ? null : vista.ritmo > 1.1 ? 'vas desbordado' : vista.ritmo < 0.9 ? 'vas sobrado' : 'en el guion';
  const bajoColchon = vista.aire !== null && colchon !== null && vista.aire < colchon;
  const anualSuscripciones = vista.suscripciones.reduce((a, s) => a + s.anual, 0);

  const subtitulo = !cargado
    ? undefined
    : movs.length === 0
      ? 'El sistema no ve tu dinero todavía.'
      : `Día ${vista.dia} de ${vista.totalDias}. Al ritmo actual cierras el mes en ${eur(vista.proyeccion)} de gasto.`;

  return (
    <Screen refreshing={refrescando} onRefresh={refrescar}>
      <Stagger>
        <FadeIn index={0}>
          <ScreenHeader
            onBack={() => router.back()}
            eyebrow="Dinero"
            title="Economía"
            subtitle={subtitulo}
            action={{
              icon: 'add',
              label: 'Registrar movimiento en efectivo',
              onPress: () => setNuevoAbierto(true),
              solid: true,
            }}
          />
        </FadeIn>

        {!cargado ? (
          <FadeIn index={1}>
            <EmptyState icon="hourglass-outline" title="Leyendo tus cuentas" body="El sistema suma los últimos seis meses." />
          </FadeIn>
        ) : movs.length === 0 ? (
          <FadeIn index={1}>
            <Card variant="outline">
              <EmptyState
                icon="wallet-outline"
                title="El sistema no ve tu dinero"
                body="Exporta el extracto de Revolut en Excel o CSV (Menú → Extractos) e impórtalo desde el ordenador. Hasta entonces el coach no te dirá en qué se te va: no lo sabe, y no se lo va a inventar."
              />
              <Text style={styles.mono} selectable>
                node scripts/import-revolut.mjs extracto.csv
              </Text>
            </Card>
          </FadeIn>
        ) : (
          <>
            <FadeIn index={1}>
              <Card>
                <StatRow>
                  <Stat value={num(vista.saldo)} unit="€" label="Saldo" />
                  <Stat value={num(vista.esteMes.ingresos)} unit="€" label="Entrado" />
                  <Stat value={num(vista.esteMes.gastos)} unit="€" label="Gastado" tone={desbordado ? 'red' : 'text'} />
                </StatRow>
                <StatRow style={styles.statsSecundarios}>
                  <Stat size="sm" value={tasa === null ? '—' : tasa.toFixed(0)} unit={tasa === null ? undefined : '%'} label="Ahorro" />
                  <Stat size="sm" value={num(vista.proyeccion)} unit="€" label="Proyección" />
                  <Stat
                    size="sm"
                    value={vista.ritmo === null ? '—' : `×${vista.ritmo.toFixed(2)}`}
                    label="Ritmo"
                    tone={desbordado ? 'red' : 'text'}
                  />
                </StatRow>
              </Card>
            </FadeIn>

            {tope !== null || objetivoIngresos !== null ? (
              <FadeIn index={2}>
                <Section title="Plan del mes" tone={desbordado ? 'red' : 'dim'}>
                  <Card accent={desbordado ? colors.red : undefined}>
                    {tope !== null ? (
                      <View>
                        <View style={styles.metaFila}>
                          <Text style={styles.metaNombre}>Tope de gasto</Text>
                          <Text style={[styles.metaValor, desbordado && styles.alerta]}>
                            {eur(vista.esteMes.gastos)} / {eur(tope)}
                          </Text>
                        </View>
                        <XPBar ratio={vista.esteMes.gastos / tope} color={desbordado ? colors.red : colors.accent} />
                        {ritmoTexto ? (
                          <Text style={[styles.nota, desbordado && styles.alerta]}>
                            Ritmo ×{vista.ritmo?.toFixed(2)}: {ritmoTexto}.
                          </Text>
                        ) : null}
                      </View>
                    ) : null}
                    {objetivoIngresos !== null ? (
                      <View style={tope !== null ? styles.metaBloque : undefined}>
                        <View style={styles.metaFila}>
                          <Text style={styles.metaNombre}>Objetivo de ingresos</Text>
                          <Text style={styles.metaValor}>
                            {eur(vista.esteMes.ingresos)} / {eur(objetivoIngresos)}
                          </Text>
                        </View>
                        <XPBar ratio={vista.esteMes.ingresos / objetivoIngresos} />
                        <Text style={styles.nota}>
                          {vista.esteMes.ingresos >= objetivoIngresos
                            ? 'Objetivo cumplido.'
                            : `Faltan ${eur(objetivoIngresos - vista.esteMes.ingresos)} en ${vista.totalDias - vista.dia} días.`}
                        </Text>
                      </View>
                    ) : null}
                  </Card>
                </Section>
              </FadeIn>
            ) : null}

            <FadeIn index={3}>
              <Section title="Meses de aire" tone={bajoColchon ? 'red' : 'dim'}>
                <Card accent={bajoColchon ? colors.red : undefined}>
                  {vista.aire === null ? (
                    <Text style={styles.texto}>Sin saldo o sin gasto medio: no hay cuenta atrás que dar.</Text>
                  ) : (
                    <>
                      <Stat
                        size="lg"
                        value={vista.aire.toFixed(1)}
                        unit="meses"
                        label="Con el gasto medio actual"
                        tone={bajoColchon ? 'red' : 'text'}
                      />
                      <Text style={styles.nota}>
                        {eur(vista.saldo)} de saldo entre {eur(vista.gastoMedio)} de gasto medio al mes.
                      </Text>
                      {colchon !== null ? (
                        <View style={styles.metaBloque}>
                          <XPBar ratio={vista.aire / colchon} color={bajoColchon ? colors.red : colors.accent} />
                          <Text style={[styles.nota, bajoColchon && styles.alerta]}>
                            {bajoColchon ? 'Por debajo' : 'Por encima'} del colchón pactado de {colchon} meses.
                          </Text>
                        </View>
                      ) : null}
                    </>
                  )}
                </Card>
              </Section>
            </FadeIn>

            {vista.sinClasificar.length > 0 ? (
              <FadeIn index={4}>
                <Section title="Sin clasificar" meta={`${vista.sinClasificar.length}`} tone="accent">
                  <Card padded={false} style={styles.lista}>
                    {vista.sinClasificar.slice(0, 8).map((m, i) => (
                      <Row
                        key={m.id}
                        first={i === 0}
                        leading={<Ionicons name="help-circle-outline" size={18} color={colors.textDim} />}
                        title={m.description}
                        detail={m.date}
                        trailing={<RowValue tone="accent">{eurSigno(m.amount)}</RowValue>}
                        chevron
                        onPress={() => setEditando(m)}
                        accessibilityLabel={`Clasificar ${m.description} de ${Math.abs(m.amount)} euros`}
                      />
                    ))}
                  </Card>
                  <SystemButton
                    title="Que los clasifique el sistema"
                    variant="outline"
                    icon="sparkles-outline"
                    onPress={clasificarTodo}
                    loading={clasificando}
                  />
                  <Text style={styles.nota}>
                    Este dinero no aparece en ningún presupuesto. Toca uno para decirle qué era: el sistema
                    aprende la regla y no vuelve a preguntártelo.
                  </Text>
                </Section>
              </FadeIn>
            ) : null}

            <FadeIn index={5}>
              <Section title="En qué se va" meta={vista.categorias.length > 0 ? `${vista.categorias.length}` : undefined}>
                {vista.categorias.length === 0 ? (
                  <Card variant="outline">
                    <EmptyState compact icon="pie-chart-outline" title="Sin gastos este mes" />
                  </Card>
                ) : (
                  <Card>
                    {vista.categorias.map((c, i) => {
                      const limite = presupuestos.find((b) => b.category === c.categoria);
                      const pasado = limite ? c.total > Number(limite.monthly_limit) : false;
                      return (
                        <View key={c.categoria} style={[styles.cat, i > 0 && styles.catSep]}>
                          <View style={styles.metaFila}>
                            <Text style={styles.metaNombre} numberOfLines={1}>
                              {NOMBRE_CATEGORIA[c.categoria] ?? c.categoria}
                            </Text>
                            <Text style={[styles.metaValor, pasado && styles.alerta]}>
                              {eur(c.total)}
                              {limite ? ` / ${eur(Number(limite.monthly_limit))}` : ''}
                            </Text>
                          </View>
                          <XPBar ratio={c.total / maxCat} color={pasado ? colors.red : colors.accent} height={5} />
                        </View>
                      );
                    })}
                  </Card>
                )}
              </Section>
            </FadeIn>

            <FadeIn index={6}>
              <Section
                title="Cargos recurrentes"
                meta={vista.suscripciones.length > 0 ? `${eur(anualSuscripciones)} al año` : undefined}
              >
                {vista.suscripciones.length === 0 ? (
                  <Card variant="outline">
                    <EmptyState
                      compact
                      icon="repeat-outline"
                      title="Ninguno detectado"
                      body="Hacen falta tres meses de histórico para verlos."
                    />
                  </Card>
                ) : (
                  <>
                    <Card padded={false} style={styles.lista}>
                      {vista.suscripciones.slice(0, 10).map((s, i) => (
                        <Row
                          key={s.cobrador}
                          first={i === 0}
                          leading={<Ionicons name="repeat-outline" size={18} color={colors.textDim} />}
                          title={s.cobrador}
                          detail={`${eur(s.importeMedio, 2)} al mes · ${s.meses} meses · último ${s.ultimo}`}
                          trailing={<RowValue strong>{eur(s.anual)}/año</RowValue>}
                        />
                      ))}
                    </Card>
                    <Text style={styles.nota}>
                      Son {eur(anualSuscripciones)} al año que se cobran solos. Cancelar lo que no usas es el
                      único ahorro que no exige disciplina.
                    </Text>
                  </>
                )}
              </Section>
            </FadeIn>

            {vista.cerrados.length > 0 ? (
              <FadeIn index={7}>
                <Section title="Meses cerrados" meta={`${vista.cerrados.length}`}>
                  <Card padded={false} style={styles.lista}>
                    {vista.cerrados.slice(-5).reverse().map((r, i) => (
                      <Row
                        key={r.mes}
                        first={i === 0}
                        title={r.mes}
                        detail={`Entró ${eur(r.ingresos)} · gastó ${eur(r.gastos)}`}
                        trailing={
                          r.ingresos > 0 ? (
                            <RowValue>{(((r.ingresos - r.gastos) / r.ingresos) * 100).toFixed(0)} % ahorro</RowValue>
                          ) : undefined
                        }
                      />
                    ))}
                  </Card>
                </Section>
              </FadeIn>
            ) : null}
          </>
        )}
      </Stagger>

      <Modal visible={editando !== null} transparent animationType="slide" onRequestClose={() => setEditando(null)}>
        <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={styles.backdropTap} onPress={() => setEditando(null)} accessibilityLabel="Cerrar" />
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetEyebrow}>CLASIFICAR</Text>
            <Text style={styles.sheetTitle}>¿Qué fue esto?</Text>
            <Text style={styles.sheetSub} numberOfLines={2}>
              {editando?.description} · {editando ? eurSigno(editando.amount) : ''}
            </Text>
            <ScrollView
              automaticallyAdjustKeyboardInsets
              keyboardShouldPersistTaps="handled"
              style={styles.sheetScroll}
              showsVerticalScrollIndicator={false}
            >
              <ChipWrap>
                {CATEGORIAS_ELEGIBLES.map((c) => (
                  <Chip
                    key={c}
                    label={NOMBRE_CATEGORIA[c] ?? c}
                    onPress={() => aplicarCategoria(c)}
                    accessibilityLabel={`Clasificar como ${NOMBRE_CATEGORIA[c] ?? c}`}
                  />
                ))}
              </ChipWrap>
            </ScrollView>
            <SystemButton title="Cancelar" variant="ghost" onPress={() => setEditando(null)} style={{ marginTop: 10 }} />
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={nuevoAbierto} transparent animationType="slide" onRequestClose={() => setNuevoAbierto(false)}>
        <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={styles.backdropTap} onPress={() => setNuevoAbierto(false)} accessibilityLabel="Cerrar" />
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetEyebrow}>EN EFECTIVO</Text>
            <Text style={styles.sheetTitle}>Lo que el banco no ve</Text>
            <Text style={styles.sheetSub}>Negativo si es gasto, positivo si es un cobro en mano.</Text>
            <Text style={styles.label}>Importe</Text>
            <TextInput
              style={styles.input}
              value={importe}
              onChangeText={setImporte}
              placeholder="-25,00"
              placeholderTextColor={colors.textFaint}
              keyboardType="numbers-and-punctuation"
              accessibilityLabel="Importe en euros"
              autoFocus
            />
            <Text style={styles.label}>Concepto</Text>
            <TextInput
              style={styles.input}
              value={concepto}
              onChangeText={setConcepto}
              placeholder="Qué fue"
              placeholderTextColor={colors.textFaint}
              accessibilityLabel="Concepto"
            />
            <Text style={styles.label}>Categoría</Text>
            <ChipRow>
              {CATEGORIAS_ELEGIBLES.map((c) => (
                <Chip
                  key={c}
                  label={NOMBRE_CATEGORIA[c] ?? c}
                  selected={catNueva === c}
                  onPress={() => setCatNueva(c)}
                  accessibilityLabel={`Categoría ${NOMBRE_CATEGORIA[c] ?? c}`}
                />
              ))}
            </ChipRow>
            <SystemButton title="Registrar" onPress={guardarEfectivo} loading={guardando} style={{ marginTop: 22 }} />
            <SystemButton title="Cancelar" variant="ghost" onPress={() => setNuevoAbierto(false)} style={{ marginTop: 6 }} />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  lista: { paddingHorizontal: 16, paddingVertical: 2 },
  statsSecundarios: { marginTop: 18, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.line },
  texto: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 20, color: colors.textDim },
  nota: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.textFaint, marginTop: 8 },
  alerta: { color: colors.red },
  mono: {
    fontFamily: fonts.semibold,
    fontSize: 12.5,
    color: colors.accentText,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 20,
  },
  metaFila: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, marginBottom: 8 },
  metaNombre: { flex: 1, minWidth: 0, fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
  metaValor: { fontFamily: fonts.number, fontSize: 12.5, color: colors.accentText },
  metaBloque: { marginTop: 18 },
  cat: { paddingVertical: 10 },
  catSep: { borderTopWidth: 1, borderTopColor: colors.line },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  backdropTap: { flex: 1 },
  sheet: {
    backgroundColor: colors.panel,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 34,
  },
  sheetHandle: { alignSelf: 'center', width: 36, height: 3, backgroundColor: colors.accentDim, marginBottom: 16 },
  sheetEyebrow: { fontFamily: fonts.heading, fontSize: 11, letterSpacing: 2.5, color: colors.accentText },
  sheetTitle: { fontFamily: fonts.heading, fontSize: 24, letterSpacing: -0.5, color: colors.text, marginTop: 6, marginBottom: 4 },
  sheetSub: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.textDim },
  sheetScroll: { maxHeight: 320, marginTop: 16 },
  label: {
    fontFamily: fonts.heading,
    fontSize: 11,
    letterSpacing: 2,
    color: colors.textFaint,
    textTransform: 'uppercase',
    marginTop: 18,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.accentDim,
    backgroundColor: colors.bg,
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
});
