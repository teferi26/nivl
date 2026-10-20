// NIVL · Economía: la vista (patrón L-RADICAL §C, FASE3 G2). Pura: todo llega
// por props desde useEconomia (o desde la galería con datos de mentira).
//
// De arriba abajo: el encabezado grabado («Dinero» / «ECONOMÍA», con el día y
// la proyección en la línea de contexto), las cifras del mes en dos franjas
// (saldo, entrado y gastado; ahorro, proyección y ritmo), el plan del mes y
// los meses de aire con su Barra estática, lo que está sin clasificar, en qué
// se va, los cargos recurrentes y los meses cerrados. Las filas van sobre
// hairlines, sin tarjeta, con el importe en Cinzel y la unidad en Outfit.
//
// Convención de signo del extracto: negativo es gasto, positivo es ingreso
// (el signo es la información). Los traspasos entre cuentas propias no
// cuentan: lo hace resumenPorMes.
//
// INVERSIÓN única: «Registrar movimiento en efectivo» en el encabezado. Sin
// rojo: lo desbordado se ve por la trama del rótulo y se lee en el texto.
// Nada de consejo de inversión ni promesas: el sistema mide y avisa.

import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';
import {
  Barra,
  CargaArena,
  EncabezadoArena,
  Entrada,
  ErrorSistema,
  FranjaCifras,
  TarjetaArena,
  type Cifra,
} from '@/components/arena';
import { Button, EmptyState, Row, Screen, Section, SIN_DATO, Tag } from '@/components/ui';
import { ink, space, stroke, type as tipo } from '@/design/tokens';
import { t } from '@/i18n';
import { NOMBRE_CATEGORIA, type Budget, type MoneyPlan, type Transaction } from '@/lib/money';
import { tasaAhorro, type ResumenMes, type Suscripcion } from '@/lib/moneymath';
import { fechaCorta } from '@/components/fecha';
import { eur, eurSigno, num } from './formato';


/** Claves de economia:vista.mesCorto, de enero a diciembre. */
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'] as const;

/** 'AAAA-MM' → «sept 2026». */
function mesLabel(mes: string): string {
  const [a, m] = mes.split('-');
  const clave = MESES[Number(m) - 1];
  return clave ? t('economia:vista.mesAnio', { mes: t(`economia:vista.mesCorto.${clave}`), anio: a }) : mes;
}

/** Lo que useEconomia calcula de los movimientos, el saldo y el plan. */
export interface EconomiaDatos {
  mesActual: string;
  dia: number;
  totalDias: number;
  esteMes: ResumenMes;
  cerrados: ResumenMes[];
  gastoMedio: number;
  saldo: number;
  categorias: { categoria: string; total: number }[];
  suscripciones: Suscripcion[];
  sinClasificar: Transaction[];
  aire: number | null;
  proyeccion: number;
  ritmo: number | null;
}

export interface EconomiaVistaProps {
  /** Hasta la primera carga se pintan huecos. */
  cargado: boolean;
  /** Fallo de la última carga, ya escrito para el usuario. */
  errorCarga: string | null;
  refrescando: boolean;
  /** Reintentando la carga tras un fallo (el botón del ErrorSistema gira). */
  reintentando?: boolean;
  /** Hay movimientos en los últimos seis meses. */
  hayMovimientos: boolean;
  datos: EconomiaDatos;
  plan: MoneyPlan | null;
  presupuestos: Budget[];
  clasificando: boolean;
  /** «N movimientos clasificados…» tras clasificar a mano (null: nada). */
  aprendido: string | null;
  acciones: {
    /** Sin él, sin flecha de volver (pestaña de un mundo de Modos). */
    onVolver?: () => void;
    onRefrescar: () => void;
    onReintentar: () => void;
    onNuevo: () => void;
    onEditar: (m: Transaction) => void;
    onClasificarTodo: () => void;
    onOlvidarAprendido: () => void;
  };
}

