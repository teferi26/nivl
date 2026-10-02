// NIVL · Galería de pantallas del rediseño L-RADICAL. SOLO DESARROLLO.
//
// /kit/pantallas?pantalla=<id>&estado=<estado>&ancho=375|430|744|1024|1440
//
// Para capturar con Chrome sin cabeza: `&quieto=1` pinta Entrada, Contador y
// Barra ya en su valor final (sin animar; arena/quieto.ts) y `&solo=1` quita
// la cabecera de selectores y deja solo el marco.
//
// Arriba, los selectores; debajo, un marco del ancho elegido (acotado a la
// ventana) con el hueco de contenido que tendría la app a ese ancho
// (`huecoContenido`: a 1024 son 784, a 1440 son 1200). La página «arena»
// enseña cada pieza de la base (src/components/arena); las demás leen el
// `DEMO` de src/components/<pantalla>/demo.tsx y, si es null, «Pendiente».
// En un build de release (__DEV__ false) redirige a la raíz.

import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Arena,
  Barra,
  Columna,
  Contador,
  EncabezadoArena,
  Entrada,
  FranjaCifras,
  Galea,
  HeroRango,
  Laurel,
  Meandro,
  PANTALLAS_DEMO,
  TarjetaArena,
  formatoMiles,
  type DemoPantalla,
  type HeroRangoProps,
  type IdPantalla,
  type VarianteArena,
} from '@/components/arena';
import { fijarQuieto } from '@/components/arena/quieto';
import { DEMO as demoAmigos } from '@/components/amigos/demo';
import { DEMO as demoCampanas } from '@/components/campanas/demo';
import { DEMO as demoCoach } from '@/components/coach/demo';
import { DEMO as demoFotos } from '@/components/fotos/demo';
import { DEMO as demoHabitos } from '@/components/habitos/demo';
import { DEMO as demoHoy } from '@/components/hoy/demo';
import { DEMO as demoOnboarding } from '@/components/onboarding/demo';
import { DEMO as demoPerfil } from '@/components/perfil/demo';
import { Button, Chip, ChipRow, Screen, Section, Tag } from '@/components/ui';
import { huecoContenido } from '@/design/responsive';
import { ink, space, stroke, type as tipo, VERIFY_WIDTHS } from '@/design/tokens';
import { TopeAncho } from '@/design/useSizeClass';

const DEMOS: Record<IdPantalla, DemoPantalla | null> = {
  hoy: demoHoy,
  coach: demoCoach,
  perfil: demoPerfil,
  amigos: demoAmigos,
  onboarding: demoOnboarding,
  habitos: demoHabitos,
  campanas: demoCampanas,
  fotos: demoFotos,
};

type IdPagina = 'arena' | IdPantalla;
const PAGINAS: { id: IdPagina; titulo: string }[] = [{ id: 'arena', titulo: 'Arena' }, ...PANTALLAS_DEMO];
const ANCHO_POR_DEFECTO = 375;

const nada = () => {};

