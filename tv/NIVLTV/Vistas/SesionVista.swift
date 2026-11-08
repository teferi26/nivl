// NIVL TV · La sesión guiada de IRON, a pantalla completa.
//
// Va en una portada propia: el foco no puede escaparse a la barra de pestañas,
// y el botón Menú se queda aquí con su confirmación en vez de sacar de la app.
// Con el mando: clic = serie terminada (o saltar el descanso), Play/Pausa
// congela el descanso. La TV no registra nada: eso es del iPhone.

import SwiftUI

struct SesionVista: View {
    let alCerrar: () -> Void

    private enum Boton: Hashable { case principal, pausa }

    @State private var maquina: MaquinaSesion
    @State private var ahora = Date()
    @State private var aviso = Aviso()
    @State private var confirmandoSalida = false
    @FocusState private var foco: Boton?
    @Environment(\.scenePhase) private var escena
    @Environment(\.accessibilityReduceMotion) private var reducirMovimiento

    init(rutina: RutinaTV, estadoInicial: String? = nil, alCerrar: @escaping () -> Void) {
        self.alCerrar = alCerrar
        var m = MaquinaSesion(rutina: rutina)
        let t = Date()
        // Abrir la sesión es empezar la primera serie. `-estado` es solo para capturas.
        switch estadoInicial {
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
            m.pulsar(ahora: t)
        }
        _maquina = State(initialValue: m)
    }

    private var enDescanso: Bool {
        switch maquina.fase {
        case .descanso, .pausa: return true
        default: return false
        }
    }

    private var ejercicioActual: EjercicioTV? {
        maquina.fase == .terminada ? nil : maquina.ejercicio
    }

    var body: some View {
        HStack(alignment: .top, spacing: Hueco.s14) {
            ColumnaRutina(maquina: maquina)
                .frame(width: 480)
            centro
                .frame(maxWidth: .infinity)
            if maquina.rutina.tieneTecnica, let ejercicioActual {
                ColumnaTecnica(ejercicio: ejercicioActual)
                    .frame(width: 440)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .background(Tinta.i0.ignoresSafeArea())
        .interactiveDismissDisabled(true)
        .onPlayPauseCommand { maquina.alternarPausa(ahora: Date()) }
        .onExitCommand(perform: alPulsarMenu)
        .alert(Textos.salirTitulo, isPresented: $confirmandoSalida) {
            Button(Textos.salirSeguir, role: .cancel) {}
            // Sin role: .destructive, que el sistema pinta en rojo.
            Button(Textos.salirConfirmar, action: alCerrar)
        } message: {
            Text(Textos.salirTexto)
        }
        .onAppear { foco = .principal }
        .onChange(of: enDescanso) { _, ahoraEnDescanso in
            // Si el descanso acaba solo con el foco en Pausa, el botón se va: el foco no se pierde.
            if !ahoraEnDescanso, foco == .pausa { foco = .principal }
        }
        .onChange(of: confirmandoSalida) { _, abierto in
            if !abierto { foco = .principal }
        }
        .onChange(of: escena) { _, _ in avanzar() }
        .onDisappear { UIApplication.shared.isIdleTimerDisabled = false }
        .task {
            avanzar()
            // Reloj de 4 Hz: basta para un segundero y no despierta a nadie.
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 250_000_000)
                avanzar()
            }
        }
    }

    /// Todo sale de la hora real: al volver de segundo plano el primer tic ya es correcto.
    private func avanzar() {
        let t = Date()
        if maquina.tic(ahora: t), escena == .active { aviso.sonar() }
        ahora = t
        let despierta = escena == .active && maquina.pantallaDespierta(ahora: t)
        if UIApplication.shared.isIdleTimerDisabled != despierta {
            UIApplication.shared.isIdleTimerDisabled = despierta
        }
    }

    private func alPulsarMenu() {
        if maquina.enMarcha {
            confirmandoSalida = true
        } else {
            alCerrar()
        }
    }

    // MARK: Centro

    private var centro: some View {
        VStack(alignment: .leading, spacing: Hueco.s8) {
            if let ej = ejercicioActual {
                VStack(alignment: .leading, spacing: Hueco.s3) {
                    Rotulo(texto: "Ejercicio \(maquina.indice + 1) de \(maquina.rutina.ejercicios.count)")
                    Text(ej.nombre)
                        .font(Tipo.titulo)
                        .foregroundStyle(Tinta.i10)
                        .lineLimit(1)
                        .minimumScaleFactor(0.6)
                        .truncationMode(.tail)
                        .accessibilityIdentifier("ejercicioActual")
                }
                HStack(spacing: Hueco.s14) {
                    Cifra(rotulo: "Serie", valor: "\(maquina.serie)", unidad: "de \(ej.series)")
                    if !ej.reps.isEmpty {
                        Cifra(rotulo: "Repeticiones", valor: ej.reps)
                    }
                    if let carga = ej.cargaKg {
                        Cifra(rotulo: "Carga", valor: Formato.kg(carga), unidad: "kg")
                    }
                }
                reloj
            } else {
                cierre
            }
            Spacer(minLength: 0)
            botones
            Barra(fraccion: maquina.progreso, alto: 10)
        }
    }

