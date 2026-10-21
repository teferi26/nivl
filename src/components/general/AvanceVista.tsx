// NIVL · Modo GENERAL · Avance: lo que nos diferencia, a la vista (pura).
// Dos segmentos en la misma pestaña:
//
//   MÉTRICAS     XP de la semana, cumplimiento y racha en cifras grandes; XP
//                por semana (8 barras); el cumplimiento de 28 días (rejilla);
//                la racha vigente frente a la mejor y el siguiente hito; las
//                cinco estadísticas (FUE, VIT, INT, AGI, PER) y el informe
//                semanal con acceso al informe completo y a cuerpo y metas.
//   PROGRESIÓN   el nivel; el camino de rangos E a S con los días activos
//                reales (sync_rank, progression.ts); los logros y premios; el
//                botín de campañas y los niveles de cada modo.

import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Entrada, formatoMiles, ratioSeguro } from '@/components/arena';
import { textoSiguiente } from '@/components/perfil/CaminoDeRangos';
import { t } from '@/i18n';
import { STAT_ABBR, STAT_LABEL } from '@/lib/game';
import { compararRangos, HITOS_RACHA, RANGO_DIAS, RANGOS } from '@/lib/progression';
import type { DatosAvance } from './derivarAvance';
import {
  BarraGeneral,
  BarrasGeneral,
  BotonGeneral,
  CifraGeneral,
  Escudo,
  FilaCifras,
  FilaGeneral,
  HuecoGeneral,
  PantallaGeneral,
  RotuloGeneral,
  Segmentos,
  TarjetaGeneral,
  textoGeneral,
  TituloGeneral,
} from './piezas';
import { C, F, fs, G, oroA, oroMezcla, px } from './tema';
import type { DatosProgresion } from './useAvanceGeneral';

export type SegmentoAvance = 'metricas' | 'progresion';

export interface AvanceVistaProps {
  segmento: SegmentoAvance;
  onSegmento: (s: SegmentoAvance) => void;
  cargado: boolean;
  error: string | null;
  refrescando: boolean;
  avance: DatosAvance | null;
  informe: string | null;
  progresion: DatosProgresion | null;
  /** ArsenalConectado (niveles por modo, un toque para equipar). */
  arsenal?: ReactNode;
  acciones: {
    onRefrescar: () => void;
    onReintentar: () => void;
    onInforme: () => void;
    onCuerpo: () => void;
    onCampanas: () => void;
  };
}

export function AvanceVista(p: AvanceVistaProps) {
  const listo = p.cargado && !!p.avance && !!p.progresion;
  return (
    <PantallaGeneral refreshing={p.refrescando} onRefresh={p.acciones.onRefrescar}>
      <Entrada indice={0}>
        <TituloGeneral eyebrow={t('general:avance.eyebrow')} titulo={t('general:avance.titulo')} />
      </Entrada>
      <Entrada indice={1}>
        <Segmentos
          opciones={[
            { id: 'metricas', texto: t('general:avance.metricas') },
            { id: 'progresion', texto: t('general:avance.progresion') },
          ]}
          valor={p.segmento}
          alCambiar={p.onSegmento}
        />
      </Entrada>

      {p.error && !listo ? (
        <TarjetaGeneral>
          <RotuloGeneral texto={t('general:hoy.errorRotulo')} />
          <Text style={[textoGeneral.cuerpo, styles.arriba]}>{p.error}</Text>
          <BotonGeneral titulo={t('comun:reintentar')} fantasma fino onPress={p.acciones.onReintentar} />
        </TarjetaGeneral>
      ) : !listo ? (
        <View accessibilityRole="progressbar" accessibilityLabel={t('general:avance.cargandoA11y')} style={styles.huecos}>
          <HuecoGeneral alto={px(70)} />
          <HuecoGeneral alto={px(170)} />
          <HuecoGeneral alto={px(150)} />
        </View>
      ) : p.segmento === 'metricas' ? (
        <Metricas a={p.avance!} informe={p.informe} acciones={p.acciones} />
      ) : (
        <Progresion d={p.progresion!} arsenal={p.arsenal} onCampanas={p.acciones.onCampanas} />
      )}
    </PantallaGeneral>
  );
}

