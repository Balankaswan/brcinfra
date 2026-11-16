import SwiftUI

struct BillsListView: View {
    @EnvironmentObject var dataStore: DataStore
    @EnvironmentObject var authStore: AuthStore
    @State private var searchText = ""
    @State private var filterStatus = "all"
    @State private var showCreate = false
    @State private var editingBill: Bill?
    @State private var previewBill: Bill?
    @State private var errorMsg: String?

    var filtered: [Bill] {
        var result = dataStore.bills
        switch filterStatus {
        case "paid": result = result.filter { $0.isPaid }
        case "unpaid": result = result.filter { !$0.isPaid }
        default: break
        }
        if !searchText.isEmpty {
            result = result.filter {
                $0.billNumber.localizedCaseInsensitiveContains(searchText) ||
                $0.party.localizedCaseInsensitiveContains(searchText)
            }
        }
        return result
    }

    var body: some View {
        NavigationStack {
            Group {
                if filtered.isEmpty {
                    ContentUnavailableView("No Bills", systemImage: "doc.text")
                } else {
                    List {
                        ForEach(filtered) { bill in
                            NavigationLink(destination: BillDetailView(bill: bill)) {
                                BillRowView(bill: bill)
                            }
                            .listRowInsets(EdgeInsets(top: 6, leading: 16, bottom: 6, trailing: 16))
                            .listRowSeparator(.hidden)
                            .swipeActions(edge: .leading, allowsFullSwipe: false) {
                                if authStore.can(.editBill) {
                                    Button {
                                        editingBill = bill
                                    } label: {
                                        Label("Edit", systemImage: "pencil")
                                    }.tint(.blue)
                                }

                                if authStore.can(.downloadBillPDF) {
                                    Button {
                                        previewBill = bill
                                    } label: {
                                        Label("PDF", systemImage: "doc.text.fill")
                                    }.tint(.indigo)
                                }

                                if authStore.can(.markBillPaid) && !bill.isPaid {
                                    Button {
                                        Task {
                                            do { try await dataStore.markBillPaid(bill.id) }
                                            catch { errorMsg = error.localizedDescription }
                                        }
                                    } label: {
                                        Label("Paid", systemImage: "checkmark.circle.fill")
                                    }.tint(.green)
                                }
                            }
                            .swipeActions(edge: .trailing) {
                                if authStore.can(.deleteBill) {
                                    Button(role: .destructive) {
                                        Task {
                                            do { try await dataStore.deleteBill(bill.id) }
                                            catch { errorMsg = error.localizedDescription }
                                        }
                                    } label: { Label("Delete", systemImage: "trash") }
                                }
                            }
                        }
                    }
                    .listStyle(.plain)
                    .searchable(text: $searchText, prompt: "Search bill no. or party")
                }
            }
            .navigationTitle("Bills")
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Picker("", selection: $filterStatus) {
                        Text("All").tag("all")
                        Text("Paid").tag("paid")
                        Text("Unpaid").tag("unpaid")
                    }.pickerStyle(.segmented).frame(width: 180)
                }
                ToolbarItem(placement: .navigationBarTrailing) {
                    if authStore.can(.createBill) {
                        Button { showCreate = true } label: { Image(systemName: "plus") }
                    }
                }
            }
            .sheet(isPresented: $showCreate) {
                CreateBillView().environmentObject(dataStore)
            }
            .sheet(item: $editingBill) { bill in
                EditBillView(bill: bill).environmentObject(dataStore)
            }
            .sheet(item: $previewBill) { bill in
                PDFPreviewView(
                    title: "Bill \(bill.billNumber)",
                    pdfData: PDFService.shared.generateBillPDF(bill: bill),
                    filename: "Bill_\(bill.billNumber).pdf"
                )
            }
            .refreshable { await dataStore.fetchBills() }
        }
    }
}

struct BillDetailView: View {
    let bill: Bill
    @EnvironmentObject var dataStore: DataStore
    @EnvironmentObject var authStore: AuthStore
    @State private var showEdit = false
    @State private var showPDF = false

