// NIVL · Mundo WORK: el control de la economía. Pura: todo llega por props
// desde useWorkEconomia (y desde demoWork en la galería /kit/work).
//
// Lenguaje visual: lámina 3 de la P01 (el teléfono de WORK). De arriba abajo:
//   0 · La cabecera del mundo (ranura: CabeceraMundo con el emblema).
//   1 · VISTA GENERAL (la tarjeta destacada, como «Prioridades de hoy»): el
//       total en grande, el mes en una línea, el saldo de cada cuenta con su
//       barra y LA acción grande «Añadir gasto» (+ Ingreso y Transferir).
//   2 · FIJOS DEL MES: el sueldo y los gastos fijos por día de cobro; los ya
//       apuntados, tachados con su marca (como la prioridad hecha).
//   3 · EN QUÉ SE VA: categorías del mes con su barra (como «Proyectos»).
//   4 · MOVIMIENTOS: los últimos, con fecha a la derecha (como «Hitos»).
//   5 · BRIEF DE FIN DE MES: la burbuja del sistema y el aviso de que no es
//       asesoramiento financiero.
//   6 · IMPORTAR EXTRACTO (CSV o PDF que se descarga del banco).
//   7 · COACH WORK, con su campo «Pregunta al coach WORK».
// Sin la 0075 aplicada: un estado vacío tranquilo, nunca un error rojo.

import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CargaArena, Entrada, ErrorSistema } from '@/components/arena';
import { Screen } from '@/components/ui';
import { ink, space, type as tipo } from '@/design/tokens';
import { t } from '@/i18n';
import { capital, fechaCorta, mayus, nombreMes } from '@/i18n/formato';
import { claveCategoria } from '@/lib/moneywork';
import type { BriefNumeros, CategoriaPropia, FijoDelMes, LineaCategoria, MovWork, TotalesMes, VistaGeneral } from '@/lib/moneywork';
import { ACENTO, BarraWork, BotonWork, Filete, TarjetaWork, tinte } from './PiezasWork';
import { euros, eurosSigno, iconoClave, iconoCuenta, nombreCategoriaMov, nombreClave } from './nombres';

export type EstadoBrief = 'listo' | 'sin_texto' | 'pidiendo' | 'sin_pro' | 'sin_datos';

export interface DatosWorkVista {
  vista: VistaGeneral;
  mes: TotalesMes;
  fijos: FijoDelMes[];
  categorias: LineaCategoria[];
  movimientos: MovWork[];
  nombresCuenta: Record<string, string>;
  propias: CategoriaPropia[];
  brief: { mes: string; numeros: BriefNumeros; texto: string | null; estado: EstadoBrief };
}

export interface AccionesWork {
  onRefrescar: () => void;
  onReintentar: () => void;
  onGasto: () => void;
  onIngreso: () => void;
  onTransferir: () => void;
  onNuevaCuenta: () => void;
  onCuenta: (id: string) => void;
  onNuevoFijo: (tipo: 'ingreso' | 'gasto') => void;
  onFijo: (id: string) => void;
  onMovimiento: (m: MovWork) => void;
  onBrief: () => void;
  onImportar: () => void;
  onCategorias: () => void;
  onCoach: () => void;
  onOlvidarAviso: () => void;
}

export interface WorkEconomiaVistaProps {
  cabecera: ReactNode;
  estado: 'cargando' | 'error' | 'no_disponible' | 'listo';
  error: string | null;
  refrescando: boolean;
  hoy: string;
  datos: DatosWorkVista | null;
  /** Nota del sistema tras una acción («3 fijos apuntados»). */
  aviso: string | null;
  acciones: AccionesWork;
}

const MAX_CATEGORIAS = 5;

function mesLargo(mes: string): string {
  return nombreMes(Number(mes.slice(5, 7)) - 1);
}

function Cifra({ valor, grande }: { valor: number; grande?: boolean }) {
  return (
    <Text style={grande ? styles.total : styles.cifraFila} maxFontSizeMultiplier={1} adjustsFontSizeToFit numberOfLines={1}>
      {euros(valor)}
    </Text>
  );
}

