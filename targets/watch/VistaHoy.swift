// NIVL · Apple Watch: Hoy. Las misiones del día; tocar una abre su
// confirmación y «Hecha» la completa (dos toques, como CompletarSheet).
// Con foto, desde el iPhone.

import SwiftUI
import WatchKit

struct VistaHoy: View {
  @EnvironmentObject private var almacen: Almacen

  var body: some View {
    if let e = almacen.estado, e.sesion {
      lista(e)
    } else {
      SinDatos(titulo: "HOY")
    }
  }

  @ViewBuilder
  private func lista(_ e: EstadoReloj) -> some View {
    List {
      Section {
        if !e.esDeHoy {
          Text("Día nuevo. Abre NIVL en el iPhone para traer las misiones de hoy.")
            .font(Tipo.detalle)
            .foregroundStyle(Ink.ink8)
            .listRowBackground(Trama().clipShape(RoundedRectangle(cornerRadius: Radio.tarjeta)))
        }
        if e.misiones.isEmpty {
          Text("Sin misiones hoy. El coach o tú las ponéis en el iPhone.")
            .font(Tipo.detalle)
            .foregroundStyle(Ink.ink8)
            .listRowBackground(RoundedRectangle(cornerRadius: Radio.tarjeta).fill(Ink.ink1))
        }
        ForEach(e.misiones) { m in
          NavigationLink {
            ConfirmarMision(mision: m)
          } label: {
            FilaMision(mision: m, enCamino: almacen.enCamino.contains(m.id))
          }
          .listRowBackground(RoundedRectangle(cornerRadius: Radio.tarjeta).fill(Ink.ink1))
        }
      } header: {
        HStack(alignment: .firstTextBaseline) {
          Text("HOY")
            .font(Tipo.inscripcion(16))
            .foregroundStyle(Ink.ink10)
            .accessibilityAddTraits(.isHeader)
          Spacer()
          Text("\(e.cuentan - e.pendientes)/\(e.cuentan)")
            .font(Tipo.cifra(15, relativoA: .footnote))
            .foregroundStyle(Ink.ink9)
            .accessibilityLabel("\(e.cuentan - e.pendientes) de \(e.cuentan) hechas")
        }
      }
    }
    .listStyle(.plain)
    .scrollContentBackground(.hidden)
    .background(Ink.ink0)
  }
}

struct FilaMision: View {
  let mision: MisionReloj
  let enCamino: Bool

  var body: some View {
    HStack(alignment: .center, spacing: 8) {
      Check(hecha: mision.hecha, enCamino: enCamino)
      VStack(alignment: .leading, spacing: 2) {
        Text(mision.titulo)
          .font(Tipo.fila)
          .foregroundStyle(mision.hecha ? Ink.ink6 : Ink.ink9)
          .strikethrough(mision.hecha, color: Ink.ink6)
          .lineLimit(2)
        Text(detalle)
          .font(Tipo.detalle)
          .foregroundStyle(Ink.ink6)
          .lineLimit(1)
      }
    }
    .padding(.vertical, 4)
    .accessibilityElement(children: .combine)
    .accessibilityHint(mision.hecha ? "" : "Abre la misión para marcarla como hecha.")
  }

  private var detalle: String {
    if enCamino { return "Enviando al iPhone" }
    if mision.hecha { return "Hecha" }
    if mision.bloqueada { return "Bloqueada" }
    if mision.requiereFoto { return "Pide foto" }
    if mision.extra { return "Extra · \(mision.textoPremio)" }
    return mision.textoPremio
  }
}

/// El Check del kit: círculo de trazo; hecho, blanco con la marca en negro.
struct Check: View {
  let hecha: Bool
  var enCamino = false

  var body: some View {
    ZStack {
      if hecha {
        Circle().fill(Ink.ink10)
        Image(systemName: "checkmark")
          .font(.system(size: 11, weight: .heavy))
          .foregroundStyle(Ink.ink0)
      } else {
        Circle().stroke(enCamino ? Ink.ink6 : Ink.ink8, style: StrokeStyle(lineWidth: 2, dash: enCamino ? [3, 3] : []))
      }
    }
    .frame(width: 22, height: 22)
    .accessibilityHidden(true)
  }
}

