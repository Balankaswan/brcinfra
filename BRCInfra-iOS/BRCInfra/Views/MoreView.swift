import SwiftUI

struct MoreView: View {
    @EnvironmentObject var authStore: AuthStore
    @EnvironmentObject var dataStore: DataStore

    var body: some View {
        List {
            // Profile Header Card
            Section {
                HStack(spacing: 14) {
                    ZStack {
                        Circle()
                            .fill(authStore.role.accentColor.opacity(0.12))
                            .frame(width: 52, height: 52)
                        Image(systemName: authStore.role.icon)
                            .font(.system(size: 22, weight: .semibold))
                            .foregroundColor(authStore.role.accentColor)
                    }
                    VStack(alignment: .leading, spacing: 4) {
                        Text(authStore.currentUser?.displayName ?? "User")
                            .font(.system(size: 16, weight: .bold))
                        HStack(spacing: 6) {
                            Text(authStore.role.displayName)
                                .font(.system(size: 11, weight: .semibold))
                                .padding(.horizontal, 8).padding(.vertical, 3)
                                .background(authStore.role.accentColor.opacity(0.1))
                                .foregroundColor(authStore.role.accentColor)
                                .clipShape(Capsule())
                            if let email = authStore.currentUser?.email {
                                Text(email).font(.system(size: 11)).foregroundColor(Color(hex: "64748B")).lineLimit(1)
                            }
                        }
                    }
                    Spacer()
                }
                .padding(.vertical, 4)
            }

            // Finance Section
            Section("Finance") {
                if authStore.can(.viewParties) {
                    NavigationLink(destination: PartiesListView()) {
                        MoreRow(icon: "person.2.fill", title: "Parties", color: .blue,
                                badge: "\(dataStore.parties.count)")
                    }
                }
                if authStore.can(.viewSuppliers) {
                    NavigationLink(destination: SuppliersListView()) {
                        MoreRow(icon: "truck.box.fill", title: "Suppliers", color: .orange,
                                badge: "\(dataStore.suppliers.count)")
                    }
                }
                if authStore.can(.viewBanking) {
                    NavigationLink(destination: BankingView(selectedTab: 0)) {
                        MoreRow(icon: "building.columns.fill", title: "Banking", color: .green)
                    }
                }
                if authStore.can(.viewCashbook) {
                    NavigationLink(destination: CashbookView()) {
                        MoreRow(icon: "dollarsign.circle.fill", title: "Cashbook", color: .teal)
                    }
                }
            }

            if authStore.can(.viewLedgers) {
                Section("Ledgers") {
                    NavigationLink(destination: PartyLedgerListView()) {
                        MoreRow(icon: "doc.text.fill", title: "Party Ledger", color: .indigo)
                    }
                    NavigationLink(destination: SupplierLedgerListView()) {
                        MoreRow(icon: "doc.text.fill", title: "Supplier Ledger", color: .purple)
                    }
                }
            }

            Section("Fleet") {
                if authStore.can(.viewFuel) {
                    NavigationLink(destination: FuelView()) {
                        MoreRow(icon: "fuelpump.fill", title: "Fuel Management", color: .red)
                    }
                }
                if authStore.can(.viewVehicles) {
                    NavigationLink(destination: VehiclesView()) {
                        MoreRow(icon: "car.fill", title: "Vehicles", color: .cyan,
                                badge: "\(dataStore.vehicles.count)")
                    }
                }
            }

            Section {
                Button(role: .destructive) {
                    authStore.logout()
                } label: {
                    MoreRow(icon: "rectangle.portrait.and.arrow.right", title: "Sign Out", color: .red)
                }
            }
        }
        .navigationTitle("More")
        .tint(authStore.role.accentColor)
    }
}

struct MoreRow: View {
    let icon: String
    let title: String
    let color: Color
    var badge: String? = nil
    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .font(.system(size: 16))
                .foregroundColor(.white)
                .frame(width: 32, height: 32)
                .background(color)
                .cornerRadius(8)
            Text(title).foregroundColor(.primary)
            Spacer()
            if let b = badge {
                Text(b).font(.caption).foregroundColor(.secondary)
                    .padding(.horizontal, 8).padding(.vertical, 2)
                    .background(Color(.systemGray5)).clipShape(Capsule())
            }
        }
    }
}

