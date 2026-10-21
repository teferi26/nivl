// NIVL · WORK: las hojas de la economía. Puras: el formulario, los cerrojos y
// el guardado viven en useWorkEconomia.
//
//   · HojaMovimiento: gasto o ingreso en DOS TOQUES. Se escribe el importe (el
//     teclado sale solo) y tocar una categoría lo guarda. La cuenta viene
//     elegida (la última usada) y el concepto es opcional.
//   · HojaTransferencia: de una cuenta propia a otra (dos movimientos internos).
//   · HojaCuenta: nombre, tipo y SALDO INICIAL (también para corregirlo).
//   · HojaFijo: el ingreso mensual o un gasto fijo, con su día de cobro.
//   · HojaCategorias: las de serie y las propias; crear una nueva.
//   · HojaImportar: de qué cuenta es el extracto y elegir el archivo.
// Los fallos van en línea (ErrorSistema compacto), nunca en un aviso encima.

import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';
import { Campo, ErrorSistema } from '@/components/arena';
import { Button, Sheet } from '@/components/ui';
import { ink, space, type as tipo } from '@/design/tokens';
import { t } from '@/i18n';
import { BASE_DE_GRUPO, GRUPOS, type CategoriaPropia, type GrupoId, type TipoCuenta } from '@/lib/moneywork';
import { BotonWork, ChipWork, FilaChips, RotuloGrupo, useAcento } from './PiezasWork';
import { euros, ICONO_GRUPO, iconoCuenta, nombreGrupo } from './nombres';

export interface CuentaElegible {
  id: string;
  nombre: string;
  tipo: string;
  saldo: number;
}

/** La categoría elegida: un grupo de serie o una propia. */
export type CategoriaElegida = { grupo: GrupoId } | { propia: string } | { ingreso: 'ingreso_nomina' | 'ingreso_negocio' | 'ingreso_otro' };

const INGRESOS = [
  { base: 'ingreso_nomina', clave: 'nomina' },
  { base: 'ingreso_negocio', clave: 'negocio' },
  { base: 'ingreso_otro', clave: 'otro' },
] as const;

function SelectorCuenta({
  cuentas,
  elegida,
  onElegir,
  excluir,
  rotulo,
}: {
  cuentas: readonly CuentaElegible[];
  elegida: string | null;
  onElegir: (id: string) => void;
  excluir?: string | null;
  rotulo: string;
}) {
  return (
    <View style={styles.grupo}>
      <RotuloGrupo>{rotulo}</RotuloGrupo>
      <FilaChips>
        {cuentas.map((c) => (
          <ChipWork
            key={c.id}
            etiqueta={c.nombre}
            icono={iconoCuenta(c.tipo)}
            elegido={elegida === c.id}
            disabled={excluir === c.id}
            onPress={() => onElegir(c.id)}
            accessibilityLabel={t('economia:work.hojas.cuentaA11y', { nombre: c.nombre, importe: euros(c.saldo) })}
          />
        ))}
      </FilaChips>
    </View>
  );
}

// ── Gasto o ingreso en dos toques ───────────────────────────────────

export interface HojaMovimientoProps {
  tipo: 'gasto' | 'ingreso' | null;
  importe: string;
  concepto: string;
  cuentas: CuentaElegible[];
  cuenta: string | null;
  propias: CategoriaPropia[];
  guardando: boolean;
  errorImporte: string | null;
  error: string | null;
  onTipo: (t: 'gasto' | 'ingreso') => void;
  onImporte: (v: string) => void;
  onConcepto: (v: string) => void;
  onCuenta: (id: string) => void;
  /** Tocar una categoría GUARDA (segundo toque). */
  onCategoria: (c: CategoriaElegida) => void;
  onCerrar: () => void;
}

