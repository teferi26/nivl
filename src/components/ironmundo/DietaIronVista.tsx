// NIVL · Mundo IRON: la pestaña Dieta (pura), en la piel de la lámina 2 (la
// tarjeta «Dieta de hoy» crecida a pantalla). De arriba abajo:
//   1 · Dieta de hoy (héroe): el anillo de calorías y las barras de proteína
//       y agua, con el objetivo del coach.
//   2 · El parte del día: calorías y proteína cumplidas, notas y GUARDAR
//       (useNutricion: el mismo pago, una vez al día, por el recibo).
//   3 · Agua: ocho vasos que se tocan (0075).
//   4 · Comida libre: un interruptor, sin castigo (0075).
//   5 · Comidas de hoy: el plan de la semana del día de hoy (useDieta, su
//       hoja para editar, generar con el coach y la lista de la compra).
//   6 · Peso corporal: el último, el cambio en 30 días, la gráfica y pesarse
//       (useAvances: el mismo pesaje y su XP). Dato de salud: la pestaña entera
//       va tras la guarda de salud.

import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { nombreComida } from '@/components/dieta/DietaVista';
import { kgTexto } from '@/components/iron/HistorialIron';
import { t } from '@/i18n';
import { decimal, miles } from '@/i18n/formato';
import { MEAL_SLOTS } from '@/lib/body';
import type { NutritionLog, NutritionTarget } from '@/lib/bodywork';
import type { MealSlot, MealSlotName } from '@/lib/types';
import { resumenPeso, vasosDe, VASOS_OBJETIVO, type Pesaje } from './calculos';
import { GlifoIron } from './Glifos';
import {
  AnilloIron,
  BarraIron,
  BotonIron,
  ChipIron,
  estilosIron,
  FilaIron,
  HuecoIron,
  LineaAncha,
  PantallaIron,
  RotuloIron,
  TarjetaIron,
} from './piezas';
import { A, acentoA, C, F, fs, mezcla, px } from './tema';

export interface ParteIronProps {
  cargado: boolean;
  errorCarga: string | null;
  objetivo: NutritionTarget | null;
  hoyLog: NutritionLog | null;
  kcal: boolean;
  prote: boolean;
  notas: string;
  guardando: boolean;
  xpDia: number;
  acciones: {
    onKcal: () => void;
    onProte: () => void;
    onNotas: (v: string) => void;
    onGuardar: () => void;
    onCoach: () => void;
    onReintentar: () => void;
  };
}

export interface AguaLibreIronProps {
  cargado: boolean;
  ml: number;
  objetivoMl: number;
  libre: boolean;
  guardando: boolean;
  error: string | null;
  onVaso: (i: number) => void;
  onMas: () => void;
  onLibre: () => void;
}

export interface ComidasIronProps {
  cargado: boolean;
  errorCarga: string | null;
  /** Las comidas del plan de HOY. */
  hoy: MealSlot[];
  generando: boolean;
  acciones: {
    onComida: (slot: MealSlotName) => void;
    onGenerar: () => void;
    onCompra: () => void;
    onReintentar: () => void;
  };
}

export interface PesoIronProps {
  cargado: boolean;
  pesajes: readonly Pesaje[];
  pesadoHoy: boolean;
  valor: string;
  error: string | null;
  pesando: boolean;
  xpPesaje: number;
  onValor: (v: string) => void;
  onPesar: () => void;
}

export interface DietaIronVistaProps {
  cabecera: ReactNode;
  /** «mar 20 oct». */
  fecha: string;
  parte: ParteIronProps;
  agua: AguaLibreIronProps;
  comidas: ComidasIronProps;
  peso: PesoIronProps;
  overlay?: ReactNode;
}

/** Mililitros en litros, sin ceros de cola: 1500 → «1,5»; 2000 → «2»; 1250 → «1,25». */
export function litros(ml: number): string {
  const l = Math.round(ml / 10) / 100;
  return decimal(l, (String(l).split('.')[1] ?? '').length);
}