function VistaGeneralTarjeta({ d, acciones }: { d: DatosWorkVista; acciones: AccionesWork }) {
  const n = d.vista.cuentas.length;
  return (
    <TarjetaWork
      destacada
      rotulo={t('economia:work.general.rotulo')}
      meta={t('economia:work.general.cuentas', { count: n })}
      onMeta={acciones.onNuevaCuenta}
      metaA11y={t('economia:work.general.nuevaCuentaA11y')}
    >
      <View accessible accessibilityLabel={t('economia:work.general.totalA11y', { importe: euros(d.vista.total) })}>
        <Cifra valor={d.vista.total} grande />
        <Text style={styles.sub} maxFontSizeMultiplier={1.35}>
          {t('economia:work.general.mes', { entra: euros(d.mes.ingresos), sale: euros(d.mes.gastos) })}
        </Text>
      </View>
      <View style={styles.cuentas}>
        {d.vista.cuentas.map((c) => (
          <Pressable
            key={c.id}
            onPress={() => acciones.onCuenta(c.id)}
            accessibilityRole="button"
            accessibilityLabel={t('economia:work.general.cuentaA11y', { nombre: c.nombre, importe: euros(c.saldo) })}
            style={({ pressed }) => [styles.cuenta, pressed && styles.pulsado]}
          >
            <View style={styles.cuentaFila}>
              <Ionicons name={iconoCuenta(c.tipo)} size={15} color={ACENTO} />
              <Text style={styles.cuentaNombre} numberOfLines={1} maxFontSizeMultiplier={1.35}>
                {c.nombre}
              </Text>
              <Text style={[styles.cuentaSaldo, c.saldo < 0 && styles.negativo]} maxFontSizeMultiplier={1.2} numberOfLines={1}>
                {euros(c.saldo)}
              </Text>
            </View>
            <BarraWork ratio={c.cuota} alto={3} />
          </Pressable>
        ))}
      </View>
      <BotonWork titulo={t('economia:work.general.gasto')} onPress={acciones.onGasto} style={styles.botonGrande} />
      <View style={styles.enlaces}>
        <BotonWork titulo={t('economia:work.general.ingreso')} icono="add" variante="texto" onPress={acciones.onIngreso} />
        {n >= 2 ? (
          <BotonWork titulo={t('economia:work.general.transferir')} icono="swap-horizontal" variante="texto" onPress={acciones.onTransferir} />
        ) : null}
      </View>
    </TarjetaWork>
  );
}

function Fijos({ d, acciones }: { d: DatosWorkVista; acciones: AccionesWork }) {
  const hechos = d.fijos.filter((f) => f.hecho).length;
  return (
    <TarjetaWork
      rotulo={t('economia:work.fijos.rotulo')}
      meta={d.fijos.length ? t('economia:work.fijos.meta', { hechos, total: d.fijos.length }) : undefined}
    >
      {d.fijos.length === 0 ? (
        <Text style={styles.cuerpo} maxFontSizeMultiplier={1.6}>
          {t('economia:work.fijos.vacio')}
        </Text>
      ) : (
        d.fijos.map((f, i) => (
          <View key={f.fijo.id}>
            {i > 0 ? <Filete /> : null}
            <Pressable
              onPress={() => acciones.onFijo(f.fijo.id)}
              accessibilityRole="button"
              accessibilityLabel={t(f.hecho ? 'economia:work.fijos.hechoA11y' : 'economia:work.fijos.pendienteA11y', {
                nombre: f.fijo.name,
                importe: euros(f.fijo.amount),
                dia: f.fijo.day_of_month,
              })}
              style={({ pressed }) => [styles.filaFijo, pressed && styles.pulsado]}
            >
              <Text style={styles.dia} maxFontSizeMultiplier={1.2}>
                {Number(f.fecha.slice(8, 10))}
              </Text>
              <Text style={[styles.fijoNombre, f.hecho && styles.tachado]} numberOfLines={1} maxFontSizeMultiplier={1.35}>
                {f.fijo.name}
              </Text>
              <Text style={[styles.fijoImporte, f.hecho && styles.apagado]} maxFontSizeMultiplier={1.2}>
                {eurosSigno(f.fijo.kind === 'gasto' ? -f.fijo.amount : f.fijo.amount)}
              </Text>
              <View style={styles.marcaFijo} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                {f.hecho ? <Ionicons name="checkbox-outline" size={14} color={ACENTO} /> : null}
              </View>
            </Pressable>
          </View>
        ))
      )}
      <View style={styles.enlaces}>
        <BotonWork titulo={t('economia:work.fijos.nuevoIngreso')} icono="add" variante="texto" onPress={() => acciones.onNuevoFijo('ingreso')} />
        <BotonWork titulo={t('economia:work.fijos.nuevoGasto')} icono="add" variante="texto" onPress={() => acciones.onNuevoFijo('gasto')} />
      </View>
    </TarjetaWork>
  );
}