/** Importe en Cinzel con la unidad en Outfit (Cinzel no tiene minúsculas). */
function Importe({ texto, unidad = ' €', tenue }: { texto: string; unidad?: string; tenue?: boolean }) {
  return (
    <Text style={[styles.importe, tenue && styles.importeTenue]} maxFontSizeMultiplier={1.2} numberOfLines={1}>
      {texto}
      <Text style={styles.unidad}>{unidad}</Text>
    </Text>
  );
}

/** «−12,50 €» partido en cifra y unidad. */
function ImporteSigno({ n }: { n: number }) {
  return <Importe texto={eurSigno(n).replace(/ €$/, '')} />;
}

/** Una meta del plan: nombre, «hecho / meta» en Cinzel, Barra estática y su nota. */
function FilaMeta({
  nombre,
  hecho,
  meta,
  nota,
  primera,
}: {
  nombre: string;
  hecho: number;
  meta: number;
  nota: string | null;
  primera?: boolean;
}) {
  return (
    <View style={[styles.meta, !primera && styles.conRegla]}>
      <View
        style={styles.metaCab}
        accessible
        accessibilityLabel={t('economia:vista.metaA11y', { nombre, hecho: eur(hecho), meta: eur(meta) })}
      >
        <Text style={styles.metaNombre} maxFontSizeMultiplier={1.35} numberOfLines={1}>
          {nombre}
        </Text>
        <Text style={styles.importe} maxFontSizeMultiplier={1.2}>
          {num(hecho)}
          <Text style={styles.unidad}> € / </Text>
          {num(meta)}
          <Text style={styles.unidad}> €</Text>
        </Text>
      </View>
      <Barra ratio={meta > 0 ? hecho / meta : 0} alto={4} etiqueta={nombre} enGrupo />
      {nota ? (
        <Text style={styles.notaFila} maxFontSizeMultiplier={1.35}>
          {nota}
        </Text>
      ) : null}
    </View>
  );
}

