// NIVL · Economía: datos, efectos y cerrojos (patrón L-RADICAL §C, FASE3 G2).
// Cortado y pegado de la ruta: la carga de seis meses, la vista calculada con
// moneymath, clasificar con IA (con su candado y el camino a Pro), clasificar
// a mano y registrar efectivo. Cómo se guarda y se suma el dinero es de
// src/lib/money.ts y src/lib/moneymath.ts y aquí solo se consume (los
// traspasos entre cuentas propias los descarta resumenPorMes).
//
// Cambios de presentación respecto a la ruta vieja:
//   · La carga ya no avisa con un diálogo: deja `errorCarga` para la vista
//     (ErrorSistema con «Reintentar») y un `cargado` para pintar huecos.
//   · Los fallos de las dos hojas van en línea dentro de la hoja: el importe y
//     el concepto como error de su Campo (mismas frases de antes) y el del
//     servidor en un ErrorSistema compacto. Nada de avisos encima de una hoja.
//   · «El sistema aprende» ya no abre un aviso mientras la hoja se cierra: la
//     vista lo enseña como nota bajo el encabezado.
//   · Títulos de aviso «El sistema no responde» y `penalizacion` en el catch
//     de cada acción del usuario (no en la carga). Guardar efectivo no da XP:
//     sin vibración.

import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { useConsentimientoIA } from '@/components/ConsentimientoIA';
import { avisar, confirmar } from '@/components/ui/confirmar';
import { volver } from '@/components/ui/Screen';
import { vibrar } from '@/design/haptics';
import { useAuth } from '@/lib/auth';
import { accessNotice, clasificarMovimientos, CoachAccessError } from '@/lib/coach';
import { addDays, dateKey } from '@/lib/dates';
import {
  fetchAccounts,
  fetchBudgets,
  fetchMoneyPlan,
  fetchTransactions,
  recategorizar,
  registrarEfectivo,
  type Budget,
  type Categoria,
  type MoneyAccount,
  type MoneyPlan,
  type Transaction,
} from '@/lib/money';
import { mensajeSistema } from '@/lib/validation';
import { calcularEconomia } from './calculo';
import type { EconomiaVistaProps } from './EconomiaVista';
import type { HojaClasificarProps, HojaEfectivoProps } from './HojasEconomia';

export interface UsoEconomia {
  vista: EconomiaVistaProps;
  hojaClasificar: HojaClasificarProps;
  hojaEfectivo: HojaEfectivoProps;
  /** La hoja del consentimiento de IA (se pinta debajo de todo). */
  hojaConsentimiento: ReactNode;
}

