import React, { useState, useCallback } from 'react';
import { DataStoreProvider } from './lib/store';
import { AuthProvider, useAuth } from './lib/auth';
import { useApiSync } from './hooks/useApiSync';
import Login from './components/Login';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import LoadingSlip from './components/LoadingSlip';
import LRForm from './components/forms/LRForm';
import Memo from './components/Memo';
import Bills from './components/Bills';
import Banking from './components/Banking';
import Cashbook from './components/Cashbook';
import Ledgers from './components/Ledgers';
import POD from './components/POD';
import LedgerDetail from './components/LedgerDetail';
import PartyLedger from './components/PartyLedger';
import SupplierLedger from './components/SupplierLedger';
import GeneralLedger from './components/GeneralLedger';
import PartyCommissionLedger from './components/PartyCommissionLedger';
import Parties from './components/Parties';
import PartyDetail from './components/PartyDetail';
import Suppliers from './components/Suppliers';
import SupplierDetail from './components/SupplierDetail';
import FuelManagement from './components/FuelManagement';
import VehicleLedger from './components/VehicleLedger';
import VehicleOwnershipManager from './components/VehicleOwnershipManager';
import TDSLedger from './components/TDSLedger';
import { SyncErrorHandler } from './components/SyncErrorHandler';

const AppContent: React.FC = () => {
  const { user, isLoading } = useAuth();
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [navigationParams, setNavigationParams] = useState<any>(null);
  const [showLedgerDetail, setShowLedgerDetail] = useState<{
    name: string;
    type: 'party' | 'supplier' | 'general' | 'tds';
  } | null>(null);

  const handleNavigation = useCallback((page: string, params?: any) => {
    setCurrentPage(page);
    setNavigationParams(params ?? null);
  }, []);

  // Initialize API sync when user is authenticated
  useApiSync();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  const renderCurrentPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard onNavigate={handleNavigation} />;
      case 'loading-slip':
        return <LoadingSlip onNavigate={handleNavigation} />;
      case 'lr-create':
        return <LRForm onNavigate={handleNavigation} initialData={navigationParams?.slip} />;
      case 'lr-edit':
        return <LRForm onNavigate={handleNavigation} initialData={navigationParams?.slip} />;
      case 'memo':
        return <Memo highlightMemo={navigationParams?.highlight} createForSlip={navigationParams?.createForSlip} />;
      case 'bills':
        return <Bills highlightBill={navigationParams?.highlight} createForSlip={navigationParams?.createForSlip} />;
      case 'parties':
        return <Parties onNavigate={handleNavigation} />;
      case 'party-detail':
        return <PartyDetail
          partyId={navigationParams?.partyId}
          partyName={navigationParams?.partyName}
          onNavigate={handleNavigation}
        />;
      case 'suppliers':
        return <Suppliers onNavigate={handleNavigation} />;
      case 'supplier-detail':
        return <SupplierDetail
          supplierId={navigationParams?.supplierId}
          supplierName={navigationParams?.supplierName}
          onNavigate={handleNavigation}
        />;
      case 'party-ledger':
        return <PartyLedger onNavigate={handleNavigation} />;
      case 'supplier-ledger':
        return <SupplierLedger onNavigate={handleNavigation} />;
      case 'general-ledger':
        return <GeneralLedger />;
      case 'party-commission-ledger':
        return <PartyCommissionLedger onNavigate={handleNavigation} />;
      case 'banking':
        return <Banking />;
      case 'cashbook':
        return <Cashbook />;
      case 'fuel-management':
        return <FuelManagement />;
      case 'vehicle-ledger':
        return <VehicleLedger />;
      case 'vehicle-ownership':
        return <VehicleOwnershipManager />;
      case 'tds-ledger':
        return <TDSLedger onNavigate={handleNavigation} />;
      case 'ledgers':
        return <Ledgers onViewLedger={(name, type) => setShowLedgerDetail({ name, type })} key="ledgers" />;
      case 'pod':
        return <POD />;
      default:
        return <Dashboard onNavigate={handleNavigation} />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Layout currentPage={currentPage} onNavigate={setCurrentPage}>
        {renderCurrentPage()}
      </Layout>

      {showLedgerDetail && (
        <LedgerDetail
          ledgerName={showLedgerDetail.name}
          ledgerType={showLedgerDetail.type}
          onClose={() => setShowLedgerDetail(null)}
        />
      )}

      <SyncErrorHandler />
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <DataStoreProvider>
        <AppContent />
      </DataStoreProvider>
    </AuthProvider>
  );
}

export default App;