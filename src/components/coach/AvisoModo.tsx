// NIVL · El aviso del chat cuando el coach deja una misión en OTRO modo
// (FEEDBACK 1.0.11, punto 3): desde IRON, «repasa el tema 4» es de FOCUS.
// Una franja compacta bajo la losa del coach: el glifo del modo en su acento,
// la misión y «Ir a FOCUS» (secondary: la inversión de la pantalla es ENVIAR).
// Puro: qué avisos se pintan lo decide modos/avisosCoach.ts; el toque lo
// resuelve useCoach (la recarga de la rueda e irAlMundo).

import { StyleSheet, Text, View } from 'react-native';
import { GlifoModo } from '@/components/modos/rueda/GlifoModo';
import { Button } from '@/components/ui';
import { ink, modoAcento, space, stroke, type } from '@/design/tokens';
import { t } from '@/i18n';
import type { AvisoModo as Aviso } from '@/modos/avisosCoach';
import { NOMBRE_MODO, type ModoEtiqueta } from '@/modos/tipos';

export function AvisosModo({ avisos, onIr }: { avisos: Aviso[]; onIr: (modo: ModoEtiqueta) => void }) {
  if (!avisos.length) return null;
  return (
    <View style={styles.lista}>
      {avisos.map((a) => {
        const modo = NOMBRE_MODO[a.modo];
        const texto = t('coach:modo.mision', {
          count: a.titulos.length,
          modo,
          titulos: a.titulos.map((titulo) => t('coach:modo.titulo', { titulo })).join(', '),
        });
        return (
          <View key={a.modo} style={styles.aviso}>
            <View style={styles.texto}>
              <GlifoModo modo={a.modo} tamano={18} color={modoAcento[a.modo]} />
              <Text style={styles.linea} numberOfLines={3} maxFontSizeMultiplier={1.35}>
                {texto}
              </Text>
            </View>
            <Button
              title={t('coach:modo.ir', { modo })}
              variant="secondary"
              size="sm"
              onPress={() => onIr(a.modo)}
            />
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  lista: { marginTop: space.s2, gap: space.s2 },
  aviso: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.s2,
    borderWidth: stroke.hairline,
    borderColor: ink.ink3,
    backgroundColor: ink.ink1,
    paddingVertical: space.s2,
    paddingHorizontal: space.s3,
  },
  texto: { flexDirection: 'row', alignItems: 'center', gap: space.s2, flexShrink: 1, flexGrow: 1, flexBasis: 180 },
  linea: {
    flexShrink: 1,
    fontFamily: type.bodySm.family,
    fontSize: type.bodySm.size,
    lineHeight: type.bodySm.lineHeight,
    color: ink.ink8,
  },
});
