import SwiftUI

@main
struct BRCInfraApp: App {
    @StateObject private var authStore = AuthStore()
    @StateObject private var dataStore = DataStore()

    var body: some Scene {
        WindowGroup {
            if authStore.isLoggedIn {
                MainTabView()
                    .environmentObject(authStore)
                    .environmentObject(dataStore)
                    .onAppear { dataStore.fetchAll() }
            } else {
                LoginView()
                    .environmentObject(authStore)
            }
        }
    }
}
