// NIVL · La vista de Amigos (L-RADICAL §B.4 y §C): pura, solo props. Los datos
// y los efectos viven en useAmigos; la galería (/kit/pantallas) la pinta con
// datos de mentira (demo.tsx). <Competicion> llega como slot (`competicion`).
//
// Composición de la arena:
//   1. EncabezadoArena «AMIGOS» grabado, con volver, compartir (el único) y
//      el meandro. Si hay solicitudes entrantes, van justo debajo.
//   2. El podio de columnas (con 3 rivales o más) y «TU PUESTO: 3.º DE 8».
//   3. El ranking, que sube justo detrás: chips, línea de rivalidad y la lista
//      con MI FILA INVERTIDA = la única inversión de la pantalla. Con la arena
//      vacía no hay fila mía: la inversión pasa a «Invitar al primero».
//   4. Duelos (slot; las ligas, apagadas en 1.0.8). 5. Solicitudes. 6. Tu código, en piedra con
//      remaches. 7. Añadir por código, Tu ludus, Tus invitados. 8. Fuera del
//      ranking, Convivencia y Privacidad.
// `Entrada` solo en los bloques (8 como mucho), nunca en las filas.

import Ionicons from '@expo/vector-icons/Ionicons';
import { useRef, type ReactNode, type RefObject } from 'react';
import {
  ActivityIndicator,
  findNodeHandle,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Arena, Campo, EncabezadoArena, Entrada, FranjaCifras, TarjetaArena } from '@/components/arena';
import { TAM_BOTON } from '@/components/arena/EncabezadoArena';
import { Button, Chip, ChipWrap, EmptyState, Row, Screen, Section, Skeleton, SkeletonRows, Tag } from '@/components/ui';
import { Interruptor } from '@/components/ui/Interruptor';
import { ink, space, stroke, type as tipo } from '@/design/tokens';
import { useSizeClass } from '@/design/useSizeClass';
import { t } from '@/i18n';
import { LUDUS_MAX, LUDUS_MIN, lineaLudus, NOTA_LUDUS_MAX, OBJETIVOS_LUDUS } from '@/lib/elite';
import { kindMeta } from '@/lib/kinds';
import {
  codigoLegible,
  LARGO_CODIGO,
  lineaRivalidad,
  METRICA_LABEL,
  normalizarCodigo,
  type Metrica,
  type Ventana,
} from '@/lib/socialmath';
import { Aviso } from './Aviso';
import { ListaRanking, SafetyButton } from './ListaRanking';
import { Podio } from './Podio';
import type { DatosAmigos } from './useAmigos';

const VENTANAS: Ventana[] = ['semana', 'mes'];
/** De qué marcador son los chips de periodo y de métrica (cambia su etiqueta). */
type Ambito = 'ranking' | 'ludus';
const METRICAS: Metrica[] = ['xp', 'cumplimiento', 'racha'];

export type AmigosVistaProps = DatosAmigos['vista'] & {
  /** <Competicion> (duelos; ligas apagadas en 1.0.8). null en la galería. */
  competicion: ReactNode;
};

/** La planta de la arena del ranking vacío. */
const ARENA_VACIA = { ancho: 220, alto: 110 };
/** Con el texto por encima de esto, «Tu código» y «Añadir» vuelven a apilarse. */
const ESCALA_DOS_COLUMNAS = 1.35;