export function HojaMovimiento(p: HojaMovimientoProps) {
  const a = useAcento();
  const tipo = p.tipo ?? 'gasto';
  const propias = p.propias.filter((c) => c.kind === tipo);
  return (
    <Sheet
      visible={p.tipo !== null}
      onClose={p.onCerrar}
      eyebrow={t('economia:work.hojas.mov.eyebrow')}
      title={t(tipo === 'gasto' ? 'economia:work.hojas.mov.tituloGasto' : 'economia:work.hojas.mov.tituloIngreso')}
      footer={<Button title={t('comun:cancelar')} variant="ghost" onPress={p.onCerrar} />}
    >
      <View style={styles.pila}>
        <FilaChips>
          <ChipWork etiqueta={t('economia:work.hojas.mov.gasto')} icono="remove" elegido={tipo === 'gasto'} onPress={() => p.onTipo('gasto')} />
          <ChipWork etiqueta={t('economia:work.hojas.mov.ingreso')} icono="add" elegido={tipo === 'ingreso'} onPress={() => p.onTipo('ingreso')} />
        </FilaChips>
        <Campo
          style={[styles.campo, { borderColor: a.tinte(0.55) }]}
          etiqueta={t('economia:work.hojas.mov.importe')}
          value={p.importe}
          onChangeText={p.onImporte}
          placeholder="0,00"
          keyboardType="decimal-pad"
          grande="rank"
          autoFocus
          error={p.errorImporte}
          accessibilityLabel={t('economia:work.hojas.mov.importeA11y')}
        />
        {p.cuentas.length > 1 ? (
          <SelectorCuenta cuentas={p.cuentas} elegida={p.cuenta} onElegir={p.onCuenta} rotulo={t('economia:work.hojas.cuenta')} />
        ) : null}
        <View style={styles.grupo}>
          <RotuloGrupo>{t('economia:work.hojas.mov.toca')}</RotuloGrupo>
          <FilaChips>
            {tipo === 'gasto'
              ? GRUPOS.map((g) => (
                  <ChipWork
                    key={g}
                    etiqueta={nombreGrupo(g)}
                    icono={ICONO_GRUPO[g]}
                    disabled={p.guardando}
                    onPress={() => p.onCategoria({ grupo: g })}
                    accessibilityLabel={t('economia:work.hojas.mov.guardarComoA11y', { categoria: nombreGrupo(g) })}
                  />
                ))
              : INGRESOS.map((i) => (
                  <ChipWork
                    key={i.base}
                    etiqueta={t(`economia:work.ingreso.${i.clave}`)}
                    icono="arrow-down"
                    disabled={p.guardando}
                    onPress={() => p.onCategoria({ ingreso: i.base })}
                    accessibilityLabel={t('economia:work.hojas.mov.guardarComoA11y', { categoria: t(`economia:work.ingreso.${i.clave}`) })}
                  />
                ))}
            {propias.map((c) => (
              <ChipWork
                key={c.id}
                etiqueta={c.name}
                icono="bookmark-outline"
                disabled={p.guardando}
                onPress={() => p.onCategoria({ propia: c.id })}
                accessibilityLabel={t('economia:work.hojas.mov.guardarComoA11y', { categoria: c.name })}
              />
            ))}
          </FilaChips>
        </View>
        <Campo
          style={[styles.campo, { borderColor: a.tinte(0.55) }]}
          etiqueta={t('economia:work.hojas.mov.concepto')}
          value={p.concepto}
          onChangeText={p.onConcepto}
          placeholder={t('economia:work.hojas.mov.conceptoPlaceholder')}
          ayuda={t('economia:work.hojas.mov.conceptoAyuda')}
        />
        {p.error ? <ErrorSistema compacto mensaje={p.error} /> : null}
      </View>
    </Sheet>
  );
}

// ── Transferencia entre cuentas ─────────────────────────────────────

export interface HojaTransferenciaProps {
  visible: boolean;
  cuentas: CuentaElegible[];
  origen: string | null;
  destino: string | null;
  importe: string;
  concepto: string;
  guardando: boolean;
  errorImporte: string | null;
  error: string | null;
  onOrigen: (id: string) => void;
  onDestino: (id: string) => void;
  onImporte: (v: string) => void;
  onConcepto: (v: string) => void;
  onGuardar: () => void;
  onCerrar: () => void;
}

