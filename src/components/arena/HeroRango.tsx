// NIVL · Arena: el Hero del rango (Main.dc, Nivel.dc, Perfil.dc).
//
// Lo primero que se ve al abrir la app. Dos variantes:
//
//   · hoy    → a sangre sobre negro. Arriba la fecha, la agenda y el avatar.
//              En el centro el NIVEL en Cinzel monumental entre dos ramas de
//              laurel, con el graderío de la arena detrás. Debajo el rango
//              grabado, una línea del sistema, la barra de XP, la franja de
//              cifras y el meandro como cierre (el único de Hoy).
//   · perfil → centrada: el avatar grande (con corona desde B) sobre la planta
//              de la arena, el nombre, el título grabado, la franja y la barra.
//              Cierra con un borde de 3 en ink10. Sin meandro.
//
// Con `rango.grain > 0` (B, A, S) el fondo lleva grano ink3: decoración de
// bajo contraste, no es «logro» (SISTEMA.md §5 bis, excepción 2).
// El lector oye un resumen de una pieza; avatar y agenda van aparte, como
// botones.

import Ionicons from '@expo/vector-icons/Ionicons';
import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { Avatar } from '@/components/ui/Avatar';
import { Skeleton } from '@/components/ui/Skeleton';
import { Grano } from '@/components/ui/Texture';
import { ink, RANK_THEME, space, stroke, type as tipo, type Rank } from '@/design/tokens';
import { useSizeClass, useAnchoUtil } from '@/design/useSizeClass';
import { ASangre } from './ASangre';
import { Barra } from './Barra';
import { formatoMiles, ratioSeguro, rotuloSiguiente } from './cifras';
import { Contador } from './Contador';
import { ajustarInscripcion } from './medida';
import { BotonArena, TAM_BOTON } from './EncabezadoArena';
import { FranjaCifras, textoCifra, type Cifra } from './FranjaCifras';
import { Arena, Laurel, Meandro } from './Motivos';

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

const ARENA_ALTO = 120;
/** Graderío en ink4 con 4 gradas, como PortadaArena: en ink3 no se veía (1,3:1). */
const GRADAS = 4;
/** Hueco de texto por debajo del cual un nivel de 3 cifras baja a monumentoSm. */
const HUECO_MONUMENTO = 360;
/** «NIVEL» sobre el número: la inscripción en pequeño. */
const ROTULO_NIVEL = { size: 12, lineHeight: 16, tracking: 4 };

const dias = (n: number) => (n === 1 ? '1 día' : `${formatoMiles(n)} días`);

/** Lo que oye el lector del bloque central. */
export function resumenHero(p: HeroRangoProps): string {
  const partes: string[] = [];
  partes.push(`Nivel ${p.nivel}${p.rango ? `, rango ${p.rango}` : ''}, ${p.titulo}.`);
  partes.push(
    p.xpSiguiente > 0 ? `${formatoMiles(p.xpEnNivel)} de ${formatoMiles(p.xpSiguiente)} XP.` : 'Nivel máximo.',
  );
  partes.push(`Racha de ${dias(p.racha)}${p.rachaCerrada ? ', hoy ya cuenta' : ''}.`);
  if (p.cifraExtra) partes.push(`${p.cifraExtra.rotulo}: ${textoCifra(p.cifraExtra)}.`);
  partes.push(`Piedras: ${p.piedrasMax != null ? `${p.piedras} de ${p.piedrasMax}` : p.piedras}.`);
  return partes.join(' ');
}

export function HeroRango(props: HeroRangoProps) {
  return props.variante === 'perfil' ? <HeroPerfil {...props} /> : <HeroHoy {...props} />;
}

// ── Hoy ───────────────────────────────────────────────────────────────

