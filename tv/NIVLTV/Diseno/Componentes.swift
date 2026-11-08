// NIVL TV · Piezas del kit para el salón.
//
// Traducción a SwiftUI de lo esencial de @/components/arena: rótulo, cifra,
// tarjeta de piedra, barra y el botón con foco. Radio 0, sin sombras ni
// degradados; el foco se dice con escala ×1,1 y marco blanco.

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
            .background(invertido ? Tinta.i10 : (enfocado ? Tinta.i2 : Tinta.i1), ignoresSafeAreaEdges: [])
            .overlay(Rectangle().strokeBorder(invertido ? Tinta.i10 : Tinta.i4, lineWidth: Trazo.hairline))
            // El marco de foco va por fuera, con un hueco negro: se ve igual
            // sobre la superficie blanca que sobre la piedra.
            .padding(8)
            .overlay(Rectangle().strokeBorder(enfocado ? Tinta.i10 : .clear, lineWidth: Trazo.rule))
            .scaleEffect(configuration.isPressed ? 1.04 : (enfocado ? Foco.escala : 1), anchor: ancla)
            .animation(.easeOut(duration: Foco.duracion), value: enfocado)
            .animation(.easeOut(duration: 0.1), value: configuration.isPressed)
    }
}

/// Rótulo de sección (`label`): Outfit 700, mayúsculas, tracking 2.
struct Rotulo: View {
    let texto: String
    var body: some View {
        Text(texto)
            .font(Tipo.rotulo)
            .tracking(3)
            .textCase(.uppercase)
            .foregroundStyle(Tinta.i6)
            .lineLimit(1)
    }
}

/// Lo grabado (`inscripcion`): Cinzel 700, mayúsculas.
struct Inscripcion: View {
    let texto: String
    var color = Tinta.i8
    var body: some View {
        Text(texto)
            .font(Tipo.inscripcion)
            .tracking(5)
            .textCase(.uppercase)
            .foregroundStyle(color)
    }
}

/// Encabezado de cada sección: eyebrow + título Cinzel + meandro.
struct EncabezadoTV: View {
    let ceja: String
    let titulo: String
    var subtitulo: String?

    var body: some View {
        VStack(alignment: .leading, spacing: Hueco.s3) {
            Rotulo(texto: ceja)
            Text(titulo)
                .font(Tipo.rango)
                .tracking(6)
                .textCase(.uppercase)
                .foregroundStyle(Tinta.i10)
                // Una sola línea que encoge: a dos líneas «TORSO ·» dejaba el
                // punto colgando al final.
                .lineLimit(1)
                .minimumScaleFactor(0.5)
            if let subtitulo {
                Text(subtitulo).font(Tipo.cuerpo).foregroundStyle(Tinta.i8).lineLimit(1)
            }
            Meandro().frame(width: 220, height: 14).padding(.top, Hueco.s2)
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
                Text(valor).font(Tipo.cifra).foregroundStyle(Tinta.i10).monospacedDigit()
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

/// Tarjeta de piedra (TarjetaArena «piedra» o «contorno»).
struct Tarjeta<Contenido: View>: View {
    var marco: CGFloat = Trazo.hairline
    var relleno: CGFloat = Hueco.s8
    @ViewBuilder let contenido: () -> Contenido

    var body: some View {
        contenido()
            .padding(relleno)
            .frame(maxWidth: .infinity, alignment: .leading)
            // Sin invadir el área segura: si no, el fondo sube bajo la barra de pestañas.
            .background(Tinta.i1, ignoresSafeAreaEdges: [])
            .overlay(Rectangle().strokeBorder(Tinta.i3, lineWidth: marco))
    }
}

/// Barra de progreso: pista ink4, avance ink10.
struct Barra: View {
    let fraccion: Double
    var alto: CGFloat = 12

    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .leading) {
                Rectangle().fill(Tinta.i4)
                Rectangle().fill(Tinta.i10).frame(width: geo.size.width * min(1, max(0, fraccion)))
            }
        }
        .frame(height: alto)
        .accessibilityHidden(true)
    }
}

/// Meandro griego de un trazo (motivo `Meandro`), oculto al lector.
struct Meandro: View {
    var body: some View {
        Canvas { ctx, size in
            let paso: CGFloat = size.height
            var x: CGFloat = 0
            var p = Path()
            p.move(to: CGPoint(x: 0, y: size.height))
            while x + paso <= size.width {
                p.addLine(to: CGPoint(x: x, y: 0))
                p.addLine(to: CGPoint(x: x + paso * 0.66, y: 0))
                p.addLine(to: CGPoint(x: x + paso * 0.66, y: size.height * 0.55))
                p.addLine(to: CGPoint(x: x + paso * 0.33, y: size.height * 0.55))
                p.addLine(to: CGPoint(x: x + paso * 0.33, y: size.height))
                p.addLine(to: CGPoint(x: x + paso, y: size.height))
                x += paso
            }
            ctx.stroke(p, with: .color(Tinta.i6), lineWidth: Trazo.hairline)
        }
        .accessibilityHidden(true)
    }
}

/// Laurel de Élite: blanco, como EliteBadge de la app.
struct LaurelElite: View {
    var tam: CGFloat = 30
    var body: some View {
        HStack(spacing: 2) {
            Image(systemName: "laurel.leading")
            Image(systemName: "laurel.trailing")
        }
        .font(.system(size: tam, weight: .semibold))
        .foregroundStyle(Tinta.i10)
        .accessibilityLabel("Élite")
    }
}
