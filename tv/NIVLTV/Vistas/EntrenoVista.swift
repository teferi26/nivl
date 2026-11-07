// NIVL TV · Entrenamiento del día de IRON a pantalla grande.
//
// Tres columnas: la rutina (qué va hecho), el ejercicio con su reloj enorme y
// la técnica con su figura. Con el mando: clic = serie hecha (o saltar el
// descanso), Play/Pausa congela el descanso. El registro real sigue siendo
// del iPhone (v2: sincronizar con la SesionEnCurso por realtime).

import SwiftUI

struct EntrenoVista: View {
    @State private var maquina: MaquinaSesion
    @State private var ahora = Date()
    @Namespace private var espacioFoco
    @State private var aviso = Aviso()

    init(rutina: RutinaTV = Demo.rutina) {
        var m = MaquinaSesion(rutina: rutina)
        // `-estado descanso` al lanzar: deja la sesión en el primer descanso
        // (solo para capturas; el simulador de tvOS no simula el mando).
        // `-estado serie` deja la primera serie en marcha y `-estado fin`
        // cierra la sesión entera (pantalla de cierre).
        let t = Date()
        switch UserDefaults.standard.string(forKey: "estado") {
        case "descanso":
            m.pulsar(ahora: t.addingTimeInterval(-40))
            m.pulsar(ahora: t.addingTimeInterval(-38))
        case "serie":
            m.pulsar(ahora: t.addingTimeInterval(-24))
        case "fin":
            var vueltas = 0
            while m.fase != .terminada && vueltas < 500 {
                m.pulsar(ahora: t)
                vueltas += 1
            }
        default:
            break
        }
        _maquina = State(initialValue: m)
    }

