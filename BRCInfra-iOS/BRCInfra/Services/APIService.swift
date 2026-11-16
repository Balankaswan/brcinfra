import Foundation
import UIKit
import SwiftUI
import PDFKit

// MARK: - API Configuration
enum APIConfig {
    // Production Cloud Backend on Render (directly connected to MongoDB Atlas)
    static let cloudURL = "https://brcinfra.onrender.com/api"

    // Local Node.js Backend on port 5001 (for offline/LAN testing)
    static let localURL = "http://127.0.0.1:5001/api"

    #if DEBUG
    // Defaulting to cloudURL so Simulator and devices immediately load live MongoDB Atlas data
    static let baseURL = "https://brcinfra.onrender.com/api"
    #else
    static let baseURL = "https://brcinfra.onrender.com/api"
    #endif
}

// MARK: - Network Error
enum NetworkError: LocalizedError {
    case invalidURL
    case noData
    case decodingError(Error)
    case serverError(Int, String)
    case unauthorized
    case unknown(Error)

    var errorDescription: String? {
        switch self {
        case .invalidURL: return "Invalid URL"
        case .noData: return "No data received"
        case .decodingError(let e): return "Decode error: \(e.localizedDescription)"
        case .serverError(let code, let msg): return "Server error \(code): \(msg)"
        case .unauthorized: return "Session expired. Please log in again."
        case .unknown(let e): return e.localizedDescription
        }
    }
}

// MARK: - API Service
@MainActor
class APIService: ObservableObject {
    static let shared = APIService()
    private init() {}

    private var token: String? {
        UserDefaults.standard.string(forKey: "authToken")
    }

    // MARK: Generic GET
    func get<T: Decodable>(_ path: String) async throws -> T {
        guard let url = URL(string: "\(APIConfig.baseURL)\(path)") else { throw NetworkError.invalidURL }
        var req = URLRequest(url: url)
        req.httpMethod = "GET"
        if let token { req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }
        let (data, response) = try await URLSession.shared.data(for: req)
        try validateResponse(response, data: data)
        return try decode(T.self, from: data)
    }

    // MARK: Generic POST (Encodable body)
    func post<T: Decodable, B: Encodable>(_ path: String, body: B) async throws -> T {
        guard let url = URL(string: "\(APIConfig.baseURL)\(path)") else { throw NetworkError.invalidURL }
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let token { req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }
        req.httpBody = try JSONEncoder().encode(body)
        let (data, response) = try await URLSession.shared.data(for: req)
        try validateResponse(response, data: data)
        return try decode(T.self, from: data)
    }

    // MARK: POST with raw dictionary (for dynamic create forms)
    func postRaw<T: Decodable>(_ path: String, body: [String: Any]) async throws -> T {
        guard let url = URL(string: "\(APIConfig.baseURL)\(path)") else { throw NetworkError.invalidURL }
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let token { req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }
        req.httpBody = try JSONSerialization.data(withJSONObject: body)
        let (data, response) = try await URLSession.shared.data(for: req)
        try validateResponse(response, data: data)
        return try decode(T.self, from: data)
    }

    // MARK: PUT with raw dictionary (for dynamic edit forms)
    func putRaw<T: Decodable>(_ path: String, body: [String: Any]) async throws -> T {
        guard let url = URL(string: "\(APIConfig.baseURL)\(path)") else { throw NetworkError.invalidURL }
        var req = URLRequest(url: url)
        req.httpMethod = "PUT"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let token { req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }
        req.httpBody = try JSONSerialization.data(withJSONObject: body)
        let (data, response) = try await URLSession.shared.data(for: req)
        try validateResponse(response, data: data)
        return try decode(T.self, from: data)
    }

    // MARK: Generic PUT
    func put<T: Decodable, B: Encodable>(_ path: String, body: B) async throws -> T {
        guard let url = URL(string: "\(APIConfig.baseURL)\(path)") else { throw NetworkError.invalidURL }
        var req = URLRequest(url: url)
        req.httpMethod = "PUT"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let token { req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }
        req.httpBody = try JSONEncoder().encode(body)
        let (data, response) = try await URLSession.shared.data(for: req)
        try validateResponse(response, data: data)
        return try decode(T.self, from: data)
    }

