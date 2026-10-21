// NIVL · WORK: la PANTALLA DE REVISIÓN de un extracto importado. Nada se
// guarda hasta que la persona pulsa «Guardar»: aquí ve cada movimiento con su
// categoría propuesta, quita los que no quiera y cambia la categoría de un
// toque. Los repetidos (misma huella ya guardada) salen apagados y no se
// pueden marcar: guardarlos no haría nada. Los parecidos (uno apuntado a mano
// con el mismo importe a 3 días o menos) salen sin marcar.
// Pura: todo llega por props desde useWorkEconomia.

import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ErrorSistema } from '@/components/arena';
import { Screen } from '@/components/ui';
import { ink, space, type as tipo } from '@/design/tokens';
import { t } from '@/i18n';
import { fechaCorta } from '@/i18n/formato';
import type { FilaPropuesta } from '@/lib/moneyextracto';
import type { CategoriaPropia } from '@/lib/moneywork';
import { ACENTO, BotonWork, Filete, TarjetaWork, tinte } from './PiezasWork';
import { eurosSigno, nombreCategoriaMov } from './nombres';

export interface FilaRevision extends FilaPropuesta {
  marcada: boolean;
  /** Categoría propia elegida en la revisión. */
  propia: string | null;
}

export interface RevisionExtractoVistaProps {
  archivo: string;
  cuenta: string;
  filas: FilaRevision[];
  descartadas: number;
  guardando: boolean;
  error: string | null;
  propias: CategoriaPropia[];
  onAlternar: (i: number) => void;
  onCategoria: (i: number) => void;
  onTodas: (marcar: boolean) => void;
  onGuardar: () => void;
  onCancelar: () => void;
}

export function RevisionExtractoVista(p: RevisionExtractoVistaProps) {
  const marcadas = p.filas.filter((f) => f.marcada).length;
  const nuevas = p.filas.filter((f) => f.estado === 'nuevo').length;
  const repetidas = p.filas.filter((f) => f.estado === 'repetido').length;
  const parecidas = p.filas.filter((f) => f.estado === 'parecido').length;
  const total = p.filas.filter((f) => f.marcada).reduce((a, f) => a + Math.round(f.importe * 100), 0) / 100;

  return (
    <Screen
      overlay={
        <View style={styles.pie}>
          <BotonWork titulo={t('comun:cancelar')} variante="texto" onPress={p.onCancelar} />
          <BotonWork
            titulo={t('economia:work.revision.guardar', { count: marcadas })}
            icono="checkmark"
            onPress={p.onGuardar}
            disabled={marcadas === 0}
            cargando={p.guardando}
            style={styles.guardar}
          />
        </View>
      }
    >
      <View style={styles.cabecera}>
        <Text style={styles.eyebrow} maxFontSizeMultiplier={1.35}>
          {t('economia:work.revision.eyebrow')}
        </Text>
        <Text style={styles.titulo} accessibilityRole="header" maxFontSizeMultiplier={1.35}>
          {t('economia:work.revision.titulo')}
        </Text>
        <Text style={styles.sub} numberOfLines={2} maxFontSizeMultiplier={1.35}>
          {t('economia:work.revision.sub', { archivo: p.archivo, cuenta: p.cuenta })}
        </Text>
      </View>

      <TarjetaWork destacada rotulo={t('economia:work.revision.resumen')} meta={t('economia:work.revision.marcadas', { count: marcadas })}>
        <View style={styles.cifras}>
          <Cifra valor={nuevas} etiqueta={t('economia:work.revision.nuevos')} acento />
          <Cifra valor={repetidas} etiqueta={t('economia:work.revision.repetidos')} />
          <Cifra valor={parecidas} etiqueta={t('economia:work.revision.parecidos')} />
        </View>
        <Text style={styles.nota} maxFontSizeMultiplier={1.35}>
          {t('economia:work.revision.neto', { importe: eurosSigno(total) })}
          {p.descartadas ? ` ${t('economia:work.revision.descartadas', { count: p.descartadas })}` : ''}
        </Text>
      </TarjetaWork>

      {p.error ? <ErrorSistema compacto mensaje={p.error} /> : null}

      <TarjetaWork
        rotulo={t('economia:work.revision.movimientos')}
        meta={marcadas === nuevas + parecidas ? t('economia:work.revision.ninguno') : t('economia:work.revision.todos')}
        onMeta={() => p.onTodas(marcadas !== nuevas + parecidas)}
      >
        {p.filas.map((f, i) => {
          const repetido = f.estado === 'repetido';
          return (
            <View key={`${f.huella}|${i}`}>
              {i > 0 ? <Filete /> : null}
              <View style={styles.fila}>
                <Pressable
                  onPress={() => p.onAlternar(i)}
                  disabled={repetido}
                  hitSlop={8}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: f.marcada, disabled: repetido }}
                  accessibilityLabel={t('economia:work.revision.filaA11y', {
                    concepto: f.concepto,
                    importe: eurosSigno(f.importe),
                    fecha: fechaCorta(f.fecha),
                  })}
                  style={styles.marca}
                >
                  <Ionicons
                    name={repetido ? 'remove-circle-outline' : f.marcada ? 'checkbox-outline' : 'square-outline'}
                    size={16}
                    color={repetido ? ink.ink4 : f.marcada ? ACENTO : ink.ink6}
                  />
                </Pressable>
                <View style={styles.textos}>
                  <Text style={[styles.concepto, repetido && styles.apagado]} numberOfLines={1} maxFontSizeMultiplier={1.35}>
                    {f.concepto}
                  </Text>
                  <View style={styles.detalle}>
                    <Text style={styles.fecha} maxFontSizeMultiplier={1.2}>
                      {fechaCorta(f.fecha)}
                    </Text>
                    {repetido ? (
                      <Text style={styles.etiqueta} maxFontSizeMultiplier={1.2}>
                        {t('economia:work.revision.yaEsta')}
                      </Text>
                    ) : (
                      <Pressable
                        onPress={() => p.onCategoria(i)}
                        hitSlop={10}
                        accessibilityRole="button"
                        accessibilityLabel={t('economia:work.revision.cambiarA11y', {
                          categoria: nombreCategoriaMov({ category: f.categoria, user_category_id: f.propia, is_internal: f.interno }, p.propias),
                        })}
                        style={styles.chip}
                      >
                        <Text style={styles.chipTexto} maxFontSizeMultiplier={1.2} numberOfLines={1}>
                          {nombreCategoriaMov({ category: f.categoria, user_category_id: f.propia, is_internal: f.interno }, p.propias)}
                        </Text>
                        <Ionicons name="chevron-down" size={11} color={ink.ink8} />
                      </Pressable>
                    )}
                  </View>
                  {f.estado === 'parecido' ? (
                    <Text style={styles.etiqueta} maxFontSizeMultiplier={1.2}>
                      {t('economia:work.revision.parecido')}
                    </Text>
                  ) : null}
                </View>
                <Text style={[styles.importe, f.importe >= 0 && styles.positivo, repetido && styles.apagado]} maxFontSizeMultiplier={1.2}>
                  {eurosSigno(f.importe)}
                </Text>
              </View>
            </View>
          );
        })}
      </TarjetaWork>
      <View style={styles.hueco} />
    </Screen>
  );
}

