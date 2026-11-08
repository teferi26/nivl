// NIVL · Moderación: el detalle (pura). La foto y el texto reales, y cada
// acción pide confirmación en una hoja antes de tocar nada.
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CargaArena, Campo, EncabezadoArena, ErrorSistema, TarjetaArena } from '@/components/arena';
import { Button, EmptyState, Screen, Section, Sheet, Tag } from '@/components/ui';
import { useRetrato } from '@/components/ui/useRetrato';
import { ink, space, type as tipo } from '@/design/tokens';
import {
  accionesDe,
  fechaCorta,
  nombreDe,
  notaObligatoria,
  notaValida,
  type AccionModeracion,
  type ElementoModeracion,
} from '@/lib/moderacionmath';
import { SinAcceso } from './BandejaVista';
import type { Acceso } from './useModeracion';

export interface DetalleVistaProps {
  acceso: Acceso;
  cargado: boolean;
  error: string | null;
  refrescando: boolean;
  onRefrescar: () => void;
  elemento: ElementoModeracion | null;
  hoja: AccionModeracion | null;
  enviando: boolean;
  fallo: string | null;
  onSalir: () => void;
  onAccion: (a: AccionModeracion) => void;
  onCerrarHoja: () => void;
  onConfirmar: (nota: string) => void;
}

export const TEXTO_ACCION: Record<AccionModeracion, { boton: string; titulo: string; explica: string }> = {
  resolver: { boton: 'Resolver', titulo: 'Resolver la denuncia', explica: 'La denuncia se cierra como atendida. No cambia nada en el perfil.' },
  descartar: { boton: 'Descartar', titulo: 'Descartar la denuncia', explica: 'La denuncia se cierra porque no hay infracción.' },
  suspender: {
    boton: 'Suspender perfil',
    titulo: 'Suspender el perfil',
    explica: 'Su nombre, su foto y su título dejan de verse y sale de las interacciones sociales. Se puede levantar después.',
  },
  levantar: { boton: 'Levantar suspensión', titulo: 'Levantar la suspensión', explica: 'El perfil vuelve a verse tal como está ahora.' },
  revisar: { boton: 'Marcar revisado', titulo: 'Marcar como revisado', explica: 'El perfil sale de la cola hasta que su dueño lo cambie.' },
};

function Foto({ ruta, etiqueta }: { ruta: string; etiqueta: string }) {
  const { uri, fallida, alCargar, alFallar } = useRetrato(ruta);
  return (
    <View style={styles.foto}>
      {uri && !fallida ? (
        <Image source={{ uri }} style={styles.imagen} contentFit="cover" onLoad={alCargar} onError={alFallar} accessibilityLabel={etiqueta} />
      ) : (
        <Text style={styles.sinFoto}>{fallida ? 'No se ha podido cargar la foto.' : 'Cargando la foto'}</Text>
      )}
    </View>
  );
}

function Dato({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <View style={styles.dato}>
      <Text style={styles.datoRotulo} maxFontSizeMultiplier={1.35}>
        {rotulo}
      </Text>
      <Text style={styles.datoValor} maxFontSizeMultiplier={1.6}>
        {valor}
      </Text>
    </View>
  );
}

function Contenido({ e }: { e: ElementoModeracion }) {
  if (e.clase === 'denuncia_ia') {
    return (
      <>
        <Section title="Texto denunciado">
          <TarjetaArena variante="contorno">
            <Text style={styles.cita} maxFontSizeMultiplier={1.6} selectable>
              {e.texto}
            </Text>
          </TarjetaArena>
        </Section>
        <Section title="Contexto">
          <Dato rotulo="Origen" valor={e.origen} />
          <Dato rotulo="Denuncia" valor={nombreDe(e.denunciante)} />
          <Dato rotulo="Fecha" valor={fechaCorta(e.creadaEn)} />
        </Section>
      </>
    );
  }
  if (e.clase === 'denuncia_perfil') {
    const cambiada = !!e.denunciado.foto && e.denunciado.foto !== e.mostrado.foto;
    return (
      <>
        <Section title="Lo denunciado">
          {e.mostrado.foto ? <Foto ruta={e.mostrado.foto} etiqueta="Foto denunciada" /> : null}
          <Dato rotulo="Nombre" valor={e.mostrado.nombre ?? '-'} />
          <Dato rotulo="Título" valor={e.mostrado.titulo ?? '-'} />
        </Section>
        <Section title="El perfil ahora">
          {cambiada && e.denunciado.foto ? <Foto ruta={e.denunciado.foto} etiqueta="Foto actual" /> : null}
          <Dato rotulo="Nombre" valor={nombreDe(e.denunciado)} />
          <Dato rotulo="Título" valor={e.denunciado.titulo ?? '-'} />
          {e.denunciado.estado === 'suspended' ? <Tag tone="alerta">SUSPENDIDO</Tag> : null}
        </Section>
        <Section title="Contexto">
          <Dato rotulo="Denuncia" valor={nombreDe(e.denunciante)} />
          <Dato rotulo="Fecha" valor={fechaCorta(e.creadaEn)} />
        </Section>
      </>
    );
  }
  return (
    <Section title={e.clase === 'suspendido' ? 'Perfil suspendido' : 'Perfil'}>
      {e.foto ? <Foto ruta={e.foto} etiqueta="Foto del perfil" /> : null}
      <Dato rotulo="Nombre" valor={nombreDe({ nombre: e.nombre, id: e.userId })} />
      <Dato rotulo="Título" valor={e.titulo ?? '-'} />
      {e.clase === 'suspendido' && e.nota ? <Dato rotulo="Registro" valor={e.nota} /> : null}
    </Section>
  );
}

