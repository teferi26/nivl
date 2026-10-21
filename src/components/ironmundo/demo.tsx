// Demo de la galería /kit/pantallas (solo desarrollo): el mundo IRON con los
// datos de la lámina 2 de la P01 (martes 20 de octubre, Pierna A · Fuerza,
// sentadilla 100 kg, press banca 72,5 récord, peso muerto 130). Sin sesión ni
// Supabase; las acciones no hacen nada.
//
// La barra inferior de aquí es una MUESTRA de la lámina (4 pestañas y el
// emblema en el centro) para comparar la pantalla entera: la de la app es la
// de LayoutMundo (src/components/modos/mundo), que lleva otro encargo.

import { useState, type ReactElement } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import type { DemoPantalla } from '@/components/arena/galeria';
import { CabeceraMundo } from '@/components/modos/mundo/CabeceraMundo';
import { modoAcento } from '@/design/tokens';
import { t } from '@/i18n';
import { ejercicioPorId, EJERCICIOS } from '@/iron/ejercicios';
import { entradasIron } from '@/iron/catalogo';
import type { CardioSession, NutritionLog, NutritionTarget, Prescription } from '@/lib/bodywork';
import type { GymDay, GymExercise, MealSlot } from '@/lib/types';
import { nivelesDeModos } from '@/modos/niveles';
import { CatalogoIronVista } from './CatalogoIronVista';
import { DietaIronVista, type DietaIronVistaProps } from './DietaIronVista';
import { EntrenoIronVista, type EntrenoIronVistaProps, type VistaEntreno } from './EntrenoIronVista';
import { GlifoIron, type Glifo } from './Glifos';
import { InicioIronVista, type InicioIronVistaProps } from './InicioIronVista';
import { PuertaSaludIron } from './SaludIron';
import { A, C, F, fs, px } from './tema';
import { TecnicaIronVista } from './TecnicaIronVista';
import { fechaIron, palabraCoach } from './textos';
import type { PesoIron } from './usePesos';

const nada = () => {};
const U = 'demo';
const HOY = '2026-10-20';
const MARTES = 2;

const NIVEL = nivelesDeModos(['iron'], { iron: 17260, focus: 0, work: 0, founder: 0 })[0] ?? null;
const cabecera = <CabeceraMundo modo="iron" nivel={NIVEL} />;

const DIAS: GymDay[] = [
  { id: 'd2', user_id: U, day_of_week: MARTES, name: 'Pierna A · Fuerza' },
  { id: 'd3', user_id: U, day_of_week: 3, name: 'Empuje' },
  { id: 'd4', user_id: U, day_of_week: 4, name: 'Tirón' },
  { id: 'd6', user_id: U, day_of_week: 6, name: 'Pierna B' },
];
const ej = (id: string, dia: string, name: string, sets: number, reps: number, weight: number | null, position: number): GymExercise => ({
  id,
  gym_day_id: dia,
  user_id: U,
  name,
  sets,
  reps,
  weight,
  position,
});
const EJERCICIOS_DEMO: GymExercise[] = [
  ej('e1', 'd2', 'Sentadilla trasera', 4, 5, 102.5, 0),
  ej('e2', 'd2', 'Peso muerto rumano', 3, 8, 80, 1),
  ej('e3', 'd2', 'Prensa inclinada', 3, 10, 160, 2),
  ej('e4', 'd2', 'Zancada búlgara', 3, 10, 22.5, 3),
  ej('e5', 'd2', 'Curl femoral', 4, 12, 45, 4),
  ej('e6', 'd3', 'Press banca', 4, 6, 72.5, 0),
  ej('e7', 'd3', 'Press militar', 3, 8, 45, 1),
  ej('e8', 'd3', 'Fondos', 3, 10, null, 2),
  ej('e9', 'd4', 'Dominadas', 4, 6, null, 0),
  ej('e10', 'd4', 'Remo con barra', 4, 8, 70, 1),
  ej('e11', 'd6', 'Peso muerto', 3, 5, 130, 0),
  ej('e12', 'd6', 'Hip thrust', 3, 10, 100, 1),
];

