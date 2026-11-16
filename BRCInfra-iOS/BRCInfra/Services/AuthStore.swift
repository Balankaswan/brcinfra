import Foundation
import Combine

// MARK: - Auth Models
struct LoginRequest: Encodable {
    let username: String
    let password: String
}

struct LoginResponse: Decodable {
    let token: String
    let user: UserProfile
}

struct UserProfile: Codable {
    var id: String
    var username: String
    var email: String?
    var role: String?
    var name: String?

    enum CodingKeys: String, CodingKey {
        case id, mongoId = "_id", username, email, role, name
    }

    init(id: String = "", username: String = "", email: String? = nil, role: String? = nil, name: String? = nil) {
        self.id = id; self.username = username; self.email = email; self.role = role; self.name = name
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        self.id = (try? c.decodeIfPresent(String.self, forKey: .id)) ?? (try? c.decodeIfPresent(String.self, forKey: .mongoId)) ?? UUID().uuidString
        self.username = (try? c.decodeIfPresent(String.self, forKey: .username)) ?? ""
        self.email = try? c.decodeIfPresent(String.self, forKey: .email)
        self.role  = try? c.decodeIfPresent(String.self, forKey: .role)
        self.name  = try? c.decodeIfPresent(String.self, forKey: .name)
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(id, forKey: .id)
        try c.encode(username, forKey: .username)
        try c.encodeIfPresent(email, forKey: .email)
        try c.encodeIfPresent(role,  forKey: .role)
        try c.encodeIfPresent(name,  forKey: .name)
    }

    /// Resolved UserRole from the string role field
    var resolvedRole: UserRole {
        guard let r = role?.lowercased().trimmingCharacters(in: .whitespaces) else { return .viewer }
        return UserRole(rawValue: r) ?? .viewer
    }

    var displayName: String { name ?? username }
}

// MARK: - Auth Store
@MainActor
class AuthStore: ObservableObject {
    @Published var isLoggedIn: Bool = false
    @Published var currentUser: UserProfile?
    @Published var isLoading: Bool = false
    @Published var errorMessage: String?

    private let api = APIService.shared

    // Convenience: current resolved role
    var role: UserRole { currentUser?.resolvedRole ?? .viewer }

    // Convenience: permission check
    func can(_ feature: Feature) -> Bool {
        PermissionService.can(role, feature)
    }

    init() {
        if let token = UserDefaults.standard.string(forKey: "authToken"), !token.isEmpty {
            isLoggedIn = true
            if let data = UserDefaults.standard.data(forKey: "currentUser"),
               let user = try? JSONDecoder().decode(UserProfile.self, from: data) {
                currentUser = user
            }
        }
    }

    func login(username: String, password: String) async {
        isLoading = true; errorMessage = nil
        do {
            let resp: LoginResponse = try await api.post("/auth/login", body: LoginRequest(username: username, password: password))
            UserDefaults.standard.set(resp.token, forKey: "authToken")
            if let data = try? JSONEncoder().encode(resp.user) {
                UserDefaults.standard.set(data, forKey: "currentUser")
            }
            currentUser = resp.user
            isLoggedIn = true
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }

    func logout() {
        UserDefaults.standard.removeObject(forKey: "authToken")
        UserDefaults.standard.removeObject(forKey: "currentUser")
        currentUser = nil
        isLoggedIn = false
    }
}
