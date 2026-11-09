// NIVL · Perfil > Televisores: enlazar un Apple TV escribiendo su código y ver
// o cortar los que ya tienen acceso (tv_mis_dispositivos y tv_revocar, 0125).

import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Campo } from '@/components/arena';
import { Button, Card, confirmar, Row, RowValue, Screen, ScreenHeader, Section, SkeletonRows, volver } from '@/components/ui';
import { ink, space, type as tipo } from '@/design/tokens';
import { t } from '@/i18n';
import { fechaCorta } from '@/i18n/formato';
import { codigoTvValido, codigoTvVisible, normalizarCodigoTv } from '@/lib/tvmath';
import { fetchTelevisores, revocarTelevisor, type Televisor } from '@/lib/tvEnlace';
import { mensajeSistema } from '@/lib/validation';

export default function Televisores() {
  const [codigo, setCodigo] = useState('');
  const [lista, setLista] = useState<Televisor[]>([]);
  const [cargado, setCargado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quitando, setQuitando] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      setLista(await fetchTelevisores());
      setError(null);
    } catch (e) {
      setError(mensajeSistema(e));
    } finally {
      setCargado(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void cargar();
    }, [cargar]),
  );

  const limpio = normalizarCodigoTv(codigo);
  const continuar = () => {
    setCodigo('');
    router.push({ pathname: '/tv/[codigo]', params: { codigo: limpio } });
  };

  const desenlazar = async (d: Televisor) => {
    const ok = await confirmar({
      titulo: t('perfil:televisores.quitar.titulo'),
      mensaje: t('perfil:televisores.quitar.mensaje', { nombre: d.nombre }),
      confirmar: t('perfil:televisores.quitar.confirmar'),
      cancelar: t('comun:cancelar'),
      destructivo: true,
    });
    if (!ok) return;
    setQuitando(d.id);
    setError(null);
    try {
      await revocarTelevisor(d.id);
      await cargar();
    } catch (e) {
      setError(mensajeSistema(e));
    } finally {
      setQuitando(null);
    }
  };

  return (
    <Screen>
      <ScreenHeader
        eyebrow={t('perfil:televisores.ceja')}
        title={t('perfil:televisores.titulo')}
        subtitle={t('perfil:televisores.subtitulo')}
        onBack={() => volver(router)}
      />

      <Section title={t('perfil:televisores.enlazarSeccion')}>
        <Campo
          etiqueta={t('perfil:televisores.codigoRotulo')}
          value={codigoTvVisible(codigo)}
          onChangeText={setCodigo}
          placeholder="XXXX-XXXX" // i18n-ok
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={9}
          returnKeyType="go"
          onSubmitEditing={codigoTvValido(limpio) ? continuar : undefined}
        />
        <Text style={styles.nota} maxFontSizeMultiplier={1.6}>
          {t('perfil:televisores.comoEnlazar')}
        </Text>
        <Button title={t('perfil:televisores.continuar')} size="lg" disabled={!codigoTvValido(limpio)} onPress={continuar} />
      </Section>

      {error ? (
        <Text style={styles.error} accessibilityLiveRegion="polite" maxFontSizeMultiplier={1.6}>
          {error}
        </Text>
      ) : null}

      <Section title={t('perfil:televisores.enlazados')} meta={cargado ? t('perfil:televisores.cuantos', { n: lista.length }) : undefined}>
        {!cargado ? (
          <View accessibilityRole="progressbar" accessibilityLabel={t('perfil:televisores.cargando')}>
            <SkeletonRows />
          </View>
        ) : lista.length > 0 ? (
          <Card padded={false} style={styles.filas}>
            {lista.map((d, i) => (
              <Row
                key={d.id}
                first={i === 0}
                title={d.nombre}
                detail={t('perfil:televisores.ultimoUso', { fecha: fechaCorta(d.ultimo_uso) })}
                trailing={<RowValue>{quitando === d.id ? '...' : t('perfil:televisores.quitar.confirmar')}</RowValue>}
                disabled={quitando !== null}
                onPress={() => void desenlazar(d)}
              />
            ))}
          </Card>
        ) : (
          <Text style={styles.nota} maxFontSizeMultiplier={1.6}>
            {t('perfil:televisores.ninguno')}
          </Text>
        )}
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  nota: { fontFamily: tipo.bodySm.family, fontSize: tipo.bodySm.size, lineHeight: tipo.bodySm.lineHeight, color: ink.ink8, marginVertical: space.s3 },
  error: { fontFamily: tipo.bodySm.family, fontSize: tipo.bodySm.size, lineHeight: tipo.bodySm.lineHeight, color: ink.ink10, marginBottom: space.s4 },
  filas: { paddingHorizontal: space.s4, paddingVertical: 2 },
});