    var currentBill: Bill {
        dataStore.bills.first(where: { $0.id == bill.id }) ?? bill
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                InfoCard(title: "Bill Info") {
                    InfoRow(label: "Bill No.", value: currentBill.billNumber)
                    InfoRow(label: "Date", value: currentBill.date.formattedDate())
                    InfoRow(label: "Party", value: currentBill.party)
                    if let v = currentBill.vehicleNo, !v.isEmpty { InfoRow(label: "Vehicle", value: v) }
                    InfoRow(label: "Status", value: currentBill.statusLabel)
                }
                InfoCard(title: "Amounts") {
                    InfoRow(label: "Bill Amount", value: currentBill.billAmount.inr())
                    if let v = currentBill.detention, v > 0 { InfoRow(label: "Detention", value: v.inr()) }
                    if let v = currentBill.extra, v > 0 { InfoRow(label: "Extra", value: v.inr()) }
                    if let v = currentBill.rto, v > 0 { InfoRow(label: "RTO", value: v.inr()) }
                    InfoRow(label: "Net Amount", value: currentBill.computedNet.inr())
                }
                InfoCard(title: "Deductions") {
                    if let v = currentBill.mamool, v > 0 { InfoRow(label: "Mamool", value: v.inr()) }
                    if let v = currentBill.commission, v > 0 { InfoRow(label: "Commission", value: v.inr()) }
                    if let v = currentBill.tds, v > 0 { InfoRow(label: "TDS", value: v.inr()) }
                    if let v = currentBill.penalties, v > 0 { InfoRow(label: "Penalties", value: v.inr()) }
                    if let v = currentBill.partyCommissionCut, v > 0 { InfoRow(label: "Party Commission Cut", value: v.inr()) }
                }
                if let r = currentBill.remarks, !r.isEmpty {
                    InfoCard(title: "Remarks") { InfoRow(label: "", value: r) }
                }

                // Quick Action Buttons
                VStack(spacing: 12) {
                    if authStore.can(.downloadBillPDF) {
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

                    if authStore.can(.editBill) {
                        Button {
                            showEdit = true
                        } label: {
                            HStack(spacing: 8) {
                                Image(systemName: "pencil")
                                Text("Edit Bill")
                            }
                            .font(.headline)
                            .foregroundColor(.blue)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 13)
                            .background(Color.blue.opacity(0.12))
                            .cornerRadius(12)
                        }
                    }

                    if authStore.can(.markBillPaid) && !currentBill.isPaid {
                        Button("Mark as Received") {
                            Task { try? await dataStore.markBillPaid(currentBill.id) }
                        }
                        .buttonStyle(.borderedProminent).tint(.green)
                        .frame(maxWidth: .infinity)
                    }
                }
                .padding(.top, 4)
            }
            .padding(16)
        }
        .background(Color(.systemGroupedBackground))
        .navigationTitle("Bill \(currentBill.billNumber)").navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItemGroup(placement: .navigationBarTrailing) {
                if authStore.can(.downloadBillPDF) {
                    Button {
                        showPDF = true
                    } label: {
                        Image(systemName: "doc.text.fill")
                    }
                }

                if authStore.can(.editBill) {
                    Button {
                        showEdit = true
                    } label: {
                        Text("Edit")
                    }
                }
            }
        }
        .sheet(isPresented: $showEdit) {
            EditBillView(bill: currentBill).environmentObject(dataStore)
        }
        .sheet(isPresented: $showPDF) {
            PDFPreviewView(
                title: "Bill \(currentBill.billNumber)",
                pdfData: PDFService.shared.generateBillPDF(bill: currentBill),
                filename: "Bill_\(currentBill.billNumber).pdf"
            )
        }
    }
}

struct BillRowView: View {
    let bill: Bill
    private var statusColor: Color { bill.isPaid ? Color(hex: "059669") : Color(hex: "D97706") }
    private var accentColor: Color { Color(hex: "1D4ED8") }

