// NIVL · Modos F1: elegir los modos activados (pura). La usan el paso
// «Elige tus modos» del onboarding y la hoja de Perfil.
//
// Una tarjeta por modo: NIVL (General) arriba, fija y marcada, con «Siempre
// activo»; debajo IRON, FOCUS, WORK y FOUNDER como casillas. Marcada = marco
// de 3 en el acento del modo y el cuadrado lleno; sin invertir (la inversión
// del paso es «Continuar»). Debajo, si no hay ninguno, «Elige al menos uno.»

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { vibrar } from '@/design/haptics';
import { ink, modoAcento, space, stroke, type as tipo } from '@/design/tokens';
import { t } from '@/i18n';
import { alternarModo, eleccionValida, MODOS_ETIQUETA, NOMBRE_MODO, type ModoEtiqueta, type ModoId } from '@/modos/tipos';

export interface EleccionModosProps {
  valor: readonly ModoEtiqueta[];
  alCambiar: (modos: ModoEtiqueta[]) => void;
  /** Bloqueada mientras se guarda. */
  ocupada?: boolean;
}

function Fila({
  modo,
  marcada,
  fija,
  onPress,
}: {
  modo: ModoId;
  marcada: boolean;
  fija?: boolean;
  onPress?: () => void;
}) {
  const descripcion = t(`modos:descripcion.${modo}`);
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: marcada, disabled: !!fija }}
      accessibilityLabel={t('modos:onboarding.a11y', { modo: NOMBRE_MODO[modo], descripcion })}
      style={({ pressed }) => [
        styles.fila,
        marcada && !fija && { borderColor: modoAcento[modo], borderWidth: stroke.frame, padding: space.s3 + 1 - stroke.frame },
        pressed && styles.pulsada,
      ]}
    >
      <View style={[styles.marca, marcada && { backgroundColor: modoAcento[modo], borderColor: modoAcento[modo] }]} />
      <View style={styles.textos}>
        <Text style={[styles.nombre, marcada && { color: modoAcento[modo] }]} maxFontSizeMultiplier={1.35}>
          {NOMBRE_MODO[modo]}
        </Text>
        <Text style={styles.descripcion} maxFontSizeMultiplier={1.35}>
          {fija ? `${descripcion} ${t('modos:onboarding.siempre')}` : descripcion}
        </Text>
      </View>
    </Pressable>
  );
}

export function EleccionModos({ valor, alCambiar, ocupada }: EleccionModosProps) {
  return (
    <View>
      <Fila modo="general" marcada fija />
      {MODOS_ETIQUETA.map((m) => (
        <Fila
          key={m}
          modo={m}
          marcada={valor.includes(m)}
          onPress={
            ocupada
              ? undefined
              : () => {
                  vibrar('seleccion');
                  alCambiar(alternarModo(valor, m));
                }
          }
        />
      ))}
      {!eleccionValida(valor) ? (
        <Text style={styles.minimo} maxFontSizeMultiplier={1.35}>
          {t('modos:onboarding.minimo')}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s3,
    minHeight: 56,
    padding: space.s3,
    marginBottom: space.s2,
    borderWidth: stroke.hairline,
    borderColor: ink.ink4,
    backgroundColor: ink.ink1,
  },
  pulsada: { opacity: 0.7 },
  marca: { width: 14, height: 14, borderWidth: stroke.hairline, borderColor: ink.ink6 },
  textos: { flex: 1, minWidth: 0 },
  nombre: {
    fontFamily: tipo.inscripcion.family,
    fontSize: tipo.inscripcion.size,
    lineHeight: tipo.inscripcion.lineHeight,
    letterSpacing: tipo.inscripcion.tracking,
    color: ink.ink10,
  },
  descripcion: {
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink8,
    marginTop: 2,
  },
  minimo: {
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink9,
    marginTop: space.s1,
  },
});
