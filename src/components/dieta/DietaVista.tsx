// NIVL · Dieta: la vista (L-RADICAL §C, FASE3 Oleada 2, lote E2). Pura: todo
// llega por props desde useDieta (o desde la galería con datos de mentira) y
// no carga nada.
//
// De arriba abajo: el encabezado grabado («Cuerpo» / «DIETA», con la acción
// «Lista de la compra» en contorno y el meandro), los chips de los siete días
// (radio, vibran al elegir), la franja de cifras del día (kcal y proteína que
// planificó el coach y las comidas «n/5»), las cinco comidas del día en filas
// sobre hairlines (letra grabada, la comida y sus ingredientes, y las macros
// en Cinzel) y la lista de la compra, con el descargo de salud al pie.
//
// INVERSIÓN única: «Generar lista de la compra», solo si hay algo que
// generar (alguna comida planificada). Sin plan, el botón es secundario y la
// pantalla no invierte nada: lo que toca es tocar una comida.

import { StyleSheet, Text, View } from 'react-native';
import { DescargoSalud } from '@/components/DescargoSalud';
import {
  CargaArena,
  EncabezadoArena,
  Entrada,
  ErrorSistema,
  FranjaCifras,
  formatoMiles,
} from '@/components/arena';
import { Button, Chip, ChipWrap, Row, Screen, Section, SIN_DATO } from '@/components/ui';
import { ink, space, stroke, type as tipo } from '@/design/tokens';
import { MEAL_SLOTS } from '@/lib/body';
import type { MealSlot, MealSlotName } from '@/lib/types';

export const DIAS_CORTOS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
export const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

export const NOMBRE_COMIDA: Record<MealSlotName, string> = {
  desayuno: 'Desayuno',
  comida: 'Comida',
  merienda: 'Merienda',
  cena: 'Cena',
  snack: 'Snack',
};

export interface DietaVistaProps {
  /** Hasta la primera carga se pintan huecos. */
  cargado: boolean;
  /** Fallo de la última carga, ya escrito para el usuario. */
  errorCarga: string | null;
  /** Las comidas de toda la semana. */
  slots: MealSlot[];
  /** Día elegido, 1 (lunes) a 7 (domingo). */
  dia: number;
  /** Día de hoy, 1 a 7. */
  hoy: number;
  generando: boolean;
  acciones: {
    onVolver: () => void;
    onDia: (d: number) => void;
    onComida: (slot: MealSlotName) => void;
    onGenerar: () => void;
    onCompra: () => void;
    onReintentar: () => void;
  };
}

export function DietaVista({ cargado, errorCarga, slots, dia, hoy, generando, acciones }: DietaVistaProps) {
  const daySlots = slots.filter((s) => s.day_of_week === dia);
  // Solo suman las comidas que el coach ha planificado con macros; las escritas
  // a mano no llevan cifras y no deben falsear el total del día.
  const kcalDia = daySlots.reduce((a, s) => a + (s.kcal ?? 0), 0);
  const proteDia = daySlots.reduce((a, s) => a + (s.protein_g ?? 0), 0);
  const nombreDia = DIAS[dia - 1] ?? '';
  const esHoy = dia === hoy;
  const conIngredientes = slots.some((s) => !!s.ingredients?.trim());

  const subtitulo =
    !cargado || errorCarga
      ? undefined
      : kcalDia > 0
        ? `${nombreDia}: ${formatoMiles(kcalDia)} kcal y ${proteDia} g de proteína planificados.`
        : daySlots.length > 0
          ? `${nombreDia}: ${daySlots.length} ${daySlots.length === 1 ? 'comida planificada' : 'comidas planificadas'}.`
          : `${nombreDia} sin planificar todavía.`;

  return (
    <Screen>
      <Entrada indice={0}>
        <EncabezadoArena
          eyebrow="Cuerpo"
          titulo="Dieta"
          subtitulo={subtitulo}
          onVolver={acciones.onVolver}
          accion={{ icono: 'cart-outline', etiqueta: 'Ir a la lista de la compra', onPress: acciones.onCompra }}
          meandro
        />
      </Entrada>

      <Entrada indice={1} style={styles.dias}>
        <ChipWrap>
          {DIAS_CORTOS.map((letra, i) => (
            <Chip
              key={letra}
              label={letra}
              selected={dia === i + 1}
              onPress={() => acciones.onDia(i + 1)}
              accessibilityLabel={`${DIAS[i]}${i + 1 === hoy ? ', hoy' : ''}`}
              style={styles.chipDia}
            />
          ))}
        </ChipWrap>
      </Entrada>

      {!cargado ? (
        <CargaArena etiqueta="Cargando tu dieta" formas={['franja', 'rotulo', 'filas', 'rotulo']} filas={5} />
      ) : errorCarga ? (
        <Entrada indice={2}>
          <ErrorSistema mensaje={errorCarga} onReintentar={acciones.onReintentar} style={styles.bloque} />
        </Entrada>
      ) : (
        <>
          <Entrada indice={2} style={styles.franja}>
            <FranjaCifras
              cifras={[
                kcalDia > 0
                  ? { valor: kcalDia, rotulo: 'Kcal' }
                  : { valor: SIN_DATO, rotulo: 'Kcal', etiqueta: 'Kcal: sin dato' },
                proteDia > 0
                  ? { valor: proteDia, sufijo: ' g', rotulo: 'Proteína' }
                  : { valor: SIN_DATO, rotulo: 'Proteína', etiqueta: 'Proteína: sin dato' },
                {
                  valor: `${daySlots.length}/${MEAL_SLOTS.length}`,
                  rotulo: 'Comidas',
                  etiqueta: `Comidas: ${daySlots.length} de ${MEAL_SLOTS.length} planificadas`,
                },
              ]}
            />
          </Entrada>
          {kcalDia === 0 && daySlots.length > 0 ? (
            <Text style={[styles.nota, styles.notaFranja]} maxFontSizeMultiplier={1.35}>
              Las comidas escritas a mano no llevan macros; solo suman las que planifica el coach.
            </Text>
          ) : null}

          <Entrada indice={3}>
            <Section title={esHoy ? `Hoy · ${nombreDia}` : nombreDia} meta={`${daySlots.length}/${MEAL_SLOTS.length}`}>
              <View style={styles.lista}>
                {MEAL_SLOTS.map((slotName, i) => {
                  const existing = daySlots.find((s) => s.slot === slotName);
                  const nombre = NOMBRE_COMIDA[slotName];
                  return (
                    <Row
                      key={slotName}
                      first={i === 0}
                      leading={
                        <View style={[styles.letra, existing && styles.letraLlena]}>
                          <Text style={[styles.letraTexto, !existing && styles.letraVacia]} maxFontSizeMultiplier={1}>
                            {nombre.slice(0, 1)}
                          </Text>
                        </View>
                      }
                      title={existing ? existing.description : nombre}
                      muted={!existing}
                      detail={
                        existing
                          ? [nombre, existing.ingredients].filter(Boolean).join(' · ')
                          : 'Sin planificar. Toca para añadir.'
                      }
                      trailing={existing ? <Macros comida={existing} /> : undefined}
                      chevron
                      onPress={() => acciones.onComida(slotName)}
                      accessibilityLabel={`${existing ? `Editar ${nombre.toLowerCase()}: ${existing.description}` : `Planificar ${nombre.toLowerCase()}`} del ${nombreDia.toLowerCase()}${macrosLeidas(existing)}`}
                    />
                  );
                })}
              </View>
            </Section>
          </Entrada>

          <Entrada indice={4}>
            <Section title="Lista de la compra">
              <Button
                title="Generar la lista"
                icon="cart-outline"
                size="lg"
                variant={conIngredientes ? 'primary' : 'secondary'}
                onPress={acciones.onGenerar}
                loading={generando}
              />
              <Text style={styles.nota} maxFontSizeMultiplier={1.35}>
                {conIngredientes
                  ? 'El sistema junta los ingredientes de las 7 jornadas, elimina duplicados y los envía a la lista.'
                  : 'Escribe los ingredientes de tus comidas, separados por comas, y el sistema hará la lista.'}
              </Text>
            </Section>
          </Entrada>

          <DescargoSalud />
        </>
      )}
    </Screen>
  );
}

