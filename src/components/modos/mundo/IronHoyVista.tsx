// NIVL · Mundo IRON: el inicio, «IRON: tu gimnasio, nada más» (P01, lámina
// 2). Pura: todo llega por props desde useIronHoy.
//
// De arriba abajo:
//   0 · La cabecera del mundo (emblema, IRON, nivel de IRON).
//   1 · El informe del cierre, si lo hay (el mismo de Hoy de NIVL).
//   2 · El entreno de hoy, primero: el día de la rutina con sus ejercicios y
//       LA INVERSIÓN «Empezar entreno». Hecho: grano. Descanso: contorno.
//   3 · Tus pesos y récords (tres) con «Ver todo».
//   4 · Rutinas: tus días en una fila; «Nueva» a un toque.
//   5 · Catálogo con técnica animada.
//   6 · La dieta de hoy: objetivo y parte de calorías y proteína.
//   7 · El coach de IRON.
// FUERA (regla de producto): hábitos, campañas, Winter Arc. Viven en NIVL.

import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CargaArena, Entrada, ErrorSistema, TarjetaArena } from '@/components/arena';
import { FilaEjercicio, cargaTexto } from '@/components/gym/RutinaSemanal';
import { Button, Check, Chip, ChipWrap, EmptyState, Screen, Section } from '@/components/ui';
import { ink, space, type as tipo } from '@/design/tokens';
import { t } from '@/i18n';
import type { GymDay, GymExercise, GymSession } from '@/lib/types';
import type { CierreHoy } from '@/components/hoy/derivarHoy';
import { ListaPesosIron } from './PesosIronVista';
import type { AccionesIronHoy, EstadoDieta } from './useIronHoy';
import type { EstadoPesos } from './usePesosIron';

export interface IronHoyVistaProps {
  cabecera: ReactNode;
  /** «Martes, 20 de octubre»; null mientras carga. */
  fecha: string | null;
  cierre: CierreHoy | null;
  entreno: {
    cargado: boolean;
    errorCarga: string | null;
    hoyDia: number;
    dias: GymDay[];
    ejercicios: GymExercise[];
    sesionHoy: GymSession | null;
    xpMisionHoy: number;
    tecnicaDe?: (nombre: string) => (() => void) | undefined;
    onEmpezar: () => void;
    onReintentar: () => void;
  };
  pesos: EstadoPesos;
  dieta: EstadoDieta;
  acciones: AccionesIronHoy;
}

const PESOS_EN_INICIO = 3;

function Entreno({ e, fecha, onRutinas }: { e: IronHoyVistaProps['entreno']; fecha: string | null; onRutinas: () => void }) {
  if (!e.cargado) {
    return e.errorCarga ? (
      <ErrorSistema mensaje={e.errorCarga} onReintentar={e.onReintentar} />
    ) : (
      <CargaArena etiqueta={t('mundos:iron.cargandoA11y')} formas={['tarjeta']} />
    );
  }
  const planHoy = e.dias.find((d) => d.day_of_week === e.hoyDia);
  const ejercicios = planHoy ? e.ejercicios.filter((x) => x.gym_day_id === planHoy.id) : [];

  if (e.sesionHoy) {
    const xp = e.sesionHoy.xp_awarded + e.xpMisionHoy;
    return (
      <TarjetaArena variante="grano" rotulo={t('mundos:iron.hechoRotulo')} meta={`+${xp} XP`}>
        <View style={styles.hecho}>
          <Check checked />
          <Text style={styles.cuerpo} maxFontSizeMultiplier={1.6}>
            {t('mundos:iron.hechoCuerpo', { xp })}
          </Text>
        </View>
      </TarjetaArena>
    );
  }

  if (e.dias.length === 0) {
    return (
      <TarjetaArena variante="contorno">
        <EmptyState
          compact
          icon="barbell-outline"
          title={t('mundos:iron.sinRutinaTitulo')}
          body={t('mundos:iron.sinRutinaCuerpo')}
          action={{ label: t('mundos:iron.crearRutina'), onPress: onRutinas }}
        />
      </TarjetaArena>
    );
  }

  if (!planHoy) {
    return (
      <TarjetaArena variante="contorno" rotulo={t('mundos:iron.descansoRotulo')} meta={fecha ?? undefined}>
        <Text style={styles.cuerpo} maxFontSizeMultiplier={1.6}>
          {t('mundos:iron.descansoCuerpo')}
        </Text>
        <Button title={t('mundos:iron.verRutinas')} variant="secondary" size="sm" onPress={onRutinas} style={styles.boton} />
      </TarjetaArena>
    );
  }

  const series = ejercicios.reduce((s, x) => s + Math.max(1, x.sets), 0);
  return (
    <TarjetaArena variante="piedra" remaches zocalo rotulo={t('mundos:iron.entrenoRotulo')} meta={fecha ?? undefined}>
      <Text style={styles.dia} accessibilityRole="header" maxFontSizeMultiplier={1.35}>
        {planHoy.name}
      </Text>
      <Text style={styles.sub} maxFontSizeMultiplier={1.35}>
        {t('mundos:iron.entrenoSub', { count: ejercicios.length, series })}
      </Text>
      <View style={styles.lista}>
        {ejercicios.map((x, i) => (
          <FilaEjercicio
            key={x.id}
            primera={i === 0}
            ordinal={i + 1}
            nombre={x.name}
            carga={cargaTexto(x.sets, x.reps, x.weight)}
            onTecnica={e.tecnicaDe?.(x.name)}
          />
        ))}
      </View>
      <Button title={t('mundos:iron.empezar')} icon="barbell-outline" variant="primary" onPress={e.onEmpezar} style={styles.boton} />
    </TarjetaArena>
  );
}

