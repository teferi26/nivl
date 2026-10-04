// NIVL · Cardio: datos, efectos y cerrojos (patrón L-RADICAL §C, FASE3 Lote
// E1). Cortado y pegado de la ruta sin reescribir la lógica del XP (bloque B,
// src/lib/pagoActo.ts): la corrección no vuelve a premiar, el tope diario, la
// misión enlazada que descuenta solo a la primera sesión del día que la marca,
// el pago de lo que entró de verdad, la vibración solo si entró algo y el
// anuncio de lo pagado. Devuelve las props de CardioVista y de la hoja.
//
// Cambios de presentación (no de lógica):
//   · Lo que antes eran avisos con la hoja abierta (faltan minutos, distancia
//     o RPE fuera de rango, fallo del servidor) va en línea dentro de la hoja.
//   · El anuncio «Sesión registrada» ya no es un Alert justo cuando la hoja se
//     cierra (en iOS se pierde si coincide con la salida del Modal): el mismo
//     texto de anuncioCardio va en una tarjeta bajo el encabezado y se lee al
//     lector de pantalla.
//   · La carga deja huecos y su fallo va en línea con «Reintentar».

import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import { avisar, confirmar } from '@/components/ui/confirmar';
import { volver } from '@/components/ui/Screen';
import { vibrar } from '@/design/haptics';
import { useAuth } from '@/lib/auth';
import {
  cardioDayState,
  deleteCardio,
  fetchCardio,
  saveCardio,
  type CardioKind,
  type CardioSession,
  type CardioZone,
} from '@/lib/bodywork';
import { ensureProfile } from '@/lib/data';
import { addDays, dateKey } from '@/lib/dates';
import { awardXp } from '@/lib/engine';
import { CARDIO_DAILY_CAP, cardioXp } from '@/lib/game';
import { propagarActo } from '@/lib/links';
import { anuncioCardio, pagoDelModulo, primeraSesionQuePropaga, xpPagado } from '@/lib/pagoActo';
import { mensajeSistema } from '@/lib/validation';
import type { AnuncioCardio, CardioVistaProps } from './CardioVista';
import type { ErroresCardio, HojaCardioProps } from './HojaCardio';

export interface UseCardio {
  vista: CardioVistaProps;
  hoja: HojaCardioProps;
}

const SIN_ERRORES: ErroresCardio = { duracion: null, distancia: null, rpe: null, servidor: null };

