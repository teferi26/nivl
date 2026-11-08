// NIVL · FOCUS: las hojas de la pestaña Temario (puras: reciben datos y
// devuelven lo elegido; guardar lo hace useHojasFocus).
//
//   HojaTema · HojaTarjetasLote · HojaTarjetasIa · HojaCopiarDia · HojaHoras

import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Campo } from '@/components/arena';
import { Sheet, Skeleton } from '@/components/ui';
import { space } from '@/design/tokens';
import type { Estadisticas } from '@/focus/estadisticas';
import { copiarDia } from '@/focus/horarioRapido';
import { MAX_TEMA, MAX_SECCION, MAX_TEXTO_LOTE, tarjetasDesdeTexto, type TarjetaImportada } from '@/focus/importar';
import type { Clase, Mazo, Tema } from '@/focus/tipos';
import { t } from '@/i18n';
import { F } from './estilo';
import { Elegir, nombreDia, Pie } from './HojasFocus';
import { BarraFocus, BotonFocus, ChipFocus, Etiqueta, FilaFocus, Rotulo, textoFocus } from './Piezas';
import { textoHoras } from './textos';
import type { FaseIa } from './useTarjetasIa';

// ── Editar un tema ───────────────────────────────────────────────────

export function HojaTema({
  visible,
  tema,
  onClose,
  onGuardar,
  onBorrar,
}: {
  visible: boolean;
  tema: Pick<Tema, 'id' | 'nombre' | 'seccion'> | null;
  onClose: () => void;
  onGuardar: (nombre: string, seccion: string | null) => void;
  onBorrar: () => void;
}) {
  const [nombre, setNombre] = useState('');
  const [seccion, setSeccion] = useState('');
  const id = tema?.id;
  useEffect(() => {
    if (!visible) return;
    setNombre(tema?.nombre ?? '');
    setSeccion(tema?.seccion ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- se rellena al abrir, no en cada relectura
  }, [visible, id]);
  const ok = nombre.trim().length > 0;
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      eyebrow={t('focus:fondo.temas.editarEyebrow')}
      title={t('focus:fondo.temas.editarTitulo')}
      footer={<Pie titulo={t('focus:hojas.guardar')} disabled={!ok} onPress={() => onGuardar(nombre, seccion.trim() || null)} />}
    >
      <Campo etiqueta={t('focus:fondo.temas.nombre')} value={nombre} onChangeText={setNombre} maxLength={MAX_TEMA} />
      <Campo etiqueta={t('focus:fondo.temas.seccion')} ayuda={t('focus:fondo.temas.seccionAyuda')} value={seccion} onChangeText={setSeccion} maxLength={MAX_SECCION} estiloBloque={styles.campo} />
      <BotonFocus titulo={t('focus:hojas.borrarTema')} variante="texto" pequeno onPress={onBorrar} style={styles.seccion} />
    </Sheet>
  );
}

// ── Tarjetas pegadas ─────────────────────────────────────────────────

export function HojaTarjetasLote({
  visible,
  mazos,
  inicial,
  onClose,
  onGuardar,
}: {
  visible: boolean;
  mazos: Mazo[];
  inicial: string | null;
  onClose: () => void;
  onGuardar: (mazoId: string, tarjetas: TarjetaImportada[]) => void;
}) {
  const [mazo, setMazo] = useState<string | null>(null);
  const [texto, setTexto] = useState('');
  useEffect(() => {
    if (!visible) return;
    setMazo(inicial ?? mazos[0]?.id ?? null);
    setTexto('');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- se rellena al abrir, no en cada relectura
  }, [visible, inicial]);
  const { tarjetas, descartadas } = tarjetasDesdeTexto(texto);
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      eyebrow={t('focus:hojas.eyebrow')}
      title={t('focus:fondo.tarjetas.loteTitulo')}
      footer={<Pie titulo={t('focus:fondo.tarjetas.anadirN', { count: tarjetas.length })} disabled={!mazo || tarjetas.length === 0} onPress={() => mazo && onGuardar(mazo, tarjetas)} />}
    >
      <Elegir etiqueta={t('focus:hojas.mazo')} opciones={mazos.map((m) => ({ valor: m.id, titulo: m.nombre }))} valor={mazo} onCambiar={setMazo} />
      <Campo
        etiqueta={t('focus:fondo.tarjetas.loteCampo')}
        ayuda={t('focus:fondo.tarjetas.loteAyuda')}
        value={texto}
        onChangeText={setTexto}
        multiline
        maxLength={MAX_TEXTO_LOTE}
        style={styles.multilinea}
        placeholder={t('focus:fondo.tarjetas.loteEjemplo')}
        autoCapitalize="none"
        estiloBloque={styles.campo}
      />
      {descartadas > 0 ? (
        <Text style={[textoFocus.cuerpo, styles.arriba]} maxFontSizeMultiplier={1.5}>
          {t('focus:fondo.tarjetas.descartadas', { count: descartadas })}
        </Text>
      ) : null}
    </Sheet>
  );
}

