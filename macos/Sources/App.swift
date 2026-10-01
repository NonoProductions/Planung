import SwiftUI

@main
struct NoesPlanerApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @State private var store = AppDelegate.store
    @State private var appleSync = AppDelegate.appleSync

    var body: some Scene {
        Window("Noes Planer", id: "main") {
            RootView()
                .environment(store)
                .frame(minWidth: 980, minHeight: 620)
                .tint(Theme.accent)
        }
        .defaultSize(width: 1440, height: 900)
        .commands { PlannerCommands(store: store) }

        Settings {
            SettingsView()
                .environment(store)
                .environment(appleSync)
                .tint(Theme.accent)
        }

        MenuBarExtra {
            MenuBarTodayView()
                .environment(store)
                .tint(Theme.accent)
        } label: {
            MenuBarLabel(store: store)
        }
        .menuBarExtraStyle(.window)
    }
}

final class AppDelegate: NSObject, NSApplicationDelegate {
    @MainActor static let store = AppStore()
    @MainActor static let appleSync: AppleSync = {
        let sync = AppleSync(appStore: store)
        store.afterSync = { [weak sync] in sync?.run(reason: "Automatisch") }
        return sync
    }()

    func applicationDidFinishLaunching(_ notification: Notification) {
        MainActor.assumeIsolated { _ = Self.appleSync }
    }

    func applicationDidBecomeActive(_ notification: Notification) {
        MainActor.assumeIsolated { Self.store.sync() }
    }

    func applicationWillTerminate(_ notification: Notification) {
        MainActor.assumeIsolated { Self.store.saveNow() }
    }

    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool { true }
}

struct PlannerCommands: Commands {
    let store: AppStore

    var body: some Commands {
        CommandGroup(replacing: .newItem) {
            Button("Neuer Task") {
                if store.section == .backlog {
                    store.quickAddDate = "backlog"
                } else {
                    store.section = .today
                    store.quickAddDate = store.selectedDate
                }
            }
            .keyboardShortcut("n")
            .disabled(!store.showOfflineUI)
            Button("Neuer Termin") {
                let start = Calendar.current.nextDate(after: Date(), matching: DateComponents(minute: 0), matchingPolicy: .nextTime) ?? Date()
                store.editingEvent = EventDraft(event: PlanEvent(title: "", startTime: start, endTime: start.addingTimeInterval(3600)), isNew: true)
            }
            .keyboardShortcut("n", modifiers: [.command, .shift])
            .disabled(!store.showOfflineUI)
        }
        CommandMenu("Planung") {
            Button("Heute") { store.section = .today; store.selectedDate = DateCoding.today() }
                .keyboardShortcut("t")
                .disabled(!store.showOfflineUI)
            Button(store.showOfflineUI ? "Vorheriger Tag" : "Zurück") {
                if store.showOfflineUI { store.selectedDate = DateCoding.addDays(store.selectedDate, -1) }
                else { WebViewStore.shared.webView?.goBack() }
            }
            .keyboardShortcut("[")
            Button(store.showOfflineUI ? "Nächster Tag" : "Vorwärts") {
                if store.showOfflineUI { store.selectedDate = DateCoding.addDays(store.selectedDate, 1) }
                else { WebViewStore.shared.webView?.goForward() }
            }
            .keyboardShortcut("]")
            Divider()
            Button("Tagesansicht") { store.section = .today }.keyboardShortcut("1").disabled(!store.showOfflineUI)
            Button("Woche") { store.section = .week }.keyboardShortcut("2").disabled(!store.showOfflineUI)
            Button("Backlog") { store.section = .backlog }.keyboardShortcut("3").disabled(!store.showOfflineUI)
            Divider()
            Button(store.showCalendar ? "Kalender ausblenden" : "Kalender einblenden") { store.showCalendar.toggle() }
                .keyboardShortcut("k")
                .disabled(!store.showOfflineUI)
            Button(store.showOfflineUI ? "Erneut verbinden" : "Neu laden") {
                if store.showOfflineUI { store.returnOnline() } else { store.sync(); WebViewStore.shared.reload() }
            }
            .keyboardShortcut("r")
            Divider()
            Button("Vergrößern") { WebViewStore.shared.zoom(by: 0.1) }.keyboardShortcut("+")
            Button("Verkleinern") { WebViewStore.shared.zoom(by: -0.1) }.keyboardShortcut("-")
            Button("Originalgröße") { WebViewStore.shared.resetZoom() }.keyboardShortcut("0")
        }
        CommandGroup(after: .appSettings) {
            Button("Server-Adresse ändern …") { ServerPrompt.run(store: store) }
        }
    }
}

// MARK: - Root

struct RootView: View {
    var body: some View {
        WebShell()
            .background(Theme.background)
    }
}

struct MainView: View {
    @Environment(AppStore.self) private var store

    var body: some View {
        @Bindable var store = store
        NavigationSplitView {
            SidebarView()
                .navigationSplitViewColumnWidth(min: 190, ideal: 210, max: 260)
        } detail: {
            Group {
                switch store.section {
                case .today: TodayView()
                case .week: WeekView()
                case .backlog: BacklogView()
                }
            }
            .background(Theme.background)
        }
        .scrollIndicators(.hidden)
        .sheet(item: Binding(get: { store.editingTaskId.map { TaskRef(id: $0) } },
                             set: { store.editingTaskId = $0?.id })) { ref in
            TaskDetailView(taskId: ref.id)
        }
        .sheet(item: $store.editingEvent) { draft in
            EventEditorView(draft: draft)
        }
    }
}

