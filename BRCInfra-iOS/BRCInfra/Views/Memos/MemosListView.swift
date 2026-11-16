import SwiftUI

struct MemosListView: View {
    @EnvironmentObject var dataStore: DataStore
    @EnvironmentObject var authStore: AuthStore
    @State private var searchText = ""
    @State private var filterStatus = "all"
    @State private var showCreate = false
    @State private var editingMemo: Memo?
    @State private var previewMemo: Memo?
    @State private var errorMsg: String?

    var filtered: [Memo] {
        var result = dataStore.memos
        switch filterStatus {
        case "paid": result = result.filter { $0.isPaid }
        case "unpaid": result = result.filter { !$0.isPaid }
        default: break
        }
        if !searchText.isEmpty {
            result = result.filter {
                $0.memoNumber.localizedCaseInsensitiveContains(searchText) ||
                $0.supplier.localizedCaseInsensitiveContains(searchText) ||
                ($0.vehicleNo ?? "").localizedCaseInsensitiveContains(searchText)
            }
        }
        return result
    }

    var body: some View {
        NavigationStack {
            Group {
                if filtered.isEmpty {
                    ContentUnavailableView("No Memos", systemImage: "doc.plaintext")
                } else {
                    List {
                        ForEach(filtered) { memo in
                            NavigationLink(destination: MemoDetailView(memo: memo)) {
                                MemoRowView(memo: memo)
                            }
                            .listRowInsets(EdgeInsets(top: 6, leading: 16, bottom: 6, trailing: 16))
                            .listRowSeparator(.hidden)
                            .swipeActions(edge: .leading, allowsFullSwipe: false) {
                                if authStore.can(.editMemo) {
                                    Button {
                                        editingMemo = memo
                                    } label: {
                                        Label("Edit", systemImage: "pencil")
                                    }.tint(.blue)
                                }

                                if authStore.can(.downloadMemoPDF) {
                                    Button {
                                        previewMemo = memo
                                    } label: {
                                        Label("PDF", systemImage: "doc.text.fill")
                                    }.tint(.indigo)
                                }

                                if authStore.can(.markMemoPaid) && !memo.isPaid {
                                    Button {
                                        Task {
                                            do { try await dataStore.markMemoPaid(memo.id) }
                                            catch { errorMsg = error.localizedDescription }
                                        }
                                    } label: {
                                        Label("Paid", systemImage: "checkmark.circle.fill")
                                    }.tint(.green)
                                }
                            }
                            .swipeActions(edge: .trailing) {
                                if authStore.can(.deleteMemo) {
                                    Button(role: .destructive) {
                                        Task {
                                            do { try await dataStore.deleteMemo(memo.id) }
                                            catch { errorMsg = error.localizedDescription }
                                        }
                                    } label: { Label("Delete", systemImage: "trash") }
                                }
                            }
                        }
                    }
                    .listStyle(.plain)
                    .searchable(text: $searchText, prompt: "Search memo no. or supplier")
                }
            }
            .navigationTitle("Freight Memos")
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Picker("", selection: $filterStatus) {
                        Text("All").tag("all")
                        Text("Paid").tag("paid")
                        Text("Unpaid").tag("unpaid")
                    }.pickerStyle(.segmented).frame(width: 180)
                }
                ToolbarItem(placement: .navigationBarTrailing) {
                    if authStore.can(.createMemo) {
                        Button { showCreate = true } label: { Image(systemName: "plus") }
                    }
                }
            }
            .sheet(isPresented: $showCreate) {
                CreateMemoView().environmentObject(dataStore)
            }
            .sheet(item: $editingMemo) { memo in
                EditMemoView(memo: memo).environmentObject(dataStore)
            }
            .sheet(item: $previewMemo) { memo in
                PDFPreviewView(
                    title: "Memo \(memo.memoNumber)",
                    pdfData: PDFService.shared.generateMemoPDF(memo: memo),
                    filename: "Memo_\(memo.memoNumber).pdf"
                )
            }
            .refreshable { await dataStore.fetchMemos() }
        }
    }
}

