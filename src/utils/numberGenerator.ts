export const generateSlipNumber = (): string => {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2);
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `LS${year}${month}${random}`;
};

export const generateMemoNumber = (): string => {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2);
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `MO${year}${month}${random}`;
};

export const generateBillNumber = (): string => {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2);
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `BL${year}${month}${random}`;
};

export const formatCurrency = (amount: number): string => {
  // Debug the input and output
  console.log(`💰 formatCurrency input: ${amount}, type: ${typeof amount}`);
  
  // Check for string inputs that might cause issues
  if (typeof amount === 'string') {
    console.warn(`⚠️ String passed to formatCurrency: "${amount}"`);
    // Try to parse the string
    const parsed = parseFloat(amount);
    if (isNaN(parsed)) {
      console.error(`❌ Cannot parse string to number: "${amount}"`);
      return '₹0';
    }
    amount = parsed;
  }
  
  // Ensure amount is a valid number
  const numAmount = Number(amount);
  if (isNaN(numAmount)) {
    console.warn(`⚠️ Invalid amount passed to formatCurrency: ${amount}`);
    return '₹0';
  }
  
  // Use direct formatting to avoid "1" prefix issues with Intl.NumberFormat
  const formatted = `₹${numAmount.toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
  
  console.log(`💰 formatCurrency output: ${formatted}`);
  
  return formatted;
};

export const formatNumber = (num: number): string => {
  return new Intl.NumberFormat('en-IN').format(num);
};