// NIVL · Mundo IRON: la pestaña Entreno (pura). Tres vistas con el selector de
// chips de la lámina (`.rchips`):
//   · Rutinas: tu semana (letras de lunes a domingo), lo que prescribe el
//     coach para hoy y un día por tarjeta; el de hoy es la tarjeta héroe con
//     EMPEZAR ENTRENO. Editar, añadir y borrar abren las hojas de Gimnasio.
//   · Pesos: cada ejercicio con su gráfica grande, su 1RM estimado y el
//     récord (la versión completa de «Tus pesos y récords»).
//   · Cardio: 4 semanas de correr, bici, remo, nadar o HIIT con km, minutos,
//     ritmo y calorías estimadas, y «+ Registrar cardio» (la hoja de Cardio).
// Todo llega por props desde useEntrenoIron (o la galería).

import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ICONO, cifraCorta, etiquetaCardio, zonaCardio } from '@/components/cardio/tipos';
import type { AnuncioCardio } from '@/components/cardio/CardioVista';
import { kgTexto } from '@/components/iron/HistorialIron';
import { t } from '@/i18n';
import { capital, fechaCorta, miles, nombreDia } from '@/i18n/formato';
import { paceOf } from '@/lib/bodymath';
import type { CardioSession, Prescription } from '@/lib/bodywork';
import type { GymDay, GymExercise } from '@/lib/types';
import { ejerciciosDe, entrenoDeHoy, kcalSesion, minutosEntreno, resumenCardio } from './calculos';
import { GlifoIron } from './Glifos';
import { kgFila, seriesReps, subidaCorta } from './InicioIronVista';
import {
  BotonIron,
  ChipIron,
  CuadroIron,
  estilosIron,
  FilaIron,
  HuecoIron,
  LineaAncha,
  PantallaIron,
  RotuloIron,
  TarjetaIron,
} from './piezas';
import { A, acentoA, C, F, fs, mezcla, px } from './tema';
import type { EstadoPesosIron, PesoIron } from './usePesos';

export type VistaEntreno = 'rutinas' | 'pesos' | 'cardio';
export const VISTAS_ENTRENO: readonly VistaEntreno[] = ['rutinas', 'pesos', 'cardio'];

export interface RutinasIronProps {
  cargado: boolean;
  errorCarga: string | null;
  hoyDia: number;
  dias: GymDay[];
  ejercicios: GymExercise[];
  prescrito: Prescription[];
  /** XP ya pagado hoy por entrenar; null si aún no. */
  xpHecho: number | null;
  xpSesion: number;
  tecnicaDe?: (nombre: string) => (() => void) | undefined;
  acciones: {
    onEmpezar: () => void;
    onReintentar: () => void;
    onNuevoDia: () => void;
    onNuevoEjercicio: (dia: GymDay) => void;
    onEditarEjercicio: (dia: GymDay, ejercicio: GymExercise) => void;
    onBorrarDia: (dia: GymDay) => void;
    onBorrarEjercicio: (ejercicio: GymExercise) => void;
    onCatalogo: (dia: GymDay) => void;
  };
}

export interface CardioIronProps {
  cargado: boolean;
  errorCarga: string | null;
  /** «Hoy» (AAAA-MM-DD). */
  hoy: string;
  sesiones: CardioSession[];
  anuncio: AnuncioCardio | null;
  /** El último peso (para las calorías); null: se estima con el de referencia. */
  pesoKg: number | null;
  acciones: {
    onRegistrar: () => void;
    onBorrar: (s: CardioSession) => void;
    onReintentar: () => void;
    onCerrarAnuncio: () => void;
  };
}

export interface EntrenoIronVistaProps {
  cabecera: ReactNode;
  vista: VistaEntreno;
  onVista: (v: VistaEntreno) => void;
  rutinas: RutinasIronProps;
  pesos: EstadoPesosIron;
  cardio: CardioIronProps;
  /** Lo que flota (la hoja de Cardio va aparte, en la ruta). */
  overlay?: ReactNode;
}

