import SwiftUI

struct TodayView: View {
    @Environment(AppStore.self) private var store

    var body: some View {
        HStack(spacing: 0) {
            HStack(spacing: 0) {
                DayColumn(day: store.selectedDate)
                Rectangle().fill(Theme.lineSoft).frame(width: 1)
                DayColumn(day: DateCoding.addDays(store.selectedDate, 1))
            }
            .background(Theme.board)

            if store.showCalendar {
                Rectangle().fill(Theme.line).frame(width: 1)
                DayCalendarView(day: store.selectedDate)
                    .frame(width: 360)
                    .transition(.move(edge: .trailing).combined(with: .opacity))
            }
        }
        .animation(.easeInOut(duration: 0.2), value: store.showCalendar)
        .toolbar { DayToolbar() }
        .navigationTitle(Fmt.relativeDay(store.selectedDate))
        .navigationSubtitle(Fmt.dayDate(store.selectedDate))
    }
}

struct DayToolbar: ToolbarContent {
    @Environment(AppStore.self) private var store

    var body: some ToolbarContent {
        ToolbarItemGroup(placement: .navigation) {
            Button { store.selectedDate = DateCoding.addDays(store.selectedDate, -1) } label: {
                Image(systemName: "chevron.left")
            }
            .help("Vorheriger Tag (⌘[)")
            Button("Heute") { store.selectedDate = DateCoding.today() }
                .help("Zu heute springen (⌘T)")
            Button { store.selectedDate = DateCoding.addDays(store.selectedDate, 1) } label: {
                Image(systemName: "chevron.right")
            }
            .help("Nächster Tag (⌘])")
        }
        ToolbarItemGroup(placement: .primaryAction) {
            Button { store.quickAddDate = store.selectedDate } label: {
                Label("Neuer Task", systemImage: "plus")
            }
            .help("Neuer Task (⌘N)")
            Button { store.showCalendar.toggle() } label: {
                Label("Kalender", systemImage: store.showCalendar ? "sidebar.right" : "calendar.day.timeline.left")
            }
            .help("Kalender ein-/ausblenden (⌘K)")
        }
    }
}

// MARK: - Day column

struct DayColumn: View {
    @Environment(AppStore.self) private var store
    let day: String
    @State private var dropTargeted = false

    var body: some View {
        let tasks = store.tasks(on: day)
        VStack(alignment: .leading, spacing: 0) {
            header(tasks)
                .padding(.horizontal, 20)
                .padding(.top, 18)
                .padding(.bottom, 12)

            ScrollView {
                LazyVStack(spacing: 8) {
                    if store.quickAddDate == day {
                        QuickAddField(placeholder: "Was steht an?") { title, minutes in
                            store.addTask(title: title, day: day, plannedTime: minutes)
                        }
                    } else {
                        AddTaskButton { store.quickAddDate = day }
                    }

                    ForEach(tasks) { task in
                        TaskCard(task: task)
                            .draggable(task.id) { DragPreview(title: task.title) }
                            .dropDestination(for: String.self) { ids, _ in
                                guard let id = ids.first, !id.hasPrefix("event:") else { return false }
                                store.moveTask(id, to: day, before: task.id)
                                return true
                            }
                    }

                    if tasks.isEmpty && store.quickAddDate != day {
                        Text("Noch nichts geplant")
                            .font(.callout)
                            .foregroundStyle(Theme.textMuted)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 28)
                    }
                    Color.clear.frame(height: 80)
                }
                .padding(.horizontal, 16)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(dropTargeted ? Theme.accentLight.opacity(0.6) : .clear)
        .dropDestination(for: String.self) { ids, _ in
            guard let id = ids.first, !id.hasPrefix("event:") else { return false }
            store.moveTask(id, to: day)
            return true
        } isTargeted: { dropTargeted = $0 }
    }

    private func header(_ tasks: [PlanTask]) -> some View {
        let planned = tasks.reduce(0) { $0 + ($1.plannedTime ?? 0) }
        let isToday = day == DateCoding.today()
        return VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .firstTextBaseline) {
                Text(Fmt.dayTitle(day))
                    .font(.system(size: 22, weight: .bold))
                    .foregroundStyle(isToday ? Theme.accent : Theme.text)
                Text(Fmt.dayDate(day))
                    .font(.system(size: 13, weight: .medium))
                    .foregroundStyle(Theme.textSecondary)
                Spacer()
                if planned > 0 {
                    Label(formatMinutes(planned), systemImage: "clock")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(Theme.textSecondary)
                }
            }
            ProgressBar(value: dayProgress(tasks))
        }
    }

    /// Weighted by planned time like the web app (30 min per unit when unplanned).
    private func dayProgress(_ tasks: [PlanTask]) -> Double {
        var done = 0.0, total = 0.0
        for task in tasks {
            let subs = store.subtasks(of: task.id)
            let units = Double(1 + subs.count)
            let completed = Double((task.isCompleted ? 1 : 0) + subs.filter(\.isCompleted).count)
            let weight = Double((task.plannedTime ?? 0) > 0 ? task.plannedTime! : 30 * Int(units))
            total += weight
            done += weight * completed / units
        }
        return total == 0 ? 0 : done / total
    }
}

