// NIVL · Acceso: la vista de entrar (Fase 3, Lote A). Pura: solo props. Los
// datos y los efectos viven en useLogin; la galería (/kit/pantallas) la pinta
// con datos de mentira (demo.tsx).
//
// Composición (Ónix):
//   1. Portada: el escudo con la N, «NIVL» en Playfair y el lema. Con el
//      teclado fuera se pliega a «NIVL». En escritorio la lleva la fachada y
//      el formulario va en tarjeta.
//   2. Pestañas ENTRAR / CREAR CUENTA (role tab). No salen al recuperar ni en
//      el portal de creadores.
//   3. La línea del modo y los campos. Al crear cuenta solo correo, contraseña
//      (con su fuerza) y la casilla legal.
//   4. El aviso o el error del servidor y, tras registrarse, «Reenviar correo».
//   5. El botón principal hueso. Debajo, enlaces ghost de 44 y los legales en
//      micro (la versión, solo en Perfil).
//
// Modo portal (SITIO_CREADORES): solo entrar. Sin registro (el alta de
// creador es manual) ni restablecer (el enlace del correo abre la app, no
// este sitio; R1 del Chat 3).

import { useContext } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Campo, Entrada, TarjetaArena } from '@/components/arena';
import { Button, Check, Screen, useAnunciar } from '@/components/ui';
import { ariaWeb } from '@/components/ui/ariaWeb';
import { ConFachada } from '@/components/web/FachadaAcceso';
import { vibrar } from '@/design/haptics';
import { ink, oro, radio, space, stroke, type as tipo, vidrio } from '@/design/tokens';
import { t } from '@/i18n';
import { mayus } from '@/i18n/formato';
import { LEGAL_URLS } from '@/lib/proplans';
import { ayudaContrasena, evaluarLogin, type CampoTocable, type CamposLogin, type ModoLogin, type Tocados } from './formulario';
import { Escudo } from './Escudo';
import { ALTO_CAMPO, CampoContrasena, FuerzaContrasena } from './piezas';

export interface EstadoReenvio {
  /** Segundos de bloqueo que quedan; 0 si se puede pulsar. */
  segundos: number;
  enviando: boolean;
  /** Resultado del último reenvío, ya en la voz del sistema. */
  mensaje: string | null;
}

export interface LoginVistaProps {
  /** Portal de creadores: solo entrar. */
  portal: boolean;
  /** Viene del cuestionario: el alta guarda su plan. */
  desdePlan?: boolean;
  modo: ModoLogin;
  campos: CamposLogin;
  tocados: Tocados;
  verContrasena: boolean;
  /** Error del servidor, ya en la voz del sistema (mensajeSistema). */
  error: string | null;
  aviso: string | null;
  enviando: boolean;
  /** Teclado fuera: la portada se pliega a la marca. */
  plegada: boolean;
  /** Tras registrarse: reenviar el correo de confirmación. null si no toca. */
  reenvio: EstadoReenvio | null;
  onCorreo: (v: string) => void;
  onContrasena: (v: string) => void;
  onTocar: (campo: CampoTocable) => void;
  onAceptar: () => void;
  onVerContrasena: () => void;
  onModo: (m: ModoLogin) => void;
  onEnviar: () => void;
  onReenviar: () => void;
  onCrearPlan: () => void;
  onAbrir: (url: string) => void;
}

// La casilla legal (`acceso:login.casillaLegal`): texto acordado con el Chat 3
// (seguridad y datos). La intro y el botón salen de `acceso:login.intro.<modo>`
// y `acceso:login.boton.<modo>`.

const PESTANAS: ('signin' | 'signup')[] = ['signin', 'signup'];

/** Tracking de la marca. */
const TRACKING_MARCA = 6;
/** Ancho del escudo de la portada: deja el botón a la vista en un móvil pequeño. */
const ANCHO_ESCUDO = 72;
/** Relleno de la tarjeta del formulario en escritorio. */
const PAD_TARJETA = 28;
/** Ancho máximo del formulario: en tableta, un campo de 720 no se lee. */
const ANCHO_FORM = 440;

