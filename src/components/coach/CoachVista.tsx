// NIVL · La vista del Coach (L-RADICAL §B.2 y §C): pura, solo props. Los
// datos y los efectos viven en useCoach; la galería (/kit/pantallas) la pinta
// con datos de mentira (demo.tsx).
//
// Composición de la arena: cabecera fija con la marca (CoachMark 64) y
// «COACH» grabado en Cinzel; vacío con la planta de la arena y la galea en el
// centro; el coach habla en losas con la regla ink10 y firma «EL SISTEMA» al
// empezar cada bloque; burbuja del usuario en ink2 sin marco; días separados
// por una inscripción entre dos reglas; acciones rápidas sobre el cuadro;
// compositor con micrófono en aro siempre a la vista y enviar en círculo
// blanco. La única inversión de la pantalla es ENVIAR (grabando, enviar se
// aparta y el micrófono se enciende). CoachMark no cuenta como superficie
// (L-RADICAL R6).

import Ionicons from '@expo/vector-icons/Ionicons';
import type { RefObject } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type NativeSyntheticEvent,
  type TextInputKeyPressEventData,
} from 'react-native';
import { Arena, BotonArena, Entrada, Galea } from '@/components/arena';
import { ProUpsellLine } from '@/components/ProOffer';
import { Button, Card, Chip, Screen, Skeleton, Tag } from '@/components/ui';
import { ink, space, stroke, type } from '@/design/tokens';
import { useAnchoUtil } from '@/design/useSizeClass';
import type { CoachMode } from '@/lib/coach';
import { DESCARGO_SALUD, LINEA_CRISIS } from '@/lib/consentmath';
import { dateKey, relativoDe } from '@/lib/dates';
import type { DecisionOferta } from '@/lib/paywallmoment';
import { CoachBloqueado } from './CoachBloqueado';
import { CoachMark } from './CoachMark';
import { BotonDictar, FranjaGrabacion, type Dictado } from './Dictado';
import { MensajeCoach, type VozMensaje } from './MensajeCoach';

type Tier = DecisionOferta['tier'];

export interface BurbujaVista {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  acciones: { texto: string; ok: boolean }[];
  /** «Consultado: tu historial», o null. */
  cita: string | null;
  /** ISO del servidor; las burbujas recién llegadas no la traen. */
  fecha?: string;
  voz?: VozMensaje;
  onDenunciar?: () => void;
}

export interface CoachVistaProps {
  /** Aún sin hilo o sin estado de la IA: cabecera y huecos. */
  cargando: boolean;
  /** Con certeza sin coach (estado leído y sin Pro). */
  sinPro: boolean;
  /** Ni burbujas ni respuesta en curso. */
  vacio: boolean;
  /** Perfil de uso: lo que el coach estaría haciendo hoy (bloqueado). */
  kind: unknown;
  /** Nivel de la línea `coach_cerrado`, o null (entonces el botón de respaldo). */
  ofertaCerrado: Tier | null;
  falloCarga: boolean;
  onReintentar: () => void;
  /** Consultas del último turno cerrado del coach. */
  consultas: number;
  /** El próximo turno va en modo profundo. */
  profundo: boolean;
  burbujas: BurbujaVista[];
  enCurso: { texto: string; pensando: boolean; acciones: { texto: string; ok: boolean }[]; cita: string | null } | null;
  error: string | null;
  scrollRef?: RefObject<ScrollView | null>;
  alFondo?: () => void;
  onAtajo: (mensaje: string) => void;
  /** Fotos listas para el próximo turno. */
  adjuntas: number;
  onQuitarAdjuntas: () => void;
  /** Aviso de energía (o del servidor). `ofertaTier`: la línea `energia_agotada`. */
  energia: { texto: string; ofertaTier: Tier | null; avisoAparte: string | null } | null;
  /** Solo si el plan incluye el modo profundo. */
  potencia: { modo: CoachMode; profundoAbierto: boolean; linea: string; onElegir: (m: CoachMode) => void } | null;
  compositor: {
    texto: string;
    onCambiarTexto: (t: string) => void;
    onTeclear: (e: NativeSyntheticEvent<TextInputKeyPressEventData>) => void;
    puedeEnviar: boolean;
    onEnviar: () => void;
    /** Un turno en vuelo: adjuntar y dictar se apagan. */
    ocupado: boolean;
    /** Se puede dictar: el micrófono va junto a enviar. */
    conDictado: boolean;
    /** Grabando o preparando el dictado. */
    grabando: boolean;
    dictado: Dictado;
    avisoDictado: string | null;
    onAdjuntar: () => void;
    /**
     * El plan tiene un modelo con visión (Élite u owner). Sin él no se ofrece
     * adjuntar: el servidor corta las fotos con un 400 (Seguridad, 1.0.8).
     * null mientras no se sabe: tampoco se ofrece.
     */
    conFotos: boolean | null;
  };
  onPro: () => void;
  onMemoria: () => void;
}