    // MARK: Generic DELETE
    func delete(_ path: String) async throws {
        guard let url = URL(string: "\(APIConfig.baseURL)\(path)") else { throw NetworkError.invalidURL }
        var req = URLRequest(url: url)
        req.httpMethod = "DELETE"
        if let token { req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }
        let (data, response) = try await URLSession.shared.data(for: req)
        try validateResponse(response, data: data)
    }

    // MARK: Helpers
    private func validateResponse(_ response: URLResponse, data: Data) throws {
        guard let http = response as? HTTPURLResponse else { return }
        if http.statusCode == 401 { throw NetworkError.unauthorized }
        if !(200...299).contains(http.statusCode) {
            var msg = "Unknown error"
            if let json = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] {
                msg = (json["message"] as? String) ?? (json["error"] as? String) ?? "Server error (\(http.statusCode))"
            }
            throw NetworkError.serverError(http.statusCode, msg)
        }
    }

    private func decode<T: Decodable>(_ type: T.Type, from data: Data) throws -> T {
        let decoder = JSONDecoder()
        // Try iso8601 with fractional seconds first
        if #available(iOS 11.0, *) {
            let fmt = ISO8601DateFormatter()
            fmt.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            decoder.dateDecodingStrategy = .custom { d in
                let s = try d.singleValueContainer().decode(String.self)
                if let date = fmt.date(from: s) { return date }
                let fmt2 = ISO8601DateFormatter()
                fmt2.formatOptions = [.withInternetDateTime]
                if let date = fmt2.date(from: s) { return date }
                let df = DateFormatter(); df.dateFormat = "yyyy-MM-dd"
                if let date = df.date(from: s) { return date }
                throw DecodingError.dataCorruptedError(in: try d.singleValueContainer(), debugDescription: "Cannot parse date: \(s)")
            }
        } else {
            decoder.dateDecodingStrategy = .iso8601
        }
        do {
            return try decoder.decode(type, from: data)
        } catch {
            throw NetworkError.decodingError(error)
        }
    }
}

// MARK: - PDF Service
@MainActor
final class PDFService {
    static let shared = PDFService()
    private init() {}

    func renderHTMLToPDF(html: String) -> Data? {
        let printPageRenderer = UIPrintPageRenderer()
        let printFormatter = UIMarkupTextPrintFormatter(markupText: html)
        printPageRenderer.addPrintFormatter(printFormatter, startingAtPageAt: 0)

        // Standard A4 dimensions in points (595.2 x 841.8 pt)
        let pageRect = CGRect(x: 0, y: 0, width: 595.2, height: 841.8)
        let printableRect = CGRect(x: 20, y: 20, width: 555.2, height: 801.8)

        printPageRenderer.setValue(NSValue(cgRect: pageRect), forKey: "paperRect")
        printPageRenderer.setValue(NSValue(cgRect: printableRect), forKey: "printableRect")

        printPageRenderer.prepare(forDrawingPages: NSRange(location: 0, length: printPageRenderer.numberOfPages))

        let pdfData = NSMutableData()
        UIGraphicsBeginPDFContextToData(pdfData, pageRect, nil)

        for i in 0..<printPageRenderer.numberOfPages {
            UIGraphicsBeginPDFPage()
            printPageRenderer.drawPage(at: i, in: UIGraphicsGetPDFContextBounds())
        }

        UIGraphicsEndPDFContext()
        return pdfData.length > 0 ? (pdfData as Data) : nil
    }

    func savePDFToTemporaryFile(data: Data, filename: String) -> URL? {
        let cleanName = filename.replacingOccurrences(of: "/", with: "_")
        let tempDir = FileManager.default.temporaryDirectory
        let fileURL = tempDir.appendingPathComponent(cleanName)
        do {
            try data.write(to: fileURL, options: .atomic)
            return fileURL
        } catch {
            print("Failed to save PDF to temp file: \(error)")
            return nil
        }
    }

    private func escape(_ string: String?) -> String {
        guard let s = string else { return "" }
        return s.replacingOccurrences(of: "&", with: "&amp;")
            .replacingOccurrences(of: "<", with: "&lt;")
            .replacingOccurrences(of: ">", with: "&gt;")
            .replacingOccurrences(of: "\"", with: "&quot;")
    }

    private func formatINR(_ amount: Double?) -> String {
        guard let amount else { return "₹ 0.00" }
        return amount.inr()
    }