// ── Tarjetas con IA ──────────────────────────────────────────────────

export function HojaTarjetasIa({
  visible,
  mazos,
  inicial,
  fase,
  tarjetas,
  aviso,
  onClose,
  onGenerar,
  onQuitar,
  onOtraVez,
  onGuardar,
  onLoteAMano,
}: {
  visible: boolean;
  mazos: Mazo[];
  inicial: string | null;
  fase: FaseIa;
  tarjetas: TarjetaImportada[];
  aviso: string | null;
  onClose: () => void;
  onGenerar: (texto: string) => void;
  onQuitar: (i: number) => void;
  onOtraVez: () => void;
  onGuardar: (mazoId: string, tarjetas: TarjetaImportada[]) => void;
  onLoteAMano: () => void;
}) {
  const [mazo, setMazo] = useState<string | null>(null);
  const [texto, setTexto] = useState('');
  useEffect(() => {
    if (!visible) return;
    setMazo(inicial ?? mazos[0]?.id ?? null);
    setTexto('');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- se rellena al abrir, no en cada relectura
  }, [visible, inicial]);

  const pie =
    fase === 'sinPro' ? (
      <Pie titulo={t('focus:fondo.tarjetas.iaAMano')} onPress={onLoteAMano} />
    ) : fase === 'revisar' ? (
      <Pie titulo={t('focus:fondo.tarjetas.anadirN', { count: tarjetas.length })} disabled={!mazo || tarjetas.length === 0} onPress={() => mazo && onGuardar(mazo, tarjetas)} />
    ) : fase === 'generando' ? (
      <Pie titulo={t('focus:fondo.tarjetas.iaGenerando')} disabled onPress={() => undefined} />
    ) : (
      <Pie titulo={t('focus:fondo.tarjetas.iaGenerar')} disabled={fase === 'comprobando' || !mazo || texto.trim().length === 0} onPress={() => onGenerar(texto)} />
    );

  return (
    <Sheet visible={visible} onClose={onClose} eyebrow={t('focus:hojas.eyebrow')} title={t('focus:fondo.tarjetas.iaTitulo')} footer={pie}>
      {fase === 'comprobando' ? (
        <Skeleton height={140} />
      ) : fase === 'sinPro' ? (
        <Text style={textoFocus.cuerpo} maxFontSizeMultiplier={1.5}>
          {t('focus:fondo.tarjetas.iaSinPro')}
        </Text>
      ) : fase === 'revisar' ? (
        <>
          <Elegir etiqueta={t('focus:hojas.mazo')} opciones={mazos.map((m) => ({ valor: m.id, titulo: m.nombre }))} valor={mazo} onCambiar={setMazo} />
          <Rotulo texto={t('focus:fondo.tarjetas.iaRevisar')} derecha={t('focus:fondo.tarjetas.iaOtraVez')} onDerecha={onOtraVez} style={styles.seccion} />
          {tarjetas.map((c, i) => (
            <FilaFocus key={`${i}-${c.anverso}`} primera={i === 0} style={styles.filaAlta}>
              <View style={styles.flex}>
                <Text style={textoFocus.fila} maxFontSizeMultiplier={1.5}>
                  {c.anverso}
                </Text>
                <Text style={textoFocus.detalle} maxFontSizeMultiplier={1.5}>
                  {c.reverso}
                </Text>
              </View>
              <Pressable onPress={() => onQuitar(i)} hitSlop={14} accessibilityRole="button" accessibilityLabel={t('focus:fondo.tarjetas.iaQuitar', { pregunta: c.anverso })}>
                <Ionicons name="close" size={18} color={F.rotulo} />
              </Pressable>
            </FilaFocus>
          ))}
        </>
      ) : (
        <>
          <Elegir etiqueta={t('focus:hojas.mazo')} opciones={mazos.map((m) => ({ valor: m.id, titulo: m.nombre }))} valor={mazo} onCambiar={setMazo} />
          <Campo
            etiqueta={t('focus:fondo.tarjetas.iaCampo')}
            ayuda={t('focus:fondo.tarjetas.iaAyuda')}
            value={texto}
            onChangeText={setTexto}
            multiline
            editable={fase === 'escribir'}
            maxLength={MAX_TEXTO_LOTE}
            style={styles.multilinea}
            estiloBloque={styles.campo}
          />
          {aviso ? (
            <Text style={[textoFocus.cuerpo, styles.arriba]} maxFontSizeMultiplier={1.5}>
              {aviso}
            </Text>
          ) : null}
          {aviso ? <BotonFocus titulo={t('focus:fondo.tarjetas.iaAMano')} variante="texto" pequeno onPress={onLoteAMano} style={styles.arriba} /> : null}
        </>
      )}
    </Sheet>
  );
}

