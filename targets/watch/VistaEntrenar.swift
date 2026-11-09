// NIVL · Apple Watch: Entrenar. Se elige deporte, se comprueba el permiso de
// Salud, en piscina el largo, y la cuenta atrás. A partir de `empezar` la
// raíz cambia a la pantalla del entreno en marcha.

import SwiftUI
import WatchKit

extension DeporteReloj {
  static let enPantalla: [DeporteReloj] = [.carrera, .bici, .piscina, .aguasAbiertas, .fuerza]

  var nombreEnPantalla: String {
    switch self {
    case .carrera: return "Carrera"
    case .bici: return "Bici"
    case .piscina: return "Piscina"
    case .aguasAbiertas: return "Aguas abiertas"
    case .fuerza: return "Fuerza"
    }
  }

  var simbolo: String {
    switch self {
    case .carrera: return "figure.run"
    case .bici: return "figure.outdoor.cycle"
    case .piscina: return "figure.pool.swim"
    case .aguasAbiertas: return "figure.open.water.swim"
    case .fuerza: return "figure.strengthtraining.traditional"
    }
  }

  /// La auto-pausa propia solo vale al aire libre y con GPS bueno.
  var admiteAutoPausa: Bool { self == .carrera || self == .bici }
  var esDeAgua: Bool { self == .piscina || self == .aguasAbiertas }
  var usaGps: Bool { self == .carrera || self == .bici || self == .aguasAbiertas }
}

struct VistaEntrenar: View {
  @ObservedObject private var servicio = ServicioEntreno.compartido
  @AppStorage("nivlEntrenoAutoPausa") private var autoPausa = true

  var body: some View {
    List {
      Section {
        if let motivo = servicio.fase.textoError {
          Text(motivo)
            .font(Tipo.detalle)
            .foregroundStyle(Ink.ink9)
            .fixedSize(horizontal: false, vertical: true)
            .listRowBackground(Trama().clipShape(RoundedRectangle(cornerRadius: Radio.tarjeta)))
        }
        ForEach(DeporteReloj.enPantalla, id: \.self) { d in
          NavigationLink {
            PrepararEntreno(deporte: d, autoPausa: d.admiteAutoPausa && autoPausa)
          } label: {
            FilaDeporte(deporte: d)
          }
          .listRowBackground(RoundedRectangle(cornerRadius: Radio.tarjeta).fill(Ink.ink1))
          .accessibilityHint("Prepara un entreno de \(d.nombreEnPantalla.lowercased()).")
        }
        Toggle(isOn: $autoPausa) {
          Text("Auto-pausa")
            .font(Tipo.detalle)
            .foregroundStyle(Ink.ink8)
            .lineLimit(1)
            .minimumScaleFactor(0.8)
        }
        .listRowBackground(Rectangle().fill(Ink.ink0))
        .accessibilityHint("Pausa carrera y bici al detenerte.")
      } header: {
        Text("ENTRENAR")
          .font(Tipo.inscripcion(16))
          .foregroundStyle(Ink.ink10)
          .lineLimit(1)
          .minimumScaleFactor(0.7)
          .accessibilityAddTraits(.isHeader)
      }
    }
    .listStyle(.plain)
    .scrollContentBackground(.hidden)
    .background(Ink.ink0)
  }
}

private struct FilaDeporte: View {
  let deporte: DeporteReloj

  var body: some View {
    HStack(spacing: 8) {
      Image(systemName: deporte.simbolo)
        .font(.system(.title3))
        .foregroundStyle(Ink.ink9)
        .frame(minWidth: 24)
        .accessibilityHidden(true)
      VStack(alignment: .leading, spacing: 1) {
        Text(deporte.nombreEnPantalla)
          .font(Tipo.fila)
          .foregroundStyle(Ink.ink9)
          .lineLimit(1)
          .minimumScaleFactor(0.7)
        // Fuerza no paga por el reloj: mejor decirlo antes que después.
        if deporte == .fuerza {
          Text("Pulso y calorías. La sesión se apunta en IRON.")
            .font(Tipo.detalle)
            .foregroundStyle(Ink.ink6)
            .fixedSize(horizontal: false, vertical: true)
        }
      }
    }
    .padding(.vertical, 4)
    .accessibilityElement(children: .combine)
  }
}

