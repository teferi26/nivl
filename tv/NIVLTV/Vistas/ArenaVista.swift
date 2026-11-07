// NIVL TV · Arena: el tablero de amigos y tu ludus a pantalla completa.
//
// Izquierda, el ranking de la semana (`friends_board`, ya ordenado por el
// servidor); al moverte con el mando, la ficha de la derecha enseña al
// gladiador que tiene el foco. Debajo, tu ludus Élite (`elite_group_board`),
// que no reparte XP ni puestos: va por nombre.
// Los puestos se dicen con el peso del trazo, no con color.

import SwiftUI

struct ArenaVista: View {
    var filas: [FilaArena] = Demo.arena
    var ludus: LudusTV? = Demo.ludus

    @FocusState private var enfocada: String?

    private var seleccion: FilaArena? {
        filas.first { $0.id == enfocada } ?? filas.first { $0.soyYo } ?? filas.first
    }

    var body: some View {
        HStack(alignment: .top, spacing: Hueco.s14) {
            VStack(alignment: .leading, spacing: Hueco.s6) {
                EncabezadoTV(ceja: "Arena · últimos 7 días", titulo: "Tu tabla")
                cabeceraTabla
                ScrollView {
                    LazyVStack(spacing: Hueco.s4) {
                        ForEach(Array(filas.enumerated()), id: \.element.id) { i, fila in
                            Button {} label: { FilaRanking(puesto: i + 1, fila: fila) }
                                .buttonStyle(EstiloFila(marco: i < 3 ? Trazo.rule : Trazo.hairline))
                                .focused($enfocada, equals: fila.id)
                        }
                    }
                    // Holgura para la escala de foco (×1,03): así la lista
                    // se recorta en su marco sin morder el marco blanco y no
                    // asoma por debajo del área segura.
                    .padding(.vertical, Hueco.s4)
                    .padding(.horizontal, Hueco.s4)
                }
                .clipped()
                // Las filas que siguen se funden en vez de cortarse en seco.
                .mask(
                    VStack(spacing: 0) {
                        Rectangle()
                        LinearGradient(colors: [.black, .clear], startPoint: .top, endPoint: .bottom)
                            .frame(height: 60)
                    }
                )
            }
            .frame(maxWidth: .infinity)

            VStack(alignment: .leading, spacing: Hueco.s6) {
                if let s = seleccion { FichaGladiador(fila: s) }
                if let ludus { TablaLudus(ludus: ludus) }
            }
            .frame(width: 580)
        }
        .padding(.horizontal, Hueco.margenLateral)
        .padding(.top, Hueco.bajoPestanas)
        .padding(.bottom, Hueco.s8)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .animation(.easeOut(duration: Foco.duracion), value: enfocada)
    }

    private var cabeceraTabla: some View {
        HStack(spacing: Hueco.s6) {
            Rotulo(texto: "#").frame(width: 70, alignment: .leading)
            Rotulo(texto: "Gladiador").frame(maxWidth: .infinity, alignment: .leading)
            Rotulo(texto: "XP 7 días").frame(width: 170, alignment: .trailing)
            Rotulo(texto: "Racha").frame(width: 110, alignment: .trailing)
            Rotulo(texto: "Cumple").frame(width: 120, alignment: .trailing)
        }
        .padding(.horizontal, Hueco.s8)
    }
}

private struct FilaRanking: View {
    let puesto: Int
    let fila: FilaArena

    var body: some View {
        HStack(spacing: Hueco.s6) {
            Text("\(puesto)")
                .font(Tipo.numero)
                .foregroundStyle(puesto <= 3 ? Tinta.i10 : Tinta.i6)
                .frame(width: 70, alignment: .leading)
            HStack(spacing: Hueco.s4) {
                SelloRango(rango: fila.rango)
                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: Hueco.s3) {
                        Text(fila.nombre)
                            .font(Tipo.titular)
                            .foregroundStyle(Tinta.i10)
                            .lineLimit(1)
                            .fixedSize()
                        if fila.elite { LaurelElite(tam: 24) }
                        if fila.soyYo {
                            Text("TÚ")
                                .font(Tipo.rotulo)
                                .tracking(2)
                                .foregroundStyle(Tinta.i0)
                                .padding(.horizontal, 10)
                                .padding(.vertical, 2)
                                .background(Tinta.i10)
                                .fixedSize()
                        }
                    }
                    Text(fila.titulo).font(Tipo.rotulo).foregroundStyle(Tinta.i6)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            Text(Formato.miles(fila.xpVentana))
                .font(Tipo.numero).foregroundStyle(Tinta.i10).monospacedDigit()
                .frame(width: 170, alignment: .trailing)
            Text("\(fila.racha)")
                .font(Tipo.numero).foregroundStyle(Tinta.i9).monospacedDigit()
                .frame(width: 110, alignment: .trailing)
            Text("\(fila.cumplimientoPct) %")
                .font(Tipo.cuerpo).foregroundStyle(Tinta.i8).monospacedDigit()
                .frame(width: 120, alignment: .trailing)
        }
        .padding(.horizontal, Hueco.s8)
        .padding(.vertical, Hueco.s4)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Puesto \(puesto), \(fila.nombre), rango \(fila.rango), \(fila.xpVentana) XP, racha de \(fila.racha) días")
    }
}

