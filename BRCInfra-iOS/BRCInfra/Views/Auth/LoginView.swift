import SwiftUI

struct LoginView: View {
    @EnvironmentObject var authStore: AuthStore
    @State private var username = ""
    @State private var password = ""
    @State private var showPassword = false
    @FocusState private var focusedField: Field?

    enum Field { case username, password }

    var body: some View {
        ZStack {
            // Premium dark gradient background
            LinearGradient(
                colors: [Color(hex: "0F172A"), Color(hex: "1E3A5F"), Color(hex: "0F172A")],
                startPoint: .topLeading, endPoint: .bottomTrailing
            )
            .ignoresSafeArea()

            // Decorative orbs
            GeometryReader { geo in
                Circle()
                    .fill(Color(hex: "2563EB").opacity(0.18))
                    .frame(width: 300, height: 300)
                    .blur(radius: 60)
                    .offset(x: -50, y: -100)
                Circle()
                    .fill(Color(hex: "7C3AED").opacity(0.14))
                    .frame(width: 250, height: 250)
                    .blur(radius: 60)
                    .offset(x: geo.size.width - 100, y: geo.size.height * 0.5)
            }
            .ignoresSafeArea()

            ScrollView {
                VStack(spacing: 0) {
                    Spacer(minLength: 60)

                    // Logo Section
                    VStack(spacing: 16) {
                        ZStack {
                            Circle()
                                .fill(.white.opacity(0.08))
                                .frame(width: 100, height: 100)
                            Circle()
                                .fill(.white.opacity(0.05))
                                .frame(width: 80, height: 80)
                            Image(systemName: "truck.box.fill")
                                .font(.system(size: 42, weight: .semibold))
                                .foregroundColor(.white)
                        }
                        VStack(spacing: 6) {
                            Text("BRC Infra")
                                .font(.system(size: 34, weight: .bold, design: .rounded))
                                .foregroundColor(.white)
                            Text("Transport Management System")
                                .font(.system(size: 14, weight: .medium))
                                .foregroundColor(.white.opacity(0.6))
                                .tracking(0.5)
                        }
                    }
                    .padding(.bottom, 48)

                    // Login Card
                    VStack(spacing: 0) {
                        VStack(spacing: 20) {
                            // Header
                            VStack(spacing: 6) {
                                Text("Welcome back")
                                    .font(.system(size: 22, weight: .bold))
                                    .foregroundColor(Color(hex: "0F172A"))
                                Text("Sign in to your account")
                                    .font(.system(size: 14))
                                    .foregroundColor(Color(hex: "64748B"))
                            }
                            .padding(.top, 4)

                            Divider()

                            // Username Field
                            VStack(alignment: .leading, spacing: 7) {
                                Label("Username", systemImage: "person.fill")
                                    .font(.system(size: 12, weight: .semibold))
                                    .foregroundColor(Color(hex: "475569"))
                                HStack(spacing: 10) {
                                    Image(systemName: "person.fill")
                                        .foregroundColor(Color(hex: "94A3B8"))
                                        .frame(width: 20)
                                    TextField("Enter your username", text: $username)
                                        .autocapitalization(.none)
                                        .autocorrectionDisabled()
                                        .focused($focusedField, equals: .username)
                                        .submitLabel(.next)
                                        .onSubmit { focusedField = .password }
                                        .font(.system(size: 15))
                                }
                                .padding(14)
                                .background(
                                    RoundedRectangle(cornerRadius: 12)
                                        .fill(Color(hex: "F8FAFC"))
                                        .overlay(
                                            RoundedRectangle(cornerRadius: 12)
                                                .stroke(focusedField == .username ? Color(hex: "2563EB") : Color(hex: "E2E8F0"), lineWidth: 1.5)
                                        )
                                )
                                .animation(.easeInOut(duration: 0.2), value: focusedField)
                            }

                            // Password Field
                            VStack(alignment: .leading, spacing: 7) {
                                Label("Password", systemImage: "lock.fill")
                                    .font(.system(size: 12, weight: .semibold))
                                    .foregroundColor(Color(hex: "475569"))
                                HStack(spacing: 10) {
                                    Image(systemName: "lock.fill")
                                        .foregroundColor(Color(hex: "94A3B8"))
                                        .frame(width: 20)
                                    Group {
                                        if showPassword {
                                            TextField("Enter your password", text: $password)
                                        } else {
                                            SecureField("Enter your password", text: $password)
                                        }
                                    }
                                    .focused($focusedField, equals: .password)
                                    .submitLabel(.done)
                                    .onSubmit { Task { await authStore.login(username: username, password: password) } }
                                    .font(.system(size: 15))

                                    Button {
                                        showPassword.toggle()
                                    } label: {
                                        Image(systemName: showPassword ? "eye.slash.fill" : "eye.fill")
                                            .foregroundColor(Color(hex: "94A3B8"))
                                            .font(.system(size: 14))
                                    }
                                }
                                .padding(14)
                                .background(
                                    RoundedRectangle(cornerRadius: 12)
                                        .fill(Color(hex: "F8FAFC"))
                                        .overlay(
                                            RoundedRectangle(cornerRadius: 12)
                                                .stroke(focusedField == .password ? Color(hex: "2563EB") : Color(hex: "E2E8F0"), lineWidth: 1.5)
                                        )
                                )
                                .animation(.easeInOut(duration: 0.2), value: focusedField)
                            }

                            // Error Message
                            if let err = authStore.errorMessage {
                                HStack(spacing: 8) {
                                    Image(systemName: "exclamationmark.circle.fill")
                                        .foregroundColor(Color(hex: "DC2626"))
                                        .font(.system(size: 14))
                                    Text(err)
                                        .font(.system(size: 13))
                                        .foregroundColor(Color(hex: "DC2626"))
                                }
                                .padding(12)
                                .background(Color(hex: "FEF2F2"))
                                .cornerRadius(10)
                            }

                            // Sign In Button
                            Button {
                                Task { await authStore.login(username: username, password: password) }
                            } label: {
                                HStack(spacing: 10) {
                                    if authStore.isLoading {
                                        ProgressView()
                                            .progressViewStyle(CircularProgressViewStyle(tint: .white))
                                            .scaleEffect(0.9)
                                    }
                                    Text(authStore.isLoading ? "Signing In..." : "Sign In")
                                        .font(.system(size: 16, weight: .bold))
                                }
                                .frame(maxWidth: .infinity)
                                .padding(15)
                                .background(
                                    Group {
                                        if authStore.isLoading || username.isEmpty || password.isEmpty {
                                            LinearGradient(colors: [Color(hex: "93C5FD"), Color(hex: "818CF8")], startPoint: .leading, endPoint: .trailing)
                                        } else {
                                            LinearGradient(colors: [Color(hex: "2563EB"), Color(hex: "4F46E5")], startPoint: .leading, endPoint: .trailing)
                                        }
                                    }
                                )
                                .foregroundColor(.white)
                                .cornerRadius(13)
                                .shadow(color: Color(hex: "2563EB").opacity(0.35), radius: 12, x: 0, y: 6)
                            }
                            .disabled(authStore.isLoading || username.isEmpty || password.isEmpty)
                            .animation(.easeInOut(duration: 0.2), value: authStore.isLoading)
                        }
                        .padding(28)
                    }
                    .background(Color.white)
                    .cornerRadius(24)
                    .shadow(color: .black.opacity(0.18), radius: 32, x: 0, y: 16)
                    .padding(.horizontal, 20)

                    Spacer(minLength: 48)

                    Text("BRC Shivansh Trailor Transport © 2026")
                        .font(.system(size: 11))
                        .foregroundColor(.white.opacity(0.35))
                        .padding(.bottom, 24)
                }
            }
        }
        .onTapGesture { focusedField = nil }
    }
}

// MARK: - Color Hex Extension (shared)
extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch hex.count {
        case 3: (a, r, g, b) = (255, (int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17)
        case 6: (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8: (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default: (a, r, g, b) = (255, 0, 0, 0)
        }
        self.init(.sRGB, red: Double(r)/255, green: Double(g)/255, blue: Double(b)/255, opacity: Double(a)/255)
    }
}

#Preview {
    LoginView().environmentObject(AuthStore())
}
