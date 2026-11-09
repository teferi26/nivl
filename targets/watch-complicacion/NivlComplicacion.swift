// NIVL · Apple Watch: la complicación. Lee el resumen que la app del reloj
// guarda en el App Group (targets/watch/Almacen.swift) y se recarga cuando
// llega un día nuevo del iPhone. A medianoche las misiones dejan de ser de
// hoy: la complicación lo dice en vez de enseñar las de ayer.
//
// Familias: circular y esquina (racha), en línea (racha y pendientes) y
// rectangular (pendientes con la racha). Monocroma: la esfera la tiñe.

import SwiftUI
import WidgetKit

/// Copia de ResumenComplicacion (targets/watch/Contrato.swift).
struct ResumenComplicacion: Codable {
  let racha: Int
  let pendientes: Int
  let total: Int
  let nivel: Int
  let rango: String
  let fecha: String
  let sesion: Bool
}

private enum AppGroup {
  static let id = "group.com.teferi.nivl"
  static let claveResumen = "nivl.reloj.resumen"
}

struct EntradaNivl: TimelineEntry {
  let date: Date
  let resumen: ResumenComplicacion?
  /// La entrada de después de medianoche: lo guardado ya no es de hoy.
  var caducado = false

  static let ejemplo = EntradaNivl(
    date: Date(),
    resumen: ResumenComplicacion(racha: 23, pendientes: 3, total: 4, nivel: 14, rango: "D", fecha: "", sesion: true)
  )
}

private func claveHoy(_ d: Date) -> String {
  let c = Calendar.current.dateComponents([.year, .month, .day], from: d)
  return String(format: "%04d-%02d-%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0)
}

struct ProveedorNivl: TimelineProvider {
  func placeholder(in context: Context) -> EntradaNivl { .ejemplo }

  func getSnapshot(in context: Context, completion: @escaping (EntradaNivl) -> Void) {
    completion(context.isPreview ? .ejemplo : leer(Date()))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<EntradaNivl>) -> Void) {
    let ahora = Date()
    let hoy = leer(ahora)
    let manana = Calendar.current.startOfDay(for: ahora.addingTimeInterval(86_400))
    let caducada = EntradaNivl(date: manana, resumen: hoy.resumen, caducado: true)
    completion(Timeline(entries: [hoy, caducada], policy: .after(manana.addingTimeInterval(60))))
  }

  private func leer(_ ahora: Date) -> EntradaNivl {
    let d = UserDefaults(suiteName: AppGroup.id)
    guard let data = d?.data(forKey: AppGroup.claveResumen),
          let r = try? JSONDecoder().decode(ResumenComplicacion.self, from: data) else {
      return EntradaNivl(date: ahora, resumen: nil)
    }
    return EntradaNivl(date: ahora, resumen: r.sesion ? r : nil, caducado: r.fecha != claveHoy(ahora))
  }
}

struct VistaComplicacion: View {
  @Environment(\.widgetFamily) private var familia
  let entrada: EntradaNivl

  private var racha: Int { entrada.resumen?.racha ?? 0 }

  var body: some View {
    switch familia {
    case .accessoryCircular: circular
    case .accessoryCorner: esquina
    case .accessoryInline: enLinea
    default: rectangular
    }
  }

  private var circular: some View {
    ZStack {
      AccessoryWidgetBackground()
      VStack(spacing: -2) {
        Text(entrada.resumen == nil ? "-" : "\(racha)")
          .font(.custom("PlayfairDisplay-Bold", size: 20))
          .minimumScaleFactor(0.5)
          .widgetAccentable()
        Text("RACHA")
          .font(.system(size: 8, weight: .bold))
          .tracking(1)
      }
    }
    .accessibilityLabel("Racha: \(racha) días")
  }

  private var esquina: some View {
    Text(entrada.resumen == nil ? "-" : "\(racha)")
      .font(.custom("PlayfairDisplay-Bold", size: 18))
      .widgetCurvesContent()
      .widgetLabel {
        Text(textoPendientes)
      }
      .accessibilityLabel("Racha: \(racha) días. \(textoPendientes)")
  }

  private var enLinea: some View {
    Text(entrada.resumen == nil ? "NIVL" : "NIVL · \(racha) días · \(textoCorto)")
  }

  private var rectangular: some View {
    VStack(alignment: .leading, spacing: 1) {
      HStack(spacing: 4) {
        Image(systemName: "shield")
        Text("NIVL · RANGO \(entrada.resumen?.rango ?? "E")")
          .font(.system(size: 12, weight: .bold))
          .tracking(1)
      }
      .widgetAccentable()
      Text(entrada.resumen == nil ? "-" : "\(racha) días")
        .font(.custom("PlayfairDisplay-Bold", size: 22))
        .minimumScaleFactor(0.6)
      Text(textoPendientes)
        .font(.system(size: 13, weight: .medium))
        .lineLimit(1)
        .minimumScaleFactor(0.8)
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .accessibilityElement(children: .combine)
  }

  private var textoPendientes: String {
    guard let r = entrada.resumen else { return "Abre NIVL en el iPhone" }
    if entrada.caducado { return "Día nuevo: abre NIVL" }
    if r.total == 0 { return "Sin misiones hoy" }
    if r.pendientes == 0 { return "Día completo" }
    return r.pendientes == 1 ? "1 misión pendiente" : "\(r.pendientes) misiones pendientes"
  }

  private var textoCorto: String {
    guard let r = entrada.resumen else { return "" }
    if entrada.caducado { return "día nuevo" }
    return r.pendientes == 0 ? "hecho" : "\(r.pendientes) pend."
  }
}

@main
struct NivlComplicacion: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "nivl.racha", provider: ProveedorNivl()) { entrada in
      VistaComplicacion(entrada: entrada)
        .containerBackground(for: .widget) { Color(red: 0x09 / 255, green: 0x09 / 255, blue: 0x0B / 255) }
    }
    .configurationDisplayName("NIVL")
    .description("Tu racha y las misiones que te quedan hoy.")
    .supportedFamilies([.accessoryCircular, .accessoryCorner, .accessoryInline, .accessoryRectangular])
  }
}
