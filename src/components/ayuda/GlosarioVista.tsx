// NIVL · «Qué significa cada cosa»: la lista completa de palabras del juego.
//
// `GlosarioVista` es solo el contenido, para meterlo en una hoja o en una
// pantalla. `HojaGlosario` lo envuelve en la hoja que se abre desde Perfil.

import { StyleSheet, Text, View } from 'react-native';
import { TarjetaArena } from '@/components/arena';
import { Sheet } from '@/components/ui';
import { ink, space, stroke, type as tipo } from '@/design/tokens';
import { t } from '@/i18n';
import { GRUPOS_GLOSARIO, terminosDeGrupo, tieneDetalle, type TerminoId } from '@/lib/glosario';

export function tituloTermino(id: TerminoId): string {
  return t(`ayuda:terminos.${id}.titulo`);
}

export function definicionTermino(id: TerminoId): string {
  return t(`ayuda:terminos.${id}.definicion`);
}

export function detalleTermino(id: TerminoId): string | null {
  return tieneDetalle(id) ? t(`ayuda:terminos.${id}.detalle`) : null;
}

function Entrada({ id }: { id: TerminoId }) {
  const definicion = definicionTermino(id);
  const detalle = detalleTermino(id);
  return (
    <View style={styles.entrada} accessible accessibilityLabel={[tituloTermino(id), definicion, detalle].filter(Boolean).join('. ')}>
      <Text maxFontSizeMultiplier={1.35} style={styles.titulo}>
        {tituloTermino(id)}
      </Text>
      <Text maxFontSizeMultiplier={1.35} style={styles.texto}>
        {definicion}
      </Text>
      {detalle ? (
        <Text maxFontSizeMultiplier={1.35} style={styles.texto}>
          {detalle}
        </Text>
      ) : null}
    </View>
  );
}

export function GlosarioVista({ destacar }: { /** Se pinta el primero, y no se repite en su grupo. */ destacar?: TerminoId }) {
  return (
    <View style={styles.lista}>
      {destacar ? (
        <TarjetaArena variante="contorno" marco={1}>
          <Entrada id={destacar} />
        </TarjetaArena>
      ) : null}
      {GRUPOS_GLOSARIO.map((grupo) => {
        const ids = terminosDeGrupo(grupo).filter((id) => id !== destacar);
        if (!ids.length) return null;
        return (
          <View key={grupo}>
            <Text maxFontSizeMultiplier={1.35} accessibilityRole="header" style={styles.grupo}>
              {t(`ayuda:glosario.grupo.${grupo}`)}
            </Text>
            {ids.map((id) => (
              <View key={id} style={styles.fila}>
                <Entrada id={id} />
              </View>
            ))}
          </View>
        );
      })}
    </View>
  );
}

export function HojaGlosario({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <Sheet visible={visible} onClose={onClose} eyebrow={t('ayuda:glosario.eyebrow')} title={t('ayuda:glosario.titulo')}>
      <GlosarioVista />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  lista: { gap: space.s6 },
  grupo: {
    fontFamily: tipo.label.family,
    fontSize: tipo.label.size,
    lineHeight: tipo.label.lineHeight,
    letterSpacing: tipo.label.tracking,
    textTransform: 'uppercase',
    color: ink.ink6,
    marginBottom: space.s2,
  },
  fila: { borderTopWidth: stroke.hairline, borderTopColor: ink.ink3, paddingVertical: space.s3 },
  entrada: { gap: space.s1, minWidth: 0 },
  titulo: {
    fontFamily: tipo.headline.family,
    fontSize: tipo.body.size,
    lineHeight: tipo.body.lineHeight,
    color: ink.ink9,
  },
  texto: {
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink8,
  },
});
