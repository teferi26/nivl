import { Component, type ErrorInfo, type ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/ui/Button';
// La galea es `Crown` (arena/Motivos la reexporta como Galea). Se importa
// directa: la red de seguridad carga lo mínimo.
import { Crown as Galea } from '@/components/ui/Crown';
import { ink, space, stroke, type as tipo } from '@/design/tokens';

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
// v2 (FASE3 Lote 0): tokens ink, galea de 48, rótulo grabado y Button primary
// (la única acción de la pantalla). La lógica no cambia.
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
          <View style={styles.galea} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Galea kind="casco" size={48} color={ink.ink6} />
          </View>
          <Text style={styles.titulo} accessibilityRole="header">
            EL SISTEMA HA FALLADO
          </Text>
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
          <Button title="Reintentar" icon="refresh" size="lg" onPress={this.reintentar} />
        </ScrollView>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: ink.ink0 },
  contenido: { padding: space.s6, paddingTop: space.s20, width: '100%', maxWidth: 560, alignSelf: 'center' },
  galea: { marginBottom: space.s5 },
  titulo: {
    fontFamily: tipo.inscripcion.family,
    fontSize: tipo.inscripcion.size,
    lineHeight: tipo.inscripcion.lineHeight,
    letterSpacing: tipo.inscripcion.tracking,
    color: ink.ink10,
    marginBottom: space.s3,
  },
  texto: {
    fontFamily: tipo.body.family,
    fontSize: tipo.body.size,
    lineHeight: tipo.body.lineHeight,
    color: ink.ink8,
    marginBottom: space.s5,
  },
  caja: {
    borderWidth: stroke.hairline,
    borderColor: ink.ink4,
    backgroundColor: ink.ink1,
    padding: space.s3,
    marginBottom: space.s6,
  },
  mensaje: {
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink9,
    marginBottom: space.s2,
  },
  stack: {
    fontFamily: tipo.micro.family,
    fontSize: tipo.micro.size,
    lineHeight: 15,
    color: ink.ink6,
  },
});
