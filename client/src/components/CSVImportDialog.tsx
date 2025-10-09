import { useState, useEffect, useMemo } from "react";
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

export function CSVImportDialog({ trigger }: CSVImportDialogProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<'upload' | 'map-accounts' | 'review'>('upload');
  const [csvData, setCsvData] = useState<string[][] | null>(null);
  const [transactions, setTransactions] = useState<CSVTransaction[]>([]);
  const [uniqueAccounts, setUniqueAccounts] = useState<UniqueAccount[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [tempMappings, setTempMappings] = useState<Record<string, string>>({});
  const [reviewTransactions, setReviewTransactions] = useState<ReviewTransaction[]>([]);
  const { toast } = useToast();

  const { data: accountMappings = [] } = useQuery<AccountMapping[]>({
    queryKey: ["/api/account-mappings"],
    enabled: open,
  });

  const { data: paymentAccounts = [], isLoading: isLoadingAccounts, error: accountsError } = useQuery<PaymentAccount[]>({
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

  // Debug: Log payment accounts when they change
  useEffect(() => {
    console.log('Payment accounts query state:', {
      loading: isLoadingAccounts,
      count: paymentAccounts.length,
      error: accountsError,
      open
    });
    if (paymentAccounts.length > 0) {
      console.log('Payment accounts loaded:', paymentAccounts);
    } else if (!isLoadingAccounts && open && paymentAccounts.length === 0) {
      console.log('No payment accounts found - query completed but empty result');
    }
  }, [paymentAccounts, isLoadingAccounts, open, accountsError]);

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

      // Create payment records
      for (const txn of toImport) {
        const matchedSchedule = txn.matchedScheduleId ? scheduleLookup.get(txn.matchedScheduleId) : undefined;
        const paymentDateIso = txn.date
          ? new Date(`${txn.date}T00:00:00Z`).toISOString()
          : new Date().toISOString();

        const formData = new FormData();
        formData.append("paymentScheduleId", matchedSchedule?.id ?? "");
        formData.append(
          "expenseId",
          matchedSchedule?.expenseId ?? `CSV-${txn.vendorName}-${txn.date}`
        );
        formData.append("paymentDate", paymentDateIso);
        formData.append("amount", txn.amount.toFixed(2));
        formData.append("paymentMethod", "other");
        formData.append("paymentAccountId", txn.paymentAccountId || "");
        const response = await fetch("/api/payment-records", {
          method: "POST",
          body: formData,
          credentials: "include",
        });

        if (!response.ok) {
          const { message } = await response.json().catch(() => ({ message: response.statusText }));
          throw new Error(`Failed to import transaction for ${txn.vendorName}: ${message}`);
        }
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
      // Find account mapping
      const mapping = accountMappings.find(
        m => m.csvAccountName.toLowerCase() === txn.csvAccountName.toLowerCase()
      );

      // Fuzzy match vendor to payment schedules
      const match = findBestMatch(txn.vendorName, paymentSchedules as PaymentSchedule[]);

      return {
        ...txn,
        paymentAccountId: mapping?.paymentAccountId,
        matchedScheduleId: match?.schedule.id,
        matchConfidence: match?.similarity,
        internalCompanyId: match?.schedule.internalCompanyId, // Pre-fill from matched schedule
        action: 'record' as const,
      };
    });

    setReviewTransactions(reviewed);
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
                          <Select
                            value={tempMappings[account.csvAccountName] || ''}
                            onValueChange={(value) => {
                              setTempMappings(prev => ({
                                ...prev,
                                [account.csvAccountName]: value
                              }));
                            }}
                          >
                            <SelectTrigger data-testid={`select-mapping-${account.csvAccountName}`}>
                              <SelectValue placeholder="Select payment account" />
                            </SelectTrigger>
                            <SelectContent>
                              {paymentAccounts.map((pa) => (
                                <SelectItem key={pa.id} value={pa.id}>
                                  {pa.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
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
              
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
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
                    {reviewTransactions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground">
                          No transactions to review
                        </TableCell>
                      </TableRow>
                    ) : (
                      reviewTransactions.map((txn, index) => (
                        <TableRow key={index}>
                          <TableCell className="text-sm">{txn.date}</TableCell>
                          <TableCell className="text-sm font-medium">{txn.vendorName}</TableCell>
                          <TableCell className="text-sm font-mono">${txn.amount.toFixed(2)}</TableCell>
                          <TableCell className="text-sm">
                            {txn.paymentAccountId ? (
                              <span className="text-muted-foreground">
                                {paymentAccounts.find(a => a.id === txn.paymentAccountId)?.name || 'Unknown'}
                              </span>
                            ) : (
                              <Badge variant="outline">Not mapped</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <Select
                              value={txn.internalCompanyId || ''}
                              onValueChange={(value) => {
                                setReviewTransactions(prev =>
                                  prev.map((t, i) => i === index ? { ...t, internalCompanyId: value } : t)
                                );
                              }}
                            >
                              <SelectTrigger className="h-8 text-sm" data-testid={`select-company-${index}`}>
                                <SelectValue placeholder="Select company" />
                              </SelectTrigger>
                              <SelectContent>
                                {internalCompanies.map((company: InternalCompany) => (
                                  <SelectItem key={company.id} value={company.id}>
                                    {company.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
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
                                onClick={() => {
                                  setReviewTransactions(prev =>
                                    prev.map((t, i) => i === index ? { ...t, action: 'record' } : t)
                                  );
                                }}
                                data-testid={`button-record-${index}`}
                              >
                                <Check className="h-3 w-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant={txn.action === 'skip' ? 'default' : 'outline'}
                                onClick={() => {
                                  setReviewTransactions(prev =>
                                    prev.map((t, i) => i === index ? { ...t, action: 'skip' } : t)
                                  );
                                }}
                                data-testid={`button-skip-${index}`}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
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