// MARK: - Cashbook View
struct CashbookView: View {
    @EnvironmentObject var dataStore: DataStore
    @State private var searchText = ""
    @State private var showCreate = false

    var filtered: [CashbookEntry] {
        guard !searchText.isEmpty else { return dataStore.cashbookEntries }
        return dataStore.cashbookEntries.filter {
            ($0.narration ?? "").localizedCaseInsensitiveContains(searchText) ||
            ($0.referenceName ?? "").localizedCaseInsensitiveContains(searchText) ||
            $0.category.localizedCaseInsensitiveContains(searchText)
        }
    }

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Cash in Hand").font(.caption).foregroundColor(.secondary)
                    Text(dataStore.cashBalance.inr()).font(.title2).fontWeight(.bold)
                        .foregroundColor(dataStore.cashBalance >= 0 ? .green : .red)
                }
                Spacer()
            }
            .padding(16)
            .background(Color.green.opacity(0.08))
            .cornerRadius(12)
            .padding(.horizontal, 16).padding(.top, 8)

            if filtered.isEmpty {
                ContentUnavailableView("No Cash Entries", systemImage: "dollarsign.circle")
            } else {
                List {
                    ForEach(filtered) { entry in
                        CashbookEntryRow(entry: entry)
                            .listRowInsets(EdgeInsets(top: 4, leading: 16, bottom: 4, trailing: 16))
                            .listRowSeparator(.hidden)
                            .swipeActions(edge: .trailing) {
                                Button(role: .destructive) {
                                    Task { try? await dataStore.deleteCashbookEntry(entry.id) }
                                } label: { Label("Delete", systemImage: "trash") }
                            }
                    }
                }
                .listStyle(.plain)
            }
        }
        .background(Color(.systemGroupedBackground))
        .navigationTitle("Cashbook")
        .searchable(text: $searchText, prompt: "Search cash entries")
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Button { showCreate = true } label: { Image(systemName: "plus") }
            }
        }
        .sheet(isPresented: $showCreate) {
            CreateCashbookEntryView().environmentObject(dataStore)
        }
        .refreshable { await dataStore.fetchCashbookEntries() }
    }
}

// MARK: - Fuel View
struct FuelView: View {
    @EnvironmentObject var dataStore: DataStore
    @State private var searchText = ""
    @State private var showCreate = false

    var totalFuelSpent: Double {
        dataStore.fuelEntries.reduce(0.0) { $0 + $1.amount }
    }

    var filtered: [FuelEntry] {
        guard !searchText.isEmpty else { return dataStore.fuelEntries }
        return dataStore.fuelEntries.filter {
            $0.vehicleNo.localizedCaseInsensitiveContains(searchText) ||
            ($0.station ?? "").localizedCaseInsensitiveContains(searchText)
        }
    }

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Total Fuel Expense").font(.caption).foregroundColor(.secondary)
                    Text(totalFuelSpent.inr()).font(.title2).fontWeight(.bold).foregroundColor(.red)
                }
                Spacer()
                Text("\(dataStore.fuelEntries.count) Entries").font(.subheadline).foregroundColor(.secondary)
            }
            .padding(16)
            .background(Color.red.opacity(0.08))
            .cornerRadius(12)
            .padding(.horizontal, 16).padding(.top, 8)

            if filtered.isEmpty {
                ContentUnavailableView("No Fuel Entries", systemImage: "fuelpump")
            } else {
                List {
                    ForEach(filtered) { entry in
                        FuelEntryRow(entry: entry)
                            .listRowInsets(EdgeInsets(top: 4, leading: 16, bottom: 4, trailing: 16))
                            .listRowSeparator(.hidden)
                    }
                }
                .listStyle(.plain)
            }
        }
        .background(Color(.systemGroupedBackground))
        .navigationTitle("Fuel Management")
        .searchable(text: $searchText, prompt: "Search by vehicle or pump")
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Button { showCreate = true } label: { Image(systemName: "plus") }
            }
        }
        .sheet(isPresented: $showCreate) {
            CreateFuelEntryView().environmentObject(dataStore)
        }
        .refreshable { await dataStore.fetchFuelEntries() }
    }
}

