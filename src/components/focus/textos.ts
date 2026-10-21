// NIVL · FOCUS: claves de i18n armadas en tiempo de ejecución (método y paso,
// día de la semana, instrucciones de cada sistema). Todas existen en
// src/i18n/es/focus.json: src/focus/__tests__/textos.test.ts lo comprueba.

import { t } from '@/i18n';

export const tf = t as unknown as (clave: string, opciones?: Record<string, unknown>) => string;
