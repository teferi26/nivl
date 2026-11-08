// NIVL · Captura de la tarjeta en la web. Solo existe en capturaTarjeta.web.ts:
// en nativo captura `react-native-view-shot`, y html2canvas no entra en el
// paquete del móvil.

import type { View } from 'react-native';

export async function capturarTarjetaWeb(_vista: View, _opciones: { ancho: number; formato: 'png' | 'jpg'; calidad: number }): Promise<string | null> {
  return null;
}

export function descargarImagenWeb(_nombre: string, _dataUrl: string): void {}

export function comparteArchivosWeb(): boolean {
  return false;
}

export async function compartirImagenWeb(_nombre: string, _dataUrl: string): Promise<'compartida' | 'cancelada' | 'imposible'> {
  return 'imposible';
}
