// BRC INFRA — Central Company Configuration
// Edit this file to update company details across the entire application

export const COMPANY_CONFIG = {
  name: 'BRC INFRA',
  tagline: 'FLEET OWNER / TRANSPORT CONTRACTOR',
  address: 'NAROL AHMEDABAD, AHMEDABAD, GUJARAT',
  mobile: '9898907333',
  alternativeMobile: '',
  email: 'brcinfra84@gmail.com',
  pan: 'BXVPK3909H',
  gstin: '24BXVPK3909H1Z4',
  jurisdiction: 'AHMEDABAD',
  // Bank Details
  bankName: 'Punjab National Bank',
  accountNumber: '1960002100075937',
  ifsc: 'PUNB0196000',
  accountHolder: 'BRC INFRA',
  branchAddress: 'NAROL BRANCH, AHMEDABAD',
  // LR Config
  defaultBranchCode: 'AHD',
};

export type CompanyConfig = typeof COMPANY_CONFIG;