export default function GaleriaPantallas() {
  const params = useLocalSearchParams<{
    pantalla?: string;
    estado?: string;
    ancho?: string;
    quieto?: string;
    solo?: string;
  }>();
  const { width: ventana } = useWindowDimensions();
  // Se fija en el render, antes de que se pinten las piezas de debajo; al
  // salir de la galería se apaga.
  fijarQuieto(params.quieto === '1');
  useEffect(() => () => fijarQuieto(false), []);
  if (!__DEV__) return <Redirect href="/" />;
  const solo = params.solo === '1';
  const quieto = params.quieto === '1';

  const pagina: IdPagina = PAGINAS.some((p) => p.id === params.pantalla) ? (params.pantalla as IdPagina) : 'arena';
  const anchoPedido = Number(params.ancho);
  const ancho = (VERIFY_WIDTHS as readonly number[]).includes(anchoPedido) ? anchoPedido : ANCHO_POR_DEFECTO;
  const demo = pagina === 'arena' ? null : DEMOS[pagina];
  const estado = demo ? (demo.estados.find((e) => e.id === params.estado) ?? demo.estados[0] ?? null) : null;
  const marco = Math.min(ancho, ventana);
  const hueco = huecoContenido(ancho).ancho;

  const ir = (cambio: { pantalla?: string; estado?: string; ancho?: string }) => router.setParams(cambio);

  let contenido: ReactNode;
  if (pagina === 'arena') contenido = <PaginaArena />;
  else if (!demo) contenido = <Pendiente titulo={PAGINAS.find((p) => p.id === pagina)?.titulo ?? pagina} />;
  else if (!estado) contenido = <Pendiente titulo={`${demo.titulo} sin estados`} />;
  else contenido = estado.render();

  return (
    <SafeAreaView style={styles.pantalla} edges={['top', 'left', 'right']}>
      {solo ? null : (
        <View style={styles.controles}>
          <Text style={styles.titulo}>PANTALLAS · L-RADICAL</Text>
          <ChipRow>
            {PAGINAS.map((p) => (
              <Chip
                key={p.id}
                small
                label={p.id !== 'arena' && !DEMOS[p.id] ? `${p.titulo} · pendiente` : p.titulo}
                selected={p.id === pagina}
                onPress={() => ir({ pantalla: p.id, estado: '' })}
              />
            ))}
          </ChipRow>
          {demo && demo.estados.length > 0 ? (
            <ChipRow>
              {demo.estados.map((e) => (
                <Chip key={e.id} small label={e.titulo} selected={e.id === estado?.id} onPress={() => ir({ estado: e.id })} />
              ))}
            </ChipRow>
          ) : null}
          <ChipRow>
            {VERIFY_WIDTHS.map((w) => (
              <Chip key={w} small label={String(w)} selected={w === ancho} onPress={() => ir({ ancho: String(w) })} />
            ))}
          </ChipRow>
          <Text style={styles.nota}>
            Marco {marco} · hueco de contenido {hueco}
            {marco < ancho ? ` · la ventana no llega a ${ancho}` : ''}
            {quieto ? ' · quieto' : ''}
          </Text>
        </View>
      )}

      {/* Con «solo», el marco a la izquierda: Chrome sin cabeza no baja de
          ~500 de ventana y, centrado, la captura de 375 lo cortaba. */}
      <View style={[styles.marco, { width: marco }, solo && styles.marcoSolo]}>
        <TopeAncho.Provider value={hueco}>
          <View key={`${pagina}-${estado?.id ?? ''}-${quieto ? 'q' : 'm'}`} style={styles.flex}>
            {contenido}
          </View>
        </TopeAncho.Provider>
      </View>
    </SafeAreaView>
  );
}

function Pendiente({ titulo }: { titulo: string }) {
  return (
    <View style={styles.pendiente}>
      <Laurel alto={44} lado="izq" />
      <View style={styles.pendienteTexto}>
        <Text style={styles.inscripcion}>PENDIENTE</Text>
        <Text style={styles.cuerpo}>{titulo}: su demo.tsx aún exporta DEMO = null.</Text>
      </View>
      <Laurel alto={44} lado="der" />
    </View>
  );
}

// ── Página «arena»: cada pieza de la base ────────────────────────────

const VARIANTES: VarianteArena[] = ['piedra', 'contorno', 'trama', 'grano', 'invertida'];

const HERO_BASE: HeroRangoProps = {
  variante: 'hoy',
  nivel: 23,
  rango: 'A',
  titulo: 'Héroe de la arena',
  xpEnNivel: 1840,
  xpSiguiente: 2200,
  racha: 12,
  rachaCerrada: false,
  piedras: 2,
  eyebrow: 'Jueves 2 oct',
  linea: 'Buenas tardes, Teferi. 2 misiones por delante.',
  avatar: { path: null, nombre: 'Teferi' },
  cifraExtra: { valor: '3/5', rotulo: 'Misiones' },
  desde: { nivel: 0, xpRatio: 0, racha: 0 },
  accion: { icono: 'calendar-outline', etiqueta: 'Agenda', onPress: nada },
  onAvatar: nada,
};

const HEROES_HOY: { id: string; titulo: string; props: Partial<HeroRangoProps> }[] = [
  {
    id: 'E',
    titulo: 'Hoy · rango E',
    props: { nivel: 3, rango: 'E', titulo: 'Tiro', xpEnNivel: 120, xpSiguiente: 400, racha: 2, piedras: 0,
      linea: 'Buenos días, Teferi. 4 misiones por delante.', cifraExtra: { valor: '1/5', rotulo: 'Misiones' } },
  },
  {
    id: 'B',
    titulo: 'Hoy · rango B',
    props: { nivel: 17, rango: 'B', titulo: 'Campeón', xpEnNivel: 640, xpSiguiente: 1500, racha: 41, piedras: 1 },
  },
  { id: 'A', titulo: 'Hoy · rango A · racha cerrada', props: { rachaCerrada: true } },
  {
    id: 'S',
    titulo: 'Hoy · rango S · 3 cifras',
    props: { nivel: 104, rango: 'S', titulo: 'Leyenda', xpEnNivel: 12480, xpSiguiente: 18000, racha: 731, piedras: 3,
      linea: 'Buenas noches, Teferi. Día perfecto: no queda nada.', cifraExtra: { valor: '5/5', rotulo: 'Misiones' } },
  },
  { id: 'cargando', titulo: 'Hoy · cargando', props: { cargando: true } },
  {
    id: 'tope',
    titulo: 'Hoy · nivel máximo',
    props: { nivel: 120, rango: 'S', titulo: 'Leyenda', xpEnNivel: 250430, xpSiguiente: 0, racha: 1004, piedras: 3,
      linea: 'No queda nivel por subir. Queda defenderlo.' },
  },
];

