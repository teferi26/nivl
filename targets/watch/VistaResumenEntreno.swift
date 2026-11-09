// NIVL · Apple Watch: el resumen al cerrar un entreno. Solo constata lo
// medido: el reloj no promete XP, eso se decide en el iPhone al recibirlo.

import SwiftUI

struct VistaResumenEntreno: View {
  @ObservedObject private var servicio = ServicioEntreno.compartido

  var body: some View {
    ResumenEntrenoVista(
      resumen: servicio.resumen, enDisco: servicio.resumenEnDisco, alCerrar: { servicio.cerrarResumen() })
  }
}

struct ResumenEntrenoVista: View {
  let resumen: EntrenoMedido?
  var enDisco = true
  let alCerrar: () -> Void

  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 8) {
        if let r = resumen {
          cabecera(r)
          HiloOro()
          ForEach(filas(r), id: \.etiqueta) { fila($0) }
          parciales(r)
          Text(enDisco
            ? "Guardado en el reloj. Llegará al iPhone cuando esté cerca."
            : "No se ha podido guardar en el reloj. NIVL lo reintentará al volver a abrirse.")
            .font(Tipo.detalle)
            .foregroundStyle(Ink.ink8)
            .fixedSize(horizontal: false, vertical: true)
        } else {
          // No debería verse, pero una pantalla en blanco aquí no tendría salida.
          Text("Sin datos de este entreno.")
            .font(Tipo.detalle)
            .foregroundStyle(Ink.ink9)
            .fixedSize(horizontal: false, vertical: true)
        }
        Button("Cerrar", action: alCerrar)
          .buttonStyle(BotonInvertido())
          .accessibilityHint("Vuelve a la lista de deportes.")
      }
      .padding(.horizontal, 4)
    }
    .background(Ink.ink0)
  }

  private func cabecera(_ r: EntrenoMedido) -> some View {
    VStack(alignment: .leading, spacing: 2) {
      Text("ENTRENO CERRADO")
        .font(Tipo.inscripcion(13))
        .foregroundStyle(Ink.ink10)
        .lineLimit(1)
        .minimumScaleFactor(0.6)
        .accessibilityAddTraits(.isHeader)
      Rotulo(texto: DeporteReloj(rawValue: r.deporte)?.nombreEnPantalla ?? "Entreno")
      Text(formatoCrono(r.duracion_s))
        .font(Tipo.cifra(40, relativoA: .title))
        .foregroundStyle(Ink.ink10)
        .lineLimit(1)
        .minimumScaleFactor(0.5)
        .accessibilityLabel("Tiempo en movimiento, \(formatoCrono(r.duracion_s))")
    }
  }

  private struct Fila {
    let etiqueta: String
    let valor: String
    let voz: String
  }

  /// Solo lo medido: una fila sin dato se omite en vez de enseñar un 0.
  private func filas(_ r: EntrenoMedido) -> [Fila] {
    var f: [Fila] = []
    let nado = r.deporte == "piscina" || r.deporte == "aguas_abiertas"
    if let d = r.distancia_m, d > 0 {
      if r.deporte == "piscina" {
        f.append(Fila(etiqueta: "Distancia", valor: "\(formatoEntero(d)) m", voz: "\(formatoEntero(d)) metros"))
      } else {
        let km = formatoDecimal(d / 1000, decimales: 2)
        f.append(Fila(etiqueta: "Distancia", valor: "\(km) km", voz: "\(km) kilómetros"))
      }
      if r.duracion_s > 0 {
        if r.deporte == "bici" {
          let v = formatoDecimal(d / 1000 / (r.duracion_s / 3600), decimales: 1)
          f.append(Fila(etiqueta: "Velocidad", valor: "\(v) km/h", voz: "\(v) kilómetros por hora"))
        } else if r.deporte != "fuerza" {
          let ritmo = formatoRitmo(r.duracion_s / (d / (nado ? 100 : 1000)))
          let tramo = nado ? "/100" : "/km"
          f.append(Fila(etiqueta: "Ritmo", valor: "\(ritmo) \(tramo)", voz: "\(ritmo) \(nado ? "por cada 100 metros" : "por kilómetro")"))
        }
      }
    }
    if r.deporte == "piscina" {
      let largos = r.parciales.filter { $0.tipo == "largo" }.count
      if largos > 0 { f.append(Fila(etiqueta: "Largos", valor: String(largos), voz: String(largos))) }
    }
    if let v = r.desnivel_m, v > 0 {
      f.append(Fila(etiqueta: "Desnivel", valor: "\(formatoEntero(v)) m", voz: "\(formatoEntero(v)) metros"))
    }
    if let v = r.fc_media {
      f.append(Fila(etiqueta: "Pulso medio", valor: "\(formatoEntero(v)) ppm", voz: "\(formatoEntero(v)) pulsaciones por minuto"))
    }
    if let v = r.fc_max {
      f.append(Fila(etiqueta: "Pulso máximo", valor: "\(formatoEntero(v)) ppm", voz: "\(formatoEntero(v)) pulsaciones por minuto"))
    }
    if let v = r.kcal {
      f.append(Fila(etiqueta: "Energía", valor: "\(formatoEntero(v)) kcal", voz: "\(formatoEntero(v)) kilocalorías"))
    }
    return f
  }

  private func fila(_ f: Fila) -> some View {
    // Con el tipo muy grande, etiqueta y valor no caben juntos: se apilan
    // antes que recortar la cifra.
    ViewThatFits(in: .horizontal) {
      HStack(alignment: .firstTextBaseline, spacing: 4) {
        etiqueta(f)
        Spacer(minLength: 4)
        valor(f)
      }
      VStack(alignment: .leading, spacing: 0) {
        etiqueta(f)
        valor(f)
      }
    }
    .accessibilityElement(children: .ignore)
    .accessibilityLabel("\(f.etiqueta), \(f.voz)")
  }

  private func etiqueta(_ f: Fila) -> some View {
    Text(f.etiqueta.uppercased())
      .font(Tipo.rotulo)
      .tracking(1)
      .foregroundStyle(Ink.ink6)
      .fixedSize()
  }

  private func valor(_ f: Fila) -> some View {
    Text(f.valor)
      .font(Tipo.cifra(16, relativoA: .body))
      .foregroundStyle(Ink.ink9)
      .fixedSize()
  }

  /// Los kilómetros y las vueltas. Los largos no: en una sesión larga serían
  /// decenas de filas sin nada que leer en la muñeca.
  @ViewBuilder
  private func parciales(_ r: EntrenoMedido) -> some View {
    let tramos = r.parciales.filter { $0.tipo != "largo" }
    if !tramos.isEmpty {
      VStack(alignment: .leading, spacing: 4) {
        Rotulo(texto: "Parciales")
        // Kilómetros y vueltas se numeran por separado: `n` solo no identifica.
        ForEach(tramos, id: \.self) { p in
          HStack(alignment: .firstTextBaseline) {
            Text(nombreTramo(p))
              .font(Tipo.cifra(14, relativoA: .footnote))
              .foregroundStyle(Ink.ink6)
            Spacer(minLength: 4)
            Text(formatoCrono(p.duracion_s))
              .font(Tipo.cifra(14, relativoA: .footnote))
              .foregroundStyle(Ink.ink9)
          }
          .accessibilityElement(children: .ignore)
          .accessibilityLabel("\(p.tipo == "vuelta" ? "Vuelta" : "Kilómetro") \(p.n), \(formatoCrono(p.duracion_s))")
        }
      }
    }
  }

  private func nombreTramo(_ p: ParcialMedido) -> String {
    p.tipo == "vuelta" ? "V\(p.n)" : "\(p.n) km"
  }
}
