// NIVL · Competición en Amigos (0048): duelos semanales y ligas privadas.
//
// - Se mide la DISCIPLINA (lo cumplido sobre lo programado, ponderado por
//   dificultad), de lunes a domingo; a igualdad, los días activos. Lo calcula
//   el servidor. No se apuesta ni se gana XP: el texto no lo insinúa.
// - Con el servidor aún sin la 0048 (esFaltaDeServidor) la sección no existe.
// - Errores: los límites (22023) llegan como ErrorVisible y pasan tal cual;
//   lo demás, con mensajeSistema. Siempre con el aviso de trama.
// - Las hojas son <Sheet> del kit; no hay captura de imagen aquí, así que el
//   Modal de la hoja no es problema.
// - 1.0.8: las ligas están apagadas con LIGAS_VISIBLES (./flags): ni se piden,
//   ni se crean, ni se pintan. Vuelven en 1.0.9 con moderación.
// - Solo se enseñan los duelos cuyo rival sigue en el marcador de amigos, y
//   cada uno lleva su «…» con la hoja de seguridad (denunciar, bloquear).

import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Barra, Campo, CargaArena, ErrorSistema } from '@/components/arena';
import { Avatar, Button, Card, Chip, ChipWrap, confirmar, Row, Section, Sheet } from '@/components/ui';
import { SIN_DATO } from '@/components/ui/sinDato';
import { vibrar } from '@/design/haptics';
import { ink, type as tipo } from '@/design/tokens';
import { t } from '@/i18n';
import {
  aceptarLiga,
  crearLiga,
  esFaltaDeServidor,
  invitarALiga,
  misDuelos,
  misInvitacionesDeLiga,
  misLigas,
  rechazarLiga,
  responderDuelo,
  retarADuelo,
  salirDeLiga,
  tableroDeLiga,
  type Duelo,
  type FilaTablero,
  type InvitacionLiga,
  type MiPosicion,
} from '@/lib/competicionData';
import { LIGA_MAX, NOMBRE_LIGA_MAX, nombreDeLiga } from '@/lib/competition';
import { dateKey } from '@/lib/dates';
import { marcarDuelosVistos, reprogramarAvisosDelPlan } from '@/lib/notifications';
import { fonts } from '@/lib/theme';
import { mensajeSistema } from '@/lib/validation';
import { Aviso } from './Aviso';
import { LIGAS_VISIBLES } from './flags';
import {
  amigoDelDuelo,
  datosRival,
  detalleResuelto,
  diasRestantes,
  duelosConRivalEnTablero,
  etiquetaDuelo,
  lineaDuelo,
  nombreRival,
  ordenarTablero,
  repartirDuelos,
  textoQuedan,
  textoResultado,
  textoRitmo,
} from './competicionVista';

export interface Amigo {
  userId: string;
  name: string;
}

interface Props {
  /** Amigos aceptados (sin mí): a quién se puede retar o invitar. */
  amigos: readonly Amigo[];
  /** Cambia al refrescar la pantalla: vuelve a pedir duelos y ligas. */
  recarga: number;
  /** Reto abierto desde el «…» de una fila; null = cerrado. */
  retarA: Amigo | null;
  onRetarA: (a: Amigo | null) => void;
  /** false si el servidor aún no tiene la competición: el padre oculta el «Retar» de las filas. */
  onDisponible: (v: boolean) => void;
  /**
   * El marcador de amigos (friends_board, sin mí); null mientras no ha
   * cargado. Un duelo cuyo rival no está aquí no se enseña.
   */
  tablero: readonly Amigo[] | null;
  /** Abre la hoja de seguridad (denunciar, bloquear) de esa persona. */
  onSeguridad: (a: Amigo) => void;
}

type AvisoEstado = { texto: string; error: boolean } | null;

/** La regla del duelo; varias ayudas la llevan dentro como {{regla}}. */
function regla(): string {
  return t('amigos:competicion.regla');
}

