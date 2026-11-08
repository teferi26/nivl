// NIVL · Apple Watch: la app. Cinco páginas en vertical (la corona las
// pasa): Hoy, Entrenar, Racha y rango, FOCUS y Descanso IRON. Con un entreno
// en marcha, su pantalla ocupa el lugar de las páginas.

import SwiftUI
import WatchKit

/// Si la app cae con un entreno en marcha, el sistema la relanza y avisa por
/// aquí, aunque no llegue a aparecer ninguna vista.
final class DelegadoReloj: NSObject, WKApplicationDelegate {
  func handleActiveWorkoutRecovery() {
    guard !Almacen.compartido.modoDemo else { return }
    ServicioEntreno.compartido.alArrancar()
  }
}

@main
struct NivlRelojApp: App {
  @WKApplicationDelegateAdaptor(DelegadoReloj.self) private var delegado
  @StateObject private var almacen = Almacen.compartido
  @Environment(\.scenePhase) private var fase

  var body: some Scene {
    WindowGroup {
      RaizReloj()
        .environmentObject(almacen)
        .onAppear { almacen.activar() }
        .onChange(of: fase) { _, nueva in
          guard nueva == .active else { return }
          almacen.pedirEstado()
          // Solo actúa si la recuperación anterior falló.
          if !almacen.modoDemo { ServicioEntreno.compartido.alArrancar() }
        }
    }
  }
}

struct RaizReloj: View {
  @EnvironmentObject private var almacen: Almacen
  @ObservedObject private var entreno = ServicioEntreno.compartido
  @State private var pagina = Pagina.inicial
  /// Solo en demo: `-nivlMision demo-1` abre su confirmación (capturas).
  @State private var misionDemo: MisionReloj?

  enum Pagina: Int, Hashable {
    case hoy, entrenar, racha, focus, descanso

    /// `-nivlPagina entrenar|racha|focus|descanso` al lanzar (capturas del simulador).
    static var inicial: Pagina {
      switch UserDefaults.standard.string(forKey: "nivlPagina") {
      case "entrenar": return .entrenar
      case "racha": return .racha
      case "focus": return .focus
      case "descanso": return .descanso
      default: return .hoy
      }
    }
  }

  var body: some View {
    // El entreno va fuera de las páginas: un gesto de corona no debe poder
    // sacarte de él, y al salir la pila de navegación vuelve limpia.
    Group {
      if almacen.modoDemo, let demo = Demo.pantallaEntreno {
        switch demo {
        case .enMarcha:
          PanelEntreno(fase: .enMarcha, metricas: Demo.metricasEntreno(), acciones: AccionesEntreno())
        case .resumen:
          ResumenEntrenoVista(resumen: Demo.resumenEntreno(), alCerrar: {})
        }
      } else if entreno.fase.enCurso {
        VistaEntrenoEnMarcha()
      } else if entreno.fase.esResumen {
        VistaResumenEntreno()
      } else {
        paginas
      }
    }
    // Aquí y no en las páginas: al fallar, las páginas se montan ya con el
    // error puesto y dentro de ellas no se vería el cambio.
    .onChange(of: entreno.fase.textoError) { _, motivo in
      if motivo != nil { pagina = .entrenar }
    }
  }

  private var paginas: some View {
    // Una sola pila de navegación por fuera de las páginas (lo que pide
    // watchOS 10+): la confirmación de una misión se apila encima.
    NavigationStack {
      TabView(selection: $pagina) {
        VistaHoy().tag(Pagina.hoy)
        VistaEntrenar().tag(Pagina.entrenar)
        VistaRacha().tag(Pagina.racha)
        VistaFocus().tag(Pagina.focus)
        VistaDescanso().tag(Pagina.descanso)
      }
      .tabViewStyle(.verticalPage)
      .background(Ink.ink0)
      .navigationDestination(item: $misionDemo) { m in ConfirmarMision(mision: m) }
    }
    .onAppear {
      guard almacen.modoDemo, let id = UserDefaults.standard.string(forKey: "nivlMision") else { return }
      misionDemo = almacen.estado?.misiones.first { $0.id == id }
    }
    .tint(Ink.ink10)
  }
}

/// Sin datos todavía: ni el iPhone ha publicado nada ni hay caché.
struct SinDatos: View {
  let titulo: String
  var linea = "Abre NIVL en el iPhone. Tu día llegará aquí."

  var body: some View {
    VStack(spacing: 10) {
      Image(systemName: "shield")
        .font(.system(size: 30, weight: .light))
        .foregroundStyle(Ink.ink6)
        .accessibilityHidden(true)
      Text(titulo)
        .font(Tipo.inscripcion(15))
        .tracking(3)
        .foregroundStyle(Ink.ink9)
      Text(linea)
        .font(Tipo.detalle)
        .foregroundStyle(Ink.ink8)
        .multilineTextAlignment(.center)
    }
    .padding(.horizontal, 8)
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .accessibilityElement(children: .combine)
  }
}
