// NIVL · Resistencia: el mapa de un entreno.
//
// La base es un SVG monocromo (proyección equirectangular, marcas de km, inicio
// y fin) que no depende de nada nativo. En iOS, si el binario trae el mapa
// nativo, se usa MapView apagado con la misma ruta. La comprobación es
// defensiva y sin `import` estático: una OTA que llegue a un binario sin
// `react-native-maps` tiene que pintar el SVG, no romper la pantalla.

import type { ComponentType } from 'react';
import { useState } from 'react';
import { Platform, StyleSheet, Text, UIManager, View } from 'react-native';
import Svg, { Circle, Polyline, Rect } from 'react-native-svg';
import { C, F, fs, px } from '@/components/ironmundo/tema';
import { t } from '@/i18n';
import { distanciaM } from '@/lib/entrenomath';
import type { PuntoRuta } from '@/lib/entrenoMedido';
import { moduloMapas } from './moduloMapas';

export type PuntoPlano = { x: number; y: number };
export type MarcaKm = PuntoPlano & { km: number };

const ALTO = px(190);
const MARGEN = px(16);

/**
 * La ruta en el rectángulo ancho × alto, centrada y sin deformar: un grado de
 * longitud mide menos que uno de latitud cuanto más lejos del ecuador.
 */
export function proyectarRuta(
  ruta: readonly Pick<PuntoRuta, 'lat' | 'lon'>[],
  ancho: number,
  alto: number,
  margen: number = MARGEN,
): PuntoPlano[] {
  if (ruta.length === 0 || ancho <= 2 * margen || alto <= 2 * margen) return [];
  const lats = ruta.map((p) => p.lat);
  const lons = ruta.map((p) => p.lon);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  const coseno = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180);
  const anchoRuta = (maxLon - minLon) * coseno;
  const altoRuta = maxLat - minLat;
  const utilX = ancho - 2 * margen;
  const utilY = alto - 2 * margen;
  // Una ruta sin extensión (un punto repetido) va al centro.
  const escala = Math.min(anchoRuta > 0 ? utilX / anchoRuta : Infinity, altoRuta > 0 ? utilY / altoRuta : Infinity);
  const k = Number.isFinite(escala) ? escala : 0;
  const x0 = (ancho - anchoRuta * k) / 2;
  const y0 = (alto - altoRuta * k) / 2;
  return ruta.map((p) => ({
    x: x0 + (p.lon - minLon) * coseno * k,
    // En la pantalla la y crece hacia abajo; la latitud, hacia arriba.
    y: y0 + (maxLat - p.lat) * k,
  }));
}

/** Cada cuántos km se marca: la ruta larga no se llena de puntos. */
export function pasoMarcas(metros: number): number {
  if (metros <= 15000) return 1;
  if (metros <= 50000) return 5;
  return 10;
}

/** Dónde cae cada marca de km sobre los puntos ya proyectados. */
export function marcasKm(ruta: readonly Pick<PuntoRuta, 'lat' | 'lon'>[], plano: readonly PuntoPlano[]): MarcaKm[] {
  if (ruta.length < 2 || plano.length !== ruta.length) return [];
  let total = 0;
  for (let i = 1; i < ruta.length; i++) total += distanciaM(ruta[i - 1]!, ruta[i]!);
  const paso = pasoMarcas(total);
  const marcas: MarcaKm[] = [];
  let acumulado = 0;
  let siguiente = paso;
  for (let i = 1; i < ruta.length; i++) {
    acumulado += distanciaM(ruta[i - 1]!, ruta[i]!);
    while (acumulado >= siguiente * 1000) {
      marcas.push({ ...plano[i]!, km: siguiente });
      siguiente += paso;
    }
  }
  return marcas;
}

interface MapasNativos {
  MapView: ComponentType<Record<string, unknown>>;
  Polyline: ComponentType<Record<string, unknown>>;
}

let nativos: MapasNativos | null | undefined;

