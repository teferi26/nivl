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
import { Button, Screen, useAnunciar } from '@/components/ui';
import { ink, space, type as tipo } from '@/design/tokens';
import { t } from '@/i18n';
import { checkPassword } from '@/lib/validation';
import { ayudaContrasena, fuerzaDe } from './formulario';
import { CampoContrasena, FuerzaContrasena } from './piezas';

/** Ancho máximo del contenido: en tableta, un formulario de 720 no se lee. */
const ANCHO = 480;

/** El marco común: Screen centrada y el encabezado grabado. */
function MarcoCuenta({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <Screen contentStyle={styles.contenido}>
      <View style={styles.columna}>
        <Entrada indice={0}>
          <EncabezadoArena eyebrow={t('acceso:cuenta.eyebrow')} titulo={titulo} />
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
  // En iOS el rol alerta no habla: el resultado se anuncia a mano.
  useAnunciar(`${rotulo}. ${mensaje}`);
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
  useAnunciar(p.error);

  let cuerpo: ReactNode;
  if (p.fase === 'hecho') {
    cuerpo = (
      <Resultado
        variante="grano"
        rotulo={t('acceso:restablecer.hechoRotulo')}
        mensaje={t('acceso:restablecer.hechoMensaje')}
        boton={t('acceso:restablecer.continuar')}
        onPress={p.onContinuar}
      />
    );
  } else if (p.fase === 'invalido') {
    cuerpo = (
      <Resultado
        variante="trama"
        rotulo={t('acceso:restablecer.invalidoRotulo')}
        mensaje={p.fallo ?? ''}
        boton={t('acceso:cuenta.irAEntrar')}
        onPress={p.onIrAEntrar}
      />
    );
  } else if (p.fase === 'comprobando') {
    cuerpo = <Comprobando texto={t('acceso:restablecer.comprobando')} />;
  } else {
    cuerpo = (
      <View style={styles.pila}>
        <Text style={styles.linea} maxFontSizeMultiplier={1.6}>
          {ayudaContrasena()}
        </Text>
        <CampoContrasena
          etiqueta={t('acceso:restablecer.nueva')}
          ver={p.ver}
          onVer={p.onVer}
          value={p.nueva}
          onChangeText={p.onNueva}
          autoComplete="new-password"
          textContentType="newPassword"
          placeholder={t('acceso:contrasena.placeholder')}
          accessibilityLabel={t('acceso:restablecer.nueva')}
        />
        {p.nueva.length > 0 ? <FuerzaContrasena fuerza={fuerzaDe(pw.strength)} faltas={pw.missing} /> : null}
        <Campo
          etiqueta={t('acceso:contrasena.repite')}
          value={p.repite}
          onChangeText={p.onRepite}
          error={p.repite.length > 0 && !coinciden ? t('acceso:error.noCoinciden') : null}
          secureTextEntry={!p.ver}
          autoCapitalize="none"
          autoComplete="new-password"
          textContentType="newPassword"
          placeholder="••••••••••"
          accessibilityLabel={t('acceso:contrasena.repite')}
          onSubmitEditing={p.onGuardar}
        />

        {p.error ? (
          <View accessibilityRole="alert" accessibilityLiveRegion="assertive">
            <TarjetaArena variante="trama" rotulo={t('acceso:noHaSalido')} style={styles.compacta}>
              <Text style={styles.mensaje} maxFontSizeMultiplier={1.6}>
                {p.error}
              </Text>
            </TarjetaArena>
          </View>
        ) : null}

        <Button
          title={t('acceso:restablecer.guardar')}
          size="lg"
          onPress={p.onGuardar}
          loading={p.enviando}
          disabled={!puede}
          style={styles.principal}
        />
      </View>
    );
  }

  return <MarcoCuenta titulo={t('acceso:restablecer.titulo')}>{cuerpo}</MarcoCuenta>;
}

// ── Confirmar ───────────────────────────────────────────────────────────

export interface ConfirmarVistaProps {
  /** null mientras se canjea el enlace. */
  error: string | null;
  onIrAEntrar: () => void;
}

export function ConfirmarVista({ error, onIrAEntrar }: ConfirmarVistaProps) {
  return (
    <MarcoCuenta titulo={t('acceso:confirmar.titulo')}>
      {error ? (
        <Resultado
          variante="trama"
          rotulo={t('acceso:confirmar.falloRotulo')}
          mensaje={error}
          boton={t('acceso:cuenta.irAEntrar')}
          onPress={onIrAEntrar}
        />
      ) : (
        <Comprobando texto={t('acceso:confirmar.confirmando')} />
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