// MARK: - Vehicles View
struct VehiclesView: View {
    @EnvironmentObject var dataStore: DataStore
    @State private var searchText = ""
    @State private var showCreate = false

    var filtered: [Vehicle] {
        guard !searchText.isEmpty else { return dataStore.vehicles }
        return dataStore.vehicles.filter {
            $0.vehicleNo.localizedCaseInsensitiveContains(searchText) ||
            ($0.ownershipType ?? "").localizedCaseInsensitiveContains(searchText)
        }
    }

    var body: some View {
        Group {
            if filtered.isEmpty {
                ContentUnavailableView("No Vehicles", systemImage: "car")
            } else {
                List {
                    ForEach(filtered) { v in
                        VehicleRowView(vehicle: v)
                            .listRowInsets(EdgeInsets(top: 6, leading: 16, bottom: 6, trailing: 16))
                            .listRowSeparator(.hidden)
                    }
                }
                .listStyle(.plain)
            }
        }
        .background(Color(.systemGroupedBackground))
        .navigationTitle("Vehicles")
        .searchable(text: $searchText, prompt: "Search vehicle number")
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Button { showCreate = true } label: { Image(systemName: "plus") }
            }
        }
        .sheet(isPresented: $showCreate) {
            CreateVehicleView().environmentObject(dataStore)
        }
        .refreshable { await dataStore.fetchVehicles() }
    }
}

struct VehicleRowView: View {
    let vehicle: Vehicle
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(vehicle.vehicleNo).font(.headline).fontWeight(.bold)
                Spacer()
                Text(vehicle.isOwn ? "Own" : "Attached")
                    .font(.caption2).fontWeight(.semibold)
                    .padding(.horizontal, 8).padding(.vertical, 3)
                    .background(vehicle.isOwn ? Color.green.opacity(0.15) : Color.blue.opacity(0.15))
                    .foregroundColor(vehicle.isOwn ? .green : .blue)
                    .cornerRadius(6)
            }

            HStack(spacing: 12) {
                if let fit = vehicle.fitnessExpiry, !fit.isEmpty {
                    ExpiryTag(title: "Fitness", date: fit)
                }
                if let ins = vehicle.insuranceExpiry, !ins.isEmpty {
                    ExpiryTag(title: "Insurance", date: ins)
                }
                if let per = vehicle.permitExpiry, !per.isEmpty {
                    ExpiryTag(title: "Permit", date: per)
                }
            }
        }
        .padding(14).background(.white).cornerRadius(12)
        .shadow(color: .black.opacity(0.04), radius: 4, y: 1)
    }
}

struct ExpiryTag: View {
    let title: String
    let date: String
    var body: some View {
        VStack(alignment: .leading, spacing: 1) {
            Text(title).font(.system(size: 9)).foregroundColor(.secondary)
            Text(date.formattedDate()).font(.system(size: 11, weight: .medium))
        }
        .padding(.horizontal, 6).padding(.vertical, 3)
        .background(Color(.systemGray6)).cornerRadius(6)
    }
}

struct CreateVehicleView: View {
    @EnvironmentObject var dataStore: DataStore
    @Environment(\.dismiss) var dismiss

    @State private var vehicleNo = ""
    @State private var ownershipType = "own"
    @State private var fitnessExpiry = Date().addingTimeInterval(365 * 86400)
    @State private var insuranceExpiry = Date().addingTimeInterval(365 * 86400)
    @State private var permitExpiry = Date().addingTimeInterval(365 * 86400)
    @State private var pucExpiry = Date().addingTimeInterval(180 * 86400)
    @State private var taxExpiry = Date().addingTimeInterval(365 * 86400)
    @State private var isLoading = false
    @State private var errorMsg: String?

