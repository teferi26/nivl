// NIVL · Diario: datos, efectos y cerrojos (patrón L-RADICAL §C, FASE3 Lote D).
// Cortado y pegado de la ruta sin reescribir la lógica: el borrador y el
// estado «sucio», el turno de carga, el XP del día en caliente, las fotos de
// evidencia y las vibraciones. Devuelve las props de DiarioVista.

import * as ImagePicker from 'expo-image-picker';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Linking, Platform, type ScrollView } from 'react-native';
import { avisar, confirmar } from '@/components/ui/confirmar';
import { volver } from '@/components/ui/Screen';
import { vibrar } from '@/design/haptics';
import { evaluateAchievements, unlockAchievements } from '@/lib/achievements';
import { useAuth } from '@/lib/auth';
import {
  deleteJournalPhoto,
  fetchJournalPhotos,
  fetchJournalPhotosForDates,
  journalPhotoUrl,
  uploadJournalPhoto,
} from '@/lib/contract';
import { ensureProfile } from '@/lib/data';
import { addDays, dateKey } from '@/lib/dates';
import { awardXp } from '@/lib/engine';
import { JOURNAL_XP } from '@/lib/game';
import {
  countEntries,
  fetchEntriesForDates,
  fetchEntryForDate,
  fetchEventsForDate,
  fetchRecentEntries,
  promptForDate,
  upsertEntry,
} from '@/lib/journal';
import { MAX_VICTORIAS, completitud, entradaVacia, fechasFlashback, limpiarVictorias } from '@/lib/journalmath';
import { propagarActo, restoDelModulo } from '@/lib/links';
import type { JournalEntry, JournalPhoto } from '@/lib/types';
import { mensajeSistema } from '@/lib/validation';
import { deMisiones, desgloseXp } from '@/lib/voice';
import { lineaDeCronica, type LineaCronica } from './Cronica';
import type { DiarioVistaProps, FotoDiario, Segmento } from './DiarioVista';

/** Entradas que estudia el Archivo: dos meses dan tendencia sin traer la vida entera. */
const RECIENTES = 60;

