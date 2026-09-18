import React from 'react';
import { X, Download } from 'lucide-react';
import { formatCurrency } from '../utils/numberGenerator';

interface LedgerDetailProps {
  ledgerName: string;
  ledgerType: 'party' | 'supplier' | 'general' | 'tds';
  onClose: () => void;
}

const LedgerDetail: React.FC<LedgerDetailProps> = ({ ledgerName, ledgerType, onClose }) => {
  // TODO: Replace with actual ledger data from backend
  const sampleData = {
    name: ledgerName,
    totalEntries: 0,
    outstandingBalance: 0,
    entries: [] as Array<{
      date: string;
      tripDetails: string;
      balance: number;
      billNo?: string;
      memoNo?: string;
      billAmount?: number;
      received?: number;
      deductions?: number;
      netReceived?: number;
      status?: string;
      credit?: number;
      payment?: number;
      remarks?: string;
    }>
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-6xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              {ledgerType === 'party' ? 'Party' : 'Supplier'} Ledger: {ledgerName}
            </h2>
            <div className="flex items-center space-x-6 mt-2 text-sm text-gray-600">
              <span>{ledgerType === 'party' ? 'Party' : 'Supplier'} Name: <strong>{sampleData.name}</strong></span>
              <span>Total Entries: <strong>{sampleData.totalEntries}</strong></span>
              <span>Outstanding Balance: <strong className="text-orange-600">{formatCurrency(sampleData.outstandingBalance)}</strong></span>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2">
              <Download className="w-4 h-4" />
              <span>Download PDF</span>
            </button>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="p-6">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {ledgerType === 'party' ? 'Bill No' : 'Memo No'}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Trip Details</th>
                  {ledgerType === 'supplier' ? (
                    <>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Detention (₹)</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Extra WT (₹)</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Credit (₹)</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Payment (₹)</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Advance (₹)</th>
                    </>
                  ) : (
                    <>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Bill Amount (₹)</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Received (₹)</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Deductions (₹)</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Net Received (₹)</th>
                    </>
                  )}
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Balance (₹)</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {ledgerType === 'party' ? 'Status' : 'Remarks'}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {sampleData.entries.map((entry, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">{entry.date}</td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-blue-600 font-medium">
                      {ledgerType === 'party' ? (entry as any).billNo : (entry as any).memoNo}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">{entry.tripDetails}</td>
                    {ledgerType === 'supplier' ? (
                      <>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">-</td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">-</td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-green-600 font-medium">
                          {(entry as any).credit > 0 ? formatCurrency((entry as any).credit) : '-'}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-blue-600">
                          {(entry as any).payment > 0 ? formatCurrency((entry as any).payment) : '-'}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">-</td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatCurrency((entry as any).billAmount)}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-blue-600">
                          {formatCurrency((entry as any).received)}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-red-600">
                          {formatCurrency((entry as any).deductions)}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-blue-600">
                          {formatCurrency((entry as any).netReceived)}
                        </td>
                      </>
                    )}
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-orange-600 font-medium">
                      {formatCurrency(entry.balance)}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                      {ledgerType === 'party' ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                          {(entry as any).status}
                        </span>
                      ) : (
                        (entry as any).remarks
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LedgerDetail;