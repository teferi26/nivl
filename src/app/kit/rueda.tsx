// NIVL · Galería: la rueda de modos quieta SOBRE LAS PANTALLAS DE VERDAD (el Hoy
// de NIVL y el inicio de IRON con datos de demo y su barra de pestañas), para
// compararla con las láminas de la P01 (propuestas_modos/p01). SOLO
// DESARROLLO, sin sesión ni Supabase.
//
// /kit/rueda?estado=<e>&modo=<m>&actual=<m>&anterior=<m>&t=<0..1>
//   estado: abierta (lámina 4, cuadro 01: mantenida en el emblema) · apuntando
//           (lámina 1, cuadro 03) · recarga (cuadro 04 y «recarga dorada» con
//           modo=general) · pantalla (la pantalla sola: cabecera, emblema)
//           · emblema (el disco quieto y cargando)
//   modo: el apuntado o el que recarga · actual: el modo a la vista (general:
//   el Hoy de NIVL; otro: el inicio de IRON) · anterior: el que se marca ·
//   t: instante de la recarga (0,7 por defecto)
// Las piezas son las de la app (RuedaModos, DibujoEmblema, CabeceraMundo,
// HoyVista, IronHoyVista, TabBar); aquí solo se fijan sus valores. En un build
// de release (__DEV__ false) redirige a la raíz.

import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { HOY_DEMO, misionDemo, perfilDemo, YO_DEMO } from '@/components/arena/demoDatos';
import { derivarHoy, type EntradaHoy } from '@/components/hoy/derivarHoy';
import { HoyVista } from '@/components/hoy/HoyVista';
import { CabeceraMundo, LADO_RANURA } from '@/components/modos/mundo/CabeceraMundo';
import { IronHoyVista } from '@/components/modos/mundo/IronHoyVista';
import { DibujoEmblema, type FormaEmblema } from '@/components/modos/rueda/DibujoEmblema';
import { DiscoRueda, FichaRueda, geometriaRueda, GuiaDedo, RecargaModo, topFicha, VeloRueda } from '@/components/modos/rueda/RuedaModos';
import { nombreDestino } from '@/components/ui/navItems';
import { TabBar } from '@/components/ui/TabBar';
import { acentoRueda } from '@/design/tokens';
import { t } from '@/i18n';
import type { Completion, Quest } from '@/lib/types';
import { nivelesDeModos } from '@/modos/niveles';
import { mascaraDisponibles, ORDEN_RUEDA, RUEDA } from '@/modos/rueda';
import { esModo, MODOS, type ModoEtiqueta, type ModoId } from '@/modos/tipos';

const TODOS: readonly ModoId[] = MODOS;
const XP_DEMO: Record<ModoEtiqueta, number> = { iron: 7760, focus: 2600, work: 1500, founder: 600 };
const nada = () => {};