// ── Copiar un día del horario ────────────────────────────────────────

const DIAS = [1, 2, 3, 4, 5, 6, 7] as const;
const LABORABLES = [1, 2, 3, 4, 5];

export function HojaCopiarDia({
  visible,
  origen,
  clases,
  onClose,
  onGuardar,
}: {
  visible: boolean;
  origen: number;
  clases: Clase[];
  onClose: () => void;
  onGuardar: (destinos: number[]) => void;
}) {
  const [destinos, setDestinos] = useState<number[]>([]);
  useEffect(() => {
    if (visible) setDestinos([]);
  }, [visible]);
  const alternar = (d: number) => setDestinos((xs) => (xs.includes(d) ? xs.filter((x) => x !== d) : [...xs, d]));
  const { nuevas, saltadas } = copiarDia(clases, origen, destinos);
  const laborables = LABORABLES.filter((d) => d !== origen);
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      eyebrow={t('focus:hojas.eyebrow')}
      title={t('focus:fondo.horario.copiarTitulo', { dia: nombreDia(origen) })}
      footer={<Pie titulo={t('focus:fondo.horario.copiarN', { count: nuevas.length })} disabled={nuevas.length === 0} onPress={() => onGuardar(destinos)} />}
    >
      <Text style={textoFocus.cuerpo} maxFontSizeMultiplier={1.5}>
        {t('focus:fondo.horario.copiarCuerpo')}
      </Text>
      <View style={styles.chips}>
        {DIAS.filter((d) => d !== origen).map((d) => (
          <ChipFocus key={d} titulo={nombreDia(d, true)} activo={destinos.includes(d)} onPress={() => alternar(d)} accessibilityLabel={nombreDia(d)} />
        ))}
      </View>
      <BotonFocus titulo={t('focus:fondo.horario.deLunesAViernes')} variante="texto" pequeno onPress={() => setDestinos(laborables)} style={styles.arriba} />
      {saltadas > 0 ? (
        <Text style={[textoFocus.cuerpo, styles.arriba]} maxFontSizeMultiplier={1.5}>
          {t('focus:fondo.horario.saltadas', { count: saltadas })}
        </Text>
      ) : null}
    </Sheet>
  );
}

// ── Horas: las estadísticas ──────────────────────────────────────────

/** A partir de aquí se avisa de que una asignatura va por detrás de lo que pesa. */
const DESFASE_AVISO = -10;
const TEMAS_VISIBLES = 10;

