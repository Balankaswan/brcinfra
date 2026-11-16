import Foundation

// MARK: - User Roles
enum UserRole: String, Codable, CaseIterable {
    case superAdmin  = "superadmin"
    case admin       = "admin"
    case accountant  = "accountant"
    case operations  = "operations"
    case driver      = "driver"
    case viewer      = "viewer"

    var displayName: String {
        switch self {
        case .superAdmin:  return "Super Admin"
        case .admin:       return "Admin"
        case .accountant:  return "Accountant"
        case .operations:  return "Operations"
        case .driver:      return "Driver"
        case .viewer:      return "Viewer"
        }
    }

    var icon: String {
        switch self {
        case .superAdmin:  return "crown.fill"
        case .admin:       return "person.badge.key.fill"
        case .accountant:  return "chart.bar.doc.horizontal.fill"
        case .operations:  return "shippingbox.fill"
        case .driver:      return "car.fill"
        case .viewer:      return "eye.fill"
        }
    }

    var accentHex: String {
        switch self {
        case .superAdmin:  return "7C3AED"
        case .admin:       return "1D4ED8"
        case .accountant:  return "065F46"
        case .operations:  return "EA580C"
        case .driver:      return "0369A1"
        case .viewer:      return "475569"
        }
    }
}

// MARK: - Feature Permissions
enum Feature: Hashable {
    // Dashboard
    case viewDashboard, viewFullFinancials, viewProfitLoss
    // Loading Slips
    case viewLoadingSlips, createLoadingSlip, editLoadingSlip, deleteLoadingSlip, downloadLoadingSlipPDF
    // Bills
    case viewBills, createBill, editBill, deleteBill, markBillPaid, downloadBillPDF
    // Memos
    case viewMemos, createMemo, editMemo, deleteMemo, markMemoPaid, downloadMemoPDF
    // Parties
    case viewParties, createParty, editParty, deleteParty
    // Suppliers
    case viewSuppliers, createSupplier, editSupplier
    // Vehicles
    case viewVehicles, createVehicle, editVehicle, deleteVehicle
    // Banking
    case viewBanking, createBankingEntry, deleteBankingEntry
    // Cashbook
    case viewCashbook, createCashbookEntry, deleteCashbookEntry
    // Fuel
    case viewFuel, createFuelEntry
    // Ledgers
    case viewLedgers
    // Admin
    case manageUsers, viewAuditLog, manageSettings
}

// MARK: - Permission Matrix
struct PermissionService {
    static func can(_ role: UserRole, _ feature: Feature) -> Bool {
        switch role {
        case .superAdmin: return true
        case .admin:      return adminPermissions.contains(feature)
        case .accountant: return accountantPermissions.contains(feature)
        case .operations: return operationsPermissions.contains(feature)
        case .driver:     return driverPermissions.contains(feature)
        case .viewer:     return viewerPermissions.contains(feature)
        }
    }

    private static let adminPermissions: Set<Feature> = [
        .viewDashboard, .viewFullFinancials, .viewProfitLoss,
        .viewLoadingSlips, .createLoadingSlip, .editLoadingSlip, .deleteLoadingSlip, .downloadLoadingSlipPDF,
        .viewBills, .createBill, .editBill, .deleteBill, .markBillPaid, .downloadBillPDF,
        .viewMemos, .createMemo, .editMemo, .deleteMemo, .markMemoPaid, .downloadMemoPDF,
        .viewParties, .createParty, .editParty, .deleteParty,
        .viewSuppliers, .createSupplier, .editSupplier,
        .viewVehicles, .createVehicle, .editVehicle, .deleteVehicle,
        .viewBanking, .createBankingEntry, .deleteBankingEntry,
        .viewCashbook, .createCashbookEntry, .deleteCashbookEntry,
        .viewFuel, .createFuelEntry, .viewLedgers, .manageSettings
    ]

    private static let accountantPermissions: Set<Feature> = [
        .viewDashboard, .viewFullFinancials, .viewProfitLoss,
        .viewLoadingSlips, .downloadLoadingSlipPDF,
        .viewBills, .createBill, .editBill, .markBillPaid, .downloadBillPDF,
        .viewMemos, .createMemo, .editMemo, .markMemoPaid, .downloadMemoPDF,
        .viewParties, .viewSuppliers, .viewVehicles,
        .viewBanking, .createBankingEntry,
        .viewCashbook, .createCashbookEntry,
        .viewFuel, .viewLedgers
    ]

    private static let operationsPermissions: Set<Feature> = [
        .viewDashboard,
        .viewLoadingSlips, .createLoadingSlip, .editLoadingSlip, .downloadLoadingSlipPDF,
        .viewBills, .downloadBillPDF,
        .viewMemos, .downloadMemoPDF,
        .viewParties, .createParty,
        .viewSuppliers, .createSupplier,
        .viewVehicles, .createVehicle, .editVehicle,
        .viewFuel, .createFuelEntry
    ]

    private static let driverPermissions: Set<Feature> = [
        .viewDashboard, .viewLoadingSlips, .viewVehicles
    ]

    private static let viewerPermissions: Set<Feature> = [
        .viewDashboard, .viewProfitLoss,
        .viewLoadingSlips, .downloadLoadingSlipPDF,
        .viewBills, .downloadBillPDF,
        .viewMemos, .downloadMemoPDF,
        .viewParties, .viewSuppliers, .viewVehicles,
        .viewBanking, .viewCashbook, .viewFuel, .viewLedgers
    ]
}
