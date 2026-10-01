import Foundation
import AppKit
import Network
import Observation

/// A local change waiting to be sent to the server.
struct PendingChange: Codable, Identifiable {
    enum Entity: String, Codable { case task, event, objective }
    enum Kind: String, Codable { case create, update, delete }

    var id = UUID()
    var entity: Entity
    var kind: Kind
    var recordId: String
    var fields: [String: JSONValue] = [:]
}

enum SyncState: Equatable {
    case idle, syncing, offline, error(String)
}

enum AppSection: String, CaseIterable, Identifiable {
    case today, week, backlog
    var id: String { rawValue }
}

enum BacklogBucket: String, CaseIterable, Identifiable {
    case thisWeek = "this_week", nextWeeks = "next_weeks", someday
    var id: String { rawValue }
    var label: String {
        switch self {
        case .thisWeek: return "Diese Woche"
        case .nextWeeks: return "Nächste Wochen"
        case .someday: return "Irgendwann"
        }
    }
}

private struct StoreFile: Codable {
    var tasks: [PlanTask] = []
    var events: [PlanEvent] = []
    var channels: [Channel] = []
    var calendars: [CalendarCategory] = []
    var objectives: [Objective] = []
    var pending: [PendingChange] = []
    var lastSync: Date?
    var email: String?
}

/// Local-first data store: every change is applied to the local copy immediately,
/// saved to disk and queued for the server. Sync sends the queue and then pulls a snapshot.
@MainActor
@Observable
final class AppStore {
    // Data
    var tasks: [PlanTask] = []
    var events: [PlanEvent] = []
    var channels: [Channel] = []
    var calendars: [CalendarCategory] = []
    var objectives: [Objective] = []
    private(set) var pending: [PendingChange] = []

    // Account / sync
    var isLoggedIn: Bool
    var email: String?
    var serverURL: String {
        didSet { UserDefaults.standard.set(serverURL, forKey: "serverURL"); api.baseURL = URL(string: serverURL) }
    }
    private(set) var syncState: SyncState = .idle
    private(set) var lastSync: Date?
    private(set) var isOnline = true
    /// Set by the web view: false after the web app failed to load for network reasons.
    var webReachable = true
    var showOfflineUI: Bool { !isOnline || !webReachable }

    // UI state shared across views
    var section: AppSection = .today
    var selectedDate: String = DateCoding.today()
    var weekStart: String = DateCoding.weekStart(DateCoding.today())
    var quickAddDate: String?
    var editingTaskId: String?
    var editingEvent: EventDraft?
    var showCalendar: Bool = UserDefaults.standard.object(forKey: "showCalendar") as? Bool ?? true {
        didSet { UserDefaults.standard.set(showCalendar, forKey: "showCalendar") }
    }

    @ObservationIgnored let api: APIClient
    /// Called after every sync attempt (also offline), e.g. to mirror the tasks into Apple Reminders.
    @ObservationIgnored var afterSync: (() -> Void)?
    @ObservationIgnored private var inFlightChangeId: UUID?
    @ObservationIgnored private var saveWork: Task<Void, Never>?
    @ObservationIgnored private var syncSoonWork: Task<Void, Never>?
    @ObservationIgnored private var timer: Timer?
    @ObservationIgnored private let monitor = NWPathMonitor()
    @ObservationIgnored private var isSyncing = false

    private static var fileURL: URL { AppPaths.support.appendingPathComponent("store.json") }

    init() {
        let url = UserDefaults.standard.string(forKey: "serverURL") ?? ""
        serverURL = url
        api = APIClient(baseURL: URL(string: url))
        isLoggedIn = api.isLoggedIn
        load()

        monitor.pathUpdateHandler = { [weak self] path in
            Task { @MainActor in
                guard let self else { return }
                let online = path.status == .satisfied
                let cameOnline = online && !self.isOnline
                self.isOnline = online
                if !online { self.syncState = .offline }
                if cameOnline { self.sync() }
            }
        }
        monitor.start(queue: .main)
        // Every 30 s while the app is in front, every 5 min in the background (menu bar,
        // Apple mirroring) to keep database load low. Becoming active syncs right away.
        timer = Timer.scheduledTimer(withTimeInterval: 30, repeats: true) { [weak self] _ in
            Task { @MainActor in
                guard let self else { return }
                if NSApp.isActive || Date().timeIntervalSince(self.lastSync ?? .distantPast) >= 5 * 60 {
                    self.sync()
                }
            }
        }
        sync()
    }

