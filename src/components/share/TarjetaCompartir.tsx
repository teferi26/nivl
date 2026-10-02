// NIVL · La tarjeta que se comparte, dibujada.
//
// Sigue al píxel las maquetas del Chat 4 (docs/design-v2/maquetas/Tarjeta-*,
// winter2/chat4-experiencia @b551d1a) y SISTEMA.md §10. Las medidas están en
// píxeles del archivo final de 1080 de ancho y se escalan con `px()`: la vista
// previa del móvil y el archivo exportado son la misma pieza.
//
// Solo pinta lo que decide `src/lib/sharecard.ts`: textos, fotos permitidas
// (18+, consentimiento y opt-in) y geometría. Negro puro, la marca NIVL en
// Cinzel arriba, dentro de la zona segura, y un pie con el alias (si se
// permite) y nivl.app.
//
// Se monta FUERA de pantalla y fuera de cualquier Modal (en Android, capturar
// dentro de un Modal da negro), con `collapsable={false}`, y avisa con
// `onListo` cuando las imágenes han cargado: capturar antes deja huecos.
//
// Fotos en B/N: en iOS, RN 0.81 no tiene `filter: grayscale`. Se desatura con
// una capa negra en `mixBlendMode: 'saturation'` dentro de un grupo aislado
// (nueva arquitectura). NO PROBADO en dispositivo ni en la captura de
// view-shot; si no desatura, la alternativa es procesar la imagen antes.

import { forwardRef, useEffect, useMemo, useRef } from 'react';
import { Image, StyleSheet, Text, View, type TextStyle } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import {
  fotosVisibles,
  lienzo,
  reticulaRacha,
  textos,
  type ContextoTarjeta,
  type FormatoTarjeta,
  type OpcionesTarjeta,
  type Tarjeta,
} from '@/lib/sharecard';
import { fonts } from '@/lib/theme';

// Tokens `ink` del Sistema de diseño v2 (src/design/tokens.ts, rama del Chat 4).
// Copia literal hasta la integración: entonces se importan de allí.
const ink = {
  ink0: '#000000',
  ink2: '#161616',
  ink3: '#242424',
  ink4: '#3A3A3A',
  ink6: '#8C8C8C',
  ink8: '#BDBDBD',
  ink10: '#FFFFFF',
} as const;

export interface TarjetaCompartirProps {
  tarjeta: Tarjeta;
  formato: FormatoTarjeta;
  opciones: OpcionesTarjeta;
  contexto?: ContextoTarjeta;
  /** Alias público aprobado (solo se pinta con `opciones.mostrarNombre`). */
  alias?: string | null;
  /** Retrato aprobado ya descargado a caché (tarjeta de rango), o null. */
  retratoUri?: string | null;
  /** Ancho en puntos en el que se pinta (1080 para capturar 1:1). */
  ancho?: number;
  /** Se llama una vez, cuando todo lo que hay que pintar ha cargado. */
  onListo?: () => void;
}

