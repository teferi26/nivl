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
// 72 h tras un «Ahora no». Sin motivo solo se apunta el inicio de la prueba
// (como línea, sin gastar topes): es lo que permite ofrecer `fin_prueba` al
// acabar. La cabecera, con motivo, sale de COPY_UPSELL (`eyebrow`, `titulo`).

import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { ProOffer } from '@/components/ProOffer';
import { Barra, CargaArena, EncabezadoArena, Entrada, ErrorSistema, TarjetaArena } from '@/components/arena';
import { Button, Row, Screen, Section } from '@/components/ui';
import { vibrar } from '@/design/haptics';
import { useAuth } from '@/lib/auth';
import { ensureProfile } from '@/lib/data';
import { isValidKey, nombreDia } from '@/lib/dates';
import {
  anotarOferta,
  copyUpsell,
  energiaAgotada,
  esMomento,
  energiaRestante,
  fetchAiStatus,
  gestionarSuscripcion,
  isElite,
  isPro,
  LINEA_PRUEBA,
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
import { ink, space, type as tipo } from '@/design/tokens';
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
  // No se pudo leer el estado del coach (sin red, servidor caído). Sin estado
  // no se sabe si la cuenta ya paga: a quien paga nunca se le vende por un
  // fallo de red, así que sin estado no hay oferta, solo el error y la salida.
  const [errorEstado, setErrorEstado] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  // Quien llega desde una línea de upsell ya pidió ver la oferta: abierta.
  const [verOferta, setVerOferta] = useState(motivo !== null);
  // Una sola respuesta por visita: salir después de comprar no es un «Ahora no».
  const [respondida, setRespondida] = useState(false);
  const respondidaRef = useRef(false);

  const responder = (r: RespuestaOferta) => {
    if (!motivo || respondida || respondidaRef.current) return;
    respondidaRef.current = true;
    setRespondida(true);
    void anotarOferta(motivo, r, 'linea');
  };

  // Salir sin responder por cualquier camino (gesto atrás, botón atrás de
  // Android, cambiar de pestaña que desmonta) también es un «Ahora no»: así
  // arranca la pausa de 72 h y no se insiste.
  useEffect(() => {
    return () => {
      if (motivo && !respondidaRef.current) {
        respondidaRef.current = true;
        void anotarOferta(motivo, 'cerrada', 'linea');
      }
    };
  }, [motivo]);

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
    setErrorEstado(st.status === 'rejected');
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
    // huecos. Aún no se sabe qué cara toca: solo el eyebrow, sin un título
    // que luego salte a otro.
    return (
      <Screen>
        <EncabezadoArena onVolver={salir} eyebrow="NIVL Pro" titulo="" />
        <CargaArena etiqueta="Cargando NIVL Pro" formas={['rotulo', 'filas', 'tarjeta']} />
      </Screen>
    );
  }

  const errorPlan = errorEstado ? (
    <ErrorSistema
      compacto
      mensaje="No se ha podido comprobar tu plan."
      onReintentar={refrescar}
      reintentando={refreshing}
      style={styles.error}
    />
  ) : null;

  // Sin estado no hay cara que enseñar: ni la del plan (no se sabe cuál es) ni
  // la de venta (podría ser de alguien que ya paga). Solo el error y la salida.
  if (errorEstado && !status) {
    return (
      <Screen refreshing={refreshing} onRefresh={refrescar}>
        <>
          <Entrada indice={0}>
            <EncabezadoArena onVolver={salir} eyebrow="NIVL Pro" titulo="Tu plan" />
          </Entrada>
          <Entrada indice={1}>{errorPlan}</Entrada>
          <Entrada indice={2}>
            <Button title="Volver" variant="secondary" onPress={salir} />
          </Entrada>
        </>
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
        vibrar('penalizacion');
        setAvisoGestion(mensajeSistema(e));
      }
    };
    return (
      <Screen refreshing={refreshing} onRefresh={refrescar}>
        <>
          <Entrada indice={0}>
            <EncabezadoArena
              onVolver={salir}
              eyebrow={elite ? 'NIVL Élite' : 'NIVL Pro'}
              titulo="El coach está contigo."
              subtitulo={
                elite
                  ? 'Máxima potencia y modo profundo. Brief, plan del día, entreno, dieta, revisión semanal y memoria.'
                  : prueba
                    ? 'Tu prueba de 7 días. Brief, plan del día, entreno, dieta, revisión semanal y memoria. Al acabar no se cobra nada: no se renueva sola.'
                    : 'Brief, plan del día, entreno, dieta, revisión semanal y memoria. Todo activo.'
              }
            />
          </Entrada>

          {errorPlan}

          <Entrada indice={1}>
            <Section title="Energía del coach este mes" meta={`${pct} %`}>
              <Barra ratio={queda} alto={8} tono={agotada ? 'ink8' : 'blanco'} etiqueta={`Energía del coach: ${pct} %`} />
              <Text style={styles.energia}>
                {agotada
                  ? `Agotada por este mes. ${recarga ? `Se recarga el ${recarga}.` : 'Se recarga el día 1.'} Tus misiones, tu racha y todos los módulos siguen funcionando.`
                  : `Queda el ${pct} % de lo que el coach puede pensar por ti este mes.${recarga ? ` Se recarga entera el ${recarga}.` : ''}`}
              </Text>
            </Section>
          </Entrada>

          <Entrada indice={2}>
            <View style={styles.bloque}>
              <TarjetaArena variante="contorno" rotulo="Tu plan">
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
              </TarjetaArena>
              {deTienda ? (
                <>
                  <Button
                    title="Gestionar o cancelar suscripción"
                    variant="ghost"
                    size="md"
                    icon="open-outline"
                    onPress={gestionar}
                    style={styles.gestionar}
                  />
                  <Text style={styles.nota}>
                    Ahí cambias de plan, ves la renovación o la cancelas. {textoGestionTienda(Platform.OS)}
                  </Text>
                  {avisoGestion ? (
                    <Text style={[styles.nota, styles.aviso]} accessibilityRole="alert">
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
            </View>
          </Entrada>

          <Entrada indice={3}>
            {/* Una inversión por estado: con la oferta abierta, manda su acción. */}
            <Button
              title="Hablar con el coach"
              variant={mejorable && verOferta ? 'secondary' : 'primary'}
              icon="shield-half"
              onPress={() => router.replace('/(tabs)/coach')}
            />
          </Entrada>

          {/* Con la tienda abierta: quien está en la prueba puede suscribirse
              sin esperar a que acabe, y un Pro puede pasar a Élite (el cambio
              dentro del grupo de suscripción lo gestiona la tienda). */}
          {mejorable ? (
            <Entrada key={verOferta ? 'oferta' : 'boton'} indice={4}>
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
            </Entrada>
          ) : null}
        </>
      </Screen>
    );
  }

  // Con motivo, la cabecera es la del momento; sin él, la de siempre. La prueba
  // se anuncia arriba solo si la cuenta puede empezarla.
  const cabecera = motivo ? copyUpsell(motivo, tierParam ?? 'pro') : null;
  const conPrueba = status?.trialAvailable ? ` ${LINEA_PRUEBA}` : '';
  return (
    <Screen refreshing={refreshing} onRefresh={refrescar}>
      <>
        <Entrada indice={0}>
          <EncabezadoArena
            onVolver={salir}
            eyebrow={cabecera?.eyebrow ?? 'NIVL Pro'}
            titulo={cabecera?.titulo ?? 'Un coach que manda en tu día.'}
            subtitulo={`NIVL es gratis entera: misiones, racha, campañas, gym, dieta, economía, amigos. Pro añade el coach: la IA que lo dirige todo por ti.${conPrueba}`}
          />
        </Entrada>
        {errorPlan}
        <Entrada indice={1}>
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
              if (motivo) responder('prueba');
              else void anotarOferta('coach_cerrado', 'prueba', 'linea');
              load();
            }}
          />
        </Entrada>
      </>
    </Screen>
  );
}

