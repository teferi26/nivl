// NIVL · Resistencia: el detalle de un entreno (puro). Mapa, cifras según el
// deporte, récords, parciales, zonas de pulso y largos si es piscina.

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ErrorSistema } from '@/components/arena';
import { TarjetaHueco } from '@/components/ironmundo/Esqueletos';
import { BotonIron, FilaIron, PantallaIron, TarjetaIron } from '@/components/ironmundo/piezas';
import { C, F, fs, px } from '@/components/ironmundo/tema';
import { fechaIron } from '@/components/ironmundo/textos';
import { Tag } from '@/components/ui';
import { t } from '@/i18n';
import { decimal, miles } from '@/i18n/formato';
import {
  formatoRitmo,
  limitesZonas,
  parcialesDeRuta,
  ritmoSeg100m,
  ritmoSegKm,
  tiempoEnZonas,
  velocidadKmh,
  type ParcialCalc,
  type Record_,
  type Zona,
} from '@/lib/entrenomath';
import type { EntrenoFila, PerfilEntreno } from '@/lib/resistencia';
import { CabeceraResistencia, CifraResistencia, distanciaTexto, duracionTexto, etiquetaDeporte, ritmoTexto } from './HubVista';
import { estilosIron, RotuloIron } from './piezas';
import { RutaMapa } from './RutaMapa';

/** Tope de filas de parciales: una piscina larga no es una pantalla de 150 líneas. */
const MAX_PARCIALES = 40;
const ZONAS: readonly Zona[] = ['Z1', 'Z2', 'Z3', 'Z4', 'Z5'];

export interface DetalleVistaProps {
  cargado: boolean;
  errorCarga: string | null;
  entreno: EntrenoFila | null;
  perfil: PerfilEntreno | null;
  records: readonly Record_[];
  borrando?: boolean;
  acciones: { onVolver: () => void; onReintentar: () => void; onBorrar?: () => void; onIndicarPulso?: () => void };
}

/** El nombre de la marca, en el idioma de la interfaz. */
export function etiquetaRecord(r: Pick<Record_, 'clave' | 'etiqueta'>): string {
  switch (r.clave) {
    case 'distancia_max':
      return t('resistencia:record.distanciaMaxEtiqueta');
    case 'desnivel_max':
      return t('resistencia:record.desnivelMaxEtiqueta');
    case '21k':
      return t('resistencia:record.media');
    case '42k':
      return t('resistencia:record.maraton');
    default:
      return r.etiqueta;
  }
}

/** «5 km · 23:41»; en las marcas de distancia y desnivel, la cifra con su unidad. */
export function textoRecord(r: Record_): string {
  if (r.clave === 'distancia_max') {
    return t('resistencia:record.distanciaMax', { valor: decimal(r.valor_s / 1000, 2) });
  }
  if (r.clave === 'desnivel_max') return t('resistencia:record.desnivelMax', { valor: miles(Math.round(r.valor_s)) });
  return t('resistencia:record.marca', { nombre: etiquetaRecord(r), tiempo: duracionTexto(r.valor_s) });
}

function ritmoParcial(p: ParcialCalc, deporte: EntrenoFila['deporte']): string | null {
  if (p.tipo === 'transicion' || p.distancia_m <= 0) return null;
  if (deporte === 'bici') {
    const v = velocidadKmh(p.distancia_m, p.duracion_s);
    return v === null ? null : t('resistencia:unidad.kmh', { valor: decimal(v, 1) });
  }
  if (p.tipo === 'largo' || deporte === 'piscina' || deporte === 'aguas_abiertas') {
    const r = formatoRitmo(ritmoSeg100m(p.distancia_m, p.duracion_s));
    return r === null ? null : t('resistencia:unidad.por100', { ritmo: r });
  }
  const r = formatoRitmo(ritmoSegKm(p.distancia_m, p.duracion_s));
  return r === null ? null : t('resistencia:unidad.porKm', { ritmo: r });
}

