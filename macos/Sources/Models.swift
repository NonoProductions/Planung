import Foundation

// MARK: - Records

struct PlanTask: Codable, Identifiable, Hashable {
    var id: String
    var title: String
    var description: String?
    var status: String = "OPEN"
    var plannedTime: Int?
    var actualTime: Int?
    /// Local day `yyyy-MM-dd`, like the web app.
    var scheduledDate: String?
    var scheduledStart: Date?
    var scheduledEnd: Date?
    var position: Int = 0
    var channelId: String?
    var parentId: String?
    var isBacklog: Bool = false
    var backlogBucket: String?
    var backlogFolder: String?
    var completedAt: Date?
    /// Last change on the server or locally; decides conflicts with Apple Reminders/Calendar.
    var updatedAt: Date?

    var isCompleted: Bool { status == "COMPLETED" }
    var hasTimeBlock: Bool { scheduledStart != nil && scheduledEnd != nil }

    init(id: String = UUID().uuidString.lowercased(), title: String) {
        self.id = id
        self.title = title
    }

    private enum CodingKeys: String, CodingKey {
        case id, title, description, status, plannedTime, actualTime, scheduledDate, scheduledStart,
             scheduledEnd, position, channelId, parentId, isBacklog, backlogBucket, backlogFolder, completedAt, updatedAt
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        title = try c.decodeIfPresent(String.self, forKey: .title) ?? ""
        description = try c.decodeIfPresent(String.self, forKey: .description)
        status = try c.decodeIfPresent(String.self, forKey: .status) ?? "OPEN"
        plannedTime = try c.decodeIfPresent(Int.self, forKey: .plannedTime)
        actualTime = try c.decodeIfPresent(Int.self, forKey: .actualTime)
        scheduledDate = (try c.decodeIfPresent(String.self, forKey: .scheduledDate)).map { String($0.prefix(10)) }
        scheduledStart = try c.decodeFlexibleDate(.scheduledStart)
        scheduledEnd = try c.decodeFlexibleDate(.scheduledEnd)
        position = try c.decodeIfPresent(Int.self, forKey: .position) ?? 0
        channelId = try c.decodeIfPresent(String.self, forKey: .channelId)
        parentId = try c.decodeIfPresent(String.self, forKey: .parentId)
        isBacklog = try c.decodeIfPresent(Bool.self, forKey: .isBacklog) ?? false
        backlogBucket = try c.decodeIfPresent(String.self, forKey: .backlogBucket)
        backlogFolder = try c.decodeIfPresent(String.self, forKey: .backlogFolder)
        completedAt = try c.decodeFlexibleDate(.completedAt)
        updatedAt = try c.decodeFlexibleDate(.updatedAt)
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(id, forKey: .id)
        try c.encode(title, forKey: .title)
        try c.encodeIfPresent(description, forKey: .description)
        try c.encode(status, forKey: .status)
        try c.encodeIfPresent(plannedTime, forKey: .plannedTime)
        try c.encodeIfPresent(actualTime, forKey: .actualTime)
        try c.encodeIfPresent(scheduledDate, forKey: .scheduledDate)
        try c.encodeIfPresent(scheduledStart.map(DateCoding.iso), forKey: .scheduledStart)
        try c.encodeIfPresent(scheduledEnd.map(DateCoding.iso), forKey: .scheduledEnd)
        try c.encode(position, forKey: .position)
        try c.encodeIfPresent(channelId, forKey: .channelId)
        try c.encodeIfPresent(parentId, forKey: .parentId)
        try c.encode(isBacklog, forKey: .isBacklog)
        try c.encodeIfPresent(backlogBucket, forKey: .backlogBucket)
        try c.encodeIfPresent(backlogFolder, forKey: .backlogFolder)
        try c.encodeIfPresent(completedAt.map(DateCoding.iso), forKey: .completedAt)
        try c.encodeIfPresent(updatedAt.map(DateCoding.iso), forKey: .updatedAt)
    }
}

struct RecurringRule: Codable, Hashable {
    var frequency: String // daily | weekly | monthly
    var interval: Int?
    var endDate: String?
    var daysOfWeek: [Int]?
}

struct PlanEvent: Codable, Identifiable, Hashable {
    var id: String
    var title: String
    var description: String?
    var startTime: Date
    var endTime: Date
    var color: String?
    var isRecurring: Bool = false
    var recurringRule: RecurringRule?
    var calendarCategoryId: String?

    init(id: String = UUID().uuidString.lowercased(), title: String, startTime: Date, endTime: Date) {
        self.id = id
        self.title = title
        self.startTime = startTime
        self.endTime = endTime
    }

    private enum CodingKeys: String, CodingKey {
        case id, title, description, startTime, endTime, color, isRecurring, recurringRule, calendarCategoryId
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        title = try c.decodeIfPresent(String.self, forKey: .title) ?? ""
        description = try c.decodeIfPresent(String.self, forKey: .description)
        startTime = try c.decodeFlexibleDate(.startTime) ?? Date()
        endTime = try c.decodeFlexibleDate(.endTime) ?? startTime
        color = try c.decodeIfPresent(String.self, forKey: .color)
        isRecurring = try c.decodeIfPresent(Bool.self, forKey: .isRecurring) ?? false
        recurringRule = try? c.decodeIfPresent(RecurringRule.self, forKey: .recurringRule)
        calendarCategoryId = try c.decodeIfPresent(String.self, forKey: .calendarCategoryId)
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(id, forKey: .id)
        try c.encode(title, forKey: .title)
        try c.encodeIfPresent(description, forKey: .description)
        try c.encode(DateCoding.iso(startTime), forKey: .startTime)
        try c.encode(DateCoding.iso(endTime), forKey: .endTime)
        try c.encodeIfPresent(color, forKey: .color)
        try c.encode(isRecurring, forKey: .isRecurring)
        try c.encodeIfPresent(recurringRule, forKey: .recurringRule)
        try c.encodeIfPresent(calendarCategoryId, forKey: .calendarCategoryId)
    }
}