function PaginaArena() {
  const [vuelta, setVuelta] = useState(0);
  const [xp, setXp] = useState(1840);
  const [ocupado, setOcupado] = useState(false);
  const repetir = () => setVuelta((v) => v + 1);

  return (
    <Screen>
      <EncabezadoArena
        eyebrow="Base E0"
        titulo="La arena"
        subtitulo="Motivos, cifras que suben, barras que se llenan y losas con profundidad."
        accion={{ icono: 'refresh', etiqueta: 'Repetir las animaciones', onPress: repetir }}
        meandro
      />

      <Section title="Motivos">
        <View style={styles.muestras}>
          {[20, 44, 88].map((a) => (
            <View key={a} style={styles.muestra}>
              <View style={styles.par}>
                <Laurel alto={a} lado="izq" />
                <Laurel alto={a} lado="der" />
              </View>
              <Text style={styles.pie}>Laurel {a}</Text>
            </View>
          ))}
          {[72, 96, 128].map((a) => (
            <View key={a} style={styles.muestra}>
              <Columna alto={a} />
              <Text style={styles.pie}>Columna {a}</Text>
            </View>
          ))}
          {[24, 48, 96].map((t) => (
            <View key={t} style={styles.muestra}>
              <Galea kind="casco" size={t} />
              <Text style={styles.pie}>Galea {t}</Text>
            </View>
          ))}
        </View>
        <AnchoDelPadre>{(w) => <Arena ancho={w} alto={120} variante="arco" />}</AnchoDelPadre>
        <Text style={styles.pie}>Arena arco · ancho completo × 120 · 3 gradas</Text>
        <View style={styles.muestras}>
          <View style={styles.muestra}>
            <Arena ancho={220} alto={140} variante="ovalo" />
            <Text style={styles.pie}>Arena óvalo 220 × 140</Text>
          </View>
          <View style={styles.muestra}>
            <Arena ancho={160} alto={80} variante="arco" gradas={5} color={ink.ink4} />
            <Text style={styles.pie}>Arco 160 × 80 · 5 gradas · ink4</Text>
          </View>
        </View>
        <View style={styles.pila}>
          <Meandro alto={8} />
          <Text style={styles.pie}>Meandro 8</Text>
          <Meandro alto={12} />
          <Text style={styles.pie}>Meandro 12</Text>
        </View>
      </Section>

      <Section title="Contador" action={{ label: 'Repetir', onPress: repetir, icon: 'refresh' }}>
        <View key={`c${vuelta}`} style={styles.muestras}>
          <View style={styles.muestra}>
            <Contador valor={23} desde={0} formato={String} style={styles.monumento} maxFontSizeMultiplier={1} />
            <Text style={styles.pie}>monumento · 0 → 23</Text>
          </View>
          <View style={styles.muestra}>
            <Contador valor={xp} desde={0} sufijo=" XP" style={styles.cifra} maxFontSizeMultiplier={1} />
            <Text style={styles.pie}>cifra · formatoMiles</Text>
          </View>
          <View style={styles.muestra}>
            <Contador valor={63} desde={50} sufijo="d" style={styles.cifra} maxFontSizeMultiplier={1} />
            <Text style={styles.pie}>racha · 50 → 63</Text>
          </View>
        </View>
        <Button title={`Sumar 250 XP (${formatoMiles(xp)})`} variant="secondary" size="sm" onPress={() => setXp((v) => v + 250)} />
      </Section>

      <Section title="Barra" action={{ label: 'Repetir', onPress: repetir, icon: 'refresh' }}>
        <View key={`b${vuelta}`} style={styles.pila}>
          <Barra ratio={0.84} desde={0} segmentos={10} etiqueta="Experiencia del nivel 23" />
          <Text style={styles.pie}>alto 6 · 10 segmentos · desde 0 hasta 84 %</Text>
          <Barra ratio={0.62} desde={0.3} alto={4} etiqueta="Tu semana" />
          <Barra ratio={0.48} desde={0.3} alto={4} tono="ink8" etiqueta="La semana del rival" />
          <Text style={styles.pie}>alto 4 · blanco y ink8 · desde 30 %</Text>
          <Barra ratio={12 / 21} desde={11 / 21} alto={8} segmentos={21} etiqueta="Racha del hábito" />
          <Text style={styles.pie}>alto 8 · 21 segmentos · de 11 a 12</Text>
        </View>
      </Section>

      <Section title="Entrada" action={{ label: 'Repetir', onPress: repetir, icon: 'refresh' }}>
        <View key={`e${vuelta}`} style={styles.pila}>
          {['Primer bloque', 'Segundo', 'Tercero', 'Cuarto', 'Quinto'].map((t, i) => (
            <Entrada key={t} indice={i}>
              <TarjetaArena variante="piedra" padded>
                <Text style={styles.cuerpo}>
                  {t} · índice {i} · {i * 55} ms
                </Text>
              </TarjetaArena>
            </Entrada>
          ))}
        </View>
      </Section>

      <Section title="Tarjeta de la arena">
        <View style={styles.pila}>
          {VARIANTES.map((v, i) => (
            <TarjetaArena
              key={v}
              variante={v}
              remaches
              zocalo
              rotulo={v === 'invertida' ? 'La inversión' : `Variante ${v}`}
              meta={i === 0 ? '3/5' : undefined}
              onPress={i === 0 ? nada : undefined}
              accessibilityLabel={i === 0 ? 'Tarjeta pulsable de ejemplo' : undefined}
            >
              <TextoTarjeta invertida={v === 'invertida'}>
                {v === 'piedra'
                  ? 'Superficie ink1 con remaches y zócalo. Pulsable: se encoge al tocarla.'
                  : v === 'contorno'
                    ? 'Hairline ink3 sobre el negro. Avisos, pausa, informes.'
                    : v === 'trama'
                      ? 'Marco de trama: alerta, penalización, bloqueado.'
                      : v === 'grano'
                        ? 'Marco de grano: logro, racha, día perfecto.'
                        : 'Blanco con texto negro. Una por pantalla.'}
              </TextoTarjeta>
            </TarjetaArena>
          ))}
          <TarjetaArena variante="contorno" marco={3} rotulo="Marco 3" meta="Sin remaches">
            <TextoTarjeta>Borde ink10 de 3: jerarquía por trazo.</TextoTarjeta>
          </TarjetaArena>
        </View>
      </Section>

      <Section title="Encabezado de la arena">
        <TarjetaArena variante="contorno">
          <EncabezadoArena
            eyebrow="Arena"
            titulo="Amigos"
            subtitulo="Tu semana contra la suya. Gana quien más XP suma."
            onVolver={nada}
            accion={{ icono: 'share-outline', etiqueta: 'Compartir mi semana', onPress: nada }}
            meandro
          />
          <EncabezadoArena
            eyebrow="Constancia"
            titulo="Hábitos"
            accion={{ icono: 'add', etiqueta: 'Nuevo hábito', onPress: nada, solida: true }}
            derecha={<Tag>3 en forja</Tag>}
          />
        </TarjetaArena>
      </Section>

      <Section title="Franja de cifras">
        <View key={`f${vuelta}`} style={styles.pila}>
          <FranjaCifras
            cifras={[
              { valor: 4, rotulo: 'En forja', desde: 0 },
              { valor: 34, rotulo: 'Mejor racha', sufijo: 'd', desde: 0 },
              { valor: 1, rotulo: 'Listos' },
              { valor: 7, rotulo: 'Adquiridos' },
            ]}
          />
          <FranjaCifras
            centrado
            cifras={[
              { valor: 2, rotulo: 'Abiertas' },
              { valor: 11, rotulo: 'Despejadas' },
              { valor: 3300, rotulo: 'Botín', sufijo: ' XP', desde: 0 },
            ]}
          />
          <FranjaCifras centrado cifras={[{ valor: 'A', rotulo: 'Rango' }, { valor: '', rotulo: 'Sin dato' }]} />
        </View>
      </Section>

      {HEROES_HOY.map((h) => (
        <View key={`${h.id}-${vuelta}`}>
          <Section title={h.titulo} action={{ label: 'Repetir', onPress: repetir, icon: 'refresh' }} />
          <HeroRango {...HERO_BASE} {...h.props} />
        </View>
      ))}

      <View key={`perfil-${vuelta}`}>
        <Section title="Perfil · rango A" action={{ label: 'Repetir', onPress: repetir, icon: 'refresh' }} />
        <HeroRango
          {...HERO_BASE}
          variante="perfil"
          nivel={24}
          racha={63}
          piedrasMax={3}
          eyebrow="Emprendedor"
          linea="63 días seguidos en la arena. Mañana suma uno más."
          desde={{ nivel: 20, xpRatio: 0.2, racha: 50 }}
          avatarOcupado={ocupado}
          onAvatar={() => {
            setOcupado(true);
            setTimeout(() => setOcupado(false), 1500);
          }}
        />
        <Section title="Perfil · rango S" />
        <HeroRango
          {...HERO_BASE}
          variante="perfil"
          nivel={31}
          rango="S"
          titulo="Leyenda"
          racha={731}
          piedras={3}
          piedrasMax={3}
          eyebrow="Deportista"
          linea={undefined}
          desde={null}
        />
      </View>
    </Screen>
  );
}