function Parciales({ e }: { e: EntrenoFila }) {
  const lista: ParcialCalc[] = e.parciales.length > 0 ? e.parciales : e.ruta ? parcialesDeRuta(e.ruta, 1000, e.fc_serie ?? null) : [];
  if (lista.length === 0) return null;
  const visibles = lista.slice(0, MAX_PARCIALES);
  return (
    <TarjetaIron>
      <RotuloIron texto={t('resistencia:detalle.parciales')} em={String(lista.length)} />
      <View style={styles.filas}>
        {visibles.map((p, i) => {
          const ritmo = ritmoParcial(p, e.deporte);
          return (
            <FilaIron key={`${p.tipo}-${p.n}-${i}`} primera={i === 0}>
              <Text style={[estilosIron.filaNombre, styles.flex]} numberOfLines={1} maxFontSizeMultiplier={1.35}>
                {t(`resistencia:detalle.parcial.${p.tipo}`, { n: p.n })}
              </Text>
              <Text style={[estilosIron.filaSerie, styles.colTiempo]} maxFontSizeMultiplier={1.35}>
                {duracionTexto(p.duracion_s)}
              </Text>
              <Text style={[estilosIron.filaKg, styles.colRitmo]} maxFontSizeMultiplier={1.35}>
                {ritmo ?? t('ironmundo:sinDato')}
              </Text>
            </FilaIron>
          );
        })}
      </View>
      {lista.length > visibles.length ? (
        <Text style={estilosIron.detalle} maxFontSizeMultiplier={1.35}>
          {t('resistencia:detalle.masParciales', { count: lista.length - visibles.length })}
        </Text>
      ) : null}
    </TarjetaIron>
  );
}

function Zonas({ e, perfil, onIndicarPulso }: { e: EntrenoFila; perfil: PerfilEntreno | null; onIndicarPulso?: () => void }) {
  if (e.fc_media === null && !e.fc_serie) return null;
  const pf = { fc_max: perfil?.fc_max ?? null, fc_reposo: perfil?.fc_reposo ?? null, umbral: perfil?.fc_umbral ?? null };
  const limites = limitesZonas(pf);
  const tiempos = tiempoEnZonas({ fc_serie: e.fc_serie, parciales: e.parciales, duracion_s: e.duracion_s, fc_media: e.fc_media }, pf);
  return (
    <TarjetaIron>
      <RotuloIron texto={t('resistencia:detalle.zonas')} />
      {!tiempos || !limites ? (
        <>
          <Text style={[estilosIron.detalle, styles.arriba]} maxFontSizeMultiplier={1.6}>
            {t('resistencia:detalle.zonasSinPerfil')}
          </Text>
          {onIndicarPulso ? <BotonIron fantasma fino titulo={t('resistencia:detalle.indicarPulso')} onPress={onIndicarPulso} /> : null}
        </>
      ) : (
        <View style={styles.filas}>
          {ZONAS.map((z) => {
            const seg = tiempos[z];
            const tope = Math.max(...ZONAS.map((x) => tiempos[x]), 1);
            const lim = limites.find((l) => l.zona === z);
            return (
              <View
                key={z}
                style={styles.zona}
                accessible
                accessibilityLabel={t('resistencia:detalle.zonaA11y', { zona: z, tiempo: duracionTexto(seg) })}
              >
                <Text style={styles.zonaNombre} maxFontSizeMultiplier={1.2}>
                  {z}
                </Text>
                <View style={styles.zonaBarra}>
                  <View style={[styles.zonaRelleno, { width: `${Math.round((seg / tope) * 100)}%` }]} />
                </View>
                <Text style={styles.zonaTiempo} maxFontSizeMultiplier={1.2}>
                  {duracionTexto(seg)}
                </Text>
                <Text style={styles.zonaRango} numberOfLines={1} maxFontSizeMultiplier={1.2}>
                  {lim ? t('resistencia:detalle.zonaRango', { desde: Math.round(lim.desde), hasta: Math.round(lim.hasta) }) : ''}
                </Text>
              </View>
            );
          })}
        </View>
      )}
    </TarjetaIron>
  );
}

