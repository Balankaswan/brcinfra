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
  // GST Configuration
  stateCode: '24',            // Gujarat — used for intra/inter state detection
  gstRates: [0, 5, 12, 18, 28] as const,
  defaultGstType: 'forward_charge' as const,
  sacCode: '996511',          // GTA Services SAC Code
  rcmNote: 'GST Payable Under Reverse Charge Mechanism (RCM) by Recipient of Service as per Notification No. 13/2017-CT(R).',
};

export type CompanyConfig = typeof COMPANY_CONFIG;