const tecnica = (id: string) => (ejercicioPorId(id) ? nada : undefined);
const peso = (clave: string, nombre: string, kg: number, subida: number | null, record: boolean, serie: number[], e1rm: number): PesoIron => ({
  clave,
  nombre,
  kg,
  subida,
  record,
  e1rm,
  sesiones: serie.length + 4,
  serie,
  ultimaFecha: '2026-10-18',
  onTecnica: tecnica(clave),
});
const PESOS: PesoIron[] = [
  peso('sentadilla-barra', 'Sentadilla', 100, 7.5, false, [85, 87.5, 90, 90, 92.5, 95, 97.5, 100], 116.7),
  peso('press-banca', 'Press banca', 72.5, 10, true, [62.5, 65, 65, 67.5, 67.5, 70, 70, 72.5], 84.6),
  peso('peso-muerto', 'Peso muerto', 130, 10, false, [115, 120, 120, 122.5, 125, 125, 127.5, 130], 151.7),
  peso('hip-thrust', 'Hip thrust', 100, 15, false, [70, 75, 80, 85, 90, 95, 100], 128.6),
];

const PRESCRITO: Prescription[] = [];

function entreno(cambios: Partial<InicioIronVistaProps['entreno']> = {}): InicioIronVistaProps['entreno'] {
  return {
    cargado: true,
    errorCarga: null,
    hoyDia: MARTES,
    dias: DIAS,
    ejercicios: EJERCICIOS_DEMO,
    prescrito: PRESCRITO,
    xpHecho: null,
    xpSesion: 50,
    tecnicaDe: () => nada,
    onEmpezar: nada,
    onReintentar: nada,
    ...cambios,
  };
}

function inicio(cambios: Partial<InicioIronVistaProps> = {}): InicioIronVistaProps {
  const e = cambios.entreno ?? entreno();
  return {
    cabecera,
    fecha: fechaIron(HOY),
    cierre: null,
    entreno: e,
    pesos: { estado: 'listo', filas: PESOS },
    dieta: { estado: 'listo', kcal: 1880, objetivoKcal: 2410, proteina: 140, objetivoProteina: 170, aguaMl: 1500, objetivoAguaMl: 2000 },
    coach: palabraCoach(e),
    acciones: { onRutinas: nada, onPesos: nada, onCatalogo: nada, onDieta: nada, onCoach: nada },
    ...cambios,
  };
}

const sesion = (n: number, c: Partial<CardioSession>): CardioSession => ({
  id: `c${n}`,
  date: `2026-10-${String(20 - n).padStart(2, '0')}`,
  kind: 'correr',
  distance_km: 5,
  duration_min: 28,
  avg_hr: null,
  rpe: null,
  zone: 'Z2',
  notes: null,
  xp_awarded: 25,
  ...c,
});
const CARDIO: CardioSession[] = [
  sesion(0, { kind: 'correr', distance_km: 6.2, duration_min: 32, zone: 'Z2' }),
  sesion(2, { kind: 'bici', distance_km: 28.5, duration_min: 65, zone: 'Z2' }),
  sesion(5, { kind: 'otro', distance_km: null, duration_min: 20, zone: 'intervalos', xp_awarded: 20 }),
  sesion(8, { kind: 'remo', distance_km: 5, duration_min: 24, zone: 'Z4', xp_awarded: 0 }),
  sesion(12, { kind: 'correr', distance_km: 10, duration_min: 55, zone: 'Z2' }),
  sesion(16, { kind: 'nadar', distance_km: 1.5, duration_min: 40, zone: 'Z3' }),
  sesion(19, { kind: 'correr', distance_km: 5, duration_min: 27, zone: 'Z3' }),
];

function entrenoVista(vista: VistaEntreno, cambios: Partial<EntrenoIronVistaProps> = {}): EntrenoIronVistaProps {
  return {
    cabecera,
    vista,
    onVista: nada,
    rutinas: {
      cargado: true,
      errorCarga: null,
      hoyDia: MARTES,
      dias: DIAS,
      ejercicios: EJERCICIOS_DEMO,
      prescrito: [],
      xpHecho: null,
      xpSesion: 50,
      tecnicaDe: () => nada,
      acciones: {
        onEmpezar: nada,
        onReintentar: nada,
        onNuevoDia: nada,
        onNuevoEjercicio: nada,
        onEditarEjercicio: nada,
        onBorrarDia: nada,
        onBorrarEjercicio: nada,
        onCatalogo: nada,
      },
    },
    pesos: { estado: 'listo', filas: PESOS },
    cardio: {
      cargado: true,
      errorCarga: null,
      hoy: HOY,
      sesiones: CARDIO,
      anuncio: null,
      pesoKg: 78.4,
      acciones: { onRegistrar: nada, onBorrar: nada, onReintentar: nada, onCerrarAnuncio: nada },
    },
    ...cambios,
  };
}