    var body: some View {
        HStack(spacing: 0) {
            // Left accent bar
            Rectangle()
                .fill(statusColor)
                .frame(width: 4)
                .clipShape(RoundedRectangle(cornerRadius: 2))
                .padding(.vertical, 4)

            HStack(spacing: 12) {
                // Icon
                ZStack {
                    RoundedRectangle(cornerRadius: 10)
                        .fill(accentColor.opacity(0.09))
                        .frame(width: 42, height: 42)
                    Image(systemName: "doc.text.fill")
                        .font(.system(size: 17, weight: .semibold))
                        .foregroundColor(accentColor)
                }

                VStack(alignment: .leading, spacing: 3) {
                    HStack(spacing: 6) {
                        Text(bill.billNumber)
                            .font(.system(size: 14, weight: .bold))
                            .foregroundColor(Color(hex: "0F172A"))
                        if let count = bill.tripCount ?? bill.loadingSlipIds?.count, count > 1 {
                            Text("\(count) trips")
                                .font(.system(size: 10, weight: .bold))
                                .padding(.horizontal, 5).padding(.vertical, 1)
                                .background(Color.blue.opacity(0.12))
                                .foregroundColor(.blue)
                                .clipShape(Capsule())
                        }
                    }
                    Text(bill.party)
                        .font(.system(size: 12, weight: .medium))
                        .foregroundColor(Color(hex: "475569"))
                        .lineLimit(1)
                    Text(bill.date.formattedDate())
                        .font(.system(size: 11))
                        .foregroundColor(Color(hex: "94A3B8"))
                }

                Spacer()

                VStack(alignment: .trailing, spacing: 5) {
                    Text(bill.computedNet.inr())
                        .font(.system(size: 14, weight: .bold))
                        .foregroundColor(Color(hex: "0F172A"))
                    Text(bill.statusLabel)
                        .font(.system(size: 10, weight: .semibold))
                        .padding(.horizontal, 7).padding(.vertical, 3)
                        .background(statusColor.opacity(0.12))
                        .foregroundColor(statusColor)
                        .clipShape(Capsule())
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

// MARK: - Create Bill View
struct CreateBillView: View {
    @EnvironmentObject var dataStore: DataStore
    @Environment(\.dismiss) var dismiss

    @State private var date = Date()
    @State private var party = ""
    @State private var billAmount = ""
    @State private var mamool = ""
    @State private var commission = ""
    @State private var detention = ""
    @State private var rto = ""
    @State private var extra = ""
    @State private var tds = ""
    @State private var penalties = ""
    @State private var partyCommissionCut = ""
    @State private var remarks = ""
    @State private var selectedLRId = ""
    @State private var availableLRs: [LoadingSlip] = []
    @State private var isLoading = false
    @State private var errorMsg: String?

    var netAmount: Double {
        let base = (Double(billAmount) ?? 0) + (Double(detention) ?? 0) + (Double(extra) ?? 0) + (Double(rto) ?? 0)
        let deductions = (Double(mamool) ?? 0) + (Double(commission) ?? 0) + (Double(tds) ?? 0) + (Double(penalties) ?? 0) + (Double(partyCommissionCut) ?? 0)
        return base - deductions
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Select LR *") {
                    if availableLRs.isEmpty {
                        Text("No unbilled LRs available. Create a Loading Slip first.")
                            .font(.caption).foregroundColor(.secondary)
                    } else {
                        Picker("Loading Slip (LR)", selection: $selectedLRId) {
                            Text("— Select LR —").tag("")
                            ForEach(availableLRs, id: \.id) { lr in
                                Text("\(lr.displayNumber) — \(lr.route)").tag(lr.id)
                            }
                        }
                        .pickerStyle(.menu)
                        .onChange(of: selectedLRId) { newId in
                            if let lr = availableLRs.first(where: { $0.id == newId }) {
                                if let p = lr.party, !p.isEmpty { party = p }
                                if let f = lr.freight { billAmount = String(format: "%.0f", f) }
                            }
                        }
                    }
                }

                Section("Bill Details") {
                    DatePicker("Bill Date", selection: $date, displayedComponents: .date)
                    if !dataStore.parties.isEmpty {
                        Picker("Party", selection: $party) {
                            Text("— Select Party —").tag("")
                            ForEach(dataStore.parties, id: \.id) { p in
                                Text(p.name).tag(p.name)
                            }
                        }
                    } else {
                        TextField("Party Name *", text: $party)
                    }
                    TextField("Bill Amount (₹) *", text: $billAmount).keyboardType(.decimalPad)
                }

                Section("Deductions") {
                    HStack {
                        Text("Mamool"); Spacer()
                        TextField("0", text: $mamool).keyboardType(.decimalPad).multilineTextAlignment(.trailing).frame(width: 100)
                    }
                    HStack {
                        Text("Commission"); Spacer()
                        TextField("0", text: $commission).keyboardType(.decimalPad).multilineTextAlignment(.trailing).frame(width: 100)
                    }
                    HStack {
                        Text("Detention"); Spacer()
                        TextField("0", text: $detention).keyboardType(.decimalPad).multilineTextAlignment(.trailing).frame(width: 100)
                    }
                    HStack {
                        Text("RTO"); Spacer()
                        TextField("0", text: $rto).keyboardType(.decimalPad).multilineTextAlignment(.trailing).frame(width: 100)
                    }
                    HStack {
                        Text("Extra"); Spacer()
                        TextField("0", text: $extra).keyboardType(.decimalPad).multilineTextAlignment(.trailing).frame(width: 100)
                    }
                    HStack {
                        Text("TDS"); Spacer()
                        TextField("0", text: $tds).keyboardType(.decimalPad).multilineTextAlignment(.trailing).frame(width: 100)
                    }
                    HStack {
                        Text("Penalties"); Spacer()
                        TextField("0", text: $penalties).keyboardType(.decimalPad).multilineTextAlignment(.trailing).frame(width: 100)
                    }
                    HStack {
                        Text("Party Commission Cut"); Spacer()
                        TextField("0", text: $partyCommissionCut).keyboardType(.decimalPad).multilineTextAlignment(.trailing).frame(width: 100)
                    }
                }

                Section {
                    HStack {
                        Text("Net Amount").fontWeight(.semibold)
                        Spacer()
                        Text(netAmount.inr()).fontWeight(.bold).foregroundColor(netAmount >= 0 ? .green : .red)
                    }
                }

                Section("Remarks") {
                    TextField("Remarks", text: $remarks, axis: .vertical).lineLimit(2...4)
                }

                if let err = errorMsg {
                    Section { Text(err).foregroundColor(.red).font(.caption) }
                }
            }
            .navigationTitle("New Bill")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { save() }
                        .disabled(isLoading || party.isEmpty || billAmount.isEmpty || selectedLRId.isEmpty)
                        .fontWeight(.semibold)
                }
            }
            .task {
                availableLRs = await dataStore.availableForBilling()
            }
        }
    }