    var body: some View {
        NavigationStack {
            Form {
                Section("Vehicle Information") {
                    TextField("Vehicle No. (e.g. GJ01AB1234) *", text: $vehicleNo)
                    Picker("Ownership", selection: $ownershipType) {
                        Text("Own").tag("own")
                        Text("Attached").tag("attached")
                    }.pickerStyle(.segmented)
                }

                Section("Document Expiries") {
                    DatePicker("Fitness Expiry", selection: $fitnessExpiry, displayedComponents: .date)
                    DatePicker("Insurance Expiry", selection: $insuranceExpiry, displayedComponents: .date)
                    DatePicker("Permit Expiry", selection: $permitExpiry, displayedComponents: .date)
                    DatePicker("PUC Expiry", selection: $pucExpiry, displayedComponents: .date)
                    DatePicker("Tax Expiry", selection: $taxExpiry, displayedComponents: .date)
                }

                if let err = errorMsg {
                    Section { Text(err).foregroundColor(.red).font(.caption) }
                }
            }
            .navigationTitle("Add Vehicle")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { save() }
                        .disabled(isLoading || vehicleNo.trimmingCharacters(in: .whitespaces).isEmpty)
                        .fontWeight(.semibold)
                }
            }
        }
    }

    func save() {
        isLoading = true; errorMsg = nil
        let body: [String: Any] = [
            "vehicle_no": vehicleNo.uppercased().trimmingCharacters(in: .whitespaces),
            "ownership_type": ownershipType,
            "fitness_expiry": fitnessExpiry.toYMD().toISODate(),
            "insurance_expiry": insuranceExpiry.toYMD().toISODate(),
            "permit_expiry": permitExpiry.toYMD().toISODate(),
            "puc_expiry": pucExpiry.toYMD().toISODate(),
            "tax_expiry": taxExpiry.toYMD().toISODate()
        ]
        Task {
            do {
                _ = try await dataStore.createVehicle(body: body)
                await MainActor.run { dismiss() }
            } catch {
                await MainActor.run { errorMsg = error.localizedDescription; isLoading = false }
            }
        }
    }
}

// MARK: - Party Ledger List & Detail
struct PartyLedgerListView: View {
    @EnvironmentObject var dataStore: DataStore
    @State private var searchText = ""

    var partyList: [(name: String, outstanding: Double)] {
        var names = Set<String>()
        dataStore.parties.forEach { names.insert($0.name) }
        dataStore.bills.forEach { if !$0.party.isEmpty { names.insert($0.party) } }

        return names.map { partyName in
            let partyBills = dataStore.bills.filter { $0.party == partyName }
            let billed = partyBills.reduce(0.0) { $0 + max(0, $1.computedNet) }

            let bankPaid = dataStore.bankingEntries.filter {
                $0.referenceName?.lowercased() == partyName.lowercased() &&
                ($0.category == "bill_payment" || $0.category == "party_payment" || $0.category == "party_on_account")
            }.reduce(0.0) { $0 + $1.amount }

            let cashPaid = dataStore.cashbookEntries.filter {
                $0.referenceName?.lowercased() == partyName.lowercased() &&
                ($0.category == "bill_payment" || $0.category == "party_payment" || $0.category == "party_on_account")
            }.reduce(0.0) { $0 + $1.amount }

            let balance = billed - (bankPaid + cashPaid)
            return (name: partyName, outstanding: balance)
        }
        .filter { searchText.isEmpty || $0.name.localizedCaseInsensitiveContains(searchText) }
        .sorted { $0.outstanding > $1.outstanding }
    }

    var body: some View {
        Group {
            if partyList.isEmpty {
                ContentUnavailableView("No Parties", systemImage: "doc.text")
            } else {
                List(partyList, id: \.name) { item in
                    NavigationLink(destination: PartyLedgerDetailView(partyName: item.name)) {
                        HStack {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(item.name).font(.headline)
                                Text("Party Statement").font(.caption).foregroundColor(.secondary)
                            }
                            Spacer()
                            VStack(alignment: .trailing, spacing: 4) {
                                Text(item.outstanding.inr())
                                    .font(.subheadline).fontWeight(.bold)
                                    .foregroundColor(item.outstanding > 0 ? .red : .green)
                                Text(item.outstanding > 0 ? "Receivable" : "Settled")
                                    .font(.caption2).foregroundColor(.secondary)
                            }
                        }
                        .padding(.vertical, 4)
                    }
                }
            }
        }
        .navigationTitle("Party Ledgers")
        .searchable(text: $searchText, prompt: "Search party name")
    }
}

