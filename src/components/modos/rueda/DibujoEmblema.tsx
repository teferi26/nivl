// NIVL · Modos: el dibujo del emblema (sin gesto). Lo pintan el emblema de
// verdad (EmblemaModo), su copia nítida sobre la rueda abierta (RuedaModos) y
// la galería /kit/rueda.
//
//   · 'disco' (lámina 1, cuadro 01, y la barra de la lámina 4): círculo negro
//     con el aro del acento de 2 pt, halo de 16 pt al 45 % y un anillo negro de
//     4 pt; los cuatro puntos de los modos (5 pt, al 85 %, brillo corto) centrados
//     sobre el filo exterior, cada uno donde vive su modo en la rueda.
//   · 'placa' (cabecera del mundo, lámina 2): la placa redondeada con el
//     acento al 14 % de fondo, filo del acento y halo.
//   · Al mantener, el anillo de carga abraza el disco: 5 pt de aire y 4 pt de
//     trazo, extremos redondos y halo.

import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedProps, type SharedValue } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { acentoRueda, ink } from '@/design/tokens';
import { ANGULO_MODO, puntoEn } from '@/modos/rueda';
import { MODOS_ETIQUETA, type ModoId } from '@/modos/tipos';
import { conAlfa, halo, mezcla } from './color';
import { GlifoModo } from './GlifoModo';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export type FormaEmblema = 'disco' | 'placa';

/** Aire entre el disco y el anillo de carga, y su grosor. */
const AIRE_CARGA = 5;
const TRAZO_CARGA = 4;
/** Diámetro de los puntos de los modos. */
const PUNTO = 5;

export interface DibujoEmblemaProps {
  forma: FormaEmblema;
  tamano: number;
  modo: ModoId;
  disponibles: readonly ModoId[];
  /** 0 a 1 mientras se mantiene (el anillo de carga). */
  carga?: SharedValue<number>;
}

export function DibujoEmblema({ forma, tamano, modo, disponibles, carga }: DibujoEmblemaProps) {
  const acento = acentoRueda[modo];
  const rCarga = tamano / 2 + AIRE_CARGA + TRAZO_CARGA / 2;
  const lienzo = Math.ceil(2 * (rCarga + TRAZO_CARGA));
  const c = lienzo / 2;
  const circunferencia = 2 * Math.PI * rCarga;
  const fuera = (lienzo - tamano) / 2;
  const propsCarga = useAnimatedProps(() => {
    const v = carga ? carga.value : 0;
    return { strokeDashoffset: circunferencia * (1 - v), strokeOpacity: v > 0.01 ? 1 : 0 };
  });

  return (
    <View style={{ width: tamano, height: tamano }} pointerEvents="none">
      {forma === 'disco' ? (
        <>
          <View
            style={[
              styles.disco,
              {
                width: tamano,
                height: tamano,
                borderRadius: tamano / 2,
                borderColor: acento,
                boxShadow: halo(acento, 16, 0.45, { ancho: 4, color: ink.ink0 }),
              },
            ]}
          >
            <GlifoModo modo={modo} tamano={Math.round(tamano * 0.5)} color={acento} trazo={1.9} />
          </View>
          {MODOS_ETIQUETA.map((m) => {
            // Sobre el filo exterior del disco (aro negro de 4 pt incluido), como la lámina.
            const p = puntoEn(tamano / 2, tamano / 2, tamano / 2 + 3, ANGULO_MODO[m]);
            const color = disponibles.includes(m) ? acentoRueda[m] : ink.ink4;
            const encendido = disponibles.includes(m);
            return (
              <View
                key={m}
                style={[
                  styles.punto,
                  {
                    left: p.x - PUNTO / 2,
                    top: p.y - PUNTO / 2,
                    backgroundColor: color,
                    opacity: 0.85,
                    boxShadow: encendido ? `0px 0px 3px ${conAlfa(color, 0.8)}` : undefined,
                  },
                ]}
              />
            );
          })}
        </>
      ) : (
        <View
          style={[
            styles.placa,
            {
              width: tamano,
              height: tamano,
              borderRadius: Math.round(tamano * 0.27),
              borderColor: acento,
              backgroundColor: mezcla(acento, 0.14),
              boxShadow: halo(acento, 16, 0.45),
            },
          ]}
        >
          <GlifoModo modo={modo} tamano={Math.round(tamano * 0.5)} color={acento} />
        </View>
      )}
      <View style={[styles.carga, { left: -fuera, top: -fuera, width: lienzo, height: lienzo }]}>
        <Svg width={lienzo} height={lienzo}>
          <AnimatedCircle
            cx={c}
            cy={c}
            r={rCarga}
            fill="none"
            stroke={acento}
            strokeWidth={TRAZO_CARGA}
            strokeLinecap="round"
            strokeDasharray={`${circunferencia} ${circunferencia}`}
            transform={`rotate(-90 ${c} ${c})`}
            animatedProps={propsCarga}
          />
        </Svg>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  disco: { backgroundColor: ink.ink0, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  placa: { borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  carga: { position: 'absolute' },
  punto: { position: 'absolute', width: PUNTO, height: PUNTO, borderRadius: PUNTO / 2 },
});
