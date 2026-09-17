import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '@/lib/theme';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
  stack: string | null;
}

// Red de seguridad de toda la app. Sin esto, cualquier excepción de render
// deja la pantalla en negro sin una sola pista, que es exactamente lo que pasa
// cuando la app corre desde TestFlight y no hay consola donde mirar.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, stack: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.setState({ stack: info.componentStack ?? null });
    // Queda en los registros del dispositivo; con Sentry conectado, también allí.
    console.error('Fallo no capturado:', error, info.componentStack);
  }

  reintentar = () => this.setState({ error: null, stack: null });

  render() {
    const { error, stack } = this.state;
    if (!error) return this.props.children;

    return (
      <View style={styles.screen}>
        <ScrollView contentContainerStyle={styles.contenido}>
          <Text style={styles.titulo}>EL SISTEMA HA FALLADO</Text>
          <Text style={styles.texto}>
            Algo se ha roto por dentro. Tus datos están a salvo: viven en el servidor, no en esta
            pantalla.
          </Text>
          <View style={styles.caja}>
            <Text style={styles.mensaje}>{error.message || String(error)}</Text>
            {stack ? (
              <Text style={styles.stack} numberOfLines={12}>
                {stack.trim()}
              </Text>
            ) : null}
          </View>
          <Pressable onPress={this.reintentar} style={styles.boton} accessibilityRole="button">
            <Text style={styles.botonTexto}>REINTENTAR</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  contenido: { padding: 24, paddingTop: 80 },
  titulo: {
    fontFamily: fonts.heading,
    fontSize: 16,
    letterSpacing: 3,
    color: colors.red,
    marginBottom: 12,
  },
  texto: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 21,
    color: colors.text,
    marginBottom: 18,
  },
  caja: {
    borderWidth: 1,
    borderColor: colors.redDim,
    backgroundColor: colors.redPanel,
    padding: 12,
    marginBottom: 20,
  },
  mensaje: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: colors.red,
    marginBottom: 8,
  },
  stack: {
    fontFamily: fonts.body,
    fontSize: 11,
    lineHeight: 15,
    color: colors.textDim,
  },
  boton: {
    borderWidth: 1.5,
    borderColor: colors.accent,
    paddingVertical: 12,
    alignItems: 'center',
  },
  botonTexto: {
    fontFamily: fonts.heading,
    fontSize: 14,
    letterSpacing: 2,
    color: colors.accent,
  },
});