export function LoginVista(p: LoginVistaProps) {
  const { portal, modo, campos, tocados, verContrasena, error, aviso, enviando, plegada } = p;
  // En iOS el rol alerta no habla: el error y el aviso se anuncian a mano.
  useAnunciar(error);
  useAnunciar(aviso);
  useAnunciar(p.reenvio?.mensaje ?? null);
  const ev = evaluarLogin(modo, campos, tocados);
  const alta = modo === 'signup';
  const recuperar = modo === 'recover';
  // Alta con todo bien salvo la casilla: el botón apagado debe decir por qué.
  const faltaCasilla = alta && !campos.aceptado && evaluarLogin(modo, { ...campos, aceptado: true }, tocados).puedeEnviar;
  // Web de escritorio: la fachada de la izquierda ya lleva la marca y el lema.
  const conFachada = useContext(ConFachada);

  return (
    <Screen contentStyle={styles.contenido}>
      <Entrada indice={0}>
        {conFachada ? null : plegada ? (
          <Text style={styles.marcaPlegada} accessibilityRole="header" maxFontSizeMultiplier={1}>{/* i18n-ok: la marca */}
            NIVL
          </Text>
        ) : (
          <Portada lema={portal ? mayus(t('acceso:login.portal')) : t('comun:lema')} />
        )}
      </Entrada>

      <Entrada indice={1}>
        <View style={[styles.form, conFachada && styles.tarjeta]}>
          {portal ? null : recuperar ? (
            <Text style={styles.tituloModo} accessibilityRole="header" maxFontSizeMultiplier={1.35}>
              {t('acceso:login.recuperarTitulo')}
            </Text>
          ) : (
            <View style={styles.pestanas} accessibilityRole="tablist">
              {PESTANAS.map((pestana) => {
                const activa = modo === pestana;
                return (
                  <Pressable
                    key={pestana}
                    onPress={() => {
                      if (activa) return;
                      vibrar('seleccion');
                      p.onModo(pestana);
                    }}
                    style={[styles.pestana, activa && styles.pestanaActiva]}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: activa }}
                    {...ariaWeb({ selected: activa })}
                    accessibilityLabel={t(`acceso:login.pestana.${pestana}.a11y`)}
                  >
                    <Text style={[styles.pestanaTexto, activa && styles.pestanaTextoActiva]} maxFontSizeMultiplier={1.35}>
                      {mayus(t(`acceso:login.pestana.${pestana}.texto`))}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}

          <Text style={styles.intro} maxFontSizeMultiplier={1.6}>
            {portal ? t('acceso:login.introPortal') : p.desdePlan && modo === 'signup' ? t('onboarding:embudo.cuenta.titulo') : t(`acceso:login.intro.${modo}`)}
          </Text>

          <View style={styles.campos}>
            <Campo
              etiqueta={t('acceso:login.correo')}
              value={campos.correo}
              onChangeText={p.onCorreo}
              onBlur={() => p.onTocar('correo')}
              error={ev.errorCorreo}
              style={styles.campo}
              autoCapitalize="none"
              autoComplete="email"
              textContentType="username"
              keyboardType="email-address"
              placeholder={t('acceso:login.correoPlaceholder')}
              accessibilityLabel={t('acceso:login.correoA11y')}
              onSubmitEditing={recuperar ? p.onEnviar : undefined}
            />

            {recuperar ? null : (
              <CampoContrasena
                etiqueta={t('acceso:contrasena.etiqueta')}
                ver={verContrasena}
                onVer={p.onVerContrasena}
                value={campos.contrasena}
                onChangeText={p.onContrasena}
                onBlur={() => p.onTocar('contrasena')}
                autoComplete={modo === 'signin' ? 'current-password' : 'new-password'}
                textContentType={modo === 'signin' ? 'password' : 'newPassword'}
                placeholder={alta ? t('acceso:contrasena.placeholder') : '••••••••••'}
                accessibilityLabel={t('acceso:contrasena.etiqueta')}
                onSubmitEditing={modo === 'signin' ? p.onEnviar : undefined}
              />
            )}

            {ev.fuerza ? (
              <FuerzaContrasena fuerza={ev.fuerza} faltas={ev.faltas} />
            ) : alta ? (
              <Text style={styles.ayuda} maxFontSizeMultiplier={1.6}>
                {ayudaContrasena()}
              </Text>
            ) : null}

            {alta ? (
              <View>
                <Pressable
                  onPress={() => {
                    vibrar('seleccion');
                    p.onAceptar();
                  }}
                  style={styles.casilla}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: campos.aceptado }}
                  {...ariaWeb({ checked: campos.aceptado })}
                  accessibilityLabel={t('acceso:login.casillaLegal')}
                >
                  <Check checked={campos.aceptado} size={24} />
                  <Text style={styles.casillaTexto} maxFontSizeMultiplier={1.6}>
                    {t('acceso:login.casillaLegal')}
                  </Text>
                </Pressable>
                {/* Los enlaces van fuera de la casilla: dentro, VoiceOver y
                    TalkBack leían la casilla entera y no llegaban a ellos. */}
                <View style={styles.legalesCasilla}>
                  <EnlaceLegal
                    texto={t('acceso:login.terminos')}
                    etiqueta={t('acceso:login.terminos')}
                    onPress={() => p.onAbrir(LEGAL_URLS.terminos)}
                  />
                  <EnlaceLegal
                    texto={t('acceso:login.privacidad')}
                    etiqueta={t('acceso:login.privacidad')}
                    onPress={() => p.onAbrir(LEGAL_URLS.privacidad)}
                  />
                </View>
              </View>
            ) : null}
          </View>

          {error ? (
            <View accessibilityRole="alert" accessibilityLiveRegion="assertive" style={styles.mensaje}>
              <TarjetaArena variante="trama" rotulo={t('acceso:noHaSalido')} style={styles.compacta}>
                <Text style={styles.mensajeTexto} maxFontSizeMultiplier={1.6}>
                  {error}
                </Text>
              </TarjetaArena>
            </View>
          ) : null}
          {aviso ? (
            <View accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.mensaje}>
              <TarjetaArena variante="contorno" rotulo={t('acceso:login.revisaCorreo')} style={styles.compacta}>
                <Text style={styles.mensajeTexto} maxFontSizeMultiplier={1.6}>
                  {aviso}
                </Text>
              </TarjetaArena>
            </View>
          ) : null}

          {p.reenvio ? (
            <View style={styles.reenvio}>
              <Button
                title={
                  p.reenvio.segundos > 0
                    ? t('acceso:login.reenviar.espera', { n: p.reenvio.segundos })
                    : t('acceso:login.reenviar.boton')
                }
                variant="secondary"
                onPress={p.onReenviar}
                loading={p.reenvio.enviando}
                disabled={p.reenvio.segundos > 0}
              />
              {p.reenvio.mensaje ? (
                <Text style={styles.reenvioMensaje} accessibilityLiveRegion="polite" maxFontSizeMultiplier={1.6}>
                  {p.reenvio.mensaje}
                </Text>
              ) : null}
            </View>
          ) : null}

          <Button
            title={t(`acceso:login.boton.${modo}`)}
            size="lg"
            onPress={p.onEnviar}
            loading={enviando}
            disabled={!ev.puedeEnviar}
            style={styles.principal}
          />
          {faltaCasilla ? (
            <Text style={styles.faltaCasilla} accessibilityLiveRegion="polite" maxFontSizeMultiplier={1.6}>
              {t('acceso:login.faltaCasilla')}
            </Text>
          ) : null}

          {portal ? (
            <Text style={styles.nota} maxFontSizeMultiplier={1.6}>
              {t('acceso:login.olvidoPortal')}
            </Text>
          ) : modo === 'signin' ? (
            <Button
              title={t('acceso:login.olvido')}
              variant="ghost"
              onPress={() => p.onModo('recover')}
              disabled={enviando}
              style={styles.enlace}
            />
          ) : recuperar ? (
            <Button
              title={t('acceso:login.volverAEntrar')}
              variant="ghost"
              onPress={() => p.onModo('signin')}
              disabled={enviando}
              style={styles.enlace}
            />
          ) : (
            <Text style={styles.nota} maxFontSizeMultiplier={1.6}>
              {t('acceso:login.notaCuenta')}
            </Text>
          )}

          {portal || p.desdePlan ? null : (
            <Button
              title={t('acceso:login.crearPlan')}
              variant="ghost"
              onPress={p.onCrearPlan}
              disabled={enviando}
              style={styles.enlace}
            />
          )}

          {/* Los textos legales, a la vista antes de entrar. Al crear cuenta
              ya van junto a la casilla. */}
          {alta ? null : (
            <View style={styles.legales}>
              <EnlaceLegal
                texto={t('acceso:login.terminos')}
                etiqueta={t('acceso:login.terminosA11y')}
                onPress={() => p.onAbrir(LEGAL_URLS.terminos)}
              />
              <Text style={styles.separador}>·</Text>
              <EnlaceLegal
                texto={t('acceso:login.privacidad')}
                etiqueta={t('acceso:login.privacidadA11y')}
                onPress={() => p.onAbrir(LEGAL_URLS.privacidad)}
              />
            </View>
          )}

          {/* La versión no va en el acceso: solo en Perfil (Version.tsx). */}
        </View>
      </Entrada>
    </Screen>
  );
}

