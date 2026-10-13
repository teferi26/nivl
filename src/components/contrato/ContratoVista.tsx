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
import { t } from '@/i18n';
import { decimal } from '@/i18n/formato';
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
    { label: t('contrato:vista.tabla.mision'), value: t('contrato:vista.tabla.xp', { xp: DIFFICULTIES.map((d) => XP_BY_DIFFICULTY[d]).join(' · ') }) },
    { label: t('contrato:vista.tabla.evidencia'), value: t('contrato:vista.tabla.evidenciaValor', { pct: Math.round(EVIDENCE_BONUS * 100) }) },
    {
      label: t('contrato:vista.tabla.racha'),
      value: t('contrato:vista.tabla.rachaValor', {
        pct: Math.round((streakMultiplier(7) - 1) * 100),
        techo: decimal(streakMultiplier(9999), 1),
      }),
    },
    { label: t('contrato:vista.tabla.gimnasio'), value: t('contrato:vista.tabla.xp', { xp: GYM_SESSION_XP }) },
    { label: t('contrato:vista.tabla.record'), value: t('contrato:vista.tabla.xp', { xp: PR_XP }) },
    { label: t('contrato:vista.tabla.diario'), value: t('contrato:vista.tabla.xp', { xp: JOURNAL_XP }) },
    { label: t('contrato:vista.tabla.pesarte'), value: t('contrato:vista.tabla.xp', { xp: WEIGH_IN_XP }) },
    { label: t('contrato:vista.tabla.objetivo'), value: t('contrato:vista.tabla.xp', { xp: GOAL_ACHIEVED_XP }) },
    { label: t('contrato:vista.tabla.tarea'), value: t('contrato:vista.tabla.tareaValor', { mult: BOSS_MULTIPLIER }) },
    {
      label: t('contrato:vista.tabla.campana'),
      value: t('contrato:vista.tabla.campanaValor', { min: DUNGEON_CLEAR_XP.E, max: DUNGEON_CLEAR_XP.S }),
    },
    { label: t('contrato:vista.tabla.extra'), value: t('contrato:vista.tabla.pb', { pb: DIFFICULTIES.map((d) => BONUS_BY_DIFFICULTY[d]).join(' · ') }) },
  ];
  const perdidas = [
    {
      label: t('contrato:vista.tabla.sinHacer'),
      value: t('contrato:vista.tabla.sinHacerValor', { pct: Math.round(PENALTY_FACTOR * 100), tope: DAILY_PENALTY_CAP }),
    },
    { label: t('contrato:vista.tabla.romper'), value: t('contrato:vista.tabla.romperValor', { xp: RULE_BREAK_XP }) },
    { label: t('contrato:vista.tabla.piedra'), value: t('contrato:vista.tabla.piedraValor') },
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
          accessibilityLabel={t('contrato:vista.tabla.filaA11y', { concepto: f.label, valor: f.value })}
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
        accessibilityLabel={t(editada ? 'contrato:vista.norma.a11yEditada' : 'contrato:vista.norma.a11y', {
          n: indice + 1,
          texto: regla.text,
          consecuencia: regla.consequence,
          xp: RULE_BREAK_XP,
        })}
        accessibilityHint={t('contrato:vista.norma.pista')}
        accessibilityActions={[
          { name: 'activate', label: t('contrato:vista.norma.accionConfesar') },
          { name: 'editar', label: t('contrato:vista.norma.accionEditar') },
          { name: 'longpress', label: t('contrato:vista.norma.accionEliminar') },
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
            {t('contrato:vista.norma.siLaRompes', { consecuencia: regla.consequence })}
          </Text>
          {editada ? (
            <Text style={styles.normaEditada} maxFontSizeMultiplier={1.35}>
              {t('contrato:vista.norma.editadaHoy')}
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
        accessibilityLabel={t('contrato:vista.norma.editarA11y', { n: indice + 1 })}
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
      <TarjetaArena variante="contorno" rotulo={t('contrato:vista.carta.sinCarta')}>
        <Text style={styles.cartaTexto} maxFontSizeMultiplier={1.35}>
          {t('contrato:vista.carta.sinCartaTexto')}
        </Text>
        <Button title={t('contrato:vista.carta.escribir')} variant="secondary" size="sm" icon="create-outline" onPress={onEscribir} style={styles.cartaBoton} />
      </TarjetaArena>
    );
  }
  if (carta.opened_at) {
    return (
      <TarjetaArena variante="piedra" rotulo={t('contrato:vista.carta.abierta')}>
        <Text style={styles.cartaMeta} maxFontSizeMultiplier={1.35}>
          {t('contrato:vista.carta.abiertaMeta', { sellada: fecha(carta.sealed_at), abierta: fecha(carta.opened_at) })}
        </Text>
        <Text style={styles.cartaCuerpo}>{carta.body}</Text>
      </TarjetaArena>
    );
  }
  if (carta.open_at <= hoy) {
    return (
      <TarjetaArena variante="grano" rotulo={t('contrato:vista.carta.haLlegado')}>
        <Text style={styles.cartaTexto} maxFontSizeMultiplier={1.35}>
          {t('contrato:vista.carta.espera', { sellada: fecha(carta.sealed_at) })}
        </Text>
        <Button title={t('contrato:vista.carta.abrir')} variant="secondary" size="sm" icon="mail-open-outline" onPress={onAbrir} style={styles.cartaBoton} />
      </TarjetaArena>
    );
  }
  if (esCompromiso(carta.body)) {
    return (
      <TarjetaArena variante="piedra" rotulo={t('contrato:vista.carta.firmado')}>
        <Text style={styles.cartaMeta} maxFontSizeMultiplier={1.35}>
          {t('contrato:vista.carta.firmadoMeta', { firmado: fecha(carta.sealed_at), vence: fecha(carta.open_at) })}
        </Text>
        <Text style={styles.cartaCuerpo}>{carta.body}</Text>
      </TarjetaArena>
    );
  }
  return (
    <TarjetaArena variante="contorno" rotulo={t('contrato:vista.carta.sellada')}>
      <View style={styles.sellada}>
        <Ionicons name="lock-closed-outline" size={20} color={ink.ink6} />
        <Text style={[styles.cartaTexto, styles.flex]} maxFontSizeMultiplier={1.35}>
          {t('contrato:vista.carta.selladaTexto', { sellada: fecha(carta.sealed_at), apertura: fecha(carta.open_at) })}
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
      ? t('contrato:vista.subtituloVacio')
      : t('contrato:vista.subtitulo', { count: reglas.length, bonus });

  const encabezado = (
    <EncabezadoArena
      onVolver={acciones.onVolver}
      eyebrow={t('contrato:vista.eyebrow')}
      titulo={t('contrato:vista.titulo')}
      subtitulo={cargado ? subtitulo : undefined}
      accion={
        cargado && conPerfil && hayReglas
          ? { icono: 'add', etiqueta: t('contrato:vista.nuevaNorma'), onPress: acciones.onNuevaNorma, solida: true }
          : undefined
      }
    />
  );

  if (!cargado) {
    return (
      <Screen>
        {encabezado}
        <CargaArena etiqueta={t('contrato:vista.cargando')} formas={['tarjeta', 'franja', 'filas']} />
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
              {t('contrato:vista.rotulo')}
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
                  {t('contrato:vista.vacioTitulo')}
                </Text>
                <Text style={styles.vacioTexto} maxFontSizeMultiplier={1.35}>
                  {t('contrato:vista.vacioTexto')}
                </Text>
                <Button title={t('contrato:vista.primeraNorma')} icon="add" onPress={acciones.onNuevaNorma} disabled={!conPerfil} />
                <Button
                  title={t('contrato:vista.cargarCuaderno')}
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
              {t('contrato:vista.notaNormas')}
            </Text>
          ) : null}
        </View>
      </Entrada>

      <Entrada indice={2}>
        <Section
          title={t('contrato:vista.bonusTitulo')}
          tone="logro"
          meta={t('contrato:vista.bonusMeta', { gastado: gastadoSemana, tope: REDEEM_WEEKLY_CAP })}
        >
          <FranjaCifras
            cifras={[
              { valor: bonus, rotulo: t('contrato:vista.enBolsa'), sufijo: ' PB' }, // i18n-ok: unidad
              { valor: canjeables, rotulo: t('contrato:vista.canjeables'), sufijo: ' PB' }, // i18n-ok: unidad
            ]}
          />
          <Button
            title={t('contrato:vista.canjear', { coste: REDEEM_COST })}
            variant="secondary"
            size="sm"
            icon="cafe-outline"
            onPress={acciones.onCanjear}
            disabled={!conPerfil}
            style={styles.canjear}
          />
          <Text style={styles.nota} maxFontSizeMultiplier={1.35}>
            {t('contrato:vista.notaBonus', { coste: REDEEM_COST, tope: REDEEM_WEEKLY_CAP })}
          </Text>
        </Section>
      </Entrada>

      <Entrada indice={3}>
        <Section title={t('contrato:vista.cartaTitulo')}>
          <Carta carta={carta} hoy={hoy} onEscribir={acciones.onEscribirCarta} onAbrir={acciones.onAbrirCarta} />
        </Section>
      </Entrada>

      <Entrada indice={4}>
        <Section title={t('contrato:vista.gana')}>
          <Tabla filas={ganancias} />
        </Section>
      </Entrada>

      <Entrada indice={5}>
        <Section title={t('contrato:vista.pierde')} tone="alerta">
          <Tabla filas={perdidas} />
          <Text style={styles.nota} maxFontSizeMultiplier={1.35}>
            {t('contrato:vista.notaTabla')}
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