export function AmigosVista(p: AmigosVistaProps) {
  const { refrescando, refrescar, onVolver, abrirTarjeta, preparando, yo, subtitulo, cargando, fallo } = p;

  return (
    <Screen refreshing={refrescando} onRefresh={refrescar}>
      <Entrada indice={0}>
        <EncabezadoArena
          eyebrow={t('amigos:vista.eyebrow')}
          titulo={t('amigos:vista.titulo')}
          subtitulo={subtitulo}
          onVolver={onVolver}
          // Compartir vive solo aquí. Mientras se prepara la tarjeta, el
          // botón pasa a un indicador del mismo tamaño.
          accion={
            yo && !preparando
              ? { icono: 'share-social-outline', etiqueta: t('amigos:vista.compartirSemana'), onPress: abrirTarjeta }
              : undefined
          }
          derecha={
            yo && preparando ? (
              <View
                style={styles.preparando}
                accessible
                accessibilityRole="progressbar"
                accessibilityLabel={t('amigos:vista.preparandoSemana')}
              >
                <ActivityIndicator size="small" color={ink.ink9} />
              </View>
            ) : undefined
          }
          meandro
        />
      </Entrada>

      {cargando ? (
        <Cargando />
      ) : fallo && !yo ? (
        <TarjetaArena variante="contorno">
          <EmptyState
            compact
            icon="cloud-offline-outline"
            title={t('comun:sistemaNoResponde')}
            body={fallo}
            action={{ label: t('comun:reintentar'), onPress: refrescar }}
          />
        </TarjetaArena>
      ) : yo ? (
        <Contenido {...p} yo={yo} />
      ) : null}
    </Screen>
  );
}

/** Huecos con la forma de lo que viene: el podio y las filas. */
function Cargando() {
  return (
    <View accessibilityLabel={t('amigos:vista.cargando')} accessibilityRole="progressbar">
      <View style={styles.podioHueco}>
        {[96, 128, 72].map((alto) => (
          <View key={alto} style={styles.podioHuecoCol}>
            <Skeleton height={48} width={48} round />
            <Skeleton height={alto} width={40} style={styles.podioHuecoFuste} />
          </View>
        ))}
      </View>
      <Skeleton height={14} width={180} style={styles.huecoLinea} />
      <Skeleton height={11} width={90} style={styles.huecoRotulo} />
      <SkeletonRows rows={5} />
    </View>
  );
}

function Contenido(p: AmigosVistaProps & { yo: NonNullable<AmigosVistaProps['yo']> }) {
  const {
    yo,
    fallo,
    numAmigos,
    ranking,
    metrica,
    cambiando,
    miRango,
    rangos,
    competicion,
    entrantes,
    salientes,
    estado,
    invitaciones,
    ocultos,
    refrescar,
    refrescando,
  } = p;
  const { sizeClass } = useSizeClass();
  const { fontScale } = useWindowDimensions();
  // Desde medium, «Tu código» y «Añadir por código» van lado a lado (no con
  // el texto muy grande).
  const parLado = sizeClass !== 'compact' && fontScale <= ESCALA_DOS_COLUMNAS;

  return (
    <>
      {fallo ? (
        <TarjetaArena variante="contorno" style={styles.bloque}>
          <Text style={styles.falloLinea} accessibilityRole="alert">
            {t('amigos:vista.falloActualizar', { fallo })}
          </Text>
          <Button
            title={t('comun:reintentar')}
            size="sm"
            variant="secondary"
            onPress={refrescar}
            loading={refrescando}
            style={styles.reintentar}
          />
        </TarjetaArena>
      ) : null}

      {/* Lo que espera respuesta va lo primero; lo enviado, más abajo. */}
      {entrantes.length > 0 ? (
        <Entrada indice={1}>
          <Solicitudes {...p} entrantes={entrantes} salientes={[]} />
        </Entrada>
      ) : null}

      {numAmigos > 0 ? (
        <Entrada indice={1}>
          <Podio
            filas={ranking}
            metrica={metrica}
            rivales={numAmigos}
            miRango={miRango}
            rangos={rangos}
            atenuado={cambiando}
          />
        </Entrada>
      ) : null}

      <Entrada indice={2}>
        <Ranking {...p} />
      </Entrada>

      {competicion ? <Entrada indice={3}>{competicion}</Entrada> : null}

      {salientes.length > 0 ? (
        <Entrada indice={4}>
          <Solicitudes {...p} entrantes={[]} salientes={salientes} />
        </Entrada>
      ) : null}

      {parLado ? (
        <Entrada indice={5} style={styles.par}>
          <View style={styles.parCelda}>
            <TuCodigo {...p} yo={yo} />
          </View>
          <View style={styles.parCelda}>
            <AnadirCodigo {...p} />
          </View>
        </Entrada>
      ) : (
        <>
          <Entrada indice={5}>
            <TuCodigo {...p} yo={yo} />
          </Entrada>

          <Entrada indice={6}>
            <AnadirCodigo {...p} />
          </Entrada>
        </>
      )}

      <Entrada indice={7}>
        {estado !== 'fuera' ? <Ludus {...p} /> : null}
        {invitaciones ? <Invitados {...p} invitaciones={invitaciones} /> : null}

        {ocultos.length > 0 ? (
          <Section title={t('amigos:ocultos.titulo')} meta={`${ocultos.length}`}>
            <View style={styles.lista}>
              {ocultos.map((b) => (
                <Row
                  key={b.userId}
                  first
                  leading={<Ionicons name="eye-off-outline" size={18} color={ink.ink6} />}
                  title={b.name}
                  muted
                  detail={t('amigos:ocultos.detalle')}
                  // Toda la fila abre la hoja: el «más» es solo la pista (un
                  // botón dentro de otro es HTML inválido en la web).
                  trailing={<Ionicons name="ellipsis-horizontal" size={20} color={ink.ink6} style={styles.mas} />}
                  onPress={() => p.abrirSeguridad(b)}
                  onLongPress={() => p.quitarAmigo(b)}
                  accessibilityLongPressLabel={t('amigos:comun.quitarAmigo')}
                  accessibilityLabel={t('amigos:ocultos.a11y', { nombre: b.name })}
                  style={styles.filaLista}
                />
              ))}
            </View>
          </Section>
        ) : null}

        <Convivencia {...p} />
        <Privacidad {...p} yo={yo} />
      </Entrada>
    </>
  );
}

