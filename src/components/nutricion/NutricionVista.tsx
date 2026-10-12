// NIVL · Nutrición: la vista (L-RADICAL §C, FASE3 Oleada 2, lote E2). Pura:
// todo llega por props desde useNutricion (o desde la galería con datos de
// mentira) y no carga nada.
//
// De arriba abajo: el encabezado grabado («Cuerpo» / «NUTRICIÓN», con el
// objetivo en la línea de contexto y el meandro), la franja de cifras del día
// (kcal y proteína del objetivo, y el parte «n/2»), el objetivo (carbos y
// grasa en filas con la cifra en Cinzel, y el porqué del coach) o su vacío,
// el parte de hoy (dos filas con Check sobre hairlines, el Campo de notas y
// el botón), la adherencia de 28 días (filas con su porcentaje en Cinzel y
// una Barra estática) y el descargo de salud.
//
// INVERSIÓN única: «Registrar el día». Si la carga falla, ErrorSistema ocupa
// el parte y no hay botón: un día que no se ha leído no se registra encima.
// El texto nunca promete resultados de salud: se mide la adherencia.

import { StyleSheet, Text, View } from 'react-native';
import { DescargoSalud } from '@/components/DescargoSalud';
import {
  Barra,
  Campo,
  CargaArena,
  EncabezadoArena,
  Entrada,
  ErrorSistema,
  FranjaCifras,
  TarjetaArena,
  formatoMiles,
  type Cifra,
} from '@/components/arena';
import { Button, Check, EmptyState, Row, Screen, Section, SIN_DATO, Tag } from '@/components/ui';
import { ink, space, stroke, type as tipo } from '@/design/tokens';
import { t } from '@/i18n';
import type { NutritionLog, NutritionTarget } from '@/lib/bodywork';

export interface NutricionVistaProps {
  /** Hasta la primera carga se pintan huecos. */
  cargado: boolean;
  /** Fallo de la última carga, ya escrito para el usuario: sin parte ni botón. */
  errorCarga: string | null;
  objetivo: NutritionTarget | null;
  /** El parte guardado de hoy (en la zona del perfil), si lo hay. */
  hoyLog: NutritionLog | null;
  /** Partes de los últimos 28 días. */
  historial: NutritionLog[];
  kcal: boolean;
  prote: boolean;
  notas: string;
  guardando: boolean;
  /** Lo que paga cumplir las dos cosas (NUTRITION_DAY_XP). */
  xpDia: number;
  acciones: {
    onVolver: () => void;
    onKcal: () => void;
    onProte: () => void;
    onNotas: (v: string) => void;
    onGuardar: () => void;
    onCoach: () => void;
    onReintentar: () => void;
  };
}

/** A partir de aquí la adherencia se da por buena. */
const ADHERENCIA_BUENA = 80;

