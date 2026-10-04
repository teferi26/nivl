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
import { NOMBRE_CATEGORIA, type Budget, type MoneyPlan, type Transaction } from '@/lib/money';
import { tasaAhorro, type ResumenMes, type Suscripcion } from '@/lib/moneymath';
import { fechaCorta } from '@/components/fecha';
import { eur, eurSigno, num } from './formato';


const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'];

/** 'AAAA-MM' → «sept 2026». */
function mesLabel(mes: string): string {
  const [a, m] = mes.split('-');
  const i = Number(m) - 1;
  return MESES[i] ? `${MESES[i]} ${a}` : mes;
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
    onVolver: () => void;
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
        accessibilityLabel={`${nombre}: ${eur(hecho)} de ${eur(meta)}`}
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
    vista.ritmo === null ? null : vista.ritmo > 1.1 ? 'vas desbordado' : vista.ritmo < 0.9 ? 'vas sobrado' : 'en el guion';
  const bajoColchon = vista.aire !== null && colchon !== null && vista.aire < colchon;
  const anualSuscripciones = vista.suscripciones.reduce((a, s) => a + s.anual, 0);

  // Sin lo cargado no hay nada que enseñar: el fallo ocupa la pantalla.
  const falloEntero = cargado && !!errorCarga && !hayMovimientos;

  const subtitulo = !cargado || falloEntero
    ? undefined
    : !hayMovimientos
      ? 'El sistema no ve tu dinero todavía.'
      : `Día ${vista.dia} de ${vista.totalDias}. Al ritmo actual cierras el mes en ${eur(vista.proyeccion)} de gasto.`;

  const encabezado = (
    <EncabezadoArena
      onVolver={acciones.onVolver}
      eyebrow="Dinero"
      titulo="Economía"
      subtitulo={subtitulo}
      meandro
      accion={
        cargado && !falloEntero
          ? { icono: 'add', etiqueta: 'Registrar movimiento en efectivo', onPress: acciones.onNuevo, solida: true }
          : undefined
      }
    />
  );

  if (!cargado) {
    return (
      <Screen>
        {encabezado}
        <CargaArena
          etiqueta="Leyendo tus cuentas. El sistema suma los últimos seis meses."
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
      { valor: num(vista.saldo), sufijo: ' €', rotulo: 'Saldo', etiqueta: `Saldo: ${eur(vista.saldo)}` },
      {
        valor: num(vista.esteMes.gastos),
        sufijo: ' €',
        rotulo: 'Gastado',
        etiqueta: `Gastado este mes: ${eur(vista.esteMes.gastos)}${desbordado ? ', vas desbordado' : ''}`,
      },
    ],
    [
      { valor: num(vista.esteMes.ingresos), sufijo: ' €', rotulo: 'Entrado', etiqueta: `Entrado este mes: ${eur(vista.esteMes.ingresos)}` },
      tasa === null
        ? { valor: SIN_DATO, rotulo: 'Ahorro', etiqueta: 'Ahorro: sin dato' }
        : { valor: tasa.toFixed(0), sufijo: ' %', rotulo: 'Ahorro' },
    ],
    [
      { valor: num(vista.proyeccion), sufijo: ' €', rotulo: 'Proyección', etiqueta: `Proyección del mes: ${eur(vista.proyeccion)}` },
      vista.ritmo === null
        ? { valor: SIN_DATO, rotulo: 'Ritmo', etiqueta: 'Ritmo: sin dato' }
        : { valor: `×${num(vista.ritmo, 2)}`, rotulo: 'Ritmo', etiqueta: `Ritmo: por ${num(vista.ritmo, 2)}` },
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
            rotulo="El sistema aprende"
            onPress={acciones.onOlvidarAprendido}
            accessibilityLabel={`El sistema aprende. ${aprendido} Toca para ocultarlo.`}
            style={styles.bloque}
          >
            <Text style={styles.texto} maxFontSizeMultiplier={1.35}>
              {aprendido}
            </Text>
            <Text style={styles.ocultar} maxFontSizeMultiplier={1.35}>
              Toca para ocultar
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
              title="El sistema no ve tu dinero"
              body="Registra lo que pagas en efectivo con el botón de arriba."
              action={{ label: 'Registrar movimiento', onPress: acciones.onNuevo }}
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
              <Section title="Plan del mes" tone={desbordado ? 'alerta' : 'default'}>
                <View style={styles.lista}>
                  {tope !== null ? (
                    <FilaMeta
                      primera
                      nombre="Tope de gasto"
                      hecho={vista.esteMes.gastos}
                      meta={tope}
                      nota={ritmoTexto && vista.ritmo !== null ? `Ritmo ×${num(vista.ritmo, 2)}: ${ritmoTexto}.` : null}
                    />
                  ) : null}
                  {objetivoIngresos !== null ? (
                    <FilaMeta
                      primera={tope === null}
                      nombre="Objetivo de ingresos"
                      hecho={vista.esteMes.ingresos}
                      meta={objetivoIngresos}
                      nota={
                        vista.esteMes.ingresos >= objetivoIngresos
                          ? 'Objetivo cumplido.'
                          : `Faltan ${eur(objetivoIngresos - vista.esteMes.ingresos)} en ${vista.totalDias - vista.dia} días.`
                      }
                    />
                  ) : null}
                </View>
              </Section>
            </Entrada>
          ) : null}

          <Entrada indice={3}>
            <Section title="Meses de aire" tone={bajoColchon ? 'alerta' : 'default'}>
              {vista.aire === null ? (
                <Text style={styles.texto} maxFontSizeMultiplier={1.35}>
                  Sin saldo o sin gasto medio: no hay cuenta atrás que dar.
                </Text>
              ) : (
                <View>
                  <View
                    style={styles.aire}
                    accessible
                    accessibilityLabel={`${num(vista.aire, 1)} meses de aire con el gasto medio actual`}
                  >
                    <Text style={styles.aireCifra} maxFontSizeMultiplier={1.2}>
                      {num(vista.aire, 1)}
                      <Text style={styles.aireUnidad}> meses</Text>
                    </Text>
                    <Text style={styles.rotulo} maxFontSizeMultiplier={1.35}>
                      Con el gasto medio actual
                    </Text>
                  </View>
                  <Text style={styles.nota} maxFontSizeMultiplier={1.35}>
                    {eur(vista.saldo)} de saldo entre {eur(vista.gastoMedio)} de gasto medio al mes.
                  </Text>
                  {colchon !== null ? (
                    <View style={styles.colchon}>
                      <Barra
                        ratio={vista.aire / colchon}
                        alto={4}
                        tono={bajoColchon ? 'ink8' : 'blanco'}
                        etiqueta={`Colchón pactado de ${colchon} meses`}
                      />
                      <Text style={styles.nota} maxFontSizeMultiplier={1.35}>
                        {bajoColchon ? 'Por debajo' : 'Por encima'} del colchón pactado de {colchon} meses.
                      </Text>
                    </View>
                  ) : null}
                </View>
              )}
            </Section>
          </Entrada>

          {vista.sinClasificar.length > 0 ? (
            <Entrada indice={4}>
              <Section title="Sin clasificar" meta={`${vista.sinClasificar.length}`}>
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
                      accessibilityLabel={`Clasificar ${m.description}, ${m.amount < 0 ? 'gasto' : 'ingreso'} de ${eur(Math.abs(m.amount), 2)}, el ${fechaCorta(m.date)}`}
                    />
                  ))}
                </View>
                <Button
                  title="Que los clasifique el sistema"
                  variant="secondary"
                  icon="sparkles-outline"
                  onPress={acciones.onClasificarTodo}
                  loading={clasificando}
                  style={styles.boton}
                />
                <Text style={styles.nota} maxFontSizeMultiplier={1.35}>
                  Este dinero no aparece en ningún presupuesto. Toca uno para decirle qué era: el sistema
                  aprende la regla y no vuelve a preguntártelo.
                </Text>
              </Section>
            </Entrada>
          ) : null}

          <Entrada indice={5}>
            <Section title="En qué se va" meta={vista.categorias.length > 0 ? `${vista.categorias.length}` : undefined}>
              {vista.categorias.length === 0 ? (
                <TarjetaArena variante="contorno">
                  <EmptyState compact icon="pie-chart-outline" title="Sin gastos este mes" />
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
                        accessibilityLabel={`${nombre}: ${eur(c.total)}${limite ? ` de un límite de ${eur(Number(limite.monthly_limit))}` : ''}${pasado ? ', por encima del límite' : ''}`}
                      >
                        <View style={styles.metaCab}>
                          <Text style={styles.metaNombre} numberOfLines={1} maxFontSizeMultiplier={1.35}>
                            {nombre}
                          </Text>
                          {pasado ? <Tag tone="alerta">Pasado</Tag> : null}
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
              title="Cargos recurrentes"
              meta={vista.suscripciones.length > 0 ? `${eur(anualSuscripciones)} al año` : undefined}
            >
              {vista.suscripciones.length === 0 ? (
                <TarjetaArena variante="contorno">
                  <EmptyState
                    compact
                    icon="repeat-outline"
                    title="Ninguno detectado"
                    body="Hacen falta tres meses de histórico para verlos."
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
                        detail={`${eur(s.importeMedio, 2)} al mes · ${s.meses} meses · último ${fechaCorta(s.ultimo)}`}
                        trailing={<Importe texto={num(s.anual)} unidad=" €/año" />}
                        accessibilityLabel={`${s.cobrador}: ${eur(s.anual)} al año`}
                      />
                    ))}
                  </View>
                  <Text style={styles.nota} maxFontSizeMultiplier={1.35}>
                    Son {eur(anualSuscripciones)} al año que se cobran solos. Cancelar lo que no usas es el
                    único ahorro que no exige disciplina.
                  </Text>
                </>
              )}
            </Section>
          </Entrada>

          {vista.cerrados.length > 0 ? (
            <Entrada indice={7}>
              <Section title="Meses cerrados" meta={`${vista.cerrados.length}`}>
                <View style={styles.lista}>
                  {vista.cerrados.slice(-5).reverse().map((r, i) => (
                    <Row
                      key={r.mes}
                      first={i === 0}
                      title={mesLabel(r.mes)}
                      detail={`Entró ${eur(r.ingresos)} · gastó ${eur(r.gastos)}`}
                      trailing={
                        r.ingresos > 0 ? (
                          <Importe texto={(((r.ingresos - r.gastos) / r.ingresos) * 100).toFixed(0)} unidad=" % ahorro" tenue />
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
