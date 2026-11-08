// NIVL TV · Arena: el tablero de amigos y tu ludus a pantalla completa.
//
// Izquierda, el ranking de la semana (ya ordenado por el servidor). Las filas
// tienen foco pero no son botones: el foco recorre la tabla y la ficha de la
// derecha enseña lo que la fila no dice, el nivel. Sin foco, la ficha eres tú.
// Debajo, tu ludus, que no reparte puestos: va en el orden que da el servidor.
// Los puestos se dicen con el peso del trazo, no con color.

import SwiftUI

struct ArenaVista: View {
    let filas: [FilaArena]
    let ludus: LudusTV?

    @FocusState private var enfocada: String?
    /// El foco ya ha entrado en la tabla desde que se abrió la pestaña.
    @State private var yaEntro = false

    private var seleccion: FilaArena? {
        filas.first { $0.id == enfocada } ?? filas.first { $0.soyYo } ?? filas.first
    }

    private var idPropia: String? { filas.first { $0.soyYo }?.id }

    var body: some View {
        HStack(alignment: .top, spacing: Hueco.s14) {
            VStack(alignment: .leading, spacing: Hueco.s4) {
                HStack(alignment: .bottom) {
                    EncabezadoTV(ceja: "Arena · últimos 7 días", titulo: Textos.arenaTitulo)
                    Spacer(minLength: Hueco.s8)
                    if let p = PuestoArena.propio(filas), p.total > 1 {
                        Cifra(rotulo: "Tu puesto", valor: "\(p.puesto)", unidad: "de \(p.total)")
                            .fixedSize()
                    }
                }
                if filas.isEmpty {
                    Text(Textos.arenaVacia)
                        .font(Tipo.cuerpo)
                        .foregroundStyle(Tinta.i8)
                        .lineLimit(2)
                } else {
                    cabeceraTabla
                    tabla
                }
            }
            .frame(maxWidth: .infinity)

            if seleccion != nil || ludus != nil {
                VStack(alignment: .leading, spacing: Hueco.s6) {
                    if let s = seleccion {
                        FichaGladiador(fila: s)
                            .animation(.easeOut(duration: Foco.duracion), value: enfocada)
                    }
                    if let ludus { TablaLudus(ludus: ludus) }
                }
                .frame(width: 560)
            }
        }
        .modifier(MargenPestana())
    }

    private var tabla: some View {
        ScrollViewReader { lector in
            ScrollView {
                // Sin Lazy: son 200 filas como mucho, y así tu fila existe y puede
                // recibir el foco aunque esté muy abajo.
                VStack(spacing: Hueco.s4) {
                    ForEach(Array(filas.enumerated()), id: \.element.id) { i, fila in
                        let celda = FilaRanking(puesto: i + 1, fila: fila, enfocada: enfocada == fila.id)
                        celda
                            .focusable()
                            .focused($enfocada, equals: fila.id)
                            .accessibilityElement(children: .ignore)
                            .accessibilityLabel(celda.etiqueta)
                            .accessibilityIdentifier(fila.soyYo ? "filaPropia" : "filaArena")
                            .id(fila.id)
                    }
                    if filas.count == 1 {
                        Text(Textos.arenaSinAmigos)
                            .font(Tipo.cuerpoSm)
                            .foregroundStyle(Tinta.i8)
                            .lineLimit(2)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(.top, Hueco.s4)
                    }
                }
                // Holgura para la escala de foco (×1,05): la lista se recorta
                // en su marco sin morder el marco blanco.
                .padding(.vertical, Hueco.s4)
                .padding(.horizontal, Hueco.s8)
            }
            .focusSection()
            // Al bajar desde las pestañas, a tu fila y no a la primera que asome.
            // Ni defaultFocus ni prefersDefaultFocus lo consiguen en una lista
            // desplazada (probado con el mando en tvOS): se redirige a mano, y
            // solo la primera vez, para no mover el foco al volver de segundo plano.
            .onChange(of: enfocada) { _, ahora in
                guard ahora != nil, !yaEntro else { return }
                yaEntro = true
                if ahora != idPropia, let idPropia { enfocada = idPropia }
            }
            .clipped()
            // Hasta el borde del área segura: la fila siguiente asoma y se ve que hay más.
            .padding(.bottom, -Hueco.s8)
            .onAppear {
                yaEntro = false
                guard let idPropia else { return }
                lector.scrollTo(idPropia, anchor: .center)
            }
        }
    }

