// NIVL · Mundo IRON: la técnica de un ejercicio (/iron/[id]) en la piel de la
// lámina 2 (la tarjeta «Técnica · bucle animado» del catálogo, a pantalla).
// Pura: el ejercicio, su historial y volver llegan por props.
//
// De arriba abajo: la cabecera (‹ TÉCNICA, grupo y nivel, el emblema), la
// tarjeta héroe con el maniquí en bucle (Pausar), el nombre y las consignas
// numeradas; tu historial (la carga de la próxima, la mejor marca, la gráfica
// y las últimas sesiones); los músculos (mapa delante y detrás) y los errores
// comunes. Aquí se mira: la única acción es pausar.

import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { DescargoSalud } from '@/components/DescargoSalud';
import { kgTexto, proximaTexto, seriesTexto } from '@/components/iron/HistorialIron';
import { nombreIron, textoIron } from '@/components/iron/texto';
import type { EstadoHistorialIron } from '@/components/iron/useHistorialIron';
import { useAnchoUtil } from '@/design/useSizeClass';
import { t } from '@/i18n';
import { fechaCorta } from '@/i18n/formato';
import { bloques } from '@/iron/historial';
import type { Ejercicio } from '@/iron/tipos';
import { metaEjercicio } from './CatalogoIronVista';
import { FiguraTecnica } from './FiguraTecnica';
import { GlifoIron } from './Glifos';
import { MapaMini } from './MapaMini';
import { TarjetaHueco } from './Esqueletos';
import { BotonIron, estilosIron, FilaIron, LineaAncha, PantallaIron, RotuloIron, TarjetaIron } from './piezas';
import { A, C, F, fs, M, mezcla, px } from './tema';

/** La demostración no pasa de aquí de ancho (iPad). */
const ANCHO_MAX = 520;

export interface TecnicaIronVistaProps {
  ejercicio: Ejercicio;
  onVolver: () => void;
  /** Lo registrado en Gimnasio. Sin él (galería), no se pinta. */
  historial?: EstadoHistorialIron;
  /** Galería: el maniquí quieto en este instante. */
  ms?: number;
}

function Historial({ estado }: { estado: EstadoHistorialIron }) {
  if (estado.estado === 'cargando') {
    return (
      <View accessibilityRole="progressbar" accessibilityLabel={t('iron:historial.cargando')}>
        <TarjetaHueco lineas={5} />
      </View>
    );
  }
  if (estado.estado === 'error') {
    return (
      <TarjetaIron>
        <RotuloIron texto={t('ironmundo:tecnica.historial')} />
        <Text style={estilosIron.error} maxFontSizeMultiplier={1.6}>
          {estado.mensaje}
        </Text>
        <BotonIron fantasma fino titulo={t('ironmundo:reintentar')} onPress={estado.reintentar} />
      </TarjetaIron>
    );
  }
  const { sesiones, total, mejor, sugerencia } = estado.resumen;
  if (total === 0) {
    return (
      <TarjetaIron>
        <RotuloIron texto={t('ironmundo:tecnica.historial')} />
        <Text style={[estilosIron.cuerpo, styles.arriba]} maxFontSizeMultiplier={1.6}>
          {t('iron:historial.vacio')}
        </Text>
      </TarjetaIron>
    );
  }
  const serie = [...sesiones].reverse().map((s) => Math.max(...s.series.map((x) => x.kg)));
  return (
    <TarjetaIron>
      <RotuloIron texto={t('ironmundo:tecnica.historial')} em={t('ironmundo:pesos.sesiones', { count: total })} />
      {sugerencia ? (
        <View style={styles.proxima}>
          <Text style={styles.proximaTexto} maxFontSizeMultiplier={1.35}>
            {proximaTexto(sugerencia)}
          </Text>
          <Text style={estilosIron.detalle} maxFontSizeMultiplier={1.6}>
            {t(`iron:historial.motivo.${sugerencia.motivo}`, { tope: sugerencia.tope })}
          </Text>
          <Text style={[estilosIron.detalle, styles.tenue]} maxFontSizeMultiplier={1.6}>
            {t('iron:historial.orientativo')}
          </Text>
        </View>
      ) : null}
      <View style={styles.cifras}>
        <View style={styles.cifra}>
          <Text style={styles.cifraValor} maxFontSizeMultiplier={1}>
            {mejor ? `${kgTexto(mejor.e1rm)} ${t('ironmundo:unidadKg')}` : t('ironmundo:sinDato')}
          </Text>
          <Text style={styles.cifraRotulo} maxFontSizeMultiplier={1.2}>
            {t('iron:historial.mejor')}
          </Text>
        </View>
        <View style={styles.cifra}>
          <Text style={styles.cifraValor} maxFontSizeMultiplier={1}>
            {String(total)}
          </Text>
          <Text style={styles.cifraRotulo} maxFontSizeMultiplier={1.2}>
            {t('iron:historial.sesiones')}
          </Text>
        </View>
      </View>
      {serie.length >= 2 ? (
        <View style={styles.grafica}>
          <LineaAncha puntos={serie} alto={px(48)} grosor={2} />
        </View>
      ) : null}
      <View style={styles.arriba}>
        {sesiones.map((s, i) => {
          const fecha = fechaCorta(s.fecha);
          const texto = seriesTexto(bloques(s.series));
          return (
            <FilaIron key={s.fecha} primera={i === 0} accessibilityLabel={t('iron:historial.sesionA11y', { fecha, series: texto })}>
              <Text style={[estilosIron.filaSerie, styles.fecha]} maxFontSizeMultiplier={1.35}>
                {fecha}
              </Text>
              <Text style={[estilosIron.filaNombre, styles.flex]} maxFontSizeMultiplier={1.35}>
                {texto}
              </Text>
            </FilaIron>
          );
        })}
      </View>
    </TarjetaIron>
  );
}

