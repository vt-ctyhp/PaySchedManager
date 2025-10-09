import { useState, useEffect } from "react";
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
import { CSVUploader } from "./CSVUploader";
import { parseTransactionsFromCSV, detectUniqueAccounts, applyAccountMappings } from "@/lib/csvProcessor";
import type { CSVTransaction, UniqueAccount } from "@/types/csvImport";
import type { AccountMapping } from "@shared/schema";

interface CSVImportDialogProps {
  trigger?: React.ReactNode;
}

export function CSVImportDialog({ trigger }: CSVImportDialogProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<'upload' | 'map-accounts' | 'review'>('upload');
  const [csvData, setCsvData] = useState<string[][] | null>(null);
  const [transactions, setTransactions] = useState<CSVTransaction[]>([]);
  const [uniqueAccounts, setUniqueAccounts] = useState<UniqueAccount[]>([]);
  const [error, setError] = useState<string | null>(null);

  const { data: accountMappings = [] } = useQuery<AccountMapping[]>({
    queryKey: ["/api/account-mappings"],
    enabled: open,
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

  const handleContinue = () => {
    if (step === 'upload') {
      const unmapped = uniqueAccounts.filter(a => !a.isMapped);
      if (unmapped.length > 0) {
        setStep('map-accounts');
      } else {
        setStep('review');
      }
    } else if (step === 'map-accounts') {
      setStep('review');
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
              
              <div className="space-y-2">
                <p className="text-sm font-medium">Unmapped Accounts ({unmappedAccounts.length})</p>
                <div className="text-sm text-muted-foreground">
                  TODO: Add quick mapping interface here
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep('upload')}>
                  Back
                </Button>
                <Button onClick={handleContinue} data-testid="button-skip-mapping">
                  Skip & Continue
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
              <div className="text-sm">
                TODO: Add transaction review table here
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(unmappedAccounts.length > 0 ? 'map-accounts' : 'upload')}>
                  Back
                </Button>
                <Button>
                  Import {transactions.length} Transactions
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
