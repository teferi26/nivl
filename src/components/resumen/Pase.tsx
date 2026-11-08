// NIVL · Recuerdos: el pase de la semana, una diapositiva a la vez (FASE3
// Lote F). usePase guarda los efectos de la antigua pantalla (las URL
// firmadas de todas las fotos de golpe, marcar visto al llegar al final y
// compartir la diapositiva como tarjeta `recuerdo` por la capa raíz); PaseVista
// (PaseVista.tsx) es pura y la galería la pinta con datos de mentira.
//
// Cambios de comportamiento pedidos en FASE3:
//   · No avanza solo con «reducir movimiento» ni con el lector de pantalla:
//     se pasa con los toques (o con los botones Anterior y Siguiente del
//     lector). Las barras dicen dónde estás sin moverse.
//   · Mantener pulsado pausa; soltar sigue desde donde iba.
//   · La foto va en una columna de min(ancho, alto·9/16): en una web ancha
//     no se estira; fuera de la columna, negro.
//   · Llegar al final no vibra (se mira, no se gana).

import { File, Paths } from 'expo-file-system';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Platform } from 'react-native';
import { useMovimientoArena } from '@/components/arena/quieto';
import { useCelebracion } from '@/components/celebracion/contexto';
import { leerPuedeCompartirFotos } from '@/components/permisoFotos';
import { avisar } from '@/components/ui/confirmar';
import { t } from '@/i18n';
import { marcarVisto, urlFirmada, type Recap, type Slide } from '@/lib/photos';
import type { Foto, Tarjeta } from '@/lib/sharecard';
import { mensajeSistema } from '@/lib/validation';
import { fotoComoDataWeb } from '@/lib/web/fotoWeb';
import { hayCapaWeb } from '@/components/web/useCapaWeb';
import { PaseVista, type PaseVistaProps } from './PaseVista';
import { eyebrowSlide } from './tipos';

const DURACION_MS = 6000;

/**
 * La foto de evidencia, descargada a caché con una URI local: la tarjeta nunca
 * lleva una URL firmada (caduca en 60 s). Siempre el mismo archivo, que se
 * sobrescribe: no se acumulan fotos de salud en caché. En la web, sin sistema
 * de archivos, va en memoria como `data:`. Si falla, null: el recuerdo se
 * comparte sin foto.
 */
async function fotoLocal(ruta: string, fecha: string): Promise<Foto | null> {
  try {
    const url = await urlFirmada(ruta);
    if (!url) return null;
    if (Platform.OS === 'web') {
      const uri = await fotoComoDataWeb(url);
      return uri ? { uri, fecha } : null;
    }
    const archivo = await File.downloadFileAsync(url, new File(Paths.cache, 'nivl-recuerdo.jpg'), { idempotent: true });
    return { uri: archivo.uri, fecha };
  } catch {
    return null;
  }
}

/** ¿Hay lector de pantalla encendido? Se sigue en vivo. */
function useLectorPantalla(): boolean {
  const [activo, setActivo] = useState(false);
  useEffect(() => {
    let vivo = true;
    AccessibilityInfo.isScreenReaderEnabled()
      .then((v) => {
        if (vivo) setActivo(v);
      })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('screenReaderChanged', setActivo);
    return () => {
      vivo = false;
      sub.remove();
    };
  }, []);
  return activo;
}