/// Lo que va entre tocar un deporte y empezar. Todo en una vista empujada: si
/// se vuelve atrás, se cancela la comprobación y la cuenta.
struct PrepararEntreno: View {
  private enum Paso { case permiso, sinConsentimiento, sinPermiso, largo, cuenta }

  let deporte: DeporteReloj
  let autoPausa: Bool

  @EnvironmentObject private var almacen: Almacen
  @ObservedObject private var servicio = ServicioEntreno.compartido
  @Environment(\.dismiss) private var cerrar
  @State private var paso = Paso.permiso
  @State private var largo: Double?

  var body: some View {
    contenido
      .background(Ink.ink0)
      .task { await comprobarPermiso() }
  }

  @ViewBuilder
  private var contenido: some View {
    switch paso {
    case .permiso:
      Rotulo(texto: "Comprobando permisos")
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    case .sinConsentimiento:
      SinPermiso(
        linea: "Sin tu permiso de salud en NIVL, el reloj no mide ni guarda nada.",
        comoActivarlo: "Actívalo en el iPhone: NIVL, Perfil, Tus datos de salud. Abre NIVL con el reloj cerca.",
        alCerrar: { cerrar() })
    case .sinPermiso:
      SinPermiso(
        linea: "Sin acceso a Salud, el reloj no puede medir este entreno.",
        comoActivarlo: "Actívalo en la app Salud del iPhone: tu perfil, Apps, NIVL.",
        alCerrar: { cerrar() })
    case .largo:
      ElegirLargo { metros in
        largo = metros
        paso = .cuenta
      }
    case .cuenta:
      CuentaAtras(deporte: deporte, alTerminar: arrancar)
    }
  }

  private func comprobarPermiso() async {
    // Antes que HealthKit: sin el consentimiento de NIVL ni se muestra su diálogo.
    // Desconocido cuenta como no: el iPhone aún no ha dicho que sí.
    guard almacen.modoDemo || almacen.estado?.saludAceptada == true else {
      WKInterfaceDevice.current().play(.failure)
      paso = .sinConsentimiento
      return
    }
    // En demo no se toca HealthKit: la captura no debe colgarse de un diálogo.
    let concedido = almacen.modoDemo ? true : await servicio.pedirPermisos()
    guard !Task.isCancelled else { return }
    if !concedido {
      WKInterfaceDevice.current().play(.failure)
      paso = .sinPermiso
    } else {
      paso = deporte == .piscina ? .largo : .cuenta
    }
  }

  private func arrancar() {
    guard !almacen.modoDemo else {
      cerrar()
      return
    }
    servicio.empezar(deporte, largoPiscina: largo, autoPausa: autoPausa)
  }
}

private struct SinPermiso: View {
  let linea: String
  let comoActivarlo: String
  let alCerrar: () -> Void

  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 8) {
        Text("SIN PERMISO")
          .font(Tipo.inscripcion(14))
          .foregroundStyle(Ink.ink10)
          .lineLimit(1)
          .minimumScaleFactor(0.7)
          .accessibilityAddTraits(.isHeader)
        Text(linea)
          .font(Tipo.detalle)
          .foregroundStyle(Ink.ink9)
          .fixedSize(horizontal: false, vertical: true)
          .padding(8)
          .frame(maxWidth: .infinity, alignment: .leading)
          .background(Trama().clipShape(RoundedRectangle(cornerRadius: Radio.control)))
          .overlay(RoundedRectangle(cornerRadius: Radio.control).stroke(Ink.ink4, lineWidth: 1))
        Text(comoActivarlo)
          .font(Tipo.detalle)
          .foregroundStyle(Ink.ink8)
          .fixedSize(horizontal: false, vertical: true)
        Button("Entendido", action: alCerrar)
          .buttonStyle(BotonContorno())
          .accessibilityHint("Vuelve a la lista de deportes.")
      }
      .padding(.horizontal, 4)
    }
  }
}

