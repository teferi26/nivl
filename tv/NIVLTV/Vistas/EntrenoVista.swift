// NIVL TV · La pestaña Entreno: la rutina de hoy o por qué no la hay.
//
// La sesión guiada se abre a pantalla completa (SesionVista). La pestaña no
// marca nada ni escribe nada: enseña lo prescrito y da paso.

import SwiftUI

/// Una sesión abierta: lleva su propia copia de la rutina, así un refresco de
/// datos o el cambio de día nunca le cambia el entreno a quien está sudando.
private struct SesionAbierta: Identifiable {
    let id = UUID()
    let rutina: RutinaTV
    let estadoInicial: String?
}

struct EntrenoPantalla: View {
    let rutina: RutinaTV?
    let saludActiva: Bool
    var proxima: ProximaSesion?
    var estadoInicial: String?

    @State private var sesion: SesionAbierta?
    @Namespace private var espacioFoco

    private var estado: EstadoEntreno {
        EstadoEntreno.decidir(rutina: rutina, saludActiva: saludActiva, proxima: proxima)
    }

    var body: some View {
        Group {
            switch estado {
            case .sinSalud:
                aviso(titulo: Textos.sinSaludTitulo, texto: Textos.sinSaludEntreno)
            case .rutinaVacia(let nombre):
                aviso(titulo: nombre, texto: Textos.rutinaVacia)
            case .descanso(let proxima):
                descanso(proxima)
            case .rutina(let r):
                resumen(r)
            }
        }
        .modifier(MargenPestana())
        .focusScope(espacioFoco)
        // Fuera del switch: si cambia el estado, la sesión abierta no se cierra.
        .fullScreenCover(item: $sesion) { s in
            SesionVista(rutina: s.rutina, estadoInicial: s.estadoInicial) { sesion = nil }
        }
        .onAppear {
            // Solo capturas (`-estado descanso|serie|fin`); con datos reales llega nil.
            if ["descanso", "serie", "fin"].contains(estadoInicial), sesion == nil, let rutina, !rutina.ejercicios.isEmpty {
                sesion = SesionAbierta(rutina: rutina, estadoInicial: estadoInicial)
            }
        }
    }

    // MARK: Sin entreno

    private func aviso(titulo: String, texto: String) -> some View {
        VStack(alignment: .leading, spacing: Hueco.s8) {
            EncabezadoTV(ceja: Textos.entrenoCeja, titulo: titulo)
            Text(texto)
                .font(Tipo.cuerpo)
                .foregroundStyle(Tinta.i8)
                .lineLimit(3)
        }
        .frame(maxWidth: 1200, alignment: .leading)
    }

    private func descanso(_ proxima: ProximaSesion?) -> some View {
        VStack(alignment: .leading, spacing: Hueco.s10) {
            EncabezadoTV(ceja: Textos.entrenoCeja, titulo: Textos.hoyNoToca)
            Text(proxima == nil ? Textos.descansoSinProxima : Textos.descansoConProxima)
                .font(Tipo.cuerpo)
                .foregroundStyle(Tinta.i8)
                .lineLimit(3)
            if let proxima {
                Tarjeta(marco: Trazo.rule, relleno: Hueco.s8) {
                    VStack(alignment: .leading, spacing: Hueco.s4) {
                        Rotulo(texto: Textos.proximaRotulo)
                        Text(Formato.cuando(enDias: proxima.enDias, diaSemana: proxima.diaSemana))
                            .font(Tipo.rango)
                            .tracking(6)
                            .textCase(.uppercase)
                            .foregroundStyle(Tinta.i10)
                            .lineLimit(1)
                            .minimumScaleFactor(0.5)
                        Text(proxima.nombre)
                            .font(Tipo.titular)
                            .foregroundStyle(Tinta.i9)
                            .lineLimit(2)
                        Text(Textos.numeroEjercicios(proxima.ejercicios))
                            .font(Tipo.cuerpo)
                            .foregroundStyle(Tinta.i8)
                    }
                }
                .accessibilityElement(children: .combine)
                .frame(maxWidth: 900)
            }
        }
        .frame(maxWidth: 1200, alignment: .leading)
    }

    // MARK: La rutina antes de empezar

    private func resumen(_ r: RutinaTV) -> some View {
        HStack(alignment: .top, spacing: Hueco.s14) {
            VStack(alignment: .leading, spacing: Hueco.s8) {
                EncabezadoTV(ceja: Textos.entrenoCeja, titulo: r.nombre, subtitulo: r.dia)
                HStack(spacing: Hueco.s8) {
                    Cifra(rotulo: "Ejercicios", valor: "\(r.ejercicios.count)")
                    Cifra(rotulo: "Series", valor: "\(r.seriesTotales)")
                }
                Text(Textos.entrenoAyuda)
                    .font(Tipo.cuerpoSm)
                    .foregroundStyle(Tinta.i8)
                    .lineLimit(3)
                Button(r.hecha ? "Repetir sesión" : "Empezar") {
                    sesion = SesionAbierta(rutina: r, estadoInicial: nil)
                }
                .buttonStyle(EstiloFoco(invertido: true))
                .prefersDefaultFocus(in: espacioFoco)
                .accessibilityIdentifier("empezarSesion")
                Text(Textos.entrenoNoRegistra)
                    .font(Tipo.cuerpoSm)
                    .foregroundStyle(Tinta.i6)
                    .lineLimit(3)
            }
            .frame(width: 640, alignment: .leading)

            ListaPrescrita(ejercicios: r.ejercicios)
        }
    }
}

/// Lo prescrito de un vistazo. No tiene foco porque no hay nada que hacer en ella.
private struct ListaPrescrita: View {
    let ejercicios: [EjercicioTV]

    /// Más de lo que cabe no se aprieta: se dice cuánto queda fuera.
    private static let capacidad = 14
    private var visibles: ArraySlice<EjercicioTV> { ejercicios.prefix(Self.capacidad) }
    private var columnas: [GridItem] {
        Array(repeating: GridItem(.flexible(), spacing: Hueco.s4, alignment: .top), count: ejercicios.count > 6 ? 2 : 1)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: Hueco.s4) {
            LazyVGrid(columns: columnas, spacing: Hueco.s3) {
                ForEach(Array(visibles.enumerated()), id: \.element.id) { i, ej in
                    HStack(alignment: .firstTextBaseline, spacing: Hueco.s4) {
                        Text("\(i + 1)")
                            .font(Tipo.inscripcion)
                            .foregroundStyle(Tinta.i6)
                            .frame(width: 44, alignment: .leading)
                        VStack(alignment: .leading, spacing: 4) {
                            Text(ej.nombre)
                                .font(Tipo.cuerpo)
                                .foregroundStyle(Tinta.i10)
                                .lineLimit(1)
                            Text(Formato.prescripcion(series: ej.series, reps: ej.reps, cargaKg: ej.cargaKg))
                                .font(Tipo.cuerpoSm)
                                .foregroundStyle(Tinta.i8)
                                .lineLimit(1)
                        }
                        Spacer(minLength: 0)
                    }
                    .padding(Hueco.s4)
                    .background(Tinta.i1, ignoresSafeAreaEdges: [])
                    .overlay(Rectangle().strokeBorder(Tinta.i3, lineWidth: Trazo.hairline))
                    .accessibilityElement(children: .combine)
                }
            }
            if ejercicios.count > Self.capacidad {
                Text(Textos.yMas(ejercicios.count - Self.capacidad))
                    .font(Tipo.cuerpoSm)
                    .foregroundStyle(Tinta.i6)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}
