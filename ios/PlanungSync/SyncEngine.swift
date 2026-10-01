import EventKit
import Foundation
import UIKit

/// The fields a reminder and a task have in common. Comparing the task side,
/// the reminder side and the last synced value (base) tells which side changed.
struct ReminderFields: Codable, Equatable {
    var title: String
    var notes: String
    var completed: Bool
    var day: String?
    var minutes: Int?

    init(task: RemoteTask) {
        title = task.title
        notes = task.description ?? ""
        completed = task.isCompleted
        if let start = task.start {
            day = DateCoding.day(start)
            minutes = DateCoding.minutesOfDay(start)
        } else if let date = task.scheduledDate, date.count >= 10 {
            day = String(date.prefix(10))
        }
    }

    init(reminder: EKReminder) {
        title = reminder.title ?? ""
        notes = reminder.notes ?? ""
        completed = reminder.isCompleted
        guard let comps = reminder.dueDateComponents else { return }
        if comps.hour != nil, let date = Calendar.current.date(from: comps) {
            day = DateCoding.day(date)
            minutes = DateCoding.minutesOfDay(date)
        } else if let y = comps.year, let m = comps.month, let d = comps.day {
            day = String(format: "%04d-%02d-%02d", y, m, d)
        }
    }
}

/// The fields a calendar event and a scheduled task have in common.
struct EventFields: Codable, Equatable {
    var title: String
    var start: Int
    var end: Int

    init?(task: RemoteTask) {
        guard let start = task.start, let end = task.end, end > start else { return nil }
        title = task.title
        self.start = Self.minute(start)
        self.end = Self.minute(end)
    }

    init(event: EKEvent) {
        title = event.title ?? ""
        start = Self.minute(event.startDate)
        end = Self.minute(event.endDate)
    }

    var startDate: Date { Date(timeIntervalSince1970: TimeInterval(start)) }
    var endDate: Date { Date(timeIntervalSince1970: TimeInterval(end)) }

    private static func minute(_ date: Date) -> Int {
        Int(date.timeIntervalSince1970 / 60) * 60
    }
}

struct SyncEntry: Codable {
    var reminderId: String?
    var reminderBase: ReminderFields?
    var eventId: String?
    var eventBase: EventFields?

    var isEmpty: Bool { reminderBase == nil && eventBase == nil }
}

struct SyncState: Codable {
    var reminderListId: String?
    var eventCalendarId: String?
    var entries: [String: SyncEntry] = [:]
}

struct SyncSummary {
    var toApple = 0
    var fromApple = 0
    var imported = 0
    var deleted = 0
    var deletedTasks = 0
    var skippedDeletes = 0

    /// Whether tasks on the server changed, so the web view should reload.
    var changedServer: Bool { fromApple > 0 || imported > 0 || deletedTasks > 0 }

    var text: String {
        var parts: [String] = []
        if toApple > 0 { parts.append("\(toApple) → Apple") }
        if fromApple > 0 { parts.append("\(fromApple) ← Apple") }
        if imported > 0 { parts.append("\(imported) neu aus Apple") }
        if deleted > 0 { parts.append("\(deleted) gelöscht") }
        if skippedDeletes > 0 { parts.append("\(skippedDeletes) Löschungen zurückgehalten") }
        return parts.isEmpty ? "Alles aktuell" : parts.joined(separator: ", ")
    }
}

enum SyncError: LocalizedError {
    case noReminderAccess
    case noCalendarAccess

    var errorDescription: String? {
        switch self {
        case .noReminderAccess: return "Kein Zugriff auf Erinnerungen – in den Einstellungen erlauben"
        case .noCalendarAccess: return "Kein Zugriff auf den Kalender – in den Einstellungen erlauben"
        }
    }
}

/// Two-way sync between Planung tasks and a "Planung" list in Apple Reminders
/// plus a "Planung" calendar in Apple Calendar.
///
/// Every reminder/event carries its task ID in its URL (planung://task/<id>),
/// so the pairing survives a reinstall. The last synced state per task is kept
/// locally to decide which side changed; if both changed, the newer edit wins.
@MainActor
final class SyncEngine {
    static let collectionName = "Planung"

