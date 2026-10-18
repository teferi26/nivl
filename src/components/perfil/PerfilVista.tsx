// NIVL · Perfil: la vista (L-RADICAL B.3 y Perfil.dc).
//
// Pura: todo llega por props (usePerfil en la app, demo.tsx en la galería).
// De arriba abajo:
//   1. HeroRango perfil: el gladiador sobre la planta de la arena, el nombre
//      editable, el título grabado, NIVEL · RANGO · RACHA · PIEDRAS y la XP.
//   2. Camino de rangos: los alcanzados invertidos (la ÚNICA inversión).
//   3. Arena: compartir, amigos, Pro/Élite y creadores, en lista de hairlines.
//   4. Pausa, si la hay.
//   5. Logros: vitrina en rejilla (grano los ganados, contorno los cerrados).
//   6. Estadísticas con Barra y Registro con FranjaCifras.
//   7. Meandro a sangre y los Ajustes (PerfilAjustes, sin rediseñar).
// Contadores: nivel y racha en el Hero, misiones y evidencia en Registro (4).

import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { ASangre, Barra, Entrada, FranjaCifras, HeroRango, Meandro, TarjetaArena, type Cifra } from '@/components/arena';
import { EliteBadge } from '@/components/EliteBadge';
import { Button, Section, Skeleton, SkeletonRows, Tag } from '@/components/ui';
import { SIN_DATO } from '@/components/ui/sinDato';
import { ink, space, stroke, type as tipo } from '@/design/tokens';
import { useSizeClass } from '@/design/useSizeClass';
import { t } from '@/i18n';
import { mayus } from '@/i18n/formato';
import { isValidKey, nombreDia } from '@/lib/dates';
import { MAX_STONES, STAT_ABBR, STAT_COLUMN, STAT_LABEL, statPoints, STATS, streakMultiplier } from '@/lib/game';
import { kindMeta } from '@/lib/kinds';
import type { EstadoProgreso } from '@/lib/progression';
import type { Profile } from '@/lib/types';
import { voice } from '@/lib/voice';
import { CaminoDeRangos } from './CaminoDeRangos';

export interface LogroVitrina {
  code: string;
  name: string;
  title?: string;
  unlocked: boolean;
  equipado: boolean;
}

export interface PerfilDatos {
  profile: Profile;
  estado: EstadoProgreso;
  titulo: string;
  elite: boolean;
  frozen: boolean;
  /** null = aún no se sabe (o sin red). */
  tieneCoach: boolean | null;
  /** La fila «Código de creador»: sin atribución y en plazo. */
  codigoCreador: boolean;
  esCreador: boolean;
  logros: LogroVitrina[];
  stats: { total: number; withEvidence: number };
  /** La frase de racha del sistema: va como `linea` del Hero. */
  rachaFrase: string;
  /** La racha que enseña Hoy (rachaVisible): cuenta hoy si ya está cerrado. */
  racha: number;
  /** Hoy ya está cerrado y cuenta en la racha. */
  rachaCerrada: boolean;
}

export interface PerfilAcciones {
  onNombre: (t: string) => void;
  onGuardarNombre: () => void;
  onAvatar: () => void;
  onCompartir: () => void;
  onCodigo: () => void;
  onLogro: (code: string) => void;
  onReintentar: () => void;
}

export interface PerfilVistaProps {
  /** null = cargando (o error, si lo hay). */
  datos: PerfilDatos | null;
  /** La carga ha fallado. Sin datos, la vista lo dice con un reintento. */
  error?: string | null;
  /** Lo último que enseñó el Hero: nivel, barra y racha suben desde ahí. */
  desde?: { nivel: number; xpRatio: number; racha: number } | null;
  /** El valor del campo del nombre. */
  nombre: string;
  subiendoFoto: boolean;
  acciones: PerfilAcciones;
  /** PerfilAjustes (null en la galería). */
  ajustes: ReactNode;
  /**
   * Modos F1: los niveles por modo (NivelesModo), bajo el camino de rangos.
   * Solo con `modos_activos` encendido; si no, nada.
   */
  nivelesModo?: ReactNode;
}

