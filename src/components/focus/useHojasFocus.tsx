// NIVL · FOCUS: las hojas de las tres pestañas y lo que guardan (efectos).
//
// Una sola hoja abierta a la vez. Pasar de una a otra espera a que la primera
// se cierre (en iOS, presentar un Modal encima de otro que se va no abre nada).
// Guardar va por `hacer` (useFocusDatos): cerrojo, fallo en voz del sistema y
// relectura. Nada de aquí paga XP.

import { router } from 'expo-router';
import { rutaFocus } from '@/components/modos/mundo/prestadoRutas';
import { useCallback, useMemo, useRef, useState } from 'react';
import { confirmar } from '@/components/ui';
import { vibrar } from '@/design/haptics';
import { trasEstudiar, type ResultadoActoEstudio } from '@/focus/actoEstudio';
import { clavePerfil, evolucionDe, nombreNota } from '@/focus/agenda';
import * as F from '@/focus/datos';
import { estadisticasDe } from '@/focus/estadisticas';
import { diasEntre } from '@/focus/fechas';
import { copiarDia } from '@/focus/horarioRapido';
import { metodoPorId, type IdMetodo, type Metodo } from '@/focus/metodos';
import { enlazables } from '@/focus/mision';
import { notasPorAsignatura, planDeExamen, repasosDeHoy, tarjetasVivas, temasDeAsignatura, temasDeExamen } from '@/focus/resumen';
import { CONFIG_POR_DEFECTO, type ConfigPomodoro } from '@/focus/pomodoro';
import { pendientesDeHoy, sesionesDeTanda, type Resultado } from '@/focus/repaso';
import { pierdeCalendario } from '@/focus/temarioLista';
import { siguienteEstado, type Clase, type Nota, type Tema } from '@/focus/tipos';
import { t } from '@/i18n';
import { useAuth } from '@/lib/auth';
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
  horaClase,
  type ItemRepaso,
} from './HojasFocus';
import { HojaEntrega, HojaSimulacro } from './HojasAgenda';
import { HojaCopiarDia, HojaHoras, HojaTarjetasIa, HojaTarjetasLote, HojaTema } from './HojasTemario';
import { useTarjetasIa } from './useTarjetasIa';

type Hoja =
  | { tipo: 'asignatura' }
  | { tipo: 'temas'; asignaturaId: string; examenId: string | null }
  | { tipo: 'examen'; asignaturaId: string | null; editarId?: string }
  | { tipo: 'entrega'; id: string | null }
  | { tipo: 'simulacro'; asignaturaId: string | null }
  | { tipo: 'detalle'; examenId: string }
  | { tipo: 'clase'; dia: number; claseId: string | null }
  | { tipo: 'copiarDia'; dia: number }
  | { tipo: 'editarTema'; temaId: string }
  | { tipo: 'tarjetasLote'; mazoId: string | null }
  | { tipo: 'tarjetasIa'; mazoId: string | null }
  | { tipo: 'horas' }
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
  /** Sin pomodoro montado: el bloque de esta persona, para que el plan del examen case con Hoy. */
  configPlan?: ConfigPomodoro;
  misiones?: { id: string; titulo: string; xp: number; hecha: boolean; penalizacion: boolean; link?: string | null; modos?: readonly string[] }[];
  /** Estudiar algo ya: deja el bloque apuntado a ese tema y va a Hoy. */
  onEstudiar?: (asignaturaId: string, temaId: string | null) => void;
  /** Tras una tanda de repaso ya guardada y propagada. */
  onActo?: (r: ResultadoActoEstudio | null) => void;
}

