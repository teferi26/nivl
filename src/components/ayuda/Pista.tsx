// NIVL · La pista: una tarjeta corta dentro del flujo de la pantalla, nunca un
// modal. Se cierra para siempre con «Entendido». Las de un mismo `grupo` salen
// de una en una. Antes de escribir una, lee docs/primer-uso/AYUDA-CONTEXTUAL.md:
// si la pantalla necesita explicarse, primero se simplifica.

import { useLayoutEffect } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Button } from '@/components/ui';
import { usePiel } from '@/design/piel';
import { ink, space, stroke, type as tipo } from '@/design/tokens';
import { t } from '@/i18n';
import {
  apagarPistasGuardado,
  descartarPistaGuardada,
  registrarPista,
} from './ayudaEstado';
import { pistaVisible } from './ayudaMath';
import { useInstantaneaAyuda } from './useAyuda';

export interface AccionPista {
  label: string;
  onPress: () => void;
}

export interface PistaVistaProps {
  titulo: string;
  cuerpo: string;
  accion?: AccionPista;
  onEntendido: () => void;
  onNoMostrarMas: () => void;
  /** Colocación: márgenes, ancho. */
  style?: StyleProp<ViewStyle>;
}

/** Lo que se ve, sin almacén. */
export function PistaVista({ titulo, cuerpo, accion, onEntendido, onNoMostrarMas, style }: PistaVistaProps) {
  const piel = usePiel();
  return (
    <View
      style={[
        styles.caja,
        piel && { backgroundColor: piel.tarjeta, borderColor: piel.borde, borderRadius: piel.radio },
        style,
      ]}
    >
      <Text maxFontSizeMultiplier={1.35} style={styles.titulo}>
        {titulo}
      </Text>
      <Text maxFontSizeMultiplier={1.35} style={styles.cuerpo}>
        {cuerpo}
      </Text>
      {/* Sin botón sólido: la acción principal de la pantalla es otra. */}
      <View style={styles.acciones}>
        {accion ? <Button title={accion.label} variant="secondary" size="sm" onPress={accion.onPress} /> : null}
        <Button
          title={t('ayuda:pista.entendido')}
          variant={accion ? 'ghost' : 'secondary'}
          size="sm"
          onPress={onEntendido}
        />
      </View>
      <Pressable
        onPress={onNoMostrarMas}
        style={({ pressed }) => [styles.enlace, pressed && styles.enlacePulsado]}
        accessibilityRole="button"
        accessibilityLabel={t('ayuda:pista.noMostrarA11y')}
      >
        <Text maxFontSizeMultiplier={1.35} style={styles.enlaceTexto}>
          {t('ayuda:pista.noMostrar')}
        </Text>
      </Pressable>
    </View>
  );
}

export interface PistaProps {
  /** `pantalla.tema` o `modo.pantalla.tema`, único en toda la app. */
  id: string;
  titulo: string;
  cuerpo: string;
  /** Pulsarla cierra también la pista: quien la sigue ya la ha entendido. */
  accion?: AccionPista;
  /** Las del mismo grupo salen de una en una. */
  grupo?: string;
  /** Dentro del grupo, menor número antes. Por defecto, 0. */
  prioridad?: number;
  style?: StyleProp<ViewStyle>;
}

export function Pista({ id, titulo, cuerpo, accion, grupo, prioridad = 0, style }: PistaProps) {
  const { cargado, estado, registros } = useInstantaneaAyuda();

  // Antes de pintar: si no, la segunda del grupo asomaría un instante.
  useLayoutEffect(() => {
    if (!grupo) return;
    return registrarPista({ id, grupo, prioridad });
  }, [id, grupo, prioridad]);

  if (!cargado || !pistaVisible(estado, registros, id, grupo)) return null;

  return (
    <PistaVista
      titulo={titulo}
      cuerpo={cuerpo}
      accion={
        accion && {
          label: accion.label,
          onPress: () => {
            descartarPistaGuardada(id);
            accion.onPress();
          },
        }
      }
      onEntendido={() => descartarPistaGuardada(id)}
      onNoMostrarMas={apagarPistasGuardado}
      style={style}
    />
  );
}

const styles = StyleSheet.create({
  caja: {
    backgroundColor: ink.ink1,
    borderWidth: stroke.hairline,
    borderColor: ink.ink4,
    paddingHorizontal: space.s4,
    paddingTop: space.s4,
    paddingBottom: space.s1,
    gap: space.s2,
  },
  titulo: {
    fontFamily: tipo.headline.family,
    fontSize: tipo.body.size,
    lineHeight: tipo.body.lineHeight,
    color: ink.ink9,
    minWidth: 0,
  },
  cuerpo: {
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink8,
    minWidth: 0,
  },
  acciones: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.s2, marginTop: space.s1 },
  enlace: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' },
  enlacePulsado: { backgroundColor: ink.ink2 },
  enlaceTexto: {
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink6,
    textDecorationLine: 'underline',
  },
});
