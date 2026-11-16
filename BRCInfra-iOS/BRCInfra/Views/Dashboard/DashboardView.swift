import SwiftUI

// MARK: - Premium Dashboard (Role-Aware)
struct PremiumDashboardView: View {
    @EnvironmentObject var dataStore: DataStore
    @EnvironmentObject var authStore: AuthStore
    @State private var partyFilter: BalanceFilter = .unpaid
    @State private var supplierFilter: BalanceFilter = .unpaid
    @State private var showProfile = false

    enum BalanceFilter: String, CaseIterable {
        case unpaid = "Unpaid"; case paid = "Paid"; case all = "All"
    }

    // MARK: - Computed
    var partyBalance: Double {
        switch partyFilter {
        case .unpaid: return dataStore.bills.filter { !$0.isPaid }.reduce(0) { $0 + max(0, $1.computedNet) }
        case .paid:   return dataStore.bills.filter {  $0.isPaid }.reduce(0) { $0 + $1.computedNet }
        case .all:    return dataStore.bills.reduce(0) { $0 + max(0, $1.computedNet) }
        }
    }
    var supplierBalance: Double {
        switch supplierFilter {
        case .unpaid: return dataStore.memos.filter { !$0.isPaid }.reduce(0) { $0 + max(0, $1.netAmount) }
        case .paid:   return dataStore.memos.filter {  $0.isPaid }.reduce(0) { $0 + $1.netAmount }
        case .all:    return dataStore.memos.reduce(0) { $0 + $1.netAmount }
        }
    }
    var totalRevenue: Double { dataStore.bills.reduce(0) { $0 + $1.billAmount } }
    var totalProfit: Double {
        dataStore.bills.reduce(0) { $0 + $1.computedNet } - dataStore.memos.reduce(0) { $0 + $1.netAmount }
    }
    var pendingBills: Int   { dataStore.bills.filter { !$0.isPaid }.count }
    var pendingMemos: Int   { dataStore.memos.filter { !$0.isPaid }.count }
    var activeVehicles: Int { dataStore.vehicles.count }
    var pendingLRs: Int     { dataStore.loadingSlips.filter { $0.memoNumber == nil || $0.memoNumber?.isEmpty == true }.count }

