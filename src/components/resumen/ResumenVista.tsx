// NIVL · Recuerdos: la lista (patrón L-RADICAL §C, FASE3 Lote F). Pura:
// todo llega por props desde useResumen (o desde la galería).
//
// De arriba abajo: el encabezado grabado («Recuerdos» / «TU SEMANA EN
// IMÁGENES») con meandro; «Esta semana» en una tarjeta de piedra con la
// INVERSIÓN de la pantalla, «Generar el de esta semana», y debajo lo que
// haya contestado el sistema (sin NIVL Pro, el camino a /pro en contorno);
// y los pases en filas con hairline: el que está sin ver, con el icono
// sólido y la etiqueta «Sin ver»; los vistos, en ink6.

import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CargaArena, EncabezadoArena, Entrada, ErrorSistema, TarjetaArena } from '@/components/arena';
import { Button, EmptyState, Screen, Section, Tag } from '@/components/ui';
import { ink, space, stroke, type as tipo } from '@/design/tokens';
import type { Recap } from '@/lib/photos';
import { nombrePeriodo } from './tipos';

export interface ResumenVistaProps {
  cargado: boolean;
  errorCarga: string | null;
  recaps: Recap[];
  generando: boolean;
  /** Lo que ha contestado el sistema al generar, ya escrito para el usuario. */
  aviso: string | null;
  /** Sin NIVL Pro: el aviso lleva «Ver NIVL Pro». */
  pidePro: boolean;
  refrescando: boolean;
  acciones: {
    onVolver: () => void;
    onRefrescar: () => void;
    onReintentar: () => void;
    onGenerar: () => void;
    onVerPro: () => void;
    onAbrir: (r: Recap) => void;
  };
}

const BOTON = 44;

function FilaPase({ r, primera, onAbrir }: { r: Recap; primera: boolean; onAbrir: () => void }) {
  const visto = !!r.seen_at;
  const detalle = `${r.slides.length} diapositivas · ${r.photo_count} fotos`;
  return (
    <Pressable
      onPress={onAbrir}
      style={({ pressed }) => [styles.fila, !primera && styles.conRegla, pressed && styles.pulsado]}
      accessibilityRole="button"
      accessibilityLabel={`Abrir el pase: ${nombrePeriodo(r)}. ${detalle}. ${visto ? 'Visto' : 'Sin ver'}`}
    >
      <View style={styles.icono}>
        <Ionicons name={visto ? 'play-outline' : 'play'} size={20} color={visto ? ink.ink6 : ink.ink10} />
      </View>
      <View style={styles.filaTexto}>
        <Text style={[styles.filaTitulo, visto && styles.visto]} numberOfLines={2} maxFontSizeMultiplier={1.35}>
          {nombrePeriodo(r)}
        </Text>
        <Text style={styles.filaDetalle} maxFontSizeMultiplier={1.35}>
          {detalle}
        </Text>
      </View>
      {visto ? (
        <Text style={styles.filaDetalle} maxFontSizeMultiplier={1.35}>
          Visto
        </Text>
      ) : (
        <Tag>Sin ver</Tag>
      )}
      <Ionicons name="chevron-forward" size={18} color={ink.ink6} />
    </Pressable>
  );
}

