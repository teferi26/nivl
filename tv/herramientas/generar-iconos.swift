#!/usr/bin/env swift
// NIVL TV · Genera el icono en capas y la Top Shelf en estilo Ónix, sin dependencias.
//   swift tv/herramientas/generar-iconos.swift
// Escribe en tv/NIVLTV/Assets.xcassets/App Icon & Top Shelf Image.brandassets.
// El escudo con la N es el de assets/images/icon.png.

import AppKit
import CoreText
import Foundation

let raiz = URL(fileURLWithPath: CommandLine.arguments[0]).deletingLastPathComponent().deletingLastPathComponent()
let raizReal = FileManager.default.fileExists(atPath: raiz.appendingPathComponent("NIVLTV").path)
    ? raiz : URL(fileURLWithPath: FileManager.default.currentDirectoryPath).appendingPathComponent("tv")
let marca = raizReal.appendingPathComponent("NIVLTV/Assets.xcassets/App Icon & Top Shelf Image.brandassets")
let fuente = raizReal.appendingPathComponent("NIVLTV/Recursos/Fuentes/PlayfairDisplay_700Bold.ttf") as CFURL
CTFontManagerRegisterFontsForURL(fuente, .process, nil)

func color(_ hex: UInt32, _ a: CGFloat = 1) -> CGColor {
    CGColor(srgbRed: CGFloat((hex >> 16) & 255) / 255, green: CGFloat((hex >> 8) & 255) / 255, blue: CGFloat(hex & 255) / 255, alpha: a)
}
let hueso = color(0xEDEAE3), oro = color(0xC9A961)

func lienzo(_ w: Int, _ h: Int, opaco: Bool, _ pinta: (CGContext) -> Void) -> CGImage {
    let info: CGImageAlphaInfo = opaco ? .noneSkipLast : .premultipliedLast
    let c = CGContext(data: nil, width: w, height: h, bitsPerComponent: 8, bytesPerRow: 0,
                      space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: info.rawValue)!
    c.setAllowsAntialiasing(true)
    c.interpolationQuality = .high
    pinta(c)
    return c.makeImage()!
}

func fondo(_ c: CGContext, _ w: Int, _ h: Int) {
    let g = CGGradient(colorsSpace: CGColorSpace(name: CGColorSpace.sRGB), colors: [color(0x121214), color(0x09090B), color(0x050506)] as CFArray, locations: [0, 0.55, 1])!
    c.drawLinearGradient(g, start: CGPoint(x: 0, y: h), end: .zero, options: [])
}

/// El contorno del escudo en una caja de lado `l` (origen abajo a la izquierda).
func escudo(_ x: CGFloat, _ y: CGFloat, _ l: CGFloat, margen m: CGFloat = 0) -> CGPath {
    let p = CGMutablePath()
    func q(_ a: CGFloat, _ b: CGFloat) -> CGPoint { CGPoint(x: x + a * l, y: y + (1 - b) * l) }
    let i = m
    p.move(to: q(0.5, 0.0 + i))
    p.addLine(to: q(1 - i * 1.15, 0.13 + i * 0.75))
    p.addLine(to: q(1 - i * 1.15, 0.52))
    p.addCurve(to: q(0.5, 1 - i * 1.15), control1: q(1 - i * 1.15, 0.78), control2: q(0.72, 0.9 - i))
    p.addCurve(to: q(i * 1.15, 0.52), control1: q(0.28, 0.9 - i), control2: q(i * 1.15, 0.78))
    p.addLine(to: q(i * 1.15, 0.13 + i * 0.75))
    p.closeSubpath()
    return p
}

func letra(_ c: CGContext, _ texto: String, centro: CGPoint, alto: CGFloat, color col: CGColor, tracking: CGFloat = 0) {
    let f = CTFontCreateWithName("PlayfairDisplay-Bold" as CFString, alto, nil)
    let attrs: [NSAttributedString.Key: Any] = [.init(kCTFontAttributeName as String): f, .init(kCTForegroundColorAttributeName as String): col, .init(kCTKernAttributeName as String): tracking]
    let linea = CTLineCreateWithAttributedString(NSAttributedString(string: texto, attributes: attrs))
    c.textPosition = .zero
    let caja = CTLineGetImageBounds(linea, c)
    c.textPosition = CGPoint(x: centro.x - caja.midX, y: centro.y - caja.midY)
    CTLineDraw(linea, c)
}

