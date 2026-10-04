// NIVL · Puertas: las vistas del permiso de salud (FASE3, Lote B1). Puras: la
// lógica (lectura, cerrojo de la aceptación, tiempo real) sigue en
// ConsentimientoSalud.tsx tal cual.
//
// La puerta: «TU SALUD, CON PERMISO» inscrito, la explicación en piedra (trama
// si hay un borrado pendiente o un fallo), «Revisar permiso» como la inversión
// e «Ir a Perfil» en ghost. Sin poder comprobar: «Volver a comprobar» pasa a
// secondary.
//
// La hoja: el texto del permiso en filas (sin tocar una coma), la casilla con
// Check, LA inversión «Aceptar y activar salud» y «Ahora no» en secondary: el
// mismo peso para decir que no (sin patrón oscuro).
//
// health.test.ts busca el título con `title` (de ahí `ScreenHeader inscrito`,
// el plan B de las puertas, y no EncabezadoArena), los botones por `title` y
// una sola casilla con accessibilityRole 'checkbox' en todo el árbol.
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Entrada, TarjetaArena } from '@/components/arena';
// eslint-disable-next-line no-restricted-imports -- health.test.ts (Seguridad) busca el título por ScreenHeader.
import { Button, Check, Screen, ScreenHeader, Skeleton } from '@/components/ui';
import { ink, space, stroke, type as tipo } from '@/design/tokens';
import { HEALTH_COPY as T } from '@/lib/healthmath';
import { LEGAL_URLS } from '@/lib/proplans';
import { HojaPuerta } from './HojaPuerta';
import { ANCHO_PUERTA, texto } from './estilos';

export interface PuertaSaludVistaProps {
  cargando: boolean;
  error: string | null;
  borradoPendiente: boolean;
  onVolver: () => void;
  onRevisar: () => void;
  onReintentar: () => void;
  onPerfil: () => void;
}

export function PuertaSaludVista(p: PuertaSaludVistaProps) {
  return (
    <Screen>
      <View style={styles.columna}>
        <Entrada indice={0}>
          <ScreenHeader inscrito eyebrow="Opcional" title="Tu salud, con permiso" onBack={p.onVolver} />
        </Entrada>
        <Entrada indice={1} style={styles.pila}>
          {p.cargando ? (
            <View accessibilityRole="progressbar" accessibilityLabel="Comprobando permiso de salud">
              <Skeleton height={110} />
            </View>
          ) : (
            <>
              <TarjetaArena
                variante={p.borradoPendiente ? 'trama' : 'piedra'}
                remaches={!p.borradoPendiente}
                rotulo={p.borradoPendiente ? 'Borrado pendiente' : 'Registro de salud'}
              >
                <Text style={texto.mensaje} maxFontSizeMultiplier={1.6}>
                  {p.borradoPendiente
                    ? 'Tu permiso está retirado y hay un borrado pendiente. Puedes terminarlo en Perfil.'
                    : 'Antes de abrir este registro, revisa qué datos de salud guarda NIVL y decide si quieres activarlo.'}
                </Text>
              </TarjetaArena>
              {p.error ? (
                <TarjetaArena variante="trama" rotulo="Sin comprobar" style={styles.compacta}>
                  <Text style={texto.mensaje} accessibilityRole="alert" maxFontSizeMultiplier={1.6}>
                    {p.error}
                  </Text>
                </TarjetaArena>
              ) : null}
              <Button
                title={p.error ? 'Volver a comprobar' : 'Revisar permiso'}
                variant={p.error ? 'secondary' : 'primary'}
                size="lg"
                onPress={p.error ? p.onReintentar : p.onRevisar}
                disabled={p.borradoPendiente}
              />
              <Button title="Ir a Perfil" variant="ghost" onPress={p.onPerfil} />
            </>
          )}
        </Entrada>
      </View>
    </Screen>
  );
}

/** Las cuatro partes del permiso, con su rótulo. El texto es el de HEALTH_COPY. */
const PARTES = [
  { rotulo: 'Para qué', texto: T.purpose },
  { rotulo: 'Quién y dónde', texto: T.storage },
  { rotulo: 'Es opcional', texto: T.choice },
  { rotulo: 'Retirarlo', texto: T.withdrawal },
] as const;

export interface HojaSaludVistaProps {
  visible: boolean;
  marcada: boolean;
  ocupada: boolean;
  error: string | null;
  onMarcar: () => void;
  onAceptar: () => void;
  onCancelar: () => void;
  /** Fallo al abrir la política (lo pinta como error de la hoja). */
  onErrorEnlace: (mensaje: string) => void;
}

export function HojaSaludVista(p: HojaSaludVistaProps) {
  return (
    <HojaPuerta
      visible={p.visible}
      onCerrar={p.onCancelar}
      eyebrow="Permiso de salud"
      titulo={T.title}
      pie={
        <>
          {p.error ? (
            <TarjetaArena variante="trama" style={styles.compacta}>
              <Text style={styles.error} accessibilityRole="alert" maxFontSizeMultiplier={1.6}>
                {p.error}
              </Text>
            </TarjetaArena>
          ) : null}
          <Button title="Aceptar y activar salud" size="lg" onPress={p.onAceptar} disabled={!p.marcada} loading={p.ocupada} />
          <Button title="Ahora no" variant="secondary" size="lg" onPress={p.onCancelar} disabled={p.ocupada} />
        </>
      }
    >
      {PARTES.map((parte, i) => (
        <View key={parte.rotulo} style={[styles.fila, i > 0 && texto.hairline]}>
          <Text style={texto.etiqueta} maxFontSizeMultiplier={1.35}>
            {parte.rotulo}
          </Text>
          <Text style={texto.cuerpo} maxFontSizeMultiplier={1.6}>
            {parte.texto}
          </Text>
        </View>
      ))}
      <Pressable
        style={texto.enlaceZona}
        accessibilityRole="link"
        accessibilityLabel="Leer la política de privacidad"
        onPress={() => Linking.openURL(LEGAL_URLS.privacidad).catch(() => p.onErrorEnlace('No se ha podido abrir la política.'))}
      >
        <Text style={texto.enlace}>Leer la política de privacidad</Text>
      </Pressable>
      <Pressable
        style={[texto.filaMarca, styles.casilla, p.marcada && styles.casillaMarcada]}
        accessibilityRole="checkbox"
        accessibilityLabel={T.checkbox}
        accessibilityState={{ checked: p.marcada, disabled: p.ocupada }}
        disabled={p.ocupada}
        onPress={p.onMarcar}
      >
        <Check checked={p.marcada} size={24} />
        <Text style={[texto.mensaje, styles.flex]} maxFontSizeMultiplier={1.6}>
          {T.checkbox}
        </Text>
      </Pressable>
    </HojaPuerta>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  columna: { width: '100%', maxWidth: ANCHO_PUERTA, alignSelf: 'center' },
  pila: { gap: space.s4 },
  compacta: { paddingVertical: space.s3 },
  fila: { gap: space.s1, paddingVertical: space.s3 },
  casilla: {
    marginTop: space.s3,
    paddingHorizontal: space.s3,
    borderWidth: stroke.hairline,
    borderColor: ink.ink4,
    backgroundColor: ink.ink2,
  },
  // Marcada: el marco engorda a 2 en ink10 (jerarquía por trazo, sin invertir).
  casillaMarcada: { borderWidth: stroke.rule, borderColor: ink.ink10 },
  error: {
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink9,
  },
});
