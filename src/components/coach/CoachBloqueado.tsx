// NIVL · El Coach de una cuenta sin NIVL Pro (L-RADICAL §B.2.3, movido de la
// ruta). El mismo contenido que el vacío, pero la galea va en una losa de
// contorno con remaches: la puerta del coach, cerrada. No es trama: la trama
// es alerta y una cuenta sin Pro no es un error. Debajo, lo que haría hoy
// por este perfil y una muestra de su brief. La inversión de este estado es
// el botón de respaldo «Ver NIVL Pro» (sin compositor no hay enviar).

import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';
import { Entrada, Galea, TarjetaArena } from '@/components/arena';
import { ProUpsellLine } from '@/components/ProOffer';
import { Button } from '@/components/ui';
import { ink, space, stroke, type } from '@/design/tokens';
import type { DecisionOferta } from '@/lib/paywallmoment';
import { proSampleBrief, proToday } from '@/lib/proplans';

/** La galea de la losa: la misma del vacío. */
const GALEA = 96;

/**
 * La pestaña de una cuenta sin NIVL Pro. No es un error ni un muro en blanco:
 * enseña lo que el coach estaría haciendo hoy por este perfil y el camino a
 * Pro. El resto de la app no se toca.
 */
export function CoachBloqueado({
  kind,
  onPro,
  oferta,
}: {
  kind: unknown;
  onPro: () => void;
  /** El nivel de la línea de la oferta (`coach_cerrado`), o null: entonces el botón. */
  oferta: DecisionOferta['tier'] | null;
}) {
  const muestra = proSampleBrief(kind);
  return (
    <View style={styles.bloqueado}>
      <Entrada indice={0}>
        <TarjetaArena variante="contorno" remaches>
          <View style={styles.losa}>
            <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none">
              <Galea kind="casco" size={GALEA} color={ink.ink10} />
            </View>
            {/* Con la línea de la oferta, «El coach es parte de NIVL Pro» ya lo
                dice ella: el título no lo repite. */}
            <Text style={styles.titulo} accessibilityRole="header" maxFontSizeMultiplier={1.35}>
              {oferta ? 'EL COACH NO ESTÁ EN TU PLAN.' : 'EL COACH ES PARTE DE NIVL PRO.'}
            </Text>
            <Text style={styles.texto}>
              Tus misiones, tu racha, tus campañas y todos los módulos siguen siendo tuyos. Lo que falta es quien lo
              dirige.
            </Text>
          </View>
        </TarjetaArena>
      </Entrada>

      <Entrada indice={1}>
        <TarjetaArena variante="contorno" rotulo="Hoy estaría">
          {proToday(kind).map((linea, i) => (
            <View key={linea} style={[styles.fila, i > 0 && styles.filaSep]}>
              <Ionicons name="remove-outline" size={14} color={ink.ink6} style={styles.filaIcono} />
              <Text style={styles.filaTexto}>{linea}</Text>
            </View>
          ))}
        </TarjetaArena>
      </Entrada>

      {/* Cómo suena un brief de verdad. Es una muestra y se dice: nada aquí
          sale de los datos de esta cuenta. */}
      <Entrada indice={2}>
        <TarjetaArena variante="piedra" rotulo="Un brief suyo" meta="Ejemplo">
          <View accessible accessibilityLabel={`Ejemplo de brief del coach. ${muestra.join(' ')}`}>
            {muestra.map((linea, i) => (
              <Text key={linea} style={[styles.muestraLinea, i > 0 && styles.muestraSep]}>
                {linea}
              </Text>
            ))}
          </View>
        </TarjetaArena>
      </Entrada>

      {/* Sin decisión (o si no toca), el botón: la pantalla nunca se queda sin salida. */}
      <Entrada indice={3}>
        {oferta ? (
          <ProUpsellLine momento="coach_cerrado" tier={oferta} />
        ) : (
          <Button title="Ver NIVL Pro" onPress={onPro} />
        )}
      </Entrada>
    </View>
  );
}

const lectura = { fontFamily: type.bodySm.family, fontSize: type.bodySm.size, lineHeight: type.bodySm.lineHeight } as const;

const styles = StyleSheet.create({
  bloqueado: { gap: space.s4, paddingTop: space.s2, paddingBottom: space.s6 },
  losa: { alignItems: 'center', paddingVertical: space.s3 },
  titulo: {
    fontFamily: type.inscripcion.family,
    fontSize: type.inscripcion.size,
    lineHeight: type.inscripcion.lineHeight,
    letterSpacing: type.inscripcion.tracking,
    color: ink.ink10,
    textAlign: 'center',
    marginTop: space.s4,
  },
  texto: {
    fontFamily: type.body.family,
    fontSize: type.body.size,
    lineHeight: type.body.lineHeight,
    color: ink.ink8,
    textAlign: 'center',
    marginTop: space.s3,
  },
  fila: { flexDirection: 'row', gap: space.s3 - 2, paddingVertical: space.s2 },
  filaSep: { borderTopWidth: stroke.hairline, borderTopColor: ink.ink3 },
  filaIcono: { marginTop: 3 },
  filaTexto: { ...lectura, flex: 1, minWidth: 0, color: ink.ink9 },
  muestraLinea: { ...lectura, color: ink.ink8 },
  muestraSep: { marginTop: space.s2 },
});