const OBJETIVO: NutritionTarget = { id: 'o', from_date: '2026-10-01', kcal: 2410, protein_g: 170, carbs_g: 260, fat_g: 75, rationale: null };
const LOG: NutritionLog = { id: 'l', date: HOY, hit_kcal: true, hit_protein: false, kcal_est: 1880, protein_est: 140, notes: null, water_ml: 1500, free_meal: false };
const comida = (slot: MealSlot['slot'], description: string, kcal: number, protein_g: number): MealSlot => ({
  id: slot,
  user_id: U,
  day_of_week: MARTES,
  slot,
  description,
  ingredients: null,
  kcal,
  protein_g,
});
const COMIDAS: MealSlot[] = [
  comida('desayuno', 'Avena con yogur griego y plátano', 520, 32),
  comida('comida', 'Arroz, pollo y verduras salteadas', 780, 55),
  comida('merienda', 'Tostada de pavo y una pieza de fruta', 330, 24),
];
const PESAJES = [
  { date: '2026-09-21', weight_kg: 80.1 },
  { date: '2026-09-25', weight_kg: 79.9 },
  { date: '2026-09-29', weight_kg: 79.6 },
  { date: '2026-10-03', weight_kg: 79.7 },
  { date: '2026-10-07', weight_kg: 79.2 },
  { date: '2026-10-11', weight_kg: 78.9 },
  { date: '2026-10-15', weight_kg: 78.8 },
  { date: '2026-10-20', weight_kg: 78.4 },
];

function dieta(cambios: Partial<DietaIronVistaProps> = {}): DietaIronVistaProps {
  return {
    cabecera,
    fecha: fechaIron(HOY),
    parte: {
      cargado: true,
      errorCarga: null,
      objetivo: OBJETIVO,
      hoyLog: LOG,
      kcal: true,
      prote: false,
      notas: '',
      guardando: false,
      xpDia: 10,
      acciones: { onKcal: nada, onProte: nada, onNotas: nada, onGuardar: nada, onCoach: nada, onReintentar: nada },
    },
    agua: { cargado: true, ml: 1500, objetivoMl: 2000, libre: false, guardando: false, error: null, onVaso: nada, onMas: nada, onLibre: nada },
    comidas: { cargado: true, errorCarga: null, hoy: COMIDAS, generando: false, acciones: { onComida: nada, onGenerar: nada, onCompra: nada, onReintentar: nada } },
    peso: { cargado: true, pesajes: PESAJES, pesadoHoy: true, valor: '', error: null, pesando: false, xpPesaje: 5, onValor: nada, onPesar: nada },
    ...cambios,
  };
}

// ── La barra de la lámina (muestra) ─────────────────────────────────

const PUNTOS: readonly { color: string; angulo: number; mio?: boolean }[] = [
  { color: modoAcento.iron, angulo: -90, mio: true },
  { color: modoAcento.focus, angulo: 0 },
  { color: modoAcento.work, angulo: 90 },
  { color: modoAcento.founder, angulo: 180 },
];

function BarraIronMuestra({ activa }: { activa: number }) {
  const pestanas: { glifo: Glifo; texto: string }[] = [
    { glifo: 'casa', texto: t('mundos:pestana.hoy') },
    { glifo: 'pesa', texto: t('mundos:pestana.entreno') },
    { glifo: 'plato', texto: t('mundos:pestana.dieta') },
    { glifo: 'chat', texto: t('mundos:pestana.coach') },
  ];
  const item = (i: number) => {
    const p = pestanas[i]!;
    const on = i === activa;
    return (
      <View key={p.texto} style={estilos.item}>
        <GlifoIron nombre={p.glifo} lado={px(19)} color={on ? A : C.apagado} />
        <Text style={[estilos.itemTexto, on && estilos.itemOn]}>{p.texto}</Text>
      </View>
    );
  };
  const lado = px(56);
  return (
    <View style={estilos.barra}>
      {item(0)}
      {item(1)}
      <View style={estilos.huecoEmblema}>
        <View style={[estilos.emblema, { width: lado, height: lado, borderRadius: lado / 2 }]}>
          <GlifoIron nombre="pesa" lado={px(24)} color={A} grosor={1.9} />
          <Svg width={lado + 18} height={lado + 18} style={estilos.puntos} viewBox="-37 -37 74 74">
            {PUNTOS.map((d) => (
              <Circle
                key={d.angulo}
                cx={34 * Math.cos((d.angulo * Math.PI) / 180)}
                cy={34 * Math.sin((d.angulo * Math.PI) / 180)}
                r={d.mio ? 3 : 2}
                fill={d.color}
                opacity={d.mio ? 1 : 0.55}
              />
            ))}
          </Svg>
        </View>
      </View>
      {item(2)}
      {item(3)}
    </View>
  );
}