function Largos({ e }: { e: EntrenoFila }) {
  if (e.deporte !== 'piscina') return null;
  const medidos = e.parciales.filter((p) => p.tipo === 'largo').length;
  const largo = e.largo_piscina_m;
  const estimados = largo && e.distancia_m ? Math.round(e.distancia_m / largo) : 0;
  const n = medidos > 0 ? medidos : estimados;
  if (n === 0) return null;
  return (
    <TarjetaIron>
      <RotuloIron texto={t('resistencia:detalle.largos')} />
      <Text style={estilosIron.titulo} maxFontSizeMultiplier={1.35}>
        {largo ? t('resistencia:detalle.largosDe', { count: n, largo }) : t('resistencia:detalle.largosSin', { count: n })}
      </Text>
    </TarjetaIron>
  );
}

export function DetalleVista({ cargado, errorCarga, entreno: e, perfil, records, borrando, acciones }: DetalleVistaProps) {
  if (!cargado || !e) {
    return (
      <PantallaIron>
        <CabeceraResistencia titulo={t('resistencia:detalle.titulo')} onVolver={acciones.onVolver} />
        {errorCarga ? (
          <ErrorSistema compacto mensaje={errorCarga} onReintentar={acciones.onReintentar} />
        ) : cargado ? (
          <TarjetaIron>
            <Text style={estilosIron.cuerpo} maxFontSizeMultiplier={1.6}>
              {t('resistencia:detalle.noExiste')}
            </Text>
          </TarjetaIron>
        ) : (
          <View style={styles.pila} accessibilityRole="progressbar" accessibilityLabel={t('resistencia:detalle.cargandoA11y')}>
            <TarjetaHueco heroe lineas={6} alto={px(210)} />
            <TarjetaHueco lineas={3} />
            <TarjetaHueco lineas={5} />
          </View>
        )}
      </PantallaIron>
    );
  }

  const distancia = distanciaTexto(e.distancia_m, e.deporte);
  const ritmo = ritmoTexto(e.deporte, e.distancia_m, e.duracion_s);
  const cifras = [
    distancia ? { valor: distancia, rotulo: t('resistencia:detalle.distancia') } : null,
    { valor: duracionTexto(e.duracion_s), rotulo: t('resistencia:detalle.duracion') },
    ritmo ? { valor: ritmo, rotulo: e.deporte === 'bici' ? t('resistencia:detalle.velocidad') : t('resistencia:detalle.ritmo') } : null,
  ].filter((c): c is { valor: string; rotulo: string } => c !== null);
  const secundarias = [
    e.desnivel_m !== null ? { valor: t('resistencia:unidad.m', { valor: miles(Math.round(e.desnivel_m)) }), rotulo: t('resistencia:detalle.desnivel') } : null,
    e.fc_media !== null ? { valor: String(Math.round(e.fc_media)), rotulo: t('resistencia:detalle.fcMedia') } : null,
    e.fc_max !== null ? { valor: String(Math.round(e.fc_max)), rotulo: t('resistencia:detalle.fcMax') } : null,
    e.kcal !== null ? { valor: miles(Math.round(e.kcal)), rotulo: t('resistencia:detalle.kcal') } : null,
    e.rpe !== null ? { valor: decimal(e.rpe, Number.isInteger(e.rpe) ? 0 : 1), rotulo: t('resistencia:detalle.rpe') } : null,
  ].filter((c): c is { valor: string; rotulo: string } => c !== null);

  return (
    <PantallaIron>
      <CabeceraResistencia titulo={etiquetaDeporte(e.deporte)} subtitulo={fechaIron(e.fecha)} onVolver={acciones.onVolver} />
      {errorCarga ? <ErrorSistema compacto mensaje={errorCarga} onReintentar={acciones.onReintentar} /> : null}
      {e.ruta && e.ruta.length >= 2 ? <RutaMapa ruta={e.ruta} distanciaTexto={distancia} /> : null}
      <TarjetaIron heroe>
        <RotuloIron texto={t(`resistencia:detalle.origen.${e.origen}`)} />
        <View style={styles.cifras}>
          {cifras.map((c) => (
            <CifraResistencia key={c.rotulo} valor={c.valor} rotulo={c.rotulo} />
          ))}
        </View>
        {secundarias.length > 0 ? (
          <View style={styles.cifrasDos}>
            {secundarias.map((c) => (
              <View key={c.rotulo} style={styles.mitad}>
                <CifraResistencia valor={c.valor} rotulo={c.rotulo} />
              </View>
            ))}
          </View>
        ) : null}
        {records.length > 0 ? (
          <View style={styles.chips} accessibilityLabel={t('resistencia:detalle.recordsA11y')}>
            {records.map((r) => (
              <Tag key={`${r.deporte}-${r.clave}`} tone="logro">
                {textoRecord(r)}
              </Tag>
            ))}
          </View>
        ) : null}
      </TarjetaIron>
      <Largos e={e} />
      <Parciales e={e} />
      <Zonas e={e} perfil={perfil} onIndicarPulso={acciones.onIndicarPulso} />
      {e.notas ? (
        <TarjetaIron>
          <RotuloIron texto={t('resistencia:detalle.notas')} />
          <Text style={[estilosIron.cuerpo, styles.arriba]} maxFontSizeMultiplier={1.6}>
            {e.notas}
          </Text>
        </TarjetaIron>
      ) : null}
      {e.origen === 'manual' && acciones.onBorrar ? (
        <Pressable
          onPress={acciones.onBorrar}
          disabled={borrando}
          accessibilityRole="button"
          accessibilityState={{ disabled: !!borrando, busy: !!borrando }}
          style={styles.borrar}
        >
          <Text style={styles.borrarTexto} maxFontSizeMultiplier={1.35}>
            {t('resistencia:detalle.borrar')}
          </Text>
        </Pressable>
      ) : null}
    </PantallaIron>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  pila: { gap: px(7) },
  arriba: { marginTop: px(5) },
  filas: { marginTop: px(6) },
  colTiempo: { minWidth: px(46), textAlign: 'right' },
  colRitmo: { minWidth: px(72), textAlign: 'right' },
  cifras: { flexDirection: 'row', gap: px(7), marginTop: px(8) },
  cifrasDos: { flexDirection: 'row', flexWrap: 'wrap', marginTop: px(7), marginHorizontal: -px(3.5), rowGap: px(7) },
  mitad: { flexBasis: '33.33%', flexGrow: 1, paddingHorizontal: px(3.5), flexDirection: 'row' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: px(6), marginTop: px(9) },
  zona: { flexDirection: 'row', alignItems: 'center', gap: px(7), paddingVertical: px(4) },
  zonaNombre: { width: px(22), fontFamily: F.b, fontSize: fs(10), color: C.claro },
  zonaBarra: { flex: 1, height: px(6), backgroundColor: C.pista, overflow: 'hidden' },
  zonaRelleno: { height: '100%', backgroundColor: C.blanco },
  zonaTiempo: { minWidth: px(44), textAlign: 'right', fontFamily: F.b, fontSize: fs(10), color: C.blanco },
  zonaRango: { width: px(62), textAlign: 'right', fontFamily: F.r, fontSize: fs(9.5), color: C.mudo },
  borrar: { alignSelf: 'center', minHeight: 44, justifyContent: 'center', paddingHorizontal: px(10) },
  borrarTexto: { fontFamily: F.m, fontSize: fs(10), color: C.mudo, textDecorationLine: 'underline' },
});
