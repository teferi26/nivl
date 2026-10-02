// NIVL · La tienda en iOS y Android: RevenueCat tal cual.
//
// Metro elige este archivo en nativo y `tienda.ts` en web (extensiones por
// plataforma). Así el SDK de RevenueCat (y su capa web de ~1 MB) no entra en
// el bundle web, donde nunca se compra (`purchasesAvailable()` es false).
export { default as Purchases, PURCHASES_ERROR_CODE } from 'react-native-purchases';
export type {
  CustomerInfo,
  PurchasesError,
  PurchasesPackage,
  StoreProductChangeInfo,
} from 'react-native-purchases';
