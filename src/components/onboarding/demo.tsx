// Demo de la galería /kit/pantallas (solo desarrollo). Lo rellena el encargo
// de esta pantalla del rediseño L-RADICAL (docs/design-v2/L-RADICAL.md §C).
//
// El onboarding no tiene hook ni vista: aquí van sus tres piezas puras
// (PortadaArena, TablillaContrato, ProgresoPasos) dentro de un marco con el
// mismo margen (24) y el mismo pie fijo que la pantalla real.
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { HOY_DEMO } from '@/components/arena/demoDatos';
import type { DemoPantalla } from '@/components/arena/galeria';
import { Button } from '@/components/ui';
import { GutterContext } from '@/components/ui/Screen';
import { ink, space, stroke } from '@/design/tokens';
import { TopeAncho } from '@/design/useSizeClass';
import { HORIZONTE_POR_DEFECTO, textoCompromiso } from '@/lib/compromiso';
import { addDays, fechaConAnio } from '@/lib/dates';
import { PortadaArena } from './PortadaArena';
import { ProgresoPasos } from './ProgresoPasos';
import { TablillaContrato } from './TablillaContrato';
import { TituloPaso } from './TituloPaso';

const GUTTER = 24;
const ANCHO_COLUMNA = 560;
const TOTAL = 7;
const nada = () => {};

const ABRE_EL = addDays(HOY_DEMO, HORIZONTE_POR_DEFECTO.days);
const CONTRATO = textoCompromiso({
  name: 'Teferi',
  goal: 'Lanzar NIVL y llegar a mil gladiadores que entrenen cada día',
  target: '1.000 usuarios',
  deadline: 'junio de 2027',
  horizonte: HORIZONTE_POR_DEFECTO,
  firmadoEl: fechaConAnio(HOY_DEMO),
  seAbreEl: fechaConAnio(ABRE_EL),
});

/** El marco del onboarding: cabecera opcional, cuerpo con margen 24 y pie fijo. */
function Marco({ cabecera, pie, children }: { cabecera?: ReactNode; pie?: ReactNode; children: ReactNode }) {
  return (
    <View style={styles.pantalla}>
      {/* La misma columna de 560 que la pantalla real (iPad sin tope = 1320 pt). */}
      <TopeAncho.Provider value={ANCHO_COLUMNA}>
        <View style={styles.columna}>
          {cabecera ? <View style={styles.cabecera}>{cabecera}</View> : null}
          <ScrollView contentContainerStyle={styles.cuerpo} showsVerticalScrollIndicator={false}>
            <GutterContext.Provider value={GUTTER}>{children}</GutterContext.Provider>
          </ScrollView>
          {pie ? <View style={styles.pie}>{pie}</View> : null}
        </View>
      </TopeAncho.Provider>
    </View>
  );
}

export const DEMO: DemoPantalla | null = {
  id: 'onboarding',
  titulo: 'Onboarding',
  marco: 'pila',
  estados: [
    {
      id: 'portada',
      titulo: 'Portada',
      render: () => (
        <Marco pie={<Button title="Entrar en la arena" size="lg" onPress={nada} />}>
          <PortadaArena />
        </Marco>
      ),
    },
    {
      id: 'tablilla',
      titulo: 'Contrato',
      render: () => (
        <Marco cabecera={<ProgresoPasos paso={6} total={TOTAL} />}>
          <TituloPaso
            inscripcion="La firma"
            titulo="Fírmalo contigo"
            pista="Nadie más lo va a leer. Se sella hoy y se abre cuando venza el plazo. Elige cuánto te das."
          />
          <TablillaContrato parrafos={CONTRATO.split(/\n\s*\n/)} abreEl={fechaConAnio(ABRE_EL)} />
        </Marco>
      ),
    },
    {
      id: 'progreso',
      titulo: 'Progreso',
      render: () => (
        <Marco
          cabecera={<ProgresoPasos paso={2} total={TOTAL} />}
          pie={<Button title="Continuar" size="lg" onPress={nada} />}
        >
          <TituloPaso inscripcion="El nombre" titulo="¿Cómo te llamas?" />
          <View style={styles.pasos}>
            {[1, 3, 4, 5, 7].map((p) => (
              <ProgresoPasos key={p} paso={p} total={TOTAL} />
            ))}
          </View>
        </Marco>
      ),
    },
  ],
};

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: ink.ink0 },
  columna: { flex: 1, width: '100%', maxWidth: ANCHO_COLUMNA + 2 * GUTTER, alignSelf: 'center' },
  cabecera: { paddingHorizontal: GUTTER, paddingTop: space.s4 },
  cuerpo: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: GUTTER, paddingTop: space.s5, paddingBottom: space.s6 },
  pasos: { gap: space.s6, marginTop: space.s4 },
  pie: {
    paddingHorizontal: GUTTER,
    paddingVertical: space.s3,
    borderTopWidth: stroke.hairline,
    borderTopColor: ink.ink3,
    backgroundColor: ink.ink0,
  },
});
