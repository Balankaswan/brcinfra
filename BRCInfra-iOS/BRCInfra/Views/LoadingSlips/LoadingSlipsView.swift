import SwiftUI

// MARK: - Loading Slips List
struct LoadingSlipsView: View {
    @EnvironmentObject var dataStore: DataStore
    @EnvironmentObject var authStore: AuthStore
    @State private var searchText = ""
    @State private var filterBilled = "all"
    @State private var showCreate = false
    @State private var editingSlip: LoadingSlip?
    @State private var previewSlip: LoadingSlip?

    var filtered: [LoadingSlip] {
        var result = dataStore.loadingSlips
        switch filterBilled {
        case "billed": result = result.filter { $0.isBilled }
        case "unbilled": result = result.filter { !$0.isBilled }
        default: break
        }
        if !searchText.isEmpty {
            result = result.filter {
                ($0.slipNumber ?? "").localizedCaseInsensitiveContains(searchText) ||
                ($0.lrNumber ?? "").localizedCaseInsensitiveContains(searchText) ||
                ($0.party ?? "").localizedCaseInsensitiveContains(searchText) ||
                ($0.vehicleNo ?? "").localizedCaseInsensitiveContains(searchText) ||
                $0.fromLocation.localizedCaseInsensitiveContains(searchText) ||
                $0.toLocation.localizedCaseInsensitiveContains(searchText)
            }
        }
        return result
    }

    var body: some View {
        NavigationStack {
            Group {
                if filtered.isEmpty {
                    ContentUnavailableView("No Loading Slips", systemImage: "shippingbox")
                } else {
                    List {
                        ForEach(filtered) { slip in
                            NavigationLink(destination: LoadingSlipDetailView(slip: slip)) {
                                LoadingSlipRowView(slip: slip)
                            }
                            .listRowInsets(EdgeInsets(top: 6, leading: 16, bottom: 6, trailing: 16))
                            .listRowSeparator(.hidden)
                            .swipeActions(edge: .leading) {
                                if authStore.can(.editLoadingSlip) {
                                    Button {
                                        editingSlip = slip
                                    } label: {
                                        Label("Edit", systemImage: "pencil")
                                    }.tint(.blue)
                                }

                                if authStore.can(.downloadLoadingSlipPDF) {
                                    Button {
                                        previewSlip = slip
                                    } label: {
                                        Label("PDF", systemImage: "doc.text.fill")
                                    }.tint(.indigo)
                                }
                            }
                            .swipeActions(edge: .trailing) {
                                if authStore.can(.deleteLoadingSlip) {
                                    Button(role: .destructive) {
                                        Task { try? await dataStore.deleteLoadingSlip(slip.id) }
                                    } label: { Label("Delete", systemImage: "trash") }
                                }
                            }
                        }
                    }
                    .listStyle(.plain)
                    .searchable(text: $searchText, prompt: "LR No, party, vehicle, route")
                }
            }
            .navigationTitle("Loading Slips")
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Picker("", selection: $filterBilled) {
                        Text("All").tag("all")
                        Text("Billed").tag("billed")
                        Text("Unbilled").tag("unbilled")
                    }.pickerStyle(.segmented).frame(width: 190)
                }
                ToolbarItem(placement: .navigationBarTrailing) {
                    if authStore.can(.createLoadingSlip) {
                        Button { showCreate = true } label: { Image(systemName: "plus") }
                    }
                }
            }
            .sheet(isPresented: $showCreate) {
                CreateLoadingSlipView().environmentObject(dataStore)
            }
            .sheet(item: $editingSlip) { slip in
                EditLoadingSlipView(slip: slip).environmentObject(dataStore)
            }
            .sheet(item: $previewSlip) { slip in
                PDFPreviewView(
                    title: "LR \(slip.displayNumber)",
                    pdfData: PDFService.shared.generateLoadingSlipPDF(slip: slip),
                    filename: "LoadingSlip_\(slip.displayNumber).pdf"
                )
            }
            .refreshable { await dataStore.fetchLoadingSlips() }
        }
    }
}

struct LoadingSlipRowView: View {
    let slip: LoadingSlip
    private var billedColor: Color { slip.isBilled ? Color(hex: "059669") : Color(hex: "7C3AED") }
    private var accentColor: Color { Color(hex: "7C3AED") }

