import Foundation

// MARK: - Paginated Response Wrappers
struct BillsResponse: Decodable {
    let bills: [Bill]
}
struct MemosResponse: Decodable {
    let memos: [Memo]
}
struct LoadingSlipsResponse: Decodable {
    let loadingSlips: [LoadingSlip]
}
struct BankingEntriesResponse: Decodable {
    let bankingEntries: [BankingEntry]
}
struct CashbookEntriesResponse: Decodable {
    let cashbookEntries: [CashbookEntry]
}

// MARK: - Central Data Store
@MainActor
class DataStore: ObservableObject {
    @Published var bills: [Bill] = []
    @Published var memos: [Memo] = []
    @Published var parties: [Party] = []
    @Published var suppliers: [Supplier] = []
    @Published var vehicles: [Vehicle] = []
    @Published var loadingSlips: [LoadingSlip] = []
    @Published var bankingEntries: [BankingEntry] = []
    @Published var cashbookEntries: [CashbookEntry] = []
    @Published var fuelEntries: [FuelEntry] = []

    @Published var isLoading = false
    @Published var errorMessage: String?

    private let api = APIService.shared

    // MARK: - Fetch All
    func fetchAll() {
        Task { await fetchBills() }
        Task { await fetchMemos() }
        Task { await fetchParties() }
        Task { await fetchSuppliers() }
        Task { await fetchVehicles() }
        Task { await fetchLoadingSlips() }
        Task { await fetchBankingEntries() }
        Task { await fetchCashbookEntries() }
        Task { await fetchFuelEntries() }
    }

    // MARK: - Bills
    func fetchBills() async {
        do {
            let resp: BillsResponse = try await api.get("/bills?limit=1000")
            bills = resp.bills.sorted { $0.date > $1.date }
        } catch { errorMessage = error.localizedDescription }
    }

    func createBill(body: [String: Any]) async throws -> Bill {
        let created: Bill = try await api.postRaw("/bills", body: body)
        bills.insert(created, at: 0)
        return created
    }

    func updateBill(id: String, body: [String: Any]) async throws -> Bill {
        struct Resp: Decodable { let bill: Bill }
        if let resp: Resp = try? await api.putRaw("/bills/\(id)", body: body) {
            if let idx = bills.firstIndex(where: { $0.id == id }) { bills[idx] = resp.bill }
            return resp.bill
        }
        let updated: Bill = try await api.putRaw("/bills/\(id)", body: body)
        if let idx = bills.firstIndex(where: { $0.id == id }) { bills[idx] = updated }
        return updated
    }

    func updateBill(_ bill: Bill) async throws {
        struct Resp: Decodable { let bill: Bill }
        if let resp: Resp = try? await api.put("/bills/\(bill.id)", body: bill) {
            if let idx = bills.firstIndex(where: { $0.id == bill.id }) { bills[idx] = resp.bill }
            return
        }
        let updated: Bill = try await api.put("/bills/\(bill.id)", body: bill)
        if let idx = bills.firstIndex(where: { $0.id == bill.id }) { bills[idx] = updated }
    }

    func markBillPaid(_ id: String) async throws {
        struct S: Encodable { let status: String }
        struct Resp: Decodable { let bill: Bill }
        if let resp: Resp = try? await api.put("/bills/\(id)", body: S(status: "received")) {
            if let idx = bills.firstIndex(where: { $0.id == id }) { bills[idx] = resp.bill }
            return
        }
        if let updated: Bill = try? await api.put("/bills/\(id)", body: S(status: "received")) {
            if let idx = bills.firstIndex(where: { $0.id == id }) { bills[idx] = updated }
        }
    }

    func deleteBill(_ id: String) async throws {
        try await api.delete("/bills/\(id)")
        bills.removeAll { $0.id == id }
    }

    // MARK: - Memos
    func fetchMemos() async {
        do {
            let resp: MemosResponse = try await api.get("/memos?limit=1000")
            memos = resp.memos.sorted { $0.date > $1.date }
        } catch { errorMessage = error.localizedDescription }
    }

    func createMemo(body: [String: Any]) async throws -> Memo {
        struct Resp: Decodable { let memo: Memo }
        if let resp: Resp = try? await api.postRaw("/memos", body: body) {
            memos.insert(resp.memo, at: 0)
            return resp.memo
        }
        let created: Memo = try await api.postRaw("/memos", body: body)
        memos.insert(created, at: 0)
        return created
    }

    func updateMemo(id: String, body: [String: Any]) async throws -> Memo {
        struct Resp: Decodable { let memo: Memo }
        if let resp: Resp = try? await api.putRaw("/memos/\(id)", body: body) {
            if let idx = memos.firstIndex(where: { $0.id == id }) { memos[idx] = resp.memo }
            return resp.memo
        }
        let updated: Memo = try await api.putRaw("/memos/\(id)", body: body)
        if let idx = memos.firstIndex(where: { $0.id == id }) { memos[idx] = updated }
        return updated
    }