struct ProgressBar: View {
    var value: Double
    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .leading) {
                Capsule().fill(Theme.sunken)
                Capsule().fill(value >= 1 ? Theme.success : Theme.accent)
                    .frame(width: max(0, min(1, value)) * geo.size.width)
            }
        }
        .frame(height: 4)
        .animation(.easeOut(duration: 0.25), value: value)
    }
}

struct AddTaskButton: View {
    var title = "Task hinzufügen"
    var action: () -> Void
    @State private var hovering = false

    var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                Image(systemName: "plus")
                Text(title).lineLimit(1)
                Spacer(minLength: 0)
            }
            .font(.system(size: 13, weight: .medium))
            .foregroundStyle(hovering ? Theme.accent : Theme.textSecondary)
            .padding(.horizontal, 12)
            .padding(.vertical, 10)
            .background(hovering ? Theme.accentLight : Theme.sunken.opacity(0.6), in: RoundedRectangle(cornerRadius: 10))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .onHover { hovering = $0 }
    }
}

/// Inline title field; Enter adds and keeps the field open for the next task, Esc closes it.
struct QuickAddField: View {
    @Environment(AppStore.self) private var store
    var placeholder: String
    var onAdd: (String, Int?) -> Void
    @State private var title = ""
    @State private var minutes: Int?
    @FocusState private var focused: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            TextField(placeholder, text: $title)
                .textFieldStyle(.plain)
                .font(.system(size: 14, weight: .medium))
                .focused($focused)
                .onSubmit(submit)
                .onExitCommand { store.quickAddDate = nil }
            HStack(spacing: 6) {
                DurationMenu(minutes: $minutes)
                Spacer()
                Button("Abbrechen") { store.quickAddDate = nil }
                    .buttonStyle(.plain)
                    .foregroundStyle(Theme.textSecondary)
                Button("Hinzufügen", action: submit)
                    .buttonStyle(.borderedProminent)
                    .controlSize(.small)
                    .disabled(title.trimmingCharacters(in: .whitespaces).isEmpty)
            }
            .font(.caption)
        }
        .padding(12)
        .card(highlighted: true)
        .onAppear { focused = true }
    }

    private func submit() {
        let trimmed = title.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else { store.quickAddDate = nil; return }
        onAdd(trimmed, minutes)
        title = ""
        minutes = nil
        focused = true
    }
}

struct DurationMenu: View {
    @Binding var minutes: Int?
    static let options = [5, 10, 15, 20, 30, 45, 60, 90, 120, 180, 240]

    var body: some View {
        Menu {
            Button("Keine") { minutes = nil }
            Divider()
            ForEach(Self.options, id: \.self) { m in
                Button(formatMinutes(m)) { minutes = m }
            }
        } label: {
            Label(minutes.map(formatMinutes) ?? "Dauer", systemImage: "clock")
        }
        .menuStyle(.borderlessButton)
        .fixedSize()
    }
}

struct DragPreview: View {
    let title: String
    var body: some View {
        Text(title)
            .font(.system(size: 13, weight: .medium))
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(Theme.card, in: RoundedRectangle(cornerRadius: 8))
            .overlay(RoundedRectangle(cornerRadius: 8).stroke(Theme.accent))
    }
}

// MARK: - Task card

struct TaskCard: View {
    @Environment(AppStore.self) private var store
    let task: PlanTask
    var compact = false
    @State private var hovering = false
    @State private var expanded = false
    @State private var newSubtask = ""

    var body: some View {
        let subtasks = store.subtasks(of: task.id)
        let channel = store.channel(task.channelId)

        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .top, spacing: 10) {
                CheckCircle(done: task.isCompleted, color: Color(hexString: channel?.color)) {
                    withAnimation(.easeOut(duration: 0.15)) { store.toggleComplete(task.id) }
                }
                VStack(alignment: .leading, spacing: 5) {
                    Text(task.title)
                        .font(.system(size: compact ? 12.5 : 13.5, weight: .medium))
                        .foregroundStyle(task.isCompleted ? Theme.textMuted : Theme.text)
                        .strikethrough(task.isCompleted, color: Theme.textMuted)
                        .fixedSize(horizontal: false, vertical: true)
                    meta(channel: channel, subtasks: subtasks)
                }
                Spacer(minLength: 4)
                if let minutes = task.plannedTime, minutes > 0, !compact {
                    Text(formatMinutes(minutes))
                        .font(.system(size: 11, weight: .semibold).monospacedDigit())
                        .foregroundStyle(Theme.textSecondary)
                        .padding(.horizontal, 7)
                        .padding(.vertical, 3)
                        .background(Theme.sunken, in: Capsule())
                }
            }

