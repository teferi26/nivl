// La tienda sigue cerrada (sin clave de RevenueCat): ProOffer pinta su lista de
// solo lectura. Si algo llamase aquí, no hay catálogo ni compra posible.
const noDisponible = async (): Promise<never> => {
  throw new Error('Sin compras en el arnés.');
};
export const PURCHASES_ERROR_CODE = {
  PURCHASE_CANCELLED_ERROR: '1', PAYMENT_PENDING_ERROR: '20', PURCHASE_NOT_ALLOWED_ERROR: '3',
  PRODUCT_NOT_AVAILABLE_FOR_PURCHASE_ERROR: '5', NETWORK_ERROR: '10',
};
export default {
  configure() {},
  logIn: async () => ({}),
  logOut: async () => ({}),
  setAttributes: async () => {},
  getOfferings: async () => ({ current: null, all: {} }),
  getCustomerInfo: noDisponible,
  purchasePackage: noDisponible,
  restorePurchases: noDisponible,
};
