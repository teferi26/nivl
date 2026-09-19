// NIVL · NIVL Pro. Se llega desde cualquier sitio con router.push('/pro').
//
// Dos caras de la misma pantalla: quien no tiene coach ve la oferta completa
// (ProOffer); quien ya lo tiene ve su plan y la energía que le queda este mes.
// La energía es el presupuesto de IA del candado (0020) enseñado SIEMPRE como
// porcentaje: los dólares son cosa nuestra, no del usuario.

import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ProOffer } from '@/components/ProOffer';
import { SystemButton } from '@/components/SystemButton';
import { XPBar } from '@/components/XPBar';
import { Card, FadeIn, Row, RowValue, Screen, ScreenHeader, Section, Skeleton, Stagger } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { ensureProfile } from '@/lib/data';
import { isValidKey, nombreDia } from '@/lib/dates';
import { energiaAgotada, energiaRestante, fetchAiStatus, isPro, planLabel, type AiStatus } from '@/lib/pro';
import { fetchSubscription } from '@/lib/subscription';
import { colors, fonts } from '@/lib/theme';

/** "jueves, 1 de octubre" a partir de una clave o de un ISO completo. */
function fechaLegible(valor: string | null | undefined): string | null {
  const key = valor?.slice(0, 10);
  if (!key || !isValidKey(key)) return null;
  return nombreDia(key).toLowerCase();
}

export default function Pro() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const [status, setStatus] = useState<AiStatus | null>(null);
  const [kind, setKind] = useState<unknown>('general');
  const [periodEnd, setPeriodEnd] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    // Sin sesión no hay nada que leer, pero la pantalla no puede quedarse
    // cargando para siempre: antes este return dejaba el spinner infinito.
    if (!userId) {
      setLoading(false);
      return;
    }
    // Cada lectura falla por su cuenta: sin red, la oferta se pinta igual con
    // el perfil general. Una pantalla de venta nunca se queda en blanco.
    const [st, prof, sub] = await Promise.allSettled([fetchAiStatus(), ensureProfile(userId), fetchSubscription(userId)]);
    if (st.status === 'fulfilled') setStatus(st.value);
    if (prof.status === 'fulfilled') setKind(prof.value.profile_kind);
    if (sub.status === 'fulfilled') setPeriodEnd(sub.value?.current_period_end ?? null);
    setLoading(false);
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const salir = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)');
  };

  const refrescar = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  if (loading) {
    // La cabecera (con su vuelta atrás) desde el primer fotograma; debajo,
    // huecos. Aún no se sabe qué cara toca, así que el título es neutro.
    return (
      <Screen>
        <ScreenHeader onBack={salir} eyebrow="NIVL Pro" title="El coach" />
        <View accessibilityRole="progressbar" accessibilityLabel="Cargando NIVL Pro">
          <Skeleton height={64} style={styles.hueco} />
          <Skeleton height={14} width="82%" style={styles.huecoLinea} />
          <Skeleton height={14} width="68%" style={styles.huecoLinea} />
          <Skeleton height={14} width="74%" style={styles.huecoLinea} />
          <Skeleton height={120} style={styles.huecoBloque} />
          <Skeleton height={56} style={styles.huecoBloque} />
        </View>
      </Screen>
    );
  }

  if (isPro(status)) {
    const queda = energiaRestante(status);
    const pct = Math.round(queda * 100);
    const agotada = energiaAgotada(status);
    const recarga = fechaLegible(status?.renews);
    const renueva = fechaLegible(periodEnd);
    const dePago = status?.plan === 'mensual' || status?.plan === 'anual';
    return (
      <Screen refreshing={refreshing} onRefresh={refrescar}>
        <Stagger>
          <FadeIn index={0}>
            <ScreenHeader
              onBack={salir}
              eyebrow="NIVL Pro"
              title="El coach está contigo."
              subtitle="Brief, plan del día, entreno, dieta, revisión semanal y memoria. Todo activo."
            />
          </FadeIn>

          <FadeIn index={1}>
            <Section title="Energía del coach este mes" meta={`${pct} %`}>
              <XPBar ratio={queda} height={8} color={agotada ? colors.accentDim : colors.accent} />
              <Text style={styles.energia}>
                {agotada
                  ? `Agotada por este mes. ${recarga ? `Se recarga el ${recarga}.` : 'Se recarga el día 1.'} Tus misiones, tu racha y todos los módulos siguen funcionando.`
                  : `Queda el ${pct} % de lo que el coach puede pensar por ti este mes.${recarga ? ` Se recarga entera el ${recarga}.` : ''}`}
              </Text>
            </Section>
          </FadeIn>

          <FadeIn index={2}>
            <Section title="Tu plan">
              <Card padded={false} style={styles.lista}>
                <Row first title="Plan" trailing={<RowValue tone="accent" strong>{planLabel(status?.plan ?? null)}</RowValue>} />
                {renueva ? (
                  <Row title={dePago ? 'Próxima renovación' : 'Activo hasta'} trailing={<Text style={styles.valor}>{renueva}</Text>} />
                ) : null}
                {recarga ? <Row title="Recarga de energía" trailing={<Text style={styles.valor}>{recarga}</Text>} /> : null}
              </Card>
              {dePago ? (
                <Text style={styles.nota}>
                  La suscripción se gestiona y se cancela en los ajustes de suscripciones de tu tienda (App Store o
                  Google Play).
                </Text>
              ) : null}
            </Section>
          </FadeIn>

          <FadeIn index={3}>
            <SystemButton title="Hablar con el coach" icon="shield-half" onPress={() => router.replace('/(tabs)/coach')} />
          </FadeIn>
        </Stagger>
      </Screen>
    );
  }

  return (
    <Screen refreshing={refreshing} onRefresh={refrescar}>
      <Stagger>
        <FadeIn index={0}>
          <ScreenHeader
            onBack={salir}
            eyebrow="NIVL Pro"
            title="Un coach que manda en tu día."
            subtitle="NIVL es gratis entera: misiones, racha, campañas, gym, dieta, economía, amigos. Pro añade el coach: la IA que lo dirige todo por ti."
          />
        </FadeIn>
        <FadeIn index={1}>
          <ProOffer userId={userId} kind={kind} exitLabel="Seguir gratis" onExit={salir} onPurchased={load} />
        </FadeIn>
      </Stagger>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hueco: { marginBottom: 18 },
  huecoLinea: { marginBottom: 12 },
  huecoBloque: { marginTop: 14 },
  energia: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 20, color: colors.textDim, marginTop: 10 },
  lista: { paddingHorizontal: 16, paddingVertical: 2 },
  valor: { fontFamily: fonts.semibold, fontSize: 13, color: colors.text },
  nota: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.textFaint, marginTop: 4 },
});