export const TarjetaCompartir = forwardRef<View, TarjetaCompartirProps>(function TarjetaCompartir(
  { tarjeta, formato, opciones, contexto, alias, retratoUri, ancho, onListo },
  ref,
) {
  const l = useMemo(() => lienzo(formato, ancho), [formato, ancho]);
  const k = l.ancho / 1080;
  const px = (n: number) => n * k;
  // En 4:5 la tarjeta de rango no cabe a la escala de la maqueta 9:16: el
  // retrato y la letra bajan al 72 % para no pisar el antetítulo.
  const r = formato === 'post' ? 0.72 : 1;
  const x = textos(tarjeta, opciones, alias);
  const fotos = fotosVisibles(tarjeta, opciones, contexto);
  const retrato = tarjeta.tipo === 'rango' && retratoUri ? retratoUri : null;
  const imagenes = fotos.length + (retrato ? 1 : 0);

  // Avisar una sola vez cuando todas las imágenes han cargado (o fallado).
  const pendientes = useRef(imagenes);
  const avisado = useRef(false);
  const listo = () => {
    if (avisado.current) return;
    avisado.current = true;
    onListo?.();
  };
  const unaMenos = () => {
    pendientes.current -= 1;
    if (pendientes.current <= 0) listo();
  };
  useEffect(() => {
    pendientes.current = imagenes;
    avisado.current = false;
    if (imagenes === 0) listo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imagenes, tarjeta, formato]);

  const txt = (familia: string, tam: number, color: string, extra: TextStyle = {}): TextStyle => ({
    fontFamily: familia,
    fontSize: px(tam),
    color,
    ...extra,
  });

  return (
    <View
      ref={ref}
      collapsable={false}
      style={{
        width: l.ancho,
        height: l.alto,
        backgroundColor: ink.ink0,
        paddingTop: l.seguro.arriba,
        paddingBottom: l.seguro.abajo,
        paddingHorizontal: l.seguro.lados,
        alignItems: 'center',
      }}
    >
      <Text allowFontScaling={false} style={txt(fonts.brand, 56, ink.ink10, { letterSpacing: px(24), marginTop: px(40) })}>
        NIVL
      </Text>
      <Text allowFontScaling={false} style={txt(fonts.heading, 30, ink.ink6, { letterSpacing: px(10), marginTop: px(28) })}>
        {x.antetitulo}
      </Text>

      <View style={[styles.cuerpo, { gap: px(40), paddingVertical: px(36) }]}>
        {tarjeta.tipo === 'logro' ? (
          <>
            <Svg width={px(220)} height={px(220)} viewBox="0 0 48 48" fill="none" stroke={ink.ink10} strokeWidth={1.2}>
              <Circle cx={24} cy={24} r={20} />
              <Circle cx={24} cy={24} r={16} />
              <Path d="M16 25l5 5 11-12" strokeWidth={2.4} />
            </Svg>
            <Text allowFontScaling={false} numberOfLines={3} style={txt(fonts.brand, 92, ink.ink10, { lineHeight: px(104), textAlign: 'center' })}>
              {x.titular}
            </Text>
          </>
        ) : null}

        {tarjeta.tipo === 'nivel' ? (
          <>
            <Text allowFontScaling={false} style={txt(fonts.body, 36, ink.ink8, { letterSpacing: px(10) })}>
              NIVEL
            </Text>
            <Text allowFontScaling={false} style={txt(fonts.brand, 300, ink.ink10, { lineHeight: px(300) })}>
              {String(Math.max(1, Math.floor(tarjeta.nivel)))}
            </Text>
            {typeof tarjeta.progreso === 'number' ? (
              <View style={{ width: px(640), height: px(12), backgroundColor: ink.ink4 }}>
                <View style={{ width: `${Math.round(Math.min(1, Math.max(0, tarjeta.progreso)) * 100)}%`, height: px(12), backgroundColor: ink.ink10 }} />
              </View>
            ) : null}
          </>
        ) : null}

        {tarjeta.tipo === 'rango' ? (
          <>
            <View style={{ width: px(340 * r), height: px(400 * r), alignItems: 'center', justifyContent: 'flex-end' }}>
              <View style={{ position: 'absolute', top: 0, left: px(75 * r) }}>
                <Svg width={px(190 * r)} height={px(90 * r)} viewBox="0 0 120 56" fill="none" stroke={ink.ink10} strokeWidth={3}>
                  <Path d="M20 50 C20 24 38 10 60 10 C82 10 100 24 100 50 Z" />
                  <Path d="M60 2 C74 4 86 10 92 20" strokeWidth={5} />
                  <Path d="M34 50 V34 H86 V50" />
                  <Path d="M60 34 V50" />
                </Svg>
              </View>
              {/* Aro exterior fino (el box-shadow de la maqueta) y aro de 8 con el retrato. */}
              <View style={{ width: px(330 * r), height: px(330 * r), borderRadius: px(165 * r), borderWidth: px(3), borderColor: ink.ink8, alignItems: 'center', justifyContent: 'center', marginBottom: -px(15 * r) }}>
                <View style={{ width: px(300 * r), height: px(300 * r), borderRadius: px(150 * r), borderWidth: px(8), borderColor: ink.ink10, backgroundColor: ink.ink2, overflow: 'hidden' }}>
                  {retrato ? <Image source={{ uri: retrato }} onLoad={unaMenos} onError={unaMenos} style={StyleSheet.absoluteFillObject} resizeMode="cover" /> : null}
                </View>
              </View>
            </View>
            <Text allowFontScaling={false} style={txt(fonts.brand, 220 * r, ink.ink10, { lineHeight: px(220 * r) })}>
              {tarjeta.rango}
            </Text>
          </>
        ) : null}

        {tarjeta.tipo === 'racha' ? (
          <>
            <Text allowFontScaling={false} style={txt(fonts.brand, 280, ink.ink10, { lineHeight: px(280) })}>
              {String(Math.max(0, Math.floor(tarjeta.dias)))}
            </Text>
            <Text allowFontScaling={false} style={txt(fonts.body, 44, ink.ink10, { letterSpacing: px(12) })}>
              DÍAS DE RACHA
            </Text>
            <View style={{ width: px(760), flexDirection: 'row', flexWrap: 'wrap', gap: px(14) }}>
              {reticulaRacha(tarjeta).map((hecho, i) => (
                <View
                  key={i}
                  style={{
                    width: (px(760) - 9 * px(14)) / 10,
                    aspectRatio: 1,
                    backgroundColor: hecho ? ink.ink10 : 'transparent',
                    borderWidth: hecho ? 0 : px(3),
                    borderColor: ink.ink4,
                  }}
                />
              ))}
            </View>
          </>
        ) : null}

        {tarjeta.tipo === 'antesDespues' && fotos.length === 2 ? (
          // Las fotos ceden alto si el texto no cabe (en RN el interlineado es
          // mayor que en la maqueta HTML): nunca más de 980/720, nunca encima del
          // antetítulo ni del pie.
          <View style={{ alignSelf: 'stretch', flexDirection: 'row', gap: px(28), flexShrink: 1, minHeight: 0 }}>
            {fotos.map((f, i) => (
              <View key={f.uri} style={{ flex: 1, gap: px(18), minHeight: 0 }}>
                <View style={{ flexShrink: 1, minHeight: 0, height: px(formato === 'stories' ? 980 : 720), backgroundColor: ink.ink2, borderWidth: px(2), borderColor: ink.ink4, overflow: 'hidden', isolation: 'isolate' }}>
                  <Image source={{ uri: f.uri }} onLoad={unaMenos} onError={unaMenos} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
                  <View pointerEvents="none" style={[StyleSheet.absoluteFillObject, { backgroundColor: ink.ink0, mixBlendMode: 'saturation' }]} />
                </View>
                <Text allowFontScaling={false} style={txt(fonts.body, 32, ink.ink10, { letterSpacing: px(6) })}>
                  {i === 0 ? 'ANTES' : 'DESPUÉS'}
                </Text>
                <Text allowFontScaling={false} style={txt(fonts.body, 30, ink.ink6)}>
                  {x.fechas?.[i] ?? ''}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {x.detalle && tarjeta.tipo !== 'racha' ? (
          <Text
            allowFontScaling={false}
            numberOfLines={3}
            style={
              tarjeta.tipo === 'rango'
                ? txt(fonts.brand, 52, ink.ink10, { letterSpacing: px(14), textAlign: 'center' })
                : txt(fonts.body, tarjeta.tipo === 'antesDespues' ? 32 : 40, tarjeta.tipo === 'antesDespues' ? ink.ink6 : ink.ink8, {
                    lineHeight: px(tarjeta.tipo === 'antesDespues' ? 44 : 56),
                    textAlign: 'center',
                  })
            }
          >
            {x.detalle}
          </Text>
        ) : null}

        {x.racha ? (
          <Text allowFontScaling={false} style={txt(fonts.body, 32, ink.ink6)}>
            {x.racha}
          </Text>
        ) : null}
      </View>

      <View
        style={{
          alignSelf: 'stretch',
          flexDirection: 'row',
          justifyContent: 'space-between',
          borderTopWidth: px(2),
          borderTopColor: ink.ink3,
          paddingTop: px(28),
          marginBottom: px(40),
        }}
      >
        <Text allowFontScaling={false} numberOfLines={1} style={txt(fonts.body, 32, ink.ink6, { flexShrink: 1 })}>
          {x.alias ?? ''}
        </Text>
        <Text allowFontScaling={false} style={txt(fonts.body, 32, ink.ink10)}>
          {x.dominio}
        </Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  cuerpo: { flex: 1, minHeight: 0, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
