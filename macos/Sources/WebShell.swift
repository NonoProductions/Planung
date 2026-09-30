import SwiftUI
import WebKit

/// Default server when none has been set yet.
let defaultServerURL = "https://planung-ivory.vercel.app"

/// Shows the web app while it is reachable and falls back to the native offline views otherwise.
struct WebShell: View {
    @Environment(AppStore.self) private var store

    var body: some View {
        let url = URL(string: store.serverURL.isEmpty ? defaultServerURL : store.serverURL)!
        ZStack(alignment: .top) {
            WebContainer(url: url)
                .opacity(store.showOfflineUI ? 0 : 1)
                .allowsHitTesting(!store.showOfflineUI)

            if store.showOfflineUI {
                if store.email != nil {
                    VStack(spacing: 0) {
                        OfflineBanner()
                        MainView()
                    }
                } else {
                    OfflineUnavailableView()
                }
            }
        }
        .onChange(of: store.isOnline) { _, online in
            if online { store.returnOnline() }
        }
    }
}

struct OfflineBanner: View {
    @Environment(AppStore.self) private var store

    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: "wifi.slash")
            Text("Offline-Modus – Änderungen werden synchronisiert, sobald du wieder online bist.")
            Spacer()
            Button("Erneut versuchen") { store.returnOnline() }
                .buttonStyle(.borderless)
        }
        .font(.callout.weight(.medium))
        .foregroundStyle(Theme.text)
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
        .background(Theme.warning.opacity(0.22))
    }
}

struct OfflineUnavailableView: View {
    @Environment(AppStore.self) private var store
    @State private var showLogin = false

    var body: some View {
        VStack(spacing: 14) {
            Image(systemName: "wifi.slash").font(.system(size: 40)).foregroundStyle(Theme.textMuted)
            Text("Keine Verbindung").font(.title2.bold()).foregroundStyle(Theme.text)
            Text("Der Offline-Modus ist noch nicht eingerichtet. Melde dich einmal online auf der Webseite an, dann werden deine Daten auch lokal gespeichert.")
                .multilineTextAlignment(.center)
                .foregroundStyle(Theme.textSecondary)
                .frame(maxWidth: 420)
            Button("Erneut versuchen") { store.returnOnline() }
                .buttonStyle(.borderedProminent)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Theme.background)
    }
}

// MARK: - Web view

@MainActor
final class WebViewStore {
    static let shared = WebViewStore()
    weak var webView: WKWebView?
    var homeURL: URL?

    func reload() {
        guard let webView else { return }
        if let current = webView.url, current.origin == homeURL?.origin { webView.reload() }
        else if let homeURL { webView.load(URLRequest(url: homeURL)) }
    }

    func zoom(by delta: CGFloat) {
        guard let webView else { return }
        webView.pageZoom = min(3, max(0.5, webView.pageZoom + delta))
        UserDefaults.standard.set(Double(webView.pageZoom), forKey: "pageZoom")
    }

    func resetZoom() {
        webView?.pageZoom = 1
        UserDefaults.standard.set(1.0, forKey: "pageZoom")
    }
}

struct WebContainer: NSViewRepresentable {
    @Environment(AppStore.self) private var store
    let url: URL

    /// Hands the credentials typed into the web login form to the offline store, so one login covers both.
    private static let loginCaptureScript = """
    document.addEventListener('submit', function (event) {
      var form = event.target;
      var email = form.querySelector('input[type=email]');
      var password = form.querySelector('input[type=password]');
      if (email && password && email.value && password.value) {
        window.webkit.messageHandlers.planerLogin.postMessage({ email: email.value, password: password.value });
      }
    }, true);
    """

    func makeCoordinator() -> Coordinator { Coordinator(store: store, origin: url.origin) }