/** Las macros de una comida en Cinzel: kcal arriba, proteína debajo. */
function Macros({ comida }: { comida: MealSlot }) {
  if (!comida.kcal && !comida.protein_g) return null;
  return (
    <View style={styles.macros}>
      {comida.kcal ? (
        <Text style={styles.cifraFila} maxFontSizeMultiplier={1.2}>
          {formatoMiles(comida.kcal)}
          <Text style={styles.unidad}> kcal</Text>
        </Text>
      ) : null}
      {comida.protein_g ? (
        <Text style={styles.cifraSec} maxFontSizeMultiplier={1.2}>
          {comida.protein_g}
          <Text style={styles.unidad}> g prot.</Text>
        </Text>
      ) : null}
    </View>
  );
}

function macrosLeidas(c: MealSlot | undefined): string {
  if (!c) return '';
  const partes = [c.kcal ? `${c.kcal} kcal` : null, c.protein_g ? `${c.protein_g} gramos de proteína` : null].filter(
    Boolean,
  );
  return partes.length ? `, ${partes.join(' y ')}` : '';
}

const LETRA = 30;

const styles = StyleSheet.create({
  dias: { marginBottom: space.s6 },
  // Siete chips de 44 caben a 375 en una fila.
  chipDia: { minWidth: 40, justifyContent: 'center' },
  bloque: { marginBottom: space.s6 },
  franja: {
    paddingVertical: space.s3,
    borderTopWidth: stroke.hairline,
    borderBottomWidth: stroke.hairline,
    borderColor: ink.ink3,
    marginBottom: space.s6,
  },
  notaFranja: { marginTop: -space.s4, marginBottom: space.s6 },
  lista: { borderTopWidth: stroke.hairline, borderBottomWidth: stroke.hairline, borderColor: ink.ink3 },
  letra: {
    width: LETRA,
    height: LETRA,
    borderWidth: stroke.hairline,
    borderColor: ink.ink4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  letraLlena: { borderColor: ink.ink10 },
  letraVacia: { color: ink.ink6 },
  letraTexto: { fontFamily: 'Cinzel_700Bold', fontSize: 14, lineHeight: 18, color: ink.ink10 },
  macros: { alignItems: 'flex-end' },
  cifraFila: {
    fontFamily: 'Cinzel_600SemiBold',
    fontSize: 16,
    lineHeight: 20,
    color: ink.ink10,
    fontVariant: ['tabular-nums'],
  },
  cifraSec: {
    fontFamily: 'Cinzel_600SemiBold',
    fontSize: 14,
    lineHeight: 18,
    color: ink.ink8,
    fontVariant: ['tabular-nums'],
  },
  unidad: { fontFamily: tipo.micro.family, fontSize: tipo.micro.size, letterSpacing: tipo.micro.tracking, color: ink.ink6 },
  nota: {
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink6,
    marginTop: space.s3,
  },
});
