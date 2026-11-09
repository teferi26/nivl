// NIVL · Apple Watch: racha y rango. La racha es el monumento de la página;
// debajo, el rango grabado, el nivel con su barra y las piedras.

import SwiftUI

struct VistaRacha: View {
  @EnvironmentObject private var almacen: Almacen

  var body: some View {
    if let e = almacen.estado, e.sesion {
      ScrollView {
        VStack(spacing: 12) {
          racha(e)
          rango(e)
          piedras(e)
        }
        .padding(.horizontal, 4)
      }
      .background(Ink.ink0)
    } else {
      SinDatos(titulo: "RACHA")
    }
  }

  private func racha(_ e: EstadoReloj) -> some View {
    VStack(spacing: 2) {
      Text("\(e.racha)")
        .font(Tipo.cifra(64))
        .minimumScaleFactor(0.5)
        .lineLimit(1)
        .foregroundStyle(Ink.ink10)
      Rotulo(texto: e.racha == 1 ? "Día de racha" : "Días de racha")
      HiloOro()
        .padding(.top, 4)
      if !e.rachaCerrada && e.pendientes > 0 && e.esDeHoy {
        Text(e.pendientes == 1 ? "Te queda 1 misión para sumar hoy." : "Te quedan \(e.pendientes) misiones para sumar hoy.")
          .font(Tipo.detalle)
          .foregroundStyle(Ink.ink8)
          .multilineTextAlignment(.center)
      }
    }
    .accessibilityElement(children: .combine)
  }

  private func rango(_ e: EstadoReloj) -> some View {
    HStack(spacing: 10) {
      Text(e.rango)
        .font(Tipo.cifra(26, relativoA: .title2))
        .foregroundStyle(Ink.ink10)
        .frame(width: 44, height: 44)
        .overlay(RoundedRectangle(cornerRadius: Radio.control).stroke(Oro.hilo, lineWidth: 1))
        .accessibilityLabel("Rango \(e.rango)")
      VStack(alignment: .leading, spacing: 4) {
        Text("NIVEL \(e.nivel)")
          .font(Tipo.inscripcion(13))
          .foregroundStyle(Ink.ink9)
        Barra(progreso: e.progresoNivel)
        Text(e.xpSiguiente > 0 ? "\(formatoMiles(e.xpEnNivel)) / \(formatoMiles(e.xpSiguiente)) XP" : "Nivel máximo")
          .font(Tipo.detalle)
          .foregroundStyle(Ink.ink6)
          .lineLimit(1)
          .minimumScaleFactor(0.8)
      }
    }
    .padding(8)
    .frame(maxWidth: .infinity, alignment: .leading)
    .background(Ink.ink1, in: RoundedRectangle(cornerRadius: Radio.control))
    .overlay(RoundedRectangle(cornerRadius: Radio.control).stroke(Ink.ink3, lineWidth: 1))
    .accessibilityElement(children: .combine)
  }

  private func piedras(_ e: EstadoReloj) -> some View {
    VStack(alignment: .leading, spacing: 6) {
      Rotulo(texto: "Piedras de protección")
      HStack(spacing: 8) {
        ForEach(0..<max(1, e.piedrasMax), id: \.self) { i in
          Image(systemName: i < e.piedras ? "shield.fill" : "shield")
            .font(.system(size: 18, weight: .regular))
            .foregroundStyle(i < e.piedras ? Ink.ink10 : Ink.ink4)
        }
        Spacer()
        Text("\(e.piedras)/\(e.piedrasMax)")
          .font(Tipo.cifra(16, relativoA: .body))
          .foregroundStyle(Ink.ink9)
      }
      if !e.titulo.isEmpty {
        Text(e.titulo)
          .font(Tipo.detalle)
          .foregroundStyle(Ink.ink6)
      }
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .accessibilityElement(children: .ignore)
    .accessibilityLabel("Piedras de protección: \(e.piedras) de \(e.piedrasMax).")
  }
}

/// La Barra del kit: pista ink4, avance en oro.
struct Barra: View {
  let progreso: Double
  var alto: CGFloat = 4

  var body: some View {
    GeometryReader { g in
      ZStack(alignment: .leading) {
        Capsule().fill(Ink.ink4)
        Capsule().fill(Oro.hilo).frame(width: g.size.width * progreso)
      }
    }
    .frame(height: alto)
    .accessibilityHidden(true)
  }
}