export function useEconomia(): UsoEconomia {
  const consentimiento = useConsentimientoIA();
  const { session } = useAuth();
  const userId = session?.user.id;
  const hoy = dateKey();

  const [movs, setMovs] = useState<Transaction[]>([]);
  const [cuentas, setCuentas] = useState<MoneyAccount[]>([]);
  const [plan, setPlan] = useState<MoneyPlan | null>(null);
  const [presupuestos, setPresupuestos] = useState<Budget[]>([]);
  const [editando, setEditando] = useState<Transaction | null>(null);
  const [nuevoAbierto, setNuevoAbierto] = useState(false);
  const [importe, setImporte] = useState('');
  const [concepto, setConcepto] = useState('');
  const [catNueva, setCatNueva] = useState<Categoria>('otros');
  const [guardando, setGuardando] = useState(false);
  const [clasificando, setClasificando] = useState(false);
  const [cargado, setCargado] = useState(false);
  const [refrescando, setRefrescando] = useState(false);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [errorClasificar, setErrorClasificar] = useState<string | null>(null);
  const [errorImporte, setErrorImporte] = useState<string | null>(null);
  const [errorConcepto, setErrorConcepto] = useState<string | null>(null);
  const [errorEfectivo, setErrorEfectivo] = useState<string | null>(null);
  const [aprendido, setAprendido] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      const [t, c, p, b] = await Promise.all([
        fetchTransactions(addDays(hoy, -180)),
        fetchAccounts(),
        fetchMoneyPlan(),
        fetchBudgets(),
      ]);
      setMovs(t);
      setCuentas(c);
      setPlan(p);
      setPresupuestos(b);
      setErrorCarga(null);
    } catch (e) {
      setErrorCarga(mensajeSistema(e));
    } finally {
      setCargado(true);
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

  const datos = useMemo(() => calcularEconomia(movs, cuentas, plan, hoy), [movs, cuentas, plan, hoy]);

  // Pasa por Haiku, no por el coach: leer "MERCADONA 4471" y decir que es
  // supermercado no pide criterio, y hacerlo con el modelo del coach costaría
  // cien veces más por arrastrar todo su contexto para nada.
  const clasificarTodo = async () => {
    if (clasificando) return;
    if (!(await consentimiento.asegurar())) return;
    setClasificando(true);
    try {
      const r = await clasificarMovimientos();
      await cargar();
      avisar(r.clasificados ? 'El sistema ha clasificado' : 'Sin cambios', r.texto);
    } catch (e) {
      if (e instanceof CoachAccessError) {
        // La clasificación automática es IA y pasa por el mismo candado que el
        // coach. No es un error: clasificar a mano sigue funcionando, y quien
        // quiera la automática tiene el camino a Pro.
        // Dos casos: sin suscripción se ofrece Pro (dos botones, uno lleva a
        // /pro); con cualquier otro motivo es un aviso de un solo botón.
        if (e.reason === 'sin_suscripcion') {
          const verPro = await confirmar({
            titulo: 'Clasificación automática',
            mensaje:
              'Que el sistema clasifique por ti es parte de NIVL Pro. Puedes seguir clasificando a mano: toca un movimiento y el sistema aprende la regla.',
            confirmar: 'Ver NIVL Pro',
            cancelar: 'Ahora no',
          });
          if (verPro) router.push('/pro');
        } else {
          avisar('El sistema', accessNotice(e));
        }
      } else {
        vibrar('penalizacion');
        avisar('El sistema no responde', mensajeSistema(e));
      }
    } finally {
      setClasificando(false);
    }
  };

  const aplicarCategoria = async (cat: Categoria) => {
    if (!editando || !userId) return;
    setErrorClasificar(null);
    try {
      const n = await recategorizar(userId, editando, cat, true);
      setEditando(null);
      await cargar();
      if (n > 1) {
        setAprendido(`${n} movimientos clasificados. A partir de ahora lo hace solo.`);
      }
    } catch (e) {
      vibrar('penalizacion');
      setErrorClasificar(mensajeSistema(e));
    }
  };

  const guardarEfectivo = async () => {
    if (!userId || guardando) return;
    const n = Number(importe.replace(',', '.'));
    if (!Number.isFinite(n) || n === 0) {
      setErrorImporte('Escribe el importe. Negativo si es gasto, positivo si es ingreso.');
      return;
    }
    setErrorImporte(null);
    if (!concepto.trim()) {
      setErrorConcepto('Dentro de un mes no vas a recordar qué fue.');
      return;
    }
    setErrorConcepto(null);
    setErrorEfectivo(null);
    setGuardando(true);
    try {
      await registrarEfectivo(userId, {
        date: hoy,
        amount: n,
        description: concepto.trim(),
        category: catNueva,
      });
      setNuevoAbierto(false);
      setImporte('');
      setConcepto('');
      await cargar();
    } catch (e) {
      vibrar('penalizacion');
      setErrorEfectivo(mensajeSistema(e));
    } finally {
      setGuardando(false);
    }
  };

  const cerrarClasificar = () => {
    setEditando(null);
    setErrorClasificar(null);
  };
  const cerrarEfectivo = () => {
    setNuevoAbierto(false);
    setErrorImporte(null);
    setErrorConcepto(null);
    setErrorEfectivo(null);
  };

  return {
    vista: {
      cargado,
      errorCarga,
      refrescando,
      hayMovimientos: movs.length > 0,
      datos,
      plan,
      presupuestos,
      clasificando,
      aprendido,
      acciones: {
        onVolver: () => volver(router),
        onRefrescar: refrescar,
        onReintentar: cargar,
        onNuevo: () => setNuevoAbierto(true),
        onEditar: (m) => {
          setAprendido(null);
          setErrorClasificar(null);
          setEditando(m);
        },
        onClasificarTodo: clasificarTodo,
        onOlvidarAprendido: () => setAprendido(null),
      },
    },
    hojaClasificar: {
      movimiento: editando,
      error: errorClasificar,
      onElegir: aplicarCategoria,
      onCerrar: cerrarClasificar,
    },
    hojaEfectivo: {
      visible: nuevoAbierto,
      importe,
      concepto,
      categoria: catNueva,
      guardando,
      errorImporte,
      errorConcepto,
      error: errorEfectivo,
      onImporte: (v) => {
        setImporte(v);
        if (errorImporte) setErrorImporte(null);
      },
      onConcepto: (v) => {
        setConcepto(v);
        if (errorConcepto) setErrorConcepto(null);
      },
      onCategoria: setCatNueva,
      onGuardar: guardarEfectivo,
      onCerrar: cerrarEfectivo,
    },
    hojaConsentimiento: consentimiento.hoja,
  };
}
