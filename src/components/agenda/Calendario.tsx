// NIVL · Agenda: el calendario de arriba (FASE3 Lote C). Puro.
//
//   · TiraSemana → siete columnas: la letra en micro ink6, el número en Cinzel
//     600 18 y una pista ink4 con la carga del día en ink8 (lo que ocupan los
//     eventos con hora sobre 8 h).
//   · RejillaMes → 7 × 6 con hairline ink3, números en Cinzel 600 14 y las
//     marcas por forma, nunca por color: evento = punto lleno ink9, plazo de
//     campaña = cuadrado en contorno, solo misiones = punto pequeño ink6.
//
// En los dos, el día elegido es LA inversión de la pantalla (placa ink10,
// texto ink0) y hoy lleva marco de 2 en ink10. Elegir un día vibra
// `seleccion` (lo hace useAgenda, no la vista).

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ink, space, stroke, type as tipo } from '@/design/tokens';
import { cargaDelDia } from '@/lib/timeline';
import {
  contenidoDe,
  diasDeSemana,
  etiquetaDia,
  LETRAS_DIA,
  rejillaMes,
  tramosDe,
  type DatosAgenda,
} from './derivarAgenda';

interface CalendarioProps {
  datos: DatosAgenda;
  hoy: string;
  dia: string;
  onElegir: (dia: string) => void;
}

/** Alto mínimo de una celda: la zona táctil de 44. */
const CELDA_MIN = 44;
const MARCA = 5;

