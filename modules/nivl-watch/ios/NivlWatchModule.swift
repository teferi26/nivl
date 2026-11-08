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
// · Los entrenos medidos en el reloj llegan como fichero (transferFile) a un
//   buzón en disco: JS los recoge con `tomarEntrenos()` y, cuando los ha
//   guardado, `confirmarEntreno(id)` borra la copia y avisa al reloj para que
//   borre la suya. Hasta entonces, nada se pierde.
//
// El contrato (las claves y el JSON) está en src/watch/contrato.ts.

import ExpoModulesCore
import WatchConnectivity

public class NivlWatchModule: Module {
  public func definition() -> ModuleDefinition {
    Name("NivlWatch")

    Events("onMensaje", "onEntreno")

    OnCreate {
      PuenteReloj.compartido.alLlegar = { [weak self] in
        self?.sendEvent("onMensaje", [:])
      }
      PuenteReloj.compartido.alLlegarEntreno = { [weak self] in
        self?.sendEvent("onEntreno", [:])
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

    Function("tomarEntrenos") { () -> [[String: String]] in
      BuzonEntrenosReloj.compartido.tomar()
    }

    Function("confirmarEntreno") { (id: String) in
      PuenteReloj.compartido.confirmarEntreno(id)
    }
  }
}

/// Los entrenos del reloj esperando a que JS los guarde. Application Support:
/// no se purga solo, a diferencia de Caches.
final class BuzonEntrenosReloj {
  static let compartido = BuzonEntrenosReloj()

  private let tope = 200
  private let fm = FileManager.default

  private var carpeta: URL {
    fm.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
      .appendingPathComponent("nivl-reloj-entrenos", isDirectory: true)
  }

  /// El id acaba siendo un nombre de fichero: solo letras, números y guiones.
  static func idValido(_ id: String) -> Bool {
    !id.isEmpty && id.count <= 100
      && id.unicodeScalars.allSatisfy { CharacterSet.alphanumerics.contains($0) || $0 == "-" || $0 == "_" }
  }

  private func fichero(_ id: String) -> URL {
    carpeta.appendingPathComponent(id).appendingPathExtension("json")
  }

  private func prepararCarpeta() {
    var url = carpeta
    try? fm.createDirectory(at: url, withIntermediateDirectories: true)
    // Llevan pulso y ruta: no viajan en la copia de seguridad.
    var valores = URLResourceValues()
    valores.isExcludedFromBackup = true
    try? url.setResourceValues(valores)
  }

  /// Los ficheros, del más antiguo al más nuevo.
  private func ficheros() -> [(url: URL, fecha: Date)] {
    let urls = (try? fm.contentsOfDirectory(
      at: carpeta,
      includingPropertiesForKeys: [.contentModificationDateKey],
      options: [.skipsHiddenFiles]
    )) ?? []
    return urls
      .filter { $0.pathExtension == "json" }
      .map { url in
        let fecha = (try? url.resourceValues(forKeys: [.contentModificationDateKey]))?.contentModificationDate
        return (url, fecha ?? .distantPast)
      }
      .sorted { $0.fecha < $1.fecha }
  }

  /// Síncrono a propósito: WatchConnectivity borra el fichero al volver del delegado.
  func guardar(desde origen: URL, id: String) -> Bool {
    guard Self.idValido(id) else { return false }
    prepararCarpeta()
    let destino = fichero(id)
    // Si el reloj lo reenvía porque se perdió el aviso, gana el último.
    try? fm.removeItem(at: destino)
    do {
      try fm.moveItem(at: origen, to: destino)
    } catch {
      return false
    }
    // Mover conserva la fecha del reloj; el orden del tope es el de llegada.
    try? fm.setAttributes([.modificationDate: Date()], ofItemAtPath: destino.path)

    let todos = ficheros()
    if todos.count > tope {
      for viejo in todos.prefix(todos.count - tope) { try? fm.removeItem(at: viejo.url) }
    }
    return true
  }

  func tomar() -> [[String: String]] {
    ficheros().compactMap { entrada in
      guard let datos = try? Data(contentsOf: entrada.url),
        let json = String(data: datos, encoding: .utf8)
      else {
        // Ilegible no se arregla reintentando.
        try? fm.removeItem(at: entrada.url)
        return nil
      }
      return ["id": entrada.url.deletingPathExtension().lastPathComponent, "json": json]
    }
  }

  func borrar(_ id: String) {
    guard Self.idValido(id) else { return }
    try? fm.removeItem(at: fichero(id))
  }
}

/// El delegado de WatchConnectivity. Uno por proceso (WCSession.default lo es).
final class PuenteReloj: NSObject, WCSessionDelegate {
  static let compartido = PuenteReloj()

  /// Avisa a JS de que hay peticiones en la cola.
  var alLlegar: (() -> Void)?
  /// Avisa a JS de que hay entrenos en el buzón.
  var alLlegarEntreno: (() -> Void)?

  private let cola = DispatchQueue(label: "app.nivl.reloj")
  private var contextoPendiente: String?
  private var pendientes: [[String: String]] = []
  private var respuestas: [String: ([String: Any]) -> Void] = [:]
  private var avisosPendientes: [String] = []

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

  /// JS ya lo ha guardado: se borra aquí y se avisa al reloj para que borre
  /// el suyo. Si el aviso se pierde, el reloj lo reenvía y externo_id lo frena.
  func confirmarEntreno(_ id: String) {
    BuzonEntrenosReloj.compartido.borrar(id)
    cola.async {
      self.avisosPendientes.append(id)
      self.enviarAvisos()
    }
  }

  /// En `cola`.
  private func enviarAvisos() {
    guard WCSession.isSupported() else { return }
    let s = WCSession.default
    guard s.activationState == .activated else {
      activar()
      return
    }
    for id in avisosPendientes { s.transferUserInfo(["entrenoRecibido": id]) }
    avisosPendientes.removeAll()
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
    cola.async {
      self.enviarContexto()
      self.enviarAvisos()
    }
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

  func session(_ session: WCSession, didReceive file: WCSessionFile) {
    guard let id = file.metadata?["entrenoId"] as? String,
      BuzonEntrenosReloj.compartido.guardar(desde: file.fileURL, id: id)
    else { return }
    DispatchQueue.main.async { self.alLlegarEntreno?() }
  }
}
