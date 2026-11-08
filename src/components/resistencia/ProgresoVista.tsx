// NIVL · Resistencia: el progreso (pura). Curva de forma y fatiga, volumen
// semanal por disciplina, peso y récords. Sin color: lo que distingue una
// disciplina de otra es el relleno (sólido, gris, trama, filete). Los efectos,
// en useProgreso; `datosProgreso` hace las cuentas para la pantalla y la galería.

import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, Line, Pattern, Rect } from 'react-native-svg';
import { ErrorSistema } from '@/components/arena';
import { GlifoIron } from '@/components/ironmundo/Glifos';
import { FilaIron, HuecoIron, LineaAncha, PantallaIron, TarjetaIron } from '@/components/ironmundo/piezas';
import { C, F, fs, M, px } from '@/components/ironmundo/tema';
import { EmptyState } from '@/components/ui';
import { t } from '@/i18n';
import { decimal, fechaCorta, miles } from '@/i18n/formato';
import {
  cargaSesion,
  estadoForma,
  serieCarga,
  volumenSemanal,
  type DiaCarga,
  type EstadoForma,
  type PerfilCarga,
  type SesionCarga,
} from '@/lib/cargamath';
import type { Record_ } from '@/lib/entrenomath';
import { GraficaForma } from './GraficaForma';
import { minutosTexto } from './CarreraVista';
import { etiquetaRecord } from './DetalleVista';
import { estilosIron, RotuloIron } from './piezas';

export type GrupoVolumen = 'natacion' | 'bici' | 'carrera' | 'otros';
const GRUPOS: readonly GrupoVolumen[] = ['natacion', 'bici', 'carrera', 'otros'];

export interface SemanaVolumen {
  semana: string;
  total_s: number;
  porGrupo: Record<GrupoVolumen, { duracion_s: number; distancia_m: number }>;
}

export interface PesoVista {
  fecha: string;
  kg: number;
}

export type SesionProgreso = SesionCarga & { distancia_m: number | null };

export interface FormaVista {
  estado: EstadoForma;
  ctl: number;
  atl: number;
  tsb: number;
  acwr: number | null;
  rampa: number | null;
}

export interface DatosProgreso {
  serie: DiaCarga[];
  forma: FormaVista;
  volumen: SemanaVolumen[];
  pesos: PesoVista[];
}

/** Días de curva que se ven: 16 semanas. */
export const DIAS_CURVA = 112;
export const SEMANAS_VOLUMEN = 8;

function grupoDe(deporte: string): GrupoVolumen {
  if (deporte === 'piscina' || deporte === 'aguas_abiertas') return 'natacion';
  return deporte === 'bici' || deporte === 'carrera' ? deporte : 'otros';
}

/** Las cuentas de la pantalla. Todo sale de los módulos puros de carga. */
export function datosProgreso(sesiones: readonly SesionProgreso[], perfil: PerfilCarga, pesos: readonly PesoVista[], hoy: string): DatosProgreso {
  const cargas = sesiones.map((s) => ({ fecha: s.fecha, carga: cargaSesion(s, perfil) }));
  const serie = serieCarga(cargas, hoy, DIAS_CURVA);
  const volumen = volumenSemanal(sesiones.slice(), hoy, SEMANAS_VOLUMEN).map((v): SemanaVolumen => {
    const porGrupo = Object.fromEntries(GRUPOS.map((g) => [g, { duracion_s: 0, distancia_m: 0 }])) as SemanaVolumen['porGrupo'];
    for (const [deporte, d] of Object.entries(v.porDeporte)) {
      const g = porGrupo[grupoDe(deporte)];
      g.duracion_s += d.duracion_s;
      g.distancia_m += d.distancia_m;
    }
    return { semana: v.semana, total_s: v.total_s, porGrupo };
  });
  return { serie, forma: estadoForma(serie), volumen, pesos: pesos.slice() };
}

export interface ProgresoVistaProps extends DatosProgreso {
  estado: 'cargando' | 'error' | 'listo';
  error: string | null;
  records: Record_[];
  /** Los récords se calculan aparte: su fallo no tumba la pantalla. */
  recordsEstado: 'cargando' | 'error' | 'listo';
  refreshing: boolean;
  onRefresh: () => void;
  onReintentar: () => void;
  onVolver: () => void;
  onRegistrar: () => void;
  onVerEntreno: (id: string) => void;
  overlay?: ReactNode;
}

