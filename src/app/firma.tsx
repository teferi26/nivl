// NIVL · /firma: el compromiso, ya con la app usada. Antes era el último paso
// de la entrada; los datos son los mismos: se sella como carta (`sealLetter`)
// y deja `commitment_signed` en la crónica.

import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Keyboard, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Campo, EncabezadoArena, Entrada, TarjetaArena } from '@/components/arena';
import { useHealthConsent } from '@/components/ConsentimientoSalud';
import { HoldToSign } from '@/components/HoldToSign';
import { TablillaContrato } from '@/components/onboarding/TablillaContrato';
import { Chip, Screen, Skeleton } from '@/components/ui';
import { avisar } from '@/components/ui/confirmar';
import { vibrar } from '@/design/haptics';
import { ink, oro, radio, space, type as tipo } from '@/design/tokens';
import { idiomaInterfaz, t } from '@/i18n';
import { mayus } from '@/i18n/formato';
import { useAuth } from '@/lib/auth';
import { firmaValida, GOAL_MAX_LENGTH, HORIZONTES, HORIZONTE_POR_DEFECTO, limpiarFrase, textoCompromiso, type Horizonte } from '@/lib/compromiso';
import { fetchLetter, fetchObjetivoEntrada, sealLetter } from '@/lib/contract';
import { ensureProfile, insertEvent } from '@/lib/data';
import { addDays, dateKey, fechaConAnio } from '@/lib/dates';
import { colors } from '@/lib/theme';
import { mensajeSistema, NAME_MAX_LENGTH } from '@/lib/validation';

const MS_SELLO = 1400;