export function TecnicaIronVista({ ejercicio: ej, onVolver, historial, ms }: TecnicaIronVistaProps) {
  const [pausado, setPausado] = useState(false);
  const ancho = Math.min(useAnchoUtil(), ANCHO_MAX) - 2 * M.margen - 2 * px(12) - 2;
  const nombre = textoIron(ej.nombre);
  const secundarios = ej.musculos.secundarios.map((m) => nombreIron('musculo', m)).join(', ');
  return (
    <PantallaIron>
      <View style={styles.cabecera}>
        <Pressable onPress={onVolver} hitSlop={12} accessibilityRole="button" accessibilityLabel={t('ironmundo:volver')} style={styles.atras}>
          <GlifoIron nombre="atras" lado={px(18)} color={C.mudo} grosor={2.2} />
        </Pressable>
        <View style={styles.flex}>
          <Text style={styles.titulo} accessibilityRole="header" maxFontSizeMultiplier={1.2}>
            {t('ironmundo:tecnica.titulo')}
          </Text>
          <Text style={styles.subtitulo} numberOfLines={1} maxFontSizeMultiplier={1.35}>
            {[nombreIron('grupo', ej.grupo), t(`iron:nivel.${ej.nivel}`)].join(' · ')}
          </Text>
        </View>
        <View style={styles.emblema}>
          <GlifoIron nombre="pesa" lado={px(16)} color={A} />
        </View>
      </View>

      <TarjetaIron heroe style={styles.heroe}>
        <RotuloIron texto={t('ironmundo:catalogo.tecnica')} em={t('ironmundo:catalogo.fases', { count: 3 })} />
        <View style={styles.escena}>
          <FiguraTecnica
            ejercicio={ej}
            alto={Math.min(px(200), 300)}
            ancho={Math.round(ancho * 0.58)}
            ms={ms}
            pausado={pausado}
            accessibilityLabel={t('iron:demo.animacion', { nombre })}
          />
          <MapaMini musculos={ej.musculos} alto={px(150)} etiqueta={t('ironmundo:catalogo.mapaA11y', { nombre })} />
        </View>
        <Text style={[estilosIron.titulo, styles.nombre]} maxFontSizeMultiplier={1.35}>
          {nombre}
        </Text>
        <Text style={estilosIron.meta} maxFontSizeMultiplier={1.35}>
          {metaEjercicio(ej)}
        </Text>
        <BotonIron fantasma fino titulo={pausado ? t('iron:demo.seguir') : t('iron:demo.pausar')} onPress={() => setPausado((p) => !p)} />
      </TarjetaIron>

      {historial ? <Historial estado={historial} /> : null}

      <TarjetaIron>
        <RotuloIron texto={t('ironmundo:tecnica.comoSeHace')} />
        <View style={styles.pasos}>
          {ej.cues.map((c, i) => (
            <View key={c} style={styles.paso}>
              <View style={styles.pasoNumero}>
                <Text style={styles.pasoNumeroTexto} maxFontSizeMultiplier={1}>
                  {i + 1}
                </Text>
              </View>
              <Text style={styles.pasoTexto} maxFontSizeMultiplier={1.6}>
                {textoIron(c)}
              </Text>
            </View>
          ))}
        </View>
      </TarjetaIron>

      <TarjetaIron>
        <RotuloIron texto={t('ironmundo:tecnica.musculos')} />
        <Text style={estilosIron.cuerpo} maxFontSizeMultiplier={1.6}>
          <Text style={styles.fuerte}>{`${t('ironmundo:tecnica.principales')} `}</Text>
          {ej.musculos.principales.map((m) => nombreIron('musculo', m)).join(', ')}
        </Text>
        {secundarios ? (
          <Text style={[estilosIron.cuerpo, styles.tenue]} maxFontSizeMultiplier={1.6}>
            <Text style={styles.fuerte}>{`${t('ironmundo:tecnica.secundarios')} `}</Text>
            {secundarios}
          </Text>
        ) : null}
      </TarjetaIron>

      {ej.errores.length > 0 ? (
        <TarjetaIron>
          <RotuloIron texto={t('ironmundo:tecnica.errores')} />
          <View style={styles.arriba}>
            {ej.errores.map((c, i) => (
              <FilaIron key={c} primera={i === 0}>
                <Text style={[estilosIron.filaNombre, styles.flex]} maxFontSizeMultiplier={1.6}>
                  {textoIron(c)}
                </Text>
              </FilaIron>
            ))}
          </View>
        </TarjetaIron>
      ) : null}

      <DescargoSalud />
    </PantallaIron>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  arriba: { marginTop: px(6) },
  tenue: { color: C.mudo },
  fuerte: { fontFamily: F.b, color: C.blanco },
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: px(9), paddingTop: px(4), marginBottom: px(2) },
  atras: { paddingVertical: px(4) },
  titulo: { fontFamily: F.cinzel, fontSize: fs(16), letterSpacing: fs(16) * 0.08, color: C.blanco },
  subtitulo: { fontFamily: F.m, fontSize: fs(9.5), letterSpacing: fs(9.5) * 0.06, color: C.mudo, marginTop: px(2) },
  emblema: {
    width: px(30),
    height: px(30),
    borderRadius: px(10),
    borderWidth: 1.5,
    borderColor: A,
    backgroundColor: mezcla(0.14, C.fondo),
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroe: { padding: px(12) },
  escena: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: px(6), marginBottom: px(4) },
  nombre: { fontSize: fs(18) },
  pasos: { marginTop: px(8), gap: px(6) },
  paso: { flexDirection: 'row', alignItems: 'center', gap: px(7) },
  pasoNumero: { width: px(16), height: px(16), borderRadius: px(5), backgroundColor: C.hueco, alignItems: 'center', justifyContent: 'center' },
  pasoNumeroTexto: { fontFamily: F.xb, fontSize: fs(8.5), color: A },
  pasoTexto: { flex: 1, fontFamily: F.m, fontSize: fs(10), lineHeight: fs(10) * 1.35, color: C.texto },
  proxima: { marginTop: px(6), gap: px(2) },
  proximaTexto: { fontFamily: F.b, fontSize: fs(15), color: C.blanco },
  cifras: { flexDirection: 'row', gap: px(7), marginTop: px(8) },
  cifra: { flex: 1, backgroundColor: C.fondo, borderRadius: px(12), borderWidth: 1, borderColor: C.filete, padding: px(8) },
  cifraValor: { fontFamily: F.xb, fontSize: fs(17), color: C.blanco },
  cifraRotulo: { fontFamily: F.b, fontSize: fs(8), letterSpacing: fs(8) * 0.14, color: C.mudo, textTransform: 'uppercase', marginTop: px(1) },
  grafica: { marginTop: px(10) },
  fecha: { minWidth: px(52) },
  mapa: { alignItems: 'center', marginVertical: px(8) },
});
