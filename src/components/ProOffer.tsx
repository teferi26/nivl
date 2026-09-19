// NIVL · La oferta de NIVL Pro: qué hace el coach, los dos planes, la acción y
// la letra pequeña. La comparten la pantalla `/pro` y el último paso del
// onboarding (`compact`), para que el precio y las condiciones no puedan
// decir una cosa en un sitio y otra en otro.
//
// Reglas de esta pieza, que no son de estilo: nada de urgencia falsa, ni
// cuentas atrás, ni testimonios; la salida gratuita pesa lo mismo que la
// compra; y mientras la tienda no esté conectada (`purchasesAvailable()`), el
// botón apunta el interés y lo dice, en vez de fingir un cobro: sin selector
// de plan, sin "restaurar compras" y sin letra de renovación automática.

import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useRef, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { SystemButton } from '@/components/SystemButton';
import { Card, Tag } from '@/components/ui';
import { insertEvent } from '@/lib/data';
import {
  DEFAULT_PLAN,
  LEGAL_URLS,
  PRO_BENEFITS,
  PRO_PLANS,
  legalText,
  proEmphasis,
  proPlan,
  purchase,
  purchasesAvailable,
  restorePurchases,
  type ProPlanId,
} from '@/lib/pro';
import { colors, fonts } from '@/lib/theme';
import { mensajeSistema } from '@/lib/validation';

interface OfferOptions {
  userId?: string;
  /** Tras una compra o una restauración confirmadas por la tienda. */
  onPurchased?: () => void;
}

/**
 * El estado de la oferta, separado de su pintura. Existe para que el
 * onboarding pueda poner el cuerpo dentro de su scroll y los dos botones en un
 * pie fijo (en un móvil de 667 pt, si no, no se veía ningún botón sin bajar) y
 * que aun así compartan plan elegido, cerrojo y avisos.
 */
export function useProOffer({ userId, onPurchased }: OfferOptions) {
  const [planId, setPlanId] = useState<ProPlanId>(DEFAULT_PLAN);
  const [busy, setBusy] = useState<'compra' | 'restaurar' | null>(null);
  const [anotado, setAnotado] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const lock = useRef(false);

  const disponible = purchasesAvailable();
  const plan = proPlan(planId);

  const conCerrojo = async (que: 'compra' | 'restaurar', fn: () => Promise<void>) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(que);
    setAviso(null);
    try {
      await fn();
    } catch (e) {
      setAviso(mensajeSistema(e));
    } finally {
      lock.current = false;
      setBusy(null);
    }
  };

  const onPrincipal = () =>
    conCerrojo('compra', async () => {
      if (disponible) {
        await purchase(planId);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        onPurchased?.();
        return;
      }
      // Sin tienda todavía: se apunta el interés en los eventos de la cuenta.
      // No hay tabla nueva ni cobro, y tampoco plan: sin tienda no se elige.
      if (userId) await insertEvent(userId, 'pro_interest', { plan: null });
      setAnotado(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    });

  const onRestaurar = () =>
    conCerrojo('restaurar', async () => {
      await restorePurchases();
      onPurchased?.();
    });

  const elegir = (id: ProPlanId) => {
    Haptics.selectionAsync().catch(() => {});
    setPlanId(id);
  };

  // Aviso propio, pintado junto a los enlaces: el de la compra sale encima de
  // los botones, demasiado lejos de donde se ha tocado.
  const [avisoEnlace, setAvisoEnlace] = useState(false);
  const abrir = (url: string) => {
    setAvisoEnlace(false);
    Linking.openURL(url).catch(() => setAvisoEnlace(true));
  };

  return { planId, plan, busy, anotado, aviso, avisoEnlace, disponible, elegir, onPrincipal, onRestaurar, abrir };
}

export type ProOfferState = ReturnType<typeof useProOffer>;

interface BodyProps {
  oferta: ProOfferState;
  /** `profile.profile_kind`: decide la línea de énfasis. */
  kind: unknown;
  /** Versión condensada para el onboarding: beneficios a dos columnas, sin énfasis. */
  compact?: boolean;
}