// ── Métricas ─────────────────────────────────────────────────────────

function Metricas({ a, informe, acciones }: { a: DatosAvance; informe: string | null; acciones: AvanceVistaProps['acciones'] }) {
  const ultima = a.semanas.length - 1;
  const etiquetas = a.semanas.map((s, i) => (i === ultima ? t('general:avance.estaSemana') : `${s.inicio.slice(8, 10)}/${s.inicio.slice(5, 7)}`));
  const delta = a.delta === null ? undefined : a.delta >= 0 ? `▲ ${a.delta} %` : `▼ ${Math.abs(a.delta)} %`;
  const hito = HITOS_RACHA.find((h) => h > a.rachaActual) ?? null;
  const maxStat = Math.max(1, ...a.stats.map((s) => s.total));
  return (
    <>
      <Entrada indice={2}>
        <FilaCifras>
          <CifraGeneral icono="flash" rotulo={t('general:avance.xpSemana')} valor={formatoMiles(a.xpSemana)} unidad="XP" nota={delta} />
          <CifraGeneral
            icono="checkmark-done"
            rotulo={t('general:avance.cumplimiento')}
            valor={a.cumplimiento7 === null ? '-' : String(a.cumplimiento7)}
            unidad={a.cumplimiento7 === null ? undefined : '%'}
            nota={t('general:avance.sieteDias')}
          />
          <CifraGeneral icono="flame" rotulo={t('general:avance.racha')} valor={String(a.rachaActual)} nota={t('general:avance.mejor', { n: a.rachaMejor })} />
        </FilaCifras>
      </Entrada>

      <Entrada indice={3}>
        <TarjetaGeneral>
          <RotuloGeneral texto={t('general:avance.xpPorSemana')} em={t('general:avance.ochoSemanas')} />
          <BarrasGeneral
            valores={a.semanas.map((s) => s.xp)}
            etiquetas={etiquetas}
            cifras={a.semanas.map((s) => (s.xp >= 1000 ? `${(s.xp / 1000).toFixed(1).replace('.', ',')}k` : String(s.xp)))}
            resaltar={ultima}
            accessibilityLabel={t('general:avance.xpPorSemanaA11y', { lista: a.semanas.map((s, i) => `${etiquetas[i]}: ${s.xp}`).join(', ') })}
          />
        </TarjetaGeneral>
      </Entrada>

      <Entrada indice={4}>
        <TarjetaGeneral>
          <RotuloGeneral
            texto={t('general:avance.cumplimiento28')}
            em={a.cumplimiento28 === null ? undefined : `${a.cumplimiento28} %`}
          />
          <View style={styles.rejilla} accessible accessibilityLabel={t('general:avance.rejillaA11y', { dias: a.diasActivos28, pct: a.cumplimiento28 ?? 0 })}>
            {a.dias.map((d) => {
              const r = d.programadas > 0 ? Math.min(1, d.hechas / d.programadas) : 0;
              return (
                <View
                  key={d.fecha}
                  style={[
                    styles.celda,
                    d.programadas === 0
                      ? styles.celdaLibre
                      : r >= 1
                        ? styles.celdaLlena
                        : r > 0
                          ? { backgroundColor: oroA(0.18 + 0.5 * r), borderColor: oroA(0.5) }
                          : styles.celdaVacia,
                  ]}
                />
              );
            })}
          </View>
          <View style={styles.leyenda}>
            <Text style={textoGeneral.detalle}>{t('general:avance.diasActivos', { n: a.diasActivos28 })}</Text>
            <View style={styles.leyendaDer}>
              <View style={[styles.punto, styles.celdaVacia]} />
              <Text style={textoGeneral.detalle}>{t('general:avance.nada')}</Text>
              <View style={[styles.punto, styles.celdaLlena]} />
              <Text style={textoGeneral.detalle}>{t('general:avance.todo')}</Text>
            </View>
          </View>
        </TarjetaGeneral>
      </Entrada>

      <Entrada indice={5}>
        <TarjetaGeneral>
          <RotuloGeneral texto={t('general:avance.rachaHistorica')} em={t('general:avance.mejor', { n: a.rachaMejor })} />
          <View style={styles.racha}>
            <Ionicons name="flame" size={px(30)} color={G} />
            <View style={styles.flex}>
              <Text style={styles.rachaCifra}>{t('general:avance.dias', { count: a.rachaActual })}</Text>
              <BarraGeneral ratio={a.rachaMejor > 0 ? a.rachaActual / a.rachaMejor : 0} style={styles.arriba} />
              <Text style={[textoGeneral.detalle, styles.arriba]}>
                {hito ? t('general:avance.hito', { n: hito, faltan: hito - a.rachaActual }) : t('general:avance.hitoMax')}
              </Text>
            </View>
          </View>
        </TarjetaGeneral>
      </Entrada>

      <Entrada indice={6}>
        <TarjetaGeneral>
          <RotuloGeneral texto={t('general:avance.estadisticas')} em={t('general:avance.estaSemanaEm')} />
          {a.stats.map((s, i) => (
            <FilaGeneral key={s.stat} primera={i === 0} accessibilityLabel={t('general:avance.statA11y', { stat: STAT_LABEL[s.stat], total: s.total, semana: s.semana })}>
              <Text style={styles.statAbbr}>{STAT_ABBR[s.stat]}</Text>
              <View style={styles.flex}>
                <Text style={textoGeneral.fila} numberOfLines={1}>
                  {STAT_LABEL[s.stat]}
                </Text>
                <BarraGeneral ratio={s.total / maxStat} alto={3} style={styles.statBarra} />
              </View>
              <View style={styles.statDer}>
                <Text style={styles.statTotal}>{formatoMiles(s.total)}</Text>
                <Text style={textoGeneral.oro}>{s.semana > 0 ? `+${formatoMiles(s.semana)}` : '0'}</Text>
              </View>
            </FilaGeneral>
          ))}
        </TarjetaGeneral>
      </Entrada>

      <Entrada indice={7}>
        <TarjetaGeneral heroe>
          <RotuloGeneral texto={t('general:avance.informe')} em={t('general:avance.sieteDias')} />
          <Text style={[textoGeneral.cuerpo, styles.arriba]} maxFontSizeMultiplier={1.6}>
            {informe ?? ''}
          </Text>
          <View style={styles.botones}>
            <BotonGeneral titulo={t('general:avance.informeCompleto')} icono="document-text-outline" onPress={acciones.onInforme} />
            <BotonGeneral titulo={t('general:avance.cuerpo')} icono="body-outline" fantasma onPress={acciones.onCuerpo} />
          </View>
        </TarjetaGeneral>
      </Entrada>
    </>
  );
}

