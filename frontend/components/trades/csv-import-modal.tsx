'use client';

import { useState, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Upload, FileText, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import api from '@/lib/api';
import { cn } from '@/lib/utils';

interface CSVImportModalProps {
  trigger?: React.ReactNode;
}

export function CSVImportModal({ trigger }: CSVImportModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [csvContent, setCsvContent] = useState('');
  const [broker, setBroker] = useState('auto');
  const [dragActive, setDragActive] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    valid: boolean;
    broker: string;
    preview: unknown[];
    errors?: string[];
  } | null>(null);
  const [importResult, setImportResult] = useState<{
    success: boolean;
    message: string;
    summary?: {
      imported: number;
      skipped: number;
    };
  } | null>(null);

  const queryClient = useQueryClient();

  const validateMutation = useMutation({
    mutationFn: () => api.validateCSV(csvContent, broker),
    onSuccess: (data) => {
      setValidationResult(data);
    },
  });

  const importMutation = useMutation({
    mutationFn: () => api.importCSV(csvContent, broker),
    onSuccess: (data) => {
      setImportResult({
        success: true,
        message: data.message,
        summary: data.summary,
      });
      queryClient.invalidateQueries({ queryKey: ['trades'] });
      queryClient.invalidateQueries({ queryKey: ['trade-stats'] });
      queryClient.invalidateQueries({ queryKey: ['briefing'] });
      queryClient.invalidateQueries({ queryKey: ['playbook'] });
      queryClient.invalidateQueries({ queryKey: ['playbook-comparison'] });
    },
    onError: (err: Error) => {
      setImportResult({
        success: false,
        message: err.message,
      });
    },
  });

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      readFile(file);
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      readFile(e.target.files[0]);
    }
  };

  const readFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      setCsvContent(e.target?.result as string);
      setValidationResult(null);
      setImportResult(null);
    };
    reader.readAsText(file);
  };

  const handleValidate = () => {
    setValidationResult(null);
    setImportResult(null);
    validateMutation.mutate();
  };

  const handleImport = () => {
    setImportResult(null);
    importMutation.mutate();
  };

  const resetModal = () => {
    setCsvContent('');
    setBroker('auto');
    setValidationResult(null);
    setImportResult(null);
  };

  return (
    <>
      <div onClick={() => setIsOpen(true)}>
        {trigger || (
          <Button variant="outline">
            <Upload className="mr-2 h-4 w-4" />
            Import CSV
          </Button>
        )}
      </div>
      <Dialog open={isOpen} onOpenChange={(open) => {
        setIsOpen(open);
        if (!open) resetModal();
      }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Import Trades from CSV</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {!importResult?.success && (
              <>
                <div className="space-y-2">
                  <Label>Broker Format</Label>
                  <Select value={broker} onValueChange={(v) => v && setBroker(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Auto-detect</SelectItem>
                      <SelectItem value="zerodha">Zerodha</SelectItem>
                      <SelectItem value="generic">Generic CSV</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div
                  className={cn(
                    'relative rounded-lg border-2 border-dashed p-8 text-center transition-colors',
                    dragActive ? 'border-primary bg-primary/5' : 'border-border',
                    csvContent && 'border-solid bg-muted/50'
                  )}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                >
                  {csvContent ? (
                    <div className="flex items-center justify-center gap-2">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                      <span className="text-sm">
                        CSV loaded ({csvContent.split('\n').length - 1} rows)
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setCsvContent('');
                          setValidationResult(null);
                        }}
                      >
                        Clear
                      </Button>
                    </div>
                  ) : (
                    <>
                      <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">
                        Drag and drop your CSV file here, or
                      </p>
                      <input
                        type="file"
                        accept=".csv"
                        className="hidden"
                        id="csv-upload"
                        onChange={handleFileSelect}
                      />
                      <label htmlFor="csv-upload">
                        <Button variant="link" className="mt-1 cursor-pointer">
                          browse to select
                        </Button>
                      </label>
                    </>
                  )}
                </div>

                {csvContent && (
                  <div className="space-y-2">
                    <Label>Or paste CSV content</Label>
                    <Textarea
                      value={csvContent}
                      onChange={(e) => {
                        setCsvContent(e.target.value);
                        setValidationResult(null);
                      }}
                      placeholder="Paste CSV content here..."
                      rows={4}
                      className="font-mono text-xs"
                    />
                  </div>
                )}

                {validationResult && (
                  <Alert variant={validationResult.valid ? 'default' : 'destructive'}>
                    {validationResult.valid ? (
                      <CheckCircle className="h-4 w-4" />
                    ) : (
                      <AlertCircle className="h-4 w-4" />
                    )}
                    <AlertDescription>
                      {validationResult.valid ? (
                        <>
                          Detected broker: <strong>{validationResult.broker}</strong>. 
                          Found {validationResult.preview.length} trades ready to import.
                        </>
                      ) : (
                        validationResult.errors?.join(', ') || 'Invalid CSV format'
                      )}
                    </AlertDescription>
                  </Alert>
                )}
              </>
            )}

            {importResult && (
              <Alert variant={importResult.success ? 'default' : 'destructive'}>
                {importResult.success ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  <AlertCircle className="h-4 w-4" />
                )}
                <AlertDescription>
                  {importResult.message}
                  {importResult.summary && (
                    <div className="mt-2 text-sm">
                      Imported: {importResult.summary.imported}, 
                      Skipped: {importResult.summary.skipped}
                    </div>
                  )}
                </AlertDescription>
              </Alert>
            )}

            <div className="flex justify-end gap-3">
              {importResult?.success ? (
                <Button onClick={() => setIsOpen(false)}>Done</Button>
              ) : (
                <>
                  <Button
                    variant="outline"
                    onClick={handleValidate}
                    disabled={!csvContent || validateMutation.isPending}
                  >
                    {validateMutation.isPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Validate
                  </Button>
                  <Button
                    onClick={handleImport}
                    disabled={!validationResult?.valid || importMutation.isPending}
                  >
                    {importMutation.isPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Import Trades
                  </Button>
                </>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