export function NutricionVista({
  cargado,
  errorCarga,
  objetivo,
  hoyLog,
  historial,
  kcal,
  prote,
  notas,
  guardando,
  xpDia,
  acciones,
}: NutricionVistaProps) {
  const dias = historial.length;
  const pctKcal = dias ? Math.round((historial.filter((l) => l.hit_kcal).length / dias) * 100) : 0;
  const pctProte = dias ? Math.round((historial.filter((l) => l.hit_protein).length / dias) * 100) : 0;
  const cumplidosHoy = (kcal ? 1 : 0) + (prote ? 1 : 0);
  const diaPagado = !!(hoyLog?.hit_kcal && hoyLog?.hit_protein);

  const subtitulo = !cargado || errorCarga
    ? undefined
    : objetivo
      ? t('nutricion:vista.subObjetivo', { kcal: formatoMiles(objetivo.kcal), prote: objetivo.protein_g })
      : t('nutricion:vista.subSinObjetivo');

  const cifras: Cifra[] = [
    objetivo
      ? { valor: objetivo.kcal, rotulo: t('nutricion:vista.cifraKcal') }
      : { valor: SIN_DATO, rotulo: t('nutricion:vista.cifraKcal'), etiqueta: t('nutricion:vista.cifraKcalSinDato') },
    objetivo
      ? { valor: objetivo.protein_g, sufijo: ' g', rotulo: t('nutricion:vista.cifraProte') }
      : { valor: SIN_DATO, rotulo: t('nutricion:vista.cifraProte'), etiqueta: t('nutricion:vista.cifraProteSinDato') },
    {
      valor: `${cumplidosHoy}/2`,
      rotulo: t('nutricion:vista.cifraParte'),
      etiqueta: t('nutricion:vista.cifraParteA11y', { n: cumplidosHoy }),
    },
  ];

  // Lo que estimó el coach desde el chat para hoy, si lo hizo.
  const estimado = !hoyLog
    ? null
    : hoyLog.kcal_est !== null && hoyLog.protein_est !== null
      ? t('nutricion:vista.estimadoAmbos', { kcal: formatoMiles(hoyLog.kcal_est), prote: hoyLog.protein_est })
      : hoyLog.kcal_est !== null
        ? t('nutricion:vista.estimadoKcal', { kcal: formatoMiles(hoyLog.kcal_est) })
        : hoyLog.protein_est !== null
          ? t('nutricion:vista.estimadoProte', { prote: hoyLog.protein_est })
          : null;

  return (
    <Screen>
      <Entrada indice={0}>
        <EncabezadoArena
          eyebrow={t('nutricion:vista.eyebrow')}
          titulo={t('nutricion:vista.titulo')}
          subtitulo={subtitulo}
          onVolver={acciones.onVolver}
          meandro
        />
      </Entrada>

      {!cargado ? (
        <CargaArena etiqueta={t('nutricion:vista.cargando')} formas={['franja', 'rotulo', 'filas', 'rotulo', 'filas']} />
      ) : errorCarga ? (
        <Entrada indice={1}>
          <ErrorSistema mensaje={errorCarga} onReintentar={acciones.onReintentar} style={styles.bloque} />
        </Entrada>
      ) : (
        <>
          <Entrada indice={1} style={styles.franja}>
            <FranjaCifras cifras={cifras} />
          </Entrada>

          <Entrada indice={2}>
            {objetivo ? (
              <Section title={t('nutricion:vista.objetivo')}>
                {objetivo.carbs_g || objetivo.fat_g ? (
                  <View style={styles.lista}>
                    {objetivo.carbs_g ? (
                      <Row
                        first
                        title={t('nutricion:vista.carbos')}
                        // i18n-ok: unidad
                        trailing={<Text style={styles.cifraFila} maxFontSizeMultiplier={1.2}>{objetivo.carbs_g}<Text style={styles.unidad}> g</Text></Text>}
                        accessibilityLabel={t('nutricion:vista.carbosA11y', { g: objetivo.carbs_g })}
                      />
                    ) : null}
                    {objetivo.fat_g ? (
                      <Row
                        first={!objetivo.carbs_g}
                        title={t('nutricion:vista.grasa')}
                        // i18n-ok: unidad
                        trailing={<Text style={styles.cifraFila} maxFontSizeMultiplier={1.2}>{objetivo.fat_g}<Text style={styles.unidad}> g</Text></Text>}
                        accessibilityLabel={t('nutricion:vista.grasaA11y', { g: objetivo.fat_g })}
                      />
                    ) : null}
                  </View>
                ) : null}
                {objetivo.rationale ? (
                  <Text style={styles.motivo} maxFontSizeMultiplier={1.35}>
                    {objetivo.rationale}
                  </Text>
                ) : null}
              </Section>
            ) : (
              <TarjetaArena variante="contorno" style={styles.bloque}>
                <EmptyState
                  compact
                  icon="nutrition-outline"
                  title={t('nutricion:vista.sinObjetivo')}
                  body={t('nutricion:vista.sinObjetivoCuerpo')}
                  action={{ label: t('nutricion:vista.hablarCoach'), onPress: acciones.onCoach, variant: 'outline' }}
                />
              </TarjetaArena>
            )}
          </Entrada>

          <Entrada indice={3}>
            <Section title={t('nutricion:vista.parteHoy')} meta={`${cumplidosHoy}/2`} tone={cumplidosHoy === 2 ? 'accent' : 'dim'}>
              <View style={styles.lista}>
                <Row
                  first
                  leading={<Check checked={kcal} size={24} />}
                  title={t('nutricion:vista.calorias')}
                  detail={
                    objetivo
                      ? t('nutricion:vista.objetivoKcal', { kcal: formatoMiles(objetivo.kcal) })
                      : t('nutricion:vista.sinObjetivo')
                  }
                  trailing={kcal ? <Tag tone="dim">{t('nutricion:vista.cumplido')}</Tag> : undefined}
                  onPress={acciones.onKcal}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: kcal }}
                  accessibilityLabel={t('nutricion:vista.kcalA11y')}
                />
                <Row
                  leading={<Check checked={prote} size={24} />}
                  title={t('nutricion:vista.proteina')}
                  detail={
                    objetivo
                      ? t('nutricion:vista.objetivoProte', { prote: objetivo.protein_g })
                      : t('nutricion:vista.sinObjetivo')
                  }
                  trailing={prote ? <Tag tone="dim">{t('nutricion:vista.cumplido')}</Tag> : undefined}
                  onPress={acciones.onProte}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: prote }}
                  accessibilityLabel={t('nutricion:vista.proteA11y')}
                />
              </View>
              {estimado ? (
                <Text style={styles.nota} maxFontSizeMultiplier={1.35}>
                  {estimado}
                </Text>
              ) : null}
              <Campo
                etiqueta={t('nutricion:vista.notas')}
                value={notas}
                onChangeText={acciones.onNotas}
                placeholder={t('nutricion:vista.notasPlaceholder')}
                multiline
                estiloBloque={styles.campo}
                style={styles.notas}
              />
              <Button
                title={diaPagado ? t('nutricion:vista.corregir') : t('nutricion:vista.registrar')}
                size="lg"
                onPress={acciones.onGuardar}
                loading={guardando}
                style={styles.boton}
              />
              <Text style={styles.nota} maxFontSizeMultiplier={1.35}>
                {diaPagado
                  ? t('nutricion:vista.yaPagado')
                  : t('nutricion:vista.paga', { xp: xpDia })}
              </Text>
            </Section>
          </Entrada>

          <Entrada indice={4}>
            <Section
              title={t('nutricion:vista.adherencia')}
              meta={dias ? t('nutricion:vista.partes', { count: dias }) : undefined}
            >
              {dias ? (
                <>
                  <View style={styles.lista}>
                    <FilaAdherencia primera rotulo={t('nutricion:vista.calorias')} pct={pctKcal} />
                    <FilaAdherencia rotulo={t('nutricion:vista.proteina')} pct={pctProte} />
                  </View>
                  <Text style={styles.nota} maxFontSizeMultiplier={1.35}>
                    {t('nutricion:vista.adherenciaNota')}
                  </Text>
                </>
              ) : (
                <TarjetaArena variante="contorno">
                  <EmptyState
                    compact
                    icon="analytics-outline"
                    title={t('nutricion:vista.sinPartes')}
                    body={t('nutricion:vista.sinPartesCuerpo')}
                  />
                </TarjetaArena>
              )}
            </Section>
          </Entrada>

          <DescargoSalud />
        </>
      )}
    </Screen>
  );
}

