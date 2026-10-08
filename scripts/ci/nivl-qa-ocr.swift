import Foundation
import Vision

// Local runner only. Never print recognized strings to the Actions log.
// The caller redirects stdout to a private temporary file consumed by the allowlist parser.
var recognized: [String] = []
for argument in CommandLine.arguments.dropFirst() {
    let imageURL = URL(fileURLWithPath: argument)
    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.recognitionLanguages = ["es-ES", "en-US"]
    request.usesLanguageCorrection = false
    do {
        try VNImageRequestHandler(url: imageURL).perform([request])
        recognized.append(contentsOf: (request.results ?? []).compactMap {
            $0.topCandidates(1).first?.string
        })
    } catch {
        // OCR unavailable does not reveal image names or error descriptions.
    }
}
if let data = try? JSONEncoder().encode(recognized) {
    FileHandle.standardOutput.write(data)
}
