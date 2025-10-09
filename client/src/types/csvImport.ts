export interface CSVTransaction {
  date: string;
  csvAccountName: string;
  institution: string;
  vendorName: string;
  amount: number;
  description: string;
  category: string;
  // For fuzzy matching results
  matchedScheduleId?: string;
  matchConfidence?: number;
  // For user selections
  selectedInternalCompanyId?: string;
  selectedPaymentAccountId?: string;
  action?: 'record' | 'create-schedule' | 'skip';
}

export interface UniqueAccount {
  csvAccountName: string;
  transactionCount: number;
  isMapped: boolean;
  mappedPaymentAccountId?: string;
}

export interface ImportStep {
  current: 'upload' | 'map-accounts' | 'review' | 'confirm';
  csvData: string[][] | null;
  transactions: CSVTransaction[];
  uniqueAccounts: UniqueAccount[];
  accountMappings: Map<string, string>; // csvAccountName -> paymentAccountId
}
