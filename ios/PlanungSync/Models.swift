import Foundation

/// A top-level task as returned by the Planung API.
struct RemoteTask: Codable, Identifiable {
    let id: String
    var title: String
    var description: String?
    var status: String
    var plannedTime: Int?
    var scheduledDate: String?
    var scheduledStart: String?
    var scheduledEnd: String?
    var isBacklog: Bool?
    var completedAt: String?
    var updatedAt: String?

    var isCompleted: Bool { status == "COMPLETED" }
    var start: Date? { DateCoding.parse(scheduledStart) }
    var end: Date? { DateCoding.parse(scheduledEnd) }
    var updated: Date { DateCoding.parse(updatedAt) ?? .distantPast }
}

struct TaskListResponse: Codable {
    let tasks: [RemoteTask]
}

struct MobileSession: Codable {
    var accessToken: String
    var refreshToken: String
    var expiresAt: Double
    var email: String?
}

enum DateCoding {
    /// Supabase returns Prisma `timestamp without time zone` columns in UTC
    /// without a zone suffix, e.g. `2026-09-30T08:00:00.54`.
    static func parse(_ value: String?) -> Date? {
        guard var value, !value.isEmpty else { return nil }
        let hasZone = value.hasSuffix("Z")
            || value.range(of: #"[+-]\d{2}:?\d{2}$"#, options: .regularExpression) != nil
        if !hasZone { value += "Z" }

        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = formatter.date(from: value) { return date }
        formatter.formatOptions = [.withInternetDateTime]
        return formatter.date(from: value)
    }

    static func iso(_ date: Date) -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter.string(from: date)
    }

    /// Local calendar day as `yyyy-MM-dd`, the format the web app uses for `scheduledDate`.
    static func day(_ date: Date) -> String {
        let c = Calendar.current.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0)
    }

    static func dayComponents(_ day: String) -> DateComponents? {
        let parts = day.split(separator: "-").compactMap { Int($0) }
        guard parts.count == 3 else { return nil }
        return DateComponents(year: parts[0], month: parts[1], day: parts[2])
    }

    /// Local date for a day string plus minutes since midnight.
    static func date(day: String, minutes: Int) -> Date? {
        guard var c = dayComponents(day) else { return nil }
        c.hour = minutes / 60
        c.minute = minutes % 60
        return Calendar.current.date(from: c)
    }

    static func minutesOfDay(_ date: Date) -> Int {
        let c = Calendar.current.dateComponents([.hour, .minute], from: date)
        return (c.hour ?? 0) * 60 + (c.minute ?? 0)
    }
}