function signo(n: number): string {
  return n > 0 ? `+${decimal(n)}` : decimal(n);
}

/** La carga en frases: los ratios tal cual no le dicen nada a nadie. */
function frasesCarga(f: FormaVista): string[] {
  const frases: string[] = [];
  if (f.acwr !== null) frases.push(t('resistenciaPlan:progreso.acwrFrase', { valor: decimal(f.acwr, 1) }));
  if (f.rampa !== null) {
    const puntos = Math.round(Math.abs(f.rampa));
    frases.push(
      puntos === 0
        ? t('resistenciaPlan:progreso.rampaIgual')
        : t(f.rampa > 0 ? 'resistenciaPlan:progreso.rampaSube' : 'resistenciaPlan:progreso.rampaBaja', { valor: puntos }),
    );
  }
  return frases;
}

function tiempoTexto(segundos: number): string {
  const s = Math.round(segundos);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const seg = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${seg}` : `${m}:${seg}`;
}

/** Un récord: tiempo, salvo la distancia más larga y el mayor desnivel, que son metros. */
export function valorRecord(r: Pick<Record_, 'clave' | 'valor_s'>): string {
  if (r.clave === 'desnivel_max') return t('resistenciaPlan:unidad.m', { valor: decimal(r.valor_s) });
  if (r.clave === 'distancia_max') {
    return r.valor_s < 1000 ? t('resistenciaPlan:unidad.m', { valor: decimal(r.valor_s) }) : t('resistenciaPlan:unidad.km', { valor: decimal(r.valor_s / 1000, 1) });
  }
  return tiempoTexto(r.valor_s);
}

function Cabecera({ onVolver }: { onVolver: () => void }) {
  return (
    <View style={styles.cabecera}>
      <Pressable onPress={onVolver} hitSlop={12} accessibilityRole="button" accessibilityLabel={t('ironmundo:volver')} style={styles.atras}>
        <GlifoIron nombre="atras" lado={px(18)} color={C.mudo} grosor={2.2} />
      </Pressable>
      <View style={styles.flex}>
        <Text style={styles.titulo} accessibilityRole="header" maxFontSizeMultiplier={1.2}>
          {t('resistenciaPlan:progreso.titulo')}
        </Text>
        <Text style={styles.subtitulo} numberOfLines={1} maxFontSizeMultiplier={1.35}>
          {t('resistenciaPlan:progreso.sub')}
        </Text>
      </View>
    </View>
  );
}

function Cifra({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <View
      style={styles.cifra}
      accessible
      // i18n-ok
      accessibilityLabel={`${rotulo}: ${valor}`}
    >
      <Text style={estilosIron.kg} numberOfLines={1} adjustsFontSizeToFit maxFontSizeMultiplier={1}>
        {valor}
      </Text>
      <Text style={estilosIron.detalle} numberOfLines={1} maxFontSizeMultiplier={1.35}>
        {rotulo}
      </Text>
    </View>
  );
}

const ALTO_VOLUMEN = 110;
const TRAMA_VOLUMEN = 'tramaVolumen';

function relleno(g: GrupoVolumen): { fill: string; stroke?: string } {
  switch (g) {
    case 'bici':
      return { fill: C.blanco };
    case 'carrera':
      return { fill: C.mudo };
    case 'natacion':
      return { fill: `url(#${TRAMA_VOLUMEN})`, stroke: C.suave };
    case 'otros':
      return { fill: 'none', stroke: C.suave };
  }
}

function TramaVolumen({ id = TRAMA_VOLUMEN }: { id?: string }) {
  return (
    <Defs>
      <Pattern id={id} patternUnits="userSpaceOnUse" width={4} height={4} patternTransform="rotate(45)">
        <Line x1={0} y1={0} x2={0} y2={4} stroke={C.suave} strokeWidth={1.2} />
      </Pattern>
    </Defs>
  );
}