function multiplicador(dias: number): string {
  return `×${streakMultiplier(dias).toFixed(1).replace('.', ',')}`;
}

export function PerfilVista({ datos, error, desde, nombre, subiendoFoto, acciones, ajustes, nivelesModo }: PerfilVistaProps) {
  if (!datos && error) {
    return (
      <TarjetaArena variante="contorno" rotulo={t('comun:sistemaNoResponde')} style={styles.bloque}>
        <Text style={styles.cuerpo} maxFontSizeMultiplier={1.35} accessibilityRole="alert">
          {error}
        </Text>
        <Button title={t('comun:reintentar')} icon="refresh" variant="secondary" onPress={acciones.onReintentar} style={styles.reintentar} />
      </TarjetaArena>
    );
  }
  if (!datos) return <PerfilCargando />;

  const { profile, estado, titulo, elite, frozen, tieneCoach, stats, logros } = datos;
  const kind = kindMeta(profile.profile_kind);

  const campoNombre = (
    <TextInput
      style={[styles.nombre, elite && styles.nombreConInsignia]}
      value={nombre}
      onChangeText={acciones.onNombre}
      onBlur={acciones.onGuardarNombre}
      onSubmitEditing={acciones.onGuardarNombre}
      returnKeyType="done"
      maxLength={24}
      maxFontSizeMultiplier={1.35}
      accessibilityLabel={t('perfil:vista.nombreA11y')}
    />
  );

  return (
    <View>
      <Entrada indice={0}>
        <HeroRango
          variante="perfil"
          nivel={estado.nivel}
          rango={estado.rango}
          titulo={titulo}
          xpEnNivel={estado.xpEnNivel}
          xpSiguiente={estado.xpSiguiente}
          racha={datos.racha}
          rachaCerrada={datos.rachaCerrada}
          desde={desde}
          piedras={profile.protection_stones}
          piedrasMax={MAX_STONES}
          eyebrow={kind.title}
          linea={datos.rachaFrase}
          avatar={{ path: profile.avatar_url, nombre: profile.name }}
          onAvatar={acciones.onAvatar}
          avatarOcupado={subiendoFoto}
          nombre={campoNombre}
          insignia={elite ? <EliteBadge size={22} style={styles.insignia} /> : null}
        />
        <Text style={styles.aviso} maxFontSizeMultiplier={1.35}>
          {t('perfil:vista.avisoRevision')}
        </Text>
      </Entrada>

      <Entrada indice={1}>
        <Section title={t('perfil:vista.camino')} meta={estado.rango}>
          <CaminoDeRangos rango={estado.rango} siguiente={estado.siguienteRango} />
        </Section>
        {nivelesModo ?? null}
      </Entrada>

      <Entrada indice={2}>
        <Section title={t('perfil:vista.arena')}>
          <View style={styles.lista}>
            <FilaArena icono="share-social-outline" titulo={t('perfil:vista.compartir')} onPress={acciones.onCompartir} />
            <FilaArena icono="people-outline" titulo={t('perfil:vista.amigos')} meta={t('perfil:vista.ranking')} onPress={() => router.push('/amigos')} />
            <FilaArena
              icono="shield-half-outline"
              titulo={elite ? 'NIVL Élite' : 'NIVL Pro'} // i18n-ok: nombres de los planes (la marca)
              meta={tieneCoach === null ? undefined : tieneCoach ? t('perfil:vista.activo') : t('perfil:vista.activaCoach')}
              onPress={() => router.push('/pro')}
            />
            {datos.codigoCreador ? (
              <FilaArena
                icono="ticket-outline"
                titulo={t('perfil:vista.codigo')}
                detalle={t('perfil:vista.codigoDetalle')}
                onPress={acciones.onCodigo}
              />
            ) : null}
            {datos.esCreador ? (
              <FilaArena
                icono="megaphone-outline"
                titulo={t('perfil:vista.panelCreador')}
                detalle={t('perfil:vista.panelCreadorDetalle')}
                onPress={() => router.push('/creador')}
              />
            ) : null}
          </View>
        </Section>
      </Entrada>

      {frozen ? (
        <Entrada indice={3}>
          <TarjetaArena variante="contorno" rotulo={t('perfil:vista.enPausa')} style={styles.bloque}>
            <Text style={styles.cuerpo} maxFontSizeMultiplier={1.35}>
              {profile.freeze_until && isValidKey(profile.freeze_until)
                ? t('perfil:vista.pausaHasta', {
                    frase: voice.frozen(profile.freeze_reason ?? t('perfil:ajustes.pausaMotivo')),
                    dia: nombreDia(profile.freeze_until).toLowerCase(),
                  })
                : voice.frozen(profile.freeze_reason ?? t('perfil:ajustes.pausaMotivo'))}
            </Text>
          </TarjetaArena>
        </Entrada>
      ) : null}

      <Entrada indice={4}>
        <Vitrina logros={logros} onLogro={acciones.onLogro} />
      </Entrada>

      <Entrada indice={5}>
        <Estadisticas profile={profile} />
      </Entrada>

      <Entrada indice={6}>
        <Section title={t('perfil:vista.registro')}>
          <FranjaCifras cifras={cifrasRegistro(stats, profile.streak_days)} />
        </Section>
      </Entrada>

      <ASangre style={styles.meandro}>
        <Meandro alto={12} />
      </ASangre>

      {/* En la galería no hay ajustes (null): sin ellos, tampoco su rótulo. */}
      {ajustes ? <Section title={t('perfil:vista.ajustes')}>{ajustes}</Section> : null}
    </View>
  );
}

