import React, { useState } from 'react';
import { Plus, Building, Edit, Trash2 } from 'lucide-react';
import type { Supplier } from '../types';

const SupplierComponent: React.FC = () => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Supplier Management</h1>
        <button 
          onClick={() => setShowForm(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
        >
          <Plus className="w-5 h-5" />
          <span>Add Supplier</span>
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">All Suppliers</h3>
        </div>
        <div className="p-6">
          <div className="text-center text-gray-500 py-12">
            <Building className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>No suppliers found</p>
            <p className="text-sm">Add suppliers to manage their accounts</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SupplierComponent;