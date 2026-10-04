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
      ? `${formatoMiles(objetivo.kcal)} kcal y ${objetivo.protein_g} g de proteína al día.`
      : 'Sin objetivo fijado todavía.';

  const cifras: Cifra[] = [
    objetivo
      ? { valor: objetivo.kcal, rotulo: 'Kcal objetivo' }
      : { valor: SIN_DATO, rotulo: 'Kcal objetivo', etiqueta: 'Kcal objetivo: sin dato' },
    objetivo
      ? { valor: objetivo.protein_g, sufijo: ' g', rotulo: 'Proteína' }
      : { valor: SIN_DATO, rotulo: 'Proteína', etiqueta: 'Proteína: sin dato' },
    {
      valor: `${cumplidosHoy}/2`,
      rotulo: 'Parte de hoy',
      etiqueta: `Parte de hoy: ${cumplidosHoy} de 2 cumplidos`,
    },
  ];

  // Lo que estimó el coach desde el chat para hoy, si lo hizo.
  const estimado =
    hoyLog && (hoyLog.kcal_est !== null || hoyLog.protein_est !== null)
      ? [
          hoyLog.kcal_est !== null ? `${formatoMiles(hoyLog.kcal_est)} kcal` : null,
          hoyLog.protein_est !== null ? `${hoyLog.protein_est} g de proteína` : null,
        ]
          .filter(Boolean)
          .join(' y ')
      : null;

  return (
    <Screen>
      <Entrada indice={0}>
        <EncabezadoArena
          eyebrow="Cuerpo"
          titulo="Nutrición"
          subtitulo={subtitulo}
          onVolver={acciones.onVolver}
          meandro
        />
      </Entrada>

      {!cargado ? (
        <CargaArena etiqueta="Cargando tu nutrición" formas={['franja', 'rotulo', 'filas', 'rotulo', 'filas']} />
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
              <Section title="Objetivo">
                {objetivo.carbs_g || objetivo.fat_g ? (
                  <View style={styles.lista}>
                    {objetivo.carbs_g ? (
                      <Row
                        first
                        title="Carbohidratos"
                        trailing={<Text style={styles.cifraFila} maxFontSizeMultiplier={1.2}>{objetivo.carbs_g}<Text style={styles.unidad}> g</Text></Text>}
                        accessibilityLabel={`Carbohidratos: ${objetivo.carbs_g} gramos al día`}
                      />
                    ) : null}
                    {objetivo.fat_g ? (
                      <Row
                        first={!objetivo.carbs_g}
                        title="Grasa"
                        trailing={<Text style={styles.cifraFila} maxFontSizeMultiplier={1.2}>{objetivo.fat_g}<Text style={styles.unidad}> g</Text></Text>}
                        accessibilityLabel={`Grasa: ${objetivo.fat_g} gramos al día`}
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
                  title="Sin objetivo fijado"
                  body="Pídeselo al coach: lo calculará con tu peso, tu entrenamiento y el ritmo que buscas."
                  action={{ label: 'Hablar con el coach', onPress: acciones.onCoach, variant: 'outline' }}
                />
              </TarjetaArena>
            )}
          </Entrada>

          <Entrada indice={3}>
            <Section title="Parte de hoy" meta={`${cumplidosHoy}/2`} tone={cumplidosHoy === 2 ? 'accent' : 'dim'}>
              <View style={styles.lista}>
                <Row
                  first
                  leading={<Check checked={kcal} size={24} />}
                  title="Calorías"
                  detail={objetivo ? `Objetivo: ${formatoMiles(objetivo.kcal)} kcal` : 'Sin objetivo fijado'}
                  trailing={kcal ? <Tag tone="dim">Cumplido</Tag> : undefined}
                  onPress={acciones.onKcal}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: kcal }}
                  accessibilityLabel="He cumplido las calorías"
                />
                <Row
                  leading={<Check checked={prote} size={24} />}
                  title="Proteína"
                  detail={objetivo ? `Objetivo: ${objetivo.protein_g} g` : 'Sin objetivo fijado'}
                  trailing={prote ? <Tag tone="dim">Cumplido</Tag> : undefined}
                  onPress={acciones.onProte}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: prote }}
                  accessibilityLabel="He cumplido la proteína"
                />
              </View>
              {estimado ? (
                <Text style={styles.nota} maxFontSizeMultiplier={1.35}>
                  El coach estimó hoy {estimado}.
                </Text>
              ) : null}
              <Campo
                etiqueta="Notas del día"
                value={notas}
                onChangeText={acciones.onNotas}
                placeholder="Qué se torció, o qué comiste de más"
                multiline
                estiloBloque={styles.campo}
                style={styles.notas}
              />
              <Button
                title={diaPagado ? 'Corregir el parte' : 'Registrar el día'}
                size="lg"
                onPress={acciones.onGuardar}
                loading={guardando}
                style={styles.boton}
              />
              <Text style={styles.nota} maxFontSizeMultiplier={1.35}>
                {diaPagado
                  ? 'El día ya está registrado y pagado. Puedes corregir el parte sin que vuelva a premiar.'
                  : `Cumplir las dos cosas paga hasta +${xpDia} XP a VIT.`}
              </Text>
            </Section>
          </Entrada>

          <Entrada indice={4}>
            <Section title="Adherencia · 28 días" meta={dias ? `${dias} ${dias === 1 ? 'parte' : 'partes'}` : undefined}>
              {dias ? (
                <>
                  <View style={styles.lista}>
                    <FilaAdherencia primera rotulo="Calorías" pct={pctKcal} />
                    <FilaAdherencia rotulo="Proteína" pct={pctProte} />
                  </View>
                  <Text style={styles.nota} maxFontSizeMultiplier={1.35}>
                    Si la adherencia es alta y el peso no se mueve dos semanas, el fallo es del objetivo, no tuyo: el
                    sistema lo recalculará.
                  </Text>
                </>
              ) : (
                <TarjetaArena variante="contorno">
                  <EmptyState
                    compact
                    icon="analytics-outline"
                    title="Sin partes todavía"
                    body="Son dos toques al día y son lo que permite al sistema saber si hay que tocar las calorías o apretar."
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
      accessibilityLabel={`${rotulo}: ${pct} % de los días${pct >= ADHERENCIA_BUENA ? ', buena adherencia' : ''}`}
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