    var expiringVehicles: [(vehicle: Vehicle, doc: String, days: Int)] {
        var alerts: [(vehicle: Vehicle, doc: String, days: Int)] = []
        let today = Date()
        for v in dataStore.vehicles {
            let docs: [(String, String?)] = [
                ("Insurance", v.insuranceExpiry), ("Fitness", v.fitnessExpiry),
                ("Permit", v.permitExpiry), ("PUC", v.pucExpiry), ("Road Tax", v.taxExpiry)
            ]
            for (name, dateStr) in docs {
                guard let ds = dateStr, let d = parseDate(ds) else { continue }
                let diff = Calendar.current.dateComponents([.day], from: today, to: d).day ?? 0
                if diff <= 30 { alerts.append((v, name, diff)) }
            }
        }
        return alerts.sorted { $0.days < $1.days }
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 0) {
                // Hero Header
                heroHeader
                    .padding(.bottom, 20)

                VStack(spacing: 20) {
                    // KPI Cards
                    kpiSection
                    // Quick Stats Row
                    quickStatsRow
                    // Compliance Alerts
                    if !expiringVehicles.isEmpty { complianceSection }
                    // Recent Activity
                    if authStore.can(.viewBills) { recentBillsSection }
                    if authStore.can(.viewMemos) { recentMemosSection }
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 32)
            }
        }
        .background(Color(hex: "F1F5F9").ignoresSafeArea())
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .navigationBarLeading) {
                Button { dataStore.fetchAll() } label: {
                    Image(systemName: "arrow.clockwise")
                        .foregroundColor(authStore.role.accentColor)
                }
            }
            ToolbarItem(placement: .navigationBarTrailing) {
                Button { showProfile = true } label: {
                    HStack(spacing: 6) {
                        ZStack {
                            Circle()
                                .fill(authStore.role.accentColor.opacity(0.15))
                                .frame(width: 32, height: 32)
                            Image(systemName: authStore.role.icon)
                                .font(.system(size: 14, weight: .semibold))
                                .foregroundColor(authStore.role.accentColor)
                        }
                    }
                }
            }
        }
        .sheet(isPresented: $showProfile) { ProfileSheetView() }
        .refreshable { dataStore.fetchAll() }
    }

    // MARK: - Hero Header
    var heroHeader: some View {
        ZStack(alignment: .bottomLeading) {
            LinearGradient(
                colors: [authStore.role.accentColor, authStore.role.accentColor.opacity(0.75)],
                startPoint: .topLeading, endPoint: .bottomTrailing
            )
            .ignoresSafeArea(edges: .top)

            VStack(alignment: .leading, spacing: 6) {
                Text("Good \(timeOfDay()),")
                    .font(.system(size: 15, weight: .medium))
                    .foregroundColor(.white.opacity(0.85))
                Text(authStore.currentUser?.displayName ?? "User")
                    .font(.system(size: 26, weight: .bold, design: .rounded))
                    .foregroundColor(.white)
                HStack(spacing: 6) {
                    Image(systemName: authStore.role.icon)
                        .font(.caption)
                    Text(authStore.role.displayName)
                        .font(.caption)
                        .fontWeight(.semibold)
                }
                .padding(.horizontal, 10)
                .padding(.vertical, 4)
                .background(.white.opacity(0.2))
                .clipShape(Capsule())
                .foregroundColor(.white)
            }
            .padding(.horizontal, 20)
            .padding(.bottom, 24)
        }
        .frame(height: 160)
    }

    // MARK: - KPI Grid
    var kpiSection: some View {
        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
            if authStore.can(.viewProfitLoss) {
                KPICard(
                    title: "Net Profit",
                    value: totalProfit.inr(),
                    icon: "chart.line.uptrend.xyaxis",
                    color: totalProfit >= 0 ? Color(hex: "059669") : Color(hex: "DC2626"),
                    trend: totalProfit >= 0 ? "↑" : "↓"
                )
                KPICard(
                    title: "Total Revenue",
                    value: totalRevenue.inr(),
                    icon: "indianrupeesign.circle.fill",
                    color: Color(hex: "7C3AED"),
                    trend: nil
                )
            }
            if authStore.can(.viewBills) {
                BalanceKPICard(
                    title: "Party Balance",
                    value: partyBalance.inr(),
                    icon: "person.2.fill",
                    color: Color(hex: "1D4ED8"),
                    filter: $partyFilter
                )
            }
            if authStore.can(.viewMemos) {
                BalanceKPICard(
                    title: "Supplier Balance",
                    value: supplierBalance.inr(),
                    icon: "truck.box.fill",
                    color: Color(hex: "EA580C"),
                    filter: $supplierFilter
                )
            }
        }
    }

    // MARK: - Quick Stats
    var quickStatsRow: some View {
        HStack(spacing: 10) {
            QuickStatPill(label: "Pending Bills", value: "\(pendingBills)", color: Color(hex: "1D4ED8"), icon: "doc.text")
            QuickStatPill(label: "Pending Memos", value: "\(pendingMemos)", color: Color(hex: "EA580C"), icon: "receipt")
            QuickStatPill(label: "LRs Unbilled", value: "\(pendingLRs)", color: Color(hex: "7C3AED"), icon: "shippingbox")
        }
    }

    // MARK: - Compliance Section
    var complianceSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionHeader(title: "Vehicle Compliance", icon: "exclamationmark.triangle.fill", color: Color(hex: "D97706"), badge: "\(expiringVehicles.count)")
            ForEach(Array(expiringVehicles.prefix(5).enumerated()), id: \.offset) { _, alert in
                ComplianceRow(alert: alert)
            }
        }
        .premiumCard()
    }

    // MARK: - Recent Bills
    var recentBillsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionHeader(title: "Recent Bills", icon: "doc.text.fill", color: Color(hex: "1D4ED8"), badge: nil)
            if dataStore.bills.isEmpty {
                EmptyStateRow(message: "No bills yet")
            } else {
                ForEach(Array(dataStore.bills.prefix(5).enumerated()), id: \.offset) { _, bill in
                    RecentDocRow(
                        number: bill.billNumber,
                        party: bill.party,
                        date: bill.date.formattedDate(),
                        amount: bill.computedNet.inr(),
                        statusLabel: bill.statusLabel,
                        isPaid: bill.isPaid
                    )
                }
            }
        }
        .premiumCard()
    }

    // MARK: - Recent Memos
    var recentMemosSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionHeader(title: "Recent Memos", icon: "receipt.fill", color: Color(hex: "EA580C"), badge: nil)
            if dataStore.memos.isEmpty {
                EmptyStateRow(message: "No memos yet")
            } else {
                ForEach(Array(dataStore.memos.prefix(5).enumerated()), id: \.offset) { _, memo in
                    RecentDocRow(
                        number: memo.memoNumber,
                        party: memo.supplier,
                        date: memo.date.formattedDate(),
                        amount: memo.netAmount.inr(),
                        statusLabel: memo.statusLabel,
                        isPaid: memo.isPaid
                    )
                }
            }
        }
        .premiumCard()
    }

    private func timeOfDay() -> String {
        let h = Calendar.current.component(.hour, from: Date())
        if h < 12 { return "Morning" } else if h < 17 { return "Afternoon" } else { return "Evening" }
    }

    private func parseDate(_ s: String) -> Date? {
        let fmts = ["yyyy-MM-dd'T'HH:mm:ss.SSSZ", "yyyy-MM-dd'T'HH:mm:ssZ", "yyyy-MM-dd"]
        for fmt in fmts { let f = DateFormatter(); f.dateFormat = fmt; if let d = f.date(from: s) { return d } }
        return nil
    }
}