struct LedgerRowItem: Identifiable {
    let id: String
    let date: String
    let type: String
    let reference: String
    let debit: Double
    let credit: Double
    let runningBalance: Double
}

struct PartyLedgerDetailView: View {
    let partyName: String
    @EnvironmentObject var dataStore: DataStore

    var transactions: [LedgerRowItem] {
        var raw: [(date: String, type: String, ref: String, debit: Double, credit: Double)] = []

        let partyBills = dataStore.bills.filter { $0.party == partyName }
        for b in partyBills {
            raw.append((date: b.date, type: "Bill", ref: "Bill #\(b.billNumber)", debit: b.computedNet, credit: 0))
        }

        let bankPayments = dataStore.bankingEntries.filter {
            $0.referenceName?.lowercased() == partyName.lowercased() &&
            ($0.category == "bill_payment" || $0.category == "party_payment" || $0.category == "party_on_account")
        }
        for p in bankPayments {
            raw.append((date: p.date, type: "Bank Pay", ref: p.referenceId ?? "Bank", debit: 0, credit: p.amount))
        }

        let cashPayments = dataStore.cashbookEntries.filter {
            $0.referenceName?.lowercased() == partyName.lowercased() &&
            ($0.category == "bill_payment" || $0.category == "party_payment" || $0.category == "party_on_account")
        }
        for c in cashPayments {
            raw.append((date: c.date, type: "Cash Pay", ref: c.referenceId ?? "Cash", debit: 0, credit: c.amount))
        }

        // Sort chronologically
        raw.sort { $0.date < $1.date }

        var running = 0.0
        var result: [LedgerRowItem] = []
        for (i, r) in raw.enumerated() {
            running += (r.debit - r.credit)
            result.append(LedgerRowItem(
                id: "\(i)-\(r.ref)",
                date: r.date,
                type: r.type,
                reference: r.ref,
                debit: r.debit,
                credit: r.credit,
                runningBalance: running
            ))
        }
        return result.reversed() // show newest on top
    }

    var totalBilled: Double { transactions.reduce(0.0) { $0 + $1.debit } }
    var totalPaid: Double { transactions.reduce(0.0) { $0 + $1.credit } }
    var currentBalance: Double { totalBilled - totalPaid }

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                // Header Summary Card
                VStack(spacing: 12) {
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Total Invoiced").font(.caption).foregroundColor(.secondary)
                            Text(totalBilled.inr()).font(.headline).fontWeight(.semibold)
                        }
                        Spacer()
                        VStack(alignment: .trailing, spacing: 2) {
                            Text("Total Received").font(.caption).foregroundColor(.secondary)
                            Text(totalPaid.inr()).font(.headline).fontWeight(.semibold).foregroundColor(.green)
                        }
                    }
                    Divider()
                    HStack {
                        Text("Net Outstanding").font(.subheadline).fontWeight(.medium)
                        Spacer()
                        Text(currentBalance.inr()).font(.title3).fontWeight(.bold)
                            .foregroundColor(currentBalance > 0 ? .red : .green)
                    }
                }
                .padding(16).background(.white).cornerRadius(16)
                .shadow(color: .black.opacity(0.04), radius: 6, y: 2)

                // Transactions
                if transactions.isEmpty {
                    ContentUnavailableView("No Transactions", systemImage: "doc.text")
                        .padding(.top, 40)
                } else {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Ledger Statement (\(transactions.count))")
                            .font(.headline).padding(.horizontal, 4)

                        ForEach(transactions) { item in
                            HStack(alignment: .top) {
                                VStack(alignment: .leading, spacing: 3) {
                                    HStack {
                                        Text(item.reference).font(.subheadline).fontWeight(.semibold)
                                        Text(item.type)
                                            .font(.caption2).fontWeight(.medium)
                                            .padding(.horizontal, 6).padding(.vertical, 1)
                                            .background(item.debit > 0 ? Color.blue.opacity(0.12) : Color.green.opacity(0.12))
                                            .foregroundColor(item.debit > 0 ? .blue : .green)
                                            .cornerRadius(4)
                                    }
                                    Text(item.date.formattedDate()).font(.caption2).foregroundColor(.secondary)
                                }
                                Spacer()
                                VStack(alignment: .trailing, spacing: 3) {
                                    if item.debit > 0 {
                                        Text("+ \(item.debit.inr())").font(.subheadline).fontWeight(.bold).foregroundColor(.blue)
                                    } else {
                                        Text("- \(item.credit.inr())").font(.subheadline).fontWeight(.bold).foregroundColor(.green)
                                    }
                                    Text("Bal: \(item.runningBalance.inr())").font(.caption2).foregroundColor(.secondary)
                                }
                            }
                            .padding(12).background(.white).cornerRadius(12)
                            .shadow(color: .black.opacity(0.03), radius: 3, y: 1)
                        }
                    }
                }
            }
            .padding(16)
        }
        .background(Color(.systemGroupedBackground))
        .navigationTitle(partyName)
        .navigationBarTitleDisplayMode(.inline)
    }
}

