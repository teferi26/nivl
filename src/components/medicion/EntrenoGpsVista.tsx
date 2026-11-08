// NIVL · Entreno con GPS: la vista. Pura: todo llega por props.
//
// Una pantalla por fase, en una unión discriminada: no hay combinación de
// banderas que pinte dos fases a la vez. Lo que el sensor no da se pinta como
// sin dato, nunca como cero.

import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';
import {
  CargaArena,
  EncabezadoArena,
  Entrada,
  ErrorSistema,
  FranjaCifras,
  TarjetaArena,
  type Cifra,
} from '@/components/arena';
import { Button, Card, Chip, ChipWrap, Row, RowValue, Screen, Section, SIN_DATO, leidoSinDato } from '@/components/ui';
import { Interruptor } from '@/components/ui/Interruptor';
import { ink, space, type as tipo } from '@/design/tokens';
import { t } from '@/i18n';
import type { EntrenoMedido, Parcial } from '@/lib/entrenoMedido';
import type { DeporteGps, EstadoGps } from '@/lib/medicion/saludNativa';
import { formatoDuracion, formatoRitmo, ritmoSKm } from '@/lib/medicion/rutaGps';
import { calidadGps, kmDe, velocidadDe, type MotivoNoDisponible } from './puro';

export type PantallaGps =
  | { fase: 'no_disponible'; motivo: MotivoNoDisponible }
  | { fase: 'permiso'; denegado: boolean; pidiendo: boolean; error: string | null }
  | { fase: 'listo'; deporte: DeporteGps; autoPausa: boolean; empezando: boolean; error: string | null }
  | { fase: 'marcha'; estado: EstadoGps; segundos: number; terminando: boolean; error: string | null }
  | { fase: 'interrumpida'; estado: EstadoGps; terminando: boolean; error: string | null }
  | { fase: 'guardando' }
  | { fase: 'corta' }
  | {
      fase: 'resumen';
      entreno: EntrenoMedido;
      /** Aún no ha subido: sigue en el disco del móvil y se reintenta sola. */
      pendiente: boolean;
      /** Ya estaba, medida por otro origen: no se ha añadido de nuevo. */
      duplicada?: boolean;
      /** Terminó otro día: se guarda, pero no cuenta para aquel día. */
      deOtroDia: boolean;
    };

export interface EntrenoGpsVistaProps {
  pantalla: PantallaGps;
  acciones: {
    onVolver: () => void;
    onPedirPermiso: () => void;
    onAbrirAjustes: () => void;
    onDeporte: (d: DeporteGps) => void;
    onAutoPausa: (v: boolean) => void;
    onEmpezar: () => void;
    onPausar: () => void;
    onReanudar: () => void;
    onTerminar: () => void;
    onDescartar: () => void;
    onNuevaSesion: () => void;
  };
}

/** Celdas de ritmo o velocidad según el deporte: en bici se habla en km/h. */
function celdaMarcha(deporte: DeporteGps | string, sKm: number | null): Cifra {
  if (deporte === 'bici') {
    return { valor: velocidadDe(sKm), rotulo: t('medicion:gps.velocidad') };
  }
  return { valor: formatoRitmo(sKm), rotulo: t('medicion:gps.ritmo') };
}

function celdaPrecision(precisionM: number | null): Cifra {
  const calidad = calidadGps(precisionM);
  if (calidad === null || precisionM === null) {
    return { valor: SIN_DATO, rotulo: t('medicion:gps.precision'), etiqueta: `${t('medicion:gps.precision')}: ${leidoSinDato()}` };
  }
  return {
    valor: t(`medicion:gps.calidad.${calidad}`),
    rotulo: t('medicion:gps.precision'),
    etiqueta: t('medicion:gps.precisionA11y', { calidad: t(`medicion:gps.calidad.${calidad}`), metros: Math.round(precisionM) }),
  };
}

function Parciales({ parciales, deporte }: { parciales: Parcial[]; deporte: DeporteGps | string }) {
  if (parciales.length === 0) return null;
  // Lo último arriba: es lo que se mira corriendo.
  const orden = [...parciales].reverse();
  return (
    <Section title={t('medicion:gps.parciales')} meta={`${parciales.length}`}>
      <Card padded={false} style={styles.lista}>
        {orden.map((p, i) => {
          const sKm = ritmoSKm(p.distancia_m, p.duracion_s);
          const ritmo = deporte === 'bici' ? `${velocidadDe(sKm)} km/h` : `${formatoRitmo(sKm)} /km`; // i18n-ok: unidad
          return (
            <Row
              key={p.n}
              first={i === 0}
              title={t('medicion:gps.parcial', { n: p.n })}
              detail={ritmo}
              trailing={<RowValue strong>{formatoDuracion(p.duracion_s)}</RowValue>}
            />
          );
        })}
      </Card>
    </Section>
  );
}

