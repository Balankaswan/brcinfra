import SwiftUI

struct BankingView: View {
    @EnvironmentObject var dataStore: DataStore
    @State private var selectedTab: Int
    @State private var showCreateBank = false
    @State private var showCreateCash = false
    @State private var showCreateFuel = false
    @State private var searchText = ""

    init(selectedTab: Int = 0) {
        _selectedTab = State(initialValue: selectedTab)
    }

    var filteredBank: [BankingEntry] {
        guard !searchText.isEmpty else { return dataStore.bankingEntries }
        return dataStore.bankingEntries.filter {
            ($0.narration ?? "").localizedCaseInsensitiveContains(searchText) ||
            ($0.referenceName ?? "").localizedCaseInsensitiveContains(searchText) ||
            $0.category.localizedCaseInsensitiveContains(searchText)
        }
    }

    var filteredCash: [CashbookEntry] {
        guard !searchText.isEmpty else { return dataStore.cashbookEntries }
        return dataStore.cashbookEntries.filter {
            ($0.narration ?? "").localizedCaseInsensitiveContains(searchText) ||
            ($0.referenceName ?? "").localizedCaseInsensitiveContains(searchText) ||
            $0.category.localizedCaseInsensitiveContains(searchText)
        }
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Balance cards
                HStack(spacing: 12) {
                    BalanceCardSmall(title: "Bank Balance", amount: dataStore.bankBalance, color: .blue)
                    BalanceCardSmall(title: "Cash Balance", amount: dataStore.cashBalance, color: .green)
                }.padding(.horizontal, 16).padding(.vertical, 10)

                Picker("", selection: $selectedTab) {
                    Text("Bank").tag(0)
                    Text("Cash").tag(1)
                    Text("Fuel").tag(2)
                }.pickerStyle(.segmented).padding(.horizontal, 16).padding(.bottom, 8)

                if selectedTab == 0 {
                    bankList
                } else if selectedTab == 1 {
                    cashList
                } else {
                    fuelList
                }
            }
            .background(Color(.systemGroupedBackground))
            .navigationTitle("Banking & Cash")
            .searchable(text: $searchText, prompt: "Search entries")
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button {
                        if selectedTab == 0 { showCreateBank = true }
                        else if selectedTab == 1 { showCreateCash = true }
                        else { showCreateFuel = true }
                    } label: { Image(systemName: "plus") }
                }
            }
            .sheet(isPresented: $showCreateBank) {
                CreateBankingEntryView().environmentObject(dataStore)
            }
            .sheet(isPresented: $showCreateCash) {
                CreateCashbookEntryView().environmentObject(dataStore)
            }
            .sheet(isPresented: $showCreateFuel) {
                CreateFuelEntryView().environmentObject(dataStore)
            }
            .refreshable {
                await dataStore.fetchBankingEntries()
                await dataStore.fetchCashbookEntries()
                await dataStore.fetchFuelEntries()
            }
        }
    }

    var bankList: some View {
        Group {
            if filteredBank.isEmpty {
                ContentUnavailableView("No Bank Entries", systemImage: "building.columns")
            } else {
                List {
                    ForEach(filteredBank) { entry in
                        BankingEntryRow(entry: entry)
                            .listRowInsets(EdgeInsets(top: 4, leading: 16, bottom: 4, trailing: 16))
                            .listRowSeparator(.hidden)
                            .swipeActions(edge: .trailing) {
                                Button(role: .destructive) {
                                    Task { try? await dataStore.deleteBankingEntry(entry.id) }
                                } label: { Label("Delete", systemImage: "trash") }
                            }
                    }
                }.listStyle(.plain)
            }
        }
    }

    var cashList: some View {
        Group {
            if filteredCash.isEmpty {
                ContentUnavailableView("No Cash Entries", systemImage: "banknote")
            } else {
                List {
                    ForEach(filteredCash) { entry in
                        CashbookEntryRow(entry: entry)
                            .listRowInsets(EdgeInsets(top: 4, leading: 16, bottom: 4, trailing: 16))
                            .listRowSeparator(.hidden)
                            .swipeActions(edge: .trailing) {
                                Button(role: .destructive) {
                                    Task { try? await dataStore.deleteCashbookEntry(entry.id) }
                                } label: { Label("Delete", systemImage: "trash") }
                            }
                    }
                }.listStyle(.plain)
            }
        }
    }

    var fuelList: some View {
        Group {
            if dataStore.fuelEntries.isEmpty {
                ContentUnavailableView("No Fuel Entries", systemImage: "fuelpump")
            } else {
                List {
                    ForEach(dataStore.fuelEntries) { entry in
                        FuelEntryRow(entry: entry)
                            .listRowInsets(EdgeInsets(top: 4, leading: 16, bottom: 4, trailing: 16))
                            .listRowSeparator(.hidden)
                    }
                }.listStyle(.plain)
            }
        }
    }
}