    let store = EKEventStore()
    private let api: APIClient
    private var state: SyncState
    private let log: (String) -> Void

    /// Skip deletions when more than this share of the paired items vanished at
    /// once (e.g. list deleted, iCloud hiccup) instead of wiping tasks.
    private let deleteSafetyShare = 0.3
    private let deleteSafetyMinimum = 3

    init(api: APIClient, log: @escaping (String) -> Void) {
        self.api = api
        self.log = log
        state = Self.loadState()
    }

    func reset() {
        state = SyncState()
        saveState()
    }

    func run(reminders: Bool, calendar: Bool) async throws -> SyncSummary {
        var summary = SyncSummary()

        if reminders, !(try await store.requestFullAccessToReminders()) { throw SyncError.noReminderAccess }
        if calendar, !(try await store.requestFullAccessToEvents()) { throw SyncError.noCalendarAccess }

        var tasks = Dictionary(uniqueKeysWithValues: try await api.fetchTasks().map { ($0.id, $0) })

        if reminders {
            try await syncReminders(tasks: &tasks, summary: &summary)
            saveState()
        }
        if calendar {
            try await syncEvents(tasks: &tasks, summary: &summary)
            saveState()
        }

        state.entries = state.entries.filter { tasks[$0.key] != nil || !$0.value.isEmpty }
        saveState()
        return summary
    }

    // MARK: - Reminders