    private var baseCSS: String {
        """
        * { box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            color: #1a202c;
            margin: 0;
            padding: 16px;
            font-size: 10pt;
            line-height: 1.4;
        }
        .header {
            text-align: center;
            border-bottom: 2px solid #1a365d;
            padding-bottom: 8px;
            margin-bottom: 12px;
        }
        .company-title {
            font-size: 18pt;
            font-weight: 800;
            color: #1a365d;
            letter-spacing: 0.5px;
            margin: 0;
        }
        .subtitle {
            font-size: 8pt;
            font-weight: 600;
            color: #4a5568;
            margin-top: 3px;
            text-transform: uppercase;
        }
        .company-address {
            font-size: 8.5pt;
            color: #4a5568;
            margin-top: 2px;
        }
        .contact-bar {
            display: flex;
            justify-content: space-between;
            font-size: 8pt;
            font-weight: 600;
            color: #2b6cb0;
            margin-top: 6px;
            border-top: 1px dashed #cbd5e0;
            padding-top: 4px;
        }
        .doc-banner {
            background: #1a365d;
            color: #ffffff;
            text-align: center;
            font-weight: 700;
            font-size: 12pt;
            padding: 6px 0;
            margin: 10px 0;
            border-radius: 4px;
            letter-spacing: 1px;
        }
        .doc-banner.memo { background: #2b6cb0; }
        .doc-banner.lr { background: #1a365d; }
        .info-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 12px;
        }
        .info-table td {
            padding: 5px 8px;
            border: 1px solid #cbd5e0;
            font-size: 9pt;
        }
        .label-cell {
            background-color: #f7fafc;
            font-weight: 600;
            color: #4a5568;
            width: 25%;
        }
        .val-cell {
            width: 25%;
            font-weight: 500;
        }
        .data-table {
            width: 100%;
            border-collapse: collapse;
            margin: 10px 0;
        }
        .data-table th {
            background-color: #edf2f7;
            color: #2d3748;
            font-weight: 700;
            font-size: 9pt;
            padding: 7px 8px;
            border: 1px solid #cbd5e0;
            text-align: left;
        }
        .data-table td {
            padding: 6px 8px;
            border: 1px solid #e2e8f0;
            font-size: 9pt;
        }
        .text-right { text-align: right; }
        .text-center { text-align: center; }
        .total-row {
            background-color: #1a365d;
            color: #ffffff;
            font-weight: 800;
            font-size: 10.5pt;
        }
        .total-row td {
            border-color: #1a365d;
            color: #ffffff;
        }
        .total-row-memo {
            background-color: #2b6cb0;
            color: #ffffff;
            font-weight: 800;
            font-size: 10.5pt;
        }
        .total-row-memo td {
            border-color: #2b6cb0;
            color: #ffffff;
        }
        .notes-box {
            border: 1px solid #e2e8f0;
            background: #f7fafc;
            border-radius: 4px;
            padding: 8px 10px;
            font-size: 8pt;
            margin-top: 10px;
        }
        .signature-table {
            width: 100%;
            margin-top: 35px;
            border-collapse: collapse;
        }
        .signature-table td {
            width: 50%;
            text-align: center;
            font-size: 9pt;
            padding-top: 40px;
            border-top: 1px solid #4a5568;
            font-weight: 600;
        }
        .status-badge {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 8pt;
            font-weight: 700;
        }
        .status-received, .status-paid {
            background-color: #c6f6d5;
            color: #22543d;
        }
        .status-pending {
            background-color: #feebc8;
            color: #7b341e;
        }
        """
    }