export function HojaTransferencia(p: HojaTransferenciaProps) {
  const a = useAcento();
  return (
    <Sheet
      visible={p.visible}
      onClose={p.onCerrar}
      eyebrow={t('economia:work.hojas.trf.eyebrow')}
      title={t('economia:work.hojas.trf.titulo')}
      footer={
        <>
          <BotonWork titulo={t('economia:work.hojas.trf.guardar')} onPress={p.onGuardar} cargando={p.guardando} disabled={!p.origen || !p.destino} />
          <Button title={t('comun:cancelar')} variant="ghost" onPress={p.onCerrar} />
        </>
      }
    >
      <View style={styles.pila}>
        <Text style={styles.sub} maxFontSizeMultiplier={1.35}>
          {t('economia:work.hojas.trf.sub')}
        </Text>
        <SelectorCuenta cuentas={p.cuentas} elegida={p.origen} onElegir={p.onOrigen} rotulo={t('economia:work.hojas.trf.desde')} />
        <SelectorCuenta cuentas={p.cuentas} elegida={p.destino} excluir={p.origen} onElegir={p.onDestino} rotulo={t('economia:work.hojas.trf.a')} />
        <Campo
          style={[styles.campo, { borderColor: a.tinte(0.55) }]}
          etiqueta={t('economia:work.hojas.mov.importe')}
          value={p.importe}
          onChangeText={p.onImporte}
          placeholder="0,00"
          keyboardType="decimal-pad"
          grande="rank"
          error={p.errorImporte}
        />
        <Campo
          style={[styles.campo, { borderColor: a.tinte(0.55) }]}
          etiqueta={t('economia:work.hojas.mov.concepto')}
          value={p.concepto}
          onChangeText={p.onConcepto}
          placeholder={t('economia:work.hojas.trf.conceptoPlaceholder')}
        />
        {p.error ? <ErrorSistema compacto mensaje={p.error} /> : null}
      </View>
    </Sheet>
  );
}

// ── Cuenta con saldo inicial ────────────────────────────────────────

export const TIPOS_CUENTA = ['efectivo', 'banco', 'revolut', 'otro'] as const;

export interface HojaCuentaProps {
  visible: boolean;
  /** Editando una cuenta existente (solo nombre y saldo inicial). */
  editando: boolean;
  nombre: string;
  tipo: TipoCuenta;
  saldo: string;
  guardando: boolean;
  errorNombre: string | null;
  errorSaldo: string | null;
  error: string | null;
  onNombre: (v: string) => void;
  onTipo: (t: TipoCuenta) => void;
  onSaldo: (v: string) => void;
  onGuardar: () => void;
  onArchivar?: () => void;
  onCerrar: () => void;
}

export function HojaCuenta(p: HojaCuentaProps) {
  const a = useAcento();
  return (
    <Sheet
      visible={p.visible}
      onClose={p.onCerrar}
      eyebrow={t('economia:work.hojas.cuentaHoja.eyebrow')}
      title={t(p.editando ? 'economia:work.hojas.cuentaHoja.tituloEditar' : 'economia:work.hojas.cuentaHoja.titulo')}
      footer={
        <>
          <BotonWork titulo={t(p.editando ? 'comun:guardar' : 'economia:work.hojas.cuentaHoja.crear')} onPress={p.onGuardar} cargando={p.guardando} />
          {p.editando && p.onArchivar ? (
            <Button title={t('economia:work.hojas.cuentaHoja.archivar')} variant="ghost" onPress={p.onArchivar} />
          ) : (
            <Button title={t('comun:cancelar')} variant="ghost" onPress={p.onCerrar} />
          )}
        </>
      }
    >
      <View style={styles.pila}>
        <Campo
          style={[styles.campo, { borderColor: a.tinte(0.55) }]}
          etiqueta={t('economia:work.hojas.cuentaHoja.nombre')}
          value={p.nombre}
          onChangeText={p.onNombre}
          placeholder={t('economia:work.hojas.cuentaHoja.nombrePlaceholder')}
          error={p.errorNombre}
          maxLength={40}
        />
        {p.editando ? null : (
          <View style={styles.grupo}>
            <RotuloGrupo>{t('economia:work.hojas.cuentaHoja.tipo')}</RotuloGrupo>
            <FilaChips>
              {TIPOS_CUENTA.map((tc) => (
                <ChipWork key={tc} etiqueta={t(`economia:work.tipoCuenta.${tc}`)} icono={iconoCuenta(tc)} elegido={p.tipo === tc} onPress={() => p.onTipo(tc)} />
              ))}
            </FilaChips>
          </View>
        )}
        <Campo
          style={[styles.campo, { borderColor: a.tinte(0.55) }]}
          etiqueta={t('economia:work.hojas.cuentaHoja.saldo')}
          value={p.saldo}
          onChangeText={p.onSaldo}
          placeholder="0,00"
          keyboardType="numbers-and-punctuation"
          ayuda={t('economia:work.hojas.cuentaHoja.saldoAyuda')}
          error={p.errorSaldo}
        />
        {p.error ? <ErrorSistema compacto mensaje={p.error} /> : null}
      </View>
    </Sheet>
  );
}

