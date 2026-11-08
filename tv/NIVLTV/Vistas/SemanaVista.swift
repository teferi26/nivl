// NIVL TV · Resumen de la semana.
//
// Racha, XP ganado, misiones hechas o falladas, el mapa de 12 semanas y la
// tendencia de peso. Todo llega calculado (cierre de días y estudio de peso
// de analytics.ts): la vista no hace aritmética, solo pinta. Lo hecho en
// blanco; lo fallado en trama, que sustituye al rojo.

import Charts
import SwiftUI

struct SemanaVista: View {
    let semana: SemanaTV
    let saludActiva: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: Hueco.s6) {
            HStack(alignment: .bottom) {
                EncabezadoTV(ceja: "Resumen · esta semana", titulo: "Tu semana")
                    // Si no, el título (que encoge para caber en una línea)
                    // cede su sitio a las cifras y sale diminuto.
                    .fixedSize()
                Spacer()
                HStack(spacing: Hueco.s8) {
                    Cifra(rotulo: "Racha", valor: "\(semana.racha)", unidad: "días")
                    Cifra(rotulo: "Piedras", valor: "\(semana.piedras)", unidad: "de \(semana.piedrasMax)")
                    Cifra(rotulo: "XP ganado", valor: Formato.miles(semana.xpGanado))
                    Cifra(rotulo: "Hechas", valor: "\(semana.hechas)")
                    Cifra(rotulo: "Falladas", valor: "\(semana.falladas)")
                }
                .frame(width: 1080)
            }

            HStack(alignment: .top, spacing: Hueco.s10) {
                Tarjeta(marco: Trazo.hairline, relleno: Hueco.s8) {
                    VStack(alignment: .leading, spacing: Hueco.s6) {
                        Rotulo(texto: "Misiones por día")
                        BarrasSemana(dias: semana.dias)
                        Leyenda()
                    }
                }
                .frame(width: 720)
                Tarjeta(marco: Trazo.hairline, relleno: Hueco.s8) {
                    VStack(alignment: .leading, spacing: Hueco.s6) {
                        Rotulo(texto: "Últimas 12 semanas")
                        MapaCalor(mapa: semana.mapa)
                    }
                }
            }

            // Relleno más corto: con s8 la tarjeta bajaba del área segura.
            Tarjeta(marco: Trazo.hairline, relleno: Hueco.s6) {
                if let tendencia = semana.tendenciaKgSemana,
                   let inicio = semana.tendenciaInicio, let fin = semana.tendenciaFin, !semana.pesos.isEmpty {
                    HStack(alignment: .top, spacing: Hueco.s10) {
                        VStack(alignment: .leading, spacing: Hueco.s4) {
                            Rotulo(texto: "Peso · 4 semanas")
                            HStack(alignment: .firstTextBaseline, spacing: Hueco.s2) {
                                Text(Formato.tendencia(tendencia))
                                    .font(Tipo.cifra)
                                    .foregroundStyle(Tinta.i10)
                                Text("kg por semana").font(Tipo.cuerpoSm).foregroundStyle(Tinta.i6)
                            }
                            Text(semana.lectura ?? "")
                                .font(Tipo.cuerpoSm)
                                .foregroundStyle(Tinta.i8)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                        .frame(width: 520, alignment: .leading)
                        GraficoPeso(pesos: semana.pesos, inicio: inicio, fin: fin)
                            .frame(height: 150)
                    }
                } else {
                    VStack(alignment: .leading, spacing: Hueco.s4) {
                        Rotulo(texto: "Peso · 4 semanas")
                        Text(saludActiva
                             ? (semana.lectura ?? "Pésate al menos tres veces para leer la tendencia.")
                             : "Activa los datos de salud en tu iPhone para ver tu peso aquí.")
                            .font(Tipo.cuerpoSm)
                            .foregroundStyle(Tinta.i8)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
            }
        }
        .padding(.horizontal, Hueco.margenLateral)
        .padding(.top, Hueco.bajoPestanas)
        .padding(.bottom, Hueco.s8)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
    }
}

// MARK: Barras de la semana

private struct BarrasSemana: View {
    let dias: [DiaSemana]
    private let alto: CGFloat = 130

    var body: some View {
        let tope = max(1, dias.map { $0.hechas + $0.falladas }.max() ?? 1)
        HStack(alignment: .bottom, spacing: Hueco.s6) {
            ForEach(dias) { d in
                VStack(spacing: Hueco.s3) {
                    VStack(spacing: 4) {
                        Trama()
                            .frame(height: alto * CGFloat(d.falladas) / CGFloat(tope))
                            .overlay(Rectangle().strokeBorder(Tinta.i6, lineWidth: d.falladas > 0 ? Trazo.hairline : 0))
                        Rectangle()
                            .fill(Tinta.i10)
                            .frame(height: alto * CGFloat(d.hechas) / CGFloat(tope))
                    }
                    .frame(height: alto, alignment: .bottom)
                    Text(d.inicial).font(Tipo.rotulo).foregroundStyle(Tinta.i8)
                }
                .frame(maxWidth: .infinity)
                .accessibilityElement(children: .ignore)
                .accessibilityLabel("\(d.inicial): \(d.hechas) hechas, \(d.falladas) falladas")
            }
        }
    }
}

private struct Leyenda: View {
    var body: some View {
        HStack(spacing: Hueco.s8) {
            HStack(spacing: Hueco.s2) {
                Rectangle().fill(Tinta.i10).frame(width: 24, height: 24)
                Text("Hechas").font(Tipo.rotulo).foregroundStyle(Tinta.i8)
            }
            HStack(spacing: Hueco.s2) {
                Trama().frame(width: 24, height: 24).overlay(Rectangle().strokeBorder(Tinta.i6, lineWidth: Trazo.hairline))
                Text("Falladas").font(Tipo.rotulo).foregroundStyle(Tinta.i8)
            }
        }
        .accessibilityHidden(true)
    }
}

/// Rayado a 45° (la trama del sistema: alerta, fallo).
struct Trama: View {
    var body: some View {
        Canvas { ctx, size in
            var p = Path()
            var x: CGFloat = -size.height
            while x < size.width {
                p.move(to: CGPoint(x: x, y: size.height))
                p.addLine(to: CGPoint(x: x + size.height, y: 0))
                x += 10
            }
            ctx.stroke(p, with: .color(Tinta.i6), lineWidth: 2)
        }
        .clipped()
        .accessibilityHidden(true)
    }
}

// MARK: Mapa de calor

private struct MapaCalor: View {
    let mapa: [[Double]]
    private let iniciales = ["L", "M", "X", "J", "V", "S", "D"]

    /// Cinco escalones de gris de la escala ink, del vacío al blanco.
    private func tinta(_ v: Double) -> Color {
        switch v {
        case ..<0.05: return Tinta.i2
        case ..<0.35: return Tinta.i4
        case ..<0.65: return Tinta.i6
        case ..<0.9: return Tinta.i8
        default: return Tinta.i10
        }
    }

    var body: some View {
        HStack(alignment: .top, spacing: Hueco.s3) {
            VStack(spacing: 6) {
                ForEach(iniciales, id: \.self) { i in
                    Text(i).font(Tipo.rotulo).foregroundStyle(Tinta.i6).frame(height: 26)
                }
            }
            ForEach(mapa.indices, id: \.self) { s in
                VStack(spacing: 6) {
                    ForEach(mapa[s].indices, id: \.self) { d in
                        Rectangle()
                            .fill(tinta(mapa[s][d]))
                            .frame(maxWidth: .infinity)
                            .frame(height: 26)
                            .overlay(
                                Rectangle().strokeBorder(Tinta.i10, lineWidth: s == mapa.count - 1 ? Trazo.hairline : 0)
                            )
                    }
                }
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Mapa de cumplimiento de las últimas 12 semanas")
    }
}

// MARK: Peso

private struct GraficoPeso: View {
    let pesos: [PuntoPeso]
    let inicio: Double
    let fin: Double

    var body: some View {
        let ultimo = pesos.last?.dia ?? 0
        let valores = pesos.map(\.kg) + [inicio, fin]
        let minimo = (valores.min() ?? 0) - 0.5
        let maximo = (valores.max() ?? 0) + 0.5
        Chart {
            ForEach(pesos) { p in
                PointMark(x: .value("Día", p.dia), y: .value("Kg", p.kg))
                    .foregroundStyle(Tinta.i8)
                    .symbolSize(140)
            }
            // La recta del estudio (mínimos cuadrados en el servidor).
            LineMark(x: .value("Día", 0), y: .value("Kg", inicio), series: .value("Serie", "tendencia"))
                .foregroundStyle(Tinta.i10)
                .lineStyle(StrokeStyle(lineWidth: 5))
            LineMark(x: .value("Día", ultimo), y: .value("Kg", fin), series: .value("Serie", "tendencia"))
                .foregroundStyle(Tinta.i10)
                .lineStyle(StrokeStyle(lineWidth: 5))
        }
        .chartYScale(domain: minimo...maximo)
        .chartXAxis(.hidden)
        .chartYAxis {
            AxisMarks(position: .leading, values: .automatic(desiredCount: 3)) { v in
                AxisGridLine().foregroundStyle(Tinta.i3)
                AxisValueLabel {
                    if let kg = v.as(Double.self) {
                        Text(Formato.kg(kg)).font(Tipo.rotulo).foregroundStyle(Tinta.i6)
                    }
                }
            }
        }
        .accessibilityLabel("Tendencia de peso de \(Formato.kg(inicio)) a \(Formato.kg(fin)) kilos")
    }
}