/** iPad: nodo nativo del botón para anclar la hoja de compartir (solo iOS; en web findNodeHandle lanza). */
function nodoAncla(ref: RefObject<View | null>): number | undefined {
  if (Platform.OS !== 'ios' || !ref.current) return undefined;
  return findNodeHandle(ref.current) ?? undefined;
}

// ── Ranking ─────────────────────────────────────────────────────────────

function Ranking(p: AmigosVistaProps) {
  const {
    numAmigos,
    visibles,
    invitar,
    ventana,
    elegirVentana,
    metrica,
    elegirMetrica,
    ranking,
    cambiando,
    quitarAmigo,
    abrirSeguridad,
    miRango,
    rangos,
  } = p;
  const vacio = useRef<View>(null);
  return (
    <Section title={t('amigos:ranking.titulo')} meta={numAmigos > 0 ? `${visibles.length}` : undefined}>
      {numAmigos === 0 ? (
        <TarjetaArena variante="contorno" remaches>
          <View style={styles.vacioArena}>
            {/* El óvalo va vacío: el único icono es el del EmptyState (que
                lo exige), así no se repite. */}
            <Arena ancho={ARENA_VACIA.ancho} alto={ARENA_VACIA.alto} variante="ovalo" />
          </View>
          {/* La inversión de la pantalla cuando no hay fila mía: invitar.
              EmptyState no expone el ref de su botón: la hoja se ancla al bloque. */}
          <View ref={vacio} collapsable={false}>
            <EmptyState
              compact
              icon="person-add-outline"
              title={t('amigos:ranking.vacioTitulo')}
              body={t('amigos:ranking.vacioCuerpo')}
              action={{ label: t('amigos:ranking.invitarPrimero'), onPress: () => invitar(nodoAncla(vacio)), variant: 'solid' }}
            />
          </View>
        </TarjetaArena>
      ) : (
        <>
          <Segmento valor={ventana} onElegir={elegirVentana} ambito="ranking" />
          <Metricas valor={metrica} onElegir={elegirMetrica} ambito="ranking" />

          <Text style={styles.rivalidad} accessibilityLiveRegion="polite">
            {lineaRivalidad(ranking, metrica, ventana)}
          </Text>

          <ListaRanking
            filas={ranking}
            metrica={metrica}
            atenuado={cambiando}
            onLongPress={quitarAmigo}
            onSafety={abrirSeguridad}
            miRango={miRango}
            rangos={rangos}
          />
          <Text style={styles.hint}>
            {t(`amigos:ranking.ayuda.${metrica}`)}
          </Text>
        </>
      )}
    </Section>
  );
}

