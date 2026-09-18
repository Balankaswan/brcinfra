import React, { useState, useEffect } from 'react';
import { Users, Search, Plus, Eye, ArrowLeft } from 'lucide-react';
import { formatCurrency } from '../utils/numberGenerator';
import { useDataStore } from '../lib/store';

interface PartiesProps {
  onNavigate?: (page: string, params?: any) => void;
}

const Parties: React.FC<PartiesProps> = ({ onNavigate }) => {
  const { parties, bills, bankingEntries, cashbookEntries } = useDataStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredParties, setFilteredParties] = useState(parties);

  useEffect(() => {
    // Deduplicate parties by name first
    const uniqueParties = parties.reduce((acc, party) => {
      const existing = acc.find(p => p.name === party.name);
      if (!existing) {
        acc.push(party);
      }
      return acc;
    }, [] as typeof parties);

    const filtered = uniqueParties.filter(party =>
      party.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      party.contact_person?.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredParties(filtered);
  }, [searchTerm, parties]);

  // Calculate party balance and active trips for each party
  const getPartyStats = (partyName: string) => {
    const partyBills = bills.filter(bill => bill.party === partyName);
    
    let totalBalance = 0;
    let activeTripCount = 0;

    partyBills.forEach(bill => {
      // Calculate bill-specific payments from banking entries
      const billBankingPayments = bankingEntries
        .filter(entry => entry.reference_id === bill.bill_number && entry.type === 'credit')
        .reduce((total, entry) => total + entry.amount, 0);
      
      // Calculate bill-specific payments from cashbook entries
      const billCashbookPayments = cashbookEntries
        .filter(entry => entry.reference_id === bill.bill_number && entry.type === 'credit')
        .reduce((total, entry) => total + entry.amount, 0);
      
      const billPayments = billBankingPayments + billCashbookPayments;
      
      // freight - mamool - commission + detention + rto + extra - tds - penalties
      const partyOwes = bill.bill_amount - (bill.mamool || 0) - (bill.commission || 0) + (bill.detention || 0) + (bill.rto || 0) + (bill.extra || 0) - (bill.tds || 0) - (bill.penalties || 0);
      const pendingAmount = partyOwes - billPayments;
      
      if (pendingAmount > 0) {
        totalBalance += pendingAmount;
        activeTripCount++;
      }
    });

    // Subtract party on account payments from total balance
    const partyOnAccountBankingPayments = bankingEntries
      .filter(entry => entry.type === 'credit' && entry.category === 'party_on_account' && entry.reference_name === partyName)
      .reduce((sum, entry) => sum + entry.amount, 0);
    
    const partyOnAccountCashbookPayments = cashbookEntries
      .filter(entry => entry.type === 'credit' && entry.category === 'party_on_account' && entry.reference_name === partyName)
      .reduce((sum, entry) => sum + entry.amount, 0);
    
    // Subtract party debit notes from total balance
    const partyDebitNoteBankingPayments = bankingEntries
      .filter(entry => entry.type === 'credit' && entry.category === 'party_debit_note' && entry.reference_name === partyName)
      .reduce((sum, entry) => sum + entry.amount, 0);
    
    const totalOnAccountPayments = partyOnAccountBankingPayments + partyOnAccountCashbookPayments;
    const totalDebitNotes = partyDebitNoteBankingPayments;
    const finalBalance = Math.max(0, totalBalance - totalOnAccountPayments - totalDebitNotes);

    // Debug logging for SHIVAM INFRA and BRC INFRA specifically
    if (partyName === 'SHIVAM INFRA' || partyName === 'BRC INFRA') {
      console.log(`🏢 ${partyName} Balance Calculation:`, {
        billBalance: totalBalance,
        onAccountPayments: totalOnAccountPayments,
        onAccountBanking: partyOnAccountBankingPayments,
        onAccountCashbook: partyOnAccountCashbookPayments,
        debitNotes: totalDebitNotes,
        finalBalance: finalBalance,
        activeTripCount: activeTripCount
      });
    }

    return { totalBalance: finalBalance, activeTripCount };
  };

  const handlePartyClick = (party: any) => {
    if (onNavigate) {
      onNavigate('party-detail', { partyId: party.id, partyName: party.name });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => onNavigate?.('dashboard')}
            className="flex items-center space-x-2 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back to Dashboard</span>
          </button>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Parties</h1>
        <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center space-x-2">
          <Plus className="w-4 h-4" />
          <span>Add Party</span>
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
        <input
          type="text"
          placeholder="Search parties..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Parties Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredParties.map((party, index) => {
          const stats = getPartyStats(party.name);
          
          return (
            <div
              key={`party-${party.id || party._id || party.name.replace(/\s+/g, '-')}-${index}`}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md hover:border-blue-300 cursor-pointer transition-all duration-200"
              onClick={() => handlePartyClick(party)}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Users className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{party.name}</h3>
                    <p className="text-sm text-gray-500">{party.contact_person}</p>
                  </div>
                </div>
                <Eye className="w-5 h-5 text-gray-400" />
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Party Balance</span>
                  <span className="font-semibold text-lg text-red-600">
                    {formatCurrency(stats.totalBalance)}
                  </span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Active Trips</span>
                  <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-sm font-medium">
                    {stats.activeTripCount}
                  </span>
                </div>

                <div className="pt-3 border-t border-gray-100">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Phone:</span>
                    <span className="text-gray-900">{party.phone}</span>
                  </div>
                  <div className="flex justify-between text-sm mt-1">
                    <span className="text-gray-500">Location:</span>
                    <span className="text-gray-900">{party.address?.split(',')[0] || 'N/A'}</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-100">
                <button className="w-full bg-blue-50 text-blue-700 py-2 rounded-lg hover:bg-blue-100 transition-colors">
                  View Pending Bills →
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {filteredParties.length === 0 && (
        <div className="text-center py-12">
          <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No parties found</h3>
          <p className="text-gray-500">
            {searchTerm ? 'Try adjusting your search criteria' : 'Get started by adding your first party'}
          </p>
        </div>
      )}
    </div>
  );
};

export default Parties;
