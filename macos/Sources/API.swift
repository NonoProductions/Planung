import Foundation
import WebKit

enum APIError: LocalizedError {
    case invalidServerURL
    case notLoggedIn
    case unauthorized
    case offline
    case server(Int, String)

    var errorDescription: String? {
        switch self {
        case .invalidServerURL: return "Ungültige Server-Adresse"
        case .notLoggedIn: return "Nicht angemeldet"
        case .unauthorized: return "Anmeldung abgelaufen – bitte neu anmelden"
        case .offline: return "Keine Verbindung zum Server"
        case .server(let code, let message): return "Serverfehler \(code): \(message)"
        }
    }
}

struct MobileSession: Codable {
    var accessToken: String
    var refreshToken: String
    var expiresAt: Double
    var email: String?
}

/// Talks to the Planung web app (Next.js API). Uses the login cookie of the embedded web app when
/// there is one (the API routes accept the NextAuth session), otherwise a Bearer token. The cookie
/// path needs no token refresh, which used to fail after sleep and silently stop the sync.
@MainActor
final class APIClient {
    var baseURL: URL?
    private(set) var session: MobileSession?

    init(baseURL: URL?) {
        self.baseURL = baseURL
        if let data = SessionFile.load() {
            session = try? JSONDecoder().decode(MobileSession.self, from: data)
        }
    }

    var isLoggedIn: Bool { session != nil }

    func login(email: String, password: String) async throws {
        let data = try await send("POST", "/api/mobile/login", body: .object(["email": .string(email), "password": .string(password)]), auth: false)
        store(try JSONDecoder().decode(MobileSession.self, from: data))
    }

    func logout() {
        session = nil
        SessionFile.delete()
    }

    func fetchSnapshot() async throws -> Snapshot {
        let data = try await send("GET", "/api/mobile/snapshot")
        return try JSONDecoder().decode(Snapshot.self, from: data)
    }

    /// Whether the embedded web app is logged in for the current server.
    func hasWebSession() async -> Bool {
        guard let baseURL else { return false }
        return await webCookieHeader(for: baseURL) != nil
    }

    @discardableResult
    func send(_ method: String, _ path: String, body: JSONValue? = nil, auth: Bool = true, retried: Bool = false) async throws -> Data {
        guard let baseURL, let url = URL(string: path, relativeTo: baseURL) else { throw APIError.invalidServerURL }

        var request = URLRequest(url: url)
        request.httpMethod = method
        request.timeoutInterval = 20
        request.cachePolicy = .reloadIgnoringLocalCacheData
        request.httpShouldHandleCookies = false
        if let body {
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try JSONEncoder().encode(body)
        }

        var usesWebSession = false
        if auth {
            if let cookies = await webCookieHeader(for: url) {
                request.setValue(cookies, forHTTPHeaderField: "Cookie")
                usesWebSession = true
            } else {
                guard let session else { throw APIError.notLoggedIn }
                if session.expiresAt - 60 < Date().timeIntervalSince1970 {
                    try await refresh()
                }
                if let token = self.session?.accessToken {
                    request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
                }
            }
        }

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await URLSession.shared.data(for: request)
        } catch let error as URLError where error.code != .cancelled {
            throw APIError.offline
        }
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        if usesWebSession, let http = response as? HTTPURLResponse { await keepCookies(from: http, url: url) }

        if status == 401 && auth {
            if usesWebSession { throw APIError.unauthorized }
            if !retried {
                try await refresh()
                return try await send(method, path, body: body, auth: auth, retried: true)
            }
        }
        guard (200..<300).contains(status) else {
            let message = (try? JSONSerialization.jsonObject(with: data) as? [String: Any])?["error"] as? String
            throw APIError.server(status, message ?? HTTPURLResponse.localizedString(forStatusCode: status))
        }
        return data
    }

    // MARK: Web session cookies

    private var cookieStore: WKHTTPCookieStore { WKWebsiteDataStore.default().httpCookieStore }

    /// `Cookie` header with the web app's cookies for `url`, or nil when it holds no NextAuth session.
    private func webCookieHeader(for url: URL) async -> String? {
        guard let host = url.host else { return nil }
        let now = Date()
        let cookies = await cookieStore.allCookies().filter { cookie in
            let domain = cookie.domain.hasPrefix(".") ? String(cookie.domain.dropFirst()) : cookie.domain
            let matches = host == domain || host.hasSuffix("." + domain)
            return matches && (cookie.expiresDate ?? .distantFuture) > now && (!cookie.isSecure || url.scheme == "https")
        }
        guard cookies.contains(where: { $0.name.contains("session-token") }) else { return nil }
        return cookies.map { "\($0.name)=\($0.value)" }.joined(separator: "; ")
    }

    /// NextAuth re-issues the session cookie to extend it; keep the web view's copy current.
    private func keepCookies(from response: HTTPURLResponse, url: URL) async {
        let fields = response.allHeaderFields.reduce(into: [String: String]()) { result, pair in
            if let key = pair.key as? String, let value = pair.value as? String { result[key] = value }
        }
        for cookie in HTTPCookie.cookies(withResponseHeaderFields: fields, for: url) {
            await cookieStore.setCookie(cookie)
        }
    }

    private func store(_ newSession: MobileSession) {
        session = newSession
        if let data = try? JSONEncoder().encode(newSession) {
            SessionFile.save(data)
        }
    }

    private func refresh() async throws {
        guard let refreshToken = session?.refreshToken else { throw APIError.notLoggedIn }
        do {
            let data = try await send("POST", "/api/mobile/refresh", body: .object(["refreshToken": .string(refreshToken)]), auth: false)
            store(try JSONDecoder().decode(MobileSession.self, from: data))
        } catch APIError.server(401, _) {
            logout()
            throw APIError.unauthorized
        }
    }
}

/// Stores the login tokens in a file only the current user can read. The keychain
/// would ask for permission after every rebuild of the ad-hoc signed app.
enum SessionFile {
    private static var url: URL { AppPaths.support.appendingPathComponent("session.json") }

    static func save(_ data: Data) {
        try? data.write(to: url, options: .atomic)
        try? FileManager.default.setAttributes([.posixPermissions: 0o600], ofItemAtPath: url.path)
    }

    static func load() -> Data? { try? Data(contentsOf: url) }

    static func delete() { try? FileManager.default.removeItem(at: url) }
}

enum AppPaths {
    static var support: URL {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        let dir = base.appendingPathComponent("NoesPlaner", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir
    }
}
