// NIVL · FOCUS: la pantalla de concentración. Mientras hay un bloque en marcha,
// a pantalla completa solo el reloj, qué se estudia y cómo terminar: sin coach,
// sin XP, sin tarjetas. Las salidas de la app se cuentan aquí y no tocan nada.

import { StatusBar } from 'expo-status-bar';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ink, space } from '@/design/tokens';
import type { Situacion } from '@/focus/pomodoro';
import { t } from '@/i18n';
import { F } from './estilo';
import { AnilloReloj, BotonFocus, Rotulo, textoFocus } from './Piezas';

const LADO_RELOJ = 240;

export interface PantallaConcentracionProps {
  visible: boolean;
  situacion: Situacion;
  reloj: string;
  ratio: number;
  /** La asignatura, o null en un bloque libre. */
  asignatura: string | null;
  tema: string | null;
  salidas: number;
  bloque: number;
  cadaLargo: number;
  onPausar: () => void;
  onSeguir: () => void;
  onTerminar: () => void;
}

export function PantallaConcentracion(p: PantallaConcentracionProps) {
  const insets = useSafeAreaInsets();
  const titulo = p.asignatura ?? t('focus:hoy.bloqueLibre');
  const enPausa = p.situacion === 'en_pausa';
  return (
    <Modal visible={p.visible} animationType="fade" presentationStyle="fullScreen" onRequestClose={p.onTerminar}>
      {p.visible ? <StatusBar hidden /> : null}
      <View style={[styles.fondo, { paddingTop: insets.top + space.s4, paddingBottom: insets.bottom + space.s4 }]}>
        <Rotulo texto={t('focus:concentracion.rotulo')} derecha={t('focus:hoy.bloque', { n: p.bloque, de: p.cadaLargo })} />
        <View style={styles.centro}>
          <View accessible accessibilityRole="timer" accessibilityLabel={t('focus:hoy.sesionA11y', { reloj: p.reloj, titulo, fase: t('focus:concentracion.rotulo') })}>
            <AnilloReloj ratio={p.ratio} reloj={p.reloj} pie={enPausa ? t('focus:concentracion.enPausa') : t('focus:hoy.relojBloque')} lado={LADO_RELOJ} />
          </View>
          <Text style={[textoFocus.titulo, styles.centrado]} maxFontSizeMultiplier={1.35} numberOfLines={2}>
            {titulo}
          </Text>
          {p.tema ? (
            <Text style={[textoFocus.cuerpo, styles.centrado]} maxFontSizeMultiplier={1.35} numberOfLines={3}>
              {p.tema}
            </Text>
          ) : null}
          {p.salidas > 0 ? (
            <Text style={[textoFocus.detalle, styles.centrado]} maxFontSizeMultiplier={1.35}>
              {t('focus:concentracion.salidas', { count: p.salidas })}
            </Text>
          ) : null}
        </View>
        <View style={styles.pie}>
          <BotonFocus titulo={enPausa ? t('focus:hoy.seguir') : t('focus:hoy.pausar')} icono={enPausa ? 'play' : 'pause'} onPress={enPausa ? p.onSeguir : p.onPausar} />
          <BotonFocus titulo={t('focus:hoy.parar')} variante="texto" pequeno onPress={p.onTerminar} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: ink.ink0, paddingHorizontal: space.s5 },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.s3 },
  centrado: { textAlign: 'center', color: F.texto },
  pie: { gap: space.s2 },
});
