import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";
import { CSVUploader } from "./CSVUploader";

interface CSVImportDialogProps {
  trigger?: React.ReactNode;
}

export function CSVImportDialog({ trigger }: CSVImportDialogProps) {
  const [open, setOpen] = useState(false);
  const [csvData, setCsvData] = useState<string[][] | null>(null);

  const handleFileLoad = (data: string[][]) => {
    setCsvData(data);
    console.log('CSV loaded:', data.length, 'rows');
    console.log('Headers:', data[0]);
    console.log('First data row:', data[1]);
  };

  const handleFileClear = () => {
    setCsvData(null);
  };

  const handleClose = () => {
    setOpen(false);
    setCsvData(null);
  };

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
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import Transactions from CSV</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <CSVUploader onFileLoad={handleFileLoad} onFileClear={handleFileClear} />
          
          {csvData && (
            <div className="space-y-2">
              <p className="text-sm font-medium">File loaded successfully!</p>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>Total rows: {csvData.length}</p>
                <p>Data rows: {csvData.length - 1}</p>
                <p>Columns: {csvData[0]?.length || 0}</p>
              </div>
              <div className="flex gap-2 mt-4">
                <Button variant="outline" onClick={handleClose}>
                  Cancel
                </Button>
                <Button data-testid="button-continue-import">
                  Continue
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
