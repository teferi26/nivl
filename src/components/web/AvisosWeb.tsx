// NIVL · Web: los avisos en pantalla (lo que en el móvil sería una
// notificación local). Montado una vez en el layout raíz, solo en la web.
//
// Arriba a la derecha en escritorio y a todo el ancho en el móvil; encima de
// todo (también de las hojas). Cada aviso es una tarjeta ink1 con hairline y
// regla izquierda de 2 en ink10: no gasta la inversión de la pantalla de
// debajo. Se queda hasta que la persona lo cierra (como una notificación que
// espera a que vuelvas). Se anuncia al lector de pantalla al aparecer.

import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAnunciar } from '@/components/ui';
import { ink, space, stroke, type as tipo } from '@/design/tokens';
import { useAnchoUtil } from '@/design/useSizeClass';
import { t } from '@/i18n';
import { cerrarAviso, suscribirAvisos, type AvisoWeb } from '@/lib/web/avisos';

const ANCHO_AVISO = 380;

export function AvisosWeb() {
  const [avisos, setAvisos] = useState<readonly AvisoWeb[]>([]);
  useEffect(() => suscribirAvisos(setAvisos), []);
  const ultimo = avisos[avisos.length - 1];
  useAnunciar(ultimo ? `${ultimo.titulo}. ${ultimo.cuerpo}` : null);
  const ancho = useAnchoUtil();
  if (Platform.OS !== 'web' || avisos.length === 0) return null;
  const estrecho = ancho < ANCHO_AVISO + 2 * space.s6;

  return (
    <View
      style={[styles.capa, estrecho ? styles.capaEstrecha : styles.capaAncha]}
      pointerEvents="box-none"
      role="region"
      aria-label={t('avisos:web.regionA11y')}
    >
      {avisos.map((a) => (
        <View key={a.id} style={styles.aviso} accessibilityRole="alert">
          <View style={styles.textos}>
            <Text style={styles.titulo} maxFontSizeMultiplier={1.35}>
              {a.titulo}
            </Text>
            {a.cuerpo ? (
              <Text style={styles.cuerpo} maxFontSizeMultiplier={1.35}>
                {a.cuerpo}
              </Text>
            ) : null}
          </View>
          <Pressable
            onPress={() => cerrarAviso(a.id)}
            style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [styles.cerrar, (pressed || hovered) && styles.cerrarActivo]}
            accessibilityRole="button"
            accessibilityLabel={t('avisos:web.cerrarA11y', { titulo: a.titulo })}
          >
            <Ionicons name="close" size={18} color={ink.ink8} />
          </Pressable>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  capa: { position: 'absolute', zIndex: 1000, gap: space.s2 },
  capaAncha: { top: space.s6, right: space.s6, width: ANCHO_AVISO },
  capaEstrecha: { top: space.s3, left: space.s3, right: space.s3 },
  aviso: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.s3,
    backgroundColor: ink.ink1,
    borderWidth: stroke.hairline,
    borderColor: ink.ink4,
    borderLeftWidth: stroke.rule,
    borderLeftColor: ink.ink10,
    paddingVertical: space.s3,
    paddingLeft: space.s4,
    paddingRight: space.s1,
  },
  textos: { flex: 1, minWidth: 0, gap: space.s1, paddingTop: 2 },
  titulo: {
    fontFamily: tipo.label.family,
    fontSize: tipo.label.size,
    lineHeight: tipo.label.lineHeight,
    letterSpacing: tipo.label.tracking,
    textTransform: 'uppercase',
    color: ink.ink10,
  },
  cuerpo: { fontFamily: tipo.bodySm.family, fontSize: tipo.bodySm.size, lineHeight: tipo.bodySm.lineHeight, color: ink.ink9 },
  cerrar: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  cerrarActivo: { backgroundColor: ink.ink2 },
});