    var body: some View {
        HStack(spacing: 0) {
            Rectangle()
                .fill(billedColor)
                .frame(width: 4)
                .clipShape(RoundedRectangle(cornerRadius: 2))
                .padding(.vertical, 4)

            HStack(spacing: 12) {
                ZStack {
                    RoundedRectangle(cornerRadius: 10)
                        .fill(accentColor.opacity(0.09))
                        .frame(width: 42, height: 42)
                    Image(systemName: "shippingbox.fill")
                        .font(.system(size: 17, weight: .semibold))
                        .foregroundColor(accentColor)
                }

                VStack(alignment: .leading, spacing: 3) {
                    HStack(spacing: 6) {
                        Text(slip.displayNumber)
                            .font(.system(size: 14, weight: .bold))
                            .foregroundColor(Color(hex: "0F172A"))
                        Text(slip.isBilled ? "Billed" : "Unbilled")
                            .font(.system(size: 9, weight: .bold))
                            .padding(.horizontal, 6).padding(.vertical, 2)
                            .background(billedColor.opacity(0.12))
                            .foregroundColor(billedColor)
                            .clipShape(Capsule())
                    }
                    // Route with arrow
                    HStack(spacing: 4) {
                        Text(slip.fromLocation)
                            .font(.system(size: 11, weight: .medium))
                            .foregroundColor(Color(hex: "475569"))
                        Image(systemName: "arrow.right")
                            .font(.system(size: 9))
                            .foregroundColor(Color(hex: "94A3B8"))
                        Text(slip.toLocation)
                            .font(.system(size: 11, weight: .medium))
                            .foregroundColor(Color(hex: "475569"))
                    }
                    HStack(spacing: 6) {
                        if let vn = slip.vehicleNo, !vn.isEmpty {
                            Text(vn)
                                .font(.system(size: 10, weight: .semibold))
                                .padding(.horizontal, 5).padding(.vertical, 2)
                                .background(Color(hex: "F1F5F9"))
                                .foregroundColor(Color(hex: "475569"))
                                .clipShape(Capsule())
                        }
                        if let party = slip.party, !party.isEmpty {
                            Text(party)
                                .font(.system(size: 10))
                                .foregroundColor(Color(hex: "94A3B8"))
                                .lineLimit(1)
                        }
                    }
                }

                Spacer()

                if let f = slip.freight {
                    Text(f.inr())
                        .font(.system(size: 13, weight: .bold))
                        .foregroundColor(Color(hex: "0F172A"))
                }
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 10)
        }
        .background(Color.white)
        .cornerRadius(14)
        .shadow(color: .black.opacity(0.05), radius: 6, x: 0, y: 2)
    }
}

struct LoadingSlipDetailView: View {
    let slip: LoadingSlip
    @EnvironmentObject var dataStore: DataStore
    @EnvironmentObject var authStore: AuthStore
    @State private var showEdit = false
    @State private var showPDF = false