function HeroHoy(p: HeroRangoProps) {
  const { gutter, maxContent } = useSizeClass();
  const ancho = useAnchoUtil();
  const [anchoArena, setAnchoArena] = useState(0);
  const huecoTexto = Math.min(ancho, maxContent + 2 * gutter) - 2 * gutter;
  const grande = !(String(Math.abs(p.nivel)).length >= 3 && huecoTexto < HUECO_MONUMENTO);
  const mono = grande ? tipo.monumento : tipo.monumentoSm;
  const altoLaurel = grande ? 88 : 60;
  const grano = p.rango != null && RANK_THEME[p.rango].grain > 0;
  const tope = p.xpSiguiente <= 0;
  const ratio = tope ? 1 : ratioSeguro(p.xpEnNivel, p.xpSiguiente);
  const d = p.desde ?? null;
  const tituloMayus = p.titulo.toUpperCase();
  const ajusteTitulo = ajustarInscripcion(tituloMayus, huecoTexto, {
    size: tipo.inscripcion.size,
    tracking: tipo.inscripcion.tracking,
  });

  const alMedir = (e: LayoutChangeEvent) => {
    const w = Math.round(e.nativeEvent.layout.width);
    if (w !== anchoArena) setAnchoArena(w);
  };

  const cifras: Cifra[] = [
    {
      valor: p.cargando ? '' : p.racha,
      rotulo: p.rachaCerrada ? 'Racha · hoy cuenta' : 'Racha',
      sufijo: p.cargando ? undefined : 'd',
      desde: d?.racha ?? null,
      etiqueta: p.cargando ? 'Racha: cargando' : `Racha: ${dias(p.racha)}`,
    },
    ...(p.cifraExtra ? [p.cargando ? { ...p.cifraExtra, valor: '', desde: null } : p.cifraExtra] : []),
    {
      valor: p.cargando ? '' : p.piedrasMax != null ? `${p.piedras}/${p.piedrasMax}` : p.piedras,
      rotulo: 'Piedras',
    },
  ];

  return (
    <ASangre style={styles.hoy}>
      {grano ? <Grano color={ink.ink3} /> : null}

      {/* 1 · Fecha, agenda y avatar (fuera del resumen: son botones). */}
      <View style={[styles.cabeza, { paddingHorizontal: gutter }]}>
        <Text style={styles.eyebrow} maxFontSizeMultiplier={1.35} numberOfLines={1}>
          {p.eyebrow ?? ''}
        </Text>
        {p.accion ? <BotonArena icono={p.accion.icono} etiqueta={p.accion.etiqueta} onPress={p.accion.onPress} /> : null}
        <Pressable
          onPress={p.onAvatar}
          disabled={!p.onAvatar}
          accessibilityRole="button"
          accessibilityLabel={`Tu perfil, ${p.avatar.nombre}`}
          style={({ pressed }) => [styles.avatarBoton, pressed && styles.pulsado]}
        >
          <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
            <Avatar size={TAM_BOTON} avatarPath={p.avatar.path} name={p.avatar.nombre} rank={p.rango} titulo={p.titulo} />
          </View>
        </Pressable>
      </View>

      {/* 2-6 · El monumento y sus cifras: un solo elemento para el lector. */}
      <View
        accessible
        accessibilityLabel={p.cargando ? 'Cargando tu nivel' : resumenHero(p)}
        accessibilityRole={p.cargando ? 'progressbar' : undefined}
      >
        <View
          style={[styles.monumento, { height: mono.lineHeight + ROTULO_NIVEL.lineHeight + space.s6 }]}
          onLayout={alMedir}
        >
          {anchoArena > 0 ? (
            <Arena
              ancho={anchoArena}
              alto={ARENA_ALTO}
              variante="arco"
              gradas={GRADAS}
              color={ink.ink4}
              style={styles.arena}
            />
          ) : null}
          <View style={styles.filaMonumento}>
            <Laurel alto={altoLaurel} lado="izq" />
            {p.cargando ? (
              <Skeleton height={mono.size * 0.8} width={mono.size * 1.1} />
            ) : (
              <View style={styles.nivelPila}>
                {/* Qué es el número: sin esto, «23» no dice nada. */}
                <Text style={styles.rotuloNivel} maxFontSizeMultiplier={1.35} numberOfLines={1}>
                  NIVEL
                </Text>
                <Contador
                  valor={p.nivel}
                  desde={d?.nivel ?? null}
                  formato={String}
                  style={[
                    styles.nivel,
                    { fontFamily: mono.family, fontSize: mono.size, lineHeight: mono.lineHeight, letterSpacing: mono.tracking },
                  ]}
                  maxFontSizeMultiplier={1}
                  adjustsFontSizeToFit
                  numberOfLines={1}
                />
              </View>
            )}
            <Laurel alto={altoLaurel} lado="der" />
          </View>
        </View>

        <View style={{ paddingHorizontal: gutter }}>
          {p.cargando ? (
            <Skeleton height={14} width={200} style={styles.centro} />
          ) : (
            <>
              {/* «RANGO A» en su línea y el título en la suya: nunca «HÉROE DE
                  LA / ARENA». Si el título no cabe, se aprieta el tracking. */}
              {p.rango ? (
                <Text style={styles.inscripcion} maxFontSizeMultiplier={1.35} numberOfLines={1}>
                  {`RANGO ${p.rango}`}
                </Text>
              ) : null}
              <Text
                style={[
                  styles.inscripcion,
                  p.rango ? styles.inscripcionTitulo : null,
                  { fontSize: ajusteTitulo.size, letterSpacing: ajusteTitulo.tracking },
                ]}
                maxFontSizeMultiplier={1.35}
                numberOfLines={ajusteTitulo.cabe ? 1 : 2}
              >
                {tituloMayus}
              </Text>
            </>
          )}

          {p.linea && !p.cargando ? (
            <Text style={styles.linea} maxFontSizeMultiplier={1.35} numberOfLines={2}>
              {p.linea}
            </Text>
          ) : null}

          <View style={styles.xpFila}>
            <Text style={styles.micro} maxFontSizeMultiplier={1.35}>
              {p.cargando ? '- XP' : tope ? `${formatoMiles(p.xpEnNivel)} XP` : `${formatoMiles(p.xpEnNivel)} / ${formatoMiles(p.xpSiguiente)} XP`}
            </Text>
            <Text style={styles.micro} maxFontSizeMultiplier={1.35}>
              {p.cargando ? '' : rotuloSiguiente(p.nivel, tope)}
            </Text>
          </View>
          {p.cargando ? (
            <Skeleton height={6} />
          ) : (
            <Barra
              ratio={ratio}
              desde={d?.xpRatio ?? null}
              alto={6}
              segmentos={10}
              etiqueta={`Experiencia del nivel ${p.nivel}`}
              enGrupo
            />
          )}

          <View style={styles.franja}>
            <FranjaCifras cifras={cifras} centrado enGrupo />
          </View>
        </View>
      </View>

      {/* 7 · El cierre de la arena, de borde a borde. */}
      <Meandro alto={8} style={styles.meandro} />
    </ASangre>
  );
}