/** El escudo con la N, la marca y el lema. */
function Portada({ lema }: { lema: string }) {
  return (
    <View style={styles.portada}>
      <Escudo ancho={ANCHO_ESCUDO} />
      <Text style={styles.marca} accessibilityRole="header" accessibilityLabel="NIVL" maxFontSizeMultiplier={1}>{/* i18n-ok: la marca */}
        NIVL
      </Text>
      <Text style={styles.lemaTexto} maxFontSizeMultiplier={1.35} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
        {lema}
      </Text>
    </View>
  );
}

/** Enlace legal en micro, con 44 de alto de zona táctil. */
function EnlaceLegal({ texto, etiqueta, onPress }: { texto: string; etiqueta: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.legal} accessibilityRole="link" accessibilityLabel={etiqueta}>
      <Text style={styles.legalTexto} maxFontSizeMultiplier={1.6}>
        {texto}
      </Text>
    </Pressable>
  );
}

const micro = {
  fontFamily: tipo.micro.family,
  fontSize: tipo.micro.size,
  lineHeight: tipo.micro.lineHeight,
} as const;

const styles = StyleSheet.create({
  contenido: { flexGrow: 1, justifyContent: 'center', paddingTop: space.s6 },
  portada: { alignItems: 'center', marginBottom: space.s6 },
  marca: {
    fontFamily: tipo.display.family,
    fontSize: tipo.display.size,
    lineHeight: tipo.display.lineHeight,
    letterSpacing: TRACKING_MARCA,
    // El tracking se suma tras la última letra: el mismo hueco delante centra.
    paddingLeft: TRACKING_MARCA,
    color: ink.ink9,
    textAlign: 'center',
    marginTop: space.s2,
  },
  lemaTexto: {
    fontFamily: tipo.inscripcion.family,
    fontSize: tipo.inscripcion.size,
    lineHeight: tipo.inscripcion.lineHeight,
    letterSpacing: tipo.inscripcion.tracking,
    color: ink.ink8,
    textAlign: 'center',
    marginTop: space.s1,
  },
  marcaPlegada: {
    fontFamily: tipo.number.family,
    fontSize: tipo.number.size,
    lineHeight: tipo.number.lineHeight,
    letterSpacing: TRACKING_MARCA,
    paddingLeft: TRACKING_MARCA,
    color: ink.ink9,
    textAlign: 'center',
    marginBottom: space.s5,
  },
  form: { width: '100%', maxWidth: ANCHO_FORM, alignSelf: 'center' },
  tarjeta: {
    padding: PAD_TARJETA,
    borderRadius: radio.tarjeta,
    borderWidth: stroke.hairline,
    borderColor: vidrio.borde,
    backgroundColor: vidrio.tarjeta,
  },
  tituloModo: {
    fontFamily: tipo.title.family,
    fontSize: tipo.title.size,
    lineHeight: tipo.title.lineHeight,
    letterSpacing: tipo.title.tracking,
    color: ink.ink9,
    textAlign: 'center',
  },
  pestanas: {
    flexDirection: 'row',
    gap: space.s1,
    padding: space.s1,
    borderRadius: radio.control,
    borderWidth: stroke.hairline,
    borderColor: vidrio.borde,
    backgroundColor: vidrio.suave,
  },
  pestana: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radio.chip },
  pestanaActiva: { backgroundColor: oro.tenue },
  pestanaTexto: {
    fontFamily: tipo.label.family,
    fontSize: tipo.label.size,
    lineHeight: tipo.label.lineHeight,
    letterSpacing: tipo.label.tracking,
    color: ink.ink8,
  },
  pestanaTextoActiva: { color: oro.claro },
  intro: {
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink8,
    textAlign: 'center',
    marginTop: space.s4,
  },
  campos: { gap: space.s4, marginTop: space.s5 },
  campo: { minHeight: ALTO_CAMPO },
  ayuda: {
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink6,
    marginTop: -space.s2,
  },
  casilla: { flexDirection: 'row', alignItems: 'flex-start', gap: space.s3, minHeight: 44, paddingTop: space.s2 },
  casillaTexto: {
    flex: 1,
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink8,
  },
  legalesCasilla: { flexDirection: 'row', flexWrap: 'wrap', columnGap: space.s4, paddingLeft: 24 + space.s3 },
  mensaje: { marginTop: space.s5 },
  compacta: { paddingVertical: space.s3 },
  mensajeTexto: {
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink9,
  },
  reenvio: { gap: space.s2, marginTop: space.s3 },
  reenvioMensaje: {
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink8,
    textAlign: 'center',
  },
  principal: { marginTop: space.s6 },
  enlace: { marginTop: space.s2, alignSelf: 'center' },
  faltaCasilla: {
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink6,
    textAlign: 'center',
    marginTop: space.s2,
  },
  nota: {
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink6,
    textAlign: 'center',
    marginTop: space.s4,
  },
  legales: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: space.s2, marginTop: space.s3 },
  legal: { minHeight: 44, justifyContent: 'center' },
  legalTexto: { ...micro, color: ink.ink6, textDecorationLine: 'underline' },
  separador: { ...micro, color: ink.ink6 },
});