function Segmento({ valor, onElegir, ambito }: { valor: Ventana; onElegir: (v: Ventana) => void; ambito: Ambito }) {
  return (
    <View
      style={styles.segmento}
      accessibilityRole="radiogroup"
      accessibilityLabel={t(`amigos:segmento.${ambito}.rotulo`)}
    >
      {VENTANAS.map((v) => (
        <Chip
          key={v}
          label={t(`amigos:ventana.${v}`)}
          selected={valor === v}
          onPress={() => onElegir(v)}
          style={styles.segmentoChip}
          accessibilityLabel={t(`amigos:segmento.${ambito}.${v}`)}
        />
      ))}
    </View>
  );
}

function Metricas({ valor, onElegir, ambito }: { valor: Metrica; onElegir: (m: Metrica) => void; ambito: Ambito }) {
  return (
    <ChipWrap style={styles.metricas}>
      {METRICAS.map((m) => (
        <Chip
          key={m}
          label={METRICA_LABEL[m]}
          small
          tone="accent"
          selected={valor === m}
          onPress={() => onElegir(m)}
          accessibilityLabel={t(`amigos:metricas.${ambito}`, { metrica: METRICA_LABEL[m] })}
        />
      ))}
    </ChipWrap>
  );
}

// ── Solicitudes ─────────────────────────────────────────────────────────

function Solicitudes({
  entrantes,
  salientes,
  ocupada,
  abrirSeguridad,
  responder,
  quitar,
}: Pick<AmigosVistaProps, 'entrantes' | 'salientes' | 'ocupada' | 'abrirSeguridad' | 'responder' | 'quitar'>) {
  return (
    <Section title={entrantes.length > 0 ? t('amigos:solicitudes.titulo') : t('amigos:solicitudes.enviadas')} meta={entrantes.length > 0 ? `${entrantes.length}` : undefined}>
      <View style={styles.lista}>
        {entrantes.map((r) => (
          <Row
            key={r.friendshipId}
            first
            leading={<Ionicons name="person-add-outline" size={18} color={ink.ink10} />}
            title={r.name}
            detail={t('amigos:solicitudes.entrante', { nivel: r.level })}
            style={styles.filaLista}
            // Aceptar a la derecha y rechazar como un aspa: dos chips con
            // texto dejaban al nombre en dos letras a 375 px.
            trailing={
              ocupada === r.friendshipId ? (
                <ActivityIndicator size="small" color={ink.ink10} />
              ) : (
                <View style={styles.respuestas}>
                  <SafetyButton name={r.name} onPress={() => abrirSeguridad(r)} />
                  <Button title={t('amigos:comun.aceptar')} size="sm" variant="secondary" onPress={() => responder(r, true)} />
                  <Pressable
                    onPress={() => responder(r, false)}
                    hitSlop={10}
                    style={({ pressed }) => [styles.rechazar, pressed && styles.pulsado]}
                    accessibilityRole="button"
                    accessibilityLabel={t('amigos:solicitudes.rechazarA11y', { nombre: r.name })}
                  >
                    <Ionicons name="close" size={18} color={ink.ink8} />
                  </Pressable>
                </View>
              )
            }
          />
        ))}
        {salientes.map((r) => (
          <Row
            key={r.friendshipId}
            first
            leading={<Ionicons name="hourglass-outline" size={18} color={ink.ink6} />}
            title={r.name}
            muted
            detail={t('amigos:solicitudes.saliente', { nivel: r.level })}
            style={styles.filaLista}
            trailing={
              <View style={styles.respuestas}>
                <SafetyButton name={r.name} onPress={() => abrirSeguridad(r)} />
                <Chip
                  label={t('amigos:solicitudes.retirar')}
                  small
                  onPress={() =>
                    quitar(
                      r.friendshipId,
                      t('amigos:solicitudes.retirarTitulo'),
                      t('amigos:solicitudes.retirarMensaje', { nombre: r.name }),
                      t('amigos:solicitudes.retirar'),
                    )
                  }
                  accessibilityLabel={t('amigos:solicitudes.retirarA11y', { nombre: r.name })}
                />
              </View>
            }
          />
        ))}
      </View>
    </Section>
  );
}