struct MemoDetailView: View {
    let memo: Memo
    @EnvironmentObject var dataStore: DataStore
    @EnvironmentObject var authStore: AuthStore
    @State private var showEdit = false
    @State private var showPDF = false

    var currentMemo: Memo {
        dataStore.memos.first(where: { $0.id == memo.id }) ?? memo
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                InfoCard(title: "Memo Info") {
                    InfoRow(label: "Memo No.", value: currentMemo.memoNumber)
                    InfoRow(label: "Date", value: currentMemo.date.formattedDate())
                    InfoRow(label: "Supplier", value: currentMemo.supplier)
                    if let vn = currentMemo.vehicleNo, !vn.isEmpty { InfoRow(label: "Vehicle", value: vn) }
                    InfoRow(label: "Status", value: currentMemo.statusLabel)
                }
                InfoCard(title: "Amounts") {
                    InfoRow(label: "Freight", value: currentMemo.freight.inr())
                    if let v = currentMemo.detention, v > 0 { InfoRow(label: "Detention", value: v.inr()) }
                    if let v = currentMemo.extra, v > 0 { InfoRow(label: "Extra", value: v.inr()) }
                    if let v = currentMemo.rto, v > 0 { InfoRow(label: "RTO", value: v.inr()) }
                    InfoRow(label: "Net Amount", value: currentMemo.netAmount.inr())
                }
                InfoCard(title: "Deductions") {
                    if let v = currentMemo.commission, v > 0 { InfoRow(label: "Commission", value: v.inr()) }
                    if let v = currentMemo.mamool, v > 0 { InfoRow(label: "Mamool", value: v.inr()) }
                    if let v = currentMemo.deduction, v > 0 { InfoRow(label: "Other Deduction", value: v.inr()) }
                }
                if let r = currentMemo.remarks, !r.isEmpty {
                    InfoCard(title: "Remarks") { InfoRow(label: "", value: r) }
                }

                // Quick Action Buttons
                VStack(spacing: 12) {
                    if authStore.can(.downloadMemoPDF) {
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

                    if authStore.can(.editMemo) {
                        Button {
                            showEdit = true
                        } label: {
                            HStack(spacing: 8) {
                                Image(systemName: "pencil")
                                Text("Edit Memo")
                            }
                            .font(.headline)
                            .foregroundColor(.blue)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 13)
                            .background(Color.blue.opacity(0.12))
                            .cornerRadius(12)
                        }
                    }

                    if authStore.can(.markMemoPaid) && !currentMemo.isPaid {
                        Button("Mark as Paid") {
                            Task { try? await dataStore.markMemoPaid(currentMemo.id) }
                        }
                        .buttonStyle(.borderedProminent).tint(.orange)
                        .frame(maxWidth: .infinity)
                    }
                }
                .padding(.top, 4)
            }
            .padding(16)
        }
        .background(Color(.systemGroupedBackground))
        .navigationTitle("Memo \(currentMemo.memoNumber)").navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItemGroup(placement: .navigationBarTrailing) {
                if authStore.can(.downloadMemoPDF) {
                    Button {
                        showPDF = true
                    } label: {
                        Image(systemName: "doc.text.fill")
                    }
                }

                if authStore.can(.editMemo) {
                    Button {
                        showEdit = true
                    } label: {
                        Text("Edit")
                    }
                }
            }
        }
        .sheet(isPresented: $showEdit) {
            EditMemoView(memo: currentMemo).environmentObject(dataStore)
        }
        .sheet(isPresented: $showPDF) {
            PDFPreviewView(
                title: "Memo \(currentMemo.memoNumber)",
                pdfData: PDFService.shared.generateMemoPDF(memo: currentMemo),
                filename: "Memo_\(currentMemo.memoNumber).pdf"
            )
        }
    }
}

struct MemoRowView: View {
    let memo: Memo
    private var statusColor: Color { memo.isPaid ? Color(hex: "059669") : Color(hex: "D97706") }
    private var accentColor: Color { Color(hex: "EA580C") }

