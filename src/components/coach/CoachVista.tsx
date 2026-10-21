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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Arena, BotonArena, Entrada, Galea } from '@/components/arena';
import { ProUpsellLine } from '@/components/ProOffer';
import { Button, Card, Chip, Screen, Skeleton, Tag } from '@/components/ui';
import { useTecladoAbierto } from '@/components/ui/useTecladoAbierto';
import { usePiel, type Piel } from '@/design/piel';
import { ink, space, stroke, type } from '@/design/tokens';
import { useAnchoUtil, useNavActual } from '@/design/useSizeClass';
import { t } from '@/i18n';
import type { CoachMode } from '@/lib/coach';
import { DESCARGO_SALUD, LINEA_CRISIS } from '@/lib/consentmath';
import { dateKey, relativoDe } from '@/lib/dates';
import type { DecisionOferta } from '@/lib/paywallmoment';
import type { AvisoModo } from '@/modos/avisosCoach';
import type { ModoEtiqueta } from '@/modos/tipos';
import { AvisosModo } from './AvisoModo';
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
  /** Misiones que el coach dejó en otros modos: «Ir a FOCUS» bajo la losa. */
  avisosModo?: AvisoModo[];
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
    onCambiarTexto: (texto: string) => void;
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
  /** «Ir a {modo}» de un aviso: la recarga de la rueda y el cambio de mundo. */
  onIrAModo?: (modo: ModoEtiqueta) => void;
  onPro: () => void;
  onMemoria: () => void;
}

// Atajos a los rituales: lo que el coach anterior hacía por cadena programada.
// La etiqueta y el mensaje están en coach:atajos.<clave>.
const ATAJOS = [
  { clave: 'planificaDia', icono: 'list-outline' },
  { clave: 'reporte', icono: 'clipboard-outline' },
  { clave: 'dojo', icono: 'flash-outline' },
  { clave: 'revisame', icono: 'analytics-outline' },
] as const satisfies readonly { clave: string; icono: keyof typeof Ionicons.glyphMap }[];

// Acciones rápidas sobre el cuadro, con el hilo ya empezado. Hacen lo mismo
// que los atajos del vacío: se lo envían al coach (onAtajo). En coach:rapidas.<clave>.
const RAPIDAS = [
  { clave: 'planHoy', icono: 'list-outline' },
  { clave: 'registrar', icono: 'clipboard-outline' },
  { clave: 'queEntreno', icono: 'barbell-outline' },
  { clave: 'resumenSemana', icono: 'calendar-outline' },
] as const satisfies readonly { clave: string; icono: keyof typeof Ionicons.glyphMap }[];

/** Por debajo de este ancho útil, «COACH» baja de `rank` (32) a inscripción de 20. */
const ANCHO_TITULO_GRANDE = 400;
/** La planta de la arena del vacío y la galea de su centro. */
const ARENA_ANCHO = 260;
const ARENA_ALTO = 160;
const GALEA = 96;