// ── Tu código ───────────────────────────────────────────────────────────

function TuCodigo({ yo, copiado, copiar, invitar }: Pick<AmigosVistaProps, 'copiado' | 'copiar' | 'invitar'> & {
  yo: NonNullable<AmigosVistaProps['yo']>;
}) {
  const boton = useRef<View>(null);
  return (
    <TarjetaArena variante="piedra" remaches rotulo={t('amigos:codigo.tuCodigo')} style={styles.bloque}>
      <Text
        style={styles.codigo}
        selectable
        numberOfLines={1}
        adjustsFontSizeToFit
        maxFontSizeMultiplier={1.35}
        accessibilityLabel={t('amigos:codigo.tuCodigoA11y', { codigo: yo.friendCode.split('').join(' ') })}
      >
        {codigoLegible(yo.friendCode)}
      </Text>
      <Text style={styles.cuerpo}>{t('amigos:codigo.tuCodigoCuerpo')}</Text>
      <View style={styles.botones}>
        <Button
          title={copiado ? t('amigos:codigo.copiado') : t('amigos:codigo.copiar')}
          icon={copiado ? 'checkmark' : 'copy-outline'}
          variant="secondary"
          onPress={copiar}
          style={styles.boton}
        />
        {/* Secundario: la inversión de la pantalla es mi fila del ranking. */}
        <View ref={boton} collapsable={false} style={styles.boton}>
          <Button title={t('amigos:codigo.invitar')} icon="paper-plane-outline" variant="secondary" onPress={() => invitar(nodoAncla(boton))} />
        </View>
      </View>
    </TarjetaArena>
  );
}

// ── Añadir por código ───────────────────────────────────────────────────

function AnadirCodigo({
  codigo,
  setCodigo,
  setAvisoCodigo,
  enviar,
  enviando,
  avisoCodigo,
}: Pick<AmigosVistaProps, 'codigo' | 'setCodigo' | 'setAvisoCodigo' | 'enviar' | 'enviando' | 'avisoCodigo'>) {
  return (
    <Section title={t('amigos:codigo.anadir')}>
      <View style={styles.anadirFila}>
        {/* El campo va envuelto: en la web un input no encoge por debajo de
            su ancho propio y empujaba «Enviar» fuera del margen a 375. */}
        <View style={styles.flex}>
          <Campo
            etiqueta={t('amigos:codigo.campo')}
            style={styles.codigoCampo}
            value={codigo}
            onChangeText={(v) => {
              setCodigo(normalizarCodigo(v));
              setAvisoCodigo(null);
            }}
            // i18n-ok: un código de ejemplo, no se lee como texto
            placeholder="ABCD2345"
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={LARGO_CODIGO}
            returnKeyType="send"
            onSubmitEditing={enviar}
            accessibilityLabel={t('amigos:codigo.campoA11y')}
          />
        </View>
        <Button title={t('amigos:codigo.enviar')} variant="secondary" onPress={enviar} loading={enviando} disabled={codigo.length === 0} />
      </View>
      {avisoCodigo ? <Aviso texto={avisoCodigo.texto} error={avisoCodigo.error} /> : null}
    </Section>
  );
}

