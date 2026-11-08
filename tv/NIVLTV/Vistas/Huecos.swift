// NIVL TV · La primera carga: la forma de cada pestaña en huecos.
//
// Nunca un spinner ni un estado vacío antes de saber. HuecoCarga respira y
// respeta «reducir movimiento».

import SwiftUI

struct HuecosEntreno: View {
    var body: some View {
        HStack(alignment: .top, spacing: Hueco.s14) {
            VStack(alignment: .leading, spacing: Hueco.s8) {
                HuecoCarga().frame(height: 170)
                HuecoCarga().frame(height: 120)
                HuecoCarga().frame(width: 320, height: 90)
            }
            .frame(width: 640)
            HuecosFilas(numero: 5, alto: 104)
        }
        .modifier(MargenPestana())
    }
}

struct HuecosArena: View {
    var body: some View {
        HStack(alignment: .top, spacing: Hueco.s14) {
            VStack(alignment: .leading, spacing: Hueco.s6) {
                HuecoCarga().frame(height: 150)
                HuecosFilas(numero: 5, alto: 104)
            }
            HuecoCarga().frame(width: 540, height: 360)
        }
        .modifier(MargenPestana())
    }
}

struct HuecosSemana: View {
    var body: some View {
        VStack(alignment: .leading, spacing: Hueco.s6) {
            HuecoCarga().frame(height: 150)
            HStack(spacing: Hueco.s10) {
                HuecoCarga().frame(width: 720, height: 340)
                HuecoCarga().frame(height: 340)
            }
            HuecoCarga().frame(height: 220)
        }
        .modifier(MargenPestana())
    }
}

struct HuecosCuenta: View {
    var body: some View {
        HStack(alignment: .top, spacing: Hueco.s14) {
            HuecoCarga().frame(height: 380)
            HuecoCarga().frame(width: 760, height: 380)
        }
        .modifier(MargenPestana())
    }
}

private struct HuecosFilas: View {
    let numero: Int
    let alto: CGFloat

    var body: some View {
        VStack(spacing: Hueco.s4) {
            ForEach(0..<numero, id: \.self) { _ in HuecoCarga().frame(height: alto) }
        }
    }
}

/// El sitio que deja la barra de pestañas, igual en todas.
struct MargenPestana: ViewModifier {
    var arriba = Hueco.bajoPestanas

    func body(content: Content) -> some View {
        content
            .padding(.horizontal, Hueco.margenLateral)
            .padding(.top, arriba)
            .padding(.bottom, Hueco.s8)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
}
