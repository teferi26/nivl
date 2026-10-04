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

import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Barra } from '@/components/arena';
import { Campo } from '@/components/arena';
import { Avatar, Button, Card, Chip, ChipWrap, confirmar, Row, Section, Sheet } from '@/components/ui';
import { SIN_DATO } from '@/components/ui/sinDato';
import { vibrar } from '@/design/haptics';
import { ink, type as tipo } from '@/design/tokens';
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
import {
  datosRival,
  detalleResuelto,
  diasRestantes,
  etiquetaDuelo,
  lineaDuelo,
  nombreRival,
  ordenarTablero,
  repartirDuelos,
  TEXTO_RESULTADO,
  textoQuedan,
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
}

type AvisoEstado = { texto: string; error: boolean } | null;

const REGLA =
  'Se mide la disciplina: qué parte de lo tuyo cumples, ponderado por dificultad. No gana quien más misiones se pone. A igualdad, más días activos.';

export function Competicion({ amigos, recarga, retarA, onRetarA, onDisponible }: Props) {
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
      const [d, l, i] = await Promise.all([misDuelos(), misLigas(), misInvitacionesDeLiga()]);
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
  const vista = useMemo(() => repartirDuelos(duelos, hoy), [duelos, hoy]);

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
    <Section title="Competición" meta={vista.activos.length > 0 ? `${vista.activos.length}` : undefined}>
      {!cargado ? (
        <View style={styles.cargando} accessibilityLabel="Cargando la competición" accessibilityRole="progressbar">
          <ActivityIndicator size="small" color={ink.ink6} />
        </View>
      ) : (
        <>
          {fallo ? (
            <View style={styles.separado}>
              <Aviso texto={`No se ha podido cargar: ${fallo}`} error />
              <View style={styles.reintentar}>
                <Button title="Reintentar" icon="refresh" variant="secondary" size="sm" onPress={cargar} />
              </View>
            </View>
          ) : null}

          {vista.porResponder.length > 0 ? (
            <Card padded={false} style={styles.lista}>
              {vista.porResponder.map((d, i) => (
                <Row
                  key={d.id}
                  first={i === 0}
                  leading={<Ionicons name="flash-outline" size={18} color={ink.ink9} />}
                  title={`${nombreRival(d)} te reta`}
                  detail={`Duelo de disciplina · ${textoQuedan(diasRestantes(d.week_start, hoy))}`}
                  trailing={
                    ocupado === d.id ? (
                      <ActivityIndicator size="small" color={ink.ink9} />
                    ) : (
                      <View style={styles.respuestas}>
                        <Button title="Aceptar" size="sm" variant="secondary" onPress={() => responder(d, true)} />
                        <Rechazar etiqueta={`Rechazar el duelo de ${nombreRival(d)}`} onPress={() => responder(d, false)} />
                      </View>
                    )
                  }
                />
              ))}
            </Card>
          ) : null}

          {vista.activos.map((d) => (
            <DueloActivo key={d.id} d={d} hoy={hoy} />
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
                  detail="Reto enviado · falta su respuesta"
                />
              ))}
              {vista.cerrados.map((d, i) => (
                <Row
                  key={d.id}
                  first={vista.enviados.length === 0 && i === 0}
                  muted
                  leading={<Ionicons name="hourglass-outline" size={18} color={ink.ink6} />}
                  title={nombreRival(d)}
                  detail="Semana cerrada · resolviendo"
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
                      rival ? (
                        <Button title="Revancha" size="sm" variant="secondary" onPress={() => onRetarA(rival)} />
                      ) : (
                        <Text style={styles.resultado}>{TEXTO_RESULTADO[d.resultado!]}</Text>
                      )
                    }
                  />
                );
              })}
            </Card>
          ) : null}

          {invitaciones.length > 0 ? (
            <Card padded={false} style={styles.lista}>
              {invitaciones.map((inv, i) => (
                <Row
                  key={inv.league_id}
                  first={i === 0}
                  leading={<Ionicons name="mail-outline" size={18} color={ink.ink9} />}
                  title={inv.nombre}
                  detail={`${inv.de} te invita a su liga`}
                  trailing={
                    ocupado === inv.league_id ? (
                      <ActivityIndicator size="small" color={ink.ink9} />
                    ) : (
                      <View style={styles.respuestas}>
                        <Button title="Entrar" size="sm" variant="secondary" onPress={() => responderLiga(inv, true)} />
                        <Rechazar etiqueta={`Rechazar la liga ${inv.nombre}`} onPress={() => responderLiga(inv, false)} />
                      </View>
                    )
                  }
                />
              ))}
            </Card>
          ) : null}

          {ligas.length > 0 ? (
            <Card padded={false} style={styles.lista}>
              {ligas.map((l, i) => (
                <Row
                  key={l.league_id}
                  first={i === 0}
                  leading={<Ionicons name="trophy-outline" size={18} color={ink.ink9} />}
                  title={l.nombre}
                  detail={
                    l.puesto > 0
                      ? `${l.puesto}.º de ${l.miembros} esta semana`
                      : `${l.miembros} ${l.miembros === 1 ? 'miembro' : 'miembros'} · aún sin datos esta semana`
                  }
                  chevron
                  onPress={() => setLigaAbierta({ id: l.league_id, nombre: l.nombre })}
                  accessibilityLabel={`Liga ${l.nombre}. Abrir el tablero`}
                />
              ))}
            </Card>
          ) : null}

          {avisoLista ? <Aviso texto={avisoLista.texto} error={avisoLista.error} style={styles.separado} /> : null}

          {nada ? (
            <>
              <Text style={styles.vacio}>Esta semana nadie te mide. Reta a un amigo.</Text>
              <Text style={styles.hint}>
                Un duelo dura una semana, de lunes a domingo. Una liga reúne hasta {LIGA_MAX} amigos. {REGLA}
              </Text>
            </>
          ) : null}

          <View style={styles.botones}>
            <View style={styles.boton}>
              <Button
                title="Retar"
                icon="flash-outline"
                variant="secondary"
                disabled={sinAmigos}
                onPress={() => setEligiendoRival(true)}
              />
            </View>
            <View style={styles.boton}>
              <Button title="Crear liga" icon="trophy-outline" variant="secondary" onPress={() => setCreando(true)} />
            </View>
          </View>
          {sinAmigos ? <Text style={styles.hint}>Para retar a alguien, primero tiene que ser tu amigo.</Text> : null}
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