// ── Progresión ───────────────────────────────────────────────────────

function Progresion({ d, arsenal, onCampanas }: { d: DatosProgresion; arsenal?: ReactNode; onCampanas: () => void }) {
  const e = d.estado;
  const maximo = e.xpSiguiente <= 0;
  const ganados = d.logros.filter((l) => l.ganado).length;
  return (
    <>
      <Entrada indice={2}>
        <TarjetaGeneral heroe>
          <View style={styles.nivel}>
            <Escudo nivel={e.nivel} lado={px(58)} />
            <View style={styles.flex}>
              <Text style={styles.eyebrow}>{t('general:progresion.nivelGlobal')}</Text>
              <Text style={styles.nivelTitulo}>{t('general:progresion.nivel', { nivel: e.nivel })}</Text>
              <BarraGeneral ratio={maximo ? 1 : ratioSeguro(e.xpEnNivel, e.xpSiguiente)} alto={px(5)} style={styles.arriba} />
              <Text style={[textoGeneral.detalle, styles.arriba]}>
                {maximo
                  ? t('general:heroe.xpMax')
                  : t('general:progresion.faltaXp', { xp: formatoMiles(e.xpSiguiente - e.xpEnNivel), nivel: e.nivel + 1 })}
              </Text>
            </View>
          </View>
        </TarjetaGeneral>
      </Entrada>

      <Entrada indice={3}>
        <TarjetaGeneral>
          <RotuloGeneral
            texto={t('general:progresion.camino')}
            em={d.diasActivos === null ? undefined : t('general:progresion.diasActivos', { n: d.diasActivos })}
          />
          {RANGOS.map((r, i) => {
            const cmp = compararRangos(r.id, e.rango);
            const estado = cmp < 0 ? 'ganado' : cmp === 0 ? 'actual' : 'futuro';
            const esSiguiente = e.siguienteRango?.rango === r.id;
            const diasOk = d.diasActivos === null ? null : Math.min(1, ratioSeguro(d.diasActivos, RANGO_DIAS[r.id] || 1));
            return (
              <FilaGeneral
                key={r.id}
                primera={i === 0}
                accessibilityLabel={t('general:progresion.rangoA11y', { rango: r.id, nombre: r.nombre, nivel: r.grados[0], dias: RANGO_DIAS[r.id], estado: t(`general:progresion.estado.${estado}`) })}
              >
                <View style={[styles.letra, estado === 'ganado' && styles.letraGanada, estado === 'actual' && styles.letraActual]}>
                  <Text style={[styles.letraTexto, estado === 'ganado' && styles.letraTextoGanada, estado === 'futuro' && styles.letraTextoFutura]}>{r.id}</Text>
                </View>
                <View style={styles.flex}>
                  <Text style={[textoGeneral.fila, estado === 'futuro' && styles.apagado]} numberOfLines={1}>
                    {r.nombre}
                  </Text>
                  <Text style={textoGeneral.detalle} numberOfLines={1}>
                    {t('general:progresion.requisito', { nivel: r.grados[0], dias: RANGO_DIAS[r.id] })}
                  </Text>
                  {esSiguiente && diasOk !== null ? <BarraGeneral ratio={diasOk} alto={3} style={styles.arriba} /> : null}
                </View>
                {estado === 'ganado' ? (
                  <Ionicons name="checkmark-circle" size={px(16)} color={G} />
                ) : estado === 'actual' ? (
                  <Text style={textoGeneral.oro}>{t('general:progresion.actual', { grado: 'I'.repeat(e.grado) })}</Text>
                ) : null}
              </FilaGeneral>
            );
          })}
          {e.siguienteRango ? <Text style={[textoGeneral.cuerpo, styles.siguiente]}>{textoSiguiente(e.siguienteRango)}</Text> : null}
        </TarjetaGeneral>
      </Entrada>

      <Entrada indice={4}>
        <RotuloGeneral texto={t('general:progresion.logros')} em={t('general:progresion.deTotal', { n: ganados, total: d.logros.length })} seccion />
        <View style={styles.logros}>
          {d.logros.map((l) => (
            <View key={l.code} style={[styles.logro, l.ganado && styles.logroGanado]} accessible accessibilityLabel={t('general:progresion.logroA11y', { nombre: l.nombre, desc: l.desc, estado: l.ganado ? t('general:progresion.ganado') : t('general:progresion.pendiente') })}>
              <Ionicons name={l.ganado ? 'trophy' : 'lock-closed-outline'} size={px(18)} color={l.ganado ? G : C.apagado} />
              <Text style={[styles.logroNombre, !l.ganado && styles.apagado]} numberOfLines={2} maxFontSizeMultiplier={1.25}>
                {l.nombre}
              </Text>
              {l.titulo ? (
                <Text style={styles.logroTitulo} numberOfLines={1} maxFontSizeMultiplier={1.25}>
                  {t('general:progresion.titulo', { titulo: l.titulo })}
                </Text>
              ) : null}
            </View>
          ))}
        </View>
      </Entrada>

      <Entrada indice={5}>
        <TarjetaGeneral>
          <RotuloGeneral texto={t('general:progresion.botin')} em={t('general:progresion.botinXp', { xp: formatoMiles(d.botinTotal) })} />
          {d.botin.length === 0 ? (
            <>
              <Text style={[textoGeneral.cuerpo, styles.arriba]}>{t('general:progresion.botinVacio', { count: d.abiertas })}</Text>
              <BotonGeneral titulo={t('general:progresion.irCampanas')} fantasma fino icono="flag-outline" onPress={onCampanas} />
            </>
          ) : (
            d.botin.slice(0, 8).map((b, i) => (
              <FilaGeneral key={b.id} primera={i === 0}>
                <View style={[styles.letra, styles.letraGanada]}>
                  <Text style={[styles.letraTexto, styles.letraTextoGanada]}>{b.rango}</Text>
                </View>
                <Text style={[textoGeneral.fila, styles.flex]} numberOfLines={1}>
                  {b.titulo}
                </Text>
                <Text style={textoGeneral.oro}>{`+${formatoMiles(b.xp)} XP`}</Text>
              </FilaGeneral>
            ))
          )}
        </TarjetaGeneral>
      </Entrada>

      {arsenal ? <Entrada indice={6}>{arsenal}</Entrada> : null}
    </>
  );
}