export function ResumenVista({ cargado, errorCarga, recaps, generando, aviso, pidePro, refrescando, acciones }: ResumenVistaProps) {
  const sinVer = recaps.filter((r) => !r.seen_at).length;
  const subtitulo = !cargado
    ? undefined
    : recaps.length === 0
      ? 'Todavía no hay pases guardados.'
      : sinVer > 0
        ? `${sinVer} ${sinVer === 1 ? 'pase sin ver' : 'pases sin ver'} de ${recaps.length}.`
        : `${recaps.length} ${recaps.length === 1 ? 'pase guardado' : 'pases guardados'}.`;

  return (
    <Screen refreshing={refrescando} onRefresh={acciones.onRefrescar}>
      <Entrada indice={0}>
        <EncabezadoArena
          onVolver={acciones.onVolver}
          eyebrow="Recuerdos"
          titulo="Tu semana en imágenes"
          subtitulo={subtitulo}
          meandro
        />
      </Entrada>

      <Entrada indice={1}>
        <Section title="Esta semana">
          <TarjetaArena variante="piedra" remaches>
            <Text style={styles.texto} maxFontSizeMultiplier={1.6}>
              El sistema junta las fotos que has ido subiendo con cada misión y te cuenta la semana. Si no has subido
              ninguna, no hay resumen: un pase vacío no recuerda nada.
            </Text>
            <Button
              title="Generar el de esta semana"
              icon="sparkles-outline"
              onPress={acciones.onGenerar}
              loading={generando}
              style={styles.generar}
            />
            {generando ? (
              <Text style={styles.montando} maxFontSizeMultiplier={1.6} accessibilityLiveRegion="polite">
                El sistema está montando tu semana…
              </Text>
            ) : null}
            {aviso ? (
              <View style={styles.aviso} accessibilityLiveRegion="polite" accessibilityRole="alert">
                <Ionicons name="alert-circle-outline" size={16} color={ink.ink9} style={styles.avisoIcono} />
                <Text style={styles.avisoTexto} maxFontSizeMultiplier={1.6}>
                  {aviso}
                </Text>
              </View>
            ) : null}
            {pidePro ? (
              <Button title="Ver NIVL Pro" variant="secondary" size="sm" onPress={acciones.onVerPro} style={styles.pro} />
            ) : null}
            <Text style={styles.nota} maxFontSizeMultiplier={1.6}>
              El del mes lo genera el sistema solo, el día 1.
            </Text>
          </TarjetaArena>
        </Section>
      </Entrada>

      <Entrada indice={2}>
        <Section title="Pases" meta={recaps.length > 0 ? `${recaps.length}` : undefined}>
          {!cargado ? (
            <CargaArena etiqueta="Buscando tus recuerdos" formas={['filas']} />
          ) : errorCarga && recaps.length === 0 ? (
            <ErrorSistema mensaje={errorCarga} onReintentar={acciones.onReintentar} />
          ) : recaps.length === 0 ? (
            <TarjetaArena variante="contorno">
              <EmptyState
                icon="images-outline"
                title="Todavía no hay recuerdos"
                body="Sube una foto al completar una misión y el domingo tendrás algo que mirar."
              />
            </TarjetaArena>
          ) : (
            <>
              {errorCarga ? (
                <ErrorSistema compacto mensaje={errorCarga} onReintentar={acciones.onReintentar} style={styles.falloLista} />
              ) : null}
              {recaps.map((r, i) => (
                <FilaPase key={r.id} r={r} primera={i === 0} onAbrir={() => acciones.onAbrir(r)} />
              ))}
            </>
          )}
        </Section>
      </Entrada>
    </Screen>
  );
}

const styles = StyleSheet.create({
  texto: { fontFamily: tipo.bodySm.family, fontSize: tipo.bodySm.size, lineHeight: tipo.bodySm.lineHeight, color: ink.ink8 },
  generar: { marginTop: space.s5 },
  montando: {
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink8,
    marginTop: space.s3,
    textAlign: 'center',
  },
  aviso: { flexDirection: 'row', alignItems: 'flex-start', gap: space.s2, marginTop: space.s4 },
  avisoIcono: { marginTop: 2 },
  avisoTexto: {
    flex: 1,
    minWidth: 0,
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink9,
  },
  pro: { marginTop: space.s3, alignSelf: 'flex-start' },
  nota: {
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink6,
    marginTop: space.s4,
  },
  falloLista: { marginBottom: space.s4 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: space.s3, minHeight: 64, paddingVertical: space.s3 },
  conRegla: { borderTopWidth: stroke.hairline, borderTopColor: ink.ink3 },
  pulsado: { backgroundColor: ink.ink2 },
  icono: {
    width: BOTON,
    height: BOTON,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: stroke.hairline,
    borderColor: ink.ink4,
  },
  filaTexto: { flex: 1, minWidth: 0, gap: 2 },
  filaTitulo: { fontFamily: 'Outfit_600SemiBold', fontSize: 16, lineHeight: 22, color: ink.ink9 },
  visto: { color: ink.ink8 },
  filaDetalle: {
    fontFamily: tipo.micro.family,
    fontSize: tipo.micro.size,
    lineHeight: tipo.micro.lineHeight,
    letterSpacing: tipo.micro.tracking,
    textTransform: 'uppercase',
    color: ink.ink6,
  },
});
