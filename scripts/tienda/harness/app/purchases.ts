// Sin tienda real. Por defecto no hay catálogo y ProOffer pinta su lista de solo
// lectura. Solo en las escenas de revisión de compra (`catalogo` en escenas.json,
// scripts/tienda/revision-compra.mjs) sirve los diez productos con los precios de
// planesmodo.ts, para pintar la pantalla de compra real. No hay StoreKit y no se
// puede comprar: esas capturas se declaran así en la nota a Apple.
import { PRODUCTOS_MODO } from '@/lib/planesmodo';

const estado = (globalThis as unknown as { __TIENDA__: { catalogo?: boolean } }).__TIENDA__;
const noDisponible = async (): Promise<never> => {
  throw new Error('Sin compras en el arnés.');
};
const importe = (cents: number) => `${(cents / 100).toFixed(2).replace('.', ',')} €`;
const paquetes = () =>
  PRODUCTOS_MODO.map((p) => ({
    identifier: p.id,
    product: {
      identifier: p.id,
      priceString: importe(p.cents),
      price: p.cents / 100,
      introPrice: p.diasGratis
        ? { price: 0, priceString: '0,00 €', period: `P${p.diasGratis}D`, cycles: 1, periodUnit: 'DAY', periodNumberOfUnits: p.diasGratis }
        : null,
    },
  }));

let usuario = 'arnes';
export const PURCHASES_ERROR_CODE = {
  PURCHASE_CANCELLED_ERROR: '1', PAYMENT_PENDING_ERROR: '20', PURCHASE_NOT_ALLOWED_ERROR: '3',
  PRODUCT_NOT_AVAILABLE_FOR_PURCHASE_ERROR: '5', NETWORK_ERROR: '10',
};
export default {
  configure(o: { appUserID?: string }) { usuario = o?.appUserID ?? usuario; },
  logIn: async (id: string) => { usuario = id; return {}; },
  logOut: async () => ({}),
  setAttributes: async () => {},
  getAppUserID: async () => usuario,
  isConfigured: async () => true,
  getOfferings: async () => (estado.catalogo
    ? { current: { identifier: 'arnes', availablePackages: paquetes() }, all: {} }
    : { current: null, all: {} }),
  getProducts: async () => [],
  checkTrialOrIntroductoryPriceEligibility: async (ids: string[]) =>
    Object.fromEntries(ids.map((id) => [id, { status: 2 }])),
  getCustomerInfo: noDisponible,
  purchasePackage: noDisponible,
  restorePurchases: noDisponible,
};
