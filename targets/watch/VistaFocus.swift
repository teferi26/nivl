// NIVL · Apple Watch: FOCUS. Si el iPhone tiene un pomodoro en marcha, el
// reloj lo sigue (cuenta con su `finEn`) y puede pausarlo o seguirlo. Si no,
// «Empezar» se lo pide al iPhone y, si FOCUS no está abierto allí, cuenta en
// el reloj: un cronómetro que no registra sesión (solo paga el bloque que
// registra el iPhone, src/focus/mision.ts).

import SwiftUI
import WatchKit

struct VistaFocus: View {
  @EnvironmentObject private var almacen: Almacen
  @StateObject private var local = Temporizador(idAviso: "nivl.reloj.focus", tituloAviso: "Bloque de foco terminado")
  @StateObject private var espejo = Temporizador(idAviso: "nivl.reloj.focus.iphone", tituloAviso: "Fase de FOCUS terminada")
  @State private var aviso: String?
  @State private var mandando = false

  private let minutosLocal: Double = 25

  /// El pomodoro del iPhone, si está vivo (en marcha con fin futuro, o en pausa).
  private var delIphone: FocusReloj? {
    guard let f = almacen.estado?.focus else { return nil }
    if f.situacion == "en_pausa" { return f }
    if f.situacion == "en_marcha", let fin = f.finEn, fin > Date().timeIntervalSince1970 * 1000 { return f }
    return nil
  }

  var body: some View {
    TimelineView(.periodic(from: .now, by: 1)) { ctx in
      ScrollView {
        VStack(spacing: 6) {
          // El aviso arriba: debajo del botón quedaba fuera de la pantalla y
          // «Pausar» parecía no hacer nada.
          if let aviso {
            Text(aviso)
              .font(Tipo.detalle)
              .foregroundStyle(Ink.ink9)
              .multilineTextAlignment(.center)
              .fixedSize(horizontal: false, vertical: true)
          }
          if let f = delIphone {
            cabecera(f.nombreFase, "BLOQUE \(f.bloque) DE \(f.cadaLargo) · IPHONE")
            Anillo(progreso: progresoIphone(f, ctx.date), texto: formatoReloj(restanteIphone(f, ctx.date)))
            if f.situacion == "en_marcha" {
              Button("Pausar") { mandar("pausar") }.buttonStyle(BotonContorno()).disabled(mandando)
            } else {
              Button("Seguir") { mandar("empezar") }.buttonStyle(BotonInvertido()).disabled(mandando)
            }
          } else {
            cabecera("FOCO", local.enMarcha || local.enPausa ? "EN EL RELOJ" : "\(Int(minutosLocal)) MIN")
            Anillo(progreso: local.progreso(ctx.date),
                   texto: formatoReloj(local.enMarcha || local.enPausa ? local.restante(ctx.date) : minutosLocal * 60))
            botonesLocal
            if local.enMarcha || local.enPausa {
              Text("Solo cronómetro: para que cuente, arráncalo desde FOCUS en el iPhone.")
                .font(Tipo.detalle)
                .foregroundStyle(Ink.ink6)
                .multilineTextAlignment(.center)
            }
          }
        }
        .padding(.horizontal, 4)
      }
    }
    .background(Ink.ink0)
    .onAppear(perform: seguirIphone)
    .onChange(of: almacen.estado?.focus) { _, _ in seguirIphone() }
  }

  private func cabecera(_ fase: String, _ linea: String) -> some View {
    VStack(spacing: 2) {
      Text(fase)
        .font(Tipo.inscripcion(14))
        .foregroundStyle(Ink.ink10)
        .accessibilityAddTraits(.isHeader)
      Rotulo(texto: linea)
    }
  }

  @ViewBuilder
  private var botonesLocal: some View {
    if local.enMarcha {
      HStack(spacing: 6) {
        Button("Pausar") { local.pausar() }.buttonStyle(BotonContorno())
        Button("Parar") { local.parar() }.buttonStyle(BotonContorno())
      }
    } else if local.enPausa {
      HStack(spacing: 6) {
        Button("Seguir") { local.reanudar() }.buttonStyle(BotonInvertido())
        Button("Parar") { local.parar() }.buttonStyle(BotonContorno())
      }
    } else {
      Button("Empezar") { empezar() }.buttonStyle(BotonInvertido()).disabled(mandando)
    }
  }

  private func restanteIphone(_ f: FocusReloj, _ ahora: Date) -> Double {
    if f.situacion == "en_marcha", let fin = f.finEn { return max(0, fin / 1000 - ahora.timeIntervalSince1970) }
    return f.restanteMs / 1000
  }

  private func progresoIphone(_ f: FocusReloj, _ ahora: Date) -> Double {
    guard f.totalMs > 0 else { return 0 }
    return min(1, max(0, 1 - restanteIphone(f, ahora) * 1000 / f.totalMs))
  }

  /// Con el pomodoro del iPhone en marcha, el reloj lleva su propia cuenta
  /// atrás hasta el mismo fin: así vibra en la muñeca aunque esté bajada (por notificación local).
  private func seguirIphone() {
    guard !almacen.modoDemo, let f = delIphone, f.situacion == "en_marcha" else {
      espejo.parar()
      return
    }
    local.parar()
    espejo.empezar(segundos: restanteIphone(f, Date()), total: f.totalMs / 1000, pedirPermiso: false)
  }

  private func empezar() {
    aviso = nil
    mandando = true
    Task {
      // Primero el del iPhone (el único que registra el bloque).
      let ok = almacen.estado?.focus != nil ? await almacen.mandarFocus("empezar") : false
      mandando = false
      if !ok {
        WKInterfaceDevice.current().play(.start)
        local.empezar(segundos: minutosLocal * 60)
      }
    }
  }

  private func mandar(_ accion: String) {
    aviso = nil
    mandando = true
    Task {
      let ok = await almacen.mandarFocus(accion)
      mandando = false
      if ok {
        WKInterfaceDevice.current().play(.click)
      } else {
        WKInterfaceDevice.current().play(.failure)
        aviso = "Abre FOCUS en el iPhone para mandar en su pomodoro."
      }
    }
  }
}

/// El anillo del pomodoro: pista ink4 de 6, avance en oro, cifra en Playfair.
struct Anillo: View {
  let progreso: Double
  let texto: String

  /// Sale del ALTO de la pantalla (no del ancho): cabecera + anillo + botón
  /// tienen que caber sin girar la corona. ~89 pt en 46 mm, ~71 en 40 mm.
  static let lado: CGFloat = min(112, (WKInterfaceDevice.current().screenBounds.height * 0.36).rounded())

  var body: some View {
    ZStack {
      Circle().stroke(Ink.ink4, lineWidth: 6)
      Circle()
        .trim(from: 0, to: progreso)
        .stroke(Oro.hilo, style: StrokeStyle(lineWidth: 6, lineCap: .round))
        .rotationEffect(.degrees(-90))
      Text(texto)
        .font(Tipo.cifra(30 * Anillo.lado / 112, relativoA: .title))
        .minimumScaleFactor(0.6)
        .lineLimit(1)
        .foregroundStyle(Ink.ink10)
        .padding(.horizontal, 12)
    }
    .frame(width: Anillo.lado, height: Anillo.lado)
    .accessibilityElement(children: .ignore)
    .accessibilityLabel("Quedan \(texto)")
  }
}