export function useCardio(): UseCardio {
  const { session } = useAuth();
  const userId = session?.user.id;

  const [sesiones, setSesiones] = useState<CardioSession[]>([]);
  const [abierto, setAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const [kind, setKind] = useState<CardioKind>('correr');
  const [zone, setZone] = useState<CardioZone>('Z2');
  const [distancia, setDistancia] = useState('');
  const [duracion, setDuracion] = useState('');
  const [pulso, setPulso] = useState('');
  const [rpe, setRpe] = useState('');
  const [notas, setNotas] = useState('');

  // Presentación: huecos hasta la primera carga buena, fallos en línea y el
  // anuncio de lo pagado en la pantalla.
  const [cargado, setCargado] = useState(false);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [errores, setErrores] = useState<ErroresCardio>(SIN_ERRORES);
  const [anuncio, setAnuncio] = useState<AnuncioCardio | null>(null);

  const cargar = useCallback(async () => {
    try {
      setSesiones(await fetchCardio(addDays(dateKey(), -56)));
      setErrorCarga(null);
      setCargado(true);
    } catch (e) {
      setErrorCarga(mensajeSistema(e));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar]),
  );

  const limpiar = () => {
    setDistancia('');
    setDuracion('');
    setPulso('');
    setRpe('');
    setNotas('');
  };

  const abrir = () => {
    setErrores(SIN_ERRORES);
    setAnuncio(null);
    setAbierto(true);
  };

  const cerrar = () => {
    setErrores(SIN_ERRORES);
    setAbierto(false);
  };

  const guardar = async () => {
    if (!userId || guardando) return;
    const min = Number(duracion.replace(',', '.'));
    if (!min || min <= 0) {
      setErrores({ ...SIN_ERRORES, duracion: 'Falta la duración. Sin minutos no hay sesión que registrar.' });
      return;
    }
    const km = distancia.trim() ? Number(distancia.replace(',', '.')) : null;
    if (km !== null && (!Number.isFinite(km) || km <= 0)) {
      setErrores({ ...SIN_ERRORES, distancia: 'Escribe los kilómetros con números, por ejemplo 5,2.' });
      return;
    }
    const esfuerzo = rpe.trim() ? Number(rpe.replace(',', '.')) : null;
    if (esfuerzo !== null && (esfuerzo < 1 || esfuerzo > 10)) {
      setErrores({ ...SIN_ERRORES, rpe: 'El esfuerzo va de 1 a 10.' });
      return;
    }
    setErrores(SIN_ERRORES);

    setGuardando(true);
    try {
      const hoy = dateKey();
      // Dos reglas a la vez: corregir una sesión ya registrada no vuelve a
      // premiar (y conserva lo que pagó en su día, o el tope se recalcularía
      // mal), y el total del día no puede pasar de CARDIO_DAILY_CAP.
      const { pagadoHoy, pagadoEsteTipo, tiposHoy } = await cardioDayState(hoy, kind);
      const esCorreccion = pagadoEsteTipo !== null;

      const base = esCorreccion ? 0 : cardioXp(kind, pagadoHoy);
      const fila = {
        date: hoy,
        kind,
        distance_km: km,
        duration_min: min,
        avg_hr: pulso.trim() ? Number(pulso) : null,
        rpe: esfuerzo,
        zone,
        notes: notas.trim() || null,
      };
      // Primero se guarda el acto; si la misión enlazada paga parte, la fila se
      // corrige después (de `xp` sale el tope diario, tiene que ser exacto).
      await saveCardio(userId, { ...fila, xp: esCorreccion ? pagadoEsteTipo : base });

      // Un solo gesto: con la sesión guardada se marcan solas la misión, la
      // regla y el bloque aeróbico. Caminar no: un paseo no salda un "Correr
      // 5 km". La misión descuenta solo a la PRIMERA sesión del día que la
      // marca: la doble sesión real sigue cobrando lo suyo, con el tope de
      // siempre. Antes se miraba `pagadoHoy === 0`, y como la primera sesión
      // descontada guarda 0 XP, la segunda volvía a perder la misión.
      const primera = primeraSesionQuePropaga(tiposHoy);
      const eco =
        !esCorreccion && kind !== 'caminar'
          ? await propagarActo(await ensureProfile(userId), 'cardio', hoy)
          : null;
      const nuevo = esCorreccion ? 0 : pagoDelModulo(base, eco, primera);

      // Se paga `nuevo`, nunca `xp`: `xp` solo conserva en la fila lo que ya se
      // cobró en su momento. Y se apunta lo PAGADO (el servidor recorta por
      // topes): de `xp` sale el tope diario de cardio.
      let pagado = 0;
      if (nuevo > 0) {
        const perfil = await ensureProfile(userId);
        const res = await awardXp(perfil, nuevo, 'FUE', 'cardio_session', { kind, km, min, zone });
        pagado = xpPagado(nuevo, perfil.xp_total, res.profile.xp_total);
      }
      // Vibra solo lo que entró de verdad: la misión enlazada y lo pagado por
      // el módulo. Una corrección o un día ya en el tope no vibran.
      if ((eco?.xp ?? 0) + pagado > 0) vibrar('mision');
      if (!esCorreccion && pagado !== base) await saveCardio(userId, { ...fila, xp: pagado });

      setAbierto(false);
      limpiar();
      await cargar();
      // Lo que entró de verdad: la misión enlazada marcada ahora y lo que pagó
      // el módulo. Si no entró nada, por qué. En la pantalla, no en un Alert:
      // la hoja acaba de cerrarse.
      const texto = anuncioCardio({
        xpMision: eco?.xp ?? 0,
        marcadas: eco?.marcadas ?? [],
        xpModulo: pagado,
        pedidoModulo: nuevo,
        misionYaPagada: primera && (eco?.xpMisiones ?? 0) > 0,
        esCorreccion,
        topeDiario: CARDIO_DAILY_CAP,
      });
      setAnuncio({ texto, pagado: (eco?.xp ?? 0) + pagado > 0 });
      AccessibilityInfo.announceForAccessibility(`Sesión registrada. ${texto}`);
    } catch (e) {
      // Con la hoja abierta: el fallo va dentro de ella, con lo escrito intacto.
      setErrores({ ...SIN_ERRORES, servidor: mensajeSistema(e) });
      vibrar('penalizacion');
    } finally {
      setGuardando(false);
    }
  };

  const borrar = async (s: CardioSession) => {
    const ok = await confirmar({
      titulo: 'Eliminar sesión',
      mensaje: `${s.kind} del ${s.date}`,
      confirmar: 'Eliminar',
      destructivo: true,
    });
    if (!ok) return;
    vibrar('destructiva');
    try {
      await deleteCardio(s.id);
    } catch (e) {
      // Antes el fallo se tragaba y la sesión seguía ahí sin explicación.
      avisar('Error del sistema', mensajeSistema(e));
      return;
    }
    await cargar();
  };

  /** Escribir en un campo con error lo limpia: el aviso era de lo de antes. */
  const conLimpieza = (campo: keyof ErroresCardio, set: (v: string) => void) => (v: string) => {
    set(v);
    if (errores[campo]) setErrores((prev) => ({ ...prev, [campo]: null }));
  };

  return {
    vista: {
      cargado,
      errorCarga,
      hoy: dateKey(),
      sesiones,
      anuncio,
      acciones: {
        onVolver: () => volver(router),
        onReintentar: () => {
          cargar();
        },
        onRegistrar: abrir,
        onBorrar: borrar,
        onCerrarAnuncio: () => setAnuncio(null),
      },
    },
    hoja: {
      visible: abierto,
      kind,
      zone,
      duracion,
      distancia,
      rpe,
      pulso,
      notas,
      guardando,
      errores,
      onKind: setKind,
      onZone: setZone,
      onDuracion: conLimpieza('duracion', setDuracion),
      onDistancia: conLimpieza('distancia', setDistancia),
      onRpe: conLimpieza('rpe', setRpe),
      onPulso: setPulso,
      onNotas: setNotas,
      onGuardar: guardar,
      onCerrar: cerrar,
    },
  };
}