    // MARK: - Account

    func login(server: String, email: String, password: String) async throws {
        var trimmed = server.trimmingCharacters(in: .whitespacesAndNewlines)
        if !trimmed.contains("://") { trimmed = "https://" + trimmed }
        while trimmed.hasSuffix("/") { trimmed.removeLast() }
        guard URL(string: trimmed)?.host != nil else { throw APIError.invalidServerURL }
        serverURL = trimmed

        try await api.login(email: email, password: password)
        if self.email != nil && self.email?.lowercased() != email.lowercased() {
            resetData() // a different account must not inherit the local data
        }
        self.email = email
        isLoggedIn = true
        scheduleSave()
        sync()
    }

    func logout() {
        api.logout()
        isLoggedIn = false
        resetData()
    }

    private func resetData() {
        tasks = []; events = []; channels = []; calendars = []; objectives = []; pending = []
        lastSync = nil; email = nil
        scheduleSave()
    }

    var pendingCount: Int { pending.count }

    // MARK: - Persistence

    private func load() {
        guard let data = try? Data(contentsOf: Self.fileURL),
              let file = try? JSONDecoder().decode(StoreFile.self, from: data) else { return }
        tasks = file.tasks; events = file.events; channels = file.channels
        calendars = file.calendars; objectives = file.objectives; pending = file.pending
        lastSync = file.lastSync; email = file.email
    }

    private func scheduleSave() {
        saveWork?.cancel()
        saveWork = Task { [weak self] in
            try? await Task.sleep(for: .milliseconds(300))
            guard !Task.isCancelled else { return }
            self?.saveNow()
        }
    }

    func saveNow() {
        let file = StoreFile(tasks: tasks, events: events, channels: channels, calendars: calendars,
                             objectives: objectives, pending: pending, lastSync: lastSync, email: email)
        guard let data = try? JSONEncoder().encode(file) else { return }
        try? data.write(to: Self.fileURL, options: .atomic)
    }

    // MARK: - Sync

    func sync() {
        Task { await syncNow() }
    }

    func syncNow() async {
        guard !isSyncing else { return }
        isSyncing = true
        defer { isSyncing = false }
        // The web app's login is enough; it also revives a sync whose token login expired.
        if await api.hasWebSession() { isLoggedIn = true }
        guard isLoggedIn else { return }
        syncState = .syncing
        do {
            try await flush()
            let snapshot = try await api.fetchSnapshot()
            apply(snapshot)
            lastSync = Date()
            syncState = .idle
            scheduleSave()
        } catch APIError.offline {
            syncState = .offline
        } catch APIError.unauthorized, APIError.notLoggedIn {
            isLoggedIn = false
            syncState = .error("Bitte online neu anmelden")
            return
        } catch {
            syncState = .error(error.localizedDescription)
        }
        afterSync?()
    }

    /// Back online: send offline changes first, then reload the (hidden) web app.
    /// The web view flips `webReachable` back once the page has loaded.
    func returnOnline() {
        Task {
            while isSyncing { try? await Task.sleep(for: .milliseconds(200)) }
            await syncNow()
            guard pending.isEmpty || !isLoggedIn else { return }
            WebViewStore.shared.reload()
        }
    }

    /// Syncs shortly after a burst of local edits.
    private func syncSoon() {
        syncSoonWork?.cancel()
        syncSoonWork = Task { [weak self] in
            try? await Task.sleep(for: .seconds(1))
            guard !Task.isCancelled else { return }
            self?.sync()
        }
    }

    private func flush() async throws {
        while let change = pending.first {
            inFlightChangeId = change.id
            defer { inFlightChangeId = nil }
            do {
                try await send(change)
            } catch APIError.server(let code, _) where (400..<500).contains(code) && code != 401 {
                // Rejected for good (e.g. record deleted elsewhere): drop it so the queue can't get stuck.
            }
            pending.removeAll { $0.id == change.id }
            scheduleSave()
        }
    }

    private func send(_ change: PendingChange) async throws {
        let base: String
        switch change.entity {
        case .task: base = "/api/tasks"
        case .event: base = "/api/events"
        case .objective: base = "/api/objectives"
        }
        switch change.kind {
        case .create:
            var body = change.fields
            body["id"] = .string(change.recordId)
            try await api.send("POST", base, body: .object(body))
        case .update:
            try await api.send("PATCH", "\(base)/\(change.recordId)", body: .object(change.fields))
        case .delete:
            try await api.send("DELETE", "\(base)/\(change.recordId)")
        }
    }