private struct ElegirLargo: View {
  let alElegir: (Double) -> Void

  @AppStorage("nivlEntrenoLargoOtro") private var otro = 33
  @State private var viendoOtro = false

  var body: some View {
    ScrollView {
      VStack(spacing: 6) {
        Rotulo(texto: "Largo de piscina")
        HStack(spacing: 6) {
          botonLargo(25)
          botonLargo(50)
        }
        if viendoOtro {
          // 10 a 100 m: el rango que admite el contrato del entreno.
          Stepper(value: $otro, in: 10...100) {
            Text("\(otro) m")
              .font(Tipo.cifra(20, relativoA: .title3))
              .foregroundStyle(Ink.ink10)
              .lineLimit(1)
              .minimumScaleFactor(0.6)
          }
          .accessibilityLabel("Largo de piscina")
          .accessibilityValue("\(otro) metros")
          Button {
            alElegir(Double(otro))
          } label: {
            Text("Usar \(otro) m").textCase(nil).lineLimit(1).minimumScaleFactor(0.7)
          }
          .buttonStyle(BotonInvertido())
          .accessibilityLabel("Usar piscina de \(otro) metros")
        } else {
          Button("Otra") { viendoOtro = true }
            .buttonStyle(BotonContorno())
            .accessibilityLabel("Otra medida de piscina")
        }
      }
      .padding(.horizontal, 4)
    }
  }

  private func botonLargo(_ metros: Int) -> some View {
    Button {
      alElegir(Double(metros))
    } label: {
      Text("\(metros) m").textCase(nil).lineLimit(1).minimumScaleFactor(0.7)
    }
    .buttonStyle(BotonContorno())
    .accessibilityLabel("Piscina de \(metros) metros")
  }
}

/// 3, 2, 1. Tocar la cifra salta la espera.
private struct CuentaAtras: View {
  let deporte: DeporteReloj
  let alTerminar: () -> Void

  @Environment(\.dismiss) private var cerrar
  @State private var cifra = 3
  @State private var disparada = false

  /// Sale del alto de la pantalla, como el anillo de FOCUS: tiene que convivir
  /// con el botón sin girar la corona en 40 mm.
  private static let tamCifra: CGFloat = min(84, (WKInterfaceDevice.current().screenBounds.height * 0.36).rounded())

  var body: some View {
    VStack(spacing: 4) {
      Rotulo(texto: deporte.nombreEnPantalla)
      Button(action: disparar) {
        Text("\(cifra)")
          .font(Tipo.cifra(Self.tamCifra))
          .minimumScaleFactor(0.5)
          .lineLimit(1)
          .foregroundStyle(Ink.ink10)
          .frame(maxWidth: .infinity, maxHeight: .infinity)
          .contentShape(Rectangle())
      }
      .buttonStyle(.plain)
      .accessibilityLabel("Empieza en \(cifra)")
      .accessibilityHint("Toca para empezar ya.")
      Button("Cancelar") { cerrar() }
        .buttonStyle(BotonContorno())
    }
    .padding(.horizontal, 4)
    .task {
      for n in [3, 2, 1] {
        cifra = n
        WKInterfaceDevice.current().play(.click)
        try? await Task.sleep(for: .seconds(1))
        if Task.isCancelled { return }
      }
      disparar()
    }
  }

  private func disparar() {
    guard !disparada else { return }
    disparada = true
    WKInterfaceDevice.current().play(.start)
    alTerminar()
  }
}
