import React from 'react';
import { FileText } from 'lucide-react';

const PDFDemo: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">PDF Generator</h1>
      </div>

      <div className="bg-gray-50 p-8 rounded-lg text-center">
        <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h4 className="font-medium text-gray-900 mb-2">PDF Preview</h4>
        <p className="text-gray-500 text-sm">Select actual data from the system to generate PDFs</p>
      </div>
    </div>
  );
};

export default PDFDemo;
