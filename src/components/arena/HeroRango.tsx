// NIVL · Arena: el Hero del rango (Ónix).
//
// Lo primero que se ve al abrir la app. Dos variantes, las dos con la tarjeta
// de velo de oro:
//
//   · hoy    → arriba la fecha, la agenda y el avatar. Debajo el escudo con el
//              nivel, el rango, el título, la barra de oro, una línea del
//              sistema y la franja de cifras.
//   · perfil → centrada: el avatar grande, el nombre, el título, la franja y
//              la barra.
//
// El lector oye un resumen de una pieza; avatar y agenda van aparte, como
// botones.

import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Avatar } from '@/components/ui/Avatar';
import { Skeleton } from '@/components/ui/Skeleton';
import { ink, oro, radio, space, stroke, type as tipo, vidrio, type Rank } from '@/design/tokens';
import { idiomaInterfaz, t } from '@/i18n';
import { Barra } from './Barra';
import { CIFRA_VACIA, formatoMiles, ratioSeguro, rotuloSiguiente } from './cifras';
import { Contador } from './Contador';
import { BotonArena, TAM_BOTON } from './EncabezadoArena';
import { EscudoNivel, estiloNivelEscudo } from './EscudoNivel';
import { FranjaCifras, textoCifra, type Cifra } from './FranjaCifras';

export interface HeroRangoProps {
  variante: 'hoy' | 'perfil';
  cargando?: boolean;
  nivel: number;
  rango: Rank | null;
  titulo: string;
  xpEnNivel: number;
  /** XP que pide el nivel actual. 0 = nivel máximo. */
  xpSiguiente: number;
  racha: number;
  rachaCerrada: boolean;
  piedras: number;
  piedrasMax?: number;
  /** hoy: la fecha. perfil: el tipo de uso tras el título («Emprendedor»). */
  eyebrow?: string;
  /** Una línea del sistema (saludo y estado del día, frase de racha). */
  linea?: string;
  avatar: { path: string | null; nombre: string };
  /** hoy: la tercera cifra de la franja («3/5 Misiones»). */
  cifraExtra?: Cifra;
  /** Último valor visto: el nivel, la barra y la racha suben desde ahí. */
  desde?: { nivel: number; xpRatio: number; racha: number } | null;
  /** hoy: botón a la derecha (la agenda). */
  accion?: { icono: keyof typeof Ionicons.glyphMap; etiqueta: string; onPress: () => void };
  onAvatar?: () => void;
  /** perfil: subiendo la foto. */
  avatarOcupado?: boolean;
  /** perfil: el nombre (el TextInput de la pantalla). */
  nombre?: ReactNode;
  /** perfil: insignia junto al nombre (EliteBadge). */
  insignia?: ReactNode;
}

const LADO_ESCUDO = 62;

/** «1 día», «12 días», «1.840 días». */
const dias = (n: number) => t('arena:heroRango.dias', { count: n });

/** «3 de 5» o «3»: las piedras como las oye el lector. */
function piedrasLeidas(p: HeroRangoProps): string {
  return p.piedrasMax != null ? t('arena:heroRango.piedrasDe', { piedras: p.piedras, max: p.piedrasMax }) : String(p.piedras);
}

/** Lo que oye el lector del bloque central. */
export function resumenHero(p: HeroRangoProps): string {
  const partes: string[] = [];
  partes.push(
    p.rango
      ? t('arena:heroRango.a11yNivelRango', { nivel: p.nivel, rango: p.rango, titulo: p.titulo })
      : t('arena:heroRango.a11yNivel', { nivel: p.nivel, titulo: p.titulo }),
  );
  partes.push(
    p.xpSiguiente > 0
      ? t('arena:heroRango.a11yXp', { actual: formatoMiles(p.xpEnNivel), total: formatoMiles(p.xpSiguiente) })
      : t('arena:heroRango.a11yNivelMaximo'),
  );
  partes.push(t(p.rachaCerrada ? 'arena:heroRango.a11yRachaHoy' : 'arena:heroRango.a11yRacha', { dias: dias(p.racha) }));
  if (p.cifraExtra) partes.push(`${p.cifraExtra.rotulo}: ${textoCifra(p.cifraExtra)}.`);
  partes.push(t('arena:heroRango.a11yPiedras', { piedras: piedrasLeidas(p) }));
  return partes.join(' ');
}

