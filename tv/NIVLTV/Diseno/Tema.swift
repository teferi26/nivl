// NIVL TV · Tokens de «Ónix» para la pantalla grande.
//
// Espejo de src/design/tokens.ts (la fuente única de la app). Fondo casi negro,
// texto y botón color hueso, tarjetas redondeadas y el oro solo como hilo en
// cifras y detalles. Si cambia un token allí, cámbialo aquí.
//
// Escala de TV: se lee a tres metros. La pauta de Apple para tvOS pide cuerpo
// de 29 pt o más; aquí la lectura mínima es 30 y los rótulos 24.

import CoreText
import SwiftUI
import UIKit

enum Tinta {
    static let i0 = Color(hex: 0x09090B) // fondo
    static let i1 = Color(hex: 0x151517) // superficie
    static let i2 = Color(hex: 0x1D1D1F) // superficie elevada
    static let i3 = Color(hex: 0x2A2A2C) // hairline
    static let i4 = Color(hex: 0x4A494C) // pista, borde de control
    static let i6 = Color(hex: 0x8F8C85) // texto terciario
    static let i8 = Color(hex: 0xB8B4AB) // texto secundario
    static let i9 = Color(hex: 0xF5F2EC) // texto principal
    static let i10 = Color(hex: 0xEDEAE3) // hueso: inversión y botón
}

/// El oro de Ónix: un hilo en cifras, rótulos y marcos. Nunca un relleno de botón.
enum Oro {
    static let hilo = Color(hex: 0xC9A961)
    static let claro = Color(hex: 0xEAD9AE)
}

/// Radios: `tokens.ts` con la escala de TV. La tarjeta manda; lo de dentro, menos.
enum Radio {
    static let tarjeta: CGFloat = 28
    static let control: CGFloat = 20
    static let chip: CGFloat = 12
    static let mini: CGFloat = 5
}

extension View {
    /// Fondo con radio, sin invadir el área segura.
    func fondoOnix<S: ShapeStyle>(_ estilo: S, radio: CGFloat) -> some View {
        background { RoundedRectangle(cornerRadius: radio, style: .continuous).fill(estilo) }
    }

    func marcoOnix<S: ShapeStyle>(_ estilo: S, ancho: CGFloat, radio: CGFloat) -> some View {
        overlay(RoundedRectangle(cornerRadius: radio, style: .continuous).strokeBorder(estilo, lineWidth: ancho))
    }
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
    // Playfair: títulos y cifras. Outfit: todo lo que se lee.
    static func monumento(_ tam: CGFloat = 220) -> Font { playfair("PlayfairDisplay-Bold", tam) }
    static let display = playfair("PlayfairDisplay-Bold", 96)
    static let rango = playfair("PlayfairDisplay-Bold", 60)
    static let cifra = playfair("PlayfairDisplay-SemiBold", 64)
    static let numero = playfair("PlayfairDisplay-SemiBold", 44)
    static let inscripcion = playfair("PlayfairDisplay-Bold", 28)

    /// Playfair trae por defecto cifras de estilo antiguo, que a tres metros bailan:
    /// se piden alineadas y tabulares.
    private static func playfair(_ nombre: String, _ tam: CGFloat) -> Font {
        let ajustes: [[UIFontDescriptor.FeatureKey: Int]] = [
            [.type: kNumberCaseType, .selector: kUpperCaseNumbersSelector],
            [.type: kNumberSpacingType, .selector: kMonospacedNumbersSelector],
        ]
        let descriptor = UIFontDescriptor(name: nombre, size: tam).addingAttributes([.featureSettings: ajustes])
        return Font(UIFont(descriptor: descriptor, size: tam))
    }

    static let titulo = Font.custom("Outfit-Bold", fixedSize: 52)
    static let titular = Font.custom("Outfit-Bold", fixedSize: 38)
    static let cuerpo = Font.custom("Outfit-Medium", fixedSize: 32)
    static let cuerpoSm = Font.custom("Outfit-Medium", fixedSize: 30)
    static let rotulo = Font.custom("Outfit-Bold", fixedSize: 24)
    static let boton = Font.custom("Outfit-Bold", fixedSize: 30)
}

enum Fuentes {
    /// Registra las TTF del paquete (Playfair y Outfit, OFL). Sin Info.plist
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