// MARK: - Supplier Ledger List & Detail
struct SupplierLedgerListView: View {
    @EnvironmentObject var dataStore: DataStore
    @State private var searchText = ""

    var supplierList: [(name: String, pending: Double)] {
        var names = Set<String>()
        dataStore.suppliers.forEach { names.insert($0.name) }
        dataStore.memos.forEach { if !$0.supplier.isEmpty { names.insert($0.supplier) } }

        return names.map { supplierName in
            let supplierMemos = dataStore.memos.filter { $0.supplier == supplierName }
            let memoFreight = supplierMemos.reduce(0.0) { $0 + max(0, $1.netAmount) }

            let bankPaid = dataStore.bankingEntries.filter {
                $0.referenceName?.lowercased() == supplierName.lowercased() &&
                ($0.category == "supplier_payment" || $0.category == "memo_advance")
            }.reduce(0.0) { $0 + $1.amount }

            let cashPaid = dataStore.cashbookEntries.filter {
                $0.referenceName?.lowercased() == supplierName.lowercased() &&
                ($0.category == "supplier_payment" || $0.category == "memo_advance")
            }.reduce(0.0) { $0 + $1.amount }

            let balance = memoFreight - (bankPaid + cashPaid)
            return (name: supplierName, pending: balance)
        }
        .filter { searchText.isEmpty || $0.name.localizedCaseInsensitiveContains(searchText) }
        .sorted { $0.pending > $1.pending }
    }

    var body: some View {
        Group {
            if supplierList.isEmpty {
                ContentUnavailableView("No Suppliers", systemImage: "doc.text")
            } else {
                List(supplierList, id: \.name) { item in
                    NavigationLink(destination: SupplierLedgerDetailView(supplierName: item.name)) {
                        HStack {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(item.name).font(.headline)
                                Text("Supplier Statement").font(.caption).foregroundColor(.secondary)
                            }
                            Spacer()
                            VStack(alignment: .trailing, spacing: 4) {
                                Text(item.pending.inr())
                                    .font(.subheadline).fontWeight(.bold)
                                    .foregroundColor(item.pending > 0 ? .orange : .green)
                                Text(item.pending > 0 ? "Payable" : "Settled")
                                    .font(.caption2).foregroundColor(.secondary)
                            }
                        }
                        .padding(.vertical, 4)
                    }
                }
            }
        }
        .navigationTitle("Supplier Ledgers")
        .searchable(text: $searchText, prompt: "Search supplier name")
    }
}

struct SupplierLedgerDetailView: View {
    let supplierName: String
    @EnvironmentObject var dataStore: DataStore

