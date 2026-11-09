// NIVL · NIVL Pro. Se llega desde cualquier sitio con router.push('/pro').
//
// Dos caras de la misma pantalla: quien no tiene coach ve la oferta completa
// (ProOffer, con la prueba de 7 días si nunca la tuvo); quien ya lo tiene ve
// su plan y la energía que le queda este mes.
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
import { OfertaModosVista } from '@/components/modos/pago/OfertaModosVista';
import { useOfertaModos } from '@/components/modos/pago/useOfertaModos';
import { UsoIa } from '@/components/UsoIa';
import { PlanesWeb } from '@/components/web/PlanesWeb';
import { Barra, CargaArena, EncabezadoArena, Entrada, ErrorSistema, TarjetaArena } from '@/components/arena';
import { Button, Row, Screen, Section } from '@/components/ui';
import { vibrar } from '@/design/haptics';
import { t } from '@/i18n';
import { useAuth } from '@/lib/auth';
import { ensureProfile } from '@/lib/data';
import { isValidKey, nombreDia } from '@/lib/dates';
import {
  anotarOferta,
  copyUpsell,
  energiaAgotada,
  esMomento,
  energiaRestante,
  porcentajeIa,
  usoIa,
  fetchAiStatus,
  fetchDerechosModos,
  gestionarSuscripcion,
  isElite,
  isPro,
  MODOS_DE_PAGO,
  planDePago,
  planLabel,
  textoGestionTienda,
  purchasesAvailable,
  type AiStatus,
  type DerechosModos,
  type ModoDePago,
  type RespuestaOferta,
} from '@/lib/pro';
import { COACH_USAGE_NOTICE } from '@/lib/proplans';
import { fetchSubscription } from '@/lib/subscription';
import { ink, space, type as tipo, vidrio } from '@/design/tokens';
import { mensajeSistema } from '@/lib/validation';
import { NOMBRE_MODO } from '@/modos/tipos';
import { recargarDerechos } from '@/modos/useDerechos';

/** "jueves, 1 de octubre" a partir de una clave o de un ISO completo. */
function fechaLegible(valor: string | null | undefined): string | null {
  const key = valor?.slice(0, 10);
  if (!key || !isValidKey(key)) return null;
  return nombreDia(key).toLowerCase();
}

/** La oferta por modos como bloque: cuerpo, acciones y letra. */
function Oferta({
  kind,
  modoInicial,
  empezarEnTodos,
  actual,
  etiquetaSalida,
  onSalir,
  onComprado,
}: {
  kind: unknown;
  modoInicial: ModoDePago | null;
  empezarEnTodos?: boolean;
  actual?: string | null;
  etiquetaSalida: string;
  onSalir: () => void;
  onComprado: () => void;
}) {
  const oferta = useOfertaModos({ kind, modoInicial, empezarEnTodos, actual, onComprado });
  return <OfertaModosVista oferta={oferta} etiquetaSalida={etiquetaSalida} onSalir={onSalir} />;
}

