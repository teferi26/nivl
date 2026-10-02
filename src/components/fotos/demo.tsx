// Demo de la galería /kit/pantallas?pantalla=fotos (solo desarrollo, L5).
//
// FotosVista con datos de mentira: sin sesión ni Supabase. Las «fotos» son
// siluetas en SVG (data URI) pintadas con los tokens de tinta, para ver la
// composición sin enseñar a nadie. «Hoy» es HOY_DEMO; las acciones no hacen
// nada.
import { StyleSheet } from 'react-native';
import { EncabezadoArena } from '@/components/arena';
import type { DemoPantalla } from '@/components/arena/galeria';
import { HOY_DEMO } from '@/components/arena/demoDatos';
import { Screen, Section } from '@/components/ui';
import { ink } from '@/design/tokens';
import { addDays } from '@/lib/dates';
import { POSES, lunesDe, type FotoProgreso, type PesoDia, type Pose } from '@/lib/progressPhotos';
import { CompararFotos } from './CompararFotos';
import { FotosVista, type FotosVistaProps } from './FotosVista';

const nada = () => {};

/** Silueta por pose; `t` de 0 (antes) a 1 (ahora) estrecha la cintura. */
function silueta(pose: Pose, t: number): string {
  const cintura = Math.round(30 - 8 * t);
  const lado = pose === 'lado';
  const hombro = lado ? 22 : 40;
  const c = lado ? Math.round(cintura * 0.7) : cintura;
  const cuerpo = `M${60 - hombro} 70 Q60 60 ${60 + hombro} 70 L${60 + c} 118 L${60 + c - 4} 150 L${60 - c + 4} 150 L${60 - c} 118 Z`;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 160">` +
    `<rect width="120" height="160" fill="${ink.ink2}"/>` +
    `<rect x="0" y="150" width="120" height="10" fill="${ink.ink3}"/>` +
    `<circle cx="60" cy="44" r="14" fill="${pose === 'espalda' ? ink.ink4 : ink.ink6}"/>` +
    `<path d="${cuerpo}" fill="${pose === 'espalda' ? ink.ink4 : ink.ink6}"/>` +
    `</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const SEMANAS = 14;
/** Semana 3 empezando por el final: sin espalda (no rompe la línea, sí la racha). */
const SIN_ESPALDA = 9;

function fotosDemo(): { fotos: FotoProgreso[]; pesos: PesoDia[]; urls: Record<string, string> } {
  const fotos: FotoProgreso[] = [];
  const pesos: PesoDia[] = [];
  const urls: Record<string, string> = {};
  const lunes = lunesDe(HOY_DEMO);
  for (let s = SEMANAS - 1; s >= 0; s--) {
    const inicio = addDays(lunes, -7 * s);
    const t = (SEMANAS - 1 - s) / (SEMANAS - 1);
    const kg = Math.round((84.6 - 5.4 * t) * 10) / 10;
    pesos.push({ fecha: inicio, kg });
    POSES.forEach((pose, i) => {
      // Esta semana (viernes 2 oct) aún falta la espalda.
      if (s === 0 && pose === 'espalda') return;
      if (s === SIN_ESPALDA && pose === 'espalda') return;
      const id = `demo-${s}-${pose}`;
      fotos.push({ id, fecha: addDays(inicio, i === 2 ? 1 : 0), pose, pesoKg: null });
      urls[id] = silueta(pose, t);
    });
  }
  return { fotos, pesos, urls };
}

const DATOS = fotosDemo();

function base(cambios: Partial<FotosVistaProps> = {}): FotosVistaProps {
  return {
    acceso: 'abierto',
    cargado: true,
    error: null,
    hoy: HOY_DEMO,
    fotos: DATOS.fotos,
    pesos: DATOS.pesos,
    urls: DATOS.urls,
    semanasVisibles: 8,
    puedeCompartir: true,
    compartiendo: false,
    confirmandoEdad: false,
    errorEdad: null,
    acciones: {
      onVolver: nada,
      onNueva: nada,
      onVerMas: nada,
      onAbrir: nada,
      onFallo: nada,
      onPedirFirmas: nada,
      onCompartir: nada,
      onConfirmarEdad: nada,
      onAhoraNo: nada,
      onRevisarSalud: nada,
      onReintentar: nada,
    },
    ...cambios,
  };
}

export const DEMO: DemoPantalla | null = {
  id: 'fotos',
  titulo: 'Fotos',
  estados: [
    { id: 'con-fotos', titulo: 'Con fotos', render: () => <FotosVista {...base()} /> },
    { id: 'sin-fotos', titulo: 'Sin fotos', render: () => <FotosVista {...base({ fotos: [], pesos: [], urls: {} })} /> },
    {
      id: 'confirmar-18',
      titulo: 'Confirmar 18+',
      render: () => <FotosVista {...base({ acceso: 'confirmar_edad', fotos: [], urls: {} })} />,
    },
    {
      id: 'comparar',
      titulo: 'Comparar con peso',
      render: () => (
        <Screen>
          <EncabezadoArena eyebrow="Progreso" titulo="Fotos" subtitulo="Antes y después, con el peso encendido." onVolver={nada} />
          <Section title="Antes y después" style={styles.sinMargen}>
            <CompararFotos
              fotos={DATOS.fotos}
              pesos={DATOS.pesos}
              hoy={HOY_DEMO}
              urls={DATOS.urls}
              puedeCompartir
              compartiendo={false}
              onCompartir={nada}
              onPedirFirmas={nada}
              onFallo={nada}
              inicial={{ pose: 'frente', plazo: 90, mostrarPeso: true }}
            />
          </Section>
        </Screen>
      ),
    },
    { id: 'sin-salud', titulo: 'Sin permiso de salud', render: () => <FotosVista {...base({ acceso: 'sin_salud' })} /> },
    { id: 'cargando', titulo: 'Cargando', render: () => <FotosVista {...base({ cargado: false })} /> },
  ],
};

const styles = StyleSheet.create({
  sinMargen: { marginTop: 0 },
});
