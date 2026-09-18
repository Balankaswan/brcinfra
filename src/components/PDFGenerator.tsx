import React, { useState } from 'react';
import { FileDown, Loader2 } from 'lucide-react';
import { generateMemoPDF, generateLoadingSlipPDF, generateBillPDF } from '../utils/pdfGenerator';
import type { LoadingSlip, Memo, Bill } from '../types';

interface PDFGeneratorProps {
  type: 'memo' | 'loading-slip' | 'bill';
  data: Memo | LoadingSlip | Bill;
  loadingSlip?: LoadingSlip;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const PDFGenerator: React.FC<PDFGeneratorProps> = ({ 
  type, 
  data, 
  loadingSlip, 
  className = '', 
  size = 'md' 
}) => {
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGeneratePDF = async () => {
    setIsGenerating(true);
    try {
      switch (type) {
        case 'memo':
          if (loadingSlip) {
            await generateMemoPDF(data as Memo, loadingSlip);
          }
          break;
        case 'loading-slip':
          await generateLoadingSlipPDF(data as LoadingSlip);
          break;
        case 'bill':
          if (loadingSlip) {
            await generateBillPDF(data as Bill, loadingSlip);
          }
          break;
      }
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Error generating PDF. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const getButtonText = () => {
    switch (type) {
      case 'memo':
        return 'Generate Memo PDF';
      case 'loading-slip':
        return 'Generate Loading Slip PDF';
      case 'bill':
        return 'Generate Bill PDF';
      default:
        return 'Generate PDF';
    }
  };

  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'px-3 py-1.5 text-sm';
      case 'lg':
        return 'px-6 py-3 text-base';
      default:
        return 'px-4 py-2 text-sm';
    }
  };

  return (
    <button
      onClick={handleGeneratePDF}
      disabled={isGenerating}
      className={`
        inline-flex items-center space-x-2 bg-red-600 text-white rounded-lg 
        hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed 
        transition-colors ${getSizeClasses()} ${className}
      `}
    >
      {isGenerating ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <FileDown className="w-4 h-4" />
      )}
      <span>{isGenerating ? 'Generating...' : getButtonText()}</span>
    </button>
  );
};

export default PDFGenerator;
