import SwiftUI

// MARK: - Task detail

struct TaskDetailView: View {
    @Environment(AppStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    let taskId: String
    @State private var newSubtask = ""
    @State private var confirmDelete = false

    var body: some View {
        if let task = store.task(taskId) {
            content(task)
        } else {
            Text("Task wurde gelöscht").padding(40)
                .onAppear { dismiss() }
        }
    }

    private func binding<T>(_ keyPath: WritableKeyPath<PlanTask, T>, fallback: T) -> Binding<T> {
        Binding(get: { store.task(taskId)?[keyPath: keyPath] ?? fallback },
                set: { value in store.updateTask(taskId) { $0[keyPath: keyPath] = value } })
    }

    private func content(_ task: PlanTask) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .top, spacing: 12) {
                CheckCircle(done: task.isCompleted, color: Color(hexString: store.channel(task.channelId)?.color), size: 22) {
                    store.toggleComplete(taskId)
                }
                .padding(.top, 4)
                TextField("Titel", text: binding(\.title, fallback: ""), axis: .vertical)
                    .textFieldStyle(.plain)
                    .font(.system(size: 20, weight: .bold))
                    .foregroundStyle(Theme.text)
            }
            .padding(20)

            Divider()

            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    properties(task)
                    notes
                    if task.parentId == nil { subtasks }
                }
                .padding(20)
            }

            Divider()
            HStack {
                Button(role: .destructive) { confirmDelete = true } label: {
                    Label("Löschen", systemImage: "trash")
                }
                .confirmationDialog("„\(task.title)“ löschen?", isPresented: $confirmDelete) {
                    Button("Löschen", role: .destructive) { store.deleteTask(taskId); dismiss() }
                }
                Spacer()
                Button("Fertig") { dismiss() }
                    .keyboardShortcut(.defaultAction)
                    .buttonStyle(.borderedProminent)
            }
            .padding(16)
        }
        .frame(width: 520, height: 600)
        .background(Theme.card)
    }

    private func properties(_ task: PlanTask) -> some View {
        Grid(alignment: .leadingFirstTextBaseline, horizontalSpacing: 16, verticalSpacing: 12) {
            GridRow {
                label("Datum", "calendar")
                HStack {
                    if task.isBacklog || task.scheduledDate == nil {
                        Picker("", selection: Binding(
                            get: { BacklogBucket(rawValue: task.backlogBucket ?? "") ?? .someday },
                            set: { store.moveToBacklog(taskId, bucket: $0, folder: task.backlogFolder) })) {
                            ForEach(BacklogBucket.allCases) { Text("Backlog · \($0.label)").tag($0) }
                        }
                        .labelsHidden()
                        .fixedSize()
                        Button("Einplanen") { store.moveTask(taskId, to: store.selectedDate) }
                    } else {
                        DatePicker("", selection: Binding(
                            get: { DateCoding.date(fromDay: task.scheduledDate ?? "") ?? Date() },
                            set: { store.moveTask(taskId, to: DateCoding.day($0)) }), displayedComponents: .date)
                            .labelsHidden()
                            .frame(minWidth: 120)
                        Button("In den Backlog") { store.moveToBacklog(taskId) }
                    }
                }
            }
            GridRow {
                label("Zeitblock", "clock")
                timeBlockEditor(task)
            }
            GridRow {
                label("Dauer", "hourglass")
                DurationMenu(minutes: binding(\.plannedTime, fallback: nil))
            }
            if task.parentId == nil {
                GridRow {
                    label("Channel", "number")
                    Picker("", selection: binding(\.channelId, fallback: nil)) {
                        Text("Kein Channel").tag(String?.none)
                        ForEach(store.channels) { channel in
                            Text("#\(channel.name)").tag(String?.some(channel.id))
                        }
                    }
                    .labelsHidden()
                    .fixedSize()
                    .disabled(store.channels.isEmpty)
                }
            }
        }
    }

    @ViewBuilder
    private func timeBlockEditor(_ task: PlanTask) -> some View {
        if let start = task.scheduledStart, let end = task.scheduledEnd {
            HStack(spacing: 6) {
                DatePicker("", selection: Binding(get: { start }, set: { newStart in
                    store.updateTask(taskId) { t in
                        let duration = end.timeIntervalSince(start)
                        t.scheduledStart = newStart
                        t.scheduledEnd = newStart.addingTimeInterval(duration)
                    }
                }), displayedComponents: .hourAndMinute).labelsHidden().fixedSize()
                Text("–")
                DatePicker("", selection: Binding(get: { end }, set: { newEnd in
                    store.updateTask(taskId) { t in t.scheduledEnd = max(newEnd, start.addingTimeInterval(300)) }
                }), displayedComponents: .hourAndMinute).labelsHidden().fixedSize()
                Button { store.updateTask(taskId) { $0.scheduledStart = nil; $0.scheduledEnd = nil } } label: {
                    Image(systemName: "xmark.circle.fill").foregroundStyle(Theme.textMuted)
                }
                .buttonStyle(.plain)
                .help("Zeitblock entfernen")
            }
        } else {
            Button("Uhrzeit festlegen") {
                let day = task.scheduledDate ?? store.selectedDate
                let base = DateCoding.date(fromDay: day) ?? Date()
                var start = base.addingTimeInterval(9 * 3600)
                if day == DateCoding.today() {
                    start = Calendar.current.nextDate(after: Date(), matching: DateComponents(minute: 0), matchingPolicy: .nextTime) ?? start
                }
                store.timeBlock(taskId, start: start)
            }
        }
    }

    private var notes: some View {
        VStack(alignment: .leading, spacing: 6) {
            label("Notizen", "text.alignleft")
            TextEditor(text: Binding(get: { store.task(taskId)?.description ?? "" },
                                     set: { value in store.updateTask(taskId) { $0.description = value.isEmpty ? nil : value } }))
                .font(.system(size: 13))
                .scrollContentBackground(.hidden)
                .padding(8)
                .frame(minHeight: 90)
                .background(Theme.sunken, in: RoundedRectangle(cornerRadius: 8))
        }
    }

    private var subtasks: some View {
        VStack(alignment: .leading, spacing: 8) {
            label("Subtasks", "checklist")
            ForEach(store.subtasks(of: taskId)) { sub in
                HStack(spacing: 10) {
                    CheckCircle(done: sub.isCompleted, color: nil, size: 16) { store.toggleComplete(sub.id) }
                    TextField("Subtask", text: Binding(get: { store.task(sub.id)?.title ?? "" },
                                                       set: { v in store.updateTask(sub.id) { $0.title = v } }))
                        .textFieldStyle(.plain)
                        .strikethrough(sub.isCompleted)
                        .foregroundStyle(sub.isCompleted ? Theme.textMuted : Theme.text)
                    Spacer()
                    Button { store.deleteTask(sub.id) } label: {
                        Image(systemName: "minus.circle").foregroundStyle(Theme.textMuted)
                    }
                    .buttonStyle(.plain)
                }
                .draggable(sub.id)
                .dropDestination(for: String.self) { ids, _ in
                    guard let id = ids.first, store.task(id)?.parentId == taskId else { return false }
                    store.moveSubtask(id, before: sub.id)
                    return true
                }
            }
            HStack(spacing: 10) {
                Image(systemName: "plus").foregroundStyle(Theme.textMuted).frame(width: 16)
                TextField("Subtask hinzufügen", text: $newSubtask)
                    .textFieldStyle(.plain)
                    .onSubmit {
                        let t = newSubtask.trimmingCharacters(in: .whitespaces)
                        guard !t.isEmpty else { return }
                        store.addTask(title: t, parentId: taskId)
                        newSubtask = ""
                    }
            }
        }
    }

    private func label(_ text: String, _ icon: String) -> some View {
        Label(text, systemImage: icon)
            .font(.system(size: 12, weight: .semibold))
            .foregroundStyle(Theme.textSecondary)
    }
}