    private var cabeceraTabla: some View {
        HStack(spacing: Hueco.s6) {
            Rotulo(texto: "#").frame(width: FilaRanking.anchoPuesto, alignment: .leading)
            Rotulo(texto: "Gladiador").frame(maxWidth: .infinity, alignment: .leading)
            Rotulo(texto: "XP 7 días").frame(width: FilaRanking.anchoXP, alignment: .trailing)
            Rotulo(texto: "Racha").frame(width: FilaRanking.anchoRacha, alignment: .trailing)
            Rotulo(texto: "Cumplido").frame(width: FilaRanking.anchoCumple, alignment: .trailing)
        }
        .padding(.horizontal, Hueco.s8 + Hueco.s6)
        .accessibilityHidden(true)
    }
}

private struct FilaRanking: View {
    let puesto: Int
    let fila: FilaArena
    let enfocada: Bool

    static let anchoPuesto: CGFloat = 88
    static let anchoXP: CGFloat = 150
    static let anchoRacha: CGFloat = 100
    static let anchoCumple: CGFloat = 170

    var body: some View {
        HStack(spacing: Hueco.s6) {
            Text("\(puesto)")
                .font(Tipo.numero)
                .foregroundStyle(puesto <= 3 ? Tinta.i10 : Tinta.i6)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
                .frame(width: Self.anchoPuesto, alignment: .leading)
            HStack(spacing: Hueco.s4) {
                SelloRango(rango: fila.rango)
                VStack(alignment: .leading, spacing: 2) {
                    Text(fila.nombre)
                        .font(Tipo.titular)
                        .foregroundStyle(Tinta.i10)
                        .lineLimit(1)
                        .truncationMode(.tail)
                    HStack(spacing: Hueco.s3) {
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
                        if fila.elite { LaurelElite(tam: 24).fixedSize() }
                        Text(fila.titulo)
                            .font(Tipo.cuerpoSm)
                            .foregroundStyle(Tinta.i8)
                            .lineLimit(1)
                            .truncationMode(.tail)
                    }
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            Text(Formato.miles(fila.xpVentana))
                .font(Tipo.numero).foregroundStyle(Tinta.i10).monospacedDigit()
                .lineLimit(1).minimumScaleFactor(0.7)
                .frame(width: Self.anchoXP, alignment: .trailing)
            Text("\(fila.racha)")
                .font(Tipo.numero).foregroundStyle(Tinta.i9).monospacedDigit()
                .lineLimit(1).minimumScaleFactor(0.7)
                .frame(width: Self.anchoRacha, alignment: .trailing)
            Text(Formato.cumple(fila.cumplimientoPct))
                .font(fila.cumplimientoPct == nil ? Tipo.cuerpoSm : Tipo.cuerpo).foregroundStyle(Tinta.i8).monospacedDigit()
                .lineLimit(1)
                .fixedSize()
                .frame(width: Self.anchoCumple, alignment: .trailing)
        }
        .padding(.horizontal, Hueco.s6)
        .padding(.vertical, Hueco.s4)
        .background(enfocada ? Tinta.i2 : Tinta.i1, ignoresSafeAreaEdges: [])
        // Con foco se ve desde el sofá: marco grueso y escala. Tu fila ya lleva su etiqueta TÚ.
        .overlay(Rectangle().strokeBorder(enfocada ? Tinta.i10 : (fila.soyYo ? Tinta.i8 : Tinta.i3),
                                          lineWidth: enfocada ? Trazo.frame : (puesto <= 3 && !fila.soyYo ? Trazo.rule : Trazo.hairline)))
        .scaleEffect(enfocada ? 1.05 : 1)
        .animation(.easeOut(duration: Foco.duracion), value: enfocada)
    }

    var etiqueta: String {
        var partes = ["Puesto \(puesto)", fila.nombre]
        if fila.soyYo { partes.append("tú") }
        partes += ["rango \(fila.rango)", "\(fila.xpVentana) XP", "racha de \(fila.racha) días"]
        partes.append(fila.cumplimientoPct.map { "cumple \($0) por ciento" } ?? "cumplimiento sin medir")
        return partes.joined(separator: ", ")
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

/// Lo que la fila no cuenta: el nivel y lo que le falta para el siguiente.
private struct FichaGladiador: View {
    let fila: FilaArena

    var body: some View {
        let n = Juego.nivel(xp: fila.xpTotal)
        Tarjeta(marco: Trazo.frame, relleno: Hueco.s6) {
            VStack(alignment: .leading, spacing: Hueco.s4) {
                Text(fila.nombre)
                    .font(Tipo.titular)
                    .foregroundStyle(Tinta.i10)
                    .lineLimit(1)
                    .truncationMode(.tail)
                HStack(alignment: .lastTextBaseline, spacing: Hueco.s4) {
                    Text("\(n.nivel)")
                        .font(Tipo.monumento(96))
                        .foregroundStyle(Tinta.i10)
                        .lineLimit(1)
                        .minimumScaleFactor(0.6)
                    VStack(alignment: .leading, spacing: Hueco.s2) {
                        Rotulo(texto: "Nivel")
                        HStack(spacing: Hueco.s3) {
                            Text("Rango \(fila.rango) · \(fila.titulo)")
                                .font(Tipo.cuerpoSm)
                                .foregroundStyle(Tinta.i8)
                                .lineLimit(1)
                                .truncationMode(.tail)
                            if fila.elite { LaurelElite(tam: 24).fixedSize() }
                        }
                    }
                }
                Barra(fraccion: n.fraccion)
                Text(n.siguiente > 0
                     ? "\(Formato.miles(n.dentro)) de \(Formato.miles(n.siguiente)) XP al nivel \(n.nivel + 1)"
                     : "Nivel máximo")
                    .font(Tipo.cuerpoSm)
                    .foregroundStyle(Tinta.i8)
                    .lineLimit(1)
            }
        }
        .accessibilityElement(children: .combine)
    }
}

/// El ludus tal como lo manda el servidor: sin puestos y sin reordenar por puntos.
private struct TablaLudus: View {
    let ludus: LudusTV

    var body: some View {
        // La ficha no tiene foco ni scroll: caben `maxFilas` miembros (el aforo
        // máximo de un ludus) y el resto se resume en una línea.
        let visibles = Self.visibles(ludus.miembros)
        let resto = ludus.miembros.count - visibles.count
        return Tarjeta(marco: Trazo.hairline, relleno: Hueco.s6) {
            VStack(alignment: .leading, spacing: Hueco.s2) {
                HStack(spacing: Hueco.s3) {
                    LaurelElite(tam: 26).fixedSize()
                    Inscripcion(texto: "Tu ludus · \(ludus.nombre)", color: Tinta.i10)
                        .lineLimit(1)
                        .truncationMode(.tail)
                }
                HStack(spacing: Hueco.s4) {
                    Spacer(minLength: 0)
                    Rotulo(texto: "XP 7 días")
                    Rotulo(texto: "Cumplido").frame(width: Self.anchoCumplido, alignment: .trailing)
                }
                .accessibilityHidden(true)
                ForEach(visibles) { m in
                    HStack(spacing: Hueco.s4) {
                        Text(m.nombre)
                            .font(Tipo.cuerpoSm)
                            .foregroundStyle(m.soyYo ? Tinta.i10 : Tinta.i9)
                            .underline(m.soyYo, color: Tinta.i10)
                            .lineLimit(1)
                            .truncationMode(.tail)
                        Spacer(minLength: 0)
                        Text(Formato.miles(m.xpVentana))
                            .font(Tipo.cuerpoSm).foregroundStyle(Tinta.i10).monospacedDigit()
                            .fixedSize()
                        Text(Formato.cumple(m.cumplimientoPct))
                            .font(Tipo.cuerpoSm).foregroundStyle(Tinta.i8).monospacedDigit()
                            .fixedSize()
                            .frame(width: Self.anchoCumplido, alignment: .trailing)
                    }
                    .accessibilityElement(children: .combine)
                }
                if resto > 0 {
                    Text(Textos.yMas(resto))
                        .font(Tipo.cuerpoSm)
                        .foregroundStyle(Tinta.i8)
                }
            }
        }
    }

    static let maxFilas = 8
    private static let anchoCumplido: CGFloat = 150

    static func visibles(_ miembros: [FilaLudus]) -> [FilaLudus] {
        guard miembros.count > maxFilas else { return miembros }
        var v = Array(miembros.prefix(maxFilas))
        if !v.contains(where: { $0.soyYo }), let yo = miembros.first(where: { $0.soyYo }) {
            v[maxFilas - 1] = yo
        }
        return v
    }
}
