'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, FileText, TrendingUp, TrendingDown, Calculator, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import api from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { TaxReport, TradeSummary } from '@/types';

function StatCard({ 
  title, 
  value, 
  subtitle, 
  icon: Icon, 
  variant = 'default' 
}: { 
  title: string; 
  value: string; 
  subtitle?: string; 
  icon: React.ElementType;
  variant?: 'default' | 'profit' | 'loss';
}) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className={`text-2xl font-bold font-mono-numbers ${
              variant === 'profit' ? 'text-profit' : 
              variant === 'loss' ? 'text-loss' : ''
            }`}>
              {value}
            </p>
            {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
          </div>
          <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
            <Icon className="h-5 w-5 text-muted-foreground" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TradesTable({ trades, showGainType = false }: { trades: TradeSummary[]; showGainType?: boolean }) {
  if (trades.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No trades in this category
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Symbol</TableHead>
            <TableHead>Direction</TableHead>
            <TableHead>Entry Date</TableHead>
            <TableHead>Exit Date</TableHead>
            <TableHead className="text-right">Entry</TableHead>
            <TableHead className="text-right">Exit</TableHead>
            <TableHead className="text-right">Qty</TableHead>
            <TableHead className="text-right">P&L</TableHead>
            <TableHead className="text-right">Charges</TableHead>
            <TableHead className="text-right">Net P&L</TableHead>
            {showGainType && <TableHead>Type</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {trades.map((trade) => (
            <TableRow key={trade._id}>
              <TableCell className="font-medium">{trade.symbol}</TableCell>
              <TableCell>
                <Badge variant={trade.direction === 'long' ? 'default' : 'secondary'}>
                  {trade.direction}
                </Badge>
              </TableCell>
              <TableCell>{formatDate(trade.entryDate)}</TableCell>
              <TableCell>{formatDate(trade.exitDate)}</TableCell>
              <TableCell className="text-right font-mono-numbers">{trade.entryPrice.toFixed(2)}</TableCell>
              <TableCell className="text-right font-mono-numbers">{trade.exitPrice.toFixed(2)}</TableCell>
              <TableCell className="text-right font-mono-numbers">{trade.quantity}</TableCell>
              <TableCell className={`text-right font-mono-numbers ${trade.pnl >= 0 ? 'text-profit' : 'text-loss'}`}>
                {formatCurrency(trade.pnl)}
              </TableCell>
              <TableCell className="text-right font-mono-numbers text-muted-foreground">
                {formatCurrency(trade.charges)}
              </TableCell>
              <TableCell className={`text-right font-mono-numbers ${trade.netPnl >= 0 ? 'text-profit' : 'text-loss'}`}>
                {formatCurrency(trade.netPnl)}
              </TableCell>
              {showGainType && (
                <TableCell>
                  <Badge variant={trade.gainType === 'LTCG' ? 'outline' : 'secondary'}>
                    {trade.gainType}
                  </Badge>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export default function ReportsPage() {
  const [selectedFY, setSelectedFY] = useState<string>('');

  const { data: fyData } = useQuery({
    queryKey: ['available-fys'],
    queryFn: () => api.getAvailableFYs(),
  });

  const currentFY = selectedFY || fyData?.current || '';

  const { data: report, isLoading, error } = useQuery({
    queryKey: ['tax-report', currentFY],
    queryFn: () => api.getTaxReport(currentFY),
    enabled: !!currentFY,
  });

  const { data: fnoReport } = useQuery({
    queryKey: ['fno-turnover', currentFY],
    queryFn: () => api.getFnOTurnover(currentFY),
    enabled: !!currentFY,
  });

  const handleExportCSV = async () => {
    try {
      const csv = await api.exportTaxReport(currentFY, 'csv');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tax-report-${currentFY}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Tax Reports</h1>
          <p className="text-sm text-muted-foreground">
            ITR-ready reports for capital gains and F&O turnover
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedFY || fyData?.current} onValueChange={(val) => val && setSelectedFY(val)}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Select FY" />
            </SelectTrigger>
            <SelectContent>
              {fyData?.years.map((fy) => (
                <SelectItem key={fy} value={fy}>
                  FY {fy}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={handleExportCSV}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>Failed to load tax report. Please try again.</AlertDescription>
        </Alert>
      )}

      {report && (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Total P&L"
              value={formatCurrency(report.summary.totalPnL)}
              subtitle={`${report.summary.totalTradeCount} trades`}
              icon={report.summary.totalPnL >= 0 ? TrendingUp : TrendingDown}
              variant={report.summary.totalPnL >= 0 ? 'profit' : 'loss'}
            />
            <StatCard
              title="Total Charges"
              value={formatCurrency(report.summary.totalCharges)}
              subtitle="Brokerage, STT, etc."
              icon={Calculator}
            />
            <StatCard
              title="Net P&L"
              value={formatCurrency(report.summary.netPnL)}
              subtitle="After all charges"
              icon={report.summary.netPnL >= 0 ? TrendingUp : TrendingDown}
              variant={report.summary.netPnL >= 0 ? 'profit' : 'loss'}
            />
            <StatCard
              title="F&O Turnover"
              value={formatCurrency(report.fno.totalTurnover)}
              subtitle={`${report.fno.tradeCount} F&O trades`}
              icon={FileText}
            />
          </div>

          {fnoReport?.taxAudit?.required && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Tax Audit Required</AlertTitle>
              <AlertDescription>{fnoReport.taxAudit.reason}</AlertDescription>
            </Alert>
          )}

          <Tabs defaultValue="summary" className="space-y-4">
            <TabsList>
              <TabsTrigger value="summary">Summary</TabsTrigger>
              <TabsTrigger value="equity">Equity ({report.summary.equityTradeCount})</TabsTrigger>
              <TabsTrigger value="fno">F&O ({report.summary.fnoTradeCount})</TabsTrigger>
              <TabsTrigger value="monthly">Monthly</TabsTrigger>
            </TabsList>

            <TabsContent value="summary" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Capital Gains (Equity)</CardTitle>
                    <CardDescription>Short-term and long-term gains from equity trades</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Short Term (STCG)</p>
                        <p className="font-semibold">Tax Rate: 20%</p>
                      </div>
                      <p className={`text-xl font-bold font-mono-numbers ${
                        report.equity.stcg.netPnL >= 0 ? 'text-profit' : 'text-loss'
                      }`}>
                        {formatCurrency(report.equity.stcg.netPnL)}
                      </p>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Long Term (LTCG)</p>
                        <p className="font-semibold">Tax Rate: 12.5% above ₹1.25L</p>
                      </div>
                      <p className={`text-xl font-bold font-mono-numbers ${
                        report.equity.ltcg.netPnL >= 0 ? 'text-profit' : 'text-loss'
                      }`}>
                        {formatCurrency(report.equity.ltcg.netPnL)}
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">F&O Business Income</CardTitle>
                    <CardDescription>Futures and Options treated as business income</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">Total Turnover</p>
                      <p className="font-mono-numbers">{formatCurrency(report.fno.totalTurnover)}</p>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">Net P&L</p>
                      <p className={`font-mono-numbers ${
                        report.fno.totalNetPnL >= 0 ? 'text-profit' : 'text-loss'
                      }`}>
                        {formatCurrency(report.fno.totalNetPnL)}
                      </p>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">Profit %</p>
                      <p className="font-mono-numbers">
                        {report.fno.totalTurnover > 0 
                          ? ((report.fno.totalNetPnL / report.fno.totalTurnover) * 100).toFixed(2)
                          : '0.00'}%
                      </p>
                    </div>
                    {fnoReport && (
                      <div className="pt-2 border-t">
                        <p className="text-sm text-muted-foreground">ITR Form Required</p>
                        <Badge variant="outline" className="mt-1">ITR-3</Badge>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Top Symbols by P&L</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Symbol</TableHead>
                          <TableHead>Segment</TableHead>
                          <TableHead className="text-right">Trades</TableHead>
                          <TableHead className="text-right">P&L</TableHead>
                          <TableHead className="text-right">Charges</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {report.topSymbols.slice(0, 10).map((sym) => (
                          <TableRow key={sym.symbol}>
                            <TableCell className="font-medium">{sym.symbol}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{sym.segment}</Badge>
                            </TableCell>
                            <TableCell className="text-right font-mono-numbers">{sym.trades}</TableCell>
                            <TableCell className={`text-right font-mono-numbers ${
                              sym.pnl >= 0 ? 'text-profit' : 'text-loss'
                            }`}>
                              {formatCurrency(sym.pnl)}
                            </TableCell>
                            <TableCell className="text-right font-mono-numbers text-muted-foreground">
                              {formatCurrency(sym.charges)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="equity" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">
                    Short Term Capital Gains (STCG)
                    <Badge variant="secondary" className="ml-2">{report.equity.stcg.tradeCount} trades</Badge>
                  </CardTitle>
                  <CardDescription>
                    Equity held for less than 12 months. Taxed at 20% (Section 111A).
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <TradesTable trades={report.equity.stcg.trades} showGainType />
                  <div className="flex justify-end mt-4 pt-4 border-t">
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Net STCG</p>
                      <p className={`text-xl font-bold font-mono-numbers ${
                        report.equity.stcg.netPnL >= 0 ? 'text-profit' : 'text-loss'
                      }`}>
                        {formatCurrency(report.equity.stcg.netPnL)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">
                    Long Term Capital Gains (LTCG)
                    <Badge variant="secondary" className="ml-2">{report.equity.ltcg.tradeCount} trades</Badge>
                  </CardTitle>
                  <CardDescription>
                    Equity held for more than 12 months. Taxed at 12.5% above ₹1.25 lakh exemption (Section 112A).
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <TradesTable trades={report.equity.ltcg.trades} showGainType />
                  <div className="flex justify-end mt-4 pt-4 border-t">
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Net LTCG</p>
                      <p className={`text-xl font-bold font-mono-numbers ${
                        report.equity.ltcg.netPnL >= 0 ? 'text-profit' : 'text-loss'
                      }`}>
                        {formatCurrency(report.equity.ltcg.netPnL)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="fno" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">
                    Futures Trades
                    <Badge variant="secondary" className="ml-2">{report.fno.futures.tradeCount} trades</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <TradesTable trades={report.fno.futures.trades} />
                  <div className="flex justify-between mt-4 pt-4 border-t">
                    <div>
                      <p className="text-sm text-muted-foreground">Turnover (Abs P&L Sum)</p>
                      <p className="font-mono-numbers">{formatCurrency(report.fno.futures.turnover || 0)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Net P&L</p>
                      <p className={`text-xl font-bold font-mono-numbers ${
                        (report.fno.futures.netPnL || 0) >= 0 ? 'text-profit' : 'text-loss'
                      }`}>
                        {formatCurrency(report.fno.futures.netPnL || 0)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">
                    Options Trades
                    <Badge variant="secondary" className="ml-2">{report.fno.options.tradeCount} trades</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <TradesTable trades={report.fno.options.trades} />
                  <div className="flex justify-between mt-4 pt-4 border-t">
                    <div>
                      <p className="text-sm text-muted-foreground">Turnover (Abs P&L Sum)</p>
                      <p className="font-mono-numbers">{formatCurrency(report.fno.options.turnover || 0)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Net P&L</p>
                      <p className={`text-xl font-bold font-mono-numbers ${
                        (report.fno.options.netPnL || 0) >= 0 ? 'text-profit' : 'text-loss'
                      }`}>
                        {formatCurrency(report.fno.options.netPnL || 0)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="monthly">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Monthly P&L Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Month</TableHead>
                          <TableHead className="text-right">Trades</TableHead>
                          <TableHead className="text-right">P&L</TableHead>
                          <TableHead className="text-right">Charges</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {Object.entries(report.byMonth).map(([month, data]) => (
                          <TableRow key={month}>
                            <TableCell className="font-medium">{month}</TableCell>
                            <TableCell className="text-right font-mono-numbers">{data.trades}</TableCell>
                            <TableCell className={`text-right font-mono-numbers ${
                              data.pnl >= 0 ? 'text-profit' : 'text-loss'
                            }`}>
                              {formatCurrency(data.pnl)}
                            </TableCell>
                            <TableCell className="text-right font-mono-numbers text-muted-foreground">
                              {formatCurrency(data.charges)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