export default function Firma() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const health = useHealthConsent();
  const [cargado, setCargado] = useState(false);
  const [name, setName] = useState('');
  const [goal, setGoal] = useState('');
  const [healthGoal, setHealthGoal] = useState(false);
  const [horizonte, setHorizonte] = useState<Horizonte>(HORIZONTE_POR_DEFECTO);
  const [firma, setFirma] = useState('');
  const [busy, setBusy] = useState(false);
  const [holding, setHolding] = useState(false);
  const [sello, setSello] = useState(false);
  const lock = useRef(false);
  const campoFirma = useRef<TextInput>(null);
  const escala = useRef(new Animated.Value(1.5)).current;
  const opacidad = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!userId) return;
    Promise.all([ensureProfile(userId), fetchObjetivoEntrada(userId)])
      .then(([perfil, objetivo]) => {
        setName(perfil.name ?? '');
        setGoal(objetivo?.goal ?? '');
        setHealthGoal(objetivo?.healthData ?? false);
      })
      .catch(() => {})
      .finally(() => setCargado(true));
  }, [userId]);

  const hoy = dateKey();
  const abreEl = addDays(hoy, horizonte.days);
  const contrato = useMemo(
    () => textoCompromiso({ name, goal, target: '', deadline: '', horizonte, firmadoEl: fechaConAnio(hoy), seAbreEl: fechaConAnio(abreEl) }),
    [name, goal, horizonte, hoy, abreEl],
  );
  const firmaOk = firmaValida(firma, name) && !!limpiarFrase(goal);

  useEffect(() => {
    if (!sello) return;
    vibrar('nivel');
    Animated.parallel([
      Animated.spring(escala, { toValue: 1, useNativeDriver: true, friction: 6, tension: 80 }),
      Animated.timing(opacidad, { toValue: 1, duration: 160, useNativeDriver: true }),
    ]).start();
    const fin = setTimeout(() => router.back(), MS_SELLO);
    return () => clearTimeout(fin);
  }, [sello, escala, opacidad]);

  const firmar = async () => {
    if (!userId || lock.current || sello) return;
    if (!firmaValida(firma, name)) {
      campoFirma.current?.focus();
      return;
    }
    if (healthGoal && !health.accepted) {
      health.ask();
      return;
    }
    lock.current = true;
    setBusy(true);
    try {
      const previa = await fetchLetter();
      if (!(previa && previa.body === contrato && previa.open_at === abreEl)) {
        await sealLetter(userId, contrato, abreEl, healthGoal);
        const idioma = idiomaInterfaz();
        await insertEvent(userId, 'commitment_signed', {
          years: horizonte.years,
          open_at: abreEl,
          ...(idioma === 'es' ? {} : { idioma }),
        }).catch(() => {});
      }
      setSello(true);
    } catch (e) {
      avisar(t('comun:sistemaNoResponde'), mensajeSistema(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };

  if (sello) {
    return (
      <Pressable style={styles.sello} onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={t('onboarding:sello.a11y', { fecha: fechaConAnio(abreEl) })}>
        <Animated.View style={{ alignItems: 'center', opacity: opacidad, transform: [{ scale: escala }] }}>
          <View style={styles.selloMarco}>
            <Text style={styles.selloTexto}>{mayus(t('onboarding:sello.titulo'))}</Text>
          </View>
        </Animated.View>
        <Animated.Text style={[styles.selloFecha, { opacity: opacidad }]}>{t('onboarding:sello.vence', { fecha: fechaConAnio(abreEl) })}</Animated.Text>
      </Pressable>
    );
  }

  return (
    <Screen scrollEnabled={!holding}>
      <Entrada indice={0}>
        <EncabezadoArena onVolver={() => router.back()} eyebrow={t('onboarding:firma.inscripcion')} titulo={t('onboarding:firma.titulo')} subtitulo={t('onboarding:firma.pista')} />
      </Entrada>
      {!cargado ? (
        <Skeleton height={220} />
      ) : (
        <Entrada indice={1}>
          {goal ? null : (
            <TarjetaArena variante="contorno" style={styles.bloque}>
              <Campo etiqueta={t('onboarding:objetivo.etiqueta')} value={goal} onChangeText={setGoal} maxLength={GOAL_MAX_LENGTH} multiline accessibilityLabel={t('onboarding:objetivo.a11y')} />
            </TarjetaArena>
          )}
          <View style={styles.horizontes} accessibilityRole="radiogroup">
            {HORIZONTES.map((h) => (
              <View key={h.years} style={styles.horizonte}>
                <Chip
                  label={h.label}
                  selected={horizonte.years === h.years}
                  onPress={() => setHorizonte(h)}
                  disabled={busy || holding}
                  accessibilityLabel={t(h.recomendado ? 'onboarding:firma.horizonteRecomendadoA11y' : 'onboarding:firma.horizonteA11y', { plazo: h.label })}
                  style={styles.horizonteChip}
                />
                <Text style={styles.recomendado}>{h.recomendado ? t('onboarding:firma.recomendado') : ' '}</Text>
              </View>
            ))}
          </View>
          <TablillaContrato parrafos={contrato.split(/\n\s*\n/)} abreEl={fechaConAnio(abreEl)} rellenar={false} />
          <Text style={styles.letra}>{t('onboarding:firma.letraPequena')}</Text>
          <TarjetaArena variante="contorno" style={styles.bloque}>
            <Campo
              ref={campoFirma}
              editable={!busy && !holding}
              etiqueta={t('onboarding:firma.campo')}
              value={firma}
              onChangeText={setFirma}
              placeholder={name.trim()}
              maxLength={NAME_MAX_LENGTH}
              autoCapitalize="words"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={Keyboard.dismiss}
              accessibilityLabel={t('onboarding:firma.campo')}
            />
          </TarjetaArena>
          <HoldToSign
            label={firmaOk ? t('onboarding:firma.mantenPulsado') : t('onboarding:firma.escribeNombre')}
            onComplete={firmar}
            onRequestInput={() => campoFirma.current?.focus()}
            onHoldChange={setHolding}
            disabled={!firmaOk}
            loading={busy}
          />
        </Entrada>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  bloque: { marginVertical: space.s3 },
  horizontes: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  horizonte: { flex: 1, alignItems: 'stretch' },
  horizonteChip: { justifyContent: 'center' },
  recomendado: { fontFamily: tipo.micro.family, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: oro.claro, textAlign: 'center', marginTop: 6 },
  letra: { fontFamily: tipo.bodySm.family, fontSize: tipo.bodySm.size, lineHeight: tipo.bodySm.lineHeight, color: ink.ink8, textAlign: 'center', marginTop: space.s1 },
  sello: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: space.s6 },
  selloMarco: { borderWidth: 1.5, borderColor: oro.hilo, borderRadius: radio.control, paddingHorizontal: 26, paddingVertical: 14 },
  selloTexto: { fontFamily: tipo.display.family, fontSize: 34, letterSpacing: 8, color: oro.claro, marginRight: -8 },
  selloFecha: { fontFamily: tipo.label.family, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: ink.ink8, marginTop: 22, textAlign: 'center' },
});