// ── Ludus ───────────────────────────────────────────────────────────────

function Ludus(p: AmigosVistaProps) {
  const {
    estado,
    miLudus,
    ventanaLudus,
    elegirVentanaLudus,
    metricaLudus,
    elegirMetricaLudus,
    ludusVisibles,
    rankingLudus,
    abrirSeguridad,
    miRango,
    rangos,
    cambiarPeticion,
    setCambiarPeticion,
    objetivo,
    setObjetivo,
    setAvisoLudus,
    nota,
    setNota,
    pidiendo,
    pedirLudus,
    avisoLudus,
  } = p;
  return (
    <Section
      title={t('amigos:ludus.titulo')}
      tone="logro"
      meta={miLudus.group ? `${miLudus.group.members}/${miLudus.group.capacity}` : undefined}
    >
      {estado === 'miembro' && miLudus.group ? (
        <>
          <View style={styles.ludusCabecera}>
            <Text style={styles.ludusNombre} numberOfLines={1}>
              {miLudus.group.name.toUpperCase()}
            </Text>
            <Text style={styles.ludusLinea}>{lineaLudus(miLudus.group)}</Text>
          </View>
          <Segmento valor={ventanaLudus} onElegir={elegirVentanaLudus} ambito="ludus" />
          <Metricas valor={metricaLudus} onElegir={elegirMetricaLudus} ambito="ludus" />
          <Text style={styles.rivalidad} accessibilityLiveRegion="polite">
            {ludusVisibles.length < 2
              ? t('amigos:ludus.formandose')
              : lineaRivalidad(rankingLudus, metricaLudus, ventanaLudus)}
          </Text>
          <ListaRanking
            filas={rankingLudus}
            metrica={metricaLudus}
            onSafety={abrirSeguridad}
            miRango={miRango}
            rangos={rangos}
            invertirMiFila={false}
          />
          <Text style={styles.hint}>{t('amigos:ludus.ayuda')}</Text>
        </>
      ) : estado === 'pedido' && !cambiarPeticion ? (
        <TarjetaArena variante="contorno">
          <EmptyState
            compact
            icon="hourglass-outline"
            title={t('amigos:ludus.peticionTitulo')}
            body={t('amigos:ludus.peticionCuerpo', {
              objetivo: kindMeta(miLudus.requestedGoal ?? 'general').enFrase,
              min: LUDUS_MIN,
              max: LUDUS_MAX,
            })}
            action={{
              label: t('amigos:ludus.cambiarPeticion'),
              onPress: () => {
                setObjetivo(miLudus.requestedGoal);
                setCambiarPeticion(true);
              },
            }}
          />
        </TarjetaArena>
      ) : (
        <TarjetaArena variante="piedra">
          <Text style={styles.cuerpo}>{t('amigos:ludus.presentacion', { min: LUDUS_MIN, max: LUDUS_MAX })}</Text>
          <ChipWrap style={styles.metricas}>
            {OBJETIVOS_LUDUS.map((k) => (
              <Chip
                key={k}
                label={kindMeta(k).label}
                small
                selected={objetivo === k}
                onPress={() => {
                  setObjetivo(k);
                  setAvisoLudus(null);
                }}
                accessibilityLabel={t('amigos:ludus.objetivoA11y', { objetivo: kindMeta(k).label })}
              />
            ))}
          </ChipWrap>
          <Campo
            etiqueta={t('amigos:ludus.nota')}
            estiloBloque={styles.nota}
            value={nota}
            onChangeText={setNota}
            placeholder={t('amigos:ludus.notaPlaceholder')}
            multiline
            maxLength={NOTA_LUDUS_MAX}
            accessibilityLabel={t('amigos:ludus.notaA11y')}
          />
          <Text style={styles.contador}>
            {nota.length}/{NOTA_LUDUS_MAX}
          </Text>
          <Button
            title={t('amigos:ludus.pedirPlaza')}
            icon="shield-outline"
            variant="secondary"
            onPress={pedirLudus}
            loading={pidiendo}
            style={styles.pedir}
          />
          {avisoLudus ? <Aviso texto={avisoLudus.texto} error={avisoLudus.error} /> : null}
        </TarjetaArena>
      )}
    </Section>
  );
}

