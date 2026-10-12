// NIVL · Fotos de progreso: la vista (L5 · A). Pura: todo llega por props,
// así la galería (/kit/pantallas?pantalla=fotos) la pinta sin sesión.
//
// Composición (lenguaje arena, L-RADICAL):
//   1. EncabezadoArena «Progreso» / «FOTOS» con meandro; su acción sólida
//      «Nueva foto» es LA inversión de la pantalla (solo con acceso abierto).
//   2. FranjaCifras: semanas seguidas, esta semana (n/3) y fotos.
//   3. La semana en curso en una TarjetaArena (grano si está cerrada).
//   4. Comparar (antes y después) y la línea por semanas.
//   5. Pie de privacidad.
// Gate propio, además del de HEALTH_ROUTES: sin salud, la tarjeta del
// permiso; sin 18+, la pregunta con «Tengo 18 o más» y «Ahora no» iguales;
// si no se ha podido leer (sin conexión), «El sistema no responde» y
// reintentar, nunca la pregunta de la edad.
// Privacidad: con `tapado` (la app no está activa: selector de apps) una placa
// ink0 cubre las miniaturas y la comparación. Bloquear las capturas de
// pantalla de Android (FLAG_SECURE) necesitaría expo-screen-capture, que no
// está instalado: pedido al coordinador.
// Cosmético: ninguna cifra de aquí es XP.

