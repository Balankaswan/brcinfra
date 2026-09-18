/**
 * Generates the next sequential number for a given document type.
 * @param items - An array of items (e.g., loading slips, memos, bills).
 * @param key - The key in the item object that holds the number string (e.g., 'slip_number').
 * @param prefix - The prefix for the number string (e.g., 'LS').
 * @returns The next number in the sequence as a string (e.g., 'LS-101').
 */
export const getNextSequenceNumber = <T extends { [key: string]: any }>(
  items: T[], 
  key: keyof T,
  prefix: string
): string => {
  if (!items || items.length === 0) {
    return `${prefix}-1`;
  }

  const highestNumber = items.reduce((max, item) => {
    const numberString = item[key] as string;
    if (typeof numberString === 'string') {
      // Handle both prefixed (LS-123) and non-prefixed (5878) formats
      let numberPart: number;
      if (numberString.startsWith(prefix + '-')) {
        numberPart = parseInt(numberString.substring(prefix.length + 1), 10);
      } else {
        // Try parsing as direct number (like 5878)
        numberPart = parseInt(numberString, 10);
      }
      
      if (!isNaN(numberPart) && numberPart > max) {
        return numberPart;
      }
    }
    return max;
  }, 0);

  return `${prefix}-${highestNumber + 1}`;
};
