import BackgroundTasks
import EventKit
import Foundation
import os
import WebKit

@MainActor
final class SyncModel: ObservableObject {
    static let shared = SyncModel()
    static let refreshTaskId = "com.noelamborelle.planungsync.refresh"

    @Published var serverURL: String {
        didSet { UserDefaults.standard.set(serverURL, forKey: "serverURL") }
    }
    @Published var syncReminders: Bool {
        didSet { UserDefaults.standard.set(syncReminders, forKey: "syncReminders") }
    }
    @Published var syncCalendar: Bool {
        didSet { UserDefaults.standard.set(syncCalendar, forKey: "syncCalendar") }
    }
    @Published private(set) var isLoggedIn = false
    @Published private(set) var isSyncing = false
    @Published private(set) var lastSync: Date?
    @Published private(set) var lastResult = ""
    @Published private(set) var lastError: String?
    @Published private(set) var logLines: [String] = []
    /// Bumped when a sync changed tasks on the server, so the web view reloads.
    @Published private(set) var webReloadCount = 0

    let api: APIClient
    private lazy var engine = SyncEngine(api: api) { [weak self] line in self?.appendLog(line) }
    private var lastSyncEnded = Date.distantPast
    private var pendingChangeSync: Task<Void, Never>?
    private var syncRequestedWhileRunning = false
    private var periodicSync: Task<Void, Never>?

    private init() {
        let defaults = UserDefaults.standard
        let storedURL = defaults.string(forKey: "serverURL") ?? ""
        serverURL = storedURL
        syncReminders = defaults.object(forKey: "syncReminders") as? Bool ?? true
        syncCalendar = defaults.object(forKey: "syncCalendar") as? Bool ?? true
        lastSync = defaults.object(forKey: "lastSync") as? Date
        lastResult = defaults.string(forKey: "lastResult") ?? ""
        api = APIClient(baseURL: Self.normalizedURL(storedURL))
        // Keychain entries survive a reinstall, UserDefaults don't.
        if api.baseURL == nil { api.logout() }
        isLoggedIn = api.isLoggedIn

        NotificationCenter.default.addObserver(forName: .EKEventStoreChanged, object: nil, queue: .main) { [weak self] _ in
            Task { @MainActor in self?.storeChanged() }
        }
    }

    var email: String? { api.session?.email }
    var webURL: URL? { api.baseURL }

    func login(email: String, password: String) async {
        lastError = nil
        guard let url = Self.normalizedURL(serverURL) else {
            lastError = APIError.invalidServerURL.localizedDescription
            return
        }
        api.baseURL = url
        do {
            try await api.login(email: email, password: password)
            let cookieStore = WKWebsiteDataStore.default().httpCookieStore
            for cookie in try await api.webSessionCookies(email: email, password: password) {
                await cookieStore.setCookie(cookie)
            }
            isLoggedIn = true
            await sync(reason: "Erster Sync")
        } catch {
            lastError = error.localizedDescription
        }
    }

    #if DEBUG
    /// Simulator tests: launching with SIMCTL_CHILD_PLANUNG_TEST_EMAIL/_PASSWORD/_SERVER signs in without typing.
    func loginFromTestEnvironment() async {
        let env = ProcessInfo.processInfo.environment
        guard !isLoggedIn, let email = env["PLANUNG_TEST_EMAIL"], let password = env["PLANUNG_TEST_PASSWORD"] else { return }
        if let server = env["PLANUNG_TEST_SERVER"] { serverURL = server }
        await login(email: email, password: password)
    }
    #endif

    func logout() {
        api.logout()
        engine.reset()
        WKWebsiteDataStore.default().removeData(
            ofTypes: WKWebsiteDataStore.allWebsiteDataTypes(),
            modifiedSince: .distantPast
        ) {}
        isLoggedIn = false
        lastSync = nil
        lastResult = ""
        logLines = []
    }

    func sync(reason: String) async {
        guard isLoggedIn, syncReminders || syncCalendar else { return }
        guard !isSyncing else {
            syncRequestedWhileRunning = true
            return
        }
        isSyncing = true
        lastError = nil
        defer {
            isSyncing = false
            lastSyncEnded = Date()
        }

        do {
            let summary = try await engine.run(reminders: syncReminders, calendar: syncCalendar)
            lastSync = Date()
            lastResult = summary.text
            UserDefaults.standard.set(lastSync, forKey: "lastSync")
            UserDefaults.standard.set(lastResult, forKey: "lastResult")
            appendLog("\(reason): \(summary.text)")
            if summary.changedServer { webReloadCount += 1 }
        } catch {
            lastError = error.localizedDescription
            appendLog("Fehler: \(error.localizedDescription)")
            if case APIError.unauthorized = error { isLoggedIn = false }
        }

        if syncRequestedWhileRunning {
            syncRequestedWhileRunning = false
            isSyncing = false
            await sync(reason: reason)
        }
    }

    /// A task was changed in the web view: push it to Apple shortly after.
    func webChanged() {
        pendingChangeSync?.cancel()
        pendingChangeSync = Task {
            try? await Task.sleep(for: .seconds(2))
            guard !Task.isCancelled else { return }
            await sync(reason: "Änderung in der App")
        }
    }

    /// While the app is open, picks up changes from other devices every few minutes.
    func startPeriodicSync() {
        periodicSync?.cancel()
        periodicSync = Task {
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(5 * 60))
                guard !Task.isCancelled else { return }
                await sync(reason: "Automatisch")
            }
        }
    }

    func stopPeriodicSync() {
        periodicSync?.cancel()
        periodicSync = nil
    }

    func scheduleBackgroundRefresh() {
        let request = BGAppRefreshTaskRequest(identifier: Self.refreshTaskId)
        request.earliestBeginDate = Date(timeIntervalSinceNow: 15 * 60)
        try? BGTaskScheduler.shared.submit(request)
    }

    /// Edits in Reminders/Calendar while the app is open. Our own saves also fire
    /// this notification, so changes right after a sync are ignored.
    private func storeChanged() {
        guard isLoggedIn, !isSyncing, Date().timeIntervalSince(lastSyncEnded) > 5 else { return }
        pendingChangeSync?.cancel()
        pendingChangeSync = Task {
            try? await Task.sleep(for: .seconds(2))
            guard !Task.isCancelled else { return }
            await sync(reason: "Änderung in Apple")
        }
    }

    private static let logger = Logger(subsystem: "com.noelamborelle.planungsync", category: "sync")

    private func appendLog(_ line: String) {
        Self.logger.info("\(line, privacy: .public)")
        let time = Date().formatted(date: .omitted, time: .shortened)
        logLines.insert("\(time)  \(line)", at: 0)
        if logLines.count > 100 { logLines.removeLast(logLines.count - 100) }
    }

    private static func normalizedURL(_ value: String) -> URL? {
        var trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return nil }
        if !trimmed.contains("://") { trimmed = "https://" + trimmed }
        while trimmed.hasSuffix("/") { trimmed.removeLast() }
        guard let url = URL(string: trimmed), url.host != nil else { return nil }
        return url
    }
}
