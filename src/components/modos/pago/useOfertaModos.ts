// NIVL · La oferta por modos: su estado y sus efectos (tienda, compra,
// restaurar, consentimiento). La pintura está en OfertaModosVista, pura.
//
// El precio que se enseña y se cobra es el de la tienda. Sin tienda
// (`purchasesAvailable()` false) la vista pinta la lista de solo lectura.
// Separado de la vista para que el onboarding ponga los botones en su pie fijo.

import { useEffect, useRef, useState } from 'react';
import { Linking, Platform } from 'react-native';
import { useConsentimientoIA } from '@/components/ConsentimientoIA';
import { vibrar } from '@/design/haptics';
import { t } from '@/i18n';
import { registrar } from '@/lib/analitica';
import {
  modoDePerfil,
  precioVisible,
  preciosModosDeTienda,
  productoModo,
  pruebasModosDeTienda,
  purchaseModo,
  purchasesAvailable,
  restorePurchases,
  StorePriceChangedError,
  type Alcance,
  type ModoDePago,
  type Periodo,
  type PreciosModos,
  type ProductoModoId,
} from '@/lib/pro';
import { mensajeSistema } from '@/lib/validation';
import type { EstadoOfertaModos } from './OfertaModosVista';

export interface OpcionesOfertaModos {
  /** El modo que se enseña primero. Sin él, el del perfil de uso. */
  modoInicial?: ModoDePago | null;
  kind?: unknown;
  /** Abre con los cuatro modos elegidos (quien ya paga uno). */
  empezarEnTodos?: boolean;
  /** El producto que la cuenta ya paga en la tienda: no se vende otra vez. */
  actual?: string | null;
  onComprado?: () => void;
}

export function useOfertaModos({ modoInicial, kind, empezarEnTodos, actual, onComprado }: OpcionesOfertaModos): EstadoOfertaModos {
  const disponible = purchasesAvailable();
  const [periodo, setPeriodo] = useState<Periodo>('anual');
  const [pack, setPack] = useState<'todos' | 'uno'>(empezarEnTodos || !modoInicial ? 'todos' : 'uno');
  // Lo elegido a mano manda; si no, el modo pedido o el del perfil (en el onboarding llega después).
  const [modoElegido, setModo] = useState<ModoDePago | null>(null);
  const modo = modoElegido ?? modoInicial ?? modoDePerfil(kind);
  const [precios, setPrecios] = useState<PreciosModos>({});
  const [pruebas, setPruebas] = useState<Partial<Record<ProductoModoId, string>>>({});
  const [catalogo, setCatalogo] = useState<'cargando' | 'listo' | 'error'>('cargando');
  const [intento, setIntento] = useState(0);
  const [busy, setBusy] = useState<'compra' | 'restaurar' | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [sinPermiso, setSinPermiso] = useState(false);
  const [avisoEnlace, setAvisoEnlace] = useState(false);
  const lock = useRef(false);
  const consentimiento = useConsentimientoIA();

  useEffect(() => {
    if (!disponible) return;
    let vivo = true;
    Promise.all([preciosModosDeTienda(), pruebasModosDeTienda()])
      .then(([p, d]) => {
        if (!vivo) return;
        setPrecios(p);
        setPruebas(d);
        setCatalogo('listo');
      })
      .catch(() => {
        if (!vivo) return;
        setPrecios({});
        setCatalogo('error');
      });
    return () => {
      vivo = false;
    };
  }, [disponible, intento]);

  const alcance: Alcance = pack === 'todos' ? 'todos' : modo;
  const producto = productoModo(alcance, periodo);
  const precioDe = (a: Alcance) => precioVisible(precios[productoModo(a, periodo).id]);
  const precio = precioVisible(precios[producto.id]);
  const esActual = !!actual && actual.split(':')[0] === producto.id;
  const puedeComprar = disponible && catalogo === 'listo' && precio !== null && !esActual;

  const reintentar = () => {
    if (lock.current) return;
    setPrecios({});
    setCatalogo('cargando');
    setIntento((n) => n + 1);
  };

  const conCerrojo = async (que: 'compra' | 'restaurar', fn: () => Promise<void>) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(que);
    setAviso(null);
    setSinPermiso(false);
    try {
      await fn();
    } catch (e) {
      vibrar('penalizacion');
      setAviso(mensajeSistema(e));
    } finally {
      lock.current = false;
      setBusy(null);
    }
  };

  const permiso = async (): Promise<boolean> => {
    const ok = await consentimiento.asegurar();
    setSinPermiso(!ok);
    setAviso(ok ? null : t('oferta:pago.aviso.sinPermiso'));
    return ok;
  };

  const onComprar = async () => {
    if (lock.current || !puedeComprar || !precio) return;
    if (!(await permiso())) return;
    return conCerrojo('compra', async () => {
      registrar('compra_iniciada', { plan: producto.id });
      const r = await purchaseModo(producto.id, precio).catch((e: unknown) => {
        if (e instanceof StorePriceChangedError) {
          setPrecios({});
          setCatalogo('cargando');
          setIntento((n) => n + 1);
        }
        throw e;
      });
      if (r === 'cancelada') return;
      registrar('compra_ok', { plan: producto.id, resultado: r });
      if (r === 'pendiente') setAviso(t('oferta:pago.aviso.pendiente'));
      if (r === 'programada') setAviso(t('oferta:pago.aviso.programada'));
      vibrar('mision');
      onComprado?.();
    });
  };

  const onRestaurar = () =>
    conCerrojo('restaurar', async () => {
      const r = await restorePurchases();
      if (r === 'nada') {
        setAviso(t('oferta:pago.aviso.nada'));
        return;
      }
      if (r === 'pendiente') setAviso(t('oferta:pago.aviso.pendiente'));
      vibrar('mision');
      onComprado?.();
    });

  const elegir = (fn: () => void) => {
    if (lock.current) return;
    vibrar('seleccion');
    fn();
  };

  return {
    disponible,
    catalogo,
    periodo,
    pack,
    modo,
    producto,
    precio,
    precioDe,
    periodoGratis: pruebas[producto.id] ?? null,
    esActual,
    puedeComprar,
    busy,
    aviso,
    sinPermiso,
    avisoEnlace,
    plataforma: Platform.OS,
    onPeriodo: (p) => elegir(() => setPeriodo(p)),
    onPack: (p) => elegir(() => setPack(p)),
    onModo: (m) => elegir(() => setModo(m)),
    onComprar,
    onRestaurar,
    onReintentar: reintentar,
    onRevisarPermiso: () => void permiso(),
    onAbrir: (url) => {
      setAvisoEnlace(false);
      Linking.openURL(url).catch(() => setAvisoEnlace(true));
    },
    hoja: consentimiento.hoja,
  };
}
