import Foundation

// MARK: - Bill
struct Bill: Codable, Identifiable {
    var id: String
    var billNumber: String
    var date: String
    var party: String
    var partyName: String?
    var billAmount: Double
    var grossInvoiceAmount: Double?
    var gstAmount: Double?
    var cgstAmount: Double?
    var sgstAmount: Double?
    var igstAmount: Double?
    var tripCount: Int?
    var loadingSlipIds: [String]?
    var linkedLrNumbers: [String]?
    var mamool: Double?
    var commission: Double?
    var detention: Double?
    var rto: Double?
    var extra: Double?
    var tds: Double?
    var penalties: Double?
    var partyCommissionCut: Double?
    var netAmount: Double?
    var status: String?
    var loadingSlipId: String?
    var remarks: String?
    var vehicleNo: String?

    enum CodingKeys: String, CodingKey {
        case id = "_id"
        case billNumber = "bill_number"
        case date, party
        case partyName = "party_name"
        case billAmount = "bill_amount"
        case grossInvoiceAmount = "gross_invoice_amount"
        case gstAmount = "gst_amount"
        case cgstAmount = "cgst_amount"
        case sgstAmount = "sgst_amount"
        case igstAmount = "igst_amount"
        case tripCount = "trip_count"
        case loadingSlipIds = "loading_slip_ids"
        case linkedLrNumbers = "linked_lr_numbers"
        case mamool, commission, detention, rto, extra, tds, penalties
        case partyCommissionCut = "party_commission_cut"
        case netAmount = "net_amount"
        case status
        case loadingSlipId = "loading_slip_id"
        case remarks
        case vehicleNo = "vehicle_no"
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = (try? c.decodeIfPresent(String.self, forKey: .id)) ?? UUID().uuidString
        billNumber = (try? c.decodeIfPresent(String.self, forKey: .billNumber)) ?? ""
        date = (try? c.decodeIfPresent(String.self, forKey: .date)) ?? ""
        let decodedParty = try? c.decodeIfPresent(String.self, forKey: .party)
        let decodedPartyName = try? c.decodeIfPresent(String.self, forKey: .partyName)
        party = (decodedParty?.isEmpty == false ? decodedParty : decodedPartyName) ?? ""
        partyName = decodedPartyName
        billAmount = (try? c.decodeIfPresent(Double.self, forKey: .billAmount)) ?? 0
        grossInvoiceAmount = try? c.decodeIfPresent(Double.self, forKey: .grossInvoiceAmount)
        gstAmount = try? c.decodeIfPresent(Double.self, forKey: .gstAmount)
        cgstAmount = try? c.decodeIfPresent(Double.self, forKey: .cgstAmount)
        sgstAmount = try? c.decodeIfPresent(Double.self, forKey: .sgstAmount)
        igstAmount = try? c.decodeIfPresent(Double.self, forKey: .igstAmount)
        tripCount = try? c.decodeIfPresent(Int.self, forKey: .tripCount)
        loadingSlipIds = try? c.decodeIfPresent([String].self, forKey: .loadingSlipIds)
        linkedLrNumbers = try? c.decodeIfPresent([String].self, forKey: .linkedLrNumbers)
        mamool = try? c.decodeIfPresent(Double.self, forKey: .mamool)
        commission = try? c.decodeIfPresent(Double.self, forKey: .commission)
        detention = try? c.decodeIfPresent(Double.self, forKey: .detention)
        rto = try? c.decodeIfPresent(Double.self, forKey: .rto)
        extra = try? c.decodeIfPresent(Double.self, forKey: .extra)
        tds = try? c.decodeIfPresent(Double.self, forKey: .tds)
        penalties = try? c.decodeIfPresent(Double.self, forKey: .penalties)
        partyCommissionCut = try? c.decodeIfPresent(Double.self, forKey: .partyCommissionCut)
        netAmount = try? c.decodeIfPresent(Double.self, forKey: .netAmount)
        status = try? c.decodeIfPresent(String.self, forKey: .status)
        loadingSlipId = try? c.decodeIfPresent(String.self, forKey: .loadingSlipId)
        remarks = try? c.decodeIfPresent(String.self, forKey: .remarks)
        vehicleNo = try? c.decodeIfPresent(String.self, forKey: .vehicleNo)
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(billNumber, forKey: .billNumber)
        try c.encode(date, forKey: .date)
        try c.encode(party, forKey: .party)
        try c.encodeIfPresent(partyName, forKey: .partyName)
        try c.encode(billAmount, forKey: .billAmount)
        try c.encodeIfPresent(grossInvoiceAmount, forKey: .grossInvoiceAmount)
        try c.encodeIfPresent(gstAmount, forKey: .gstAmount)
        try c.encodeIfPresent(cgstAmount, forKey: .cgstAmount)
        try c.encodeIfPresent(sgstAmount, forKey: .sgstAmount)
        try c.encodeIfPresent(igstAmount, forKey: .igstAmount)
        try c.encodeIfPresent(tripCount, forKey: .tripCount)
        try c.encodeIfPresent(loadingSlipIds, forKey: .loadingSlipIds)
        try c.encodeIfPresent(linkedLrNumbers, forKey: .linkedLrNumbers)
        try c.encodeIfPresent(mamool, forKey: .mamool)
        try c.encodeIfPresent(commission, forKey: .commission)
        try c.encodeIfPresent(detention, forKey: .detention)
        try c.encodeIfPresent(rto, forKey: .rto)
        try c.encodeIfPresent(extra, forKey: .extra)
        try c.encodeIfPresent(tds, forKey: .tds)
        try c.encodeIfPresent(penalties, forKey: .penalties)
        try c.encodeIfPresent(partyCommissionCut, forKey: .partyCommissionCut)
        try c.encodeIfPresent(netAmount, forKey: .netAmount)
        try c.encodeIfPresent(status, forKey: .status)
        try c.encodeIfPresent(loadingSlipId, forKey: .loadingSlipId)
        try c.encodeIfPresent(remarks, forKey: .remarks)
        try c.encodeIfPresent(vehicleNo, forKey: .vehicleNo)
    }