    /// Server state wins, then changes that are still queued are replayed on top.
    private func apply(_ snapshot: Snapshot) {
        var next = snapshot
        for change in pending { replay(change, into: &next) }
        tasks = next.tasks
        events = next.events
        channels = next.channels
        calendars = next.calendars
        objectives = next.objectives
    }

    private func replay(_ change: PendingChange, into snapshot: inout Snapshot) {
        switch change.entity {
        case .task: replay(change, records: &snapshot.tasks)
        case .event: replay(change, records: &snapshot.events)
        case .objective: replay(change, records: &snapshot.objectives)
        }
    }

    private func replay<T: Codable & Identifiable>(_ change: PendingChange, records: inout [T]) where T.ID == String {
        switch change.kind {
        case .delete:
            records.removeAll { $0.id == change.recordId }
        case .create, .update:
            var fields = change.fields
            fields["id"] = .string(change.recordId)
            if let index = records.firstIndex(where: { $0.id == change.recordId }) {
                if let merged = merge(records[index], fields) { records[index] = merged }
            } else if change.kind == .create,
                      let data = try? JSONEncoder().encode(JSONValue.object(fields)),
                      let record = try? JSONDecoder().decode(T.self, from: data) {
                records.append(record)
            }
        }
    }

    private func merge<T: Codable>(_ record: T, _ fields: [String: JSONValue]) -> T? {
        guard let data = try? JSONEncoder().encode(record),
              case .object(var object)? = try? JSONDecoder().decode(JSONValue.self, from: data) else { return nil }
        for (key, value) in fields { object[key] = value }
        guard let merged = try? JSONEncoder().encode(JSONValue.object(object)) else { return nil }
        return try? JSONDecoder().decode(T.self, from: merged)
    }

    // MARK: - Queue

    private static let createKeys: [PendingChange.Entity: Set<String>] = [
        .task: ["title", "description", "plannedTime", "scheduledDate", "scheduledStart", "scheduledEnd",
                "position", "channelId", "parentId", "isBacklog", "backlogBucket", "backlogFolder"],
        .event: ["title", "description", "startTime", "endTime", "color", "isRecurring", "recurringRule", "calendarCategoryId"],
        .objective: ["title", "weekStart", "progress"],
    ]

    private func enqueue(_ change: PendingChange) {
        let sameRecord = { (c: PendingChange) in c.entity == change.entity && c.recordId == change.recordId }

        switch change.kind {
        case .delete:
            let hadUnsentCreate = pending.contains { sameRecord($0) && $0.kind == .create && $0.id != inFlightChangeId }
            pending.removeAll { sameRecord($0) && $0.id != inFlightChangeId }
            if !hadUnsentCreate || pending.contains(where: { $0.id == inFlightChangeId && sameRecord($0) }) {
                pending.append(change)
            }
        case .update:
            if let index = pending.lastIndex(where: sameRecord), pending[index].id != inFlightChangeId,
               pending[index].kind == .update
                || (pending[index].kind == .create && Set(change.fields.keys).isSubset(of: Self.createKeys[change.entity] ?? [])) {
                pending[index].fields.merge(change.fields) { _, new in new }
            } else {
                pending.append(change)
            }
        case .create:
            pending.append(change)
        }
        scheduleSave()
        syncSoon()
    }

    // MARK: - Tasks

    func task(_ id: String?) -> PlanTask? {
        guard let id else { return nil }
        return tasks.first { $0.id == id }
    }

    func channel(_ id: String?) -> Channel? {
        guard let id else { return nil }
        return channels.first { $0.id == id }
    }

    func tasks(on day: String) -> [PlanTask] {
        tasks.filter { $0.parentId == nil && !$0.isBacklog && $0.scheduledDate == day }
            .sorted { $0.position < $1.position }
    }

    func subtasks(of id: String) -> [PlanTask] {
        tasks.filter { $0.parentId == id }.sorted { $0.position < $1.position }
    }

    var backlogTasks: [PlanTask] {
        tasks.filter { $0.parentId == nil && $0.isBacklog && !$0.isCompleted }.sorted { $0.position < $1.position }
    }