/** Misiones · % con evidencia · Multiplicador. Sin misiones, la evidencia es «-». */
function cifrasRegistro(stats: { total: number; withEvidence: number }, racha: number): Cifra[] {
  const pct = stats.total > 0 ? Math.round((stats.withEvidence / stats.total) * 100) : null;
  return [
    { valor: stats.total, rotulo: t('perfil:vista.misiones') },
    pct == null
      ? { valor: SIN_DATO, rotulo: t('perfil:vista.evidencia'), etiqueta: t('perfil:vista.evidenciaSinDatoA11y') }
      : { valor: pct, rotulo: t('perfil:vista.evidencia'), sufijo: '%', etiqueta: t('perfil:vista.evidenciaA11y', { pct }) },
    {
      valor: multiplicador(racha),
      rotulo: t('perfil:vista.multiplicador'),
      etiqueta: t('perfil:vista.multiplicadorA11y', { valor: multiplicador(racha) }),
    },
  ];
}

// ── Arena: filas de lista con hairline ────────────────────────────────

function FilaArena({
  icono,
  titulo,
  meta,
  detalle,
  onPress,
}: {
  icono: keyof typeof Ionicons.glyphMap;
  titulo: string;
  meta?: string;
  detalle?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={[titulo, meta, detalle].filter(Boolean).join('. ')}
      style={({ pressed }) => [styles.fila, pressed && styles.pulsada]}
    >
      <Ionicons name={icono} size={20} color={ink.ink8} />
      <View style={styles.filaCuerpo}>
        <Text style={styles.filaTitulo} maxFontSizeMultiplier={1.35} numberOfLines={1}>
          {titulo}
        </Text>
        {detalle ? (
          <Text style={styles.filaDetalle} maxFontSizeMultiplier={1.35} numberOfLines={2}>
            {detalle}
          </Text>
        ) : null}
      </View>
      {meta ? (
        <Text style={styles.filaMeta} maxFontSizeMultiplier={1.35} numberOfLines={1}>
          {meta}
        </Text>
      ) : null}
      <Ionicons name="chevron-forward" size={16} color={ink.ink6} />
    </Pressable>
  );
}

// ── Logros: la vitrina ───────────────────────────────────────────────