export function useHojasFocus({ datos: fd, hoy, pomodoro, configPlan, misiones, onEstudiar, onActo }: OpcionesHojas) {
  const { session } = useAuth();
  const uid = session?.user.id ?? null;
  const tanda = useRef<{ inicio: number; tarjetas: (string | null)[]; temas: string[]; escrituras: Promise<boolean>[]; avisado: boolean } | null>(null);
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
    async (tema: Tema) => {
      vibrar('seleccion');
      const siguiente = siguienteEstado(tema.estado);
      if (pierdeCalendario(tema, siguiente)) {
        const ok = await confirmar({
          titulo: t('focus:fondo.temas.perderTitulo', { nombre: tema.nombre }),
          mensaje: t('focus:fondo.temas.perderCuerpo'),
          confirmar: t('focus:fondo.temas.perderOk'),
          destructivo: true,
        });
        if (!ok) return;
        vibrar('destructiva');
        await fd.hacer(() => F.cambiarEstadoTema(tema, siguiente, hoy, { borrarRepaso: true }));
        return;
      }
      await fd.hacer(() => F.cambiarEstadoTema(tema, siguiente, hoy));
    },
    [fd, hoy],
  );

  const borrarTema = useCallback(
    async (tema: Tema) => {
      const ok = await confirmar({ titulo: t('focus:hojas.borrarTemaTitulo', { nombre: tema.nombre }), confirmar: t('focus:hojas.borrar'), destructivo: true });
      if (!ok) return false;
      vibrar('destructiva');
      return fd.hacer(() => F.borrarTema(tema.id));
    },
    [fd],
  );

  const itemsRepaso = useCallback((): ItemRepaso[] => {
    const mazo = new Map(d.mazos.map((m) => [m.id, m.nombre]));
    const asig = new Map(d.asignaturas.map((a) => [a.id, a.nombre]));
    // Solo lo que cuenta el contador de Hoy: nada de asignaturas archivadas.
    const tarjetas = pendientesDeHoy(tarjetasVivas(d), hoy).map((x) => ({
      id: x.id,
      tipo: 'tarjeta' as const,
      pregunta: x.anverso,
      respuesta: x.reverso,
      contexto: mazo.get(x.mazoId) ?? '',
    }));
    const temas = repasosDeHoy(d, hoy).temas.map((x) => ({ id: x.id, tipo: 'tema' as const, pregunta: x.nombre, respuesta: null, contexto: asig.get(x.asignaturaId) ?? '' }));
    return [...tarjetas, ...temas];
  }, [d, hoy]);

  const abrirRepaso = useCallback(() => {
    tanda.current = { inicio: Date.now(), tarjetas: [], temas: [], escrituras: [], avisado: false };
    abrir({ tipo: 'repaso', items: itemsRepaso() });
  }, [abrir, itemsRepaso]);

  /** Solo estos temas, en este orden (volver tras un hueco). */
  const abrirRepasoDe = useCallback(
    (temaIds: readonly string[]) => {
      const todos = new Map(itemsRepaso().map((i) => [i.id, i]));
      tanda.current = { inicio: Date.now(), tarjetas: [], temas: [], escrituras: [], avisado: false };
      abrir({ tipo: 'repaso', items: temaIds.flatMap((id) => todos.get(id) ?? []) });
    },
    [abrir, itemsRepaso],
  );

  /** Al cerrar la hoja de repaso: lo repasado cuenta como minutos reales y se propaga. */
  const cerrarRepaso = useCallback(() => {
    cerrar();
    const hecho = tanda.current;
    tanda.current = null;
    if (!hecho || !uid) return;
    const sesiones = sesionesDeTanda({ msReales: Date.now() - hecho.inicio, tarjetas: hecho.tarjetas, temas: hecho.temas });
    if (sesiones.length === 0) {
      if (hecho.escrituras.length > 0) void Promise.all(hecho.escrituras).then(fd.recargar);
      return;
    }
    void (async () => {
      await Promise.all(hecho.escrituras);
      const r = await trasEstudiar({
        uid,
        sesiones: sesiones.map((s) => ({
          clientId: `repaso-${hecho.inicio}-${s.sufijo}`,
          asignaturaId: s.asignaturaId,
          temaId: null,
          misionId: null,
          fecha: hoy,
          minutos: s.minutos,
          metodo: s.metodo,
        })),
        asignaturas: d.asignaturas,
      });
      onActo?.(r);
      await fd.recargar();
    })();
  }, [cerrar, uid, hoy, d.asignaturas, onActo, fd]);

  const accionMetodo = useCallback(
    (m: Metodo) => {
      cerrar();
      if (m.accion === 'repasos' || m.accion === 'flashcards') {
        setTimeout(abrirRepaso, ESPERA_CIERRE);
      } else if (m.accion === 'examenes') {
        router.navigate(rutaFocus('examenes'));
      } else {
        router.navigate(rutaFocus('hoy'));
      }
    },
    [abrirRepaso, cerrar],
  );

  const resultado = useCallback(
    (item: ItemRepaso, r: Resultado) => {
      vibrar('seleccion');
      const escribir = (fn: () => Promise<void>) => {
        const actual = tanda.current;
        // 200 repasos no pueden ser 200 relecturas ni, sin red, 200 avisos: se relee al cerrar.
        const hecho = fd
          .hacer(fn, { releer: false, avisar: !actual?.avisado })
          .then((ok) => {
            if (!ok && actual) actual.avisado = true;
            return ok;
          });
        actual?.escrituras.push(hecho);
      };
      if (item.tipo === 'tarjeta') {
        const x = d.tarjetas.find((c) => c.id === item.id);
        if (x) {
          tanda.current?.tarjetas.push(d.mazos.find((m) => m.id === x.mazoId)?.asignaturaId ?? null);
          escribir(() => F.repasarTarjeta(x, r, hoy));
        }
      } else {
        const x = d.temas.find((c) => c.id === item.id);
        if (x) {
          tanda.current?.temas.push(x.asignaturaId);
          escribir(() => F.repasarTema(x, r, hoy));
        }
      }
    },
    [d, fd, hoy],
  );

  // Una sola vez aunque se toque dos veces: crear no es idempotente (70 temas, un mazo pegado).
  const cerrojo = useRef(false);
  const unaVez = useCallback(async (fn: () => Promise<boolean>) => {
    if (cerrojo.current) return false;
    cerrojo.current = true;
    try {
      return await fn();
    } finally {
      cerrojo.current = false;
    }
  }, []);

  const guardar = useCallback(
    (fn: () => Promise<void>) =>
      unaVez(async () => {
        const ok = await fd.hacer(fn);
        if (ok) {
          vibrar('seleccion');
          cerrar();
        }
        return ok;
      }),
    [fd, cerrar, unaVez],
  );

  const examen = hoja?.tipo === 'detalle' ? (d.examenes.find((x) => x.id === hoja.examenId) ?? null) : null;
  // El simulacro es un ensayo: se lista con las notas, pero no mueve la media.
  const notasDe = hoja?.tipo === 'notas' ? notasPorAsignatura(d).find((n) => n.asignatura.id === hoja.asignaturaId) : undefined;
  const perfil = clavePerfil(d.prefs.perfil);
  const examenEditado = hoja?.tipo === 'examen' && hoja.editarId ? (d.examenes.find((x) => x.id === hoja.editarId) ?? null) : null;
  const entregaEditada = hoja?.tipo === 'entrega' && hoja.id ? (d.examenes.find((x) => x.id === hoja.id) ?? null) : null;
  const asignaturaDeNotas = hoja?.tipo === 'notas' ? (d.asignaturas.find((a) => a.id === hoja.asignaturaId) ?? null) : null;
  const ahora = new Date();
  const nombreTema = useCallback((id: string | null) => (id ? (d.temas.find((x) => x.id === id)?.nombre ?? '') : ''), [d]);
  const nombreAsig = (id: string | null | undefined) => d.asignaturas.find((a) => a.id === id)?.nombre ?? '';
  const temaEditado = hoja?.tipo === 'editarTema' ? (d.temas.find((x) => x.id === hoja.temaId) ?? null) : null;
  const claseEditada = hoja?.tipo === 'clase' && hoja.claseId ? (d.clases.find((x) => x.id === hoja.claseId) ?? null) : null;
  const mazoIa = hoja?.tipo === 'tarjetasIa' ? hoja.mazoId : null;
  const ia = useTarjetasIa(visible && hoja?.tipo === 'tarjetasIa');
  const guardarTarjetas = (mazoId: string, tarjetas: { anverso: string; reverso: string }[]) => void guardar(() => F.crearTarjetas(mazoId, tarjetas, hoy));

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
        examen={examenEditado}
        asignaturaFija={!!examenEditado && d.temas.some((x) => x.examenId === examenEditado.id)}
        perfil={perfil}
        onClose={cerrar}
        onGuardar={(x) =>
          void guardar(() =>
            examenEditado
              ? F.editarExamen(examenEditado.id, { asignaturaId: x.asignaturaId, titulo: x.titulo, fecha: x.fecha, peso: x.peso, hora: x.hora, tipo: x.tipo, estimada: x.estimada })
              : F.crearExamen(x, temasDeAsignatura(d, x.asignaturaId).length),
          )
        }
      />
      <HojaEntrega
        visible={visible && hoja?.tipo === 'entrega'}
        asignaturas={d.asignaturas}
        hoy={hoy}
        perfil={perfil}
        entrega={entregaEditada}
        onClose={cerrar}
        onGuardar={(x) =>
          void guardar(() =>
            entregaEditada
              ? F.editarExamen(entregaEditada.id, { asignaturaId: x.asignaturaId, titulo: x.titulo, fecha: x.fecha, hora: x.hora })
              : F.crearExamen({ asignaturaId: x.asignaturaId, titulo: x.titulo, fecha: x.fecha, hora: x.hora, peso: null, temas: [], tipo: 'entrega', estimada: false }, 0),
          )
        }
        onBorrar={async () => {
          if (!entregaEditada) return;
          const ok = await confirmar({ titulo: t('focus:agenda.entregas.borrarTitulo', { titulo: entregaEditada.titulo }), confirmar: t('focus:hojas.borrar'), destructivo: true });
          if (!ok) return;
          vibrar('destructiva');
          await guardar(() => F.borrarExamen(entregaEditada.id));
        }}
      />
      <HojaSimulacro
        visible={visible && hoja?.tipo === 'simulacro'}
        asignaturas={d.asignaturas}
        hoy={hoy}
        perfil={perfil}
        inicial={hoja?.tipo === 'simulacro' ? hoja.asignaturaId : null}
        evolucionDe={(id) => evolucionDe(d, id)}
        onClose={cerrar}
        onGuardar={(n) => void guardar(() => F.crearNota(n))}
      />
      <HojaDetalleExamen
        visible={visible && hoja?.tipo === 'detalle'}
        examen={examen}
        asignatura={nombreAsig(examen?.asignaturaId)}
        hoy={hoy}
        dias={examen?.fecha ? diasEntre(hoy, examen.fecha) : null}
        plan={examen ? planDeExamen(d, examen, hoy, pomodoro?.config ?? configPlan ?? CONFIG_POR_DEFECTO, ahora.getHours() * 60 + ahora.getMinutes()) : []}
        onEditar={() => examen && abrir({ tipo: 'examen', asignaturaId: examen.asignaturaId, editarId: examen.id })}
        onSimulacro={() => examen && abrir({ tipo: 'simulacro', asignaturaId: examen.asignaturaId })}
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
        clase={claseEditada}
        clases={d.clases}
        onClose={cerrar}
        onGuardar={(c, otra) => {
          if (claseEditada) void guardar(() => F.editarClase(claseEditada.id, c));
          else if (otra) void unaVez(() => fd.hacer(() => F.crearClase(c)));
          else void guardar(() => F.crearClase(c));
        }}
        onBorrar={async (c: Clase) => {
          const ok = await confirmar({ titulo: t('focus:temario.borrarClaseTitulo', { horas: horaClase(c) }), confirmar: t('focus:hojas.borrar'), destructivo: true });
          if (!ok) return;
          vibrar('destructiva');
          await guardar(() => F.borrarClase(c.id));
        }}
      />
      <HojaCopiarDia
        visible={visible && hoja?.tipo === 'copiarDia'}
        origen={hoja?.tipo === 'copiarDia' ? hoja.dia : 1}
        clases={d.clases}
        onClose={cerrar}
        onGuardar={(destinos) => hoja?.tipo === 'copiarDia' && void guardar(() => F.crearClases(copiarDia(d.clases, hoja.dia, destinos).nuevas))}
      />
      <HojaTema
        visible={visible && hoja?.tipo === 'editarTema'}
        tema={temaEditado}
        onClose={cerrar}
        onGuardar={(nombre, seccion) => temaEditado && void guardar(() => F.renombrarTema(temaEditado.id, nombre, seccion))}
        onBorrar={async () => {
          if (temaEditado && (await borrarTema(temaEditado))) cerrar();
        }}
      />
      <HojaNota
        visible={visible && hoja?.tipo === 'nota'}
        asignaturas={d.asignaturas}
        inicial={hoja?.tipo === 'nota' ? hoja.asignaturaId : null}
        hoy={hoy}
        perfil={perfil}
        onClose={cerrar}
        onGuardar={(n) => void guardar(() => F.crearNota(n))}
      />
      <HojaNotasAsignatura
        visible={visible && hoja?.tipo === 'notas'}
        asignatura={asignaturaDeNotas?.nombre ?? ''}
        objetivo={asignaturaDeNotas?.notaObjetivo ?? null}
        onObjetivo={(nota) => {
          if (!asignaturaDeNotas) return;
          vibrar('seleccion');
          void fd.hacer(() => F.fijarNotaObjetivo(asignaturaDeNotas.id, nota));
        }}
        notas={hoja?.tipo === 'notas' ? d.notas.filter((n) => n.asignaturaId === hoja.asignaturaId) : []}
        media={notasDe?.media ?? null}
        necesaria={notasDe?.necesaria ?? null}
        onClose={cerrar}
        onAnadir={() => hoja?.tipo === 'notas' && abrir({ tipo: 'nota', asignaturaId: hoja.asignaturaId })}
        onBorrar={async (n: Nota) => {
          const ok = await confirmar({ titulo: t('focus:hojas.borrarNotaTitulo', { titulo: nombreNota(n) }), confirmar: t('focus:hojas.borrar'), destructivo: true });
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
          if (otra) void unaVez(() => fd.hacer(() => F.crearTarjeta(mazoId, a, r, hoy)));
          else void guardar(() => F.crearTarjeta(mazoId, a, r, hoy));
        }}
      />
      <HojaTarjetasLote
        visible={visible && hoja?.tipo === 'tarjetasLote'}
        mazos={d.mazos}
        inicial={hoja?.tipo === 'tarjetasLote' ? hoja.mazoId : null}
        onClose={cerrar}
        onGuardar={guardarTarjetas}
      />
      <HojaTarjetasIa
        visible={visible && hoja?.tipo === 'tarjetasIa'}
        mazos={d.mazos}
        inicial={mazoIa}
        fase={ia.fase}
        tarjetas={ia.tarjetas}
        aviso={ia.aviso}
        onClose={cerrar}
        onGenerar={(texto) => void ia.generar(texto)}
        onQuitar={ia.quitar}
        onOtraVez={ia.otraVez}
        onGuardar={guardarTarjetas}
        onLoteAMano={() => abrir({ tipo: 'tarjetasLote', mazoId: mazoIa })}
      />
      <HojaHoras visible={visible && hoja?.tipo === 'horas'} datos={hoja?.tipo === 'horas' ? estadisticasDe(d, hoy) : null} onClose={cerrar} />
      <HojaRepaso visible={visible && hoja?.tipo === 'repaso'} items={hoja?.tipo === 'repaso' ? hoja.items : []} onClose={cerrarRepaso} onResultado={resultado} />
      <HojaMetodo visible={visible && hoja?.tipo === 'metodo'} metodo={hoja?.tipo === 'metodo' ? metodoPorId(hoja.id) : null} onClose={cerrar} onAccion={accionMetodo} />
      {pomodoro ? (
        <>
          <HojaAjustes
            visible={visible && hoja?.tipo === 'ajustes'}
            config={pomodoro.config}
            prefs={d.prefs}
            hoy={hoy}
            onClose={cerrar}
            onGuardar={(c, prefs) => {
              pomodoro.fijarConfig(c);
              cerrar();
              if (prefs && (prefs.minutosDia !== d.prefs.minutosDia || prefs.sinClasesHasta !== d.prefs.sinClasesHasta)) void fd.hacer(() => F.guardarPrefs(prefs));
            }}
          />
          <HojaMision
            visible={visible && hoja?.tipo === 'mision'}
            misiones={enlazables(misiones ?? [])}
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
      entrega: (id: string | null = null) => abrir({ tipo: 'entrega', id }),
      simulacro: (asignaturaId: string | null = null) => abrir({ tipo: 'simulacro', asignaturaId }),
      detalle: (examenId: string) => abrir({ tipo: 'detalle', examenId }),
      clase: (dia: number, claseId: string | null = null) => abrir({ tipo: 'clase', dia, claseId }),
      copiarDia: (dia: number) => abrir({ tipo: 'copiarDia', dia }),
      editarTema: (temaId: string) => abrir({ tipo: 'editarTema', temaId }),
      tarjetasLote: (mazoId: string | null) => abrir({ tipo: 'tarjetasLote', mazoId }),
      tarjetasIa: (mazoId: string | null) => abrir({ tipo: 'tarjetasIa', mazoId }),
      horas: () => abrir({ tipo: 'horas' }),
      nota: (asignaturaId: string | null = null) => abrir({ tipo: 'nota', asignaturaId }),
      notas: (asignaturaId: string) => abrir({ tipo: 'notas', asignaturaId }),
      mazo: () => abrir({ tipo: 'mazo' }),
      tarjeta: (mazoId: string | null) => abrir({ tipo: 'tarjeta', mazoId }),
      repaso: abrirRepaso,
      repasoDe: abrirRepasoDe,
      metodo: (id: IdMetodo) => abrir({ tipo: 'metodo', id }),
      ajustes: () => abrir({ tipo: 'ajustes' }),
      mision: () => abrir({ tipo: 'mision' }),
      noMolestar: () => abrir({ tipo: 'noMolestar' }),
      alternarTema,
      borrarTema,
    }),
    [abrir, abrirRepaso, abrirRepasoDe, alternarTema, borrarTema],
  );

  return { elemento, abrir: acciones };
}
