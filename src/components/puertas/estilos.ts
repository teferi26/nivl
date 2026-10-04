// NIVL · Puertas (FASE3, Lote B1): los estilos de texto que comparten la edad,
// el permiso de salud, el consentimiento de la IA y la denuncia.
//
// Solo RN y tokens: las pruebas de Seguridad (age, health, consentguard)
// simulan react-native con StyleSheet.create y poco más.
import { StyleSheet } from 'react-native';
import { ink, space, stroke, type as tipo } from '@/design/tokens';

/** Ancho máximo de la columna de una puerta: en tableta, 720 no se lee. */
export const ANCHO_PUERTA = 480;

export const texto = StyleSheet.create({
  cuerpo: {
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink8,
  },
  mensaje: {
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink9,
  },
  etiqueta: {
    fontFamily: tipo.label.family,
    fontSize: tipo.label.size,
    lineHeight: tipo.label.lineHeight,
    letterSpacing: tipo.label.tracking,
    textTransform: 'uppercase',
    color: ink.ink6,
  },
  marca: {
    flex: 1,
    minWidth: 0,
    fontFamily: 'Outfit_600SemiBold',
    fontSize: tipo.body.size,
    lineHeight: tipo.body.lineHeight,
    color: ink.ink10,
  },
  enlace: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink9,
    textDecorationLine: 'underline',
  },
  /** Zona táctil de 44 para un enlace de texto. */
  enlaceZona: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  /** Fila de marcar: Check + texto, 52 de alto como mínimo. */
  filaMarca: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s3,
    minHeight: 52,
    paddingVertical: space.s2,
  },
  /** Separación entre filas de una lista sin tarjetas. */
  hairline: { borderTopWidth: stroke.hairline, borderTopColor: ink.ink3 },
});
