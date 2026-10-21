// NIVL · Interruptores de Amigos.
//
// Las ligas privadas (0048) quedan ocultas en la 1.0.8: no se crean, no se
// invita, no se enseña tablero ni invitación. La lógica sigue entera en
// src/lib (competicionData, competition) y en <Competicion>; solo se apaga la
// entrada. 1.0.11 (FICHA-1011 §0): las ligas NO existen como producto;
// «Crear liga» y «Liga privada» no pueden verse. No se enciende sin decisión
// de Teferi (lo fija src/components/amigos/__tests__/ligasOcultas.test.ts).
export const LIGAS_VISIBLES = false;
