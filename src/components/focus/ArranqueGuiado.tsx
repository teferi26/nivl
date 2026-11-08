// NIVL · FOCUS: los primeros 30 segundos. Sin datos no hay reloj grande: tres
// toques (quién eres, tus asignaturas, tu próximo examen) y el primer bloque ya
// tiene nombre. Guardar lo hace useFocusHoy.

import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Campo } from '@/components/arena';
import { space } from '@/design/tokens';
import { PLANTILLAS } from '@/focus/arranque';
import { asignaturaDelExamen, examenDeArranque, nombresDeAsignaturas, type ExamenDeArranque } from '@/focus/arranqueFlujo';
import { fechaCorta, leerFechaEs } from '@/focus/fechas';
import { PERFILES_FOCUS, type PerfilFocus } from '@/focus/tipos';
import { t } from '@/i18n';
import { BotonFocus, ChipFocus, FilaFocus, Rotulo, TarjetaFocus, textoFocus } from './Piezas';
import { tf } from './textos';

export interface ArranqueGuiadoProps {
  hoy: string;
  asignaturas: { id: string; nombre: string }[];
  onAsignaturas: (nombres: string[]) => Promise<boolean>;
  onTerminar: (perfil: PerfilFocus, examen: ExamenDeArranque | null, titulo: string) => Promise<void>;
}

type Paso = 1 | 2 | 3;

