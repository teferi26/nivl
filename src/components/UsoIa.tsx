// NIVL · Cuánta IA queda este mes (0078): barra fina, porcentaje y, al acercarse al tope, la voz del
// sistema. Al llegar, la recarga (consumible `nivl_ia_recarga_1`) si la tienda está abierta.
//
// Monocromo «Mármol y tinta»: el aviso no se colorea, se marca con el tono de la barra (ink8 al agotarse)
// y un reloj. Sin guion largo en ningún texto (catálogo coach:uso.*).

import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Barra } from '@/components/arena';
import { Button } from '@/components/ui';
import { ink, space, type } from '@/design/tokens';
import { t } from '@/i18n';
import { nombreDia } from '@/lib/dates';
import { comprarRecargaIa, porcentajeIa, precioRecargaIa, purchasesAvailable, usoIa, type AiStatus, type NivelUsoIa } from '@/lib/pro';
import { mensajeSistema } from '@/lib/validation';

/** El texto del aviso para un nivel de uso (null en uso normal). Puro salvo el catálogo. */
export function textoUsoIa(nivel: NivelUsoIa, renueva?: string): string | null {
  switch (nivel) {
    case 'aviso80':
      return t('coach:uso.aviso80');
    case 'aviso95':
      return t('coach:uso.aviso95');
    case 'hoy':
      return t('coach:uso.hoy');
    case 'agotada':
      return renueva ? t('coach:uso.agotada', { dia: nombreDia(renueva).toLowerCase() }) : t('coach:uso.agotadaSinDia');
    default:
      return null;
  }
}

interface Props {
  status: AiStatus | null | undefined;
  /** Tras una recarga aplicada: vuelve a leer el estado. */
  onRecargada?: () => void;
  /** Compacto (cabecera del coach): sin la barra cuando no hay nada que avisar. */
  compacto?: boolean;
  /** Sin la fila de la barra (quien la pinta ya tiene la suya, como /pro): solo aviso y recarga. */
  sinBarra?: boolean;
}

export function UsoIa({ status, onRecargada, compacto = false, sinBarra = false }: Props) {
  const uso = usoIa(status);
  const [precio, setPrecio] = useState<string | null>(null);
  const [comprando, setComprando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const ofreceRecarga = !!uso && (uso.nivel === 'agotada' || uso.nivel === 'aviso95') && purchasesAvailable();

  useEffect(() => {
    if (!ofreceRecarga) return;
    let vivo = true;
    precioRecargaIa().then((p) => vivo && setPrecio(p)).catch(() => {});
    return () => {
      vivo = false;
    };
  }, [ofreceRecarga]);

  if (!uso) return null;
  const pct = porcentajeIa(uso.queda);
  const aviso = textoUsoIa(uso.nivel, status?.ia?.renueva ?? status?.renews);
  if (sinBarra && !aviso && !mensaje) return null;
  if (compacto && !aviso) {
    return (
      <View style={styles.fila} accessible accessibilityLabel={t('coach:uso.a11y', { pct })}>
        <Text style={styles.etiqueta}>{t('coach:uso.etiqueta')}</Text>
        <View style={styles.barra}>
          <Barra ratio={uso.queda} alto={4} tono="blanco" enGrupo etiqueta={t('coach:uso.a11y', { pct })} />
        </View>
        <Text style={styles.pct}>{t('coach:uso.restante', { pct })}</Text>
      </View>
    );
  }

  const recargar = async () => {
    setComprando(true);
    setMensaje(null);
    try {
      const r = await comprarRecargaIa();
      if (r === 'cancelada') return;
      setMensaje(r === 'activa' ? t('coach:uso.recargaHecha') : t('coach:uso.recargaPendiente'));
      onRecargada?.();
    } catch (e) {
      setMensaje(mensajeSistema(e));
    } finally {
      setComprando(false);
    }
  };

  return (
    <View style={[styles.bloque, sinBarra && styles.sinMargen]}>
      {sinBarra ? null : <View style={styles.fila} accessible accessibilityLabel={t('coach:uso.a11y', { pct })}>
        <Text style={styles.etiqueta}>{t('coach:uso.etiqueta')}</Text>
        <View style={styles.barra}>
          <Barra ratio={uso.queda} alto={4} tono={uso.nivel === 'agotada' ? 'ink8' : 'blanco'} enGrupo etiqueta={t('coach:uso.a11y', { pct })} />
        </View>
        <Text style={styles.pct}>{t('coach:uso.restante', { pct })}</Text>
      </View>}
      {aviso ? (
        <View style={styles.avisoFila}>
          <Ionicons name="hourglass-outline" size={14} color={ink.ink8} />
          <Text style={styles.aviso} accessibilityRole="text">{aviso}</Text>
        </View>
      ) : null}
      {ofreceRecarga ? (
        <Button
          title={precio ? t('coach:uso.recargar', { precio }) : t('coach:uso.recargarSinPrecio')}
          variant={uso.nivel === 'agotada' ? 'primary' : 'secondary'}
          size="sm"
          icon="flash-outline"
          loading={comprando}
          onPress={() => void recargar()}
        />
      ) : null}
      {mensaje ? <Text style={styles.aviso}>{mensaje}</Text> : null}
    </View>
  );
}

const micro = { fontFamily: type.micro.family, fontSize: type.micro.size, lineHeight: type.micro.lineHeight, letterSpacing: type.micro.tracking } as const;
const lectura = { fontFamily: type.bodySm.family, fontSize: type.bodySm.size, lineHeight: type.bodySm.lineHeight } as const;

const styles = StyleSheet.create({
  bloque: { gap: space.s2, paddingHorizontal: space.s5, paddingVertical: space.s2 },
  sinMargen: { paddingHorizontal: 0, marginTop: space.s3 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: space.s2 },
  etiqueta: { ...micro, color: ink.ink6, textTransform: 'uppercase' },
  barra: { flex: 1 },
  pct: { ...micro, color: ink.ink8 },
  avisoFila: { flexDirection: 'row', alignItems: 'flex-start', gap: space.s2 },
  aviso: { ...lectura, color: ink.ink8, flex: 1, minWidth: 0 },
});
