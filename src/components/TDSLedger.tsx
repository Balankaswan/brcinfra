import React, { useState, useMemo, useEffect } from 'react';
import { Filter, FileText, Table, FileDown, Users, DollarSign, Search } from 'lucide-react';
import { useDataStore } from '../lib/store';
import { formatCurrency } from '../utils/numberGenerator';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

// Define the interface for TDS ledger entries
interface TDSLedgerEntry {
    id: string;
    date: string;
    billNo: string;
    partyName: string;
    freightAmount: number; // Gross Freight
    tdsAmount: number;
    netReceived: number; // Total Paid/Received (excluding TDS)
    runningBalance: number; // TDS Running Balance
}

interface TDSLedgerProps {
    onNavigate?: (page: string, params?: any) => void;
}

const TDSLedger: React.FC<TDSLedgerProps> = ({ onNavigate }) => {
    const { bills, bankingEntries, cashbookEntries } = useDataStore();

    // States
    const [financialYear, setFinancialYear] = useState('2025-26');
    const [partySearch, setPartySearch] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

    // Financial Year Date Range
    const fyDates = useMemo(() => {
        if (financialYear === '2025-26') {
            return { start: '2025-04-01', end: '2026-03-31' };
        }
        // Add other FYs if needed
        const startYear = parseInt(financialYear.split('-')[0]);
        return {
            start: `${startYear}-04-01`,
            end: `${startYear + 1}-03-31`
        };
    }, [financialYear]);

    // Set default date range from FY
    useEffect(() => {
        if (!dateFrom && !dateTo) {
            // Don't override user selection if they have already picked dates
        }
    }, [fyDates]);

    // Process data to generate TDS Ledger entries
    const tdsEntries = useMemo(() => {
        let runningBalance = 0;
        const entries: TDSLedgerEntry[] = [];

        // Filter bills by date and TDS presence
        const filteredBills = bills
            .filter(bill => {
                const billDate = bill.date;
                const inFY = billDate >= fyDates.start && billDate <= fyDates.end;
                const matchesParty = partySearch ? bill.party.toLowerCase().includes(partySearch.toLowerCase()) : true;
                const matchesDateRange = (!dateFrom || billDate >= dateFrom) && (!dateTo || billDate <= dateTo);

                return inFY && matchesParty && matchesDateRange && (bill.tds || 0) > 0;
            })
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        filteredBills.forEach(bill => {
            // Calculate amount received for this bill
            const bankReceived = bankingEntries
                .filter(e => e.reference_id === bill.bill_number && e.type === 'credit')
                .reduce((sum, e) => sum + e.amount, 0);

            const cashReceived = cashbookEntries
                .filter(e => e.reference_id === bill.bill_number && e.type === 'credit')
                .reduce((sum, e) => sum + e.amount, 0);

            const totalReceived = bankReceived + cashReceived;

            const tdsAmount = bill.tds || 0;
            runningBalance += tdsAmount;

            entries.push({
                id: bill.id,
                date: bill.date,
                billNo: bill.bill_number,
                partyName: bill.party,
                freightAmount: bill.bill_amount || 0,
                tdsAmount: tdsAmount,
                netReceived: totalReceived,
                runningBalance: runningBalance
            });
        });

        return entries;
    }, [bills, bankingEntries, cashbookEntries, fyDates, partySearch, dateFrom, dateTo]);

    // Summary Totals
    const summary = useMemo(() => {
        return tdsEntries.reduce((acc, entry) => ({
            totalFreight: acc.totalFreight + entry.freightAmount,
            totalTds: acc.totalTds + entry.tdsAmount,
            totalReceived: acc.totalReceived + entry.netReceived
        }), { totalFreight: 0, totalTds: 0, totalReceived: 0 });
    }, [tdsEntries]);

    // Export to Excel
    const exportToExcel = () => {
        const headers = [
            'Date', 'Bill No', 'Party Name', 'Freight Amount (₹)', 'TDS Amount (₹)', 'Net Received (₹)', 'TDS Balance (₹)'
        ];

        const data = tdsEntries.map(entry => [
            new Date(entry.date).toLocaleDateString('en-IN'),
            entry.billNo,
            entry.partyName,
            entry.freightAmount,
            entry.tdsAmount,
            entry.netReceived,
            entry.runningBalance
        ]);

        const worksheet = XLSX.utils.aoa_to_sheet([headers, ...data]);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'TDS Ledger');

        XLSX.writeFile(workbook, `TDS_Ledger_${financialYear}.xlsx`);
    };

    // Export to PDF
    const exportToPDF = () => {
        const doc = new jsPDF('p', 'mm', 'a4') as any;
        const pageWidth = doc.internal.pageSize.getWidth();

        // Header
        doc.setFontSize(18);
        doc.setTextColor(25, 118, 210);
        doc.text('TDS LEDGER', pageWidth / 2, 15, { align: 'center' });

        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
        doc.text(`Financial Year: ${financialYear}`, 15, 25);
        doc.text(`Report Generated: ${new Date().toLocaleDateString('en-IN')}`, pageWidth - 15, 25, { align: 'right' });

        // Summary Box
        doc.setFillColor(240, 240, 240);
        doc.rect(10, 30, pageWidth - 20, 25, 'F');
        doc.setFont('helvetica', 'bold');
        doc.text('Summary (FY ' + financialYear + ')', 15, 36);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.text(`Total Freight: ₹${summary.totalFreight.toLocaleString('en-IN')}`, 15, 43);
        doc.text(`Total TDS Deducted: ₹${summary.totalTds.toLocaleString('en-IN')}`, 15, 48);
        doc.text(`Total Net Received: ₹${summary.totalReceived.toLocaleString('en-IN')}`, 80, 43);
        doc.text(`TDS Receivable Balance: ₹${summary.totalTds.toLocaleString('en-IN')}`, 80, 48);

        // Table
        const tableHeaders = [['Date', 'Bill No', 'Party Name', 'Freight', 'TDS', 'Received', 'Balance']];
        const tableData = tdsEntries.map(entry => [
            new Date(entry.date).toLocaleDateString('en-IN'),
            entry.billNo,
            entry.partyName,
            entry.freightAmount.toLocaleString('en-IN'),
            entry.tdsAmount.toLocaleString('en-IN'),
            entry.netReceived.toLocaleString('en-IN'),
            entry.runningBalance.toLocaleString('en-IN')
        ]);

        doc.autoTable({
            startY: 60,
            head: tableHeaders,
            body: tableData,
            theme: 'grid',
            headStyles: { fillColor: [52, 144, 220], textColor: 255 },
            styles: { fontSize: 8 },
            columnStyles: {
                3: { halign: 'right' },
                4: { halign: 'right' },
                5: { halign: 'right' },
                6: { halign: 'right' }
            }
        });

        doc.save(`TDS_Ledger_${financialYear}.pdf`);
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                    <FileText className="w-8 h-8 text-blue-600" />
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">TDS Ledger</h1>
                        <p className="text-gray-600">Track TDS deductions from bills (FY 2025-26)</p>
                    </div>
                </div>
                <div className="flex space-x-2">
                    <button
                        onClick={exportToPDF}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center space-x-2"
                    >
                        <FileDown className="w-4 h-4" />
                        <span>Export PDF</span>
                    </button>
                    <button
                        onClick={exportToExcel}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center space-x-2"
                    >
                        <Table className="w-4 h-4" />
                        <span>Export Excel</span>
                    </button>
                </div>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                    <div className="flex items-center justify-between mb-4">
                        <div className="text-sm font-medium text-gray-600 uppercase">Total Freight (FY {financialYear})</div>
                        <div className="p-2 bg-blue-100 rounded-lg"><DollarSign className="w-5 h-5 text-blue-600" /></div>
                    </div>
                    <div className="text-2xl font-bold text-gray-900">{formatCurrency(summary.totalFreight)}</div>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 border-l-4 border-l-red-500">
                    <div className="flex items-center justify-between mb-4">
                        <div className="text-sm font-medium text-gray-600 uppercase">Total TDS Deducted</div>
                        <div className="p-2 bg-red-100 rounded-lg"><FileText className="w-5 h-5 text-red-600" /></div>
                    </div>
                    <div className="text-2xl font-bold text-red-600">{formatCurrency(summary.totalTds)}</div>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                    <div className="flex items-center justify-between mb-4">
                        <div className="text-sm font-medium text-gray-600 uppercase">Total Net Received</div>
                        <div className="p-2 bg-green-100 rounded-lg"><Users className="w-5 h-5 text-green-600" /></div>
                    </div>
                    <div className="text-2xl font-bold text-green-600">{formatCurrency(summary.totalReceived)}</div>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <div className="flex items-center space-x-2 mb-4">
                    <Filter className="w-5 h-5 text-gray-400" />
                    <h3 className="text-lg font-medium text-gray-900">Filters</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Financial Year</label>
                        <select
                            value={financialYear}
                            onChange={(e) => setFinancialYear(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                            <option value="2025-26">2025-26</option>
                            <option value="2024-25">2024-25</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Party Name</label>
                        <div className="relative">
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search party..."
                                value={partySearch}
                                onChange={(e) => setPartySearch(e.target.value)}
                                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">From Date</label>
                        <input
                            type="date"
                            value={dateFrom}
                            onChange={(e) => setDateFrom(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">To Date</label>
                        <input
                            type="date"
                            value={dateTo}
                            onChange={(e) => setDateTo(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 text-gray-500">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Date</th>
                                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Bill No</th>
                                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Party Name</th>
                                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider">Freight Amount (₹)</th>
                                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider">TDS Amount (₹)</th>
                                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider">Net Received (₹)</th>
                                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider">TDS Balance (₹)</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {tdsEntries.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center text-gray-500 italic">
                                        No TDS deductions found for selected periods/filters.
                                    </td>
                                </tr>
                            ) : (
                                tdsEntries.map((entry) => (
                                    <tr key={entry.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            {new Date(entry.date).toLocaleDateString('en-IN')}
                                        </td>
                                        <td
                                            className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600 cursor-pointer hover:underline"
                                            onClick={() => onNavigate && onNavigate('bills', { highlight: entry.billNo })}
                                        >
                                            {entry.billNo}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            {entry.partyName}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                                            {formatCurrency(entry.freightAmount)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-red-600 font-bold">
                                            {formatCurrency(entry.tdsAmount)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-green-600">
                                            {formatCurrency(entry.netReceived)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-orange-600 font-bold">
                                            {formatCurrency(entry.runningBalance)}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                        {tdsEntries.length > 0 && (
                            <tfoot className="bg-gray-50 font-bold">
                                <tr>
                                    <td colSpan={3} className="px-6 py-4 text-sm text-gray-900 text-right">Grand Total:</td>
                                    <td className="px-6 py-4 text-sm text-right text-gray-900">{formatCurrency(summary.totalFreight)}</td>
                                    <td className="px-6 py-4 text-sm text-right text-red-600">{formatCurrency(summary.totalTds)}</td>
                                    <td className="px-6 py-4 text-sm text-right text-green-600">{formatCurrency(summary.totalReceived)}</td>
                                    <td className="px-6 py-4 text-sm text-right text-orange-600">{formatCurrency(summary.totalTds)}</td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </div>
        </div>
    );
};

export default TDSLedger;