/// One concrete appearance of an event on the calendar (recurring events expand into many).
struct EventOccurrence: Identifiable, Hashable {
    var event: PlanEvent
    var start: Date
    var end: Date
    var id: String { "\(event.id)_\(Int(start.timeIntervalSince1970))" }
}

struct Channel: Codable, Identifiable, Hashable {
    var id: String
    var name: String
    var color: String
}

struct CalendarCategory: Codable, Identifiable, Hashable {
    var id: String
    var name: String
    var color: String
}

struct Objective: Codable, Identifiable, Hashable {
    var id: String
    var title: String
    /// Monday of the week, `yyyy-MM-dd`.
    var weekStart: String
    var progress: Int = 0

    init(id: String = UUID().uuidString.lowercased(), title: String, weekStart: String) {
        self.id = id
        self.title = title
        self.weekStart = weekStart
    }

    private enum CodingKeys: String, CodingKey { case id, title, weekStart, progress }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        title = try c.decodeIfPresent(String.self, forKey: .title) ?? ""
        weekStart = String((try c.decodeIfPresent(String.self, forKey: .weekStart) ?? "").prefix(10))
        progress = try c.decodeIfPresent(Int.self, forKey: .progress) ?? 0
    }
}

struct Snapshot: Codable {
    var tasks: [PlanTask]
    var events: [PlanEvent]
    var channels: [Channel]
    var calendars: [CalendarCategory]
    var objectives: [Objective]
}

// MARK: - JSON values for queued changes

enum JSONValue: Codable, Hashable {
    case string(String), int(Int), double(Double), bool(Bool), null
    case object([String: JSONValue]), array([JSONValue])

    init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if c.decodeNil() { self = .null }
        else if let v = try? c.decode(Bool.self) { self = .bool(v) }
        else if let v = try? c.decode(Int.self) { self = .int(v) }
        else if let v = try? c.decode(Double.self) { self = .double(v) }
        else if let v = try? c.decode(String.self) { self = .string(v) }
        else if let v = try? c.decode([JSONValue].self) { self = .array(v) }
        else { self = .object(try c.decode([String: JSONValue].self)) }
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.singleValueContainer()
        switch self {
        case .string(let v): try c.encode(v)
        case .int(let v): try c.encode(v)
        case .double(let v): try c.encode(v)
        case .bool(let v): try c.encode(v)
        case .null: try c.encodeNil()
        case .object(let v): try c.encode(v)
        case .array(let v): try c.encode(v)
        }
    }

    static func from(_ value: String?) -> JSONValue { value.map { .string($0) } ?? .null }
    static func from(_ value: Int?) -> JSONValue { value.map { .int($0) } ?? .null }
    static func from(_ value: Date?) -> JSONValue { value.map { .string(DateCoding.iso($0)) } ?? .null }

    static func from<T: Encodable>(encodable value: T?) -> JSONValue {
        guard let value, let data = try? JSONEncoder().encode(value),
              let json = try? JSONDecoder().decode(JSONValue.self, from: data) else { return .null }
        return json
    }
}

// MARK: - Dates

enum DateCoding {
    /// The database stores UTC in `timestamp without time zone`, so values often lack a zone suffix.
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

    /// Local calendar day as `yyyy-MM-dd`.
    static func day(_ date: Date) -> String {
        let c = Calendar.current.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0)
    }

    /// Local midnight of a `yyyy-MM-dd` day.
    static func date(fromDay day: String) -> Date? {
        let parts = day.split(separator: "-").compactMap { Int($0) }
        guard parts.count == 3 else { return nil }
        return Calendar.current.date(from: DateComponents(year: parts[0], month: parts[1], day: parts[2]))
    }

    static func addDays(_ day: String, _ count: Int) -> String {
        guard let date = date(fromDay: day),
              let moved = Calendar.current.date(byAdding: .day, value: count, to: date) else { return day }
        return self.day(moved)
    }

    static func today() -> String { day(Date()) }

    /// Local date for a day plus minutes since midnight.
    static func date(day: String, minutes: Int) -> Date? {
        date(fromDay: day).map { $0.addingTimeInterval(TimeInterval(minutes * 60)) }
    }

    static func minutesOfDay(_ date: Date) -> Int {
        let c = Calendar.current.dateComponents([.hour, .minute], from: date)
        return (c.hour ?? 0) * 60 + (c.minute ?? 0)
    }

    /// Monday of the week containing `day`.
    static func weekStart(_ day: String) -> String {
        guard let date = date(fromDay: day) else { return day }
        let weekday = Calendar.current.component(.weekday, from: date) // 1 = Sunday
        return addDays(day, -((weekday + 5) % 7))
    }
}

extension KeyedDecodingContainer {
    func decodeFlexibleDate(_ key: Key) throws -> Date? {
        DateCoding.parse(try decodeIfPresent(String.self, forKey: key))
    }
}

func formatMinutes(_ minutes: Int) -> String {
    "\(minutes / 60):" + String(format: "%02d", minutes % 60)
}