function Heroe({ fecha, parte, agua }: { fecha: string; parte: ParteIronProps; agua: AguaLibreIronProps }) {
  if (!parte.cargado) {
    return (
      <View accessibilityRole="progressbar" accessibilityLabel={t('ironmundo:dieta.cargandoA11y')}>
        <HuecoIron alto={px(170)} />
      </View>
    );
  }
  const obj = parte.objetivo;
  const kcal = parte.hoyLog?.kcal_est ?? null;
  const prot = parte.hoyLog?.protein_est ?? null;
  const ratio = kcal !== null && obj ? kcal / obj.kcal : 0;
  const barras = [
    {
      nombre: t('ironmundo:dieta.proteina'),
      valor: obj ? t('ironmundo:dieta.deG', { g: prot ?? 0, total: obj.protein_g }) : prot !== null ? t('ironmundo:dieta.g', { g: prot }) : t('ironmundo:sinDato'),
      r: prot !== null && obj ? prot / obj.protein_g : 0,
    },
    {
      nombre: t('ironmundo:dieta.agua'),
      valor: t('ironmundo:dieta.deL', { l: litros(agua.ml), total: litros(agua.objetivoMl) }),
      r: agua.objetivoMl ? agua.ml / agua.objetivoMl : 0,
    },
    {
      nombre: t('ironmundo:dieta.parte'),
      valor: t('ironmundo:dieta.deParte', { n: (parte.kcal ? 1 : 0) + (parte.prote ? 1 : 0) }),
      r: ((parte.kcal ? 1 : 0) + (parte.prote ? 1 : 0)) / 2,
    },
  ];
  return (
    <TarjetaIron heroe>
      <RotuloIron
        texto={t('ironmundo:dieta.rotuloFecha', { fecha })}
        em={kcal !== null && obj ? t('ironmundo:pct', { pct: Math.round(ratio * 100) }) : undefined}
      />
      <View style={styles.heroe}>
        <AnilloIron
          ratio={ratio}
          lado={px(96)}
          valor={kcal !== null ? miles(kcal) : t('ironmundo:sinDato')}
          unidad={obj ? t('ironmundo:dieta.deKcal', { total: miles(obj.kcal) }) : t('ironmundo:unidadKcal')}
        />
        <View style={styles.flex}>
          {barras.map((b) => (
            <View key={b.nombre} style={styles.macro} accessible accessibilityLabel={t('ironmundo:par', { a: b.nombre, b: b.valor })}>
              <View style={styles.macroFila}>
                <Text style={styles.macroNombre} maxFontSizeMultiplier={1.2}>
                  {b.nombre}
                </Text>
                <Text style={styles.macroValor} maxFontSizeMultiplier={1.2}>
                  {b.valor}
                </Text>
              </View>
              <BarraIron ratio={b.r} alto={4} style={styles.macroBarra} />
            </View>
          ))}
        </View>
      </View>
      <Text style={[estilosIron.detalle, styles.objetivo]} maxFontSizeMultiplier={1.6}>
        {obj
          ? t('ironmundo:dieta.objetivo', { kcal: miles(obj.kcal), proteina: obj.protein_g })
          : t('ironmundo:dieta.sinObjetivo')}
      </Text>
      {!obj ? <BotonIron fantasma fino titulo={t('ironmundo:dieta.pedirObjetivo')} onPress={parte.acciones.onCoach} /> : null}
    </TarjetaIron>
  );
}

function Marca({ hecho, texto, onPress }: { hecho: boolean; texto: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: hecho }}
      accessibilityLabel={texto}
      style={({ pressed }) => [styles.marca, pressed && styles.pulsado]}
    >
      <View style={[styles.caja, hecho && styles.cajaHecha]}>{hecho ? <GlifoIron nombre="check" lado={px(13)} color={C.fondo} grosor={2.8} /> : null}</View>
      <Text style={[estilosIron.filaNombre, styles.flex]} maxFontSizeMultiplier={1.35}>
        {texto}
      </Text>
    </Pressable>
  );
}