export function HojaHoras({ visible, datos, onClose }: { visible: boolean; datos: Estadisticas | null; onClose: () => void }) {
  if (!datos) return <Sheet visible={false} onClose={onClose}>{null}</Sheet>;
  const conHoras = datos.porAsignatura.filter((a) => a.mes > 0 || a.semana > 0 || (a.pctPeso ?? 0) > 0);
  return (
    <Sheet visible={visible} onClose={onClose} eyebrow={t('focus:hojas.eyebrow')} title={t('focus:fondo.horas.titulo')}>
      <FilaFocus primera>
        <Text style={[textoFocus.fila, styles.flex]}>{t('focus:fondo.horas.semana')}</Text>
        <Text style={textoFocus.filaFuerte}>{textoHoras(datos.total.semana)}</Text>
      </FilaFocus>
      <FilaFocus>
        <Text style={[textoFocus.fila, styles.flex]}>{t('focus:fondo.horas.mes')}</Text>
        <Text style={textoFocus.filaFuerte}>{textoHoras(datos.total.mes)}</Text>
      </FilaFocus>
      <FilaFocus>
        <Text style={[textoFocus.fila, styles.flex]}>{t('focus:fondo.horas.seguidos')}</Text>
        <Text style={textoFocus.filaFuerte}>{datos.diasSeguidos}</Text>
      </FilaFocus>

      <Rotulo texto={t('focus:fondo.horas.porAsignatura')} style={styles.seccion} />
      {conHoras.length === 0 ? (
        <Text style={[textoFocus.cuerpo, styles.arriba]} maxFontSizeMultiplier={1.5}>
          {t('focus:temario.horasVacio')}
        </Text>
      ) : (
        conHoras.map((a) => (
          <View key={a.asignaturaId} style={styles.asignatura}>
            <View style={styles.filaTexto}>
              <Text style={[textoFocus.filaFuerte, styles.flex]} numberOfLines={1} maxFontSizeMultiplier={1.35}>
                {a.nombre}
              </Text>
              {a.desfase !== null && a.desfase <= DESFASE_AVISO ? <Etiqueta texto={t('focus:fondo.horas.porDetras')} /> : null}
            </View>
            <Text style={textoFocus.detalle} maxFontSizeMultiplier={1.5}>
              {t('focus:fondo.horas.semanaMes', { semana: textoHoras(a.semana), mes: textoHoras(a.mes) })}
            </Text>
            <BarraFocus ratio={a.pctHoras / 100} />
            <Text style={textoFocus.detalle} maxFontSizeMultiplier={1.5}>
              {a.pctPeso === null || a.pctPeso === 0 ? t('focus:fondo.horas.sinPeso', { horas: a.pctHoras }) : t('focus:fondo.horas.frentePeso', { horas: a.pctHoras, peso: a.pctPeso })}
            </Text>
          </View>
        ))
      )}
      {datos.libres.mes > 0 ? (
        <Text style={[textoFocus.detalle, styles.arriba]} maxFontSizeMultiplier={1.5}>
          {t('focus:fondo.horas.libres', { horas: textoHoras(datos.libres.mes) })}
        </Text>
      ) : null}

      {datos.porTema.length > 0 ? (
        <>
          <Rotulo texto={t('focus:fondo.horas.porTema')} style={styles.seccion} />
          {datos.porTema.slice(0, TEMAS_VISIBLES).map((x, i) => (
            <FilaFocus key={x.temaId} primera={i === 0}>
              <Text style={[textoFocus.fila, styles.flex]} numberOfLines={2} maxFontSizeMultiplier={1.35}>
                {x.nombre}
              </Text>
              <Text style={textoFocus.detalle} maxFontSizeMultiplier={1.35}>
                {textoHoras(x.minutos)}
              </Text>
            </FilaFocus>
          ))}
        </>
      ) : null}

      {datos.salidas.semana > 0 ? (
        <Text style={[textoFocus.detalle, styles.seccion]} maxFontSizeMultiplier={1.5}>
          {t('focus:fondo.horas.salidas', { count: datos.salidas.semana })}
        </Text>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  campo: { marginTop: space.s4 },
  multilinea: { minHeight: 140, maxHeight: 320, textAlignVertical: 'top' },
  arriba: { marginTop: space.s2 },
  seccion: { marginTop: space.s5 },
  filaAlta: { alignItems: 'flex-start', paddingVertical: space.s3 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s2, marginTop: space.s3 },
  asignatura: { gap: 6, marginTop: space.s3 },
  filaTexto: { flexDirection: 'row', alignItems: 'center', gap: space.s2 },
});
