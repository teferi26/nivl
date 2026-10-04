// NIVL · Puertas: la vista de la edad mínima (FASE3, Lote B1). Pura: el
// estado y las acciones llegan de `ConfirmacionEdad` (EdadMinima.tsx), que
// conserva la lógica tal cual.
//
// Pendiente: losa de piedra con remaches y la casilla; LA inversión es
// «Confirmar y continuar». Bloqueada (no se pudo leer): trama con el motivo,
// «Volver a comprobar» en secondary y «Cerrar sesión» en ghost.
//
// Solo piezas que las pruebas de Seguridad simulan (age.test.ts): Screen,
// Skeleton, Check y Button de `@/components/ui`; EncabezadoArena, Entrada y
// TarjetaArena de `@/components/arena`. Los títulos de los botones no cambian.
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { EncabezadoArena, Entrada, TarjetaArena } from '@/components/arena';
import { Button, Check, Screen, Skeleton } from '@/components/ui';
import { space } from '@/design/tokens';
import { ANCHO_PUERTA, texto } from './estilos';

export type EstadoEdad = 'cargando' | 'pendiente' | 'guardando' | 'confirmada' | 'error';

export interface EdadVistaProps {
  edadMinima: number;
  /** Sesión ya resuelta: sin ella solo se ve la carga. */
  autenticado: boolean;
  estado: EstadoEdad;
  /** Fallo al leer o al guardar, ya en la voz del sistema. */
  aviso: string | null;
  /** Fallo al cerrar sesión. */
  avisoSalida: string | null;
  marcada: boolean;
  saliendo: boolean;
  onMarcar: () => void;
  onConfirmar: () => void;
  onReintentar: () => void;
  onSalir: () => void;
}

function Aviso({ rotulo, mensaje }: { rotulo: string; mensaje: string }) {
  return (
    <TarjetaArena variante="trama" rotulo={rotulo} style={styles.compacta}>
      <Text style={texto.mensaje} accessibilityRole="alert" maxFontSizeMultiplier={1.6}>
        {mensaje}
      </Text>
    </TarjetaArena>
  );
}

export function EdadVista(p: EdadVistaProps) {
  const cargando = !p.autenticado || p.estado === 'cargando';
  const pendiente = p.estado === 'pendiente' || p.estado === 'guardando';
  const bloqueada = p.autenticado && !cargando && !pendiente;
  const guardando = p.estado === 'guardando';

  return (
    <Screen contentStyle={styles.contenido}>
      <View style={styles.columna}>
        <Entrada indice={0}>
          <EncabezadoArena
            eyebrow="Antes de entrar"
            titulo="Tu edad"
            subtitulo={`NIVL es para personas de ${p.edadMinima} años o más.`}
            meandro
          />
        </Entrada>

        <Entrada indice={1} style={styles.pila}>
          {cargando ? (
            <View accessibilityRole="progressbar" accessibilityLabel="Comprobando la confirmación de edad">
              <Skeleton height={168} />
            </View>
          ) : pendiente ? (
            <>
              <TarjetaArena variante="piedra" remaches rotulo="Edad mínima" meta={`${p.edadMinima} o más`}>
                <Text style={texto.cuerpo} maxFontSizeMultiplier={1.6}>
                  Confirma que cumples la edad mínima para continuar. No hace falta indicar tu fecha de nacimiento.
                </Text>
                <Pressable
                  style={[texto.filaMarca, texto.hairline, styles.marca]}
                  accessibilityRole="checkbox"
                  accessibilityLabel={`Tengo ${p.edadMinima} años o más`}
                  accessibilityState={{ checked: p.marcada, disabled: guardando || p.saliendo }}
                  disabled={guardando || p.saliendo}
                  onPress={p.onMarcar}
                >
                  <Check checked={p.marcada} size={24} />
                  <Text style={texto.marca} maxFontSizeMultiplier={1.6}>
                    Tengo {p.edadMinima} años o más.
                  </Text>
                </Pressable>
              </TarjetaArena>
              {p.aviso ? <Aviso rotulo="No se ha guardado" mensaje={p.aviso} /> : null}
              <Button
                title="Confirmar y continuar"
                size="lg"
                onPress={p.onConfirmar}
                disabled={!p.marcada || p.saliendo}
                loading={guardando}
              />
            </>
          ) : bloqueada ? (
            <>
              <Aviso
                rotulo="Sin comprobar"
                mensaje={p.aviso ?? 'No se ha podido comprobar tu confirmación de edad.'}
              />
              <Button title="Volver a comprobar" variant="secondary" size="lg" onPress={p.onReintentar} disabled={p.saliendo} />
            </>
          ) : null}

          {p.avisoSalida ? <Aviso rotulo="Sesión abierta" mensaje={p.avisoSalida} /> : null}
          {p.autenticado ? (
            <Button title="Cerrar sesión" variant="ghost" onPress={p.onSalir} loading={p.saliendo} />
          ) : null}
        </Entrada>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  contenido: { flexGrow: 1, justifyContent: 'center', paddingTop: space.s8 },
  columna: { width: '100%', maxWidth: ANCHO_PUERTA, alignSelf: 'center' },
  pila: { gap: space.s4 },
  marca: { marginTop: space.s4 },
  compacta: { paddingVertical: space.s3 },
});
