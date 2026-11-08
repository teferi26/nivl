import SwiftUI

/// App vacía: solo existe para que los tests corran con un Info.plist que lleve
/// las claves MWDAT, igual que la app real. El SDK las exige también con el mock.
@main
struct HostApp: App {
  var body: some Scene {
    WindowGroup { Color.clear }
  }
}