export function EconomiaVista({
  cargado,
  errorCarga,
  refrescando,
  reintentando,
  hayMovimientos,
  datos: vista,
  plan,
  presupuestos,
  clasificando,
  aprendido,
  acciones,
}: EconomiaVistaProps) {
  const tasa = tasaAhorro(vista.esteMes.ingresos, vista.esteMes.gastos);
  const maxCat = vista.categorias[0]?.total ?? 1;
  const tope = plan?.spend_cap ? Number(plan.spend_cap) : null;
  const objetivoIngresos = plan?.income_target ? Number(plan.income_target) : null;
  const colchon = plan?.runway_target_months ? Number(plan.runway_target_months) : null;
  const desbordado = vista.ritmo !== null && vista.ritmo > 1.1;
  const ritmoTexto =
    vista.ritmo === null
      ? null
      : vista.ritmo > 1.1
        ? t('economia:vista.ritmoDesbordado')
        : vista.ritmo < 0.9
          ? t('economia:vista.ritmoSobrado')
          : t('economia:vista.ritmoGuion');
  const bajoColchon = vista.aire !== null && colchon !== null && vista.aire < colchon;
  const anualSuscripciones = vista.suscripciones.reduce((a, s) => a + s.anual, 0);

  // Sin lo cargado no hay nada que enseñar: el fallo ocupa la pantalla.
  const falloEntero = cargado && !!errorCarga && !hayMovimientos;

  const subtitulo = !cargado || falloEntero
    ? undefined
    : !hayMovimientos
      ? t('economia:vista.subtituloVacio')
      : t('economia:vista.subtitulo', { dia: vista.dia, total: vista.totalDias, proyeccion: eur(vista.proyeccion) });

  const encabezado = (
    <EncabezadoArena
      onVolver={acciones.onVolver}
      eyebrow={t('economia:vista.eyebrow')}
      titulo={t('economia:vista.titulo')}
      subtitulo={subtitulo}
      meandro
      accion={
        cargado && !falloEntero
          ? { icono: 'add', etiqueta: t('economia:vista.nuevo'), onPress: acciones.onNuevo, solida: true }
          : undefined
      }
    />
  );

  if (!cargado) {
    return (
      <Screen>
        {encabezado}
        <CargaArena
          etiqueta={t('economia:vista.cargando')}
          formas={['franja', 'franja', 'rotulo', 'tarjeta', 'rotulo', 'filas']}
        />
      </Screen>
    );
  }

  if (falloEntero) {
    return (
      <Screen refreshing={refrescando} onRefresh={acciones.onRefrescar}>
        {encabezado}
        <ErrorSistema mensaje={errorCarga ?? ''} onReintentar={acciones.onReintentar} reintentando={reintentando} />
      </Screen>
    );
  }

  // De dos en dos: un importe de cinco cifras cabe a 375 sin cortarse (en la
  // web adjustsFontSizeToFit no encoge el texto).
  const franjas: Cifra[][] = [
    [
      { valor: num(vista.saldo), sufijo: ' €', rotulo: t('economia:vista.saldo'), etiqueta: t('economia:vista.saldoA11y', { importe: eur(vista.saldo) }) },
      {
        valor: num(vista.esteMes.gastos),
        sufijo: ' €',
        rotulo: t('economia:vista.gastado'),
        etiqueta: t(desbordado ? 'economia:vista.gastadoDesbordadoA11y' : 'economia:vista.gastadoA11y', {
          importe: eur(vista.esteMes.gastos),
        }),
      },
    ],
    [
      {
        valor: num(vista.esteMes.ingresos),
        sufijo: ' €',
        rotulo: t('economia:vista.entrado'),
        etiqueta: t('economia:vista.entradoA11y', { importe: eur(vista.esteMes.ingresos) }),
      },
      tasa === null
        ? { valor: SIN_DATO, rotulo: t('economia:vista.ahorro'), etiqueta: t('economia:vista.ahorroSinDatoA11y') }
        : { valor: tasa.toFixed(0), sufijo: ' %', rotulo: t('economia:vista.ahorro') },
    ],
    [
      {
        valor: num(vista.proyeccion),
        sufijo: ' €',
        rotulo: t('economia:vista.proyeccion'),
        etiqueta: t('economia:vista.proyeccionA11y', { importe: eur(vista.proyeccion) }),
      },
      vista.ritmo === null
        ? { valor: SIN_DATO, rotulo: t('economia:vista.ritmo'), etiqueta: t('economia:vista.ritmoSinDatoA11y') }
        : { valor: `×${num(vista.ritmo, 2)}`, rotulo: t('economia:vista.ritmo'), etiqueta: t('economia:vista.ritmoA11y', { ritmo: num(vista.ritmo, 2) }) },
    ],
  ];

  return (
    <Screen refreshing={refrescando} onRefresh={acciones.onRefrescar}>
      <Entrada indice={0}>{encabezado}</Entrada>

      {errorCarga ? (
        <Entrada indice={1}>
          <ErrorSistema
            compacto
            mensaje={errorCarga}
            onReintentar={acciones.onReintentar}
            reintentando={reintentando}
            style={styles.bloque}
          />
        </Entrada>
      ) : null}

      {aprendido ? (
        <Entrada indice={1}>
          <TarjetaArena
            variante="grano"
            rotulo={t('economia:vista.aprendeRotulo')}
            onPress={acciones.onOlvidarAprendido}
            accessibilityLabel={t('economia:vista.aprendeA11y', { texto: aprendido })}
            style={styles.bloque}
          >
            <Text style={styles.texto} maxFontSizeMultiplier={1.35}>
              {aprendido}
            </Text>
            <Text style={styles.ocultar} maxFontSizeMultiplier={1.35}>
              {t('economia:vista.ocultar')}
            </Text>
          </TarjetaArena>
        </Entrada>
      ) : null}

      {!hayMovimientos ? (
        <Entrada indice={1}>
          <TarjetaArena variante="contorno" style={styles.bloque}>
            <EmptyState
              compact
              icon="wallet-outline"
              title={t('economia:vista.vacioTitulo')}
              body={t('economia:vista.vacioCuerpo')}
              action={{ label: t('economia:vista.registrarMovimiento'), onPress: acciones.onNuevo }}
            />
          </TarjetaArena>
        </Entrada>
      ) : (
        <>
          <Entrada indice={1} style={styles.franjas}>
            {franjas.map((f, i) => (
              <View key={f[0]!.rotulo} style={i > 0 ? styles.franjaSegunda : undefined}>
                <FranjaCifras cifras={f} />
              </View>
            ))}
          </Entrada>

          {tope !== null || objetivoIngresos !== null ? (
            <Entrada indice={2}>
              <Section title={t('economia:vista.plan')} tone={desbordado ? 'alerta' : 'default'}>
                <View style={styles.lista}>
                  {tope !== null ? (
                    <FilaMeta
                      primera
                      nombre={t('economia:vista.tope')}
                      hecho={vista.esteMes.gastos}
                      meta={tope}
                      nota={ritmoTexto && vista.ritmo !== null ? t('economia:vista.ritmoNota', { ritmo: num(vista.ritmo, 2), estado: ritmoTexto }) : null}
                    />
                  ) : null}
                  {objetivoIngresos !== null ? (
                    <FilaMeta
                      primera={tope === null}
                      nombre={t('economia:vista.objetivoIngresos')}
                      hecho={vista.esteMes.ingresos}
                      meta={objetivoIngresos}
                      nota={
                        vista.esteMes.ingresos >= objetivoIngresos
                          ? t('economia:vista.objetivoCumplido')
                          : t('economia:vista.faltan', {
                              importe: eur(objetivoIngresos - vista.esteMes.ingresos),
                              dias: vista.totalDias - vista.dia,
                            })
                      }
                    />
                  ) : null}
                </View>
              </Section>
            </Entrada>
          ) : null}

          <Entrada indice={3}>
            <Section title={t('economia:vista.aire')} tone={bajoColchon ? 'alerta' : 'default'}>
              {vista.aire === null ? (
                <Text style={styles.texto} maxFontSizeMultiplier={1.35}>
                  {t('economia:vista.sinAire')}
                </Text>
              ) : (
                <View>
                  <View
                    style={styles.aire}
                    accessible
                    accessibilityLabel={t('economia:vista.aireA11y', { meses: num(vista.aire, 1) })}
                  >
                    <Text style={styles.aireCifra} maxFontSizeMultiplier={1.2}>
                      {num(vista.aire, 1)}
                      <Text style={styles.aireUnidad}> {t('economia:vista.aireUnidad')}</Text>
                    </Text>
                    <Text style={styles.rotulo} maxFontSizeMultiplier={1.35}>
                      {t('economia:vista.conGastoMedio')}
                    </Text>
                  </View>
                  <Text style={styles.nota} maxFontSizeMultiplier={1.35}>
                    {t('economia:vista.saldoEntre', { saldo: eur(vista.saldo), gasto: eur(vista.gastoMedio) })}
                  </Text>
                  {colchon !== null ? (
                    <View style={styles.colchon}>
                      <Barra
                        ratio={vista.aire / colchon}
                        alto={4}
                        tono={bajoColchon ? 'ink8' : 'blanco'}
                        etiqueta={t('economia:vista.colchonA11y', { meses: colchon })}
                      />
                      <Text style={styles.nota} maxFontSizeMultiplier={1.35}>
                        {t(bajoColchon ? 'economia:vista.porDebajo' : 'economia:vista.porEncima', { meses: colchon })}
                      </Text>
                    </View>
                  ) : null}
                </View>
              )}
            </Section>
          </Entrada>

          {vista.sinClasificar.length > 0 ? (
            <Entrada indice={4}>
              <Section title={t('economia:vista.sinClasificar')} meta={`${vista.sinClasificar.length}`}>
                <View style={styles.lista}>
                  {vista.sinClasificar.slice(0, 8).map((m, i) => (
                    <Row
                      key={m.id}
                      first={i === 0}
                      leading={<Ionicons name="help-circle-outline" size={18} color={ink.ink6} />}
                      title={m.description}
                      detail={fechaCorta(m.date)}
                      trailing={<ImporteSigno n={m.amount} />}
                      chevron
                      onPress={() => acciones.onEditar(m)}
                      accessibilityLabel={t(m.amount < 0 ? 'economia:vista.clasificarGastoA11y' : 'economia:vista.clasificarIngresoA11y', {
                        concepto: m.description,
                        importe: eur(Math.abs(m.amount), 2),
                        fecha: fechaCorta(m.date),
                      })}
                    />
                  ))}
                </View>
                <Button
                  title={t('economia:vista.clasificarTodo')}
                  variant="secondary"
                  icon="sparkles-outline"
                  onPress={acciones.onClasificarTodo}
                  loading={clasificando}
                  style={styles.boton}
                />
                <Text style={styles.nota} maxFontSizeMultiplier={1.35}>
                  {t('economia:vista.notaSinClasificar')}
                </Text>
              </Section>
            </Entrada>
          ) : null}

          <Entrada indice={5}>
            <Section title={t('economia:vista.enQueSeVa')} meta={vista.categorias.length > 0 ? `${vista.categorias.length}` : undefined}>
              {vista.categorias.length === 0 ? (
                <TarjetaArena variante="contorno">
                  <EmptyState compact icon="pie-chart-outline" title={t('economia:vista.sinGastos')} />
                </TarjetaArena>
              ) : (
                <View style={styles.lista}>
                  {vista.categorias.map((c, i) => {
                    const limite = presupuestos.find((b) => b.category === c.categoria);
                    const pasado = limite ? c.total > Number(limite.monthly_limit) : false;
                    const nombre = NOMBRE_CATEGORIA[c.categoria] ?? c.categoria;
                    return (
                      <View
                        key={c.categoria}
                        style={[styles.meta, i > 0 && styles.conRegla]}
                        accessible
                        accessibilityLabel={
                          limite
                            ? t(pasado ? 'economia:vista.categoriaPasadaA11y' : 'economia:vista.categoriaLimiteA11y', {
                                nombre,
                                importe: eur(c.total),
                                limite: eur(Number(limite.monthly_limit)),
                              })
                            : t('economia:vista.categoriaA11y', { nombre, importe: eur(c.total) })
                        }
                      >
                        <View style={styles.metaCab}>
                          <Text style={styles.metaNombre} numberOfLines={1} maxFontSizeMultiplier={1.35}>
                            {nombre}
                          </Text>
                          {pasado ? <Tag tone="alerta">{t('economia:vista.pasado')}</Tag> : null}
                          <Text style={styles.importe} maxFontSizeMultiplier={1.2}>
                            {num(c.total)}
                            <Text style={styles.unidad}> €</Text>
                            {limite ? (
                              <>
                                <Text style={styles.unidad}> / </Text>
                                {num(Number(limite.monthly_limit))}
                                <Text style={styles.unidad}> €</Text>
                              </>
                            ) : null}
                          </Text>
                        </View>
                        <Barra ratio={c.total / maxCat} alto={4} tono={pasado ? 'blanco' : 'ink8'} etiqueta={nombre} enGrupo />
                      </View>
                    );
                  })}
                </View>
              )}
            </Section>
          </Entrada>

          <Entrada indice={6}>
            <Section
              title={t('economia:vista.recurrentes')}
              meta={vista.suscripciones.length > 0 ? t('economia:vista.alAnio', { importe: eur(anualSuscripciones) }) : undefined}
            >
              {vista.suscripciones.length === 0 ? (
                <TarjetaArena variante="contorno">
                  <EmptyState
                    compact
                    icon="repeat-outline"
                    title={t('economia:vista.ningunoTitulo')}
                    body={t('economia:vista.ningunoCuerpo')}
                  />
                </TarjetaArena>
              ) : (
                <>
                  <View style={styles.lista}>
                    {vista.suscripciones.slice(0, 10).map((s, i) => (
                      <Row
                        key={s.cobrador}
                        first={i === 0}
                        leading={<Ionicons name="repeat-outline" size={18} color={ink.ink6} />}
                        title={s.cobrador}
                        detail={t('economia:vista.recurrenteDetalle', {
                          importe: eur(s.importeMedio, 2),
                          meses: s.meses,
                          fecha: fechaCorta(s.ultimo),
                        })}
                        trailing={<Importe texto={num(s.anual)} unidad={` ${t('economia:vista.unidadAnio')}`} />}
                        accessibilityLabel={t('economia:vista.recurrenteA11y', { cobrador: s.cobrador, importe: eur(s.anual) })}
                      />
                    ))}
                  </View>
                  <Text style={styles.nota} maxFontSizeMultiplier={1.35}>
                    {t('economia:vista.notaRecurrentes', { importe: eur(anualSuscripciones) })}
                  </Text>
                </>
              )}
            </Section>
          </Entrada>

          {vista.cerrados.length > 0 ? (
            <Entrada indice={7}>
              <Section title={t('economia:vista.cerrados')} meta={`${vista.cerrados.length}`}>
                <View style={styles.lista}>
                  {vista.cerrados.slice(-5).reverse().map((r, i) => (
                    <Row
                      key={r.mes}
                      first={i === 0}
                      title={mesLabel(r.mes)}
                      detail={t('economia:vista.cerradoDetalle', { ingresos: eur(r.ingresos), gastos: eur(r.gastos) })}
                      trailing={
                        r.ingresos > 0 ? (
                          <Importe texto={(((r.ingresos - r.gastos) / r.ingresos) * 100).toFixed(0)} unidad={` ${t('economia:vista.unidadAhorro')}`} tenue />
                        ) : undefined
                      }
                    />
                  ))}
                </View>
              </Section>
            </Entrada>
          ) : null}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  bloque: { marginBottom: space.s6 },
  franjas: {
    marginBottom: space.s6,
    paddingVertical: space.s3,
    borderTopWidth: stroke.hairline,
    borderBottomWidth: stroke.hairline,
    borderColor: ink.ink3,
  },
  franjaSegunda: {
    marginTop: space.s3,
    paddingTop: space.s3,
    borderTopWidth: stroke.hairline,
    borderTopColor: ink.ink3,
  },
  // Filas sobre hairlines, sin tarjeta.
  lista: { borderTopWidth: stroke.hairline, borderBottomWidth: stroke.hairline, borderColor: ink.ink3 },
  conRegla: { borderTopWidth: stroke.hairline, borderTopColor: ink.ink3 },
  meta: { paddingVertical: space.s3, gap: space.s2 },
  metaCab: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: space.s3 },
  metaNombre: {
    flex: 1,
    minWidth: 0,
    fontFamily: tipo.body.family,
    fontSize: tipo.body.size,
    lineHeight: tipo.body.lineHeight,
    color: ink.ink9,
  },
  importe: {
    fontFamily: tipo.number.family,
    fontSize: 16,
    lineHeight: 20,
    color: ink.ink10,
    fontVariant: ['tabular-nums'],
  },
  importeTenue: { color: ink.ink8 },
  // Cinzel no tiene minúsculas: la unidad va en Outfit.
  unidad: { fontFamily: tipo.micro.family, fontSize: tipo.micro.size, letterSpacing: tipo.micro.tracking, color: ink.ink6 },
  aire: { gap: space.s1 },
  aireCifra: {
    fontFamily: tipo.cifra.family,
    fontSize: tipo.cifra.size,
    lineHeight: tipo.cifra.lineHeight,
    color: ink.ink10,
  },
  aireUnidad: { fontFamily: tipo.micro.family, fontSize: 14, letterSpacing: tipo.micro.tracking, color: ink.ink6 },
  rotulo: {
    fontFamily: tipo.micro.family,
    fontSize: tipo.micro.size,
    lineHeight: tipo.micro.lineHeight,
    letterSpacing: tipo.micro.tracking,
    textTransform: 'uppercase',
    color: ink.ink6,
  },
  colchon: { marginTop: space.s4 },
  texto: {
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink8,
  },
  nota: {
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink6,
    marginTop: space.s3,
  },
  notaFila: {
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink8,
  },
  boton: { alignSelf: 'flex-start', marginTop: space.s4 },
  ocultar: {
    fontFamily: tipo.micro.family,
    fontSize: tipo.micro.size,
    lineHeight: tipo.micro.lineHeight,
    letterSpacing: tipo.micro.tracking,
    textTransform: 'uppercase',
    color: ink.ink6,
    marginTop: space.s2,
  },
});