const nombreDiaLargo = (iso: number) => capital(nombreDia(iso - 1));

// ── Rutinas ──────────────────────────────────────────────────────────

function Semana({ dias, hoyDia }: { dias: GymDay[]; hoyDia: number }) {
  const con = new Set(dias.map((d) => d.day_of_week));
  return (
    <View
      style={styles.semana}
      accessible
      accessibilityLabel={t('ironmundo:rutinas.semanaA11y', {
        dias: [1, 2, 3, 4, 5, 6, 7].filter((d) => con.has(d)).map(nombreDiaLargo).join(', ') || t('ironmundo:sinDato'),
      })}
    >
      {[1, 2, 3, 4, 5, 6, 7].map((d) => {
        const toca = con.has(d);
        const hoy = d === hoyDia;
        return (
          <View key={d} style={styles.semanaDia}>
            <View style={[styles.semanaBola, toca && styles.semanaToca, hoy && styles.semanaHoy]}>
              <Text style={[styles.semanaLetra, toca && styles.semanaLetraToca]} maxFontSizeMultiplier={1}>
                {nombreDia(d - 1, 'letra')}
              </Text>
            </View>
            <View style={[styles.semanaPunto, hoy && styles.semanaPuntoHoy]} />
          </View>
        );
      })}
    </View>
  );
}

function TarjetaDia({ dia, r, esHoy }: { dia: GymDay; r: RutinasIronProps; esHoy: boolean }) {
  const lista = ejerciciosDe(dia.id, r.ejercicios);
  const series = lista.reduce((s, e) => s + Math.max(1, e.sets), 0);
  const hecho = esHoy && r.xpHecho !== null;
  return (
    <TarjetaIron heroe={esHoy}>
      <RotuloIron
        texto={nombreDiaLargo(dia.day_of_week)}
        em={hecho ? t('ironmundo:xp', { xp: r.xpHecho ?? 0 }) : esHoy ? t('ironmundo:rutinas.hoy') : undefined}
      />
      <View style={styles.diaTitulo}>
        <Text style={[estilosIron.titulo, styles.flex]} accessibilityRole="header" numberOfLines={2} maxFontSizeMultiplier={1.35}>
          {dia.name}
        </Text>
        <Pressable
          onPress={() => r.acciones.onBorrarDia(dia)}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={t('ironmundo:rutinas.borrarDiaA11y', { dia: dia.name })}
          style={({ pressed }) => [styles.papelera, pressed && styles.pulsado]}
        >
          <Ionicons name="trash-outline" size={px(15)} color={C.mudo} />
        </Pressable>
      </View>
      <Text style={estilosIron.meta} maxFontSizeMultiplier={1.35}>
        {lista.length > 0
          ? t('ironmundo:entreno.meta', { count: lista.length, series, minutos: minutosEntreno(series) })
          : t('ironmundo:entreno.diaVacio')}
      </Text>
      {lista.length > 0 ? (
        <View style={styles.filas}>
          {lista.map((e, i) => (
            <FilaIron
              key={e.id}
              primera={i === 0}
              onPress={() => r.acciones.onEditarEjercicio(dia, e)}
              onLongPress={() => r.acciones.onBorrarEjercicio(e)}
              accessibilityLabel={t('ironmundo:rutinas.ejercicioA11y', {
                nombre: e.name,
                series: e.sets,
                reps: e.reps,
                kg: kgFila(e.weight),
              })}
              accessibilityActions={[{ name: 'longpress', label: t('ironmundo:rutinas.borrarEjercicio') }]}
              onAccessibilityAction={(ev) => {
                if (ev.nativeEvent.actionName === 'longpress') r.acciones.onBorrarEjercicio(e);
              }}
            >
              <Text style={estilosIron.filaNombre} numberOfLines={1} maxFontSizeMultiplier={1.35}>
                {e.name}
              </Text>
              <Text style={[estilosIron.filaSerie, styles.colSerie]} maxFontSizeMultiplier={1.35}>
                {seriesReps(e.sets, e.reps)}
              </Text>
              <Text style={[estilosIron.filaKg, styles.colKg]} maxFontSizeMultiplier={1.35}>
                {kgFila(e.weight)}
              </Text>
            </FilaIron>
          ))}
        </View>
      ) : null}
      <View style={styles.botones}>
        <BotonIron fantasma fino icono="mas" titulo={t('ironmundo:rutinas.ejercicio')} onPress={() => r.acciones.onNuevoEjercicio(dia)} style={styles.flex} />
        <BotonIron fantasma fino titulo={t('ironmundo:catalogo.boton')} onPress={() => r.acciones.onCatalogo(dia)} style={styles.flex} />
      </View>
      {esHoy && !hecho && lista.length > 0 ? <BotonIron icono="pesa" titulo={t('ironmundo:entreno.empezar')} onPress={r.acciones.onEmpezar} /> : null}
    </TarjetaIron>
  );
}