struct BalanceCardSmall: View {
    let title: String; let amount: Double; let color: Color
    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(title).font(.caption).foregroundColor(.secondary)
            Text(amount.inr()).font(.title3).fontWeight(.bold).foregroundColor(amount >= 0 ? color : .red)
        }
        .padding(10).frame(maxWidth: .infinity, alignment: .leading)
        .background(color.opacity(0.08)).cornerRadius(10)
    }
}

struct BankingEntryRow: View {
    let entry: BankingEntry
    var body: some View {
        HStack {
            Image(systemName: entry.type == "credit" ? "arrow.down.circle.fill" : "arrow.up.circle.fill")
                .foregroundColor(entry.type == "credit" ? .green : .red).font(.title2)
            VStack(alignment: .leading, spacing: 2) {
                Text(entry.category.replacingOccurrences(of: "_", with: " ").capitalized)
                    .font(.subheadline).fontWeight(.semibold)
                if let n = entry.narration { Text(n).font(.caption).foregroundColor(.secondary).lineLimit(1) }
                Text(entry.date.formattedDate()).font(.caption2).foregroundColor(.secondary)
            }
            Spacer()
            Text(entry.amount.inr())
                .font(.subheadline).fontWeight(.bold)
                .foregroundColor(entry.type == "credit" ? .green : .red)
        }
        .padding(10).background(.white).cornerRadius(10)
        .shadow(color: .black.opacity(0.04), radius: 3, y: 1)
    }
}

struct CashbookEntryRow: View {
    let entry: CashbookEntry
    var body: some View {
        HStack {
            Image(systemName: entry.type == "credit" ? "arrow.down.circle.fill" : "arrow.up.circle.fill")
                .foregroundColor(entry.type == "credit" ? .green : .red).font(.title2)
            VStack(alignment: .leading, spacing: 2) {
                Text(entry.category.replacingOccurrences(of: "_", with: " ").capitalized)
                    .font(.subheadline).fontWeight(.semibold)
                if let n = entry.narration { Text(n).font(.caption).foregroundColor(.secondary).lineLimit(1) }
                Text(entry.date.formattedDate()).font(.caption2).foregroundColor(.secondary)
            }
            Spacer()
            Text(entry.amount.inr())
                .font(.subheadline).fontWeight(.bold)
                .foregroundColor(entry.type == "credit" ? .green : .red)
        }
        .padding(10).background(.white).cornerRadius(10)
        .shadow(color: .black.opacity(0.04), radius: 3, y: 1)
    }
}

struct FuelEntryRow: View {
    let entry: FuelEntry
    var body: some View {
        HStack {
            Image(systemName: "fuelpump.fill").foregroundColor(.orange).font(.title2)
            VStack(alignment: .leading, spacing: 2) {
                Text(entry.vehicleNo).font(.subheadline).fontWeight(.semibold)
                if let l = entry.liters { Text("\(String(format: "%.1f", l)) L").font(.caption).foregroundColor(.secondary) }
                Text(entry.date.formattedDate()).font(.caption2).foregroundColor(.secondary)
            }
            Spacer()
            Text(entry.amount.inr()).font(.subheadline).fontWeight(.bold).foregroundColor(.orange)
        }
        .padding(10).background(.white).cornerRadius(10)
        .shadow(color: .black.opacity(0.04), radius: 3, y: 1)
    }
}

