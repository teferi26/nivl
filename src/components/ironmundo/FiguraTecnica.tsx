// NIVL · Mundo IRON: la técnica en trazo, como la lámina 2 (catálogo y
// técnica). Es el MISMO motor de src/iron (esqueletoEn, centroCarga: las
// poses, la biomecánica y el ciclo del ejercicio); aquí solo cambia cómo se
// presenta:
//   · el cuerpo en trazo grueso del acento (lado lejano más tenue), la cabeza
//     llena y la carga como barra con dos discos (o mancuerna);
//   · dos poses fantasma en blanco al 16 % y al 32 % (salida y media bajada);
//   · la flecha discontinua del recorrido, que apunta según la fase;
//   · debajo, las fichas SUBE · BAJA · FONDO con la actual en el acento.
// El encuadre se ajusta a la figura (no al escenario del motor): ocupa el 85 %
// del alto de su caja y va centrada.
// Quieta en `ms` (galería) o con «reducir movimiento» (en la pose clave).

import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Line, Path, Rect } from 'react-native-svg';
import { useMovimientoReducido } from '@/components/ui/motion';
import { t } from '@/i18n';
import { centroCarga, esqueletoEn } from '@/iron/dibujo';
import { SEGMENTOS, type Esqueleto, type Punto } from '@/iron/esqueleto';
import type { Ejercicio } from '@/iron/tipos';
import { faseEn, FASES_TECNICA, msClave, msFantasmas, type FaseTecnica } from './fases';
import { A, C, F, fs, px } from './tema';

export interface FiguraTecnicaProps {
  ejercicio: Ejercicio;
  /** Alto de la caja de la figura (la figura ocupa el 85 %). */
  alto: number;
  /** Ancho disponible (la figura se centra en él). */
  ancho: number;
  ms?: number;
  pausado?: boolean;
  /** Sin las fichas de fase debajo. */
  sinFases?: boolean;
  accessibilityLabel?: string;
}

const PASO_MS = 40;
const GROSOR = 3.4;
const R_CABEZA = 5.2;

/** La carga como trazos: barra con dos discos o mancuerna (en coordenadas del mundo). */
function cargaDe(ej: Ejercicio, e: Esqueleto): { barra: [Punto, Punto]; discos: Punto[]; disco: number } | null {
  if (!ej.carga) return null;
  const c = centroCarga(e, ej.carga, ej.vista);
  if (!c) return null;
  const barra = ej.carga.tipo === 'barra';
  const mancuerna = ej.carga.tipo === 'mancuerna';
  if (!barra && !mancuerna) return null;
  const media = barra ? 15 : 5;
  return {
    barra: [
      { x: c.x - media, y: c.y },
      { x: c.x + media, y: c.y },
    ],
    discos: [
      { x: c.x - media + 1.5, y: c.y },
      { x: c.x + media - 1.5, y: c.y },
    ],
    disco: barra ? 7 : 4,
  };
}

function puntosDe(ej: Ejercicio, e: Esqueleto): Punto[] {
  const out: Punto[] = Object.values(e.p);
  const k = cargaDe(ej, e);
  if (k) out.push(...k.barra.map((p) => ({ x: p.x, y: p.y + k.disco })), ...k.barra.map((p) => ({ x: p.x, y: p.y - k.disco })));
  out.push({ x: e.p.cabeza.x, y: e.p.cabeza.y + R_CABEZA });
  return out;
}

/** El encuadre ajustado a todas las poses del ciclo (y el suelo). */
function encuadreFigura(ej: Ejercicio): { x: number; y: number; w: number; h: number } {
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = 0;
  let y1 = -Infinity;
  const paso = ej.cicloMs / 24;
  for (let ms = 0; ms < ej.cicloMs; ms += paso) {
    for (const p of puntosDe(ej, esqueletoEn(ej, ms))) {
      x0 = Math.min(x0, p.x);
      x1 = Math.max(x1, p.x);
      y0 = Math.min(y0, p.y);
      y1 = Math.max(y1, p.y);
    }
  }
  const m = 4;
  // A la derecha, sitio para la flecha.
  return { x: x0 - m, y: y0 - m, w: x1 - x0 + 2 * m + 14, h: y1 - y0 + 2 * m };
}