export default function KitRueda() {
  const p = useLocalSearchParams<{ estado?: string; modo?: string; actual?: string; anterior?: string; t?: string }>();
  const { width: w, height: h } = useWindowDimensions();
  const estado = p.estado ?? 'abierta';
  const modo: ModoId = esModo(p.modo) ? p.modo : 'iron';
  const actual: ModoId = esModo(p.actual) ? p.actual : 'general';
  const anterior: ModoId | null = esModo(p.anterior) ? p.anterior : null;
  const instante = p.t ? Math.min(1, Math.max(0, Number(p.t))) : 0.7;
  const geo = geometriaRueda(w, h);
  const resaltado = useSharedValue(-1);
  const progreso = useSharedValue(instante);
  const carga = useSharedValue(0);
  const dedoX = useSharedValue(0);
  const dedoY = useSharedValue(0);
  const [emblema, setEmblema] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    resaltado.value = estado === 'apuntando' ? ORDEN_RUEDA.indexOf(modo) : -1;
    progreso.value = instante;
    carga.value = estado === 'emblema' ? 0.7 : 0;
    if (estado === 'apuntando' && modo !== 'general') {
      // El dedo sobre el icono del sector apuntado (cuadro 03).
      const a = ({ iron: 0, focus: 90, work: 180, founder: 270 } as const)[modo];
      const r = (RUEDA.icono - 4) * geo.escala;
      dedoX.value = geo.cx + r * Math.sin((a * Math.PI) / 180);
      dedoY.value = geo.cy - r * Math.cos((a * Math.PI) / 180);
    } else if (estado === 'abierta' && emblema) {
      // Mantenido: el dedo sigue en el emblema (lámina 4, cuadro 01).
      dedoX.value = emblema.x;
      dedoY.value = emblema.y;
    } else {
      dedoX.value = 0;
      dedoY.value = 0;
    }
  }, [estado, modo, instante, emblema, geo.cx, geo.cy, geo.escala, resaltado, progreso, carga, dedoX, dedoY]);

  if (!__DEV__) return <Redirect href="/" />;

  if (estado === 'recarga') {
    return (
      <View style={styles.pantalla}>
        <RecargaModo modo={modo} ancho={w} alto={h} progreso={progreso} reducido={false} />
      </View>
    );
  }

  if (estado === 'emblema') {
    return (
      <View style={[styles.pantalla, styles.centrado]}>
        <DibujoEmblema forma="disco" tamano={56} modo={actual} disponibles={TODOS} />
        <View style={{ height: 80 }} />
        <DibujoEmblema forma="disco" tamano={56} modo={actual} disponibles={TODOS} carga={carga} />
      </View>
    );
  }

  // El gesto nace del disco del centro de la barra (P01).
  const forma: FormaEmblema = 'disco';
  const tamano = 56;
  const pantalla = actual === 'general' ? <HoyNivl alMedir={setEmblema} /> : <InicioIron alMedir={setEmblema} />;

  if (estado === 'pantalla') return <View style={styles.pantalla}>{pantalla}</View>;

  // abierta / apuntando: la pantalla real, el desenfoque y la rueda.
  return (
    <View style={styles.pantalla}>
      {pantalla}
      <VeloRueda resaltado={resaltado} />
      <GuiaDedo ancho={w} alto={h} emblema={emblema ? { ...emblema, forma, tamano } : null} modo={actual} disponibles={TODOS} dedoX={dedoX} dedoY={dedoY} resaltado={resaltado} mantener={estado === 'abierta'} capa="fondo" />
      <FichaRueda
        modo={estado === 'apuntando' ? modo : null}
        actual={actual}
        anterior={anterior}
        ancho={w}
        top={topFicha(geo)}
        arribaRueda={geo.cy - geo.D / 2}
      />
      <View style={{ position: 'absolute', left: geo.cx - geo.D / 2, top: geo.cy - geo.D / 2 }}>
        <DiscoRueda lado={geo.D} modo={actual} anterior={anterior} mascara={mascaraDisponibles(TODOS)} resaltado={resaltado} />
      </View>
      <GuiaDedo
        ancho={w}
        alto={h}
        emblema={emblema ? { ...emblema, forma, tamano } : null}
        modo={actual}
        disponibles={TODOS}
        dedoX={dedoX}
        dedoY={dedoY}
        resaltado={resaltado}
        mantener={estado === 'abierta'}
        capa="dedo"
      />
    </View>
  );
}

/** Mide dónde queda el emblema en la ventana (de ahí nace la estela). */
function Medido({ alMedir, children }: { alMedir: (p: { x: number; y: number }) => void; children: React.ReactNode }) {
  const ref = useRef<View>(null);
  return (
    <View
      ref={ref}
      collapsable={false}
      onLayout={() =>
        ref.current?.measureInWindow((x, y, ancho, alto) => {
          if (ancho > 0) alMedir({ x: x + ancho / 2, y: y + alto / 2 });
        })
      }
    >
      {children}
    </View>
  );
}

// ─────────────── El Hoy de NIVL (datos de demo de la galería) ───────────────

const hecha = (q: Quest, xp: number): Completion => ({
  id: `c-${q.id}`,
  user_id: 'demo-usuario',
  quest_id: q.id,
  date: HOY_DEMO,
  completed_at: `${HOY_DEMO}T08:30:00Z`,
  xp_awarded: xp,
  evidence_url: null,
});

function HoyNivl({ alMedir }: { alMedir: (p: { x: number; y: number }) => void }) {
  const datos = useMemo(() => {
    const pierna = misionDemo({ title: 'Entreno de pierna', stat: 'FUE', difficulty: 'dificil', link: 'gym', modes: ['iron'] });
    const proteina = misionDemo({ title: 'Llegar a 140 g de proteína', stat: 'VIT', modes: ['iron'] });
    const tema4 = misionDemo({ title: 'Estudiar Tema 4', stat: 'INT', modes: ['focus'] });
    const leer = misionDemo({ title: 'Leer 20 páginas', stat: 'INT' });
    const entrada: EntradaHoy = {
      hoy: HOY_DEMO,
      hora: 16,
      profile: perfilDemo(),
      rango: YO_DEMO.rango,
      tituloEquipado: null,
      quests: [pierna, proteina, tema4, leer],
      completions: { [pierna.id]: hecha(pierna, 100) },
      dayResult: null,
      plan: null,
      esPro: false,
      board: null,
      rotosPrevios: 0,
      diaPerfecto: false,
      avisoRecuperacion: false,
      modo: 'general',
    };
    return derivarHoy(entrada);
  }, []);
  return (
    <View style={styles.columna}>
      <View style={styles.contenido}>
        <HoyVista
          estado="listo"
          error={null}
          datos={datos}
          ocupada={null}
          preparandoTarjeta={false}
          refrescando={false}
          desde={null}
          acciones={{ onCompletar: nada, onAlternarBloque: nada, onCompartirDia: nada, onRefrescar: nada, onReintentar: nada }}
        />
      </View>
      <BarraDemo
        modo="general"
        alMedir={alMedir}
        rutas={['index', 'coach', 'habitos', 'mazmorras', 'perfil']} titulos={{ index: nombreDestino('hoy'), coach: nombreDestino('coach'), habitos: nombreDestino('habitos'), mazmorras: nombreDestino('campanas'), perfil: nombreDestino('perfil') }} />
    </View>
  );
}

