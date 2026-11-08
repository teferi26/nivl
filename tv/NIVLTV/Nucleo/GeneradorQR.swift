// NIVL TV · El QR del enlace, con CoreImage y sin interpolar.
//
// CoreImage da la matriz; aquí se recorta su margen y se pinta a un píxel por
// módulo, blanco sobre negro con cuatro módulos de zona de silencio. La vista
// lo escala por un entero, así cada módulo cae en píxeles exactos.

import CoreGraphics
import CoreImage
import CoreImage.CIFilterBuiltins

enum GeneradorQR {
    /// Módulos de zona de silencio por lado (lo que pide el estándar).
    static let silencio = 4

    /// true = módulo oscuro en el QR estándar. Sin zona de silencio.
    static func matriz(_ texto: String) -> [[Bool]]? {
        let filtro = CIFilter.qrCodeGenerator()
        filtro.message = Data(texto.utf8)
        filtro.correctionLevel = "M"
        guard let salida = filtro.outputImage else { return nil }
        let marco = salida.extent.integral
        let ancho = Int(marco.width), alto = Int(marco.height)
        guard ancho > 0, alto > 0 else { return nil }
        var pixeles = [UInt8](repeating: 255, count: ancho * alto)
        CIContext(options: [.useSoftwareRenderer: true, .workingColorSpace: NSNull()]).render(
            salida, toBitmap: &pixeles, rowBytes: ancho, bounds: marco, format: .L8, colorSpace: nil
        )
        let filas = (0..<alto).map { y in (0..<ancho).map { x in pixeles[y * ancho + x] < 128 } }
        guard let arriba = filas.firstIndex(where: { $0.contains(true) }),
              let abajo = filas.lastIndex(where: { $0.contains(true) }),
              let izquierda = (0..<ancho).first(where: { x in filas.contains { $0[x] } }),
              let derecha = (0..<ancho).last(where: { x in filas.contains { $0[x] } }) else { return nil }
        return filas[arriba...abajo].map { Array($0[izquierda...derecha]) }
    }

    /// Módulos blancos sobre negro, un píxel por módulo, con su zona de silencio.
    static func imagen(_ texto: String) -> CGImage? {
        guard let m = matriz(texto), let primera = m.first else { return nil }
        let total = primera.count + silencio * 2
        guard m.count + silencio * 2 == total else { return nil }
        var datos = [UInt8](repeating: 0, count: total * total)
        for (y, fila) in m.enumerated() {
            for (x, oscuro) in fila.enumerated() where oscuro {
                datos[(y + silencio) * total + x + silencio] = 255
            }
        }
        guard let proveedor = CGDataProvider(data: Data(datos) as CFData) else { return nil }
        return CGImage(
            width: total, height: total, bitsPerComponent: 8, bitsPerPixel: 8, bytesPerRow: total,
            space: CGColorSpaceCreateDeviceGray(), bitmapInfo: CGBitmapInfo(rawValue: CGImageAlphaInfo.none.rawValue),
            provider: proveedor, decode: nil, shouldInterpolate: false, intent: .defaultIntent
        )
    }
}
