// NIVL TV · Piezas del kit para el salón.
//
// Traducción a SwiftUI de lo esencial de @/components/arena: rótulo, cifra,
// tarjeta, barra y el botón con foco. Tarjetas redondeadas y oro solo como
// hilo; el foco se dice con escala ×1,1 y marco hueso.

import SwiftUI

/// Botón de mando. `invertido` es la acción principal (la única superficie
/// blanca de la pantalla).
struct EstiloFoco: ButtonStyle {
    var invertido = false
    var relleno = EdgeInsets(top: 22, leading: 44, bottom: 22, trailing: 44)
    /// Pegado al borde del área segura, va `.leading`: si creciera por el centro, se saldría de ella.
    var ancla: UnitPoint = .center

    func makeBody(configuration: Configuration) -> some View {
        CuerpoFoco(configuration: configuration, invertido: invertido, relleno: relleno, ancla: ancla)
    }
}

private struct CuerpoFoco: View {
    let configuration: ButtonStyle.Configuration
    let invertido: Bool
    let relleno: EdgeInsets
    let ancla: UnitPoint
    @Environment(\.isFocused) private var enfocado

    var body: some View {
        configuration.label
            .fixedSize()
            .font(Tipo.boton)
            .tracking(2.5)
            .textCase(.uppercase)
            .padding(relleno)
            .foregroundStyle(invertido ? Tinta.i0 : Tinta.i9)
            .fondoOnix(invertido ? Tinta.i10 : (enfocado ? Tinta.i2 : Tinta.i1), radio: Radio.control)
            .marcoOnix(invertido ? Tinta.i10 : Tinta.i4, ancho: Trazo.hairline, radio: Radio.control)
            // El marco de foco va por fuera, con un hueco negro: se ve igual
            // sobre la superficie blanca que sobre la piedra.
            .padding(8)
            .marcoOnix(enfocado ? Tinta.i10 : .clear, ancho: Trazo.rule, radio: Radio.control + 8)
            .scaleEffect(configuration.isPressed ? 1.04 : (enfocado ? Foco.escala : 1), anchor: ancla)
            .animation(.easeOut(duration: Foco.duracion), value: enfocado)
            .animation(.easeOut(duration: 0.1), value: configuration.isPressed)
    }
}

/// Rótulo de sección (`label`): Outfit 700, mayúsculas, tracking 2.
struct Rotulo: View {
    let texto: String
    var color = Tinta.i6
    var body: some View {
        Text(texto)
            .font(Tipo.rotulo)
            .tracking(3)
            .textCase(.uppercase)
            .foregroundStyle(color)
            .lineLimit(1)
    }
}

/// Lo grabado (`inscripcion`): Playfair 700.
struct Inscripcion: View {
    let texto: String
    var color = Tinta.i8
    var body: some View {
        Text(texto)
            .font(Tipo.inscripcion)
            .foregroundStyle(color)
    }
}

/// Encabezado de cada sección: eyebrow + título Playfair + hilo de oro.
struct EncabezadoTV: View {
    let ceja: String
    let titulo: String
    var subtitulo: String?

    var body: some View {
        VStack(alignment: .leading, spacing: Hueco.s3) {
            Rotulo(texto: ceja, color: Oro.hilo)
            Text(titulo)
                .font(Tipo.rango)
                .foregroundStyle(Tinta.i10)
                // Una sola línea que encoge: a dos líneas «TORSO ·» dejaba el
                // punto colgando al final.
                .lineLimit(1)
                .minimumScaleFactor(0.5)
            if let subtitulo {
                Text(subtitulo).font(Tipo.cuerpo).foregroundStyle(Tinta.i8).lineLimit(1)
            }
            HiloOro().padding(.top, Hueco.s2)
        }
        .accessibilityElement(children: .combine)
    }
}

/// Celda «rótulo: valor» de una franja de cifras.
struct Cifra: View {
    let rotulo: String
    let valor: String
    var unidad: String?

    var body: some View {
        VStack(alignment: .leading, spacing: Hueco.s2) {
            Rotulo(texto: rotulo)
            HStack(alignment: .firstTextBaseline, spacing: Hueco.s2) {
                Text(valor).font(Tipo.cifra).foregroundStyle(Oro.claro)
                    .lineLimit(1).minimumScaleFactor(0.5)
                if let unidad {
                    Text(unidad).font(Tipo.cuerpoSm).foregroundStyle(Tinta.i6)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)
    }
}

/// Tarjeta de Ónix.
struct Tarjeta<Contenido: View>: View {
    var marco: CGFloat = Trazo.hairline
    var relleno: CGFloat = Hueco.s8
    @ViewBuilder let contenido: () -> Contenido

    var body: some View {
        contenido()
            .padding(relleno)
            .frame(maxWidth: .infinity, alignment: .leading)
            // Sin invadir el área segura: si no, el fondo sube bajo la barra de pestañas.
            .fondoOnix(Tinta.i1, radio: Radio.tarjeta)
            .marcoOnix(Tinta.i3, ancho: marco, radio: Radio.tarjeta)
    }
}

/// Barra de progreso: pista ink4, avance en el hilo de oro.
struct Barra: View {
    let fraccion: Double
    var alto: CGFloat = 12

    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .leading) {
                Capsule().fill(Tinta.i4)
                Capsule().fill(Oro.hilo).frame(width: geo.size.width * min(1, max(0, fraccion)))
            }
        }
        .frame(height: alto)
        .accessibilityHidden(true)
    }
}

/// El hilo de oro bajo un título, oculto al lector.
struct HiloOro: View {
    var body: some View {
        Capsule().fill(Oro.hilo).frame(width: 96, height: Trazo.hairline).accessibilityHidden(true)
    }
}

/// Laurel de Élite: el hilo de oro, como EliteBadge de la app.
struct LaurelElite: View {
    var tam: CGFloat = 30
    var body: some View {
        HStack(spacing: 2) {
            Image(systemName: "laurel.leading")
            Image(systemName: "laurel.trailing")
        }
        .font(.system(size: tam, weight: .semibold))
        .foregroundStyle(Oro.hilo)
        .accessibilityLabel("Élite")
    }
}