    func save() {
        isLoading = true; errorMsg = nil
        var body: [String: Any] = [
            "date": date.toYMD().toISODate(),
            "party": party,
            "bill_amount": Double(billAmount) ?? 0,
            "net_amount": netAmount,
            "loading_slip_id": selectedLRId,
            "loading_slip_ids": [selectedLRId],
            "status": "pending"
        ]
        if let v = Double(mamool), v > 0 { body["mamool"] = v }
        if let v = Double(commission), v > 0 { body["commission"] = v }
        if let v = Double(detention), v > 0 { body["detention"] = v }
        if let v = Double(rto), v > 0 { body["rto"] = v }
        if let v = Double(extra), v > 0 { body["extra"] = v }
        if let v = Double(tds), v > 0 { body["tds"] = v }
        if let v = Double(penalties), v > 0 { body["penalties"] = v }
        if let v = Double(partyCommissionCut), v > 0 { body["party_commission_cut"] = v }
        if !remarks.isEmpty { body["remarks"] = remarks }

        Task {
            do {
                _ = try await dataStore.createBill(body: body)
                await dataStore.fetchLoadingSlips() // refresh LRs to show billed status
                await MainActor.run { dismiss() }
            } catch {
                await MainActor.run { errorMsg = error.localizedDescription; isLoading = false }
            }
        }
    }
}

// MARK: - Edit Bill View
struct EditBillView: View {
    let bill: Bill
    @EnvironmentObject var dataStore: DataStore
    @Environment(\.dismiss) var dismiss

    @State private var date: Date
    @State private var party: String
    @State private var vehicleNo: String
    @State private var billAmount: String
    @State private var detention: String
    @State private var extra: String
    @State private var rto: String
    @State private var mamool: String
    @State private var commission: String
    @State private var tds: String
    @State private var penalties: String
    @State private var partyCommissionCut: String
    @State private var status: String
    @State private var remarks: String
    @State private var isLoading = false
    @State private var errorMsg: String?

    init(bill: Bill) {
        self.bill = bill
        let df = DateFormatter()
        df.dateFormat = "yyyy-MM-dd"
        let parsedDate: Date
        if let d = df.date(from: String(bill.date.prefix(10))) {
            parsedDate = d
        } else {
            parsedDate = Date()
        }
        _date = State(initialValue: parsedDate)
        _party = State(initialValue: bill.party)
        _vehicleNo = State(initialValue: bill.vehicleNo ?? "")
        _billAmount = State(initialValue: String(format: "%.0f", bill.billAmount))
        _detention = State(initialValue: bill.detention != nil ? String(format: "%.0f", bill.detention!) : "")
        _extra = State(initialValue: bill.extra != nil ? String(format: "%.0f", bill.extra!) : "")
        _rto = State(initialValue: bill.rto != nil ? String(format: "%.0f", bill.rto!) : "")
        _mamool = State(initialValue: bill.mamool != nil ? String(format: "%.0f", bill.mamool!) : "")
        _commission = State(initialValue: bill.commission != nil ? String(format: "%.0f", bill.commission!) : "")
        _tds = State(initialValue: bill.tds != nil ? String(format: "%.0f", bill.tds!) : "")
        _penalties = State(initialValue: bill.penalties != nil ? String(format: "%.0f", bill.penalties!) : "")
        _partyCommissionCut = State(initialValue: bill.partyCommissionCut != nil ? String(format: "%.0f", bill.partyCommissionCut!) : "")
        _status = State(initialValue: bill.status ?? "pending")
        _remarks = State(initialValue: bill.remarks ?? "")
    }

