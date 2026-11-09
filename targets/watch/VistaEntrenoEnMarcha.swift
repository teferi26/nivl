// NIVL · Apple Watch: el entreno en marcha. Dos páginas en horizontal, como la
// app Entreno: a la izquierda los controles, a la derecha las métricas. La
// vista no decide nada: pinta lo que dice ServicioEntreno.

import SwiftUI
import WatchKit

extension FaseEntreno {
  /// Hay una sesión viva: la raíz cambia las páginas por esta pantalla.
  var enCurso: Bool {
    switch self {
    case .preparando, .enMarcha, .pausaAuto, .pausa, .terminando: return true
    case .parado, .resumen, .error: return false
    }
  }

  var esResumen: Bool {
    if case .resumen = self { return true }
    return false
  }

  var textoError: String? {
    if case .error(let motivo) = self { return motivo }
    return nil
  }
}

struct VistaEntrenoEnMarcha: View {
  @ObservedObject private var servicio = ServicioEntreno.compartido

  var body: some View {
    PanelEntreno(
      fase: servicio.fase,
      metricas: servicio.metricas,
      acciones: AccionesEntreno(
        pausar: { servicio.pausar() },
        reanudar: { servicio.reanudar() },
        parcial: { servicio.marcarParcial() },
        terminar: { servicio.terminar() },
        descartar: { servicio.descartar() },
        bloquearAgua: { WKInterfaceDevice.current().enableWaterLock() }
      )
    )
  }
}

/// Los gestos, por fuera, para que la demo pinte la misma vista sin HealthKit.
struct AccionesEntreno {
  var pausar: () -> Void = {}
  var reanudar: () -> Void = {}
  var parcial: () -> Void = {}
  var terminar: () -> Void = {}
  var descartar: () -> Void = {}
  var bloquearAgua: () -> Void = {}
}

struct PanelEntreno: View {
  private enum Pagina: Hashable { case controles, metricas }

  let fase: FaseEntreno
  let metricas: MetricasEntreno
  let acciones: AccionesEntreno

  @State private var pagina = Pagina.metricas

  var body: some View {
    TabView(selection: $pagina) {
      ControlesEntreno(fase: fase, metricas: metricas, acciones: acciones, alReanudar: { pagina = .metricas })
        .tag(Pagina.controles)
      MetricasEnMarcha(fase: fase, metricas: metricas)
        .tag(Pagina.metricas)
    }
    .tabViewStyle(.page)
    .background(Ink.ink0)
  }
}

private extension FaseEntreno {
  /// La línea de estado. Nil mientras todo va normal.
  var aviso: String? {
    switch self {
    case .preparando: return "Preparando"
    case .pausaAuto: return "Auto-pausa"
    case .pausa: return "En pausa"
    case .terminando: return "Guardando"
    case .enMarcha, .parado, .resumen, .error: return nil
    }
  }

  var pausada: Bool {
    switch self {
    case .pausa, .pausaAuto: return true
    default: return false
    }
  }
}

// MARK: - Métricas

private struct DatoEntreno: Identifiable {
  let etiqueta: String
  let valor: String
  let unidad: String
  /// Cómo se lee la unidad en voz alta.
  let unidadVoz: String
  var id: String { etiqueta }

  var voz: String {
    valor == sinMedir ? "\(etiqueta), sin datos" : "\(etiqueta), \(valor) \(unidadVoz)"
  }
}

private struct MetricasEnMarcha: View {
  let fase: FaseEntreno
  let metricas: MetricasEntreno