    var backlogFolders: [String] {
        Array(Set(backlogTasks.compactMap(\.backlogFolder))).sorted()
    }

    func backlogTasks(bucket: BacklogBucket) -> [PlanTask] {
        backlogTasks.filter { $0.backlogFolder == nil && (BacklogBucket(rawValue: $0.backlogBucket ?? "") ?? .someday) == bucket }
    }

    func backlogTasks(folder: String) -> [PlanTask] {
        backlogTasks.filter { $0.backlogFolder == folder }
    }

    @discardableResult
    func addTask(title: String, day: String? = nil, bucket: BacklogBucket? = nil, folder: String? = nil,
                 parentId: String? = nil, plannedTime: Int? = nil, channelId: String? = nil) -> PlanTask {
        var task = PlanTask(title: title)
        task.parentId = parentId
        task.plannedTime = plannedTime
        task.channelId = channelId
        if let parentId {
            task.position = subtasks(of: parentId).count
        } else if let day {
            task.scheduledDate = day
            task.position = (tasks(on: day).map(\.position).max() ?? -1) + 1
        } else {
            task.isBacklog = true
            task.backlogBucket = (bucket ?? .someday).rawValue
            task.backlogFolder = folder
            task.position = (backlogTasks.map(\.position).max() ?? -1) + 1
        }
        task.updatedAt = Date()
        tasks.append(task)
        enqueue(PendingChange(entity: .task, kind: .create, recordId: task.id, fields: Self.fields(of: task)))
        return task
    }

    /// Applies `change` locally and queues exactly the fields that changed.
    func updateTask(_ id: String, _ change: (inout PlanTask) -> Void) {
        guard let index = tasks.firstIndex(where: { $0.id == id }) else { return }
        let old = tasks[index]
        var new = old
        change(&new)
        if new.status != old.status {
            new.completedAt = new.isCompleted ? Date() : nil
        }
        if new != old { new.updatedAt = Date() }
        tasks[index] = new

        let before = Self.fields(of: old), after = Self.fields(of: new)
        var diff = after.filter { before[$0.key] != $0.value }
        if new.status != old.status { diff["status"] = .string(new.status) }
        guard !diff.isEmpty else { return }
        enqueue(PendingChange(entity: .task, kind: .update, recordId: id, fields: diff))

        // The server completes open subtasks together with their parent.
        if new.isCompleted && !old.isCompleted {
            for i in tasks.indices where tasks[i].parentId == id && !tasks[i].isCompleted {
                tasks[i].status = "COMPLETED"
                tasks[i].completedAt = Date()
            }
        }
    }

    func toggleComplete(_ id: String) {
        updateTask(id) { $0.status = $0.isCompleted ? "OPEN" : "COMPLETED" }
    }

    func deleteTask(_ id: String) {
        // The database only nulls parentId of subtasks, so they are deleted explicitly.
        let children = tasks.filter { $0.parentId == id }.map(\.id)
        tasks.removeAll { $0.id == id || $0.parentId == id }
        for child in children { enqueue(PendingChange(entity: .task, kind: .delete, recordId: child)) }
        enqueue(PendingChange(entity: .task, kind: .delete, recordId: id))
        if editingTaskId == id { editingTaskId = nil }
    }

    /// Moves a task onto `day` (keeping its time of day if it has a time block), before `beforeId` or at the end.
    func moveTask(_ id: String, to day: String, before beforeId: String? = nil) {
        guard let task = task(id), id != beforeId else { return }
        var list = tasks(on: day).filter { $0.id != id }
        let insertAt = beforeId.flatMap { b in list.firstIndex { $0.id == b } } ?? list.count
        list.insert(task, at: insertAt)

        updateTask(id) { t in
            if let oldDay = t.scheduledDate, oldDay != day, let start = t.scheduledStart, let end = t.scheduledEnd,
               let from = DateCoding.date(fromDay: oldDay), let to = DateCoding.date(fromDay: day) {
                let shift = to.timeIntervalSince(from)
                t.scheduledStart = start.addingTimeInterval(shift)
                t.scheduledEnd = end.addingTimeInterval(shift)
            }
            t.scheduledDate = day
            t.isBacklog = false
            t.backlogBucket = nil
            t.backlogFolder = nil
        }
        renumber(list.map(\.id))
    }