// ── Ingreso mensual o gasto fijo ────────────────────────────────────

export interface HojaFijoProps {
  tipo: 'ingreso' | 'gasto' | null;
  nombre: string;
  importe: string;
  dia: string;
  cuentas: CuentaElegible[];
  cuenta: string | null;
  grupo: GrupoId;
  esteMes: boolean;
  guardando: boolean;
  errorNombre: string | null;
  errorImporte: string | null;
  errorDia: string | null;
  error: string | null;
  onNombre: (v: string) => void;
  onImporte: (v: string) => void;
  onDia: (v: string) => void;
  onCuenta: (id: string) => void;
  onGrupo: (g: GrupoId) => void;
  onEsteMes: (v: boolean) => void;
  onGuardar: () => void;
  onCerrar: () => void;
}

export function HojaFijo(p: HojaFijoProps) {
  const a = useAcento();
  const ingreso = p.tipo === 'ingreso';
  return (
    <Sheet
      visible={p.tipo !== null}
      onClose={p.onCerrar}
      eyebrow={t('economia:work.hojas.fijo.eyebrow')}
      title={t(ingreso ? 'economia:work.hojas.fijo.tituloIngreso' : 'economia:work.hojas.fijo.tituloGasto')}
      footer={
        <>
          <BotonWork titulo={t('comun:guardar')} onPress={p.onGuardar} cargando={p.guardando} />
          <Button title={t('comun:cancelar')} variant="ghost" onPress={p.onCerrar} />
        </>
      }
    >
      <View style={styles.pila}>
        <Text style={styles.sub} maxFontSizeMultiplier={1.35}>
          {t(ingreso ? 'economia:work.hojas.fijo.subIngreso' : 'economia:work.hojas.fijo.subGasto')}
        </Text>
        <Campo
          style={[styles.campo, { borderColor: a.tinte(0.55) }]}
          etiqueta={t('economia:work.hojas.fijo.nombre')}
          value={p.nombre}
          onChangeText={p.onNombre}
          placeholder={t(ingreso ? 'economia:work.hojas.fijo.nombreIngreso' : 'economia:work.hojas.fijo.nombreGasto')}
          error={p.errorNombre}
          maxLength={60}
        />
        <View style={styles.dosCampos}>
          <View style={styles.flex}>
            <Campo
              style={[styles.campo, { borderColor: a.tinte(0.55) }]}
              etiqueta={t('economia:work.hojas.mov.importe')}
              value={p.importe}
              onChangeText={p.onImporte}
              placeholder="0,00"
              keyboardType="decimal-pad"
              error={p.errorImporte}
            />
          </View>
          <View style={styles.campoDia}>
            <Campo
              style={[styles.campo, { borderColor: a.tinte(0.55) }]}
              etiqueta={t('economia:work.hojas.fijo.dia')}
              value={p.dia}
              onChangeText={p.onDia}
              placeholder="1"
              keyboardType="number-pad"
              maxLength={2}
              error={p.errorDia}
            />
          </View>
        </View>
        {p.cuentas.length > 1 ? (
          <SelectorCuenta cuentas={p.cuentas} elegida={p.cuenta} onElegir={p.onCuenta} rotulo={t('economia:work.hojas.cuenta')} />
        ) : null}
        {ingreso ? null : (
          <View style={styles.grupo}>
            <RotuloGrupo>{t('economia:work.hojas.categoria')}</RotuloGrupo>
            <FilaChips>
              {GRUPOS.map((g) => (
                <ChipWork key={g} etiqueta={nombreGrupo(g)} icono={ICONO_GRUPO[g]} elegido={p.grupo === g} onPress={() => p.onGrupo(g)} />
              ))}
            </FilaChips>
          </View>
        )}
        <FilaChips>
          <ChipWork
            etiqueta={t('economia:work.hojas.fijo.esteMes')}
            icono={p.esteMes ? 'checkbox' : 'square-outline'}
            elegido={p.esteMes}
            onPress={() => p.onEsteMes(!p.esteMes)}
          />
        </FilaChips>
        {p.error ? <ErrorSistema compacto mensaje={p.error} /> : null}
      </View>
    </Sheet>
  );
}

