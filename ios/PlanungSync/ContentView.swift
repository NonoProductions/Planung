import SwiftUI

struct ContentView: View {
    @EnvironmentObject var model: SyncModel

    var body: some View {
        if model.isLoggedIn, let url = model.webURL {
            MainView(url: url)
        } else {
            NavigationStack {
                LoginView().navigationTitle("Planung")
            }
        }
    }
}

/// The web app full screen. Sync runs automatically; its settings open from the
/// web app's settings page.
private struct MainView: View {
    @EnvironmentObject var model: SyncModel
    @StateObject private var web: WebViewStore
    @State private var showsSync = false

    init(url: URL) {
        _web = StateObject(wrappedValue: WebViewStore(url: url))
    }

    var body: some View {
        // Full screen: the web app pads itself with env(safe-area-inset-*), so its
        // background continues behind the status bar instead of leaving a black strip.
        WebAppView(store: web)
            .ignoresSafeArea()
            .sheet(isPresented: $showsSync) {
                NavigationStack {
                    SyncView()
                        .navigationTitle("Sync")
                        .navigationBarTitleDisplayMode(.inline)
                        .toolbar {
                            ToolbarItem(placement: .confirmationAction) {
                                Button("Fertig") { showsSync = false }
                            }
                        }
                }
                .presentationDetents([.medium, .large])
            }
            .onAppear {
                web.onTaskChange = { model.webChanged() }
                web.onOpenSync = { showsSync = true }
            }
            .onChange(of: model.webReloadCount) { web.reload() }
    }
}

private struct LoginView: View {
    @EnvironmentObject var model: SyncModel
    @State private var email = ""
    @State private var password = ""
    @State private var isLoading = false

    var body: some View {
        Form {
            Section {
                TextField("https://deine-app.vercel.app", text: $model.serverURL)
                    .keyboardType(.URL)
                    .textContentType(.URL)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
            } header: {
                Text("Server")
            } footer: {
                Text("Die Adresse, unter der deine Planung-Web-App läuft.")
            }

            Section("Konto") {
                TextField("E-Mail", text: $email)
                    .keyboardType(.emailAddress)
                    .textContentType(.username)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                SecureField("Passwort", text: $password)
                    .textContentType(.password)
            }

            if let error = model.lastError {
                Section { Text(error).foregroundStyle(.red) }
            }

            Section {
                Button {
                    isLoading = true
                    Task {
                        await model.login(email: email, password: password)
                        isLoading = false
                    }
                } label: {
                    HStack {
                        Text("Anmelden")
                        if isLoading { Spacer(); ProgressView() }
                    }
                }
                .disabled(isLoading || email.isEmpty || password.isEmpty || model.serverURL.isEmpty)
            }
        }
    }
}

private struct SyncView: View {
    @EnvironmentObject var model: SyncModel

    var body: some View {
        List {
            Section {
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        if let lastSync = model.lastSync {
                            Text("Zuletzt: \(lastSync.formatted(date: .abbreviated, time: .shortened))")
                                .font(.subheadline)
                            if !model.lastResult.isEmpty {
                                Text(model.lastResult).font(.caption).foregroundStyle(.secondary)
                            }
                        } else {
                            Text("Noch nicht synchronisiert").font(.subheadline)
                        }
                    }
                    Spacer()
                    if model.isSyncing { ProgressView() }
                }

                Button("Jetzt synchronisieren") {
                    Task { await model.sync(reason: "Manuell") }
                }
                .disabled(model.isSyncing)

                if let error = model.lastError {
                    Text(error).font(.footnote).foregroundStyle(.red)
                }
            }

            Section {
                Toggle("Erinnerungen", isOn: $model.syncReminders)
                Toggle("Kalender", isOn: $model.syncCalendar)
            } header: {
                Text("Synchronisieren mit")
            } footer: {
                Text("Tasks landen in der Liste bzw. im Kalender „\(SyncEngine.collectionName)“. Tasks mit Uhrzeit erscheinen zusätzlich als Termin.")
            }

            if !model.logLines.isEmpty {
                Section("Protokoll") {
                    ForEach(Array(model.logLines.enumerated()), id: \.offset) { _, line in
                        Text(line).font(.caption.monospaced())
                    }
                }
            }

            Section {
                if let email = model.email {
                    LabeledContent("Angemeldet als", value: email)
                }
                Button("Abmelden", role: .destructive) { model.logout() }
            }
        }
        .refreshable { await model.sync(reason: "Aktualisiert") }
    }
}
