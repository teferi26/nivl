// Display-only fixture of the configured Spain catalogue. No StoreKit call,
// transaction, receipt, customer identity, or entitlement is fabricated.
if (process.env.EXPO_PUBLIC_SCREENSHOT_MODE !== '1') {
  throw new Error('The screenshot purchases fixture cannot run outside screenshot mode.');
}
const catalogue = [
  ['nivl_pro_mensual', '12,99 €', 12.99, 'P1M'],
  ['nivl_pro_anual', '99,99 €', 99.99, 'P1Y'],
  ['nivl_elite_mensual', '29,99 €', 29.99, 'P1M'],
  ['nivl_elite_anual', '299,00 €', 299, 'P1Y'],
  ['nivl_elite_fundador', '249,00 €', 249, 'P1Y'],
] as const;

const availablePackages = catalogue.map(([identifier, priceString, price, subscriptionPeriod]) => ({
  identifier,
  packageType: 'CUSTOM',
  product: { identifier, priceString, price, subscriptionPeriod, currencyCode: 'EUR', title: identifier, description: '' },
  presentedOfferingContext: { offeringIdentifier: 'screenshot-local', placementIdentifier: null, targetingContext: null },
}));
const offering = { identifier: 'screenshot-local', serverDescription: 'Local catalogue fixture', metadata: {}, availablePackages };
const unavailable = async (): Promise<never> => { throw new Error('Purchases are disabled in the screenshot simulator.'); };

export const PURCHASES_ERROR_CODE = {
  PURCHASE_CANCELLED_ERROR: '1', PAYMENT_PENDING_ERROR: '20', PURCHASE_NOT_ALLOWED_ERROR: '3',
  PRODUCT_NOT_AVAILABLE_FOR_PURCHASE_ERROR: '5', NETWORK_ERROR: '10',
};
export default {
  configure() {},
  logIn: async () => ({}),
  logOut: async () => ({}),
  setAttributes: async () => {},
  getOfferings: async () => ({ current: offering, all: { 'screenshot-local': offering } }),
  purchasePackage: unavailable,
  restorePurchases: unavailable,
};