/// Letra de rango en un marco cuyo grosor crece con el rango.
private struct SelloRango: View {
    let rango: String
    private var marco: CGFloat {
        switch rango {
        case "E": return 2
        case "D", "C": return 4
        default: return 6
        }
    }

    var body: some View {
        Text(rango)
            .font(Tipo.numero)
            .foregroundStyle(Tinta.i10)
            .frame(width: 64, height: 64)
            .overlay(Rectangle().strokeBorder(Tinta.i10, lineWidth: marco))
            .accessibilityHidden(true)
    }
}

private struct FichaGladiador: View {
    let fila: FilaArena

    var body: some View {
        let n = Juego.nivel(xp: fila.xpTotal)
        Tarjeta(marco: Trazo.frame, relleno: Hueco.s6) {
            VStack(alignment: .leading, spacing: Hueco.s4) {
                HStack(alignment: .center, spacing: Hueco.s4) {
                    Inscripcion(texto: "Rango \(fila.rango) · \(fila.titulo)")
                    if fila.elite { LaurelElite(tam: 26) }
                }
                HStack(alignment: .lastTextBaseline, spacing: Hueco.s6) {
                    Text("\(n.nivel)")
                        .font(Tipo.monumento(110))
                        .foregroundStyle(Tinta.i10)
                    VStack(alignment: .leading, spacing: Hueco.s2) {
                        Rotulo(texto: "Nivel")
                        Text(fila.nombre).font(Tipo.titulo).foregroundStyle(Tinta.i10).lineLimit(1).minimumScaleFactor(0.6)
                    }
                }
                Barra(fraccion: n.fraccion)
                Text("\(Formato.miles(n.dentro)) de \(Formato.miles(n.siguiente)) XP al nivel \(n.nivel + 1)")
                    .font(Tipo.cuerpoSm)
                    .foregroundStyle(Tinta.i8)
                HStack(spacing: Hueco.s8) {
                    Cifra(rotulo: "Racha", valor: "\(fila.racha)", unidad: "días")
                    Cifra(rotulo: "Cumple", valor: "\(fila.cumplimientoPct)", unidad: "%")
                }
            }
        }
        .id(fila.id)
        .transition(.opacity)
    }
}

private struct TablaLudus: View {
    let ludus: LudusTV

    var body: some View {
        // La ficha no tiene foco ni scroll: caben `maxFilas` miembros y el
        // resto se resume en una línea (tú siempre sales).
        let visibles = Self.visibles(ludus.miembros)
        let resto = ludus.miembros.count - visibles.count
        return Tarjeta(marco: Trazo.hairline, relleno: Hueco.s6) {
            VStack(alignment: .leading, spacing: Hueco.s3) {
                HStack(spacing: Hueco.s3) {
                    LaurelElite(tam: 26)
                    Inscripcion(texto: "Tu ludus · \(ludus.nombre)", color: Tinta.i10)
                        .lineLimit(1)
                        .minimumScaleFactor(0.7)
                }
                ForEach(visibles) { m in
                    HStack {
                        Text(m.nombre)
                            .font(Tipo.cuerpo)
                            .foregroundStyle(m.soyYo ? Tinta.i10 : Tinta.i9)
                            .underline(m.soyYo, color: Tinta.i10)
                        Spacer()
                        Text(Formato.miles(m.xpVentana)).font(Tipo.cuerpo).foregroundStyle(Tinta.i10).monospacedDigit()
                        Text("\(m.cumplimientoPct) %")
                            .font(Tipo.cuerpoSm).foregroundStyle(Tinta.i6).monospacedDigit()
                            .frame(width: 100, alignment: .trailing)
                    }
                    .accessibilityElement(children: .combine)
                }
                if resto > 0 {
                    Text(resto == 1 ? "y 1 más en el iPhone" : "y \(resto) más en el iPhone")
                        .font(Tipo.rotulo)
                        .foregroundStyle(Tinta.i6)
                }
            }
        }
    }

    static let maxFilas = 4

    static func visibles(_ miembros: [FilaLudus]) -> [FilaLudus] {
        guard miembros.count > maxFilas else { return miembros }
        var v = Array(miembros.prefix(maxFilas))
        if !v.contains(where: { $0.soyYo }), let yo = miembros.first(where: { $0.soyYo }) {
            v[maxFilas - 1] = yo
        }
        return v
    }
}
