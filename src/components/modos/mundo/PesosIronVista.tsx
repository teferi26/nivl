// NIVL · Mundo IRON: «Pesos», tus pesos y récords (pura). La fila
// `FilaPesoIron` la comparten esta pantalla y el inicio de IRON (las tres
// primeras). Por ejercicio: el nombre, la subida en 6 semanas, la etiqueta de
// récord (grano: logro) y el último peso en Cinzel. Tocar la fila abre su
// técnica si casa con el catálogo.

import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { EncabezadoArena, Entrada, ErrorSistema, CargaArena, TarjetaArena } from '@/components/arena';
import { kgTexto } from '@/components/iron/HistorialIron';
import { EmptyState, Row, Screen, Section, Tag } from '@/components/ui';
import { ink, space, type as tipo } from '@/design/tokens';
import { t } from '@/i18n';
import type { EstadoPesos, FilaPeso } from './usePesosIron';

/** «+7,5»: con signo si sube (el «-» de una bajada ya lo trae el número). */
export function subidaTexto(kg: number): string {
  return kg > 0 ? `+${kgTexto(kg)}` : kgTexto(kg);
}

export function FilaPesoIron({ fila, primera, completa }: { fila: FilaPeso; primera?: boolean; completa?: boolean }) {
  const detalle = [
    fila.subida !== null ? t('mundos:iron.subida', { kg: subidaTexto(fila.subida) }) : null,
    completa && fila.e1rm !== null ? t('mundos:iron.pesoMejor', { kg: kgTexto(fila.e1rm) }) : null,
    completa ? t('mundos:iron.pesoSesiones', { count: fila.sesiones }) : null,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <Row
      first={primera}
      title={fila.nombre}
      titleAddon={fila.record ? <Tag tone="logro">{t('mundos:iron.record')}</Tag> : undefined}
      detail={detalle || undefined}
      onPress={fila.onTecnica}
      chevron={!!fila.onTecnica}
      accessibilityLabel={[
        t('mundos:iron.pesoA11y', { nombre: fila.nombre, kg: kgTexto(fila.kg) }),
        fila.record ? t('mundos:iron.record') : null,
        fila.subida !== null ? t('mundos:iron.subidaA11y', { kg: subidaTexto(fila.subida) }) : null,
      ]
        .filter(Boolean)
        .join('. ')}
      trailing={
        <Text style={styles.kg} maxFontSizeMultiplier={1}>
          {kgTexto(fila.kg)}
          <Text style={styles.unidad}>{' kg' /* i18n-ok: unidad */}</Text>
        </Text>
      }
    />
  );
}

/** La lista (o sus estados) para una sección: la usan Pesos y el inicio de IRON. */
export function ListaPesosIron({ estado, tope, completa }: { estado: EstadoPesos; tope?: number; completa?: boolean }): ReactNode {
  if (estado.estado === 'cargando') return <CargaArena etiqueta={t('mundos:iron.pesosCargandoA11y')} formas={['filas']} filas={tope ?? 3} />;
  if (estado.estado === 'error') return <ErrorSistema compacto mensaje={estado.mensaje} onReintentar={estado.reintentar} />;
  if (estado.filas.length === 0) {
    return (
      <TarjetaArena variante="contorno">
        <EmptyState compact icon="barbell-outline" title={t('mundos:iron.pesosVacioTitulo')} body={t('mundos:iron.pesosVacio')} />
      </TarjetaArena>
    );
  }
  const filas = tope ? estado.filas.slice(0, tope) : estado.filas;
  return (
    <View>
      {filas.map((f, i) => (
        <FilaPesoIron key={f.clave} fila={f} primera={i === 0} completa={completa} />
      ))}
    </View>
  );
}

export interface PesosIronVistaProps {
  cabecera: ReactNode;
  estado: EstadoPesos;
}

export function PesosIronVista({ cabecera, estado }: PesosIronVistaProps) {
  return (
    <Screen>
      <Entrada indice={0}>{cabecera}</Entrada>
      <Entrada indice={1}>
        <EncabezadoArena
          eyebrow={t('mundos:iron.pesosEyebrow')}
          titulo={t('mundos:iron.pesosTituloPantalla')}
          subtitulo={estado.estado === 'listo' ? t('mundos:iron.pesosSub', { count: estado.filas.length }) : undefined}
        />
      </Entrada>
      <Entrada indice={2}>
        <Section title={t('mundos:iron.pesosTitulo')}>
          <ListaPesosIron estado={estado} completa />
        </Section>
      </Entrada>
    </Screen>
  );
}

const styles = StyleSheet.create({
  kg: {
    fontFamily: tipo.number.family,
    fontSize: tipo.number.size,
    lineHeight: tipo.number.lineHeight,
    color: ink.ink10,
    marginLeft: space.s2,
  },
  unidad: {
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    color: ink.ink6,
  },
});
