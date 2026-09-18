import React, { useState, useMemo } from 'react';
import { Receipt, FileText, CheckCircle, Trash2, Clock, Search, X } from 'lucide-react';
import { useDataStore } from '../lib/store';
import { apiService } from '../lib/api';
import { formatCurrency } from '../utils/numberGenerator';
import MonthFilterDropdown from './MonthFilterDropdown';
import type { Memo, Bill } from '../types';

const MemosAndBills: React.FC = () => {
  const { memos, bills, deleteMemo, deleteBill, markMemoAsPaid, markBillAsReceived } = useDataStore();
  const [activeTab, setActiveTab] = useState<'memos' | 'bills'>('memos');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);

  // Filter memos and bills based on search term AND selected months
  const filteredMemos = useMemo(() => {
    let result = memos;

    // Month filter — when active, show ALL memos (pending + paid) for that month
    if (selectedMonths.length > 0) {
      result = result.filter(memo => {
        const memoMonth = memo.date ? memo.date.substring(0, 7) : '';
        return selectedMonths.includes(memoMonth);
      });
    }

    if (!searchTerm.trim()) return result;
    const searchLower = searchTerm.toLowerCase();
    return result.filter(memo =>
      memo.memo_number.toLowerCase().includes(searchLower) ||
      memo.supplier.toLowerCase().includes(searchLower) ||
      memo.date.includes(searchTerm) ||
      memo.net_amount.toString().includes(searchTerm)
    );
  }, [memos, searchTerm, selectedMonths]);

  const filteredBills = useMemo(() => {
    let result = bills;

    // Month filter — when active, show ALL bills (pending + received) for that month
    if (selectedMonths.length > 0) {
      result = result.filter(bill => {
        const billMonth = bill.date ? bill.date.substring(0, 7) : '';
        return selectedMonths.includes(billMonth);
      });
    }

    if (!searchTerm.trim()) return result;
    const searchLower = searchTerm.toLowerCase();
    return result.filter(bill =>
      bill.bill_number.toLowerCase().includes(searchLower) ||
      bill.party.toLowerCase().includes(searchLower) ||
      bill.date.includes(searchTerm) ||
      bill.net_amount.toString().includes(searchTerm)
    );
  }, [bills, searchTerm, selectedMonths]);

  const monthFilterActive = selectedMonths.length > 0;

  const pendingMemos = monthFilterActive
    ? filteredMemos.filter(m => m.status === 'pending')
    : filteredMemos.filter(m => m.status === 'pending');
  const paidMemos = filteredMemos.filter(m => m.status === 'paid');
  const pendingBills = filteredBills.filter(b => b.status === 'pending');
  const receivedBills = filteredBills.filter(b => b.status === 'received');

  const handleMarkMemoAsPaid = (memo: Memo) => {
    const paidDate = new Date().toISOString().split('T')[0];
    const paidAmount = memo.net_amount;
    if (window.confirm(`Mark memo ${memo.memo_number} as paid for ${formatCurrency(paidAmount)}?`)) {
      markMemoAsPaid(memo.id, paidDate, paidAmount);
    }
  };

  const handleMarkBillAsReceived = (bill: Bill) => {
    const receivedDate = new Date().toISOString().split('T')[0];
    const receivedAmount = bill.net_amount;
    if (window.confirm(`Mark bill ${bill.bill_number} as received for ${formatCurrency(receivedAmount)}?`)) {
      markBillAsReceived(bill.id, receivedDate, receivedAmount);
    }
  };

  const handleDeleteMemo = async (memo: Memo) => {
    if (window.confirm(`Are you sure you want to delete memo ${memo.memo_number}?`)) {
      const targetId = (memo as any)._id || memo.id || memo.memo_number;
      try {
        console.log('Deleting memo with ID:', targetId);
        await apiService.deleteMemo(targetId);
        deleteMemo(targetId);
        console.log('Memo deleted successfully');
      } catch (error) {
        console.error('Failed to delete memo:', error);
        deleteMemo(targetId); // Fallback to local deletion
      }
    }
  };

  const handleDeleteBill = async (bill: Bill) => {
    if (window.confirm(`Are you sure you want to delete bill ${bill.bill_number}?`)) {
      const targetId = (bill as any)._id || bill.id || bill.bill_number;
      try {
        console.log('Deleting bill with ID:', targetId);
        await apiService.deleteBill(targetId);
        deleteBill(targetId);
        console.log('Bill deleted successfully');
      } catch (error) {
        console.error('Failed to delete bill:', error);
        deleteBill(targetId); // Fallback to local deletion
      }
    }
  };

  const renderMemoCard = (memo: Memo, isPaid: boolean = false) => (
    <div key={memo.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-3">
          <Receipt className="w-5 h-5 text-orange-600" />
          <div>
            <h3 className="font-semibold text-gray-900">{memo.memo_number}</h3>
            <p className="text-sm text-gray-500">{memo.supplier}</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {!isPaid && (
            <button
              onClick={() => handleMarkMemoAsPaid(memo)}
              className="text-green-600 hover:text-green-800"
              title="Mark as Paid"
            >
              <CheckCircle className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => handleDeleteMemo(memo)}
            className="text-red-600 hover:text-red-800"
            title="Delete Memo"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="text-gray-500">Date:</span>
          <span className="ml-2 font-medium">{new Date(memo.date).toLocaleDateString('en-IN')}</span>
        </div>
        <div>
          <span className="text-gray-500">Net Amount:</span>
          <span className="ml-2 font-medium">{formatCurrency(memo.net_amount)}</span>
        </div>
        {isPaid && memo.paid_date && (
          <>
            <div>
              <span className="text-gray-500">Paid Date:</span>
              <span className="ml-2 font-medium">{new Date(memo.paid_date).toLocaleDateString('en-IN')}</span>
            </div>
            <div>
              <span className="text-gray-500">Paid Amount:</span>
              <span className="ml-2 font-medium">{formatCurrency(memo.paid_amount || 0)}</span>
            </div>
          </>
        )}
      </div>
      <div className="mt-3 pt-3 border-t border-gray-100">
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
          isPaid 
            ? 'bg-green-100 text-green-800' 
            : 'bg-yellow-100 text-yellow-800'
        }`}>
          {isPaid ? 'Paid' : 'Pending'}
        </span>
      </div>
    </div>
  );

  const renderBillCard = (bill: Bill, isReceived: boolean = false) => (
    <div key={bill.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-3">
          <FileText className="w-5 h-5 text-blue-600" />
          <div>
            <h3 className="font-semibold text-gray-900">{bill.bill_number}</h3>
            <p className="text-sm text-gray-500">{bill.party}</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {!isReceived && (
            <button
              onClick={() => handleMarkBillAsReceived(bill)}
              className="text-green-600 hover:text-green-800"
              title="Mark as Received"
            >
              <CheckCircle className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => handleDeleteBill(bill)}
            className="text-red-600 hover:text-red-800"
            title="Delete Bill"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="text-gray-500">Date:</span>
          <span className="ml-2 font-medium">{new Date(bill.date).toLocaleDateString('en-IN')}</span>
        </div>
        <div>
          <span className="text-gray-500">Net Amount:</span>
          <span className="ml-2 font-medium">{formatCurrency(bill.net_amount)}</span>
        </div>
        {isReceived && bill.received_date && (
          <>
            <div>
              <span className="text-gray-500">Received Date:</span>
              <span className="ml-2 font-medium">{new Date(bill.received_date).toLocaleDateString('en-IN')}</span>
            </div>
            <div>
              <span className="text-gray-500">Received Amount:</span>
              <span className="ml-2 font-medium">{formatCurrency(bill.received_amount || 0)}</span>
            </div>
          </>
        )}
      </div>
      <div className="mt-3 pt-3 border-t border-gray-100">
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
          isReceived 
            ? 'bg-green-100 text-green-800' 
            : 'bg-yellow-100 text-yellow-800'
        }`}>
          {isReceived ? 'Received' : 'Pending'}
        </span>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Freight Memos & Bills</h1>
        <div className="flex items-center space-x-3">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder={`Search ${activeTab === 'memos' ? 'freight memos' : 'bills'}...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent w-56"
            />
          </div>

          {/* Month Filter */}
          <MonthFilterDropdown selectedMonths={selectedMonths} onChange={setSelectedMonths} />

          {/* Tab Switcher */}
          <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => setActiveTab('memos')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'memos'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Freight Memos
            </button>
            <button
              onClick={() => setActiveTab('bills')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'bills'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Bills
            </button>
          </div>
        </div>
      </div>

      {/* Month filter active banner */}
      {monthFilterActive && (
        <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
          <span className="font-medium">Month filter active:</span>
          <span>Showing pending + paid/received for {selectedMonths.length} month{selectedMonths.length > 1 ? 's' : ''}</span>
          <button
            onClick={() => setSelectedMonths([])}
            className="ml-auto flex items-center gap-1 text-blue-500 hover:text-blue-700 font-medium"
          >
            <X className="w-3.5 h-3.5" /> Clear filter
          </button>
        </div>
      )}

      {activeTab === 'memos' && (
        <div className="space-y-6">
          <div>
            <div className="flex items-center space-x-2 mb-4">
              <Clock className="w-5 h-5 text-yellow-600" />
              <h2 className="text-lg font-semibold text-gray-900">Pending Memos ({pendingMemos.length})</h2>
            </div>
            {pendingMemos.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                <Receipt className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p>No pending memos found</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {pendingMemos.map(memo => renderMemoCard(memo, false))}
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center space-x-2 mb-4">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <h2 className="text-lg font-semibold text-gray-900">Paid Memos ({paidMemos.length})</h2>
            </div>
            {paidMemos.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                <CheckCircle className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p>No paid memos found</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {paidMemos.map(memo => renderMemoCard(memo, true))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'bills' && (
        <div className="space-y-6">
          <div>
            <div className="flex items-center space-x-2 mb-4">
              <Clock className="w-5 h-5 text-yellow-600" />
              <h2 className="text-lg font-semibold text-gray-900">Pending Bills ({pendingBills.length})</h2>
            </div>
            {pendingBills.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p>No pending bills found</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {pendingBills.map(bill => renderBillCard(bill, false))}
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center space-x-2 mb-4">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <h2 className="text-lg font-semibold text-gray-900">Received Bills ({receivedBills.length})</h2>
            </div>
            {receivedBills.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                <CheckCircle className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p>No received bills found</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {receivedBills.map(bill => renderBillCard(bill, true))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MemosAndBills;