  /// Sale del alto de la pantalla: el cronómetro manda, pero las filas
  /// tienen que verse sin girar la corona en 40 mm.
  private static let tamCrono: CGFloat = min(46, (WKInterfaceDevice.current().screenBounds.height * 0.19).rounded())

  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 3) {
        estado
        Text(formatoCrono(metricas.duracion_s))
          .font(Tipo.cifra(Self.tamCrono, relativoA: .title))
          .foregroundStyle(fase.pausada ? Ink.ink6 : Ink.ink10)
          .lineLimit(1)
          .minimumScaleFactor(0.5)
          .frame(maxWidth: .infinity, alignment: .leading)
          .accessibilityLabel("Tiempo, \(formatoCrono(metricas.duracion_s))")
        ForEach(datos) { FilaDato(dato: $0) }
      }
      .padding(.horizontal, 4)
    }
    .background(Ink.ink0)
  }

  /// La pausa se enseña por inversión: tiene que leerse de un vistazo.
  @ViewBuilder
  private var estado: some View {
    if let aviso = fase.aviso {
      Text(aviso.uppercased())
        .font(Tipo.rotulo)
        .tracking(2)
        .lineLimit(1)
        .minimumScaleFactor(0.7)
        .foregroundStyle(Ink.ink0)
        .padding(.vertical, 2)
        .frame(maxWidth: .infinity)
        .background(Ink.ink10, in: RoundedRectangle(cornerRadius: Radio.control))
        .accessibilityAddTraits(.isHeader)
    } else {
      Rotulo(texto: lineaDeporte)
    }
  }

  private var lineaDeporte: String {
    let nombre = metricas.deporte.nombreEnPantalla
    if metricas.deporte.usaGps && !metricas.gpsActivo {
      return "\(nombre) · \(metricas.deporte == .aguasAbiertas ? "GPS al emerger" : "Sin GPS")"
    }
    // Fuera del GPS el parcial solo existe si se ha marcado a mano.
    let conParcial = metricas.parcialActual > 1 || (metricas.deporte.usaGps && metricas.parcialActual == 1)
    return conParcial ? "\(nombre) · Parcial \(metricas.parcialActual)" : nombre
  }

  private var kilometros: DatoEntreno {
    DatoEntreno(etiqueta: "Distancia", valor: metricas.distancia_m.map { formatoDecimal($0 / 1000, decimales: 2) } ?? sinMedir,
                unidad: "km", unidadVoz: "kilómetros")
  }

  private var pulso: DatoEntreno {
    DatoEntreno(etiqueta: "Pulso", valor: formatoEntero(metricas.fc), unidad: "ppm", unidadVoz: "pulsaciones por minuto")
  }

  private var calorias: DatoEntreno {
    DatoEntreno(etiqueta: "Energía", valor: formatoEntero(metricas.kcal), unidad: "kcal", unidadVoz: "kilocalorías")
  }

  /// El ritmo de nado se dice por 100 m; el servicio lo da por kilómetro.
  private var ritmoNado: DatoEntreno {
    DatoEntreno(etiqueta: "Ritmo", valor: formatoRitmo(metricas.ritmo_s_km.map { $0 / 10 }),
                unidad: "/100", unidadVoz: "por cada 100 metros")
  }

  private func textoLargos(_ n: Int?) -> String { n.map(String.init) ?? sinMedir }

  private var datos: [DatoEntreno] {
    switch metricas.deporte {
    case .carrera:
      return [
        kilometros,
        DatoEntreno(etiqueta: "Ritmo", valor: formatoRitmo(metricas.ritmo_s_km), unidad: "/km", unidadVoz: "por kilómetro"),
        pulso,
        calorias,
      ]
    case .bici:
      return [
        kilometros,
        DatoEntreno(etiqueta: "Velocidad", valor: metricas.velocidad_kmh.map { formatoDecimal($0, decimales: 1) } ?? sinMedir,
                    unidad: "km/h", unidadVoz: "kilómetros por hora"),
        pulso,
        calorias,
      ]
    case .piscina:
      return [
        DatoEntreno(etiqueta: "Largos", valor: textoLargos(metricas.largos), unidad: "", unidadVoz: ""),
        DatoEntreno(etiqueta: "Distancia", valor: formatoEntero(metricas.distancia_m), unidad: "m", unidadVoz: "metros"),
        ritmoNado,
        pulso,
      ]
    case .aguasAbiertas:
      return [kilometros, ritmoNado, pulso, calorias]
    case .fuerza:
      return [
        pulso,
        DatoEntreno(etiqueta: "Media", valor: formatoEntero(metricas.fc_media), unidad: "ppm", unidadVoz: "pulsaciones por minuto"),
        calorias,
      ]
    }
  }
}

private struct FilaDato: View {
  let dato: DatoEntreno

  /// Cuatro filas y el cronómetro tienen que caber a la vez en 40 mm.
  private static let tamValor: CGFloat = min(22, (WKInterfaceDevice.current().screenBounds.height * 0.095).rounded())

