// NIVL · Conexión con Salud: la vista. Pura: todo llega por props.
//
// El orden importa: primero se explica cada categoría y solo después se abre
// el diálogo del sistema, que es la decisión real. Apple no le dice a NIVL qué
// se contestó, así que aquí solo consta que ya se preguntó. El envío al coach
// va aparte y apagado: conectar Salud no lo activa.

import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text } from 'react-native';
import { CargaArena, EncabezadoArena, Entrada, ErrorSistema, TarjetaArena } from '@/components/arena';
import { Button, Card, Row, RowValue, Screen, Section, SIN_DATO, Tag, leidoSinDato } from '@/components/ui';
import { Interruptor } from '@/components/ui/Interruptor';
import { ink, space, type as tipo } from '@/design/tokens';
import { t } from '@/i18n';
import { miles } from '@/i18n/formato';
import type { CategoriaSalud, ResumenDia } from '@/lib/medicion/saludNativa';
import { ExplicacionMedicion } from './ExplicacionMedicion';
import { ORDEN_CATEGORIAS, type MotivoNoDisponible } from './puro';

export interface EstadoCategoria {
  /** El sistema ya preguntó: desde aquí no se puede volver a preguntar. */
  preguntada: boolean;
  marcada: boolean;
}

export interface SaludConexionVistaProps {
  /** Aún no ha activado la medición: se explica antes de tocar HealthKit. */
  explicar: boolean;
  activando: boolean;
  errorActivar: string | null;
  cargado: boolean;
  noDisponible: MotivoNoDisponible | null;
  errorCarga: string | null;
  categorias: Record<CategoriaSalud, EstadoCategoria>;
  escribirEntrenos: boolean;
  pidiendo: boolean;
  /** El resultado de abrir el diálogo, en línea. */
  avisoPermisos: string | null;
  errorPermisos: string | null;
  resumenHoy: ResumenDia | null;
  trayendo: boolean;
  avisoTraer: string | null;
  errorTraer: string | null;
  /** null: aún no se sabe y el interruptor no se puede tocar. */
  enviarACoach: boolean | null;
  guardandoCoach: boolean;
  errorCoach: string | null;
  acciones: {
    onVolver: () => void;
    onActivar: () => void;
    onReintentar: () => void;
    onCategoria: (c: CategoriaSalud) => void;
    onEscribirEntrenos: (v: boolean) => void;
    onPedir: () => void;
    onTraer: () => void;
    onEnviarACoach: (v: boolean) => void;
  };
}

const ICONO_CATEGORIA: Record<CategoriaSalud, keyof typeof Ionicons.glyphMap> = {
  entrenos: 'map-outline',
  fc: 'heart-outline',
  energia: 'flame-outline',
  pasos: 'footsteps-outline',
  sueno: 'moon-outline',
  peso: 'scale-outline',
};

function Cifra({ valor, unidad }: { valor: number | null; unidad?: string }) {
  if (valor === null) return <RowValue>{SIN_DATO}</RowValue>;
  return <RowValue strong>{unidad ? `${miles(valor)} ${unidad}` : miles(valor)}</RowValue>;
}

function FilaHoy({ titulo, valor, unidad, primera }: { titulo: string; valor: number | null; unidad?: string; primera?: boolean }) {
  const leido = valor === null ? leidoSinDato() : `${miles(valor)} ${unidad ?? ''}`.trim();
  return (
    <Row
      first={primera}
      title={titulo}
      trailing={<Cifra valor={valor} unidad={unidad} />}
      accessibilityLabel={t('medicion:conexion.filaHoyA11y', { titulo, valor: leido })}
    />
  );
}

