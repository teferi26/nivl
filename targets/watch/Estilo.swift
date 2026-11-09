// NIVL · Apple Watch: «Ónix» en la muñeca.
// Los mismos tokens que src/design/tokens.ts: fondo casi negro, botón hueso y el
// oro solo como hilo, nunca de relleno. Playfair para cifras grandes y títulos;
// el texto que se lee, en la fuente del sistema (lo más legible a 40 mm).

import SwiftUI

enum Ink {
  private static func hex(_ v: UInt32) -> Color {
    Color(red: Double(v >> 16 & 255) / 255, green: Double(v >> 8 & 255) / 255, blue: Double(v & 255) / 255)
  }
  static let ink0 = hex(0x09090B)
  static let ink1 = hex(0x151517)
  static let ink2 = hex(0x1D1D1F)
  static let ink3 = hex(0x2A2A2C)
  static let ink4 = hex(0x4A494C)
  static let ink6 = hex(0x8F8C85)
  static let ink8 = hex(0xB8B4AB)
  static let ink9 = hex(0xF5F2EC)
  /// Hueso: el botón principal y lo invertido.
  static let ink10 = hex(0xEDEAE3)
}

/// El oro: trazos, barras y rótulos. Nunca el relleno de un botón.
enum Oro {
  static let hilo = Color(red: 0xC9 / 255, green: 0xA9 / 255, blue: 0x61 / 255)
}

enum Radio {
  static let tarjeta: CGFloat = 14
  static let control: CGFloat = 12
}

enum Tipo {
  /// Cifras grandes (racha, nivel, reloj): Playfair 700 con su escalado.
  static func cifra(_ tam: CGFloat, relativoA estilo: Font.TextStyle = .largeTitle) -> Font {
    .custom("PlayfairDisplay-Bold", size: tam, relativeTo: estilo)
  }

  /// Lo grabado: «RANGO D», rótulos de pantalla.
  static func inscripcion(_ tam: CGFloat = 13) -> Font {
    .custom("PlayfairDisplay-Bold", size: tam, relativeTo: .footnote)
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
      .foregroundStyle(Oro.hilo)
      // Una línea siempre: en 40 mm «BLOQUE 2 DE 4 · IPHONE» partía en dos
      // por el punto medio. Encoge antes que partir.
      .lineLimit(1)
      .minimumScaleFactor(0.7)
      .accessibilityAddTraits(.isHeader)
  }
}

/// La acción principal: hueso con texto oscuro. Una por pantalla.
struct BotonInvertido: ButtonStyle {
  var activo = true
  func makeBody(configuration: Configuration) -> some View {
    configuration.label
      .font(Tipo.boton)
      .tracking(1.5)
      .textCase(.uppercase)
      .frame(maxWidth: .infinity, minHeight: 44)
      .foregroundStyle(activo ? Ink.ink0 : Ink.ink6)
      .background(activo ? Ink.ink10 : Ink.ink2, in: RoundedRectangle(cornerRadius: Radio.control))
      .overlay(RoundedRectangle(cornerRadius: Radio.control).stroke(activo ? Color.clear : Ink.ink4, lineWidth: 1))
      .scaleEffect(configuration.isPressed ? 0.97 : 1)
      .animation(.easeOut(duration: 0.1), value: configuration.isPressed)
  }
}

/// Lo secundario: contorno fino sobre el fondo.
struct BotonContorno: ButtonStyle {
  func makeBody(configuration: Configuration) -> some View {
    configuration.label
      .font(Tipo.boton)
      .tracking(1.5)
      .textCase(.uppercase)
      .frame(maxWidth: .infinity, minHeight: 44)
      .foregroundStyle(Ink.ink9)
      .background(configuration.isPressed ? Ink.ink2 : Ink.ink0, in: RoundedRectangle(cornerRadius: Radio.control))
      .overlay(RoundedRectangle(cornerRadius: Radio.control).stroke(Ink.ink4, lineWidth: 1))
  }
}

/// El hilo de oro: separa lo logrado. Decoración, el lector de pantalla lo omite.
struct HiloOro: View {
  var body: some View {
    Rectangle().fill(Oro.hilo).frame(height: 1).accessibilityHidden(true)
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

/// Los controles del entreno: icono y una palabra, tocables con guantes o con
/// la mano mojada. Sin alto fijo: crece con el tipo y no corta en 40 mm.
struct BotonControl: ButtonStyle {
  var invertido = false
  @Environment(\.isEnabled) private var activo

  func makeBody(configuration: Configuration) -> some View {
    configuration.label
      .font(Tipo.rotulo)
      .tracking(1)
      .textCase(.uppercase)
      .lineLimit(1)
      .minimumScaleFactor(0.6)
      .padding(.vertical, 6)
      .padding(.horizontal, 2)
      .frame(maxWidth: .infinity, minHeight: 50)
      .foregroundStyle(!activo ? Ink.ink6 : (invertido ? Ink.ink0 : Ink.ink9))
      .background(invertido && activo ? Ink.ink10 : (configuration.isPressed ? Ink.ink2 : Ink.ink0))
      .overlay(Rectangle().stroke(invertido && activo ? Color.clear : Ink.ink4, lineWidth: 1))
      .scaleEffect(configuration.isPressed ? 0.97 : 1)
      .animation(.easeOut(duration: 0.1), value: configuration.isPressed)
  }
}

/// El valor que el sensor no ha dado. Dos guiones simples, nunca un 0: un 0
/// se leería como medido.
let sinMedir = "--"

/// Cronómetro de lo transcurrido: «4:05», «1:02:00». Hacia abajo, al revés
/// que formatoReloj (una cuenta atrás), para no adelantar un segundo.
func formatoCrono(_ segundos: Double) -> String {
  guard segundos.isFinite else { return "0:00" }
  let s = max(0, Int(segundos))
  let h = s / 3600, m = (s % 3600) / 60, ss = s % 60
  return h > 0 ? String(format: "%d:%02d:%02d", h, m, ss) : String(format: "%d:%02d", m, ss)
}

/// Un decimal fijo con coma: «12,48».
func formatoDecimal(_ n: Double, decimales: Int) -> String {
  String(format: "%.\(decimales)f", n).replacingOccurrences(of: ".", with: ",")
}

/// Ritmo «4:32» a partir de segundos. Parado, el ritmo se dispara: más de una
/// hora por tramo no es un dato que enseñar.
func formatoRitmo(_ segundos: Double?) -> String {
  guard let segundos, segundos.isFinite, segundos > 0, segundos < 3600 else { return sinMedir }
  let s = Int(segundos.rounded())
  return String(format: "%d:%02d", s / 60, s % 60)
}

/// Un entero medido, o los dos guiones si no lo hay.
func formatoEntero(_ n: Double?) -> String {
  guard let n, n.isFinite else { return sinMedir }
  return formatoMiles(Int(n.rounded()))
}