function Cuerpo({ ej, e, color, opacidad, grosor }: { ej: Ejercicio; e: Esqueleto; color: string; opacidad: number; grosor: number }) {
  const k = cargaDe(ej, e);
  return (
    <G opacity={opacidad}>
      {SEGMENTOS.filter((s) => s.id !== 'cabeza').map((s) => {
        const a = e.p[s.desde];
        const b = e.p[s.hasta];
        return (
          <Line
            key={s.id}
            x1={a.x}
            y1={-a.y}
            x2={b.x}
            y2={-b.y}
            stroke={color}
            strokeWidth={grosor}
            strokeLinecap="round"
            strokeOpacity={s.lado === 'l' ? 0.45 : 1}
          />
        );
      })}
      <Circle cx={e.p.cabeza.x} cy={-e.p.cabeza.y} r={R_CABEZA} fill={color} />
      {k ? (
        <>
          <Line x1={k.barra[0].x} y1={-k.barra[0].y} x2={k.barra[1].x} y2={-k.barra[1].y} stroke={color} strokeWidth={grosor * 1.05} strokeLinecap="round" />
          {k.discos.map((d, i) => (
            <Rect key={i} x={d.x - 2.4} y={-d.y - k.disco} width={4.8} height={k.disco * 2} rx={1.4} fill={color} />
          ))}
        </>
      ) : null}
    </G>
  );
}

function useMs(ej: Ejercicio, fijo: number | undefined, pausado: boolean): number {
  const reducido = useMovimientoReducido();
  const quieto = fijo !== undefined || reducido;
  const [ms, setMs] = useState(() => fijo ?? msClave(ej));
  useEffect(() => {
    if (quieto || pausado) return;
    const t0 = Date.now() - ms;
    const id = setInterval(() => setMs((Date.now() - t0) % ej.cicloMs), PASO_MS);
    return () => clearInterval(id);
    // `ms` solo marca desde dónde se reanuda.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quieto, pausado, ej]);
  return fijo ?? (reducido ? msClave(ej) : ms);
}

export function FiguraTecnica({ ejercicio: ej, alto, ancho, ms: fijo, pausado = false, sinFases, accessibilityLabel }: FiguraTecnicaProps) {
  const ms = useMs(ej, fijo, pausado);
  const caja = useMemo(() => encuadreFigura(ej), [ej]);
  const fantasmas = useMemo(() => msFantasmas(ej).map((m) => esqueletoEn(ej, m)), [ej]);
  const e = esqueletoEn(ej, ms);
  const fase: FaseTecnica = faseEn(ej, ms);
  const altoFig = alto * 0.85;
  const escala = Math.min(altoFig / caja.h, ancho / caja.w);
  const w = caja.w * escala;
  const h = caja.h * escala;
  const vb = `${caja.x} ${-(caja.y + caja.h)} ${caja.w} ${caja.h}`;
  const xFlecha = caja.x + caja.w - 6;
  const yArriba = caja.y + caja.h * 0.72;
  const yAbajo = caja.y + caja.h * 0.28;
  const baja = fase !== 'sube';

  return (
    <View style={[styles.caja, { height: alto, width: ancho }]}>
      <View style={styles.centro} accessible accessibilityRole="image" accessibilityLabel={accessibilityLabel}>
        <Svg width={w} height={h} viewBox={vb}>
          <Line x1={caja.x + 2} y1={0.5} x2={caja.x + caja.w - 14} y2={0.5} stroke={C.suelo} strokeWidth={1.2} />
          <Cuerpo ej={ej} e={fantasmas[0]!} color={C.blanco} opacidad={0.16} grosor={GROSOR} />
          <Cuerpo ej={ej} e={fantasmas[1]!} color={C.blanco} opacidad={0.32} grosor={GROSOR} />
          <Cuerpo ej={ej} e={e} color={A} opacidad={1} grosor={GROSOR} />
          <Line x1={xFlecha} y1={-yArriba} x2={xFlecha} y2={-yAbajo} stroke={A} strokeWidth={1.3} strokeDasharray="3 3" />
          <Path
            d={
              baja
                ? `M${xFlecha - 3.5} ${-yAbajo - 5} L${xFlecha} ${-yAbajo} L${xFlecha + 3.5} ${-yAbajo - 5}`
                : `M${xFlecha - 3.5} ${-yArriba + 5} L${xFlecha} ${-yArriba} L${xFlecha + 3.5} ${-yArriba + 5}`
            }
            stroke={A}
            strokeWidth={1.3}
            fill="none"
          />
        </Svg>
      </View>
      {sinFases ? null : (
        <View style={styles.fases} accessible accessibilityLabel={t('ironmundo:catalogo.faseA11y', { fase: t(`ironmundo:catalogo.fase.${fase}`) })}>
          {FASES_TECNICA.map((f) => (
            <Text key={f} style={[styles.ficha, f === fase && styles.fichaActual]} maxFontSizeMultiplier={1.2}>
              {t(`ironmundo:catalogo.fase.${f}`).toUpperCase()}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  caja: { justifyContent: 'center' },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  fases: { position: 'absolute', left: 0, bottom: 0, flexDirection: 'row', gap: px(4) },
  ficha: {
    fontFamily: F.xb,
    fontSize: fs(7),
    letterSpacing: fs(7) * 0.14,
    color: C.tenue,
    backgroundColor: C.hueco,
    borderRadius: px(4),
    paddingHorizontal: px(5),
    paddingVertical: px(2),
    overflow: 'hidden',
  },
  fichaActual: { backgroundColor: A, color: C.fondo },
});
