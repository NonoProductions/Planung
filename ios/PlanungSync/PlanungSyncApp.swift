import SwiftUI

@main
struct PlanungSyncApp: App {
    @StateObject private var model = SyncModel.shared
    @Environment(\.scenePhase) private var scenePhase

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(model)
        }
        .onChange(of: scenePhase) { _, phase in
            switch phase {
            case .active:
                Task {
                    #if DEBUG
                    await model.loginFromTestEnvironment()
                    #endif
                    await model.sync(reason: "App geöffnet")
                }
                model.startPeriodicSync()
            case .background:
                model.stopPeriodicSync()
                model.scheduleBackgroundRefresh()
            default:
                break
            }
        }
        .backgroundTask(.appRefresh(SyncModel.refreshTaskId)) {
            await MainActor.run { SyncModel.shared.scheduleBackgroundRefresh() }
            await SyncModel.shared.sync(reason: "Hintergrund")
        }
    }
}
