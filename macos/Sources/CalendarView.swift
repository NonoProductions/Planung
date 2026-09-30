import SwiftUI

/// A block on the day timeline: either an event occurrence or a time-blocked task.
private struct TimelineItem: Identifiable {
    enum Kind { case event(EventOccurrence), task(PlanTask) }
    var kind: Kind
    var start: Date
    var end: Date
    var column = 0
    var columns = 1

    var id: String {
        switch kind {
        case .event(let o): return "e-" + o.id
        case .task(let t): return "t-" + t.id
        }
    }
}

struct DayCalendarView: View {
    @Environment(AppStore.self) private var store
    let day: String

    private let hourHeight: CGFloat = 52
    private let gutter: CGFloat = 48
    @State private var scrolledHour: Int?

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Kalender").font(.system(size: 15, weight: .bold)).foregroundStyle(Theme.text)
                    Text("\(Fmt.relativeDay(day)), \(Fmt.dayDate(day))").font(.caption).foregroundStyle(Theme.textSecondary)
                }
                Spacer()
                Button {
                    newEvent(at: defaultNewEventStart)
                } label: {
                    Image(systemName: "plus")
                }
                .help("Neuer Termin (⇧⌘N)")
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
            Rectangle().fill(Theme.lineSoft).frame(height: 1)

            ScrollView {
                timeline
                    .padding(.vertical, 10)
            }
            .scrollPosition(id: $scrolledHour, anchor: .top)
            .task(id: day) {
                try? await Task.sleep(for: .milliseconds(50))
                scrolledHour = scrollAnchorHour
            }
        }
        .background(Theme.card)
    }

    private var scrollAnchorHour: Int {
        let hour = day == DateCoding.today() ? Calendar.current.component(.hour, from: Date()) - 2 : 7
        return max(0, min(hour, 16))
    }

    private var dayStart: Date { DateCoding.date(fromDay: day) ?? Date() }

    private var defaultNewEventStart: Date {
        if day == DateCoding.today() {
            return Calendar.current.nextDate(after: Date(), matching: DateComponents(minute: 0), matchingPolicy: .nextTime) ?? Date()
        }
        return dayStart.addingTimeInterval(9 * 3600)
    }

    private var timeline: some View {
        ZStack(alignment: .top) {
            // Laid-out hour anchors for ScrollViewReader (offset rows keep their frame at the top).
            VStack(spacing: 0) {
                ForEach(0..<24, id: \.self) { hour in
                    Color.clear.frame(height: hourHeight).id(hour)
                }
            }
            .scrollTargetLayout()
            .allowsHitTesting(false)
            grid
        }
    }

    private var grid: some View {
        GeometryReader { geo in
            let width = geo.size.width - gutter - 8
            ZStack(alignment: .topLeading) {
                // Hour grid
                ForEach(0..<24, id: \.self) { hour in
                    HStack(alignment: .top, spacing: 6) {
                        Text(String(format: "%02d:00", hour))
                            .font(.system(size: 10, weight: .medium).monospacedDigit())
                            .foregroundStyle(Theme.textMuted)
                            .frame(width: gutter - 6, alignment: .trailing)
                            .offset(y: -6)
                        Rectangle().fill(Theme.lineSoft).frame(height: 1)
                    }
                    .frame(height: hourHeight, alignment: .top)
                    .offset(y: CGFloat(hour) * hourHeight)
                }


                // Background that receives double clicks and drops
                Color.clear
                    .contentShape(Rectangle())
                    .frame(width: geo.size.width, height: hourHeight * 24)
                    .gesture(SpatialTapGesture(count: 2).onEnded { value in
                        newEvent(at: date(forY: value.location.y))
                    })
                    .dropDestination(for: String.self) { ids, location in
                        guard let id = ids.first else { return false }
                        drop(id, at: date(forY: location.y))
                        return true
                    }

                ForEach(layout()) { item in
                    block(item)
                        .frame(width: max(20, width / CGFloat(item.columns) - 3),
                               height: max(20, CGFloat(item.end.timeIntervalSince(item.start) / 3600) * hourHeight - 2))
                        .offset(x: gutter + width / CGFloat(item.columns) * CGFloat(item.column),
                                y: y(for: item.start) + 1)
                }

                if day == DateCoding.today() {
                    TimelineView(.periodic(from: .now, by: 60)) { context in
                        HStack(spacing: 0) {
                            Circle().fill(Theme.nowLine).frame(width: 8, height: 8)
                            Rectangle().fill(Theme.nowLine).frame(height: 1.5)
                        }
                        .frame(width: width + 8)
                        .offset(x: gutter - 4, y: y(for: context.date) - 4)
                    }
                    .allowsHitTesting(false)
                }
            }
        }
        .frame(height: hourHeight * 24)
    }

    // MARK: Blocks

    @ViewBuilder
    private func block(_ item: TimelineItem) -> some View {
        switch item.kind {
        case .event(let occurrence):
            let color = Color(hexString: occurrence.event.color)
                ?? Color(hexString: store.category(occurrence.event.calendarCategoryId)?.color) ?? Theme.accent
            BlockView(title: occurrence.event.title.isEmpty ? "(Ohne Titel)" : occurrence.event.title,
                      time: "\(Fmt.time(item.start))–\(Fmt.time(item.end))",
                      color: color, icon: occurrence.event.isRecurring ? "repeat" : nil, done: false)
                .onTapGesture { store.editingEvent = EventDraft(event: occurrence.event, isNew: false) }
                .draggable("event:\(occurrence.event.id)|\(occurrence.start.timeIntervalSince1970)") {
                    DragPreview(title: occurrence.event.title)
                }
        case .task(let task):
            BlockView(title: task.title, time: "\(Fmt.time(item.start))–\(Fmt.time(item.end))",
                      color: Color(hexString: store.channel(task.channelId)?.color) ?? Theme.success,
                      icon: task.isCompleted ? "checkmark.circle.fill" : "circle", done: task.isCompleted, dashed: true)
                .onTapGesture { store.editingTaskId = task.id }
                .contextMenu { TaskContextMenu(task: task) }
                .draggable(task.id) { DragPreview(title: task.title) }
        }
    }

    private func layout() -> [TimelineItem] {
        let dayEnd = dayStart.addingTimeInterval(86_400)
        var items: [TimelineItem] = store.occurrences(on: day).map {
            TimelineItem(kind: .event($0), start: max($0.start, dayStart), end: min($0.end, dayEnd))
        }
        for task in store.tasks where !task.isBacklog {
            guard let start = task.scheduledStart, let end = task.scheduledEnd,
                  start < dayEnd, end > dayStart else { continue }
            items.append(TimelineItem(kind: .task(task), start: max(start, dayStart), end: min(max(end, start.addingTimeInterval(900)), dayEnd)))
        }
        items.sort { ($0.start, $1.end) < ($1.start, $0.end) }

        // Side-by-side columns for overlapping blocks, per cluster of overlaps.
        var result: [TimelineItem] = []
        var cluster: [TimelineItem] = []
        var clusterEnd = Date.distantPast
        func closeCluster() {
            let count = (cluster.map(\.column).max() ?? 0) + 1
            result += cluster.map { var i = $0; i.columns = count; return i }
            cluster = []
        }
        for var item in items {
            if item.start >= clusterEnd { closeCluster() }
            var column = 0
            while cluster.contains(where: { $0.column == column && $0.end > item.start }) { column += 1 }
            item.column = column
            cluster.append(item)
            clusterEnd = max(clusterEnd, item.end)
        }
        closeCluster()
        return result
    }

    // MARK: Geometry & actions

    private func y(for date: Date) -> CGFloat {
        CGFloat(date.timeIntervalSince(dayStart) / 3600) * hourHeight
    }

    /// Time at a y position, snapped to 15 minutes.
    private func date(forY y: CGFloat) -> Date {
        let minutes = Int((y / hourHeight * 60 / 15).rounded(.down)) * 15
        return dayStart.addingTimeInterval(TimeInterval(max(0, min(minutes, 23 * 60 + 45)) * 60))
    }

    private func newEvent(at start: Date) {
        store.editingEvent = EventDraft(event: PlanEvent(title: "", startTime: start, endTime: start.addingTimeInterval(3600)), isNew: true)
    }

    private func drop(_ payload: String, at start: Date) {
        if payload.hasPrefix("event:") {
            // "event:<id>|<occurrence start>" – shift the whole series by the same amount.
            let parts = payload.dropFirst("event:".count).split(separator: "|")
            guard let id = parts.first.map(String.init), var event = store.events.first(where: { $0.id == id }) else { return }
            let occurrenceStart = parts.count > 1 ? Double(parts[1]).map(Date.init(timeIntervalSince1970:)) : nil
            let delta = start.timeIntervalSince(occurrenceStart ?? event.startTime)
            event.startTime += delta
            event.endTime += delta
            store.saveEvent(event)
        } else {
            store.timeBlock(payload, start: start)
        }
    }
}