export function HeroRango(props: HeroRangoProps) {
  return props.variante === 'perfil' ? <HeroPerfil {...props} /> : <HeroHoy {...props} />;
}

/** La tarjeta del Hero: vidrio con el velo de oro. */
function Velo({ children, etiqueta, cargando }: { children: ReactNode; etiqueta?: string; cargando?: boolean }) {
  return (
    <View style={styles.velo} accessible={etiqueta != null} accessibilityLabel={etiqueta} accessibilityRole={cargando ? 'progressbar' : undefined}>
      <LinearGradient colors={[oro.fondo, vidrio.suave]} start={{ x: 0.29, y: 0 }} end={{ x: 0.71, y: 1 }} style={StyleSheet.absoluteFill} pointerEvents="none" />
      {children}
    </View>
  );
}

// ── Hoy ───────────────────────────────────────────────────────────────

function HeroHoy(p: HeroRangoProps) {
  const tope = p.xpSiguiente <= 0;
  const ratio = tope ? 1 : ratioSeguro(p.xpEnNivel, p.xpSiguiente);
  const d = p.desde ?? null;

  const cifras: Cifra[] = [
    {
      valor: p.cargando ? '' : p.racha,
      rotulo: p.rachaCerrada ? t('arena:heroRango.rachaHoy') : t('arena:heroRango.racha'),
      sufijo: p.cargando ? undefined : t('arena:heroRango.unidadDia'),
      desde: d?.racha ?? null,
      etiqueta: p.cargando ? t('arena:heroRango.rachaCargando') : t('arena:heroRango.rachaA11y', { dias: dias(p.racha) }),
    },
    ...(p.cifraExtra ? [p.cargando ? { ...p.cifraExtra, valor: '', desde: null } : p.cifraExtra] : []),
    {
      valor: p.cargando ? '' : p.piedrasMax != null ? `${p.piedras}/${p.piedrasMax}` : p.piedras,
      rotulo: t('arena:heroRango.piedras'),
    },
  ];

  return (
    <View style={styles.hoy}>
      {/* Fecha, agenda y avatar (fuera del resumen: son botones). */}
      <View style={styles.cabeza}>
        {/* Fuera del español la fecha puede ser más larga: salta a dos líneas
            en vez de cortarse. */}
        <Text style={styles.eyebrow} maxFontSizeMultiplier={1.35} numberOfLines={idiomaInterfaz() === 'es' ? 1 : 2}>
          {p.eyebrow ?? ''}
        </Text>
        {p.accion ? <BotonArena icono={p.accion.icono} etiqueta={p.accion.etiqueta} onPress={p.accion.onPress} /> : null}
        <Pressable
          onPress={p.onAvatar}
          disabled={!p.onAvatar}
          accessibilityRole="button"
          accessibilityLabel={t('arena:heroRango.tuPerfilA11y', { nombre: p.avatar.nombre })}
          style={({ pressed }) => [styles.avatarBoton, pressed && styles.pulsado]}
        >
          <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
            <Avatar size={TAM_BOTON} avatarPath={p.avatar.path} name={p.avatar.nombre} rank={p.rango} titulo={p.titulo} />
          </View>
        </Pressable>
      </View>

      {/* El nivel y sus cifras: un solo elemento para el lector. */}
      <Velo etiqueta={p.cargando ? t('arena:heroRango.cargandoA11y') : resumenHero(p)} cargando={p.cargando}>
        <View style={styles.nivelFila}>
          {p.cargando ? (
            <Skeleton height={LADO_ESCUDO} width={LADO_ESCUDO} />
          ) : (
            <EscudoNivel lado={LADO_ESCUDO}>
              <Contador
                valor={p.nivel}
                desde={d?.nivel ?? null}
                formato={String}
                style={estiloNivelEscudo(LADO_ESCUDO, p.nivel)}
                maxFontSizeMultiplier={1}
                adjustsFontSizeToFit
                numberOfLines={1}
              />
            </EscudoNivel>
          )}
          <View style={styles.flex}>
            {p.cargando ? (
              <>
                <Skeleton height={12} width="50%" />
                <Skeleton height={20} width="80%" style={styles.huecoTitulo} />
              </>
            ) : (
              <>
                <Text style={styles.rotulo} maxFontSizeMultiplier={1.5} numberOfLines={1}>
                  {t('arena:heroRango.rotuloNivel')}
                  {p.rango ? <Text style={styles.rotuloOro}>{`  ·  ${t('arena:heroRango.inscripcionRango', { rango: p.rango })}`}</Text> : null}
                </Text>
                <Text style={styles.titulo} maxFontSizeMultiplier={1.4} numberOfLines={2}>
                  {p.titulo}
                </Text>
              </>
            )}
            <View style={styles.barraHoy}>
              {p.cargando ? (
                <Skeleton height={4} />
              ) : (
                <Barra ratio={ratio} desde={d?.xpRatio ?? null} alto={4} tono="oro" etiqueta={t('arena:heroRango.experienciaA11y', { nivel: p.nivel })} enGrupo />
              )}
            </View>
            <View style={styles.xpFila}>
              <Text style={styles.micro} maxFontSizeMultiplier={1.35}>
                {p.cargando ? `${CIFRA_VACIA} XP` : tope ? `${formatoMiles(p.xpEnNivel)} XP` : `${formatoMiles(p.xpEnNivel)} / ${formatoMiles(p.xpSiguiente)} XP`}
              </Text>
              <Text style={styles.micro} maxFontSizeMultiplier={1.35}>
                {p.cargando ? '' : rotuloSiguiente(p.nivel, tope)}
              </Text>
            </View>
          </View>
        </View>

        {p.linea && !p.cargando ? (
          <Text style={styles.linea} maxFontSizeMultiplier={1.35} numberOfLines={2}>
            {p.linea}
          </Text>
        ) : null}

        <View style={styles.franja}>
          <FranjaCifras cifras={cifras} centrado enGrupo />
        </View>
      </Velo>
    </View>
  );
}

