// NIVL · Contrato: la vista (patrón L-RADICAL §C, FASE3 G1). Pura: todo llega
// por props desde useContrato (o desde la galería con datos de mentira).
//
// De arriba abajo: el encabezado grabado («Lo que tú firmas» / «CONTRATO»),
// las normas como la tablilla del onboarding (losa remachada sobre su zócalo,
// greca arriba y abajo, «CONTRATO» grabado) con cada norma en una fila entre
// hairlines (numeral romano, la norma, la consecuencia y lo que cuesta), los
// puntos bonus en una FranjaCifras, la carta sellada y la tabla de cómo se
// gana y se pierde (sale de game.ts: no puede desincronizarse del motor).
//
// La tablilla es propia y no la TablillaContrato del onboarding: aquella
// pinta párrafos que se leen; aquí cada norma es un botón (tocar = confesar
// que se ha roto; mantener = eliminarla) con un lápiz al lado para editarla
// (también como acción de accesibilidad de la fila). Una norma editada en esta
// sesión lo dice debajo: las roturas de antes siguen en la versión archivada.
//
// INVERSIÓN única: con normas, la acción «Firmar una norma nueva» del
// encabezado; sin normas, «Firmar la primera norma» dentro de la tablilla
// vacía (y el encabezado no lleva acción).

import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  CargaArena,
  EncabezadoArena,
  Entrada,
  ErrorSistema,
  FranjaCifras,
  Meandro,
  TarjetaArena,
  romano,
} from '@/components/arena';
import { Button, Screen, Section } from '@/components/ui';
import { ink, space, stroke, type as tipo } from '@/design/tokens';
import { esCompromiso } from '@/lib/compromiso';
import { fechaConAnio } from '@/lib/dates';
import {
  BONUS_BY_DIFFICULTY,
  BOSS_MULTIPLIER,
  DAILY_PENALTY_CAP,
  DIFFICULTIES,
  DUNGEON_CLEAR_XP,
  EVIDENCE_BONUS,
  GOAL_ACHIEVED_XP,
  GYM_SESSION_XP,
  JOURNAL_XP,
  PENALTY_FACTOR,
  PR_XP,
  REDEEM_COST,
  REDEEM_WEEKLY_CAP,
  RULE_BREAK_XP,
  streakMultiplier,
  WEIGH_IN_XP,
  XP_BY_DIFFICULTY,
} from '@/lib/game';
import type { Letter, Rule } from '@/lib/types';

export interface ContratoVistaProps {
  /** Hasta la primera carga se pintan huecos. */
  cargado: boolean;
  /** Fallo al cargar, ya escrito para el usuario. */
  errorCarga: string | null;
  hoy: string;
  /** El perfil ha llegado (sin él no se puede canjear). */
  conPerfil: boolean;
  /** Solo las activas, en su orden. */
  reglas: Rule[];
  /** Ids de las normas editadas en esta sesión. */
  editadas: ReadonlySet<string>;
  bonus: number;
  gastadoSemana: number;
  carta: Letter | null;
  /** Cargando las normas del cuaderno. */
  sembrando: boolean;
  acciones: {
    onVolver: () => void;
    onNuevaNorma: () => void;
    onRomper: (r: Rule) => void;
    onEliminar: (r: Rule) => void;
    onEditar: (r: Rule) => void;
    onCanjear: () => void;
    onCargarPlantilla: () => void;
    onEscribirCarta: () => void;
    onAbrirCarta: () => void;
    onReintentar: () => void;
  };
}

/** «2026-10-02T…» → «viernes, 2 de octubre de 2026». */
function fecha(iso: string): string {
  return fechaConAnio(iso.slice(0, 10));
}

