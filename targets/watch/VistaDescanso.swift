// NIVL · Apple Watch: descanso entre series (IRON). Con la sesión del
// gimnasio en marcha en el iPhone, enseña el ejercicio y la serie que toca;
// «Serie hecha» arranca el descanso prescrito y vibra al acabar. Sin sesión,
// el mismo descanso con la duración a elegir. Las series se apuntan en el
// iPhone: el reloj no escribe en el registro.

import SwiftUI
import WatchKit

struct VistaDescanso: View {
  @EnvironmentObject private var almacen: Almacen
  @StateObject private var t = Temporizador(idAviso: "nivl.reloj.descanso", tituloAviso: "Descanso terminado. A la siguiente serie.")
  @State private var elegido: Int = 120

  private let opciones = [60, 90, 120, 180]

  private var iron: IronReloj? { almacen.estado?.sesion == true ? almacen.estado?.iron : nil }

  var body: some View {
    TimelineView(.periodic(from: .now, by: 1)) { ctx in
      ScrollView {
        VStack(spacing: 8) {
          if t.enMarcha || t.enPausa {
            Rotulo(texto: "Descanso")
            Anillo(progreso: t.progreso(ctx.date), texto: formatoReloj(t.restante(ctx.date)))
            HStack(spacing: 6) {
              Button("+15 s") { t.sumar(15) }.buttonStyle(BotonContorno())
              Button("Saltar") { t.parar() }.buttonStyle(BotonContorno())
            }
            if let i = iron, !i.siguiente.isEmpty {
              Text("Después: \(i.siguiente)")
                .font(Tipo.detalle)
                .foregroundStyle(Ink.ink6)
            }
          } else {
            cabecera
            if t.acabado {
              Text("Descanso hecho. A la siguiente serie.")
                .font(Tipo.detalle)
                .foregroundStyle(Ink.ink9)
                .multilineTextAlignment(.center)
            }
            if iron == nil { selector }
            Button(iron == nil ? "Empezar" : "Serie hecha") {
              WKInterfaceDevice.current().play(.start)
              t.empezar(segundos: TimeInterval(iron?.descansoS ?? elegido))
            }
            .buttonStyle(BotonInvertido())
            if iron != nil {
              Text("Apunta peso y repeticiones en el iPhone.")
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
  }

  @ViewBuilder
  private var cabecera: some View {
    if let i = iron {
      VStack(spacing: 4) {
        Rotulo(texto: "IRON · Serie \(i.serie) de \(i.series)")
        Text(i.ejercicio)
          .font(.system(.headline).weight(.bold))
          .foregroundStyle(Ink.ink9)
          .multilineTextAlignment(.center)
          .lineLimit(2)
        if let linea = prescripcion(i) {
          Text(linea)
            .font(Tipo.cifra(22, relativoA: .title3))
            .foregroundStyle(Ink.ink10)
        }
        Text("Descanso \(formatoReloj(Double(i.descansoS)))")
          .font(Tipo.detalle)
          .foregroundStyle(Ink.ink6)
      }
      .accessibilityElement(children: .combine)
    } else {
      VStack(spacing: 2) {
        Text("DESCANSO")
          .font(Tipo.inscripcion(14))
          .tracking(3)
          .foregroundStyle(Ink.ink10)
          .accessibilityAddTraits(.isHeader)
        Rotulo(texto: "Entre series")
      }
    }
  }

  private var selector: some View {
    HStack(spacing: 4) {
      ForEach(opciones, id: \.self) { s in
        Button {
          elegido = s
          WKInterfaceDevice.current().play(.click)
        } label: {
          Text(formatoReloj(Double(s)))
            .font(Tipo.cifra(13, relativoA: .footnote))
            .frame(maxWidth: .infinity, minHeight: 36)
            .foregroundStyle(elegido == s ? Ink.ink10 : Ink.ink6)
            .overlay(Rectangle().stroke(elegido == s ? Ink.ink10 : Ink.ink4, lineWidth: elegido == s ? 2 : 1))
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(s) segundos")
        .accessibilityAddTraits(elegido == s ? .isSelected : [])
      }
    }
  }

  /// «5 × 100 kg», «8-10 × 60 kg», «5 reps» o nada.
  private func prescripcion(_ i: IronReloj) -> String? {
    switch (i.reps.isEmpty, i.carga) {
    case (false, let c?): return "\(i.reps) × \(formatoKilos(c)) kg"
    case (false, nil): return "\(i.reps) reps"
    case (true, let c?): return "\(formatoKilos(c)) kg"
    default: return nil
    }
  }
}