// El título de pantalla (Cinzel 32) se corta con textos largos: el motivo y el
// nombre van en el subtítulo, que se lee entero.
function tituloDe(e: ElementoModeracion): { eyebrow: string; titulo: string; subtitulo: string } {
  if (e.clase === 'denuncia_perfil') return { eyebrow: 'Denuncia de perfil', titulo: 'Denuncia', subtitulo: e.motivoTexto };
  if (e.clase === 'denuncia_ia') return { eyebrow: 'Denuncia de la IA', titulo: 'Denuncia', subtitulo: e.motivoTexto };
  return { eyebrow: e.clase === 'suspendido' ? 'Suspendido' : 'Por revisar', titulo: 'Perfil', subtitulo: nombreDe({ nombre: e.nombre, id: e.userId }) };
}

export function HojaAccion({
  accion,
  elemento,
  enviando,
  fallo,
  onCerrar,
  onConfirmar,
}: {
  accion: AccionModeracion | null;
  elemento: ElementoModeracion | null;
  enviando: boolean;
  fallo: string | null;
  onCerrar: () => void;
  onConfirmar: (nota: string) => void;
}) {
  const [nota, setNota] = useState('');
  useEffect(() => {
    // Para suspender se propone el motivo de la denuncia: un toque menos.
    setNota(accion === 'suspender' && elemento && 'motivoTexto' in elemento ? elemento.motivoTexto : '');
  }, [accion, elemento]);
  if (!accion) return null;
  const textos = TEXTO_ACCION[accion];
  const destructiva = accion === 'suspender';
  return (
    <Sheet
      visible
      onClose={onCerrar}
      eyebrow="Confirma"
      title={textos.titulo}
      footer={
        <Button
          title={textos.boton}
          variant={destructiva ? 'danger' : 'primary'}
          loading={enviando}
          disabled={!notaValida(accion, nota)}
          onPress={() => onConfirmar(nota)}
        />
      }
    >
      <Text style={styles.explica} maxFontSizeMultiplier={1.6}>
        {textos.explica}
      </Text>
      <Campo
        etiqueta={notaObligatoria(accion) ? 'Motivo' : 'Nota (opcional)'}
        value={nota}
        onChangeText={setNota}
        maxLength={300}
        multiline
        ayuda="Queda en el registro junto a tu cuenta."
        error={fallo}
      />
    </Sheet>
  );
}

export function DetalleVista({
  acceso,
  cargado,
  error,
  refrescando,
  onRefrescar,
  elemento,
  hoja,
  enviando,
  fallo,
  onSalir,
  onAccion,
  onCerrarHoja,
  onConfirmar,
}: DetalleVistaProps) {
  if (acceso === 'negado') return <SinAcceso onSalir={onSalir} />;

  if (!cargado) {
    return (
      <Screen>
        <EncabezadoArena onVolver={onSalir} eyebrow="Moderación" titulo="Detalle" />
        {error ? (
          <ErrorSistema mensaje={error} onReintentar={onRefrescar} reintentando={refrescando} />
        ) : (
          <CargaArena etiqueta="Cargando el detalle" formas={['tarjeta', 'rotulo', 'filas']} />
        )}
      </Screen>
    );
  }

  if (!elemento) {
    return (
      <Screen>
        <EncabezadoArena onVolver={onSalir} eyebrow="Moderación" titulo="Detalle" />
        <TarjetaArena variante="contorno">
          <EmptyState compact icon="checkmark-done-outline" title="Ya está atendido" body="Este asunto ya no está en la bandeja." />
        </TarjetaArena>
      </Screen>
    );
  }

  const cabecera = tituloDe(elemento);
  const acciones = accionesDe(elemento);
  return (
    <Screen refreshing={refrescando} onRefresh={onRefrescar}>
      <EncabezadoArena onVolver={onSalir} eyebrow={cabecera.eyebrow} titulo={cabecera.titulo} subtitulo={cabecera.subtitulo} />
      <Contenido e={elemento} />
      <View style={styles.acciones}>
        {acciones.map((a, i) => (
          <Button
            key={a}
            title={TEXTO_ACCION[a].boton}
            variant={a === 'suspender' ? 'danger' : i === 0 ? 'primary' : 'secondary'}
            onPress={() => onAccion(a)}
          />
        ))}
      </View>
      <HojaAccion accion={hoja} elemento={elemento} enviando={enviando} fallo={fallo} onCerrar={onCerrarHoja} onConfirmar={onConfirmar} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  foto: {
    width: '100%',
    aspectRatio: 1,
    maxWidth: 320,
    backgroundColor: ink.ink1,
    borderWidth: 1,
    borderColor: ink.ink3,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.s3,
    alignSelf: 'center',
  },
  imagen: { width: '100%', height: '100%' },
  sinFoto: { ...tipo.bodySm, color: ink.ink6, textAlign: 'center', padding: space.s4 },
  dato: { marginBottom: space.s3 },
  datoRotulo: { ...tipo.label, color: ink.ink6, textTransform: 'uppercase' },
  datoValor: { ...tipo.body, color: ink.ink9 },
  cita: { ...tipo.body, color: ink.ink9 },
  acciones: { gap: space.s3, marginTop: space.s2 },
  explica: { ...tipo.body, color: ink.ink8, marginBottom: space.s4 },
});