    var currentSlip: LoadingSlip {
        dataStore.loadingSlips.first(where: { $0.id == slip.id }) ?? slip
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                InfoCard(title: "LR Details") {
                    InfoRow(label: "LR No.", value: currentSlip.displayNumber)
                    InfoRow(label: "Date", value: currentSlip.date.formattedDate())
                    InfoRow(label: "Route", value: currentSlip.route)
                    if let v = currentSlip.vehicleNo { InfoRow(label: "Vehicle", value: v) }
                }
                InfoCard(title: "Party / Supplier") {
                    if let p = currentSlip.party, !p.isEmpty { InfoRow(label: "Party (Consignor)", value: p) }
                    if let s = currentSlip.supplier, !s.isEmpty { InfoRow(label: "Supplier (Owner)", value: s) }
                    if let o = currentSlip.ownerName, !o.isEmpty { InfoRow(label: "Owner", value: o) }
                }
                InfoCard(title: "Freight") {
                    if let m = currentSlip.material { InfoRow(label: "Material", value: m) }
                    if let w = currentSlip.weight { InfoRow(label: "Weight", value: "\(w) MT") }
                    if let f = currentSlip.freight { InfoRow(label: "Freight", value: f.inr()) }
                    if let a = currentSlip.advance { InfoRow(label: "Advance", value: a.inr()) }
                    if let b = currentSlip.balance { InfoRow(label: "Balance", value: b.inr()) }
                }
                if currentSlip.isBilled || currentSlip.hasMemo {
                    InfoCard(title: "Linkages") {
                        if let bn = currentSlip.billNumber { InfoRow(label: "Bill No.", value: bn) }
                        if let mn = currentSlip.memoNumber { InfoRow(label: "Memo No.", value: mn) }
                    }
                }
                if let driver = currentSlip.driverName, !driver.isEmpty {
                    InfoCard(title: "Driver") {
                        InfoRow(label: "Driver Name", value: driver)
                        if let dn = currentSlip.driverNumber { InfoRow(label: "Driver Phone", value: dn) }
                    }
                }
                if let n = currentSlip.narration, !n.isEmpty {
                    InfoCard(title: "Remarks") { InfoRow(label: "", value: n) }
                }

                // Quick Actions
                VStack(spacing: 12) {
                    if authStore.can(.downloadLoadingSlipPDF) {
                        Button {
                            showPDF = true
                        } label: {
                            HStack(spacing: 8) {
                                Image(systemName: "doc.text.fill")
                                Text("View & Download PDF")
                            }
                            .font(.headline)
                            .foregroundColor(.white)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 13)
                            .background(Color.blue)
                            .cornerRadius(12)
                        }
                    }

                    if authStore.can(.editLoadingSlip) {
                        Button {
                            showEdit = true
                        } label: {
                            HStack(spacing: 8) {
                                Image(systemName: "pencil")
                                Text("Edit Loading Slip")
                            }
                            .font(.headline)
                            .foregroundColor(.blue)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 13)
                            .background(Color.blue.opacity(0.12))
                            .cornerRadius(12)
                        }
                    }
                }
                .padding(.top, 4)
            }
            .padding(16)
        }
        .background(Color(.systemGroupedBackground))
        .navigationTitle(currentSlip.displayNumber).navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItemGroup(placement: .navigationBarTrailing) {
                if authStore.can(.downloadLoadingSlipPDF) {
                    Button {
                        showPDF = true
                    } label: {
                        Image(systemName: "doc.text.fill")
                    }
                }

                if authStore.can(.editLoadingSlip) {
                    Button {
                        showEdit = true
                    } label: {
                        Text("Edit")
                    }
                }
            }
        }
        .sheet(isPresented: $showEdit) {
            EditLoadingSlipView(slip: currentSlip).environmentObject(dataStore)
        }
        .sheet(isPresented: $showPDF) {
            PDFPreviewView(
                title: "LR \(currentSlip.displayNumber)",
                pdfData: PDFService.shared.generateLoadingSlipPDF(slip: currentSlip),
                filename: "LoadingSlip_\(currentSlip.displayNumber).pdf"
            )
        }
    }
}

// MARK: - Create Loading Slip View
struct CreateLoadingSlipView: View {
    @EnvironmentObject var dataStore: DataStore
    @Environment(\.dismiss) var dismiss

    @State private var date = Date()
    @State private var fromLocation = ""
    @State private var toLocation = ""
    @State private var vehicleNo = ""
    @State private var party = ""
    @State private var supplier = ""
    @State private var material = ""
    @State private var weight = ""
    @State private var freight = ""
    @State private var advance = ""
    @State private var driverName = ""
    @State private var driverNumber = ""
    @State private var ownerName = ""
    @State private var narration = ""
    @State private var slipNumber = "Loading..."
    @State private var isLoading = false
    @State private var errorMsg: String?