export function Competicion({ amigos, recarga, retarA, onRetarA, onDisponible, tablero, onSeguridad }: Props) {
  const [disponible, setDisponible] = useState(true);
  const [cargado, setCargado] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);
  const [duelos, setDuelos] = useState<Duelo[]>([]);
  const [ligas, setLigas] = useState<MiPosicion[]>([]);
  const [invitaciones, setInvitaciones] = useState<InvitacionLiga[]>([]);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [avisoLista, setAvisoLista] = useState<AvisoEstado>(null);
  const lock = useRef(false);

  // Hojas
  const [eligiendoRival, setEligiendoRival] = useState(false);
  const [creando, setCreando] = useState(false);
  const [ligaAbierta, setLigaAbierta] = useState<{ id: string; nombre: string } | null>(null);

  const cargar = useCallback(async () => {
    try {
      const [d, l, i] = await Promise.all([
        misDuelos(),
        LIGAS_VISIBLES ? misLigas() : Promise.resolve<MiPosicion[]>([]),
        LIGAS_VISIBLES ? misInvitacionesDeLiga() : Promise.resolve<InvitacionLiga[]>([]),
      ]);
      setDuelos(d);
      // L6-0: lo que se enseña aquí deja de ser novedad para el aviso de duelo.
      void marcarDuelosVistos(d);
      setLigas(l);
      setInvitaciones(i);
      setFallo(null);
      setDisponible(true);
      onDisponible(true);
    } catch (e) {
      if (esFaltaDeServidor(e)) {
        setDisponible(false);
        onDisponible(false);
      } else {
        setFallo(mensajeSistema(e));
      }
    } finally {
      setCargado(true);
    }
  }, [onDisponible]);

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar]),
  );
  const primera = useRef(true);
  useEffect(() => {
    if (primera.current) {
      primera.current = false;
      return;
    }
    cargar();
  }, [recarga, cargar]);

  const hoy = dateKey();
  // Sin el marcador aún no se sabe qué duelos enseñar: se espera (carga).
  const vista = useMemo(
    () => repartirDuelos(tablero ? duelosConRivalEnTablero(duelos, tablero) : [], hoy),
    [duelos, tablero, hoy],
  );
  const listo = cargado && tablero !== null;
  /** El «…» de un duelo: solo si el rival es una persona concreta del marcador. */
  const masOpciones = (d: Duelo) => {
    const persona = tablero ? amigoDelDuelo(d, tablero) : null;
    return persona ? <MasOpciones alias={persona.name} onPress={() => onSeguridad(persona)} /> : null;
  };

  const responder = async (d: Duelo, aceptar: boolean) => {
    if (lock.current) return;
    lock.current = true;
    setOcupado(d.id);
    setAvisoLista(null);
    try {
      await responderDuelo(d.id, aceptar);
      if (aceptar) vibrar('mision');
      await cargar();
      if (aceptar) reprogramarAvisosDelPlan();
    } catch (e) {
      vibrar('penalizacion');
      setAvisoLista({ texto: mensajeSistema(e), error: true });
    } finally {
      lock.current = false;
      setOcupado(null);
    }
  };

  const responderLiga = async (inv: InvitacionLiga, aceptar: boolean) => {
    if (lock.current) return;
    lock.current = true;
    setOcupado(inv.league_id);
    setAvisoLista(null);
    try {
      if (aceptar) {
        await aceptarLiga(inv.league_id);
        vibrar('mision');
      } else {
        await rechazarLiga(inv.league_id);
      }
      await cargar();
    } catch (e) {
      vibrar('penalizacion');
      setAvisoLista({ texto: mensajeSistema(e), error: true });
    } finally {
      lock.current = false;
      setOcupado(null);
    }
  };

  if (!disponible) return null;

  const nada =
    vista.porResponder.length +
      vista.activos.length +
      vista.enviados.length +
      vista.cerrados.length +
      vista.resueltos.length ===
      0 &&
    ligas.length === 0 &&
    invitaciones.length === 0;
  const sinAmigos = amigos.length === 0;

  return (
    <Section title={t('amigos:competicion.titulo')} meta={vista.activos.length > 0 ? `${vista.activos.length}` : undefined}>
      {!listo ? (
        <CargaArena etiqueta={t('amigos:competicion.cargando')} formas={['filas']} filas={2} />
      ) : (
        <>
          {fallo ? (
            <ErrorSistema compacto mensaje={fallo} onReintentar={cargar} style={styles.separado} />
          ) : null}

          {vista.porResponder.length > 0 ? (
            <Card padded={false} style={styles.lista}>
              {vista.porResponder.map((d, i) => (
                <Row
                  key={d.id}
                  first={i === 0}
                  leading={<Ionicons name="flash-outline" size={18} color={ink.ink9} />}
                  title={t('amigos:competicion.teReta', { nombre: nombreRival(d) })}
                  detail={t('amigos:competicion.teRetaDetalle', { quedan: textoQuedan(diasRestantes(d.week_start, hoy)) })}
                  trailing={
                    ocupado === d.id ? (
                      <ActivityIndicator size="small" color={ink.ink9} />
                    ) : (
                      <View style={styles.respuestas}>
                        <Button
                          title={t('amigos:comun.aceptar')}
                          size="sm"
                          variant="secondary"
                          onPress={() => responder(d, true)}
                        />
                        <Rechazar
                          etiqueta={t('amigos:competicion.rechazarDuelo', { nombre: nombreRival(d) })}
                          onPress={() => responder(d, false)}
                        />
                        {masOpciones(d)}
                      </View>
                    )
                  }
                />
              ))}
            </Card>
          ) : null}

          {vista.activos.map((d) => (
            <DueloActivo key={d.id} d={d} hoy={hoy} opciones={masOpciones(d)} />
          ))}

          {vista.enviados.length > 0 || vista.cerrados.length > 0 || vista.resueltos.length > 0 ? (
            <Card padded={false} style={styles.lista}>
              {vista.enviados.map((d, i) => (
                <Row
                  key={d.id}
                  first={i === 0}
                  muted
                  leading={<Ionicons name="hourglass-outline" size={18} color={ink.ink6} />}
                  title={nombreRival(d)}
                  detail={t('amigos:competicion.retoEnviado')}
                  trailing={masOpciones(d)}
                />
              ))}
              {vista.cerrados.map((d, i) => (
                <Row
                  key={d.id}
                  first={vista.enviados.length === 0 && i === 0}
                  muted
                  leading={<Ionicons name="hourglass-outline" size={18} color={ink.ink6} />}
                  title={nombreRival(d)}
                  detail={t('amigos:competicion.semanaCerrada')}
                  trailing={masOpciones(d)}
                />
              ))}
              {vista.resueltos.map((d, i) => {
                // Revancha: solo si el rival se identifica sin duda entre tus
                // amigos (el duelo trae su nombre, no su id). Con el rival
                // oculto (null) no hay a quién retar.
                const mismos =
                  d.resultado === 'pierdo' && d.rival != null && d.rival !== ''
                    ? amigos.filter((a) => a.name === d.rival)
                    : [];
                const rival = mismos.length === 1 ? mismos[0]! : null;
                return (
                  <Row
                    key={d.id}
                    first={vista.enviados.length + vista.cerrados.length === 0 && i === 0}
                    leading={<Ionicons name="flag-outline" size={18} color={ink.ink6} />}
                    title={nombreRival(d)}
                    detail={detalleResuelto(d, rival !== null)}
                    trailing={
                      <View style={styles.respuestas}>
                        {rival ? (
                          <Button title={t('amigos:competicion.revancha')} size="sm" variant="secondary" onPress={() => onRetarA(rival)} />
                        ) : (
                          <Text style={styles.resultado}>{textoResultado(d.resultado!)}</Text>
                        )}
                        {masOpciones(d)}
                      </View>
                    }
                  />
                );
              })}
            </Card>
          ) : null}

          {LIGAS_VISIBLES && invitaciones.length > 0 ? (
            <Card padded={false} style={styles.lista}>
              {invitaciones.map((inv, i) => (
                <Row
                  key={inv.league_id}
                  first={i === 0}
                  leading={<Ionicons name="mail-outline" size={18} color={ink.ink9} />}
                  title={inv.nombre}
                  detail={t('amigos:liga.teInvita', { de: inv.de })}
                  trailing={
                    ocupado === inv.league_id ? (
                      <ActivityIndicator size="small" color={ink.ink9} />
                    ) : (
                      <View style={styles.respuestas}>
                        <Button
                          title={t('amigos:liga.entrar')}
                          size="sm"
                          variant="secondary"
                          onPress={() => responderLiga(inv, true)}
                        />
                        <Rechazar
                          etiqueta={t('amigos:liga.rechazar', { nombre: inv.nombre })}
                          onPress={() => responderLiga(inv, false)}
                        />
                      </View>
                    )
                  }
                />
              ))}
            </Card>
          ) : null}

          {LIGAS_VISIBLES && ligas.length > 0 ? (
            <Card padded={false} style={styles.lista}>
              {ligas.map((l, i) => (
                <Row
                  key={l.league_id}
                  first={i === 0}
                  leading={<Ionicons name="trophy-outline" size={18} color={ink.ink9} />}
                  title={l.nombre}
                  detail={
                    l.puesto > 0
                      ? t('amigos:liga.puestoSemana', { puesto: l.puesto, total: l.miembros })
                      : t('amigos:liga.miembrosSinDatos', { count: l.miembros })
                  }
                  chevron
                  onPress={() => setLigaAbierta({ id: l.league_id, nombre: l.nombre })}
                  accessibilityLabel={t('amigos:liga.abrirA11y', { nombre: l.nombre })}
                />
              ))}
            </Card>
          ) : null}

          {avisoLista ? <Aviso texto={avisoLista.texto} error={avisoLista.error} style={styles.separado} /> : null}

          {nada ? (
            <>
              <Text style={styles.vacio}>{t('amigos:competicion.vacio')}</Text>
              <Text style={styles.hint}>
                {LIGAS_VISIBLES
                  ? t('amigos:competicion.vacioAyudaLigas', { max: LIGA_MAX, regla: regla() })
                  : t('amigos:competicion.vacioAyuda', { regla: regla() })}
              </Text>
            </>
          ) : null}

          <View style={styles.botones}>
            <View style={styles.boton}>
              <Button
                title={t('amigos:competicion.retar')}
                icon="flash-outline"
                variant="secondary"
                disabled={sinAmigos}
                onPress={() => setEligiendoRival(true)}
              />
            </View>
            {LIGAS_VISIBLES ? (
              <View style={styles.boton}>
                <Button title={t('amigos:liga.crear')} icon="trophy-outline" variant="secondary" onPress={() => setCreando(true)} />
              </View>
            ) : null}
          </View>
          {sinAmigos ? <Text style={styles.hint}>{t('amigos:competicion.sinAmigos')}</Text> : null}
        </>
      )}

      <RetarSheet
        visible={eligiendoRival || retarA !== null}
        amigos={amigos}
        preelegido={retarA}
        hoy={hoy}
        onCerrar={() => {
          setEligiendoRival(false);
          onRetarA(null);
        }}
        onHecho={cargar}
      />
      {LIGAS_VISIBLES ? (
        <>
          <CrearLigaSheet
            visible={creando}
            onCerrar={() => setCreando(false)}
            onCreada={(id, nombre) => {
              setCreando(false);
              cargar();
              setLigaAbierta({ id, nombre });
            }}
          />
          <LigaSheet liga={ligaAbierta} amigos={amigos} onCerrar={() => setLigaAbierta(null)} onCambio={cargar} />
        </>
      ) : null}
    </Section>
  );
}