function Prescripcion({ r }: { r: RutinasIronProps }) {
  const hoy = entrenoDeHoy({ dias: r.dias, ejercicios: r.ejercicios, prescrito: r.prescrito, hoyDia: r.hoyDia });
  if (!hoy.delCoach) return null;
  return (
    <TarjetaIron heroe>
      <RotuloIron texto={t('ironmundo:rutinas.prescritoRotulo')} em={t('ironmundo:hastaXp', { xp: r.xpSesion })} />
      <Text style={estilosIron.meta} maxFontSizeMultiplier={1.35}>
        {t('ironmundo:entreno.meta', { count: hoy.filas.length, series: hoy.series, minutos: hoy.minutos })}
      </Text>
      <View style={styles.filas}>
        {r.prescrito.map((p, i) => (
          <FilaIron key={p.id} primera={i === 0} onPress={r.tecnicaDe?.(p.exercise_name)}>
            <View style={styles.flex}>
              <Text style={estilosIron.filaNombre} numberOfLines={1} maxFontSizeMultiplier={1.35}>
                {p.exercise_name}
              </Text>
              {p.notes ? (
                <Text style={estilosIron.detalle} numberOfLines={2} maxFontSizeMultiplier={1.35}>
                  {p.notes}
                </Text>
              ) : null}
            </View>
            <Text style={[estilosIron.filaSerie, styles.colSerie]} maxFontSizeMultiplier={1.35}>
              {seriesReps(p.sets, p.reps)}
            </Text>
            <Text style={[estilosIron.filaKg, styles.colKg]} maxFontSizeMultiplier={1.35}>
              {kgFila(p.weight)}
            </Text>
          </FilaIron>
        ))}
      </View>
      {r.xpHecho === null ? <BotonIron icono="pesa" titulo={t('ironmundo:entreno.empezar')} onPress={r.acciones.onEmpezar} /> : null}
    </TarjetaIron>
  );
}

