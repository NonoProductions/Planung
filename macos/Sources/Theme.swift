import AppKit
import SwiftUI

/// Colors from the web app's globals.css (light / dark).
enum Theme {
    static let background = dynamic(0xf4efe8, 0x151312)
    static let board = dynamic(0xfffdfa, 0x1a1817)
    static let card = dynamic(0xffffff, 0x1e1c1a)
    static let sidebar = dynamic(0xf6f2ec, 0x181614)
    static let hover = dynamic(0xece6de, 0x2b2825)
    static let sunken = dynamic(0xf2efea, 0x201e1c)
    static let line = dynamic(0xe4ddd6, 0x302c29)
    static let lineSoft = dynamic(0xefe8e0, 0x262321)
    static let text = dynamic(0x4c463f, 0xece6de)
    static let textSecondary = dynamic(0x7f786f, 0xa39b91)
    static let textMuted = dynamic(0xb2aaa1, 0x6d665f)
    static let accent = Color(hex: 0x8d7cf6)
    static let accentLight = dynamic(0xf0ebff, 0x2a2540)
    static let success = Color(hex: 0x57b679)
    static let warning = Color(hex: 0xf4ad46)
    static let danger = Color(hex: 0xe06f6f)
    static let nowLine = Color(hex: 0xf29f34)

    private static func dynamic(_ light: UInt32, _ dark: UInt32) -> Color {
        Color(nsColor: NSColor(name: nil) { appearance in
            appearance.bestMatch(from: [.darkAqua, .aqua]) == .darkAqua ? NSColor(hex: dark) : NSColor(hex: light)
        })
    }
}

extension NSColor {
    convenience init(hex: UInt32) {
        self.init(srgbRed: CGFloat((hex >> 16) & 0xff) / 255, green: CGFloat((hex >> 8) & 0xff) / 255,
                  blue: CGFloat(hex & 0xff) / 255, alpha: 1)
    }
}

extension Color {
    init(hex: UInt32) { self.init(nsColor: NSColor(hex: hex)) }

    /// `#RRGGBB` strings as stored for channels and calendars.
    init?(hexString: String?) {
        guard var s = hexString?.trimmingCharacters(in: .whitespaces), !s.isEmpty else { return nil }
        if s.hasPrefix("#") { s.removeFirst() }
        guard s.count == 6, let value = UInt32(s, radix: 16) else { return nil }
        self.init(hex: value)
    }
}

struct CardStyle: ViewModifier {
    var highlighted = false
    func body(content: Content) -> some View {
        content
            .background(Theme.card, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous)
                .strokeBorder(highlighted ? Theme.accent : Theme.line, lineWidth: highlighted ? 1.5 : 1))
            .shadow(color: .black.opacity(0.04), radius: 6, y: 3)
    }
}

extension View {
    func card(highlighted: Bool = false) -> some View { modifier(CardStyle(highlighted: highlighted)) }
}

enum Fmt {
    static let locale = Locale(identifier: "de_DE")

    static func string(_ date: Date, _ template: String) -> String {
        let f = DateFormatter()
        f.locale = locale
        f.setLocalizedDateFormatFromTemplate(template)
        return f.string(from: date)
    }

    static func time(_ date: Date) -> String { string(date, "HH:mm") }

    static func dayTitle(_ day: String) -> String {
        guard let date = DateCoding.date(fromDay: day) else { return day }
        let f = DateFormatter()
        f.locale = locale
        f.dateFormat = "EEEE"
        return f.string(from: date)
    }

    static func dayDate(_ day: String) -> String {
        guard let date = DateCoding.date(fromDay: day) else { return day }
        let f = DateFormatter()
        f.locale = locale
        f.dateFormat = "d. MMMM"
        return f.string(from: date)
    }

    static func relativeDay(_ day: String) -> String {
        let today = DateCoding.today()
        if day == today { return "Heute" }
        if day == DateCoding.addDays(today, 1) { return "Morgen" }
        if day == DateCoding.addDays(today, -1) { return "Gestern" }
        return dayTitle(day)
    }
}