// ── Categorías ──────────────────────────────────────────────────────

export interface HojaCategoriasProps {
  visible: boolean;
  propias: CategoriaPropia[];
  nombre: string;
  tipo: 'gasto' | 'ingreso';
  grupo: GrupoId;
  guardando: boolean;
  errorNombre: string | null;
  error: string | null;
  onNombre: (v: string) => void;
  onTipo: (t: 'gasto' | 'ingreso') => void;
  onGrupo: (g: GrupoId) => void;
  onCrear: () => void;
  onCerrar: () => void;
}

export function HojaCategorias(p: HojaCategoriasProps) {
  const a = useAcento();
  return (
    <Sheet
      visible={p.visible}
      onClose={p.onCerrar}
      eyebrow={t('economia:work.hojas.cat.eyebrow')}
      title={t('economia:work.hojas.cat.titulo')}
      footer={
        <>
          <BotonWork titulo={t('economia:work.hojas.cat.crear')} onPress={p.onCrear} cargando={p.guardando} />
          <Button title={t('comun:cerrar')} variant="ghost" onPress={p.onCerrar} />
        </>
      }
    >
      <View style={styles.pila}>
        <View style={styles.grupo}>
          <RotuloGrupo>{t('economia:work.hojas.cat.deSerie')}</RotuloGrupo>
          <FilaChips>
            {GRUPOS.map((g) => (
              <ChipWork key={g} etiqueta={nombreGrupo(g)} icono={ICONO_GRUPO[g]} onPress={() => p.onGrupo(g)} elegido={p.grupo === g} />
            ))}
          </FilaChips>
        </View>
        {p.propias.length ? (
          <View style={styles.grupo}>
            <RotuloGrupo>{t('economia:work.hojas.cat.tuyas')}</RotuloGrupo>
            <FilaChips>
              {p.propias.map((c) => (
                <ChipWork key={c.id} etiqueta={c.name} icono={c.kind === 'ingreso' ? 'arrow-down' : 'bookmark-outline'} onPress={() => {}} />
              ))}
            </FilaChips>
          </View>
        ) : null}
        <View style={styles.separador} />
        <Campo
          style={[styles.campo, { borderColor: a.tinte(0.55) }]}
          etiqueta={t('economia:work.hojas.cat.nueva')}
          value={p.nombre}
          onChangeText={p.onNombre}
          placeholder={t('economia:work.hojas.cat.nuevaPlaceholder')}
          error={p.errorNombre}
          maxLength={32}
        />
        <FilaChips>
          <ChipWork etiqueta={t('economia:work.hojas.mov.gasto')} elegido={p.tipo === 'gasto'} onPress={() => p.onTipo('gasto')} />
          <ChipWork etiqueta={t('economia:work.hojas.mov.ingreso')} elegido={p.tipo === 'ingreso'} onPress={() => p.onTipo('ingreso')} />
        </FilaChips>
        {p.tipo === 'gasto' ? (
          <Text style={styles.sub} maxFontSizeMultiplier={1.35}>
            {t('economia:work.hojas.cat.cuentaComo', { grupo: nombreGrupo(p.grupo) })}
          </Text>
        ) : null}
        {p.error ? <ErrorSistema compacto mensaje={p.error} /> : null}
      </View>
    </Sheet>
  );
}

// ── Importar extracto ───────────────────────────────────────────────

export interface HojaImportarProps {
  visible: boolean;
  cuentas: CuentaElegible[];
  cuenta: string | null;
  puedeElegir: boolean;
  leyendo: boolean;
  error: string | null;
  onCuenta: (id: string) => void;
  onElegir: () => void;
  onCerrar: () => void;
}