export function ArranqueGuiado({ hoy, asignaturas, onAsignaturas, onTerminar }: ArranqueGuiadoProps) {
  const [paso, setPaso] = useState<Paso>(1);
  const [perfil, setPerfil] = useState<PerfilFocus | null>(null);
  const [elegidas, setElegidas] = useState<string[]>([]);
  const [pegadas, setPegadas] = useState('');
  const [asignatura, setAsignatura] = useState<string | null>(null);
  const [fecha, setFecha] = useState('');
  const [temas, setTemas] = useState('');
  const [ocupado, setOcupado] = useState(false);

  const plantilla = useMemo(() => (perfil ? PLANTILLAS[perfil].asignaturas.map((k) => tf(`focus:plantillas.${k}`)) : []), [perfil]);
  const nombres = nombresDeAsignaturas(elegidas, pegadas);

  const elegirPerfil = (p: PerfilFocus) => {
    setPerfil(p);
    setElegidas(PLANTILLAS[p].asignaturas.map((k) => tf(`focus:plantillas.${k}`)));
    setPaso(2);
  };

  const alternar = (nombre: string) => setElegidas((xs) => (xs.includes(nombre) ? xs.filter((x) => x !== nombre) : [...xs, nombre]));

  const guardarAsignaturas = async () => {
    if (ocupado || nombres.length === 0) return;
    setOcupado(true);
    const ok = await onAsignaturas(nombres);
    setOcupado(false);
    if (ok) setPaso(3);
  };

  const idExamen = asignaturaDelExamen(asignaturas, asignatura);
  const leida = fecha.trim() ? leerFechaEs(fecha, hoy) : null;
  const errorFecha = fecha.trim().length > 0 && (leida === null || leida < hoy);

  const terminar = async (sinFecha: boolean) => {
    if (ocupado || !perfil) return;
    const examen = examenDeArranque(idExamen, sinFecha ? '' : fecha, temas, hoy);
    if (examen === 'fecha_mala') return;
    const nombre = asignaturas.find((a) => a.id === idExamen)?.nombre ?? '';
    setOcupado(true);
    await onTerminar(perfil, examen, perfil === 'oposicion' ? t('focus:hoyArranque.examenOposicion') : t('focus:hoyArranque.examenDe', { asignatura: nombre }));
    setOcupado(false);
  };

  return (
    <TarjetaFocus heroe>
      <Rotulo texto={t('focus:hoyArranque.rotulo')} derecha={t('focus:hoyArranque.paso', { n: paso, de: 3 })} />

      {paso === 1 ? (
        <>
          <Text style={[textoFocus.titulo, styles.arriba]} maxFontSizeMultiplier={1.35} accessibilityRole="header">
            {t('focus:hoyArranque.perfilTitulo')}
          </Text>
          <Text style={[textoFocus.cuerpo, styles.arribaPoco]} maxFontSizeMultiplier={1.5}>
            {t('focus:hoyArranque.perfilCuerpo')}
          </Text>
          <View style={styles.arriba}>
            {PERFILES_FOCUS.map((p, i) => (
              <FilaFocus key={p} primera={i === 0} onPress={() => elegirPerfil(p)} style={styles.fila} accessibilityLabel={tf(`focus:hoyArranque.perfil.${p}.titulo`)}>
                <View style={styles.flex}>
                  <Text style={textoFocus.filaFuerte} maxFontSizeMultiplier={1.35}>
                    {tf(`focus:hoyArranque.perfil.${p}.titulo`)}
                  </Text>
                  <Text style={textoFocus.detalle} maxFontSizeMultiplier={1.5}>
                    {tf(`focus:hoyArranque.perfil.${p}.cuerpo`)}
                  </Text>
                </View>
              </FilaFocus>
            ))}
          </View>
        </>
      ) : null}

      {paso === 2 && perfil ? (
        <>
          <Text style={[textoFocus.titulo, styles.arriba]} maxFontSizeMultiplier={1.35} accessibilityRole="header">
            {t('focus:hoyArranque.asignaturasTitulo')}
          </Text>
          {plantilla.length > 0 ? (
            <View style={styles.chips}>
              {plantilla.map((n) => (
                <ChipFocus key={n} titulo={n} activo={elegidas.includes(n)} onPress={() => alternar(n)} />
              ))}
            </View>
          ) : null}
          <Campo
            etiqueta={plantilla.length > 0 ? t('focus:hoyArranque.pegarOtras') : t('focus:hoyArranque.pegar')}
            ayuda={t('focus:hoyArranque.pegarAyuda')}
            value={pegadas}
            onChangeText={setPegadas}
            multiline
            maxLength={3000}
            style={styles.multilinea}
            placeholder={tf(`focus:hoyArranque.ejemplo.${perfil}`)}
          />
          <BotonFocus titulo={t('focus:hoyArranque.continuar', { count: nombres.length })} disabled={nombres.length === 0 || ocupado} onPress={() => void guardarAsignaturas()} style={styles.arriba} />
          <BotonFocus titulo={t('focus:hoyArranque.atras')} variante="texto" pequeno onPress={() => setPaso(1)} />
        </>
      ) : null}

      {paso === 3 ? (
        <>
          <Text style={[textoFocus.titulo, styles.arriba]} maxFontSizeMultiplier={1.35} accessibilityRole="header">
            {t('focus:hoyArranque.examenTitulo')}
          </Text>
          {asignaturas.length > 1 ? (
            <View style={styles.chips}>
              {asignaturas.map((a) => (
                <ChipFocus key={a.id} titulo={a.nombre} activo={a.id === idExamen} onPress={() => setAsignatura(a.id)} />
              ))}
            </View>
          ) : null}
          <Campo
            etiqueta={t('focus:hojas.fecha')}
            ayuda={leida && !errorFecha ? t('focus:hojas.fechaLeida', { fecha: fechaCorta(leida) }) : t('focus:hojas.fechaAyuda')}
            error={errorFecha ? t('focus:hoyArranque.fechaMala') : undefined}
            value={fecha}
            onChangeText={setFecha}
            maxLength={12}
          />
          {idExamen ? (
            <Campo etiqueta={t('focus:hoyArranque.temas')} ayuda={t('focus:hoyArranque.temasAyuda')} value={temas} onChangeText={setTemas} multiline maxLength={20000} style={styles.multilinea} />
          ) : null}
          <BotonFocus titulo={t('focus:hoyArranque.listo')} disabled={!idExamen || leida === null || errorFecha || ocupado} onPress={() => void terminar(false)} style={styles.arriba} />
          <BotonFocus titulo={t('focus:hoyArranque.sinFecha')} variante="contorno" disabled={ocupado} onPress={() => void terminar(true)} style={styles.arribaPoco} />
        </>
      ) : null}
    </TarjetaFocus>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0, gap: 2 },
  fila: { paddingVertical: space.s3 },
  arriba: { marginTop: space.s3 },
  arribaPoco: { marginTop: space.s1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s2, marginTop: space.s3 },
  multilinea: { minHeight: 90, textAlignVertical: 'top' },
});