function Dieta({ dieta, acciones }: { dieta: EstadoDieta; acciones: AccionesIronHoy }) {
  let lineas: string[] = [];
  if (dieta.estado === 'listo') {
    lineas = [
      dieta.objetivo
        ? t('mundos:iron.dietaObjetivo', { kcal: dieta.objetivo.kcal, proteina: dieta.objetivo.proteina })
        : t('mundos:iron.dietaSinObjetivo'),
      dieta.parte && (dieta.parte.kcal !== null || dieta.parte.proteina !== null)
        ? t('mundos:iron.dietaParte', { kcal: dieta.parte.kcal ?? '-', proteina: dieta.parte.proteina ?? '-' })
        : t('mundos:iron.dietaSinParte'),
    ];
  }
  return (
    <TarjetaArena variante="contorno" rotulo={t('mundos:iron.dietaTitulo')}>
      {dieta.estado === 'cargando' ? (
        <CargaArena etiqueta={t('mundos:iron.cargandoA11y')} formas={['rotulo']} />
      ) : (
        lineas.map((l) => (
          <Text key={l} style={[styles.cuerpo, styles.linea]} maxFontSizeMultiplier={1.6}>
            {l}
          </Text>
        ))
      )}
      <View style={styles.botones}>
        <Button title={t('mundos:iron.dietaAbrir')} icon="restaurant-outline" variant="secondary" size="sm" onPress={acciones.onDieta} />
        <Button title={t('mundos:iron.nutricionAbrir')} icon="nutrition-outline" variant="ghost" size="sm" onPress={acciones.onNutricion} />
      </View>
    </TarjetaArena>
  );
}

export function IronHoyVista({ cabecera, fecha, cierre, entreno, pesos, dieta, acciones }: IronHoyVistaProps) {
  return (
    <Screen>
      <Entrada indice={0}>{cabecera}</Entrada>

      {cierre ? (
        <Entrada indice={1} style={styles.bloque}>
          <TarjetaArena variante={cierre.alerta ? 'trama' : 'contorno'} rotulo={cierre.alerta ? t('hoy:vista.alertaRotulo') : t('hoy:vista.informeRotulo')}>
            {cierre.lineas.map((l) => (
              <Text key={l} style={[styles.cuerpo, styles.linea]}>
                {l}
              </Text>
            ))}
          </TarjetaArena>
        </Entrada>
      ) : null}

      <Entrada indice={2} style={styles.bloque}>
        <Entreno e={entreno} fecha={fecha} onRutinas={acciones.onRutinas} />
      </Entrada>

      <Entrada indice={3}>
        <Section title={t('mundos:iron.pesosTitulo')} action={{ label: t('mundos:iron.verTodo'), onPress: acciones.onPesos }}>
          <ListaPesosIron estado={pesos} tope={PESOS_EN_INICIO} />
        </Section>
      </Entrada>

      {entreno.cargado ? (
        <Entrada indice={4}>
          <Section
            title={t('mundos:iron.rutinasTitulo')}
            meta={entreno.dias.length > 0 ? `${entreno.dias.length}` : undefined}
          >
            <ChipWrap>
              {entreno.dias.map((d) => (
                <Chip key={d.id} label={d.name} selected={d.day_of_week === entreno.hoyDia} onPress={acciones.onRutinas} />
              ))}
              <Chip label={t('mundos:iron.nueva')} icon="add" onPress={acciones.onRutinas} />
            </ChipWrap>
          </Section>
        </Entrada>
      ) : null}

      <Entrada indice={5} style={styles.bloque}>
        <TarjetaArena variante="contorno" rotulo={t('mundos:iron.catalogoTitulo')}>
          <Text style={styles.cuerpo} maxFontSizeMultiplier={1.6}>
            {t('mundos:iron.catalogoCuerpo')}
          </Text>
          <Button title={t('mundos:iron.catalogoAbrir')} icon="body-outline" variant="secondary" size="sm" onPress={acciones.onCatalogo} style={styles.boton} />
        </TarjetaArena>
      </Entrada>

      <Entrada indice={6} style={styles.bloque}>
        <Dieta dieta={dieta} acciones={acciones} />
      </Entrada>

      <Entrada indice={7} style={styles.bloque}>
        <TarjetaArena variante="contorno" rotulo={t('mundos:iron.coachTitulo')}>
          <Text style={styles.cuerpo} maxFontSizeMultiplier={1.6}>
            {t('mundos:iron.coachCuerpo')}
          </Text>
          <Button title={t('mundos:iron.coachAbrir')} icon="chatbubble-ellipses-outline" variant="secondary" size="sm" onPress={acciones.onCoach} style={styles.boton} />
        </TarjetaArena>
      </Entrada>
    </Screen>
  );
}

const styles = StyleSheet.create({
  bloque: { marginBottom: space.s6 },
  hecho: { flexDirection: 'row', alignItems: 'center', gap: space.s3 },
  dia: {
    fontFamily: tipo.headline.family,
    fontSize: tipo.headline.size,
    lineHeight: tipo.headline.lineHeight,
    letterSpacing: tipo.headline.tracking,
    color: ink.ink10,
  },
  sub: {
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink8,
    marginTop: space.s1,
  },
  lista: { marginTop: space.s3 },
  cuerpo: {
    fontFamily: tipo.body.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink9,
    flexShrink: 1,
  },
  linea: { marginTop: space.s1 },
  boton: { marginTop: space.s4, alignSelf: 'flex-start' },
  botones: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s2, marginTop: space.s4 },
});
