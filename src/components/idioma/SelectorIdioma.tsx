// NIVL · Idiomas (Modos F1): el selector de idioma de la app.
//
// Una lista de los idiomas que NIVL habla, cada uno con su nombre en su propia
// lengua (English, Français...: NOMBRE_IDIOMA no se traduce, así lo encuentra
// quien no entiende el idioma en que está la app). Un toque elige; lo elegido
// lleva el Check blanco (la marca de «hecho» del kit; no gasta la inversión).
//
// Puro: recibe `valor` y avisa con `alCambiar`. Quien lo usa guarda la
// preferencia y escribe `profiles.locale` (usePerfil.elegirIdioma). Accesible
// como grupo de radio: el lector dice el nombre y si está marcado.

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Card, Check } from '@/components/ui';
import { ink, space, stroke, type as tipo } from '@/design/tokens';
import { IDIOMAS, NOMBRE_IDIOMA, t } from '@/i18n';

export interface SelectorIdiomaProps {
  /** El idioma elegido (código: es, en, fr, de, pt, it). Otro valor no marca ninguno. */
  valor: string;
  alCambiar: (lng: string) => void;
  /** Mientras se guarda: las filas no responden. */
  ocupado?: boolean;
}

export function SelectorIdioma({ valor, alCambiar, ocupado }: SelectorIdiomaProps) {
  return (
    <Card padded={false} style={styles.lista}>
      <View accessibilityRole="radiogroup" accessibilityLabel={t('perfil:idiomaApp.grupoA11y')}>
        {IDIOMAS.map((lng, i) => {
          const marcado = valor === lng;
          return (
            <Pressable
              key={lng}
              onPress={() => {
                if (!marcado) alCambiar(lng);
              }}
              disabled={ocupado}
              accessibilityRole="radio"
              accessibilityLabel={NOMBRE_IDIOMA[lng]}
              accessibilityLanguage={lng}
              accessibilityState={{ checked: marcado, disabled: !!ocupado }}
              style={({ pressed }) => [styles.fila, i > 0 && styles.separada, pressed && styles.pulsada]}
              testID={`idioma-${lng}`}
            >
              <Text style={[styles.nombre, marcado && styles.nombreMarcado]} maxFontSizeMultiplier={1.35} numberOfLines={1}>
                {NOMBRE_IDIOMA[lng]}
              </Text>
              <Check checked={marcado} size={22} />
            </Pressable>
          );
        })}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  lista: { paddingHorizontal: space.s4, paddingVertical: 2 },
  fila: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s3,
    paddingVertical: space.s3,
  },
  separada: { borderTopWidth: stroke.hairline, borderTopColor: ink.ink3 },
  pulsada: { opacity: 0.6 },
  nombre: {
    flex: 1,
    fontFamily: tipo.body.family,
    fontSize: tipo.body.size,
    lineHeight: tipo.body.lineHeight,
    color: ink.ink8,
  },
  nombreMarcado: { fontFamily: tipo.headline.family, color: ink.ink9 },
});
