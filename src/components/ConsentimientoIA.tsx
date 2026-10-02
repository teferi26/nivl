// NIVL · La hoja del consentimiento para la IA (Guideline 5.1.2(i), RGPD
// arts. 9 y 49).
//
// Sale antes del primer uso del coach: el primer mensaje del chat, la prueba
// de 7 días, la compra y el Oráculo. Dice qué datos van, a quién y dónde, y
// guarda la aceptación en el servidor con su versión (migración 0028). Sin
// ella el servidor no llama a ningún modelo, así que esta hoja no es la
// cerradura: es la puerta con el cartel.
//
// Uso: `const consentimiento = useConsentimientoIA();` y, antes de la acción,
// `if (!(await consentimiento.asegurar())) return;`. La pantalla pinta
// `{consentimiento.hoja}` en cualquier parte de su árbol.

import Ionicons from '@expo/vector-icons/Ionicons';
import { vibrar } from '@/design/haptics';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SystemButton } from '@/components/SystemButton';
import {
  aceptarConsentimiento,
  consentimientoVigente,
  crearCerrojoAceptacion,
  DATOS_IA,
  DESCARGO_SALUD,
  fetchConsentimiento,
  LINEA_CRISIS,
  PROVEEDORES_IA,
  TEXTO_CONSENTIMIENTO as T,
  type AccionesAceptacion,
} from '@/lib/consent';
import { LEGAL_URLS } from '@/lib/proplans';
import { colors, fonts } from '@/lib/theme';
import { mensajeSistema } from '@/lib/validation';

interface SheetProps {
  visible: boolean;
  onAceptado: () => void;
  onCerrar: () => void;
}

export function ConsentimientoSheet({ visible, onAceptado, onCerrar }: SheetProps) {
  const [busy, setBusy] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  // El cerrojo es puro (consentmath.ts, con tests): aquí solo se le dan las
  // manos. La ref guarda las del último render.
  const acciones = useRef<AccionesAceptacion | null>(null);
  acciones.current = {
    guardar: aceptarConsentimiento,
    alEmpezar: () => {
      setBusy(true);
      setAviso(null);
    },
    alTerminar: () => setBusy(false),
    alAceptar: () => {
      vibrar('mision');
      onAceptado();
    },
    alFallar: (e) => setAviso(mensajeSistema(e)),
  };
  const [cerrojo] = useState(() => crearCerrojoAceptacion(() => acciones.current!));

  const aceptar = () => cerrojo.aceptar();
  const cerrar = () => {
    cerrojo.cerrar(() => {
      setAviso(null);
      onCerrar();
    });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={cerrar}>
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropTap} onPress={cerrar} accessibilityRole="button" accessibilityLabel="Cerrar" />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollBody} showsVerticalScrollIndicator>
            <Text style={styles.eyebrow}>{T.eyebrow}</Text>
            <Text style={styles.title}>{T.titulo}</Text>
            <Text style={styles.body}>{T.intro}</Text>

            <View style={styles.lista}>
              {DATOS_IA.map((d) => (
                <View key={d.titulo} style={styles.item}>
                  <Text style={styles.itemTitle}>{d.titulo}</Text>
                  <Text style={styles.itemDetail}>{d.detalle}</Text>
                </View>
              ))}
            </View>

            <Text style={styles.label}>{T.aQuien}</Text>
            <View style={styles.lista}>
              {PROVEEDORES_IA.map((p) => (
                <View key={p.nombre} style={styles.item}>
                  <Text style={styles.itemTitle}>
                    {p.nombre} · {p.donde}
                  </Text>
                  <Text style={styles.itemDetail}>{p.cuando}</Text>
                </View>
              ))}
            </View>
            <Text style={styles.body}>{T.fueraEee}</Text>
            <Text style={styles.body}>{T.paraQue}</Text>
            <Text style={styles.body}>{T.consentimiento}</Text>
            <Text style={styles.body}>{T.sinAceptar}</Text>

            <View style={styles.descargo}>
              <Ionicons name="medkit-outline" size={16} color={colors.accentText} style={styles.descargoIcon} />
              <Text style={styles.descargoText}>
                {DESCARGO_SALUD} {LINEA_CRISIS}
              </Text>
            </View>

            <Pressable
              onPress={() => Linking.openURL(LEGAL_URLS.privacidad).catch(() => {})}
              hitSlop={10}
              accessibilityRole="link"
              accessibilityLabel="Leer la política de privacidad"
            >
              <Text style={styles.link}>Leer la política de privacidad</Text>
            </Pressable>
          </ScrollView>

          {aviso ? (
            <Text style={styles.aviso} accessibilityRole="alert">
              {aviso}
            </Text>
          ) : null}
          <SystemButton title={T.aceptar} size="lg" onPress={aceptar} loading={busy} style={styles.first} />
          <SystemButton title={T.rechazar} variant="ghost" onPress={cerrar} disabled={busy} style={styles.cancel} />
        </View>
      </View>
    </Modal>
  );
}