function Rutinas({ r }: { r: RutinasIronProps }) {
  if (!r.cargado) {
    return r.errorCarga ? (
      <TarjetaIron>
        <Text style={estilosIron.cuerpo} maxFontSizeMultiplier={1.6}>
          {r.errorCarga}
        </Text>
        <BotonIron fantasma fino titulo={t('ironmundo:reintentar')} onPress={r.acciones.onReintentar} />
      </TarjetaIron>
    ) : (
      <View style={styles.pila} accessibilityRole="progressbar" accessibilityLabel={t('ironmundo:entreno.cargandoA11y')}>
        <HuecoIron alto={px(60)} />
        <HuecoIron alto={px(200)} />
        <HuecoIron alto={px(160)} />
      </View>
    );
  }
  // Desde hoy en adelante: lo que toca primero, arriba.
  const orden = [...r.dias].sort((a, b) => ((a.day_of_week - r.hoyDia + 7) % 7) - ((b.day_of_week - r.hoyDia + 7) % 7));
  return (
    <View style={styles.pila}>
      <View>
        <RotuloIron
          seccion
          texto={t('ironmundo:rutinas.semana')}
          em={t('ironmundo:rutinas.nuevoDia')}
          onEm={r.acciones.onNuevoDia}
          emA11y={t('ironmundo:rutinas.nuevoDiaA11y')}
        />
        <TarjetaIron>
          <Semana dias={r.dias} hoyDia={r.hoyDia} />
        </TarjetaIron>
      </View>
      <Prescripcion r={r} />
      {r.dias.length === 0 ? (
        <TarjetaIron heroe>
          <RotuloIron texto={t('ironmundo:rutinas.rotulo')} />
          <Text style={estilosIron.titulo} maxFontSizeMultiplier={1.35}>
            {t('ironmundo:entreno.sinRutinaTitulo')}
          </Text>
          <Text style={estilosIron.meta} maxFontSizeMultiplier={1.6}>
            {t('ironmundo:entreno.sinRutinaMeta')}
          </Text>
          <BotonIron icono="mas" titulo={t('ironmundo:entreno.crearRutina')} onPress={r.acciones.onNuevoDia} />
        </TarjetaIron>
      ) : (
        orden.map((d) => <TarjetaDia key={d.id} dia={d} r={r} esHoy={d.day_of_week === r.hoyDia} />)
      )}
    </View>
  );
}

// ── Pesos ────────────────────────────────────────────────────────────

function TarjetaPesoGrande({ p }: { p: PesoIron }) {
  const min = p.serie.length > 0 ? Math.min(...p.serie) : null;
  const max = p.serie.length > 0 ? Math.max(...p.serie) : null;
  return (
    <TarjetaIron
      heroe={p.record}
      onPress={p.onTecnica}
      accessibilityLabel={[
        t('ironmundo:pesos.a11y', { nombre: p.nombre, kg: kgTexto(p.kg) }),
        p.record ? t('ironmundo:pesos.record') : null,
        p.subida !== null ? subidaCorta(p.subida) : null,
        p.e1rm !== null ? t('ironmundo:pesos.e1rm', { kg: kgTexto(p.e1rm) }) : null,
      ]
        .filter(Boolean)
        .join('. ')}
    >
      <View style={styles.pesoCabeza}>
        <View style={styles.flex}>
          <Text style={styles.pesoNombre} numberOfLines={1} maxFontSizeMultiplier={1.35}>
            {p.nombre}
          </Text>
          <Text style={styles.pesoKg} maxFontSizeMultiplier={1}>
            {kgTexto(p.kg)}
            <Text style={styles.pesoUnidad}>{` ${t('ironmundo:unidadKg')}`}</Text>
          </Text>
        </View>
        <View style={styles.pesoDerecha}>
          {p.record ? (
            <Text style={estilosIron.etiqueta} maxFontSizeMultiplier={1.2}>
              {t('ironmundo:pesos.record').toUpperCase()}
            </Text>
          ) : null}
          {p.subida !== null ? (
            <Text style={estilosIron.delta} maxFontSizeMultiplier={1.2}>
              {subidaCorta(p.subida)}
            </Text>
          ) : null}
        </View>
      </View>
      <View style={styles.pesoGrafica}>
        <View style={styles.flex}>
          <LineaAncha puntos={p.serie} alto={px(56)} grosor={2} />
        </View>
        {min !== null && max !== null && max !== min ? (
          <View style={styles.pesoEjes} pointerEvents="none">
            <Text style={styles.pesoEje} maxFontSizeMultiplier={1}>
              {kgTexto(max)}
            </Text>
            <Text style={styles.pesoEje} maxFontSizeMultiplier={1}>
              {kgTexto(min)}
            </Text>
          </View>
        ) : null}
      </View>
      <Text style={estilosIron.meta} maxFontSizeMultiplier={1.35}>
        {[
          p.e1rm !== null ? t('ironmundo:pesos.e1rm', { kg: kgTexto(p.e1rm) }) : null,
          t('ironmundo:pesos.sesiones', { count: p.sesiones }),
          t('ironmundo:pesos.ultima', { fecha: fechaCorta(p.ultimaFecha) }),
        ]
          .filter(Boolean)
          .join(' · ')}
      </Text>
    </TarjetaIron>
  );
}