    private func syncReminders(tasks: inout [String: RemoteTask], summary: inout SyncSummary) async throws {
        let list = try collection(for: .reminder)
        let reminders = await fetchReminders(in: list)

        // Pair reminders with tasks.
        var byTask: [String: EKReminder] = [:]
        var unpaired: [EKReminder] = []
        for reminder in reminders {
            if let id = Self.taskId(of: reminder) ?? pairedTaskId(reminderId: reminder.calendarItemIdentifier) {
                if byTask[id] == nil {
                    byTask[id] = reminder
                    if Self.taskId(of: reminder) == nil {
                        reminder.url = Self.url(for: id)
                        try store.save(reminder, commit: false)
                    }
                }
            } else {
                unpaired.append(reminder)
            }
        }

        // New reminders created on the iPhone become tasks.
        for reminder in unpaired where !(reminder.title ?? "").trimmingCharacters(in: .whitespaces).isEmpty {
            let fields = ReminderFields(reminder: reminder)
            if fields.completed { continue }
            let task = try await api.createTask(Self.createBody(fields))
            reminder.url = Self.url(for: task.id)
            try store.save(reminder, commit: false)
            tasks[task.id] = task
            byTask[task.id] = reminder
            state.entries[task.id, default: SyncEntry()].reminderId = reminder.calendarItemIdentifier
            state.entries[task.id, default: SyncEntry()].reminderBase = fields
            summary.imported += 1
            log("Neu aus Erinnerungen: \(task.title)")
        }

        let pairedCount = state.entries.values.filter { $0.reminderBase != nil }.count
        let vanished = tasks.values.filter { !$0.isCompleted && byTask[$0.id] == nil && state.entries[$0.id]?.reminderBase != nil }
        // Only items paired on this device count as deleted: an item pointing to a task we
        // have never seen comes from another device whose task hasn't reached us yet.
        let orphaned = byTask.filter { tasks[$0.key] == nil && !$0.value.isCompleted && state.entries[$0.key]?.reminderBase != nil }
        let allowTaskDeletes = isSafeToDelete(vanished.count, of: pairedCount)
        let allowReminderDeletes = isSafeToDelete(orphaned.count, of: pairedCount)
        if !allowTaskDeletes { log("⚠️ \(vanished.count) Erinnerungen fehlen – Tasks werden vorsichtshalber nicht gelöscht") }
        if !allowReminderDeletes { log("⚠️ \(orphaned.count) Tasks fehlen – Erinnerungen werden vorsichtshalber nicht gelöscht") }

        for task in Array(tasks.values) {
            var entry = state.entries[task.id] ?? SyncEntry()
            let taskFields = ReminderFields(task: task)

            if let reminder = byTask[task.id] {
                let reminderFields = ReminderFields(reminder: reminder)
                var synced = taskFields

                if taskFields != reminderFields {
                    let reminderChanged = reminderFields != entry.reminderBase
                    let taskChanged = taskFields != entry.reminderBase
                    let reminderWins = reminderChanged && (!taskChanged || (reminder.lastModifiedDate ?? .distantPast) > task.updated)

                    if reminderWins {
                        let updated = try await api.updateTask(task.id, Self.updateBody(from: reminderFields, task: task))
                        tasks[task.id] = updated
                        synced = ReminderFields(task: updated)
                        if synced != reminderFields { try apply(synced, to: reminder) }
                        summary.fromApple += 1
                        log("← \(updated.title)")
                    } else {
                        try apply(taskFields, to: reminder)
                        summary.toApple += 1
                        log("→ \(task.title)")
                    }
                }
                entry.reminderId = reminder.calendarItemIdentifier
                entry.reminderBase = synced
            } else if entry.reminderBase != nil {
                // The reminder was deleted on the iPhone.
                if !task.isCompleted {
                    guard allowTaskDeletes else { summary.skippedDeletes += 1; continue }
                    try await api.deleteTask(task.id)
                    tasks[task.id] = nil
                    state.entries[task.id] = nil
                    summary.deleted += 1
                    summary.deletedTasks += 1
                    log("Gelöscht (Erinnerung entfernt): \(task.title)")
                    continue
                }
                entry.reminderId = nil
                entry.reminderBase = nil
            } else if !task.isCompleted {
                let reminder = EKReminder(eventStore: store)
                reminder.calendar = list
                reminder.url = Self.url(for: task.id)
                try apply(taskFields, to: reminder)
                entry.reminderId = reminder.calendarItemIdentifier
                entry.reminderBase = taskFields
                summary.toApple += 1
                log("→ neu: \(task.title)")
            }
            state.entries[task.id] = entry
        }

        // Tasks deleted in the web app.
        for (id, reminder) in byTask where tasks[id] == nil && state.entries[id]?.reminderBase != nil {
            if !reminder.isCompleted {
                guard allowReminderDeletes else { summary.skippedDeletes += 1; continue }
                try store.remove(reminder, commit: false)
                summary.deleted += 1
                log("Erinnerung entfernt: \(reminder.title ?? "")")
            }
            state.entries[id]?.reminderId = nil
            state.entries[id]?.reminderBase = nil
        }

        try store.commit()
    }

    private func apply(_ fields: ReminderFields, to reminder: EKReminder) throws {
        reminder.title = fields.title
        reminder.notes = fields.notes.isEmpty ? nil : fields.notes
        reminder.isCompleted = fields.completed

        for alarm in reminder.alarms ?? [] { reminder.removeAlarm(alarm) }
        if let day = fields.day, var comps = DateCoding.dayComponents(day) {
            if let minutes = fields.minutes {
                comps.hour = minutes / 60
                comps.minute = minutes % 60
                comps.timeZone = .current
                if let date = Calendar.current.date(from: comps) {
                    reminder.addAlarm(EKAlarm(absoluteDate: date))
                }
            }
            reminder.dueDateComponents = comps
        } else {
            reminder.dueDateComponents = nil
        }
        try store.save(reminder, commit: false)
    }

    private func fetchReminders(in list: EKCalendar) async -> [EKReminder] {
        let predicate = store.predicateForReminders(in: [list])
        return await withCheckedContinuation { continuation in
            store.fetchReminders(matching: predicate) { continuation.resume(returning: $0 ?? []) }
        }
    }