function Parte({ p }: { p: ParteIronProps }) {
  if (!p.cargado) return null;
  if (p.errorCarga) {
    return (
      <TarjetaIron>
        <Text style={estilosIron.cuerpo} maxFontSizeMultiplier={1.6}>
          {p.errorCarga}
        </Text>
        <BotonIron fantasma fino titulo={t('ironmundo:reintentar')} onPress={p.acciones.onReintentar} />
      </TarjetaIron>
    );
  }
  const pagado = !!(p.hoyLog?.hit_kcal && p.hoyLog?.hit_protein);
  return (
    <TarjetaIron>
      <RotuloIron texto={t('ironmundo:dieta.parteRotulo')} em={pagado ? t('ironmundo:dieta.parteHecho') : t('ironmundo:hastaXp', { xp: p.xpDia })} />
      <View style={styles.marcas}>
        <Marca hecho={p.kcal} texto={t('ironmundo:dieta.kcalCumplidas')} onPress={p.acciones.onKcal} />
        <Marca hecho={p.prote} texto={t('ironmundo:dieta.proteCumplida')} onPress={p.acciones.onProte} />
      </View>
      <TextInput
        value={p.notas}
        onChangeText={p.acciones.onNotas}
        placeholder={t('ironmundo:dieta.notas')}
        placeholderTextColor={C.tenue}
        accessibilityLabel={t('ironmundo:dieta.notasA11y')}
        multiline
        maxLength={500}
        style={styles.notas}
        maxFontSizeMultiplier={1.35}
      />
      <BotonIron titulo={t('ironmundo:dieta.guardarParte')} onPress={p.acciones.onGuardar} ocupado={p.guardando} />
    </TarjetaIron>
  );
}

function Agua({ a }: { a: AguaLibreIronProps }) {
  const llenos = vasosDe(a.ml);
  return (
    <TarjetaIron>
      <RotuloIron
        texto={t('ironmundo:agua.rotulo')}
        em={t('ironmundo:dieta.deL', { l: litros(a.ml), total: litros(a.objetivoMl) })}
      />
      <View style={styles.vasos} accessibilityRole="adjustable" accessibilityLabel={t('ironmundo:agua.a11y', { vasos: llenos, total: VASOS_OBJETIVO })}>
        {Array.from({ length: VASOS_OBJETIVO }, (_, i) => {
          const lleno = i < llenos;
          return (
            <Pressable
              key={i}
              onPress={() => a.onVaso(i)}
              disabled={!a.cargado}
              hitSlop={4}
              accessibilityRole="button"
              accessibilityLabel={t('ironmundo:agua.vasoA11y', { n: i + 1 })}
              accessibilityState={{ selected: lleno }}
              style={({ pressed }) => [styles.vaso, lleno && styles.vasoLleno, pressed && styles.pulsado]}
            >
              <GlifoIron nombre="gota" lado={px(16)} color={lleno ? A : C.apagado} grosor={lleno ? 2 : 1.6} />
            </Pressable>
          );
        })}
      </View>
      {a.error ? (
        <Text style={estilosIron.error} maxFontSizeMultiplier={1.6}>
          {a.error}
        </Text>
      ) : null}
      <BotonIron fantasma fino titulo={t('ironmundo:agua.mas')} onPress={a.onMas} desactivado={!a.cargado} />
    </TarjetaIron>
  );
}

function Libre({ a }: { a: AguaLibreIronProps }) {
  return (
    <TarjetaIron heroe={a.libre}>
      <RotuloIron texto={t('ironmundo:libre.rotulo')} em={a.libre ? t('ironmundo:libre.hoy') : undefined} />
      <Text style={[estilosIron.cuerpo, styles.libreTexto]} maxFontSizeMultiplier={1.6}>
        {a.libre ? t('ironmundo:libre.activa') : t('ironmundo:libre.cuerpo')}
      </Text>
      <View style={styles.libreChip}>
        <ChipIron
          texto={a.libre ? t('ironmundo:libre.quitar') : t('ironmundo:libre.marcar')}
          activo={a.libre}
          onPress={a.cargado ? a.onLibre : undefined}
          accessibilityLabel={t('ironmundo:libre.a11y')}
        />
      </View>
    </TarjetaIron>
  );
}

