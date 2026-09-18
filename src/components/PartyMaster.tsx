import React, { useState, useEffect } from 'react';
import { Search, FileText, Users } from 'lucide-react';
import { useDataStore } from '../lib/store';
import { apiService } from '../lib/api';
// PartyForm component not available
import type { Party } from '../types';
import { getAllPartyBalances } from '../utils/ledgerUtils';
import { formatCurrency } from '../utils/numberGenerator';


interface OutstandingBalance {
  party_id: string;
  total_outstanding: number;
  bill_count: number;
}

const PartyMaster: React.FC = () => {
  const { parties, bills, addParty, deleteParty } = useDataStore();
  const [showForm, setShowForm] = useState(false);
  const [outstandingBalances] = useState<OutstandingBalance[]>([]);
  const [editingParty, setEditingParty] = useState<Party | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadParties();
  }, [parties, bills]);

  const loadParties = async () => {
    try {
      const response = await apiService.getParties();
      parties.forEach(party => deleteParty(party.id));
      response.parties?.forEach(party => addParty(party));
    } catch (error) {
      console.error('Failed to load parties:', error);
    }
  };

  // Get all party balances
  const partyBalances = getAllPartyBalances(bills, []);

  // Filter parties based on search term
  const filteredParties = parties.filter(party => 
    party.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (party.contact || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (party.address || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Calculate summary statistics
  const summary = partyBalances.reduce((acc: any, party: any) => ({
    totalParties: acc.totalParties + 1,
    totalOutstanding: acc.totalOutstanding + Math.max(0, party.outstandingAmount),
    totalOverpaid: acc.totalOverpaid + Math.max(0, -party.outstandingAmount),
    pendingParties: acc.pendingParties + (party.outstandingAmount > 0 ? 1 : 0)
  }), {
    totalParties: 0,
    totalOutstanding: 0,
    totalOverpaid: 0,
    pendingParties: 0
  });

  const handleViewLedger = (partyName: string) => {
    const balance = outstandingBalances.find(b => b.party_id === partyName);
    if (balance) {
      // Convert to Party type for editing
      const partyForEdit: Party = {
        id: balance.party_id,
        name: partyName,
        contact: '',
        phone: '',
        address: '',
        created_at: new Date().toISOString()
      };
      setEditingParty(partyForEdit);
      setShowForm(true);
    }
  };



  if (showForm && editingParty) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => setShowForm(false)}
          className="flex items-center space-x-2 text-blue-600 hover:text-blue-800"
        >
          <span>← Back to Party Master</span>
        </button>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Party Form</h3>
          <p className="text-gray-600">Party form component needs to be created</p>
          {/* <PartyForm
            party={editingParty}
            onSubmit={handleCreateParty}
            onCancel={() => setShowForm(false)}
          /> */}
          <button
            onClick={() => setShowForm(false)}
            className="mt-4 px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="mb-6 flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Party Master</h1>
        <button
          onClick={() => setShowForm(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <Users className="w-4 h-4" />
          Add Party
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
          <div className="text-sm text-blue-600 font-medium">Total Parties</div>
          <div className="text-2xl font-bold text-blue-900">{summary.totalParties}</div>
        </div>
        <div className="bg-red-50 p-4 rounded-lg border border-red-200">
          <div className="text-sm text-red-600 font-medium">Total Outstanding</div>
          <div className="text-2xl font-bold text-red-900">{formatCurrency(summary.totalOutstanding)}</div>
        </div>
        <div className="bg-green-50 p-4 rounded-lg border border-green-200">
          <div className="text-sm text-green-600 font-medium">Total Overpaid</div>
          <div className="text-2xl font-bold text-green-900">{formatCurrency(summary.totalOverpaid)}</div>
        </div>
        <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
          <div className="text-sm text-yellow-600 font-medium">Pending Parties</div>
          <div className="text-2xl font-bold text-yellow-900">{summary.pendingParties}</div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <div className="flex items-center space-x-4">
          <div className="flex-1 relative">
            <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search parties..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* Party List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">
            Party List ({filteredParties.length})
          </h3>
        </div>
        
        {filteredParties.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Party Name</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total Bills (₹)</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total Payments (₹)</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total Advances (₹)</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Outstanding Balance (₹)</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredParties.map((party, index) => (
                  <tr key={party.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div>
                          <p className="text-sm text-gray-600">{party.contact || 'No contact'}</p>
                          <p className="text-sm text-gray-600">{party.address || 'No address'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-blue-600 font-medium">
                      {formatCurrency(0)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-green-600 font-medium">
                      {formatCurrency(0)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-yellow-600 font-medium">
                      {formatCurrency(0)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-bold text-gray-600">
                      {formatCurrency(0)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        Cleared
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center space-x-2">
                        <button
                          onClick={() => handleViewLedger(party.name)}
                          className="text-blue-600 hover:text-blue-900"
                          title="View Ledger"
                        >
                          <FileText className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-6 py-12 text-center">
            <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">
              {searchTerm ? 'No parties found matching your search' : 'No parties found'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PartyMaster;
