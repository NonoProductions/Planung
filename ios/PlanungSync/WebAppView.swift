import SwiftUI
import WebKit

/// Owns the web view that shows the Planung web app and reports task edits
/// made in it, so the native side can sync them to Reminders/Calendar.
@MainActor
final class WebViewStore: NSObject, ObservableObject, WKScriptMessageHandler, WKNavigationDelegate {
    let webView: WKWebView
    var onTaskChange: () -> Void = {}
    /// The web app's settings page asks to show the sync settings.
    var onOpenSync: () -> Void = {}

    private let host: String?

    /// Reports every successful non-GET API call (task created, moved, completed …).
    private static let fetchHook = """
    (function () {
      const originalFetch = window.fetch;
      window.fetch = function (input, init) {
        const promise = originalFetch.apply(this, arguments);
        try {
          const method = ((init && init.method) || (input && input.method) || 'GET').toUpperCase();
          const url = typeof input === 'string' ? input : (input && input.url) || '';
          if (method !== 'GET' && url.includes('/api/') && !url.includes('/api/auth/')) {
            promise.then(function (response) {
              if (response.ok) window.webkit.messageHandlers.planung.postMessage('changed');
            }).catch(function () {});
          }
        } catch (e) {}
        return promise;
      };
    })();
    """

    /// No rubber-band scrolling past the edges and no scroll bars, neither for the
    /// page nor for its scrollable lists, so the web app feels like a native app.
    private static let appFeel = """
    (function () {
      const style = document.createElement('style');
      style.textContent = 'html, body, * { overscroll-behavior: none; scrollbar-width: none; }'
        + ' ::-webkit-scrollbar { display: none; }';
      document.documentElement.appendChild(style);
    })();
    """

    init(url: URL) {
        host = url.host
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .default()
        let scripts = config.userContentController
        scripts.addUserScript(WKUserScript(source: Self.fetchHook, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        scripts.addUserScript(WKUserScript(source: Self.appFeel, injectionTime: .atDocumentEnd, forMainFrameOnly: true))

        webView = WKWebView(frame: .zero, configuration: config)
        // Off: an edge swipe would navigate back instead of showing the previous day.
        webView.allowsBackForwardNavigationGestures = false
        webView.isInspectable = true
        webView.isOpaque = false
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.scrollView.bounces = false
        webView.scrollView.showsVerticalScrollIndicator = false
        webView.scrollView.showsHorizontalScrollIndicator = false
        super.init()

        scripts.add(self, name: "planung")
        webView.navigationDelegate = self
        webView.load(URLRequest(url: url))
    }

    func reload() {
        webView.reload()
    }

    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        let body = message.body as? String ?? ""
        if body.hasPrefix("haptic") {
            Self.playHaptic(body.split(separator: ":").last.map(String.init) ?? "medium")
            return
        }
        switch body {
        case "openSync": onOpenSync()
        default: onTaskChange()
        }
    }

    /// Feedback for "haptic:<kind>" from the web app (src/lib/haptics.ts).
    private static func playHaptic(_ kind: String) {
        switch kind {
        case "select": UISelectionFeedbackGenerator().selectionChanged()
        case "light": UIImpactFeedbackGenerator(style: .light).impactOccurred()
        case "success": UINotificationFeedbackGenerator().notificationOccurred(.success)
        case "warning": UINotificationFeedbackGenerator().notificationOccurred(.warning)
        default: UIImpactFeedbackGenerator(style: .medium).impactOccurred()
        }
    }

    /// Links to other sites open in Safari instead of inside the app.
    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction) async -> WKNavigationActionPolicy {
        guard let url = action.request.url, action.navigationType == .linkActivated,
              url.host != nil, url.host != host else { return .allow }
        await UIApplication.shared.open(url)
        return .cancel
    }
}

/// Hosts the store's web view.
struct WebAppView: UIViewRepresentable {
    let store: WebViewStore

    func makeUIView(context: Context) -> WebViewHost {
        WebViewHost(webView: store.webView)
    }

    func updateUIView(_ host: WebViewHost, context: Context) {}

    final class WebViewHost: UIView {
        private let webView: WKWebView

        init(webView: WKWebView) {
            self.webView = webView
            super.init(frame: .zero)
        }

        required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

        override func didMoveToWindow() {
            super.didMoveToWindow()
            guard window != nil, webView.superview !== self else { return }
            webView.frame = bounds
            webView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
            addSubview(webView)
        }
    }
}
