// NIVL · Puertas: la vista de la hoja de denunciar una respuesta de la IA
// (FASE3, Lote B1). Pura: el envío, el cerrojo y el correo de respaldo siguen
// en DenunciarIA.tsx tal cual.
//
// `Sheet` del kit (en tableta, modal centrado de 560). Motivos en chips radio
// (vibran `seleccion` por dentro); LA inversión «Enviar denuncia» en el pie.
// Enviada (o el correo de respaldo): el aviso en contorno y «Cerrar» en
// secondary. Fallo: trama.
import { StyleSheet, Text, View } from 'react-native';
import { TarjetaArena } from '@/components/arena';
import { Button, Chip, ChipWrap, Sheet } from '@/components/ui';
import { space } from '@/design/tokens';
import { t } from '@/i18n';
import { etiquetaMotivo, MOTIVOS_IA, type MotivoIA } from '@/components/denunciaIA';
import { texto } from './estilos';

export interface DenunciaVistaProps {
  visible: boolean;
  motivo: MotivoIA | null;
  /** Confirmación (enviada) o fallo, ya en la voz del sistema. */
  aviso: string | null;
  enviada: boolean;
  ocupada: boolean;
  onMotivo: (m: MotivoIA) => void;
  onEnviar: () => void;
  onCerrar: () => void;
}

export function DenunciaVista(p: DenunciaVistaProps) {
  return (
    <Sheet
      visible={p.visible}
      onClose={p.onCerrar}
      eyebrow={t('comun:denunciarRespuesta')}
      title={t('puertas:denuncia.titulo')}
      footer={
        <>
          {!p.enviada ? (
            <Button
              title={t('puertas:denuncia.enviar')}
              icon="flag-outline"
              size="lg"
              disabled={!p.motivo || p.ocupada}
              loading={p.ocupada}
              onPress={p.onEnviar}
            />
          ) : null}
          <Button
            title={p.enviada ? t('comun:cerrar') : t('comun:cancelar')}
            variant={p.enviada ? 'secondary' : 'ghost'}
            size={p.enviada ? 'lg' : 'md'}
            disabled={p.ocupada}
            onPress={p.onCerrar}
          />
        </>
      }
    >
      <Text style={texto.cuerpo} maxFontSizeMultiplier={1.6}>
        {t('puertas:denuncia.cuerpo')}
      </Text>

      {!p.enviada ? (
        <View style={styles.motivos}>
          <Text style={texto.etiqueta} maxFontSizeMultiplier={1.35}>
            {t('puertas:denuncia.motivo')}
          </Text>
          <View accessibilityRole="radiogroup" accessibilityLabel={t('puertas:denuncia.motivo')}>
            <ChipWrap>
              {MOTIVOS_IA.map((m) => (
                <Chip
                  key={m.value}
                  label={etiquetaMotivo(m.value)}
                  selected={p.motivo === m.value}
                  disabled={p.ocupada}
                  onPress={() => p.onMotivo(m.value)}
                />
              ))}
            </ChipWrap>
          </View>
        </View>
      ) : null}

      {p.aviso ? (
        <TarjetaArena variante={p.enviada ? 'contorno' : 'trama'} rotulo={p.enviada ? undefined : t('puertas:denuncia.noHaSalido')} style={styles.aviso}>
          <Text style={texto.mensaje} accessibilityRole="alert" selectable maxFontSizeMultiplier={1.6}>
            {p.aviso}
          </Text>
        </TarjetaArena>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  motivos: { marginTop: space.s5, gap: space.s3 },
  aviso: { marginTop: space.s5 },
});
