// NIVL · Perfil: las tres hojas de la ruta (FASE3 Lote B2). Puras: los datos,
// los cerrojos y los efectos viven en usePerfil; aquí solo se pinta.
//
//   · HojaBorrar → lo que se pierde en una tarjeta de trama, el aviso de la
//     suscripción según la plataforma, el de creador en texto plano (sin
//     enlace: regla de las tiendas) y un Campo donde hay que escribir
//     «ELIMINAR». Pie: danger «Eliminar para siempre» (apagado hasta que la
//     palabra cuadra) + ghost «Cancelar». El danger sigue llamando a
//     `confirmar()` de usePerfil: borrar la cuenta no tiene vuelta atrás y
//     la segunda pregunta se queda aunque el Campo ya frene el roce.
//   · HojaPausa  → chips del motivo y de los días; INVERSIÓN «Activar pausa».
//   · HojaCodigo → Campo grande en Cinzel (rank); INVERSIÓN «Guardar código».
//   · HojaIdioma → el idioma del coach (1.0.10): Automático + es, en, fr, de,
//     pt, it. Elegir es un toque y cierra la hoja (Check en lo elegido);
//     pie: ghost «Cerrar». La interfaz sigue en español.
//   · HojaIdiomaApp → Modos F1, con el flag `idiomas_activos`: el idioma de la
//     app y del coach a la vez (SelectorIdioma). Elegir cierra la hoja.
//
// Los fallos van en línea (ErrorSistema compacto): nada de avisos encima de
// una hoja abierta.

import { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { Campo, ErrorSistema, TarjetaArena } from '@/components/arena';
import { Button, Card, Check, Chip, ChipWrap, Row, Sheet, useAnunciar } from '@/components/ui';
import { ink, space, type as tipo } from '@/design/tokens';
import { esIdioma, IDIOMAS, NOMBRE_IDIOMA, t, type Preferencia } from '@/i18n';
import { mayus } from '@/i18n/formato';
import { idiomaBase } from '@/i18n/dispositivo';
import { SelectorIdioma } from '@/components/idioma/SelectorIdioma';
import { CODIGO_MAX_LENGTH } from '@/lib/creatormath';
import { addDays, nombreDia } from '@/lib/dates';

/** La palabra que hay que escribir para poder borrar la cuenta («ELIMINAR»). */
export function palabraBorrar(): string {
  return t('perfil:borrar.palabra');
}

/** ¿Lo escrito es «ELIMINAR»? Sin distinguir mayúsculas ni espacios de los lados. */
export function palabraCuadra(escrito: string): boolean {
  return mayus(escrito.trim()) === mayus(palabraBorrar());
}

// En iOS no se nombra Google Play (guideline 2.3.10), y al revés.
function avisoSuscripcion(): string {
  return Platform.OS === 'android'
    ? t('perfil:borrar.suscripcion.android')
    : Platform.OS === 'ios'
      ? t('perfil:borrar.suscripcion.ios')
      : t('perfil:borrar.suscripcion.otra');
}

export interface HojaBorrarProps {
  abierta: boolean;
  cerrar: () => void;
  aviso: string | null;
  esCreador: boolean;
  borrando: boolean;
  confirmar: () => void;
  /** Solo la galería: lo escrito de partida en el Campo. */
  escritoInicial?: string;
}

export function HojaBorrar({ abierta, cerrar, aviso, esCreador, borrando, confirmar, escritoInicial = '' }: HojaBorrarProps) {
  const [escrito, setEscrito] = useState(escritoInicial);
  // Cada vez que se abre, el Campo empieza vacío: la palabra no se queda puesta.
  useEffect(() => {
    if (abierta) setEscrito(escritoInicial);
  }, [abierta, escritoInicial]);

  const cuadra = palabraCuadra(escrito);
  // Quien no ve el botón tiene que saber que ya se ha encendido.
  useAnunciar(abierta && cuadra ? t('perfil:borrar.activo') : null);
  const cerrarSiSePuede = () => {
    if (!borrando) cerrar();
  };

  return (
    <Sheet
      visible={abierta}
      onClose={cerrarSiSePuede}
      eyebrow={t('perfil:borrar.eyebrow')}
      title={t('perfil:borrar.titulo')}
      footer={
        <>
          <Button
            title={t('perfil:borrar.boton')}
            variant="danger"
            icon="trash-outline"
            onPress={confirmar}
            loading={borrando}
            disabled={!cuadra}
          />
          <Button title={t('comun:cancelar')} variant="ghost" onPress={cerrarSiSePuede} disabled={borrando} />
        </>
      }
    >
      <View style={styles.pila}>
        <TarjetaArena variante="trama" rotulo={t('perfil:borrar.rotulo')}>
          <View style={styles.pilaCorta}>
            <Text style={styles.cuerpo}>{t('perfil:borrar.cuerpo')}</Text>
            <Text style={styles.nota}>{avisoSuscripcion()}</Text>
          </View>
        </TarjetaArena>

        {esCreador ? (
          <Text style={styles.nota}>{t('perfil:borrar.creador')}</Text>
        ) : null}

        <Campo
          etiqueta={t('perfil:borrar.etiqueta', { palabra: palabraBorrar() })}
          grande="rank"
          value={escrito}
          onChangeText={setEscrito}
          placeholder={palabraBorrar()}
          autoCapitalize="characters"
          autoCorrect={false}
          autoComplete="off"
          spellCheck={false}
          editable={!borrando}
          maxLength={20}
          returnKeyType="done"
          ayuda={cuadra ? t('perfil:borrar.listo') : t('perfil:borrar.noCuadra')}
          accessibilityLabel={t('perfil:borrar.campoA11y', { palabra: palabraBorrar() })}
        />

        {aviso ? <ErrorSistema compacto mensaje={aviso} /> : null}
      </View>
    </Sheet>
  );
}

export interface HojaPausaProps {
  abierta: boolean;
  cerrar: () => void;
  motivo: string;
  setMotivo: (m: string) => void;
  dias: number;
  setDias: (d: number) => void;
  activar: () => void;
  /** El fallo al activar, en línea dentro de la hoja. */
  aviso?: string | null;
  /** Activando: el botón muestra la carga y no admite un segundo toque. */
  ocupado?: boolean;
  /** Hoy (AAAA-MM-DD): de aquí sale el día en que se reanuda. */
  today: string;
  motivos: readonly string[];
  duraciones: readonly number[];
}

const textoDias = (d: number) => t('comun:dia', { count: d });

export function HojaPausa({
  abierta,
  cerrar,
  motivo,
  setMotivo,
  dias,
  setDias,
  activar,
  aviso = null,
  ocupado = false,
  today,
  motivos,
  duraciones,
}: HojaPausaProps) {
  const cerrarSiSePuede = () => {
    if (!ocupado) cerrar();
  };
  return (
    <Sheet
      visible={abierta}
      onClose={cerrarSiSePuede}
      eyebrow={t('perfil:pausa.eyebrow')}
      title={t('perfil:pausa.titulo')}
      footer={
        <>
          <Button title={t('perfil:pausa.activar')} size="lg" icon="snow-outline" onPress={activar} loading={ocupado} />
          <Button title={t('comun:cancelar')} variant="ghost" onPress={cerrarSiSePuede} disabled={ocupado} />
        </>
      }
    >
      <View style={styles.pila}>
        <Text style={styles.cuerpo}>{t('perfil:pausa.cuerpo')}</Text>

        <View style={styles.grupo}>
          <Text style={styles.etiqueta} maxFontSizeMultiplier={1.35}>
            {t('perfil:pausa.motivo')}
          </Text>
          <ChipWrap>
            {motivos.map((r) => (
              <Chip key={r} label={r} selected={motivo === r} onPress={() => setMotivo(r)} accessibilityLabel={t('perfil:pausa.motivoA11y', { motivo: r })} />
            ))}
          </ChipWrap>
        </View>

        <View style={styles.grupo}>
          <Text style={styles.etiqueta} maxFontSizeMultiplier={1.35}>
            {t('perfil:pausa.duracion')}
          </Text>
          <ChipWrap>
            {duraciones.map((d) => (
              <Chip key={d} label={textoDias(d)} selected={dias === d} onPress={() => setDias(d)} accessibilityLabel={textoDias(d)} />
            ))}
          </ChipWrap>
        </View>

        <View style={styles.grupo} accessible accessibilityLabel={t('perfil:pausa.reanudaA11y', { dia: nombreDia(addDays(today, dias)) })}>
          <Text style={styles.etiqueta} maxFontSizeMultiplier={1.35}>
            {t('perfil:pausa.reanuda')}
          </Text>
          <Text style={styles.fecha} maxFontSizeMultiplier={1.35}>
            {mayus(nombreDia(addDays(today, dias)))}
          </Text>
        </View>

        {aviso ? <ErrorSistema compacto mensaje={aviso} /> : null}
      </View>
    </Sheet>
  );
}

export interface HojaCodigoProps {
  abierta: boolean;
  cerrar: () => void;
  valor: string;
  cambiar: (texto: string) => void;
  aviso: string | null;
  ocupado: boolean;
  enviar: () => void;
  /** La galería lo apaga: el foco abre el teclado en las capturas. */
  autoFocus?: boolean;
}

export function HojaCodigo({ abierta, cerrar, valor, cambiar, aviso, ocupado, enviar, autoFocus = true }: HojaCodigoProps) {
  return (
    <Sheet
      visible={abierta}
      onClose={cerrar}
      eyebrow={t('perfil:codigo.eyebrow')}
      title={t('perfil:codigo.titulo')}
      footer={
        <>
          <Button title={t('perfil:codigo.guardar')} size="lg" onPress={enviar} loading={ocupado} disabled={!valor.trim()} />
          <Button title={t('comun:cancelar')} variant="ghost" onPress={cerrar} />
        </>
      }
    >
      <View style={styles.pila}>
        <Text style={styles.cuerpo}>{t('perfil:codigo.cuerpo')}</Text>
        <Campo
          etiqueta={t('perfil:codigo.etiqueta')}
          grande="rank"
          value={valor}
          onChangeText={cambiar}
          placeholder={mayus(t('perfil:codigo.etiqueta'))}
          maxLength={CODIGO_MAX_LENGTH + 4}
          autoCapitalize="characters"
          autoCorrect={false}
          autoComplete="off"
          spellCheck={false}
          autoFocus={autoFocus}
          returnKeyType="done"
          onSubmitEditing={enviar}
          error={aviso}
          accessibilityLabel={t('perfil:codigo.a11y')}
        />
      </View>
    </Sheet>
  );
}

export interface HojaIdiomaProps {
  abierta: boolean;
  cerrar: () => void;
  /** Lo elegido (null: aún no se sabe; se marca como Español, que es lo que habla el coach entonces). */
  preferencia: Preferencia | null;
  /** El idioma del teléfono (BCP 47), para explicar qué hace «Automático». */
  dispositivo: string | null;
  elegir: (p: Preferencia) => void;
}

/** Qué hace «Automático» con este teléfono. */
export function detalleAutomatico(dispositivo: string | null): string {
  const base = idiomaBase(dispositivo);
  if (esIdioma(base)) return t('perfil:idioma.autoAhora', { idioma: NOMBRE_IDIOMA[base] });
  return t('perfil:idioma.autoOtro');
}

export function HojaIdioma({ abierta, cerrar, preferencia, dispositivo, elegir }: HojaIdiomaProps) {
  const elegida: Preferencia = preferencia ?? 'es';
  const opciones: { valor: Preferencia; titulo: string; detalle?: string }[] = [
    { valor: 'auto', titulo: t('perfil:idioma.auto'), detalle: detalleAutomatico(dispositivo) },
    ...IDIOMAS.map((i) => ({ valor: i as Preferencia, titulo: NOMBRE_IDIOMA[i] })),
  ];
  return (
    <Sheet
      visible={abierta}
      onClose={cerrar}
      eyebrow={t('perfil:idioma.eyebrow')}
      title={t('perfil:idioma.titulo')}
      footer={<Button title={t('comun:cerrar')} variant="ghost" onPress={cerrar} />}
    >
      <View style={styles.pila}>
        <Text style={styles.cuerpo}>{t('perfil:idioma.cuerpo')}</Text>
        <Card padded={false} style={styles.lista}>
          {opciones.map((o, i) => {
            const marcada = elegida === o.valor;
            return (
              <Row
                key={o.valor}
                first={i === 0}
                title={o.titulo}
                detail={o.detalle}
                trailing={<Check checked={marcada} size={22} />}
                onPress={() => elegir(o.valor)}
                accessibilityLabel={o.detalle ? t('perfil:idioma.opcionA11y', { titulo: o.titulo, detalle: o.detalle }) : o.titulo}
                accessibilityState={{ selected: marcada }}
              />
            );
          })}
        </Card>
      </View>
    </Sheet>
  );
}

export interface HojaIdiomaAppProps {
  activa: boolean;
  abierta: boolean;
  cerrar: () => void;
  valor: string;
  elegir: (lng: string) => void;
}

export function HojaIdiomaApp({ activa, abierta, cerrar, valor, elegir }: HojaIdiomaAppProps) {
  if (!activa) return null;
  return (
    <Sheet
      visible={abierta}
      onClose={cerrar}
      eyebrow={t('perfil:idiomaApp.eyebrow')}
      title={t('perfil:idiomaApp.titulo')}
      footer={<Button title={t('comun:cerrar')} variant="ghost" onPress={cerrar} />}
    >
      <View style={styles.pila}>
        <Text style={styles.cuerpo}>{t('perfil:idiomaApp.cuerpo')}</Text>
        <SelectorIdioma valor={valor} alCambiar={elegir} />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  pila: { gap: space.s5 },
  lista: { paddingHorizontal: space.s4, paddingVertical: 2 },
  pilaCorta: { gap: space.s3 },
  grupo: { gap: space.s2 },
  etiqueta: {
    fontFamily: tipo.label.family,
    fontSize: tipo.label.size,
    lineHeight: tipo.label.lineHeight,
    letterSpacing: tipo.label.tracking,
    textTransform: 'uppercase',
    color: ink.ink6,
  },
  cuerpo: {
    fontFamily: tipo.body.family,
    fontSize: tipo.body.size,
    lineHeight: tipo.body.lineHeight,
    color: ink.ink9,
  },
  nota: {
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink8,
  },
  fecha: {
    fontFamily: tipo.inscripcion.family,
    fontSize: tipo.inscripcion.size,
    lineHeight: tipo.inscripcion.lineHeight,
    letterSpacing: tipo.inscripcion.tracking,
    color: ink.ink9,
  },
});