// ── Tus invitados ───────────────────────────────────────────────────────

function Invitados({
  invitaciones,
  siguienteInsignia,
  insigniasGanadas,
}: Pick<AmigosVistaProps, 'siguienteInsignia' | 'insigniasGanadas'> & {
  invitaciones: NonNullable<AmigosVistaProps['invitaciones']>;
}) {
  return (
    <Section title={t('amigos:invitados.titulo')}>
      <FranjaCifras
        cifras={[
          {
            valor: String(invitaciones.activos),
            rotulo: t('amigos:invitados.activos'),
            etiqueta: t('amigos:invitados.activosA11y', { n: invitaciones.activos }),
          },
          {
            valor: String(invitaciones.pendientes),
            rotulo: t('amigos:invitados.enPrueba'),
            etiqueta: t('amigos:invitados.enPruebaA11y', { n: invitaciones.pendientes }),
          },
        ]}
      />
      {siguienteInsignia ? (
        <Text style={styles.siguienteInsignia}>
          {t('amigos:invitados.siguiente', { nombre: siguienteInsignia.nombre, umbral: siguienteInsignia.umbral })}
        </Text>
      ) : null}
      {insigniasGanadas.length > 0 ? (
        <View style={styles.insignias}>
          {insigniasGanadas.map((nombre) => (
            <Tag key={nombre} tone="logro">
              {nombre}
            </Tag>
          ))}
        </View>
      ) : null}
      <Text style={styles.hint}>{t('amigos:invitados.ayuda')}</Text>
    </Section>
  );
}

// ── Convivencia y privacidad ────────────────────────────────────────────

function Convivencia({
  abrirSoporte,
  blockedUsers,
  safetyBusy,
  desbloquear,
}: Pick<AmigosVistaProps, 'abrirSoporte' | 'blockedUsers' | 'safetyBusy' | 'desbloquear'>) {
  return (
    <Section title={t('amigos:convivencia.titulo')}>
      <Text style={styles.cuerpo}>{t('amigos:convivencia.cuerpo')}</Text>
      <Button
        title={t('amigos:seguridad.soporte')}
        icon="help-circle-outline"
        variant="secondary"
        onPress={abrirSoporte}
        style={styles.compartir}
      />
      {blockedUsers.length > 0 ? (
        <View style={[styles.lista, styles.bloqueados]}>
          {blockedUsers.map((person) => (
            <Row
              key={person.userId}
              first
              title={person.name}
              detail={t('amigos:convivencia.bloqueado')}
              style={styles.filaLista}
              trailing={
                <Chip label={t('amigos:convivencia.desbloquear')} small disabled={safetyBusy} onPress={() => desbloquear(person)} />
              }
            />
          ))}
        </View>
      ) : null}
    </Section>
  );
}

