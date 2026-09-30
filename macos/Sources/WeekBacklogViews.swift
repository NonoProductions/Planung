import SwiftUI

// MARK: - Week

struct WeekView: View {
    @Environment(AppStore.self) private var store
    @State private var newObjective = ""

    var body: some View {
        let days = (0..<7).map { DateCoding.addDays(store.weekStart, $0) }
        VStack(spacing: 0) {
            objectives
                .padding(.horizontal, 20)
                .padding(.vertical, 14)
            Rectangle().fill(Theme.line).frame(height: 1)
            GeometryReader { geo in
                ScrollView(.horizontal) {
                    HStack(spacing: 0) {
                        ForEach(days, id: \.self) { day in
                            WeekDayColumn(day: day)
                                .frame(width: max(170, geo.size.width / 7))
                            if day != days.last { Rectangle().fill(Theme.lineSoft).frame(width: 1) }
                        }
                    }
                    .frame(minHeight: geo.size.height)
                }
            }
            .background(Theme.board)
        }
        .navigationTitle("Woche")
        .navigationSubtitle(weekTitle(days))
        .toolbar {
            ToolbarItemGroup(placement: .navigation) {
                Button { store.weekStart = DateCoding.addDays(store.weekStart, -7) } label: { Image(systemName: "chevron.left") }
                Button("Diese Woche") { store.weekStart = DateCoding.weekStart(DateCoding.today()) }
                Button { store.weekStart = DateCoding.addDays(store.weekStart, 7) } label: { Image(systemName: "chevron.right") }
            }
        }
    }

    private func weekTitle(_ days: [String]) -> String {
        guard let first = days.first, let last = days.last, let date = DateCoding.date(fromDay: first) else { return "" }
        let week = Calendar(identifier: .iso8601).component(.weekOfYear, from: date)
        return "KW \(week) · \(Fmt.dayDate(first)) – \(Fmt.dayDate(last))"
    }

    private var objectives: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Wochenziele").font(.system(size: 13, weight: .bold)).foregroundStyle(Theme.textSecondary)
            let items = store.objectives(week: store.weekStart)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 10) {
                    ForEach(items) { ObjectiveCard(objective: $0) }
                    HStack {
                        Image(systemName: "plus").foregroundStyle(Theme.textMuted)
                        TextField("Neues Ziel", text: $newObjective)
                            .textFieldStyle(.plain)
                            .onSubmit {
                                let t = newObjective.trimmingCharacters(in: .whitespaces)
                                guard !t.isEmpty else { return }
                                store.addObjective(title: t, week: store.weekStart)
                                newObjective = ""
                            }
                    }
                    .padding(12)
                    .frame(width: 220)
                    .background(Theme.sunken.opacity(0.7), in: RoundedRectangle(cornerRadius: 12))
                }
            }
        }
    }
}

struct ObjectiveCard: View {
    @Environment(AppStore.self) private var store
    let objective: Objective

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(objective.title)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Theme.text)
                    .lineLimit(2)
                Spacer()
                Text("\(objective.progress) %")
                    .font(.caption.weight(.semibold).monospacedDigit())
                    .foregroundStyle(objective.progress >= 100 ? Theme.success : Theme.textSecondary)
            }
            Slider(value: Binding(get: { Double(objective.progress) },
                                  set: { store.updateObjective(objective.id, progress: Int($0)) }), in: 0...100, step: 10)
                .controlSize(.mini)
        }
        .padding(12)
        .frame(width: 240)
        .card()
        .contextMenu {
            Button("Erreicht") { store.updateObjective(objective.id, progress: 100) }
            Button("Löschen", role: .destructive) { store.deleteObjective(objective.id) }
        }
    }
}

struct WeekDayColumn: View {
    @Environment(AppStore.self) private var store
    let day: String
    @State private var targeted = false

