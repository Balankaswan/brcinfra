import React, { useState } from 'react';
import { Truck, FileText, Receipt, CreditCard, Archive, Fuel, ChevronDown, ChevronRight, PlusCircle, List } from 'lucide-react';
import { COMPANY_LOGO_BASE64 } from '../assets/logo';

interface LayoutProps {
  children: React.ReactNode;
  currentPage: string;
  onNavigate: (page: string) => void;
}

const Layout: React.FC<LayoutProps> = React.memo(({ children, currentPage, onNavigate }) => {
  const [lrExpanded, setLrExpanded] = useState(
    currentPage === 'lr-create' || currentPage === 'loading-slip' || currentPage === 'lr-edit'
  );

  const isLRActive = currentPage === 'lr-create' || currentPage === 'loading-slip' || currentPage === 'lr-edit';

  return (
    <div className="h-screen overflow-hidden flex bg-gray-50">
      {/* Sidebar */}
      <div className="w-64 bg-white shadow-lg flex flex-col">
        <div className="p-6 border-b">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-lg flex items-center justify-center overflow-hidden">
              <img
                src={COMPANY_LOGO_BASE64}
                alt="BRC Logo"
                className="w-full h-full object-contain"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  target.nextElementSibling?.classList.remove('hidden');
                }}
              />
              <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center hidden">
                <Truck className="w-6 h-6 text-white" />
              </div>
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">BRC INFRA</h1>
              <p className="text-xs text-gray-500">Transport Management</p>
            </div>
          </div>
        </div>

        <nav className="p-4 flex-1 overflow-y-auto">
          <ul className="space-y-1">
            {/* Dashboard */}
            <li>
              <button
                onClick={() => onNavigate('dashboard')}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-left transition-colors ${
                  currentPage === 'dashboard'
                    ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Truck className="w-5 h-5" />
                <span className="font-medium">Dashboard</span>
              </button>
            </li>

            {/* LR — Expandable */}
            <li>
              <button
                onClick={() => setLrExpanded(!lrExpanded)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-lg text-left transition-colors ${
                  isLRActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <FileText className="w-5 h-5" />
                  <span className="font-medium">LR</span>
                </div>
                {lrExpanded
                  ? <ChevronDown className="w-4 h-4" />
                  : <ChevronRight className="w-4 h-4" />}
              </button>
              {lrExpanded && (
                <ul className="ml-6 mt-1 space-y-1">
                  <li>
                    <button
                      onClick={() => onNavigate('lr-create')}
                      className={`w-full flex items-center space-x-2 px-3 py-2 rounded-lg text-left text-sm transition-colors ${
                        currentPage === 'lr-create'
                          ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700'
                          : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <PlusCircle className="w-4 h-4" />
                      <span>Create New LR</span>
                    </button>
                  </li>
                  <li>
                    <button
                      onClick={() => onNavigate('loading-slip')}
                      className={`w-full flex items-center space-x-2 px-3 py-2 rounded-lg text-left text-sm transition-colors ${
                        currentPage === 'loading-slip'
                          ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700'
                          : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <List className="w-4 h-4" />
                      <span>LR List</span>
                    </button>
                  </li>
                </ul>
              )}
            </li>

            {/* Memo */}
            <li>
              <button
                onClick={() => onNavigate('memo')}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-left transition-colors ${
                  currentPage === 'memo'
                    ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Receipt className="w-5 h-5" />
                <span className="font-medium">Freight Memo</span>
              </button>
            </li>

            {/* Bills */}
            <li>
              <button
                onClick={() => onNavigate('bills')}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-left transition-colors ${
                  currentPage === 'bills'
                    ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Receipt className="w-5 h-5" />
                <span className="font-medium">Bills</span>
              </button>
            </li>

            {/* Banking */}
            <li>
              <button
                onClick={() => onNavigate('banking')}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-left transition-colors ${
                  currentPage === 'banking'
                    ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <CreditCard className="w-5 h-5" />
                <span className="font-medium">Banking</span>
              </button>
            </li>

            {/* Cashbook */}
            <li>
              <button
                onClick={() => onNavigate('cashbook')}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-left transition-colors ${
                  currentPage === 'cashbook'
                    ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <CreditCard className="w-5 h-5" />
                <span className="font-medium">Cashbook</span>
              </button>
            </li>

            {/* Ledgers */}
            {[
              { id: 'party-ledger', label: 'Party Ledgers' },
              { id: 'supplier-ledger', label: 'Supplier Ledgers' },
              { id: 'general-ledger', label: 'General Ledgers' },
              { id: 'tds-ledger', label: 'TDS Ledger' },
              { id: 'party-commission-ledger', label: 'Party Commission' },
            ].map(item => (
              <li key={item.id}>
                <button
                  onClick={() => onNavigate(item.id)}
                  className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-left transition-colors ${
                    currentPage === item.id
                      ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <FileText className="w-5 h-5" />
                  <span className="font-medium">{item.label}</span>
                </button>
              </li>
            ))}

            {/* Other */}
            {[
              { id: 'fuel-management', label: 'Fuel Management', icon: Fuel },
              { id: 'vehicle-ledger', label: 'Vehicle Ledger', icon: Truck },
              { id: 'vehicle-ownership', label: 'Vehicle Ownership', icon: Truck },
              { id: 'pod', label: 'POD', icon: Archive },
            ].map(item => (
              <li key={item.id}>
                <button
                  onClick={() => onNavigate(item.id)}
                  className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-left transition-colors ${
                    currentPage === item.id
                      ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  <span className="font-medium">{item.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white shadow-sm border-b px-6 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">
              BRC INFRA - Logistics Management
            </h2>
            <div className="flex items-center space-x-2 text-sm text-green-600">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span>LAN Mode - Real-time Sync Active</span>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
});

export default Layout;