// MARK: - Banking Categories
let bankingCategories = ["party_payment", "supplier_payment", "memo_advance", "bill_payment",
    "party_commission", "fuel_wallet", "salary", "rent", "maintenance", "other"]
let cashbookCategories = ["party_payment", "supplier_payment", "memo_advance", "bill_payment",
    "party_on_account", "salary", "rent", "petty_cash", "fuel", "maintenance", "other"]

// MARK: - Create Banking Entry
struct CreateBankingEntryView: View {
    @EnvironmentObject var dataStore: DataStore
    @Environment(\.dismiss) var dismiss

    @State private var date = Date()
    @State private var type = "credit"
    @State private var category = "other"
    @State private var amount = ""
    @State private var narration = ""
    @State private var referenceName = ""
    @State private var referenceId = ""
    @State private var isLoading = false
    @State private var errorMsg: String?

    var body: some View {
        NavigationStack {
            Form {
                Section("Entry Details") {
                    DatePicker("Date", selection: $date, displayedComponents: .date)
                    Picker("Type", selection: $type) {
                        Text("Credit (Received)").tag("credit")
                        Text("Debit (Paid Out)").tag("debit")
                    }.pickerStyle(.segmented)
                    Picker("Category", selection: $category) {
                        ForEach(bankingCategories, id: \.self) { cat in
                            Text(cat.replacingOccurrences(of: "_", with: " ").capitalized).tag(cat)
                        }
                    }
                    TextField("Amount (₹) *", text: $amount).keyboardType(.decimalPad)
                }

                Section("Reference") {
                    TextField("Reference Name (Party/Supplier)", text: $referenceName)
                    TextField("Reference ID / Doc No.", text: $referenceId)
                }

                Section("Narration") {
                    TextField("Description / Narration", text: $narration, axis: .vertical).lineLimit(2...4)
                }

                if let err = errorMsg {
                    Section { Text(err).foregroundColor(.red).font(.caption) }
                }
            }
            .navigationTitle("New Bank Entry")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { save() }
                        .disabled(isLoading || amount.isEmpty)
                        .fontWeight(.semibold)
                }
            }
        }
    }

    func save() {
        guard let amt = Double(amount), amt > 0 else { errorMsg = "Enter a valid amount."; return }
        isLoading = true; errorMsg = nil
        var body: [String: Any] = [
            "date": date.toYMD().toISODate(),
            "type": type,
            "category": category,
            "amount": amt
        ]
        if !narration.isEmpty { body["narration"] = narration }
        if !referenceName.isEmpty { body["reference_name"] = referenceName }
        if !referenceId.isEmpty { body["reference_id"] = referenceId }

        Task {
            do {
                _ = try await dataStore.createBankingEntry(body: body)
                await MainActor.run { dismiss() }
            } catch {
                await MainActor.run { errorMsg = error.localizedDescription; isLoading = false }
            }
        }
    }
}

// MARK: - Create Cashbook Entry
struct CreateCashbookEntryView: View {
    @EnvironmentObject var dataStore: DataStore
    @Environment(\.dismiss) var dismiss

    @State private var date = Date()
    @State private var type = "credit"
    @State private var category = "other"
    @State private var amount = ""
    @State private var narration = ""
    @State private var referenceName = ""
    @State private var referenceId = ""
    @State private var isLoading = false
    @State private var errorMsg: String?