function EnQueSeVa({ d, hoy, acciones }: { d: DatosWorkVista; hoy: string; acciones: AccionesWork }) {
  const lineas = d.categorias.slice(0, MAX_CATEGORIAS);
  return (
    <TarjetaWork rotulo={t('economia:work.categorias.rotulo')} meta={mayus(mesLargo(hoy.slice(0, 7)))}>
      {lineas.length === 0 ? (
        <Text style={styles.cuerpo} maxFontSizeMultiplier={1.6}>
          {t('economia:work.categorias.vacio')}
        </Text>
      ) : (
        lineas.map((l) => (
          <View
            key={l.clave}
            style={styles.categoria}
            accessible
            accessibilityLabel={t('economia:work.categorias.a11y', {
              nombre: nombreClave(l.clave, d.propias),
              importe: euros(l.total),
              pct: Math.round(l.cuota * 100),
            })}
          >
            <View style={styles.categoriaFila}>
              <Ionicons name={iconoClave(l.clave)} size={14} color={ink.ink6} />
              <Text style={styles.categoriaNombre} numberOfLines={1} maxFontSizeMultiplier={1.35}>
                {nombreClave(l.clave, d.propias)}
              </Text>
              <Text style={styles.categoriaImporte} maxFontSizeMultiplier={1.2}>
                {euros(l.total)}
              </Text>
              <Text style={styles.pct} maxFontSizeMultiplier={1.2}>
                {Math.round(l.cuota * 100)}%
              </Text>
            </View>
            <BarraWork ratio={l.cuota} />
          </View>
        ))
      )}
      <BotonWork titulo={t('economia:work.categorias.gestionar')} icono="pricetags-outline" variante="texto" onPress={acciones.onCategorias} />
    </TarjetaWork>
  );
}

function Movimientos({ d, acciones }: { d: DatosWorkVista; acciones: AccionesWork }) {
  return (
    <TarjetaWork rotulo={t('economia:work.movimientos.rotulo')} meta={d.movimientos.length ? t('economia:work.movimientos.meta') : undefined}>
      {d.movimientos.length === 0 ? (
        <Text style={styles.cuerpo} maxFontSizeMultiplier={1.6}>
          {t('economia:work.movimientos.vacio')}
        </Text>
      ) : (
        d.movimientos.map((m) => (
          <Pressable
            key={m.id}
            onPress={() => acciones.onMovimiento(m)}
            accessibilityRole="button"
            accessibilityLabel={t('economia:work.movimientos.a11y', {
              concepto: m.description,
              importe: eurosSigno(m.amount),
              fecha: fechaCorta(m.date),
              cuenta: d.nombresCuenta[m.account_id ?? ''] ?? '',
            })}
            style={({ pressed }) => [styles.mov, pressed && styles.pulsado]}
          >
            <Ionicons
              name={m.is_internal ? 'swap-horizontal' : m.amount >= 0 ? 'arrow-down' : iconoClave(claveCategoria(m))}
              size={14}
              color={ACENTO}
            />
            <View style={styles.movTextos}>
              <Text style={styles.movConcepto} numberOfLines={1} maxFontSizeMultiplier={1.35}>
                {m.description}
              </Text>
              <Text style={styles.movDetalle} numberOfLines={1} maxFontSizeMultiplier={1.35}>
                {`${nombreCategoriaMov(m, d.propias)} · ${d.nombresCuenta[m.account_id ?? ''] ?? ''}`}
              </Text>
            </View>
            <View style={styles.movDerecha}>
              <Text style={[styles.movImporte, m.amount >= 0 && !m.is_internal && styles.positivo]} maxFontSizeMultiplier={1.2}>
                {eurosSigno(m.amount)}
              </Text>
              <Text style={styles.movFecha} maxFontSizeMultiplier={1.2}>
                {fechaCorta(m.date)}
              </Text>
            </View>
          </Pressable>
        ))
      )}
    </TarjetaWork>
  );
}