/** Los efectos del pase: URL de las fotos, tiempo, pausa, visto y compartir. */
export function usePase(recap: Recap, onSalir: () => void): PaseVistaProps {
  const [i, setI] = useState(0);
  const [compartiendo, setCompartiendo] = useState(false);
  const [pausado, setPausado] = useState(false);
  const { compartir: abrirHoja } = useCelebracion();
  const [urls, setUrls] = useState<Record<string, string>>({});
  const progreso = useRef(new Animated.Value(0)).current;
  const avance = useRef(0);
  const reducido = useMovimientoArena();
  const lector = useLectorPantalla();
  const auto = !reducido && !lector;
  const slides = recap.slides;
  const slide: Slide | undefined = slides[i];

  // Las fotos son privadas: cada una necesita su URL firmada. Se piden todas
  // de golpe al abrir para que el pase no se pare a mitad esperando una.
  useEffect(() => {
    let vivo = true;
    (async () => {
      const rutas = slides.map((s) => s.foto).filter(Boolean) as string[];
      const pares = await Promise.all(
        rutas.map(async (r) => [r, (await urlFirmada(r)) ?? ''] as const),
      );
      if (vivo) setUrls(Object.fromEntries(pares));
    })();
    return () => {
      vivo = false;
    };
  }, [slides]);

  // Diapositiva nueva: la barra vuelve a cero y se quita la pausa. Va antes
  // del efecto del tiempo (React corre los efectos en este orden).
  useEffect(() => {
    avance.current = 0;
    progreso.setValue(0);
    setPausado(false);
  }, [i, progreso]);

  // El tiempo: sigue desde donde iba (tras una pausa, con lo que le quedaba).
  // Sin `auto` no corre: se pasa a mano.
  useEffect(() => {
    if (!auto || pausado) return;
    const resto = Math.max(0, 1 - avance.current);
    const anim = Animated.timing(progreso, {
      toValue: 1,
      duration: DURACION_MS * resto,
      useNativeDriver: false,
    });
    anim.start(({ finished }) => {
      if (!finished) return;
      if (i < slides.length - 1) setI((v) => v + 1);
    });
    return () => {
      anim.stop();
      progreso.stopAnimation((v) => {
        avance.current = v;
      });
    };
  }, [i, auto, pausado, slides.length, progreso]);

  // Llegar al final lo marca como visto. Sin vibración: se mira, no se gana.
  useEffect(() => {
    if (i === slides.length - 1) marcarVisto(recap.id).catch(() => {});
  }, [i, slides.length, recap.id]);

  /**
   * Compartir la diapositiva como tarjeta `recuerdo` en la hoja de compartir
   * de la capa raíz (useCelebracion().compartir: nunca en un Modal, y la cola
   * de celebraciones se pausa mientras está abierta). El texto del coach y la
   * foto salen apagados: los enciende el usuario en la hoja, si quiere.
   * La foto solo se descarga si se pueden compartir fotos (18+ y salud): sin
   * permiso, ni siquiera llega a la caché.
   */
  const compartir = async () => {
    if (compartiendo || !slide) return;
    setCompartiendo(true);
    try {
      const foto =
        slide.foto && (await leerPuedeCompartirFotos()) ? await fotoLocal(slide.foto, recap.period_start) : null;
      const tarjeta: Tarjeta = {
        tipo: 'recuerdo',
        etiqueta: eyebrowSlide(slide.tipo),
        dato: slide.dato ?? null,
        titulo: slide.titulo,
        texto: slide.texto || null,
        foto,
      };
      abrirHoja(tarjeta);
    } catch (e) {
      avisar(t('resumen:pase.noCompartir'), mensajeSistema(e));
    } finally {
      setCompartiendo(false);
    }
  };

  // Teclado en la web: flechas para pasar, Escape para salir.
  const teclas = useRef({ anterior: () => {}, siguiente: () => {}, salir: onSalir });
  teclas.current = {
    anterior: () => setI((v) => Math.max(0, v - 1)),
    siguiente: () => (i < slides.length - 1 ? setI((v) => v + 1) : onSalir()),
    salir: onSalir,
  };
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const alPulsar = (e: KeyboardEvent) => {
      // Con la hoja de compartir encima, las flechas no pasan las diapositivas de debajo.
      if (hayCapaWeb()) return;
      const accion = e.key === 'ArrowLeft' ? teclas.current.anterior : e.key === 'ArrowRight' ? teclas.current.siguiente : e.key === 'Escape' ? teclas.current.salir : null;
      if (!accion) return;
      e.preventDefault();
      accion();
    };
    document.addEventListener('keydown', alPulsar);
    return () => document.removeEventListener('keydown', alPulsar);
  }, []);

  return {
    recap,
    i,
    foto: slide?.foto ? urls[slide.foto] : undefined,
    progreso,
    auto,
    pausado,
    compartiendo,
    onAnterior: () => setI((v) => Math.max(0, v - 1)),
    onSiguiente: () => (i < slides.length - 1 ? setI((v) => v + 1) : onSalir()),
    onPausar: () => setPausado(true),
    onSeguir: () => setPausado(false),
    onCompartir: compartir,
    onSalir,
  };
}

/** El pase montado: efectos + vista. */
export function Pase({ recap, onSalir }: { recap: Recap; onSalir: () => void }) {
  return <PaseVista {...usePase(recap, onSalir)} />;
}