function Vitrina({ logros, onLogro }: { logros: LogroVitrina[]; onLogro: (code: string) => void }) {
  const { sizeClass } = useSizeClass();
  const columnas = sizeClass === 'compact' ? 3 : 4;
  const ganados = logros.filter((a) => a.unlocked).length;
  const filas: (LogroVitrina | null)[][] = [];
  for (let i = 0; i < logros.length; i += columnas) {
    const fila: (LogroVitrina | null)[] = logros.slice(i, i + columnas);
    while (fila.length < columnas) fila.push(null);
    filas.push(fila);
  }

  return (
    <Section title={t('perfil:vista.logros')} meta={`${ganados}/${logros.length}`} tone={ganados > 0 ? 'logro' : 'default'}>
      <View style={styles.vitrina}>
        {filas.map((fila, i) => (
          <View key={i} style={styles.vitrinaFila}>
            {fila.map((a, j) =>
              a ? (
                <TarjetaArena
                  key={a.code}
                  variante={a.unlocked ? 'grano' : 'contorno'}
                  padded={false}
                  onPress={() => onLogro(a.code)}
                  accessibilityLabel={logroA11y(a)}
                  style={styles.celda}
                >
                  <View style={styles.logro}>
                    <Ionicons
                      name={a.unlocked ? 'ribbon' : 'lock-closed-outline'}
                      size={22}
                      color={a.unlocked ? ink.ink10 : ink.ink6}
                    />
                    <Text
                      style={[styles.logroNombre, a.unlocked && styles.logroNombreGanado]}
                      maxFontSizeMultiplier={1.35}
                      numberOfLines={2}
                    >
                      {a.name}
                    </Text>
                    {a.title && a.unlocked ? (
                      a.equipado ? (
                        <Tag tone="logro">{mayus(t('perfil:vista.equipado'))}</Tag>
                      ) : (
                        <Tag>{mayus(t('perfil:vista.titulo'))}</Tag>
                      )
                    ) : null}
                  </View>
                </TarjetaArena>
              ) : (
                <View key={`hueco-${j}`} style={styles.celda} />
              ),
            )}
          </View>
        ))}
      </View>
    </Section>
  );
}

/** «Madrugador, desbloqueado. Título: El Alba, equipado». */
function logroA11y(a: LogroVitrina): string {
  const logro = t(a.unlocked ? 'perfil:vista.logroDesbloqueado' : 'perfil:vista.logroBloqueado', { nombre: a.name });
  if (!a.title || !a.unlocked) return logro;
  return t(a.equipado ? 'perfil:vista.logroTituloEquipado' : 'perfil:vista.logroTitulo', { logro, titulo: a.title });
}

// ── Estadísticas ─────────────────────────────────────────────────────

function Estadisticas({ profile }: { profile: Profile }) {
  const maxStatXp = Math.max(100, ...STATS.map((s) => profile[STAT_COLUMN[s]]));
  return (
    <Section title={t('perfil:vista.estadisticas')}>
      {STATS.map((s, i) => {
        const xp = profile[STAT_COLUMN[s]];
        const puntos = statPoints(xp);
        return (
          <View
            key={s}
            style={[styles.stat, i > 0 && styles.statSep]}
            accessible
            accessibilityLabel={t('perfil:vista.statA11y', { stat: STAT_LABEL[s], puntos })}
          >
            <View style={styles.statNombre}>
              <Text style={styles.statAbbr} maxFontSizeMultiplier={1.35}>
                {STAT_ABBR[s]}
              </Text>
              <Text style={styles.statLabel} maxFontSizeMultiplier={1.35} numberOfLines={1}>
                {STAT_LABEL[s]}
              </Text>
            </View>
            <View style={styles.statBarra}>
              <Barra ratio={xp / maxStatXp} alto={4} etiqueta={STAT_LABEL[s]} />
            </View>
            <Text style={styles.statPuntos} maxFontSizeMultiplier={1}>
              {puntos}
            </Text>
          </View>
        );
      })}
      <Text style={styles.nota} maxFontSizeMultiplier={1.35}>
        {t('perfil:vista.statNota')}
      </Text>
    </Section>
  );
}

// ── Cargando: el Hero en huecos y la lista en filas ──────────────────

