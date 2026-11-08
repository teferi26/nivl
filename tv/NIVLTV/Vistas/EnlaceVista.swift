// NIVL TV · Enlazar la TV desde el iPhone.
//
// Código enorme y QR a la vista, sin teclado ni contraseña. La cuenta atrás
// la pinta un TimelineView; la renovación la decide MaquinaApp.

import SwiftUI

struct EnlaceVista: View {
    let enlace: EnlaceActivo?
    let motivo: MotivoSinEnlazar?
    let pedirOtro: () -> Void
    @FocusState private var enfocado: Bool

    var body: some View {
        HStack(alignment: .center, spacing: Hueco.s20) {
            VStack(alignment: .leading, spacing: Hueco.s10) {
                EncabezadoTV(ceja: Textos.enlaceCeja, titulo: Textos.enlaceTitulo)
                if let enlace {
                    activo(enlace)
                } else {
                    Text(Textos.motivo(motivo ?? .pidiendo))
                        .font(Tipo.titular)
                        .foregroundStyle(Tinta.i9)
                        .fixedSize(horizontal: false, vertical: true)
                }
                // Siempre presente, también mientras se pide: si apareciera
                // después, el foco del mando no llegaría a él.
                Button(enlace == nil ? "Pedir código" : "Pedir otro código", action: pedirOtro)
                    .buttonStyle(EstiloFoco(invertido: enlace == nil))
                    .focused($enfocado)
                    .accessibilityIdentifier("pedirCodigo")
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            if let enlace {
                QRVista(texto: CodigoTV.enlaceQR(enlace.codigo), lado: 640)
            } else if motivo == .pidiendo {
                HuecoCarga().frame(width: 640, height: 640)
            } else {
                Color.clear.frame(width: 640, height: 640)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Tinta.i0.ignoresSafeArea())
        .onAppear { enfocado = true }
    }

    @ViewBuilder
    private func activo(_ e: EnlaceActivo) -> some View {
        Text(CodigoTV.visible(e.codigo))
            .font(Tipo.monumento(136))
            .foregroundStyle(Tinta.i10)
            .lineLimit(1)
            .minimumScaleFactor(0.7)
            .accessibilityLabel("Código \(CodigoTV.deletreado(e.codigo))")
            .accessibilityIdentifier("codigoEnlace")

        VStack(alignment: .leading, spacing: Hueco.s4) {
            paso("1", Textos.pasoUno)
            paso("2", Textos.pasoDos)
        }

        TimelineView(.periodic(from: .now, by: 1)) { contexto in
            let queda = e.caducaEn.timeIntervalSince(contexto.date)
            Text(e.sinConexion ? Textos.sinConexionEnlace : (queda > 0 ? Textos.caducaEn(Formato.reloj(queda)) : Textos.renovando))
                .font(Tipo.cuerpo)
                .foregroundStyle(Tinta.i8)
                .monospacedDigit()
        }
    }

    private func paso(_ numero: String, _ texto: String) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: Hueco.s4) {
            Text(numero)
                .font(Tipo.inscripcion)
                .foregroundStyle(Tinta.i0)
                .frame(width: 48, height: 48)
                .background(Tinta.i10, ignoresSafeAreaEdges: [])
            Text(texto).font(Tipo.cuerpo).foregroundStyle(Tinta.i9)
        }
        .accessibilityElement(children: .combine)
    }
}

/// El QR nítido: la imagen se escala por un entero y sin interpolar.
struct QRVista: View {
    let texto: String
    let lado: CGFloat

    var body: some View {
        if let imagen = GeneradorQR.imagen(texto) {
            let total = CGFloat(imagen.width)
            let escala = max(1, floor(lado / total))
            Image(decorative: imagen, scale: 1)
                .resizable()
                .interpolation(.none)
                .antialiased(false)
                .frame(width: total * escala, height: total * escala)
                .frame(width: lado, height: lado)
                .accessibilityElement()
                .accessibilityLabel("Código QR para enlazar esta TV")
                .accessibilityIdentifier("qrEnlace")
        }
    }
}

/// Mientras se carga: huecos que respiran, nunca un spinner.
struct HuecoCarga: View {
    @Environment(\.accessibilityReduceMotion) private var reducir
    @State private var encendido = false

    var body: some View {
        Rectangle()
            .fill(Tinta.i2)
            .opacity(reducir ? 1 : (encendido ? 1 : 0.45))
            .onAppear {
                guard !reducir else { return }
                withAnimation(.easeInOut(duration: 1).repeatForever(autoreverses: true)) { encendido = true }
            }
            .accessibilityHidden(true)
    }
}