// MARK: - KPI Card
struct KPICard: View {
    let title: String; let value: String; let icon: String; let color: Color; let trend: String?
    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                ZStack {
                    RoundedRectangle(cornerRadius: 10).fill(color.opacity(0.12)).frame(width: 38, height: 38)
                    Image(systemName: icon).font(.system(size: 17, weight: .semibold)).foregroundColor(color)
                }
                Spacer()
                if let t = trend {
                    Text(t).font(.system(size: 14, weight: .bold)).foregroundColor(color)
                        .padding(5).background(color.opacity(0.12)).clipShape(Circle())
                }
            }
            Text(title).font(.system(size: 11, weight: .medium)).foregroundColor(Color(hex: "64748B")).lineLimit(1)
            Text(value).font(.system(size: 17, weight: .bold, design: .rounded)).foregroundColor(Color(hex: "0F172A")).lineLimit(1).minimumScaleFactor(0.6)
        }
        .padding(14).background(.white).cornerRadius(16)
        .shadow(color: .black.opacity(0.06), radius: 8, x: 0, y: 3)
    }
}

// MARK: - Balance KPI Card
struct BalanceKPICard: View {
    let title: String; let value: String; let icon: String; let color: Color
    @Binding var filter: PremiumDashboardView.BalanceFilter
    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                ZStack {
                    RoundedRectangle(cornerRadius: 10).fill(color.opacity(0.12)).frame(width: 38, height: 38)
                    Image(systemName: icon).font(.system(size: 17, weight: .semibold)).foregroundColor(color)
                }
                Spacer()
            }
            Text(title).font(.system(size: 11, weight: .medium)).foregroundColor(Color(hex: "64748B"))
            Text(value).font(.system(size: 17, weight: .bold, design: .rounded)).foregroundColor(Color(hex: "0F172A")).lineLimit(1).minimumScaleFactor(0.6)
            HStack(spacing: 4) {
                ForEach(PremiumDashboardView.BalanceFilter.allCases, id: \.self) { f in
                    Button { filter = f } label: {
                        Text(f.rawValue).font(.system(size: 9, weight: .bold))
                            .padding(.horizontal, 7).padding(.vertical, 3)
                            .background(filter == f ? color : Color(hex: "F1F5F9"))
                            .foregroundColor(filter == f ? .white : Color(hex: "64748B"))
                            .clipShape(Capsule())
                    }
                }
            }
        }
        .padding(14).background(.white).cornerRadius(16)
        .shadow(color: .black.opacity(0.06), radius: 8, x: 0, y: 3)
    }
}

