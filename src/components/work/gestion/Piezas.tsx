// NIVL · WORK · Gestión: lo que comparten las tres pantallas. Solo kit existente.

import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { CargaArena, EncabezadoArena, ErrorSistema, type AccionArena, type FormaCarga } from '@/components/arena';
import { Check, EmptyState, Row, Screen, Tag } from '@/components/ui';
import { ink, space, type as tipo } from '@/design/tokens';
import { t } from '@/i18n';
import { fechaCorta } from '@/work/fechas';
import type { EntregaConRiesgo, RiesgoEntrega } from '@/work/proyectos';
import type { Entrega } from '@/work/tipos';

export interface EstadoPantalla {
  estado: 'cargando' | 'listo' | 'error';
  error: string | null;
  disponible: boolean;
  onVolver: () => void;
  onReintentar: () => void;
}

interface PantallaGestionProps extends EstadoPantalla {
  titulo: string;
  subtitulo?: string;
  accion?: AccionArena;
  etiquetaCarga: string;
  formas: FormaCarga[];
  /** Pie de pantalla o aviso que no se va con el scroll. */
  overlay?: ReactNode;
  children: ReactNode;
}

export function PantallaGestion(p: PantallaGestionProps) {
  const listo = p.estado === 'listo' && p.disponible;
  return (
    <Screen overlay={p.overlay}>
      <EncabezadoArena titulo={p.titulo} subtitulo={p.subtitulo} onVolver={p.onVolver} accion={listo ? p.accion : undefined} />
      {p.estado === 'cargando' ? (
        <CargaArena etiqueta={p.etiquetaCarga} formas={p.formas} />
      ) : p.estado === 'error' ? (
        <ErrorSistema mensaje={p.error ?? t('comun:sistemaNoResponde')} onReintentar={p.onReintentar} />
      ) : !p.disponible ? (
        <EmptyState icon="hourglass-outline" title={t('trabajo:comun.noDisponibleTitulo')} body={t('trabajo:comun.noDisponibleCuerpo')} />
      ) : (
        p.children
      )}
    </Screen>
  );
}

export function textoRiesgo(r: RiesgoEntrega): string {
  return t(`trabajogestion:riesgo.${r}`);
}

/** La trama es para lo que ya aprieta; no es una nota sobre la persona. */
export function EtiquetaRiesgo({ riesgo }: { riesgo: RiesgoEntrega }) {
  return <Tag tone={riesgo === 'atrasada' || riesgo === 'hoy' ? 'alerta' : 'dim'}>{textoRiesgo(riesgo)}</Tag>;
}

export function FilaEntrega({
  entrega,
  primera,
  onMarcar,
  onAbrir,
}: {
  entrega: EntregaConRiesgo;
  primera?: boolean;
  onMarcar: (e: Entrega) => void;
  onAbrir: (e: Entrega) => void;
}) {
  const a11y = t(entrega.hecha ? 'trabajogestion:proyectos.desmarcarA11y' : 'trabajogestion:proyectos.marcarA11y', { titulo: entrega.titulo });
  return (
    <Row
      first={primera}
      title={entrega.titulo}
      done={entrega.hecha}
      detail={entrega.fecha ? fechaCorta(entrega.fecha) : undefined}
      onPress={() => onAbrir(entrega)}
      leading={
        <Pressable onPress={() => onMarcar(entrega)} hitSlop={12} accessibilityRole="checkbox" accessibilityState={{ checked: entrega.hecha }} accessibilityLabel={a11y}>
          <Check checked={entrega.hecha} />
        </Pressable>
      }
      trailing={entrega.hecha ? undefined : <EtiquetaRiesgo riesgo={entrega.riesgo} />}
    />
  );
}

export function TextoAyuda({ children }: { children: ReactNode }) {
  return (
    <Text style={styles.ayuda} maxFontSizeMultiplier={1.35}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  ayuda: { fontFamily: tipo.bodySm.family, fontSize: tipo.bodySm.size, lineHeight: tipo.bodySm.lineHeight, color: ink.ink8, marginBottom: space.s3 },
});
