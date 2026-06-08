import { useState, useEffect, useMemo, useCallback, memo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, ArrowRight, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Check, X } from "lucide-react";
import { CSVUploader } from "./CSVUploader";
import { parseTransactionsFromCSV, detectUniqueAccounts, applyAccountMappings } from "@/lib/csvProcessor";
import { findBestMatch } from "@/lib/fuzzyMatcher";
import type { CSVTransaction, UniqueAccount } from "@/types/csvImport";
import type { AccountMapping, PaymentAccount, PaymentSchedule, InternalCompany } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";

interface CSVImportDialogProps {
  trigger?: React.ReactNode;
}

interface ReviewTransaction extends CSVTransaction {
  paymentAccountId?: string;
  matchedScheduleId?: string;
  matchConfidence?: number;
  internalCompanyId?: string;
  action: 'record' | 'skip';
}

interface ReviewRowProps {
  txn: ReviewTransaction;
  index: number;
  isSelected: boolean;
  companyOptions: ComboboxOption[];
  accountName: string | null;
  onToggleSelect: (index: number) => void;
  onChangeCompany: (index: number, value: string) => void;
  onSetAction: (index: number, action: ReviewTransaction['action']) => void;
}

// Memoized so that selecting a company on one row does not re-render every
// other row. Re-rendering the whole table on each interaction made the dialog
// sluggish and, under the resulting jank, the company dropdown could register a
// click on the wrong item.
const ReviewRow = memo(function ReviewRow({
  txn,
  index,
  isSelected,
  companyOptions,
  accountName,
  onToggleSelect,
  onChangeCompany,
  onSetAction,
}: ReviewRowProps) {
  return (
    <TableRow className={isSelected ? "bg-muted/50" : undefined}>
      <TableCell className="text-center">
        <Checkbox
          checked={isSelected}
          onCheckedChange={() => onToggleSelect(index)}
          aria-label={`Select transaction ${index + 1}`}
        />
      </TableCell>
      <TableCell className="text-sm">{txn.date}</TableCell>
      <TableCell className="text-sm font-medium">{txn.vendorName}</TableCell>
      <TableCell className="text-sm font-mono">${txn.amount.toFixed(2)}</TableCell>
      <TableCell className="text-sm">
        {accountName ? (
          <span className="text-muted-foreground">{accountName}</span>
        ) : (
          <Badge variant="outline">Not mapped</Badge>
        )}
      </TableCell>
      <TableCell>
        <div className="w-44">
          <Combobox
            data-testid={`select-company-${index}`}
            value={txn.internalCompanyId || ''}
            onValueChange={(value) => onChangeCompany(index, value)}
            options={companyOptions}
            placeholder="Select company"
            searchPlaceholder="Search companies..."
            emptyText="No companies found."
            className="h-8 text-sm"
          />
        </div>
      </TableCell>
      <TableCell>
        {txn.matchConfidence ? (
          <Badge
            variant={txn.matchConfidence >= 85 ? "default" : txn.matchConfidence >= 60 ? "secondary" : "outline"}
          >
            {txn.matchConfidence}%
          </Badge>
        ) : (
          <span className="text-xs text-muted-foreground">No match</span>
        )}
      </TableCell>
      <TableCell>
        <div className="flex gap-1">
          <Button
            size="sm"
            variant={txn.action === 'record' ? 'default' : 'outline'}
            onClick={() => onSetAction(index, 'record')}
            data-testid={`button-record-${index}`}
          >
            <Check className="h-3 w-3" />
          </Button>
          <Button
            size="sm"
            variant={txn.action === 'skip' ? 'default' : 'outline'}
            onClick={() => onSetAction(index, 'skip')}
            data-testid={`button-skip-${index}`}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
});

export function CSVImportDialog({ trigger }: CSVImportDialogProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<'upload' | 'map-accounts' | 'review'>('upload');
  const [csvData, setCsvData] = useState<string[][] | null>(null);
  const [transactions, setTransactions] = useState<CSVTransaction[]>([]);
  const [uniqueAccounts, setUniqueAccounts] = useState<UniqueAccount[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [tempMappings, setTempMappings] = useState<Record<string, string>>({});
  const [reviewTransactions, setReviewTransactions] = useState<ReviewTransaction[]>([]);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [confidenceFilter, setConfidenceFilter] = useState<'all' | 'high' | 'medium' | 'low' | 'unmatched'>('all');
  const [bulkCompanySelection, setBulkCompanySelection] = useState<string>("");
  const { toast } = useToast();

  const { data: accountMappings = [] } = useQuery<AccountMapping[]>({
    queryKey: ["/api/account-mappings"],
    enabled: open,
  });

  const { data: paymentAccounts = [], isLoading: isLoadingAccounts } = useQuery<PaymentAccount[]>({
    queryKey: ["/api/payment-accounts"],
    enabled: open,
  });

  const { data: paymentSchedules = [] } = useQuery<PaymentSchedule[]>({
    queryKey: ["/api/payment-schedules"],
    enabled: open && step === 'review',
    refetchOnMount: true,
  });

  const { data: internalCompanies = [] } = useQuery<InternalCompany[]>({
    queryKey: ["/api/internal-companies"],
    enabled: open && step === 'review',
    refetchOnMount: true,
  });

  const scheduleLookup = useMemo(() => {
    const map = new Map<string, PaymentSchedule>();
    (paymentSchedules as PaymentSchedule[]).forEach((schedule) => {
      map.set(schedule.id, schedule);
    });
    return map;
  }, [paymentSchedules]);

  const createMappingMutation = useMutation({
    mutationFn: async (mapping: { csvAccountName: string; paymentAccountId: string }) => {
      const response = await fetch("/api/account-mappings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mapping),
      });
      if (!response.ok) throw new Error("Failed to create mapping");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/account-mappings"] });
    },
  });

  const handleFileLoad = (data: string[][]) => {
    setCsvData(data);
    setError(null);
    
    try {
      const parsed = parseTransactionsFromCSV(data);
      setTransactions(parsed);
      
      const unique = detectUniqueAccounts(parsed, accountMappings);
      setUniqueAccounts(unique);
      
      console.log('CSV loaded:', parsed.length, 'transactions');
      console.log('Unique accounts:', unique.length);
    } catch (err: any) {
      setError(err.message || 'Failed to process CSV file');
      setCsvData(null);
    }
  };

  // Clear selection when the filter changes (the set of visible rows changes).
  // Intentionally NOT keyed on reviewTransactions: editing a row's company or
  // action must not wipe the user's selection, and re-running this on every
  // edit forced a full-table re-render.
  useEffect(() => {
    setSelectedRows(new Set());
  }, [confidenceFilter]);

  const toggleRowSelection = useCallback((rowIndex: number) => {
    setSelectedRows(prev => {
      const next = new Set(prev);
      if (next.has(rowIndex)) {
        next.delete(rowIndex);
      } else {
        next.add(rowIndex);
      }
      return next;
    });
  }, []);

  const handleChangeCompany = useCallback((rowIndex: number, value: string) => {
    setReviewTransactions(prev =>
      prev.map((t, i) => (i === rowIndex ? { ...t, internalCompanyId: value } : t)),
    );
  }, []);

  const handleSetRowAction = useCallback((rowIndex: number, action: ReviewTransaction['action']) => {
    setReviewTransactions(prev =>
      prev.map((t, i) => (i === rowIndex ? { ...t, action } : t)),
    );
  }, []);

  const companyOptions = useMemo<ComboboxOption[]>(
    () => internalCompanies.map((company) => ({ value: company.id, label: company.name })),
    [internalCompanies],
  );

  const accountNameLookup = useMemo(() => {
    const map = new Map<string, string>();
    paymentAccounts.forEach((account) => map.set(account.id, account.name));
    return map;
  }, [paymentAccounts]);

  const filteredRows = useMemo(() => {
    return reviewTransactions
      .map((txn, index) => ({ txn, index }))
      .filter(({ txn }) => {
        const confidence = txn.matchConfidence;
        switch (confidenceFilter) {
          case 'high':
            return !!confidence && confidence >= 85;
          case 'medium':
            return !!confidence && confidence >= 60 && confidence < 85;
          case 'low':
            return !!confidence && confidence < 60;
          case 'unmatched':
            return !confidence;
          default:
            return true;
        }
      });
  }, [reviewTransactions, confidenceFilter]);

  const headerCheckboxState = useMemo(() => {
    if (filteredRows.length === 0) return false as const;
    if (selectedRows.size === filteredRows.length) return true as const;
    if (selectedRows.size === 0) return false as const;
    return 'indeterminate' as const;
  }, [filteredRows, selectedRows]);

  const selectAllFiltered = () => {
    setSelectedRows(new Set(filteredRows.map(({ index }) => index)));
  };

  const clearSelection = () => {
    setSelectedRows(new Set());
  };

  const bulkSetAction = (action: ReviewTransaction['action']) => {
    if (selectedRows.size === 0) return;
    setReviewTransactions(prev =>
      prev.map((txn, index) => (selectedRows.has(index) ? { ...txn, action } : txn)),
    );
  };

  const bulkSetCompany = (companyId: string) => {
    if (!companyId || selectedRows.size === 0) return;
    setReviewTransactions(prev =>
      prev.map((txn, index) => (selectedRows.has(index) ? { ...txn, internalCompanyId: companyId } : txn)),
    );
    setBulkCompanySelection("");
  };

  const handleFileClear = () => {
    setCsvData(null);
    setTransactions([]);
    setUniqueAccounts([]);
    setError(null);
    setStep('upload');
  };

  const handleClose = () => {
    setOpen(false);
    setCsvData(null);
    setTransactions([]);
    setUniqueAccounts([]);
    setError(null);
    setStep('upload');
  };

  const handleSaveMappings = async () => {
    try {
      const mappingsToCreate = Object.entries(tempMappings);
      
      if (mappingsToCreate.length === 0) {
        setStep('review');
        return;
      }

      for (const [csvAccountName, paymentAccountId] of mappingsToCreate) {
        await createMappingMutation.mutateAsync({
          csvAccountName,
          paymentAccountId,
        });
      }

      toast({
        title: "Mappings saved",
        description: `${mappingsToCreate.length} account mapping(s) created successfully.`,
      });

      setTempMappings({});
      
      // Refresh unique accounts with updated mappings
      const updated = detectUniqueAccounts(transactions, accountMappings);
      setUniqueAccounts(updated);
      
      // Prepare review transactions before moving to review step
      prepareReviewTransactions();
      
      setStep('review');
    } catch (error: any) {
      toast({
        title: "Error saving mappings",
        description: error.message || "Failed to save account mappings",
        variant: "destructive",
      });
    }
  };

  const handleImport = async () => {
    try {
      const toImport = reviewTransactions.filter(t => t.action === 'record');
      
      if (toImport.length === 0) {
        toast({
          title: "No transactions to import",
          description: "Please select at least one transaction to record.",
          variant: "destructive",
        });
        return;
      }

      // Validate that all transactions have required data
      const invalid = toImport.filter(t => !t.internalCompanyId || !t.paymentAccountId);
      if (invalid.length > 0) {
        toast({
          title: "Missing required information",
          description: `${invalid.length} transaction(s) are missing company or account information.`,
          variant: "destructive",
        });
        return;
      }

      const bulkPayload = toImport.map((txn) => {
        const matchedSchedule = txn.matchedScheduleId ? scheduleLookup.get(txn.matchedScheduleId) : undefined;
        const paymentDateIso = txn.date
          ? new Date(`${txn.date}T00:00:00Z`).toISOString()
          : new Date().toISOString();

        return {
          paymentScheduleId: matchedSchedule?.id ?? null,
          expenseId: matchedSchedule?.expenseId ?? `CSV-${txn.vendorName}-${txn.date}`,
          internalCompanyId: txn.internalCompanyId ?? matchedSchedule?.internalCompanyId ?? null,
          paymentDate: paymentDateIso,
          amount: txn.amount.toFixed(2),
          paymentMethod: "other",
          paymentAccountId: txn.paymentAccountId ?? null,
          approvedBy: null,
          confirmationFile: null,
          approvalScreenshot: null,
        };
      });

      const response = await fetch("/api/payment-records/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bulkPayload),
        credentials: "include",
      });

      if (!response.ok) {
        const { message } = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(message || "Failed to import transactions");
      }

      // Invalidate payment records query to refresh the list
      queryClient.invalidateQueries({ queryKey: ["/api/payment-records"] });

      toast({
        title: "Import successful",
        description: `${toImport.length} payment record(s) created successfully.`,
      });

      handleClose();
    } catch (error: any) {
      toast({
        title: "Import failed",
        description: error.message || "Failed to import transactions",
        variant: "destructive",
      });
    }
  };

  const prepareReviewTransactions = () => {
    const reviewed: ReviewTransaction[] = transactions.map((txn) => {
      // Resolve the mapped payment account. Prefer the mapping the user just
      // chose in step 2 (tempMappings) since the saved account-mappings query
      // may not have refetched yet, then fall back to the persisted mapping.
      const paymentAccountId =
        tempMappings[txn.csvAccountName] ??
        accountMappings.find(
          m => m.csvAccountName.toLowerCase() === txn.csvAccountName.toLowerCase()
        )?.paymentAccountId;

      const account = paymentAccountId
        ? paymentAccounts.find(a => a.id === paymentAccountId)
        : undefined;

      // Fuzzy match vendor to payment schedules
      const match = findBestMatch(txn.vendorName, paymentSchedules as PaymentSchedule[]);

      // Auto-categorize the company: prefer the vendor-matched schedule's
      // company, then fall back to the selected bank account's company, then any
      // pre-selected company. Always overridable in the dropdown.
      const internalCompanyId =
        match?.schedule.internalCompanyId ??
        account?.internalCompanyId ??
        txn.selectedInternalCompanyId;

      return {
        ...txn,
        paymentAccountId,
        matchedScheduleId: match?.schedule.id,
        matchConfidence: match?.similarity,
        internalCompanyId,
        action: 'record' as const,
      };
    });

    setReviewTransactions(reviewed);
    setSelectedRows(new Set());
  };

  const handleContinue = () => {
    if (step === 'upload') {
      const unmapped = uniqueAccounts.filter(a => !a.isMapped);
      if (unmapped.length > 0) {
        setStep('map-accounts');
      } else {
        prepareReviewTransactions();
        setStep('review');
      }
    } else if (step === 'map-accounts') {
      handleSaveMappings();
    }
  };

  // Radix Select inside a Radix Dialog can leave `pointer-events: none` stuck
  // on <body> after a dropdown closes, which silently freezes clicks on the
  // rest of the dialog (e.g. the Save & Continue button). Clear it on close.
  const handleSelectOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setTimeout(() => {
        document.body.style.pointerEvents = "";
      }, 0);
    }
  };

  const unmappedAccounts = uniqueAccounts.filter(a => !a.isMapped);
  const mappedAccounts = uniqueAccounts.filter(a => a.isMapped);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button data-testid="button-import-transactions">
            <Upload className="h-4 w-4 mr-2" />
            Import Transactions
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {step === 'upload' && 'Import Transactions from CSV'}
            {step === 'map-accounts' && 'Map CSV Accounts'}
            {step === 'review' && 'Review Transactions'}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {error && (
            <Alert variant="destructive" data-testid="alert-import-error">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Step 1: Upload CSV */}
          {step === 'upload' && (
            <>
              <CSVUploader onFileLoad={handleFileLoad} onFileClear={handleFileClear} />
              
              {csvData && transactions.length > 0 && (
                <div className="space-y-3 p-4 bg-muted/50 rounded-lg" data-testid="div-upload-summary">
                  <p className="text-sm font-medium">File loaded successfully!</p>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Transactions:</span>
                      <span className="ml-2 font-medium">{transactions.length}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Accounts:</span>
                      <span className="ml-2 font-medium">{uniqueAccounts.length}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Mapped:</span>
                      <span className="ml-2 font-medium text-green-600">{mappedAccounts.length}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Need Mapping:</span>
                      <span className="ml-2 font-medium text-amber-600">{unmappedAccounts.length}</span>
                    </div>
                  </div>
                  
                  {unmappedAccounts.length > 0 && (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        {unmappedAccounts.length} account{unmappedAccounts.length !== 1 ? 's' : ''} need{unmappedAccounts.length === 1 ? 's' : ''} to be mapped before import
                      </AlertDescription>
                    </Alert>
                  )}
                  
                  <div className="flex gap-2 pt-2">
                    <Button variant="outline" onClick={handleClose}>
                      Cancel
                    </Button>
                    <Button onClick={handleContinue} data-testid="button-continue-import">
                      Continue
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Step 2: Map Accounts */}
          {step === 'map-accounts' && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Map CSV account names to your internal payment accounts to proceed with import.
              </p>
              
              {isLoadingAccounts ? (
                <p className="text-sm text-muted-foreground">Loading payment accounts...</p>
              ) : paymentAccounts.length === 0 ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    No payment accounts found. Please create payment accounts first before mapping CSV accounts.
                  </AlertDescription>
                </Alert>
              ) : unmappedAccounts.length > 0 ? (
                <div className="space-y-3">
                  <p className="text-sm font-medium">Unmapped Accounts ({unmappedAccounts.length})</p>
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {unmappedAccounts.map((account) => (
                      <div key={account.csvAccountName} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{account.csvAccountName}</p>
                          <p className="text-xs text-muted-foreground">
                            {account.transactionCount} transaction{account.transactionCount !== 1 ? 's' : ''}
                          </p>
                        </div>
                        <div className="w-64">
                          <Combobox
                            data-testid={`select-mapping-${account.csvAccountName}`}
                            value={tempMappings[account.csvAccountName] || ''}
                            onValueChange={(value) => {
                              setTempMappings(prev => ({
                                ...prev,
                                [account.csvAccountName]: value
                              }));
                            }}
                            placeholder="Select payment account"
                            searchPlaceholder="Search accounts..."
                            emptyText="No accounts found."
                            options={paymentAccounts.map((pa) => ({
                              value: pa.id,
                              label: pa.lastFourDigits
                                ? `${pa.name} (****${pa.lastFourDigits})`
                                : pa.name,
                              keywords: pa.lastFourDigits ?? undefined,
                            }))}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">All accounts are already mapped.</p>
              )}

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep('upload')}>
                  Back
                </Button>
                <Button 
                  onClick={handleContinue} 
                  disabled={createMappingMutation.isPending || isLoadingAccounts}
                  data-testid="button-save-mappings"
                >
                  {Object.keys(tempMappings).length > 0 ? 'Save & Continue' : 'Skip & Continue'}
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Review */}
          {step === 'review' && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Review and configure transactions before importing.
              </p>

              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="outline" size="sm" onClick={selectAllFiltered} disabled={filteredRows.length === 0}>
                    Select All ({filteredRows.length})
                  </Button>
                  <Button variant="outline" size="sm" onClick={clearSelection} disabled={selectedRows.size === 0}>
                    Clear Selection
                  </Button>
                  <Separator orientation="vertical" className="h-6 hidden md:block" />
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => bulkSetAction('record')}
                    disabled={selectedRows.size === 0}
                  >
                    Set Record
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => bulkSetAction('skip')}
                    disabled={selectedRows.size === 0}
                  >
                    Set Skip
                  </Button>
                  <Select
                    value={bulkCompanySelection}
                    onOpenChange={handleSelectOpenChange}
                    onValueChange={(value) => {
                      setBulkCompanySelection(value);
                      bulkSetCompany(value);
                    }}
                    disabled={selectedRows.size === 0}
                  >
                    <SelectTrigger className="w-[200px] h-8 text-sm">
                      <SelectValue placeholder="Bulk assign company" />
                    </SelectTrigger>
                    <SelectContent>
                      {internalCompanies.map(company => (
                        <SelectItem key={company.id} value={company.id}>
                          {company.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Select value={confidenceFilter} onOpenChange={handleSelectOpenChange} onValueChange={value => setConfidenceFilter(value as typeof confidenceFilter)}>
                  <SelectTrigger className="w-[220px] h-8 text-sm">
                    <SelectValue placeholder="Filter by confidence" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All matches</SelectItem>
                    <SelectItem value="high">High confidence (≥85%)</SelectItem>
                    <SelectItem value="medium">Medium confidence (60-84%)</SelectItem>
                    <SelectItem value="low">Low confidence (&lt;60%)</SelectItem>
                    <SelectItem value="unmatched">Unmatched only</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="text-xs text-muted-foreground">
                {selectedRows.size} selected · Showing {filteredRows.length} of {reviewTransactions.length}
              </div>

              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10 text-center">
                        <Checkbox
                          aria-label="Select all"
                          checked={headerCheckboxState}
                          onCheckedChange={(checked) => {
                            if (checked === true || checked === 'indeterminate') {
                              selectAllFiltered();
                            } else {
                              clearSelection();
                            }
                          }}
                        />
                      </TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Vendor</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Account</TableHead>
                      <TableHead>Company</TableHead>
                      <TableHead>Match</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground">
                          No transactions to review
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredRows.map(({ txn, index }) => (
                        <ReviewRow
                          key={index}
                          txn={txn}
                          index={index}
                          isSelected={selectedRows.has(index)}
                          companyOptions={companyOptions}
                          accountName={txn.paymentAccountId ? (accountNameLookup.get(txn.paymentAccountId) ?? 'Unknown') : null}
                          onToggleSelect={toggleRowSelection}
                          onChangeCompany={handleChangeCompany}
                          onSetAction={handleSetRowAction}
                        />
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(unmappedAccounts.length > 0 ? 'map-accounts' : 'upload')}>
                  Back
                </Button>
                <Button 
                  onClick={handleImport}
                  disabled={reviewTransactions.filter(t => t.action === 'record').length === 0}
                  data-testid="button-import-transactions"
                >
                  Import {reviewTransactions.filter(t => t.action === 'record').length} Transactions
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