/** Una fila de adherencia: rótulo, porcentaje en Cinzel y la barra (estática). */
function FilaAdherencia({ rotulo, pct, primera }: { rotulo: string; pct: number; primera?: boolean }) {
  return (
    <View
      style={[styles.adherencia, !primera && styles.conRegla]}
      accessible
      accessibilityLabel={t(
        pct >= ADHERENCIA_BUENA ? 'nutricion:vista.adherenciaBuenaA11y' : 'nutricion:vista.adherenciaA11y',
        { rotulo, pct },
      )}
    >
      <View style={styles.adherenciaCab}>
        <Text style={styles.adherenciaRotulo} maxFontSizeMultiplier={1.35}>
          {rotulo}
        </Text>
        <Text style={styles.cifraFila} maxFontSizeMultiplier={1.2}>
          {pct} %
        </Text>
      </View>
      <Barra ratio={pct / 100} alto={4} tono={pct >= ADHERENCIA_BUENA ? 'blanco' : 'ink8'} etiqueta={rotulo} enGrupo />
    </View>
  );
}

const styles = StyleSheet.create({
  bloque: { marginBottom: space.s6 },
  franja: {
    marginBottom: space.s6,
    paddingVertical: space.s3,
    borderTopWidth: stroke.hairline,
    borderBottomWidth: stroke.hairline,
    borderColor: ink.ink3,
  },
  // Filas sobre hairlines, sin tarjeta.
  lista: { borderTopWidth: stroke.hairline, borderBottomWidth: stroke.hairline, borderColor: ink.ink3 },
  cifraFila: {
    fontFamily: 'Cinzel_600SemiBold',
    fontSize: 16,
    lineHeight: 20,
    color: ink.ink10,
    fontVariant: ['tabular-nums'],
  },
  // Cinzel no tiene minúsculas: la unidad va en Outfit.
  unidad: { fontFamily: tipo.micro.family, fontSize: tipo.micro.size, letterSpacing: tipo.micro.tracking, color: ink.ink6 },
  motivo: {
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink8,
    marginTop: space.s3,
  },
  campo: { marginTop: space.s5 },
  notas: { minHeight: 72, textAlignVertical: 'top' },
  boton: { marginTop: space.s5 },
  nota: {
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink6,
    marginTop: space.s3,
  },
  adherencia: { paddingVertical: space.s3, gap: space.s2 },
  conRegla: { borderTopWidth: stroke.hairline, borderTopColor: ink.ink3 },
  adherenciaCab: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: space.s3 },
  adherenciaRotulo: {
    fontFamily: tipo.body.family,
    fontSize: tipo.body.size,
    lineHeight: tipo.body.lineHeight,
    color: ink.ink9,
  },
});