function Rechazar({ etiqueta, onPress }: { etiqueta: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      style={({ pressed }) => [styles.rechazar, pressed && styles.pulsado]}
      accessibilityRole="button"
      accessibilityLabel={etiqueta}
    >
      <Ionicons name="close" size={18} color={ink.ink8} />
    </Pressable>
  );
}

/** El «…» de un duelo: 44 pt, abre la hoja de seguridad de ese rival. */
function MasOpciones({ alias, onPress }: { alias: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={() => {
        vibrar('seleccion');
        onPress();
      }}
      style={({ pressed }) => [styles.mas, pressed && styles.pulsado]}
      accessibilityRole="button"
      accessibilityLabel={t('amigos:competicion.masOpciones', { nombre: alias })}
      accessibilityHint={t('amigos:competicion.masOpcionesPista')}
    >
      <Ionicons name="ellipsis-horizontal" size={18} color={ink.ink8} />
    </Pressable>
  );
}

/**
 * Un duelo en curso: quién va delante, con una barra por cada uno (0–100).
 * Con el rival oculto (sus datos llegan null) solo va mi barra: ni la suya,
 * ni su índice, ni sus días, ni «va delante».
 */
function DueloActivo({ d, hoy, opciones }: { d: Duelo; hoy: string; opciones: ReactNode }) {
  const quedan = diasRestantes(d.week_start, hoy);
  const rival = datosRival(d);
  const nombre = nombreRival(d);
  return (
    <Card style={styles.duelo} accessibilityLabel={etiquetaDuelo(d, quedan)}>
      <View style={styles.dueloCabecera}>
        <Text style={styles.dueloTitulo} numberOfLines={1}>
          {t('amigos:competicion.tuContra', { nombre })}
        </Text>
        <Text style={styles.dueloMeta}>{textoQuedan(quedan)}</Text>
        {opciones}
      </View>
      <BarraDuelo etiqueta={t('amigos:comun.tu')} valor={d.mi_indice} dias={d.mis_dias} mia />
      {rival ? <BarraDuelo etiqueta={rival.nombre} valor={rival.indice} dias={rival.dias} /> : null}
      <Text style={styles.dueloLinea}>
        {rival
          ? t('amigos:competicion.lineaSemana', { linea: lineaDuelo(d) })
          : t('amigos:competicion.sinDatosRival')}
      </Text>
    </Card>
  );
}