// ── Perfil ────────────────────────────────────────────────────────────

const AVATAR_PERFIL = 120;

function HeroPerfil(p: HeroRangoProps) {
  const tope = p.xpSiguiente <= 0;
  const ratio = tope ? 1 : ratioSeguro(p.xpEnNivel, p.xpSiguiente);
  const d = p.desde ?? null;
  const inscripcion = `${p.titulo}${p.eyebrow ? ` · ${p.eyebrow}` : ''}`;

  const cifras: Cifra[] = p.cargando
    ? [
        { valor: '', rotulo: t('arena:heroRango.nivel') },
        { valor: '', rotulo: t('arena:heroRango.rango') },
        { valor: '', rotulo: t('arena:heroRango.racha') },
        { valor: '', rotulo: t('arena:heroRango.piedras') },
      ]
    : [
        { valor: p.nivel, rotulo: t('arena:heroRango.nivel'), desde: d?.nivel ?? null },
        { valor: p.rango ?? '', rotulo: t('arena:heroRango.rango') },
        {
          valor: p.racha,
          rotulo: t('arena:heroRango.racha'),
          sufijo: t('arena:heroRango.unidadDia'),
          desde: d?.racha ?? null,
          etiqueta: t('arena:heroRango.rachaA11y', { dias: dias(p.racha) }),
        },
        {
          valor: p.piedrasMax != null ? `${p.piedras}/${p.piedrasMax}` : p.piedras,
          rotulo: t('arena:heroRango.piedras'),
          etiqueta: t('arena:heroRango.piedrasA11y', { piedras: piedrasLeidas(p) }),
        },
      ];

  return (
    <View style={styles.perfil}>
      <Velo>
        <View style={styles.escena}>
          <Pressable
            onPress={p.onAvatar}
            disabled={!p.onAvatar || p.avatarOcupado}
            accessibilityRole="button"
            accessibilityLabel={p.onAvatar ? t('arena:heroRango.cambiarFoto') : p.avatar.nombre}
            accessibilityState={{ busy: !!p.avatarOcupado }}
            style={({ pressed }) => [pressed && styles.pulsado]}
          >
            <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
              <Avatar size={AVATAR_PERFIL} avatarPath={p.avatar.path} name={p.avatar.nombre} rank={p.rango} titulo={p.titulo} />
            </View>
            {p.onAvatar ? (
              <View style={styles.placa}>
                {p.avatarOcupado ? (
                  <ActivityIndicator size="small" color={ink.ink10} />
                ) : (
                  <Ionicons name="camera-outline" size={16} color={ink.ink10} />
                )}
              </View>
            ) : null}
          </Pressable>
        </View>

        <View style={styles.nombreFila}>
          {p.nombre ?? (
            <Text style={styles.nombre} maxFontSizeMultiplier={1.35} numberOfLines={1}>
              {p.avatar.nombre}
            </Text>
          )}
          {p.insignia}
        </View>

        {p.cargando ? (
          <Skeleton height={14} width={220} style={styles.centro} />
        ) : (
          <Text style={styles.inscripcion} maxFontSizeMultiplier={1.35} numberOfLines={2}>
            {inscripcion}
          </Text>
        )}

        {p.linea && !p.cargando ? (
          <Text style={[styles.linea, styles.lineaPerfil]} maxFontSizeMultiplier={1.35} numberOfLines={2}>
            {p.linea}
          </Text>
        ) : null}

        <View style={styles.franjaPerfil}>
          <FranjaCifras cifras={cifras} centrado />
        </View>

        <View style={styles.xpFila}>
          <Text style={styles.micro} maxFontSizeMultiplier={1.35}>
            {p.cargando ? `${CIFRA_VACIA} XP` : tope ? `${formatoMiles(p.xpEnNivel)} XP` : `${formatoMiles(p.xpEnNivel)} / ${formatoMiles(p.xpSiguiente)} XP`}
          </Text>
          <Text style={styles.micro} maxFontSizeMultiplier={1.35}>
            {p.cargando ? '' : rotuloSiguiente(p.nivel, tope)}
          </Text>
        </View>
        {p.cargando ? (
          <Skeleton height={4} />
        ) : (
          <Barra ratio={ratio} desde={d?.xpRatio ?? null} alto={4} tono="oro" etiqueta={t('arena:heroRango.experienciaA11y', { nivel: p.nivel })} />
        )}
      </Velo>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  velo: {
    borderRadius: radio.tarjeta,
    borderWidth: stroke.hairline,
    borderColor: oro.borde,
    paddingVertical: 13,
    paddingHorizontal: 15,
    overflow: 'hidden',
  },

  // Hoy
  hoy: { marginBottom: space.s6 },
  cabeza: { flexDirection: 'row', alignItems: 'center', gap: space.s2, paddingTop: space.s2, marginBottom: space.s2 },
  eyebrow: {
    flex: 1,
    fontFamily: tipo.label.family,
    fontSize: tipo.label.size,
    lineHeight: tipo.label.lineHeight,
    letterSpacing: tipo.label.tracking,
    textTransform: 'uppercase',
    color: ink.ink8,
  },
  avatarBoton: { minWidth: TAM_BOTON, minHeight: TAM_BOTON, alignItems: 'center', justifyContent: 'center' },
  pulsado: { opacity: 0.7 },
  nivelFila: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  rotulo: {
    fontFamily: tipo.label.family,
    fontSize: tipo.micro.size,
    lineHeight: tipo.micro.lineHeight,
    letterSpacing: tipo.label.tracking,
    color: ink.ink8,
  },
  rotuloOro: { color: oro.claro },
  titulo: { fontFamily: tipo.label.family, fontSize: 19, lineHeight: 24, color: ink.ink9, marginTop: 2 },
  huecoTitulo: { marginTop: space.s2 },
  barraHoy: { marginTop: 7 },
  linea: {
    marginTop: space.s3,
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink8,
  },
  xpFila: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: space.s3,
    marginTop: 5,
  },
  micro: {
    fontFamily: tipo.micro.family,
    fontSize: tipo.micro.size,
    lineHeight: tipo.micro.lineHeight,
    letterSpacing: tipo.micro.tracking,
    color: ink.ink8,
  },
  franja: {
    marginTop: space.s3,
    paddingTop: space.s3,
    borderTopWidth: stroke.hairline,
    borderTopColor: vidrio.linea,
  },
  centro: { alignSelf: 'center', marginTop: space.s2 },

  // Perfil
  perfil: { marginBottom: space.s6 },
  escena: { alignItems: 'center', paddingTop: space.s3 },
  placa: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    width: 32,
    height: 32,
    borderRadius: radio.pastilla,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ink.ink1,
    borderWidth: stroke.hairline,
    borderColor: vidrio.borde,
  },
  nombreFila: {
    marginTop: space.s4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.s2,
  },
  nombre: {
    fontFamily: tipo.title.family,
    fontSize: 22,
    lineHeight: 28,
    color: ink.ink9,
    textAlign: 'center',
  },
  inscripcion: {
    marginTop: space.s2,
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: oro.claro,
    textAlign: 'center',
  },
  lineaPerfil: { textAlign: 'center', alignSelf: 'center', maxWidth: 360 },
  franjaPerfil: { marginTop: space.s5, marginBottom: space.s4 },
});