    private func pairedTaskId(reminderId: String) -> String? {
        state.entries.first { $0.value.reminderId == reminderId }?.key
    }

    // MARK: - Calendar

    private func syncEvents(tasks: inout [String: RemoteTask], summary: inout SyncSummary) async throws {
        let calendar = try collection(for: .event)
        let windowStart = Date().addingTimeInterval(-30 * 86_400)
        let windowEnd = Date().addingTimeInterval(365 * 86_400)
        let predicate = store.predicateForEvents(withStart: windowStart, end: windowEnd, calendars: [calendar])
        let events = store.events(matching: predicate)

        func inWindow(_ fields: EventFields) -> Bool {
            fields.endDate > windowStart && fields.startDate < windowEnd
        }

        var byTask: [String: EKEvent] = [:]
        var unpaired: [EKEvent] = []
        var seen = Set<String>()
        for event in events {
            // Recurring events show up once per occurrence; only handle the first.
            guard seen.insert(event.calendarItemIdentifier).inserted else { continue }
            if let id = Self.taskId(of: event) ?? pairedTaskId(eventId: event.calendarItemIdentifier) {
                if byTask[id] == nil { byTask[id] = event }
            } else if !event.isAllDay {
                unpaired.append(event)
            }
        }

        // New events created in the Planung calendar become scheduled tasks.
        for event in unpaired {
            let fields = EventFields(event: event)
            let task = try await api.createTask([
                "title": fields.title.isEmpty ? "Termin" : fields.title,
                "scheduledDate": DateCoding.day(fields.startDate),
                "scheduledStart": DateCoding.iso(fields.startDate),
                "scheduledEnd": DateCoding.iso(fields.endDate),
                "plannedTime": max(5, (fields.end - fields.start) / 60),
            ])
            event.url = Self.url(for: task.id)
            try store.save(event, span: .thisEvent, commit: false)
            tasks[task.id] = task
            byTask[task.id] = event
            state.entries[task.id, default: SyncEntry()].eventId = event.calendarItemIdentifier
            state.entries[task.id, default: SyncEntry()].eventBase = fields
            summary.imported += 1
            log("Neu aus Kalender: \(task.title)")
        }

        let pairedCount = state.entries.values.filter { $0.eventBase != nil }.count
        let orphaned = byTask.filter { tasks[$0.key] == nil && state.entries[$0.key]?.eventBase != nil }
        let allowEventDeletes = isSafeToDelete(orphaned.count, of: pairedCount)
        if !allowEventDeletes { log("⚠️ \(orphaned.count) Tasks fehlen – Termine werden vorsichtshalber nicht gelöscht") }

        for task in Array(tasks.values) {
            var entry = state.entries[task.id] ?? SyncEntry()
            let taskFields = EventFields(task: task)
            if let taskFields, !inWindow(taskFields) { continue }

            switch (taskFields, byTask[task.id]) {
            case (nil, nil):
                entry.eventId = nil
                entry.eventBase = nil

            case (nil, let event?):
                let eventFields = EventFields(event: event)
                if let base = entry.eventBase, eventFields != base {
                    // Task was unscheduled in the web app, but the event was moved since: keep the event's time.
                    let updated = try await api.updateTask(task.id, Self.updateBody(from: eventFields))
                    tasks[task.id] = updated
                    entry.eventBase = eventFields
                    summary.fromApple += 1
                    log("← Termin: \(updated.title)")
                } else {
                    try store.remove(event, span: .thisEvent, commit: false)
                    entry.eventId = nil
                    entry.eventBase = nil
                    summary.toApple += 1
                    log("Termin entfernt: \(task.title)")
                }

            case (let taskFields?, nil):
                if let base = entry.eventBase, base == taskFields {
                    // The event was deleted in Apple Calendar: unschedule the task, keep its day.
                    let updated = try await api.updateTask(task.id, ["scheduledStart": NSNull(), "scheduledEnd": NSNull()])
                    tasks[task.id] = updated
                    entry.eventId = nil
                    entry.eventBase = nil
                    summary.fromApple += 1
                    log("Zeit entfernt (Termin gelöscht): \(task.title)")
                } else {
                    let event = EKEvent(eventStore: store)
                    event.calendar = calendar
                    event.url = Self.url(for: task.id)
                    try apply(taskFields, to: event)
                    entry.eventId = event.calendarItemIdentifier
                    entry.eventBase = taskFields
                    summary.toApple += 1
                    log("→ Termin neu: \(task.title)")
                }

            case (let taskFields?, let event?):
                let eventFields = EventFields(event: event)
                var synced = taskFields
                if taskFields != eventFields {
                    let eventChanged = eventFields != entry.eventBase
                    let taskChanged = taskFields != entry.eventBase
                    let eventWins = eventChanged && (!taskChanged || (event.lastModifiedDate ?? .distantPast) > task.updated)

                    if eventWins {
                        let updated = try await api.updateTask(task.id, Self.updateBody(from: eventFields))
                        tasks[task.id] = updated
                        synced = EventFields(task: updated) ?? eventFields
                        summary.fromApple += 1
                        log("← Termin: \(updated.title)")
                    } else {
                        try apply(taskFields, to: event)
                        summary.toApple += 1
                        log("→ Termin: \(task.title)")
                    }
                }
                if event.url == nil {
                    event.url = Self.url(for: task.id)
                    try store.save(event, span: .thisEvent, commit: false)
                }
                entry.eventId = event.calendarItemIdentifier
                entry.eventBase = synced
            }
            state.entries[task.id] = entry
        }

        // Tasks deleted in the web app.
        for (id, event) in orphaned {
            guard allowEventDeletes else { summary.skippedDeletes += 1; continue }
            try store.remove(event, span: .thisEvent, commit: false)
            state.entries[id]?.eventId = nil
            state.entries[id]?.eventBase = nil
            summary.deleted += 1
            log("Termin entfernt: \(event.title ?? "")")
        }

        try store.commit()
    }

