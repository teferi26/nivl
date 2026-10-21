// NIVL · FOCUS: las hojas de las tres pestañas y lo que guardan (efectos).
//
// Una sola hoja abierta a la vez. Pasar de una a otra espera a que la primera
// se cierre (en iOS, presentar un Modal encima de otro que se va no abre nada).
// Guardar va por `hacer` (useFocusDatos): cerrojo, fallo en voz del sistema y
// relectura. Nada de aquí paga XP.

import { router } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { confirmar } from '@/components/ui';
import { vibrar } from '@/design/haptics';
import * as F from '@/focus/datos';
import { diasEntre } from '@/focus/fechas';
import { metodoPorId, type IdMetodo, type Metodo } from '@/focus/metodos';
import { notasPorAsignatura, planDeExamen, temasDeAsignatura, temasDeExamen } from '@/focus/resumen';
import { pendientesDeHoy, type Resultado } from '@/focus/repaso';
import { siguienteEstado, type Nota, type Tema } from '@/focus/tipos';
import { t } from '@/i18n';
import type { UsePomodoro } from './usePomodoro';
import type { UseFocusDatos } from './useFocusDatos';
import {
  HojaAjustes,
  HojaAsignatura,
  HojaClase,
  HojaDetalleExamen,
  HojaExamen,
  HojaMazo,
  HojaMetodo,
  HojaMision,
  HojaNoMolestar,
  HojaNota,
  HojaNotasAsignatura,
  HojaRepaso,
  HojaTarjeta,
  HojaTemas,
  type ItemRepaso,
} from './HojasFocus';

type Hoja =
  | { tipo: 'asignatura' }
  | { tipo: 'temas'; asignaturaId: string; examenId: string | null }
  | { tipo: 'examen'; asignaturaId: string | null }
  | { tipo: 'detalle'; examenId: string }
  | { tipo: 'clase'; dia: number }
  | { tipo: 'nota'; asignaturaId: string | null }
  | { tipo: 'notas'; asignaturaId: string }
  | { tipo: 'mazo' }
  | { tipo: 'tarjeta'; mazoId: string | null }
  | { tipo: 'repaso'; items: ItemRepaso[] }
  | { tipo: 'metodo'; id: IdMetodo }
  | { tipo: 'ajustes' }
  | { tipo: 'mision' }
  | { tipo: 'noMolestar' };

const ESPERA_CIERRE = 420;

export interface OpcionesHojas {
  datos: UseFocusDatos;
  hoy: string;
  pomodoro?: UsePomodoro;
  misiones?: { id: string; titulo: string; xp: number; hecha: boolean; penalizacion: boolean }[];
  /** Estudiar algo ya: deja el bloque apuntado a ese tema y va a Hoy. */
  onEstudiar?: (asignaturaId: string, temaId: string | null) => void;
}