// MARK: - Quick Stat Pill
struct QuickStatPill: View {
    let label: String; let value: String; let color: Color; let icon: String
    var body: some View {
        VStack(spacing: 6) {
            Image(systemName: icon).font(.system(size: 16, weight: .semibold)).foregroundColor(color)
            Text(value).font(.system(size: 18, weight: .bold, design: .rounded)).foregroundColor(Color(hex: "0F172A"))
            Text(label).font(.system(size: 9, weight: .medium)).foregroundColor(Color(hex: "64748B")).multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity).padding(.vertical, 12)
        .background(.white).cornerRadius(12)
        .shadow(color: .black.opacity(0.05), radius: 6, x: 0, y: 2)
    }
}

// MARK: - Section Header
struct SectionHeader: View {
    let title: String; let icon: String; let color: Color; let badge: String?
    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: icon).foregroundColor(color).font(.system(size: 15, weight: .semibold))
            Text(title).font(.system(size: 15, weight: .bold)).foregroundColor(Color(hex: "0F172A"))
            Spacer()
            if let b = badge {
                Text(b).font(.system(size: 11, weight: .bold)).padding(.horizontal, 8).padding(.vertical, 3)
                    .background(color).foregroundColor(.white).clipShape(Capsule())
            }
        }
    }
}

// MARK: - Compliance Row
struct ComplianceRow: View {
    let alert: (vehicle: Vehicle, doc: String, days: Int)
    var isExpired: Bool { alert.days < 0 }
    var rowColor: Color { isExpired ? Color(hex: "DC2626") : Color(hex: "D97706") }
    var body: some View {
        HStack(spacing: 10) {
            ZStack {
                Circle().fill(rowColor.opacity(0.1)).frame(width: 36, height: 36)
                Image(systemName: "car.fill").foregroundColor(rowColor).font(.system(size: 14))
            }
            VStack(alignment: .leading, spacing: 2) {
                Text(alert.vehicle.vehicleNo).font(.system(size: 13, weight: .semibold)).foregroundColor(Color(hex: "0F172A"))
                Text(alert.doc).font(.system(size: 11)).foregroundColor(Color(hex: "64748B"))
            }
            Spacer()
            Text(isExpired ? "Expired" : "\(alert.days)d left")
                .font(.system(size: 11, weight: .bold)).padding(.horizontal, 8).padding(.vertical, 4)
                .background(rowColor.opacity(0.12)).foregroundColor(rowColor).clipShape(Capsule())
        }
        .padding(.vertical, 4)
    }
}

// MARK: - Recent Doc Row
struct RecentDocRow: View {
    let number: String; let party: String; let date: String
    let amount: String; let statusLabel: String; let isPaid: Bool
    var statusColor: Color { isPaid ? Color(hex: "059669") : Color(hex: "D97706") }
    var body: some View {
        HStack(spacing: 10) {
            VStack(alignment: .leading, spacing: 3) {
                Text(number).font(.system(size: 13, weight: .bold)).foregroundColor(Color(hex: "0F172A"))
                Text(party).font(.system(size: 12)).foregroundColor(Color(hex: "475569"))
                Text(date).font(.system(size: 10)).foregroundColor(Color(hex: "94A3B8"))
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 4) {
                Text(amount).font(.system(size: 13, weight: .bold)).foregroundColor(Color(hex: "0F172A"))
                Text(statusLabel).font(.system(size: 10, weight: .semibold))
                    .padding(.horizontal, 7).padding(.vertical, 2)
                    .background(statusColor.opacity(0.12)).foregroundColor(statusColor).clipShape(Capsule())
            }
        }
        .padding(.vertical, 6)
        Divider().padding(.leading, 0)
    }
}

