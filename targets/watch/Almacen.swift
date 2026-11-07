// NIVL · Apple Watch: el estado del reloj y su canal con el iPhone.
//
// · El iPhone manda el estado del día como applicationContext. Se guarda en
//   el App Group (lo lee la complicación) y se pinta aunque no haya conexión:
//   es una caché, la fuente de verdad sigue en el teléfono.
// · El reloj pide cosas con sendMessage si el iPhone está alcanzable (con
//   respuesta) y, si no, en cola con transferUserInfo (sin respuesta: se
//   aplicará cuando el iPhone abra NIVL).
// · Interruptor de demo: `-nivlDemo YES` al lanzar (o la clave nivlDemo en
//   UserDefaults). Pinta Demo.estado sin iPhone ni servidor y no manda nada.

import Foundation
import SwiftUI
import WatchConnectivity
import WidgetKit

@MainActor
final class Almacen: NSObject, ObservableObject {
  static let compartido = Almacen()

  @Published private(set) var estado: EstadoReloj?
  /// Misiones pedidas como hechas que el iPhone aún no ha confirmado.
  @Published private(set) var enCamino: Set<String> = []
  /// El último aviso del sistema que hay que enseñar (motivo del iPhone).
  @Published var aviso: String?
  @Published private(set) var alcanzable = false

  let modoDemo: Bool
  private let defaults = UserDefaults(suiteName: AppGroup.id) ?? .standard
  private let claveEstado = "nivl.reloj.estado"

  override init() {
    let args = ProcessInfo.processInfo.arguments
    modoDemo = UserDefaults.standard.bool(forKey: "nivlDemo") || args.contains("-nivlDemo")
    super.init()
    if modoDemo {
      estado = Demo.estado()
      guardarResumen()
    } else if let data = defaults.data(forKey: claveEstado),
              let e = try? JSONDecoder().decode(EstadoReloj.self, from: data) {
      estado = e
    }
  }

  func activar() {
    guard !modoDemo, WCSession.isSupported() else { return }
    let s = WCSession.default
    s.delegate = self
    s.activate()
  }

  // MARK: Recibir

  fileprivate func recibir(_ json: String) {
    guard let data = json.data(using: .utf8),
          let e = try? JSONDecoder().decode(EstadoReloj.self, from: data) else { return }
    // Un contexto más viejo que el que ya se pinta no lo pisa.
    if let actual = estado, actual.generadoEn > e.generadoEn { return }
    estado = e
    // Lo que el iPhone ya da por hecho deja de estar «en camino».
    enCamino = enCamino.filter { id in !(e.misiones.first { $0.id == id }?.hecha ?? true) }
    defaults.set(data, forKey: claveEstado)
    guardarResumen()
  }

  private func guardarResumen() {
    guard let e = estado else { return }
    let r = ResumenComplicacion(
      racha: e.racha,
      pendientes: e.pendientes,
      total: e.cuentan,
      nivel: e.nivel,
      rango: e.rango,
      fecha: e.fecha,
      sesion: e.sesion
    )
    if let data = try? JSONEncoder().encode(r) {
      defaults.set(data, forKey: AppGroup.claveResumen)
      WidgetCenter.shared.reloadAllTimelines()
    }
  }

  // MARK: Pedir

  /// «Hecha» desde la muñeca. Devuelve lo que hay que decir, o nil si fue bien.
  func completar(_ m: MisionReloj) async -> String? {
    guard let e = estado else { return "Abre NIVL en el iPhone." }
    guard e.esDeHoy else { return "El día ha cambiado. Abre NIVL en el iPhone." }
    if modoDemo {
      marcarLocal(m.id)
      return nil
    }
    let peticion = PeticionReloj.completar(id: m.id, fecha: e.fecha)
    enCamino.insert(m.id)
    switch await enviar(peticion) {
    case let .respuesta(r):
      if r.ok {
        marcarLocal(m.id)
        return nil
      }
      enCamino.remove(m.id)
      return r.motivo ?? "El sistema no responde."
    case .enCola:
      // Se queda «en camino» hasta que el iPhone mande el día con ella hecha.
      return "Sin conexión con el iPhone. Se marcará al abrir NIVL."
    case .fallo:
      enCamino.remove(m.id)
      return "El sistema no responde. Inténtalo desde el iPhone."
    }
  }

  /// Arrancar, pausar o parar el pomodoro del iPhone. false si no se pudo.
  func mandarFocus(_ accion: String) async -> Bool {
    if modoDemo { return false }
    if case let .respuesta(r) = await enviar(.focus(accion: accion), soloDirecto: true), r.ok { return true }
    return false
  }

  /// Al abrir el reloj: que el iPhone reenvíe lo último.
  func pedirEstado() {
    guard !modoDemo else { return }
    Task { _ = await enviar(.estado, soloDirecto: true) }
  }

  private func marcarLocal(_ id: String) {
    guard var e = estado, let i = e.misiones.firstIndex(where: { $0.id == id }) else { return }
    e.misiones[i].hecha = true
    estado = e
    guardarResumen()
  }

  enum Resultado {
    case respuesta(RespuestaReloj)
    case enCola
    case fallo
  }

  private func enviar(_ p: PeticionReloj, soloDirecto: Bool = false) async -> Resultado {
    guard WCSession.isSupported() else { return .fallo }
    let s = WCSession.default
    guard s.activationState == .activated else { return .fallo }
    let mensaje: [String: Any] = ["peticion": p.json]
    if s.isReachable {
      return await withCheckedContinuation { (cont: CheckedContinuation<Resultado, Never>) in
        s.sendMessage(mensaje, replyHandler: { reply in
          let json = reply["respuesta"] as? String ?? ""
          let r = json.data(using: .utf8).flatMap { try? JSONDecoder().decode(RespuestaReloj.self, from: $0) }
          cont.resume(returning: r.map { .respuesta($0) } ?? .fallo)
        }, errorHandler: { _ in
          cont.resume(returning: .fallo)
        })
      }
    }
    if soloDirecto { return .fallo }
    s.transferUserInfo(mensaje)
    return .enCola
  }
}

extension Almacen: WCSessionDelegate {
  nonisolated func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
    let json = session.receivedApplicationContext["estado"] as? String
    let alcanzable = session.isReachable
    Task { @MainActor in
      self.alcanzable = alcanzable
      if let json { self.recibir(json) }
      self.pedirEstado()
    }
  }

  nonisolated func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
    guard let json = applicationContext["estado"] as? String else { return }
    Task { @MainActor in self.recibir(json) }
  }

  nonisolated func sessionReachabilityDidChange(_ session: WCSession) {
    let alcanzable = session.isReachable
    Task { @MainActor in
      self.alcanzable = alcanzable
      if alcanzable { self.pedirEstado() }
    }
  }
}