    var effectiveInvoiceAmount: Double {
        grossInvoiceAmount ?? netAmount ?? billAmount
    }

    var computedNet: Double {
        let base = effectiveInvoiceAmount + (detention ?? 0) + (extra ?? 0) + (rto ?? 0)
        let deductions = (mamool ?? 0) + (commission ?? 0) + (tds ?? 0) + (penalties ?? 0) + (partyCommissionCut ?? 0)
        return base - deductions
    }
    var isPaid: Bool { status == "received" }
    var statusLabel: String { isPaid ? "Received" : "Pending" }
}

// MARK: - Memo
struct Memo: Codable, Identifiable {
    var id: String
    var memoNumber: String
    var date: String
    var supplier: String
    var vehicleNo: String?
    var freight: Double
    var commission: Double?
    var mamool: Double?
    var detention: Double?
    var extra: Double?
    var rto: Double?
    var deduction: Double?
    var netAmount: Double
    var status: String?
    var loadingSlipId: String?
    var remarks: String?

    enum CodingKeys: String, CodingKey {
        case id = "_id"
        case memoNumber = "memo_number"
        case date, supplier
        case vehicleNo = "vehicle_no"
        case freight, commission, mamool, detention, extra, rto, deduction
        case netAmount = "net_amount"
        case status
        case loadingSlipId = "loading_slip_id"
        case remarks
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = (try? c.decodeIfPresent(String.self, forKey: .id)) ?? UUID().uuidString
        memoNumber = (try? c.decodeIfPresent(String.self, forKey: .memoNumber)) ?? ""
        date = (try? c.decodeIfPresent(String.self, forKey: .date)) ?? ""
        supplier = (try? c.decodeIfPresent(String.self, forKey: .supplier)) ?? ""
        vehicleNo = try? c.decodeIfPresent(String.self, forKey: .vehicleNo)
        freight = (try? c.decodeIfPresent(Double.self, forKey: .freight)) ?? 0
        commission = try? c.decodeIfPresent(Double.self, forKey: .commission)
        mamool = try? c.decodeIfPresent(Double.self, forKey: .mamool)
        detention = try? c.decodeIfPresent(Double.self, forKey: .detention)
        extra = try? c.decodeIfPresent(Double.self, forKey: .extra)
        rto = try? c.decodeIfPresent(Double.self, forKey: .rto)
        deduction = try? c.decodeIfPresent(Double.self, forKey: .deduction)
        netAmount = (try? c.decodeIfPresent(Double.self, forKey: .netAmount)) ?? freight
        status = try? c.decodeIfPresent(String.self, forKey: .status)
        loadingSlipId = try? c.decodeIfPresent(String.self, forKey: .loadingSlipId)
        remarks = try? c.decodeIfPresent(String.self, forKey: .remarks)
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(memoNumber, forKey: .memoNumber)
        try c.encode(date, forKey: .date)
        try c.encode(supplier, forKey: .supplier)
        try c.encodeIfPresent(vehicleNo, forKey: .vehicleNo)
        try c.encode(freight, forKey: .freight)
        try c.encodeIfPresent(commission, forKey: .commission)
        try c.encodeIfPresent(mamool, forKey: .mamool)
        try c.encodeIfPresent(detention, forKey: .detention)
        try c.encodeIfPresent(extra, forKey: .extra)
        try c.encodeIfPresent(rto, forKey: .rto)
        try c.encodeIfPresent(deduction, forKey: .deduction)
        try c.encode(netAmount, forKey: .netAmount)
        try c.encodeIfPresent(status, forKey: .status)
        try c.encodeIfPresent(loadingSlipId, forKey: .loadingSlipId)
        try c.encodeIfPresent(remarks, forKey: .remarks)
    }