/** Qué hace el coach y cuánto cuesta. Sin botones. */
export function ProOfferBody({ oferta, kind, compact }: BodyProps) {
  const { planId, disponible, elegir } = oferta;
  return (
    <View>
      {compact ? null : (
        <Card variant="outline" accent={colors.accentDim}>
          <Text style={styles.emphasis}>{proEmphasis(kind)}</Text>
        </Card>
      )}

      {compact ? (
        <View style={styles.benefitGrid}>
          {PRO_BENEFITS.map((b) => (
            <View key={b.title} style={styles.benefitCell}>
              <Ionicons name={b.icon as never} size={15} color={colors.accentText} style={styles.benefitIcon} />
              <Text style={styles.benefitCellTitle} numberOfLines={2}>
                {b.title}
              </Text>
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.benefits}>
          {PRO_BENEFITS.map((b, i) => (
            <View key={b.title} style={[styles.benefit, i > 0 && styles.sep]}>
              <Ionicons name={b.icon as never} size={18} color={colors.accentText} style={styles.benefitIcon} />
              <View style={styles.benefitBody}>
                <Text style={styles.benefitTitle}>{b.title}</Text>
                <Text style={styles.benefitDetail}>{b.detail}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {disponible ? (
        <View accessibilityRole="radiogroup" style={styles.plans}>
          {PRO_PLANS.map((p) => {
            const on = p.id === planId;
            return (
              <Pressable
                key={p.id}
                onPress={() => elegir(p.id)}
                style={({ pressed }) => [styles.plan, on && styles.planOn, pressed && styles.pressed]}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`Plan ${p.label.toLowerCase()}, ${p.price} al ${p.period}. ${p.pitch}`}
              >
                <View style={[styles.radio, on && styles.radioOn]}>{on ? <View style={styles.radioDot} /> : null}</View>
                <View style={styles.planBody}>
                  <View style={styles.planHead}>
                    <Text style={styles.planLabel}>{p.label.toUpperCase()}</Text>
                    {p.savings ? <Tag tone="accent">{p.savings}</Tag> : null}
                  </View>
                  <Text style={styles.planPitch}>{p.pitch}</Text>
                </View>
                <View style={styles.planPrice}>
                  <Text style={styles.price}>{p.price}</Text>
                  <Text style={styles.period}>al {p.period}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      ) : (
        // Sin tienda no hay nada que elegir: los precios se enseñan, no se
        // seleccionan. Un selector que no selecciona nada era media mentira.
        <View style={styles.priceList}>
          <Text style={styles.priceListTitle}>LO QUE COSTARÁ</Text>
          {PRO_PLANS.map((p, i) => (
            <View
              key={p.id}
              style={[styles.priceRow, i > 0 && styles.sep]}
              accessible
              accessibilityLabel={`Plan ${p.label.toLowerCase()}: ${p.price} al ${p.period}. ${p.pitch}`}
            >
              <View style={styles.planBody}>
                <View style={styles.planHead}>
                  <Text style={styles.planLabel}>{p.label.toUpperCase()}</Text>
                  {p.savings ? <Tag>{p.savings}</Tag> : null}
                </View>
                <Text style={styles.planPitch}>{p.pitch}</Text>
              </View>
              <View style={styles.planPrice}>
                <Text style={styles.price}>{p.price}</Text>
                <Text style={styles.period}>al {p.period}</Text>
              </View>
            </View>
          ))}
          <Text style={[styles.notice, styles.noticeLeft]}>
            Las suscripciones aún no están abiertas. Hoy no se cobra nada.
          </Text>
        </View>
      )}
    </View>
  );
}

interface ActionsProps {
  oferta: ProOfferState;
  /** La salida gratuita: "Seguir gratis". Siempre visible, nunca escondida. */
  exitLabel: string;
  onExit: () => void;
  exitLoading?: boolean;
}

/** Los dos botones, del mismo tamaño, y lo que el sistema responde al pulsarlos. */
export function ProOfferActions({ oferta, exitLabel, onExit, exitLoading }: ActionsProps) {
  const { plan, busy, anotado, aviso, disponible, onPrincipal } = oferta;
  return (
    <View>
      {anotado ? (
        <Text style={[styles.notice, styles.noticeAbove]} accessibilityLiveRegion="polite">
          Anotado. El sistema te avisará cuando abran las suscripciones. Hoy no se cobra nada.
        </Text>
      ) : null}
      {aviso ? (
        <Text style={[styles.notice, styles.noticeAbove, styles.noticeWarn]} accessibilityRole="alert">
          {aviso}
        </Text>
      ) : null}
      <SystemButton
        title={disponible ? `Activar NIVL Pro · ${plan.price}/${plan.period}` : anotado ? 'Anotado' : 'Avísame cuando abra'}
        size="lg"
        icon={disponible ? undefined : anotado ? 'checkmark' : 'notifications-outline'}
        onPress={onPrincipal}
        loading={busy === 'compra'}
        disabled={anotado || busy === 'restaurar'}
      />
      <SystemButton
        title={exitLabel}
        variant="outline"
        size="lg"
        onPress={onExit}
        loading={exitLoading}
        disabled={busy !== null}
        style={styles.exit}
      />
    </View>
  );
}

/**
 * Lo que exigen las tiendas para una suscripción autorrenovable: restaurar, la
 * letra pequeña y los enlaces legales. SOLO cuando se puede comprar: con la
 * tienda cerrada, hablar de renovación automática y ofrecer "restaurar" una
 * compra que no puede existir contradecía el "hoy no se cobra nada".
 */
export function ProOfferLegal({ oferta }: { oferta: ProOfferState }) {
  const { planId, busy, disponible, avisoEnlace, onRestaurar, abrir } = oferta;
  if (!disponible) return null;
  return (
    <View>
      <SystemButton
        title="Restaurar compras"
        variant="ghost"
        size="sm"
        onPress={onRestaurar}
        loading={busy === 'restaurar'}
        disabled={busy === 'compra'}
        style={styles.restore}
      />
      <Text style={styles.legal}>{legalText(planId)}</Text>
      <View style={styles.links}>
        <Pressable
          onPress={() => abrir(LEGAL_URLS.terminos)}
          hitSlop={10}
          accessibilityRole="link"
          accessibilityLabel="Términos de uso"
        >
          <Text style={styles.link}>Términos</Text>
        </Pressable>
        <Text style={styles.linkSep}>·</Text>
        <Pressable
          onPress={() => abrir(LEGAL_URLS.privacidad)}
          hitSlop={10}
          accessibilityRole="link"
          accessibilityLabel="Política de privacidad"
        >
          <Text style={styles.link}>Privacidad</Text>
        </Pressable>
      </View>
      {avisoEnlace ? (
        <Text style={[styles.notice, styles.noticeWarn]} accessibilityRole="alert">
          No se ha podido abrir el enlace.
        </Text>
      ) : null}
    </View>
  );
}

interface Props extends OfferOptions, Omit<ActionsProps, 'oferta'> {
  kind: unknown;
  compact?: boolean;
}

/** La oferta entera, en columna: la pantalla `/pro`. */
export function ProOffer({ userId, kind, compact, exitLabel, onExit, exitLoading, onPurchased }: Props) {
  const oferta = useProOffer({ userId, onPurchased });
  return (
    <View>
      <ProOfferBody oferta={oferta} kind={kind} compact={compact} />
      <ProOfferActions oferta={oferta} exitLabel={exitLabel} onExit={onExit} exitLoading={exitLoading} />
      <ProOfferLegal oferta={oferta} />
    </View>
  );
}

const styles = StyleSheet.create({
  emphasis: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 21, color: colors.text },
  benefits: { marginTop: 6, marginBottom: 18 },
  benefit: { flexDirection: 'row', gap: 12, paddingVertical: 11 },
  sep: { borderTopWidth: 1, borderTopColor: colors.line },
  benefitIcon: { marginTop: 1 },
  benefitBody: { flex: 1, minWidth: 0 },
  benefitTitle: { fontFamily: fonts.semibold, fontSize: 14.5, lineHeight: 20, color: colors.text },
  benefitDetail: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.textDim, marginTop: 2 },
  benefitGrid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 12 },
  benefitCell: {
    width: '50%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingVertical: 6,
    paddingRight: 10,
  },
  benefitCellTitle: { flex: 1, minWidth: 0, fontFamily: fonts.semibold, fontSize: 13, lineHeight: 17, color: colors.text },
  plans: { gap: 10, marginBottom: 16 },
  plan: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bg,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  planOn: { borderColor: colors.accent, borderWidth: 1.5, backgroundColor: colors.accentFaint },
  pressed: { opacity: 0.7 },
  priceList: {
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
  },
  priceListTitle: { fontFamily: fonts.heading, fontSize: 11, letterSpacing: 2.2, color: colors.textFaint, marginBottom: 2 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.accentDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: { borderColor: colors.accent },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent },
  planBody: { flex: 1, minWidth: 0 },
  planHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  planLabel: { fontFamily: fonts.heading, fontSize: 13, letterSpacing: 2, color: colors.text },
  planPitch: { fontFamily: fonts.body, fontSize: 12.5, lineHeight: 17, color: colors.textDim, marginTop: 3 },
  planPrice: { alignItems: 'flex-end' },
  price: { fontFamily: fonts.number, fontSize: 17, color: colors.text },
  period: { fontFamily: fonts.body, fontSize: 11, color: colors.textFaint, marginTop: 1 },
  exit: { marginTop: 10 },
  notice: {
    fontFamily: fonts.body,
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.accentText,
    textAlign: 'center',
    marginTop: 12,
  },
  noticeLeft: { textAlign: 'left', marginTop: 8 },
  noticeAbove: { marginTop: 0, marginBottom: 10 },
  noticeWarn: { color: colors.textDim },
  restore: { marginTop: 6, alignSelf: 'center' },
  legal: { fontFamily: fonts.body, fontSize: 11, lineHeight: 16, color: colors.textFaint, marginTop: 8 },
  links: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, marginTop: 10 },
  link: { fontFamily: fonts.semibold, fontSize: 12, color: colors.accentText, textDecorationLine: 'underline' },
  linkSep: { fontFamily: fonts.body, fontSize: 12, color: colors.textFaint },
});