    var body: some View {
        NavigationStack {
            Form {
                Section("LR Details") {
                    HStack {
                        Text("LR No.").foregroundColor(.secondary)
                        Spacer()
                        Text(slipNumber).fontWeight(.semibold).foregroundColor(.blue)
                    }
                    DatePicker("Date", selection: $date, displayedComponents: .date)
                    TextField("From Location *", text: $fromLocation)
                    TextField("To Location *", text: $toLocation)
                }

                Section("Vehicle & Party") {
                    TextField("Vehicle No.", text: $vehicleNo)
                    if !dataStore.parties.isEmpty {
                        Picker("Party (Consignor)", selection: $party) {
                            Text("— Select Party —").tag("")
                            ForEach(dataStore.parties, id: \.id) { p in
                                Text(p.name).tag(p.name)
                            }
                        }
                    } else {
                        TextField("Party (Consignor)", text: $party)
                    }
                    if !dataStore.suppliers.isEmpty {
                        Picker("Supplier (Owner)", selection: $supplier) {
                            Text("— Select Supplier —").tag("")
                            ForEach(dataStore.suppliers, id: \.id) { s in
                                Text(s.name).tag(s.name)
                            }
                        }
                    } else {
                        TextField("Supplier (Owner)", text: $supplier)
                    }
                }

                Section("Freight Details") {
                    TextField("Material", text: $material)
                    TextField("Weight (MT)", text: $weight).keyboardType(.decimalPad)
                    TextField("Freight Amount (₹)", text: $freight).keyboardType(.decimalPad)
                    TextField("Advance (₹)", text: $advance).keyboardType(.decimalPad)
                }

                Section("Driver / Owner") {
                    TextField("Driver Name", text: $driverName)
                    TextField("Driver Phone", text: $driverNumber).keyboardType(.phonePad)
                    TextField("Owner Name", text: $ownerName)
                }

                Section("Remarks") {
                    TextField("Narration / Remarks", text: $narration, axis: .vertical)
                        .lineLimit(3...6)
                }

                if let err = errorMsg {
                    Section {
                        Text(err).foregroundColor(.red).font(.caption)
                    }
                }
            }
            .navigationTitle("New Loading Slip")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { save() }
                        .disabled(isLoading || fromLocation.isEmpty || toLocation.isEmpty)
                        .fontWeight(.semibold)
                }
            }
            .task { slipNumber = await dataStore.nextLRNumber() }
        }
    }

    func save() {
        guard !fromLocation.isEmpty, !toLocation.isEmpty else {
            errorMsg = "From and To locations are required."
            return
        }
        isLoading = true
        errorMsg = nil

        let freightVal = Double(freight) ?? 0
        let advanceVal = Double(advance) ?? 0

        var body: [String: Any] = [
            "date": date.toYMD().toISODate(),
            "from_location": fromLocation,
            "to_location": toLocation,
            "freight": freightVal,
            "advance": advanceVal,
            "balance": freightVal - advanceVal,
            "total_freight": freightVal
        ]
        if !vehicleNo.isEmpty { body["vehicle_no"] = vehicleNo }
        if !party.isEmpty { body["party"] = party; body["consignor_name"] = party }
        if !supplier.isEmpty { body["supplier"] = supplier; body["owner_name"] = supplier }
        if !material.isEmpty { body["material"] = material }
        if let w = Double(weight) { body["weight"] = w }
        if !driverName.isEmpty { body["driver_name"] = driverName }
        if !driverNumber.isEmpty { body["driver_number"] = driverNumber }
        if !ownerName.isEmpty { body["owner_name"] = ownerName }
        if !narration.isEmpty { body["narration"] = narration }

        Task {
            do {
                _ = try await dataStore.createLoadingSlip(body: body)
                await MainActor.run { dismiss() }
            } catch {
                await MainActor.run {
                    errorMsg = error.localizedDescription
                    isLoading = false
                }
            }
        }
    }
}

// MARK: - Parties View
struct PartiesListView: View {
    @EnvironmentObject var dataStore: DataStore
    @State private var searchText = ""

    var filtered: [Party] {
        dataStore.parties.filter {
            searchText.isEmpty ||
            $0.name.localizedCaseInsensitiveContains(searchText) ||
            ($0.contactPerson ?? "").localizedCaseInsensitiveContains(searchText)
        }
        .sorted { $0.name < $1.name }
    }

    var body: some View {
        NavigationStack {
            Group {
                if filtered.isEmpty {
                    ContentUnavailableView("No Parties", systemImage: "person.2")
                } else {
                    List(filtered) { party in
                        NavigationLink(destination: PartyDetailView(party: party)) {
                            PartyRowView(party: party)
                        }
                        .listRowSeparator(.hidden)
                        .listRowInsets(EdgeInsets(top: 6, leading: 16, bottom: 6, trailing: 16))
                    }
                    .listStyle(.plain)
                    .searchable(text: $searchText, prompt: "Search parties")
                }
            }
            .navigationTitle("Parties")
            .refreshable { await dataStore.fetchParties() }
        }
    }
}

struct PartyRowView: View {
    let party: Party
    var body: some View {
        HStack(spacing: 12) {
            ZStack {
                Circle().fill(Color.blue.opacity(0.12)).frame(width: 42, height: 42)
                Text(String(party.name.prefix(1))).font(.headline).fontWeight(.bold).foregroundColor(.blue)
            }
            VStack(alignment: .leading, spacing: 3) {
                Text(party.name).font(.subheadline).fontWeight(.semibold)
                if let cp = party.contactPerson { Text(cp).font(.caption).foregroundColor(.secondary) }
                if let ph = party.phone { Text(ph).font(.caption).foregroundColor(.secondary) }
            }
            Spacer()
        }
        .padding(12).background(.white).cornerRadius(12)
        .shadow(color: .black.opacity(0.04), radius: 4, y: 1)
    }
}