/** Un estilo de la escala `type` (SISTEMA §2) como estilo de texto. */
const texto = (t: (typeof tipo)[keyof typeof tipo]) => ({
  fontFamily: t.family,
  fontSize: t.size,
  lineHeight: t.lineHeight,
  letterSpacing: t.tracking,
});

const styles = StyleSheet.create({
  error: { marginBottom: space.s5 },
  energia: { ...texto(tipo.body), color: ink.ink8, marginTop: 10 },
  bloque: { marginBottom: 26 },
  valor: { ...texto(tipo.bodySm), color: ink.ink9 },
  // El plan es el dato fuerte: misma talla, peso de headline.
  planValor: { ...texto(tipo.bodySm), fontFamily: tipo.headline.family, color: ink.ink9 },
  nota: { ...texto(tipo.bodySm), color: ink.ink6, marginTop: 4 },
  // Aviso: regla izquierda de 2 pt ink6, no color (el mismo de la oferta).
  aviso: { color: ink.ink9, borderLeftWidth: 2, borderLeftColor: ink.ink6, paddingLeft: 10, marginTop: 8 },
  mejorar: { marginTop: 10 },
  gestionar: { marginTop: 8, alignSelf: 'flex-start' },
  oferta: { marginTop: 22, borderTopWidth: 1, borderTopColor: ink.ink3, paddingTop: 18 },
});
