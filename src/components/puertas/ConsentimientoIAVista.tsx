// NIVL · Puertas: la vista de la hoja del consentimiento para la IA (FASE3,
// Lote B1). Pura: el cerrojo de la aceptación y la promesa de `asegurar()`
// siguen en ConsentimientoIA.tsx tal cual.
//
// Qué datos van (filas), a quién y dónde (filas), el texto legal sin tocar, el
// descargo de salud en contorno, y en el pie fijo LA inversión «Acepto y
// activo el coach» con «Ahora no» en secondary: decir que no pesa lo mismo.
//
// Va en `HojaPuerta` y no en `Sheet`: consentguard.test.ts monta esta hoja de
// verdad con react-native simulado (sin useWindowDimensions ni Animated) y sin
// simular `@/components/ui`. Por lo mismo, los botones son `SystemButton`
// (simulado allí) y el aviso es un Text con accessibilityRole 'alert' y el
// mensaje como hijo.
import Ionicons from '@expo/vector-icons/Ionicons';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { TarjetaArena } from '@/components/arena';
// eslint-disable-next-line no-restricted-imports -- consentguard.test.ts (Seguridad) simula SystemButton por nombre.
import { SystemButton } from '@/components/SystemButton';
import { ink, space, type as tipo } from '@/design/tokens';
import { DATOS_IA, DESCARGO_SALUD, LINEA_CRISIS, PROVEEDORES_IA, TEXTO_CONSENTIMIENTO as T } from '@/lib/consentmath';
import { LEGAL_URLS } from '@/lib/proplans';
import { HojaPuerta } from './HojaPuerta';
import { texto } from './estilos';

export interface ConsentimientoIAVistaProps {
  visible: boolean;
  ocupada: boolean;
  aviso: string | null;
  onAceptar: () => void;
  onCerrar: () => void;
}

function Filas({ filas }: { filas: { clave: string; titulo: string; detalle: string }[] }) {
  return (
    <View style={styles.filas}>
      {filas.map((f, i) => (
        <View key={f.clave} style={[styles.fila, i > 0 && texto.hairline]}>
          <Text style={styles.filaTitulo} maxFontSizeMultiplier={1.6}>
            {f.titulo}
          </Text>
          <Text style={texto.cuerpo} maxFontSizeMultiplier={1.6}>
            {f.detalle}
          </Text>
        </View>
      ))}
    </View>
  );
}

export function ConsentimientoIAVista({ visible, ocupada, aviso, onAceptar, onCerrar }: ConsentimientoIAVistaProps) {
  return (
    <HojaPuerta
      visible={visible}
      onCerrar={onCerrar}
      eyebrow={T.eyebrow}
      titulo={T.titulo}
      pie={
        <>
          {aviso ? (
            <TarjetaArena variante="trama" style={styles.compacta}>
              <Text style={styles.aviso} accessibilityRole="alert" maxFontSizeMultiplier={1.6}>
                {aviso}
              </Text>
            </TarjetaArena>
          ) : null}
          <SystemButton title={T.aceptar} size="lg" onPress={onAceptar} loading={ocupada} />
          <SystemButton title={T.rechazar} variant="outline" size="lg" onPress={onCerrar} disabled={ocupada} />
        </>
      }
    >
      <Text style={texto.cuerpo} maxFontSizeMultiplier={1.6}>
        {T.intro}
      </Text>
      <Filas filas={DATOS_IA.map((d) => ({ clave: d.titulo, titulo: d.titulo, detalle: d.detalle }))} />

      <Text style={[texto.etiqueta, styles.seccion]} maxFontSizeMultiplier={1.35}>
        {T.aQuien}
      </Text>
      <Filas
        filas={PROVEEDORES_IA.map((p) => ({ clave: p.nombre, titulo: `${p.nombre} · ${p.donde}`, detalle: p.cuando }))}
      />

      {[T.fueraEee, T.paraQue, T.consentimiento, T.sinAceptar].map((parrafo) => (
        <Text key={parrafo} style={[texto.cuerpo, styles.parrafo]} maxFontSizeMultiplier={1.6}>
          {parrafo}
        </Text>
      ))}

      <TarjetaArena variante="contorno" style={styles.descargo}>
        <View style={styles.descargoFila}>
          <Ionicons name="medkit-outline" size={18} color={ink.ink9} style={styles.descargoIcono} />
          <Text style={[texto.mensaje, styles.flex]} maxFontSizeMultiplier={1.6}>
            {DESCARGO_SALUD} {LINEA_CRISIS}
          </Text>
        </View>
      </TarjetaArena>

      <Pressable
        onPress={() => Linking.openURL(LEGAL_URLS.privacidad).catch(() => {})}
        style={[texto.enlaceZona, styles.enlace]}
        accessibilityRole="link"
        accessibilityLabel="Leer la política de privacidad"
      >
        <Text style={texto.enlace}>Leer la política de privacidad</Text>
      </Pressable>
    </HojaPuerta>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  compacta: { paddingVertical: space.s3 },
  filas: { marginTop: space.s3 },
  fila: { gap: space.s1, paddingVertical: space.s3 },
  filaTitulo: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink10,
  },
  seccion: { marginTop: space.s5 },
  parrafo: { marginTop: space.s3 },
  descargo: { marginTop: space.s5 },
  descargoFila: { flexDirection: 'row', gap: space.s3 },
  descargoIcono: { marginTop: 1 },
  enlace: { marginTop: space.s2 },
  aviso: {
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink9,
  },
});