function Comidas({ c }: { c: ComidasIronProps }) {
  return (
    <View>
      <RotuloIron seccion texto={t('ironmundo:comidas.rotulo')} em={t('ironmundo:comidas.compra')} onEm={c.acciones.onCompra} />
      {!c.cargado ? (
        <HuecoIron alto={px(150)} />
      ) : c.errorCarga ? (
        <TarjetaIron>
          <Text style={estilosIron.cuerpo} maxFontSizeMultiplier={1.6}>
            {c.errorCarga}
          </Text>
          <BotonIron fantasma fino titulo={t('ironmundo:reintentar')} onPress={c.acciones.onReintentar} />
        </TarjetaIron>
      ) : (
        <TarjetaIron>
          {MEAL_SLOTS.filter((s) => s !== 'snack' || c.hoy.some((m) => m.slot === 'snack')).map((slot, i) => {
            const m = c.hoy.find((x) => x.slot === slot);
            const cifras = m
              ? [m.kcal !== null ? t('ironmundo:comidas.kcal', { kcal: miles(m.kcal) }) : null, m.protein_g !== null ? t('ironmundo:dieta.g', { g: m.protein_g }) : null]
                  .filter(Boolean)
                  .join(' · ')
              : '';
            return (
              <FilaIron
                key={slot}
                primera={i === 0}
                onPress={() => c.acciones.onComida(slot)}
                style={styles.comida}
                accessibilityLabel={m ? `${nombreComida(slot)}: ${m.description}. ${cifras}` : t('ironmundo:comidas.vaciaA11y', { comida: nombreComida(slot) })}
              >
                <View style={styles.flex}>
                  <Text style={styles.comidaNombre} maxFontSizeMultiplier={1.35}>
                    {nombreComida(slot).toUpperCase()}
                  </Text>
                  <Text style={[estilosIron.filaNombre, !m && styles.comidaVacia]} numberOfLines={2} maxFontSizeMultiplier={1.35}>
                    {m ? m.description : t('ironmundo:comidas.vacia')}
                  </Text>
                </View>
                {m ? (
                  <Text style={[estilosIron.filaSerie, styles.comidaCifras]} maxFontSizeMultiplier={1.35}>
                    {cifras}
                  </Text>
                ) : (
                  <GlifoIron nombre="mas" lado={px(14)} color={A} grosor={2.2} />
                )}
              </FilaIron>
            );
          })}
          <BotonIron fantasma fino titulo={t('ironmundo:comidas.generar')} onPress={c.acciones.onGenerar} ocupado={c.generando} />
        </TarjetaIron>
      )}
    </View>
  );
}

function Peso({ p }: { p: PesoIronProps }) {
  const r = resumenPeso(p.pesajes);
  return (
    <View>
      <RotuloIron seccion texto={t('ironmundo:peso.rotulo')} em={r.fecha ? t('ironmundo:peso.ultimo', { fecha: r.fecha.slice(8, 10) + '/' + r.fecha.slice(5, 7) }) : undefined} />
      {!p.cargado ? (
        <HuecoIron alto={px(190)} />
      ) : (
        <TarjetaIron>
          <View style={styles.pesoCabeza}>
            <Text style={styles.pesoKg} maxFontSizeMultiplier={1}>
              {r.ultimo !== null ? kgTexto(r.ultimo) : t('ironmundo:sinDato')}
              <Text style={styles.pesoUnidad}>{` ${t('ironmundo:unidadKg')}`}</Text>
            </Text>
            {r.cambio30 !== null ? (
              <Text style={[estilosIron.delta, styles.pesoDelta]} maxFontSizeMultiplier={1.2}>
                {r.cambio30 <= 0
                  ? t('ironmundo:peso.baja', { kg: kgTexto(-r.cambio30) })
                  : t('ironmundo:peso.sube', { kg: kgTexto(r.cambio30) })}
              </Text>
            ) : null}
          </View>
          {r.serie.length >= 2 ? (
            <View style={styles.pesoGrafica}>
              <LineaAncha puntos={r.serie} alto={px(64)} grosor={2} />
            </View>
          ) : (
            <Text style={[estilosIron.detalle, styles.pesoVacio]} maxFontSizeMultiplier={1.6}>
              {t('ironmundo:peso.vacio')}
            </Text>
          )}
          <View style={styles.pesar}>
            <TextInput
              value={p.valor}
              onChangeText={p.onValor}
              placeholder={t('ironmundo:peso.placeholder')}
              placeholderTextColor={C.tenue}
              keyboardType="decimal-pad"
              accessibilityLabel={t('ironmundo:peso.campoA11y')}
              style={styles.campoPeso}
              maxFontSizeMultiplier={1.35}
              returnKeyType="done"
              onSubmitEditing={p.onPesar}
            />
            <BotonIron
              titulo={p.pesadoHoy ? t('ironmundo:peso.corregir') : t('ironmundo:peso.pesar', { xp: p.xpPesaje })}
              onPress={p.onPesar}
              ocupado={p.pesando}
              style={styles.botonPesar}
            />
          </View>
          {p.error ? (
            <Text style={estilosIron.error} maxFontSizeMultiplier={1.6}>
              {p.error}
            </Text>
          ) : null}
          <Text style={[estilosIron.detalle, styles.privado]} maxFontSizeMultiplier={1.6}>
            {t('ironmundo:peso.privado')}
          </Text>
        </TarjetaIron>
      )}
    </View>
  );
}