    var body: some View {
        HStack(spacing: 0) {
            Rectangle()
                .fill(statusColor)
                .frame(width: 4)
                .clipShape(RoundedRectangle(cornerRadius: 2))
                .padding(.vertical, 4)

            HStack(spacing: 12) {
                ZStack {
                    RoundedRectangle(cornerRadius: 10)
                        .fill(accentColor.opacity(0.09))
                        .frame(width: 42, height: 42)
                    Image(systemName: "receipt.fill")
                        .font(.system(size: 17, weight: .semibold))
                        .foregroundColor(accentColor)
                }

                VStack(alignment: .leading, spacing: 3) {
                    Text(memo.memoNumber)
                        .font(.system(size: 14, weight: .bold))
                        .foregroundColor(Color(hex: "0F172A"))
                    Text(memo.supplier)
                        .font(.system(size: 12, weight: .medium))
                        .foregroundColor(Color(hex: "475569"))
                        .lineLimit(1)
                    HStack(spacing: 6) {
                        Text(memo.date.formattedDate())
                            .font(.system(size: 11))
                            .foregroundColor(Color(hex: "94A3B8"))
                        if let vn = memo.vehicleNo, !vn.isEmpty {
                            Text(vn)
                                .font(.system(size: 10, weight: .semibold))
                                .padding(.horizontal, 5).padding(.vertical, 2)
                                .background(Color(hex: "F1F5F9"))
                                .foregroundColor(Color(hex: "475569"))
                                .clipShape(Capsule())
                        }
                    }
                }

                Spacer()

                VStack(alignment: .trailing, spacing: 5) {
                    Text(memo.netAmount.inr())
                        .font(.system(size: 14, weight: .bold))
                        .foregroundColor(Color(hex: "0F172A"))
                    Text(memo.statusLabel)
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

// MARK: - Create Memo View
struct CreateMemoView: View {
    @EnvironmentObject var dataStore: DataStore
    @Environment(\.dismiss) var dismiss

    @State private var date = Date()
    @State private var supplier = ""
    @State private var vehicleNo = ""
    @State private var freight = ""
    @State private var commission = ""
    @State private var mamool = ""
    @State private var detention = ""
    @State private var extra = ""
    @State private var rto = ""
    @State private var deduction = ""
    @State private var remarks = ""
    @State private var selectedLRId = ""
    @State private var availableLRs: [LoadingSlip] = []
    @State private var isLoading = false
    @State private var errorMsg: String?

    var netAmount: Double {
        let base = (Double(freight) ?? 0) + (Double(detention) ?? 0) + (Double(extra) ?? 0) + (Double(rto) ?? 0)
        let deductions = (Double(commission) ?? 0) + (Double(mamool) ?? 0) + (Double(deduction) ?? 0)
        return base - deductions
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Select LR *") {
                    if availableLRs.isEmpty {
                        Text("No LRs without memos. Create a Loading Slip first.")
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
                                if let s = lr.supplier, !s.isEmpty { supplier = s }
                                if let vn = lr.vehicleNo, !vn.isEmpty { vehicleNo = vn }
                                if let f = lr.freight { freight = String(format: "%.0f", f) }
                            }
                        }
                    }
                }

                Section("Memo Details") {
                    DatePicker("Date", selection: $date, displayedComponents: .date)
                    if !dataStore.suppliers.isEmpty {
                        Picker("Supplier", selection: $supplier) {
                            Text("— Select Supplier —").tag("")
                            ForEach(dataStore.suppliers, id: \.id) { s in
                                Text(s.name).tag(s.name)
                            }
                        }
                    } else {
                        TextField("Supplier Name *", text: $supplier)
                    }
                    TextField("Vehicle No.", text: $vehicleNo)
                    TextField("Freight Amount (₹) *", text: $freight).keyboardType(.decimalPad)
                }

                Section("Deductions") {
                    HStack { Text("Commission"); Spacer(); TextField("0", text: $commission).keyboardType(.decimalPad).multilineTextAlignment(.trailing).frame(width: 100) }
                    HStack { Text("Mamool"); Spacer(); TextField("0", text: $mamool).keyboardType(.decimalPad).multilineTextAlignment(.trailing).frame(width: 100) }
                    HStack { Text("Detention"); Spacer(); TextField("0", text: $detention).keyboardType(.decimalPad).multilineTextAlignment(.trailing).frame(width: 100) }
                    HStack { Text("Extra"); Spacer(); TextField("0", text: $extra).keyboardType(.decimalPad).multilineTextAlignment(.trailing).frame(width: 100) }
                    HStack { Text("RTO"); Spacer(); TextField("0", text: $rto).keyboardType(.decimalPad).multilineTextAlignment(.trailing).frame(width: 100) }
                    HStack { Text("Other Deduction"); Spacer(); TextField("0", text: $deduction).keyboardType(.decimalPad).multilineTextAlignment(.trailing).frame(width: 100) }
                }

                Section {
                    HStack {
                        Text("Net Amount").fontWeight(.semibold)
                        Spacer()
                        Text(netAmount.inr()).fontWeight(.bold).foregroundColor(netAmount >= 0 ? .orange : .red)
                    }
                }

                Section("Remarks") {
                    TextField("Remarks", text: $remarks, axis: .vertical).lineLimit(2...4)
                }

                if let err = errorMsg {
                    Section { Text(err).foregroundColor(.red).font(.caption) }
                }
            }
            .navigationTitle("New Freight Memo")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { save() }
                        .disabled(isLoading || supplier.isEmpty || freight.isEmpty || selectedLRId.isEmpty)
                        .fontWeight(.semibold)
                }
            }
            .task { availableLRs = dataStore.availableForMemo() }
        }
    }

    func save() {
        isLoading = true; errorMsg = nil
        var body: [String: Any] = [
            "date": date.toYMD().toISODate(),
            "supplier": supplier,
            "freight": Double(freight) ?? 0,
            "net_amount": netAmount,
            "loading_slip_id": selectedLRId,
            "loading_slip_ids": [selectedLRId],
            "status": "pending"
        ]
        if !vehicleNo.isEmpty { body["vehicle_no"] = vehicleNo }
        if let v = Double(commission), v > 0 { body["commission"] = v }
        if let v = Double(mamool), v > 0 { body["mamool"] = v }
        if let v = Double(detention), v > 0 { body["detention"] = v }
        if let v = Double(extra), v > 0 { body["extra"] = v }
        if let v = Double(rto), v > 0 { body["rto"] = v }
        if let v = Double(deduction), v > 0 { body["deduction"] = v }
        if !remarks.isEmpty { body["remarks"] = remarks }

        Task {
            do {
                _ = try await dataStore.createMemo(body: body)
                await dataStore.fetchLoadingSlips()
                await MainActor.run { dismiss() }
            } catch {
                await MainActor.run { errorMsg = error.localizedDescription; isLoading = false }
            }
        }
    }
}