    @ViewBuilder
    private var reloj: some View {
        switch maquina.fase {
        case .inicio, .terminada:
            EmptyView()
        case .serie:
            bloqueReloj(rotulo: "Serie en curso", cifra: Formato.reloj(maquina.transcurrido(ahora: ahora) ?? 0),
                        pie: "Pulsa al terminar la serie", fraccion: nil)
        case .descanso, .pausa:
            let pausado: Bool = { if case .pausa = maquina.fase { return true }; return false }()
            bloqueReloj(rotulo: pausado ? "Descanso en pausa" : "Descanso",
                        cifra: Formato.reloj(maquina.restante(ahora: ahora) ?? 0),
                        pie: siguientePie, fraccion: maquina.fraccionDescanso(ahora: ahora))
        }
    }

    private var siguientePie: String {
        guard let ej = maquina.ejercicio else { return "" }
        if maquina.serie == 1 { return "A continuación: \(ej.nombre)" }
        return "A continuación: serie \(maquina.serie) de \(ej.series)"
    }

    private func bloqueReloj(rotulo: String, cifra: String, pie: String, fraccion: Double?) -> some View {
        Tarjeta(marco: Trazo.rule, relleno: Hueco.s8) {
            VStack(alignment: .leading, spacing: Hueco.s4) {
                Inscripcion(texto: rotulo)
                RelojFijo(texto: cifra, tam: maquina.rutina.tieneTecnica ? 150 : 200, transicion: !reducirMovimiento)
                if let fraccion {
                    Barra(fraccion: fraccion, alto: 14)
                }
                Text(pie)
                    .font(Tipo.cuerpo)
                    .foregroundStyle(Tinta.i8)
                    .lineLimit(1)
            }
        }
        .accessibilityElement(children: .combine)
    }

    private var cierre: some View {
        Tarjeta(marco: Trazo.frame, relleno: Hueco.s14) {
            VStack(alignment: .leading, spacing: Hueco.s6) {
                Inscripcion(texto: Textos.sesionTerminada)
                HStack(alignment: .firstTextBaseline, spacing: Hueco.s4) {
                    Text("\(maquina.hechas)")
                        .font(Tipo.monumento())
                        .foregroundStyle(Tinta.i10)
                    Text("de \(maquina.rutina.seriesTotales) series")
                        .font(Tipo.titular)
                        .foregroundStyle(Tinta.i9)
                }
                Text(Textos.sesionTerminadaTexto)
                    .font(Tipo.titular)
                    .foregroundStyle(Tinta.i10)
                    .lineLimit(3)
                    .accessibilityIdentifier("sesionTerminadaTexto")
            }
        }
        .accessibilityElement(children: .combine)
    }

    // MARK: Botones

    private var textoPrincipal: String {
        switch maquina.fase {
        case .inicio: return "Empezar"
        case .serie: return "Terminar serie"
        case .descanso, .pausa: return "Saltar descanso"
        case .terminada: return "Volver"
        }
    }

    private var pausado: Bool {
        if case .pausa = maquina.fase { return true }
        return false
    }

    private var botones: some View {
        HStack(spacing: Hueco.s8) {
            Button(textoPrincipal) {
                if maquina.fase == .terminada {
                    alCerrar()
                } else {
                    maquina.pulsar(ahora: Date())
                }
            }
            .buttonStyle(EstiloFoco(invertido: true))
            .focused($foco, equals: .principal)
            .accessibilityIdentifier("accionSesion")

            // Un solo botón con dos textos: si fueran dos, Pausa y Seguir se robarían el foco.
            if enDescanso {
                Button(pausado ? "Seguir" : "Pausa") { maquina.alternarPausa(ahora: Date()) }
                    .buttonStyle(EstiloFoco())
                    .focused($foco, equals: .pausa)
            }
        }
    }
}

// MARK: Reloj

/// Cinzel no trae cifras tabulares (el «1» avanza 39 y el «0» 65 a 100 pt) y
/// `.monospacedDigit()` no hace nada con ella: cada carácter va en su celda y el
/// reloj no baila al cambiar de segundo.
private struct RelojFijo: View {
    let texto: String
    let tam: CGFloat
    let transicion: Bool

    /// Avance del dígito más ancho de Cinzel Bold y de los dos puntos, por punto de cuerpo.
    private static let anchoCifra: CGFloat = 0.66
    private static let anchoDosPuntos: CGFloat = 0.25