// La barra de la arena (L-RADICAL §B.4.4): la mía en blanco, la del rival en
// ink8. El duelo entero se anuncia en la tarjeta; la fila no se lee aparte.
function BarraDuelo({ etiqueta, valor, dias, mia }: { etiqueta: string; valor: number; dias: number; mia?: boolean }) {
  return (
    <View style={styles.barraFila} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      <Text style={styles.barraEtiqueta} numberOfLines={1}>
        {etiqueta}
      </Text>
      <View style={styles.pista}>
        <Barra ratio={valor / 100} alto={6} tono={mia ? 'blanco' : 'ink8'} etiqueta={t('amigos:competicion.disciplinaDe', { nombre: etiqueta })} />
      </View>
      <Text style={styles.barraValor}>{valor}</Text>
      <Text style={styles.barraDias}>{/* i18n-ok: unidad */}
        {dias} d
      </Text>
    </View>
  );
}

// ── Hoja: retar ─────────────────────────────────────────────────────────

function RetarSheet({
  visible,
  amigos,
  preelegido,
  hoy,
  onCerrar,
  onHecho,
}: {
  visible: boolean;
  amigos: readonly Amigo[];
  preelegido: Amigo | null;
  hoy: string;
  onCerrar: () => void;
  onHecho: () => void;
}) {
  const [elegido, setElegido] = useState<Amigo | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState<AvisoEstado>(null);
  const lock = useRef(false);

  useEffect(() => {
    if (!visible) return;
    setElegido(preelegido);
    setAviso(null);
  }, [visible, preelegido]);

  // La semana del duelo empieza el lunes de esta semana (lo fija el servidor).
  const lunes = useMemo(() => {
    const [y, m, d] = hoy.split('-').map(Number);
    const fecha = new Date(Date.UTC(y, m - 1, d));
    const dow = (fecha.getUTCDay() + 6) % 7;
    return new Date(fecha.getTime() - dow * 86_400_000).toISOString().slice(0, 10);
  }, [hoy]);
  const quedan = diasRestantes(lunes, hoy);

  const retar = async () => {
    if (!elegido || lock.current) return;
    lock.current = true;
    setEnviando(true);
    setAviso(null);
    try {
      await retarADuelo(elegido.userId);
      vibrar('mision');
      setAviso({ texto: t('amigos:retar.enviado', { nombre: elegido.name }), error: false });
      onHecho();
    } catch (e) {
      vibrar('penalizacion');
      setAviso({ texto: mensajeSistema(e), error: true });
    } finally {
      lock.current = false;
      setEnviando(false);
    }
  };

  const enviado = aviso !== null && !aviso.error;

  return (
    <Sheet
      visible={visible}
      onClose={onCerrar}
      eyebrow={t('amigos:retar.eyebrow')}
      title={elegido ? t('amigos:retar.retarA', { nombre: elegido.name }) : t('amigos:retar.retarAmigo')}
      footer={
        enviado ? (
          <Button title={t('comun:cerrar')} variant="secondary" onPress={onCerrar} />
        ) : (
          <Button
            title={t('amigos:retar.enviar')}
            icon="flash-outline"
            onPress={retar}
            loading={enviando}
            disabled={!elegido}
          />
        )
      }
    >
      {!preelegido ? (
        <>
          <Text style={styles.rotulo}>{t('amigos:retar.rival')}</Text>
          <ChipWrap>
            {amigos.map((a) => (
              <Chip
                key={a.userId}
                label={a.name}
                small
                selected={elegido?.userId === a.userId}
                onPress={() => {
                  vibrar('seleccion');
                  setElegido(a);
                  setAviso(null);
                }}
                accessibilityLabel={t('amigos:retar.retarA', { nombre: a.name })}
              />
            ))}
          </ChipWrap>
        </>
      ) : null}
      <View style={styles.ficha}>
        <FichaLinea rotulo={t('amigos:retar.metrica')} valor={t('amigos:retar.disciplina')} />
        <FichaLinea rotulo={t('amigos:retar.duracion')} valor={t('amigos:retar.duracionValor', { quedan: textoQuedan(quedan) })} />
      </View>
      <Text style={styles.hint}>{t('amigos:retar.ayuda', { regla: regla() })}</Text>
      {aviso ? <Aviso texto={aviso.texto} error={aviso.error} /> : null}
    </Sheet>
  );
}