            if expanded && !compact {
                VStack(alignment: .leading, spacing: 6) {
                    ForEach(subtasks) { sub in
                        HStack(spacing: 8) {
                            CheckCircle(done: sub.isCompleted, color: nil, size: 14) { store.toggleComplete(sub.id) }
                            Text(sub.title)
                                .font(.system(size: 12.5))
                                .foregroundStyle(sub.isCompleted ? Theme.textMuted : Theme.text)
                                .strikethrough(sub.isCompleted, color: Theme.textMuted)
                            Spacer()
                        }
                    }
                    HStack(spacing: 8) {
                        Image(systemName: "plus").font(.system(size: 10, weight: .bold)).foregroundStyle(Theme.textMuted)
                            .frame(width: 14)
                        TextField("Subtask", text: $newSubtask)
                            .textFieldStyle(.plain)
                            .font(.system(size: 12.5))
                            .onSubmit {
                                let t = newSubtask.trimmingCharacters(in: .whitespaces)
                                guard !t.isEmpty else { return }
                                store.addTask(title: t, parentId: task.id)
                                newSubtask = ""
                            }
                    }
                }
                .padding(.leading, 28)
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, compact ? 8 : 11)
        .card(highlighted: hovering)
        .opacity(task.isCompleted ? 0.75 : 1)
        .contentShape(Rectangle())
        .onHover { hovering = $0 }
        .onTapGesture { store.editingTaskId = task.id }
        .contextMenu { TaskContextMenu(task: task) }
    }

    @ViewBuilder
    private func meta(channel: Channel?, subtasks: [PlanTask]) -> some View {
        let hasMeta = channel != nil || task.hasTimeBlock || !subtasks.isEmpty || (task.description?.isEmpty == false)
        if hasMeta || (hovering && !compact) {
            let layout = compact ? AnyLayout(VStackLayout(alignment: .leading, spacing: 3)) : AnyLayout(HStackLayout(spacing: 8))
            layout {
                if let channel {
                    Text("#\(channel.name)")
                        .font(.system(size: 10.5, weight: .semibold))
                        .lineLimit(1)
                        .foregroundStyle(Color(hexString: channel.color) ?? Theme.accent)
                }
                if let start = task.scheduledStart, let end = task.scheduledEnd {
                    Label("\(Fmt.time(start))–\(Fmt.time(end))", systemImage: "clock")
                        .font(.system(size: 10.5, weight: .medium).monospacedDigit())
                        .foregroundStyle(Theme.textSecondary)
                        .fixedSize()
                }
                if task.description?.isEmpty == false {
                    Image(systemName: "text.alignleft").font(.system(size: 10)).foregroundStyle(Theme.textMuted)
                }
                if !compact && (!subtasks.isEmpty || hovering) {
                    Button {
                        withAnimation(.easeOut(duration: 0.15)) { expanded.toggle() }
                    } label: {
                        HStack(spacing: 3) {
                            Image(systemName: expanded ? "chevron.down" : "chevron.right").font(.system(size: 8, weight: .bold))
                            Text(subtasks.isEmpty ? "Subtasks" : "\(subtasks.filter(\.isCompleted).count)/\(subtasks.count)")
                        }
                        .font(.system(size: 10.5, weight: .medium))
                        .foregroundStyle(Theme.textSecondary)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }
}

struct TaskContextMenu: View {
    @Environment(AppStore.self) private var store
    let task: PlanTask

    var body: some View {
        Button(task.isCompleted ? "Wieder öffnen" : "Erledigt") { store.toggleComplete(task.id) }
        Button("Bearbeiten …") { store.editingTaskId = task.id }
        Divider()
        let today = DateCoding.today()
        if task.scheduledDate != today { Button("Auf heute") { store.moveTask(task.id, to: today) } }
        Button("Auf morgen") { store.moveTask(task.id, to: DateCoding.addDays(task.scheduledDate ?? today, 1)) }
        Menu("In den Backlog") {
            ForEach(BacklogBucket.allCases) { bucket in
                Button(bucket.label) { store.moveToBacklog(task.id, bucket: bucket) }
            }
        }
        if task.hasTimeBlock {
            Button("Aus dem Kalender entfernen") {
                store.updateTask(task.id) { $0.scheduledStart = nil; $0.scheduledEnd = nil }
            }
        }
        Divider()
        Button("Löschen", role: .destructive) { store.deleteTask(task.id) }
    }
}

struct CheckCircle: View {
    var done: Bool
    var color: Color?
    var size: CGFloat = 18
    var action: () -> Void
    @State private var hovering = false

    var body: some View {
        Button(action: action) {
            ZStack {
                Circle()
                    .strokeBorder(done ? Theme.success : (color ?? Theme.line), lineWidth: 1.6)
                    .background(Circle().fill(done ? Theme.success : .clear))
                if done || hovering {
                    Image(systemName: "checkmark")
                        .font(.system(size: size * 0.5, weight: .bold))
                        .foregroundStyle(done ? .white : Theme.textMuted)
                }
            }
            .frame(width: size, height: size)
            .contentShape(Circle())
        }
        .buttonStyle(.plain)
        .onHover { hovering = $0 }
        .padding(.top, 1)
    }
}