    func updateMemo(_ memo: Memo) async throws {
        struct Resp: Decodable { let memo: Memo }
        if let resp: Resp = try? await api.put("/memos/\(memo.id)", body: memo) {
            if let idx = memos.firstIndex(where: { $0.id == memo.id }) { memos[idx] = resp.memo }
            return
        }
        let updated: Memo = try await api.put("/memos/\(memo.id)", body: memo)
        if let idx = memos.firstIndex(where: { $0.id == memo.id }) { memos[idx] = updated }
    }

    func markMemoPaid(_ id: String) async throws {
        struct S: Encodable { let status: String }
        struct Resp: Decodable { let memo: Memo }
        if let resp: Resp = try? await api.put("/memos/\(id)", body: S(status: "paid")) {
            if let idx = memos.firstIndex(where: { $0.id == id }) { memos[idx] = resp.memo }
            return
        }
        if let updated: Memo = try? await api.put("/memos/\(id)", body: S(status: "paid")) {
            if let idx = memos.firstIndex(where: { $0.id == id }) { memos[idx] = updated }
        }
    }

    func deleteMemo(_ id: String) async throws {
        try await api.delete("/memos/\(id)")
        memos.removeAll { $0.id == id }
    }

    // MARK: - Parties
    func fetchParties() async {
        do {
            struct Resp: Decodable { let parties: [Party]? }
            if let resp = try? await api.get("/parties") as Resp, let p = resp.parties {
                parties = p.sorted { $0.name < $1.name }
            } else {
                let arr: [Party] = try await api.get("/parties")
                parties = arr.sorted { $0.name < $1.name }
            }
        } catch { errorMessage = error.localizedDescription }
    }

    func createParty(body: [String: Any]) async throws -> Party {
        struct Resp: Decodable { let party: Party }
        if let resp: Resp = try? await api.postRaw("/parties", body: body) {
            parties.append(resp.party); parties.sort { $0.name < $1.name }
            return resp.party
        }
        let created: Party = try await api.postRaw("/parties", body: body)
        parties.append(created); parties.sort { $0.name < $1.name }
        return created
    }

    // MARK: - Suppliers
    func fetchSuppliers() async {
        do {
            struct Resp: Decodable { let suppliers: [Supplier]? }
            if let resp = try? await api.get("/suppliers") as Resp, let s = resp.suppliers {
                suppliers = s.sorted { $0.name < $1.name }
            } else {
                let arr: [Supplier] = try await api.get("/suppliers")
                suppliers = arr.sorted { $0.name < $1.name }
            }
        } catch { errorMessage = error.localizedDescription }
    }

    func createSupplier(body: [String: Any]) async throws -> Supplier {
        struct Resp: Decodable { let supplier: Supplier }
        if let resp: Resp = try? await api.postRaw("/suppliers", body: body) {
            suppliers.append(resp.supplier); suppliers.sort { $0.name < $1.name }
            return resp.supplier
        }
        let created: Supplier = try await api.postRaw("/suppliers", body: body)
        suppliers.append(created); suppliers.sort { $0.name < $1.name }
        return created
    }

    // MARK: - Vehicles
    func fetchVehicles() async {
        do {
            struct Resp: Decodable { let vehicles: [Vehicle]? }
            if let resp = try? await api.get("/vehicles") as Resp, let v = resp.vehicles {
                vehicles = v.sorted { $0.vehicleNo < $1.vehicleNo }
            } else {
                let arr: [Vehicle] = try await api.get("/vehicles")
                vehicles = arr.sorted { $0.vehicleNo < $1.vehicleNo }
            }
        } catch { errorMessage = error.localizedDescription }
    }

    func createVehicle(body: [String: Any]) async throws -> Vehicle {
        struct Resp: Decodable { let vehicle: Vehicle }
        if let resp: Resp = try? await api.postRaw("/vehicles", body: body) {
            vehicles.append(resp.vehicle); vehicles.sort { $0.vehicleNo < $1.vehicleNo }
            return resp.vehicle
        }
        let created: Vehicle = try await api.postRaw("/vehicles", body: body)
        vehicles.append(created); vehicles.sort { $0.vehicleNo < $1.vehicleNo }
        return created
    }

    // MARK: - Loading Slips
    func fetchLoadingSlips() async {
        do {
            let resp: LoadingSlipsResponse = try await api.get("/loading-slips?limit=1000")
            loadingSlips = resp.loadingSlips.sorted { $0.date > $1.date }
        } catch { errorMessage = error.localizedDescription }
    }

    func createLoadingSlip(body: [String: Any]) async throws -> LoadingSlip {
        struct Resp: Decodable { let loadingSlip: LoadingSlip }
        let resp: Resp = try await api.postRaw("/loading-slips", body: body)
        loadingSlips.insert(resp.loadingSlip, at: 0)
        return resp.loadingSlip
    }

    func updateLoadingSlip(id: String, body: [String: Any]) async throws -> LoadingSlip {
        struct Resp: Decodable { let loadingSlip: LoadingSlip }
        if let resp: Resp = try? await api.putRaw("/loading-slips/\(id)", body: body) {
            if let idx = loadingSlips.firstIndex(where: { $0.id == id }) { loadingSlips[idx] = resp.loadingSlip }
            return resp.loadingSlip
        }
        let updated: LoadingSlip = try await api.putRaw("/loading-slips/\(id)", body: body)
        if let idx = loadingSlips.firstIndex(where: { $0.id == id }) { loadingSlips[idx] = updated }
        return updated
    }