/** «Ha leído tu día · 4 consultas», «Listo para tu día». */
export function lineaCabecera(p: Pick<CoachVistaProps, 'cargando' | 'sinPro' | 'consultas'>): string {
  if (p.cargando) return t('coach:vista.leyendo');
  if (p.sinPro) return t('coach:vista.partePro');
  if (p.consultas <= 0) return t('coach:vista.listo');
  return t('coach:vista.haLeido', { count: p.consultas });
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
            {t('coach:vista.titulo')}
          </Text>
          {p.profundo ? <Tag>{t('coach:vista.profundoTag')}</Tag> : null}
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
            etiqueta={p.sinPro ? t('comun:verNivlPro') : t('coach:vista.verPlan')}
            onPress={p.onPro}
          />
          {/* La memoria es del coach: sin Pro no ha aprendido nada que
              enseñar. Vuelve en cuanto la cuenta tiene coach. */}
          {p.sinPro ? null : <BotonArena icono="library-outline" etiqueta={t('coach:vista.verMemoria')} onPress={p.onMemoria} />}
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
  const piel = usePiel();
  return (
    <View style={styles.vacio}>
      <Entrada indice={0}>
        <ArenaGalea />
      </Entrada>
      <Entrada indice={1} style={styles.vacioTextos}>
        <Text style={styles.vacioTitulo} accessibilityRole="header" maxFontSizeMultiplier={1.35}>
          {t('coach:vista.vacioTitulo')}
        </Text>
        <Text style={styles.vacioTexto}>{t('coach:vista.vacioCuerpo')}</Text>
        <Text style={styles.vacioDescargo}>
          {DESCARGO_SALUD} {LINEA_CRISIS}
        </Text>
      </Entrada>
      <Entrada indice={2}>
        <View style={styles.atajos} accessibilityLabel={t('coach:vista.atajosA11y')}>
          {ATAJOS.map((a) => {
            const etiqueta = t(`coach:atajos.${a.clave}.etiqueta`);
            return (
              <Pressable
                key={a.clave}
                onPress={() => onAtajo(t(`coach:atajos.${a.clave}.mensaje`))}
                hitSlop={ZONA_PILDORA}
                style={({ pressed }) => [styles.pildora, pildoraPiel(piel), pressed && styles.pulsado]}
                accessibilityRole="button"
                accessibilityLabel={etiqueta}
                accessibilityHint={t('coach:vista.enviaPista')}
              >
                <Ionicons name={a.icono} size={14} color={ink.ink8} />
                <Text style={styles.pildoraTexto} maxFontSizeMultiplier={1.35}>
                  {etiqueta}
                </Text>
              </Pressable>
            );
          })}
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
  const piel = usePiel();
  return (
    <ScrollView
      horizontal
      style={conLinea && styles.rapidasFila}
      contentContainerStyle={styles.rapidas}
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      accessibilityLabel={t('coach:vista.rapidasA11y')}
    >
      {RAPIDAS.map((a) => {
        const etiqueta = t(`coach:rapidas.${a.clave}.etiqueta`);
        return (
          <Pressable
            key={a.clave}
            onPress={() => onAtajo(t(`coach:rapidas.${a.clave}.mensaje`))}
            disabled={desactivadas}
            hitSlop={ZONA_PILDORA}
            style={({ pressed }) => [styles.pildora, pildoraPiel(piel), desactivadas && styles.pildoraOff, pressed && styles.pulsado]}
            accessibilityRole="button"
            accessibilityLabel={etiqueta}
            accessibilityHint={t('coach:vista.enviaPista')}
            accessibilityState={{ disabled: desactivadas }}
          >
            <Ionicons name={a.icono} size={14} color={ink.ink8} />
            <Text style={styles.pildoraTexto} maxFontSizeMultiplier={1.35}>
              {etiqueta}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

// Las píldoras miden 38: con esto llegan a 44 de zona táctil.
const ZONA_PILDORA = { top: 3, bottom: 3, left: 0, right: 0 };

/** «HOY», «AYER»: inscripción grabada entre dos reglas. */
function Separador({ texto }: { texto: string }) {
  // Con la piel de un mundo: letras espaciadas de 11 sin Cinzel y filete fino.
  const piel = usePiel();
  const linea = [styles.separadorLinea, piel && { height: stroke.hairline, backgroundColor: piel.borde }];
  return (
    <View style={styles.separador} accessibilityRole="header">
      <View style={linea} />
      <Text
        style={[
          styles.separadorTexto,
          piel?.coach && { fontFamily: piel.coach.fuenteRotulo, fontSize: 11, lineHeight: 14, letterSpacing: 2.2, color: piel.coach.textoTenue },
        ]}
        maxFontSizeMultiplier={1.35}
      >
        {texto}
      </Text>
      <View style={linea} />
    </View>
  );
}

export function CoachVista(p: CoachVistaProps) {
  const { compositor: c } = p;
  // La piel de un mundo (IRON): su cabecera, burbujas y compositor. Sin ella, igual que siempre.
  const piel = usePiel();
  const pc = piel?.coach;
  const cabecera = pc ? (
    pc.cabecera({ linea: lineaCabecera(p), sinPro: p.sinPro, profundo: p.profundo, cargando: p.cargando, onPro: p.onPro, onMemoria: p.onMemoria })
  ) : (
    <Cabecera p={p} />
  );
  // Con la barra de pestañas abajo, ella ya cubre el indicador de inicio. Con
  // el raíl o la barra lateral (iPad) no hay nada debajo: el pie suma el margen
  // seguro, salvo con el teclado fuera, que ya lo tapa.
  const insets = useSafeAreaInsets();
  const nav = useNavActual();
  const teclado = useTecladoAbierto();
  const fondoSeguro = nav !== 'tabs' && !teclado ? insets.bottom : 0;

  if (p.cargando) {
    // La cabecera ya, y el cuerpo en hueco: un spinner solo en mitad del negro
    // no decía ni en qué pantalla se estaba.
    return (
      <Screen plain>
        {cabecera}
        <View style={styles.cargandoCuerpo} accessibilityRole="progressbar" accessibilityLabel={t('coach:vista.cargandoA11y')}>
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
      {cabecera}

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        // El KAV mide su marco respecto a su padre (onLayout), pero el teclado
        // llega en coordenadas de pantalla: el desfase es la zona segura de
        // arriba (el padre empieza debajo de la isla). Con 8 fijo el teclado
        // tapaba la barra de entrada unos 50 pt en el iPhone.
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
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
                  {t('coach:vista.falloTitulo')}
                </Text>
                <Text style={styles.falloCargaTexto}>{t('coach:vista.falloCuerpo')}</Text>
                <Button
                  title={t('comun:reintentar')}
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
                    <View
                      style={[
                        styles.burbujaUsuario,
                        pc && {
                          backgroundColor: pc.burbujaUsuario,
                          borderRadius: pc.radioBurbuja,
                          borderBottomRightRadius: 4,
                        },
                      ]}
                    >
                      <Text style={[styles.textoUsuario, pc && styles.textoUsuarioPiel]}>{b.text}</Text>
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
                    avisos={
                      b.avisosModo?.length && p.onIrAModo ? <AvisosModo avisos={b.avisosModo} onIr={p.onIrAModo} /> : null
                    }
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
              {t('coach:vista.fotosListas', { count: p.adjuntas })}
            </Text>
            <Pressable
              onPress={p.onQuitarAdjuntas}
              hitSlop={14}
              style={styles.quitar}
              accessibilityRole="button"
              accessibilityLabel={t('coach:vista.quitarFotosA11y')}
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
              accessibilityLabel={t('coach:vista.energiaA11y', { texto: p.energia.texto })}
            >
              <Ionicons name="hourglass-outline" size={14} color={ink.ink8} />
              <Text style={styles.avisoTexto}>{p.energia.texto}</Text>
              <Ionicons name="chevron-forward" size={14} color={ink.ink6} />
            </Pressable>
          )
        ) : null}

        {p.potencia ? (
          <View style={styles.potencia}>
            <View style={styles.potenciaChips} accessibilityRole="radiogroup" accessibilityLabel={t('coach:vista.potenciaA11y')}>
              <Chip
                small
                label={t('coach:vista.estandar')}
                selected={p.potencia.modo === 'estandar'}
                onPress={() => p.potencia?.onElegir('estandar')}
              />
              <Chip
                small
                label={t('coach:vista.profundo')}
                icon="telescope-outline"
                selected={p.potencia.modo === 'profundo'}
                onPress={() => p.potencia?.onElegir('profundo')}
                disabled={!p.potencia.profundoAbierto}
                accessibilityLabel={t('coach:vista.profundoA11y', { linea: p.potencia.linea })}
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
            <View style={[styles.bandaPro, { paddingBottom: styles.bandaPro.paddingBottom + fondoSeguro }]}>
              {/* La línea de la oferta ya dice que el coach es parte de NIVL Pro. */}
              <Text style={styles.bandaProTexto}>
                {p.ofertaCerrado ? t('coach:vista.conservada') : t('coach:vista.conservadaPro')}
              </Text>
              {p.ofertaCerrado ? (
                <ProUpsellLine momento="coach_cerrado" tier={p.ofertaCerrado} />
              ) : (
                <Button title={t('comun:verNivlPro')} size="sm" onPress={p.onPro} />
              )}
            </View>
          )
        ) : (
          <View>
            {conRapidas ? <Rapidas onAtajo={p.onAtajo} desactivadas={c.ocupado} conLinea={!p.potencia} /> : null}
            <FranjaGrabacion dictado={c.dictado} aviso={c.avisoDictado} />
            {c.conFotos === false ? <Text style={styles.sinFotos}>{t('coach:vista.fotosElite')}</Text> : null}
            <View
              style={[
                styles.barra,
                (!!p.potencia || conRapidas || c.grabando || !!c.avisoDictado) && styles.barraSinLinea,
                piel && { backgroundColor: 'transparent', borderTopColor: piel.borde },
                { paddingBottom: styles.barra.paddingBottom + fondoSeguro + (pc?.margenInferior ?? 0) },
              ]}
            >
              {c.conFotos ? (
                <Pressable
                  onPress={c.onAdjuntar}
                  disabled={c.ocupado}
                  style={({ pressed }) => [styles.adjuntar, pressed && styles.pulsado]}
                  accessibilityRole="button"
                  accessibilityLabel={t('coach:vista.adjuntarA11y')}
                >
                  <Ionicons name="add" size={26} color={ink.ink8} />
                </Pressable>
              ) : null}
              <TextInput
                style={[styles.input, piel && { borderRadius: 14, backgroundColor: piel.campo, borderColor: piel.borde }]}
                value={c.texto}
                onChangeText={c.onCambiarTexto}
                placeholder={t('coach:vista.placeholder')}
                placeholderTextColor={ink.ink6}
                selectionColor={piel?.acento}
                multiline
                onKeyPress={c.onTeclear}
                accessibilityLabel={t('coach:vista.mensajeA11y')}
              />
              {/* El micrófono, siempre a la vista junto a enviar. */}
              {c.conDictado ? <BotonDictar dictado={c.dictado} disabled={c.ocupado} /> : null}
              {c.grabando ? null : (
                // La inversión de la pantalla: el círculo blanco con la flecha negra.
                // Grabando se aparta: el micrófono encendido es entonces lo único.
                <Pressable
                  onPress={c.onEnviar}
                  disabled={!c.puedeEnviar}
                  style={({ pressed }) => [
                    styles.enviar,
                    // Con piel: el cuadrado redondeado del acento de la lámina.
                    piel && { borderRadius: 12, backgroundColor: piel.acento },
                    !c.puedeEnviar && styles.enviarOff,
                    pressed && styles.pulsado,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={c.ocupado ? t('coach:vista.enviandoA11y') : t('coach:vista.enviarA11y')}
                  accessibilityState={{ disabled: !c.puedeEnviar, busy: c.ocupado }}
                >
                  {/* Con el turno en marcha, apagado y con los puntos: no se manda otro. */}
                  <Ionicons name={c.ocupado ? 'ellipsis-horizontal' : piel ? 'arrow-forward' : 'arrow-up'} size={22} color={piel ? piel.sobreAcento : ink.ink0} />
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

/** Las píldoras (atajos y rápidas) con la piel de un mundo. */
function pildoraPiel(piel: Piel | null) {
  return piel ? { borderRadius: piel.radioChip, borderColor: piel.borde, backgroundColor: piel.tarjeta } : null;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  textoUsuarioPiel: { color: ink.ink10 },
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