  var body: some View {
    HStack(alignment: .firstTextBaseline, spacing: 3) {
      Text(dato.valor)
        .font(Tipo.cifra(Self.tamValor, relativoA: .title3))
        .foregroundStyle(Ink.ink9)
        .lineLimit(1)
        .minimumScaleFactor(0.6)
      if !dato.unidad.isEmpty {
        Text(dato.unidad)
          .font(Tipo.rotulo)
          .foregroundStyle(Ink.ink6)
          .lineLimit(1)
          .fixedSize()
      }
      Spacer(minLength: 4)
      Text(dato.etiqueta.uppercased())
        .font(Tipo.rotulo)
        .tracking(1)
        .foregroundStyle(Ink.ink6)
        .lineLimit(1)
        .minimumScaleFactor(0.7)
    }
    .accessibilityElement(children: .ignore)
    .accessibilityLabel(dato.voz)
  }
}

// MARK: - Controles

private struct ControlesEntreno: View {
  let fase: FaseEntreno
  let metricas: MetricasEntreno
  let acciones: AccionesEntreno
  let alReanudar: () -> Void

  @State private var preguntandoFin = false

  private var preparando: Bool {
    if case .preparando = fase { return true }
    return false
  }

  private var terminando: Bool {
    if case .terminando = fase { return true }
    return false
  }

  var body: some View {
    ScrollView {
      VStack(spacing: 6) {
        Rotulo(texto: fase.aviso ?? metricas.deporte.nombreEnPantalla)
        if preparando {
          // Aún no hay nada que perder: se cancela sin preguntar.
          Button("Cancelar", action: acciones.descartar)
            .buttonStyle(BotonContorno())
            .accessibilityHint("Abandona el entreno sin guardar nada.")
        } else {
          HStack(spacing: 6) {
            botonPausa
            segundoControl
          }
          HStack(spacing: 6) {
            if metricas.deporte.esDeAgua {
              control("Agua", simbolo: "drop", voz: "Bloqueo de agua",
                      pista: "Bloquea la pantalla para nadar. Se quita girando la corona.",
                      accion: acciones.bloquearAgua)
                .disabled(terminando)
            }
            control("Fin", simbolo: "xmark", voz: "Finalizar entreno", pista: "Pregunta si guardar o descartar.",
                    accion: { preguntandoFin = true })
              .disabled(terminando)
          }
        }
      }
      .padding(.horizontal, 4)
    }
    .background(Ink.ink0)
    .confirmationDialog("¿Cerrar el entreno?", isPresented: $preguntandoFin, titleVisibility: .visible) {
      Button("Guardar", action: terminar)
      Button("Descartar", role: .destructive, action: acciones.descartar)
      Button("Seguir", role: .cancel) {}
    } message: {
      Text("Si lo descartas, no queda rastro.")
    }
  }

  @ViewBuilder
  private var botonPausa: some View {
    if fase.pausada {
      control("Seguir", simbolo: "play.fill", voz: "Seguir", pista: "Reanuda el entreno.", invertido: true, accion: reanudar)
    } else {
      control("Pausa", simbolo: "pause.fill", voz: "Pausar", pista: "Detiene el cronómetro.", invertido: true, accion: pausar)
        .disabled(terminando)
    }
  }

  /// En auto-pausa, el parcial no tiene sentido y sí lo tiene lo contrario:
  /// dejar la pausa puesta para que no se levante al volver a moverte.
  @ViewBuilder
  private var segundoControl: some View {
    if case .pausaAuto = fase {
      control("Pausa", simbolo: "pause", voz: "Mantener la pausa", pista: "No se reanuda sola al moverte.", accion: pausar)
    } else {
      control("Parcial", simbolo: "flag", voz: "Marcar parcial", pista: "Cierra el tramo actual y abre otro.",
              accion: marcarParcial)
        .disabled(terminando || fase.pausada)
    }
  }

  private func control(_ texto: String, simbolo: String, voz: String, pista: String, invertido: Bool = false,
                       accion: @escaping () -> Void) -> some View {
    Button(action: accion) {
      VStack(spacing: 2) {
        Image(systemName: simbolo)
          .font(.system(.title3))
          .accessibilityHidden(true)
        Text(texto)
      }
    }
    .buttonStyle(BotonControl(invertido: invertido))
    .accessibilityLabel(voz)
    .accessibilityHint(pista)
  }

  private func pausar() {
    WKInterfaceDevice.current().play(.stop)
    acciones.pausar()
  }

  private func reanudar() {
    WKInterfaceDevice.current().play(.start)
    acciones.reanudar()
    // Seguir es volver a correr: lo que hace falta ver son las métricas.
    alReanudar()
  }

  private func marcarParcial() {
    WKInterfaceDevice.current().play(.click)
    acciones.parcial()
  }

  private func terminar() {
    WKInterfaceDevice.current().play(.stop)
    acciones.terminar()
  }
}