    // MARK: - Loading Slip (LR) PDF
    func generateLoadingSlipPDF(slip: LoadingSlip) -> Data? {
        let lrNum = escape(slip.displayNumber)
        let dateStr = escape(slip.date.formattedDate())
        let vehicle = escape(slip.vehicleNo ?? "N/A")
        let party = escape(slip.party ?? "N/A")
        let supplier = escape(slip.supplier ?? "N/A")
        let owner = escape(slip.ownerName ?? "N/A")
        let route = escape(slip.route)
        let material = escape(slip.material ?? "General Goods")
        let weight = slip.weight != nil ? "\(slip.weight!) MT" : "N/A"
        let freight = formatINR(slip.freight)
        let advance = formatINR(slip.advance)
        let balance = formatINR(slip.balance)
        let driverName = escape(slip.driverName ?? "N/A")
        let driverPhone = escape(slip.driverNumber ?? "N/A")
        let narration = escape(slip.narration ?? "")

        let html = """
        <!DOCTYPE html>
        <html>
        <head>
        <meta charset="utf-8">
        <style>\(baseCSS)</style>
        </head>
        <body>
            <div class="header">
                <h1 class="company-title">BHAVISHYA ROAD CARRIERS</h1>
                <div class="subtitle">FLEET OWNERS, TRANSPORT CONTRACTORS & COMMISSION AGENTS</div>
                <div class="company-address">404, Parijaat Business Center, Nr. SP Ring Road, Aslali, Ahmedabad - 382405</div>
                <div class="contact-bar">
                    <span>MOB: 9824026578, 9824900776</span>
                    <span>PAN NO: BNDPK7173D</span>
                    <span>DIRECT TO AHMEDABAD JURISDICTION</span>
                </div>
            </div>

            <div class="doc-banner lr">LORRY RECEIPT / LOADING SLIP</div>

            <table class="info-table">
                <tr>
                    <td class="label-cell">LR / Slip No.</td>
                    <td class="val-cell"><strong>\(lrNum)</strong></td>
                    <td class="label-cell">Date</td>
                    <td class="val-cell">\(dateStr)</td>
                </tr>
                <tr>
                    <td class="label-cell">Vehicle No.</td>
                    <td class="val-cell"><strong>\(vehicle)</strong></td>
                    <td class="label-cell">Route</td>
                    <td class="val-cell">\(route)</td>
                </tr>
                <tr>
                    <td class="label-cell">Consignor (Party)</td>
                    <td class="val-cell">\(party)</td>
                    <td class="label-cell">Consignee (Supplier)</td>
                    <td class="val-cell">\(supplier)</td>
                </tr>
                <tr>
                    <td class="label-cell">Owner Name</td>
                    <td class="val-cell">\(owner)</td>
                    <td class="label-cell">Material</td>
                    <td class="val-cell">\(material)</td>
                </tr>
            </table>

            <table class="data-table">
                <thead>
                    <tr>
                        <th>Description</th>
                        <th class="text-center">Weight</th>
                        <th class="text-right">Freight Amount</th>
                        <th class="text-right">Advance Paid</th>
                        <th class="text-right">Balance Payable</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>Transportation charges for \(material) from \(route)</td>
                        <td class="text-center">\(weight)</td>
                        <td class="text-right">\(freight)</td>
                        <td class="text-right">\(advance)</td>
                        <td class="text-right"><strong>\(balance)</strong></td>
                    </tr>
                    <tr class="total-row">
                        <td colspan="4">NET BALANCE TO BE PAID</td>
                        <td class="text-right">\(balance)</td>
                    </tr>
                </tbody>
            </table>

            <table class="info-table">
                <tr>
                    <td class="label-cell">Driver Name</td>
                    <td class="val-cell">\(driverName)</td>
                    <td class="label-cell">Driver Phone</td>
                    <td class="val-cell">\(driverPhone)</td>
                </tr>
                \(narration.isEmpty ? "" : "<tr><td class=\"label-cell\">Remarks</td><td colspan=\"3\">\(narration)</td></tr>")
            </table>

            <div class="notes-box">
                <strong>Terms & Conditions:</strong><br/>
                1. The goods are accepted for carriage subject to terms and conditions printed on standard consignment note.<br/>
                2. Not responsible for breakage, leakage, shortage or damages en route due to natural calamity or accident.<br/>
                3. Jurisdiction: Subject to Ahmedabad jurisdiction only.
            </div>

            <table class="signature-table">
                <tr>
                    <td>Consignor / Driver Signature</td>
                    <td>For BHAVISHYA ROAD CARRIERS<br/>(Authorized Signatory)</td>
                </tr>
            </table>
        </body>
        </html>
        """
        return renderHTMLToPDF(html: html)
    }