function Cifra({ valor, etiqueta, acento }: { valor: number; etiqueta: string; acento?: boolean }) {
  const a11y = `${etiqueta}: ${valor}`; // i18n-ok: rótulo ya traducido y una cifra
  return (
    <View style={styles.cifra} accessible accessibilityLabel={a11y}>
      <Text style={[styles.cifraValor, acento && { color: ACENTO }]} maxFontSizeMultiplier={1}>
        {valor}
      </Text>
      <Text style={styles.cifraEtiqueta} maxFontSizeMultiplier={1.2}>
        {etiqueta}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  cabecera: { paddingTop: space.s2, paddingBottom: space.s4, gap: space.s1 },
  eyebrow: { fontFamily: tipo.label.family, fontSize: 11, letterSpacing: 1.6, color: ACENTO, textTransform: 'uppercase' },
  titulo: { fontFamily: tipo.rank.family, fontSize: 24, lineHeight: 30, letterSpacing: 2, color: ink.ink10 },
  sub: { fontFamily: tipo.bodySm.family, fontSize: 13, lineHeight: 18, color: ink.ink8 },
  cifras: { flexDirection: 'row', gap: space.s3 },
  cifra: { flex: 1 },
  cifraValor: { fontFamily: tipo.number.family, fontSize: 26, lineHeight: 30, color: ink.ink10 },
  cifraEtiqueta: { fontFamily: tipo.micro.family, fontSize: 11, letterSpacing: 1, color: ink.ink6, textTransform: 'uppercase' },
  nota: { fontFamily: tipo.bodySm.family, fontSize: 12, lineHeight: 16, color: ink.ink8, marginTop: space.s3 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: space.s3, minHeight: 50, paddingVertical: 4 },
  marca: { width: 28, height: 44, alignItems: 'center', justifyContent: 'center' },
  textos: { flex: 1, minWidth: 0, gap: 4 },
  concepto: { fontFamily: tipo.bodySm.family, fontSize: 13, lineHeight: 18, color: ink.ink9 },
  detalle: { flexDirection: 'row', alignItems: 'center', gap: space.s2, flexWrap: 'wrap' },
  fecha: { fontFamily: tipo.micro.family, fontSize: 11, color: ink.ink6 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: tinte(0.4),
    backgroundColor: tinte(0.08),
    maxWidth: 160,
  },
  chipTexto: { fontFamily: tipo.micro.family, fontSize: 11, color: ink.ink9 },
  etiqueta: { fontFamily: tipo.micro.family, fontSize: 11, color: ink.ink6, textTransform: 'uppercase', letterSpacing: 1 },
  importe: { fontFamily: tipo.label.family, fontSize: 13, color: ink.ink9 },
  positivo: { color: ACENTO },
  apagado: { color: ink.ink6 },
  pie: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: space.s5,
    paddingTop: space.s3,
    paddingBottom: space.s5,
    backgroundColor: ink.ink0,
    borderTopWidth: 1,
    borderTopColor: ink.ink3,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s4,
  },
  guardar: { flex: 1 },
  hueco: { height: 90 },
});