function Pesos({ estado }: { estado: EstadoPesosIron }) {
  if (estado.estado === 'cargando') {
    return (
      <View style={styles.pila} accessibilityRole="progressbar" accessibilityLabel={t('ironmundo:pesos.cargandoA11y')}>
        <HuecoIron alto={px(140)} />
        <HuecoIron alto={px(140)} />
      </View>
    );
  }
  if (estado.estado === 'error') {
    return (
      <TarjetaIron>
        <Text style={estilosIron.cuerpo} maxFontSizeMultiplier={1.6}>
          {estado.mensaje}
        </Text>
        <BotonIron fantasma fino titulo={t('ironmundo:reintentar')} onPress={estado.reintentar} />
      </TarjetaIron>
    );
  }
  const records = estado.filas.filter((f) => f.record).length;
  return (
    <View style={styles.pila}>
      <RotuloIron
        seccion
        texto={t('ironmundo:pesos.rotulo')}
        em={estado.filas.length > 0 ? t('ironmundo:pesos.records', { count: records }) : undefined}
      />
      {estado.filas.length === 0 ? (
        <TarjetaIron>
          <Text style={estilosIron.cuerpo} maxFontSizeMultiplier={1.6}>
            {t('ironmundo:pesos.vacio')}
          </Text>
        </TarjetaIron>
      ) : (
        estado.filas.map((p) => <TarjetaPesoGrande key={p.clave} p={p} />)
      )}
    </View>
  );
}

// ── Cardio ───────────────────────────────────────────────────────────

function Cifra({ valor, rotulo }: { valor: string; rotulo: string }) {
  return (
    <View style={styles.cifra} accessible accessibilityLabel={t('ironmundo:par', { a: rotulo, b: valor })}>
      <Text style={styles.cifraValor} numberOfLines={1} adjustsFontSizeToFit maxFontSizeMultiplier={1}>
        {valor}
      </Text>
      <Text style={styles.cifraRotulo} numberOfLines={1} maxFontSizeMultiplier={1.2}>
        {rotulo}
      </Text>
    </View>
  );
}