// MARK: - Empty State Row
struct EmptyStateRow: View {
    let message: String
    var body: some View {
        Text(message).font(.system(size: 13)).foregroundColor(Color(hex: "94A3B8"))
            .frame(maxWidth: .infinity).padding(.vertical, 12)
    }
}

// MARK: - Premium Card Modifier
extension View {
    func premiumCard() -> some View {
        self.padding(16).background(Color.white).cornerRadius(16)
            .shadow(color: .black.opacity(0.06), radius: 10, x: 0, y: 4)
    }
}

// MARK: - Profile Sheet
struct ProfileSheetView: View {
    @EnvironmentObject var authStore: AuthStore
    @Environment(\.dismiss) var dismiss
    var body: some View {
        NavigationStack {
            VStack(spacing: 24) {
                // Avatar
                ZStack {
                    Circle().fill(authStore.role.accentColor.opacity(0.12)).frame(width: 90, height: 90)
                    Image(systemName: authStore.role.icon)
                        .font(.system(size: 36, weight: .semibold)).foregroundColor(authStore.role.accentColor)
                }
                .padding(.top, 24)
                VStack(spacing: 6) {
                    Text(authStore.currentUser?.displayName ?? "User")
                        .font(.system(size: 22, weight: .bold, design: .rounded))
                    Text(authStore.role.displayName)
                        .font(.system(size: 14, weight: .semibold)).foregroundColor(authStore.role.accentColor)
                        .padding(.horizontal, 14).padding(.vertical, 5)
                        .background(authStore.role.accentColor.opacity(0.1)).clipShape(Capsule())
                    if let email = authStore.currentUser?.email {
                        Text(email).font(.system(size: 13)).foregroundColor(Color(hex: "64748B"))
                    }
                }

                // Permissions Summary
                VStack(alignment: .leading, spacing: 10) {
                    Text("Your Access Level").font(.system(size: 13, weight: .semibold)).foregroundColor(Color(hex: "64748B"))
                    permissionRow("View Dashboard", allowed: authStore.can(.viewDashboard))
                    permissionRow("Manage Bills", allowed: authStore.can(.createBill))
                    permissionRow("Manage Memos", allowed: authStore.can(.createMemo))
                    permissionRow("Loading Slips", allowed: authStore.can(.createLoadingSlip))
                    permissionRow("Banking & Cashbook", allowed: authStore.can(.viewBanking))
                    permissionRow("Ledgers", allowed: authStore.can(.viewLedgers))
                    permissionRow("User Management", allowed: authStore.can(.manageUsers))
                }
                .padding(16).background(Color(hex: "F8FAFC")).cornerRadius(14)
                .padding(.horizontal)

                Spacer()

                Button(role: .destructive) {
                    dismiss()
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) { authStore.logout() }
                } label: {
                    HStack { Image(systemName: "rectangle.portrait.and.arrow.right"); Text("Sign Out") }
                        .font(.system(size: 16, weight: .semibold))
                        .frame(maxWidth: .infinity).padding(14)
                        .background(Color(hex: "FEF2F2")).foregroundColor(Color(hex: "DC2626"))
                        .cornerRadius(12)
                }
                .padding(.horizontal).padding(.bottom, 32)
            }
            .navigationTitle("My Profile")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .navigationBarTrailing) { Button("Done") { dismiss() } } }
        }
    }

    func permissionRow(_ label: String, allowed: Bool) -> some View {
        HStack {
            Image(systemName: allowed ? "checkmark.circle.fill" : "xmark.circle.fill")
                .foregroundColor(allowed ? Color(hex: "059669") : Color(hex: "CBD5E1"))
                .font(.system(size: 15))
            Text(label).font(.system(size: 13))
            Spacer()
        }
    }
}

// MARK: - Original DashboardView (backward compat alias)
typealias DashboardView = PremiumDashboardView

#Preview {
    NavigationStack { PremiumDashboardView() }
        .environmentObject(DataStore())
        .environmentObject(AuthStore())
}