    var body: some View {
        let tasks = store.tasks(on: day)
        let isToday = day == DateCoding.today()
        let planned = tasks.reduce(0) { $0 + ($1.plannedTime ?? 0) }

        VStack(alignment: .leading, spacing: 10) {
            Button {
                store.selectedDate = day
                store.section = .today
            } label: {
                VStack(alignment: .leading, spacing: 2) {
                    Text(Fmt.dayTitle(day))
                        .font(.system(size: 15, weight: .bold))
                        .foregroundStyle(isToday ? Theme.accent : Theme.text)
                    HStack {
                        Text(Fmt.dayDate(day))
                        Spacer()
                        if planned > 0 { Text(formatMinutes(planned)).monospacedDigit() }
                    }
                    .font(.caption)
                    .foregroundStyle(Theme.textSecondary)
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .help("Tag öffnen")

            ScrollView {
                VStack(spacing: 6) {
                    ForEach(tasks) { task in
                        TaskCard(task: task, compact: true)
                            .draggable(task.id) { DragPreview(title: task.title) }
                            .dropDestination(for: String.self) { ids, _ in
                                guard let id = ids.first, !id.hasPrefix("event:") else { return false }
                                store.moveTask(id, to: day, before: task.id)
                                return true
                            }
                    }
                    if store.quickAddDate == "week:" + day {
                        QuickAddField(placeholder: "Neuer Task") { title, minutes in
                            store.addTask(title: title, day: day, plannedTime: minutes)
                        }
                    } else {
                        AddTaskButton(title: "Neu") { store.quickAddDate = "week:" + day }
                    }
                }
                .padding(.bottom, 40)
            }
        }
        .padding(12)
        .frame(maxHeight: .infinity, alignment: .top)
        .background(targeted ? Theme.accentLight.opacity(0.6) : (isToday ? Theme.accentLight.opacity(0.25) : .clear))
        .dropDestination(for: String.self) { ids, _ in
            guard let id = ids.first, !id.hasPrefix("event:") else { return false }
            store.moveTask(id, to: day)
            return true
        } isTargeted: { targeted = $0 }
    }
}

// MARK: - Backlog

struct BacklogView: View {
    @Environment(AppStore.self) private var store
    @State private var newFolders: [String] = []
    @State private var folderPrompt = false
    @State private var folderName = ""

    var body: some View {
        let folders = Array(Set(store.backlogFolders + newFolders)).sorted()
        GeometryReader { geo in
            ScrollView(.horizontal) {
                HStack(alignment: .top, spacing: 14) {
                    ForEach(BacklogBucket.allCases) { bucket in
                        BacklogColumn(title: bucket.label, icon: icon(bucket), bucket: bucket, folder: nil)
                    }
                    ForEach(folders, id: \.self) { folder in
                        BacklogColumn(title: folder, icon: "folder", bucket: .someday, folder: folder)
                    }
                }
                .padding(18)
                .frame(minHeight: geo.size.height, alignment: .top)
            }
        }
        .background(Theme.board)
        .navigationTitle("Backlog")
        .navigationSubtitle(store.backlogTasks.count == 1 ? "1 offener Task" : "\(store.backlogTasks.count) offene Tasks")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button { folderName = ""; folderPrompt = true } label: {
                    Label("Neuer Ordner", systemImage: "folder.badge.plus")
                }
            }
        }
        .alert("Neuer Ordner", isPresented: $folderPrompt) {
            TextField("Name", text: $folderName)
            Button("Anlegen") {
                let name = folderName.trimmingCharacters(in: .whitespaces)
                if !name.isEmpty { newFolders.append(name) }
            }
            Button("Abbrechen", role: .cancel) {}
        }
    }

    private func icon(_ bucket: BacklogBucket) -> String {
        switch bucket {
        case .thisWeek: return "flame"
        case .nextWeeks: return "calendar.badge.clock"
        case .someday: return "moon.stars"
        }
    }
}

struct BacklogColumn: View {
    @Environment(AppStore.self) private var store
    let title: String
    let icon: String
    let bucket: BacklogBucket
    let folder: String?
    @State private var targeted = false

