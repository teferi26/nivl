// NIVL · Apple Watch: el buzón de entrenos medidos.
//
// Cada entreno terminado es un JSON en disco. Se manda con transferFile (cola
// del sistema, llega aunque el iPhone no esté cerca) y el fichero solo se borra
// cuando el iPhone confirma con userInfo {entrenoRecibido: id}: una entrega sin
// confirmar se vuelve a mandar pasado un día. El iPhone deduplica por
// externo_id, así que repetir nunca paga dos veces.

import Foundation
import WatchConnectivity

@MainActor
final class BuzonEntrenos {
  static let compartido = BuzonEntrenos()

  nonisolated static let claveId = "entrenoId"
  nonisolated static let claveAck = "entrenoRecibido"

  private let carpeta: URL
  private let defaults = UserDefaults.standard
  private let claveEntregados = "nivl.reloj.entrenosEntregados"
  private let maximoFicheros = 200
  private let reenviarTras: TimeInterval = 24 * 3600

  private init() {
    let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
    carpeta = base.appendingPathComponent("nivl-entrenos", isDirectory: true)
    try? FileManager.default.createDirectory(at: carpeta, withIntermediateDirectories: true)
  }

  /// Deja el entreno a salvo en disco y lo pone en camino. false si no se ha
  /// podido escribir: quien llama no debe tirar su copia.
  func guardar(_ entreno: EntrenoMedido) -> Bool {
    guard Self.idValido(entreno.externo_id),
          let data = try? JSONEncoder().encode(entreno) else { return false }
    do {
      try data.write(to: url(entreno.externo_id), options: .atomic)
    } catch {
      return false
    }
    recortar()
    enviarPendientes()
    return true
  }

  /// Pone en cola lo que no esté ya viajando ni entregado hace poco.
  func enviarPendientes() {
    guard WCSession.isSupported() else { return }
    let s = WCSession.default
    guard s.activationState == .activated else { return }
    let viajando = Set(s.outstandingFileTransfers.compactMap { $0.file.metadata?[Self.claveId] as? String })
    let entregados = leerEntregados()
    let ahora = Date().timeIntervalSince1970
    for fichero in ficheros() {
      let id = fichero.deletingPathExtension().lastPathComponent
      if viajando.contains(id) { continue }
      if let cuando = entregados[id], ahora - cuando < reenviarTras { continue }
      s.transferFile(fichero, metadata: [Self.claveId: id])
    }
  }

  func transferenciaTerminada(id: String, fallo: Bool) {
    var entregados = leerEntregados()
    // Con fallo no se marca: se reintenta al próximo arranque o reconexión.
    entregados[id] = fallo ? nil : Date().timeIntervalSince1970
    defaults.set(entregados, forKey: claveEntregados)
  }

  /// El iPhone ya lo tiene a salvo: fuera la copia del reloj.
  func confirmar(id: String) {
    guard Self.idValido(id) else { return }
    try? FileManager.default.removeItem(at: url(id))
    var entregados = leerEntregados()
    entregados[id] = nil
    defaults.set(entregados, forKey: claveEntregados)
  }

  private func leerEntregados() -> [String: Double] {
    defaults.dictionary(forKey: claveEntregados) as? [String: Double] ?? [:]
  }

  private func url(_ id: String) -> URL {
    carpeta.appendingPathComponent(id).appendingPathExtension("json")
  }

  private func ficheros() -> [URL] {
    let lista = try? FileManager.default.contentsOfDirectory(
      at: carpeta, includingPropertiesForKeys: [.contentModificationDateKey], options: .skipsHiddenFiles)
    return (lista ?? []).filter { $0.pathExtension == "json" }
  }

  /// Un reloj que nunca vuelve a ver su iPhone no llena el disco.
  private func recortar() {
    let lista = ficheros()
    guard lista.count > maximoFicheros else { return }
    func fecha(_ u: URL) -> Date {
      (try? u.resourceValues(forKeys: [.contentModificationDateKey]).contentModificationDate) ?? .distantPast
    }
    for u in lista.sorted(by: { fecha($0) < fecha($1) }).prefix(lista.count - maximoFicheros) {
      try? FileManager.default.removeItem(at: u)
    }
  }

  /// El id acaba siendo nombre de fichero y el ack llega de fuera.
  private static func idValido(_ id: String) -> Bool {
    !id.isEmpty && id.count <= 200 && id.allSatisfy { $0.isLetter || $0.isNumber || $0 == "-" || $0 == "_" }
  }
}