export function useDiario(): DiarioVistaProps {
  const { session } = useAuth();
  const userId = session?.user.id;
  const today = dateKey();

  const [segmento, setSegmento] = useState<Segmento>('escribir');

  const [mood, setMood] = useState<number | null>(null);
  const [energy, setEnergy] = useState<number | null>(null);
  const [emotions, setEmotions] = useState<string[]>([]);
  const [sleep, setSleep] = useState<number | null>(null);
  const [wins, setWins] = useState<string[]>(['']);
  const [text, setText] = useState('');
  const [lesson, setLesson] = useState('');
  const [gratitude, setGratitude] = useState('');
  const [plan, setPlan] = useState('');
  const [photos, setPhotos] = useState<FotoDiario[]>([]);
  // El día que se está escribiendo. No siempre es hoy: se puede retroceder
  // para completar o corregir lo de días pasados.
  const [dia, setDia] = useState(today);
  const [registrado, setRegistrado] = useState(false);
  const [sucio, setSucio] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [chronicle, setChronicle] = useState<LineaCronica[]>([]);
  const [aviso, setAviso] = useState<string | null>(null);
  // Fallo del guardado, en línea sobre el botón (lo escrito sigue en pantalla).
  const [errorGuardado, setErrorGuardado] = useState<string | null>(null);
  // Fallo al cargar el día: la vista no enseña el formulario ni el pie, así
  // que una entrada existente nunca se guarda encima con todo en blanco.
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const saving = useRef(false);
  // Espejo síncrono de `sucio`: al volver a la pantalla o al refrescar no se
  // recarga el día si hay algo a medio escribir (antes se perdía sin avisar).
  const sucioRef = useRef(false);
  // Turno de carga: al pasar de día deprisa, una respuesta vieja no pisa a la nueva.
  const turno = useRef(0);
  const scroll = useRef<ScrollView>(null);

  const [recent, setRecent] = useState<JournalEntry[]>([]);
  const [recuerdos, setRecuerdos] = useState<JournalEntry[]>([]);
  const [photoCounts, setPhotoCounts] = useState<Map<string, number>>(new Map());
  const [archivoLoaded, setArchivoLoaded] = useState(false);
  const fotosPorDia = useRef(new Map<string, JournalPhoto[]>());
  const urlsPorDia = useRef(new Map<string, Promise<string[]>>());

  const marcar = () => {
    sucioRef.current = true;
    setSucio(true);
    setAviso(null);
    setErrorGuardado(null);
  };

  const loadDia = useCallback(async () => {
    const mio = ++turno.current;
    try {
      const start = new Date(`${dia}T00:00:00`);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      const [entry, dayPhotos, events] = await Promise.all([
        fetchEntryForDate(dia),
        fetchJournalPhotos(dia),
        fetchEventsForDate(start.toISOString(), end.toISOString()),
      ]);
      const conUrl = await Promise.all(
        dayPhotos.map(async (photo) => ({ photo, url: await journalPhotoUrl(photo.path) })),
      );
      if (mio !== turno.current) return;
      // Siempre se reinicia: al cambiar de día, si no se limpiara, quedaría en
      // pantalla lo escrito del día anterior y se guardaría en el equivocado.
      setMood(entry?.mood ?? null);
      setEnergy(entry?.energy ?? null);
      setEmotions(entry?.emotions ?? []);
      setSleep(entry?.sleep_hours ?? null);
      setWins(entry?.wins.length ? entry.wins : ['']);
      setText(entry?.text ?? '');
      setLesson(entry?.lesson ?? '');
      setGratitude(entry?.gratitude ?? '');
      setPlan(entry?.plan ?? '');
      setRegistrado(!!entry);
      sucioRef.current = false;
      setSucio(false);
      setPhotos(conUrl);
      setChronicle(events.map(lineaDeCronica).filter((l): l is LineaCronica => l !== null));
      // El error se quita solo con el día ya en pantalla: mientras tanto el
      // formulario (vacío o de otro día) no se enseña ni se puede guardar.
      setErrorCarga(null);
    } catch (e) {
      if (mio === turno.current) setErrorCarga(mensajeSistema(e));
    } finally {
      if (mio === turno.current) setLoaded(true);
    }
  }, [dia]);

  const loadArchivo = useCallback(async () => {
    try {
      const hoy = dateKey();
      const [entries, viejas] = await Promise.all([
        fetchRecentEntries(RECIENTES),
        fetchEntriesForDates(Object.values(fechasFlashback(hoy))),
      ]);
      // Una sola consulta para saber qué días tienen fotos; las URL firmadas
      // se piden después, tarjeta a tarjeta y solo si se van a ver.
      const fotos = await fetchJournalPhotosForDates(entries.map((e) => e.date));
      const porDia = new Map<string, JournalPhoto[]>();
      for (const f of fotos) porDia.set(f.date, [...(porDia.get(f.date) ?? []), f]);
      fotosPorDia.current = porDia;
      urlsPorDia.current = new Map();
      setPhotoCounts(new Map([...porDia].map(([d, l]) => [d, l.length])));
      setRecent(entries);
      setRecuerdos(viejas);
    } catch {
      // El Archivo es lectura: si falla, se queda lo que hubiera y escribir sigue funcionando.
    } finally {
      setArchivoLoaded(true);
    }
  }, []);

  const loadPhotos = useCallback((date: string): Promise<string[]> => {
    const ya = urlsPorDia.current.get(date);
    if (ya) return ya;
    const pedido = Promise.all((fotosPorDia.current.get(date) ?? []).map((f) => journalPhotoUrl(f.path))).then(
      (urls) => urls.filter((u): u is string => !!u),
    );
    urlsPorDia.current.set(date, pedido);
    return pedido;
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!sucioRef.current) loadDia();
    }, [loadDia]),
  );

  useFocusEffect(
    useCallback(() => {
      loadArchivo();
    }, [loadArchivo]),
  );

  const refrescar = async () => {
    setRefreshing(true);
    await Promise.all([sucioRef.current ? Promise.resolve() : loadDia(), loadArchivo()]);
    setRefreshing(false);
  };

  /** Cambiar de día tira lo no guardado: se pregunta una vez, no se pierde en silencio. */
  const irADia = async (next: string, alEscribir = false) => {
    const ir = () => {
      sucioRef.current = false;
      setSucio(false);
      setAviso(null);
      setErrorGuardado(null);
      if (next !== dia) {
        setLoaded(false);
        setErrorCarga(null);
        setDia(next);
      }
      if (alEscribir) setSegmento('escribir');
      scroll.current?.scrollTo({ y: 0, animated: false });
    };
    if (!sucioRef.current || next === dia) return ir();
    const descartar = await confirmar({
      titulo: 'Cambios sin guardar',
      mensaje: 'Si cambias de día se pierde lo que has escrito.',
      confirmar: 'Descartar',
      cancelar: 'Seguir escribiendo',
      destructivo: true,
    });
    if (descartar) ir();
  };

  const addPhoto = async () => {
    if (!userId || saving.current) return;
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      const mensaje = 'El sistema necesita la cámara para los comprobantes del diario.';
      if (Platform.OS === 'web') {
        avisar('Sin cámara', mensaje);
      } else if (await confirmar({ titulo: 'Sin cámara', mensaje, confirmar: 'Abrir ajustes' })) {
        Linking.openSettings().catch(() => {});
      }
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.4,
      base64: true,
    });
    if (result.canceled) return;
    const b64 = result.assets[0]?.base64;
    if (!b64) return;
    saving.current = true;
    try {
      const photo = await uploadJournalPhoto(userId, dia, b64);
      const url = await journalPhotoUrl(photo.path);
      setPhotos((prev) => [...prev, { photo, url }]);
      vibrar('misionExtra');
      loadArchivo();
    } catch (e) {
      avisar('El sistema no responde', mensajeSistema(e));
    } finally {
      saving.current = false;
    }
  };

  const removePhoto = async (item: FotoDiario) => {
    const ok = await confirmar({
      titulo: 'Eliminar comprobante',
      mensaje: '¿Borrar esta foto del diario?',
      confirmar: 'Eliminar',
      destructivo: true,
    });
    if (!ok) return;
    try {
      // La foto sale de la pantalla solo si se ha borrado de verdad.
      await deleteJournalPhoto(item.photo);
      setPhotos((prev) => prev.filter((p) => p.photo.id !== item.photo.id));
      // Borrado confirmado (FASE3, tabla de vibraciones).
      vibrar('destructiva');
      loadArchivo();
    } catch (e) {
      avisar('El sistema no responde', mensajeSistema(e));
    }
  };

  /** Lo que se guardaría ahora mismo: de aquí salen la completitud y el guardado. */
  const borrador = useMemo(
    () => ({
      mood,
      energy,
      emotions,
      sleep_hours: sleep,
      wins: limpiarVictorias(wins),
      text: text.trim() || null,
      lesson: lesson.trim() || null,
      gratitude: gratitude.trim() || null,
      plan: plan.trim() || null,
    }),
    [mood, energy, emotions, sleep, wins, text, lesson, gratitude, plan],
  );
  const hecho = completitud(borrador);

  const reclamadas = useMemo(() => new Set(borrador.wins.map((w) => w.toLocaleLowerCase('es'))), [borrador.wins]);
  const cabenMas = borrador.wins.length < MAX_VICTORIAS;

  /** Lo que el sistema vio pasa a ser algo que él reclama: ocupa la primera fila vacía. */
  const reclamar = (victoria: string) => {
    if (!cabenMas || reclamadas.has(victoria.toLocaleLowerCase('es'))) return;
    vibrar('seleccion');
    const hueco = wins.findIndex((w) => !w.trim());
    setWins(hueco >= 0 ? wins.map((w, i) => (i === hueco ? victoria : w)) : [...wins, victoria]);
    marcar();
  };

  const save = async () => {
    // Cerrojo síncrono: dos toques rápidos ya no insertan dos entradas ni duplican XP.
    if (!userId || busy || saving.current || errorCarga) return;
    // Una entrada en blanco no es un cierre: ni ocupa el archivo ni cobra XP.
    if (entradaVacia(borrador)) {
      setAviso(
        photos.length > 0
          ? 'Tus fotos ya están guardadas. Para registrar el día, responde al menos una pregunta.'
          : 'Aún no hay nada que registrar. Responde al menos una pregunta; las demás pueden esperar.',
      );
      return;
    }
    saving.current = true;
    setBusy(true);
    setAviso(null);
    setErrorGuardado(null);
    try {
      const { isNew } = await upsertEntry(userId, { date: dia, ...borrador });
      // El XP solo se paga por escribir el día en caliente: hoy o ayer. Rellenar
      // dos semanas de golpe completaría el archivo igual, pero no debe pagar
      // 20 entradas de una sentada: eso convierte la reflexión en granja.
      const enCaliente = dia === dateKey() || dia === addDays(dateKey(), -1);
      if (isNew && enCaliente) {
        const profile = await ensureProfile(userId);
        // Un solo gesto: escribir el día marca sola la misión del diario. Solo
        // hoy (una misión no se completa con fecha de ayer), y si la había paga
        // ella: el módulo no vuelve a cobrar por lo mismo.
        const eco = dia === dateKey() ? await propagarActo(profile, 'diario', dia) : null;
        const resto = restoDelModulo(JOURNAL_XP, eco);
        if (resto > 0) {
          await awardXp(eco?.profile ?? profile, resto, 'PER', 'journal_entry', { date: dia });
        }
        // El desglose cuadra con lo que luego enseña la misión enlazada
        // (+15 en el aviso frente a +10 en la misión era 10 + 5 sin decirlo).
        const desglose = desgloseXp([
          { xp: eco?.xp ?? 0, de: deMisiones(eco?.marcadas ?? []) },
          { xp: resto, de: 'a PER por el diario' },
        ]);
        const total = await countEntries();
        const fresh = await unlockAchievements(userId, evaluateAchievements({ journalCount: total }));
        // Guardar con XP (FASE3, tabla de vibraciones).
        vibrar('mision');
        avisar(
          'Entrada registrada',
          `${desglose || 'La misión del diario ya estaba marcada y pagada.'}${fresh.length > 0 ? `\nLogro: ${fresh.map((a) => a.name).join(', ')}` : ''}`,
        );
      }
      // Guardar sin XP no vibra (FASE3): ni el día atrasado ni los cambios.
      if (isNew && !(dia === dateKey() || dia === addDays(dateKey(), -1))) {
        avisar('Entrada registrada', 'Día completado en tu archivo. Sin XP: solo lo paga el día en caliente.');
      }
      if (!isNew) {
        setAviso('Cambios guardados.');
      }
      setRegistrado(true);
      await Promise.all([loadDia(), loadArchivo()]);
    } catch (e) {
      // Fallo de la acción principal: en línea, sobre el botón, y con su vibración.
      vibrar('penalizacion');
      setErrorGuardado(`${mensajeSistema(e)} Tus respuestas siguen aquí.`);
    } finally {
      saving.current = false;
      setBusy(false);
    }
  };

  const cambiarSegmento = (s: Segmento) => {
    if (s === segmento) return;
    setSegmento(s);
    scroll.current?.scrollTo({ y: 0, animated: false });
  };

  return {
    segmento,
    hoy: today,
    dia,
    cargado: loaded,
    registrado,
    sucio,
    ocupado: busy,
    refrescando: refreshing,
    aviso,
    errorGuardado,
    errorCarga,
    xp: JOURNAL_XP,
    pista: promptForDate(dia),
    respuestas: { mood, energy, emotions, sleep, wins, text, lesson, gratitude, plan },
    hecho,
    reclamadas,
    cabenMas,
    fotos: photos,
    cronica: chronicle,
    archivo: { cargado: archivoLoaded, entries: recent, recuerdos, photoCounts, loadPhotos },
    scrollRef: scroll,
    acciones: {
      onVolver: () => volver(router),
      onSegmento: cambiarSegmento,
      onIrADia: irADia,
      onMood: (n) => {
        setMood(n);
        marcar();
      },
      onEnergy: (n) => {
        setEnergy(n);
        marcar();
      },
      onEmotions: (next) => {
        setEmotions(next);
        marcar();
      },
      onSleep: (next) => {
        setSleep(next);
        marcar();
      },
      onWins: (next) => {
        setWins(next);
        marcar();
      },
      onText: (v) => {
        setText(v);
        marcar();
      },
      onLesson: (v) => {
        setLesson(v);
        marcar();
      },
      onGratitude: (v) => {
        setGratitude(v);
        marcar();
      },
      onPlan: (v) => {
        setPlan(v);
        marcar();
      },
      onReclamar: reclamar,
      onAnadirFoto: addPhoto,
      onQuitarFoto: removePhoto,
      onGuardar: save,
      onRefrescar: refrescar,
      onReintentarCarga: () => {
        // Huecos mientras se reintenta, nunca el formulario sin datos.
        setErrorCarga(null);
        setLoaded(false);
        void loadDia();
      },
    },
  };
}