function Burbuja({ children }: { children: ReactNode }) {
  return (
    <View style={styles.burbujaFila}>
      <View style={styles.avatar} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Ionicons name="briefcase-outline" size={14} color={ACENTO} />
      </View>
      <View style={styles.burbuja}>{children}</View>
    </View>
  );
}

/** Las cifras del brief en tres líneas, sin IA (también lo que ve quien no tiene Pro). */
function lineasBrief(b: BriefNumeros, propias: readonly CategoriaPropia[]): string[] {
  const L: string[] = [t('economia:work.brief.entraSale', { entra: euros(b.este.ingresos), sale: euros(b.este.gastos) })];
  const top = b.categorias.slice(0, 2).map((c) => `${nombreClave(c.clave, propias)} ${euros(c.total)}`);
  if (top.length) L.push(t('economia:work.brief.top', { lista: top.join(', ') }));
  if (b.gastoDeltaPct !== null) {
    L.push(
      b.gastoDeltaPct >= 0
        ? t('economia:work.brief.sube', { pct: b.gastoDeltaPct, mes: mesLargo(b.anterior) })
        : t('economia:work.brief.baja', { pct: -b.gastoDeltaPct, mes: mesLargo(b.anterior) }),
    );
  }
  for (const a of b.alertas.slice(0, 2)) {
    if (a.tipo === 'gasta_mas_de_lo_que_entra') L.push(t('economia:work.brief.alertaGastaMas', { importe: euros(a.diferencia) }));
    if (a.tipo === 'categoria_sube') L.push(t('economia:work.brief.alertaSube', { nombre: nombreClave(a.clave, propias), pct: a.pct }));
    if (a.tipo === 'fijos_pesan') L.push(t('economia:work.brief.alertaFijos', { pct: a.pct }));
    if (a.tipo === 'cuenta_en_negativo') L.push(t('economia:work.brief.alertaNegativo', { cuenta: a.cuenta }));
    if (a.tipo === 'sin_clasificar') L.push(t('economia:work.brief.alertaSinClasificar', { count: a.movimientos }));
  }
  return L;
}

function Brief({ d, acciones }: { d: DatosWorkVista; acciones: AccionesWork }) {
  const b = d.brief;
  const titulo = t('economia:work.brief.rotulo', { mes: mayus(mesLargo(b.mes)) });
  if (b.estado === 'sin_datos') {
    return (
      <TarjetaWork rotulo={titulo}>
        <Text style={styles.cuerpo} maxFontSizeMultiplier={1.6}>
          {t('economia:work.brief.sinDatos', { mes: mesLargo(b.mes) })}
        </Text>
      </TarjetaWork>
    );
  }
  return (
    <TarjetaWork rotulo={titulo} meta={b.texto ? t('economia:work.brief.metaIa') : undefined}>
      <Burbuja>
        {b.texto ? (
          b.texto
            .replace(/\n*Esto no es asesoramiento financiero\.?\s*$/, '')
            .split(/\n+/)
            .filter((p) => p.trim())
            .map((p) => (
              <Text key={p} style={[styles.burbujaTexto, styles.parrafo]} maxFontSizeMultiplier={1.6}>
                {p}
              </Text>
            ))
        ) : (
          lineasBrief(b.numeros, d.propias).map((l) => (
            <Text key={l} style={styles.burbujaTexto} maxFontSizeMultiplier={1.6}>
              {l}
            </Text>
          ))
        )}
      </Burbuja>
      <Text style={styles.aviso} maxFontSizeMultiplier={1.35}>
        {t('economia:work.brief.aviso')}
      </Text>
      {b.texto ? null : b.estado === 'sin_pro' ? (
        <Text style={[styles.nota, styles.notaArriba]} maxFontSizeMultiplier={1.35}>
          {t('economia:work.brief.sinPro')}
        </Text>
      ) : (
        <BotonWork
          titulo={t('economia:work.brief.escribir')}
          icono="sparkles-outline"
          variante="contorno"
          cargando={b.estado === 'pidiendo'}
          onPress={acciones.onBrief}
          style={styles.botonArriba}
        />
      )}
    </TarjetaWork>
  );
}