    // MARK: - Bill (Invoice) PDF
    func generateBillPDF(bill: Bill) -> Data? {
        let billNum = escape(bill.billNumber)
        let dateStr = escape(bill.date.formattedDate())
        let party = escape(bill.party)
        let vehicle = escape(bill.vehicleNo ?? "N/A")
        let status = escape(bill.statusLabel)
        let isReceived = bill.isPaid
        let billAmount = formatINR(bill.billAmount)
        let detention = formatINR(bill.detention)
        let extra = formatINR(bill.extra)
        let rto = formatINR(bill.rto)
        let mamool = formatINR(bill.mamool)
        let commission = formatINR(bill.commission)
        let tds = formatINR(bill.tds)
        let penalties = formatINR(bill.penalties)
        let commCut = formatINR(bill.partyCommissionCut)
        let netAmount = formatINR(bill.computedNet)
        let remarks = escape(bill.remarks ?? "")

        let html = """
        <!DOCTYPE html>
        <html>
        <head>
        <meta charset="utf-8">
        <style>\(baseCSS)</style>
        </head>
        <body>
            <div class="header">
                <h1 class="company-title">BHAVISHYA ROAD CARRIERS</h1>
                <div class="subtitle">Specialist in Heavy ODC, Hydraulic, Low Bed Trailer, Flat Bed Trailer Transport</div>
                <div class="company-address">404, Parijaat Business Center, Nr. SP Ring Road, Aslali, Ahmedabad - 382405</div>
                <div class="contact-bar">
                    <span>MOB: 9824026578, 9824900776</span>
                    <span>PAN NO: BNDPK7173D</span>
                    <span>DIRECT TO AHMEDABAD JURISDICTION</span>
                </div>
            </div>

            <div class="doc-banner">FREIGHT BILL / INVOICE</div>

            <table class="info-table">
                <tr>
                    <td class="label-cell">Bill Number</td>
                    <td class="val-cell"><strong>\(billNum)</strong></td>
                    <td class="label-cell">Date</td>
                    <td class="val-cell">\(dateStr)</td>
                </tr>
                <tr>
                    <td class="label-cell">Party (Billed To)</td>
                    <td class="val-cell"><strong>\(party)</strong></td>
                    <td class="label-cell">Payment Status</td>
                    <td class="val-cell">
                        <span class="status-badge \(isReceived ? "status-received" : "status-pending")">\(status)</span>
                    </td>
                </tr>
                <tr>
                    <td class="label-cell">Vehicle No.</td>
                    <td class="val-cell">\(vehicle)</td>
                    <td class="label-cell">LR Reference</td>
                    <td class="val-cell">\(escape(bill.loadingSlipId ?? "Direct"))</td>
                </tr>
            </table>

            <table class="data-table">
                <thead>
                    <tr>
                        <th>Particulars / Charges</th>
                        <th class="text-right" style="width: 25%;">Amount (₹)</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>Base Freight / Bill Amount</td>
                        <td class="text-right"><strong>\(billAmount)</strong></td>
                    </tr>
                    \(bill.detention != nil && bill.detention! > 0 ? "<tr><td>Detention Charges (+)</td><td class=\"text-right\">\(detention)</td></tr>" : "")
                    \(bill.extra != nil && bill.extra! > 0 ? "<tr><td>Extra Charges (+)</td><td class=\"text-right\">\(extra)</td></tr>" : "")
                    \(bill.rto != nil && bill.rto! > 0 ? "<tr><td>RTO Charges (+)</td><td class=\"text-right\">\(rto)</td></tr>" : "")
                    \(bill.mamool != nil && bill.mamool! > 0 ? "<tr><td style=\"color:#c53030;\">Less: Mamool (-)</td><td class=\"text-right\" style=\"color:#c53030;\">\(mamool)</td></tr>" : "")
                    \(bill.commission != nil && bill.commission! > 0 ? "<tr><td style=\"color:#c53030;\">Less: Commission (-)</td><td class=\"text-right\" style=\"color:#c53030;\">\(commission)</td></tr>" : "")
                    \(bill.tds != nil && bill.tds! > 0 ? "<tr><td style=\"color:#c53030;\">Less: TDS (-)</td><td class=\"text-right\" style=\"color:#c53030;\">\(tds)</td></tr>" : "")
                    \(bill.penalties != nil && bill.penalties! > 0 ? "<tr><td style=\"color:#c53030;\">Less: Penalties (-)</td><td class=\"text-right\" style=\"color:#c53030;\">\(penalties)</td></tr>" : "")
                    \(bill.partyCommissionCut != nil && bill.partyCommissionCut! > 0 ? "<tr><td style=\"color:#c53030;\">Less: Party Commission Cut (-)</td><td class=\"text-right\" style=\"color:#c53030;\">\(commCut)</td></tr>" : "")
                    <tr class="total-row">
                        <td>NET AMOUNT PAYABLE</td>
                        <td class="text-right">\(netAmount)</td>
                    </tr>
                </tbody>
            </table>

            \(remarks.isEmpty ? "" : "<div class=\"notes-box\"><strong>Remarks:</strong> \(remarks)</div>")

            <div class="notes-box">
                <strong>Bank Details for Payment:</strong><br/>
                Account Name: <strong>BHAVISHYA ROAD CARRIERS</strong><br/>
                Bank: Bank of Baroda, Aslali Branch, Ahmedabad<br/>
                IFSC: BARB0ASLALI | Please quote Bill No. \(billNum) in payment narration.
            </div>

            <table class="signature-table">
                <tr>
                    <td>Party Signature & Seal</td>
                    <td>For BHAVISHYA ROAD CARRIERS<br/>(Authorized Signatory)</td>
                </tr>
            </table>
        </body>
        </html>
        """
        return renderHTMLToPDF(html: html)
    }