    func moveToBacklog(_ id: String, bucket: BacklogBucket = .someday, folder: String? = nil, before beforeId: String? = nil) {
        guard task(id) != nil, id != beforeId else { return }
        updateTask(id) { t in
            t.isBacklog = true
            t.backlogBucket = bucket.rawValue
            t.backlogFolder = folder
            t.scheduledDate = nil
            t.scheduledStart = nil
            t.scheduledEnd = nil
        }
        var list = (folder.map { backlogTasks(folder: $0) } ?? backlogTasks(bucket: bucket)).filter { $0.id != id }
        let insertAt = beforeId.flatMap { b in list.firstIndex { $0.id == b } } ?? list.count
        if let moved = task(id) { list.insert(moved, at: insertAt) }
        renumber(list.map(\.id))
    }

    func moveSubtask(_ id: String, before beforeId: String?) {
        guard let parentId = task(id)?.parentId, id != beforeId else { return }
        var list = subtasks(of: parentId).filter { $0.id != id }
        let insertAt = beforeId.flatMap { b in list.firstIndex { $0.id == b } } ?? list.count
        if let moved = task(id) { list.insert(moved, at: insertAt) }
        renumber(list.map(\.id))
    }

    /// Schedules a task into the calendar at `start` (duration: planned time, else 60 min like the web app).
    func timeBlock(_ id: String, start: Date) {
        guard let task = task(id) else { return }
        let minutes = (task.plannedTime ?? 0) > 0 ? task.plannedTime! : 60
        let day = DateCoding.day(start)
        if task.scheduledDate != day || task.isBacklog { moveTask(id, to: day) }
        updateTask(id) { t in
            t.scheduledStart = start
            t.scheduledEnd = start.addingTimeInterval(TimeInterval(minutes * 60))
            t.plannedTime = minutes
        }
    }

    private func renumber(_ ids: [String]) {
        for (position, id) in ids.enumerated() where task(id)?.position != position {
            updateTask(id) { $0.position = position }
        }
    }

    private static func fields(of task: PlanTask) -> [String: JSONValue] {
        [
            "title": .string(task.title),
            "description": .from(task.description),
            "plannedTime": .from(task.plannedTime),
            "scheduledDate": .from(task.scheduledDate),
            "scheduledStart": .from(task.scheduledStart),
            "scheduledEnd": .from(task.scheduledEnd),
            "position": .int(task.position),
            "channelId": .from(task.channelId),
            "parentId": .from(task.parentId),
            "isBacklog": .bool(task.isBacklog),
            "backlogBucket": .from(task.backlogBucket),
            "backlogFolder": .from(task.backlogFolder),
        ]
    }

    // MARK: - Events

    func category(_ id: String?) -> CalendarCategory? {
        guard let id else { return nil }
        return calendars.first { $0.id == id }
    }

    func saveEvent(_ event: PlanEvent) {
        if let index = events.firstIndex(where: { $0.id == event.id }) {
            let before = Self.fields(of: events[index]), after = Self.fields(of: event)
            events[index] = event
            let diff = after.filter { before[$0.key] != $0.value }
            if !diff.isEmpty { enqueue(PendingChange(entity: .event, kind: .update, recordId: event.id, fields: diff)) }
        } else {
            events.append(event)
            enqueue(PendingChange(entity: .event, kind: .create, recordId: event.id, fields: Self.fields(of: event)))
        }
    }

    func deleteEvent(_ id: String) {
        events.removeAll { $0.id == id }
        enqueue(PendingChange(entity: .event, kind: .delete, recordId: id))
    }

    private static func fields(of event: PlanEvent) -> [String: JSONValue] {
        [
            "title": .string(event.title),
            "description": .from(event.description),
            "startTime": .from(event.startTime),
            "endTime": .from(event.endTime),
            "color": .from(event.color),
            "isRecurring": .bool(event.isRecurring),
            "recurringRule": .from(encodable: event.recurringRule),
            "calendarCategoryId": .from(event.calendarCategoryId),
        ]
    }

    func occurrences(on day: String) -> [EventOccurrence] {
        guard let start = DateCoding.date(fromDay: day),
              let end = Calendar.current.date(byAdding: .day, value: 1, to: start) else { return [] }
        return events.flatMap { RecurrenceExpander.occurrences(of: $0, from: start, to: end) }
            .sorted { $0.start < $1.start }
    }

    // MARK: - Objectives