function Importar({ acciones }: { acciones: AccionesWork }) {
  return (
    <TarjetaWork rotulo={t('economia:work.importar.rotulo')} meta={t('economia:work.importar.meta')}>
      <Text style={styles.cuerpo} maxFontSizeMultiplier={1.6}>
        {t('economia:work.importar.cuerpo')}
      </Text>
      <View style={styles.seguro}>
        <Ionicons name="lock-closed-outline" size={13} color={ACENTO} />
        <Text style={styles.nota} maxFontSizeMultiplier={1.35}>
          {t('economia:work.importar.nunca')}
        </Text>
      </View>
      <BotonWork titulo={t('economia:work.importar.elegir')} icono="document-text-outline" variante="contorno" onPress={acciones.onImportar} style={styles.botonArriba} />
    </TarjetaWork>
  );
}

function Coach({ acciones }: { acciones: AccionesWork }) {
  return (
    <TarjetaWork rotulo={t('economia:work.coach.rotulo')} meta={'• ' + t('economia:work.coach.enLinea')}>
      <Burbuja>
        <Text style={styles.burbujaTexto} maxFontSizeMultiplier={1.6}>
          {t('economia:work.coach.cuerpo')}
        </Text>
      </Burbuja>
      <Pressable
        onPress={acciones.onCoach}
        accessibilityRole="button"
        accessibilityLabel={t('economia:work.coach.preguntaA11y')}
        style={({ pressed }) => [styles.pregunta, pressed && styles.pulsado]}
      >
        <Text style={styles.preguntaTexto} numberOfLines={1} maxFontSizeMultiplier={1.35}>
          {t('economia:work.coach.pregunta')}
        </Text>
        <View style={styles.enviar}>
          <Ionicons name="arrow-forward" size={14} color={ink.ink0} />
        </View>
      </Pressable>
    </TarjetaWork>
  );
}

