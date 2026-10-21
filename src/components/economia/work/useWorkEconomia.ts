// NIVL · Mundo WORK: datos, efectos y cerrojos de la economía (patrón useX +
// XVista). La lógica pura es de src/lib/moneywork.ts y moneyextracto.ts; los
// efectos de src/lib/moneydatos.ts.
//
//   · Al abrir: lee cuentas, movimientos, fijos y categorías y GENERA los
//     fijos que falten hasta hoy (idempotente por huella; ver moneywork.ts).
//   · Sin la 0075: estado 'no_disponible' (vacío tranquilo, nunca rojo).
//   · Gasto o ingreso en dos toques; transferencias; cuentas con saldo
//     inicial; fijos; categorías propias.
//   · Importar extracto: el CSV se lee EN EL MÓVIL (no sale del teléfono);
//     el PDF lo lee la función `economia` con IA (consentimiento y candado).
//     Antes de guardar, la pantalla de revisión.
//   · El brief del mes: el guardado si lo hay; si no, las cifras del código y
//     el botón para que la IA lo escriba (Pro).
// Guardar dinero no da XP (nada que inflar): sin vibración al guardar, la de
// `penalizacion` solo en el fallo de una acción.

import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { useConsentimientoIA } from '@/components/ConsentimientoIA';
import { avisar, confirmar } from '@/components/ui/confirmar';
import { vibrar } from '@/design/haptics';
import { t } from '@/i18n';
import { accessNotice, CoachAccessError } from '@/lib/coach';
import { dateKey } from '@/lib/dates';
import {
  archivarCuenta,
  bajaFijo,
  borrarMovimiento,
  briefGuardado,
  cargarWork,
  crearCategoria,
  crearCuenta,
  crearFijo,
  editarCuenta,
  elegirExtracto,
  existentesDesde,
  generarFijos,
  insertarMovimientos,
  nuevoId,
  pedirBrief,
  pedirPropuesta,
  puedeElegirArchivo,
  reglasCategoria,
  type DatosWork,
} from '@/lib/moneydatos';
import { leerExtractoCsv, proponerImportacion } from '@/lib/moneyextracto';
import {
  BASE_DE_GRUPO,
  generadoHasta,
  huellaFijo,
  leerImporte,
  mesDelBrief,
  nuevoMovimiento,
  patasTransferencia,
  pendientesFijos,
  type GrupoId,
  type MovNuevo,
  type MovWork,
  type TipoCuenta,
} from '@/lib/moneywork';
import { mesDe } from '@/lib/moneymath';
import { mensajeSistema } from '@/lib/validation';
import { rutaCoachDe } from '@/modos/rutasModo';
import { derivarWork } from './calculoWork';
import {
  baseDe,
  type CategoriaElegida,
  type CuentaElegible,
  type HojaCategoriasProps,
  type HojaCuentaProps,
  type HojaElegirCategoriaProps,
  type HojaFijoProps,
  type HojaImportarProps,
  type HojaMovimientoProps,
  type HojaTransferenciaProps,
} from './HojasWork';
import { euros } from './nombres';
import type { FilaRevision, RevisionExtractoVistaProps } from './RevisionExtractoVista';
import type { EstadoBrief, WorkEconomiaVistaProps } from './WorkEconomiaVista';

export interface UsoWorkEconomia {
  vista: Omit<WorkEconomiaVistaProps, 'cabecera'>;
  revision: RevisionExtractoVistaProps | null;
  hojas: {
    movimiento: HojaMovimientoProps;
    transferencia: HojaTransferenciaProps;
    cuenta: HojaCuentaProps;
    fijo: HojaFijoProps;
    categorias: HojaCategoriasProps;
    importar: HojaImportarProps;
    elegirCategoria: HojaElegirCategoriaProps;
  };
  hojaConsentimiento: ReactNode;
}