    var computedNet: Double {
        let base = (Double(billAmount) ?? 0) + (Double(detention) ?? 0) + (Double(extra) ?? 0) + (Double(rto) ?? 0)
        let deductions = (Double(mamool) ?? 0) + (Double(commission) ?? 0) + (Double(tds) ?? 0) + (Double(penalties) ?? 0) + (Double(partyCommissionCut) ?? 0)
        return base - deductions
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Bill Reference") {
                    HStack {
                        Text("Bill Number").foregroundColor(.secondary)
                        Spacer()
                        Text(bill.billNumber).fontWeight(.semibold).foregroundColor(.blue)
                    }
                    DatePicker("Date", selection: $date, displayedComponents: .date)
                    if !dataStore.parties.isEmpty {
                        Picker("Party *", selection: $party) {
                            Text("— Select Party —").tag("")
                            ForEach(dataStore.parties, id: \.id) { p in
                                Text(p.name).tag(p.name)
                            }
                        }
                    } else {
                        TextField("Party Name *", text: $party)
                    }
                    TextField("Vehicle No.", text: $vehicleNo)
                    Picker("Payment Status", selection: $status) {
                        Text("Pending").tag("pending")
                        Text("Received (Paid)").tag("received")
                    }
                    .pickerStyle(.segmented)
                }

                Section("Amounts") {
                    TextField("Bill / Freight Amount (₹) *", text: $billAmount)
                        .keyboardType(.decimalPad)
                    TextField("Detention (₹)", text: $detention)
                        .keyboardType(.decimalPad)
                    TextField("Extra Charges (₹)", text: $extra)
                        .keyboardType(.decimalPad)
                    TextField("RTO Charges (₹)", text: $rto)
                        .keyboardType(.decimalPad)
                }

                Section("Deductions") {
                    TextField("Mamool (₹)", text: $mamool)
                        .keyboardType(.decimalPad)
                    TextField("Commission (₹)", text: $commission)
                        .keyboardType(.decimalPad)
                    TextField("TDS (₹)", text: $tds)
                        .keyboardType(.decimalPad)
                    TextField("Penalties (₹)", text: $penalties)
                        .keyboardType(.decimalPad)
                    TextField("Party Commission Cut (₹)", text: $partyCommissionCut)
                        .keyboardType(.decimalPad)
                }

                Section {
                    HStack {
                        Text("Net Bill Amount").fontWeight(.semibold)
                        Spacer()
                        Text(computedNet.inr()).font(.headline).fontWeight(.bold).foregroundColor(.green)
                    }
                }

                Section("Remarks") {
                    TextField("Remarks", text: $remarks, axis: .vertical)
                        .lineLimit(2...4)
                }

                if let err = errorMsg {
                    Section {
                        Text(err).font(.caption).foregroundColor(.red)
                    }
                }
            }
            .navigationTitle("Edit Bill")
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
                    .disabled(party.isEmpty || billAmount.isEmpty || isLoading)
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
        guard !party.isEmpty, let amt = Double(billAmount), amt > 0 else {
            errorMsg = "Party and valid Bill Amount are required."
            return
        }
        isLoading = true
        errorMsg = nil
        let df = DateFormatter()
        df.dateFormat = "yyyy-MM-dd"

        var body: [String: Any] = [
            "date": df.string(from: date),
            "party": party.trimmingCharacters(in: .whitespaces),
            "bill_amount": amt,
            "status": status,
            "net_amount": computedNet
        ]

        let cleanVehicle = vehicleNo.trimmingCharacters(in: .whitespaces)
        if !cleanVehicle.isEmpty { body["vehicle_no"] = cleanVehicle }
        if let v = Double(detention) { body["detention"] = v }
        if let v = Double(extra) { body["extra"] = v }
        if let v = Double(rto) { body["rto"] = v }
        if let v = Double(mamool) { body["mamool"] = v }
        if let v = Double(commission) { body["commission"] = v }
        if let v = Double(tds) { body["tds"] = v }
        if let v = Double(penalties) { body["penalties"] = v }
        if let v = Double(partyCommissionCut) { body["party_commission_cut"] = v }
        let cleanRemarks = remarks.trimmingCharacters(in: .whitespaces)
        if !cleanRemarks.isEmpty { body["remarks"] = cleanRemarks }

        do {
            _ = try await dataStore.updateBill(id: bill.id, body: body)
            dismiss()
        } catch {
            errorMsg = error.localizedDescription
            isLoading = false
        }
    }
}