/** Tabla de transparencia: los valores salen de game.ts. */
function tablas() {
  const ganancias = [
    { label: 'Misión (trivial a épica)', value: `${DIFFICULTIES.map((d) => XP_BY_DIFFICULTY[d]).join(' · ')} XP` },
    { label: 'Evidencia (foto)', value: `+${Math.round(EVIDENCE_BONUS * 100)} %` },
    {
      label: 'Racha',
      value: `+${Math.round((streakMultiplier(7) - 1) * 100)} % por semana · techo ×${streakMultiplier(9999).toFixed(1).replace('.', ',')}`,
    },
    { label: 'Sesión de gimnasio', value: `${GYM_SESSION_XP} XP` },
    { label: 'Récord personal', value: `${PR_XP} XP` },
    { label: 'Página del diario', value: `${JOURNAL_XP} XP` },
    { label: 'Pesarte', value: `${WEIGH_IN_XP} XP` },
    { label: 'Objetivo cumplido', value: `${GOAL_ACHIEVED_XP} XP` },
    { label: 'Tarea de campaña', value: `XP de su dificultad · jefe ×${BOSS_MULTIPLIER}` },
    { label: 'Campaña despejada', value: `De ${DUNGEON_CLEAR_XP.E} a ${DUNGEON_CLEAR_XP.S} XP según rango` },
    { label: 'Misión extra', value: `${DIFFICULTIES.map((d) => BONUS_BY_DIFFICULTY[d]).join(' · ')} PB` },
  ];
  const perdidas = [
    { label: 'Misión del día sin hacer', value: `−${Math.round(PENALTY_FACTOR * 100)} % de su XP · tope −${DAILY_PENALTY_CAP}/día` },
    { label: 'Romper una norma firmada', value: `−${RULE_BREAK_XP} XP + consecuencia` },
    { label: 'Piedra de protección', value: 'Absorbe todo el daño de un día' },
  ];
  return { ganancias, perdidas };
}

