// NIVL · Gimnasio: la vista (patrón L-RADICAL §C, FASE3 Lote E1). Pura: todo
// llega por props desde useGym (o desde la galería con datos de mentira) y no
// carga nada.
//
// De arriba abajo: el encabezado grabado («Cuerpo» / «GIMNASIO», acción «Nuevo
// día» en contorno, meandro), la franja Días/semana · Ejercicios · XP, lo
// prescrito por el sistema (filas), la sesión de hoy y la rutina semanal.
// Sesión de hoy según el estado:
//   · rutina hoy → TarjetaArena piedra con remaches y zócalo con los
//     ejercicios; INVERSIÓN «Entrenar · +N XP».
//   · entrenando → SesionEnCurso; INVERSIÓN «Terminar sesión» (la otra no está).
//   · hecha → TarjetaArena grano «Sesión registrada» con el XP del día.
//   · descanso → TarjetaArena contorno con la línea del día y secondary.
// Sin rutina, una sola llamada a crear el primer día (en la rutina).
// iPad (medium en adelante y texto ≤ 1,35): Sesión | Rutina a dos columnas;
// entrenando, una columna de 640.

import type { ReactNode } from 'react';
import { StyleSheet, Text, View, useWindowDimensions, type ViewStyle } from 'react-native';
import {
  CargaArena,
  EncabezadoArena,
  Entrada,
  ErrorSistema,
  FranjaCifras,
  TarjetaArena,
  type Cifra,
} from '@/components/arena';
import { DescargoSalud } from '@/components/DescargoSalud';
import { Button, Check, Screen, Section } from '@/components/ui';
import { ink, space, type as tipo } from '@/design/tokens';
import { useAnchoUtil, useSizeClass } from '@/design/useSizeClass';
import type { Prescription } from '@/lib/bodywork';
import { GYM_SESSION_XP } from '@/lib/game';
import type { GymDay, GymExercise, GymSession } from '@/lib/types';
import { DAY_NAMES, FilaEjercicio, RutinaSemanal, cargaTexto } from './RutinaSemanal';
import { SesionEnCurso, type LiftInput, type SerieInput } from './SesionEnCurso';

export interface GymVistaProps {
  /** Hasta la primera carga buena se pintan huecos. */
  cargado: boolean;
  /** Fallo de la última carga, ya escrito para el usuario. */
  errorCarga: string | null;
  /** Día ISO de hoy (1 lunes … 7 domingo). */
  hoyDia: number;
  dias: GymDay[];
  ejercicios: GymExercise[];
  sesionHoy: GymSession | null;
  /** XP que han pagado hoy las misiones enlazadas al gimnasio. */
  xpMisionHoy: number;
  prescrito: Prescription[];
  entrenando: boolean;
  series: LiftInput[];
  notas: string;
  fotoLista: boolean;
  /** Guardando la sesión: el botón espera. */
  ocupado: boolean;
  acciones: {
    onVolver: () => void;
    onReintentar: () => void;
    onNuevoDia: () => void;
    onEntrenar: () => void;
    onTerminar: () => void;
    onCambiarSerie: (iEj: number, iSerie: number, campo: keyof SerieInput, valor: string) => void;
    onAnadirSerie: (iEj: number) => void;
    onQuitarSerie: (iEj: number, iSerie: number) => void;
    onNotas: (v: string) => void;
    onFoto: () => void;
    onNuevoEjercicio: (dia: GymDay) => void;
    onEditarEjercicio: (dia: GymDay, ejercicio: GymExercise) => void;
    onBorrarDia: (dia: GymDay) => void;
    onBorrarEjercicio: (ejercicio: GymExercise) => void;
  };
}

/** Con el texto más grande que esto, una sola columna aunque sea un iPad. */
const ESCALA_DOS_COLUMNAS = 1.35;
/** Tope del contenido a dos columnas (márgenes incluidos). */
const ANCHO_DOS_COLUMNAS = 1152;
/** Entrenando, la tabla de series no pasa de aquí. */
const ANCHO_ENTRENO = 640;

