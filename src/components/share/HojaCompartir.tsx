// NIVL · Hoja de compartir (E4): vista previa, formato, qué se enseña y botón.
//
// Reglas (Chat 3 §3 y decisiones del coordinador):
// - Se abre SIEMPRE con todo apagado (alias, fotos, peso, invitación): nada
//   se recuerda entre usos. Cada vez se elige qué sale.
// - Las fotos de progreso solo se ofrecen con `contexto.puedeCompartirFotos`
//   (18+ y consentimiento de salud: `permisosFotos(...).compartir`).
// - Si las fotos no van a salir en B/N en esta plataforma, se avisa antes.
//
// No es un Modal de RN: en Android, capturar una vista dentro de un Modal da
// un PNG negro. Es una capa a pantalla completa que se monta con
// `<Screen overlay={…}>`, y la tarjeta que se captura se pinta fuera de la
// vista (left: -10000) a 1080 px físicos. Sin animaciones: respeta «reducir
// movimiento» por construcción.

import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useRef, useState } from 'react';
import { PixelRatio, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, useWindowDimensions, View } from 'react-native';
import { compartirTarjeta, type Ancla } from '@/lib/share';
import {
  avisoColor,
  bloqueo,
  DIMENSIONES,
  OPCIONES_POR_DEFECTO,
  type ContextoTarjeta,
  type FormatoTarjeta,
  type OpcionesTarjeta,
  type Tarjeta,
} from '@/lib/sharecard';
import { Trama } from '@/components/ui/Texture';
import { ink } from '@/design/tokens';
import { fonts } from '@/lib/theme';
import { mensajeSistema } from '@/lib/validation';
import { TarjetaCompartir } from './TarjetaCompartir';


export interface HojaCompartirProps {
  visible: boolean;
  onCerrar: () => void;
  tarjeta: Tarjeta;
  contexto?: ContextoTarjeta;
  /** Alias público aprobado; sin él no se ofrece el interruptor. */
  alias?: string | null;
  /**
   * Pide el alias público SOLO cuando se enciende «Mostrar mi alias» (condición
   * del Chat 3: `fetchAliasCompartir()` no se llama al abrir la hoja). Devuelve
   * el alias que se puede firmar, o null si no hay. Quien llama decide qué
   * hacer con un alias pendiente de aprobación; nunca se firma con él.
   */
  pedirAlias?: () => Promise<string | null>;
  retratoUri?: string | null;
  /** Código de amigo; sin él no se ofrece la invitación. */
  codigoAmigo?: string | null;
  /** Formato inicial (por defecto, historia). */
  formatoInicial?: FormatoTarjeta;
}