private struct TaskRef: Identifiable { let id: String }

// MARK: - Sidebar

struct SidebarView: View {
    @Environment(AppStore.self) private var store

    var body: some View {
        @Bindable var store = store
        VStack(spacing: 0) {
            List(selection: Binding(get: { store.section }, set: { if let s = $0 { store.section = s } })) {
                Section("Planer") {
                    row(.today, "Heute", "sun.max")
                    row(.week, "Woche", "calendar")
                    row(.backlog, "Backlog", "tray.full")
                }
                let channels = store.channels
                if !channels.isEmpty {
                    Section("Channels") {
                        ForEach(channels) { channel in
                            HStack(spacing: 8) {
                                Circle().fill(Color(hexString: channel.color) ?? Theme.accent).frame(width: 8, height: 8)
                                Text(channel.name).foregroundStyle(Theme.textSecondary)
                            }
                            .selectionDisabled()
                        }
                    }
                }
            }
            .listStyle(.sidebar)
            .scrollContentBackground(.hidden)

            SyncStatusView()
                .padding(12)
        }
        .background(Theme.sidebar)
    }

    private func row(_ section: AppSection, _ title: String, _ icon: String) -> some View {
        Label(title, systemImage: icon)
            .tag(section)
            .dropDestination(for: String.self) { ids, _ in
                guard let id = ids.first, !id.hasPrefix("event:") else { return false }
                switch section {
                case .today: store.moveTask(id, to: DateCoding.today())
                case .week: store.moveTask(id, to: DateCoding.addDays(DateCoding.today(), 1))
                case .backlog: store.moveToBacklog(id)
                }
                return true
            }
    }
}

struct SyncStatusView: View {
    @Environment(AppStore.self) private var store

    var body: some View {
        HStack(spacing: 8) {
            Group {
                switch store.syncState {
                case .syncing: ProgressView().controlSize(.small)
                case .offline: Image(systemName: "wifi.slash").foregroundStyle(Theme.warning)
                case .error: Image(systemName: "exclamationmark.triangle.fill").foregroundStyle(Theme.danger)
                case .idle: Image(systemName: "checkmark.icloud").foregroundStyle(Theme.success)
                }
            }
            .frame(width: 18)

            VStack(alignment: .leading, spacing: 1) {
                Text(title).font(.caption.weight(.semibold)).foregroundStyle(Theme.text)
                Text(subtitle).font(.caption2).foregroundStyle(Theme.textSecondary).lineLimit(2)
            }
            Spacer(minLength: 0)
            Menu {
                Button("Jetzt synchronisieren") { store.sync() }
                if let email = store.email { Text(email) }
                Divider()
                Button("Abmelden", role: .destructive) { store.logout() }
            } label: {
                Image(systemName: "ellipsis.circle")
            }
            .menuStyle(.borderlessButton)
            .menuIndicator(.hidden)
            .fixedSize()
        }
        .padding(10)
        .background(Theme.card.opacity(0.7), in: RoundedRectangle(cornerRadius: 10))
    }

    private var title: String {
        switch store.syncState {
        case .syncing: return "Synchronisiere …"
        case .offline: return "Offline"
        case .error: return "Sync-Fehler"
        case .idle: return "Synchronisiert"
        }
    }

    private var subtitle: String {
        if case .error(let message) = store.syncState { return message }
        if store.pendingCount > 0 {
            return store.pendingCount == 1 ? "1 Änderung wartet" : "\(store.pendingCount) Änderungen warten"
        }
        guard let last = store.lastSync else { return "Noch nie" }
        let f = RelativeDateTimeFormatter()
        f.locale = Fmt.locale
        return Date().timeIntervalSince(last) < 60 ? "Gerade eben" : f.localizedString(for: last, relativeTo: Date())
    }
}

/// Small modal prompt for the server address.
@MainActor
enum ServerPrompt {
    static func run(store: AppStore) {
        let alert = NSAlert()
        alert.messageText = "Server-Adresse"
        alert.informativeText = "Adresse deiner Planung-Web-App."
        let field = NSTextField(frame: NSRect(x: 0, y: 0, width: 320, height: 24))
        field.stringValue = store.serverURL.isEmpty ? defaultServerURL : store.serverURL
        alert.accessoryView = field
        alert.addButton(withTitle: "Sichern")
        alert.addButton(withTitle: "Abbrechen")
        guard alert.runModal() == .alertFirstButtonReturn else { return }
        var value = field.stringValue.trimmingCharacters(in: .whitespacesAndNewlines)
        if !value.contains("://") { value = "https://" + value }
        while value.hasSuffix("/") { value.removeLast() }
        guard URL(string: value)?.host != nil else { return }
        store.serverURL = value
    }
}

/// Menu bar icon with today's open task count. A view of its own, so it observes the store
/// and updates as soon as tasks change (in the scene body it would not be tracked).
struct MenuBarLabel: View {
    let store: AppStore

    var body: some View {
        let open = store.tasks(on: DateCoding.today()).filter { !$0.isCompleted }.count
        if open == 0 {
            Image(systemName: "checkmark.circle")
        } else {
            HStack(spacing: 3) {
                Image(systemName: "circle.dotted")
                Text("\(open)")
            }
        }
    }
}
