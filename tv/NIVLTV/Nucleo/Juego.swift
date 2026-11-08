// NIVL TV · Tablas de presentación del juego.
//
// Espejo de src/lib/game.ts (xpCostForLevel, levelFromXp): la TV no calcula
// economía, solo traduce el XP que da el servidor a nivel para pintarlo,
// igual que hace la app. Si tocas una, toca la otra (JuegoTests fija los
// mismos valores). El RANGO no se deduce aquí: lo decide y registra el
// servidor (`sync_rank`, progression.ts) y llega hecho en cada fila.

import Foundation

enum Juego {
    static func costeNivel(_ nivel: Int) -> Int {
        Int((100 * pow(Double(nivel), 1.5)).rounded())
    }

    struct Nivel: Equatable {
        let nivel: Int
        let dentro: Int
        let siguiente: Int

        /// Fracción hacia el siguiente nivel; llena en el tope (siguiente = 0).
        var fraccion: Double {
            siguiente > 0 ? min(1, max(0, Double(dentro) / Double(siguiente))) : 1
        }
    }

    static func nivel(xp: Int) -> Nivel {
        var nivel = 1
        var resto = max(0, xp)
        while nivel < 999, resto >= costeNivel(nivel) {
            resto -= costeNivel(nivel)
            nivel += 1
        }
        if nivel >= 999 { return Nivel(nivel: 999, dentro: 0, siguiente: 0) }
        return Nivel(nivel: nivel, dentro: resto, siguiente: costeNivel(nivel))
    }

}

enum Formato {
    /// Miles con punto, como `formatoMiles` de la app (1.840), sin depender
    /// de la configuración regional del aparato.
    static func miles(_ n: Int) -> String {
        let signo = n < 0 ? "-" : ""
        var cifras = String(abs(n))
        var grupos: [String] = []
        while cifras.count > 3 {
            grupos.insert(String(cifras.suffix(3)), at: 0)
            cifras.removeLast(3)
        }
        grupos.insert(cifras, at: 0)
        return signo + grupos.joined(separator: ".")
    }

    /// m:ss para el reloj de series y descansos.
    static func reloj(_ segundos: TimeInterval) -> String {
        let s = max(0, Int(segundos.rounded(.up)))
        return "\(s / 60):" + String(format: "%02d", s % 60)
    }

    /// Carga en kg con coma decimal y sin «,0».
    static func kg(_ valor: Double) -> String {
        if valor == valor.rounded() { return "\(Int(valor))" }
        return String(format: "%.1f", valor).replacingOccurrences(of: ".", with: ",")
    }

    /// Ritmo con signo y dos decimales («−0,43», «+0,20»). El signo menos es
    /// el matemático (U+2212), no un guion.
    static func tendencia(_ kgSemana: Double) -> String {
        let cifra = String(format: "%.2f", abs(kgSemana)).replacingOccurrences(of: ".", with: ",")
        if cifra == "0,00" { return "0,00" }
        return (kgSemana < 0 ? "\u{2212}" : "+") + cifra
    }

    /// Porcentaje de cumplimiento; nil es «sin medir», que no es 0.
    static func cumple(_ pct: Int?) -> String {
        pct.map { "\($0) %" } ?? "Sin medir"
    }

    /// «8-10» se lee «8 a 10». Lo demás («8», «AMRAP») va tal cual.
    static func reps(_ texto: String) -> String {
        let partes = texto.split(separator: "-", omittingEmptySubsequences: false)
        guard partes.count == 2, partes.allSatisfy({ !$0.isEmpty && $0.allSatisfy(\.isNumber) }) else { return texto }
        return "\(partes[0]) a \(partes[1])"
    }

    private static let diasSemana = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]

    /// 1 lunes a 7 domingo. nil si el número no es un día.
    static func nombreDia(_ dia: Int) -> String? {
        (1...7).contains(dia) ? diasSemana[dia - 1] : nil
    }

    /// Cuándo es la próxima sesión, en palabras.
    static func cuando(enDias: Int, diaSemana: Int) -> String {
        if enDias == 1 { return "Mañana" }
        guard let dia = nombreDia(diaSemana) else { return "En \(enDias) días" }
        return enDias == 7 ? "El \(dia.lowercased()) que viene" : dia
    }

    /// «4 × 8 a 10 · 80 kg». Sin carga no hay kilos; sin repeticiones, «4 series».
    static func prescripcion(series: Int, reps: String, cargaKg: Double?) -> String {
        let base = reps.isEmpty ? (series == 1 ? "1 serie" : "\(series) series") : "\(series) × \(reps)"
        return base + (cargaKg.map { " · \(kg($0)) kg" } ?? "")
    }

    /// Lo que se pinta junto a «Última sincronización».
    static func hace(_ desde: Date, ahora: Date) -> String {
        let s = Int(ahora.timeIntervalSince(desde))
        if s < 60 { return "hace un momento" }
        if s < 3600 { return "hace \(s / 60) min" }
        if s < 86400 { return "hace \(s / 3600) h" }
        let dias = s / 86400
        return dias == 1 ? "hace 1 día" : "hace \(dias) días"
    }

    /// Fecha corta en español, sin depender de la región del aparato.
    static func fechaCorta(_ fecha: Date, zona: TimeZone = .current) -> String {
        var calendario = Calendar(identifier: .gregorian)
        calendario.timeZone = zona
        let c = calendario.dateComponents([.year, .month, .day], from: fecha)
        let meses = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto",
                     "septiembre", "octubre", "noviembre", "diciembre"]
        let mes = meses[max(0, min(11, (c.month ?? 1) - 1))]
        return "\(c.day ?? 1) de \(mes) de \(c.year ?? 0)"
    }

    /// Sin guion largo (regla del proyecto): ni U+2014 ni U+2013 en lo que se pinta.
    static func sinGuiones(_ texto: String) -> Bool {
        !texto.contains("\u{2014}") && !texto.contains("\u{2013}")
    }
}