/**
 * Un duelo en curso: quién va delante, con una barra por cada uno (0–100).
 * Con el rival oculto (sus datos llegan null) solo va mi barra: ni la suya,
 * ni su índice, ni sus días, ni «va delante».
 */
function DueloActivo({ d, hoy }: { d: Duelo; hoy: string }) {
  const quedan = diasRestantes(d.week_start, hoy);
  const rival = datosRival(d);
  const nombre = nombreRival(d);
  return (
    <Card style={styles.duelo} accessibilityLabel={etiquetaDuelo(d, quedan)}>
      <View style={styles.dueloCabecera}>
        <Text style={styles.dueloTitulo} numberOfLines={1}>
          Tú contra {nombre}
        </Text>
        <Text style={styles.dueloMeta}>{textoQuedan(quedan)}</Text>
      </View>
      <BarraDuelo etiqueta="Tú" valor={d.mi_indice} dias={d.mis_dias} mia />
      {rival ? <BarraDuelo etiqueta={rival.nombre} valor={rival.indice} dias={rival.dias} /> : null}
      <Text style={styles.dueloLinea}>
        {rival ? `${lineaDuelo(d)} · disciplina de la semana` : 'Sin datos del rival · disciplina de la semana'}
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
        <Barra ratio={valor / 100} alto={6} tono={mia ? 'blanco' : 'ink8'} etiqueta={`Disciplina de ${etiqueta}`} />
      </View>
      <Text style={styles.barraValor}>{valor}</Text>
      <Text style={styles.barraDias}>{dias} d</Text>
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
      setAviso({ texto: `Reto enviado a ${elegido.name}. Empieza cuando lo acepte.`, error: false });
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
      eyebrow="Duelo semanal"
      title={elegido ? `Retar a ${elegido.name}` : 'Retar a un amigo'}
      footer={
        enviado ? (
          <Button title="Cerrar" variant="secondary" onPress={onCerrar} />
        ) : (
          <Button title="Enviar el reto" icon="flash-outline" onPress={retar} loading={enviando} disabled={!elegido} />
        )
      }
    >
      {!preelegido ? (
        <>
          <Text style={styles.rotulo}>Rival</Text>
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
                accessibilityLabel={`Retar a ${a.name}`}
              />
            ))}
          </ChipWrap>
        </>
      ) : null}
      <View style={styles.ficha}>
        <FichaLinea rotulo="Métrica" valor="Disciplina" />
        <FichaLinea rotulo="Duración" valor={`Esta semana, hasta el domingo (${textoQuedan(quedan)})`} />
      </View>
      <Text style={styles.hint}>
        {REGLA} Es la única métrica y la única duración del duelo: así nadie elige la que le favorece.
      </Text>
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
      setAviso({ texto: 'Ponle un nombre de al menos 2 letras.', error: true });
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
      eyebrow="Liga privada"
      title="Crear liga"
      footer={<Button title="Crear" icon="trophy-outline" onPress={crear} loading={enviando} />}
    >
      <Campo
        etiqueta="Nombre de la liga"
        value={nombre}
        onChangeText={(v) => {
          setNombre(v);
          setAviso(null);
        }}
        placeholder="Nombre de la liga"
        maxLength={NOMBRE_LIGA_MAX}
        returnKeyType="done"
        onSubmitEditing={crear}
        accessibilityLabel="Nombre de la liga"
      />
      <Text style={styles.hint}>
        Solo entran amigos a los que invites, y cada uno decide si acepta. Hasta {LIGA_MAX} miembros. La tabla se
        reinicia cada lunes. {REGLA}
      </Text>
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
      setAviso({ texto: `Invitación enviada a ${a.name}. Entra cuando la acepte.`, error: false });
    } catch (e) {
      vibrar('penalizacion');
      // 42501 al invitar: no eres quien la creó (el servidor no dice quién es).
      const code = (e as { code?: string } | null)?.code;
      setAviso({ texto: code === '42501' ? 'Solo quien creó la liga puede invitar.' : mensajeSistema(e), error: true });
    } finally {
      lock.current = false;
      setInvitando(null);
    }
  };

  const salir = async () => {
    if (!id || lock.current) return;
    const ok = await confirmar({
      titulo: 'Salir de la liga',
      mensaje: 'Dejarás de ver su tabla y ellos la tuya. Si la creaste tú, la liga se disuelve para todos.',
      confirmar: 'Salir',
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
      eyebrow="Liga · esta semana"
      title={liga?.nombre ?? ''}
      footer={<Button title="Salir de la liga" variant="danger" onPress={salir} loading={saliendo} />}
    >
      {filas === null ? (
        <View style={styles.cargando} accessibilityLabel="Cargando el tablero" accessibilityRole="progressbar">
          <ActivityIndicator size="small" color={ink.ink6} />
        </View>
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
              title={f.es_yo ? `${f.alias} · tú` : f.alias}
              detail={
                f.sin_datos
                  ? 'Aún sin datos esta semana'
                  : `${f.dias_activos} días activos · ritmo ${textoRitmo(f.velocidad)}`
              }
              trailing={<Text style={styles.indice}>{f.sin_datos ? SIN_DATO : f.indice}</Text>}
              accessibilityLabel={`${f.puesto > 0 ? `Puesto ${f.puesto}` : 'Sin puesto'}. ${f.es_yo ? 'Tú' : f.alias}. ${
                f.sin_datos ? 'Aún sin datos esta semana' : `Disciplina ${f.indice}, ${f.dias_activos} días activos`
              }.`}
            />
          ))}
          <Text style={styles.hint}>
            La cifra es la disciplina de la semana (0–100). Desempata el ritmo frente a tus cuatro semanas previas.
          </Text>
        </View>
      )}

      {filas !== null && invitables.length > 0 ? (
        <>
          <Text style={[styles.rotulo, styles.separado]}>Invitar</Text>
          <ChipWrap>
            {invitables.map((a) => (
              <Chip
                key={a.userId}
                label={invitados.has(a.userId) ? `${a.name} · invitado` : a.name}
                small
                icon={invitados.has(a.userId) ? 'checkmark' : 'person-add-outline'}
                disabled={invitando !== null || invitados.has(a.userId)}
                onPress={() => invitar(a)}
                accessibilityLabel={`Invitar a ${a.name} a la liga`}
              />
            ))}
          </ChipWrap>
          <Text style={styles.hint}>
            Solo quien creó la liga puede invitar. Si no la creaste tú, pídele que invite a quien quieras sumar.
          </Text>
        </>
      ) : null}
      {aviso ? <Aviso texto={aviso.texto} error={aviso.error} /> : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  cargando: { paddingVertical: 18, alignItems: 'center' },
  lista: { paddingHorizontal: 16, paddingVertical: 2 },
  separado: { marginTop: 14 },
  respuestas: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rechazar: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: ink.ink3 },
  pulsado: { opacity: 0.6 },
  resultado: { fontFamily: fonts.semibold, fontSize: 14, color: ink.ink9 },
  reintentar: { alignSelf: 'flex-start', marginTop: 8 },
  vacio: { fontFamily: fonts.semibold, fontSize: 14, color: ink.ink9, marginTop: 4 },
  hint: { fontFamily: tipo.bodySm.family, fontSize: tipo.bodySm.size, lineHeight: tipo.bodySm.lineHeight, color: ink.ink8, marginTop: 10 },
  botones: { flexDirection: 'row', gap: 8, marginTop: 6 },
  boton: { flex: 1 },
  duelo: { gap: 8 },
  dueloCabecera: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
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
