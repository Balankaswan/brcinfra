# PDF Generator for Bhavishya Road Carriers

This project now includes a comprehensive PDF generation system for creating professional transport documents including Loading Slips, Broker Memos, and Bills.

## 🚀 Features

- **Loading Slip PDF**: Complete loading slip with company branding, transport details, and financial breakdown
- **Broker Memo PDF**: Professional memo format with commission calculations and supplier details  
- **Bill PDF**: Detailed bill format with party information and payment calculations
- **Company Logo Integration**: Automatic logo placement on all documents
- **Professional Formatting**: Clean, business-ready document layouts matching your provided formats

## 📁 Files Added/Modified

### New Files:
- `src/utils/pdfGenerator.ts` - Core PDF generation functions
- `src/components/PDFGenerator.tsx` - Reusable PDF generation component
- `src/components/PDFDemo.tsx` - Demo component to test PDF functionality
- `src/assets/logo.ts` - Logo configuration and placeholder

### Modified Files:
- `src/components/forms/BillForm.tsx` - Added PDF generation button
- `src/components/forms/MemoForm.tsx` - Added PDF generation button  
- `src/components/forms/LoadingSlipForm.tsx` - Added PDF generation button

## 🎯 How to Use

### 1. In Forms
PDF generation buttons automatically appear when editing existing records in:
- Bill Form (when editing an existing bill)
- Memo Form (when editing an existing memo)
- Loading Slip Form (when editing an existing loading slip)

### 2. Manual PDF Generation
You can also generate PDFs programmatically:

```typescript
import { generateBrokerMemoPDF, generateLoadingSlipPDF, generateBillPDF } from '../utils/pdfGenerator';

// Generate Loading Slip PDF
await generateLoadingSlipPDF(loadingSlipData);

// Generate Broker Memo PDF
await generateBrokerMemoPDF(memoData, loadingSlipData);

// Generate Bill PDF
await generateBillPDF(billData, loadingSlipData);
```

### 3. Using the PDFGenerator Component
```tsx
import PDFGenerator from './components/PDFGenerator';

<PDFGenerator
  type="memo" // or "loading-slip" or "bill"
  data={memoData}
  loadingSlip={loadingSlipData} // required for memo and bill types
  size="md" // "sm", "md", or "lg"
/>
```

## 🎨 Customization

### Company Logo
1. Convert your logo to base64 format (use https://www.base64-image.de/)
2. Replace the placeholder in `src/assets/logo.ts`:
```typescript
export const COMPANY_LOGO_BASE64 = `data:image/png;base64,YOUR_LOGO_BASE64_HERE`;
```
3. Adjust logo dimensions if needed:
```typescript
export const LOGO_CONFIG = {
  width: 40,  // Adjust width
  height: 40, // Adjust height
  x: 20,      // X position
  y: 15       // Y position
};
```

### Company Information
Update company details in `src/utils/pdfGenerator.ts`:
```typescript
export const COMPANY_INFO = {
  name: 'YOUR COMPANY NAME',
  address: 'Your address line 1',
  address2: 'Your address line 2',
  // ... other details
};
```

## 📋 Document Formats

### Loading Slip
- Company header with logo
- Transport details (from/to, vehicle, weight)
- Financial breakdown (freight, advance, total)
- Bank details
- Important notices
- Authorized signatory

### Broker Memo  
- Company branding
- Transport details from loading slip
- Supplier information
- Financial calculations (freight, commission, mamool, detention)
- Balance amount calculation

### Bill
- Company header
- Bill details and date
- Tabulated transport information
- Bank details
- Professional formatting

## 🔧 Technical Details

### Dependencies Used
- `jspdf` - PDF generation library
- `html2canvas` - HTML to canvas conversion (for alternative method)

### PDF Generation Methods
1. **Direct PDF Creation**: Uses jsPDF to create PDFs programmatically with precise positioning
2. **HTML to PDF**: Alternative method using html2canvas + jsPDF for complex layouts

## 🎪 Demo Component

A demo component (`PDFDemo.tsx`) is available to test all PDF generation functionality with sample data. You can integrate this into your dashboard or create a separate route to access it.

## 🚀 Future Enhancements

As mentioned, you can add advance payment functionality later. The current structure supports:
- Advance payment arrays in data types
- PDF templates ready for advance payment display
- Form integration prepared for advance payment UI

## 📞 Support

The PDF generator is fully integrated into your existing forms and ready to use. All PDFs will be automatically downloaded when generated, with filenames based on document numbers (e.g., `Broker_Memo_MO25081001.pdf`).