function GraficaVolumen({ volumen }: { volumen: SemanaVolumen[] }) {
  const [ancho, setAncho] = useState(0);
  const maximo = Math.max(1, ...volumen.map((v) => v.total_s));
  const hueco = 6;
  const columna = volumen.length > 0 ? Math.max(4, (ancho - hueco * (volumen.length - 1)) / volumen.length) : 0;
  const ultima = volumen[volumen.length - 1];
  return (
    <View
      style={{ height: ALTO_VOLUMEN }}
      accessible
      accessibilityRole="image"
      accessibilityLabel={ultima ? t('resistenciaPlan:progreso.volumenA11y', { duracion: minutosTexto(ultima.total_s / 60) }) : undefined}
      onLayout={(ev) => setAncho(Math.floor(ev.nativeEvent.layout.width))}
    >
      {ancho > 0 ? (
        <Svg width={ancho} height={ALTO_VOLUMEN} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <TramaVolumen />
          {volumen.map((v, i) => {
            let y = ALTO_VOLUMEN;
            return GRUPOS.map((g) => {
              const seg = v.porGrupo[g].duracion_s;
              if (seg <= 0) return null;
              const alto = (seg / maximo) * (ALTO_VOLUMEN - 4);
              y -= alto;
              return <Rect key={`${v.semana}-${g}`} x={i * (columna + hueco)} y={y} width={columna} height={Math.max(1, alto - 1)} {...relleno(g)} />;
            });
          })}
        </Svg>
      ) : null}
    </View>
  );
}

function FechasVolumen({ volumen }: { volumen: SemanaVolumen[] }) {
  const primera = volumen[0];
  const ultima = volumen[volumen.length - 1];
  if (!primera || !ultima) return null;
  return (
    <View style={styles.fechas}>
      <Text style={styles.leyendaTexto} maxFontSizeMultiplier={1.35}>
        {fechaCorta(primera.semana)}
      </Text>
      <Text style={styles.leyendaTexto} maxFontSizeMultiplier={1.35}>
        {fechaCorta(ultima.semana)}
      </Text>
    </View>
  );
}

function LeyendaVolumen() {
  return (
    <View style={styles.leyenda} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {GRUPOS.map((g) => (
        <View key={g} style={styles.leyendaEntrada}>
          <Svg width={10} height={10}>
            <TramaVolumen id={`${TRAMA_VOLUMEN}-${g}`} />
            <Rect x={0} y={0} width={10} height={10} {...(g === 'natacion' ? { fill: `url(#${TRAMA_VOLUMEN}-${g})`, stroke: C.suave } : relleno(g))} />
          </Svg>
          <Text style={styles.leyendaTexto} maxFontSizeMultiplier={1.35}>
            {t(`resistenciaPlan:grupo.${g}`)}
          </Text>
        </View>
      ))}
    </View>
  );
}

function distanciaGrupo(g: GrupoVolumen, metros: number): string {
  if (metros <= 0 || g === 'otros') return '';
  return g === 'natacion' ? t('resistenciaPlan:unidad.m', { valor: miles(metros) }) : t('resistenciaPlan:unidad.km', { valor: decimal(metros / 1000, 1) });
}

function Records({ records, estado, onVerEntreno }: Pick<ProgresoVistaProps, 'records' | 'onVerEntreno'> & { estado: ProgresoVistaProps['recordsEstado'] }) {
  if (estado === 'cargando') return <HuecoIron alto={px(150)} />;
  if (estado === 'error' || records.length === 0) {
    return (
      <TarjetaIron>
        <RotuloIron texto={t('resistenciaPlan:progreso.records')} />
        <Text style={[estilosIron.detalle, styles.arriba]} maxFontSizeMultiplier={1.6}>
          {estado === 'error' ? t('resistenciaPlan:progreso.recordsError') : t('resistenciaPlan:progreso.recordsVacio')}
        </Text>
      </TarjetaIron>
    );
  }
  const deportes = [...new Set(records.map((r) => r.deporte))];
  return (
    <>
      {deportes.map((d) => (
        <TarjetaIron key={d}>
          <RotuloIron texto={t('resistenciaPlan:progreso.recordsDe', { deporte: nombreDeporte(d) })} />
          {records
            .filter((r) => r.deporte === d)
            .map((r, i) => (
              <FilaIron
                key={`${r.deporte}-${r.clave}`}
                primera={i === 0}
                style={styles.filaRecord}
                onPress={() => onVerEntreno(r.entreno_id)}
                // i18n-ok
                accessibilityLabel={`${etiquetaRecord(r)}: ${valorRecord(r)}. ${fechaCorta(r.fecha)}`}
              >
                <Text style={[estilosIron.filaNombre, styles.flex]} numberOfLines={1} maxFontSizeMultiplier={1.5}>
                  {etiquetaRecord(r)}
                </Text>
                <Text style={estilosIron.filaSerie} maxFontSizeMultiplier={1.35}>
                  {fechaCorta(r.fecha)}
                </Text>
                <Text style={[estilosIron.filaKg, styles.valor]} numberOfLines={1} maxFontSizeMultiplier={1.35}>
                  {valorRecord(r)}
                </Text>
              </FilaIron>
            ))}
        </TarjetaIron>
      ))}
    </>
  );
}