    var isPaid: Bool { status == "paid" }
    var statusLabel: String { isPaid ? "Paid" : "Pending" }
}

// MARK: - Party
struct Party: Codable, Identifiable {
    var id: String
    var name: String
    var contactPerson: String?
    var phone: String?
    var email: String?
    var address: String?
    var gstin: String?

    enum CodingKeys: String, CodingKey {
        case id = "_id"
        case name
        case contactPerson = "contact_person"
        case phone, email, address, gstin
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = (try? c.decodeIfPresent(String.self, forKey: .id)) ?? UUID().uuidString
        name = (try? c.decodeIfPresent(String.self, forKey: .name)) ?? ""
        contactPerson = try? c.decodeIfPresent(String.self, forKey: .contactPerson)
        phone = try? c.decodeIfPresent(String.self, forKey: .phone)
        email = try? c.decodeIfPresent(String.self, forKey: .email)
        address = try? c.decodeIfPresent(String.self, forKey: .address)
        gstin = try? c.decodeIfPresent(String.self, forKey: .gstin)
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(name, forKey: .name)
        try c.encodeIfPresent(contactPerson, forKey: .contactPerson)
        try c.encodeIfPresent(phone, forKey: .phone)
        try c.encodeIfPresent(email, forKey: .email)
        try c.encodeIfPresent(address, forKey: .address)
        try c.encodeIfPresent(gstin, forKey: .gstin)
    }
}

// MARK: - Supplier
struct Supplier: Codable, Identifiable {
    var id: String
    var name: String
    var contactPerson: String?
    var phone: String?
    var email: String?
    var address: String?
    var panNumber: String?

    enum CodingKeys: String, CodingKey {
        case id = "_id"
        case name
        case contactPerson = "contact_person"
        case phone, email, address
        case panNumber = "pan_number"
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = (try? c.decodeIfPresent(String.self, forKey: .id)) ?? UUID().uuidString
        name = (try? c.decodeIfPresent(String.self, forKey: .name)) ?? ""
        contactPerson = try? c.decodeIfPresent(String.self, forKey: .contactPerson)
        phone = try? c.decodeIfPresent(String.self, forKey: .phone)
        email = try? c.decodeIfPresent(String.self, forKey: .email)
        address = try? c.decodeIfPresent(String.self, forKey: .address)
        panNumber = try? c.decodeIfPresent(String.self, forKey: .panNumber)
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(name, forKey: .name)
        try c.encodeIfPresent(contactPerson, forKey: .contactPerson)
        try c.encodeIfPresent(phone, forKey: .phone)
        try c.encodeIfPresent(email, forKey: .email)
        try c.encodeIfPresent(address, forKey: .address)
        try c.encodeIfPresent(panNumber, forKey: .panNumber)
    }
}