export function TiraSemana({ datos, hoy, dia, onElegir }: CalendarioProps) {
  return (
    <View style={styles.tira} accessibilityRole="radiogroup" accessibilityLabel="Días de la semana">
      {diasDeSemana(dia).map((d, i) => {
        const c = contenidoDe(datos, d, hoy);
        const carga = cargaDelDia(tramosDe(c.eventos));
        const sel = d === dia;
        const esHoy = d === hoy;
        return (
          <Pressable
            key={d}
            onPress={() => onElegir(d)}
            style={({ pressed }) => [
              styles.diaTira,
              esHoy && styles.marcoHoy,
              sel && styles.invertido,
              pressed && !sel && styles.pulsado,
            ]}
            accessibilityRole="radio"
            accessibilityState={{ selected: sel }}
            accessibilityLabel={etiquetaDia(d, hoy, c)}
          >
            <Text style={[styles.letra, sel && styles.textoInvertido]} maxFontSizeMultiplier={1.2}>
              {LETRAS_DIA[i]}
            </Text>
            <Text style={[styles.numTira, sel && styles.textoInvertido]} maxFontSizeMultiplier={1.2}>
              {Number(d.slice(8))}
            </Text>
            <View style={[styles.pista, sel && styles.pistaInvertida]}>
              <View
                style={[
                  styles.relleno,
                  sel && styles.rellenoInvertido,
                  { height: `${carga > 0 ? Math.max(10, carga * 100) : 0}%` },
                ]}
              />
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

export function RejillaMes({ datos, hoy, dia, onElegir }: CalendarioProps) {
  const celdas = rejillaMes(dia);
  return (
    <View>
      <View style={styles.cabecera} accessible={false} importantForAccessibility="no-hide-descendants">
        {LETRAS_DIA.map((l) => (
          <Text key={l} style={styles.letraMes} maxFontSizeMultiplier={1.2}>
            {l}
          </Text>
        ))}
      </View>
      <View style={styles.rejilla} accessibilityRole="radiogroup" accessibilityLabel="Días del mes">
        {celdas.map((d, i) => {
          if (!d) return <View key={`v-${i}`} style={styles.celda} />;
          const c = contenidoDe(datos, d, hoy);
          const sel = d === dia;
          const esHoy = d === hoy;
          const otros = c.eventos.length + c.plazos.length;
          return (
            <Pressable
              key={d}
              onPress={() => onElegir(d)}
              style={({ pressed }) => [styles.celda, sel && styles.invertido, pressed && !sel && styles.pulsado]}
              accessibilityRole="radio"
              accessibilityState={{ selected: sel }}
              accessibilityLabel={etiquetaDia(d, hoy, c)}
            >
              {esHoy ? <View style={styles.marcoCelda} pointerEvents="none" /> : null}
              <Text style={[styles.numMes, sel && styles.textoInvertido]} maxFontSizeMultiplier={1.2}>
                {Number(d.slice(8))}
              </Text>
              <View style={styles.marcas}>
                {c.eventos.length ? <View style={[styles.punto, sel && styles.puntoInvertido]} /> : null}
                {c.plazos.length ? <View style={[styles.cuadro, sel && styles.cuadroInvertido]} /> : null}
                {/* Las misiones diarias caen casi cada día: solo se marcan
                    cuando no hay nada más, si no la rejilla entera llevaría punto. */}
                {otros === 0 && c.misiones.length ? (
                  <View style={[styles.puntoMision, sel && styles.puntoMisionInvertido]} />
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tira: { flexDirection: 'row', gap: space.s1 },
  diaTira: {
    flex: 1,
    minWidth: 0,
    minHeight: CELDA_MIN,
    alignItems: 'center',
    paddingVertical: space.s2,
    borderWidth: stroke.hairline,
    borderColor: ink.ink3,
  },
  // Hoy: marco de 2. Se resta 1 al relleno para que el número no salte.
  marcoHoy: { borderWidth: stroke.rule, borderColor: ink.ink10, paddingVertical: space.s2 - 1 },
  invertido: { backgroundColor: ink.ink10, borderColor: ink.ink10 },
  textoInvertido: { color: ink.ink0 },
  pulsado: { backgroundColor: ink.ink2 },
  letra: {
    fontFamily: tipo.micro.family,
    fontSize: tipo.micro.size,
    lineHeight: tipo.micro.lineHeight,
    letterSpacing: tipo.micro.tracking,
    color: ink.ink6,
  },
  numTira: {
    fontFamily: 'Cinzel_600SemiBold',
    fontSize: 18,
    lineHeight: 24,
    color: ink.ink9,
    fontVariant: ['tabular-nums'],
    marginTop: space.s1,
  },
  pista: {
    width: 14,
    height: 18,
    marginTop: space.s2,
    backgroundColor: ink.ink4,
    justifyContent: 'flex-end',
  },
  pistaInvertida: { backgroundColor: ink.ink8 },
  relleno: { width: '100%', backgroundColor: ink.ink8 },
  rellenoInvertido: { backgroundColor: ink.ink0 },

  cabecera: { flexDirection: 'row', paddingBottom: space.s2 },
  letraMes: {
    flex: 1,
    textAlign: 'center',
    fontFamily: tipo.micro.family,
    fontSize: tipo.micro.size,
    lineHeight: tipo.micro.lineHeight,
    letterSpacing: tipo.micro.tracking,
    color: ink.ink6,
  },
  // La hairline: arriba e izquierda en la rejilla, abajo y derecha en cada celda.
  rejilla: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderTopWidth: stroke.hairline,
    borderLeftWidth: stroke.hairline,
    borderColor: ink.ink3,
  },
  celda: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    minHeight: CELDA_MIN,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: stroke.hairline,
    borderBottomWidth: stroke.hairline,
    borderColor: ink.ink3,
  },
  marcoCelda: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: stroke.rule,
    borderColor: ink.ink10,
  },
  numMes: {
    fontFamily: 'Cinzel_600SemiBold',
    fontSize: 14,
    lineHeight: 18,
    color: ink.ink9,
    fontVariant: ['tabular-nums'],
  },
  marcas: { flexDirection: 'row', alignItems: 'center', gap: 3, height: MARCA, marginTop: 3 },
  punto: { width: MARCA, height: MARCA, borderRadius: MARCA / 2, backgroundColor: ink.ink9 },
  puntoInvertido: { backgroundColor: ink.ink0 },
  cuadro: { width: MARCA, height: MARCA, borderWidth: stroke.hairline, borderColor: ink.ink9 },
  cuadroInvertido: { borderColor: ink.ink0 },
  puntoMision: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: ink.ink6 },
  puntoMisionInvertido: { backgroundColor: ink.ink4 },
});