    var body: some View {
        NavigationStack {
            Form {
                Section("Entry Details") {
                    DatePicker("Date", selection: $date, displayedComponents: .date)
                    Picker("Type", selection: $type) {
                        Text("Credit (Cash In)").tag("credit")
                        Text("Debit (Cash Out)").tag("debit")
                    }.pickerStyle(.segmented)
                    Picker("Category", selection: $category) {
                        ForEach(cashbookCategories, id: \.self) { cat in
                            Text(cat.replacingOccurrences(of: "_", with: " ").capitalized).tag(cat)
                        }
                    }
                    TextField("Amount (₹) *", text: $amount).keyboardType(.decimalPad)
                }

                Section("Reference") {
                    TextField("Reference Name (Party/Supplier)", text: $referenceName)
                    TextField("Reference ID / Doc No.", text: $referenceId)
                }

                Section("Narration") {
                    TextField("Description / Narration", text: $narration, axis: .vertical).lineLimit(2...4)
                }

                if let err = errorMsg {
                    Section { Text(err).foregroundColor(.red).font(.caption) }
                }
            }
            .navigationTitle("New Cash Entry")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { save() }
                        .disabled(isLoading || amount.isEmpty)
                        .fontWeight(.semibold)
                }
            }
        }
    }

    func save() {
        guard let amt = Double(amount), amt > 0 else { errorMsg = "Enter a valid amount."; return }
        isLoading = true; errorMsg = nil
        var body: [String: Any] = [
            "date": date.toYMD().toISODate(),
            "type": type,
            "category": category,
            "amount": amt
        ]
        if !narration.isEmpty { body["narration"] = narration }
        if !referenceName.isEmpty { body["reference_name"] = referenceName }
        if !referenceId.isEmpty { body["reference_id"] = referenceId }

        Task {
            do {
                _ = try await dataStore.createCashbookEntry(body: body)
                await MainActor.run { dismiss() }
            } catch {
                await MainActor.run { errorMsg = error.localizedDescription; isLoading = false }
            }
        }
    }
}

// MARK: - Create Fuel Entry
struct CreateFuelEntryView: View {
    @EnvironmentObject var dataStore: DataStore
    @Environment(\.dismiss) var dismiss

    @State private var date = Date()
    @State private var vehicleNo = ""
    @State private var liters = ""
    @State private var amount = ""
    @State private var station = ""
    @State private var odometer = ""
    @State private var isLoading = false
    @State private var errorMsg: String?

    var body: some View {
        NavigationStack {
            Form {
                Section("Fuel Details") {
                    DatePicker("Date", selection: $date, displayedComponents: .date)
                    if !dataStore.vehicles.isEmpty {
                        Picker("Vehicle", selection: $vehicleNo) {
                            Text("— Select Vehicle —").tag("")
                            ForEach(dataStore.vehicles, id: \.id) { v in
                                Text(v.vehicleNo).tag(v.vehicleNo)
                            }
                        }
                    } else {
                        TextField("Vehicle No. *", text: $vehicleNo)
                    }
                    TextField("Station / Pump Name", text: $station)
                    TextField("Liters", text: $liters).keyboardType(.decimalPad)
                    TextField("Amount (₹) *", text: $amount).keyboardType(.decimalPad)
                    TextField("Odometer (km)", text: $odometer).keyboardType(.numberPad)
                }

                if let err = errorMsg {
                    Section { Text(err).foregroundColor(.red).font(.caption) }
                }
            }
            .navigationTitle("New Fuel Entry")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { save() }
                        .disabled(isLoading || vehicleNo.isEmpty || amount.isEmpty)
                        .fontWeight(.semibold)
                }
            }
        }
    }

    func save() {
        guard let amt = Double(amount), amt > 0 else { errorMsg = "Enter a valid amount."; return }
        isLoading = true; errorMsg = nil
        var body: [String: Any] = [
            "date": date.toYMD().toISODate(),
            "vehicle_no": vehicleNo,
            "amount": amt,
            "type": "fuel_allocation"
        ]
        if let l = Double(liters) { body["liters"] = l; body["fuel_quantity"] = l }
        if !station.isEmpty { body["station"] = station }
        if let o = Double(odometer) { body["odometer"] = o; body["odometer_reading"] = o }

        Task {
            do {
                _ = try await dataStore.createFuelEntry(body: body)
                await MainActor.run { dismiss() }
            } catch {
                await MainActor.run { errorMsg = error.localizedDescription; isLoading = false }
            }
        }
    }
}

