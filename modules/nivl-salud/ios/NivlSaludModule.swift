// NIVL · Módulo nativo de Apple Salud y GPS del iPhone. Esta capa solo expone:
// la lectura está en LectorSalud.swift y la sesión GPS en GpsSesion.swift.
// La interfaz JS la envuelve src/lib/medicion/saludNativa.ts.

import ExpoModulesCore

public class NivlSaludModule: Module {
  public func definition() -> ModuleDefinition {
    Name("NivlSalud")

    Events("onGps")

    OnCreate {
      GpsSesion.compartido.alCambiar = { [weak self] estado in
        self?.sendEvent("onGps", estado)
      }
    }

    Function("disponible") { () -> Bool in
      LectorSalud.disponible()
    }

    AsyncFunction("pedirPermisos") { (categorias: [String], escribirEntrenos: Bool) async throws in
      try await LectorSalud.compartido.pedirPermisos(categorias: categorias, escribirEntrenos: escribirEntrenos)
    }

    AsyncFunction("hayQuePreguntar") { (categorias: [String]) async throws -> Bool in
      try await LectorSalud.compartido.hayQuePreguntar(categorias: categorias)
    }

    AsyncFunction("resumenDia") { (fecha: String) async throws -> [String: Any] in
      try await LectorSalud.compartido.resumenDia(fecha: fecha)
    }

    AsyncFunction("ventanaActividad") { (inicioISO: String, finISO: String) async throws -> [String: Any] in
      try await LectorSalud.compartido.ventanaActividad(inicioISO: inicioISO, finISO: finISO)
    }

    AsyncFunction("entrenosNuevos") { (limite: Int) async throws -> [String: Any] in
      try await LectorSalud.compartido.entrenosNuevos(limite: limite)
    }

    Function("confirmarAncla") { (ancla: String) in
      LectorSalud.compartido.confirmarAncla(ancla)
    }

    Function("reiniciarAncla") {
      LectorSalud.compartido.reiniciarAncla()
    }

    Function("gpsPermiso") { () -> String in
      GpsSesion.compartido.permiso()
    }

    AsyncFunction("gpsPedirPermiso") { () async throws -> String in
      try await GpsSesion.compartido.pedirPermiso()
    }

    AsyncFunction("gpsEmpezar") { (deporte: String, autoPausa: Bool) async throws in
      try await GpsSesion.compartido.empezar(deporte: deporte, autoPausa: autoPausa)
    }

    Function("gpsPausar") {
      GpsSesion.compartido.pausar()
    }

    Function("gpsReanudar") {
      GpsSesion.compartido.reanudar()
    }

    AsyncFunction("gpsParar") { (conSalud: Bool) async -> String? in
      await GpsSesion.compartido.parar(conSalud: conSalud)
    }

    Function("gpsDescartar") {
      GpsSesion.compartido.descartar()
    }

    Function("gpsEstado") { () -> [String: Any]? in
      GpsSesion.compartido.estado()
    }
  }
}