function ConBarra({ activa, children }: { activa: number; children: ReactElement }) {
  return (
    <View style={estilos.lleno}>
      <View style={estilos.lleno}>{children}</View>
      <BarraIronMuestra activa={activa} />
    </View>
  );
}

function EntrenoInteractivo() {
  const [vista, setVista] = useState<VistaEntreno>('rutinas');
  return <EntrenoIronVista {...entrenoVista(vista, { onVista: setVista })} />;
}

function CatalogoDemo({ consulta = '', ms }: { consulta?: string; ms?: number }) {
  const elegido = ejercicioPorId('sentadilla-barra') ?? EJERCICIOS[0]!;
  const todas = entradasIron();
  const lista = (consulta ? todas.filter((e) => e.nombre.toLowerCase().includes(consulta.toLowerCase())) : todas.filter((e) => e.grupo === 'pierna'))
    .filter((e) => e.id !== elegido.id)
    .slice(0, 12);
  return (
    <CatalogoIronVista
      diaNombre="Pierna A"
      consulta={consulta}
      onConsulta={nada}
      grupos={['pierna', 'pecho', 'espalda', 'hombro', 'brazo', 'core']}
      grupo="pierna"
      onGrupo={nada}
      elegido={elegido}
      lista={lista}
      onElegir={nada}
      onAnadir={nada}
      onTecnica={nada}
      onVolver={nada}
      ms={ms}
    />
  );
}

const SENTADILLA = ejercicioPorId('sentadilla-barra') ?? EJERCICIOS[0]!;
const MS_FONDO = SENTADILLA.msFicha ?? SENTADILLA.poses[Math.floor(SENTADILLA.poses.length / 2)]!.ms;