// ─────────────── El inicio de IRON (datos de demo) ───────────────

function InicioIron({ alMedir }: { alMedir: (p: { x: number; y: number }) => void }) {
  const u = 'demo-usuario';
  const dias = [
    { id: 'd1', user_id: u, day_of_week: 2, name: 'Pierna A' },
    { id: 'd2', user_id: u, day_of_week: 1, name: 'Empuje' },
    { id: 'd3', user_id: u, day_of_week: 4, name: 'Tirón' },
    { id: 'd4', user_id: u, day_of_week: 5, name: 'Pierna B' },
  ];
  const ejercicios = [
    { id: 'e1', gym_day_id: 'd1', user_id: u, name: 'Sentadilla trasera', sets: 4, reps: 5, weight: 102.5, position: 0 },
    { id: 'e2', gym_day_id: 'd1', user_id: u, name: 'Peso muerto rumano', sets: 3, reps: 8, weight: 80, position: 1 },
    { id: 'e3', gym_day_id: 'd1', user_id: u, name: 'Prensa inclinada', sets: 3, reps: 10, weight: 160, position: 2 },
  ];
  const nivel = nivelesDeModos(['iron'], XP_DEMO)[0];
  return (
    <View style={styles.columna}>
      <View style={styles.contenido}>
        <IronHoyVista
          cabecera={
            <CabeceraMundo
              modo="iron"
              nivel={nivel}
              emblema={<DibujoEmblema forma="placa" tamano={LADO_RANURA} modo="iron" disponibles={TODOS} />}
            />
          }
          fecha="Martes, 20 de octubre"
          cierre={null}
          entreno={{
            cargado: true,
            errorCarga: null,
            hoyDia: 2,
            dias,
            ejercicios,
            sesionHoy: null,
            xpMisionHoy: 0,
            onEmpezar: nada,
            onReintentar: nada,
          }}
          pesos={{
            estado: 'listo',
            filas: [
              { clave: 'sentadilla', nombre: 'Sentadilla', kg: 100, subida: 7.5, record: false, e1rm: 117, sesiones: 6 },
              { clave: 'banca', nombre: 'Press banca', kg: 72.5, subida: 5, record: true, e1rm: 84, sesiones: 6 },
              { clave: 'muerto', nombre: 'Peso muerto', kg: 130, subida: 10, record: false, e1rm: 151, sesiones: 5 },
            ],
          }}
          dieta={{ estado: 'listo', objetivo: { kcal: 2400, proteina: 160 }, parte: { kcal: 1880, proteina: 128 } }}
          acciones={{ onRutinas: nada, onPesos: nada, onCatalogo: nada, onDieta: nada, onNutricion: nada, onCoach: nada }}
        />
      </View>
      <BarraDemo
        modo="iron"
        alMedir={alMedir}
        rutas={['iron-hoy', 'iron-rutinas', 'iron-pesos', 'iron-coach']}
        titulos={{ 'iron-hoy': t('mundos:pestana.hoy'), 'iron-rutinas': t('mundos:pestana.rutinas'), 'iron-pesos': t('mundos:pestana.pesos'), 'iron-coach': t('mundos:pestana.coach') }}
        acento={acentoRueda.iron}
      />
    </View>
  );
}

/** La barra de pestañas de verdad con una navegación de mentira (no navega). */
function BarraDemo({
  rutas,
  titulos,
  acento,
  modo,
  alMedir,
}: {
  rutas: string[];
  titulos: Record<string, string>;
  acento?: string;
  modo: ModoId;
  alMedir: (p: { x: number; y: number }) => void;
}) {
  const props = {
    state: { index: 0, routes: rutas.map((n) => ({ key: n, name: n })) },
    descriptors: Object.fromEntries(rutas.map((n) => [n, { options: { title: titulos[n] } }])),
    navigation: { emit: () => ({ defaultPrevented: true }), navigate: nada },
  } as unknown as BottomTabBarProps;
  return (
    <TabBar
      {...props}
      acento={acento}
      centro={
        <Medido alMedir={alMedir}>
          <DibujoEmblema forma="disco" tamano={56} modo={modo} disponibles={TODOS} />
        </Medido>
      }
    />
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: '#000000', overflow: 'hidden' },
  centrado: { alignItems: 'center', justifyContent: 'center' },
  columna: { flex: 1 },
  contenido: { flex: 1, paddingTop: 44 },
});
