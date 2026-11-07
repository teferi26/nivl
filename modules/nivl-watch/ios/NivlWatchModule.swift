// NIVL · puente con el Apple Watch (lado iPhone).
//
// · `actualizarContexto(json)`: el estado del día va al reloj como
//   applicationContext (el último gana y llega aunque el reloj esté dormido).
//   Si la sesión aún no está activa, se guarda y se manda al activarse.
// · Lo que pide el reloj (sendMessage en directo o transferUserInfo en cola)
//   se guarda en una cola y se avisa a JS con `onMensaje`; JS la vacía con
//   `tomarPendientes()` (así no se pierde nada si JS aún no escuchaba, p. ej.
//   el iPhone despertado en segundo plano por el reloj).
// · Las peticiones en directo esperan respuesta: JS contesta con
//   `responder(id, json)`. Si JS no contesta en 8 s, se responde «sin respuesta».
//
// El contrato (las claves y el JSON) está en src/watch/contrato.ts.

import ExpoModulesCore
import WatchConnectivity

public class NivlWatchModule: Module {
  public func definition() -> ModuleDefinition {
    Name("NivlWatch")

    Events("onMensaje")

    OnCreate {
      PuenteReloj.compartido.alLlegar = { [weak self] in
        self?.sendEvent("onMensaje", [:])
      }
      PuenteReloj.compartido.activar()
    }

    Function("disponible") { () -> Bool in
      WCSession.isSupported()
    }

    Function("estado") { () -> [String: Bool] in
      PuenteReloj.compartido.estado()
    }

    Function("actualizarContexto") { (json: String) in
      PuenteReloj.compartido.publicar(json)
    }

    Function("tomarPendientes") { () -> [[String: String]] in
      PuenteReloj.compartido.tomarPendientes()
    }

    Function("responder") { (id: String, json: String) in
      PuenteReloj.compartido.responder(id: id, json: json)
    }
  }
}

/// El delegado de WatchConnectivity. Uno por proceso (WCSession.default lo es).
final class PuenteReloj: NSObject, WCSessionDelegate {
  static let compartido = PuenteReloj()

  /// Avisa a JS de que hay peticiones en la cola.
  var alLlegar: (() -> Void)?

  private let cola = DispatchQueue(label: "app.nivl.reloj")
  private var contextoPendiente: String?
  private var pendientes: [[String: String]] = []
  private var respuestas: [String: ([String: Any]) -> Void] = [:]

  func activar() {
    guard WCSession.isSupported() else { return }
    let s = WCSession.default
    if s.delegate == nil { s.delegate = self }
    if s.activationState != .activated { s.activate() }
  }

  func estado() -> [String: Bool] {
    guard WCSession.isSupported() else { return ["emparejado": false, "instalada": false, "alcanzable": false] }
    let s = WCSession.default
    return ["emparejado": s.isPaired, "instalada": s.isWatchAppInstalled, "alcanzable": s.isReachable]
  }

  func publicar(_ json: String) {
    cola.async {
      self.contextoPendiente = json
      self.enviarContexto()
    }
  }

  /// En `cola`.
  private func enviarContexto() {
    guard WCSession.isSupported(), let json = contextoPendiente else { return }
    let s = WCSession.default
    guard s.activationState == .activated else {
      activar()
      return
    }
    // Sin reloj o sin la app instalada, applicationContext lanza: se guarda
    // y se reintenta al cambiar el estado del emparejamiento.
    guard s.isPaired, s.isWatchAppInstalled else { return }
    do {
      try s.updateApplicationContext(["estado": json])
      contextoPendiente = nil
    } catch {
      // Se queda pendiente para el siguiente intento.
    }
  }

  func tomarPendientes() -> [[String: String]] {
    cola.sync {
      let todo = pendientes
      pendientes.removeAll()
      return todo
    }
  }

  func responder(id: String, json: String) {
    cola.async {
      guard let r = self.respuestas.removeValue(forKey: id) else { return }
      r(["respuesta": json])
    }
  }

  private func encolar(_ json: String, respuesta: (([String: Any]) -> Void)?) {
    cola.async {
      var id = ""
      if let respuesta {
        id = UUID().uuidString
        self.respuestas[id] = respuesta
        // El reloj no espera para siempre: si JS no contesta (app sin JS
        // cargado), se responde «vuelve a intentarlo» y la petición SALE de
        // la cola: si se quedara, JS la atendería minutos después (un
        // «pausar» del pomodoro a destiempo o una misión marcada que el reloj
        // dio por fallida).
        self.cola.asyncAfter(deadline: .now() + 8) {
          if let r = self.respuestas.removeValue(forKey: id) {
            self.pendientes.removeAll { $0["id"] == id }
            r(["respuesta": "{\"ok\":false,\"motivo\":\"Abre NIVL en el iPhone y vuelve a intentarlo.\"}"])
          }
        }
      }
      // Tope de la cola: un reloj sin red no puede llenar la memoria.
      if self.pendientes.count >= 50 { self.pendientes.removeFirst() }
      self.pendientes.append(["id": id, "json": json])
      DispatchQueue.main.async { self.alLlegar?() }
    }
  }

  // MARK: WCSessionDelegate

  func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
    cola.async { self.enviarContexto() }
  }

  func sessionDidBecomeInactive(_ session: WCSession) {}

  func sessionDidDeactivate(_ session: WCSession) {
    // Cambio de reloj emparejado: se activa la sesión del nuevo.
    session.activate()
  }

  func sessionWatchStateDidChange(_ session: WCSession) {
    cola.async { self.enviarContexto() }
  }

  func session(_ session: WCSession, didReceiveMessage message: [String: Any], replyHandler: @escaping ([String: Any]) -> Void) {
    guard let json = message["peticion"] as? String else {
      replyHandler(["respuesta": "{\"ok\":false,\"motivo\":\"Petición no reconocida.\"}"])
      return
    }
    encolar(json, respuesta: replyHandler)
  }

  func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
    guard let json = message["peticion"] as? String else { return }
    encolar(json, respuesta: nil)
  }

  func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any] = [:]) {
    guard let json = userInfo["peticion"] as? String else { return }
    encolar(json, respuesta: nil)
  }
}