export const DEMO: DemoPantalla = {
  id: 'iron',
  titulo: 'IRON',
  estados: [
    { id: 'inicio', titulo: 'Inicio (lámina)', render: () => <ConBarra activa={0}><InicioIronVista {...inicio()} /></ConBarra> },
    {
      id: 'inicio-cargando',
      titulo: 'Inicio · cargando',
      render: () => (
        <ConBarra activa={0}>
          <InicioIronVista
            {...inicio({
              entreno: entreno({ cargado: false }),
              pesos: { estado: 'cargando' },
              dieta: { estado: 'cargando' },
              coach: palabraCoach(entreno({ cargado: false })),
            })}
          />
        </ConBarra>
      ),
    },
    {
      id: 'inicio-hecho',
      titulo: 'Inicio · sesión hecha',
      render: () => (
        <ConBarra activa={0}>
          <InicioIronVista {...inicio({ entreno: entreno({ xpHecho: 75 }), coach: palabraCoach(entreno({ xpHecho: 75 })) })} />
        </ConBarra>
      ),
    },
    {
      id: 'inicio-descanso',
      titulo: 'Inicio · descanso',
      render: () => (
        <ConBarra activa={0}>
          <InicioIronVista {...inicio({ entreno: entreno({ hoyDia: 7 }), coach: palabraCoach(entreno({ hoyDia: 7 })) })} />
        </ConBarra>
      ),
    },
    {
      id: 'inicio-vacio',
      titulo: 'Inicio · sin rutina',
      render: () => (
        <ConBarra activa={0}>
          <InicioIronVista
            {...inicio({
              entreno: entreno({ dias: [], ejercicios: [] }),
              pesos: { estado: 'listo', filas: [] },
              dieta: { estado: 'listo', kcal: null, objetivoKcal: null, proteina: null, objetivoProteina: null, aguaMl: 0, objetivoAguaMl: 2000 },
              coach: palabraCoach(entreno({ dias: [], ejercicios: [] })),
            })}
          />
        </ConBarra>
      ),
    },
    { id: 'entreno', titulo: 'Entreno · rutinas', render: () => <ConBarra activa={1}><EntrenoInteractivo /></ConBarra> },
    { id: 'entreno-pesos', titulo: 'Entreno · pesos', render: () => <ConBarra activa={1}><EntrenoIronVista {...entrenoVista('pesos')} /></ConBarra> },
    { id: 'entreno-cardio', titulo: 'Entreno · cardio', render: () => <ConBarra activa={1}><EntrenoIronVista {...entrenoVista('cardio')} /></ConBarra> },
    {
      id: 'entreno-cardio-vacio',
      titulo: 'Entreno · cardio vacío',
      render: () => (
        <ConBarra activa={1}>
          <EntrenoIronVista {...entrenoVista('cardio', { cardio: { ...entrenoVista('cardio').cardio, sesiones: [], pesoKg: null } })} />
        </ConBarra>
      ),
    },
    { id: 'dieta', titulo: 'Dieta', render: () => <ConBarra activa={2}><DietaIronVista {...dieta()} /></ConBarra> },
    {
      id: 'dieta-libre',
      titulo: 'Dieta · comida libre y sin objetivo',
      render: () => (
        <ConBarra activa={2}>
          <DietaIronVista
            {...dieta({
              parte: { ...dieta().parte, objetivo: null, hoyLog: null, kcal: false },
              agua: { ...dieta().agua, ml: 750, libre: true },
              comidas: { ...dieta().comidas, hoy: [] },
              peso: { ...dieta().peso, pesajes: [], pesadoHoy: false },
            })}
          />
        </ConBarra>
      ),
    },
    { id: 'catalogo', titulo: 'Catálogo (lámina)', render: () => <ConBarra activa={1}><CatalogoDemo ms={MS_FONDO} /></ConBarra> },
    { id: 'catalogo-busqueda', titulo: 'Catálogo · búsqueda', render: () => <ConBarra activa={1}><CatalogoDemo consulta="press" ms={MS_FONDO} /></ConBarra> },
    {
      id: 'tecnica',
      titulo: 'Técnica con historial',
      render: () => (
        <TecnicaIronVista
          ejercicio={SENTADILLA}
          onVolver={nada}
          ms={MS_FONDO}
          historial={{
            estado: 'listo',
            resumen: {
              total: 9,
              mejor: { fecha: '2026-10-18', kg: 100, reps: 5, e1rm: 116.7 },
              sugerencia: { series: 4, reps: 5, kg: 102.5, motivo: 'subir', tope: 6 },
              sesiones: [
                { fecha: '2026-10-18', series: [{ kg: 100, reps: 5 }, { kg: 100, reps: 5 }, { kg: 100, reps: 5 }, { kg: 100, reps: 5 }] },
                { fecha: '2026-10-13', series: [{ kg: 97.5, reps: 5 }, { kg: 97.5, reps: 5 }, { kg: 97.5, reps: 5 }] },
                { fecha: '2026-10-06', series: [{ kg: 95, reps: 5 }, { kg: 95, reps: 5 }, { kg: 95, reps: 4 }] },
                { fecha: '2026-09-29', series: [{ kg: 92.5, reps: 5 }, { kg: 92.5, reps: 5 }] },
              ],
            },
          }}
        />
      ),
    },
    {
      id: 'salud',
      titulo: 'Sin consentimiento de salud',
      render: () => (
        <ConBarra activa={0}>
          <PuertaSaludIron cargando={false} error={null} borradoPendiente={false} onVolver={nada} onRevisar={nada} onReintentar={nada} onPerfil={nada} />
        </ConBarra>
      ),
    },
  ],
};

const estilos = StyleSheet.create({
  lleno: { flex: 1, backgroundColor: C.fondo },
  barra: {
    height: px(70),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: px(6),
    paddingBottom: px(10),
    borderTopWidth: 1,
    borderTopColor: C.barra,
    backgroundColor: C.fondo,
  },
  item: { width: px(52), alignItems: 'center', gap: px(3) },
  itemTexto: { fontFamily: F.sb, fontSize: fs(8.5), color: C.apagado },
  itemOn: { color: C.blanco },
  huecoEmblema: { width: px(56), alignItems: 'center' },
  emblema: {
    marginTop: -px(26),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.fondo,
    borderWidth: 2,
    borderColor: A,
    shadowColor: A,
    shadowOpacity: 0.6,
    shadowRadius: 11,
    shadowOffset: { width: 0, height: 0 },
  },
  puntos: { position: 'absolute' },
});
