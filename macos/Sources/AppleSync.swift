import AppKit
import EventKit
import Foundation
import Observation
import SwiftUI

// Two-way sync between Planung tasks and a "Planung" list in Apple Reminders plus a
// "Planung" calendar in Apple Calendar. Ported from the iOS app (ios/PlanungSync/SyncEngine.swift),
// but it reads and writes the local AppStore instead of the server, so it also works offline;
// the store's queue carries the changes to the server.

/// The fields a reminder and a task have in common. Comparing the task side, the reminder
/// side and the last synced value (base) tells which side changed.
struct ReminderFields: Codable, Equatable {
    var title: String
    var notes: String
    var completed: Bool
    var day: String?
    var minutes: Int?

    init(task: PlanTask) {
        title = task.title
        notes = task.description ?? ""
        completed = task.isCompleted
        if let start = task.scheduledStart {
            day = DateCoding.day(start)
            minutes = DateCoding.minutesOfDay(start)
        } else if !task.isBacklog {
            day = task.scheduledDate
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

/// The fields a calendar event and a time-blocked task have in common.
struct EventFields: Codable, Equatable {
    var title: String
    var start: Int
    var end: Int

    init?(task: PlanTask) {
        guard let start = task.scheduledStart, let end = task.scheduledEnd, end > start else { return nil }
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

struct AppleSyncEntry: Codable {
    var reminderId: String?
    var reminderBase: ReminderFields?
    var eventId: String?
    var eventBase: EventFields?

    var isEmpty: Bool { reminderBase == nil && eventBase == nil }
}

struct AppleSyncState: Codable {
    var reminderListId: String?
    var eventCalendarId: String?
    var entries: [String: AppleSyncEntry] = [:]
}

struct AppleSyncSummary {
    var toApple = 0
    var fromApple = 0
    var imported = 0
    var deleted = 0
    var skippedDeletes = 0

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

enum AppleSyncError: LocalizedError {
    case noReminderAccess, noCalendarAccess

    var errorDescription: String? {
        switch self {
        case .noReminderAccess: return "Kein Zugriff auf Erinnerungen – in Systemeinstellungen › Datenschutz & Sicherheit erlauben"
        case .noCalendarAccess: return "Kein Zugriff auf den Kalender – in Systemeinstellungen › Datenschutz & Sicherheit erlauben"
        }
    }
}

// MARK: - Controller

/// Settings, status and triggers for the Apple sync.
@MainActor
@Observable
final class AppleSync {
    var syncReminders: Bool { didSet { UserDefaults.standard.set(syncReminders, forKey: "syncReminders"); run(reason: "Einstellung geändert") } }
    var syncCalendar: Bool { didSet { UserDefaults.standard.set(syncCalendar, forKey: "syncCalendar"); run(reason: "Einstellung geändert") } }
    private(set) var isRunning = false
    private(set) var lastRun: Date?
    private(set) var lastResult = ""
    private(set) var lastError: String?
    private(set) var logLines: [String] = []

    @ObservationIgnored private let appStore: AppStore
    @ObservationIgnored private lazy var engine = AppleSyncEngine(appStore: appStore) { [weak self] in self?.appendLog($0) }
    @ObservationIgnored private var lastRunEnded = Date.distantPast
    @ObservationIgnored private var pendingRun: Task<Void, Never>?
    @ObservationIgnored private var runRequested = false

    init(appStore: AppStore) {
        self.appStore = appStore
        let defaults = UserDefaults.standard
        // Off until switched on in the settings, so the permission prompts only come when wanted.
        syncReminders = defaults.object(forKey: "syncReminders") as? Bool ?? false
        syncCalendar = defaults.object(forKey: "syncCalendar") as? Bool ?? false
        lastRun = defaults.object(forKey: "appleLastRun") as? Date
        lastResult = defaults.string(forKey: "appleLastResult") ?? ""

        NotificationCenter.default.addObserver(forName: .EKEventStoreChanged, object: nil, queue: .main) { [weak self] _ in
            Task { @MainActor in self?.appleChanged() }
        }
    }

    var isEnabled: Bool { syncReminders || syncCalendar }

    /// Runs after the store has pulled fresh server data, so deletions are judged against the current state.
    func run(reason: String) {
        guard isEnabled, appStore.isLoggedIn, appStore.lastSync != nil else { return }
        guard !isRunning else { runRequested = true; return }
        isRunning = true
        lastError = nil
        Task {
            defer {
                isRunning = false
                lastRunEnded = Date()
                if runRequested {
                    runRequested = false
                    run(reason: reason)
                }
            }
            do {
                let summary = try await engine.run(reminders: syncReminders, calendar: syncCalendar)
                lastRun = Date()
                lastResult = summary.text
                UserDefaults.standard.set(lastRun, forKey: "appleLastRun")
                UserDefaults.standard.set(lastResult, forKey: "appleLastResult")
                if summary.text != "Alles aktuell" || reason != "Automatisch" { appendLog("\(reason): \(summary.text)") }
            } catch {
                lastError = error.localizedDescription
                appendLog("Fehler: \(error.localizedDescription)")
            }
        }
    }

    func reset() {
        engine.reset()
        logLines = []
        lastResult = ""
    }

    /// Edits in Reminders/Calendar. Our own saves fire this too, so right after a run it is ignored.
    private func appleChanged() {
        guard isEnabled, !isRunning, Date().timeIntervalSince(lastRunEnded) > 5 else { return }
        pendingRun?.cancel()
        pendingRun = Task {
            try? await Task.sleep(for: .seconds(2))
            guard !Task.isCancelled else { return }
            run(reason: "Änderung in Apple")
        }
    }

    private func appendLog(_ line: String) {
        let time = Date().formatted(date: .omitted, time: .shortened)
        logLines.insert("\(time)  \(line)", at: 0)
        if logLines.count > 100 { logLines.removeLast(logLines.count - 100) }
    }
}

// MARK: - Engine

/// Every reminder/event carries its task ID in its URL (planung://task/<id>), the same as on
/// the iPhone, so both apps recognise the same items. The last synced state per task is kept
/// locally to decide which side changed; if both changed, the newer edit wins.
@MainActor
final class AppleSyncEngine {
    static let collectionName = "Planung"

    let store = EKEventStore()
    private let appStore: AppStore
    private var state: AppleSyncState
    private let log: (String) -> Void

    /// Skip deletions when more than this share of the paired items vanished at once
    /// (e.g. list deleted, iCloud hiccup) instead of wiping tasks.
    private let deleteSafetyShare = 0.3
    private let deleteSafetyMinimum = 3

    init(appStore: AppStore, log: @escaping (String) -> Void) {
        self.appStore = appStore
        self.log = log
        state = Self.loadState()
    }

    func reset() {
        state = AppleSyncState()
        saveState()
    }

    func run(reminders: Bool, calendar: Bool) async throws -> AppleSyncSummary {
        var summary = AppleSyncSummary()
        if reminders, !(try await store.requestFullAccessToReminders()) { throw AppleSyncError.noReminderAccess }
        if calendar, !(try await store.requestFullAccessToEvents()) { throw AppleSyncError.noCalendarAccess }

        if reminders {
            try await syncReminders(summary: &summary)
            saveState()
        }
        if calendar {
            try syncEvents(summary: &summary)
            saveState()
        }
        let ids = Set(appStore.tasks.map(\.id))
        state.entries = state.entries.filter { ids.contains($0.key) || !$0.value.isEmpty }
        saveState()
        return summary
    }

    /// Top-level tasks keyed by ID, as the sync sees them.
    private func currentTasks() -> [String: PlanTask] {
        Dictionary(appStore.tasks.filter { $0.parentId == nil }.map { ($0.id, $0) }, uniquingKeysWith: { a, _ in a })
    }

    // MARK: Reminders

    private func syncReminders(summary: inout AppleSyncSummary) async throws {
        let list = try collection(for: .reminder)
        let reminders = await fetchReminders(in: list)
        var tasks = currentTasks()

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

        // New reminders become tasks.
        for reminder in unpaired where !(reminder.title ?? "").trimmingCharacters(in: .whitespaces).isEmpty {
            let fields = ReminderFields(reminder: reminder)
            if fields.completed { continue }
            let task = createTask(from: fields)
            reminder.url = Self.url(for: task.id)
            try store.save(reminder, commit: false)
            tasks[task.id] = task
            byTask[task.id] = reminder
            state.entries[task.id, default: AppleSyncEntry()].reminderId = reminder.calendarItemIdentifier
            state.entries[task.id, default: AppleSyncEntry()].reminderBase = fields
            summary.imported += 1
            log("Neu aus Erinnerungen: \(task.title)")
        }

        let pairedCount = state.entries.values.filter { $0.reminderBase != nil }.count
        let vanished = tasks.values.filter { !$0.isCompleted && byTask[$0.id] == nil && state.entries[$0.id]?.reminderBase != nil }
        let orphaned = byTask.filter { tasks[$0.key] == nil && !$0.value.isCompleted }
        let allowTaskDeletes = isSafeToDelete(vanished.count, of: pairedCount)
        let allowReminderDeletes = isSafeToDelete(orphaned.count, of: pairedCount)
        if !allowTaskDeletes { log("⚠️ \(vanished.count) Erinnerungen fehlen – Tasks werden vorsichtshalber nicht gelöscht") }
        if !allowReminderDeletes { log("⚠️ \(orphaned.count) Tasks fehlen – Erinnerungen werden vorsichtshalber nicht gelöscht") }

        for task in Array(tasks.values) {
            var entry = state.entries[task.id] ?? AppleSyncEntry()
            let taskFields = ReminderFields(task: task)

            if let reminder = byTask[task.id] {
                let reminderFields = ReminderFields(reminder: reminder)
                var synced = taskFields

                if taskFields != reminderFields {
                    let reminderChanged = reminderFields != entry.reminderBase
                    let taskChanged = taskFields != entry.reminderBase
                    let reminderWins = reminderChanged
                        && (!taskChanged || (reminder.lastModifiedDate ?? .distantPast) > (task.updatedAt ?? .distantPast))

                    if reminderWins {
                        apply(reminderFields, toTask: task)
                        let updated = appStore.task(task.id) ?? task
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
                // The reminder was deleted in Apple Reminders.
                if !task.isCompleted {
                    guard allowTaskDeletes else { summary.skippedDeletes += 1; continue }
                    appStore.deleteTask(task.id)
                    tasks[task.id] = nil
                    state.entries[task.id] = nil
                    summary.deleted += 1
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

        // Tasks deleted in Planung.
        for (id, reminder) in byTask where tasks[id] == nil {
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
        if let day = fields.day, let midnight = DateCoding.date(fromDay: day) {
            var comps = Calendar.current.dateComponents([.year, .month, .day], from: midnight)
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

    // MARK: Calendar

    private func syncEvents(summary: inout AppleSyncSummary) throws {
        let calendar = try collection(for: .event)
        let windowStart = Date().addingTimeInterval(-30 * 86_400)
        let windowEnd = Date().addingTimeInterval(365 * 86_400)
        let predicate = store.predicateForEvents(withStart: windowStart, end: windowEnd, calendars: [calendar])
        let events = store.events(matching: predicate)
        var tasks = currentTasks()

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

        // New events in the Planung calendar become time-blocked tasks.
        for event in unpaired {
            let fields = EventFields(event: event)
            let task = appStore.addTask(title: fields.title.isEmpty ? "Termin" : fields.title,
                                        day: DateCoding.day(fields.startDate),
                                        plannedTime: max(5, (fields.end - fields.start) / 60))
            appStore.updateTask(task.id) { t in
                t.scheduledStart = fields.startDate
                t.scheduledEnd = fields.endDate
            }
            event.url = Self.url(for: task.id)
            try store.save(event, span: .thisEvent, commit: false)
            tasks[task.id] = appStore.task(task.id)
            byTask[task.id] = event
            state.entries[task.id, default: AppleSyncEntry()].eventId = event.calendarItemIdentifier
            state.entries[task.id, default: AppleSyncEntry()].eventBase = fields
            summary.imported += 1
            log("Neu aus Kalender: \(task.title)")
        }

        let pairedCount = state.entries.values.filter { $0.eventBase != nil }.count
        let orphaned = byTask.filter { tasks[$0.key] == nil }
        let allowEventDeletes = isSafeToDelete(orphaned.count, of: pairedCount)
        if !allowEventDeletes { log("⚠️ \(orphaned.count) Tasks fehlen – Termine werden vorsichtshalber nicht gelöscht") }

        for task in Array(tasks.values) {
            var entry = state.entries[task.id] ?? AppleSyncEntry()
            let taskFields = EventFields(task: task)
            if let taskFields, !inWindow(taskFields) { continue }

            switch (taskFields, byTask[task.id]) {
            case (nil, nil):
                entry.eventId = nil
                entry.eventBase = nil

            case (nil, let event?):
                let eventFields = EventFields(event: event)
                if let base = entry.eventBase, eventFields != base {
                    // Time block removed in Planung, but the event was moved since: keep the event's time.
                    apply(eventFields, toTask: task)
                    entry.eventBase = eventFields
                    summary.fromApple += 1
                    log("← Termin: \(task.title)")
                } else {
                    try store.remove(event, span: .thisEvent, commit: false)
                    entry.eventId = nil
                    entry.eventBase = nil
                    summary.toApple += 1
                    log("Termin entfernt: \(task.title)")
                }

            case (let taskFields?, nil):
                if let base = entry.eventBase, base == taskFields {
                    // The event was deleted in Apple Calendar: drop the time block, keep the day.
                    appStore.updateTask(task.id) { $0.scheduledStart = nil; $0.scheduledEnd = nil }
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
                    let eventWins = eventChanged
                        && (!taskChanged || (event.lastModifiedDate ?? .distantPast) > (task.updatedAt ?? .distantPast))

                    if eventWins {
                        apply(eventFields, toTask: task)
                        synced = appStore.task(task.id).flatMap(EventFields.init(task:)) ?? eventFields
                        summary.fromApple += 1
                        log("← Termin: \(task.title)")
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

        // Tasks deleted in Planung.
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

    // MARK: Changes to Planung tasks

    private func createTask(from fields: ReminderFields) -> PlanTask {
        // Undated reminders land in the backlog, like undated tasks in the web app.
        let task = fields.day.map { appStore.addTask(title: fields.title, day: $0) }
            ?? appStore.addTask(title: fields.title, bucket: .thisWeek)
        appStore.updateTask(task.id) { t in
            t.description = fields.notes.isEmpty ? nil : fields.notes
            if let day = fields.day, let minutes = fields.minutes, let start = DateCoding.date(day: day, minutes: minutes) {
                t.scheduledStart = start
                t.scheduledEnd = start.addingTimeInterval(30 * 60)
                t.plannedTime = 30
            }
        }
        return appStore.task(task.id) ?? task
    }

    /// Applies a reminder edit; only touches what differs from the task.
    private func apply(_ fields: ReminderFields, toTask task: PlanTask) {
        let current = ReminderFields(task: task)
        if fields.day != current.day || fields.minutes != current.minutes {
            if let day = fields.day {
                appStore.moveTask(task.id, to: day)
                appStore.updateTask(task.id) { t in
                    if let minutes = fields.minutes, let start = DateCoding.date(day: day, minutes: minutes) {
                        let duration: TimeInterval
                        if let s = task.scheduledStart, let e = task.scheduledEnd, e > s {
                            duration = e.timeIntervalSince(s)
                        } else {
                            duration = TimeInterval((task.plannedTime ?? 30) * 60)
                        }
                        t.scheduledStart = start
                        t.scheduledEnd = start.addingTimeInterval(duration)
                    } else {
                        t.scheduledStart = nil
                        t.scheduledEnd = nil
                    }
                }
            } else {
                appStore.moveToBacklog(task.id, bucket: .thisWeek)
            }
        }
        appStore.updateTask(task.id) { t in
            t.title = fields.title
            t.description = fields.notes.isEmpty ? nil : fields.notes
            t.status = fields.completed ? "COMPLETED" : (t.isCompleted ? "OPEN" : t.status)
        }
    }

    private func apply(_ fields: EventFields, toTask task: PlanTask) {
        let day = DateCoding.day(fields.startDate)
        if task.scheduledDate != day || task.isBacklog { appStore.moveTask(task.id, to: day) }
        appStore.updateTask(task.id) { t in
            t.title = fields.title
            t.scheduledStart = fields.startDate
            t.scheduledEnd = fields.endDate
        }
    }

    // MARK: Helpers

    /// Finds or creates the "Planung" reminder list / calendar. If a list used before is gone,
    /// pairing bases are dropped so items get recreated instead of their tasks being deleted.
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
            calendar.color = NSColor.systemIndigo
            let defaultSource = type == .reminder
                ? store.defaultCalendarForNewReminders()?.source
                : store.defaultCalendarForNewEvents?.source
            guard let source = defaultSource ?? store.sources.first(where: { $0.sourceType == .local }) else {
                throw type == .reminder ? AppleSyncError.noReminderAccess : AppleSyncError.noCalendarAccess
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

    // MARK: Persistence

    private static var stateURL: URL { AppPaths.support.appendingPathComponent("apple-sync.json") }

    private static func loadState() -> AppleSyncState {
        guard let data = try? Data(contentsOf: stateURL),
              let state = try? JSONDecoder().decode(AppleSyncState.self, from: data) else { return AppleSyncState() }
        return state
    }

    private func saveState() {
        if let data = try? JSONEncoder().encode(state) {
            try? data.write(to: Self.stateURL, options: .atomic)
        }
    }
}

// MARK: - Settings window

struct SettingsView: View {
    @Environment(AppStore.self) private var store
    @Environment(AppleSync.self) private var appleSync

    var body: some View {
        @Bindable var appleSync = appleSync
        Form {
            Section {
                Toggle("Mit Erinnerungen abgleichen", isOn: $appleSync.syncReminders)
                Toggle("Mit Kalender abgleichen", isOn: $appleSync.syncCalendar)
            } header: {
                Text("Apple Erinnerungen & Kalender")
            } footer: {
                Text("Offene Tasks landen in der Erinnerungen-Liste „Planung“, Tasks mit Uhrzeit zusätzlich im Kalender „Planung“. Änderungen gehen in beide Richtungen – auch offline. Dieselben Einträge nutzt die iPhone-App.")
                    .foregroundStyle(.secondary)
            }

            Section("Status") {
                if !store.isLoggedIn {
                    Text("Melde dich zuerst in der App auf der Webseite an.").foregroundStyle(.secondary)
                } else if let error = appleSync.lastError {
                    Label(error, systemImage: "exclamationmark.triangle.fill").foregroundStyle(Theme.danger)
                } else if appleSync.isRunning {
                    HStack { ProgressView().controlSize(.small); Text("Gleiche ab …") }
                } else if let last = appleSync.lastRun {
                    LabeledContent("Zuletzt", value: last.formatted(date: .abbreviated, time: .shortened))
                    LabeledContent("Ergebnis", value: appleSync.lastResult)
                } else {
                    Text(appleSync.isEnabled ? "Noch nicht abgeglichen" : "Aus").foregroundStyle(.secondary)
                }
                Button("Jetzt abgleichen") { store.sync() }
                    .disabled(!appleSync.isEnabled || !store.isLoggedIn || appleSync.isRunning)
            }

            if !appleSync.logLines.isEmpty {
                Section("Protokoll") {
                    ScrollView {
                        VStack(alignment: .leading, spacing: 3) {
                            ForEach(Array(appleSync.logLines.enumerated()), id: \.offset) { _, line in
                                Text(line).font(.caption.monospacedDigit()).textSelection(.enabled)
                            }
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    .frame(height: 140)
                }
            }

            Section("Server") {
                LabeledContent("Adresse", value: store.serverURL.isEmpty ? defaultServerURL : store.serverURL)
                if let email = store.email { LabeledContent("Konto", value: email) }
                Button("Server-Adresse ändern …") { ServerPrompt.run(store: store) }
            }
        }
        .formStyle(.grouped)
        .frame(width: 480)
        .frame(minHeight: 420)
    }
}
