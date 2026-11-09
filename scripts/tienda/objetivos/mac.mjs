// Objetivo Mac: NIVL no tiene app nativa de Mac ni hay simulador de macOS. La web
// a tamaño de escritorio sería otro producto, así que no se presenta como captura
// de Mac: sale en el objetivo web. Una app de iPad en un Mac usa las capturas de iPad.
export default {
  id: 'mac',
  familia: 'mac',
  disponible() {
    return { ok: false, motivo: 'sin app nativa de Mac ni simulador de macOS no hay captura real' };
  },
  async capturar() {
    return [];
  },
};
