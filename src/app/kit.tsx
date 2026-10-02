// NIVL · Galería del kit v2. SOLO DESARROLLO.
//
// Sirve para verificar a ojo el sistema de diseño (docs/design-v2/SISTEMA.md)
// a 375/430/744/1024/1440 sin necesidad de sesión. En un build de release
// (__DEV__ false) redirige a la raíz y la puerta de sesión no la abre. En la
// web no se acota a la columna de 560 (ColumnaWeb en _layout.tsx).

import { Redirect } from 'expo-router';
import { useContext, useMemo, useState, type ReactNode } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Heatmap } from '@/components/Heatmap';
import { Avatar, Button, Card, Crown, Section, Screen, ScreenHeader, Sheet, SuperficieContext, Tag, Toast } from '@/components/ui';
import { alturaCorona } from '@/components/ui/Avatar';
import { addDays, dateKey } from '@/lib/dates';
import { ink, RANK_THEME, space, type, type Rank } from '@/design/tokens';
import { useAnchoUtil, useSizeClass } from '@/design/useSizeClass';

const RANGOS: Rank[] = ['E', 'D', 'C', 'B', 'A', 'S'];
const TAMANOS_CORONA = [16, 24, 48, 96] as const;
const TAMANOS_AVATAR = [40, 64, 96] as const;

/**
 * Texto de lectura del kit. Lee SuperficieContext: dentro de una Card inverse
 * (fondo blanco) se pinta en negro; fuera, en ink9. Sin hex sueltos.
 */
function Texto({ children }: { children: ReactNode }) {
  const inversa = useContext(SuperficieContext) === 'inverse';
  return <Text style={[styles.body, { color: inversa ? ink.ink0 : ink.ink9 }]}>{children}</Text>;
}

