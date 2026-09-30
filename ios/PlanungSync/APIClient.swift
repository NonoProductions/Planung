import Foundation

enum APIError: LocalizedError {
    case invalidServerURL
    case notLoggedIn
    case unauthorized
    case server(Int, String)

    var errorDescription: String? {
        switch self {
        case .invalidServerURL: return "Ungültige Server-Adresse"
        case .notLoggedIn: return "Nicht angemeldet"
        case .unauthorized: return "Anmeldung abgelaufen – bitte neu anmelden"
        case .server(let code, let message): return "Serverfehler \(code): \(message)"
        }
    }
}

/// Keeps NextAuth's post-login redirect from being followed; only the cookies matter.
private final class NoRedirects: NSObject, URLSessionTaskDelegate {
    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest) async -> URLRequest? {
        nil
    }
}

/// Talks to the Planung web app (Next.js API) with a Bearer token.
@MainActor
final class APIClient {
    private static let sessionAccount = "session"

    var baseURL: URL?
    private(set) var session: MobileSession?

    init(baseURL: URL?) {
        self.baseURL = baseURL
        if let data = Keychain.load(account: Self.sessionAccount) {
            session = try? JSONDecoder().decode(MobileSession.self, from: data)
        }
    }

    var isLoggedIn: Bool { session != nil }

    func login(email: String, password: String) async throws {
        let data = try await send("POST", "/api/mobile/login", body: ["email": email, "password": password], auth: false)
        store(try JSONDecoder().decode(MobileSession.self, from: data))
    }

    /// Signs in to the web app (NextAuth credentials flow) and returns its session
    /// cookies, so the embedded web view starts logged in with the same credentials.
    func webSessionCookies(email: String, password: String) async throws -> [HTTPCookie] {
        guard let baseURL else { throw APIError.invalidServerURL }
        // Cookies are handled by hand: the CSRF cookie from the first response must
        // go along with the login POST, and the session cookie comes back on a redirect.
        let config = URLSessionConfiguration.ephemeral
        config.httpShouldSetCookies = false
        config.httpCookieAcceptPolicy = .never
        let session = URLSession(configuration: config, delegate: NoRedirects(), delegateQueue: nil)

        func cookies(from response: URLResponse) -> [HTTPCookie] {
            guard let http = response as? HTTPURLResponse,
                  let fields = http.allHeaderFields as? [String: String] else { return [] }
            return HTTPCookie.cookies(withResponseHeaderFields: fields, for: baseURL)
        }

        let (csrfData, csrfResponse) = try await session.data(from: baseURL.appendingPathComponent("api/auth/csrf"))
        guard let csrfToken = (try JSONSerialization.jsonObject(with: csrfData) as? [String: Any])?["csrfToken"] as? String else {
            throw APIError.server(0, "Web-Login nicht möglich")
        }
        let csrfCookies = cookies(from: csrfResponse)

        var request = URLRequest(url: baseURL.appendingPathComponent("api/auth/callback/credentials"))
        request.httpMethod = "POST"
        request.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
        for (field, value) in HTTPCookie.requestHeaderFields(with: csrfCookies) {
            request.setValue(value, forHTTPHeaderField: field)
        }
        var form = URLComponents()
        form.queryItems = [
            URLQueryItem(name: "csrfToken", value: csrfToken),
            URLQueryItem(name: "email", value: email),
            URLQueryItem(name: "password", value: password),
        ]
        request.httpBody = form.percentEncodedQuery?
            .replacingOccurrences(of: "+", with: "%2B")
            .data(using: .utf8)
        let (_, loginResponse) = try await session.data(for: request)

        let sessionCookies = cookies(from: loginResponse)
        guard sessionCookies.contains(where: { $0.name.hasSuffix("session-token") }) else {
            throw APIError.server(401, "Web-Login fehlgeschlagen")
        }
        return csrfCookies + sessionCookies
    }

    func logout() {
        session = nil
        Keychain.delete(account: Self.sessionAccount)
    }

    func fetchTasks() async throws -> [RemoteTask] {
        let data = try await send("GET", "/api/mobile/tasks")
        return try JSONDecoder().decode(TaskListResponse.self, from: data).tasks
    }

    func createTask(_ body: [String: Any]) async throws -> RemoteTask {
        let data = try await send("POST", "/api/tasks", body: body)
        return try JSONDecoder().decode(RemoteTask.self, from: data)
    }

    func updateTask(_ id: String, _ body: [String: Any]) async throws -> RemoteTask {
        let data = try await send("PATCH", "/api/tasks/\(id)", body: body)
        return try JSONDecoder().decode(RemoteTask.self, from: data)
    }

    func deleteTask(_ id: String) async throws {
        _ = try await send("DELETE", "/api/tasks/\(id)")
    }

    // MARK: - Private

    private func store(_ newSession: MobileSession) {
        session = newSession
        if let data = try? JSONEncoder().encode(newSession) {
            Keychain.save(data, account: Self.sessionAccount)
        }
    }

    private func refresh() async throws {
        guard let refreshToken = session?.refreshToken else { throw APIError.notLoggedIn }
        do {
            let data = try await send("POST", "/api/mobile/refresh", body: ["refreshToken": refreshToken], auth: false)
            store(try JSONDecoder().decode(MobileSession.self, from: data))
        } catch APIError.server(401, _) {
            logout()
            throw APIError.unauthorized
        }
    }

    private func send(_ method: String, _ path: String, body: [String: Any]? = nil, auth: Bool = true, retried: Bool = false) async throws -> Data {
        guard let baseURL, let url = URL(string: path, relativeTo: baseURL) else { throw APIError.invalidServerURL }

        if auth {
            guard let session else { throw APIError.notLoggedIn }
            if session.expiresAt - 60 < Date().timeIntervalSince1970 {
                try await refresh()
            }
        }

        var request = URLRequest(url: url)
        request.httpMethod = method
        request.timeoutInterval = 20
        if let body {
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try JSONSerialization.data(withJSONObject: body)
        }
        if auth, let token = session?.accessToken {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        let (data, response) = try await URLSession.shared.data(for: request)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0

        if status == 401 && auth && !retried {
            try await refresh()
            return try await send(method, path, body: body, auth: auth, retried: true)
        }
        guard (200..<300).contains(status) else {
            let message = (try? JSONSerialization.jsonObject(with: data) as? [String: Any])?["error"] as? String
            throw APIError.server(status, message ?? HTTPURLResponse.localizedString(forStatusCode: status))
        }
        return data
    }
}