    func deleteLoadingSlip(_ id: String) async throws {
        try await api.delete("/loading-slips/\(id)")
        loadingSlips.removeAll { $0.id == id }
    }

    func nextLRNumber(branchCode: String = "AHD") async -> String {
        struct R: Decodable { let nextLRNumber: String? }
        if let r = try? await api.get("/loading-slips/next-number?branch_code=\(branchCode)") as R {
            return r.nextLRNumber ?? "AUTO"
        }
        return "AUTO"
    }

    func availableForBilling() async -> [LoadingSlip] {
        struct R: Decodable { let loadingSlips: [LoadingSlip] }
        if let r = try? await api.get("/loading-slips/available-for-billing") as R {
            return r.loadingSlips
        }
        return []
    }

    func availableForMemo() -> [LoadingSlip] {
        loadingSlips.filter { $0.memoNumber == nil || $0.memoNumber?.isEmpty == true }
    }

    // MARK: - Banking
    func fetchBankingEntries() async {
        do {
            let resp: BankingEntriesResponse = try await api.get("/banking?limit=10000")
            bankingEntries = resp.bankingEntries.sorted { $0.date > $1.date }
        } catch { errorMessage = error.localizedDescription }
    }

    func createBankingEntry(body: [String: Any]) async throws -> BankingEntry {
        struct Resp: Decodable { let bankingEntry: BankingEntry }
        if let resp: Resp = try? await api.postRaw("/banking", body: body) {
            bankingEntries.insert(resp.bankingEntry, at: 0)
            return resp.bankingEntry
        }
        let created: BankingEntry = try await api.postRaw("/banking", body: body)
        bankingEntries.insert(created, at: 0)
        return created
    }

    func deleteBankingEntry(_ id: String) async throws {
        try await api.delete("/banking/\(id)")
        bankingEntries.removeAll { $0.id == id }
    }

    // MARK: - Cashbook
    func fetchCashbookEntries() async {
        do {
            let resp: CashbookEntriesResponse = try await api.get("/cashbook?limit=10000")
            cashbookEntries = resp.cashbookEntries.sorted { $0.date > $1.date }
        } catch { errorMessage = error.localizedDescription }
    }

    func createCashbookEntry(body: [String: Any]) async throws -> CashbookEntry {
        struct Resp: Decodable { let cashbookEntry: CashbookEntry }
        if let resp: Resp = try? await api.postRaw("/cashbook", body: body) {
            cashbookEntries.insert(resp.cashbookEntry, at: 0)
            return resp.cashbookEntry
        }
        let created: CashbookEntry = try await api.postRaw("/cashbook", body: body)
        cashbookEntries.insert(created, at: 0)
        return created
    }

    func deleteCashbookEntry(_ id: String) async throws {
        try await api.delete("/cashbook/\(id)")
        cashbookEntries.removeAll { $0.id == id }
    }

    // MARK: - Fuel
    func fetchFuelEntries() async {
        do {
            struct R: Decodable { let transactions: [FuelEntry]? }
            if let r = try? await api.get("/fuel/transactions?limit=500") as R, let e = r.transactions {
                fuelEntries = e.sorted { $0.date > $1.date }
            } else {
                let arr: [FuelEntry] = try await api.get("/fuel/transactions?limit=500")
                fuelEntries = arr.sorted { $0.date > $1.date }
            }
        } catch { errorMessage = error.localizedDescription }
    }

    func createFuelEntry(body: [String: Any]) async throws -> FuelEntry {
        struct Resp: Decodable { let transaction: FuelEntry }
        if let resp: Resp = try? await api.postRaw("/fuel/transactions", body: body) {
            fuelEntries.insert(resp.transaction, at: 0)
            return resp.transaction
        }
        let created: FuelEntry = try await api.postRaw("/fuel/transactions", body: body)
        fuelEntries.insert(created, at: 0)
        return created
    }

    // MARK: - Computed Stats
    var totalUnpaidPartyBalance: Double {
        bills.filter { !$0.isPaid }.reduce(0.0) { $0 + max(0, $1.computedNet) }
    }
    var totalUnpaidSupplierBalance: Double {
        memos.filter { !$0.isPaid }.reduce(0.0) { $0 + max(0, $1.netAmount) }
    }
    var totalRevenue: Double { bills.reduce(0) { $0 + $1.effectiveInvoiceAmount } }
    var bankBalance: Double {
        bankingEntries.filter { $0.type == "credit" }.reduce(0.0) { $0 + $1.amount } -
        bankingEntries.filter { $0.type == "debit" }.reduce(0.0) { $0 + $1.amount }
    }
    var cashBalance: Double {
        cashbookEntries.filter { $0.type == "credit" }.reduce(0.0) { $0 + $1.amount } -
        cashbookEntries.filter { $0.type == "debit" }.reduce(0.0) { $0 + $1.amount }
    }
}