export function HojaCompartir({
  visible,
  onCerrar,
  tarjeta,
  contexto,
  alias: aliasDado,
  pedirAlias,
  retratoUri,
  codigoAmigo,
  formatoInicial = 'stories',
}: HojaCompartirProps) {
  const { width, height } = useWindowDimensions();
  const [formato, setFormato] = useState<FormatoTarjeta>(formatoInicial);
  const [opciones, setOpciones] = useState<OpcionesTarjeta>(OPCIONES_POR_DEFECTO);
  // Qué combinación de formato y opciones ha terminado de pintar la tarjeta
  // de captura. Comparar claves evita la carrera entre el aviso del hijo y un
  // reinicio en un efecto del padre (los efectos del hijo corren antes).
  const [listoPara, setListoPara] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  // Alias pedido al encender el interruptor (undefined = aún no pedido).
  const [aliasPedido, setAliasPedido] = useState<string | null | undefined>(undefined);
  const [pidiendoAlias, setPidiendoAlias] = useState(false);
  const [sinAlias, setSinAlias] = useState(false);
  const alias = aliasDado ?? aliasPedido ?? null;
  const vista = useRef<View>(null);
  const boton = useRef<View>(null);
  const ctx: ContextoTarjeta = contexto ?? { puedeCompartirFotos: false };

  // Cada apertura empieza de cero: nada se recuerda entre usos.
  useEffect(() => {
    if (!visible) return;
    setFormato(formatoInicial);
    setOpciones(OPCIONES_POR_DEFECTO);
    setError(null);
    setAliasPedido(undefined);
    setSinAlias(false);
  }, [visible, formatoInicial]);

  if (!visible) return null;

  const clave = `${alias ?? ''}|${formato}|${opciones.mostrarNombre}|${opciones.mostrarFotos}|${opciones.mostrarPeso}|${opciones.incluirInvitacion}|${opciones.mostrarTextoCoach}`;
  const listo = listoPara === clave;

  const esProgreso = tarjeta.tipo === 'antesDespues';
  const fotoRecuerdo = tarjeta.tipo === 'recuerdo' && !!tarjeta.foto?.uri;
  const textoRecuerdo = tarjeta.tipo === 'recuerdo' && !!tarjeta.texto;
  const hayPeso = esProgreso && typeof tarjeta.pesoAntesKg === 'number' && typeof tarjeta.pesoDespuesKg === 'number';
  const motivo = bloqueo(tarjeta, opciones, ctx);
  const aviso = avisoColor(tarjeta, opciones, ctx, Platform.OS);
  const cambiar = (k: keyof OpcionesTarjeta) => (v: boolean) =>
    setOpciones((o) => ({ ...o, [k]: v, ...(k === 'mostrarFotos' && !v ? { mostrarPeso: false } : null) }));

  // Encender el alias: si no ha llegado, se pide una vez. Mientras tanto la
  // tarjeta va sin firma (mostrarNombre sigue apagado hasta tener alias).
  const cambiarAlias = async (v: boolean) => {
    setSinAlias(false);
    if (!v || aliasDado || aliasPedido) {
      setOpciones((o) => ({ ...o, mostrarNombre: v && !!(aliasDado || aliasPedido) }));
      return;
    }
    if (!pedirAlias || aliasPedido === null) {
      setSinAlias(true);
      return;
    }
    setPidiendoAlias(true);
    try {
      const a = await pedirAlias();
      const limpio = a && a.trim() ? a.trim() : null;
      setAliasPedido(limpio);
      if (limpio) setOpciones((o) => ({ ...o, mostrarNombre: true }));
      else setSinAlias(true);
    } catch {
      setAliasPedido(null);
      setSinAlias(true);
    } finally {
      setPidiendoAlias(false);
    }
  };

  const anchoPrevia = Math.min(width - 48, formato === 'stories' ? (height * 0.5 * 9) / 16 : (height * 0.5 * 4) / 5, 340);
  // La captura se pinta a 1080 px físicos: así view-shot no reescala.
  const anchoCaptura = DIMENSIONES[formato].ancho / PixelRatio.get();

  const compartir = async () => {
    setError(null);
    setEnviando(true);
    try {
      const ancla = await new Promise<Ancla | null>((r) =>
        boton.current ? boton.current.measureInWindow((x, y, w, h) => r({ x, y, width: w, height: h })) : r(null),
      );
      await compartirTarjeta({ tarjeta, formato, opciones, contexto: ctx, vista, codigoAmigo, ancla });
    } catch (e) {
      setError(mensajeSistema(e));
    } finally {
      setEnviando(false);
    }
  };

  const puede = !motivo && listo && !enviando;

  return (
    <View style={[StyleSheet.absoluteFill, styles.capa]} accessibilityViewIsModal>
      {/* Tarjeta real, fuera de la vista, para capturar. */}
      <View
        style={styles.fuera}
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        {...({ 'aria-hidden': true } as object)}
      >
        <TarjetaCompartir
          ref={vista}
          tarjeta={tarjeta}
          formato={formato}
          opciones={opciones}
          contexto={ctx}
          alias={alias}
          retratoUri={retratoUri}
          ancho={anchoCaptura}
          codigoAmigo={codigoAmigo}
          key={clave}
          onListo={() => setListoPara(clave)}
        />
      </View>

      <View style={styles.hoja}>
        <View style={styles.cabecera}>
          <Text style={styles.titulo}>COMPARTIR</Text>
          <Pressable onPress={onCerrar} accessibilityRole="button" accessibilityLabel="Cerrar" hitSlop={12} style={styles.cerrar}>
            <Text style={styles.cerrarX}>✕</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.contenido}>
          <View style={styles.previa} accessible accessibilityLabel="Vista previa de la tarjeta">
            <TarjetaCompartir
              tarjeta={tarjeta}
              formato={formato}
              opciones={opciones}
              contexto={ctx}
              alias={alias}
              retratoUri={retratoUri}
              codigoAmigo={codigoAmigo}
              ancho={anchoPrevia}
            />
          </View>

          <View style={styles.formatos} accessibilityRole="radiogroup">
            {(
              [
                ['stories', 'HISTORIA 9:16'],
                ['post', 'PUBLICACIÓN 4:5'],
              ] as const
            ).map(([f, rotulo]) => {
              const activo = formato === f;
              return (
                <Pressable
                  key={f}
                  onPress={() => setFormato(f)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: activo }}
                  style={[styles.formato, activo && styles.formatoActivo]}
                >
                  <Text style={[styles.formatoTexto, activo && styles.formatoTextoActivo]}>{rotulo}</Text>
                </Pressable>
              );
            })}
          </View>

          {aliasDado || pedirAlias ? (
            <Interruptor rotulo="Mostrar mi alias" valor={opciones.mostrarNombre} onCambio={cambiarAlias} deshabilitado={pidiendoAlias} />
          ) : null}
          {esProgreso && ctx.puedeCompartirFotos ? (
            <Interruptor rotulo="Incluir mis fotos de progreso" valor={opciones.mostrarFotos} onCambio={cambiar('mostrarFotos')} />
          ) : null}
          {fotoRecuerdo && ctx.puedeCompartirFotos ? (
            <Interruptor rotulo="Incluir la foto" valor={opciones.mostrarFotos} onCambio={cambiar('mostrarFotos')} />
          ) : null}
          {textoRecuerdo ? (
            <Interruptor rotulo="Incluir el texto del coach" valor={opciones.mostrarTextoCoach} onCambio={cambiar('mostrarTextoCoach')} />
          ) : null}
          {esProgreso && hayPeso && opciones.mostrarFotos ? (
            <Interruptor rotulo="Mostrar el peso" valor={opciones.mostrarPeso} onCambio={cambiar('mostrarPeso')} />
          ) : null}
          {codigoAmigo ? (
            <Interruptor rotulo="Añadir mi enlace de invitación" valor={opciones.incluirInvitacion} onCambio={cambiar('incluirInvitacion')} />
          ) : null}
        </ScrollView>

        <View ref={boton} collapsable={false} style={styles.pie}>
          {/* Avisos justo encima del botón (Chat 4). Bloqueo y error con trama:
              un marco <Trama/> ink6 de 3 pt alrededor de una placa ink1, como
              la Card alerta del kit. */}
          {motivo ? <Aviso texto={motivo} trama /> : null}
          {aviso ? <Aviso texto={aviso} /> : null}
          {sinAlias ? <Aviso texto="Sin alias disponible." /> : null}
          {error ? <Aviso texto={error} trama alerta /> : null}
          <Pressable
            onPress={compartir}
            disabled={!puede}
            accessibilityRole="button"
            accessibilityState={{ disabled: !puede, busy: enviando }}
            style={[styles.boton, !puede && styles.botonApagado]}
          >
            <Text style={[styles.botonTexto, !puede && styles.botonTextoApagado]}>{enviando ? 'ABRIENDO…' : 'COMPARTIR'}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function Aviso({ texto, trama = false, alerta = false }: { texto: string; trama?: boolean; alerta?: boolean }) {
  const linea = (
    <>
      <Ionicons name="information-circle-outline" size={16} color={ink.ink8} />
      <Text style={styles.nota}>{texto}</Text>
    </>
  );
  return (
    <View
      style={trama ? styles.avisoMarco : styles.aviso}
      accessibilityRole={alerta ? 'alert' : undefined}
      accessibilityLiveRegion={alerta ? 'polite' : undefined}
    >
      {trama ? (
        <>
          <Trama color={ink.ink6} />
          <View style={styles.avisoPlaca}>{linea}</View>
        </>
      ) : (
        linea
      )}
    </View>
  );
}

