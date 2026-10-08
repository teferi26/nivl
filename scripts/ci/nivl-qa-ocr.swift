import Foundation
import Vision

let pointMode = CommandLine.arguments.contains("--dismiss-password-point")
let paths = CommandLine.arguments.dropFirst().filter { $0 != "--dismiss-password-point" }
var observations: [(String, Float, CGRect)] = []
var imageProcessed = false
for path in paths {
    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.recognitionLanguages = ["es-ES", "en-US"]
    request.usesLanguageCorrection = false
    do {
        try VNImageRequestHandler(url: URL(fileURLWithPath: path)).perform([request])
        imageProcessed = true
        for observation in request.results ?? [] {
            if let candidate = observation.topCandidates(1).first {
                observations.append((candidate.string, candidate.confidence, observation.boundingBox))
            }
        }
    } catch {
        // Never emit image paths, OCR strings or error descriptions.
    }
}

func normalized(_ value: String) -> String {
    value.split(whereSeparator: { $0.isWhitespace }).joined(separator: " ").lowercased()
}

if pointMode {
    let titles = Set(["guardar contraseña", "guardar contraseña?", "¿guardar contraseña?", "guardar esta contraseña", "save password", "save password?"])
    var titleFound = false
    var modalHint = false
    for width in 1...3 {
        if observations.count >= width {
            for index in 0...(observations.count - width) {
                let window = Array(observations[index..<(index + width)])
                let isFixedTitle = titles.contains(normalized(window.map { $0.0 }.joined(separator: " ")))
                if isFixedTitle { modalHint = true }
                if window.allSatisfy({ $0.1 >= 0.95 }) && isFixedTitle {
                    titleFound = true
                }
            }
        }
    }
    let buttons = observations.filter {
        $0.1 >= 0.95 && ["ahora no", "not now"].contains(normalized($0.0))
    }
    modalHint = modalHint || observations.contains { ["ahora no", "not now"].contains(normalized($0.0)) }
    let confidentText = observations.filter { $0.1 >= 0.95 }
    let knownLabels = Set(["tu edad", "tengo 16 años o más", "tengo 16 años o más.", "confirmar y continuar", "hoy", "entrar en la arena", "entra con tu correo y tu contraseña de nivl."])
    var knownScreen = false
    for width in 1...3 {
        if observations.count >= width {
            for index in 0...(observations.count - width) {
                let window = Array(observations[index..<(index + width)])
                if window.allSatisfy({ $0.1 >= 0.95 }) && knownLabels.contains(normalized(window.map { $0.0 }.joined(separator: " "))) {
                    knownScreen = true
                }
            }
        }
    }
    var point: String? = nil
    if titleFound && buttons.count == 1 {
        let box = buttons[0].2
        let x = Int((box.midX * 100).rounded())
        let y = Int(((1 - box.midY) * 100).rounded())
        if (1...99).contains(x) && (1...99).contains(y) {
            point = "\(x)%,\(y)%"
        }
    }
    struct FixedPointResult: Codable {
        let ocr_available: Bool
        let password_dialog: Bool
        let modal_hint: Bool
        let known_screen: Bool
        let point: String?
    }
    if let data = try? JSONEncoder().encode(FixedPointResult(ocr_available: imageProcessed && !confidentText.isEmpty, password_dialog: titleFound, modal_hint: modalHint, known_screen: knownScreen, point: point)) {
        FileHandle.standardOutput.write(data)
    }
} else {
    // Caller redirects standard OCR strings to a private runner file only.
    if let data = try? JSONEncoder().encode(observations.map { $0.0 }) {
        FileHandle.standardOutput.write(data)
    }
}
