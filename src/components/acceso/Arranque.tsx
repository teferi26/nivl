// NIVL · Acceso: lo que se ve en el arranque (`/`, index.tsx) y en una ruta
// que no existe (+not-found.tsx). Puro: solo props. La decisión de adónde ir
// (login, onboarding o Hoy) sigue en index.tsx, intacta.
//
//   · ArranqueCargando → la planta de la arena (Arena ovalo 220 × 140, ink3)
//     con «NIVL» grabado en ink6 encima. Un solo elemento accesible,
//     «Cargando». Nada invertido.
//   · ArranqueError → ErrorSistema (sin su botón) + LA INVERSIÓN «Reintentar»
//     + ghost «Cerrar sesión» (la salida si la cuenta no carga nunca).
//   · FueraDeLaArena → el 404: EncabezadoArena «Ruta» / «FUERA DE LA
//     ARENA», la planta, una línea y LA INVERSIÓN «Volver a la arena».

import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Arena, EncabezadoArena, Entrada, ErrorSistema } from '@/components/arena';
import { Button, Screen } from '@/components/ui';
import { ink, space, type as tipo } from '@/design/tokens';

const ANCHO_OVALO = 220;
const ALTO_OVALO = 140;
const ANCHO = 440;

/** La planta de la arena con algo encima, centrado. */
function Planta({ children }: { children?: ReactNode }) {
  return (
    <View style={styles.planta}>
      <Arena ancho={ANCHO_OVALO} alto={ALTO_OVALO} variante="ovalo" color={ink.ink3} style={styles.ovalo} />
      {children}
    </View>
  );
}

export function ArranqueCargando() {
  return (
    <View
      style={styles.fondo}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="Cargando"
      accessibilityState={{ busy: true }}
    >
      <Planta>
        <Text style={styles.marca} maxFontSizeMultiplier={1}>
          NIVL
        </Text>
      </Planta>
    </View>
  );
}

export interface ArranqueErrorProps {
  /** Ya en la voz del sistema (mensajeSistema). */
  mensaje: string;
  onReintentar: () => void;
  onCerrarSesion: () => void;
}

export function ArranqueError({ mensaje, onReintentar, onCerrarSesion }: ArranqueErrorProps) {
  return (
    <Screen contentStyle={styles.centro}>
      <View style={styles.columna}>
        <Entrada indice={0}>
          <ErrorSistema mensaje={mensaje} />
        </Entrada>
        <Entrada indice={1}>
          <View style={styles.acciones}>
            <Button title="Reintentar" icon="refresh" size="lg" onPress={onReintentar} />
            {/* Salida si la cuenta no carga nunca: sin esto no había forma de cambiar de cuenta. */}
            <Button title="Cerrar sesión" variant="ghost" onPress={onCerrarSesion} style={styles.salida} />
          </View>
        </Entrada>
      </View>
    </Screen>
  );
}

export function FueraDeLaArena({ onVolver }: { onVolver: () => void }) {
  return (
    <Screen contentStyle={styles.centro}>
      <View style={styles.columna}>
        <Entrada indice={0}>
          <EncabezadoArena eyebrow="Ruta" titulo="Fuera de la arena" />
        </Entrada>
        <Entrada indice={1}>
          <Planta />
        </Entrada>
        <Entrada indice={2}>
          <Text style={styles.linea} maxFontSizeMultiplier={1.6}>
            El sistema no reconoce este destino. Puede que el enlace sea viejo o esté mal copiado.
          </Text>
          <Button title="Volver a la arena" size="lg" onPress={onVolver} style={styles.principal} />
        </Entrada>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: ink.ink0, alignItems: 'center', justifyContent: 'center' },
  planta: { width: ANCHO_OVALO, height: ALTO_OVALO, alignSelf: 'center', alignItems: 'center', justifyContent: 'center' },
  ovalo: { position: 'absolute', left: 0, top: 0 },
  marca: {
    fontFamily: tipo.inscripcion.family,
    fontSize: tipo.inscripcion.size,
    lineHeight: tipo.inscripcion.lineHeight,
    letterSpacing: tipo.inscripcion.tracking,
    // El tracking se suma tras la última letra: el mismo hueco delante centra.
    // Placa negra: tapa el eje de la planta detrás de las letras.
    paddingLeft: tipo.inscripcion.tracking + space.s2,
    paddingRight: space.s2,
    backgroundColor: ink.ink0,
    color: ink.ink6,
  },
  centro: { flexGrow: 1, justifyContent: 'center' },
  columna: { width: '100%', maxWidth: ANCHO, alignSelf: 'center' },
  acciones: { marginTop: space.s6 },
  salida: { marginTop: space.s2 },
  linea: {
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink8,
    textAlign: 'center',
    marginTop: space.s6,
  },
  principal: { marginTop: space.s6 },
});
