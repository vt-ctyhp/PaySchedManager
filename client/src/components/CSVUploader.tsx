import { useState, useCallback } from "react";
import { Upload, FileText, X, AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface CSVUploaderProps {
  onFileLoad: (data: string[][]) => void;
  onFileClear?: () => void;
  maxSizeMB?: number;
}

export function CSVUploader({ onFileLoad, onFileClear, maxSizeMB = 10 }: CSVUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const parseCSV = (text: string): string[][] => {
    const lines = text.split('\n');
    const result: string[][] = [];
    
    for (const line of lines) {
      if (!line.trim()) continue;
      
      const row: string[] = [];
      let current = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const nextChar = line[i + 1];
        
        if (char === '"') {
          if (inQuotes && nextChar === '"') {
            // Escaped quote (two consecutive quotes)
            current += '"';
            i++; // Skip the next quote
          } else {
            // Toggle quote state
            inQuotes = !inQuotes;
          }
        } else if (char === ',' && !inQuotes) {
          row.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      
      row.push(current.trim());
      result.push(row);
    }
    
    return result;
  };

  const validateAndProcessFile = useCallback(async (file: File) => {
    setError(null);
    setIsProcessing(true);

    if (!file.name.toLowerCase().endsWith('.csv')) {
      setError('Please upload a CSV file (.csv extension required)');
      setIsProcessing(false);
      return;
    }

    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      setError(`File size exceeds ${maxSizeMB}MB limit`);
      setIsProcessing(false);
      return;
    }

    try {
      const text = await file.text();
      const data = parseCSV(text);
      
      if (data.length === 0) {
        setError('CSV file is empty');
        setIsProcessing(false);
        return;
      }

      if (data.length === 1) {
        setError('CSV file only contains headers, no data rows');
        setIsProcessing(false);
        return;
      }

      setFile(file);
      onFileLoad(data);
    } catch (err) {
      setError('Failed to read CSV file. Please ensure it is a valid CSV format.');
    } finally {
      setIsProcessing(false);
    }
  }, [maxSizeMB, onFileLoad]);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles.length > 0) {
      validateAndProcessFile(droppedFiles[0]);
    }
  }, [validateAndProcessFile]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (selectedFiles && selectedFiles.length > 0) {
      validateAndProcessFile(selectedFiles[0]);
    }
  }, [validateAndProcessFile]);

  const handleRemoveFile = useCallback(() => {
    setFile(null);
    setError(null);
    onFileClear?.();
  }, [onFileClear]);

  return (
    <div className="space-y-4">
      {!file ? (
        <Card
          className={`border-2 border-dashed transition-colors ${
            isDragging ? 'border-primary bg-primary/5' : 'border-border'
          }`}
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Upload className={`h-12 w-12 mb-4 ${isDragging ? 'text-primary' : 'text-muted-foreground'}`} />
            <p className="text-lg font-medium mb-2">
              {isDragging ? 'Drop CSV file here' : 'Drag and drop CSV file'}
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              or click to browse
            </p>
            <input
              type="file"
              accept=".csv"
              onChange={handleFileInput}
              className="hidden"
              id="csv-file-input"
              data-testid="input-csv-file"
              disabled={isProcessing}
            />
            <label htmlFor="csv-file-input">
              <Button
                type="button"
                variant="outline"
                disabled={isProcessing}
                asChild
                data-testid="button-browse-csv"
              >
                <span>{isProcessing ? 'Processing...' : 'Browse Files'}</span>
              </Button>
            </label>
            <p className="text-xs text-muted-foreground mt-4">
              Maximum file size: {maxSizeMB}MB
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <FileText className="h-8 w-8 text-primary" />
              <div>
                <p className="font-medium" data-testid="text-uploaded-filename">{file.name}</p>
                <p className="text-sm text-muted-foreground">
                  {(file.size / 1024).toFixed(2)} KB
                </p>
              </div>
            </div>
            <Button
              size="icon"
              variant="ghost"
              onClick={handleRemoveFile}
              data-testid="button-remove-csv"
            >
              <X className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      )}

      {error && (
        <Alert variant="destructive" data-testid="alert-csv-error">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