export function WorkEconomiaVista({ cabecera, estado, error, refrescando, hoy, datos: d, aviso, acciones }: WorkEconomiaVistaProps) {
  return (
    <Screen refreshing={refrescando} onRefresh={acciones.onRefrescar}>
      <Entrada indice={0}>{cabecera}</Entrada>

      {estado === 'cargando' ? (
        <Entrada indice={1}>
          <CargaArena etiqueta={t('economia:work.cargandoA11y')} formas={['tarjeta', 'filas']} />
        </Entrada>
      ) : estado === 'error' && !d ? (
        <Entrada indice={1}>
          <ErrorSistema mensaje={error ?? ''} onReintentar={acciones.onReintentar} />
        </Entrada>
      ) : estado === 'no_disponible' ? (
        <Entrada indice={1}>
          <TarjetaWork destacada rotulo={t('economia:work.general.rotulo')}>
            <Text style={styles.titular} maxFontSizeMultiplier={1.35}>
              {t('economia:work.preparando.titulo')}
            </Text>
            <Text style={styles.cuerpo} maxFontSizeMultiplier={1.6}>
              {t('economia:work.preparando.cuerpo')}
            </Text>
          </TarjetaWork>
        </Entrada>
      ) : d && d.vista.cuentas.length === 0 ? (
        <Entrada indice={1}>
          <TarjetaWork destacada rotulo={t('economia:work.general.rotulo')} meta={t('economia:work.primera.meta')}>
            <Text style={styles.titular} maxFontSizeMultiplier={1.35}>
              {t('economia:work.primera.titulo')}
            </Text>
            <Text style={styles.cuerpo} maxFontSizeMultiplier={1.6}>
              {t('economia:work.primera.cuerpo')}
            </Text>
            <BotonWork titulo={t('economia:work.primera.crear')} icono="add" onPress={acciones.onNuevaCuenta} style={styles.botonGrande} />
          </TarjetaWork>
        </Entrada>
      ) : d ? (
        <>
          {aviso ? (
            <Pressable onPress={acciones.onOlvidarAviso} accessibilityRole="button" accessibilityLabel={t('economia:work.avisoA11y', { texto: aviso })}>
              <View style={styles.avisoSistema}>
                <Ionicons name="checkmark-circle" size={15} color={ACENTO} />
                <Text style={styles.avisoTexto} maxFontSizeMultiplier={1.35}>
                  {aviso}
                </Text>
              </View>
            </Pressable>
          ) : null}
          {error ? <ErrorSistema compacto mensaje={error} onReintentar={acciones.onReintentar} /> : null}
          <Entrada indice={1}>
            <VistaGeneralTarjeta d={d} acciones={acciones} />
          </Entrada>
          <Entrada indice={2}>
            <Fijos d={d} acciones={acciones} />
          </Entrada>
          <Entrada indice={3}>
            <EnQueSeVa d={d} hoy={hoy} acciones={acciones} />
          </Entrada>
          <Entrada indice={4}>
            <Movimientos d={d} acciones={acciones} />
          </Entrada>
          <Entrada indice={5}>
            <Brief d={d} acciones={acciones} />
          </Entrada>
          <Entrada indice={6}>
            <Importar acciones={acciones} />
          </Entrada>
          <Entrada indice={7}>
            <Coach acciones={acciones} />
          </Entrada>
        </>
      ) : null}
      {estado !== 'listo' && estado !== 'cargando' ? (
        <Entrada indice={2}>
          <Coach acciones={acciones} />
        </Entrada>
      ) : null}
    </Screen>
  );
}

/** Capitaliza el nombre del mes para títulos fuera de rótulo. */
export function tituloMes(mes: string): string {
  return capital(mesLargo(mes));
}