struct PartyDetailView: View {
    let party: Party
    @EnvironmentObject var dataStore: DataStore

    var partyBills: [Bill] { dataStore.bills.filter { $0.party == party.name }.sorted { $0.date > $1.date } }
    var outstandingBalance: Double { partyBills.filter { !$0.isPaid }.reduce(0) { $0 + max(0, $1.computedNet) } }

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                // Party Info
                InfoCard(title: "Party Information") {
                    InfoRow(label: "Name", value: party.name)
                    if let cp = party.contactPerson { InfoRow(label: "Contact", value: cp) }
                    if let ph = party.phone { InfoRow(label: "Phone", value: ph) }
                    if let em = party.email { InfoRow(label: "Email", value: em) }
                    if let addr = party.address { InfoRow(label: "Address", value: addr) }
                    if let gst = party.gstin { InfoRow(label: "GSTIN", value: gst) }
                }

                // Balance
                HStack {
                    Text("Outstanding Balance").font(.headline)
                    Spacer()
                    Text(outstandingBalance.inr()).font(.title3).fontWeight(.bold).foregroundColor(.blue)
                }
                .padding(16).background(Color.blue.opacity(0.08)).cornerRadius(16)

                // Bills
                if !partyBills.isEmpty {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Bills (\(partyBills.count))").font(.headline).padding(.horizontal, 16).padding(.top, 12)
                        ForEach(partyBills) { bill in
                            BillRowView(bill: bill).padding(.horizontal, 16)
                        }
                        .padding(.bottom, 12)
                    }
                    .background(.white).cornerRadius(16)
                    .shadow(color: .black.opacity(0.05), radius: 8, y: 2)
                }
            }
            .padding(16)
        }
        .background(Color(.systemGroupedBackground))
        .navigationTitle(party.name).navigationBarTitleDisplayMode(.large)
    }
}

// MARK: - Suppliers View
struct SuppliersListView: View {
    @EnvironmentObject var dataStore: DataStore
    @State private var searchText = ""

    var filtered: [Supplier] {
        dataStore.suppliers.filter {
            searchText.isEmpty ||
            $0.name.localizedCaseInsensitiveContains(searchText) ||
            ($0.contactPerson ?? "").localizedCaseInsensitiveContains(searchText)
        }.sorted { $0.name < $1.name }
    }

    var body: some View {
        NavigationStack {
            Group {
                if filtered.isEmpty {
                    ContentUnavailableView("No Suppliers", systemImage: "truck.box")
                } else {
                    List(filtered) { supplier in
                        NavigationLink(destination: SupplierDetailView(supplier: supplier)) {
                            SupplierRowView(supplier: supplier)
                        }
                        .listRowSeparator(.hidden)
                        .listRowInsets(EdgeInsets(top: 6, leading: 16, bottom: 6, trailing: 16))
                    }
                    .listStyle(.plain)
                    .searchable(text: $searchText, prompt: "Search suppliers")
                }
            }
            .navigationTitle("Suppliers")
            .refreshable { await dataStore.fetchSuppliers() }
        }
    }
}

struct SupplierRowView: View {
    let supplier: Supplier
    var body: some View {
        HStack(spacing: 12) {
            ZStack {
                Circle().fill(Color.orange.opacity(0.12)).frame(width: 42, height: 42)
                Text(String(supplier.name.prefix(1))).font(.headline).fontWeight(.bold).foregroundColor(.orange)
            }
            VStack(alignment: .leading, spacing: 3) {
                Text(supplier.name).font(.subheadline).fontWeight(.semibold)
                if let cp = supplier.contactPerson { Text(cp).font(.caption).foregroundColor(.secondary) }
                if let ph = supplier.phone { Text(ph).font(.caption).foregroundColor(.secondary) }
            }
            Spacer()
        }
        .padding(12).background(.white).cornerRadius(12)
        .shadow(color: .black.opacity(0.04), radius: 4, y: 1)
    }
}

struct SupplierDetailView: View {
    let supplier: Supplier
    @EnvironmentObject var dataStore: DataStore