    func objectives(week: String) -> [Objective] {
        objectives.filter { $0.weekStart == week }.sorted { $0.title < $1.title }
    }

    func addObjective(title: String, week: String) {
        let objective = Objective(title: title, weekStart: week)
        objectives.append(objective)
        enqueue(PendingChange(entity: .objective, kind: .create, recordId: objective.id,
                              fields: ["title": .string(title), "weekStart": .string(week), "progress": .int(0)]))
    }

    func updateObjective(_ id: String, title: String? = nil, progress: Int? = nil) {
        guard let index = objectives.firstIndex(where: { $0.id == id }) else { return }
        var fields: [String: JSONValue] = [:]
        if let title, title != objectives[index].title { objectives[index].title = title; fields["title"] = .string(title) }
        if let progress, progress != objectives[index].progress { objectives[index].progress = progress; fields["progress"] = .int(progress) }
        if !fields.isEmpty { enqueue(PendingChange(entity: .objective, kind: .update, recordId: id, fields: fields)) }
    }

    func deleteObjective(_ id: String) {
        objectives.removeAll { $0.id == id }
        enqueue(PendingChange(entity: .objective, kind: .delete, recordId: id))
    }
}

/// Draft for the event editor sheet.
struct EventDraft: Identifiable {
    var event: PlanEvent
    var isNew: Bool
    var id: String { event.id }
}

// MARK: - Recurring events

enum RecurrenceExpander {
    /// Occurrences of `event` overlapping [from, to).
    static func occurrences(of event: PlanEvent, from rangeStart: Date, to rangeEnd: Date) -> [EventOccurrence] {
        let duration = event.endTime.timeIntervalSince(event.startTime)
        func occurrence(_ start: Date) -> EventOccurrence {
            EventOccurrence(event: event, start: start, end: start.addingTimeInterval(duration))
        }
        func overlaps(_ start: Date) -> Bool { start < rangeEnd && start.addingTimeInterval(duration) > rangeStart }

        guard event.isRecurring, let rule = event.recurringRule else {
            return overlaps(event.startTime) ? [occurrence(event.startTime)] : []
        }

        let calendar = Calendar.current
        let interval = max(rule.interval ?? 1, 1)
        var effectiveEnd = rangeEnd
        if let endDay = rule.endDate.map({ String($0.prefix(10)) }), let endDate = DateCoding.date(fromDay: endDay),
           let endOfDay = calendar.date(byAdding: .day, value: 1, to: endDate) {
            effectiveEnd = min(effectiveEnd, endOfDay)
        }
        guard event.startTime < effectiveEnd else { return [] }

        // Iterating from the series start is fine: at most a few thousand steps.
        let searchStart = rangeStart.addingTimeInterval(-duration)
        var results: [EventOccurrence] = []

        if rule.frequency == "weekly", let days = rule.daysOfWeek, !days.isEmpty {
            let seriesWeek = calendar.dateInterval(of: .weekOfYear, for: event.startTime)?.start ?? event.startTime
            let time = calendar.dateComponents([.hour, .minute, .second], from: event.startTime)
            var day = calendar.startOfDay(for: max(searchStart, event.startTime))
            while day < effectiveEnd {
                let weekday = calendar.component(.weekday, from: day) - 1 // 0 = Sunday, like JS
                if days.contains(weekday),
                   let start = calendar.date(bySettingHour: time.hour ?? 0, minute: time.minute ?? 0, second: time.second ?? 0, of: day),
                   start >= event.startTime, start < effectiveEnd, overlaps(start) {
                    let week = calendar.dateInterval(of: .weekOfYear, for: day)?.start ?? day
                    let weeks = calendar.dateComponents([.weekOfYear], from: seriesWeek, to: week).weekOfYear ?? 0
                    if weeks % interval == 0 { results.append(occurrence(start)) }
                }
                guard let next = calendar.date(byAdding: .day, value: 1, to: day) else { break }
                day = next
            }
            return results
        }

        let component: Calendar.Component
        switch rule.frequency {
        case "daily": component = .day
        case "weekly": component = .weekOfYear
        default: component = .month
        }
        var step = 0
        while step < 20_000, let start = calendar.date(byAdding: component, value: step * interval, to: event.startTime),
              start < effectiveEnd {
            if overlaps(start) { results.append(occurrence(start)) }
            step += 1
        }
        return results
    }
}
