// NIVL · Apple Watch: la app. Cuatro páginas en vertical (la corona las
// pasa): Hoy, Racha y rango, FOCUS y Descanso IRON.

import SwiftUI

@main
struct NivlRelojApp: App {
  @StateObject private var almacen = Almacen.compartido
  @Environment(\.scenePhase) private var fase

  var body: some Scene {
    WindowGroup {
      RaizReloj()
        .environmentObject(almacen)
        .onAppear { almacen.activar() }
        .onChange(of: fase) { _, nueva in
          if nueva == .active { almacen.pedirEstado() }
        }
    }
  }
}

struct RaizReloj: View {
  @EnvironmentObject private var almacen: Almacen
  @State private var pagina = Pagina.inicial
  /// Solo en demo: `-nivlMision demo-1` abre su confirmación (capturas).
  @State private var misionDemo: MisionReloj?

  enum Pagina: Int, Hashable {
    case hoy, racha, focus, descanso

    /// `-nivlPagina racha|focus|descanso` al lanzar (capturas del simulador).
    static var inicial: Pagina {
      switch UserDefaults.standard.string(forKey: "nivlPagina") {
      case "racha": return .racha
      case "focus": return .focus
      case "descanso": return .descanso
      default: return .hoy
      }
    }
  }

  var body: some View {
    // Una sola pila de navegación por fuera de las páginas (lo que pide
    // watchOS 10+): la confirmación de una misión se apila encima.
    NavigationStack {
      TabView(selection: $pagina) {
        VistaHoy().tag(Pagina.hoy)
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