    private func apply(_ fields: EventFields, to event: EKEvent) throws {
        event.title = fields.title
        event.startDate = fields.startDate
        event.endDate = fields.endDate
        try store.save(event, span: .thisEvent, commit: false)
    }

    private func pairedTaskId(eventId: String) -> String? {
        state.entries.first { $0.value.eventId == eventId }?.key
    }

    // MARK: - Helpers

    /// Finds or creates the "Planung" reminder list / calendar. If a list we used
    /// before is gone, pairing bases are dropped so items get recreated instead of
    /// their tasks being deleted.
    private func collection(for type: EKEntityType) throws -> EKCalendar {
        let storedId = type == .reminder ? state.reminderListId : state.eventCalendarId
        if let storedId, let existing = store.calendar(withIdentifier: storedId) { return existing }

        if storedId != nil {
            for key in state.entries.keys {
                if type == .reminder {
                    state.entries[key]?.reminderId = nil
                    state.entries[key]?.reminderBase = nil
                } else {
                    state.entries[key]?.eventId = nil
                    state.entries[key]?.eventBase = nil
                }
            }
        }

        let calendar: EKCalendar
        if let existing = store.calendars(for: type).first(where: { $0.title == Self.collectionName && $0.allowsContentModifications }) {
            calendar = existing
        } else {
            calendar = EKCalendar(for: type, eventStore: store)
            calendar.title = Self.collectionName
            calendar.cgColor = UIColor.systemIndigo.cgColor
            let defaultSource = type == .reminder
                ? store.defaultCalendarForNewReminders()?.source
                : store.defaultCalendarForNewEvents?.source
            guard let source = defaultSource ?? store.sources.first(where: { $0.sourceType == .local }) else {
                throw type == .reminder ? SyncError.noReminderAccess : SyncError.noCalendarAccess
            }
            calendar.source = source
            try store.saveCalendar(calendar, commit: true)
            log("\(type == .reminder ? "Liste" : "Kalender") „\(Self.collectionName)“ angelegt")
        }

        if type == .reminder { state.reminderListId = calendar.calendarIdentifier } else { state.eventCalendarId = calendar.calendarIdentifier }
        return calendar
    }

