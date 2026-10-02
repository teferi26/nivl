// NIVL · La tienda en web: no hay. Mismo contrato que `tienda.native.ts`.
//
// En web `purchasesAvailable()` es false (no hay clave ni módulo nativo), así
// que nada de esto se llama: existe para que `pro.ts` compile igual en las
// tres plataformas sin arrastrar el SDK de RevenueCat al bundle web. Los
// `import type` y `typeof import(...)` se borran al compilar: no añaden código.
import type * as RNPurchases from 'react-native-purchases';

const sinTienda = () => Promise.reject(new Error('Las compras no están disponibles en web.'));

/** Cualquier método rechaza: si algo lo llamase en web, no cobra nada. */
export const Purchases = new Proxy({}, { get: () => sinTienda }) as unknown as typeof RNPurchases.default;

/** Sin códigos de error de tienda en web: ninguna comparación coincide. */
export const PURCHASES_ERROR_CODE = {} as unknown as typeof RNPurchases.PURCHASES_ERROR_CODE;

export type {
  CustomerInfo,
  PurchasesError,
  PurchasesPackage,
  StoreProductChangeInfo,
} from 'react-native-purchases';
