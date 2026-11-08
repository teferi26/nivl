// NIVL · /empezar: la entrada de quien aún no tiene cuenta. La portada y el
// cuestionario no piden nada a cambio; las respuestas se quedan en el teléfono
// hasta que hay cuenta (el onboarding las recoge).

import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Cuestionario } from '@/components/embudo/Cuestionario';
import { Portada } from '@/components/embudo/Portada';
import { FondoOnix } from '@/components/ui';
import { registrar } from '@/lib/analitica';
import type { Respuestas } from '@/lib/embudo';
import { guardarRespuestas, leerRespuestas } from '@/lib/embudoGuardado';
import { colors } from '@/lib/theme';

export default function Empezar() {
  const [dentro, setDentro] = useState(false);
  const [previas, setPrevias] = useState<Respuestas | null>(null);

  useEffect(() => {
    leerRespuestas().then(setPrevias).catch(() => {});
  }, []);

  const terminar = (r: Respuestas) => {
    void guardarRespuestas(r);
    registrar('registro', { resultado: 'cuestionario' });
    router.push({ pathname: '/login', params: { modo: 'signup', desde: 'plan' } });
  };

  return (
    <SafeAreaView style={styles.pantalla}>
      <FondoOnix />
      {dentro ? (
        <Cuestionario inicial={previas} onTerminar={terminar} onSalir={() => setDentro(false)} />
      ) : (
        <Portada onCrear={() => setDentro(true)} onEntrar={() => router.push({ pathname: '/login', params: { modo: 'signin' } })} />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colors.bg },
});