// Atajos a los rituales: lo que el coach anterior hacía por cadena programada.
const ATAJOS: { etiqueta: string; mensaje: string; icono: keyof typeof Ionicons.glyphMap }[] = [
  { etiqueta: 'Planifica mi día', mensaje: 'Planifica el resto de mi día de hoy.', icono: 'list-outline' },
  { etiqueta: 'Reporte', mensaje: 'Voy a reportar. Pregúntame lo que necesites saber de hoy.', icono: 'clipboard-outline' },
  { etiqueta: 'Dojo de ventas', mensaje: 'Entréname 15 minutos de ventas. Empieza con una objeción real.', icono: 'flash-outline' },
  { etiqueta: 'Revísame', mensaje: 'Haz la revisión de mis últimos 14 días con honestidad brutal.', icono: 'analytics-outline' },
];

// Acciones rápidas sobre el cuadro, con el hilo ya empezado. Hacen lo mismo
// que los atajos del vacío: se lo envían al coach (onAtajo).
const RAPIDAS: { etiqueta: string; mensaje: string; icono: keyof typeof Ionicons.glyphMap }[] = [
  { etiqueta: 'Plan de hoy', mensaje: 'Planifica el resto de mi día de hoy.', icono: 'list-outline' },
  { etiqueta: 'Registrar', mensaje: 'Voy a reportar. Pregúntame lo que necesites saber de hoy.', icono: 'clipboard-outline' },
  { etiqueta: '¿Qué entreno?', mensaje: '¿Qué entreno hoy? Decídelo con mi historial y cómo vengo.', icono: 'barbell-outline' },
  {
    etiqueta: 'Resumen de la semana',
    mensaje: 'Hazme el resumen de mi semana: lo que cumplí, lo que no y qué cambio para la próxima.',
    icono: 'calendar-outline',
  },
];

/** Por debajo de este ancho útil, «COACH» baja de `rank` (32) a inscripción de 20. */
const ANCHO_TITULO_GRANDE = 400;
/** La planta de la arena del vacío y la galea de su centro. */
const ARENA_ANCHO = 260;
const ARENA_ALTO = 160;
const GALEA = 96;

/** «Ha leído tu día · 4 consultas», «Listo para tu día». */
export function lineaCabecera(p: Pick<CoachVistaProps, 'cargando' | 'sinPro' | 'consultas'>): string {
  if (p.cargando) return 'Leyendo tu día';
  if (p.sinPro) return 'Parte de NIVL Pro';
  if (p.consultas <= 0) return 'Listo para tu día';
  return `Ha leído tu día · ${p.consultas} ${p.consultas === 1 ? 'consulta' : 'consultas'}`;
}

/** «HOY», «AYER», «HACE 5 DÍAS» de una fecha ISO; null si no la hay o no se lee. */
export function rotuloDia(fecha: string | undefined, hoy: string = dateKey()): string | null {
  if (!fecha) return null;
  const d = new Date(fecha);
  if (Number.isNaN(d.getTime())) return null;
  return relativoDe(dateKey(d), hoy).toUpperCase();
}