/** El mapa nativo, o null si este binario no lo trae. Nunca lanza. */
function mapasNativos(): MapasNativos | null {
  if (nativos !== undefined) return nativos;
  nativos = null;
  try {
    if (Platform.OS === 'ios' && UIManager.hasViewManagerConfig?.('AIRMap')) {
      const m = moduloMapas();
      if (m?.default && m?.Polyline) {
        nativos = { MapView: m.default as MapasNativos['MapView'], Polyline: m.Polyline as MapasNativos['Polyline'] };
      }
    }
  } catch {
    nativos = null;
  }
  return nativos;
}

function MapaSvg({ ruta }: { ruta: readonly PuntoRuta[] }) {
  const [ancho, setAncho] = useState(0);
  const plano = ancho > 0 ? proyectarRuta(ruta, ancho, ALTO) : [];
  const marcas = marcasKm(ruta, plano);
  const puntos = plano.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const inicio = plano[0];
  const fin = plano[plano.length - 1];
  return (
    <View style={styles.caja} onLayout={(e) => setAncho(Math.floor(e.nativeEvent.layout.width))}>
      {ancho > 0 && inicio && fin ? (
        <>
          <Svg width={ancho} height={ALTO}>
            <Polyline points={puntos} fill="none" stroke={C.blanco} strokeWidth={2.4} strokeLinejoin="round" strokeLinecap="round" />
            {marcas.map((m) => (
              <Circle key={m.km} cx={m.x} cy={m.y} r={2.4} fill={C.fondo} stroke={C.suave} strokeWidth={1.2} />
            ))}
            <Circle cx={inicio.x} cy={inicio.y} r={5} fill={C.fondo} stroke={C.blanco} strokeWidth={2} />
            <Rect x={fin.x - 4.5} y={fin.y - 4.5} width={9} height={9} fill={C.blanco} />
          </Svg>
          {marcas.map((m) => (
            <Text key={m.km} style={[styles.km, { left: m.x + 5, top: m.y - 13 }]} maxFontSizeMultiplier={1}>
              {m.km}
            </Text>
          ))}
        </>
      ) : null}
    </View>
  );
}

function regionDe(ruta: readonly PuntoRuta[]) {
  const lats = ruta.map((p) => p.lat);
  const lons = ruta.map((p) => p.lon);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLon + maxLon) / 2,
    latitudeDelta: Math.max(0.005, (maxLat - minLat) * 1.3),
    longitudeDelta: Math.max(0.005, (maxLon - minLon) * 1.3),
  };
}

export function RutaMapa({ ruta, distanciaTexto }: { ruta: readonly PuntoRuta[]; distanciaTexto: string | null }) {
  const nativo = mapasNativos();
  const etiqueta = distanciaTexto ? t('resistencia:detalle.mapaA11y', { distancia: distanciaTexto }) : t('resistencia:detalle.mapaSinDistanciaA11y');
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={etiqueta}>
      {nativo ? (
        <View style={styles.caja} pointerEvents="none">
          <nativo.MapView
            style={StyleSheet.absoluteFill}
            mapType="mutedStandard"
            userInterfaceStyle="dark"
            initialRegion={regionDe(ruta)}
            scrollEnabled={false}
            zoomEnabled={false}
            rotateEnabled={false}
            pitchEnabled={false}
            showsPointsOfInterest={false}
            toolbarEnabled={false}
          >
            <nativo.Polyline
              coordinates={ruta.map((p) => ({ latitude: p.lat, longitude: p.lon }))}
              strokeColor={C.blanco}
              strokeWidth={3}
              lineJoin="round"
              lineCap="round"
            />
          </nativo.MapView>
        </View>
      ) : (
        <MapaSvg ruta={ruta} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  caja: { height: ALTO, borderWidth: 1, borderColor: C.filete, backgroundColor: C.fondo, overflow: 'hidden' },
  km: { position: 'absolute', fontFamily: F.b, fontSize: fs(9.5), color: C.suave },
});