function PerfilCargando() {
  return (
    <View accessible accessibilityRole="progressbar" accessibilityLabel={t('perfil:vista.cargandoA11y')}>
      <HeroRango
        variante="perfil"
        cargando
        nivel={0}
        rango={null}
        titulo=""
        xpEnNivel={0}
        xpSiguiente={0}
        racha={0}
        rachaCerrada={false}
        piedras={0}
        avatar={{ path: null, nombre: '' }}
        nombre={<Skeleton height={24} width={160} />}
      />
      <Section title={t('perfil:vista.camino')}>
        <Skeleton height={44} />
      </Section>
      <Section title={t('perfil:vista.arena')}>
        <SkeletonRows rows={3} />
      </Section>
    </View>
  );
}

const styles = StyleSheet.create({
  nombre: {
    flexShrink: 1,
    minWidth: 120,
    maxWidth: '100%',
    padding: 0,
    fontFamily: tipo.headline.family,
    fontSize: 22,
    lineHeight: 28,
    color: ink.ink10,
    textAlign: 'center',
  },
  nombreConInsignia: { minWidth: 80 },
  insignia: { flexShrink: 0 },
  aviso: {
    marginTop: -space.s3,
    marginBottom: space.s8,
    fontFamily: tipo.micro.family,
    fontSize: tipo.micro.size,
    lineHeight: tipo.micro.lineHeight,
    color: ink.ink6,
    textAlign: 'center',
  },
  bloque: { marginBottom: 26 },
  reintentar: { marginTop: space.s4, alignSelf: 'flex-start' },
  cuerpo: {
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink8,
  },

  // Arena
  lista: { borderBottomWidth: stroke.hairline, borderBottomColor: ink.ink3 },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s3,
    minHeight: 52,
    paddingVertical: space.s3,
    borderTopWidth: stroke.hairline,
    borderTopColor: ink.ink3,
  },
  pulsada: { opacity: 0.6 },
  filaCuerpo: { flex: 1, minWidth: 0 },
  filaTitulo: { fontFamily: tipo.micro.family, fontSize: 16, lineHeight: 22, color: ink.ink9 },
  filaDetalle: {
    marginTop: 2,
    fontFamily: tipo.bodySm.family,
    fontSize: 13,
    lineHeight: 18,
    color: ink.ink6,
  },
  filaMeta: {
    maxWidth: '40%',
    fontFamily: tipo.micro.family,
    fontSize: tipo.micro.size,
    lineHeight: tipo.micro.lineHeight,
    letterSpacing: tipo.micro.tracking,
    textTransform: 'uppercase',
    color: ink.ink6,
  },

  // Logros
  vitrina: { gap: space.s2 },
  vitrinaFila: { flexDirection: 'row', gap: space.s2 },
  celda: { flex: 1, minWidth: 0 },
  // Alto mínimo común: las tarjetas de una fila no bailan con nombres de una o dos líneas.
  logro: { minHeight: 116, alignItems: 'center', gap: space.s2, paddingVertical: space.s4, paddingHorizontal: space.s2 },
  logroNombre: {
    fontFamily: tipo.micro.family,
    fontSize: tipo.micro.size,
    lineHeight: tipo.micro.lineHeight,
    color: ink.ink6,
    textAlign: 'center',
  },
  logroNombreGanado: { color: ink.ink9 },

  // Estadísticas
  stat: { flexDirection: 'row', alignItems: 'center', gap: space.s3, paddingVertical: space.s3 },
  statSep: { borderTopWidth: stroke.hairline, borderTopColor: ink.ink3 },
  statNombre: { width: 96 },
  statAbbr: { fontFamily: tipo.number.family, fontSize: 14, lineHeight: 18, letterSpacing: 1, color: ink.ink10 },
  statLabel: {
    marginTop: 2,
    fontFamily: tipo.micro.family,
    fontSize: tipo.micro.size,
    lineHeight: tipo.micro.lineHeight,
    color: ink.ink6,
  },
  statBarra: { flex: 1 },
  statPuntos: {
    width: 40,
    textAlign: 'right',
    fontFamily: tipo.number.family,
    fontSize: 16,
    lineHeight: 20,
    color: ink.ink9,
  },
  nota: {
    marginTop: space.s2,
    fontFamily: tipo.bodySm.family,
    fontSize: 12,
    lineHeight: 17,
    color: ink.ink6,
  },

  meandro: { marginTop: space.s2, marginBottom: space.s8 },
});