export default function Kit() {
  const [hoja, setHoja] = useState(false);
  const [nota, setNota] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const marco = useSizeClass();
  const ancho = useAnchoUtil();
  // Actividad de prueba para ver los cuatro pasos de la escala del heatmap.
  const conteos = useMemo(() => {
    const hoy = dateKey();
    const out: Record<string, number> = {};
    for (let i = 0; i < 91; i++) out[addDays(hoy, -i)] = (i * 7) % 6;
    return out;
  }, []);
  if (!__DEV__) return <Redirect href="/" />;

  return (
    <Screen
      overlay={<Toast message={toast} onDone={() => setToast(null)} />}
      aside={
        <View style={{ gap: space.s2 }}>
          <Text style={styles.label}>PANEL CONTEXTUAL</Text>
          <Text style={styles.body}>Solo en expanded y si al contenido le quedan 560 + 2·32.</Text>
        </View>
      }
    >
      <ScreenHeader
        eyebrow="Diseño v2"
        title="Kit"
        subtitle={`Hueco ${Math.round(ancho)} · clase ${marco.sizeClass} · margen ${marco.gutter} · máx. ${marco.maxContent}`}
      />

      <Section title="Botones">
        <View style={{ gap: 10 }}>
          <Button title="Primario" onPress={() => setToast('+50 XP · FUE')} />
          <Button title="Secundario" variant="secondary" onPress={() => setHoja(true)} />
          <Button title="Fantasma" variant="ghost" onPress={() => {}} />
          <Button title="Eliminar cuenta" variant="danger" icon="trash-outline" onPress={() => {}} />
          <Button title="Pequeño" size="sm" variant="secondary" onPress={() => {}} />
          <Button title="Desactivado" disabled onPress={() => {}} />
          <Button
            title="Un aviso largo para ver el toast en dos líneas"
            variant="secondary"
            size="sm"
            onPress={() => setToast('+120 XP · FUE · día perfecto y racha de treinta días seguidos en la arena')}
          />
        </View>
      </Section>

      <Section title="Tarjetas">
        <View style={{ gap: 10 }}>
          <Card variant="surface"><Texto>surface · superficie normal</Texto></Card>
          <Card variant="outline"><Texto>outline · avisos y vacíos</Texto></Card>
          <Card variant="inverse"><Texto>inverse · una por pantalla</Texto></Card>
          <Card variant="alerta"><Texto>alerta · trama: penalización, bloqueo</Texto></Card>
          <Card variant="logro"><Texto>logro · grano: racha, hito, Élite</Texto></Card>
        </View>
      </Section>

      <Section title="Etiquetas">
        <View style={styles.fila}>
          <Tag>Hoy</Tag>
          <Tag tone="alerta">Penalización</Tag>
          <Tag tone="logro">Extra</Tag>
        </View>
      </Section>

      <Section title="Así se pierde" tone="alerta" meta="−30 XP">
        <Texto>Sección con tono alerta (antes «red»): la regla es una banda de trama.</Texto>
      </Section>

      <Section title="Conseguidas" tone="logro" meta="12">
        <Texto>Sección con tono logro (antes «gold»): la regla es una banda de grano.</Texto>
      </Section>

      <Section title="Rangos">
        <View style={styles.fila}>
          {RANGOS.map((r) => (
            <View key={r} style={styles.rango}>
              <Avatar size={64} avatarPath={null} name={`Rango ${r}`} rank={r} titulo={RANK_THEME[r].defaultTitle} />
              <Text style={styles.letra}>{r}</Text>
              <Text style={styles.small}>{RANK_THEME[r].defaultTitle}</Text>
            </View>
          ))}
        </View>
      </Section>

      <Section title="Coronas a 16 · 24 · 48 · 96">
        {(['casco', 'laurel', 'corona_arena'] as const).map((k) => (
          <View key={k} style={[styles.fila, { marginBottom: space.s4 }]}>
            {TAMANOS_CORONA.map((t) => (
              <View key={t} style={styles.muestra}>
                <Crown kind={k} size={t} />
                <Text style={styles.small}>{t}</Text>
              </View>
            ))}
          </View>
        ))}
      </Section>

      <Section title="Avatares a 40 · 64 · 96">
        {(['B', 'A', 'S'] as const).map((r) => (
          <View key={r} style={[styles.fila, { marginBottom: space.s4 }]}>
            {TAMANOS_AVATAR.map((t) => (
              <View key={t} style={styles.muestra}>
                <Avatar size={t} avatarPath={null} name={`Rango ${r}`} rank={r} titulo={RANK_THEME[r].defaultTitle} />
                <Text style={styles.small}>
                  {r} · {t} · corona +{alturaCorona(t, r)}
                </Text>
              </View>
            ))}
          </View>
        ))}
      </Section>

      <Section title="Heatmap">
        <Heatmap counts={conteos} />
      </Section>

      <Sheet
        visible={hoja}
        onClose={() => setHoja(false)}
        eyebrow="HOJA"
        title="Sheet del kit"
        footer={<Button title="Guardar" onPress={() => setHoja(false)} />}
      >
        <Text style={styles.body}>
          Centrada a 560 en tablet, a ancho completo en el móvil, con safe area real. El campo comprueba que el
          teclado no tapa el pie (Android edge-to-edge).
        </Text>
        <TextInput
          value={nota}
          onChangeText={setNota}
          placeholder="Escribe algo"
          placeholderTextColor={ink.ink6}
          accessibilityLabel="Campo de prueba"
          style={styles.campo}
        />
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: {
    fontFamily: type.label.family,
    fontSize: type.label.size,
    lineHeight: type.label.lineHeight,
    letterSpacing: type.label.tracking,
    color: ink.ink6,
  },
  body: { fontFamily: type.body.family, fontSize: type.body.size, lineHeight: type.body.lineHeight, color: ink.ink9 },
  small: { fontFamily: type.micro.family, fontSize: type.micro.size, lineHeight: type.micro.lineHeight, color: ink.ink8 },
  letra: { fontFamily: type.rank.family, fontSize: 20, color: ink.ink10 },
  fila: { flexDirection: 'row', flexWrap: 'wrap', gap: 18, alignItems: 'flex-end' },
  rango: { alignItems: 'center', gap: 6, width: 84 },
  muestra: { alignItems: 'center', gap: 6 },
  campo: {
    marginTop: space.s4,
    minHeight: 48,
    paddingHorizontal: space.s3,
    backgroundColor: ink.ink2,
    borderWidth: 1,
    borderColor: ink.ink4,
    color: ink.ink9,
    fontFamily: type.body.family,
    fontSize: type.body.size,
  },
});