function Semanas({ minutos }: { minutos: number[] }) {
  const tope = Math.max(...minutos, 1);
  return (
    <View
      style={styles.barras}
      accessible
      accessibilityLabel={t('ironmundo:cardio.semanasA11y', { minutos: minutos.map((m) => cifraCorta(m, 0)).join(', ') })}
    >
      {minutos.map((m, i) => (
        <View key={i} style={styles.barraCol}>
          <Text style={styles.barraValor} maxFontSizeMultiplier={1}>
            {m > 0 ? cifraCorta(m, 0) : ''}
          </Text>
          <View style={styles.barraPista}>
            <View style={[styles.barraRelleno, { height: `${Math.max(m > 0 ? 6 : 0, Math.round((m / tope) * 100))}%` }, i === 3 && styles.barraActual]} />
          </View>
          <Text style={[styles.barraRotulo, i === 3 && styles.barraRotuloActual]} maxFontSizeMultiplier={1}>
            {i === 3 ? t('ironmundo:cardio.estaSemana') : t('ironmundo:cardio.haceSemanas', { count: 3 - i })}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** Nadando, el ritmo se da por 100 m: 1,5 km en 40 min → «2:40». */
export function ritmoPor100(km: number, minutos: number): string {
  const seg = Math.round((minutos * 60) / (km * 10));
  return `${Math.floor(seg / 60)}:${String(seg % 60).padStart(2, '0')}`;
}

function FilaCardio({ s, primera, pesoKg, onBorrar }: { s: CardioSession; primera: boolean; pesoKg: number | null; onBorrar: () => void }) {
  const ritmo = paceOf(s.distance_km, s.duration_min);
  const kcal = kcalSesion(s, pesoKg);
  const cifras = [
    s.distance_km ? t('ironmundo:cardio.km', { km: cifraCorta(Number(s.distance_km)) }) : null,
    t('ironmundo:cardio.min', { min: cifraCorta(Number(s.duration_min), 1) }),
    s.kind === 'nadar' && s.distance_km && Number(s.duration_min) > 0
      ? t('ironmundo:cardio.ritmo100', { ritmo: ritmoPor100(Number(s.distance_km), Number(s.duration_min)) })
      : s.kind === 'bici' && s.distance_km && Number(s.duration_min) > 0
      ? t('ironmundo:cardio.velocidad', { kmh: cifraCorta((Number(s.distance_km) * 60) / Number(s.duration_min), 1) })
      : ritmo
        ? t('ironmundo:cardio.ritmo', { ritmo })
        : null,
    kcal !== null ? t('ironmundo:cardio.kcal', { kcal: miles(kcal) }) : null,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <FilaIron
      primera={primera}
      onLongPress={onBorrar}
      style={styles.filaCardio}
      accessibilityLabel={t('ironmundo:cardio.filaA11y', { tipo: etiquetaCardio(s.kind), zona: zonaCardio(s.zone), cifras, fecha: fechaCorta(s.date) })}
      accessibilityActions={[{ name: 'longpress', label: t('ironmundo:cardio.borrar') }]}
      onAccessibilityAction={(e) => {
        if (e.nativeEvent.actionName === 'longpress') onBorrar();
      }}
    >
      <CuadroIron lado={px(30)} radio={px(8)}>
        <Ionicons name={ICONO[s.kind]} size={px(15)} color={A} />
      </CuadroIron>
      <View style={styles.flex}>
        <View style={styles.cardioTitulo}>
          <Text style={estilosIron.filaNombre} numberOfLines={1} maxFontSizeMultiplier={1.35}>
            {etiquetaCardio(s.kind)}
          </Text>
          <Text style={styles.zona} maxFontSizeMultiplier={1.2}>
            {zonaCardio(s.zone)}
          </Text>
        </View>
        <Text style={estilosIron.filaSerie} numberOfLines={2} maxFontSizeMultiplier={1.35}>
          {cifras}
        </Text>
      </View>
      <View style={styles.cardioDerecha}>
        <Text style={estilosIron.filaSerie} maxFontSizeMultiplier={1.35}>
          {fechaCorta(s.date)}
        </Text>
        {s.xp_awarded > 0 ? (
          <Text style={estilosIron.delta} maxFontSizeMultiplier={1.35}>
            {t('ironmundo:xp', { xp: s.xp_awarded })}
          </Text>
        ) : null}
      </View>
    </FilaIron>
  );
}

function Cardio({ c }: { c: CardioIronProps }) {
  if (!c.cargado) {
    return c.errorCarga ? (
      <TarjetaIron>
        <Text style={estilosIron.cuerpo} maxFontSizeMultiplier={1.6}>
          {c.errorCarga}
        </Text>
        <BotonIron fantasma fino titulo={t('ironmundo:reintentar')} onPress={c.acciones.onReintentar} />
      </TarjetaIron>
    ) : (
      <View style={styles.pila} accessibilityRole="progressbar" accessibilityLabel={t('ironmundo:cardio.cargandoA11y')}>
        <HuecoIron alto={px(230)} />
        <HuecoIron alto={px(120)} />
      </View>
    );
  }
  const r = resumenCardio(c.sesiones, c.hoy, c.pesoKg);
  const recientes = [...c.sesiones].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return (
    <View style={styles.pila}>
      <TarjetaIron heroe>
        <RotuloIron texto={t('ironmundo:cardio.rotulo')} em={t('ironmundo:cardio.sesiones', { count: r.sesiones })} />
        <Text style={estilosIron.titulo} maxFontSizeMultiplier={1.35}>
          {t('ironmundo:cardio.titulo')}
        </Text>
        <View style={styles.cifras}>
          <Cifra valor={cifraCorta(r.km, 1)} rotulo={t('ironmundo:cardio.kmRotulo')} />
          <Cifra valor={cifraCorta(r.minutos, 0)} rotulo={t('ironmundo:cardio.minRotulo')} />
          <Cifra valor={r.kcal !== null ? miles(r.kcal) : t('ironmundo:sinDato')} rotulo={t('ironmundo:cardio.kcalRotulo')} />
        </View>
        <Semanas minutos={r.semanas} />
        <Text style={estilosIron.detalle} maxFontSizeMultiplier={1.6}>
          {c.pesoKg !== null ? t('ironmundo:cardio.estimacion', { kg: kgTexto(c.pesoKg) }) : t('ironmundo:cardio.estimacionReferencia')}
        </Text>
        <BotonIron icono="mas" titulo={t('ironmundo:cardio.registrar')} onPress={c.acciones.onRegistrar} />
      </TarjetaIron>

      {c.anuncio ? (
        <TarjetaIron onPress={c.acciones.onCerrarAnuncio} accessibilityLabel={c.anuncio.texto}>
          <RotuloIron texto={t('ironmundo:cardio.anuncio')} em={t('ironmundo:cerrar')} />
          <Text style={[estilosIron.cuerpo, styles.anuncio]} maxFontSizeMultiplier={1.6}>
            {c.anuncio.texto}
          </Text>
        </TarjetaIron>
      ) : null}

      <View>
        <RotuloIron seccion texto={t('ironmundo:cardio.lista')} />
        <TarjetaIron>
          {recientes.length === 0 ? (
            <Text style={estilosIron.cuerpo} maxFontSizeMultiplier={1.6}>
              {t('ironmundo:cardio.vacio')}
            </Text>
          ) : (
            recientes.map((s, i) => <FilaCardio key={s.id} s={s} primera={i === 0} pesoKg={c.pesoKg} onBorrar={() => c.acciones.onBorrar(s)} />)
          )}
        </TarjetaIron>
      </View>
    </View>
  );
}

// ── Pantalla ─────────────────────────────────────────────────────────

export function EntrenoIronVista({ cabecera, vista, onVista, rutinas, pesos, cardio, overlay }: EntrenoIronVistaProps) {
  return (
    <PantallaIron overlay={overlay}>
      {cabecera}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} accessibilityRole="tablist">
        {VISTAS_ENTRENO.map((v) => (
          <ChipIron key={v} pestana texto={t(`ironmundo:entreno.vista.${v}`)} activo={v === vista} onPress={() => onVista(v)} />
        ))}
      </ScrollView>
      {vista === 'rutinas' ? <Rutinas r={rutinas} /> : vista === 'pesos' ? <Pesos estado={pesos} /> : <Cardio c={cardio} />}
      <View style={styles.pie}>
        <GlifoIron nombre="pesa" lado={px(14)} color={C.apagado} />
      </View>
    </PantallaIron>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  pila: { gap: px(7) },
  chips: { gap: px(6), paddingVertical: px(2) },
  filas: { marginTop: px(6) },
  colSerie: { width: px(44), textAlign: 'center' },
  colKg: { minWidth: px(60), textAlign: 'right' },
  botones: { flexDirection: 'row', gap: px(7) },
  diaTitulo: { flexDirection: 'row', alignItems: 'flex-start', gap: px(8) },
  papelera: { padding: px(4), marginTop: px(4) },
  pulsado: { opacity: 0.6 },
  semana: { flexDirection: 'row', justifyContent: 'space-between' },
  semanaDia: { alignItems: 'center', gap: px(4) },
  semanaBola: {
    width: px(30),
    height: px(30),
    borderRadius: px(15),
    borderWidth: 1,
    borderColor: C.borde,
    alignItems: 'center',
    justifyContent: 'center',
  },
  semanaToca: { backgroundColor: mezcla(0.16, C.tarjeta), borderColor: acentoA(0.6) },
  semanaHoy: { borderColor: A, borderWidth: 2 },
  semanaLetra: { fontFamily: F.b, fontSize: fs(10), color: C.apagado },
  semanaLetraToca: { color: C.blanco },
  semanaPunto: { width: 4, height: 4, borderRadius: 2, backgroundColor: 'transparent' },
  semanaPuntoHoy: { backgroundColor: A },
  pesoCabeza: { flexDirection: 'row', alignItems: 'flex-start', gap: px(8) },
  pesoNombre: { fontFamily: F.sb, fontSize: fs(11), color: C.meta },
  pesoKg: { fontFamily: F.xb, fontSize: fs(26), color: C.blanco, marginTop: px(2) },
  pesoUnidad: { fontFamily: F.sb, fontSize: fs(11), color: C.mudo },
  pesoDerecha: { alignItems: 'flex-end', gap: px(4), paddingTop: px(2) },
  pesoGrafica: { flexDirection: 'row', gap: px(8), marginTop: px(8), marginBottom: px(4) },
  pesoEjes: { height: px(56), justifyContent: 'space-between', alignItems: 'flex-end', minWidth: px(26) },
  pesoEje: { fontFamily: F.sb, fontSize: fs(8), color: C.apagado },
  cifras: { flexDirection: 'row', gap: px(7), marginTop: px(8) },
  cifra: { flex: 1, minWidth: 0, backgroundColor: C.tarjeta, borderRadius: px(12), borderWidth: 1, borderColor: C.filete, padding: px(8) },
  cifraValor: { fontFamily: F.xb, fontSize: fs(19), color: C.blanco },
  cifraRotulo: { fontFamily: F.b, fontSize: fs(8), letterSpacing: fs(8) * 0.14, color: C.mudo, textTransform: 'uppercase', marginTop: px(1) },
  barras: { flexDirection: 'row', gap: px(8), height: px(96), marginTop: px(10), marginBottom: px(6) },
  barraCol: { flex: 1, alignItems: 'center', gap: px(3) },
  barraValor: { fontFamily: F.b, fontSize: fs(8.5), color: C.meta, minHeight: fs(8.5) * 1.3 },
  barraPista: { flex: 1, width: '70%', backgroundColor: C.pista, borderRadius: px(6), justifyContent: 'flex-end', overflow: 'hidden' },
  barraRelleno: { width: '100%', backgroundColor: acentoA(0.55), borderRadius: px(6) },
  barraActual: { backgroundColor: A },
  barraRotulo: { fontFamily: F.sb, fontSize: fs(8), color: C.apagado },
  barraRotuloActual: { color: C.blanco },
  anuncio: { marginTop: px(4) },
  filaCardio: { paddingVertical: px(7) },
  cardioTitulo: { flexDirection: 'row', alignItems: 'center', gap: px(6) },
  zona: {
    fontFamily: F.xb,
    fontSize: fs(7.5),
    letterSpacing: fs(7.5) * 0.12,
    color: A,
    borderWidth: 1,
    borderColor: acentoA(0.5),
    borderRadius: px(4),
    paddingHorizontal: px(4),
    paddingVertical: px(1),
    overflow: 'hidden',
  },
  cardioDerecha: { alignItems: 'flex-end', gap: px(2) },
  pie: { alignItems: 'center', paddingVertical: px(10) },
});
