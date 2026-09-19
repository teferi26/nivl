// NIVL · La oferta de NIVL Pro: qué hace el coach, los dos planes, la acción y
// la letra pequeña. La comparten la pantalla `/pro` y el último paso del
// onboarding (`compact`), para que el precio y las condiciones no puedan
// decir una cosa en un sitio y otra en otro.
//
// Reglas de esta pieza, que no son de estilo: nada de urgencia falsa, ni
// cuentas atrás, ni testimonios; la salida gratuita pesa lo mismo que la
// compra; y mientras la tienda no esté conectada (`purchasesAvailable()`), el
// botón apunta el interés y lo dice, en vez de fingir un cobro.

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

interface Props {
  userId?: string;
  /** `profile.profile_kind`: decide la línea de énfasis. */
  kind: unknown;
  /** Versión condensada para el onboarding: beneficios en una línea. */
  compact?: boolean;
  /** La salida gratuita: "Seguir gratis". Siempre visible, nunca escondida. */
  exitLabel: string;
  onExit: () => void;
  exitLoading?: boolean;
  /** Tras una compra o una restauración confirmadas por la tienda. */
  onPurchased?: () => void;
}

export function ProOffer({ userId, kind, compact, exitLabel, onExit, exitLoading, onPurchased }: Props) {
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
      setAviso(e instanceof Error ? e.message : 'El sistema no ha podido completar la operación.');
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
      // Sin tienda todavía: se apunta el interés (y el plan elegido) en los
      // eventos de la cuenta. No hay tabla nueva ni cobro.
      if (userId) await insertEvent(userId, 'pro_interest', { plan: plan.plan });
      setAnotado(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    });

  const onRestaurar = () =>
    conCerrojo('restaurar', async () => {
      await restorePurchases();
      onPurchased?.();
    });

  const abrir = (url: string) => Linking.openURL(url).catch(() => {});

  return (
    <View>
      <Card variant="outline" accent={colors.accentDim}>
        <Text style={styles.emphasis}>{proEmphasis(kind)}</Text>
      </Card>

      <View style={styles.benefits}>
        {PRO_BENEFITS.map((b, i) => (
          <View key={b.title} style={[styles.benefit, i > 0 && styles.benefitSep, compact && styles.benefitCompact]}>
            <Ionicons name={b.icon as never} size={compact ? 16 : 18} color={colors.accentText} style={styles.benefitIcon} />
            <View style={styles.benefitBody}>
              <Text style={styles.benefitTitle}>{b.title}</Text>
              {compact ? null : <Text style={styles.benefitDetail}>{b.detail}</Text>}
            </View>
          </View>
        ))}
      </View>

      <View accessibilityRole="radiogroup" style={styles.plans}>
        {PRO_PLANS.map((p) => {
          const on = p.id === planId;
          return (
            <Pressable
              key={p.id}
              onPress={() => {
                setPlanId(p.id);
                setAnotado(false);
              }}
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

      <SystemButton
        title={disponible ? `Activar NIVL Pro · ${plan.price}` : anotado ? 'Anotado' : 'Avísame cuando abra'}
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

      {anotado ? (
        <Text style={styles.notice} accessibilityLiveRegion="polite">
          Anotado: plan {plan.label.toLowerCase()}. El sistema te avisará cuando abran las suscripciones. Hoy no se cobra nada.
        </Text>
      ) : !disponible ? (
        <Text style={styles.notice}>
          Las suscripciones se activan con el lanzamiento público. Hoy no se cobra nada.
        </Text>
      ) : null}
      {aviso ? (
        <Text style={[styles.notice, styles.noticeWarn]} accessibilityLiveRegion="polite">
          {aviso}
        </Text>
      ) : null}

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
    </View>
  );
}

const styles = StyleSheet.create({
  emphasis: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 21, color: colors.text },
  benefits: { marginTop: 6, marginBottom: 18 },
  benefit: { flexDirection: 'row', gap: 12, paddingVertical: 11 },
  benefitCompact: { paddingVertical: 8 },
  benefitSep: { borderTopWidth: 1, borderTopColor: colors.line },
  benefitIcon: { marginTop: 1 },
  benefitBody: { flex: 1, minWidth: 0 },
  benefitTitle: { fontFamily: fonts.semibold, fontSize: 14.5, lineHeight: 20, color: colors.text },
  benefitDetail: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.textDim, marginTop: 2 },
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
  noticeWarn: { color: colors.textDim },
  restore: { marginTop: 6, alignSelf: 'center' },
  legal: { fontFamily: fonts.body, fontSize: 11, lineHeight: 16, color: colors.textFaint, marginTop: 8 },
  links: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, marginTop: 10 },
  link: { fontFamily: fonts.semibold, fontSize: 12, color: colors.accentText, textDecorationLine: 'underline' },
  linkSep: { fontFamily: fonts.body, fontSize: 12, color: colors.textFaint },
});