function Interruptor({
  rotulo,
  valor,
  onCambio,
  deshabilitado = false,
}: {
  rotulo: string;
  valor: boolean;
  onCambio: (v: boolean) => void;
  deshabilitado?: boolean;
}) {
  return (
    <View style={styles.fila}>
      <Text style={styles.filaTexto}>{rotulo}</Text>
      <Switch
        value={valor}
        onValueChange={onCambio}
        disabled={deshabilitado}
        accessibilityLabel={rotulo}
        trackColor={{ false: ink.ink4, true: ink.ink10 }}
        thumbColor={valor ? ink.ink0 : ink.ink8}
        // En web, RN usa su propio color activo si no se le da este.
        {...({ activeThumbColor: ink.ink0 } as object)}
        ios_backgroundColor={ink.ink4}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  capa: { backgroundColor: ink.ink0, zIndex: 1000, overflow: 'hidden' },
  fuera: { position: 'absolute', left: -10000, top: 0 },
  hoja: { flex: 1, width: '100%', maxWidth: 560, alignSelf: 'center' },
  cabecera: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 56, paddingBottom: 12 },
  titulo: { fontFamily: fonts.heading, fontSize: 12, letterSpacing: 2, color: ink.ink6 },
  cerrar: { minWidth: 44, minHeight: 44, alignItems: 'flex-end', justifyContent: 'center' },
  cerrarX: { fontFamily: fonts.heading, fontSize: 20, color: ink.ink9 },
  contenido: { paddingHorizontal: 20, paddingBottom: 24, gap: 16 },
  previa: { alignItems: 'center', borderWidth: 1, borderColor: ink.ink3, alignSelf: 'center' },
  formatos: { flexDirection: 'row', gap: 8 },
  formato: { flex: 1, minHeight: 44, borderWidth: 1, borderColor: ink.ink4, alignItems: 'center', justifyContent: 'center' },
  formatoActivo: { backgroundColor: ink.ink10, borderColor: ink.ink10 },
  formatoTexto: { fontFamily: fonts.heading, fontSize: 12, letterSpacing: 2, color: ink.ink8 },
  formatoTextoActivo: { color: ink.ink0 },
  fila: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44, borderBottomWidth: 1, borderBottomColor: ink.ink3, gap: 12 },
  filaTexto: { fontFamily: fonts.body, fontSize: 16, color: ink.ink9, flexShrink: 1 },
  nota: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: ink.ink8, flexShrink: 1 },
  aviso: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 12 },
  // La trama hace de borde de 3 pt; el texto va en la placa lisa, nunca encima del rayado.
  avisoMarco: { marginBottom: 12, padding: 3, backgroundColor: ink.ink0, overflow: 'hidden' },
  avisoPlaca: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 10, backgroundColor: ink.ink1 },
  pie: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 32, borderTopWidth: 1, borderTopColor: ink.ink3 },
  boton: { minHeight: 52, backgroundColor: ink.ink10, alignItems: 'center', justifyContent: 'center' },
  botonApagado: { backgroundColor: ink.ink1, borderWidth: 1, borderColor: ink.ink4 },
  botonTexto: { fontFamily: fonts.heading, fontSize: 14, letterSpacing: 2, color: ink.ink0 },
  botonTextoApagado: { color: ink.ink6 },
});