// MARK: - Vehicle
struct Vehicle: Codable, Identifiable {
    var id: String
    var vehicleNo: String
    var ownershipType: String?
    var insuranceExpiry: String?
    var fitnessExpiry: String?
    var permitExpiry: String?
    var pucExpiry: String?
    var taxExpiry: String?

    enum CodingKeys: String, CodingKey {
        case id = "_id"
        case vehicleNo = "vehicle_no"
        case ownershipType = "ownership_type"
        case insuranceExpiry = "insurance_expiry"
        case fitnessExpiry = "fitness_expiry"
        case permitExpiry = "permit_expiry"
        case pucExpiry = "puc_expiry"
        case taxExpiry = "tax_expiry"
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = (try? c.decodeIfPresent(String.self, forKey: .id)) ?? UUID().uuidString
        vehicleNo = (try? c.decodeIfPresent(String.self, forKey: .vehicleNo)) ?? ""
        ownershipType = try? c.decodeIfPresent(String.self, forKey: .ownershipType)
        insuranceExpiry = try? c.decodeIfPresent(String.self, forKey: .insuranceExpiry)
        fitnessExpiry = try? c.decodeIfPresent(String.self, forKey: .fitnessExpiry)
        permitExpiry = try? c.decodeIfPresent(String.self, forKey: .permitExpiry)
        pucExpiry = try? c.decodeIfPresent(String.self, forKey: .pucExpiry)
        taxExpiry = try? c.decodeIfPresent(String.self, forKey: .taxExpiry)
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(vehicleNo, forKey: .vehicleNo)
        try c.encodeIfPresent(ownershipType, forKey: .ownershipType)
    }

    var isOwn: Bool { ownershipType == "own" }
}

// MARK: - LoadingSlip
struct LoadingSlip: Codable, Identifiable {
    var id: String
    var slipNumber: String?
    var lrNumber: String?
    var date: String
    var fromLocation: String
    var toLocation: String
    var vehicleNo: String?
    var party: String?
    var supplier: String?
    var material: String?
    var weight: Double?
    var freight: Double?
    var advance: Double?
    var balance: Double?
    var status: String?
    var memoNumber: String?
    var billNumber: String?
    var driverName: String?
    var driverNumber: String?
    var ownerName: String?
    var consignorName: String?
    var consigneeName: String?
    var narration: String?