/**
 * Pide el consentimiento solo si hace falta. `asegurar()` resuelve true si ya
 * estaba vigente o si se acepta en la hoja; false si se cierra sin aceptar.
 * Si no se puede comprobar, abre la hoja y espera una aceptación guardada.
 * Salir de la pantalla cancela la petición pendiente.
 */
export function useConsentimientoIA() {
  const [abierta, setAbierta] = useState(false);
  const resolver = useRef<((ok: boolean) => void) | null>(null);
  const montada = useRef(true);

  useEffect(() => {
    montada.current = true;
    return () => {
      montada.current = false;
      resolver.current?.(false);
      resolver.current = null;
    };
  }, []);

  const pedir = useCallback(
    () =>
      new Promise<boolean>((res) => {
        if (!montada.current) {
          res(false);
          return;
        }
        resolver.current?.(false);
        resolver.current = res;
        setAbierta(true);
      }),
    [],
  );

  const asegurar = useCallback(async () => {
    try {
      const estado = await fetchConsentimiento();
      if (!montada.current) return false;
      if (consentimientoVigente(estado)) return true;
    } catch {
      // Un fallo de lectura no autoriza ni la prueba ni una compra.
    }
    return pedir();
  }, [pedir]);

  const terminar = (ok: boolean) => {
    if (!montada.current) return;
    setAbierta(false);
    const r = resolver.current;
    resolver.current = null;
    r?.(ok);
  };

  const hoja = <ConsentimientoSheet visible={abierta} onAceptado={() => terminar(true)} onCerrar={() => terminar(false)} />;
  return { asegurar, pedir, hoja };
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  backdropTap: { flex: 1, minHeight: 40 },
  sheet: {
    maxHeight: '90%',
    backgroundColor: colors.panel,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 34,
  },
  sheetHandle: { alignSelf: 'center', width: 36, height: 3, backgroundColor: colors.accentDim, marginBottom: 16 },
  scroll: { flexGrow: 0 },
  scrollBody: { paddingBottom: 8 },
  eyebrow: { fontFamily: fonts.heading, fontSize: 11, letterSpacing: 2.5, color: colors.textFaint },
  title: { fontFamily: fonts.heading, fontSize: 24, lineHeight: 29, letterSpacing: -0.5, color: colors.text, marginTop: 6 },
  body: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 19, color: colors.textDim, marginTop: 10 },
  label: {
    fontFamily: fonts.heading,
    fontSize: 11,
    letterSpacing: 2,
    color: colors.textFaint,
    textTransform: 'uppercase',
    marginTop: 18,
  },
  lista: { marginTop: 8, borderLeftWidth: 1, borderLeftColor: colors.line, paddingLeft: 12, gap: 8 },
  item: { minWidth: 0 },
  itemTitle: { fontFamily: fonts.semibold, fontSize: 13.5, color: colors.text },
  itemDetail: { fontFamily: fonts.body, fontSize: 12.5, lineHeight: 17, color: colors.textDim, marginTop: 1 },
  descargo: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panelDeep,
  },
  descargoIcon: { marginTop: 1 },
  descargoText: { flex: 1, minWidth: 0, fontFamily: fonts.body, fontSize: 12.5, lineHeight: 18, color: colors.text },
  link: { fontFamily: fonts.semibold, fontSize: 13, color: colors.accentText, textDecorationLine: 'underline', marginTop: 14 },
  aviso: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.red, marginTop: 10 },
  first: { marginTop: 14 },
  cancel: { marginTop: 6 },
});
