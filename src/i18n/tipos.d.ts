// NIVL · Idiomas: claves tipadas. `t('perfil:titulo')` no compila si la clave
// no está en src/i18n/es/perfil.json; el español es la fuente de verdad.
import 'i18next';
import type { RecursosEs } from './recursos';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'comun';
    resources: RecursosEs;
    returnNull: false;
  }
}
