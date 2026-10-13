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
import { t } from '@/i18n';
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
        {!cargando ? <Entrada indice={0}>
          <EncabezadoArena
            eyebrow={t('puertas:edad.eyebrow')}
            titulo={t('puertas:edad.titulo')}
            subtitulo={t('puertas:edad.subtitulo', { n: p.edadMinima })}
            meandro
          />
        </Entrada> : null}

        <Entrada indice={1} style={styles.pila}>
          {cargando ? (
            <View accessibilityRole="progressbar" accessibilityLabel={t('puertas:cargando')}>
              <Skeleton height={168} />
            </View>
          ) : pendiente ? (
            <>
              <TarjetaArena variante="piedra" remaches rotulo={t('puertas:edad.rotulo')} meta={t('puertas:edad.meta', { n: p.edadMinima })}>
                <Text style={texto.cuerpo} maxFontSizeMultiplier={1.6}>
                  {t('puertas:edad.cuerpo')}
                </Text>
                <Pressable
                  style={[texto.filaMarca, texto.hairline, styles.marca]}
                  accessibilityRole="checkbox"
                  accessibilityLabel={t('puertas:edad.casillaA11y', { n: p.edadMinima })}
                  accessibilityState={{ checked: p.marcada, disabled: guardando || p.saliendo }}
                  disabled={guardando || p.saliendo}
                  onPress={p.onMarcar}
                >
                  <Check checked={p.marcada} size={24} />
                  <Text style={texto.marca} maxFontSizeMultiplier={1.6}>
                    {t('puertas:edad.casilla', { n: p.edadMinima })}
                  </Text>
                </Pressable>
              </TarjetaArena>
              {p.aviso ? <Aviso rotulo={t('puertas:edad.noGuardado')} mensaje={p.aviso} /> : null}
              <Button
                title={t('puertas:edad.confirmar')}
                size="lg"
                onPress={p.onConfirmar}
                disabled={!p.marcada || p.saliendo}
                loading={guardando}
              />
            </>
          ) : bloqueada ? (
            <>
              <Aviso
                rotulo={t('puertas:sinComprobar')}
                mensaje={p.aviso ?? t('puertas:edad.noComprobada')}
              />
              <Button title={t('puertas:volverAComprobar')} variant="secondary" size="lg" onPress={p.onReintentar} disabled={p.saliendo} />
            </>
          ) : null}

          {p.avisoSalida ? <Aviso rotulo={t('puertas:edad.sesionAbierta')} mensaje={p.avisoSalida} /> : null}
          {p.autenticado ? (
            <Button title={t('comun:cerrarSesion')} variant="ghost" onPress={p.onSalir} loading={p.saliendo} />
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