function Privacidad({ yo, cambiarVisible }: Pick<AmigosVistaProps, 'cambiarVisible'> & {
  yo: NonNullable<AmigosVistaProps['yo']>;
}) {
  return (
    <Section title={t('amigos:privacidad.titulo')}>
      <View style={styles.lista}>
        <Row
          first
          leading={<Ionicons name={yo.socialVisible ? 'eye-outline' : 'eye-off-outline'} size={18} color={ink.ink8} />}
          title={t('amigos:privacidad.aparecer')}
          detail={
            yo.socialVisible
              ? t('amigos:privacidad.visible')
              : t('amigos:privacidad.oculto')
          }
          style={styles.filaLista}
          trailing={
            <Interruptor
              value={yo.socialVisible}
              onValueChange={cambiarVisible}
              accessibilityLabel={t('amigos:privacidad.aparecerA11y')}
            />
          }
        />
      </View>
    </Section>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  bloque: { marginBottom: space.s6 + 2 },
  // Las listas de la arena van sin tarjeta: filas con hairline (Main.dc).
  lista: { borderTopWidth: stroke.hairline, borderTopColor: ink.ink3 },
  filaLista: { borderBottomWidth: stroke.hairline, borderBottomColor: ink.ink3, borderTopWidth: 0 },
  bloqueados: { marginTop: space.s4 },
  podioHueco: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    maxWidth: 440,
    width: '100%',
    alignSelf: 'center',
    borderBottomWidth: stroke.hairline,
    borderBottomColor: ink.ink3,
    paddingBottom: space.s2,
  },
  podioHuecoCol: { alignItems: 'center', gap: space.s2 },
  podioHuecoFuste: { marginTop: space.s1 },
  huecoLinea: { alignSelf: 'center', marginTop: space.s5, marginBottom: space.s8 },
  huecoRotulo: { marginBottom: space.s3 },
  reintentar: { alignSelf: 'flex-start', marginTop: space.s3 },
  preparando: {
    width: TAM_BOTON,
    height: TAM_BOTON,
    borderWidth: stroke.hairline,
    borderColor: ink.ink4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  par: { flexDirection: 'row', alignItems: 'flex-start', gap: space.s5 },
  parCelda: { flex: 1, minWidth: 0 },
  falloLinea: {
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink9,
  },
  vacioArena: { alignItems: 'center', justifyContent: 'center', marginTop: space.s2 },
  codigo: {
    fontFamily: tipo.rank.family,
    fontSize: tipo.rank.size,
    lineHeight: tipo.rank.lineHeight,
    letterSpacing: 6,
    color: ink.ink10,
    marginTop: space.s1,
  },
  cuerpo: {
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink8,
    marginTop: space.s3,
  },
  hint: {
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink6,
    marginTop: space.s3,
  },
  botones: { flexDirection: 'row', gap: space.s2, marginTop: space.s4 },
  boton: { flex: 1 },
  compartir: { marginTop: 14 },
  siguienteInsignia: {
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink8,
    marginTop: 14,
  },
  insignias: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s2, marginTop: space.s3 },
  // El botón se alinea con la caja del Campo (la etiqueta va encima).
  anadirFila: { flexDirection: 'row', gap: space.s2, alignItems: 'flex-end' },
  // El código en Cinzel espaciado; caja, foco y relleno los pone Campo.
  codigoCampo: {
    color: ink.ink10,
    fontFamily: tipo.number.family,
    fontSize: 17,
    letterSpacing: 3,
  },
  respuestas: { flexDirection: 'row', alignItems: 'center', gap: space.s2 },
  rechazar: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: stroke.hairline,
    borderColor: ink.ink4,
  },
  pulsado: { opacity: 0.6 },
  mas: { width: 44, textAlign: 'center' },
  segmento: { flexDirection: 'row', gap: space.s2 },
  segmentoChip: { flex: 1, justifyContent: 'center' },
  metricas: { marginTop: 10 },
  rivalidad: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: tipo.bodySm.size + 0.5,
    lineHeight: 21,
    color: ink.ink9,
    marginTop: space.s4,
    marginBottom: space.s3,
  },
  ludusCabecera: { marginBottom: 14 },
  ludusNombre: {
    fontFamily: tipo.inscripcion.family,
    fontSize: 18,
    lineHeight: 24,
    letterSpacing: tipo.inscripcion.tracking,
    color: ink.ink10,
  },
  ludusLinea: {
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink8,
    marginTop: 2,
  },
  nota: { marginTop: 14 },
  contador: {
    fontFamily: tipo.micro.family,
    fontSize: tipo.micro.size,
    color: ink.ink6,
    marginTop: 6,
    textAlign: 'right',
  },
  pedir: { marginTop: space.s3 },
});
