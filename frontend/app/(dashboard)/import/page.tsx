'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Upload, FileText, CheckCircle, AlertCircle, Download, Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import api from '@/lib/api';
import { cn, formatCurrency, formatDate } from '@/lib/utils';

export default function ImportPage() {
  const [csvContent, setCsvContent] = useState('');
  const [selectedBroker, setSelectedBroker] = useState('auto');
  const [step, setStep] = useState<'upload' | 'preview' | 'result'>('upload');
  const queryClient = useQueryClient();

  const { data: brokersData, isLoading: brokersLoading } = useQuery({
    queryKey: ['supported-brokers'],
    queryFn: () => api.getSupportedBrokers(),
  });

  const validateMutation = useMutation({
    mutationFn: () => api.validateCSV(csvContent, selectedBroker),
    onSuccess: () => setStep('preview'),
  });

  const importMutation = useMutation({
    mutationFn: () => api.importCSV(csvContent, selectedBroker),
    onSuccess: () => {
      setStep('result');
      // Invalidate all trade-related queries
      queryClient.invalidateQueries({ queryKey: ['trades'] });
      queryClient.invalidateQueries({ queryKey: ['recent-trades'] });
      queryClient.invalidateQueries({ queryKey: ['trades-calendar'] });
      queryClient.invalidateQueries({ queryKey: ['trades-all'] });
      queryClient.invalidateQueries({ queryKey: ['trade-stats'] });
      queryClient.invalidateQueries({ queryKey: ['behavioral-patterns'] });
      queryClient.invalidateQueries({ queryKey: ['briefing'] });
      queryClient.invalidateQueries({ queryKey: ['playbook'] });
      queryClient.invalidateQueries({ queryKey: ['playbook-comparison'] });
    },
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setCsvContent(event.target?.result as string);
      };
      reader.readAsText(file);
    }
  };

  const handleDownloadSample = async () => {
    try {
      const sample = await api.getSampleCSV(selectedBroker === 'auto' ? 'zerodha' : selectedBroker);
      const blob = new Blob([sample], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sample_${selectedBroker === 'auto' ? 'zerodha' : selectedBroker}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download sample:', error);
    }
  };

  const resetImport = () => {
    setCsvContent('');
    setStep('upload');
    validateMutation.reset();
    importMutation.reset();
  };

  const brokers = brokersData?.brokers || [];
  const preview = validateMutation.data;
  const result = importMutation.data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Import Trades</h1>
        <p className="text-sm text-muted-foreground">
          Import trades from your broker CSV exports
        </p>
      </div>

      <div className="flex items-center gap-4">
        <div className={cn(
          'flex items-center gap-2',
          step === 'upload' ? 'text-foreground' : 'text-muted-foreground'
        )}>
          <div className={cn(
            'h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium',
            step === 'upload' ? 'bg-primary text-primary-foreground' : 'bg-muted'
          )}>
            1
          </div>
          <span className="text-sm font-medium">Upload</span>
        </div>
        <div className="h-px w-8 bg-border" />
        <div className={cn(
          'flex items-center gap-2',
          step === 'preview' ? 'text-foreground' : 'text-muted-foreground'
        )}>
          <div className={cn(
            'h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium',
            step === 'preview' ? 'bg-primary text-primary-foreground' : 'bg-muted'
          )}>
            2
          </div>
          <span className="text-sm font-medium">Preview</span>
        </div>
        <div className="h-px w-8 bg-border" />
        <div className={cn(
          'flex items-center gap-2',
          step === 'result' ? 'text-foreground' : 'text-muted-foreground'
        )}>
          <div className={cn(
            'h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium',
            step === 'result' ? 'bg-primary text-primary-foreground' : 'bg-muted'
          )}>
            3
          </div>
          <span className="text-sm font-medium">Complete</span>
        </div>
      </div>

      {step === 'upload' && (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="text-base">Upload CSV File</CardTitle>
                <CardDescription>
                  Upload your broker trade history CSV or paste the content directly
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                  <Select value={selectedBroker} onValueChange={setSelectedBroker}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Select broker" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Auto-detect</SelectItem>
                      {brokers.map((broker) => (
                        <SelectItem key={broker.id} value={broker.id}>
                          {broker.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="sm" onClick={handleDownloadSample}>
                    <Download className="h-4 w-4 mr-2" />
                    Sample CSV
                  </Button>
                </div>

                <div className="border-2 border-dashed border-border/50 rounded-lg p-8 text-center hover:border-border transition-colors">
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="csv-upload"
                  />
                  <label htmlFor="csv-upload" className="cursor-pointer">
                    <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-sm font-medium mb-1">
                      Click to upload or drag and drop
                    </p>
                    <p className="text-xs text-muted-foreground">
                      CSV files only
                    </p>
                  </label>
                </div>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-border/50" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">
                      Or paste CSV content
                    </span>
                  </div>
                </div>

                <Textarea
                  value={csvContent}
                  onChange={(e) => setCsvContent(e.target.value)}
                  placeholder="Paste your CSV content here..."
                  className="min-h-[200px] font-mono text-xs"
                />

                <Button
                  onClick={() => validateMutation.mutate()}
                  disabled={!csvContent.trim() || validateMutation.isPending}
                  className="w-full"
                >
                  {validateMutation.isPending ? 'Validating...' : 'Validate & Preview'}
                </Button>

                {validateMutation.isError && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Validation Failed</AlertTitle>
                    <AlertDescription>
                      {(validateMutation.error as Error)?.message || 'Failed to validate CSV'}
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </div>

          <div>
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="text-base">Supported Brokers</CardTitle>
              </CardHeader>
              <CardContent>
                {brokersLoading ? (
                  <div className="space-y-3">
                    {[...Array(3)].map((_, i) => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {brokers.map((broker) => (
                      <div
                        key={broker.id}
                        className="p-3 rounded-lg border border-border/50 hover:border-border transition-colors"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-sm">{broker.name}</span>
                          <Badge variant="secondary" className="text-xs">
                            {broker.supportedFormats?.join(', ')}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {broker.description}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Alert className="mt-4">
              <Info className="h-4 w-4" />
              <AlertTitle>FIFO Matching</AlertTitle>
              <AlertDescription className="text-xs">
                We automatically match buy/sell orders using FIFO (First In, First Out) method to calculate P&L correctly.
              </AlertDescription>
            </Alert>
          </div>
        </div>
      )}

      {step === 'preview' && preview && (
        <Card className="border-border/50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Preview Import</CardTitle>
                <CardDescription>
                  Detected broker: <Badge variant="secondary">{preview.broker}</Badge>
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={resetImport}>
                  Back
                </Button>
                <Button
                  onClick={() => importMutation.mutate()}
                  disabled={importMutation.isPending}
                >
                  {importMutation.isPending ? 'Importing...' : `Import ${preview.preview?.trades?.length || 0} Trades`}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {preview.errors && preview.errors.length > 0 && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Validation Warnings</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc list-inside text-sm mt-2">
                    {preview.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            <div className="rounded-lg border border-border/50 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Symbol</TableHead>
                    <TableHead>Direction</TableHead>
                    <TableHead className="text-right">Entry</TableHead>
                    <TableHead className="text-right">Exit</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">P&L</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(preview.preview?.trades || []).slice(0, 10).map((trade, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-mono text-xs">
                        {formatDate(trade.tradeDate, 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell className="font-medium">{trade.symbol}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-xs',
                            trade.direction === 'long' ? 'border-profit/50 text-profit' : 'border-loss/50 text-loss'
                          )}
                        >
                          {trade.direction?.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {trade.entryPrice?.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {trade.exitPrice?.toFixed(2) || '-'}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {trade.quantity}
                      </TableCell>
                      <TableCell className={cn(
                        'text-right font-mono text-sm',
                        (trade.profitLoss || 0) >= 0 ? 'text-profit' : 'text-loss'
                      )}>
                        {trade.profitLoss !== undefined ? formatCurrency(trade.profitLoss) : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {preview.preview?.trades && preview.preview.trades.length > 10 && (
                <div className="p-3 text-center text-sm text-muted-foreground border-t border-border/50">
                  And {preview.preview.trades.length - 10} more trades...
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {step === 'result' && result && (
        <Card className="border-border/50">
          <CardContent className="py-12 text-center">
            <CheckCircle className="mx-auto h-16 w-16 text-profit mb-4" />
            <h2 className="text-2xl font-semibold mb-2">Import Successful!</h2>
            <p className="text-muted-foreground mb-6">{result.message}</p>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-2xl mx-auto mb-8">
              <div className="p-4 rounded-lg bg-muted/50">
                <p className="text-2xl font-bold text-foreground">
                  {result.summary?.totalExecutions || 0}
                </p>
                <p className="text-xs text-muted-foreground">Total Rows</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50">
                <p className="text-2xl font-bold text-profit">
                  {result.summary?.completedTrades || 0}
                </p>
                <p className="text-xs text-muted-foreground">Completed Trades</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50">
                <p className="text-2xl font-bold text-warning">
                  {result.summary?.openPositions || 0}
                </p>
                <p className="text-xs text-muted-foreground">Open Positions</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50">
                <p className="text-2xl font-bold text-foreground">
                  {result.summary?.imported || 0}
                </p>
                <p className="text-xs text-muted-foreground">Imported</p>
              </div>
            </div>

            <div className="flex justify-center gap-4">
              <Button variant="outline" onClick={resetImport}>
                Import More
              </Button>
              <Button onClick={() => window.location.href = '/trades'}>
                View Trades
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