function Cabecera({ p }: { p: Pick<CoachVistaProps, 'cargando' | 'sinPro' | 'consultas' | 'profundo' | 'onPro' | 'onMemoria'> }) {
  const grande = useAnchoUtil() >= ANCHO_TITULO_GRANDE;
  return (
    <View style={styles.header}>
      <CoachMark size={64} />
      <View style={styles.headerTextos}>
        <View style={styles.headerTituloFila}>
          <Text
            style={[styles.titulo, !grande && styles.tituloSm]}
            accessibilityRole="header"
            numberOfLines={1}
            adjustsFontSizeToFit
            maxFontSizeMultiplier={1.35}
          >
            COACH
          </Text>
          {p.profundo ? <Tag>PROFUNDO</Tag> : null}
        </View>
        <Text style={styles.headerLinea} numberOfLines={2} maxFontSizeMultiplier={1.35}>
          {lineaCabecera(p)}
        </Text>
      </View>
      {p.cargando ? null : (
        <View style={styles.headerAcciones}>
          {/* La puerta a /pro para todos: la oferta si no hay coach, y el plan
              y la energía del mes si lo hay. */}
          <BotonArena
            icono="flash-outline"
            etiqueta={p.sinPro ? 'Ver NIVL Pro' : 'Ver tu plan y la energía del coach'}
            onPress={p.onPro}
          />
          {/* La memoria es del coach: sin Pro no ha aprendido nada que
              enseñar. Vuelve en cuanto la cuenta tiene coach. */}
          {p.sinPro ? null : <BotonArena icono="library-outline" etiqueta="Ver la memoria del sistema" onPress={p.onMemoria} />}
        </View>
      )}
    </View>
  );
}

/** La planta de la arena con la galea en el centro. Decoración: el lector la salta. */
function ArenaGalea() {
  return (
    <View
      style={styles.arenaGalea}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
    >
      <Arena ancho={ARENA_ANCHO} alto={ARENA_ALTO} variante="ovalo" style={styles.arenaFondo} />
      <Galea kind="casco" size={GALEA} color={ink.ink10} />
    </View>
  );
}

function Vacio({ onAtajo }: { onAtajo: (mensaje: string) => void }) {
  return (
    <View style={styles.vacio}>
      <Entrada indice={0}>
        <ArenaGalea />
      </Entrada>
      <Entrada indice={1} style={styles.vacioTextos}>
        <Text style={styles.vacioTitulo} accessibilityRole="header" maxFontSizeMultiplier={1.35}>
          EL SISTEMA TE ESCUCHA.
        </Text>
        <Text style={styles.vacioTexto}>
          Manda en tu día, decide qué puntúa cada cosa, te juzga por la noche y recuerda todo lo que aprende de ti.
          Habla con él como hablarías con quien lleva tu vida.
        </Text>
        <Text style={styles.vacioDescargo}>
          {DESCARGO_SALUD} {LINEA_CRISIS}
        </Text>
      </Entrada>
      <Entrada indice={2}>
        <View style={styles.atajos} accessibilityLabel="Atajos">
          {ATAJOS.map((a) => (
            <Pressable
              key={a.etiqueta}
              onPress={() => onAtajo(a.mensaje)}
              hitSlop={ZONA_PILDORA}
              style={({ pressed }) => [styles.pildora, pressed && styles.pulsado]}
              accessibilityRole="button"
              accessibilityLabel={a.etiqueta}
              accessibilityHint="Se lo envía al coach"
            >
              <Ionicons name={a.icono} size={14} color={ink.ink8} />
              <Text style={styles.pildoraTexto} maxFontSizeMultiplier={1.35}>
                {a.etiqueta}
              </Text>
            </Pressable>
          ))}
        </View>
      </Entrada>
    </View>
  );
}

/**
 * Las acciones rápidas sobre el cuadro, con el hilo empezado: píldoras que se
 * desplazan en horizontal. Se las envían al coach como los atajos del vacío.
 */