    var supplierMemos: [Memo] { dataStore.memos.filter { $0.supplier == supplier.name }.sorted { $0.date > $1.date } }
    var outstandingBalance: Double { supplierMemos.filter { !$0.isPaid }.reduce(0) { $0 + max(0, $1.netAmount) } }

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                InfoCard(title: "Supplier Information") {
                    InfoRow(label: "Name", value: supplier.name)
                    if let cp = supplier.contactPerson { InfoRow(label: "Contact", value: cp) }
                    if let ph = supplier.phone { InfoRow(label: "Phone", value: ph) }
                    if let em = supplier.email { InfoRow(label: "Email", value: em) }
                    if let pan = supplier.panNumber { InfoRow(label: "PAN", value: pan) }
                }
                HStack {
                    Text("Pending Balance").font(.headline)
                    Spacer()
                    Text(outstandingBalance.inr()).font(.title3).fontWeight(.bold).foregroundColor(.orange)
                }
                .padding(16).background(Color.orange.opacity(0.08)).cornerRadius(16)

                if !supplierMemos.isEmpty {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Memos (\(supplierMemos.count))").font(.headline).padding(.horizontal, 16).padding(.top, 12)
                        ForEach(supplierMemos) { memo in
                            MemoRowView(memo: memo).padding(.horizontal, 16)
                        }
                        .padding(.bottom, 12)
                    }
                    .background(.white).cornerRadius(16)
                    .shadow(color: .black.opacity(0.05), radius: 8, y: 2)
                }
            }
            .padding(16)
        }
        .background(Color(.systemGroupedBackground))
        .navigationTitle(supplier.name).navigationBarTitleDisplayMode(.large)
    }
}

// MARK: - Edit Loading Slip View
struct EditLoadingSlipView: View {
    let slip: LoadingSlip
    @EnvironmentObject var dataStore: DataStore
    @Environment(\.dismiss) var dismiss

    @State private var date: Date
    @State private var fromLocation: String
    @State private var toLocation: String
    @State private var vehicleNo: String
    @State private var party: String
    @State private var supplier: String
    @State private var material: String
    @State private var weight: String
    @State private var freight: String
    @State private var advance: String
    @State private var driverName: String
    @State private var driverNumber: String
    @State private var ownerName: String
    @State private var narration: String
    @State private var isLoading = false
    @State private var errorMsg: String?

    init(slip: LoadingSlip) {
        self.slip = slip
        let df = DateFormatter()
        df.dateFormat = "yyyy-MM-dd"
        let parsedDate: Date
        if let d = df.date(from: String(slip.date.prefix(10))) {
            parsedDate = d
        } else {
            parsedDate = Date()
        }
        _date = State(initialValue: parsedDate)
        _fromLocation = State(initialValue: slip.fromLocation)
        _toLocation = State(initialValue: slip.toLocation)
        _vehicleNo = State(initialValue: slip.vehicleNo ?? "")
        _party = State(initialValue: slip.party ?? "")
        _supplier = State(initialValue: slip.supplier ?? "")
        _material = State(initialValue: slip.material ?? "")
        _weight = State(initialValue: slip.weight != nil ? String(slip.weight!) : "")
        _freight = State(initialValue: slip.freight != nil ? String(format: "%.0f", slip.freight!) : "")
        _advance = State(initialValue: slip.advance != nil ? String(format: "%.0f", slip.advance!) : "")
        _driverName = State(initialValue: slip.driverName ?? "")
        _driverNumber = State(initialValue: slip.driverNumber ?? "")
        _ownerName = State(initialValue: slip.ownerName ?? "")
        _narration = State(initialValue: slip.narration ?? "")
    }

