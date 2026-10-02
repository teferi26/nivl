// NIVL · NIVL Pro y Élite. Se llega desde cualquier sitio con router.push('/pro').
//
// Dos caras de la misma pantalla: quien no tiene coach ve la oferta completa
// (ProOffer, con la prueba de 7 días si nunca la tuvo); quien ya lo tiene ve
// su plan, la energía que le queda este mes y, en Élite, sus turnos profundos.
// La energía es el presupuesto de IA del candado (0020) enseñado SIEMPRE como
// porcentaje: los dólares son cosa nuestra, no del usuario.
//
// Fase 2 (D1): `/pro?motivo=…&tier=…` llega desde una línea de upsell o desde
// una hoja decidida por `ofrecerSi`. El motivo pone su contexto en la oferta y
// el nivel la abre en Pro o Élite. Al salir, comprar o empezar la prueba se
// apunta la respuesta (`anotarOferta`): es lo que hace respetar los topes y las
// 72 h tras un «Ahora no». Sin motivo, la pantalla no apunta nada.

import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { ProOffer } from '@/components/ProOffer';
import { XPBar } from '@/components/XPBar';
import { Button, Card, FadeIn, Row, Screen, ScreenHeader, Section, Skeleton, Stagger } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { ensureProfile } from '@/lib/data';
import { isValidKey, nombreDia } from '@/lib/dates';
import {
  anotarOferta,
  energiaAgotada,
  esMomento,
  energiaRestante,
  fetchAiStatus,
  gestionarSuscripcion,
  isElite,
  isPro,
  lineaProfundos,
  planDePago,
  planLabel,
  productoDePlan,
  textoGestionTienda,
  puedeProfundo,
  purchasesAvailable,
  puedeMejorarEnTienda,
  turnosProfundos,
  type AiStatus,
  type OfferTier,
  type RespuestaOferta,
} from '@/lib/pro';
import { fetchSubscription } from '@/lib/subscription';
import { ink, type as tipo } from '@/design/tokens';
import { mensajeSistema } from '@/lib/validation';

/** "jueves, 1 de octubre" a partir de una clave o de un ISO completo. */
function fechaLegible(valor: string | null | undefined): string | null {
  const key = valor?.slice(0, 10);
  if (!key || !isValidKey(key)) return null;
  return nombreDia(key).toLowerCase();
}

