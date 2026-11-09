// NIVL · Apple Watch: una cuenta atrás que no se duerme.
//
// Como el pomodoro del iPhone (src/focus/pomodoro.ts), no cuenta segundos:
// guarda CUÁNDO acaba, así que seguir la cuenta no exige tener la app viva. Con
// la muñeca bajada el sistema la duerme, y quien avisa al final es una
// notificación local programada para ese instante. Con la app delante, o con un
// entreno en marcha que la mantiene despierta, vibra ella misma. No usa el modo
// «mindfulness»: un temporizador no es atención plena (guideline 2.5.4).
//
// Lo usan el FOCUS (cuando corre en el reloj) y el descanso entre series.

import SwiftUI
import UserNotifications
import WatchKit

@MainActor
final class Temporizador: ObservableObject {
  @Published private(set) var finEn: Date?
  @Published private(set) var pausaRestante: TimeInterval?
  @Published private(set) var total: TimeInterval = 0
  @Published private(set) var acabado = false

  private let idAviso: String
  private let tituloAviso: String
  private var reloj: Timer?
  private var pedirPermiso = true

  init(idAviso: String, tituloAviso: String) {
    self.idAviso = idAviso
    self.tituloAviso = tituloAviso
  }

  var enMarcha: Bool { finEn != nil }
  var enPausa: Bool { pausaRestante != nil }

  func restante(_ ahora: Date = Date()) -> TimeInterval {
    if let finEn { return max(0, finEn.timeIntervalSince(ahora)) }
    if let pausaRestante { return pausaRestante }
    return total
  }

  func progreso(_ ahora: Date = Date()) -> Double {
    guard total > 0 else { return 0 }
    return min(1, max(0, 1 - restante(ahora) / total))
  }

  /// Arranca una cuenta atrás de `segundos`. `total` (si se da) es la fase
  /// entera, para el anillo de una fase que ya iba por la mitad.
  /// `pedirPermiso`: solo cuando lo arranca el usuario. Siguiendo al iPhone
  /// se avisa si ya hay permiso, sin preguntar al abrir la app.
  func empezar(segundos: TimeInterval, total: TimeInterval? = nil, pedirPermiso: Bool = true) {
    self.total = max(segundos, total ?? segundos)
    acabado = false
    pausaRestante = nil
    self.pedirPermiso = pedirPermiso
    correr(hasta: Date().addingTimeInterval(segundos))
  }

  func reanudar() {
    guard let r = pausaRestante else { return }
    pausaRestante = nil
    correr(hasta: Date().addingTimeInterval(r))
  }

  func pausar() {
    guard finEn != nil else { return }
    pausaRestante = restante()
    finEn = nil
    soltar()
  }

  func sumar(_ s: TimeInterval) {
    if let f = finEn {
      total += s
      finEn = f.addingTimeInterval(s)
      programarAviso()
    } else if let p = pausaRestante {
      total += s
      pausaRestante = p + s
    }
  }

  func parar() {
    finEn = nil
    pausaRestante = nil
    acabado = false
    soltar()
  }

  private func correr(hasta fin: Date) {
    finEn = fin
    programarAviso()
    reloj?.invalidate()
    reloj = Timer.scheduledTimer(withTimeInterval: 0.5, repeats: true) { [weak self] _ in
      Task { @MainActor in self?.revisar() }
    }
  }

  private func revisar() {
    guard let f = finEn, Date() >= f else { return }
    finEn = nil
    acabado = true
    // Al volver de dormida ya sonó la notificación: no vibra otra vez tarde.
    if Date().timeIntervalSince(f) < 2 { WKInterfaceDevice.current().play(.notification) }
    soltar()
  }

  private func soltar(cancelarAviso: Bool = true) {
    reloj?.invalidate()
    reloj = nil
    if cancelarAviso {
      UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: [idAviso])
    }
  }

  private func programarAviso() {
    guard let f = finEn else { return }
    let id = idAviso
    let titulo = tituloAviso
    let espera = max(1, f.timeIntervalSinceNow)
    let preguntar = pedirPermiso
    let anadir: @Sendable () -> Void = {
      let c = UNMutableNotificationContent()
      c.title = titulo
      c.sound = .default
      let r = UNNotificationRequest(identifier: id, content: c,
                                    trigger: UNTimeIntervalNotificationTrigger(timeInterval: espera, repeats: false))
      let centro = UNUserNotificationCenter.current()
      centro.removePendingNotificationRequests(withIdentifiers: [id])
      centro.add(r)
    }
    UNUserNotificationCenter.current().getNotificationSettings { ajustes in
      switch ajustes.authorizationStatus {
      case .authorized, .provisional, .ephemeral:
        anadir()
      case .notDetermined where preguntar:
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound]) { ok, _ in
          if ok { anadir() }
        }
      default:
        break
      }
    }
  }
}
