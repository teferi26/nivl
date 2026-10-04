// NIVL · Perfil: las tres hojas de la ruta (FASE3 Lote B2). Puras: los datos,
// los cerrojos y los efectos viven en usePerfil; aquí solo se pinta.
//
//   · HojaBorrar → lo que se pierde en una tarjeta de trama, el aviso de la
//     suscripción según la plataforma, el de creador en texto plano (sin
//     enlace: regla de las tiendas) y un Campo donde hay que escribir
//     «ELIMINAR». Pie: danger «Eliminar para siempre» (apagado hasta que la
//     palabra cuadra) + ghost «Cancelar». El danger sigue llamando a
//     `confirmar()` de usePerfil: borrar la cuenta no tiene vuelta atrás y
//     la segunda pregunta se queda aunque el Campo ya frene el roce.
//   · HojaPausa  → chips del motivo y de los días; INVERSIÓN «Activar pausa».
//   · HojaCodigo → Campo grande en Cinzel (rank); INVERSIÓN «Guardar código».
//
// Los fallos van en línea (ErrorSistema compacto): nada de avisos encima de
// una hoja abierta.

import { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { Campo, ErrorSistema, TarjetaArena } from '@/components/arena';
import { Button, Chip, ChipWrap, Sheet } from '@/components/ui';
import { ink, space, type as tipo } from '@/design/tokens';
import { CODIGO_MAX_LENGTH } from '@/lib/creatormath';
import { addDays, nombreDia } from '@/lib/dates';

/** La palabra que hay que escribir para poder borrar la cuenta. */
export const PALABRA_BORRAR = 'ELIMINAR';

/** ¿Lo escrito es «ELIMINAR»? Sin distinguir mayúsculas ni espacios de los lados. */
export function palabraCuadra(escrito: string): boolean {
  return escrito.trim().toLocaleUpperCase('es-ES') === PALABRA_BORRAR;
}

// En iOS no se nombra Google Play (guideline 2.3.10), y al revés.
const AVISO_SUSCRIPCION =
  Platform.OS === 'android'
    ? 'Borrar la cuenta no cancela una suscripción de NIVL Pro: cancélala en Play Store > Pagos y suscripciones > Suscripciones.'
    : Platform.OS === 'ios'
      ? 'Borrar la cuenta no cancela una suscripción de NIVL Pro: cancélala en Ajustes > tu nombre > Suscripciones.'
      : 'Borrar la cuenta no cancela una suscripción de NIVL Pro: cancélala en la tienda donde la contrataste.';

export interface HojaBorrarProps {
  abierta: boolean;
  cerrar: () => void;
  aviso: string | null;
  esCreador: boolean;
  borrando: boolean;
  confirmar: () => void;
  /** Solo la galería: lo escrito de partida en el Campo. */
  escritoInicial?: string;
}

export function HojaBorrar({ abierta, cerrar, aviso, esCreador, borrando, confirmar, escritoInicial = '' }: HojaBorrarProps) {
  const [escrito, setEscrito] = useState(escritoInicial);
  // Cada vez que se abre, el Campo empieza vacío: la palabra no se queda puesta.
  useEffect(() => {
    if (abierta) setEscrito(escritoInicial);
  }, [abierta, escritoInicial]);

  const cuadra = palabraCuadra(escrito);
  const cerrarSiSePuede = () => {
    if (!borrando) cerrar();
  };

  return (
    <Sheet
      visible={abierta}
      onClose={cerrarSiSePuede}
      eyebrow="Eliminar cuenta"
      title="Borrar para siempre"
      footer={
        <>
          <Button
            title="Eliminar para siempre"
            variant="danger"
            icon="trash-outline"
            onPress={confirmar}
            loading={borrando}
            disabled={!cuadra}
          />
          <Button title="Cancelar" variant="ghost" onPress={cerrarSiSePuede} disabled={borrando} />
        </>
      }
    >
      <View style={styles.pila}>
        <TarjetaArena variante="trama" rotulo="Lo que se pierde">
          <View style={styles.pilaCorta}>
            <Text style={styles.cuerpo}>
              Se borran tu perfil, misiones, campañas, diario, datos de cuerpo y dinero, la conversación con el coach,
              tus fotos y todo tu progreso. No hay vuelta atrás.
            </Text>
            <Text style={styles.nota}>{AVISO_SUSCRIPCION}</Text>
          </View>
        </TarjetaArena>

        {esCreador ? (
          <Text style={styles.nota}>
            Eres creador del programa. Si borras la cuenta, tu código se desactiva; el saldo ya generado se te sigue
            pagando: escríbenos a soporte para darnos tus datos de pago.
          </Text>
        ) : null}

        <Campo
          etiqueta={`Escribe ${PALABRA_BORRAR} para confirmar`}
          grande="rank"
          value={escrito}
          onChangeText={setEscrito}
          placeholder={PALABRA_BORRAR}
          autoCapitalize="characters"
          autoCorrect={false}
          autoComplete="off"
          spellCheck={false}
          editable={!borrando}
          maxLength={20}
          returnKeyType="done"
          ayuda={cuadra ? 'Listo. El botón de abajo borra la cuenta.' : 'Hasta que la palabra cuadre, el botón no se activa.'}
          accessibilityLabel={`Escribe ${PALABRA_BORRAR} para poder borrar la cuenta`}
        />

        {aviso ? <ErrorSistema compacto mensaje={aviso} /> : null}
      </View>
    </Sheet>
  );
}

export interface HojaPausaProps {
  abierta: boolean;
  cerrar: () => void;
  motivo: string;
  setMotivo: (m: string) => void;
  dias: number;
  setDias: (d: number) => void;
  activar: () => void;
  /** El fallo al activar, en línea dentro de la hoja. */
  aviso?: string | null;
  /** Activando: el botón muestra la carga y no admite un segundo toque. */
  ocupado?: boolean;
  /** Hoy (AAAA-MM-DD): de aquí sale el día en que se reanuda. */
  today: string;
  motivos: readonly string[];
  duraciones: readonly number[];
}

const textoDias = (d: number) => `${d} día${d > 1 ? 's' : ''}`;

export function HojaPausa({
  abierta,
  cerrar,
  motivo,
  setMotivo,
  dias,
  setDias,
  activar,
  aviso = null,
  ocupado = false,
  today,
  motivos,
  duraciones,
}: HojaPausaProps) {
  const cerrarSiSePuede = () => {
    if (!ocupado) cerrar();
  };
  return (
    <Sheet
      visible={abierta}
      onClose={cerrarSiSePuede}
      eyebrow="Pausar el sistema"
      title="¿Cuánto tiempo?"
      footer={
        <>
          <Button title="Activar pausa" size="lg" icon="snow-outline" onPress={activar} loading={ocupado} />
          <Button title="Cancelar" variant="ghost" onPress={cerrarSiSePuede} disabled={ocupado} />
        </>
      }
    >
      <View style={styles.pila}>
        <Text style={styles.cuerpo}>
          Sin misiones, sin penalizaciones, sin pérdida de racha. Pausar no es rendirse: es estrategia.
        </Text>

        <View style={styles.grupo}>
          <Text style={styles.etiqueta} maxFontSizeMultiplier={1.35}>
            Motivo
          </Text>
          <ChipWrap>
            {motivos.map((r) => (
              <Chip key={r} label={r} selected={motivo === r} onPress={() => setMotivo(r)} accessibilityLabel={`Motivo: ${r}`} />
            ))}
          </ChipWrap>
        </View>

        <View style={styles.grupo}>
          <Text style={styles.etiqueta} maxFontSizeMultiplier={1.35}>
            Duración, desde hoy
          </Text>
          <ChipWrap>
            {duraciones.map((d) => (
              <Chip key={d} label={textoDias(d)} selected={dias === d} onPress={() => setDias(d)} accessibilityLabel={textoDias(d)} />
            ))}
          </ChipWrap>
        </View>

        <View style={styles.grupo} accessible accessibilityLabel={`El sistema se reanuda solo el ${nombreDia(addDays(today, dias))}`}>
          <Text style={styles.etiqueta} maxFontSizeMultiplier={1.35}>
            Se reanuda solo el
          </Text>
          <Text style={styles.fecha} maxFontSizeMultiplier={1.35}>
            {nombreDia(addDays(today, dias)).toLocaleUpperCase('es-ES')}
          </Text>
        </View>

        {aviso ? <ErrorSistema compacto mensaje={aviso} /> : null}
      </View>
    </Sheet>
  );
}

export interface HojaCodigoProps {
  abierta: boolean;
  cerrar: () => void;
  valor: string;
  cambiar: (t: string) => void;
  aviso: string | null;
  ocupado: boolean;
  enviar: () => void;
  /** La galería lo apaga: el foco abre el teclado en las capturas. */
  autoFocus?: boolean;
}

export function HojaCodigo({ abierta, cerrar, valor, cambiar, aviso, ocupado, enviar, autoFocus = true }: HojaCodigoProps) {
  return (
    <Sheet
      visible={abierta}
      onClose={cerrar}
      eyebrow="Código de creador"
      title="¿Quién te trajo?"
      footer={
        <>
          <Button title="Guardar código" size="lg" onPress={enviar} loading={ocupado} disabled={!valor.trim()} />
          <Button title="Cancelar" variant="ghost" onPress={cerrar} />
        </>
      }
    >
      <View style={styles.pila}>
        <Text style={styles.cuerpo}>
          Si te recomendó NIVL alguien del programa de creadores, escribe su código. No cambia nada para ti y solo se
          puede poner una vez.
        </Text>
        <Campo
          etiqueta="Código"
          grande="rank"
          value={valor}
          onChangeText={cambiar}
          placeholder="CÓDIGO"
          maxLength={CODIGO_MAX_LENGTH + 4}
          autoCapitalize="characters"
          autoCorrect={false}
          autoComplete="off"
          spellCheck={false}
          autoFocus={autoFocus}
          returnKeyType="done"
          onSubmitEditing={enviar}
          error={aviso}
          accessibilityLabel="Código del creador que te trajo"
        />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  pila: { gap: space.s5 },
  pilaCorta: { gap: space.s3 },
  grupo: { gap: space.s2 },
  etiqueta: {
    fontFamily: tipo.label.family,
    fontSize: tipo.label.size,
    lineHeight: tipo.label.lineHeight,
    letterSpacing: tipo.label.tracking,
    textTransform: 'uppercase',
    color: ink.ink6,
  },
  cuerpo: {
    fontFamily: tipo.body.family,
    fontSize: tipo.body.size,
    lineHeight: tipo.body.lineHeight,
    color: ink.ink9,
  },
  nota: {
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink8,
  },
  fecha: {
    fontFamily: tipo.inscripcion.family,
    fontSize: tipo.inscripcion.size,
    lineHeight: tipo.inscripcion.lineHeight,
    letterSpacing: tipo.inscripcion.tracking,
    color: ink.ink9,
  },
});