export function HojaImportar(p: HojaImportarProps) {
  const a = useAcento();
  return (
    <Sheet
      visible={p.visible}
      onClose={p.onCerrar}
      eyebrow={t('economia:work.hojas.imp.eyebrow')}
      title={t('economia:work.hojas.imp.titulo')}
      footer={
        <>
          <BotonWork titulo={t('economia:work.hojas.imp.elegir')} icono="document-text-outline" onPress={p.onElegir} cargando={p.leyendo} disabled={!p.cuenta || !p.puedeElegir} />
          <Button title={t('comun:cancelar')} variant="ghost" onPress={p.onCerrar} />
        </>
      }
    >
      <View style={styles.pila}>
        <SelectorCuenta cuentas={p.cuentas} elegida={p.cuenta} onElegir={p.onCuenta} rotulo={t('economia:work.hojas.imp.deQue')} />
        {(['economia:work.hojas.imp.paso1', 'economia:work.hojas.imp.paso2', 'economia:work.hojas.imp.paso3'] as const).map((clave, n) => (
          <View key={n} style={styles.paso}>
            <Text style={[styles.pasoNum, { color: a.acento }]}>{n + 1}</Text>
            <Text style={styles.sub} maxFontSizeMultiplier={1.35}>
              {t(clave)}
            </Text>
          </View>
        ))}
        <View style={styles.seguro}>
          <Ionicons name="lock-closed-outline" size={14} color={a.acento} />
          <Text style={styles.sub} maxFontSizeMultiplier={1.35}>
            {t('economia:work.hojas.imp.privacidad')}
          </Text>
        </View>
        {p.puedeElegir ? null : (
          <Text style={styles.sub} maxFontSizeMultiplier={1.35}>
            {t('economia:work.hojas.imp.sinSelector')}
          </Text>
        )}
        {p.error ? <ErrorSistema compacto mensaje={p.error} /> : null}
      </View>
    </Sheet>
  );
}

// ── Cambiar la categoría de una fila de la revisión ─────────────────

export interface HojaElegirCategoriaProps {
  /** Ingreso o gasto de la fila; null con la hoja cerrada. */
  tipo: 'gasto' | 'ingreso' | null;
  concepto: string;
  propias: CategoriaPropia[];
  onElegir: (c: CategoriaElegida) => void;
  onCerrar: () => void;
}

export function HojaElegirCategoria(p: HojaElegirCategoriaProps) {
  const tipo = p.tipo ?? 'gasto';
  return (
    <Sheet
      visible={p.tipo !== null}
      onClose={p.onCerrar}
      eyebrow={t('economia:work.hojas.elegir.eyebrow')}
      title={p.concepto}
      footer={<Button title={t('comun:cancelar')} variant="ghost" onPress={p.onCerrar} />}
    >
      <FilaChips>
        {tipo === 'gasto'
          ? GRUPOS.map((g) => <ChipWork key={g} etiqueta={nombreGrupo(g)} icono={ICONO_GRUPO[g]} onPress={() => p.onElegir({ grupo: g })} />)
          : INGRESOS.map((i) => (
              <ChipWork key={i.base} etiqueta={t(`economia:work.ingreso.${i.clave}`)} icono="arrow-down" onPress={() => p.onElegir({ ingreso: i.base })} />
            ))}
        {p.propias
          .filter((c) => c.kind === tipo)
          .map((c) => (
            <ChipWork key={c.id} etiqueta={c.name} icono="bookmark-outline" onPress={() => p.onElegir({ propia: c.id })} />
          ))}
      </FilaChips>
    </Sheet>
  );
}

/** La base de una categoría de gasto de serie. */
export function baseDe(c: CategoriaElegida, propias: readonly CategoriaPropia[]): { categoria: string; propia: string | null } {
  if ('grupo' in c) return { categoria: BASE_DE_GRUPO[c.grupo], propia: null };
  if ('ingreso' in c) return { categoria: c.ingreso, propia: null };
  const p = propias.find((x) => x.id === c.propia);
  return { categoria: p?.base_category ?? 'otros', propia: c.propia };
}

const styles = StyleSheet.create({
  pila: { gap: space.s5 },
  campo: { borderRadius: 10 },
  grupo: { gap: space.s2 },
  sub: { flex: 1, fontFamily: tipo.bodySm.family, fontSize: tipo.bodySm.size, lineHeight: tipo.bodySm.lineHeight, color: ink.ink8 },
  dosCampos: { flexDirection: 'row', gap: space.s3 },
  flex: { flex: 1 },
  campoDia: { width: 96 },
  separador: { height: 1, backgroundColor: ink.ink3 },
  paso: { flexDirection: 'row', gap: space.s3, alignItems: 'flex-start' },
  pasoNum: { width: 18, fontFamily: tipo.label.family, fontSize: 14, lineHeight: 20 },
  seguro: { flexDirection: 'row', gap: space.s2, alignItems: 'flex-start' },
});
