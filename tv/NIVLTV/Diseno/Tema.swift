// NIVL TV · Tokens de «Mármol y tinta» para la pantalla grande.
//
// Espejo de src/design/tokens.ts (la fuente única de la app). Solo blanco y
// negro: el significado va en inversión, peso del trazo y escala, nunca en
// color. Si cambia un ink allí, cámbialo aquí.
//
// Escala de TV: se lee a tres metros. La pauta de Apple para tvOS pide cuerpo
// de 29 pt o más; aquí la lectura mínima es 30 y los rótulos 24.

import CoreText
import SwiftUI

enum Tinta {
    static let i0 = Color(hex: 0x000000) // fondo
    static let i1 = Color(hex: 0x0B0B0B) // superficie
    static let i2 = Color(hex: 0x161616) // superficie elevada
    static let i3 = Color(hex: 0x242424) // hairline
    static let i4 = Color(hex: 0x3A3A3A) // pista, borde de control
    static let i6 = Color(hex: 0x8C8C8C) // texto terciario
    static let i8 = Color(hex: 0xBDBDBD) // texto secundario
    static let i9 = Color(hex: 0xEDEDED) // texto principal
    static let i10 = Color(hex: 0xFFFFFF) // la inversión
}

/// Trazos: la jerarquía se dice con el peso (hairline 1 · rule 2 · frame 3),
/// doblados para la distancia del sofá.
enum Trazo {
    static let hairline: CGFloat = 2
    static let rule: CGFloat = 4
    static let frame: CGFloat = 6
}

/// Espaciado base 4, como `space` de tokens.ts, con los saltos grandes de TV.
enum Hueco {
    static let s2: CGFloat = 8
    static let s3: CGFloat = 12
    static let s4: CGFloat = 16
    static let s6: CGFloat = 24
    static let s8: CGFloat = 32
    static let s10: CGFloat = 40
    static let s14: CGFloat = 56
    static let s20: CGFloat = 80
    /// El margen seguro de tvOS (60 pt arriba y abajo, 80 a los lados) ya lo
    /// pone el área segura de la TabView: sumar otros 80 dejaba 160 por lado,
    /// estrechaba las columnas y hacía que el contenido se saliera por abajo.
    static let margenLateral: CGFloat = 0
    /// Bajo la barra de pestañas flotante de tvOS (se suma a los 60 del área
    /// segura; la barra acaba hacia los 115 pt).
    static let bajoPestanas: CGFloat = 80
}

/// Foco: escala ×1,1 y marco blanco. Nada de hover.
enum Foco {
    static let escala: CGFloat = 1.1
    static let duracion: Double = 0.18
}

enum Tipo {
    // Cinzel: títulos en mayúscula y cifras. Outfit: todo lo que se lee.
    static func monumento(_ tam: CGFloat = 220) -> Font { .custom("Cinzel-Bold", fixedSize: tam) }
    static let display = Font.custom("Cinzel-Bold", fixedSize: 96)
    static let rango = Font.custom("Cinzel-Bold", fixedSize: 60)
    static let cifra = Font.custom("Cinzel-SemiBold", fixedSize: 64)
    static let numero = Font.custom("Cinzel-SemiBold", fixedSize: 44)
    static let inscripcion = Font.custom("Cinzel-Bold", fixedSize: 26)
    static let titulo = Font.custom("Outfit-Bold", fixedSize: 52)
    static let titular = Font.custom("Outfit-Bold", fixedSize: 38)
    static let cuerpo = Font.custom("Outfit-Medium", fixedSize: 32)
    static let cuerpoSm = Font.custom("Outfit-Medium", fixedSize: 30)
    static let rotulo = Font.custom("Outfit-Bold", fixedSize: 24)
    static let boton = Font.custom("Outfit-Bold", fixedSize: 30)
}

enum Fuentes {
    /// Registra las TTF del paquete (Cinzel y Outfit, OFL). Sin Info.plist
    /// propio: el proyecto genera el suyo y así no hay que mantener UIAppFonts.
    static func registrar() {
        let urls = Bundle.main.urls(forResourcesWithExtension: "ttf", subdirectory: nil) ?? []
        for url in urls {
            CTFontManagerRegisterFontsForURL(url as CFURL, .process, nil)
        }
    }
}

extension Color {
    init(hex: UInt32) {
        self.init(
            .sRGB,
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255,
            opacity: 1
        )
    }
}