function FichaLinea({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <View style={styles.fichaLinea}>
      <Text style={styles.fichaRotulo}>{rotulo}</Text>
      <Text style={styles.fichaValor}>{valor}</Text>
    </View>
  );
}

// ── Hoja: crear liga ────────────────────────────────────────────────────

function CrearLigaSheet({
  visible,
  onCerrar,
  onCreada,
}: {
  visible: boolean;
  onCerrar: () => void;
  onCreada: (id: string, nombre: string) => void;
}) {
  const [nombre, setNombre] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState<AvisoEstado>(null);
  const lock = useRef(false);

  useEffect(() => {
    if (!visible) return;
    setNombre('');
    setAviso(null);
  }, [visible]);

  const crear = async () => {
    if (lock.current) return;
    const limpio = nombreDeLiga(nombre);
    if (!limpio) {
      setAviso({ texto: t('amigos:liga.nombreCorto'), error: true });
      return;
    }
    lock.current = true;
    setEnviando(true);
    setAviso(null);
    try {
      const id = await crearLiga(limpio);
      vibrar('mision');
      onCreada(id, limpio);
    } catch (e) {
      vibrar('penalizacion');
      setAviso({ texto: mensajeSistema(e), error: true });
    } finally {
      lock.current = false;
      setEnviando(false);
    }
  };

  return (
    <Sheet
      visible={visible}
      onClose={onCerrar}
      eyebrow={t('amigos:liga.privada')}
      title={t('amigos:liga.crear')}
      footer={<Button title={t('amigos:liga.crearBoton')} icon="trophy-outline" onPress={crear} loading={enviando} />}
    >
      <Campo
        etiqueta={t('amigos:liga.nombre')}
        value={nombre}
        onChangeText={(v) => {
          setNombre(v);
          setAviso(null);
        }}
        placeholder={t('amigos:liga.nombrePlaceholder')}
        maxLength={NOMBRE_LIGA_MAX}
        returnKeyType="done"
        onSubmitEditing={crear}
        accessibilityLabel={t('amigos:liga.nombre')}
      />
      <Text style={styles.hint}>{t('amigos:liga.crearAyuda', { max: LIGA_MAX, regla: regla() })}</Text>
      {aviso ? <Aviso texto={aviso.texto} error={aviso.error} /> : null}
    </Sheet>
  );
}