/** Concepto a la izquierda, valor a la derecha, entre hairlines. */
function Tabla({ filas }: { filas: { label: string; value: string }[] }) {
  return (
    <View>
      {filas.map((f, i) => (
        <View
          key={f.label}
          style={[styles.tablaFila, i > 0 && styles.hairline]}
          accessible
          accessibilityLabel={`${f.label}: ${f.value}`}
        >
          <Text style={styles.tablaConcepto} maxFontSizeMultiplier={1.35}>
            {f.label}
          </Text>
          <Text style={styles.tablaValor} maxFontSizeMultiplier={1.35}>
            {f.value}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** Una norma de la tablilla: tocar = confesar; mantener = eliminar; el lápiz, editar. */
function FilaNorma({
  regla,
  indice,
  editada,
  onRomper,
  onEliminar,
  onEditar,
}: {
  regla: Rule;
  indice: number;
  editada: boolean;
  onRomper: (r: Rule) => void;
  onEliminar: (r: Rule) => void;
  onEditar: (r: Rule) => void;
}) {
  const numeral = romano(indice + 1);
  return (
    <View style={[styles.normaFila, indice > 0 && styles.hairline]}>
      <Pressable
        onPress={() => onRomper(regla)}
        onLongPress={() => onEliminar(regla)}
        style={({ pressed }) => [styles.norma, pressed && styles.normaPulsada]}
        accessibilityRole="button"
        accessibilityLabel={`Norma ${indice + 1}: ${regla.text}. Si la rompes: ${regla.consequence}. Cuesta ${RULE_BREAK_XP} XP.${editada ? ' Editada hoy.' : ''}`}
        accessibilityHint="Toca para confesar que la has roto. Mantén pulsado para eliminarla."
        accessibilityActions={[
          { name: 'activate', label: 'Confesar que la has roto' },
          { name: 'editar', label: 'Editar la norma' },
          { name: 'longpress', label: 'Eliminar la norma' },
        ]}
        onAccessibilityAction={(e) => {
          if (e.nativeEvent.actionName === 'longpress') onEliminar(regla);
          else if (e.nativeEvent.actionName === 'editar') onEditar(regla);
          else onRomper(regla);
        }}
      >
        <Text style={styles.numeral} maxFontSizeMultiplier={1.35}>
          {numeral}
        </Text>
        <View style={styles.normaCuerpo}>
          <Text style={styles.normaTexto} maxFontSizeMultiplier={1.35}>
            {regla.text}
          </Text>
          <Text style={styles.normaConsecuencia} maxFontSizeMultiplier={1.35}>
            Si la rompes: {regla.consequence}
          </Text>
          {editada ? (
            <Text style={styles.normaEditada} maxFontSizeMultiplier={1.35}>
              Editada hoy. Las roturas anteriores quedan en la versión archivada.
            </Text>
          ) : null}
        </View>
        <Text style={styles.normaCoste} maxFontSizeMultiplier={1.35}>
          −{RULE_BREAK_XP}
        </Text>
      </Pressable>
      <Pressable
        onPress={() => onEditar(regla)}
        style={({ pressed }) => [styles.editar, pressed && styles.normaPulsada]}
        accessibilityRole="button"
        accessibilityLabel={`Editar la norma ${indice + 1}`}
      >
        <Ionicons name="create-outline" size={18} color={ink.ink8} />
      </Pressable>
    </View>
  );
}

/** La carta: ninguna, sellada, lista para abrir, abierta o la firma del onboarding. */
function Carta({
  carta,
  hoy,
  onEscribir,
  onAbrir,
}: {
  carta: Letter | null;
  hoy: string;
  onEscribir: () => void;
  onAbrir: () => void;
}) {
  if (!carta) {
    return (
      <TarjetaArena variante="contorno" rotulo="Sin carta">
        <Text style={styles.cartaTexto} maxFontSizeMultiplier={1.35}>
          Escríbele a quien serás. El sistema la sella y la custodia hasta el día señalado.
        </Text>
        <Button title="Escribir la carta" variant="secondary" size="sm" icon="create-outline" onPress={onEscribir} style={styles.cartaBoton} />
      </TarjetaArena>
    );
  }
  if (carta.opened_at) {
    return (
      <TarjetaArena variante="piedra" rotulo="Abierta">
        <Text style={styles.cartaMeta} maxFontSizeMultiplier={1.35}>
          Sellada el {fecha(carta.sealed_at)}. Abierta el {fecha(carta.opened_at)}.
        </Text>
        <Text style={styles.cartaCuerpo}>{carta.body}</Text>
      </TarjetaArena>
    );
  }
  if (carta.open_at <= hoy) {
    return (
      <TarjetaArena variante="grano" rotulo="Ha llegado el día">
        <Text style={styles.cartaTexto} maxFontSizeMultiplier={1.35}>
          La carta que sellaste el {fecha(carta.sealed_at)} espera.
        </Text>
        <Button title="Abrir la carta" variant="secondary" size="sm" icon="mail-open-outline" onPress={onAbrir} style={styles.cartaBoton} />
      </TarjetaArena>
    );
  }
  if (esCompromiso(carta.body)) {
    return (
      <TarjetaArena variante="piedra" rotulo="Firmado por ti">
        <Text style={styles.cartaMeta} maxFontSizeMultiplier={1.35}>
          Firmado el {fecha(carta.sealed_at)}. Vence el {fecha(carta.open_at)}.
        </Text>
        <Text style={styles.cartaCuerpo}>{carta.body}</Text>
      </TarjetaArena>
    );
  }
  return (
    <TarjetaArena variante="contorno" rotulo="Sellada">
      <View style={styles.sellada}>
        <Ionicons name="lock-closed-outline" size={20} color={ink.ink6} />
        <Text style={[styles.cartaTexto, styles.flex]} maxFontSizeMultiplier={1.35}>
          Sellada el {fecha(carta.sealed_at)}. Se abrirá el {fecha(carta.open_at)}. Hasta entonces, a trabajar.
        </Text>
      </View>
    </TarjetaArena>
  );
}

export function ContratoVista({
  cargado,
  errorCarga,
  hoy,
  conPerfil,
  reglas,
  editadas,
  bonus,
  gastadoSemana,
  carta,
  sembrando,
  acciones,
}: ContratoVistaProps) {
  const hayReglas = reglas.length > 0;
  const subtitulo = !conPerfil
    ? undefined
    : !hayReglas
      ? 'Sin normas firmadas. El sistema solo hace cumplir lo que tú firmas.'
      : `${reglas.length} ${reglas.length === 1 ? 'norma firmada' : 'normas firmadas'} · ${bonus} PB en la bolsa`;

  const encabezado = (
    <EncabezadoArena
      onVolver={acciones.onVolver}
      eyebrow="Lo que tú firmas"
      titulo="Contrato"
      subtitulo={cargado ? subtitulo : undefined}
      accion={
        cargado && conPerfil && hayReglas
          ? { icono: 'add', etiqueta: 'Firmar una norma nueva', onPress: acciones.onNuevaNorma, solida: true }
          : undefined
      }
    />
  );

  if (!cargado) {
    return (
      <Screen>
        {encabezado}
        <CargaArena etiqueta="Leyendo el contrato" formas={['tarjeta', 'franja', 'filas']} />
      </Screen>
    );
  }

  if (errorCarga && !conPerfil) {
    return (
      <Screen>
        {encabezado}
        <ErrorSistema mensaje={errorCarga} onReintentar={acciones.onReintentar} />
      </Screen>
    );
  }

  const { ganancias, perdidas } = tablas();
  const canjeables = Math.max(0, REDEEM_WEEKLY_CAP - gastadoSemana);

  return (
    <Screen>
      <Entrada indice={0}>{encabezado}</Entrada>

      {errorCarga ? (
        <Entrada indice={1}>
          <ErrorSistema compacto mensaje={errorCarga} onReintentar={acciones.onReintentar} style={styles.bloque} />
        </Entrada>
      ) : null}

      <Entrada indice={1}>
        <View style={styles.bloque}>
          <TarjetaArena variante="piedra" remaches zocalo>
            <Meandro alto={8} />
            <Text style={styles.rotulo} accessibilityRole="header" maxFontSizeMultiplier={1.35}>
              CONTRATO
            </Text>
            {hayReglas ? (
              reglas.map((r, i) => (
                <FilaNorma
                  key={r.id}
                  regla={r}
                  indice={i}
                  editada={editadas.has(r.id)}
                  onRomper={acciones.onRomper}
                  onEliminar={acciones.onEliminar}
                  onEditar={acciones.onEditar}
                />
              ))
            ) : (
              <View style={styles.vacio}>
                <Text style={styles.vacioTitulo} maxFontSizeMultiplier={1.35}>
                  Ninguna norma firmada
                </Text>
                <Text style={styles.vacioTexto} maxFontSizeMultiplier={1.35}>
                  Aquí van las normas que tú te impones y su consecuencia. El sistema solo las hace cumplir.
                </Text>
                <Button title="Firmar la primera norma" icon="add" onPress={acciones.onNuevaNorma} disabled={!conPerfil} />
                <Button
                  title="Cargar mis normas del cuaderno"
                  variant="ghost"
                  size="sm"
                  onPress={acciones.onCargarPlantilla}
                  loading={sembrando}
                />
              </View>
            )}
            <Meandro alto={8} style={styles.meandroPie} />
          </TarjetaArena>
          {hayReglas ? (
            <Text style={styles.nota} maxFontSizeMultiplier={1.35}>
              Toca una norma para confesar que la has roto. Mantén pulsada para eliminarla. El lápiz la edita desde
              hoy. Cada noche se marcan las cumplidas en Hábitos.
            </Text>
          ) : null}
        </View>
      </Entrada>

      <Entrada indice={2}>
        <Section title="Puntos bonus" tone="logro" meta={`${gastadoSemana}/${REDEEM_WEEKLY_CAP} canjeados`}>
          <FranjaCifras
            cifras={[
              { valor: bonus, rotulo: 'En la bolsa', sufijo: ' PB' },
              { valor: canjeables, rotulo: 'Canjeables esta semana', sufijo: ' PB' },
            ]}
          />
          <Button
            title={`Canjear ${REDEEM_COST} PB · 1 h de descanso`}
            variant="secondary"
            size="sm"
            icon="cafe-outline"
            onPress={acciones.onCanjear}
            disabled={!conPerfil}
            style={styles.canjear}
          />
          <Text style={styles.nota} maxFontSizeMultiplier={1.35}>
            Las misiones extra pagan en PB, no en XP. {REDEEM_COST} PB son 1 h de descanso sin culpa, con tope de{' '}
            {REDEEM_WEEKLY_CAP} PB cada 7 días.
          </Text>
        </Section>
      </Entrada>

      <Entrada indice={3}>
        <Section title="Carta a tu yo del futuro">
          <Carta carta={carta} hoy={hoy} onEscribir={acciones.onEscribirCarta} onAbrir={acciones.onAbrirCarta} />
        </Section>
      </Entrada>

      <Entrada indice={4}>
        <Section title="Así se gana">
          <Tabla filas={ganancias} />
        </Section>
      </Entrada>

      <Entrada indice={5}>
        <Section title="Así se pierde" tone="alerta">
          <Tabla filas={perdidas} />
          <Text style={styles.nota} maxFontSizeMultiplier={1.35}>
            Toda la app puntúa con esta tabla: mismo esfuerzo, misma recompensa. Los PB no dan XP: se canjean por descanso.
          </Text>
        </Section>
      </Entrada>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bloque: { marginBottom: space.s6 },
  hairline: { borderTopWidth: stroke.hairline, borderTopColor: ink.ink3 },
  rotulo: {
    fontFamily: tipo.inscripcion.family,
    fontSize: tipo.inscripcion.size,
    lineHeight: tipo.inscripcion.lineHeight,
    letterSpacing: tipo.inscripcion.tracking,
    marginRight: -tipo.inscripcion.tracking,
    color: ink.ink9,
    textAlign: 'center',
    marginTop: space.s4,
    marginBottom: space.s3,
  },
  meandroPie: { marginTop: space.s4 },
  normaFila: { flexDirection: 'row', alignItems: 'stretch' },
  norma: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.s3,
    minHeight: 56,
    paddingVertical: space.s3,
  },
  normaPulsada: { backgroundColor: ink.ink2 },
  numeral: {
    width: 40,
    fontFamily: tipo.number.family,
    fontSize: 16,
    lineHeight: 22,
    color: ink.ink6,
  },
  normaCuerpo: { flex: 1, minWidth: 0, gap: 2 },
  normaTexto: { fontFamily: 'Outfit_600SemiBold', fontSize: 16, lineHeight: 22, color: ink.ink9 },
  normaConsecuencia: {
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink8,
  },
  normaEditada: {
    fontFamily: tipo.micro.family,
    fontSize: tipo.micro.size,
    lineHeight: tipo.micro.lineHeight,
    letterSpacing: tipo.micro.tracking,
    color: ink.ink6,
    marginTop: space.s1,
  },
  // Zona táctil de 44 × 44, alineada con la primera línea de la norma.
  editar: { width: 44, minHeight: 44, alignItems: 'flex-end', justifyContent: 'flex-start', paddingTop: space.s3 + 2 },
  normaCoste: { fontFamily: tipo.number.family, fontSize: 14, lineHeight: 22, color: ink.ink8 },
  vacio: { gap: space.s3, paddingVertical: space.s2 },
  vacioTitulo: {
    fontFamily: tipo.headline.family,
    fontSize: tipo.headline.size,
    lineHeight: tipo.headline.lineHeight,
    letterSpacing: tipo.headline.tracking,
    color: ink.ink9,
    textAlign: 'center',
  },
  vacioTexto: {
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink8,
    textAlign: 'center',
    marginBottom: space.s2,
  },
  nota: {
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink6,
    marginTop: space.s3,
  },
  canjear: { alignSelf: 'flex-start', marginTop: space.s4 },
  tablaFila: { flexDirection: 'row', alignItems: 'flex-start', gap: space.s4, paddingVertical: space.s3 },
  tablaConcepto: {
    flex: 1,
    minWidth: 0,
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink9,
  },
  tablaValor: {
    flexShrink: 1,
    maxWidth: '55%',
    fontFamily: 'Outfit_600SemiBold',
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink8,
    textAlign: 'right',
  },
  cartaTexto: {
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink8,
  },
  cartaMeta: {
    fontFamily: tipo.micro.family,
    fontSize: tipo.micro.size,
    lineHeight: tipo.micro.lineHeight,
    letterSpacing: tipo.micro.tracking,
    color: ink.ink6,
  },
  cartaCuerpo: {
    fontFamily: tipo.body.family,
    fontSize: 15,
    lineHeight: 23,
    color: ink.ink9,
    marginTop: space.s3,
  },
  cartaBoton: { alignSelf: 'flex-start', marginTop: space.s4 },
  sellada: { flexDirection: 'row', alignItems: 'flex-start', gap: space.s3 },
});