const styles = StyleSheet.create({
  total: {
    fontFamily: tipo.rank.family,
    fontSize: 34,
    lineHeight: 40,
    letterSpacing: 0.5,
    color: ink.ink10,
  },
  sub: {
    fontFamily: tipo.bodySm.family,
    fontSize: 13,
    lineHeight: 18,
    color: ink.ink8,
    marginTop: 2,
  },
  cuentas: { marginTop: space.s3, gap: 10 },
  cuenta: { gap: 6 },
  cuentaFila: { flexDirection: 'row', alignItems: 'center', gap: space.s2 },
  cuentaNombre: { flex: 1, minWidth: 0, fontFamily: tipo.micro.family, fontSize: 14, lineHeight: 18, color: ink.ink9 },
  cuentaSaldo: { fontFamily: tipo.label.family, fontSize: 14, lineHeight: 18, color: ink.ink10 },
  negativo: { color: ink.ink8, textDecorationLine: 'underline' },
  cifraFila: { fontFamily: tipo.number.family, fontSize: 18, color: ink.ink10 },
  botonGrande: { marginTop: space.s4 },
  dosBotones: { flexDirection: 'row', gap: space.s3, marginTop: space.s2 },
  enlaces: { flexDirection: 'row', gap: space.s5, marginTop: space.s1, marginBottom: -space.s2 },
  mitad: { flex: 1 },
  botonArriba: { marginTop: space.s3 },
  filaFijo: { flexDirection: 'row', alignItems: 'center', gap: space.s3, minHeight: 40 },
  dia: {
    width: 22,
    fontFamily: tipo.rank.family,
    fontSize: 15,
    color: ACENTO,
    textAlign: 'left',
  },
  fijoNombre: { flex: 1, minWidth: 0, fontFamily: tipo.micro.family, fontSize: 13.5, color: ink.ink9 },
  fijoImporte: { fontFamily: tipo.label.family, fontSize: 13, color: ink.ink9 },
  tachado: { color: ink.ink6, textDecorationLine: 'line-through' },
  apagado: { color: ink.ink6 },
  categoria: { gap: 7, marginBottom: space.s3 },
  categoriaFila: { flexDirection: 'row', alignItems: 'center', gap: space.s2 },
  categoriaNombre: { flex: 1, minWidth: 0, fontFamily: tipo.micro.family, fontSize: 13.5, color: ink.ink9 },
  categoriaImporte: { fontFamily: tipo.label.family, fontSize: 13, color: ink.ink9 },
  pct: { width: 38, textAlign: 'right', fontFamily: tipo.bodySm.family, fontSize: 12, color: ink.ink6 },
  mov: { flexDirection: 'row', alignItems: 'center', gap: space.s3, minHeight: 44, paddingVertical: 4 },
  movTextos: { flex: 1, minWidth: 0 },
  movConcepto: { fontFamily: tipo.micro.family, fontSize: 13.5, lineHeight: 18, color: ink.ink9 },
  movDetalle: { fontFamily: tipo.micro.family, fontSize: 11, lineHeight: 14, color: ink.ink6, marginTop: 1 },
  movDerecha: { alignItems: 'flex-end' },
  movImporte: { fontFamily: tipo.label.family, fontSize: 13, lineHeight: 18, color: ink.ink9 },
  positivo: { color: ACENTO },
  movFecha: { fontFamily: tipo.micro.family, fontSize: 11, lineHeight: 14, color: ink.ink6 },
  burbujaFila: { flexDirection: 'row', gap: space.s3, alignItems: 'flex-start' },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: ACENTO,
    alignItems: 'center',
    justifyContent: 'center',
  },
  burbuja: {
    flex: 1,
    backgroundColor: ink.ink2,
    borderRadius: 10,
    paddingHorizontal: space.s3,
    paddingVertical: space.s3,
    gap: space.s1,
  },
  burbujaTexto: { fontFamily: tipo.bodySm.family, fontSize: 14, lineHeight: 20, color: ink.ink9 },
  parrafo: { marginBottom: space.s2 },
  marcaFijo: { width: 16, alignItems: 'flex-end' },
  aviso: {
    alignSelf: 'flex-start',
    fontFamily: tipo.micro.family,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.5,
    color: ink.ink6,
    marginTop: space.s3,
    marginLeft: 42,
  },
  nota: { flex: 1, fontFamily: tipo.bodySm.family, fontSize: 12, lineHeight: 16, color: ink.ink8 },
  notaArriba: { marginTop: space.s2, marginLeft: 42 },
  seguro: { flexDirection: 'row', alignItems: 'center', gap: space.s2, marginTop: space.s3 },
  cuerpo: { fontFamily: tipo.bodySm.family, fontSize: 14, lineHeight: 20, color: ink.ink8 },
  titular: { fontFamily: tipo.headline.family, fontSize: 18, lineHeight: 24, color: ink.ink10, marginBottom: space.s2 },
  pregunta: {
    marginTop: space.s3,
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: ink.ink3,
    backgroundColor: ink.ink0,
    borderRadius: 10,
    paddingLeft: space.s3,
    paddingRight: 6,
  },
  preguntaTexto: { flex: 1, fontFamily: tipo.bodySm.family, fontSize: 13, color: ink.ink6 },
  enviar: { width: 30, height: 30, borderRadius: 7, backgroundColor: ACENTO, alignItems: 'center', justifyContent: 'center' },
  avisoSistema: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: tinte(0.35),
    paddingHorizontal: space.s3,
    paddingVertical: space.s2,
    marginBottom: space.s3,
  },
  avisoTexto: { flex: 1, fontFamily: tipo.bodySm.family, fontSize: 13, lineHeight: 18, color: ink.ink9 },
  pulsado: { opacity: 0.75 },
});