private struct BlockView: View {
    let title: String
    let time: String
    let color: Color
    let icon: String?
    let done: Bool
    var dashed = false
    @State private var hovering = false

    var body: some View {
        GeometryReader { geo in
            VStack(alignment: .leading, spacing: 1) {
                HStack(spacing: 4) {
                    if let icon { Image(systemName: icon).font(.system(size: 9, weight: .bold)) }
                    Text(title).font(.system(size: 11.5, weight: .semibold)).lineLimit(geo.size.height > 40 ? 2 : 1)
                }
                .strikethrough(done)
                if geo.size.height > 34 {
                    Text(time).font(.system(size: 10).monospacedDigit()).opacity(0.75)
                }
            }
            .foregroundStyle(Theme.text)
            .padding(.horizontal, 7)
            .padding(.vertical, 4)
            .frame(width: geo.size.width, height: geo.size.height, alignment: .topLeading)
            .background(color.opacity(hovering ? 0.3 : 0.2), in: RoundedRectangle(cornerRadius: 6))
            .overlay(alignment: .leading) {
                RoundedRectangle(cornerRadius: 2).fill(color).frame(width: 3).padding(.vertical, 2)
            }
            .overlay {
                if dashed {
                    RoundedRectangle(cornerRadius: 6).strokeBorder(color.opacity(0.6), style: StrokeStyle(lineWidth: 1, dash: [3, 2]))
                }
            }
            .opacity(done ? 0.6 : 1)
            .clipped()
        }
        .contentShape(Rectangle())
        .onHover { hovering = $0 }
    }
}