    var body: some View {
        HStack(spacing: 0) {
            ForEach(Array(texto.enumerated()), id: \.offset) { _, c in
                Text(String(c))
                    .font(Tipo.monumento(tam))
                    .foregroundStyle(Tinta.i10)
                    .lineLimit(1)
                    .fixedSize()
                    .contentTransition(transicion ? .numericText() : .identity)
                    .frame(width: tam * (c.isNumber ? Self.anchoCifra : Self.anchoDosPuntos))
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(texto)
        .accessibilityIdentifier("relojSesion")
    }
}

// MARK: Columna de la rutina

private struct ColumnaRutina: View {
    let maquina: MaquinaSesion

    /// Más filas no caben en el alto de la TV: la lista sigue al ejercicio en curso.
    private static let capacidad = 6

    private var ventana: Range<Int> {
        ListaVisible.ventana(total: maquina.rutina.ejercicios.count, actual: maquina.indice, capacidad: Self.capacidad)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: Hueco.s6) {
            EncabezadoTV(ceja: Textos.entrenoCeja, titulo: maquina.rutina.nombre)
            VStack(spacing: Hueco.s3) {
                ForEach(ventana, id: \.self) { i in
                    fila(i: i, ej: maquina.rutina.ejercicios[i])
                }
            }
            HStack {
                Text("\(maquina.hechas) de \(maquina.rutina.seriesTotales) series")
                    .font(Tipo.cuerpoSm)
                    .foregroundStyle(Tinta.i8)
                    .monospacedDigit()
                Spacer(minLength: 0)
                if ventana.upperBound < maquina.rutina.ejercicios.count {
                    Text(Textos.yMas(maquina.rutina.ejercicios.count - ventana.upperBound))
                        .font(Tipo.cuerpoSm)
                        .foregroundStyle(Tinta.i6)
                }
            }
        }
    }

    private func estado(_ i: Int) -> (pasado: Bool, actual: Bool) {
        if maquina.fase == .terminada { return (true, false) }
        return (i < maquina.indice, i == maquina.indice)
    }

    private func fila(i: Int, ej: EjercicioTV) -> some View {
        let (pasado, actual) = estado(i)
        return HStack(spacing: Hueco.s4) {
            Rectangle()
                .fill(pasado || actual ? Tinta.i10 : Color.clear)
                .frame(width: 22, height: 22)
                .overlay(Rectangle().strokeBorder(pasado || actual ? Tinta.i10 : Tinta.i6, lineWidth: Trazo.hairline))
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 4) {
                Text(ej.nombre)
                    .font(Tipo.cuerpo)
                    .foregroundStyle(actual ? Tinta.i10 : (pasado ? Tinta.i8 : Tinta.i9))
                    .strikethrough(pasado, color: Tinta.i6)
                    // El actual, entero: dos líneas en todas no caben en el alto de la TV.
                    .lineLimit(actual ? 2 : 1)
                Text(Formato.prescripcion(series: ej.series, reps: ej.reps, cargaKg: ej.cargaKg))
                    .font(Tipo.cuerpoSm)
                    .foregroundStyle(Tinta.i8)
                    .lineLimit(1)
            }
            Spacer(minLength: 0)
        }
        .padding(Hueco.s4)
        .background(Tinta.i1, ignoresSafeAreaEdges: [])
        // El actual se dice con el trazo (frame), no con color.
        .overlay(Rectangle().strokeBorder(actual ? Tinta.i10 : Tinta.i3, lineWidth: actual ? Trazo.frame : Trazo.hairline))
        .accessibilityElement(children: .combine)
        .accessibilityValue(pasado ? "Terminado" : (actual ? "En curso" : "Pendiente"))
    }
}

// MARK: Columna de técnica

/// Solo existe si hay algo que enseñar: con datos reales no llega ni figura ni técnica.
private struct ColumnaTecnica: View {
    let ejercicio: EjercicioTV

    var body: some View {
        VStack(alignment: .leading, spacing: Hueco.s6) {
            if let figura = ejercicio.figura {
                Tarjeta(marco: Trazo.hairline, relleno: Hueco.s8) {
                    Image(systemName: figura)
                        .font(.system(size: 180, weight: .light))
                        .foregroundStyle(Tinta.i9)
                        .frame(maxWidth: .infinity, minHeight: 240)
                        .accessibilityHidden(true)
                }
            }
            if !ejercicio.musculos.isEmpty {
                VStack(alignment: .leading, spacing: Hueco.s3) {
                    Rotulo(texto: "Músculos")
                    Text(ejercicio.musculos.joined(separator: " · "))
                        .font(Tipo.cuerpoSm)
                        .foregroundStyle(Tinta.i8)
                        .lineLimit(2)
                }
                .accessibilityElement(children: .combine)
            }
            if !ejercicio.tecnica.isEmpty {
                VStack(alignment: .leading, spacing: Hueco.s3) {
                    Rotulo(texto: "Técnica")
                    ForEach(ejercicio.tecnica, id: \.self) { pista in
                        HStack(alignment: .firstTextBaseline, spacing: Hueco.s3) {
                            Rectangle().fill(Tinta.i10).frame(width: 10, height: 10).accessibilityHidden(true)
                            Text(pista).font(Tipo.cuerpoSm).foregroundStyle(Tinta.i9).lineLimit(2)
                        }
                    }
                }
                .accessibilityElement(children: .combine)
            }
        }
    }
}