function Rapidas({
  onAtajo,
  desactivadas,
  conLinea,
}: {
  onAtajo: (mensaje: string) => void;
  desactivadas: boolean;
  /** Sin el selector de potencia encima, la fila pone el filete. */
  conLinea: boolean;
}) {
  return (
    <ScrollView
      horizontal
      style={conLinea && styles.rapidasFila}
      contentContainerStyle={styles.rapidas}
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      accessibilityLabel="Acciones rápidas"
    >
      {RAPIDAS.map((a) => (
        <Pressable
          key={a.etiqueta}
          onPress={() => onAtajo(a.mensaje)}
          disabled={desactivadas}
          hitSlop={ZONA_PILDORA}
          style={({ pressed }) => [styles.pildora, desactivadas && styles.pildoraOff, pressed && styles.pulsado]}
          accessibilityRole="button"
          accessibilityLabel={a.etiqueta}
          accessibilityHint="Se lo envía al coach"
          accessibilityState={{ disabled: desactivadas }}
        >
          <Ionicons name={a.icono} size={14} color={ink.ink8} />
          <Text style={styles.pildoraTexto} maxFontSizeMultiplier={1.35}>
            {a.etiqueta}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

// Las píldoras miden 38: con esto llegan a 44 de zona táctil.
const ZONA_PILDORA = { top: 3, bottom: 3, left: 0, right: 0 };

/** «HOY», «AYER»: inscripción grabada entre dos reglas. */
function Separador({ texto }: { texto: string }) {
  return (
    <View style={styles.separador} accessibilityRole="header">
      <View style={styles.separadorLinea} />
      <Text style={styles.separadorTexto} maxFontSizeMultiplier={1.35}>
        {texto}
      </Text>
      <View style={styles.separadorLinea} />
    </View>
  );
}

export function CoachVista(p: CoachVistaProps) {
  const { compositor: c } = p;

  if (p.cargando) {
    // La cabecera ya, y el cuerpo en hueco: un spinner solo en mitad del negro
    // no decía ni en qué pantalla se estaba.
    return (
      <Screen plain>
        <Cabecera p={p} />
        <View style={styles.cargandoCuerpo} accessibilityRole="progressbar" accessibilityLabel="Cargando el coach">
          <Skeleton height={14} width="64%" />
          <Skeleton height={14} width="88%" style={styles.cargandoLinea} />
          <Skeleton height={14} width="46%" style={styles.cargandoLinea} />
          <Skeleton height={88} style={styles.cargandoBloque} />
          <Skeleton height={14} width="72%" style={styles.cargandoBloque} />
          <Skeleton height={14} width="54%" style={styles.cargandoLinea} />
        </View>
      </Screen>
    );
  }

  const { vacio, sinPro, falloCarga } = p;
  const hoy = dateKey();
  let diaPrevio: string | null = null;
  // Las acciones rápidas: con el hilo empezado y el cuadro libre.
  const conRapidas = !vacio && !sinPro && !c.texto.trim() && !c.grabando && !p.adjuntas;
  // La firma «EL SISTEMA» va en el primer mensaje del coach de cada bloque
  // seguido; un separador de día también abre bloque.
  let rolPrevio: BurbujaVista['role'] | null = null;

  return (
    <Screen plain>
      <Cabecera p={p} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <ScrollView
          ref={p.scrollRef}
          style={styles.flex}
          contentContainerStyle={styles.lista}
          onContentSizeChange={p.alFondo}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {vacio && sinPro ? <CoachBloqueado kind={p.kind} onPro={p.onPro} oferta={p.ofertaCerrado} /> : null}

          {vacio && !sinPro && falloCarga ? (
            <Entrada indice={0}>
              <Card variant="outline" style={styles.falloCarga}>
                <Text style={styles.falloCargaTitulo} accessibilityRole="header" maxFontSizeMultiplier={1.35}>
                  EL SISTEMA NO RESPONDE
                </Text>
                <Text style={styles.falloCargaTexto}>
                  No se ha podido cargar la conversación. Revisa la conexión y vuelve a intentarlo.
                </Text>
                <Button
                  title="Reintentar"
                  variant="secondary"
                  size="sm"
                  onPress={p.onReintentar}
                  style={styles.falloCargaBoton}
                />
              </Card>
            </Entrada>
          ) : null}

          {vacio && !sinPro && !falloCarga ? <Vacio onAtajo={p.onAtajo} /> : null}

          {/* El hilo no lleva animaciones de entrada (L-RADICAL R1). */}
          {p.burbujas.map((b) => {
            // Separador por días solo si la burbuja trae fecha; si no, nada.
            const dia = rotuloDia(b.fecha, hoy);
            const separa = dia !== null && dia !== diaPrevio;
            if (dia !== null) diaPrevio = dia;
            const firma = b.role === 'assistant' && (separa || rolPrevio !== 'assistant');
            rolPrevio = b.role;
            return (
              <View key={b.id}>
                {separa && dia ? <Separador texto={dia} /> : null}
                {b.role === 'user' ? (
                  <View style={styles.filaUsuario}>
                    <View style={styles.burbujaUsuario}>
                      <Text style={styles.textoUsuario}>{b.text}</Text>
                    </View>
                  </View>
                ) : (
                  <MensajeCoach
                    texto={b.text}
                    acciones={b.acciones}
                    cita={b.cita}
                    voz={b.voz}
                    onDenunciar={b.onDenunciar}
                    firma={firma}
                  />
                )}
              </View>
            );
          })}

          {p.enCurso ? (
            <MensajeCoach
              texto={p.enCurso.texto}
              pensando={p.enCurso.pensando}
              acciones={p.enCurso.acciones}
              cita={p.enCurso.cita}
              firma={p.burbujas[p.burbujas.length - 1]?.role !== 'assistant'}
            />
          ) : null}

          {/* Alerta v2: la trama hace de borde; el texto, en ink9. */}
          {p.error ? (
            <Card variant="alerta" padded={false} style={styles.errorTarjeta}>
              <View style={styles.error} accessibilityRole="alert">
                <Ionicons name="alert-circle-outline" size={16} color={ink.ink9} />
                <Text style={styles.errorTexto}>{p.error}</Text>
              </View>
            </Card>
          ) : null}
        </ScrollView>

        {p.adjuntas ? (
          <View style={styles.adjuntas}>
            <Ionicons name="image-outline" size={14} color={ink.ink8} />
            <Text style={styles.adjuntasTexto}>
              {p.adjuntas === 1 ? '1 foto lista para enviar' : `${p.adjuntas} fotos listas para enviar`}
            </Text>
            <Pressable
              onPress={p.onQuitarAdjuntas}
              hitSlop={14}
              style={styles.quitar}
              accessibilityRole="button"
              accessibilityLabel="Quitar las fotos"
            >
              <Ionicons name="close" size={16} color={ink.ink8} />
            </Pressable>
          </View>
        ) : null}

        {p.energia ? (
          p.energia.ofertaTier ? (
            // La línea ya dice que la energía se ha agotado: el aviso propio
            // solo queda si el servidor ha dicho otra cosa.
            <View style={styles.avisoBloque}>
              {p.energia.avisoAparte ? (
                <View style={styles.avisoFila}>
                  <Ionicons name="hourglass-outline" size={14} color={ink.ink8} />
                  <Text style={styles.avisoTexto}>{p.energia.avisoAparte}</Text>
                </View>
              ) : null}
              <ProUpsellLine momento="energia_agotada" tier={p.energia.ofertaTier} />
            </View>
          ) : (
            <Pressable
              onPress={p.onPro}
              style={({ pressed }) => [styles.aviso, pressed && styles.pulsado]}
              accessibilityRole="button"
              accessibilityLabel={`${p.energia.texto} Ver la energía del coach`}
            >
              <Ionicons name="hourglass-outline" size={14} color={ink.ink8} />
              <Text style={styles.avisoTexto}>{p.energia.texto}</Text>
              <Ionicons name="chevron-forward" size={14} color={ink.ink6} />
            </Pressable>
          )
        ) : null}

        {p.potencia ? (
          <View style={styles.potencia}>
            <View style={styles.potenciaChips} accessibilityRole="radiogroup" accessibilityLabel="Potencia del coach">
              <Chip
                small
                label="Estándar"
                selected={p.potencia.modo === 'estandar'}
                onPress={() => p.potencia?.onElegir('estandar')}
              />
              <Chip
                small
                label="Profundo"
                icon="telescope-outline"
                selected={p.potencia.modo === 'profundo'}
                onPress={() => p.potencia?.onElegir('profundo')}
                disabled={!p.potencia.profundoAbierto}
                accessibilityLabel={`Modo profundo. ${p.potencia.linea}`}
              />
            </View>
            <Text style={styles.potenciaTexto} numberOfLines={2}>
              {p.potencia.linea}
            </Text>
          </View>
        ) : null}

        {/* Sin Pro se cierra ESCRIBIR, no leer: con historial (una suscripción
            que venció) la conversación se conserva a la vista. Sin historial,
            el estado bloqueado de arriba ya lleva su propio botón. */}
        {sinPro ? (
          vacio ? null : (
            <View style={styles.bandaPro}>
              {/* La línea de la oferta ya dice que el coach es parte de NIVL Pro. */}
              <Text style={styles.bandaProTexto}>
                {p.ofertaCerrado ? 'Tu conversación se conserva.' : 'El coach es parte de NIVL Pro. Tu conversación se conserva.'}
              </Text>
              {p.ofertaCerrado ? (
                <ProUpsellLine momento="coach_cerrado" tier={p.ofertaCerrado} />
              ) : (
                <Button title="Ver NIVL Pro" size="sm" onPress={p.onPro} />
              )}
            </View>
          )
        ) : (
          <View>
            {conRapidas ? <Rapidas onAtajo={p.onAtajo} desactivadas={c.ocupado} conLinea={!p.potencia} /> : null}
            <FranjaGrabacion dictado={c.dictado} aviso={c.avisoDictado} />
            {c.conFotos === false ? <Text style={styles.sinFotos}>Las fotos al coach son de Élite</Text> : null}
            <View
              style={[styles.barra, (!!p.potencia || conRapidas || c.grabando || !!c.avisoDictado) && styles.barraSinLinea]}
            >
              {c.conFotos ? (
                <Pressable
                  onPress={c.onAdjuntar}
                  disabled={c.ocupado}
                  style={({ pressed }) => [styles.adjuntar, pressed && styles.pulsado]}
                  accessibilityRole="button"
                  accessibilityLabel="Adjuntar una foto"
                >
                  <Ionicons name="add" size={26} color={ink.ink8} />
                </Pressable>
              ) : null}
              <TextInput
                style={styles.input}
                value={c.texto}
                onChangeText={c.onCambiarTexto}
                placeholder="Habla con el sistema"
                placeholderTextColor={ink.ink6}
                multiline
                onKeyPress={c.onTeclear}
                accessibilityLabel="Mensaje para el sistema"
              />
              {/* El micrófono, siempre a la vista junto a enviar. */}
              {c.conDictado ? <BotonDictar dictado={c.dictado} disabled={c.ocupado} /> : null}
              {c.grabando ? null : (
                // La inversión de la pantalla: el círculo blanco con la flecha negra.
                // Grabando se aparta: el micrófono encendido es entonces lo único.
                <Pressable
                  onPress={c.onEnviar}
                  disabled={!c.puedeEnviar}
                  style={({ pressed }) => [styles.enviar, !c.puedeEnviar && styles.enviarOff, pressed && styles.pulsado]}
                  accessibilityRole="button"
                  accessibilityLabel={c.ocupado ? 'Enviando: el sistema está pensando' : 'Enviar mensaje'}
                  accessibilityState={{ disabled: !c.puedeEnviar, busy: c.ocupado }}
                >
                  {/* Con el turno en marcha, apagado y con los puntos: no se manda otro. */}
                  <Ionicons name={c.ocupado ? 'ellipsis-horizontal' : 'arrow-up'} size={22} color={ink.ink0} />
                </Pressable>
              )}
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
    </Screen>
  );
}

// Tokens v2 (src/design/tokens.ts): lectura en bodySm (≥ 14), rótulos en label.
const lectura = { fontFamily: type.bodySm.family, fontSize: type.bodySm.size, lineHeight: type.bodySm.lineHeight } as const;
// La conversación (Coach.dc): Outfit 15/21, entre body y bodySm.
const conversacion = { fontFamily: type.body.family, fontSize: 15, lineHeight: 21 } as const;
/** Lado de los círculos del compositor (micrófono y enviar). */
const CIRCULO = 48;

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pulsado: { opacity: 0.7 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s3,
    paddingHorizontal: space.s5,
    paddingTop: space.s3,
    paddingBottom: space.s3 + 2,
    borderBottomWidth: stroke.hairline,
    borderBottomColor: ink.ink3,
    backgroundColor: ink.ink0,
  },
  headerTextos: { flex: 1, minWidth: 0 },
  headerTituloFila: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: space.s2, rowGap: space.s1 },
  titulo: {
    fontFamily: type.rank.family,
    fontSize: type.rank.size,
    lineHeight: type.rank.lineHeight,
    letterSpacing: type.rank.tracking,
    color: ink.ink10,
  },
  tituloSm: { fontFamily: type.inscripcion.family, fontSize: 20, lineHeight: 24, letterSpacing: type.inscripcion.tracking },
  headerLinea: {
    fontFamily: type.micro.family,
    fontSize: type.micro.size,
    lineHeight: type.micro.lineHeight,
    letterSpacing: type.micro.tracking,
    color: ink.ink6,
    marginTop: 2,
  },
  headerAcciones: { flexDirection: 'row', alignItems: 'center', gap: space.s2 },
  lista: { paddingHorizontal: space.s5, paddingTop: space.s5, paddingBottom: space.s3 },
  filaUsuario: { alignItems: 'flex-end', marginBottom: space.s5 },
  // Sin marco y sin invertir: la inversión de la pantalla es enviar.
  burbujaUsuario: {
    maxWidth: '78%',
    backgroundColor: ink.ink2,
    paddingVertical: space.s3,
    paddingHorizontal: space.s3 + 2,
  },
  textoUsuario: { ...conversacion, color: ink.ink9 },
  separador: { flexDirection: 'row', alignItems: 'center', gap: space.s3, marginTop: space.s1, marginBottom: space.s5 },
  separadorLinea: { flex: 1, height: stroke.rule, backgroundColor: ink.ink4 },
  separadorTexto: {
    fontFamily: type.inscripcion.family,
    fontSize: type.inscripcion.size,
    lineHeight: type.inscripcion.lineHeight,
    letterSpacing: type.inscripcion.tracking,
    color: ink.ink8,
  },
  errorTarjeta: { marginTop: space.s1, marginBottom: 0 },
  error: { flexDirection: 'row', alignItems: 'center', gap: space.s2, paddingHorizontal: space.s3, paddingVertical: space.s3 - 2 },
  errorTexto: { ...lectura, color: ink.ink9, flex: 1 },
  falloCarga: { marginTop: space.s8, alignItems: 'center', paddingVertical: space.s6 },
  falloCargaTitulo: {
    fontFamily: type.inscripcion.family,
    fontSize: type.inscripcion.size,
    lineHeight: type.inscripcion.lineHeight,
    letterSpacing: type.inscripcion.tracking,
    color: ink.ink10,
    textAlign: 'center',
  },
  falloCargaTexto: { ...lectura, color: ink.ink8, textAlign: 'center', marginTop: space.s2 },
  falloCargaBoton: { marginTop: space.s4 },
  vacio: { alignItems: 'center', paddingTop: space.s6, paddingBottom: space.s6 },
  arenaGalea: { width: ARENA_ANCHO, height: ARENA_ALTO, alignItems: 'center', justifyContent: 'center' },
  arenaFondo: { position: 'absolute', top: 0, left: 0 },
  vacioTextos: { alignItems: 'center', alignSelf: 'stretch', paddingHorizontal: space.s2 },
  vacioTitulo: {
    fontFamily: type.inscripcion.family,
    fontSize: type.inscripcion.size,
    lineHeight: type.inscripcion.lineHeight,
    letterSpacing: type.inscripcion.tracking,
    color: ink.ink10,
    marginTop: space.s5,
    textAlign: 'center',
  },
  vacioTexto: {
    fontFamily: type.body.family,
    fontSize: type.body.size,
    lineHeight: type.body.lineHeight,
    color: ink.ink8,
    textAlign: 'center',
    marginTop: space.s3,
  },
  // El descargo de salud y la línea de crisis no bajan de 14: se tienen que leer.
  vacioDescargo: { ...lectura, color: ink.ink6, textAlign: 'center', marginTop: space.s4 },
  atajos: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: space.s2,
    marginTop: space.s6,
  },
  pildora: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 38,
    paddingHorizontal: space.s3 + 2,
    borderRadius: 999,
    borderWidth: stroke.hairline,
    borderColor: ink.ink4,
  },
  pildoraOff: { opacity: 0.35 },
  pildoraTexto: { fontFamily: type.bodySm.family, fontSize: type.bodySm.size, lineHeight: 18, color: ink.ink9 },
  rapidas: { gap: space.s2, paddingHorizontal: space.s5, paddingTop: space.s3 - 2, paddingBottom: space.s1 + 3 },
  rapidasFila: { borderTopWidth: stroke.hairline, borderTopColor: ink.ink3 },
  cargandoCuerpo: { paddingHorizontal: space.s5, paddingTop: space.s5 },
  cargandoLinea: { marginTop: space.s3 - 2 },
  cargandoBloque: { marginTop: space.s6 },
  aviso: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s2,
    minHeight: 44,
    paddingHorizontal: space.s5,
    paddingVertical: space.s3 - 2,
    borderTopWidth: stroke.hairline,
    borderTopColor: ink.ink3,
  },
  // La línea de la oferta trae su propio filete arriba: el bloque no pone otro.
  avisoBloque: { paddingHorizontal: space.s5 },
  avisoFila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s2,
    paddingVertical: space.s3 - 2,
    borderTopWidth: stroke.hairline,
    borderTopColor: ink.ink3,
  },
  avisoTexto: { ...lectura, flex: 1, minWidth: 0, color: ink.ink8 },
  bandaPro: {
    gap: space.s3 - 2,
    paddingHorizontal: space.s5,
    paddingTop: space.s3,
    paddingBottom: space.s3 + 2,
    borderTopWidth: stroke.hairline,
    borderTopColor: ink.ink3,
  },
  bandaProTexto: { ...lectura, color: ink.ink8 },
  barra: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: space.s2,
    paddingLeft: space.s2,
    paddingRight: space.s4,
    paddingTop: space.s3 - 2,
    paddingBottom: space.s3,
    borderTopWidth: stroke.hairline,
    borderTopColor: ink.ink3,
    backgroundColor: ink.ink0,
  },
  input: {
    flex: 1,
    minHeight: CIRCULO,
    maxHeight: 130,
    backgroundColor: ink.ink2,
    borderWidth: stroke.hairline,
    borderColor: ink.ink4,
    color: ink.ink9,
    ...conversacion,
    paddingHorizontal: space.s3 + 2,
    paddingTop: 13,
    paddingBottom: 13,
  },
  enviar: {
    width: CIRCULO,
    height: CIRCULO,
    borderRadius: CIRCULO / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ink.ink10,
  },
  enviarOff: { opacity: 0.35 },
  sinFotos: {
    fontFamily: type.micro.family,
    fontSize: type.micro.size,
    lineHeight: type.micro.lineHeight,
    letterSpacing: type.micro.tracking,
    color: ink.ink6,
    paddingHorizontal: space.s5,
    paddingTop: space.s2,
  },
  adjuntar: {
    width: 44,
    height: CIRCULO,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adjuntas: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s2,
    paddingHorizontal: space.s5,
    paddingBottom: space.s1,
  },
  adjuntasTexto: { ...lectura, color: ink.ink8, flex: 1 },
  quitar: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  potencia: {
    paddingHorizontal: space.s5,
    paddingTop: space.s3 - 2,
    paddingBottom: 2,
    borderTopWidth: stroke.hairline,
    borderTopColor: ink.ink3,
  },
  potenciaChips: { flexDirection: 'row', gap: space.s2 },
  barraSinLinea: { borderTopWidth: 0 },
  potenciaTexto: { ...lectura, color: ink.ink8, marginTop: space.s1 + 2 },
});
