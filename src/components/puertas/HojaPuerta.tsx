// NIVL · Puertas: la hoja de los consentimientos (salud y IA).
//
// Por qué no es `Sheet` de `@/components/ui`: las pruebas de Seguridad
// (health.test.ts, consentguard.test.ts) simulan react-native con Modal,
// Pressable, ScrollView, Text, View y StyleSheet.create, sin
// useWindowDimensions, Animated ni Keyboard, y health.test.ts además simula
// `@/components/ui` sin `Sheet`. Esta hoja copia la composición de `Sheet`
// (asa, eyebrow, título, cuerpo con scroll y pie fijo, tinta ink1 con hairline
// ink3) con solo esas primitivas. En vez de centrarse en tableta, se acota a
// 560 y se centra abajo: en iPad y en la web ya no ocupa el ancho entero.
// Sin campos de texto: no necesita mecanismo de teclado.
import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ink, space, stroke, type as tipo } from '@/design/tokens';

export interface HojaPuertaProps {
  visible: boolean;
  /** Fondo, botón atrás de Android y escape del lector: lo mismo que «Ahora no». */
  onCerrar: () => void;
  eyebrow?: string;
  titulo: string;
  children: ReactNode;
  /** Las acciones, fijas debajo del cuerpo. */
  pie: ReactNode;
}

export function HojaPuerta({ visible, onCerrar, eyebrow, titulo, children, pie }: HojaPuertaProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onCerrar}>
      <View style={styles.fondo}>
        <Pressable style={styles.fondoToque} onPress={onCerrar} accessibilityRole="button" accessibilityLabel="Cerrar" />
        <View style={styles.hoja} accessibilityViewIsModal onAccessibilityEscape={onCerrar}>
          <View style={styles.asaZona}>
            <View style={styles.asa} />
          </View>
          <View style={styles.cabecera}>
            {eyebrow ? (
              <Text style={styles.eyebrow} maxFontSizeMultiplier={1.35}>
                {eyebrow}
              </Text>
            ) : null}
            <Text style={styles.titulo} accessibilityRole="header" maxFontSizeMultiplier={1.35}>
              {titulo}
            </Text>
          </View>
          <ScrollView style={styles.flexible} contentContainerStyle={styles.cuerpo} showsVerticalScrollIndicator>
            {children}
          </ScrollView>
          <View style={styles.pie}>{pie}</View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fondo: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0, 0, 0, 0.8)' },
  fondoToque: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  hoja: {
    width: '100%',
    maxWidth: 560,
    maxHeight: '90%',
    alignSelf: 'center',
    backgroundColor: ink.ink1,
    borderTopWidth: stroke.hairline,
    borderLeftWidth: stroke.hairline,
    borderRightWidth: stroke.hairline,
    borderColor: ink.ink3,
  },
  asaZona: { alignItems: 'center', paddingTop: space.s3, paddingBottom: space.s2 },
  asa: { width: 40, height: 4, backgroundColor: ink.ink4 },
  cabecera: { gap: space.s1, paddingHorizontal: space.s5, paddingTop: space.s2, paddingBottom: space.s3 },
  eyebrow: {
    fontFamily: tipo.label.family,
    fontSize: tipo.label.size,
    lineHeight: tipo.label.lineHeight,
    letterSpacing: tipo.label.tracking,
    textTransform: 'uppercase',
    color: ink.ink6,
  },
  titulo: {
    fontFamily: tipo.headline.family,
    fontSize: tipo.headline.size,
    lineHeight: tipo.headline.lineHeight,
    letterSpacing: tipo.headline.tracking,
    color: ink.ink9,
  },
  flexible: { flexGrow: 0, flexShrink: 1 },
  cuerpo: { paddingHorizontal: space.s5, paddingBottom: space.s4 },
  pie: {
    gap: space.s2,
    paddingHorizontal: space.s5,
    paddingTop: space.s3,
    // Sin safe-area-context (las pruebas no lo cargan): 40 libra el indicador
    // de inicio del iPhone (34).
    paddingBottom: space.s10,
    borderTopWidth: stroke.hairline,
    borderTopColor: ink.ink3,
  },
});