/** Texto de lectura que se pinta en negro dentro de la invertida. */
function TextoTarjeta({ children, invertida }: { children: ReactNode; invertida?: boolean }) {
  return <Text style={[styles.cuerpo, invertida && { color: ink.ink0 }]}>{children}</Text>;
}

/** Mide el ancho del padre para los motivos que lo necesitan en número. */
function AnchoDelPadre({ children }: { children: (ancho: number) => ReactNode }) {
  const [w, setW] = useState(0);
  const alMedir = (e: LayoutChangeEvent) => setW(Math.round(e.nativeEvent.layout.width));
  return (
    <View onLayout={alMedir} style={styles.anchoPadre}>
      {w > 0 ? children(w) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: ink.ink0 },
  flex: { flex: 1 },
  controles: {
    paddingHorizontal: space.s4,
    paddingTop: space.s3,
    paddingBottom: space.s3,
    gap: space.s2,
    borderBottomWidth: stroke.hairline,
    borderBottomColor: ink.ink3,
  },
  titulo: {
    fontFamily: tipo.inscripcion.family,
    fontSize: tipo.inscripcion.size,
    letterSpacing: tipo.inscripcion.tracking,
    color: ink.ink9,
  },
  nota: { fontFamily: tipo.micro.family, fontSize: tipo.micro.size, letterSpacing: tipo.micro.tracking, color: ink.ink6 },
  marco: {
    flex: 1,
    alignSelf: 'center',
    borderLeftWidth: stroke.hairline,
    borderRightWidth: stroke.hairline,
    borderColor: ink.ink3,
    overflow: 'hidden',
  },
  marcoSolo: { alignSelf: 'flex-start', borderLeftWidth: 0, borderRightWidth: 0 },
  pendiente: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.s4, padding: space.s6 },
  pendienteTexto: { flexShrink: 1, alignItems: 'center', gap: space.s2 },
  inscripcion: {
    fontFamily: tipo.inscripcion.family,
    fontSize: tipo.inscripcion.size,
    lineHeight: tipo.inscripcion.lineHeight,
    letterSpacing: tipo.inscripcion.tracking,
    color: ink.ink9,
  },
  cuerpo: { fontFamily: tipo.bodySm.family, fontSize: tipo.bodySm.size, lineHeight: tipo.bodySm.lineHeight, color: ink.ink9 },
  muestras: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', gap: space.s5, marginBottom: space.s4 },
  muestra: { alignItems: 'center', gap: space.s2 },
  par: { flexDirection: 'row', gap: space.s2 },
  pila: { gap: space.s3 },
  pie: { fontFamily: tipo.micro.family, fontSize: tipo.micro.size, lineHeight: tipo.micro.lineHeight, color: ink.ink6 },
  monumento: {
    fontFamily: tipo.monumento.family,
    fontSize: tipo.monumento.size,
    lineHeight: tipo.monumento.lineHeight,
    color: ink.ink10,
  },
  cifra: { fontFamily: tipo.cifra.family, fontSize: tipo.cifra.size, lineHeight: tipo.cifra.lineHeight, color: ink.ink10 },
  anchoPadre: { alignSelf: 'stretch', minHeight: 1, marginBottom: space.s2 },
});
