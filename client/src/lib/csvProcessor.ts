import type { CSVTransaction, UniqueAccount } from "@/types/csvImport";
import type { AccountMapping } from "@shared/schema";

export function parseTransactionsFromCSV(csvData: string[][]): CSVTransaction[] {
  if (csvData.length < 2) {
    return [];
  }

  const headers = csvData[0].map(h => h.toLowerCase().trim());
  const transactions: CSVTransaction[] = [];

  // Find column indices with flexible matching
  const dateIndex = headers.findIndex(h => h.includes('date') && !h.includes('original'));
  
  // Look for "Account Name" specifically, not just any column with "account"
  const accountIndex = headers.findIndex(h => h === 'account name' || h === 'account name/number');
  
  const institutionIndex = headers.findIndex(h => h.includes('institution'));
  
  // Accept "Name", "Custom Name", or "Vendor" as vendor field
  const vendorIndex = headers.findIndex(h => 
    h === 'vendor name' || h === 'vendor' || h === 'name' || h === 'custom name'
  );
  
  const amountIndex = headers.findIndex(h => h.includes('amount'));
  const descriptionIndex = headers.findIndex(h => h.includes('description'));
  const categoryIndex = headers.findIndex(h => h.includes('category'));

  // Validate required columns exist
  if (dateIndex === -1 || vendorIndex === -1 || amountIndex === -1) {
    throw new Error('CSV must contain Date, Vendor/Name, and Amount columns');
  }

  // Parse data rows (skip header)
  for (let i = 1; i < csvData.length; i++) {
    const row = csvData[i];
    
    // Skip empty rows
    if (row.every(cell => !cell.trim())) {
      continue;
    }

    try {
      const amount = parseFloat(row[amountIndex]?.replace(/[^0-9.-]/g, '') || '0');
      
      // Get account name with fallback
      let csvAccountName = 'Unknown Account';
      if (accountIndex >= 0 && row[accountIndex]?.trim()) {
        csvAccountName = row[accountIndex].trim();
      } else if (institutionIndex >= 0 && row[institutionIndex]?.trim()) {
        // Fallback to institution if account name not available
        csvAccountName = row[institutionIndex].trim();
      }
      
      transactions.push({
        date: row[dateIndex]?.trim() || '',
        csvAccountName: csvAccountName,
        institution: institutionIndex >= 0 ? (row[institutionIndex]?.trim() || '') : '',
        vendorName: row[vendorIndex]?.trim() || 'Unknown Vendor',
        amount: amount,
        description: descriptionIndex >= 0 ? (row[descriptionIndex]?.trim() || '') : '',
        category: categoryIndex >= 0 ? (row[categoryIndex]?.trim() || '') : '',
        action: 'skip' // Default action
      });
    } catch (error) {
      console.warn(`Failed to parse row ${i}:`, row, error);
    }
  }

  return transactions;
}

export function detectUniqueAccounts(
  transactions: CSVTransaction[],
  accountMappings: AccountMapping[]
): UniqueAccount[] {
  const accountMap = new Map<string, UniqueAccount>();

  // Count transactions per account
  for (const transaction of transactions) {
    const csvName = transaction.csvAccountName;
    if (!accountMap.has(csvName)) {
      accountMap.set(csvName, {
        csvAccountName: csvName,
        transactionCount: 0,
        isMapped: false,
      });
    }
    const account = accountMap.get(csvName)!;
    account.transactionCount++;
  }

  // Check which accounts are already mapped
  for (const mapping of accountMappings) {
    if (accountMap.has(mapping.csvAccountName)) {
      const account = accountMap.get(mapping.csvAccountName)!;
      account.isMapped = true;
      account.mappedPaymentAccountId = mapping.paymentAccountId;
    }
  }

  return Array.from(accountMap.values()).sort((a, b) => 
    b.transactionCount - a.transactionCount
  );
}

export function applyAccountMappings(
  transactions: CSVTransaction[],
  accountMappings: AccountMapping[]
): CSVTransaction[] {
  const mappingMap = new Map(
    accountMappings.map(m => [m.csvAccountName, m.paymentAccountId])
  );

  return transactions.map(transaction => ({
    ...transaction,
    selectedPaymentAccountId: mappingMap.get(transaction.csvAccountName),
  }));
}