import { useMemo, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { EncabezadoArena, Entrada, FranjaCifras, TarjetaArena } from '@/components/arena';
import type { AccesoFotos } from '@/components/permisoFotos';
import { Button, Screen, Section, Skeleton } from '@/components/ui';
import { ink, space, type as tipo } from '@/design/tokens';
import { t } from '@/i18n';
import { mayus } from '@/i18n/formato';
import {
  estadoSemanal,
  lineaTemporal,
  POSES,
  rachaFotosSemanal,
  type FotoConPeso,
  type FotoProgreso,
  type ParAntesDespues,
  type PesoDia,
} from '@/lib/progressPhotos';
import { CompararFotos, type CompararFotosProps } from './CompararFotos';
import { LineaFotos } from './LineaFotos';
import { nombrePose } from './modelo';
import { PreguntaEdad } from './PreguntaEdad';

/** Semanas que se firman y se pintan de cada vez. */
export const SEMANAS_POR_PAGINA = 8;

export interface FotosVistaProps {
  acceso: AccesoFotos;
  cargado: boolean;
  error: string | null;
  hoy: string;
  fotos: FotoProgreso[];
  pesos: PesoDia[];
  urls: Record<string, string>;
  semanasVisibles: number;
  puedeCompartir: boolean;
  compartiendo: boolean;
  confirmandoEdad: boolean;
  errorEdad: string | null;
  /** La app no está activa: se tapa el contenido (miniaturas y comparación). */
  tapado?: boolean;
  /** Estado inicial de Comparar (solo la galería). */
  compararInicial?: CompararFotosProps['inicial'];
  acciones: {
    onVolver: () => void;
    onNueva: () => void;
    onVerMas: () => void;
    onAbrir: (f: FotoConPeso) => void;
    onFallo: (id: string) => void;
    onPedirFirmas: (ids: string[]) => void;
    onCompartir: (par: ParAntesDespues, conPeso: boolean) => void;
    onConfirmarEdad: () => void;
    onAhoraNo: () => void;
    onRevisarSalud: () => void;
    onReintentar: () => void;
    /** Con acceso 'error': vuelve a leer la salud y la confirmación 18+. */
    onReintentarAcceso: () => void;
  };
  /** Hojas de la ruta (nueva foto, ver foto). */
  hojas?: ReactNode;
}

/** «frente», «frente y lado», «frente, lado y espalda». */
function enLista(xs: string[]): string {
  if (xs.length <= 1) return xs[0] ?? '';
  if (xs.length === 2) return t('fotos:vista.listaDos', { a: xs[0], b: xs[1] });
  return t('fotos:vista.listaTres', { a: xs.slice(0, -2).join(', '), b: xs[xs.length - 2], c: xs[xs.length - 1] });
}

export function FotosVista(p: FotosVistaProps) {
  const { acceso, cargado, error, hoy, fotos, pesos, urls, semanasVisibles, acciones: a } = p;
  const abierto = acceso === 'abierto';

  const semanas = useMemo(() => lineaTemporal(fotos, pesos), [fotos, pesos]);
  const racha = useMemo(() => rachaFotosSemanal(fotos, hoy), [fotos, hoy]);
  const semana = useMemo(() => estadoSemanal(fotos, hoy), [fotos, hoy]);
  const visibles = semanas.slice(0, semanasVisibles);

  const subtitulo = !abierto
    ? t('fotos:vista.subPoses')
    : !cargado
      ? undefined
      : fotos.length === 0
        ? t('fotos:vista.subPoses')
        : semana.completa
          ? t('fotos:vista.subCerrada')
          : t('fotos:vista.subSemana', { n: semana.hechas.length });

  const textoSemana = semana.completa
    ? t('fotos:vista.tresHechas')
    : t('fotos:vista.falta', { poses: enLista(semana.faltan.map((x) => nombrePose(x).toLowerCase())) });
  const notaSemana = racha.siguienteHito
    ? t('fotos:vista.conHito', { texto: textoSemana, n: racha.siguienteHito })
    : textoSemana;

  let cuerpo: ReactNode;
  if (acceso === 'cargando' || (abierto && !cargado)) {
    cuerpo = (
      <View style={styles.pila} accessibilityRole="progressbar" accessibilityLabel={t('fotos:vista.cargandoA11y')}>
        <Skeleton height={56} />
        <Skeleton height={120} />
        <Skeleton height={220} />
      </View>
    );
  } else if (acceso === 'error') {
    cuerpo = (
      <Entrada>
        <TarjetaArena variante="contorno" rotulo={t('comun:sistemaNoResponde')}>
          <Text style={styles.texto} maxFontSizeMultiplier={1.35}>
            {t('fotos:vista.errorPermiso')}
          </Text>
          <Button title={t('fotos:vista.reintentar')} variant="secondary" onPress={a.onReintentarAcceso} style={styles.boton} />
        </TarjetaArena>
      </Entrada>
    );
  } else if (acceso === 'sin_salud') {
    cuerpo = (
      <Entrada>
        <TarjetaArena variante="contorno" rotulo={t('fotos:vista.permisoSalud')}>
          <Text style={styles.texto} maxFontSizeMultiplier={1.35}>
            {t('fotos:vista.permisoSaludTexto')}
          </Text>
          <Button title={t('fotos:vista.revisarSalud')} variant="secondary" onPress={a.onRevisarSalud} style={styles.boton} />
        </TarjetaArena>
      </Entrada>
    );
  } else if (acceso === 'confirmar_edad') {
    cuerpo = (
      <Entrada>
        <TarjetaArena variante="contorno" remaches rotulo={t('fotos:vista.solo18')}>
          <PreguntaEdad onSi={a.onConfirmarEdad} onNo={a.onAhoraNo} ocupado={p.confirmandoEdad} error={p.errorEdad} />
        </TarjetaArena>
      </Entrada>
    );
  } else if (error) {
    cuerpo = (
      <TarjetaArena variante="trama" rotulo={t('fotos:vista.sinFotos')}>
        <Text style={styles.texto}>{error}</Text>
        <Button title={t('fotos:vista.reintentar')} variant="secondary" onPress={a.onReintentar} style={styles.boton} />
      </TarjetaArena>
    );
  } else if (fotos.length === 0) {
    cuerpo = (
      <Entrada>
        <TarjetaArena variante="contorno" remaches rotulo={t('fotos:vista.primeraSemana')}>
          <Text style={styles.texto} maxFontSizeMultiplier={1.35}>
            {t('fotos:vista.primeraSemanaTexto')}
          </Text>
          <Text style={styles.nota} maxFontSizeMultiplier={1.35}>
            {t('fotos:vista.primeraSemanaNota')}
          </Text>
        </TarjetaArena>
      </Entrada>
    );
  } else {
    cuerpo = (
      <>
        <Entrada indice={0}>
          <FranjaCifras
            cifras={
              racha.semanas > 0
                ? [
                    {
                      valor: racha.semanas,
                      rotulo: t('fotos:vista.cifraSemanas'),
                      etiqueta: t('fotos:vista.cifraSemanasA11y', { n: racha.semanas }),
                    },
                    { valor: `${semana.hechas.length}/3`, rotulo: t('fotos:vista.cifraSemana') },
                    { valor: fotos.length, rotulo: t('fotos:vista.cifraFotos') },
                  ]
                : // Sin racha no se enseña un 0: primero la semana en curso.
                  [
                    { valor: `${semana.hechas.length}/3`, rotulo: t('fotos:vista.cifraSemana') },
                    { valor: fotos.length, rotulo: t('fotos:vista.cifraFotos') },
                  ]
            }
          />
        </Entrada>

        <Entrada indice={1}>
          <TarjetaArena
            variante={semana.completa ? 'grano' : 'piedra'}
            rotulo={t('fotos:vista.estaSemana')}
            meta={`${semana.hechas.length}/3`}
          >
            <View style={styles.poses}>
              {POSES.map((pose) => {
                const hecha = semana.hechas.includes(pose);
                return (
                  <View
                    key={pose}
                    style={[styles.pose, hecha && styles.poseHecha]}
                    accessible
                    accessibilityLabel={t(hecha ? 'fotos:vista.poseHechaA11y' : 'fotos:vista.poseFaltaA11y', {
                      pose: nombrePose(pose),
                    })}
                  >
                    <Text style={[styles.poseTexto, !hecha && styles.poseFalta]} maxFontSizeMultiplier={1.35}>
                      {mayus(nombrePose(pose))}
                    </Text>
                  </View>
                );
              })}
            </View>
            <Text style={styles.nota} maxFontSizeMultiplier={1.35}>
              {notaSemana}
            </Text>
          </TarjetaArena>
        </Entrada>

        <Entrada indice={2}>
          <Section title={t('fotos:vista.antesDespues')}>
            <CompararFotos
              fotos={fotos}
              pesos={pesos}
              hoy={hoy}
              urls={urls}
              puedeCompartir={p.puedeCompartir}
              compartiendo={p.compartiendo}
              onCompartir={a.onCompartir}
              onPedirFirmas={a.onPedirFirmas}
              onFallo={a.onFallo}
              inicial={p.compararInicial}
            />
          </Section>
        </Entrada>

        <Entrada indice={3}>
          <Section title={t('fotos:vista.semanaASemana')} meta={`${semanas.length}`}>
            <LineaFotos
              semanas={visibles}
              urls={urls}
              hoy={hoy}
              hayMas={semanas.length > visibles.length}
              onVerMas={a.onVerMas}
              onAbrir={a.onAbrir}
              onFallo={a.onFallo}
            />
          </Section>
        </Entrada>
      </>
    );
  }

  return (
    <Screen>
      <EncabezadoArena
        eyebrow={t('fotos:vista.eyebrow')}
        titulo={t('fotos:vista.titulo')}
        subtitulo={subtitulo}
        onVolver={a.onVolver}
        accion={
          abierto && cargado && !error
            ? { icono: 'camera-outline', etiqueta: t('fotos:vista.nueva'), onPress: a.onNueva, solida: true }
            : undefined
        }
        meandro
      />
      <View style={styles.pila}>
        {cuerpo}
        {p.tapado && abierto ? (
          <View
            style={[StyleSheet.absoluteFill, styles.placa]}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          />
        ) : null}
      </View>
      <Text style={styles.pie} maxFontSizeMultiplier={1.35}>
        {t('fotos:vista.pie')}
      </Text>
      {p.hojas}
    </Screen>
  );
}

const styles = StyleSheet.create({
  pila: { gap: space.s5 },
  texto: { fontFamily: tipo.body.family, fontSize: tipo.body.size, lineHeight: tipo.body.lineHeight, color: ink.ink9 },
  // Tapa las fotos fuera de la app; mismo fondo que la pantalla.
  placa: { backgroundColor: ink.ink0, zIndex: 1 },
  nota: {
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink8,
    marginTop: space.s3,
  },
  boton: { marginTop: space.s4 },
  poses: { flexDirection: 'row', gap: space.s2 },
  pose: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: ink.ink4,
  },
  // Hecha: marco de 2 en ink10, sin invertir (la inversión es «Nueva foto»).
  poseHecha: { borderWidth: 2, borderColor: ink.ink10 },
  poseTexto: { fontFamily: tipo.micro.family, fontSize: tipo.micro.size, letterSpacing: tipo.micro.tracking, color: ink.ink10 },
  poseFalta: { color: ink.ink6 },
  pie: {
    fontFamily: tipo.micro.family,
    fontSize: tipo.micro.size,
    lineHeight: tipo.micro.lineHeight,
    color: ink.ink6,
    textAlign: 'center',
    marginTop: space.s8,
    marginBottom: space.s4,
  },
});