    var body: some View {
        HStack(alignment: .top, spacing: Hueco.s14) {
            ColumnaRutina(maquina: maquina)
                .frame(width: 500)
            centro
                .frame(maxWidth: .infinity)
            // Con la sesión cerrada no tiene sentido la técnica del último
            // ejercicio: la columna resume lo trabajado hoy.
            ColumnaTecnica(ejercicio: maquina.fase == .terminada ? nil : maquina.ejercicio, rutina: maquina.rutina)
                .frame(width: 460)
        }
        .padding(.horizontal, Hueco.margenLateral)
        .padding(.top, Hueco.bajoPestanas)
        .padding(.bottom, Hueco.s8)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .focusScope(espacioFoco)
        .onPlayPauseCommand { maquina.alternarPausa(ahora: Date()) }
        .task {
            // Reloj de 4 Hz: basta para un segundero y no despierta a nadie.
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 250_000_000)
                let t = Date()
                if maquina.tic(ahora: t) { aviso.sonar() }
                ahora = t
            }
        }
    }

    // MARK: Centro

    private var centro: some View {
        VStack(alignment: .leading, spacing: Hueco.s6) {
            if let ej = maquina.ejercicio, maquina.fase != .terminada {
                VStack(alignment: .leading, spacing: Hueco.s3) {
                    Rotulo(texto: "Ejercicio \(maquina.indice + 1) de \(maquina.rutina.ejercicios.count)")
                    Text(ej.nombre)
                        .font(Tipo.titulo)
                        .foregroundStyle(Tinta.i10)
                        .lineLimit(1)
                        .minimumScaleFactor(0.7)
                }
                HStack(spacing: Hueco.s14) {
                    Cifra(rotulo: "Serie", valor: "\(maquina.serie)", unidad: "de \(ej.series)")
                    Cifra(rotulo: "Repeticiones", valor: ej.reps)
                    Cifra(rotulo: "Carga", valor: ej.cargaKg.map(Formato.kg) ?? "Corporal", unidad: ej.cargaKg == nil ? nil : "kg")
                }
                reloj(ej)
            } else {
                cierre
            }
            Spacer(minLength: 0)
            botones
            Barra(fraccion: maquina.progreso, alto: 10)
        }
    }

    @ViewBuilder
    private func reloj(_ ej: EjercicioTV) -> some View {
        switch maquina.fase {
        case .inicio:
            bloqueReloj(rotulo: "Preparado", cifra: Formato.reloj(TimeInterval(ej.descansoSeg)), pie: "Descanso entre series: \(Formato.reloj(TimeInterval(ej.descansoSeg)))", fraccion: nil)
        case .serie:
            bloqueReloj(rotulo: "Serie en curso", cifra: Formato.reloj(maquina.transcurrido(ahora: ahora) ?? 0), pie: "Pulsa al terminar la serie", fraccion: nil)
        case .descanso, .pausa:
            let pausado: Bool = { if case .pausa = maquina.fase { return true }; return false }()
            bloqueReloj(
                rotulo: pausado ? "Descanso en pausa" : "Descanso",
                cifra: Formato.reloj(maquina.restante(ahora: ahora) ?? 0),
                pie: siguientePie,
                fraccion: maquina.fraccionDescanso(ahora: ahora)
            )
        case .terminada:
            EmptyView()
        }
    }

    private var siguientePie: String {
        guard let ej = maquina.ejercicio else { return "" }
        if maquina.serie == 1 { return "A continuación: \(ej.nombre)" }
        return "A continuación: serie \(maquina.serie) de \(ej.series)"
    }

    private func bloqueReloj(rotulo: String, cifra: String, pie: String, fraccion: Double?) -> some View {
        Tarjeta(marco: Trazo.rule, relleno: Hueco.s6) {
            VStack(alignment: .leading, spacing: Hueco.s2) {
                Inscripcion(texto: rotulo)
                Text(cifra)
                    .font(Tipo.monumento(150))
                    .foregroundStyle(Tinta.i10)
                    .monospacedDigit()
                    .lineLimit(1)
                    .contentTransition(.numericText())
                if let fraccion {
                    Barra(fraccion: fraccion, alto: 14)
                }
                Text(pie).font(Tipo.cuerpo).foregroundStyle(Tinta.i8)
            }
        }
        .accessibilityElement(children: .combine)
    }

    private var cierre: some View {
        Tarjeta(marco: Trazo.frame, relleno: Hueco.s14) {
            VStack(alignment: .leading, spacing: Hueco.s6) {
                Inscripcion(texto: "Sesión cerrada")
                Text("\(maquina.hechas)")
                    .font(Tipo.monumento())
                    .foregroundStyle(Tinta.i10)
                Text("series hechas de \(maquina.rutina.nombre.lowercased())")
                    .font(Tipo.titular)
                    .foregroundStyle(Tinta.i9)
                Text("Regístrala en el iPhone: la misión enlazada se marca sola.")
                    .font(Tipo.cuerpo)
                    .foregroundStyle(Tinta.i8)
                    // Sin esto la frase salía cortada con puntos suspensivos.
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    // MARK: Botones

    private var textoPrincipal: String {
        switch maquina.fase {
        case .inicio: return "Empezar"
        case .serie: return "Serie hecha"
        case .descanso, .pausa: return "Saltar descanso"
        case .terminada: return "Otra vez"
        }
    }

    private var botones: some View {
        HStack(spacing: Hueco.s8) {
            Button(textoPrincipal) {
                if maquina.fase == .terminada {
                    maquina = MaquinaSesion(rutina: maquina.rutina)
                } else {
                    maquina.pulsar(ahora: Date())
                }
            }
            .buttonStyle(EstiloFoco(invertido: true))
            .prefersDefaultFocus(in: espacioFoco)

            if case .descanso = maquina.fase {
                Button("Pausa") { maquina.alternarPausa(ahora: Date()) }
                    .buttonStyle(EstiloFoco())
            } else if case .pausa = maquina.fase {
                Button("Seguir") { maquina.alternarPausa(ahora: Date()) }
                    .buttonStyle(EstiloFoco())
            }
        }
    }
}

// MARK: Columna de la rutina

private struct ColumnaRutina: View {
    let maquina: MaquinaSesion

    var body: some View {
        VStack(alignment: .leading, spacing: Hueco.s6) {
            EncabezadoTV(ceja: "IRON · hoy", titulo: maquina.rutina.nombre, subtitulo: maquina.rutina.dia)
            VStack(spacing: Hueco.s3) {
                ForEach(Array(maquina.rutina.ejercicios.enumerated()), id: \.element.id) { i, ej in
                    fila(i: i, ej: ej)
                }
            }
            Text("\(maquina.hechas) de \(maquina.rutina.seriesTotales) series. Se registra en tu iPhone.")
                .font(Tipo.rotulo)
                .foregroundStyle(Tinta.i6)
        }
    }

    private func estado(_ i: Int) -> (hecho: Bool, actual: Bool) {
        if maquina.fase == .terminada { return (true, false) }
        return (i < maquina.indice, i == maquina.indice)
    }

    private func fila(i: Int, ej: EjercicioTV) -> some View {
        let (hecho, actual) = estado(i)
        return HStack(spacing: Hueco.s4) {
            Image(systemName: hecho ? "checkmark.square.fill" : (actual ? "square.inset.filled" : "square"))
                .font(.system(size: 30, weight: .semibold))
                .foregroundStyle(hecho || actual ? Tinta.i10 : Tinta.i6)
            VStack(alignment: .leading, spacing: 4) {
                Text(ej.nombre)
                    .font(Tipo.cuerpo)
                    .foregroundStyle(actual ? Tinta.i10 : (hecho ? Tinta.i8 : Tinta.i9))
                    .strikethrough(hecho, color: Tinta.i6)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
                Text("\(ej.series) × \(ej.reps)\(ej.cargaKg.map { " · \(Formato.kg($0)) kg" } ?? "")")
                    .font(Tipo.rotulo)
                    .foregroundStyle(Tinta.i6)
            }
            Spacer(minLength: 0)
        }
        .padding(Hueco.s4)
        .background(Tinta.i1, ignoresSafeAreaEdges: [])
        // El actual se dice con el trazo (frame), no con color.
        .overlay(Rectangle().strokeBorder(actual ? Tinta.i10 : Tinta.i3, lineWidth: actual ? Trazo.frame : Trazo.hairline))
        .accessibilityElement(children: .combine)
        .accessibilityValue(hecho ? "Hecho" : (actual ? "En curso" : "Pendiente"))
    }
}

// MARK: Columna de técnica

private struct ColumnaTecnica: View {
    let ejercicio: EjercicioTV?
    let rutina: RutinaTV

    /// Músculos de toda la rutina, sin repetir y en orden de aparición.
    private var musculosDelDia: [String] {
        var vistos = Set<String>()
        return rutina.ejercicios.flatMap(\.musculos).filter { vistos.insert($0).inserted }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: Hueco.s6) {
            if ejercicio == nil {
                Tarjeta(marco: Trazo.hairline, relleno: Hueco.s8) {
                    Image(systemName: "checkmark.seal")
                        .font(.system(size: 180, weight: .light))
                        .foregroundStyle(Tinta.i9)
                        .frame(maxWidth: .infinity, minHeight: 240)
                        .accessibilityHidden(true)
                }
                VStack(alignment: .leading, spacing: Hueco.s3) {
                    Rotulo(texto: "Trabajado hoy")
                    Text(musculosDelDia.joined(separator: " · "))
                        .font(Tipo.cuerpoSm)
                        .foregroundStyle(Tinta.i8)
                        .fixedSize(horizontal: false, vertical: true)
                }
                // Cinzel no tiene minúsculas: «de» va en Outfit, como en Cifra.
                Cifra(rotulo: "Ejercicios", valor: "\(rutina.ejercicios.count)", unidad: "de \(rutina.ejercicios.count)")
            }
            if let ej = ejercicio {
                Tarjeta(marco: Trazo.hairline, relleno: Hueco.s8) {
                    Image(systemName: ej.figura)
                        .font(.system(size: 180, weight: .light))
                        .foregroundStyle(Tinta.i9)
                        .frame(maxWidth: .infinity, minHeight: 240)
                        .accessibilityHidden(true)
                }
                VStack(alignment: .leading, spacing: Hueco.s3) {
                    Rotulo(texto: "Músculos")
                    Text(ej.musculos.joined(separator: " · "))
                        .font(Tipo.cuerpoSm)
                        .foregroundStyle(Tinta.i8)
                }
                VStack(alignment: .leading, spacing: Hueco.s3) {
                    Rotulo(texto: "Técnica")
                    ForEach(ej.tecnica, id: \.self) { pista in
                        HStack(alignment: .firstTextBaseline, spacing: Hueco.s3) {
                            Rectangle().fill(Tinta.i10).frame(width: 10, height: 10)
                            Text(pista).font(Tipo.cuerpoSm).foregroundStyle(Tinta.i9)
                        }
                    }
                }
            }
        }
    }
}
