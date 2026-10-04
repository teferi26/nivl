// NIVL · Acceso: la vista de entrar (Fase 3, Lote A). Pura: solo props. Los
// datos y los efectos viven en useLogin; la galería (/kit/pantallas) la pinta
// con datos de mentira (demo.tsx).
//
// Composición:
//   1. Portada a sangre: el graderío (Arena arco 140, ink3) con «NIVL» en
//      piedra y el lema entre dos laureles. Con el teclado fuera se pliega a
//      «NIVL» grabado, sin arena.
//   2. Pestañas ENTRAR / CREAR CUENTA (role tab; la activa con regla inferior
//      de 2, sin invertir). No salen al recuperar ni en el portal de creadores.
//   3. La línea del modo y los campos (Campo). Al crear cuenta, la fuerza en
//      una Barra de 4 segmentos y lo que falta.
//   4. El aviso (contorno) o el error del servidor (trama compacta, alerta).
//   5. LA INVERSIÓN: el botón principal en lg. Debajo, enlaces ghost de 44,
//      y los legales en micro (la versión, solo en Perfil).
//
// Modo portal (SITIO_CREADORES): solo entrar. Sin registro (el alta de
// creador es manual) ni restablecer (el enlace del correo abre la app, no
// este sitio; R1 del Chat 3).

import { useState } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { Arena, ASangre, Campo, Entrada, Laurel, TarjetaArena } from '@/components/arena';
import { Button, Check, Screen, useAnunciar } from '@/components/ui';
import { vibrar } from '@/design/haptics';
import { ink, space, stroke, type as tipo } from '@/design/tokens';
import { LEGAL_URLS } from '@/lib/proplans';
import { NAME_MAX_LENGTH } from '@/lib/validation';
import { AYUDA_CONTRASENA, evaluarLogin, type CampoTocable, type CamposLogin, type ModoLogin, type Tocados } from './formulario';
import { CampoContrasena, FuerzaContrasena } from './piezas';

export interface LoginVistaProps {
  /** Portal de creadores: solo entrar. */
  portal: boolean;
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
  onNombre: (v: string) => void;
  onCorreo: (v: string) => void;
  onContrasena: (v: string) => void;
  onRepite: (v: string) => void;
  onTocar: (campo: CampoTocable) => void;
  onAceptar: () => void;
  onVerContrasena: () => void;
  onModo: (m: ModoLogin) => void;
  onEnviar: () => void;
  onAbrir: (url: string) => void;
}

// Texto acordado con el Chat 3 (seguridad y datos).
const CASILLA_LEGAL = 'He leído y acepto los Términos de NIVL y he leído su Política de privacidad.';

const INTRO: Record<ModoLogin, string> = {
  signin: 'Entra con tu correo y tu contraseña de NIVL.',
  signup: 'Crea tu cuenta de NIVL. Te enviaremos un enlace para confirmar el correo.',
  recover: 'Escribe el correo de tu cuenta y te enviaremos un enlace para elegir una contraseña nueva.',
};

const INTRO_PORTAL = 'Entra con tu cuenta de NIVL para ver tu panel de creador.';
const OLVIDO_PORTAL =
  '¿Olvidaste la contraseña? Recupérala desde la app de NIVL («¿Olvidaste la contraseña?» en la pantalla de entrar) y vuelve aquí.';

const BOTON: Record<ModoLogin, string> = { signin: 'Entrar', signup: 'Crear cuenta', recover: 'Enviar enlace' };

const PESTANAS: { modo: ModoLogin; texto: string; etiqueta: string }[] = [
  { modo: 'signin', texto: 'ENTRAR', etiqueta: 'Entrar con cuenta existente' },
  { modo: 'signup', texto: 'CREAR CUENTA', etiqueta: 'Crear una cuenta nueva' },
];

/** Alto del graderío de la portada. */
const ALTO_ARENA = 140;
/** Tracking de la marca: una fachada, más abierta que el `display`. */
const TRACKING_MARCA = 16;
/** Ancho máximo del formulario: en tableta, un campo de 720 no se lee. */
const ANCHO_FORM = 440;

