// NIVL · Acceso: las pantallas del enlace del correo (Fase 3, Lote A). Puras:
// solo props. El canje del enlace (useEnlaceCorreo) y el guardado viven en las
// rutas /auth/restablecer y /auth/confirmar; la galería pinta estas vistas con
// datos de mentira (demo.tsx).
//
//   · EncabezadoArena con eyebrow «Cuenta»: «NUEVA CONTRASEÑA» o «CONFIRMAR
//     CORREO».
//   · Comprobando: CargaArena con la forma de lo que viene.
//   · Formulario (restablecer): dos campos, la fuerza y LA INVERSIÓN «Guardar
//     contraseña».
//   · Hecho: TarjetaArena grano. Inválido o fallo: trama. En los dos, la
//     salida es el botón principal (la única inversión del estado).

import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Campo, CargaArena, EncabezadoArena, Entrada, TarjetaArena } from '@/components/arena';
import { Button, Screen } from '@/components/ui';
import { ink, space, type as tipo } from '@/design/tokens';
import { checkPassword } from '@/lib/validation';
import { AYUDA_CONTRASENA, FUERZA } from './formulario';
import { CampoContrasena, FuerzaContrasena } from './piezas';

/** Ancho máximo del contenido: en tableta, un formulario de 720 no se lee. */
const ANCHO = 480;

/** El marco común: Screen centrada y el encabezado grabado. */
function MarcoCuenta({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <Screen contentStyle={styles.contenido}>
      <View style={styles.columna}>
        <Entrada indice={0}>
          <EncabezadoArena eyebrow="Cuenta" titulo={titulo} />
        </Entrada>
        <Entrada indice={1}>{children}</Entrada>
      </View>
    </Screen>
  );
}

function Comprobando({ texto }: { texto: string }) {
  return (
    <View style={styles.pila}>
      <Text style={styles.linea} maxFontSizeMultiplier={1.6}>
        {texto}…
      </Text>
      <CargaArena etiqueta={texto} formas={['tarjeta']} />
    </View>
  );
}

function Resultado({
  variante,
  rotulo,
  mensaje,
  boton,
  onPress,
}: {
  variante: 'grano' | 'trama';
  rotulo: string;
  mensaje: string;
  boton: string;
  onPress: () => void;
}) {
  return (
    <View style={styles.pila}>
      <View accessibilityRole="alert" accessibilityLiveRegion="polite">
        <TarjetaArena variante={variante} rotulo={rotulo}>
          <Text style={styles.mensaje} maxFontSizeMultiplier={1.6}>
            {mensaje}
          </Text>
        </TarjetaArena>
      </View>
      <Button title={boton} size="lg" onPress={onPress} />
    </View>
  );
}

// ── Restablecer ─────────────────────────────────────────────────────────

export type FaseRestablecer = 'comprobando' | 'formulario' | 'hecho' | 'invalido';

export interface RestablecerVistaProps {
  fase: FaseRestablecer;
  /** Por qué no vale el enlace (solo en `invalido`). */
  fallo: string | null;
  /** Correo de la sesión de recuperación: la contraseña no puede contenerlo. */
  correo?: string;
  nueva: string;
  repite: string;
  ver: boolean;
  /** Error del servidor al guardar, ya en la voz del sistema. */
  error: string | null;
  enviando: boolean;
  onNueva: (v: string) => void;
  onRepite: (v: string) => void;
  onVer: () => void;
  onGuardar: () => void;
  onContinuar: () => void;
  onIrAEntrar: () => void;
}

export function RestablecerVista(p: RestablecerVistaProps) {
  const pw = checkPassword(p.nueva, p.correo);
  const coinciden = p.nueva === p.repite;
  const puede = pw.ok && coinciden && !p.enviando;

  let cuerpo: ReactNode;
  if (p.fase === 'hecho') {
    cuerpo = (
      <Resultado
        variante="grano"
        rotulo="Contraseña cambiada"
        mensaje="Ya puedes usarla para entrar en NIVL."
        boton="Continuar"
        onPress={p.onContinuar}
      />
    );
  } else if (p.fase === 'invalido') {
    cuerpo = (
      <Resultado
        variante="trama"
        rotulo="Enlace no válido"
        mensaje={p.fallo ?? ''}
        boton="Ir a entrar"
        onPress={p.onIrAEntrar}
      />
    );
  } else if (p.fase === 'comprobando') {
    cuerpo = <Comprobando texto="Comprobando el enlace" />;
  } else {
    cuerpo = (
      <View style={styles.pila}>
        <Text style={styles.linea} maxFontSizeMultiplier={1.6}>
          {AYUDA_CONTRASENA}
        </Text>
        <CampoContrasena
          etiqueta="Contraseña nueva"
          ver={p.ver}
          onVer={p.onVer}
          value={p.nueva}
          onChangeText={p.onNueva}
          autoComplete="new-password"
          textContentType="newPassword"
          placeholder="Una frase que recuerdes"
          accessibilityLabel="Contraseña nueva"
        />
        {p.nueva.length > 0 ? <FuerzaContrasena fuerza={FUERZA[pw.strength]} faltas={pw.missing} /> : null}
        <Campo
          etiqueta="Repite la contraseña"
          value={p.repite}
          onChangeText={p.onRepite}
          error={p.repite.length > 0 && !coinciden ? 'Las contraseñas no coinciden.' : null}
          secureTextEntry={!p.ver}
          autoCapitalize="none"
          autoComplete="new-password"
          textContentType="newPassword"
          placeholder="••••••••••"
          accessibilityLabel="Repite la contraseña"
          onSubmitEditing={p.onGuardar}
        />

        {p.error ? (
          <View accessibilityRole="alert" accessibilityLiveRegion="assertive">
            <TarjetaArena variante="trama" rotulo="No ha salido" style={styles.compacta}>
              <Text style={styles.mensaje} maxFontSizeMultiplier={1.6}>
                {p.error}
              </Text>
            </TarjetaArena>
          </View>
        ) : null}

        <Button
          title="Guardar contraseña"
          size="lg"
          onPress={p.onGuardar}
          loading={p.enviando}
          disabled={!puede}
          style={styles.principal}
        />
      </View>
    );
  }

  return <MarcoCuenta titulo="Nueva contraseña">{cuerpo}</MarcoCuenta>;
}

// ── Confirmar ───────────────────────────────────────────────────────────

export interface ConfirmarVistaProps {
  /** null mientras se canjea el enlace. */
  error: string | null;
  onIrAEntrar: () => void;
}

export function ConfirmarVista({ error, onIrAEntrar }: ConfirmarVistaProps) {
  return (
    <MarcoCuenta titulo="Confirmar correo">
      {error ? (
        <Resultado
          variante="trama"
          rotulo="No se ha podido confirmar"
          mensaje={error}
          boton="Ir a entrar"
          onPress={onIrAEntrar}
        />
      ) : (
        <Comprobando texto="Confirmando tu correo" />
      )}
    </MarcoCuenta>
  );
}

const styles = StyleSheet.create({
  contenido: { flexGrow: 1, justifyContent: 'center', paddingTop: space.s6 },
  columna: { width: '100%', maxWidth: ANCHO, alignSelf: 'center' },
  pila: { gap: space.s5 },
  linea: {
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink8,
  },
  mensaje: {
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink9,
  },
  compacta: { paddingVertical: space.s3 },
  principal: { marginTop: space.s2 },
});