function nombreDeporte(d: string): string {
  switch (d) {
    case 'carrera':
    case 'bici':
    case 'natacion':
    case 'fuerza':
      return t(`resistenciaPlan:deporte.${d}`);
    default:
      return t('resistenciaPlan:deporte.otro');
  }
}

export function ProgresoVista(p: ProgresoVistaProps) {
  if (p.estado === 'cargando') {
    return (
      <PantallaIron overlay={p.overlay}>
        <Cabecera onVolver={p.onVolver} />
        <View accessibilityRole="progressbar" accessibilityLabel={t('resistenciaPlan:progreso.cargandoA11y')} style={styles.huecos}>
          <HuecoIron alto={px(90)} />
          <HuecoIron alto={px(230)} />
          <HuecoIron alto={px(170)} />
        </View>
      </PantallaIron>
    );
  }

  if (p.estado === 'error') {
    return (
      <PantallaIron overlay={p.overlay}>
        <Cabecera onVolver={p.onVolver} />
        <ErrorSistema mensaje={p.error ?? ''} onReintentar={p.onReintentar} />
      </PantallaIron>
    );
  }

  if (p.forma.estado === 'sin_datos') {
    return (
      <PantallaIron overlay={p.overlay} refreshing={p.refreshing} onRefresh={p.onRefresh}>
        <Cabecera onVolver={p.onVolver} />
        {p.error ? <ErrorSistema compacto mensaje={p.error} onReintentar={p.onReintentar} /> : null}
        <EmptyState
          icon="pulse-outline"
          title={t('resistenciaPlan:progreso.vacioTitulo')}
          body={t('resistenciaPlan:progreso.vacioCuerpo')}
          action={{ label: t('resistenciaPlan:progreso.registrar'), onPress: p.onRegistrar, variant: 'solid' }}
        />
      </PantallaIron>
    );
  }

  const estaSemana = p.volumen[p.volumen.length - 1];
  const ultimoPeso = p.pesos[p.pesos.length - 1];
  const primerPeso = p.pesos[0];
  const cambioPeso = ultimoPeso && primerPeso && p.pesos.length > 1 ? ultimoPeso.kg - primerPeso.kg : null;

  return (
    <PantallaIron overlay={p.overlay} refreshing={p.refreshing} onRefresh={p.onRefresh}>
      <Cabecera onVolver={p.onVolver} />
      {p.error ? <ErrorSistema compacto mensaje={p.error} onReintentar={p.onReintentar} /> : null}

      <TarjetaIron heroe>
        <RotuloIron texto={t('resistenciaPlan:progreso.forma')} />
        <Text style={estilosIron.titulo} maxFontSizeMultiplier={1.35}>
          {t(`resistencia:forma.estado.${p.forma.estado}`)}
        </Text>
        <Text style={[estilosIron.cuerpo, styles.arriba]} maxFontSizeMultiplier={1.6}>
          {t(`resistenciaPlan:estadoFrase.${p.forma.estado}`)}
        </Text>
        <View style={styles.cifras}>
          <Cifra rotulo={t('resistenciaPlan:progreso.ctl')} valor={decimal(p.forma.ctl)} />
          <Cifra rotulo={t('resistenciaPlan:progreso.atl')} valor={decimal(p.forma.atl)} />
          <Cifra rotulo={t('resistenciaPlan:progreso.tsb')} valor={signo(p.forma.tsb)} />
        </View>
        <Text style={[estilosIron.detalle, styles.arriba]} maxFontSizeMultiplier={1.6}>
          {t('resistenciaPlan:progreso.explicacion')}
        </Text>
        {frasesCarga(p.forma).map((frase) => (
          <Text key={frase} style={[estilosIron.detalle, styles.arriba]} maxFontSizeMultiplier={1.6}>
            {frase}
          </Text>
        ))}
      </TarjetaIron>

      <TarjetaIron>
        <RotuloIron texto={t('resistenciaPlan:progreso.curva')} em={t('resistenciaPlan:progreso.curvaSemanas', { n: Math.round(DIAS_CURVA / 7) })} style={styles.bajo} />
        <GraficaForma serie={p.serie} />
        <Text style={[estilosIron.detalle, styles.arriba]} maxFontSizeMultiplier={1.6}>
          {t('resistenciaPlan:progreso.orientativo')}
        </Text>
      </TarjetaIron>

      <TarjetaIron>
        <RotuloIron
          texto={t('resistenciaPlan:progreso.volumen')}
          em={estaSemana ? t('resistenciaPlan:progreso.estaSemana', { duracion: minutosTexto(estaSemana.total_s / 60) }) : undefined}
          style={styles.bajo}
        />
        <GraficaVolumen volumen={p.volumen} />
        <FechasVolumen volumen={p.volumen} />
        <LeyendaVolumen />
        {estaSemana
          ? GRUPOS.filter((g) => estaSemana.porGrupo[g].duracion_s > 0).map((g, i) => (
              <FilaIron key={g} primera={i === 0} style={i === 0 ? styles.primeraFila : undefined}>
                <Text style={[estilosIron.filaNombre, styles.flex]} numberOfLines={1} maxFontSizeMultiplier={1.5}>
                  {t(`resistenciaPlan:grupo.${g}`)}
                </Text>
                <Text style={estilosIron.filaSerie} maxFontSizeMultiplier={1.35}>
                  {distanciaGrupo(g, estaSemana.porGrupo[g].distancia_m)}
                </Text>
                <Text style={estilosIron.filaKg} maxFontSizeMultiplier={1.35}>
                  {minutosTexto(estaSemana.porGrupo[g].duracion_s / 60)}
                </Text>
              </FilaIron>
            ))
          : null}
      </TarjetaIron>

      {ultimoPeso ? (
        <TarjetaIron>
          <RotuloIron texto={t('resistenciaPlan:progreso.peso')} em={fechaCorta(ultimoPeso.fecha)} style={styles.bajo} />
          <View style={styles.pesoCifras}>
            <Text style={estilosIron.kg} maxFontSizeMultiplier={1}>
              {decimal(ultimoPeso.kg, 1)} <Text style={estilosIron.kgUnidad}>{t('resistenciaPlan:unidad.kg')}</Text>
            </Text>
            {cambioPeso !== null ? (
              <Text style={estilosIron.detalle} maxFontSizeMultiplier={1.35}>
                {t('resistenciaPlan:progreso.pesoCambio', { valor: cambioPeso > 0 ? `+${decimal(cambioPeso, 1)}` : decimal(cambioPeso, 1) })}
              </Text>
            ) : null}
          </View>
          {p.pesos.length > 1 ? <LineaAncha puntos={p.pesos.map((x) => x.kg)} alto={px(44)} /> : null}
        </TarjetaIron>
      ) : null}

      <Records records={p.records} estado={p.recordsEstado} onVerEntreno={p.onVerEntreno} />
    </PantallaIron>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: px(9), paddingTop: px(4), marginBottom: px(2) },
  atras: { paddingVertical: px(4) },
  titulo: { fontFamily: F.cinzel, fontSize: fs(16), letterSpacing: fs(16) * 0.08, color: C.blanco },
  subtitulo: { fontFamily: F.m, fontSize: fs(9.5), letterSpacing: fs(9.5) * 0.06, color: C.mudo, marginTop: px(2) },
  huecos: { gap: M.hueco },
  arriba: { marginTop: px(6) },
  bajo: { marginBottom: px(8) },
  cifras: { flexDirection: 'row', gap: px(8), marginTop: px(10) },
  cifra: { flex: 1, minWidth: 0 },
  fechas: { flexDirection: 'row', justifyContent: 'space-between', marginTop: px(2) },
  leyenda: { flexDirection: 'row', flexWrap: 'wrap', gap: px(12), marginTop: px(8) },
  leyendaEntrada: { flexDirection: 'row', alignItems: 'center', gap: px(5) },
  leyendaTexto: { fontFamily: F.m, fontSize: fs(9.5), color: C.mudo },
  primeraFila: { marginTop: px(6) },
  filaRecord: { minHeight: 44 },
  valor: { minWidth: px(54), textAlign: 'right' },
  pesoCifras: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: px(4) },
});
