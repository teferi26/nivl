// NIVL · Cardio: la hoja «Nueva sesión» (FASE3 Lote E1). Pura: el formulario,
// la validación y el pago viven en useCardio.
//
// Chips radio de tipo (con icono) y de zona, y Campo de duración, distancia
// (solo si el tipo la mide), RPE, pulso y notas. Los fallos van en línea: el
// del dato en su Campo y el del servidor en ErrorSistema compacto. Pie:
// primary «Registrar sesión» + ghost «Cancelar».

import { StyleSheet, Text, View } from 'react-native';
import { Campo, ErrorSistema } from '@/components/arena';
import { Button, Chip, ChipWrap, Sheet } from '@/components/ui';
import { ink, space, type as tipo } from '@/design/tokens';
import type { CardioKind, CardioZone } from '@/lib/bodywork';
import { ETIQUETA, ICONO, PIDE_DISTANCIA, TIPOS, ZONA, ZONAS } from './tipos';

export interface ErroresCardio {
  duracion: string | null;
  distancia: string | null;
  rpe: string | null;
  /** Lo que ha contestado el sistema al guardar, ya escrito para el usuario. */
  servidor: string | null;
}

export interface HojaCardioProps {
  visible: boolean;
  kind: CardioKind;
  zone: CardioZone;
  duracion: string;
  distancia: string;
  rpe: string;
  pulso: string;
  notas: string;
  guardando: boolean;
  errores: ErroresCardio;
  onKind: (k: CardioKind) => void;
  onZone: (z: CardioZone) => void;
  onDuracion: (v: string) => void;
  onDistancia: (v: string) => void;
  onRpe: (v: string) => void;
  onPulso: (v: string) => void;
  onNotas: (v: string) => void;
  onGuardar: () => void;
  onCerrar: () => void;
}

export function HojaCardio({
  visible,
  kind,
  zone,
  duracion,
  distancia,
  rpe,
  pulso,
  notas,
  guardando,
  errores,
  onKind,
  onZone,
  onDuracion,
  onDistancia,
  onRpe,
  onPulso,
  onNotas,
  onGuardar,
  onCerrar,
}: HojaCardioProps) {
  return (
    <Sheet
      visible={visible}
      onClose={onCerrar}
      eyebrow="Nueva sesión"
      title="¿Qué has movido hoy?"
      footer={
        <>
          <Button title="Registrar sesión" onPress={onGuardar} loading={guardando} />
          <Button title="Cancelar" variant="ghost" onPress={onCerrar} />
        </>
      }
    >
      <View style={styles.pila}>
        <View style={styles.grupo}>
          <Text style={styles.etiqueta} maxFontSizeMultiplier={1.35}>
            Tipo
          </Text>
          <View accessibilityRole="radiogroup" accessibilityLabel="Tipo de sesión">
            <ChipWrap>
              {TIPOS.map((k) => (
                <Chip
                  key={k}
                  label={ETIQUETA[k]}
                  icon={ICONO[k]}
                  selected={kind === k}
                  onPress={() => onKind(k)}
                  accessibilityLabel={ETIQUETA[k]}
                />
              ))}
            </ChipWrap>
          </View>
        </View>

        <View style={styles.grupo}>
          <Text style={styles.etiqueta} maxFontSizeMultiplier={1.35}>
            Zona
          </Text>
          <View accessibilityRole="radiogroup" accessibilityLabel="Zona de esfuerzo">
            <ChipWrap>
              {ZONAS.map((z) => (
                <Chip
                  key={z}
                  label={ZONA[z]}
                  selected={zone === z}
                  onPress={() => onZone(z)}
                  accessibilityLabel={`Zona ${ZONA[z]}`}
                />
              ))}
            </ChipWrap>
          </View>
          <Text style={styles.ayuda} maxFontSizeMultiplier={1.6}>
            Z2 es el motor: ritmo al que puedes hablar en frases completas. Es el 80 % del volumen y el que
            construye la base.
          </Text>
        </View>

        <View style={styles.dos}>
          <Campo
            etiqueta="Duración (min)"
            value={duracion}
            onChangeText={onDuracion}
            keyboardType="decimal-pad"
            placeholder="30"
            accessibilityLabel="Duración en minutos"
            error={errores.duracion}
            estiloBloque={styles.columna}
          />
          {PIDE_DISTANCIA[kind] ? (
            <Campo
              etiqueta="Distancia (km)"
              value={distancia}
              onChangeText={onDistancia}
              keyboardType="decimal-pad"
              placeholder="5,2"
              accessibilityLabel="Distancia en kilómetros"
              error={errores.distancia}
              estiloBloque={styles.columna}
            />
          ) : (
            <View style={styles.columna} />
          )}
        </View>

        <View style={styles.dos}>
          <Campo
            etiqueta="Esfuerzo (RPE 1-10)"
            value={rpe}
            onChangeText={onRpe}
            keyboardType="decimal-pad"
            placeholder="6"
            accessibilityLabel="Esfuerzo percibido de 1 a 10"
            error={errores.rpe}
            estiloBloque={styles.columna}
          />
          <Campo
            etiqueta="Pulso medio"
            value={pulso}
            onChangeText={onPulso}
            keyboardType="number-pad"
            placeholder="142"
            accessibilityLabel="Pulsaciones medias"
            estiloBloque={styles.columna}
          />
        </View>

        <Campo
          etiqueta="Notas"
          value={notas}
          onChangeText={onNotas}
          multiline
          placeholder="Cómo fue, molestias, terreno"
          accessibilityLabel="Notas de la sesión"
        />

        {errores.servidor ? <ErrorSistema compacto mensaje={errores.servidor} /> : null}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  pila: { gap: space.s5 },
  grupo: { gap: space.s2 },
  etiqueta: {
    fontFamily: tipo.label.family,
    fontSize: tipo.label.size,
    lineHeight: tipo.label.lineHeight,
    letterSpacing: tipo.label.tracking,
    textTransform: 'uppercase',
    color: ink.ink6,
  },
  ayuda: {
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink6,
  },
  dos: { flexDirection: 'row', alignItems: 'flex-start', gap: space.s3 },
  columna: { flex: 1, minWidth: 0 },
});
