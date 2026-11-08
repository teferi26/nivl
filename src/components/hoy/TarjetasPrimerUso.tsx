// NIVL · Hoy: las dos peticiones que ya no se hacen al entrar. Solo aparecen
// cuando la persona ya ha hecho algo: el permiso de avisos (N4) y la firma.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { Button, Card } from '@/components/ui';
import { ink, space, type as tipo } from '@/design/tokens';
import { t } from '@/i18n';
import { fetchLetter } from '@/lib/contract';
import { estadoAvisos, inicializarAvisos } from '@/lib/notifications';
import { registrarDispositivo } from '@/lib/push';

const AVISOS_NO = 'nivl.hoy.avisos.ahora_no';
const FIRMA_NO = 'nivl.hoy.firma.ahora_no';

async function leer(clave: string): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(clave)) !== null;
  } catch {
    return false;
  }
}

async function apuntar(clave: string): Promise<void> {
  try {
    await AsyncStorage.setItem(clave, '1');
  } catch {
    // Sin almacenamiento, se volverá a preguntar.
  }
}

/** `listo`: ya ha completado algo hoy o lleva racha. */
export function TarjetasPrimerUso({ listo }: { listo: boolean }) {
  const [pedirAvisos, setPedirAvisos] = useState(false);
  const [pedirFirma, setPedirFirma] = useState(false);

  useEffect(() => {
    if (!listo) return;
    let vivo = true;
    (async () => {
      const [avisosNo, firmaNo, estado, carta] = await Promise.all([
        leer(AVISOS_NO),
        leer(FIRMA_NO),
        Platform.OS === 'web' ? null : estadoAvisos().catch(() => null),
        fetchLetter().catch(() => undefined),
      ]);
      if (!vivo) return;
      setPedirAvisos(!avisosNo && !!estado && !estado.permitido && estado.puedePreguntar);
      setPedirFirma(!firmaNo && carta === null);
    })();
    return () => {
      vivo = false;
    };
  }, [listo]);

  if (!listo || (!pedirAvisos && !pedirFirma)) return null;

  const activar = async () => {
    setPedirAvisos(false);
    await apuntar(AVISOS_NO);
    const ok = await inicializarAvisos();
    if (ok) await registrarDispositivo();
  };

  // De una en una: si faltan las dos, primero la firma, que es la que más pesa.
  if (pedirFirma) {
    return (
      <Tarjeta
        titulo={t('onboarding:embudo.tarjetas.firmaTitulo')}
        texto={t('onboarding:embudo.tarjetas.firmaTexto')}
        boton={t('onboarding:embudo.tarjetas.firmaBoton')}
        onBoton={() => router.push('/firma' as never)}
        onAhoraNo={() => {
          setPedirFirma(false);
          void apuntar(FIRMA_NO);
        }}
      />
    );
  }
  return (
    <Tarjeta
      titulo={t('onboarding:embudo.tarjetas.avisosTitulo')}
      texto={t('onboarding:embudo.tarjetas.avisosTexto')}
      boton={t('onboarding:embudo.tarjetas.avisosActivar')}
      onBoton={() => void activar()}
      onAhoraNo={() => {
        setPedirAvisos(false);
        void apuntar(AVISOS_NO);
      }}
    />
  );
}

function Tarjeta({ titulo, texto, boton, onBoton, onAhoraNo }: { titulo: string; texto: string; boton: string; onBoton: () => void; onAhoraNo: () => void }) {
  return (
    <Card variant="logro">
      <Text style={styles.titulo}>{titulo}</Text>
      <Text style={styles.texto}>{texto}</Text>
      <View style={styles.fila}>
        <Button title={boton} size="sm" onPress={onBoton} />
        <Button title={t('onboarding:embudo.tarjetas.ahoraNo')} size="sm" variant="ghost" onPress={onAhoraNo} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  titulo: { fontFamily: tipo.headline.family, fontSize: 17, lineHeight: 22, color: ink.ink9 },
  texto: { fontFamily: tipo.bodySm.family, fontSize: tipo.bodySm.size, lineHeight: tipo.bodySm.lineHeight, color: ink.ink8, marginTop: space.s1 },
  fila: { flexDirection: 'row', gap: space.s2, marginTop: space.s3, alignItems: 'center' },
});