// MARK: - Event editor

struct EventEditorView: View {
    @Environment(AppStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @State private var event: PlanEvent
    @State private var hasEndDate: Bool
    @State private var confirmDelete = false
    let isNew: Bool

    private static let colors: [(String, String)] = [
        ("#8D7CF6", "Lila"), ("#4F46E5", "Indigo"), ("#10B981", "Grün"), ("#F59E0B", "Orange"),
        ("#E06F6F", "Rot"), ("#3B82F6", "Blau"), ("#EC4899", "Pink"), ("#6B7280", "Grau"),
    ]

    init(draft: EventDraft) {
        _event = State(initialValue: draft.event)
        _hasEndDate = State(initialValue: draft.event.recurringRule?.endDate != nil)
        isNew = draft.isNew
    }

    var body: some View {
        VStack(spacing: 0) {
            TextField("Titel des Termins", text: $event.title)
                .textFieldStyle(.plain)
                .font(.system(size: 20, weight: .bold))
                .padding(20)
            Divider()
            Form {
                DatePicker("Beginn", selection: Binding(get: { event.startTime }, set: { newStart in
                    let duration = event.endTime.timeIntervalSince(event.startTime)
                    event.startTime = newStart
                    event.endTime = newStart.addingTimeInterval(duration)
                }))
                DatePicker("Ende", selection: $event.endTime, in: event.startTime.addingTimeInterval(300)...)

                if !store.calendars.isEmpty {
                    Picker("Kalender", selection: $event.calendarCategoryId) {
                        Text("Keiner").tag(String?.none)
                        ForEach(store.calendars) { Text($0.name).tag(String?.some($0.id)) }
                    }
                }
                Picker("Farbe", selection: $event.color) {
                    Text("Standard").tag(String?.none)
                    ForEach(Self.colors, id: \.0) { hex, name in
                        Label { Text(name) } icon: {
                            Image(systemName: "circle.fill").foregroundStyle(Color(hexString: hex) ?? .gray)
                        }
                        .tag(String?.some(hex))
                    }
                }

                Picker("Wiederholen", selection: Binding(
                    get: { event.isRecurring ? (event.recurringRule?.frequency ?? "none") : "none" },
                    set: { value in
                        if value == "none" {
                            event.isRecurring = false
                            event.recurringRule = nil
                        } else {
                            event.isRecurring = true
                            var rule = event.recurringRule ?? RecurringRule(frequency: value)
                            rule.frequency = value
                            if value != "weekly" { rule.daysOfWeek = nil }
                            event.recurringRule = rule
                        }
                    })) {
                    Text("Nie").tag("none")
                    Text("Täglich").tag("daily")
                    Text("Wöchentlich").tag("weekly")
                    Text("Monatlich").tag("monthly")
                }
                if event.isRecurring, event.recurringRule != nil {
                    Stepper("Alle \(event.recurringRule?.interval ?? 1) \(intervalUnit)",
                            value: Binding(get: { event.recurringRule?.interval ?? 1 },
                                           set: { event.recurringRule?.interval = $0 }), in: 1...30)
                    if event.recurringRule?.frequency == "weekly" { weekdayPicker }
                    Toggle("Endet am", isOn: $hasEndDate)
                    if hasEndDate {
                        DatePicker("Enddatum", selection: Binding(
                            get: { event.recurringRule?.endDate.flatMap { DateCoding.date(fromDay: String($0.prefix(10))) } ?? event.startTime },
                            set: { event.recurringRule?.endDate = DateCoding.day($0) }), displayedComponents: .date)
                    }
                }

                TextField("Notizen", text: Binding(get: { event.description ?? "" },
                                                   set: { event.description = $0.isEmpty ? nil : $0 }), axis: .vertical)
                    .lineLimit(3...6)
            }
            .formStyle(.grouped)
            .scrollContentBackground(.hidden)

            Divider()
            HStack {
                if !isNew {
                    Button(role: .destructive) { confirmDelete = true } label: { Label("Löschen", systemImage: "trash") }
                        .confirmationDialog(event.isRecurring ? "Ganze Serie löschen?" : "Termin löschen?", isPresented: $confirmDelete) {
                            Button("Löschen", role: .destructive) { store.deleteEvent(event.id); dismiss() }
                        }
                }
                Spacer()
                Button("Abbrechen") { dismiss() }
                    .keyboardShortcut(.cancelAction)
                Button("Sichern") { save() }
                    .keyboardShortcut(.defaultAction)
                    .buttonStyle(.borderedProminent)
                    .disabled(event.title.trimmingCharacters(in: .whitespaces).isEmpty)
            }
            .padding(16)
        }
        .frame(width: 480, height: 560)
        .background(Theme.card)
    }

    private var intervalUnit: String {
        let n = event.recurringRule?.interval ?? 1
        switch event.recurringRule?.frequency {
        case "daily": return n == 1 ? "Tag" : "Tage"
        case "weekly": return n == 1 ? "Woche" : "Wochen"
        default: return n == 1 ? "Monat" : "Monate"
        }
    }

    private var weekdayPicker: some View {
        HStack(spacing: 4) {
            Text("An")
            Spacer()
            // Monday first; values are JS weekdays (0 = Sunday).
            ForEach([1, 2, 3, 4, 5, 6, 0], id: \.self) { weekday in
                let selected = event.recurringRule?.daysOfWeek?.contains(weekday) ?? false
                Button(["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"][weekday]) {
                    var days = event.recurringRule?.daysOfWeek ?? []
                    if selected { days.removeAll { $0 == weekday } } else { days.append(weekday) }
                    event.recurringRule?.daysOfWeek = days.isEmpty ? nil : days.sorted()
                }
                .buttonStyle(.plain)
                .font(.caption.weight(.semibold))
                .frame(width: 28, height: 24)
                .background(selected ? Theme.accent : Theme.sunken, in: RoundedRectangle(cornerRadius: 6))
                .foregroundStyle(selected ? .white : Theme.text)
            }
        }
    }

    private func save() {
        var saved = event
        saved.title = saved.title.trimmingCharacters(in: .whitespaces)
        if !hasEndDate { saved.recurringRule?.endDate = nil }
        store.saveEvent(saved)
        dismiss()
    }
}
