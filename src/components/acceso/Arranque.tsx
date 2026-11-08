// NIVL · Acceso: lo que se ve en el arranque (`/`, index.tsx) y en una ruta
// que no existe (+not-found.tsx). Puro: solo props. La decisión de adónde ir
// (login, onboarding o Hoy) sigue en index.tsx, intacta.
//
//   · ArranqueCargando → el escudo con la N y «NIVL» debajo. Un solo elemento
//     accesible, «Cargando».
//   · ArranqueError → ErrorSistema (sin su botón) + el botón hueso «Reintentar»
//     + ghost «Cerrar sesión» (la salida si la cuenta no carga nunca).
//   · FueraDeLaArena → el 404: EncabezadoArena «Ruta» / «FUERA DE LA ARENA»,
//     el escudo, una línea y el botón hueso «Volver a la arena».

import { StyleSheet, Text, View } from 'react-native';
import { EncabezadoArena, Entrada, ErrorSistema } from '@/components/arena';
import { Button, FondoOnix, Screen } from '@/components/ui';
import { ink, space, type as tipo } from '@/design/tokens';
import { t } from '@/i18n';
import { Escudo } from './Escudo';

const ANCHO = 440;
const TRACKING_MARCA = 6;

export function ArranqueCargando() {
  return (
    <View
      style={styles.fondo}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={t('acceso:arranque.cargando')}
      accessibilityState={{ busy: true }}
    >
      <FondoOnix />
      <Escudo ancho={88} />
      <Text style={styles.marca} maxFontSizeMultiplier={1}>{/* i18n-ok: la marca */}
        NIVL
      </Text>
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
            <Button title={t('comun:reintentar')} icon="refresh" size="lg" onPress={onReintentar} />
            {/* Salida si la cuenta no carga nunca: sin esto no había forma de cambiar de cuenta. */}
            <Button title={t('comun:cerrarSesion')} variant="ghost" onPress={onCerrarSesion} style={styles.salida} />
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
          <EncabezadoArena eyebrow={t('acceso:fuera.eyebrow')} titulo={t('acceso:fuera.titulo')} />
        </Entrada>
        <Entrada indice={1}>
          <View style={styles.escudo}>
            <Escudo ancho={88} />
          </View>
        </Entrada>
        <Entrada indice={2}>
          <Text style={styles.linea} maxFontSizeMultiplier={1.6}>
            {t('acceso:fuera.cuerpo')}
          </Text>
          <Button title={t('acceso:fuera.volver')} size="lg" onPress={onVolver} style={styles.principal} />
        </Entrada>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: ink.ink0, alignItems: 'center', justifyContent: 'center' },
  escudo: { alignSelf: 'center' },
  marca: {
    fontFamily: tipo.number.family,
    fontSize: tipo.number.size,
    lineHeight: tipo.number.lineHeight,
    letterSpacing: TRACKING_MARCA,
    // El tracking se suma tras la última letra: el mismo hueco delante centra.
    paddingLeft: TRACKING_MARCA,
    color: ink.ink9,
    marginTop: space.s3,
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