export function DietaIronVista({ cabecera, fecha, parte, agua, comidas, peso, overlay }: DietaIronVistaProps) {
  return (
    <PantallaIron overlay={overlay}>
      {cabecera}
      <Heroe fecha={fecha} parte={parte} agua={agua} />
      <Parte p={parte} />
      <Agua a={agua} />
      <Libre a={agua} />
      <Comidas c={comidas} />
      <Peso p={peso} />
    </PantallaIron>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  pulsado: { opacity: 0.7 },
  heroe: { flexDirection: 'row', alignItems: 'center', gap: px(14), marginTop: px(8) },
  macro: { marginBottom: px(7) },
  macroFila: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: px(6) },
  macroNombre: { fontFamily: F.sb, fontSize: fs(9.5), color: C.meta },
  macroValor: { fontFamily: F.b, fontSize: fs(9.5), color: C.blanco },
  macroBarra: { marginTop: px(3) },
  objetivo: { marginTop: px(4) },
  marcas: { marginTop: px(6), gap: px(2) },
  marca: { flexDirection: 'row', alignItems: 'center', gap: px(10), minHeight: 44 },
  caja: {
    width: px(20),
    height: px(20),
    borderRadius: px(6),
    borderWidth: 1.5,
    borderColor: C.suelo,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cajaHecha: { backgroundColor: A, borderColor: A },
  notas: {
    marginTop: px(6),
    minHeight: px(56),
    borderRadius: px(10),
    borderWidth: 1,
    borderColor: C.borde,
    backgroundColor: C.fondo,
    color: C.claro,
    fontFamily: F.r,
    fontSize: fs(11),
    paddingHorizontal: px(10),
    paddingVertical: px(8),
    textAlignVertical: 'top',
  },
  vasos: { flexDirection: 'row', justifyContent: 'space-between', marginTop: px(10), marginBottom: px(2) },
  vaso: {
    width: px(32),
    height: px(40),
    borderRadius: px(9),
    borderWidth: 1,
    borderColor: C.borde,
    backgroundColor: C.tarjeta,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vasoLleno: { borderColor: acentoA(0.7), backgroundColor: mezcla(0.16, C.tarjeta) },
  libreTexto: { marginTop: px(4) },
  libreChip: { flexDirection: 'row', marginTop: px(8) },
  comida: { paddingVertical: px(8) },
  comidaNombre: { fontFamily: F.b, fontSize: fs(8), letterSpacing: fs(8) * 0.16, color: C.mudo, marginBottom: px(1) },
  comidaVacia: { color: C.tenue },
  comidaCifras: { textAlign: 'right', maxWidth: px(110) },
  pesoCabeza: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: px(8), marginTop: px(2) },
  pesoKg: { fontFamily: F.xb, fontSize: fs(30), color: C.blanco },
  pesoUnidad: { fontFamily: F.sb, fontSize: fs(12), color: C.mudo },
  pesoDelta: { fontSize: fs(10) },
  pesoGrafica: { marginTop: px(8), marginBottom: px(2) },
  pesoVacio: { marginTop: px(6) },
  pesar: { flexDirection: 'row', alignItems: 'center', gap: px(8), marginTop: px(8) },
  campoPeso: {
    minWidth: 0,
    flex: 1,
    height: px(32),
    marginTop: px(7),
    borderRadius: px(11),
    borderWidth: 1,
    borderColor: C.borde,
    backgroundColor: C.fondo,
    color: C.blanco,
    fontFamily: F.b,
    fontSize: fs(13),
    paddingHorizontal: px(10),
  },
  botonPesar: { flexShrink: 0, paddingHorizontal: px(16) },
  privado: { marginTop: px(8), color: C.tenue },
});