function Tiempo({ segundos }: { segundos: number }) {
  const texto = formatoDuracion(segundos);
  return (
    <Text
      style={styles.tiempo}
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={0.5}
      maxFontSizeMultiplier={1.2}
      accessibilityLabel={t('medicion:gps.tiempoA11y', { tiempo: texto })}
    >
      {texto}
    </Text>
  );
}

function Cuerpo({ pantalla: p, acciones }: EntrenoGpsVistaProps) {
  switch (p.fase) {
    case 'no_disponible':
      return (
        <TarjetaArena variante="contorno" rotulo={t('medicion:gps.noDisponibleRotulo')}>
          <Text style={styles.cuerpo} maxFontSizeMultiplier={1.6}>
            {t(`medicion:gps.noDisponible.${p.motivo}`)}
          </Text>
          <Text style={styles.nota} maxFontSizeMultiplier={1.6}>
            {t('medicion:gps.noDisponiblePie')}
          </Text>
        </TarjetaArena>
      );

    case 'permiso':
      return (
        <TarjetaArena variante="contorno" rotulo={t('medicion:gps.permisoRotulo')}>
          <Text style={styles.cuerpo} maxFontSizeMultiplier={1.6}>
            {t(p.denegado ? 'medicion:gps.permisoDenegado' : 'medicion:gps.permisoCuerpo')}
          </Text>
          {p.error ? <ErrorSistema compacto mensaje={p.error} style={styles.aviso} /> : null}
          <Button
            title={t(p.denegado ? 'medicion:gps.abrirAjustes' : 'medicion:gps.permisoContinuar')}
            onPress={p.denegado ? acciones.onAbrirAjustes : acciones.onPedirPermiso}
            loading={p.pidiendo}
            style={styles.boton}
          />
        </TarjetaArena>
      );

    case 'listo':
      return (
        <>
          <Section title={t('medicion:gps.deporte')}>
            <ChipWrap>
              <Chip label={t('medicion:gps.carrera')} icon="walk-outline" selected={p.deporte === 'carrera'} onPress={() => acciones.onDeporte('carrera')} />
              <Chip label={t('medicion:gps.bici')} icon="bicycle-outline" selected={p.deporte === 'bici'} onPress={() => acciones.onDeporte('bici')} />
            </ChipWrap>
          </Section>
          <Card padded={false} style={styles.lista}>
            <Row
              first
              leading={<Ionicons name="pause-circle-outline" size={20} color={ink.ink9} />}
              title={t('medicion:gps.autoPausa')}
              detail={t('medicion:gps.autoPausaDetalle')}
              trailing={<Interruptor value={p.autoPausa} onValueChange={acciones.onAutoPausa} accessibilityLabel={t('medicion:gps.autoPausa')} />}
            />
          </Card>
          {p.error ? <ErrorSistema compacto mensaje={p.error} style={styles.aviso} /> : null}
          <Button title={t('medicion:gps.empezar')} icon="play" size="lg" onPress={acciones.onEmpezar} loading={p.empezando} style={styles.boton} />
          <Text style={styles.nota} maxFontSizeMultiplier={1.6}>
            {t('medicion:gps.notaReloj')}
          </Text>
        </>
      );

    case 'marcha': {
      const enPausa = p.estado.fase === 'pausa';
      return (
        <>
          <Text style={styles.fase} accessibilityLiveRegion="polite" maxFontSizeMultiplier={1.35}>
            {t(`medicion:gps.fase.${p.estado.fase}`)}
          </Text>
          <Tiempo segundos={p.segundos} />
          <FranjaCifras
            cifras={[
              { valor: kmDe(p.estado.distancia_m), rotulo: t('medicion:gps.km') },
              celdaMarcha(p.estado.deporte, p.estado.ritmo_s_km),
              celdaPrecision(p.estado.precision_m),
            ]}
          />
          {p.error ? <ErrorSistema compacto mensaje={p.error} style={styles.aviso} /> : null}
          <View style={styles.botones}>
            <Button
              title={t(enPausa ? 'medicion:gps.reanudar' : 'medicion:gps.pausar')}
              icon={enPausa ? 'play' : 'pause'}
              size="lg"
              onPress={enPausa ? acciones.onReanudar : acciones.onPausar}
              disabled={p.terminando}
              style={styles.flex}
            />
            <Button
              title={t('medicion:gps.fin')}
              icon="stop"
              size="lg"
              variant="secondary"
              onPress={acciones.onTerminar}
              loading={p.terminando}
              style={styles.flex}
            />
          </View>
          <Button title={t('medicion:gps.descartar')} variant="ghost" size="sm" onPress={acciones.onDescartar} disabled={p.terminando} style={styles.boton} />
          <View style={styles.bloque}>
            <Parciales parciales={p.estado.parciales} deporte={p.estado.deporte} />
          </View>
        </>
      );
    }

    case 'interrumpida':
      return (
        <>
          <TarjetaArena variante="trama" rotulo={t('medicion:gps.interrumpidaRotulo')}>
            <Text style={styles.cuerpo} maxFontSizeMultiplier={1.6}>
              {t('medicion:gps.interrumpidaCuerpo')}
            </Text>
          </TarjetaArena>
          <View style={styles.bloque}>
            <FranjaCifras
              cifras={[
                { valor: formatoDuracion(p.estado.duracion_s), rotulo: t('medicion:gps.tiempo') },
                { valor: kmDe(p.estado.distancia_m), rotulo: t('medicion:gps.km') },
              ]}
            />
          </View>
          {p.error ? <ErrorSistema compacto mensaje={p.error} style={styles.aviso} /> : null}
          <Button title={t('medicion:gps.reanudar')} icon="play" size="lg" onPress={acciones.onReanudar} disabled={p.terminando} style={styles.boton} />
          <Button title={t('medicion:gps.terminarGuardar')} variant="secondary" onPress={acciones.onTerminar} loading={p.terminando} style={styles.boton} />
          <Button title={t('medicion:gps.descartar')} variant="ghost" size="sm" onPress={acciones.onDescartar} disabled={p.terminando} style={styles.boton} />
        </>
      );

    case 'guardando':
      return <CargaArena etiqueta={t('medicion:gps.guardando')} formas={['tarjeta', 'franja']} />;

    case 'corta':
      return (
        <>
          <TarjetaArena variante="contorno" rotulo={t('medicion:gps.cortaRotulo')}>
            <Text style={styles.cuerpo} maxFontSizeMultiplier={1.6}>
              {t('medicion:gps.cortaCuerpo')}
            </Text>
          </TarjetaArena>
          <Button title={t('medicion:gps.nueva')} variant="secondary" onPress={acciones.onNuevaSesion} style={styles.boton} />
        </>
      );

    case 'resumen': {
      const e = p.entreno;
      const sKm = ritmoSKm(e.distancia_m, e.duracion_s);
      return (
        <>
          <TarjetaArena variante="piedra" rotulo={t(p.pendiente ? 'medicion:gps.pendienteRotulo' : p.duplicada ? 'medicion:gps.duplicadaRotulo' : 'medicion:gps.guardadaRotulo')}>
            <Text style={styles.cuerpo} accessibilityLiveRegion="polite" maxFontSizeMultiplier={1.6}>
              {p.pendiente ? t('medicion:gps.pendienteCuerpo') : p.duplicada ? t('medicion:gps.duplicadaCuerpo') : t(p.deOtroDia ? 'medicion:gps.deOtroDia' : 'medicion:gps.guardadaCuerpo')}
            </Text>
          </TarjetaArena>
          <View style={styles.bloque}>
            <FranjaCifras
              cifras={[
                { valor: formatoDuracion(e.duracion_s), rotulo: t('medicion:gps.tiempo') },
                { valor: kmDe(e.distancia_m), rotulo: t('medicion:gps.km') },
                celdaMarcha(e.deporte, sKm),
              ]}
            />
          </View>
          <View style={styles.bloque}>
            <Parciales parciales={e.parciales} deporte={e.deporte} />
          </View>
          <Button title={t('medicion:gps.volverCardio')} onPress={acciones.onVolver} style={styles.boton} />
        </>
      );
    }
  }
}