// MARK: - Edit Memo View
struct EditMemoView: View {
    let memo: Memo
    @EnvironmentObject var dataStore: DataStore
    @Environment(\.dismiss) var dismiss

    @State private var date: Date
    @State private var supplier: String
    @State private var vehicleNo: String
    @State private var freight: String
    @State private var commission: String
    @State private var mamool: String
    @State private var detention: String
    @State private var extra: String
    @State private var rto: String
    @State private var deduction: String
    @State private var status: String
    @State private var remarks: String
    @State private var isLoading = false
    @State private var errorMsg: String?

    init(memo: Memo) {
        self.memo = memo
        let df = DateFormatter()
        df.dateFormat = "yyyy-MM-dd"
        let parsedDate: Date
        if let d = df.date(from: String(memo.date.prefix(10))) {
            parsedDate = d
        } else {
            parsedDate = Date()
        }
        _date = State(initialValue: parsedDate)
        _supplier = State(initialValue: memo.supplier)
        _vehicleNo = State(initialValue: memo.vehicleNo ?? "")
        _freight = State(initialValue: String(format: "%.0f", memo.freight))
        _commission = State(initialValue: memo.commission != nil ? String(format: "%.0f", memo.commission!) : "")
        _mamool = State(initialValue: memo.mamool != nil ? String(format: "%.0f", memo.mamool!) : "")
        _detention = State(initialValue: memo.detention != nil ? String(format: "%.0f", memo.detention!) : "")
        _extra = State(initialValue: memo.extra != nil ? String(format: "%.0f", memo.extra!) : "")
        _rto = State(initialValue: memo.rto != nil ? String(format: "%.0f", memo.rto!) : "")
        _deduction = State(initialValue: memo.deduction != nil ? String(format: "%.0f", memo.deduction!) : "")
        _status = State(initialValue: memo.status ?? "pending")
        _remarks = State(initialValue: memo.remarks ?? "")
    }