    private func isSafeToDelete(_ count: Int, of paired: Int) -> Bool {
        count <= deleteSafetyMinimum || Double(count) <= Double(paired) * deleteSafetyShare
    }

    private static func url(for taskId: String) -> URL {
        URL(string: "planung://task/\(taskId)")!
    }

    private static func taskId(of item: EKCalendarItem) -> String? {
        guard let url = item.url, url.scheme == "planung", url.host == "task" else { return nil }
        let id = url.lastPathComponent
        return id.isEmpty || id == "/" ? nil : id
    }

    private static func createBody(_ fields: ReminderFields) -> [String: Any] {
        var body: [String: Any] = ["title": fields.title]
        if !fields.notes.isEmpty { body["description"] = fields.notes }
        if let day = fields.day {
            body["scheduledDate"] = day
            if let minutes = fields.minutes, let start = DateCoding.date(day: day, minutes: minutes) {
                body["scheduledStart"] = DateCoding.iso(start)
                body["scheduledEnd"] = DateCoding.iso(start.addingTimeInterval(30 * 60))
                body["plannedTime"] = 30
            }
        } else {
            // Undated reminders land in the backlog, like undated tasks in the web app.
            body["isBacklog"] = true
            body["backlogBucket"] = "this_week"
        }
        return body
    }

    /// PATCH body for a reminder edit; only sends what differs from the task.
    private static func updateBody(from fields: ReminderFields, task: RemoteTask) -> [String: Any] {
        let current = ReminderFields(task: task)
        var body: [String: Any] = [:]
        if fields.title != current.title { body["title"] = fields.title }
        if fields.notes != current.notes { body["description"] = fields.notes.isEmpty ? NSNull() : fields.notes }
        if fields.completed != current.completed { body["status"] = fields.completed ? "COMPLETED" : "OPEN" }

        if fields.day != current.day || fields.minutes != current.minutes {
            if let day = fields.day, let minutes = fields.minutes, let start = DateCoding.date(day: day, minutes: minutes) {
                let duration: TimeInterval
                if let s = task.start, let e = task.end, e > s {
                    duration = e.timeIntervalSince(s)
                } else {
                    duration = TimeInterval((task.plannedTime ?? 30) * 60)
                }
                body["scheduledDate"] = day
                body["scheduledStart"] = DateCoding.iso(start)
                body["scheduledEnd"] = DateCoding.iso(start.addingTimeInterval(duration))
                body["isBacklog"] = false
            } else if let day = fields.day {
                body["scheduledDate"] = day
                body["scheduledStart"] = NSNull()
                body["scheduledEnd"] = NSNull()
                body["isBacklog"] = false
            } else {
                body["scheduledDate"] = NSNull()
                body["scheduledStart"] = NSNull()
                body["scheduledEnd"] = NSNull()
                body["isBacklog"] = true
                body["backlogBucket"] = "this_week"
            }
        }
        return body
    }

    private static func updateBody(from fields: EventFields) -> [String: Any] {
        [
            "title": fields.title,
            "scheduledDate": DateCoding.day(fields.startDate),
            "scheduledStart": DateCoding.iso(fields.startDate),
            "scheduledEnd": DateCoding.iso(fields.endDate),
            "isBacklog": false,
        ]
    }

    // MARK: - Persistence

    private static var stateURL: URL {
        let dir = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir.appendingPathComponent("sync-state.json")
    }

    private static func loadState() -> SyncState {
        guard let data = try? Data(contentsOf: stateURL),
              let state = try? JSONDecoder().decode(SyncState.self, from: data) else { return SyncState() }
        return state
    }

    private func saveState() {
        if let data = try? JSONEncoder().encode(state) {
            try? data.write(to: Self.stateURL, options: .atomic)
        }
    }
}