    func makeNSView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .default() // keeps the web login between launches
        config.preferences.isElementFullscreenEnabled = true
        config.userContentController.addUserScript(
            WKUserScript(source: Self.loginCaptureScript, injectionTime: .atDocumentEnd, forMainFrameOnly: true))
        config.userContentController.add(context.coordinator, name: "planerLogin")

        let webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = context.coordinator
        webView.uiDelegate = context.coordinator
        webView.allowsBackForwardNavigationGestures = true
        webView.allowsMagnification = true
        webView.isInspectable = true
        webView.underPageBackgroundColor = NSColor(Theme.background)
        let zoom = UserDefaults.standard.double(forKey: "pageZoom")
        if zoom > 0 { webView.pageZoom = zoom }

        WebViewStore.shared.webView = webView
        WebViewStore.shared.homeURL = url
        webView.load(URLRequest(url: url))
        return webView
    }

    func updateNSView(_ webView: WKWebView, context: Context) {
        guard context.coordinator.origin != url.origin else { return }
        context.coordinator.origin = url.origin
        WebViewStore.shared.homeURL = url
        webView.load(URLRequest(url: url))
    }

    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler {
        let store: AppStore
        var origin: String

        init(store: AppStore, origin: String) {
            self.store = store
            self.origin = origin
        }

        func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
            guard let body = message.body as? [String: Any],
                  let email = body["email"] as? String, let password = body["password"] as? String else { return }
            let server = store.serverURL.isEmpty ? defaultServerURL : store.serverURL
            Task { @MainActor in try? await store.login(server: server, email: email, password: password) }
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            if webView.url?.origin == origin { store.webReachable = true }
        }

        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
            let code = (error as NSError).code
            guard code != NSURLErrorCancelled else { return }
            let offlineCodes = [NSURLErrorNotConnectedToInternet, NSURLErrorNetworkConnectionLost, NSURLErrorCannotFindHost,
                                NSURLErrorCannotConnectToHost, NSURLErrorTimedOut, NSURLErrorDNSLookupFailed]
            if offlineCodes.contains(code) { store.webReachable = false }
        }

        // Links to other sites open in the default browser.
        func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction,
                     decisionHandler: @escaping @MainActor (WKNavigationActionPolicy) -> Void) {
            if let url = action.request.url, isExternal(url), action.navigationType == .linkActivated {
                NSWorkspace.shared.open(url)
                decisionHandler(.cancel)
                return
            }
            decisionHandler(.allow)
        }

        func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                     for action: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
            if let url = action.request.url {
                if isExternal(url) { NSWorkspace.shared.open(url) } else { webView.load(action.request) }
            }
            return nil
        }

        func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String,
                     initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping @MainActor () -> Void) {
            let alert = NSAlert()
            alert.messageText = message
            alert.runModal()
            completionHandler()
        }

        func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String,
                     initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping @MainActor (Bool) -> Void) {
            let alert = NSAlert()
            alert.messageText = message
            alert.addButton(withTitle: "OK")
            alert.addButton(withTitle: "Abbrechen")
            completionHandler(alert.runModal() == .alertFirstButtonReturn)
        }

        func webView(_ webView: WKWebView, runOpenPanelWith parameters: WKOpenPanelParameters,
                     initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping @MainActor ([URL]?) -> Void) {
            let panel = NSOpenPanel()
            panel.allowsMultipleSelection = parameters.allowsMultipleSelection
            panel.canChooseDirectories = parameters.allowsDirectories
            completionHandler(panel.runModal() == .OK ? panel.urls : nil)
        }

        private func isExternal(_ url: URL) -> Bool {
            switch url.scheme {
            case "http", "https": return url.origin != origin
            case "about", "blob", "data": return false
            default: return true // mailto:, tel:, …
            }
        }
    }
}

extension URL {
    /// scheme://host:port, to tell the app's own pages from external links.
    var origin: String { "\(scheme ?? "")://\(host ?? "")\(port.map { ":\($0)" } ?? "")" }
}
