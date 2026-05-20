import Foundation
import ApplicationServices

let source = CGEventSource(stateID: .combinedSessionState)
let cKeyCode: CGKeyCode = 8 // virtual key code for 'c'

// Send Cmd+C
let cmdCDown = CGEvent(keyboardEventSource: source, virtualKey: cKeyCode, keyDown: true)
cmdCDown?.flags = .maskCommand
let cmdCUp = CGEvent(keyboardEventSource: source, virtualKey: cKeyCode, keyDown: false)
cmdCUp?.flags = .maskCommand

cmdCDown?.post(tap: .cghidEventTap)
cmdCUp?.post(tap: .cghidEventTap)

print("SUCCESS")