/** Saldo inicial: admite negativo («-120,50»). */
function leerSaldo(texto: string): number | null {
  const s = texto.trim();
  if (!s) return 0;
  const negativo = /^[-−]/.test(s);
  const n = leerImporte(s);
  if (n === null) return /^[-−]?0+([.,]0+)?$/.test(s) ? 0 : null;
  return negativo ? -n : n;
}

export function useWorkEconomia(): UsoWorkEconomia {
  const consentimiento = useConsentimientoIA();
  const hoy = dateKey();

  const [datos, setDatos] = useState<DatosWork | null>(null);
  const [estado, setEstado] = useState<WorkEconomiaVistaProps['estado']>('cargando');
  const [error, setError] = useState<string | null>(null);
  const [refrescando, setRefrescando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [brief, setBrief] = useState<{ texto: string | null; estado: EstadoBrief }>({ texto: null, estado: 'sin_texto' });
  const cargando = useRef(false);

  const cargar = useCallback(async () => {
    if (cargando.current) return;
    cargando.current = true;
    try {
      const primera = await cargarWork(hoy);
      if (!primera.disponible) {
        setEstado('no_disponible');
        setDatos(null);
        return;
      }
      let c: DatosWork = primera;
      // Los fijos que falten hasta hoy. Si dos móviles lo hacen a la vez, la
      // huella única impide el duplicado.
      const ya = new Set(c.movs.filter((m) => m.recurring_id).map((m) => huellaFijo(m.recurring_id!, mesDe(m.date))));
      const nuevos = pendientesFijos(c.fijos, hoy, ya);
      const hasta = primera.fijos
        .filter((f) => (f.generated_through ?? '') < generadoHasta(f, hoy))
        .map((f) => ({ id: f.id, mes: generadoHasta(f, hoy) }));
      if (nuevos.length || hasta.length) {
        try {
          const n = await generarFijos(nuevos, hasta);
          if (n > 0) setAviso(t('economia:work.avisos.fijos', { count: n }));
          if (nuevos.length) {
            const otra = await cargarWork(hoy);
            if (otra.disponible) c = otra;
          }
        } catch {
          // Si no se pueden generar ahora, se reintenta en la próxima apertura.
        }
      }
      setDatos(c);
      setEstado('listo');
      setError(null);
      const texto = await briefGuardado(mesDelBrief(hoy));
      setBrief((b) => (b.estado === 'pidiendo' ? b : { texto, estado: texto ? 'listo' : b.estado === 'sin_pro' ? 'sin_pro' : 'sin_texto' }));
    } catch (e) {
      setError(mensajeSistema(e));
      setEstado('error');
    } finally {
      cargando.current = false;
    }
  }, [hoy]);

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar]),
  );

  const refrescar = async () => {
    setRefrescando(true);
    await cargar();
    setRefrescando(false);
  };

  const vistaDatos = useMemo(() => (datos ? derivarWork(datos, hoy, brief) : null), [datos, hoy, brief]);
  const cuentas: CuentaElegible[] = useMemo(
    () => (vistaDatos?.vista.cuentas ?? []).map((c) => ({ id: c.id, nombre: c.nombre, tipo: c.tipo, saldo: c.saldo })),
    [vistaDatos],
  );
  const propias = useMemo(() => datos?.categorias ?? [], [datos]);
  const [ultimaCuenta, setUltimaCuenta] = useState<string | null>(null);
  const cuentaPorDefecto = (ultimaCuenta && cuentas.some((c) => c.id === ultimaCuenta) ? ultimaCuenta : cuentas[0]?.id) ?? null;

  const fallo = (e: unknown, set: (m: string) => void) => {
    vibrar('penalizacion');
    set(mensajeSistema(e));
  };

  // ── Gasto o ingreso ──────────────────────────────────────────────
  const [movTipo, setMovTipo] = useState<'gasto' | 'ingreso' | null>(null);
  const [movImporte, setMovImporte] = useState('');
  const [movConcepto, setMovConcepto] = useState('');
  const [movCuenta, setMovCuenta] = useState<string | null>(null);
  const [movGuardando, setMovGuardando] = useState(false);
  const [movErrImporte, setMovErrImporte] = useState<string | null>(null);
  const [movError, setMovError] = useState<string | null>(null);
  const movCerrojo = useRef(false);

  const abrirMovimiento = (tipo: 'gasto' | 'ingreso') => {
    setMovTipo(tipo);
    setMovImporte('');
    setMovConcepto('');
    setMovCuenta(cuentaPorDefecto);
    setMovErrImporte(null);
    setMovError(null);
  };

  const guardarMovimiento = async (c: CategoriaElegida) => {
    if (!movTipo || movCerrojo.current) return;
    const importe = leerImporte(movImporte);
    if (importe === null) {
      setMovErrImporte(t('economia:work.errores.importe'));
      return;
    }
    const cuentaId = movCuenta ?? cuentaPorDefecto;
    if (!cuentaId) return;
    movCerrojo.current = true;
    setMovGuardando(true);
    setMovError(null);
    try {
      const { categoria, propia } = baseDe(c, propias);
      const concepto =
        movConcepto.trim() ||
        ('grupo' in c ? t(`economia:work.grupo.${c.grupo}`) : 'ingreso' in c ? t('economia:work.hojas.mov.ingreso') : propias.find((p) => p.id === propia)?.name ?? '');
      await insertarMovimientos([
        nuevoMovimiento({ cuentaId, tipo: movTipo, importe, fecha: hoy, concepto, categoria, categoriaPropia: propia, id: nuevoId() }),
      ]);
      setUltimaCuenta(cuentaId);
      setAviso(t(movTipo === 'gasto' ? 'economia:work.avisos.gasto' : 'economia:work.avisos.ingreso', { importe: euros(importe) }));
      setMovTipo(null);
      await cargar();
    } catch (e) {
      fallo(e, setMovError);
    } finally {
      movCerrojo.current = false;
      setMovGuardando(false);
    }
  };

  // ── Transferencia ────────────────────────────────────────────────
  const [trfAbierta, setTrfAbierta] = useState(false);
  const [trfOrigen, setTrfOrigen] = useState<string | null>(null);
  const [trfDestino, setTrfDestino] = useState<string | null>(null);
  const [trfImporte, setTrfImporte] = useState('');
  const [trfConcepto, setTrfConcepto] = useState('');
  const [trfGuardando, setTrfGuardando] = useState(false);
  const [trfErrImporte, setTrfErrImporte] = useState<string | null>(null);
  const [trfError, setTrfError] = useState<string | null>(null);

  const guardarTransferencia = async () => {
    if (trfGuardando || !trfOrigen || !trfDestino) return;
    const importe = leerImporte(trfImporte);
    if (importe === null) {
      setTrfErrImporte(t('economia:work.errores.importe'));
      return;
    }
    if (trfOrigen === trfDestino) {
      setTrfError(t('economia:work.errores.mismaCuenta'));
      return;
    }
    setTrfGuardando(true);
    setTrfError(null);
    try {
      const concepto = trfConcepto.trim() || t('economia:work.transferencia');
      await insertarMovimientos(patasTransferencia({ id: nuevoId(), origen: trfOrigen, destino: trfDestino, importe, fecha: hoy, concepto }));
      setAviso(t('economia:work.avisos.transferencia', { importe: euros(importe) }));
      setTrfAbierta(false);
      await cargar();
    } catch (e) {
      fallo(e, setTrfError);
    } finally {
      setTrfGuardando(false);
    }
  };

  // ── Cuenta ───────────────────────────────────────────────────────
  const [ctaAbierta, setCtaAbierta] = useState(false);
  const [ctaEditando, setCtaEditando] = useState<string | null>(null);
  const [ctaNombre, setCtaNombre] = useState('');
  const [ctaTipo, setCtaTipo] = useState<TipoCuenta>('banco');
  const [ctaSaldo, setCtaSaldo] = useState('');
  const [ctaGuardando, setCtaGuardando] = useState(false);
  const [ctaErrNombre, setCtaErrNombre] = useState<string | null>(null);
  const [ctaErrSaldo, setCtaErrSaldo] = useState<string | null>(null);
  const [ctaError, setCtaError] = useState<string | null>(null);

  const abrirCuenta = (id: string | null) => {
    const c = id ? datos?.cuentas.find((x) => x.id === id) : null;
    setCtaEditando(c ? c.id : null);
    setCtaNombre(c?.name ?? (datos?.cuentas.length ? '' : t('economia:work.tipoCuenta.efectivo')));
    setCtaTipo((c?.provider as TipoCuenta) ?? (datos?.cuentas.length ? 'banco' : 'efectivo'));
    setCtaSaldo(c ? String(c.opening_balance).replace('.', ',') : '');
    setCtaErrNombre(null);
    setCtaErrSaldo(null);
    setCtaError(null);
    setCtaAbierta(true);
  };

  const guardarCuenta = async () => {
    if (ctaGuardando) return;
    const nombre = ctaNombre.trim();
    if (!nombre) {
      setCtaErrNombre(t('economia:work.errores.nombre'));
      return;
    }
    const saldo = leerSaldo(ctaSaldo);
    if (saldo === null) {
      setCtaErrSaldo(t('economia:work.errores.saldo'));
      return;
    }
    setCtaGuardando(true);
    setCtaError(null);
    try {
      if (ctaEditando) await editarCuenta(ctaEditando, { name: nombre, opening_balance: saldo });
      else await crearCuenta({ nombre, tipo: ctaTipo, saldoInicial: saldo, fecha: hoy, orden: datos?.cuentas.length ?? 0 });
      setCtaAbierta(false);
      await cargar();
    } catch (e) {
      fallo(e, setCtaError);
    } finally {
      setCtaGuardando(false);
    }
  };

  const archivar = async () => {
    if (!ctaEditando) return;
    const ok = await confirmar({
      titulo: t('economia:work.confirmar.archivarTitulo', { nombre: ctaNombre }),
      mensaje: t('economia:work.confirmar.archivarMensaje'),
      confirmar: t('economia:work.hojas.cuentaHoja.archivar'),
      destructivo: true,
    });
    if (!ok) return;
    vibrar('destructiva');
    try {
      await archivarCuenta(ctaEditando);
      setCtaAbierta(false);
      await cargar();
    } catch (e) {
      fallo(e, setCtaError);
    }
  };

  // ── Fijos ────────────────────────────────────────────────────────
  const [fijoTipo, setFijoTipo] = useState<'ingreso' | 'gasto' | null>(null);
  const [fijoNombre, setFijoNombre] = useState('');
  const [fijoImporte, setFijoImporte] = useState('');
  const [fijoDia, setFijoDia] = useState('');
  const [fijoCuenta, setFijoCuenta] = useState<string | null>(null);
  const [fijoGrupo, setFijoGrupo] = useState<GrupoId>('casa');
  const [fijoEsteMes, setFijoEsteMes] = useState(true);
  const [fijoGuardando, setFijoGuardando] = useState(false);
  const [fijoErrNombre, setFijoErrNombre] = useState<string | null>(null);
  const [fijoErrImporte, setFijoErrImporte] = useState<string | null>(null);
  const [fijoErrDia, setFijoErrDia] = useState<string | null>(null);
  const [fijoError, setFijoError] = useState<string | null>(null);

  const abrirFijo = (tipo: 'ingreso' | 'gasto') => {
    setFijoTipo(tipo);
    setFijoNombre('');
    setFijoImporte('');
    setFijoDia('');
    setFijoCuenta(cuentas.find((c) => c.tipo !== 'efectivo')?.id ?? cuentaPorDefecto);
    setFijoGrupo('casa');
    setFijoEsteMes(true);
    setFijoErrNombre(null);
    setFijoErrImporte(null);
    setFijoErrDia(null);
    setFijoError(null);
  };

  const guardarFijo = async () => {
    if (!fijoTipo || fijoGuardando) return;
    const nombre = fijoNombre.trim();
    const importe = leerImporte(fijoImporte);
    const dia = Number(fijoDia);
    setFijoErrNombre(nombre ? null : t('economia:work.errores.nombre'));
    setFijoErrImporte(importe === null ? t('economia:work.errores.importe') : null);
    const diaOk = Number.isInteger(dia) && dia >= 1 && dia <= 31;
    setFijoErrDia(diaOk ? null : t('economia:work.errores.dia'));
    const cuentaId = fijoCuenta ?? cuentaPorDefecto;
    if (!nombre || importe === null || !diaOk || !cuentaId) return;
    setFijoGuardando(true);
    setFijoError(null);
    try {
      await crearFijo({
        cuentaId,
        tipo: fijoTipo,
        nombre,
        importe,
        dia,
        categoria: fijoTipo === 'ingreso' ? 'ingreso_nomina' : BASE_DE_GRUPO[fijoGrupo],
        categoriaPropia: null,
        // «Ya se ha cobrado este mes»: cuenta desde el día 1 de este mes.
        inicio: fijoEsteMes ? `${mesDe(hoy)}-01` : hoy,
      });
      setFijoTipo(null);
      await cargar();
    } catch (e) {
      fallo(e, setFijoError);
    } finally {
      setFijoGuardando(false);
    }
  };

  const tocarFijo = async (id: string) => {
    const f = datos?.fijos.find((x) => x.id === id);
    if (!f) return;
    const ok = await confirmar({
      titulo: t('economia:work.confirmar.bajaTitulo', { nombre: f.name }),
      mensaje: t('economia:work.confirmar.bajaMensaje'),
      confirmar: t('economia:work.confirmar.baja'),
      destructivo: true,
    });
    if (!ok) return;
    vibrar('destructiva');
    try {
      await bajaFijo(id, hoy);
      await cargar();
    } catch (e) {
      vibrar('penalizacion');
      avisar(t('comun:sistemaNoResponde'), mensajeSistema(e));
    }
  };

  const tocarMovimiento = async (m: MovWork) => {
    const ok = await confirmar({
      titulo: t('economia:work.confirmar.borrarTitulo'),
      mensaje: t(m.transfer_id ? 'economia:work.confirmar.borrarTransferencia' : 'economia:work.confirmar.borrarMensaje', {
        concepto: m.description,
        importe: euros(Math.abs(m.amount)),
      }),
      confirmar: t('economia:work.confirmar.borrar'),
      destructivo: true,
    });
    if (!ok) return;
    vibrar('destructiva');
    try {
      await borrarMovimiento(m);
      await cargar();
    } catch (e) {
      vibrar('penalizacion');
      avisar(t('comun:sistemaNoResponde'), mensajeSistema(e));
    }
  };

  // ── Categorías ───────────────────────────────────────────────────
  const [catAbierta, setCatAbierta] = useState(false);
  const [catNombre, setCatNombre] = useState('');
  const [catTipo, setCatTipo] = useState<'gasto' | 'ingreso'>('gasto');
  const [catGrupo, setCatGrupo] = useState<GrupoId>('otros');
  const [catGuardando, setCatGuardando] = useState(false);
  const [catErrNombre, setCatErrNombre] = useState<string | null>(null);
  const [catError, setCatError] = useState<string | null>(null);

  const crearCat = async () => {
    if (catGuardando) return;
    const nombre = catNombre.trim();
    if (!nombre) {
      setCatErrNombre(t('economia:work.errores.nombre'));
      return;
    }
    setCatGuardando(true);
    setCatError(null);
    try {
      await crearCategoria(nombre, catTipo, catTipo === 'ingreso' ? 'ingreso_otro' : BASE_DE_GRUPO[catGrupo]);
      setCatNombre('');
      await cargar();
    } catch (e) {
      fallo(e, setCatError);
    } finally {
      setCatGuardando(false);
    }
  };

  // ── Importar extracto y revisión ─────────────────────────────────
  const [impAbierta, setImpAbierta] = useState(false);
  const [impCuenta, setImpCuenta] = useState<string | null>(null);
  const [impLeyendo, setImpLeyendo] = useState(false);
  const [impError, setImpError] = useState<string | null>(null);
  const [revision, setRevision] = useState<{ archivo: string; cuentaId: string; cuenta: string; filas: FilaRevision[]; descartadas: number } | null>(null);
  const [revGuardando, setRevGuardando] = useState(false);
  const [revError, setRevError] = useState<string | null>(null);
  const [eligiendoFila, setEligiendoFila] = useState<number | null>(null);

  const abrirImportar = () => {
    if (!cuentas.length) {
      abrirCuenta(null);
      return;
    }
    setImpCuenta(cuentas.find((c) => c.tipo !== 'efectivo')?.id ?? cuentas[0]!.id);
    setImpError(null);
    setImpAbierta(true);
  };

  const leerArchivo = async () => {
    if (impLeyendo || !impCuenta) return;
    const cuenta = datos?.cuentas.find((c) => c.id === impCuenta);
    if (!cuenta) return;
    setImpLeyendo(true);
    setImpError(null);
    try {
      let archivo = await elegirExtracto();
      if (!archivo) return;
      const nombreArchivo = archivo.nombre;
      let filas: FilaRevision[];
      let descartadas: number;
      if (archivo.tipo === 'csv') {
        // En el móvil: el CSV no sale del teléfono.
        const lectura = leerExtractoCsv(archivo.contenido);
        archivo = null;
        if (lectura.error === 'sin_columnas') throw new Error('sin_columnas');
        if (!lectura.filas.length) throw new Error('vacio');
        const desde = lectura.filas.reduce((a, f) => (f.fecha < a ? f.fecha : a), lectura.filas[0]!.fecha);
        const [reglas, existentes] = await Promise.all([reglasCategoria(), existentesDesde(cuenta.id, desde)]);
        filas = proponerImportacion(lectura.filas, cuenta.name, reglas, existentes).map((f) => ({ ...f, marcada: f.estado === 'nuevo', propia: null }));
        descartadas = lectura.descartadas;
      } else {
        if (!(await consentimiento.asegurar())) return;
        const r = await pedirPropuesta(archivo, { id: cuenta.id, name: cuenta.name });
        archivo = null;
        filas = r.filas.map((f) => ({ ...f, marcada: f.estado === 'nuevo', propia: null }));
        descartadas = r.descartadas;
      }
      setImpAbierta(false);
      setRevError(null);
      setRevision({ archivo: nombreArchivo, cuentaId: cuenta.id, cuenta: cuenta.name, filas, descartadas });
    } catch (e) {
      const m = e instanceof Error ? e.message : '';
      if (e instanceof CoachAccessError) {
        setImpError(e.reason === 'sin_suscripcion' ? t('economia:work.errores.pdfPro') : accessNotice(e));
      } else if (m === 'sin_columnas') setImpError(t('economia:work.errores.sinColumnas'));
      else if (m === 'vacio') setImpError(t('economia:work.errores.vacio'));
      else fallo(e, setImpError);
    } finally {
      setImpLeyendo(false);
    }
  };

  const guardarRevision = async () => {
    if (!revision || revGuardando) return;
    const movs: MovNuevo[] = revision.filas
      .filter((f) => f.marcada && f.estado !== 'repetido')
      .map((f) => ({
        account_id: revision.cuentaId,
        date: f.fecha,
        amount: f.importe,
        description: f.concepto,
        counterparty: f.concepto,
        category: f.categoria,
        user_category_id: f.propia,
        source: 'extracto',
        is_internal: f.interno,
        transfer_id: null,
        recurring_id: null,
        dedup_hash: f.huella,
      }));
    setRevGuardando(true);
    setRevError(null);
    try {
      const n = await insertarMovimientos(movs);
      setAviso(t('economia:work.avisos.importados', { count: n }));
      setRevision(null);
      await cargar();
    } catch (e) {
      fallo(e, setRevError);
    } finally {
      setRevGuardando(false);
    }
  };

  const cambiarFila = (i: number, cambio: (f: FilaRevision) => FilaRevision) =>
    setRevision((r) => (r ? { ...r, filas: r.filas.map((f, j) => (j === i ? cambio(f) : f)) } : r));

  // ── Brief ────────────────────────────────────────────────────────
  const pedirElBrief = async () => {
    if (brief.estado === 'pidiendo') return;
    if (!(await consentimiento.asegurar())) return;
    setBrief({ texto: null, estado: 'pidiendo' });
    try {
      const r = await pedirBrief(mesDelBrief(hoy));
      setBrief({ texto: r.texto, estado: r.texto ? 'listo' : 'sin_texto' });
    } catch (e) {
      if (e instanceof CoachAccessError && e.reason === 'sin_suscripcion') {
        setBrief({ texto: null, estado: 'sin_pro' });
      } else {
        setBrief({ texto: null, estado: 'sin_texto' });
        vibrar('penalizacion');
        avisar(t('comun:sistemaNoResponde'), e instanceof CoachAccessError ? accessNotice(e) : mensajeSistema(e));
      }
    }
  };

  const filaEligiendo = eligiendoFila !== null ? revision?.filas[eligiendoFila] : undefined;

  return {
    vista: {
      estado,
      error,
      refrescando,
      hoy,
      datos: vistaDatos,
      aviso,
      acciones: {
        onRefrescar: refrescar,
        onReintentar: cargar,
        onGasto: () => abrirMovimiento('gasto'),
        onIngreso: () => abrirMovimiento('ingreso'),
        onTransferir: () => {
          setTrfOrigen(cuentas[0]?.id ?? null);
          setTrfDestino(cuentas[1]?.id ?? null);
          setTrfImporte('');
          setTrfConcepto('');
          setTrfErrImporte(null);
          setTrfError(null);
          setTrfAbierta(true);
        },
        onNuevaCuenta: () => abrirCuenta(null),
        onCuenta: (id) => abrirCuenta(id),
        onNuevoFijo: abrirFijo,
        onFijo: tocarFijo,
        onMovimiento: tocarMovimiento,
        onBrief: pedirElBrief,
        onImportar: abrirImportar,
        onCategorias: () => {
          setCatErrNombre(null);
          setCatError(null);
          setCatAbierta(true);
        },
        onCoach: () => router.navigate(rutaCoachDe('work')),
        onOlvidarAviso: () => setAviso(null),
      },
    },
    revision: revision
      ? {
          archivo: revision.archivo,
          cuenta: revision.cuenta,
          filas: revision.filas,
          descartadas: revision.descartadas,
          guardando: revGuardando,
          error: revError,
          propias,
          onAlternar: (i) => cambiarFila(i, (f) => (f.estado === 'repetido' ? f : { ...f, marcada: !f.marcada })),
          onCategoria: (i) => setEligiendoFila(i),
          onTodas: (marcar) => setRevision((r) => (r ? { ...r, filas: r.filas.map((f) => (f.estado === 'repetido' ? f : { ...f, marcada: marcar })) } : r)),
          onGuardar: guardarRevision,
          onCancelar: () => setRevision(null),
        }
      : null,
    hojas: {
      movimiento: {
        tipo: movTipo,
        importe: movImporte,
        concepto: movConcepto,
        cuentas,
        cuenta: movCuenta ?? cuentaPorDefecto,
        propias,
        guardando: movGuardando,
        errorImporte: movErrImporte,
        error: movError,
        onTipo: setMovTipo,
        onImporte: (v) => {
          setMovImporte(v);
          if (movErrImporte) setMovErrImporte(null);
        },
        onConcepto: setMovConcepto,
        onCuenta: setMovCuenta,
        onCategoria: guardarMovimiento,
        onCerrar: () => {
          if (!movCerrojo.current) setMovTipo(null);
        },
      },
      transferencia: {
        visible: trfAbierta,
        cuentas,
        origen: trfOrigen,
        destino: trfDestino,
        importe: trfImporte,
        concepto: trfConcepto,
        guardando: trfGuardando,
        errorImporte: trfErrImporte,
        error: trfError,
        onOrigen: (id) => {
          setTrfOrigen(id);
          if (trfDestino === id) setTrfDestino(cuentas.find((c) => c.id !== id)?.id ?? null);
        },
        onDestino: setTrfDestino,
        onImporte: (v) => {
          setTrfImporte(v);
          if (trfErrImporte) setTrfErrImporte(null);
        },
        onConcepto: setTrfConcepto,
        onGuardar: guardarTransferencia,
        onCerrar: () => setTrfAbierta(false),
      },
      cuenta: {
        visible: ctaAbierta,
        editando: ctaEditando !== null,
        nombre: ctaNombre,
        tipo: ctaTipo,
        saldo: ctaSaldo,
        guardando: ctaGuardando,
        errorNombre: ctaErrNombre,
        errorSaldo: ctaErrSaldo,
        error: ctaError,
        onNombre: (v) => {
          setCtaNombre(v);
          if (ctaErrNombre) setCtaErrNombre(null);
        },
        onTipo: setCtaTipo,
        onSaldo: (v) => {
          setCtaSaldo(v);
          if (ctaErrSaldo) setCtaErrSaldo(null);
        },
        onGuardar: guardarCuenta,
        onArchivar: archivar,
        onCerrar: () => setCtaAbierta(false),
      },
      fijo: {
        tipo: fijoTipo,
        nombre: fijoNombre,
        importe: fijoImporte,
        dia: fijoDia,
        cuentas,
        cuenta: fijoCuenta,
        grupo: fijoGrupo,
        esteMes: fijoEsteMes,
        guardando: fijoGuardando,
        errorNombre: fijoErrNombre,
        errorImporte: fijoErrImporte,
        errorDia: fijoErrDia,
        error: fijoError,
        onNombre: setFijoNombre,
        onImporte: setFijoImporte,
        onDia: (v) => setFijoDia(v.replace(/\D/g, '').slice(0, 2)),
        onCuenta: setFijoCuenta,
        onGrupo: setFijoGrupo,
        onEsteMes: setFijoEsteMes,
        onGuardar: guardarFijo,
        onCerrar: () => setFijoTipo(null),
      },
      categorias: {
        visible: catAbierta,
        propias,
        nombre: catNombre,
        tipo: catTipo,
        grupo: catGrupo,
        guardando: catGuardando,
        errorNombre: catErrNombre,
        error: catError,
        onNombre: (v) => {
          setCatNombre(v);
          if (catErrNombre) setCatErrNombre(null);
        },
        onTipo: setCatTipo,
        onGrupo: setCatGrupo,
        onCrear: crearCat,
        onCerrar: () => setCatAbierta(false),
      },
      importar: {
        visible: impAbierta,
        cuentas,
        cuenta: impCuenta,
        puedeElegir: puedeElegirArchivo(),
        leyendo: impLeyendo,
        error: impError,
        onCuenta: setImpCuenta,
        onElegir: leerArchivo,
        onCerrar: () => setImpAbierta(false),
      },
      elegirCategoria: {
        tipo: filaEligiendo ? (filaEligiendo.importe >= 0 ? 'ingreso' : 'gasto') : null,
        concepto: filaEligiendo?.concepto ?? '',
        propias,
        onElegir: (c) => {
          if (eligiendoFila === null) return;
          const { categoria, propia } = baseDe(c, propias);
          cambiarFila(eligiendoFila, (f) => ({ ...f, categoria, propia, interno: false }));
          setEligiendoFila(null);
        },
        onCerrar: () => setEligiendoFila(null),
      },
    },
    hojaConsentimiento: consentimiento.hoja,
  };
}