export function SaludConexionVista(p: SaludConexionVistaProps) {
  const { acciones } = p;
  const encabezado = (
    <Entrada indice={0}>
      <EncabezadoArena
        onVolver={acciones.onVolver}
        eyebrow={t('medicion:conexion.eyebrow')}
        titulo={t('medicion:conexion.titulo')}
        subtitulo={t('medicion:conexion.sub')}
      />
    </Entrada>
  );

  if (p.noDisponible) {
    return (
      <Screen>
        {encabezado}
        <TarjetaArena variante="contorno" rotulo={t('medicion:conexion.noDisponibleRotulo')}>
          <Text style={styles.cuerpo} maxFontSizeMultiplier={1.6}>
            {t(`medicion:conexion.noDisponible.${p.noDisponible}`)}
          </Text>
          <Text style={styles.nota} maxFontSizeMultiplier={1.6}>
            {t('medicion:conexion.noDisponiblePie')}
          </Text>
        </TarjetaArena>
      </Screen>
    );
  }

  if (p.explicar) {
    return (
      <Screen>
        {encabezado}
        <ExplicacionMedicion activando={p.activando} error={p.errorActivar} onActivar={acciones.onActivar} onAhoraNo={acciones.onVolver} />
      </Screen>
    );
  }

  if (!p.cargado) {
    return (
      <Screen>
        {encabezado}
        {p.errorCarga ? (
          <ErrorSistema mensaje={p.errorCarga} onReintentar={acciones.onReintentar} />
        ) : (
          <CargaArena etiqueta={t('medicion:conexion.cargando')} formas={['rotulo', 'filas']} />
        )}
      </Screen>
    );
  }

  const hayPendientes = ORDEN_CATEGORIAS.some((c) => !p.categorias[c].preguntada);
  const hayMarcadas = ORDEN_CATEGORIAS.some((c) => !p.categorias[c].preguntada && p.categorias[c].marcada);
  const entrenosPreguntados = p.categorias.entrenos.preguntada;
  const hayPreguntadas = ORDEN_CATEGORIAS.some((c) => p.categorias[c].preguntada);

  return (
    <Screen>
      {encabezado}

      <Entrada indice={1}>
        <Section title={t('medicion:conexion.queLee')}>
          <Card padded={false} style={styles.lista}>
            {ORDEN_CATEGORIAS.map((c, i) => {
              const titulo = t(`medicion:categoria.${c}.titulo`);
              const { preguntada, marcada } = p.categorias[c];
              return (
                <Row
                  key={c}
                  first={i === 0}
                  leading={<Ionicons name={ICONO_CATEGORIA[c]} size={20} color={ink.ink9} />}
                  title={titulo}
                  detail={t(`medicion:categoria.${c}.para`)}
                  trailing={
                    preguntada ? (
                      <Tag>{t('medicion:conexion.preguntada')}</Tag>
                    ) : (
                      <Interruptor
                        value={marcada}
                        onValueChange={() => acciones.onCategoria(c)}
                        accessibilityLabel={t('medicion:conexion.categoriaA11y', { categoria: titulo })}
                        disabled={p.pidiendo}
                      />
                    )
                  }
                />
              );
            })}
            <Row
              leading={<Ionicons name="create-outline" size={20} color={ink.ink9} />}
              title={t('medicion:conexion.escribirTitulo')}
              detail={t('medicion:conexion.escribirDetalle')}
              trailing={
                <Interruptor
                  value={p.escribirEntrenos}
                  onValueChange={acciones.onEscribirEntrenos}
                  accessibilityLabel={t('medicion:conexion.escribirTitulo')}
                  disabled={p.pidiendo}
                />
              }
            />
          </Card>
          <Text style={styles.nota} maxFontSizeMultiplier={1.6}>
            {t('medicion:conexion.antesDelDialogo')}
          </Text>
          {p.errorPermisos ? <ErrorSistema compacto mensaje={p.errorPermisos} style={styles.aviso} /> : null}
          {p.avisoPermisos ? (
            <Text style={styles.resultado} accessibilityLiveRegion="polite" maxFontSizeMultiplier={1.6}>
              {p.avisoPermisos}
            </Text>
          ) : null}
          <Button
            title={t('medicion:conexion.continuar')}
            icon="arrow-forward"
            onPress={acciones.onPedir}
            disabled={!(hayMarcadas || p.escribirEntrenos)}
            loading={p.pidiendo}
            style={styles.boton}
          />
          {!hayPendientes ? (
            <Text style={styles.nota} maxFontSizeMultiplier={1.6}>
              {t('medicion:conexion.todoPreguntado')}
            </Text>
          ) : null}
          <Text style={styles.nota} maxFontSizeMultiplier={1.6}>
            {t('medicion:conexion.cambiarDespues')}
          </Text>
        </Section>
      </Entrada>

      <Entrada indice={2}>
        <Section title={t('medicion:conexion.coachSeccion')}>
          <Card padded={false} style={styles.lista}>
            <Row
              first
              leading={<Ionicons name="chatbubble-ellipses-outline" size={20} color={ink.ink9} />}
              title={t('medicion:conexion.coachTitulo')}
              detail={t('medicion:conexion.coachDetalle')}
              trailing={
                <Interruptor
                  value={p.enviarACoach === true}
                  onValueChange={acciones.onEnviarACoach}
                  accessibilityLabel={t('medicion:conexion.coachTitulo')}
                  disabled={p.enviarACoach === null || p.guardandoCoach}
                />
              }
            />
          </Card>
          <Text style={styles.nota} maxFontSizeMultiplier={1.6}>
            {t('medicion:conexion.coachNota')}
          </Text>
          {p.errorCoach ? <ErrorSistema compacto mensaje={p.errorCoach} style={styles.aviso} /> : null}
        </Section>
      </Entrada>

      {entrenosPreguntados ? (
        <Entrada indice={3}>
          <Section title={t('medicion:conexion.traerSeccion')}>
            <Text style={styles.cuerpo} maxFontSizeMultiplier={1.6}>
              {t('medicion:conexion.traerCuerpo')}
            </Text>
            {p.errorTraer ? <ErrorSistema compacto mensaje={p.errorTraer} style={styles.aviso} /> : null}
            {p.avisoTraer ? (
              <Text style={styles.resultado} accessibilityLiveRegion="polite" maxFontSizeMultiplier={1.6}>
                {p.avisoTraer}
              </Text>
            ) : null}
            <Button
              title={t('medicion:conexion.traer')}
              icon="download-outline"
              variant="secondary"
              onPress={acciones.onTraer}
              loading={p.trayendo}
              style={styles.boton}
            />
          </Section>
        </Entrada>
      ) : null}

      {hayPreguntadas && p.resumenHoy ? (
        <Entrada indice={4}>
          <Section title={t('medicion:conexion.hoySeccion')}>
            <Card padded={false} style={styles.lista}>
              <FilaHoy primera titulo={t('medicion:categoria.pasos.titulo')} valor={p.resumenHoy.pasos} />
              <FilaHoy titulo={t('medicion:categoria.energia.titulo')} valor={p.resumenHoy.kcal_activas} unidad="kcal" />
              <FilaHoy titulo={t('medicion:conexion.hoyFc')} valor={p.resumenHoy.fc_media} unidad="ppm" />
              <FilaHoy titulo={t('medicion:categoria.sueno.titulo')} valor={p.resumenHoy.sueno_min} unidad="min" />
              <FilaHoy titulo={t('medicion:categoria.peso.titulo')} valor={p.resumenHoy.peso_kg} unidad="kg" />
            </Card>
            <Text style={styles.nota} maxFontSizeMultiplier={1.6}>
              {t('medicion:conexion.hoyNota')}
            </Text>
          </Section>
        </Entrada>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  lista: { paddingHorizontal: space.s4, paddingVertical: 2 },
  cuerpo: {
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink8,
  },
  nota: {
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink6,
    marginTop: space.s2,
  },
  resultado: {
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink9,
    marginTop: space.s3,
  },
  aviso: { marginTop: space.s3 },
  boton: { marginTop: space.s4 },
});