    enum CodingKeys: String, CodingKey {
        case id = "_id"
        case slipNumber = "slip_number"
        case lrNumber = "lr_number"
        case date
        case fromLocation = "from_location"
        case toLocation = "to_location"
        case vehicleNo = "vehicle_no"
        case party, supplier, material, weight, freight, advance, balance, status
        case memoNumber = "memo_number"
        case billNumber = "bill_number"
        case driverName = "driver_name"
        case driverNumber = "driver_number"
        case ownerName = "owner_name"
        case consignorName = "consignor_name"
        case consigneeName = "consignee_name"
        case narration
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = (try? c.decodeIfPresent(String.self, forKey: .id)) ?? UUID().uuidString
        slipNumber = try? c.decodeIfPresent(String.self, forKey: .slipNumber)
        lrNumber = try? c.decodeIfPresent(String.self, forKey: .lrNumber)
        date = (try? c.decodeIfPresent(String.self, forKey: .date)) ?? ""
        fromLocation = (try? c.decodeIfPresent(String.self, forKey: .fromLocation)) ?? ""
        toLocation = (try? c.decodeIfPresent(String.self, forKey: .toLocation)) ?? ""
        vehicleNo = try? c.decodeIfPresent(String.self, forKey: .vehicleNo)
        party = try? c.decodeIfPresent(String.self, forKey: .party)
        supplier = try? c.decodeIfPresent(String.self, forKey: .supplier)
        material = try? c.decodeIfPresent(String.self, forKey: .material)
        weight = try? c.decodeIfPresent(Double.self, forKey: .weight)
        freight = try? c.decodeIfPresent(Double.self, forKey: .freight)
        advance = try? c.decodeIfPresent(Double.self, forKey: .advance)
        balance = try? c.decodeIfPresent(Double.self, forKey: .balance)
        status = try? c.decodeIfPresent(String.self, forKey: .status)
        memoNumber = try? c.decodeIfPresent(String.self, forKey: .memoNumber)
        billNumber = try? c.decodeIfPresent(String.self, forKey: .billNumber)
        driverName = try? c.decodeIfPresent(String.self, forKey: .driverName)
        driverNumber = try? c.decodeIfPresent(String.self, forKey: .driverNumber)
        ownerName = try? c.decodeIfPresent(String.self, forKey: .ownerName)
        consignorName = try? c.decodeIfPresent(String.self, forKey: .consignorName)
        consigneeName = try? c.decodeIfPresent(String.self, forKey: .consigneeName)
        narration = try? c.decodeIfPresent(String.self, forKey: .narration)
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encodeIfPresent(slipNumber, forKey: .slipNumber)
        try c.encode(date, forKey: .date)
        try c.encode(fromLocation, forKey: .fromLocation)
        try c.encode(toLocation, forKey: .toLocation)
        try c.encodeIfPresent(vehicleNo, forKey: .vehicleNo)
        try c.encodeIfPresent(party, forKey: .party)
        try c.encodeIfPresent(supplier, forKey: .supplier)
        try c.encodeIfPresent(material, forKey: .material)
        try c.encodeIfPresent(weight, forKey: .weight)
        try c.encodeIfPresent(freight, forKey: .freight)
        try c.encodeIfPresent(advance, forKey: .advance)
        try c.encodeIfPresent(balance, forKey: .balance)
        try c.encodeIfPresent(status, forKey: .status)
        try c.encodeIfPresent(driverName, forKey: .driverName)
        try c.encodeIfPresent(driverNumber, forKey: .driverNumber)
        try c.encodeIfPresent(ownerName, forKey: .ownerName)
        try c.encodeIfPresent(consignorName, forKey: .consignorName)
        try c.encodeIfPresent(consigneeName, forKey: .consigneeName)
        try c.encodeIfPresent(narration, forKey: .narration)
    }

    var displayNumber: String { slipNumber ?? lrNumber ?? "—" }
    var route: String { "\(fromLocation) → \(toLocation)" }
    var isBilled: Bool { billNumber != nil && !(billNumber?.isEmpty ?? true) }
    var hasMemo: Bool { memoNumber != nil && !(memoNumber?.isEmpty ?? true) }
}

// MARK: - Banking Entry
struct BankingEntry: Codable, Identifiable {
    var id: String
    var date: String
    var type: String
    var category: String
    var amount: Double
    var narration: String?
    var referenceId: String?
    var referenceName: String?

    enum CodingKeys: String, CodingKey {
        case id = "_id"
        case date, type, category, amount, narration
        case referenceId = "reference_id"
        case referenceName = "reference_name"
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = (try? c.decodeIfPresent(String.self, forKey: .id)) ?? UUID().uuidString
        date = (try? c.decodeIfPresent(String.self, forKey: .date)) ?? ""
        type = (try? c.decodeIfPresent(String.self, forKey: .type)) ?? "credit"
        category = (try? c.decodeIfPresent(String.self, forKey: .category)) ?? ""
        amount = (try? c.decodeIfPresent(Double.self, forKey: .amount)) ?? 0
        narration = try? c.decodeIfPresent(String.self, forKey: .narration)
        referenceId = try? c.decodeIfPresent(String.self, forKey: .referenceId)
        referenceName = try? c.decodeIfPresent(String.self, forKey: .referenceName)
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(date, forKey: .date)
        try c.encode(type, forKey: .type)
        try c.encode(category, forKey: .category)
        try c.encode(amount, forKey: .amount)
        try c.encodeIfPresent(narration, forKey: .narration)
        try c.encodeIfPresent(referenceId, forKey: .referenceId)
        try c.encodeIfPresent(referenceName, forKey: .referenceName)
    }
}