    var computedNet: Double {
        let base = (Double(freight) ?? 0) + (Double(detention) ?? 0) + (Double(extra) ?? 0) + (Double(rto) ?? 0)
        let deductions = (Double(commission) ?? 0) + (Double(mamool) ?? 0) + (Double(deduction) ?? 0)
        return base - deductions
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Memo Reference") {
                    HStack {
                        Text("Memo Number").foregroundColor(.secondary)
                        Spacer()
                        Text(memo.memoNumber).fontWeight(.semibold).foregroundColor(.blue)
                    }
                    DatePicker("Date", selection: $date, displayedComponents: .date)
                    if !dataStore.suppliers.isEmpty {
                        Picker("Supplier *", selection: $supplier) {
                            Text("— Select Supplier —").tag("")
                            ForEach(dataStore.suppliers, id: \.id) { s in
                                Text(s.name).tag(s.name)
                            }
                        }
                    } else {
                        TextField("Supplier Name *", text: $supplier)
                    }
                    TextField("Vehicle No.", text: $vehicleNo)
                    Picker("Payment Status", selection: $status) {
                        Text("Pending").tag("pending")
                        Text("Paid").tag("paid")
                    }
                    .pickerStyle(.segmented)
                }

                Section("Freight & Additions") {
                    TextField("Freight Amount (₹) *", text: $freight)
                        .keyboardType(.decimalPad)
                    TextField("Detention (₹)", text: $detention)
                        .keyboardType(.decimalPad)
                    TextField("Extra Charges (₹)", text: $extra)
                        .keyboardType(.decimalPad)
                    TextField("RTO Allowance (₹)", text: $rto)
                        .keyboardType(.decimalPad)
                }

                Section("Deductions") {
                    TextField("Commission (₹)", text: $commission)
                        .keyboardType(.decimalPad)
                    TextField("Mamool (₹)", text: $mamool)
                        .keyboardType(.decimalPad)
                    TextField("Other Deductions (₹)", text: $deduction)
                        .keyboardType(.decimalPad)
                }

                Section {
                    HStack {
                        Text("Net Payable to Supplier").fontWeight(.semibold)
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
            .navigationTitle("Edit Memo")
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
                    .disabled(supplier.isEmpty || freight.isEmpty || isLoading)
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
        guard !supplier.isEmpty, let amt = Double(freight), amt > 0 else {
            errorMsg = "Supplier and valid Freight Amount are required."
            return
        }
        isLoading = true
        errorMsg = nil
        let df = DateFormatter()
        df.dateFormat = "yyyy-MM-dd"

        var body: [String: Any] = [
            "date": df.string(from: date),
            "supplier": supplier.trimmingCharacters(in: .whitespaces),
            "freight": amt,
            "status": status,
            "net_amount": computedNet
        ]

        let cleanVehicle = vehicleNo.trimmingCharacters(in: .whitespaces)
        if !cleanVehicle.isEmpty { body["vehicle_no"] = cleanVehicle }
        if let v = Double(detention) { body["detention"] = v }
        if let v = Double(extra) { body["extra"] = v }
        if let v = Double(rto) { body["rto"] = v }
        if let v = Double(commission) { body["commission"] = v }
        if let v = Double(mamool) { body["mamool"] = v }
        if let v = Double(deduction) { body["deduction"] = v }
        let cleanRemarks = remarks.trimmingCharacters(in: .whitespaces)
        if !cleanRemarks.isEmpty { body["remarks"] = cleanRemarks }

        do {
            _ = try await dataStore.updateMemo(id: memo.id, body: body)
            dismiss()
        } catch {
            errorMsg = error.localizedDescription
            isLoading = false
        }
    }
}