    private var key: String { "backlog:" + (folder.map { "folder:" + $0 } ?? bucket.rawValue) }

    var body: some View {
        let tasks = folder.map { store.backlogTasks(folder: $0) } ?? store.backlogTasks(bucket: bucket)
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Label(title, systemImage: icon)
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(Theme.text)
                Spacer()
                Text("\(tasks.count)").font(.caption.weight(.semibold)).foregroundStyle(Theme.textMuted)
            }
            .padding(.horizontal, 4)

            ScrollView {
                VStack(spacing: 8) {
                    if store.quickAddDate == key || (store.quickAddDate == "backlog" && folder == nil && bucket == .someday) {
                        QuickAddField(placeholder: "Idee festhalten …") { title, minutes in
                            store.addTask(title: title, bucket: bucket, folder: folder, plannedTime: minutes)
                        }
                    } else {
                        AddTaskButton { store.quickAddDate = key }
                    }
                    ForEach(tasks) { task in
                        TaskCard(task: task)
                            .draggable(task.id) { DragPreview(title: task.title) }
                            .dropDestination(for: String.self) { ids, _ in
                                guard let id = ids.first, !id.hasPrefix("event:") else { return false }
                                store.moveToBacklog(id, bucket: bucket, folder: folder, before: task.id)
                                return true
                            }
                    }
                }
                .padding(.bottom, 40)
            }
        }
        .padding(12)
        .frame(width: 300)
        .frame(maxHeight: .infinity, alignment: .top)
        .background(targeted ? Theme.accentLight : Theme.sunken.opacity(0.5), in: RoundedRectangle(cornerRadius: 14))
        .dropDestination(for: String.self) { ids, _ in
            guard let id = ids.first, !id.hasPrefix("event:") else { return false }
            store.moveToBacklog(id, bucket: bucket, folder: folder)
            return true
        } isTargeted: { targeted = $0 }
    }
}

// MARK: - Menu bar

struct MenuBarTodayView: View {
    @Environment(AppStore.self) private var store
    @Environment(\.openWindow) private var openWindow
    @State private var newTitle = ""

    var body: some View {
        let today = DateCoding.today()
        let tasks = store.tasks(on: today)
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("Heute").font(.headline)
                Spacer()
                Text("\(tasks.filter(\.isCompleted).count)/\(tasks.count)")
                    .font(.caption.monospacedDigit()).foregroundStyle(.secondary)
            }
            if tasks.isEmpty {
                Text("Noch nichts geplant").foregroundStyle(.secondary).font(.callout)
            }
            ForEach(tasks) { task in
                HStack(spacing: 8) {
                    CheckCircle(done: task.isCompleted, color: Color(hexString: store.channel(task.channelId)?.color), size: 15) {
                        store.toggleComplete(task.id)
                    }
                    Text(task.title)
                        .strikethrough(task.isCompleted)
                        .foregroundStyle(task.isCompleted ? .secondary : .primary)
                        .lineLimit(1)
                    Spacer()
                    if let start = task.scheduledStart {
                        Text(Fmt.time(start)).font(.caption.monospacedDigit()).foregroundStyle(.secondary)
                    }
                }
            }
            TextField("Neuer Task für heute", text: $newTitle)
                .textFieldStyle(.roundedBorder)
                .onSubmit {
                    let t = newTitle.trimmingCharacters(in: .whitespaces)
                    guard !t.isEmpty else { return }
                    store.addTask(title: t, day: today)
                    newTitle = ""
                }
            Divider()
            HStack {
                Button("Planer öffnen") {
                    openWindow(id: "main")
                    NSApp.activate(ignoringOtherApps: true)
                }
                Spacer()
                Button("Beenden") { NSApp.terminate(nil) }
            }
            .buttonStyle(.borderless)
        }
        .padding(14)
        .frame(width: 300)
    }
}