func emblema(_ c: CGContext, _ x: CGFloat, _ y: CGFloat, _ l: CGFloat) {
    c.addPath(escudo(x, y, l)); c.setStrokeColor(hueso); c.setLineWidth(l * 0.034); c.setLineJoin(.round); c.strokePath()
    c.addPath(escudo(x, y, l, margen: 0.075)); c.setStrokeColor(oro); c.setLineWidth(l * 0.011); c.strokePath()
    letra(c, "N", centro: CGPoint(x: x + l / 2, y: y + l * 0.5), alto: l * 0.56, color: hueso)
}

func guarda(_ img: CGImage, _ url: URL) {
    try! FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
    let d = CGImageDestinationCreateWithURL(url as CFURL, "public.png" as CFString, 1, nil)!
    CGImageDestinationAddImage(d, img, nil)
    precondition(CGImageDestinationFinalize(d), "no se pudo escribir \(url.path)")
}

func json(_ o: Any, _ url: URL) {
    try! FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
    try! JSONSerialization.data(withJSONObject: o, options: [.prettyPrinted, .sortedKeys]).write(to: url)
}
let info: [String: Any] = ["author": "xcode", "version": 1]

func pila(_ nombre: String, _ tam: (Int, Int), _ escalas: [Int]) {
    let dir = marca.appendingPathComponent("\(nombre).imagestack")
    json(["info": info, "layers": [["filename": "Front.imagestacklayer"], ["filename": "Back.imagestacklayer"]]], dir.appendingPathComponent("Contents.json"))
    for capa in ["Front", "Back"] {
        let d = dir.appendingPathComponent("\(capa).imagestacklayer")
        json(["info": info], d.appendingPathComponent("Contents.json"))
        var images: [[String: Any]] = []
        for e in escalas {
            let w = tam.0 * e, h = tam.1 * e, archivo = "\(capa)-\(w)x\(h).png"
            let img: CGImage
            if capa == "Back" {
                img = lienzo(w, h, opaco: true) { fondo($0, w, h) }
            } else {
                img = lienzo(w, h, opaco: false) { c in
                    let l = CGFloat(h) * 0.72
                    emblema(c, (CGFloat(w) - l) / 2, (CGFloat(h) - l) / 2, l)
                }
            }
            guarda(img, d.appendingPathComponent("Content.imageset/\(archivo)"))
            images.append(["idiom": "tv", "scale": "\(e)x", "filename": archivo])
        }
        json(["images": images, "info": info], d.appendingPathComponent("Content.imageset/Contents.json"))
    }
}

func estante(_ nombre: String, _ tam: (Int, Int)) {
    let d = marca.appendingPathComponent("\(nombre).imageset")
    var images: [[String: Any]] = []
    for e in [1, 2] {
        let w = tam.0 * e, h = tam.1 * e, archivo = "\(nombre.replacingOccurrences(of: " ", with: "-"))-\(w)x\(h).png"
        let img = lienzo(w, h, opaco: true) { c in
            fondo(c, w, h)
            let l = CGFloat(h) * 0.5, ch = CGFloat(h), cw = CGFloat(w)
            emblema(c, cw * 0.5 - l * 1.55, (ch - l) / 2, l)
            letra(c, "NIVL", centro: CGPoint(x: cw * 0.5 + l * 0.75, y: ch * 0.53), alto: l * 0.72, color: hueso, tracking: l * 0.03)
            c.setFillColor(oro)
            c.fill(CGRect(x: cw * 0.5 - l * 0.18, y: ch * 0.5 - l * 0.34, width: l * 0.32, height: max(2, ch * 0.0035)))
        }
        guarda(img, d.appendingPathComponent(archivo))
        images.append(["idiom": "tv", "scale": "\(e)x", "filename": archivo])
    }
    json(["images": images, "info": info], d.appendingPathComponent("Contents.json"))
}

try? FileManager.default.removeItem(at: marca)
pila("App Icon", (400, 240), [1, 2])
pila("App Icon - App Store", (1280, 768), [1])
estante("Top Shelf Image", (1920, 720))
estante("Top Shelf Image Wide", (2320, 720))
json([
    "assets": [
        ["filename": "App Icon - App Store.imagestack", "idiom": "tv", "role": "primary-app-icon", "size": "1280x768"],
        ["filename": "App Icon.imagestack", "idiom": "tv", "role": "primary-app-icon", "size": "400x240"],
        ["filename": "Top Shelf Image Wide.imageset", "idiom": "tv", "role": "top-shelf-image-wide", "size": "2320x720"],
        ["filename": "Top Shelf Image.imageset", "idiom": "tv", "role": "top-shelf-image", "size": "1920x720"],
    ],
    "info": info,
], marca.appendingPathComponent("Contents.json"))
print("Icono y Top Shelf escritos en \(marca.path)")
