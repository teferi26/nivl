// NIVL · Apple Watch: «Mármol y tinta» en la muñeca.
// Los mismos tokens que src/design/tokens.ts (ink0 a ink10, sin color): el
// énfasis va en la inversión (blanco con texto negro, una por pantalla), el
// trazo y el grano. Cinzel solo para cifras grandes y rótulos grabados;
// el texto que se lee, en la fuente del sistema (lo más legible a 40 mm).

import SwiftUI

enum Ink {
  static let ink0 = Color(red: 0, green: 0, blue: 0)
  static let ink1 = Color(white: 0x0B / 255)
  static let ink2 = Color(white: 0x16 / 255)
  static let ink3 = Color(white: 0x24 / 255)
  static let ink4 = Color(white: 0x3A / 255)
  static let ink6 = Color(white: 0x8C / 255)
  static let ink8 = Color(white: 0xBD / 255)
  static let ink9 = Color(white: 0xED / 255)
  static let ink10 = Color(white: 1)
}

enum Tipo {
  /// Cifras grandes (racha, nivel, reloj): Cinzel 600 con su escalado.
  static func cifra(_ tam: CGFloat, relativoA estilo: Font.TextStyle = .largeTitle) -> Font {
    .custom("Cinzel-SemiBold", size: tam, relativeTo: estilo)
  }

  /// Lo grabado: «RANGO D», rótulos de pantalla.
  static func inscripcion(_ tam: CGFloat = 13) -> Font {
    .custom("Cinzel-Bold", size: tam, relativeTo: .footnote)
  }

  static let rotulo = Font.system(size: 11, weight: .bold)
  static let fila = Font.system(.body, design: .default).weight(.medium)
  static let detalle = Font.system(.footnote).weight(.medium)
  static let boton = Font.system(size: 15, weight: .bold)
}

/// Rótulo de sección: Outfit 700 mayúsculas en la app, aquí la del sistema con
/// el mismo tracking.
struct Rotulo: View {
  let texto: String
  var body: some View {
    Text(texto.uppercased())
      .font(Tipo.rotulo)
      .tracking(2)
      .foregroundStyle(Ink.ink6)
      .accessibilityAddTraits(.isHeader)
  }
}

/// La acción principal: la inversión (blanco, texto negro, radio 0).
struct BotonInvertido: ButtonStyle {
  var activo = true
  func makeBody(configuration: Configuration) -> some View {
    configuration.label
      .font(Tipo.boton)
      .tracking(1.5)
      .textCase(.uppercase)
      .frame(maxWidth: .infinity, minHeight: 44)
      .foregroundStyle(activo ? Ink.ink0 : Ink.ink6)
      .background(activo ? Ink.ink10 : Ink.ink2)
      .overlay(Rectangle().stroke(activo ? Color.clear : Ink.ink4, lineWidth: 1))
      .scaleEffect(configuration.isPressed ? 0.97 : 1)
      .animation(.easeOut(duration: 0.1), value: configuration.isPressed)
  }
}

/// Lo secundario: contorno de 1 sobre negro.
struct BotonContorno: ButtonStyle {
  func makeBody(configuration: Configuration) -> some View {
    configuration.label
      .font(Tipo.boton)
      .tracking(1.5)
      .textCase(.uppercase)
      .frame(maxWidth: .infinity, minHeight: 44)
      .foregroundStyle(Ink.ink9)
      .background(configuration.isPressed ? Ink.ink2 : Ink.ink0)
      .overlay(Rectangle().stroke(Ink.ink4, lineWidth: 1))
  }
}

/// El grano (logro, racha): puntos finos ink6 sobre negro. Decoración: el
/// texto nunca va encima.
struct Grano: View {
  var body: some View {
    Canvas { ctx, size in
      var gen = SplitMix(semilla: 7)
      let n = Int(size.width * size.height / 60)
      for _ in 0..<n {
        let x = CGFloat(gen.siguiente() % UInt64(max(1, Int(size.width))))
        let y = CGFloat(gen.siguiente() % UInt64(max(1, Int(size.height))))
        ctx.fill(Path(CGRect(x: x, y: y, width: 1, height: 1)), with: .color(Ink.ink3))
      }
    }
    .accessibilityHidden(true)
  }
}

/// La trama (alerta, bloqueado): rayado a 45°.
struct Trama: View {
  var body: some View {
    Canvas { ctx, size in
      var p = Path()
      var x: CGFloat = -size.height
      while x < size.width {
        p.move(to: CGPoint(x: x, y: size.height))
        p.addLine(to: CGPoint(x: x + size.height, y: 0))
        x += 6
      }
      ctx.stroke(p, with: .color(Ink.ink3), lineWidth: 1)
    }
    .accessibilityHidden(true)
  }
}

/// Generador fijo para que el grano no baile en cada repintado.
struct SplitMix {
  var estado: UInt64
  init(semilla: UInt64) { estado = semilla }
  mutating func siguiente() -> UInt64 {
    estado &+= 0x9E37_79B9_7F4A_7C15
    var z = estado
    z = (z ^ (z >> 30)) &* 0xBF58_476D_1CE4_E5B9
    z = (z ^ (z >> 27)) &* 0x94D0_49BB_1331_11EB
    return z ^ (z >> 31)
  }
}

/// «1.840» como en formatoMiles (punto de miles, sin decimales).
func formatoMiles(_ n: Int) -> String {
  let f = NumberFormatter()
  f.numberStyle = .decimal
  f.groupingSeparator = "."
  f.usesGroupingSeparator = true
  f.minimumGroupingDigits = 1
  return f.string(from: NSNumber(value: n)) ?? String(n)
}

/// «25:00», «4:05», «1:02:00». Redondea hacia arriba como formatoReloj.
func formatoReloj(_ segundos: Double) -> String {
  let s = max(0, Int(segundos.rounded(.up)))
  let h = s / 3600, m = (s % 3600) / 60, ss = s % 60
  return h > 0 ? String(format: "%d:%02d:%02d", h, m, ss) : String(format: "%d:%02d", m, ss)
}

/// Kilos sin ceros de más: 100 → «100», 62,5 → «62,5».
func formatoKilos(_ k: Double) -> String {
  k.rounded() == k ? String(Int(k)) : String(format: "%.1f", k).replacingOccurrences(of: ".", with: ",")
}
