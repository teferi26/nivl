// NIVL · nivl://tv/XXXX-XXXX: confirmar el enlace de un Apple TV.
//
// La abre el QR de la TV o el código escrito en /tv. Ruta con sesión: sin ella
// la puerta manda a /login y hay que volver a escanear, porque un enlace de TV
// no debe sobrevivir a un login.
//
// Es la barrera contra el robo por código: alguien puede enseñarte su código
// para que le abras tu cuenta. Por eso el aviso va antes que el botón y, al
// aprobar, queda una notificación con dónde cortarlo.

import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { Button, Card, Screen, ScreenHeader, volver } from '@/components/ui';
import { ink, space, type as tipo } from '@/design/tokens';
import { t } from '@/i18n';
import { avisarEn } from '@/lib/notifications';
import { codigoTvValido, codigoTvVisible, normalizarCodigoTv } from '@/lib/tvmath';
import { responderCodigoTv, type MotivoTv } from '@/lib/tvEnlace';
import { mensajeSistema } from '@/lib/validation';

type Fase = 'confirmar' | 'enviando' | 'hecho' | 'rechazado';

/** El aviso llega un momento después: quien aprobó por error ya no está mirando esta pantalla. */
const AVISO_MS = 2 * 60 * 1000;

function textoMotivo(motivo: MotivoTv | undefined): string {
  if (motivo === 'demasiados_intentos') return t('perfil:televisores.motivo.intentos');
  if (motivo === 'tope_tv') return t('perfil:televisores.motivo.tope');
  if (motivo === 'borrado_pendiente') return t('perfil:televisores.motivo.borrado');
  return t('perfil:televisores.motivo.invalido');
}

export default function ConfirmarTv() {
  const params = useLocalSearchParams<{ codigo: string }>();
  const codigo = normalizarCodigoTv(params.codigo);
  const valido = codigoTvValido(codigo);

  const [fase, setFase] = useState<Fase>('confirmar');
  const [error, setError] = useState<string | null>(null);
  const [topeLleno, setTopeLleno] = useState(false);
  const [nombreTv, setNombreTv] = useState<string | null>(null);

  const responder = async (accion: 'aprobar' | 'rechazar') => {
    setFase('enviando');
    setError(null);
    setTopeLleno(false);
    try {
      const r = await responderCodigoTv(accion, codigo);
      if (!r.ok) {
        setError(textoMotivo(r.reason));
        setTopeLleno(r.reason === 'tope_tv');
        setFase('confirmar');
        return;
      }
      if (accion === 'aprobar') {
        setNombreTv(r.nombre ?? null);
        setFase('hecho');
        void avisarEn(
          `tv-enlazado-${codigo}`,
          new Date(Date.now() + AVISO_MS),
          t('perfil:televisores.aviso.titulo'),
          t('perfil:televisores.aviso.cuerpo', { nombre: r.nombre ?? t('perfil:televisores.nombrePorDefecto') }),
          '/tv',
        );
      } else {
        setFase('rechazado');
      }
    } catch (e) {
      setError(mensajeSistema(e));
      setFase('confirmar');
    }
  };

  const salir = () => volver(router);
  const verTelevisores = () => router.replace('/tv');
  const enviando = fase === 'enviando';

  return (
    <Screen>
      <ScreenHeader eyebrow={t('perfil:televisores.ceja')} title={t('perfil:televisores.confirmar.titulo')} onBack={salir} />

      {!valido ? (
        <>
          <Card variant="outline">
            <Text style={styles.cuerpo} maxFontSizeMultiplier={1.6}>
              {t('perfil:televisores.confirmar.noValido')}
            </Text>
          </Card>
          <Button title={t('perfil:televisores.verTelevisores')} variant="secondary" size="lg" style={styles.segundo} onPress={verTelevisores} />
        </>
      ) : fase === 'hecho' ? (
        <>
          <Card variant="outline">
            <Text style={styles.titular} maxFontSizeMultiplier={1.6}>
              {t('perfil:televisores.confirmar.hechoTitulo')}
            </Text>
            <Text style={styles.cuerpo} maxFontSizeMultiplier={1.6}>
              {t('perfil:televisores.confirmar.hechoCuerpo', { nombre: nombreTv ?? t('perfil:televisores.nombrePorDefecto') })}
            </Text>
          </Card>
          <Button title={t('perfil:televisores.verTelevisores')} variant="secondary" size="lg" style={styles.segundo} onPress={verTelevisores} />
        </>
      ) : fase === 'rechazado' ? (
        <>
          <Card variant="outline">
            <Text style={styles.titular} maxFontSizeMultiplier={1.6}>
              {t('perfil:televisores.confirmar.rechazadoTitulo')}
            </Text>
            <Text style={styles.cuerpo} maxFontSizeMultiplier={1.6}>
              {t('perfil:televisores.confirmar.rechazadoCuerpo')}
            </Text>
          </Card>
          <Button title={t('comun:volver')} variant="secondary" size="lg" style={styles.segundo} onPress={salir} />
        </>
      ) : (
        <>
          <Text style={styles.titular} maxFontSizeMultiplier={1.6}>
            {t('perfil:televisores.confirmar.vasA')}
          </Text>
          <Text
            style={styles.codigo}
            maxFontSizeMultiplier={1.4}
            accessibilityLabel={t('perfil:televisores.confirmar.codigoA11y', { codigo: codigo.split('').join(' ') })}
          >
            {codigoTvVisible(codigo)}
          </Text>
          <Card variant="outline" style={styles.aviso}>
            <Text style={styles.cuerpo} maxFontSizeMultiplier={1.6}>
              {t('perfil:televisores.confirmar.advertencia')}
            </Text>
          </Card>
          {error ? (
            <Text style={styles.error} accessibilityLiveRegion="polite" maxFontSizeMultiplier={1.6}>
              {error}
            </Text>
          ) : null}
          {topeLleno ? <Button title={t('perfil:televisores.verTelevisores')} variant="secondary" size="lg" style={styles.separado} onPress={verTelevisores} /> : null}
          <Button
            title={t('perfil:televisores.confirmar.enlazar')}
            size="lg"
            loading={enviando}
            disabled={enviando}
            onPress={() => void responder('aprobar')}
          />
          <Button
            title={t('perfil:televisores.confirmar.noHeSidoYo')}
            variant="ghost"
            size="lg"
            disabled={enviando}
            style={styles.segundo}
            onPress={() => void responder('rechazar')}
          />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  titular: { fontFamily: tipo.headline.family, fontSize: tipo.headline.size, lineHeight: tipo.headline.lineHeight, color: ink.ink10, marginBottom: space.s3 },
  cuerpo: { fontFamily: tipo.body.family, fontSize: tipo.body.size, lineHeight: tipo.body.lineHeight, color: ink.ink8 },
  codigo: { fontFamily: tipo.rank.family, fontSize: tipo.rank.size, lineHeight: tipo.rank.lineHeight, letterSpacing: tipo.rank.tracking, color: ink.ink10, textAlign: 'center', marginVertical: space.s6 },
  aviso: { marginBottom: space.s5 },
  error: { fontFamily: tipo.bodySm.family, fontSize: tipo.bodySm.size, lineHeight: tipo.bodySm.lineHeight, color: ink.ink10, marginBottom: space.s4 },
  segundo: { marginTop: space.s3 },
  separado: { marginBottom: space.s3 },
});
