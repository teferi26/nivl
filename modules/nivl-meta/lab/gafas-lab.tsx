// Laboratorio de las gafas: solo en la variante interna. scripts/variante-interna.mjs
// lo copia a src/app/ en un directorio temporal; ninguna pantalla del repo lo importa.
//
// Con ?auto=1 recorre la prueba entera sin tocar nada, para comprobarla con una captura.

import { requireOptionalNativeModule } from 'expo';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { disponible, estado, mostrar, suscribir, tarjetaMision } from '../src';

interface Pintado {
  revision: number;
  textos: string[];
  boton: string | null;
}

interface NivlMetaLab {
  activarMock(): Promise<number>;
  leerPintado(): Promise<Pintado | null>;
  pulsarBoton(): Promise<boolean>;
}

const lab = requireOptionalNativeModule<NivlMetaLab>('NivlMetaLab');

const TARJETA = tarjetaMision([{ id: 'lab-1', titulo: 'Leer 30 minutos' }]);

function detalle(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export default function GafasLab() {
  const { auto } = useLocalSearchParams<{ auto?: string }>();
  const [estadoGafas, setEstadoGafas] = useState('sin leer');
  const [enviada, setEnviada] = useState<boolean | null>(null);
  const [pintado, setPintado] = useState<Pintado | null>(null);
  const [clics, setClics] = useState<string[]>([]);
  const [registro, setRegistro] = useState<string[]>([]);
  const arrancado = useRef(false);

  const anotar = useCallback((linea: string) => {
    setRegistro((previo) => [...previo, linea]);
  }, []);

  useEffect(() => {
    const bajaEstado = suscribir('estado', (d) => setEstadoGafas(d.estado));
    const bajaBoton = suscribir('boton', (d) => setClics((previo) => [...previo, d.tarjetaId]));
    return () => {
      bajaEstado();
      bajaBoton();
    };
  }, []);

  const activar = useCallback(async () => {
    try {
      const puerto = await lab?.activarMock();
      anotar(`mock activo, puerto ${puerto ?? 'sin módulo'}`);
      await new Promise((listo) => setTimeout(listo, 1500));
      setEstadoGafas(await estado());
    } catch (e) {
      anotar(`activar falló: ${detalle(e)}`);
    }
  }, [anotar]);

  const enviar = useCallback(async () => {
    const ok = await mostrar(TARJETA);
    setEnviada(ok);
    anotar(`mostrar: ${ok}`);
    try {
      setPintado((await lab?.leerPintado()) ?? null);
    } catch (e) {
      anotar(`leer falló: ${detalle(e)}`);
    }
  }, [anotar]);

  const pulsar = useCallback(async () => {
    try {
      anotar(`clic inyectado: ${await lab?.pulsarBoton()}`);
    } catch (e) {
      anotar(`clic falló: ${detalle(e)}`);
    }
  }, [anotar]);

  useEffect(() => {
    if (auto !== '1' || arrancado.current) return;
    arrancado.current = true;
    void (async () => {
      await activar();
      await enviar();
      await pulsar();
    })();
  }, [auto, activar, enviar, pulsar]);

  return (
    <ScrollView style={styles.fondo} contentContainerStyle={styles.contenido}>
      <Text style={styles.titulo}>Laboratorio de gafas</Text>
      <Fila clave="Módulo enlazado" valor={String(disponible())} />
      <Fila clave="Módulo de mock" valor={String(lab !== null)} />
      <Fila clave="Estado" valor={estadoGafas} />
      <Fila clave="Envío" valor={enviada === null ? 'sin enviar' : String(enviada)} />
      <Fila clave="Clics recibidos" valor={clics.join(', ') || 'ninguno'} />

      <View style={styles.tarjeta}>
        <Text style={styles.rotulo}>Pantalla del mock (revisión {pintado?.revision ?? 'ninguna'})</Text>
        {(pintado?.textos ?? []).map((texto) => (
          <Text key={texto} style={styles.texto}>
            {texto}
          </Text>
        ))}
        {pintado?.boton ? <Text style={styles.boton}>{pintado.boton}</Text> : null}
      </View>

      <Accion texto="Activar mock" alPulsar={activar} />
      <Accion texto="Mostrar tarjeta" alPulsar={enviar} />
      <Accion texto="Pulsar botón" alPulsar={pulsar} />

      {registro.map((linea, i) => (
        <Text key={`${i}-${linea}`} style={styles.registro}>
          {linea}
        </Text>
      ))}
    </ScrollView>
  );
}

function Fila({ clave, valor }: { clave: string; valor: string }) {
  return (
    <View style={styles.fila}>
      <Text style={styles.clave}>{clave}</Text>
      <Text style={styles.valor}>{valor}</Text>
    </View>
  );
}

function Accion({ texto, alPulsar }: { texto: string; alPulsar: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={alPulsar} style={styles.accion}>
      <Text style={styles.accionTexto}>{texto}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: '#000' },
  contenido: { padding: 16, paddingTop: 72, gap: 10 },
  titulo: { color: '#fff', fontSize: 24, fontWeight: '700', marginBottom: 8 },
  fila: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  clave: { color: '#999', fontSize: 15 },
  valor: { color: '#fff', fontSize: 15, flexShrink: 1, textAlign: 'right' },
  tarjeta: { borderColor: '#fff', borderWidth: 1, padding: 16, gap: 8, marginVertical: 8 },
  rotulo: { color: '#999', fontSize: 13 },
  texto: { color: '#fff', fontSize: 18 },
  boton: { color: '#000', backgroundColor: '#fff', padding: 8, textAlign: 'center', fontWeight: '700' },
  accion: { backgroundColor: '#fff', padding: 14, alignItems: 'center' },
  accionTexto: { color: '#000', fontSize: 16, fontWeight: '700' },
  registro: { color: '#999', fontSize: 13 },
});