    var transactions: [LedgerRowItem] {
        var raw: [(date: String, type: String, ref: String, debit: Double, credit: Double)] = []

        let supplierMemos = dataStore.memos.filter { $0.supplier == supplierName }
        for m in supplierMemos {
            raw.append((date: m.date, type: "Memo", ref: "Memo #\(m.memoNumber)", debit: 0, credit: m.netAmount))
        }

        let bankPayments = dataStore.bankingEntries.filter {
            $0.referenceName?.lowercased() == supplierName.lowercased() &&
            ($0.category == "supplier_payment" || $0.category == "memo_advance")
        }
        for p in bankPayments {
            raw.append((date: p.date, type: "Bank Pay", ref: p.referenceId ?? "Bank", debit: p.amount, credit: 0))
        }

        let cashPayments = dataStore.cashbookEntries.filter {
            $0.referenceName?.lowercased() == supplierName.lowercased() &&
            ($0.category == "supplier_payment" || $0.category == "memo_advance")
        }
        for c in cashPayments {
            raw.append((date: c.date, type: "Cash Pay", ref: c.referenceId ?? "Cash", debit: c.amount, credit: 0))
        }

        // Sort chronologically
        raw.sort { $0.date < $1.date }

        var running = 0.0
        var result: [LedgerRowItem] = []
        for (i, r) in raw.enumerated() {
            // For supplier ledger: Memo (Credit) increases payable, Payment (Debit) decreases payable
            running += (r.credit - r.debit)
            result.append(LedgerRowItem(
                id: "\(i)-\(r.ref)",
                date: r.date,
                type: r.type,
                reference: r.ref,
                debit: r.debit,
                credit: r.credit,
                runningBalance: running
            ))
        }
        return result.reversed() // show newest on top
    }

    var totalMemos: Double { transactions.reduce(0.0) { $0 + $1.credit } }
    var totalPaid: Double { transactions.reduce(0.0) { $0 + $1.debit } }
    var currentBalance: Double { totalMemos - totalPaid }

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                // Header Summary Card
                VStack(spacing: 12) {
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Total Memos").font(.caption).foregroundColor(.secondary)
                            Text(totalMemos.inr()).font(.headline).fontWeight(.semibold)
                        }
                        Spacer()
                        VStack(alignment: .trailing, spacing: 2) {
                            Text("Total Paid").font(.caption).foregroundColor(.secondary)
                            Text(totalPaid.inr()).font(.headline).fontWeight(.semibold).foregroundColor(.green)
                        }
                    }
                    Divider()
                    HStack {
                        Text("Net Payable").font(.subheadline).fontWeight(.medium)
                        Spacer()
                        Text(currentBalance.inr()).font(.title3).fontWeight(.bold)
                            .foregroundColor(currentBalance > 0 ? .orange : .green)
                    }
                }
                .padding(16).background(.white).cornerRadius(16)
                .shadow(color: .black.opacity(0.04), radius: 6, y: 2)

                // Transactions
                if transactions.isEmpty {
                    ContentUnavailableView("No Transactions", systemImage: "doc.text")
                        .padding(.top, 40)
                } else {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Ledger Statement (\(transactions.count))")
                            .font(.headline).padding(.horizontal, 4)

                        ForEach(transactions) { item in
                            HStack(alignment: .top) {
                                VStack(alignment: .leading, spacing: 3) {
                                    HStack {
                                        Text(item.reference).font(.subheadline).fontWeight(.semibold)
                                        Text(item.type)
                                            .font(.caption2).fontWeight(.medium)
                                            .padding(.horizontal, 6).padding(.vertical, 1)
                                            .background(item.credit > 0 ? Color.orange.opacity(0.12) : Color.green.opacity(0.12))
                                            .foregroundColor(item.credit > 0 ? .orange : .green)
                                            .cornerRadius(4)
                                    }
                                    Text(item.date.formattedDate()).font(.caption2).foregroundColor(.secondary)
                                }
                                Spacer()
                                VStack(alignment: .trailing, spacing: 3) {
                                    if item.credit > 0 {
                                        Text("+ \(item.credit.inr())").font(.subheadline).fontWeight(.bold).foregroundColor(.orange)
                                    } else {
                                        Text("- \(item.debit.inr())").font(.subheadline).fontWeight(.bold).foregroundColor(.green)
                                    }
                                    Text("Bal: \(item.runningBalance.inr())").font(.caption2).foregroundColor(.secondary)
                                }
                            }
                            .padding(12).background(.white).cornerRadius(12)
                            .shadow(color: .black.opacity(0.03), radius: 3, y: 1)
                        }
                    }
                }
            }
            .padding(16)
        }
        .background(Color(.systemGroupedBackground))
        .navigationTitle(supplierName)
        .navigationBarTitleDisplayMode(.inline)
    }
}
