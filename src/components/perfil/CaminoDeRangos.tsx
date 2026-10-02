// NIVL · Camino de rangos (Perfil, L-RADICAL B.3.2 y Perfil.dc).
//
// Seis casillas de 44 en una rejilla de seis con hueco de 6. Sin color
// (SISTEMA.md §0 y §7): el estado va en la forma.
//   · alcanzado  → casilla invertida (ink10, letra Cinzel ink0). Los rangos
//                  ya ganados son la ÚNICA inversión de la pantalla de Perfil.
//   · actual     → marco de 3 en ink10 y letra ink10.
//   · por llegar → hairline ink4 y letra ink6.
// Debajo, lo que falta para el siguiente (siguienteRango de progression.ts).

import { StyleSheet, Text, View } from 'react-native';
import { ink, space, stroke, type as tipo } from '@/design/tokens';
import { compararRangos, RANGOS, type EstadoProgreso, type RangoId } from '@/lib/progression';

interface Props {
  rango: RangoId;
  siguiente: EstadoProgreso['siguienteRango'];
}

type EstadoNodo = 'alcanzado' | 'actual' | 'futuro';

/**
 * «{n} niveles y {d} días activos para {nombre}». Sin los días activos
 * (faltanDias null: sin red o sin sync_rank) no se inventa la cifra: se dice
 * que el rango pide además días en la arena.
 */
export function textoSiguiente(s: NonNullable<EstadoProgreso['siguienteRango']>): string {
  const niveles = s.faltan > 0 ? `${s.faltan} ${s.faltan === 1 ? 'nivel' : 'niveles'}` : null;
  if (s.faltanDias == null) {
    const pide = `${s.nombre} pide además días activos en la arena.`;
    return niveles ? `${niveles} para ${s.nombre}. ${pide}` : `Nivel listo. ${pide}`;
  }
  const dias = s.faltanDias > 0 ? `${s.faltanDias} ${s.faltanDias === 1 ? 'día activo' : 'días activos'}` : null;
  if (niveles && dias) return `${niveles} y ${dias} para ${s.nombre}.`;
  if (niveles) return `${niveles} para ${s.nombre}.`;
  // El nivel ya llega: el rango espera a los días en la arena.
  if (dias) return `${dias} para ${s.nombre}.`;
  return `Nivel y días listos para ${s.nombre}.`;
}

export function CaminoDeRangos({ rango, siguiente }: Props) {
  return (
    <View>
      <View style={styles.rejilla}>
        {RANGOS.map((r) => {
          const cmp = compararRangos(r.id, rango);
          const estado: EstadoNodo = cmp < 0 ? 'alcanzado' : cmp === 0 ? 'actual' : 'futuro';
          const etiqueta =
            estado === 'actual' ? 'actual' : estado === 'alcanzado' ? 'alcanzado' : 'por alcanzar';
          return (
            <View
              key={r.id}
              accessible
              accessibilityRole="text"
              accessibilityLabel={`Rango ${r.id}, ${r.nombre}, ${etiqueta}`}
              style={[
                styles.casilla,
                estado === 'alcanzado' && styles.casillaAlcanzada,
                estado === 'actual' && styles.casillaActual,
                estado === 'futuro' && styles.casillaFutura,
              ]}
            >
              <Text
                allowFontScaling={false}
                style={[
                  styles.letra,
                  estado === 'alcanzado' && styles.letraAlcanzada,
                  estado === 'actual' && styles.letraActual,
                  estado === 'futuro' && styles.letraFutura,
                ]}
              >
                {r.id}
              </Text>
            </View>
          );
        })}
      </View>
      <Text maxFontSizeMultiplier={1.35} style={styles.texto}>
        {siguiente ? textoSiguiente(siguiente) : 'Leyenda. No queda rango por encima.'}
      </Text>
    </View>
  );
}

const CASILLA = 44;
const HUECO = 6;

const styles = StyleSheet.create({
  rejilla: { flexDirection: 'row', gap: HUECO },
  casilla: { flex: 1, minWidth: 0, height: CASILLA, alignItems: 'center', justifyContent: 'center' },
  casillaAlcanzada: { backgroundColor: ink.ink10 },
  casillaActual: { borderWidth: stroke.frame, borderColor: ink.ink10 },
  casillaFutura: { borderWidth: stroke.hairline, borderColor: ink.ink4 },
  letra: { fontFamily: tipo.rank.family, fontSize: 18, lineHeight: 22 },
  letraAlcanzada: { color: ink.ink0 },
  letraActual: { color: ink.ink10 },
  letraFutura: { color: ink.ink6 },
  texto: {
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink8,
    marginTop: space.s3,
  },
});