    var balanceAmount: Double {
        let f = Double(freight) ?? 0
        let a = Double(advance) ?? 0
        return max(0, f - a)
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("LR Reference") {
                    HStack {
                        Text("LR / Slip No.").foregroundColor(.secondary)
                        Spacer()
                        Text(slip.displayNumber).fontWeight(.semibold).foregroundColor(.blue)
                    }
                    DatePicker("Date", selection: $date, displayedComponents: .date)
                    TextField("From Location *", text: $fromLocation)
                    TextField("To Location *", text: $toLocation)
                }

                Section("Vehicle & Party") {
                    TextField("Vehicle No.", text: $vehicleNo)
                    if !dataStore.parties.isEmpty {
                        Picker("Party (Consignor)", selection: $party) {
                            Text("— Select Party —").tag("")
                            ForEach(dataStore.parties, id: \.id) { p in
                                Text(p.name).tag(p.name)
                            }
                        }
                    } else {
                        TextField("Party (Consignor)", text: $party)
                    }

                    if !dataStore.suppliers.isEmpty {
                        Picker("Supplier (Vehicle Owner)", selection: $supplier) {
                            Text("— Select Supplier —").tag("")
                            ForEach(dataStore.suppliers, id: \.id) { s in
                                Text(s.name).tag(s.name)
                            }
                        }
                    } else {
                        TextField("Supplier (Owner)", text: $supplier)
                    }

                    TextField("Owner Name", text: $ownerName)
                }

                Section("Cargo & Freight") {
                    TextField("Material Description", text: $material)
                    TextField("Weight (MT)", text: $weight)
                        .keyboardType(.decimalPad)
                    TextField("Freight Amount (₹)", text: $freight)
                        .keyboardType(.decimalPad)
                    TextField("Advance Paid (₹)", text: $advance)
                        .keyboardType(.decimalPad)
                    HStack {
                        Text("Balance Payable")
                        Spacer()
                        Text(balanceAmount.inr()).fontWeight(.semibold).foregroundColor(.orange)
                    }
                }

                Section("Driver Details") {
                    TextField("Driver Name", text: $driverName)
                    TextField("Driver Phone", text: $driverNumber)
                        .keyboardType(.phonePad)
                }

                Section("Remarks / Narration") {
                    TextField("Remarks", text: $narration, axis: .vertical)
                        .lineLimit(2...4)
                }

                if let err = errorMsg {
                    Section {
                        Text(err).font(.caption).foregroundColor(.red)
                    }
                }
            }
            .navigationTitle("Edit Loading Slip")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Save Changes") {
                        Task { await save() }
                    }
                    .fontWeight(.semibold)
                    .disabled(fromLocation.isEmpty || toLocation.isEmpty || isLoading)
                }
            }
            .overlay {
                if isLoading {
                    ProgressView().padding().background(.ultraThinMaterial).cornerRadius(10)
                }
            }
        }
    }

    private func save() async {
        guard !fromLocation.isEmpty, !toLocation.isEmpty else {
            errorMsg = "From and To locations are required."
            return
        }
        isLoading = true
        errorMsg = nil
        let df = DateFormatter()
        df.dateFormat = "yyyy-MM-dd"

        var body: [String: Any] = [
            "date": df.string(from: date),
            "from_location": fromLocation.trimmingCharacters(in: .whitespaces),
            "to_location": toLocation.trimmingCharacters(in: .whitespaces),
            "vehicle_no": vehicleNo.trimmingCharacters(in: .whitespaces),
            "party": party.trimmingCharacters(in: .whitespaces),
            "supplier": supplier.trimmingCharacters(in: .whitespaces),
            "owner_name": ownerName.trimmingCharacters(in: .whitespaces),
            "material": material.trimmingCharacters(in: .whitespaces),
            "driver_name": driverName.trimmingCharacters(in: .whitespaces),
            "driver_number": driverNumber.trimmingCharacters(in: .whitespaces),
            "narration": narration.trimmingCharacters(in: .whitespaces)
        ]

        if let w = Double(weight) { body["weight"] = w }
        if let f = Double(freight) {
            body["freight"] = f
            let adv = Double(advance) ?? 0
            body["advance"] = adv
            body["balance"] = max(0, f - adv)
        }

        do {
            _ = try await dataStore.updateLoadingSlip(id: slip.id, body: body)
            dismiss()
        } catch {
            errorMsg = error.localizedDescription
            isLoading = false
        }
    }
}

// MARK: - Shared Info Components
struct InfoCard<Content: View>: View {
    let title: String
    @ViewBuilder let content: Content
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title).font(.caption).fontWeight(.semibold).foregroundColor(.secondary).padding(.bottom, 4)
            content
        }
        .padding(16).background(.white).cornerRadius(16)
        .shadow(color: .black.opacity(0.05), radius: 8, y: 2)
    }
}

struct InfoRow: View {
    let label: String
    let value: String
    var body: some View {
        HStack(alignment: .top) {
            Text(label).font(.subheadline).foregroundColor(.secondary).frame(minWidth: 80, alignment: .leading)
            Text(value).font(.subheadline).fontWeight(.medium).frame(maxWidth: .infinity, alignment: .leading)
        }
        Divider()
    }
}