export default function Pro() {
  const params = useLocalSearchParams<{ motivo?: string; tier?: string; modo?: string }>();
  const modoParam = MODOS_DE_PAGO.find((m) => m === params.modo) ?? null;
  const motivo = esMomento(params.motivo) ? params.motivo : null;
  const { session } = useAuth();
  const userId = session?.user.id;
  const [status, setStatus] = useState<AiStatus | null>(null);
  const [derechos, setDerechos] = useState<DerechosModos | null>(null);
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
    const [st, prof, sub, modos] = await Promise.allSettled([
      fetchAiStatus(),
      ensureProfile(userId),
      fetchSubscription(userId),
      fetchDerechosModos(),
    ]);
    if (st.status === 'fulfilled') setStatus(st.value);
    setDerechos(modos.status === 'fulfilled' ? modos.value : null);
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
        <EncabezadoArena onVolver={salir} eyebrow="NIVL" titulo="" />
        <CargaArena etiqueta="Cargando NIVL" formas={['rotulo', 'filas', 'tarjeta']} />
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
            <EncabezadoArena onVolver={salir} eyebrow="NIVL" titulo="Tu plan" />
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
    // Con la cartera del servidor (0078): el tope duro del mes, recargas incluidas. Sin ella, la energía de antes.
    const uso = usoIa(status);
    const queda = uso ? uso.queda : energiaRestante(status);
    const pct = uso ? porcentajeIa(uso.queda) : Math.round(queda * 100);
    const agotada = uso ? uso.nivel === 'agotada' : energiaAgotada(status);
    const recarga = fechaLegible(status?.renews);
    const renueva = fechaLegible(periodEnd);
    const prueba = !!status?.trial;
    // La prueba del anual es de la tienda: se guarda como cortesía, pero se
    // renueva y se cobra sola. Se dice y se gestiona como una compra.
    const pruebaTienda = prueba && !!derechos?.producto && (provider === 'apple' || provider === 'google');
    const dePago = pruebaTienda || (planDePago(status?.plan) && !prueba);
    // Élite ya no se vende, pero quien lo paga sigue viendo el plan que tiene.
    const elite = isElite(status) && !status?.trial;
    // Solo hay algo que vender a quien tiene una parte: Pro, Élite y los cuatro
    // ya lo tienen todo. Tampoco una segunda suscripción a quien paga por Stripe.
    // Sin saber sus modos (sin red), no se vende nada.
    const parcial = !!derechos && !derechos.todos;
    const mejorable = purchasesAvailable() && parcial && provider !== 'stripe';
    const nombreModos = derechos ? (derechos.todos ? t('oferta:pago.losCuatroModos') : derechos.modos.map((m) => NOMBRE_MODO[m]).join(', ')) : null;
    // Se gestiona en la tienda solo lo que se pagó en una tienda. En la web no
    // hay tienda que abrir: queda la nota de dónde se gestiona.
    const deTienda = Platform.OS !== 'web' && dePago && (provider === 'apple' || provider === 'google');
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
              eyebrow={elite ? 'NIVL Élite' : parcial ? nombreModos ?? 'NIVL' : 'NIVL Pro'}
              titulo="El coach está contigo."
              subtitulo={
                pruebaTienda
                  ? 'Tus días gratis. Al acabar, la tienda cobra tu plan salvo que lo canceles antes.'
                  : prueba
                    ? 'Tu prueba de 7 días. Brief, plan del día, entreno, dieta, revisión semanal y memoria. Al acabar no se cobra nada: no se renueva sola.'
                    : 'Brief, plan del día, entreno, dieta, revisión semanal y memoria. Todo activo.'
              }
            />
          </Entrada>

          {errorPlan}

          <Entrada indice={1}>
            <Section title={prueba ? 'Energía del coach este mes' : 'Tu coach'} meta={prueba ? `${pct} %` : undefined}>
              {prueba ? <Barra ratio={queda} alto={8} tono={agotada ? 'ink8' : 'blanco'} etiqueta={`Energía del coach: ${pct} %`} /> : null}
              <Text style={styles.energia}>
                {!prueba
                  ? COACH_USAGE_NOTICE
                  : agotada
                  ? `Agotada por este mes. ${recarga ? `Se recarga el ${recarga}.` : 'Se recarga el día 1.'} Tus misiones, tu racha y todos los módulos siguen funcionando.`
                  : `Queda el ${pct} % de lo que el coach puede pensar por ti este mes.${recarga ? ` Se recarga entera el ${recarga}.` : ''}`}
              </Text>
              <UsoIa status={status} onRecargada={() => void refrescar()} sinBarra />
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
                    <Text style={styles.planValor}>{prueba ? (status?.plan === 'prueba_auto' ? 'Prueba de NIVL Pro' : 'Prueba de 7 días') : planLabel(status?.plan ?? null)}</Text>
                  }
                />
                {nombreModos ? <Row title="Modos" trailing={<Text style={styles.valor}>{nombreModos}</Text>} /> : null}
                {renueva ? (
                  <Row title={dePago ? 'Próxima renovación' : 'Activo hasta'} trailing={<Text style={styles.valor}>{renueva}</Text>} />
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
                  <Oferta
                    kind={kind}
                    modoInicial={modoParam}
                    empezarEnTodos={!modoParam}
                    actual={derechos?.producto}
                    etiquetaSalida={t(prueba ? 'oferta:pago.salida.prueba' : 'oferta:pago.salida.plan')}
                    onSalir={() => {
                      responder('cerrada');
                      setVerOferta(false);
                    }}
                    onComprado={() => {
                      responder('compra');
                      setVerOferta(false);
                      void recargarDerechos(userId ?? null);
                      load();
                    }}
                  />
                </View>
              ) : (
                <Button
                  title={t(prueba ? 'oferta:pago.ver.suscribirme' : 'oferta:pago.ver.cuatro')}
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

  // En la web no se compra ni se enlaza a ninguna compra (ni Apple, ni Google,
  // ni Stripe todavía): «Planes» explica que la suscripción va por la app de
  // iPhone y enseña los planes en solo lectura (src/components/web/PlanesWeb).
  if (Platform.OS === 'web') {
    return <PlanesWeb kind={kind} onVolver={salir} refrescando={refreshing} onRefrescar={refrescar} />;
  }

  // Con motivo, la cabecera es la del momento; sin él, la de siempre. La prueba
  // se anuncia arriba solo si la cuenta puede empezarla.
  const cabecera = motivo ? copyUpsell(motivo, 'pro') : null;
  return (
    <Screen refreshing={refreshing} onRefresh={refrescar}>
      <>
        <Entrada indice={0}>
          <EncabezadoArena
            onVolver={salir}
            eyebrow={cabecera?.eyebrow ?? 'NIVL'}
            titulo={cabecera?.titulo ?? t('oferta:pago.titulo')}
            subtitulo={t('oferta:pago.subtitulo')}
          />
        </Entrada>
        {errorPlan}
        <Entrada indice={1}>
          <Oferta
            kind={kind}
            modoInicial={modoParam}
            etiquetaSalida={t('oferta:pago.salida.gratis')}
            onSalir={salir}
            onComprado={() => {
              responder('compra');
              void recargarDerechos(userId ?? null);
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
  oferta: { marginTop: 22, borderTopWidth: 1, borderTopColor: vidrio.linea, paddingTop: 18 },
});