    // MARK: - Memo PDF
    func generateMemoPDF(memo: Memo) -> Data? {
        let memoNum = escape(memo.memoNumber)
        let dateStr = escape(memo.date.formattedDate())
        let supplier = escape(memo.supplier)
        let vehicle = escape(memo.vehicleNo ?? "N/A")
        let status = escape(memo.statusLabel)
        let isPaid = memo.isPaid
        let freight = formatINR(memo.freight)
        let detention = formatINR(memo.detention)
        let extra = formatINR(memo.extra)
        let rto = formatINR(memo.rto)
        let commission = formatINR(memo.commission)
        let mamool = formatINR(memo.mamool)
        let deduction = formatINR(memo.deduction)
        let netAmount = formatINR(memo.netAmount)
        let remarks = escape(memo.remarks ?? "")

        let html = """
        <!DOCTYPE html>
        <html>
        <head>
        <meta charset="utf-8">
        <style>\(baseCSS)</style>
        </head>
        <body>
            <div class="header">
                <h1 class="company-title">BHAVISHYA ROAD CARRIERS</h1>
                <div class="subtitle">FLEET OWNERS, TRANSPORT CONTRACTORS & COMMISSION AGENTS</div>
                <div class="company-address">404, Parijaat Business Center, Nr. SP Ring Road, Aslali, Ahmedabad - 382405</div>
                <div class="contact-bar">
                    <span>MOB: 9824026578, 9824900776</span>
                    <span>PAN NO: BNDPK7173D</span>
                    <span>DIRECT TO AHMEDABAD JURISDICTION</span>
                </div>
            </div>

            <div class="doc-banner memo">LORRY FREIGHT MEMO</div>

            <table class="info-table">
                <tr>
                    <td class="label-cell">Memo Number</td>
                    <td class="val-cell"><strong>\(memoNum)</strong></td>
                    <td class="label-cell">Date</td>
                    <td class="val-cell">\(dateStr)</td>
                </tr>
                <tr>
                    <td class="label-cell">Supplier / Vehicle Owner</td>
                    <td class="val-cell"><strong>\(supplier)</strong></td>
                    <td class="label-cell">Payment Status</td>
                    <td class="val-cell">
                        <span class="status-badge \(isPaid ? "status-paid" : "status-pending")">\(status)</span>
                    </td>
                </tr>
                <tr>
                    <td class="label-cell">Vehicle No.</td>
                    <td class="val-cell">\(vehicle)</td>
                    <td class="label-cell">LR Reference</td>
                    <td class="val-cell">\(escape(memo.loadingSlipId ?? "Direct"))</td>
                </tr>
            </table>

            <table class="data-table">
                <thead>
                    <tr>
                        <th>Particulars / Freight Breakdown</th>
                        <th class="text-right" style="width: 25%;">Amount (₹)</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>Total Lorry Freight</td>
                        <td class="text-right"><strong>\(freight)</strong></td>
                    </tr>
                    \(memo.detention != nil && memo.detention! > 0 ? "<tr><td>Detention Allowance (+)</td><td class=\"text-right\">\(detention)</td></tr>" : "")
                    \(memo.extra != nil && memo.extra! > 0 ? "<tr><td>Extra Charges (+)</td><td class=\"text-right\">\(extra)</td></tr>" : "")
                    \(memo.rto != nil && memo.rto! > 0 ? "<tr><td>RTO Allowance (+)</td><td class=\"text-right\">\(rto)</td></tr>" : "")
                    \(memo.commission != nil && memo.commission! > 0 ? "<tr><td style=\"color:#c53030;\">Less: Commission (-)</td><td class=\"text-right\" style=\"color:#c53030;\">\(commission)</td></tr>" : "")
                    \(memo.mamool != nil && memo.mamool! > 0 ? "<tr><td style=\"color:#c53030;\">Less: Mamool (-)</td><td class=\"text-right\" style=\"color:#c53030;\">\(mamool)</td></tr>" : "")
                    \(memo.deduction != nil && memo.deduction! > 0 ? "<tr><td style=\"color:#c53030;\">Less: Other Deductions (-)</td><td class=\"text-right\" style=\"color:#c53030;\">\(deduction)</td></tr>" : "")
                    <tr class="total-row-memo">
                        <td>NET AMOUNT PAYABLE TO SUPPLIER</td>
                        <td class="text-right">\(netAmount)</td>
                    </tr>
                </tbody>
            </table>

            \(remarks.isEmpty ? "" : "<div class=\"notes-box\"><strong>Remarks:</strong> \(remarks)</div>")

            <div class="notes-box">
                <strong>Payment Confirmation:</strong><br/>
                Payment settlement is subject to receipt of original POD (Proof of Delivery) with proper seal and stamp from consignee.
            </div>

            <table class="signature-table">
                <tr>
                    <td>Supplier / Driver Signature</td>
                    <td>For BHAVISHYA ROAD CARRIERS<br/>(Authorized Signatory)</td>
                </tr>
            </table>
        </body>
        </html>
        """
        return renderHTMLToPDF(html: html)
    }
}

