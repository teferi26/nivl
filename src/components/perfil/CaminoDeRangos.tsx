// NIVL · Camino de rangos (Perfil, L3): los seis rangos E…S en una fila.
//
// Sin color (SISTEMA.md §0 y §7). El estado va en la forma:
//   · actual     → nodo invertido (blanco con letra negra). Es la ÚNICA
//                  inversión de la pantalla de Perfil.
//   · alcanzado  → contorno de 2 pt y letra ink9.
//   · por llegar → hairline ink4 y letra ink6.
// Los conectores siguen la misma regla: 2 pt hasta el actual, hairline después.
// Debajo, lo que falta para el siguiente (siguienteRango de progression.ts).

import { Fragment } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ink, stroke, type as tipo } from '@/design/tokens';
import { compararRangos, RANGOS, type EstadoProgreso, type RangoId } from '@/lib/progression';

interface Props {
  rango: RangoId;
  siguiente: EstadoProgreso['siguienteRango'];
}

type EstadoNodo = 'alcanzado' | 'actual' | 'futuro';

function textoSiguiente(s: NonNullable<EstadoProgreso['siguienteRango']>): string {
  const dias =
    s.faltanDias != null && s.faltanDias > 0
      ? `${s.faltanDias} ${s.faltanDias === 1 ? 'día activo' : 'días activos'}`
      : null;
  if (s.faltan <= 0) {
    // El nivel ya llega: el rango espera a los días en la arena.
    return dias ? `${dias} para ${s.nombre}.` : `Nivel listo para ${s.nombre}. Faltan días en la arena.`;
  }
  const niveles = `${s.faltan} ${s.faltan === 1 ? 'nivel' : 'niveles'}`;
  return dias ? `${niveles} y ${dias} para ${s.nombre}.` : `${niveles} para ${s.nombre}.`;
}

export function CaminoDeRangos({ rango, siguiente }: Props) {
  return (
    <View>
      <View style={styles.fila}>
        {RANGOS.map((r, i) => {
          const cmp = compararRangos(r.id, rango);
          const estado: EstadoNodo = cmp < 0 ? 'alcanzado' : cmp === 0 ? 'actual' : 'futuro';
          const etiqueta =
            estado === 'actual' ? 'actual' : estado === 'alcanzado' ? 'alcanzado' : 'por alcanzar';
          return (
            <Fragment key={r.id}>
              {i > 0 ? (
                <View style={[styles.conector, cmp <= 0 ? styles.conectorHecho : styles.conectorFuturo]} />
              ) : null}
              <View
                accessible
                accessibilityRole="text"
                accessibilityLabel={`Rango ${r.id}, ${r.nombre}, ${etiqueta}`}
                style={[
                  styles.nodo,
                  estado === 'actual' && styles.nodoActual,
                  estado === 'alcanzado' && styles.nodoAlcanzado,
                  estado === 'futuro' && styles.nodoFuturo,
                ]}
              >
                <Text
                  allowFontScaling={false}
                  style={[
                    styles.letra,
                    estado === 'actual' && styles.letraActual,
                    estado === 'alcanzado' && styles.letraAlcanzada,
                    estado === 'futuro' && styles.letraFutura,
                  ]}
                >
                  {r.id}
                </Text>
              </View>
            </Fragment>
          );
        })}
      </View>
      <Text maxFontSizeMultiplier={1.35} style={styles.texto}>
        {siguiente ? textoSiguiente(siguiente) : 'Leyenda. No queda rango por encima.'}
      </Text>
    </View>
  );
}

const NODO = 44;
const HUECO = 8;

const styles = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center' },
  conector: { width: HUECO },
  conectorHecho: { height: stroke.rule, backgroundColor: ink.ink9 },
  conectorFuturo: { height: stroke.hairline, backgroundColor: ink.ink4 },
  nodo: { flex: 1, height: NODO, alignItems: 'center', justifyContent: 'center' },
  nodoActual: { backgroundColor: ink.ink10 },
  nodoAlcanzado: { borderWidth: stroke.rule, borderColor: ink.ink9 },
  nodoFuturo: { borderWidth: stroke.hairline, borderColor: ink.ink4 },
  letra: { fontFamily: tipo.rank.family, fontSize: 18 },
  letraActual: { color: ink.ink0 },
  letraAlcanzada: { color: ink.ink9 },
  letraFutura: { color: ink.ink6 },
  texto: {
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink8,
    marginTop: 12,
  },
});