export function LoginVista(p: LoginVistaProps) {
  const { portal, modo, campos, tocados, verContrasena, error, aviso, enviando, plegada } = p;
  // En iOS el rol alerta no habla: el error y el aviso se anuncian a mano.
  useAnunciar(error);
  useAnunciar(aviso);
  const ev = evaluarLogin(modo, campos, tocados);
  const alta = modo === 'signup';
  const recuperar = modo === 'recover';
  // Alta con todo bien salvo la casilla: el botón apagado debe decir por qué.
  const faltaCasilla = alta && !campos.aceptado && evaluarLogin(modo, { ...campos, aceptado: true }, tocados).puedeEnviar;

  return (
    <Screen contentStyle={styles.contenido}>
      <Entrada indice={0}>
        {plegada ? (
          <Text style={styles.marcaPlegada} accessibilityRole="header" maxFontSizeMultiplier={1}>
            NIVL
          </Text>
        ) : (
          <Portada lema={portal ? 'PORTAL DE CREADORES' : 'UN 1 % MEJOR CADA DÍA'} />
        )}
      </Entrada>

      <Entrada indice={1}>
        <View style={styles.form}>
          {portal ? null : recuperar ? (
            <Text style={styles.tituloModo} accessibilityRole="header" maxFontSizeMultiplier={1.35}>
              RECUPERAR CONTRASEÑA
            </Text>
          ) : (
            <View style={styles.pestanas} accessibilityRole="tablist">
              {PESTANAS.map((t) => {
                const activa = modo === t.modo;
                return (
                  <Pressable
                    key={t.modo}
                    onPress={() => {
                      if (activa) return;
                      vibrar('seleccion');
                      p.onModo(t.modo);
                    }}
                    style={[styles.pestana, activa && styles.pestanaActiva]}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: activa }}
                    accessibilityLabel={t.etiqueta}
                  >
                    <Text style={[styles.pestanaTexto, activa && styles.pestanaTextoActiva]} maxFontSizeMultiplier={1.35}>
                      {t.texto}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}

          <Text style={styles.intro} maxFontSizeMultiplier={1.6}>
            {portal ? INTRO_PORTAL : INTRO[modo]}
          </Text>

          <View style={styles.campos}>
            {alta ? (
              <Campo
                etiqueta="Nombre"
                value={campos.nombre}
                onChangeText={p.onNombre}
                onBlur={() => p.onTocar('nombre')}
                error={ev.errorNombre}
                autoCapitalize="words"
                autoComplete="name"
                textContentType="name"
                maxLength={NAME_MAX_LENGTH}
                placeholder="Cómo quieres que te llame el sistema"
                accessibilityLabel="Nombre"
              />
            ) : null}

            <Campo
              etiqueta="Correo"
              value={campos.correo}
              onChangeText={p.onCorreo}
              onBlur={() => p.onTocar('correo')}
              error={ev.errorCorreo}
              autoCapitalize="none"
              autoComplete="email"
              textContentType="username"
              keyboardType="email-address"
              placeholder="tu@correo.com"
              accessibilityLabel="Correo electrónico"
              onSubmitEditing={recuperar ? p.onEnviar : undefined}
            />

            {recuperar ? null : (
              <CampoContrasena
                etiqueta="Contraseña"
                ver={verContrasena}
                onVer={p.onVerContrasena}
                value={campos.contrasena}
                onChangeText={p.onContrasena}
                onBlur={() => p.onTocar('contrasena')}
                autoComplete={modo === 'signin' ? 'current-password' : 'new-password'}
                textContentType={modo === 'signin' ? 'password' : 'newPassword'}
                placeholder={alta ? 'Una frase que recuerdes' : '••••••••••'}
                accessibilityLabel="Contraseña"
                onSubmitEditing={modo === 'signin' ? p.onEnviar : undefined}
              />
            )}

            {ev.fuerza ? (
              <FuerzaContrasena fuerza={ev.fuerza} faltas={ev.faltas} />
            ) : alta ? (
              <Text style={styles.ayuda} maxFontSizeMultiplier={1.6}>
                {AYUDA_CONTRASENA}
              </Text>
            ) : null}

            {alta ? (
              <>
                <Campo
                  etiqueta="Repite la contraseña"
                  value={campos.repite}
                  onChangeText={p.onRepite}
                  onBlur={() => p.onTocar('repite')}
                  error={ev.errorRepite}
                  secureTextEntry={!verContrasena}
                  autoCapitalize="none"
                  autoComplete="new-password"
                  textContentType="newPassword"
                  placeholder="••••••••••"
                  accessibilityLabel="Repite la contraseña"
                />

                <View>
                  <Pressable
                    onPress={() => {
                      vibrar('seleccion');
                      p.onAceptar();
                    }}
                    style={styles.casilla}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: campos.aceptado }}
                    accessibilityLabel={CASILLA_LEGAL}
                  >
                    <Check checked={campos.aceptado} size={24} />
                    <Text style={styles.casillaTexto} maxFontSizeMultiplier={1.6}>
                      {CASILLA_LEGAL}
                    </Text>
                  </Pressable>
                  {/* Los enlaces van fuera de la casilla: dentro, VoiceOver y
                      TalkBack leían la casilla entera y no llegaban a ellos. */}
                  <View style={styles.legalesCasilla}>
                    <EnlaceLegal texto="Términos de NIVL" etiqueta="Términos de NIVL" onPress={() => p.onAbrir(LEGAL_URLS.terminos)} />
                    <EnlaceLegal
                      texto="Privacidad de NIVL"
                      etiqueta="Privacidad de NIVL"
                      onPress={() => p.onAbrir(LEGAL_URLS.privacidad)}
                    />
                  </View>
                </View>
              </>
            ) : null}
          </View>

          {error ? (
            <View accessibilityRole="alert" accessibilityLiveRegion="assertive" style={styles.mensaje}>
              <TarjetaArena variante="trama" rotulo="No ha salido" style={styles.compacta}>
                <Text style={styles.mensajeTexto} maxFontSizeMultiplier={1.6}>
                  {error}
                </Text>
              </TarjetaArena>
            </View>
          ) : null}
          {aviso ? (
            <View accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.mensaje}>
              <TarjetaArena variante="contorno" rotulo="Revisa tu correo" style={styles.compacta}>
                <Text style={styles.mensajeTexto} maxFontSizeMultiplier={1.6}>
                  {aviso}
                </Text>
              </TarjetaArena>
            </View>
          ) : null}

          <Button
            title={BOTON[modo]}
            size="lg"
            onPress={p.onEnviar}
            loading={enviando}
            disabled={!ev.puedeEnviar}
            style={styles.principal}
          />
          {faltaCasilla ? (
            <Text style={styles.faltaCasilla} accessibilityLiveRegion="polite" maxFontSizeMultiplier={1.6}>
              Marca la casilla de Términos para continuar.
            </Text>
          ) : null}

          {portal ? (
            <Text style={styles.nota} maxFontSizeMultiplier={1.6}>
              {OLVIDO_PORTAL}
            </Text>
          ) : modo === 'signin' ? (
            <Button
              title="¿Olvidaste tu contraseña?"
              variant="ghost"
              onPress={() => p.onModo('recover')}
              disabled={enviando}
              style={styles.enlace}
            />
          ) : recuperar ? (
            <Button
              title="Volver a entrar"
              variant="ghost"
              onPress={() => p.onModo('signin')}
              disabled={enviando}
              style={styles.enlace}
            />
          ) : (
            <Text style={styles.nota} maxFontSizeMultiplier={1.6}>
              Tus hábitos, misiones y progreso se guardan en tu cuenta de NIVL.
            </Text>
          )}

          {/* Los textos legales, a la vista antes de entrar. Al crear cuenta
              ya van junto a la casilla. */}
          {alta ? null : (
            <View style={styles.legales}>
              <EnlaceLegal
                texto="Términos de NIVL"
                etiqueta="Términos de uso de NIVL"
                onPress={() => p.onAbrir(LEGAL_URLS.terminos)}
              />
              <Text style={styles.separador}>·</Text>
              <EnlaceLegal
                texto="Privacidad de NIVL"
                etiqueta="Política de privacidad de NIVL"
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

/** El graderío a sangre con la marca y el lema entre laureles. */
function Portada({ lema }: { lema: string }) {
  const [ancho, setAncho] = useState(0);
  const medir = (e: LayoutChangeEvent) => {
    const w = Math.round(e.nativeEvent.layout.width);
    if (w !== ancho) setAncho(w);
  };
  return (
    <View style={styles.portada}>
      <ASangre>
        <View style={styles.escena} onLayout={medir}>
          {ancho > 0 ? (
            <Arena ancho={ancho} alto={ALTO_ARENA} variante="arco" gradas={4} color={ink.ink3} style={styles.arena} />
          ) : null}
          <View style={styles.placa}>
            <Text style={styles.marca} accessibilityRole="header" accessibilityLabel="NIVL" maxFontSizeMultiplier={1}>
              NIVL
            </Text>
          </View>
        </View>
      </ASangre>
      <View style={styles.lema}>
        <Laurel alto={20} lado="izq" />
        <Text
          style={styles.lemaTexto}
          maxFontSizeMultiplier={1.35}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.8}
        >
          {lema}
        </Text>
        <Laurel alto={20} lado="der" />
      </View>
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
  portada: { marginBottom: space.s6 },
  escena: { height: ALTO_ARENA, justifyContent: 'flex-end', alignItems: 'center' },
  arena: { position: 'absolute', left: 0, bottom: 0 },
  // Placa negra bajo la marca: tapa los arranques del graderío detrás de las
  // letras (como en la portada del onboarding).
  placa: { backgroundColor: ink.ink0, paddingHorizontal: space.s3, marginBottom: space.s2 },
  marca: {
    fontFamily: tipo.display.family,
    fontSize: tipo.display.size,
    lineHeight: tipo.display.lineHeight,
    letterSpacing: TRACKING_MARCA,
    // El tracking se suma tras la última letra: el mismo hueco delante centra.
    paddingLeft: TRACKING_MARCA,
    color: ink.ink10,
    textAlign: 'center',
  },
  lema: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.s3,
    marginTop: space.s4,
  },
  lemaTexto: {
    flexShrink: 1,
    fontFamily: tipo.inscripcion.family,
    fontSize: tipo.inscripcion.size,
    lineHeight: tipo.inscripcion.lineHeight,
    letterSpacing: 3,
    color: ink.ink8,
    textAlign: 'center',
  },
  marcaPlegada: {
    fontFamily: tipo.inscripcion.family,
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: tipo.inscripcion.tracking,
    paddingLeft: tipo.inscripcion.tracking,
    color: ink.ink10,
    textAlign: 'center',
    marginBottom: space.s5,
  },
  form: { width: '100%', maxWidth: ANCHO_FORM, alignSelf: 'center' },
  tituloModo: {
    fontFamily: tipo.inscripcion.family,
    fontSize: tipo.inscripcion.size,
    lineHeight: tipo.inscripcion.lineHeight,
    letterSpacing: tipo.inscripcion.tracking,
    color: ink.ink10,
    textAlign: 'center',
    paddingVertical: space.s3,
    borderBottomWidth: stroke.hairline,
    borderBottomColor: ink.ink3,
  },
  pestanas: { flexDirection: 'row', borderBottomWidth: stroke.hairline, borderBottomColor: ink.ink3 },
  pestana: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: stroke.rule,
    borderBottomColor: 'transparent',
    // La regla de la activa pisa el hairline de la fila.
    marginBottom: -stroke.hairline,
  },
  pestanaActiva: { borderBottomColor: ink.ink10 },
  pestanaTexto: {
    fontFamily: tipo.label.family,
    fontSize: tipo.label.size,
    lineHeight: tipo.label.lineHeight,
    letterSpacing: tipo.label.tracking,
    color: ink.ink6,
  },
  pestanaTextoActiva: { color: ink.ink10 },
  intro: {
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink8,
    textAlign: 'center',
    marginTop: space.s4,
  },
  campos: { gap: space.s4, marginTop: space.s5 },
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