export function GymVista({
  cargado,
  errorCarga,
  hoyDia,
  dias,
  ejercicios,
  sesionHoy,
  xpMisionHoy,
  prescrito,
  entrenando,
  series,
  notas,
  fotoLista,
  ocupado,
  acciones,
}: GymVistaProps) {
  const { sizeClass, gutter } = useSizeClass();
  const { fontScale } = useWindowDimensions();
  const hueco = useAnchoUtil();
  const dosColumnas = sizeClass !== 'compact' && fontScale <= ESCALA_DOS_COLUMNAS && !entrenando;

  const planHoy = dias.find((d) => d.day_of_week === hoyDia);
  const ejerciciosHoy = planHoy ? ejercicios.filter((e) => e.gym_day_id === planHoy.id) : [];
  const nombreHoy = DAY_NAMES[hoyDia - 1] ?? '';
  // Lo ganado hoy por entrenar: lo del módulo más lo de la misión enlazada.
  const xpHoy = (sesionHoy?.xp_awarded ?? 0) + xpMisionHoy;

  const subtitulo = !cargado
    ? undefined
    : sesionHoy
      ? `Sesión registrada. +${xpHoy} XP hoy.`
      : entrenando && planHoy
        ? `${planHoy.name}, serie a serie.`
        : planHoy
          ? `Hoy toca ${planHoy.name}. ${ejerciciosHoy.length} ${ejerciciosHoy.length === 1 ? 'ejercicio' : 'ejercicios'}.`
          : `Hoy, ${nombreHoy.toLowerCase()}, no hay rutina asignada.`;

  const cifras: Cifra[] = [
    { valor: dias.length, rotulo: 'Días/semana' },
    { valor: ejercicios.length, rotulo: 'Ejercicios' },
    sesionHoy
      ? { valor: xpHoy, rotulo: 'XP de hoy' }
      : { valor: GYM_SESSION_XP, rotulo: 'XP en juego' },
  ];

  const contenido: ViewStyle | undefined = entrenando
    ? { maxWidth: ANCHO_ENTRENO + 2 * gutter }
    : dosColumnas
      ? { maxWidth: Math.min(hueco, ANCHO_DOS_COLUMNAS) }
      : undefined;

  const encabezado = (
    <Entrada indice={0}>
      <EncabezadoArena
        onVolver={acciones.onVolver}
        eyebrow="Cuerpo"
        titulo="Gimnasio"
        subtitulo={subtitulo}
        accion={{ icono: 'add', etiqueta: 'Nuevo día', onPress: acciones.onNuevoDia }}
        meandro
      />
    </Entrada>
  );

  if (!cargado) {
    return (
      <Screen contentStyle={contenido}>
        {encabezado}
        {errorCarga ? (
          <ErrorSistema mensaje={errorCarga} onReintentar={acciones.onReintentar} />
        ) : (
          <CargaArena etiqueta="Cargando el gimnasio" formas={['franja', 'tarjeta', 'rotulo', 'filas']} />
        )}
      </Screen>
    );
  }

  const prescritoBloque =
    prescrito.length > 0 ? (
      <Section title="Prescrito por el sistema" meta={`${prescrito.length}`}>
        {prescrito.map((p, i) => (
          <FilaEjercicio
            key={p.id}
            primera={i === 0}
            ordinal={i + 1}
            nombre={p.exercise_name}
            carga={cargaTexto(p.sets, p.reps, p.weight ? p.weight : null)}
            detalle={[p.rpe_target ? `RPE ${p.rpe_target}` : null, p.notes].filter(Boolean).join(' · ') || null}
          />
        ))}
      </Section>
    ) : null;

  let sesion: ReactNode;
  if (sesionHoy) {
    sesion = (
      <TarjetaArena variante="grano" rotulo="Sesión registrada" meta={`+${xpHoy} XP`}>
        <View style={styles.hecho}>
          <Check checked />
          <Text style={styles.hechoTexto} maxFontSizeMultiplier={1.6}>
            {xpMisionHoy > 0
              ? `+${xpHoy} XP hoy: ${xpMisionHoy} de la misión enlazada${sesionHoy.xp_awarded > 0 ? ` y ${sesionHoy.xp_awarded} a FUE` : ''}.`
              : `+${sesionHoy.xp_awarded} XP a FUE. FUE crece.`}
          </Text>
        </View>
      </TarjetaArena>
    );
  } else if (!planHoy) {
    sesion =
      dias.length === 0 ? null : (
        <TarjetaArena variante="contorno" rotulo="Descanso">
          <Text style={styles.linea} maxFontSizeMultiplier={1.6}>
            Hoy, {nombreHoy.toLowerCase()}, no toca rutina. Si quieres entrenar los {nombreHoy.toLowerCase()}, añade un día.
          </Text>
          <Button
            title="Añadir día"
            variant="secondary"
            size="sm"
            icon="add"
            onPress={acciones.onNuevoDia}
            style={styles.botonLinea}
          />
        </TarjetaArena>
      );
  } else if (!entrenando) {
    sesion = (
      <View style={styles.pila}>
        <TarjetaArena
          variante="piedra"
          remaches
          zocalo
          rotulo={planHoy.name}
          meta={`${ejerciciosHoy.length} ${ejerciciosHoy.length === 1 ? 'ejercicio' : 'ejercicios'}`}
        >
          {ejerciciosHoy.length === 0 ? (
            <Text style={styles.linea} maxFontSizeMultiplier={1.6}>
              Sin ejercicios en {planHoy.name}. Añádelos en la rutina semanal.
            </Text>
          ) : (
            ejerciciosHoy.map((e, i) => (
              <FilaEjercicio
                key={e.id}
                primera={i === 0}
                ordinal={i + 1}
                nombre={e.name}
                carga={cargaTexto(e.sets, e.reps, e.weight)}
              />
            ))
          )}
        </TarjetaArena>
        <Button title={`Entrenar · +${GYM_SESSION_XP} XP`} size="lg" icon="barbell-outline" onPress={acciones.onEntrenar} />
      </View>
    );
  } else {
    sesion = (
      <View style={styles.pila}>
        <SesionEnCurso
          series={series}
          notas={notas}
          fotoLista={fotoLista}
          onCambiarSerie={acciones.onCambiarSerie}
          onAnadirSerie={acciones.onAnadirSerie}
          onQuitarSerie={acciones.onQuitarSerie}
          onNotas={acciones.onNotas}
          onFoto={acciones.onFoto}
        />
        <Button title="Terminar sesión" size="lg" icon="checkmark" onPress={acciones.onTerminar} loading={ocupado} />
      </View>
    );
  }

  const sesionBloque = sesion ? (
    <Section title="Sesión de hoy" meta={nombreHoy}>
      {sesion}
    </Section>
  ) : null;

  const rutina = (
    <Section title="Rutina semanal" meta={dias.length > 0 ? `${dias.length}` : undefined}>
      <RutinaSemanal
        dias={dias}
        ejercicios={ejercicios}
        hoyDia={hoyDia}
        onNuevoDia={acciones.onNuevoDia}
        onNuevoEjercicio={acciones.onNuevoEjercicio}
        onEditarEjercicio={acciones.onEditarEjercicio}
        onBorrarDia={acciones.onBorrarDia}
        onBorrarEjercicio={acciones.onBorrarEjercicio}
      />
    </Section>
  );

  return (
    <Screen contentStyle={contenido}>
      {encabezado}

      {errorCarga ? (
        <ErrorSistema compacto mensaje={errorCarga} onReintentar={acciones.onReintentar} style={styles.error} />
      ) : null}

      <Entrada indice={1} style={styles.franja}>
        <FranjaCifras cifras={cifras} />
      </Entrada>

      {dosColumnas ? (
        <View style={styles.dos}>
          <Entrada indice={2} style={styles.col}>
            {prescritoBloque}
            {sesionBloque}
          </Entrada>
          <Entrada indice={3} style={styles.col}>
            {rutina}
          </Entrada>
        </View>
      ) : (
        <>
          {prescritoBloque ? <Entrada indice={2}>{prescritoBloque}</Entrada> : null}
          {/* Entrenando no hay Entrada: un campo con el foco no debe moverse. */}
          {entrenando ? sesionBloque : <Entrada indice={3}>{sesionBloque}</Entrada>}
          <Entrada indice={4}>{rutina}</Entrada>
        </>
      )}

      <DescargoSalud />
    </Screen>
  );
}

const styles = StyleSheet.create({
  error: { marginBottom: space.s5 },
  franja: { marginBottom: space.s8 },
  dos: { flexDirection: 'row', alignItems: 'flex-start', gap: space.s8 },
  col: { flex: 1, minWidth: 0 },
  pila: { gap: space.s4 },
  hecho: { flexDirection: 'row', alignItems: 'center', gap: space.s4 },
  hechoTexto: {
    flex: 1,
    minWidth: 0,
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink8,
  },
  linea: {
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink8,
  },
  botonLinea: { alignSelf: 'flex-start', marginTop: space.s4 },
});