struct ConfirmarMision: View {
  @EnvironmentObject private var almacen: Almacen
  @Environment(\.dismiss) private var cerrar
  let mision: MisionReloj
  @State private var ocupada = false
  @State private var aviso: String?

  private var actual: MisionReloj {
    almacen.estado?.misiones.first { $0.id == mision.id } ?? mision
  }

  private var esDeHoy: Bool { almacen.estado?.esDeHoy ?? false }

  var body: some View {
    let m = actual
    ScrollView {
      VStack(alignment: .leading, spacing: 10) {
        Rotulo(texto: m.penalizacion ? "Penalización" : (m.extra ? "Misión extra" : m.nombreDificultad))
        Text(m.titulo)
          .font(.system(.headline).weight(.bold))
          .foregroundStyle(Ink.ink9)
          .fixedSize(horizontal: false, vertical: true)
        Text(m.textoPremio.uppercased())
          .font(Tipo.inscripcion(12))
          .foregroundStyle(Ink.ink8)

        if let razon = razonBloqueo(m) {
          Text(razon)
            .font(Tipo.detalle)
            .foregroundStyle(Ink.ink9)
            .padding(8)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Trama().clipShape(RoundedRectangle(cornerRadius: Radio.control)))
            .overlay(RoundedRectangle(cornerRadius: Radio.control).stroke(Ink.ink4, lineWidth: 1))
            .fixedSize(horizontal: false, vertical: true)
        }
        if let aviso {
          Text(aviso)
            .font(Tipo.detalle)
            .foregroundStyle(Ink.ink9)
            .fixedSize(horizontal: false, vertical: true)
            .accessibilityAddTraits(.updatesFrequently)
        }

        if m.hecha {
          Label("Hecha", systemImage: "checkmark")
            .font(Tipo.boton)
            .foregroundStyle(Ink.ink6)
            .frame(maxWidth: .infinity, minHeight: 44)
        } else {
          Button {
            Task { await hecha(m) }
          } label: {
            Text(ocupada ? "Guardando" : "Hecha")
          }
          .buttonStyle(BotonInvertido(activo: razonBloqueo(m) == nil && !ocupada))
          .disabled(razonBloqueo(m) != nil || ocupada || almacen.enCamino.contains(m.id))
          .accessibilityHint("Marca la misión como hecha en NIVL.")
        }

        // La nota del módulo va DEBAJO del botón: en 40 mm, encima, empujaba
        // «Hecha» fuera de la pantalla.
        if let modulo = m.nombreModulo, !m.hecha, razonBloqueo(m) == nil {
          Text("Se marca sola al registrar \(modulo) en el iPhone. Si la marcas aquí, \(modulo) no la paga dos veces.")
            .font(Tipo.detalle)
            .foregroundStyle(Ink.ink8)
            .fixedSize(horizontal: false, vertical: true)
        }
      }
      .padding(.horizontal, 4)
    }
    .background(Ink.ink0)
  }

  private func razonBloqueo(_ m: MisionReloj) -> String? {
    if m.hecha { return nil }
    if !esDeHoy { return "El día ha cambiado. Abre NIVL en el iPhone." }
    if m.bloqueada { return "Primero completa hoy una de tus misiones: la recuperación quedará abierta." }
    if m.requiereFoto { return "Pide foto. Complétala desde el iPhone." }
    return nil
  }

  private func hecha(_ m: MisionReloj) async {
    guard !ocupada else { return }
    ocupada = true
    aviso = nil
    let motivo = await almacen.completar(m)
    ocupada = false
    if let motivo {
      aviso = motivo
      WKInterfaceDevice.current().play(.directionDown)
    } else {
      WKInterfaceDevice.current().play(.success)
      cerrar()
    }
  }
}