export function EntrenoGpsVista(props: EntrenoGpsVistaProps) {
  return (
    <Screen>
      <Entrada indice={0}>
        <EncabezadoArena
          onVolver={props.acciones.onVolver}
          eyebrow={t('medicion:gps.eyebrow')}
          titulo={t('medicion:gps.titulo')}
          subtitulo={t('medicion:gps.sub')}
        />
      </Entrada>
      <Cuerpo {...props} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  cuerpo: {
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink9,
  },
  nota: {
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink6,
    marginTop: space.s3,
  },
  lista: { paddingHorizontal: space.s4, paddingVertical: 2 },
  aviso: { marginTop: space.s4 },
  boton: { marginTop: space.s3 },
  botones: { flexDirection: 'row', gap: space.s3, marginTop: space.s6 },
  flex: { flex: 1 },
  bloque: { marginTop: space.s5 },
  fase: {
    fontFamily: tipo.label.family,
    fontSize: tipo.label.size,
    lineHeight: tipo.label.lineHeight,
    letterSpacing: tipo.label.tracking,
    textTransform: 'uppercase',
    color: ink.ink8,
    textAlign: 'center',
  },
  tiempo: {
    fontFamily: tipo.monumentoSm.family,
    fontSize: tipo.monumentoSm.size,
    lineHeight: tipo.monumentoSm.lineHeight,
    color: ink.ink10,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
    marginVertical: space.s4,
  },
});