// ── Perfil ────────────────────────────────────────────────────────────

const AVATAR_PERFIL = 120;

function HeroPerfil(p: HeroRangoProps) {
  const { gutter } = useSizeClass();
  const grano = p.rango != null && RANK_THEME[p.rango].grain > 0;
  const tope = p.xpSiguiente <= 0;
  const ratio = tope ? 1 : ratioSeguro(p.xpEnNivel, p.xpSiguiente);
  const d = p.desde ?? null;
  const inscripcion = `«${p.titulo}»${p.eyebrow ? ` · ${p.eyebrow}` : ''}`.toUpperCase();

  const cifras: Cifra[] = p.cargando
    ? [
        { valor: '', rotulo: 'Nivel' },
        { valor: '', rotulo: 'Rango' },
        { valor: '', rotulo: 'Racha' },
        { valor: '', rotulo: 'Piedras' },
      ]
    : [
        { valor: p.nivel, rotulo: 'Nivel', desde: d?.nivel ?? null },
        { valor: p.rango ?? '', rotulo: 'Rango' },
        { valor: p.racha, rotulo: 'Racha', sufijo: 'd', desde: d?.racha ?? null, etiqueta: `Racha: ${dias(p.racha)}` },
        {
          valor: p.piedrasMax != null ? `${p.piedras}/${p.piedrasMax}` : p.piedras,
          rotulo: 'Piedras',
          etiqueta: `Piedras: ${p.piedrasMax != null ? `${p.piedras} de ${p.piedrasMax}` : p.piedras}`,
        },
      ];

  return (
    <ASangre style={[styles.perfil, { paddingHorizontal: gutter }]}>
      {grano ? <Grano color={ink.ink3} /> : null}

      <View style={styles.escena}>
        <Arena ancho={220} alto={140} variante="ovalo" gradas={GRADAS} color={ink.ink4} style={styles.ovalo} />
        <Pressable
          onPress={p.onAvatar}
          disabled={!p.onAvatar || p.avatarOcupado}
          accessibilityRole="button"
          accessibilityLabel={p.onAvatar ? 'Cambiar foto de perfil' : p.avatar.nombre}
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
        <Text style={[styles.inscripcion, styles.inscripcionPerfil]} maxFontSizeMultiplier={1.35} numberOfLines={2}>
          {inscripcion}
        </Text>
      )}

      {p.linea && !p.cargando ? (
        <Text style={styles.linea} maxFontSizeMultiplier={1.35} numberOfLines={2}>
          {p.linea}
        </Text>
      ) : null}

      <View style={styles.franjaPerfil}>
        <FranjaCifras cifras={cifras} centrado />
      </View>

      <View style={styles.xpFila}>
        <Text style={styles.micro} maxFontSizeMultiplier={1.35}>
          {p.cargando ? '- XP' : tope ? `${formatoMiles(p.xpEnNivel)} XP` : `${formatoMiles(p.xpEnNivel)} / ${formatoMiles(p.xpSiguiente)} XP`}
        </Text>
        <Text style={styles.micro} maxFontSizeMultiplier={1.35}>
          {p.cargando ? '' : rotuloSiguiente(p.nivel, tope)}
        </Text>
      </View>
      {p.cargando ? (
        <Skeleton height={6} />
      ) : (
        <Barra ratio={ratio} desde={d?.xpRatio ?? null} alto={6} segmentos={10} etiqueta={`Experiencia del nivel ${p.nivel}`} />
      )}
    </ASangre>
  );
}

