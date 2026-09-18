// BRC Company Logo - Bhavishya Road Carriers
import logoImage from './IMG_8496.jpg';

// Convert image to base64 for PDF generation
export const COMPANY_LOGO_BASE64 = logoImage;

// Logo dimensions (optimized for BRC logo)
export const LOGO_CONFIG = {
  width: 50,
  height: 20,
  x: 15, // X position in PDF
  y: 8   // Y position in PDF
};

// Function to load logo from file (for future use)
export const loadLogoFromFile = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      resolve(result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};