// MARK: - PDFKit Represented View
struct PDFKitRepresentedView: UIViewRepresentable {
    let data: Data

    func makeUIView(context: Context) -> PDFView {
        let pdfView = PDFView()
        pdfView.autoScales = true
        pdfView.displayMode = .singlePageContinuous
        pdfView.displayDirection = .vertical
        pdfView.document = PDFDocument(data: data)
        return pdfView
    }

    func updateUIView(_ uiView: PDFView, context: Context) {
        if uiView.document?.dataRepresentation() != data {
            uiView.document = PDFDocument(data: data)
        }
    }
}

// MARK: - PDF Share Sheet
struct PDFShareSheet: UIViewControllerRepresentable {
    let activityItems: [Any]

    func makeUIViewController(context: Context) -> UIActivityViewController {
        let controller = UIActivityViewController(activityItems: activityItems, applicationActivities: nil)
        return controller
    }

    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}

// MARK: - PDF Preview & Download View
struct PDFPreviewView: View {
    let title: String
    let pdfData: Data?
    let filename: String
    @Environment(\.dismiss) var dismiss
    @State private var shareURL: URL?
    @State private var showShare = false

    var body: some View {
        NavigationStack {
            Group {
                if let data = pdfData, let _ = PDFDocument(data: data) {
                    PDFKitRepresentedView(data: data)
                } else {
                    ContentUnavailableView(
                        "Unable to generate PDF",
                        systemImage: "doc.text.fill",
                        description: Text("Please make sure all document details are properly saved.")
                    )
                }
            }
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Done") { dismiss() }
                }
                ToolbarItem(placement: .navigationBarTrailing) {
                    if let data = pdfData {
                        Button {
                            if let url = PDFService.shared.savePDFToTemporaryFile(data: data, filename: filename) {
                                shareURL = url
                                showShare = true
                            }
                        } label: {
                            Image(systemName: "square.and.arrow.up")
                        }
                    }
                }
            }
            .safeAreaInset(edge: .bottom) {
                if let data = pdfData {
                    Button {
                        if let url = PDFService.shared.savePDFToTemporaryFile(data: data, filename: filename) {
                            shareURL = url
                            showShare = true
                        }
                    } label: {
                        HStack(spacing: 8) {
                            Image(systemName: "arrow.down.doc.fill")
                            Text("Download / Share PDF")
                        }
                        .font(.headline)
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                        .background(Color.blue)
                        .cornerRadius(12)
                    }
                    .padding(.horizontal, 16)
                    .padding(.top, 8)
                    .padding(.bottom, 8)
                    .background(.ultraThinMaterial)
                }
            }
            .sheet(isPresented: $showShare) {
                if let shareURL {
                    PDFShareSheet(activityItems: [shareURL])
                }
            }
        }
    }
}