// ── Hoja: una liga (tablero, invitar, salir) ────────────────────────────

function LigaSheet({
  liga,
  amigos,
  onCerrar,
  onCambio,
}: {
  liga: { id: string; nombre: string } | null;
  amigos: readonly Amigo[];
  onCerrar: () => void;
  onCambio: () => void;
}) {
  const [filas, setFilas] = useState<FilaTablero[] | null>(null);
  const [aviso, setAviso] = useState<AvisoEstado>(null);
  const [invitando, setInvitando] = useState<string | null>(null);
  const [invitados, setInvitados] = useState<ReadonlySet<string>>(() => new Set());
  const [saliendo, setSaliendo] = useState(false);
  const lock = useRef(false);
  const id = liga?.id ?? null;

  useEffect(() => {
    if (!id) return;
    let vivo = true;
    setFilas(null);
    setAviso(null);
    setInvitados(new Set());
    tableroDeLiga(id)
      .then((f) => {
        if (vivo) setFilas(f);
      })
      .catch((e) => {
        if (!vivo) return;
        setFilas([]);
        setAviso({ texto: mensajeSistema(e), error: true });
      });
    return () => {
      vivo = false;
    };
  }, [id]);

  const tabla = useMemo(() => ordenarTablero(filas ?? []), [filas]);
  // A quién se puede invitar: los amigos que aún no están en el tablero. El
  // tablero no trae ids (solo el alias público, cortado a 40), así que se
  // compara por nombre.
  const invitables = useMemo(() => {
    const dentro = new Set((filas ?? []).filter((f) => !f.es_yo).map((f) => f.alias));
    return amigos.filter((a) => !dentro.has(a.name.slice(0, 40)));
  }, [filas, amigos]);

  const invitar = async (a: Amigo) => {
    if (!id || lock.current) return;
    lock.current = true;
    setInvitando(a.userId);
    setAviso(null);
    try {
      await invitarALiga(id, a.userId);
      vibrar('mision');
      setInvitados((s) => new Set(s).add(a.userId));
      setAviso({ texto: t('amigos:liga.invitacionEnviada', { nombre: a.name }), error: false });
    } catch (e) {
      vibrar('penalizacion');
      // 42501 al invitar: no eres quien la creó (el servidor no dice quién es).
      const code = (e as { code?: string } | null)?.code;
      setAviso({ texto: code === '42501' ? t('amigos:liga.soloCreador') : mensajeSistema(e), error: true });
    } finally {
      lock.current = false;
      setInvitando(null);
    }
  };

  const salir = async () => {
    if (!id || lock.current) return;
    const ok = await confirmar({
      titulo: t('amigos:liga.salir'),
      mensaje: t('amigos:liga.salirMensaje'),
      confirmar: t('amigos:liga.salirConfirmar'),
      destructivo: true,
    });
    if (!ok || lock.current) return;
    lock.current = true;
    setSaliendo(true);
    try {
      await salirDeLiga(id);
      vibrar('destructiva');
      onCambio();
      onCerrar();
    } catch (e) {
      setAviso({ texto: mensajeSistema(e), error: true });
    } finally {
      lock.current = false;
      setSaliendo(false);
    }
  };

  return (
    <Sheet
      visible={liga !== null}
      onClose={onCerrar}
      eyebrow={t('amigos:liga.eyebrow')}
      title={liga?.nombre ?? ''}
      footer={<Button title={t('amigos:liga.salir')} variant="danger" onPress={salir} loading={saliendo} />}
    >
      {filas === null ? (
        <CargaArena etiqueta={t('amigos:liga.cargandoTablero')} formas={['filas']} />
      ) : (
        <View>
          {tabla.map((f, i) => (
            <Row
              key={`${f.alias}-${i}`}
              first={i === 0}
              style={f.es_yo ? styles.miFila : undefined}
              leading={
                <View style={styles.puesto}>
                  <Text style={styles.puestoTexto}>{f.puesto > 0 ? `${f.puesto}.º` : SIN_DATO}</Text>
                  <Avatar size={32} avatarPath={f.retrato} name={f.alias} rank={null} />
                </View>
              }
              title={f.es_yo ? t('amigos:lista.nombreYo', { nombre: f.alias }) : f.alias}
              detail={
                f.sin_datos
                  ? t('amigos:liga.sinDatosSemana')
                  : t('amigos:liga.filaDetalle', { dias: f.dias_activos, ritmo: textoRitmo(f.velocidad) })
              }
              trailing={<Text style={styles.indice}>{f.sin_datos ? SIN_DATO : f.indice}</Text>}
              accessibilityLabel={
                f.sin_datos
                  ? t('amigos:liga.filaA11ySinDatos', {
                      puesto: f.puesto > 0 ? t('amigos:lista.puesto', { n: f.puesto }) : t('amigos:lista.sinPuesto'),
                      nombre: f.es_yo ? t('amigos:comun.tu') : f.alias,
                    })
                  : t('amigos:liga.filaA11y', {
                      puesto: f.puesto > 0 ? t('amigos:lista.puesto', { n: f.puesto }) : t('amigos:lista.sinPuesto'),
                      nombre: f.es_yo ? t('amigos:comun.tu') : f.alias,
                      indice: f.indice,
                      dias: f.dias_activos,
                    })
              }
            />
          ))}
          <Text style={styles.hint}>{t('amigos:liga.tableroAyuda')}</Text>
        </View>
      )}

      {filas !== null && invitables.length > 0 ? (
        <>
          <Text style={[styles.rotulo, styles.separado]}>{t('amigos:liga.invitar')}</Text>
          <ChipWrap>
            {invitables.map((a) => (
              <Chip
                key={a.userId}
                label={invitados.has(a.userId) ? t('amigos:liga.invitado', { nombre: a.name }) : a.name}
                small
                icon={invitados.has(a.userId) ? 'checkmark' : 'person-add-outline'}
                disabled={invitando !== null || invitados.has(a.userId)}
                onPress={() => invitar(a)}
                accessibilityLabel={t('amigos:liga.invitarA11y', { nombre: a.name })}
              />
            ))}
          </ChipWrap>
          <Text style={styles.hint}>{t('amigos:liga.invitarAyuda')}</Text>
        </>
      ) : null}
      {aviso ? <Aviso texto={aviso.texto} error={aviso.error} /> : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  lista: { paddingHorizontal: 16, paddingVertical: 2 },
  separado: { marginTop: 14 },
  respuestas: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rechazar: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: ink.ink3 },
  pulsado: { opacity: 0.6 },
  mas: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginRight: -10 },
  resultado: { fontFamily: fonts.semibold, fontSize: 14, color: ink.ink9 },
  vacio: { fontFamily: fonts.semibold, fontSize: 14, color: ink.ink9, marginTop: 4 },
  hint: { fontFamily: tipo.bodySm.family, fontSize: tipo.bodySm.size, lineHeight: tipo.bodySm.lineHeight, color: ink.ink8, marginTop: 10 },
  botones: { flexDirection: 'row', gap: 8, marginTop: 6 },
  boton: { flex: 1 },
  duelo: { gap: 8 },
  dueloCabecera: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  dueloTitulo: { flex: 1, fontFamily: fonts.semibold, fontSize: 15, color: ink.ink9 },
  dueloMeta: { fontFamily: fonts.body, fontSize: 12, color: ink.ink6 },
  dueloLinea: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: ink.ink8, marginTop: 2 },
  barraFila: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  barraEtiqueta: { width: 72, fontFamily: fonts.body, fontSize: 12.5, color: ink.ink8 },
  pista: { flex: 1 },
  barraValor: { width: 28, textAlign: 'right', fontFamily: fonts.number, fontSize: 13, color: ink.ink9 },
  barraDias: { width: 28, textAlign: 'right', fontFamily: fonts.body, fontSize: 11, color: ink.ink6 },
  rotulo: {
    fontFamily: tipo.label.family,
    fontSize: tipo.label.size,
    lineHeight: tipo.label.lineHeight,
    letterSpacing: tipo.label.tracking,
    textTransform: 'uppercase',
    color: ink.ink6,
    marginBottom: 10,
  },
  ficha: { marginTop: 16, borderTopWidth: 1, borderTopColor: ink.ink3 },
  fichaLinea: { flexDirection: 'row', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: ink.ink3 },
  fichaRotulo: { width: 80, fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: ink.ink6 },
  fichaValor: { flex: 1, fontFamily: fonts.semibold, fontSize: 14, lineHeight: 20, color: ink.ink9 },
  miFila: { backgroundColor: ink.ink2 },
  puesto: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  puestoTexto: { width: 28, fontFamily: fonts.number, fontSize: 13, color: ink.ink8 },
  indice: { fontFamily: fonts.number, fontSize: 15, color: ink.ink9 },
});