const LADO_LETRA = px(30);

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  arriba: { marginTop: px(6) },
  apagado: { color: C.apagado },
  huecos: { gap: px(9) },
  eyebrow: { fontFamily: F.b, fontSize: fs(8.5), letterSpacing: fs(8.5) * 0.18, color: C.meta, textTransform: 'uppercase' },
  rejilla: { flexDirection: 'row', flexWrap: 'wrap', gap: px(5), marginTop: px(10) },
  celda: { width: `${(100 - 6 * 2.2) / 7}%`, aspectRatio: 1, borderRadius: px(6), borderWidth: 1 },
  celdaLibre: { backgroundColor: 'transparent', borderColor: C.regla, borderStyle: 'dashed' },
  celdaVacia: { backgroundColor: C.hueco, borderColor: C.filete },
  celdaLlena: { backgroundColor: G, borderColor: G },
  leyenda: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: px(9), gap: px(8) },
  leyendaDer: { flexDirection: 'row', alignItems: 'center', gap: px(4) },
  punto: { width: px(9), height: px(9), borderRadius: px(3), borderWidth: 1 },
  racha: { flexDirection: 'row', alignItems: 'center', gap: px(12), marginTop: px(8) },
  rachaCifra: { fontFamily: F.xb, fontSize: fs(20), color: C.blanco },
  statAbbr: { width: px(34), fontFamily: F.xb, fontSize: fs(10.5), letterSpacing: 1, color: G },
  statBarra: { marginTop: px(5) },
  statDer: { alignItems: 'flex-end', minWidth: px(54) },
  statTotal: { fontFamily: F.b, fontSize: fs(12), color: C.blanco },
  botones: { gap: px(2) },
  nivel: { flexDirection: 'row', alignItems: 'center', gap: px(14) },
  nivelTitulo: { fontFamily: 'Cinzel_900Black', fontSize: fs(19), letterSpacing: 1, color: C.blanco, marginTop: px(2) },
  letra: { width: LADO_LETRA, height: LADO_LETRA, borderRadius: px(8), borderWidth: 1, borderColor: C.borde, alignItems: 'center', justifyContent: 'center' },
  letraGanada: { backgroundColor: G, borderColor: G },
  letraActual: { borderColor: G, borderWidth: 2, backgroundColor: oroMezcla(0.14, C.fondo) },
  letraTexto: { fontFamily: 'Cinzel_900Black', fontSize: fs(13), color: G },
  letraTextoGanada: { color: C.fondo },
  letraTextoFutura: { color: C.apagado },
  siguiente: { marginTop: px(8), paddingTop: px(8), borderTopWidth: 1, borderTopColor: C.regla },
  logros: { flexDirection: 'row', flexWrap: 'wrap', gap: px(7), marginTop: px(6) },
  logro: {
    flexBasis: '30%',
    flexGrow: 1,
    minHeight: px(84),
    borderRadius: px(13),
    borderWidth: 1,
    borderColor: C.filete,
    backgroundColor: C.tarjeta,
    alignItems: 'center',
    justifyContent: 'center',
    gap: px(4),
    padding: px(6),
  },
  logroGanado: { borderColor: oroA(0.45), backgroundColor: oroMezcla(0.08, C.tarjeta) },
  logroNombre: { fontFamily: F.sb, fontSize: fs(9.5), lineHeight: Math.round(fs(9.5) * 1.25), color: C.texto, textAlign: 'center' },
  logroTitulo: { fontFamily: F.b, fontSize: fs(8), color: G, textAlign: 'center' },
});