// MARK: - Cashbook Entry
struct CashbookEntry: Codable, Identifiable {
    var id: String
    var date: String
    var type: String
    var category: String
    var amount: Double
    var narration: String?
    var referenceId: String?
    var referenceName: String?

    enum CodingKeys: String, CodingKey {
        case id = "_id"
        case date, type, category, amount, narration
        case referenceId = "reference_id"
        case referenceName = "reference_name"
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = (try? c.decodeIfPresent(String.self, forKey: .id)) ?? UUID().uuidString
        date = (try? c.decodeIfPresent(String.self, forKey: .date)) ?? ""
        type = (try? c.decodeIfPresent(String.self, forKey: .type)) ?? "credit"
        category = (try? c.decodeIfPresent(String.self, forKey: .category)) ?? ""
        amount = (try? c.decodeIfPresent(Double.self, forKey: .amount)) ?? 0
        narration = try? c.decodeIfPresent(String.self, forKey: .narration)
        referenceId = try? c.decodeIfPresent(String.self, forKey: .referenceId)
        referenceName = try? c.decodeIfPresent(String.self, forKey: .referenceName)
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(date, forKey: .date)
        try c.encode(type, forKey: .type)
        try c.encode(category, forKey: .category)
        try c.encode(amount, forKey: .amount)
        try c.encodeIfPresent(narration, forKey: .narration)
        try c.encodeIfPresent(referenceId, forKey: .referenceId)
        try c.encodeIfPresent(referenceName, forKey: .referenceName)
    }
}

// MARK: - Fuel Entry
struct FuelEntry: Codable, Identifiable {
    var id: String
    var date: String
    var vehicleNo: String
    var liters: Double?
    var amount: Double
    var station: String?
    var odometer: Double?

    enum CodingKeys: String, CodingKey {
        case id = "_id"
        case date
        case vehicleNo = "vehicle_no"
        case liters, amount, station, odometer
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = (try? c.decodeIfPresent(String.self, forKey: .id)) ?? UUID().uuidString
        date = (try? c.decodeIfPresent(String.self, forKey: .date)) ?? ""
        vehicleNo = (try? c.decodeIfPresent(String.self, forKey: .vehicleNo)) ?? ""
        liters = try? c.decodeIfPresent(Double.self, forKey: .liters)
        amount = (try? c.decodeIfPresent(Double.self, forKey: .amount)) ?? 0
        station = try? c.decodeIfPresent(String.self, forKey: .station)
        odometer = try? c.decodeIfPresent(Double.self, forKey: .odometer)
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(date, forKey: .date)
        try c.encode(vehicleNo, forKey: .vehicleNo)
        try c.encodeIfPresent(liters, forKey: .liters)
        try c.encode(amount, forKey: .amount)
        try c.encodeIfPresent(station, forKey: .station)
        try c.encodeIfPresent(odometer, forKey: .odometer)
    }
}

// MARK: - Helpers
extension String {
    func formattedDate() -> String {
        let fmts = ["yyyy-MM-dd'T'HH:mm:ss.SSSZ", "yyyy-MM-dd'T'HH:mm:ssZ", "yyyy-MM-dd"]
        for fmt in fmts {
            let f = DateFormatter()
            f.dateFormat = fmt
            if let d = f.date(from: self) {
                let out = DateFormatter()
                out.dateStyle = .medium
                return out.string(from: d)
            }
        }
        return self
    }

    func toISODate() -> String {
        // Already ISO? return as-is
        if self.contains("T") { return self }
        return "\(self)T00:00:00.000Z"
    }
}

extension Double {
    func inr() -> String {
        let f = NumberFormatter()
        f.numberStyle = .currency
        f.currencyCode = "INR"
        f.currencySymbol = "₹"
        f.maximumFractionDigits = 2
        f.minimumFractionDigits = 0
        f.groupingSeparator = ","
        f.groupingSize = 3
        return f.string(from: NSNumber(value: self)) ?? "₹\(self)"
    }
}

extension Date {
    func toYMD() -> String {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        return f.string(from: self)
    }
}