const styles = StyleSheet.create({
  // Hoy
  hoy: { backgroundColor: ink.ink0, overflow: 'hidden', marginBottom: space.s8 },
  cabeza: { flexDirection: 'row', alignItems: 'center', gap: space.s2, paddingTop: space.s2 },
  eyebrow: {
    flex: 1,
    fontFamily: tipo.label.family,
    fontSize: tipo.label.size,
    lineHeight: tipo.label.lineHeight,
    letterSpacing: tipo.label.tracking,
    textTransform: 'uppercase',
    color: ink.ink6,
  },
  avatarBoton: { minWidth: TAM_BOTON, minHeight: TAM_BOTON, alignItems: 'center', justifyContent: 'center' },
  pulsado: { opacity: 0.7 },
  monumento: { marginTop: space.s2, justifyContent: 'flex-end' },
  arena: { position: 'absolute', left: 0, bottom: 0 },
  filaMonumento: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.s3,
    paddingHorizontal: space.s4,
    paddingBottom: space.s1,
  },
  nivelPila: { alignItems: 'center', flexShrink: 1 },
  rotuloNivel: {
    fontFamily: tipo.inscripcion.family,
    fontSize: ROTULO_NIVEL.size,
    lineHeight: ROTULO_NIVEL.lineHeight,
    letterSpacing: ROTULO_NIVEL.tracking,
    // El tracking también se pinta tras la última letra: se compensa para
    // que «NIVEL» quede centrado sobre el número.
    paddingLeft: ROTULO_NIVEL.tracking,
    color: ink.ink6,
    textAlign: 'center',
  },
  nivel: { color: ink.ink10, textAlign: 'center', flexShrink: 1 },
  inscripcion: {
    marginTop: space.s2,
    fontFamily: tipo.inscripcion.family,
    fontSize: tipo.inscripcion.size,
    lineHeight: tipo.inscripcion.lineHeight,
    letterSpacing: tipo.inscripcion.tracking,
    color: ink.ink9,
    textAlign: 'center',
  },
  inscripcionTitulo: { marginTop: space.s1 },
  linea: {
    marginTop: space.s3,
    alignSelf: 'center',
    maxWidth: 360,
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink8,
    textAlign: 'center',
  },
  xpFila: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: space.s3,
    marginTop: space.s6,
    marginBottom: space.s2,
  },
  micro: {
    fontFamily: tipo.micro.family,
    fontSize: tipo.micro.size,
    lineHeight: tipo.micro.lineHeight,
    letterSpacing: tipo.micro.tracking,
    color: ink.ink6,
  },
  franja: {
    marginTop: space.s5,
    paddingTop: space.s4,
    borderTopWidth: stroke.hairline,
    borderTopColor: ink.ink3,
  },
  meandro: { marginTop: space.s5 },
  centro: { alignSelf: 'center', marginTop: space.s2 },

  // Perfil
  perfil: {
    backgroundColor: ink.ink0,
    overflow: 'hidden',
    alignItems: 'stretch',
    paddingTop: space.s4,
    paddingBottom: space.s6,
    borderBottomWidth: stroke.frame,
    borderBottomColor: ink.ink10,
    marginBottom: space.s6,
  },
  escena: { minHeight: 168, alignItems: 'center', justifyContent: 'flex-end' },
  ovalo: { position: 'absolute', bottom: 0, alignSelf: 'center' },
  placa: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ink.ink0,
    borderWidth: stroke.hairline,
    borderColor: ink.ink10,
  },
  nombreFila: {
    marginTop: space.s4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.s2,
  },
  nombre: {
    fontFamily: tipo.headline.family,
    fontSize: 22,
    lineHeight: 28,
    color: ink.ink10,
    textAlign: 'center',
  },
  inscripcionPerfil: { color: ink.ink8, fontSize: 12, letterSpacing: 3 },
  franjaPerfil: { marginTop: space.s5 },
});
