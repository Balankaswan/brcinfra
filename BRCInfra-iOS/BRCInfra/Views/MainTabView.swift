import SwiftUI

// MARK: - Design Tokens
struct BRCDesign {
    // Brand colors
    static let primaryBlue   = Color(hex: "1D4ED8")
    static let accentIndigo  = Color(hex: "4F46E5")
    static let surfaceWhite  = Color.white
    static let bgGrouped     = Color(hex: "F1F5F9")
    static let cardBg        = Color.white

    // Semantic
    static let success = Color(hex: "059669")
    static let warning = Color(hex: "D97706")
    static let danger  = Color(hex: "DC2626")
    static let info    = Color(hex: "0369A1")

    // Typography
    static func heading(_ size: CGFloat = 24) -> Font { .system(size: size, weight: .bold, design: .rounded) }
    static func subheading(_ size: CGFloat = 17) -> Font { .system(size: size, weight: .semibold, design: .rounded) }
    static func body(_ size: CGFloat = 15) -> Font { .system(size: size, weight: .regular) }
    static func caption(_ size: CGFloat = 12) -> Font { .system(size: size, weight: .medium) }

    // Shadows
    static func cardShadow() -> some View {
        Color.clear.shadow(color: .black.opacity(0.07), radius: 12, x: 0, y: 4)
    }
}

// MARK: - Role Accent Color helper
extension UserRole {
    var accentColor: Color { Color(hex: accentHex) }
}

// MARK: - Main Tab View
struct MainTabView: View {
    @EnvironmentObject var authStore: AuthStore
    @EnvironmentObject var dataStore: DataStore
    @State private var selectedTab: Int = 0

    var body: some View {
        TabView(selection: $selectedTab) {
            NavigationStack {
                PremiumDashboardView()
            }
            .tabItem { Label("Dashboard", systemImage: "square.grid.2x2.fill") }
            .tag(0)

            if authStore.can(.viewLoadingSlips) {
                NavigationStack {
                    LoadingSlipsView()
                }
                .tabItem { Label("LR / Slips", systemImage: "shippingbox.fill") }
                .tag(1)
            }

            if authStore.can(.viewBills) {
                NavigationStack {
                    BillsListView()
                }
                .tabItem { Label("Bills", systemImage: "doc.text.fill") }
                .tag(2)
            }

            if authStore.can(.viewMemos) {
                NavigationStack {
                    MemosListView()
                }
                .tabItem { Label("Memos", systemImage: "receipt.fill") }
                .tag(3)
            }

            NavigationStack {
                MoreView()
            }
            .tabItem { Label("More", systemImage: "ellipsis.circle.fill") }
            .tag(4)
        }
        .tint(authStore.role.accentColor)
    }
}
