// NIVL · Mundo IRON: la puerta de los datos de salud en la piel de IRON.
// IRON es gym y dieta: cargas, cardio, peso corporal y comidas son datos de
// salud (art. 9 RGPD, privacidad 1.8). Sin el consentimiento explícito no se
// pinta nada de eso: esta pantalla lo pide.
//
// · `PuertaSaludIron` (pura) recibe lo mismo que PuertaSaludVista.
// · `GuardaSaludIron` es HealthConsentGuard con esta puerta: la misma regla
//   (ruta de salud y sin aceptar → puerta; si no, el contenido con la clave
//   de época) y las mismas acciones (revisar abre la hoja del permiso, que
//   pinta HealthConsentProvider).

import { router } from 'expo-router';
import type { PropsWithChildren, ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useHealthConsent } from '@/components/ConsentimientoSalud';
import { EmblemaMundo } from '@/components/modos/EmblemaMundo';
import { CabeceraMundo } from '@/components/modos/mundo/CabeceraMundo';
import { useMundo } from '@/components/modos/mundo/useMundo';
import type { PuertaSaludVistaProps } from '@/components/puertas/SaludVista';
import { t } from '@/i18n';
import { HEALTH_ROUTES } from '@/lib/healthmath';
import { GlifoIron, type Glifo } from './Glifos';
import { TarjetaHueco } from './Esqueletos';
import { BotonIron, CuadroIron, estilosIron, FilaIron, PantallaIron, RotuloIron, TarjetaIron } from './piezas';
import { C, M, px } from './tema';

const DATOS: readonly { glifo: Glifo; clave: 'pesos' | 'cardio' | 'peso' | 'dieta' }[] = [
  { glifo: 'pesa', clave: 'pesos' },
  { glifo: 'pulso', clave: 'cardio' },
  { glifo: 'bascula', clave: 'peso' },
  { glifo: 'plato', clave: 'dieta' },
];

export function PuertaSaludIron(p: PuertaSaludVistaProps & { cabecera: ReactNode }) {
  return (
    <PantallaIron centrado>
      {p.cabecera}
      <View style={styles.centro}>
      {p.cargando ? (
        <View accessibilityRole="progressbar" accessibilityLabel={t('puertas:salud.comprobandoA11y')}>
          <TarjetaHueco heroe lineas={6} />
        </View>
      ) : (
        <>
          <TarjetaIron heroe>
            <RotuloIron texto={p.borradoPendiente ? t('puertas:salud.borradoPendiente') : t('ironmundo:salud.rotulo')} />
            <Text style={estilosIron.titulo} accessibilityRole="header" maxFontSizeMultiplier={1.35}>
              {t('ironmundo:salud.titulo')}
            </Text>
            <Text style={[estilosIron.cuerpo, styles.arriba]} maxFontSizeMultiplier={1.6}>
              {p.borradoPendiente ? t('puertas:salud.borradoCuerpo') : t('puertas:salud.cuerpo')}
            </Text>
            <View style={styles.lista}>
              {DATOS.map((d, i) => (
                <FilaIron key={d.clave} primera={i === 0} style={styles.fila}>
                  <CuadroIron lado={px(30)} radio={px(8)}>
                    <GlifoIron nombre={d.glifo} lado={px(15)} color={C.blanco} />
                  </CuadroIron>
                  <Text style={[estilosIron.filaNombre, styles.flex]} maxFontSizeMultiplier={1.35}>
                    {t(`ironmundo:salud.${d.clave}`)}
                  </Text>
                </FilaIron>
              ))}
            </View>
            {p.error ? (
              <Text style={estilosIron.error} accessibilityRole="alert" maxFontSizeMultiplier={1.6}>
                {p.error}
              </Text>
            ) : null}
            <BotonIron
              titulo={p.error ? t('puertas:volverAComprobar') : t('puertas:salud.revisar')}
              fantasma={!!p.error}
              onPress={p.error ? p.onReintentar : p.onRevisar}
              desactivado={p.borradoPendiente}
            />
          </TarjetaIron>
          <BotonIron fantasma fino titulo={t('puertas:salud.irAPerfil')} onPress={p.onPerfil} />
          <Text style={[estilosIron.detalle, styles.nota]} maxFontSizeMultiplier={1.6}>
            {t('ironmundo:salud.nota')}
          </Text>
        </>
      )}
      </View>
    </PantallaIron>
  );
}

/** HealthConsentGuard con la puerta de IRON. */
export function GuardaSaludIron({ children, routeName }: PropsWithChildren<{ routeName: string }>) {
  const health = useHealthConsent();
  const mundo = useMundo('iron');
  if (!HEALTH_ROUTES.has(routeName) || health.accepted) {
    return (
      <View key={health.epoch} style={styles.flex}>
        {children}
      </View>
    );
  }
  return (
    <PuertaSaludIron
      cabecera={<CabeceraMundo modo="iron" nivel={mundo.nivel} emblema={<EmblemaMundo modo="iron" />} />}
      cargando={health.loading}
      error={health.error}
      borradoPendiente={health.erasurePending}
      onVolver={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}
      onRevisar={health.ask}
      onReintentar={() => void health.refresh()}
      onPerfil={() => router.push('/(tabs)/perfil')}
    />
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  arriba: { marginTop: px(6) },
  centro: { flex: 1, justifyContent: 'center', gap: M.hueco, paddingBottom: px(24) },
  lista: { marginTop: px(8), marginBottom: px(2) },
  fila: { paddingVertical: px(6), justifyContent: 'flex-start' },
  nota: { textAlign: 'center', marginTop: px(4) },
});