export function useHojasFocus({ datos: fd, hoy, pomodoro, misiones, onEstudiar }: OpcionesHojas) {
  const [hoja, setHoja] = useState<Hoja | null>(null);
  const [visible, setVisible] = useState(false);
  const reloj = useRef<ReturnType<typeof setTimeout> | null>(null);
  const d = fd.datos;

  const abrir = useCallback(
    (h: Hoja) => {
      if (reloj.current) clearTimeout(reloj.current);
      if (visible) {
        setVisible(false);
        reloj.current = setTimeout(() => {
          setHoja(h);
          setVisible(true);
        }, ESPERA_CIERRE);
      } else {
        setHoja(h);
        setVisible(true);
      }
    },
    [visible],
  );
  const cerrar = useCallback(() => setVisible(false), []);

  const alternarTema = useCallback(
    (tema: Tema) => {
      vibrar('seleccion');
      void fd.hacer(() => F.cambiarEstadoTema(tema, siguienteEstado(tema.estado), hoy));
    },
    [fd, hoy],
  );

  const borrarTema = useCallback(
    async (tema: Tema) => {
      const ok = await confirmar({ titulo: t('focus:hojas.borrarTemaTitulo', { nombre: tema.nombre }), confirmar: t('focus:hojas.borrar'), destructivo: true });
      if (!ok) return;
      vibrar('destructiva');
      await fd.hacer(() => F.borrarTema(tema.id));
    },
    [fd],
  );

  const itemsRepaso = useCallback((): ItemRepaso[] => {
    const mazo = new Map(d.mazos.map((m) => [m.id, m.nombre]));
    const asig = new Map(d.asignaturas.map((a) => [a.id, a.nombre]));
    const tarjetas = pendientesDeHoy(d.tarjetas, hoy).map((x) => ({
      id: x.id,
      tipo: 'tarjeta' as const,
      pregunta: x.anverso,
      respuesta: x.reverso,
      contexto: mazo.get(x.mazoId) ?? '',
    }));
    const temas = pendientesDeHoy(
      d.temas.map((x) => ({ ...x, vence: x.repasoEl })),
      hoy,
    ).map((x) => ({ id: x.id, tipo: 'tema' as const, pregunta: x.nombre, respuesta: null, contexto: asig.get(x.asignaturaId) ?? '' }));
    return [...tarjetas, ...temas];
  }, [d, hoy]);

  const abrirRepaso = useCallback(() => abrir({ tipo: 'repaso', items: itemsRepaso() }), [abrir, itemsRepaso]);

  const accionMetodo = useCallback(
    (m: Metodo) => {
      cerrar();
      if (m.accion === 'repasos' || m.accion === 'flashcards') {
        setTimeout(() => abrir({ tipo: 'repaso', items: itemsRepaso() }), ESPERA_CIERRE);
      } else if (m.accion === 'examenes') {
        router.navigate('/focus-examenes');
      } else {
        router.navigate('/focus-hoy');
      }
    },
    [abrir, cerrar, itemsRepaso],
  );

  const resultado = useCallback(
    (item: ItemRepaso, r: Resultado) => {
      vibrar('seleccion');
      if (item.tipo === 'tarjeta') {
        const x = d.tarjetas.find((c) => c.id === item.id);
        if (x) void fd.hacer(() => F.repasarTarjeta(x, r, hoy));
      } else {
        const x = d.temas.find((c) => c.id === item.id);
        if (x) void fd.hacer(() => F.repasarTema(x, r, hoy));
      }
    },
    [d, fd, hoy],
  );

  const guardar = useCallback(
    async (fn: () => Promise<void>) => {
      const ok = await fd.hacer(fn);
      if (ok) {
        vibrar('seleccion');
        cerrar();
      }
      return ok;
    },
    [fd, cerrar],
  );

  const examen = hoja?.tipo === 'detalle' ? (d.examenes.find((x) => x.id === hoja.examenId) ?? null) : null;
  const notasDe = hoja?.tipo === 'notas' ? notasPorAsignatura(d).find((n) => n.asignatura.id === hoja.asignaturaId) : undefined;
  const nombreTema = useCallback((id: string | null) => (id ? (d.temas.find((x) => x.id === id)?.nombre ?? '') : ''), [d]);
  const nombreAsig = (id: string | null | undefined) => d.asignaturas.find((a) => a.id === id)?.nombre ?? '';

  const elemento = (
    <>
      <HojaAsignatura
        visible={visible && hoja?.tipo === 'asignatura'}
        onClose={cerrar}
        onGuardar={(n) => void guardar(() => F.crearAsignatura(n, d.asignaturas.length))}
      />
      <HojaTemas
        visible={visible && hoja?.tipo === 'temas'}
        asignatura={hoja?.tipo === 'temas' ? nombreAsig(hoja.asignaturaId) : ''}
        onClose={cerrar}
        onGuardar={(temas) =>
          hoja?.tipo === 'temas' &&
          void guardar(() => F.crearTemas(hoja.asignaturaId, temas, hoja.examenId, temasDeAsignatura(d, hoja.asignaturaId).length))
        }
      />
      <HojaExamen
        visible={visible && hoja?.tipo === 'examen'}
        asignaturas={d.asignaturas}
        hoy={hoy}
        inicial={hoja?.tipo === 'examen' ? hoja.asignaturaId : null}
        onClose={cerrar}
        onGuardar={(x) => void guardar(() => F.crearExamen(x, temasDeAsignatura(d, x.asignaturaId).length))}
      />
      <HojaDetalleExamen
        visible={visible && hoja?.tipo === 'detalle'}
        examen={examen}
        asignatura={nombreAsig(examen?.asignaturaId)}
        dias={examen ? diasEntre(hoy, examen.fecha) : 0}
        plan={examen ? planDeExamen(d, examen, hoy) : []}
        temas={examen ? temasDeExamen(d, examen) : []}
        nombreTema={nombreTema}
        onClose={cerrar}
        onAlternarTema={alternarTema}
        onAnadirTemas={() =>
          examen &&
          abrir({ tipo: 'temas', asignaturaId: examen.asignaturaId, examenId: d.temas.some((x) => x.examenId === examen.id) ? examen.id : null })
        }
        onBorrar={async () => {
          if (!examen) return;
          const ok = await confirmar({ titulo: t('focus:hojas.borrarExamenTitulo'), mensaje: t('focus:hojas.borrarExamenCuerpo'), confirmar: t('focus:hojas.borrar'), destructivo: true });
          if (!ok) return;
          vibrar('destructiva');
          await guardar(() => F.borrarExamen(examen.id));
        }}
        onEstudiar={(temaId) => {
          if (!examen) return;
          cerrar();
          onEstudiar?.(examen.asignaturaId, temaId);
        }}
      />
      <HojaClase
        visible={visible && hoja?.tipo === 'clase'}
        asignaturas={d.asignaturas}
        dia={hoja?.tipo === 'clase' ? hoja.dia : 1}
        onClose={cerrar}
        onGuardar={(c) => void guardar(() => F.crearClase(c))}
      />
      <HojaNota
        visible={visible && hoja?.tipo === 'nota'}
        asignaturas={d.asignaturas}
        inicial={hoja?.tipo === 'nota' ? hoja.asignaturaId : null}
        hoy={hoy}
        onClose={cerrar}
        onGuardar={(n) => void guardar(() => F.crearNota(n))}
      />
      <HojaNotasAsignatura
        visible={visible && hoja?.tipo === 'notas'}
        asignatura={notasDe?.asignatura.nombre ?? ''}
        notas={hoja?.tipo === 'notas' ? d.notas.filter((n) => n.asignaturaId === hoja.asignaturaId) : []}
        media={notasDe?.media ?? null}
        necesaria={notasDe?.necesaria ?? null}
        onClose={cerrar}
        onAnadir={() => hoja?.tipo === 'notas' && abrir({ tipo: 'nota', asignaturaId: hoja.asignaturaId })}
        onBorrar={async (n: Nota) => {
          const ok = await confirmar({ titulo: t('focus:hojas.borrarNotaTitulo', { titulo: n.titulo }), confirmar: t('focus:hojas.borrar'), destructivo: true });
          if (!ok) return;
          vibrar('destructiva');
          await fd.hacer(() => F.borrarNota(n.id));
        }}
      />
      <HojaMazo
        visible={visible && hoja?.tipo === 'mazo'}
        asignaturas={d.asignaturas}
        onClose={cerrar}
        onGuardar={(n, a) => void guardar(() => F.crearMazo(n, a))}
      />
      <HojaTarjeta
        visible={visible && hoja?.tipo === 'tarjeta'}
        mazos={d.mazos}
        inicial={hoja?.tipo === 'tarjeta' ? hoja.mazoId : null}
        onClose={cerrar}
        onGuardar={(mazoId, a, r, otra) => {
          if (otra) void fd.hacer(() => F.crearTarjeta(mazoId, a, r, hoy));
          else void guardar(() => F.crearTarjeta(mazoId, a, r, hoy));
        }}
      />
      <HojaRepaso visible={visible && hoja?.tipo === 'repaso'} items={hoja?.tipo === 'repaso' ? hoja.items : []} onClose={cerrar} onResultado={resultado} />
      <HojaMetodo visible={visible && hoja?.tipo === 'metodo'} metodo={hoja?.tipo === 'metodo' ? metodoPorId(hoja.id) : null} onClose={cerrar} onAccion={accionMetodo} />
      {pomodoro ? (
        <>
          <HojaAjustes
            visible={visible && hoja?.tipo === 'ajustes'}
            config={pomodoro.config}
            onClose={cerrar}
            onGuardar={(c) => {
              pomodoro.fijarConfig(c);
              cerrar();
            }}
          />
          <HojaMision
            visible={visible && hoja?.tipo === 'mision'}
            misiones={(misiones ?? []).filter((m) => !m.hecha && !m.penalizacion)}
            elegida={pomodoro.estado.objetivo.misionId}
            onClose={cerrar}
            onElegir={(id) => {
              vibrar('seleccion');
              pomodoro.fijarObjetivo({ ...pomodoro.estado.objetivo, misionId: id });
              cerrar();
            }}
          />
        </>
      ) : null}
      <HojaNoMolestar visible={visible && hoja?.tipo === 'noMolestar'} onClose={cerrar} />
    </>
  );

  const acciones = useMemo(
    () => ({
      asignatura: () => abrir({ tipo: 'asignatura' }),
      temas: (asignaturaId: string, examenId: string | null = null) => abrir({ tipo: 'temas', asignaturaId, examenId }),
      examen: (asignaturaId: string | null = null) => abrir({ tipo: 'examen', asignaturaId }),
      detalle: (examenId: string) => abrir({ tipo: 'detalle', examenId }),
      clase: (dia: number) => abrir({ tipo: 'clase', dia }),
      nota: (asignaturaId: string | null = null) => abrir({ tipo: 'nota', asignaturaId }),
      notas: (asignaturaId: string) => abrir({ tipo: 'notas', asignaturaId }),
      mazo: () => abrir({ tipo: 'mazo' }),
      tarjeta: (mazoId: string | null) => abrir({ tipo: 'tarjeta', mazoId }),
      repaso: abrirRepaso,
      metodo: (id: IdMetodo) => abrir({ tipo: 'metodo', id }),
      ajustes: () => abrir({ tipo: 'ajustes' }),
      mision: () => abrir({ tipo: 'mision' }),
      noMolestar: () => abrir({ tipo: 'noMolestar' }),
      alternarTema,
      borrarTema,
    }),
    [abrir, abrirRepaso, alternarTema, borrarTema],
  );

  return { elemento, abrir: acciones };
}