export default function Pro() {
  const params = useLocalSearchParams<{ motivo?: string; tier?: string }>();
  const motivo = esMomento(params.motivo) ? params.motivo : null;
  const tierParam: OfferTier | undefined = params.tier === 'elite' || params.tier === 'pro' ? params.tier : undefined;
  const { session } = useAuth();
  const userId = session?.user.id;
  const [status, setStatus] = useState<AiStatus | null>(null);
  const [kind, setKind] = useState<unknown>('general');
  const [periodEnd, setPeriodEnd] = useState<string | null>(null);
  const [provider, setProvider] = useState<string | null>(null);
  const [avisoGestion, setAvisoGestion] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  // Quien llega desde una línea de upsell ya pidió ver la oferta: abierta.
  const [verOferta, setVerOferta] = useState(motivo !== null);
  // Una sola respuesta por visita: salir después de comprar no es un «Ahora no».
  const [respondida, setRespondida] = useState(false);

  const responder = (r: RespuestaOferta) => {
    if (!motivo || respondida) return;
    setRespondida(true);
    void anotarOferta(motivo, r, 'linea');
  };

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
    if (sub.status === 'fulfilled') {
      setPeriodEnd(sub.value?.current_period_end ?? null);
      setProvider(sub.value?.provider ?? null);
    }
    setLoading(false);
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const salir = () => {
    responder('cerrada');
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
    const prueba = !!status?.trial;
    const dePago = planDePago(status?.plan) && !prueba;
    const elite = isElite(status);
    const conProfundo = !!status?.deepAllowed;
    const turnos = turnosProfundos(status);
    // Sin segunda suscripción: ni al Élite/dueño, ni a quien paga por Stripe
    // (web) o con plan heredado de Stripe. La tienda decide el resto.
    const mejorable = purchasesAvailable() && puedeMejorarEnTienda(status, provider);
    // Se gestiona en la tienda solo lo que se pagó en una tienda.
    const deTienda = dePago && (provider === 'apple' || provider === 'google');
    const gestionar = async () => {
      setAvisoGestion(null);
      try {
        await gestionarSuscripcion();
      } catch (e) {
        setAvisoGestion(mensajeSistema(e));
      }
    };
    return (
      <Screen refreshing={refreshing} onRefresh={refrescar}>
        <Stagger>
          <FadeIn index={0}>
            <ScreenHeader
              onBack={salir}
              eyebrow={elite ? 'NIVL Élite' : 'NIVL Pro'}
              title="El coach está contigo."
              subtitle={
                elite
                  ? 'Máxima potencia y modo profundo. Brief, plan del día, entreno, dieta, revisión semanal y memoria.'
                  : prueba
                    ? 'Tu prueba de 7 días. Brief, plan del día, entreno, dieta, revisión semanal y memoria.'
                    : 'Brief, plan del día, entreno, dieta, revisión semanal y memoria. Todo activo.'
              }
            />
          </FadeIn>

          <FadeIn index={1}>
            <Section title="Energía del coach este mes" meta={`${pct} %`}>
              <XPBar ratio={queda} height={8} color={agotada ? ink.ink6 : ink.ink10} trackColor={ink.ink4} />
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
                <Row
                  first
                  title="Plan"
                  trailing={
                    // RowValue por defecto pinta en ink6 y en Cinzel: el plan es el dato fuerte, en ink9.
                    <Text style={styles.planValor}>{prueba ? 'Prueba de 7 días' : planLabel(status?.plan ?? null)}</Text>
                  }
                />
                {renueva ? (
                  <Row title={dePago ? 'Próxima renovación' : 'Activo hasta'} trailing={<Text style={styles.valor}>{renueva}</Text>} />
                ) : null}
                {/* La prueba no se recarga: acaba. La fila de "Activo hasta" ya lo dice. */}
                {recarga && !prueba ? (
                  <Row title="Recarga de energía" trailing={<Text style={styles.valor}>{recarga}</Text>} />
                ) : null}
                {conProfundo ? (
                  <Row
                    title="Turnos profundos"
                    detail={lineaProfundos(status)}
                    trailing={<Text style={styles.valor}>{puedeProfundo(status) ? turnos : 'Agotados'}</Text>}
                  />
                ) : null}
              </Card>
              {deTienda ? (
                <>
                  <Button
                    title="Gestionar o cancelar suscripción"
                    variant="ghost"
                    size="sm"
                    icon="open-outline"
                    onPress={gestionar}
                    style={styles.gestionar}
                  />
                  <Text style={styles.nota}>
                    Ahí cambias de plan, ves la renovación o la cancelas. {textoGestionTienda(Platform.OS)}
                  </Text>
                  {avisoGestion ? (
                    <Text style={styles.nota} accessibilityRole="alert">
                      {avisoGestion}
                    </Text>
                  ) : null}
                </>
              ) : dePago ? (
                <Text style={styles.nota}>
                  {provider === 'stripe'
                    ? 'Esta suscripción se contrató fuera de esta app: se gestiona y se cancela desde donde la contrataste.'
                    : textoGestionTienda(Platform.OS)}
                </Text>
              ) : null}
            </Section>
          </FadeIn>

          <FadeIn index={3}>
            <Button title="Hablar con el coach" variant="primary" icon="shield-half" onPress={() => router.replace('/(tabs)/coach')} />
          </FadeIn>

          {/* Con la tienda abierta: quien está en la prueba puede suscribirse
              sin esperar a que acabe, y un Pro puede pasar a Élite (el cambio
              dentro del grupo de suscripción lo gestiona la tienda). */}
          {mejorable ? (
            <FadeIn index={4}>
              {verOferta ? (
                <View style={styles.oferta}>
                  <ProOffer
                    userId={userId}
                    kind={kind}
                    compact
                    initialTier={prueba ? (tierParam ?? 'pro') : 'elite'}
                    motivo={motivo}
                    planActual={deTienda ? productoDePlan(status?.plan) : null}
                    exitLabel={prueba ? 'Seguir con la prueba' : 'Seguir con Pro'}
                    onExit={() => {
                      responder('cerrada');
                      setVerOferta(false);
                    }}
                    onPurchased={() => {
                      responder('compra');
                      setVerOferta(false);
                      load();
                    }}
                  />
                </View>
              ) : (
                <Button
                  title={prueba ? 'Suscribirme' : 'Ver NIVL Élite'}
                  variant="secondary"
                  onPress={() => setVerOferta(true)}
                  style={styles.mejorar}
                />
              )}
            </FadeIn>
          ) : null}
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
          <ProOffer
            userId={userId}
            kind={kind}
            initialTier={tierParam}
            motivo={motivo}
            exitLabel="Seguir gratis"
            onExit={salir}
            onPurchased={() => {
              responder('compra');
              load();
            }}
            trialAvailable={!!status?.trialAvailable}
            onTrialStarted={() => {
              responder('prueba');
              load();
            }}
          />
        </FadeIn>
      </Stagger>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hueco: { marginBottom: 18 },
  huecoLinea: { marginBottom: 12 },
  huecoBloque: { marginTop: 14 },
  energia: { fontFamily: tipo.body.family, fontSize: tipo.body.size, lineHeight: tipo.body.lineHeight, color: ink.ink8, marginTop: 10 },
  lista: { paddingHorizontal: 16, paddingVertical: 2 },
  valor: { fontFamily: 'Outfit_600SemiBold', fontSize: 13, color: ink.ink9 },
  planValor: { fontFamily: tipo.headline.family, fontSize: 14, color: ink.ink9 },
  nota: { fontFamily: tipo.bodySm.family, fontSize: tipo.bodySm.size, lineHeight: tipo.bodySm.lineHeight, color: ink.ink6, marginTop: 4 },
  mejorar: { marginTop: 10 },
  gestionar: { marginTop: 8, alignSelf: 'flex-start' },
  oferta: { marginTop: 22, borderTopWidth: 1, borderTopColor: ink.ink3, paddingTop: 18 },
});
