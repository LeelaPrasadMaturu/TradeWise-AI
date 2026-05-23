'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { TradeFiltersComponent, TradeFilters } from '@/components/trades/trade-filters';
import { TradeTable } from '@/components/trades/trade-table';
import { Pagination } from '@/components/trades/pagination';
import api from '@/lib/api';
import { format } from 'date-fns';

export default function TradesPage() {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [sortField, setSortField] = useState('tradeDate');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [filters, setFilters] = useState<TradeFilters>({
    search: '',
    result: 'all',
    direction: 'all',
    startDate: undefined,
    endDate: undefined,
  });

  const queryParams = useMemo(() => {
    const params: Record<string, string | number> = {
      page,
      limit,
      sort: `${sortDirection === 'desc' ? '-' : ''}${sortField}`,
    };

    if (filters.search) {
      params.symbol = filters.search;
    }
    if (filters.result && filters.result !== 'all') {
      params.result = filters.result;
    }
    if (filters.startDate) {
      params.startDate = format(filters.startDate, 'yyyy-MM-dd');
    }
    if (filters.endDate) {
      params.endDate = format(filters.endDate, 'yyyy-MM-dd');
    }

    return params;
  }, [page, limit, sortField, sortDirection, filters]);

  const { data, isLoading } = useQuery({
    queryKey: ['trades', queryParams],
    queryFn: () => api.getTrades(queryParams),
  });

  const trades = data?.data || [];
  const pagination = data?.pagination || { page: 1, limit: 20, total: 0, totalPages: 1 };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
    setPage(1);
  };

  const handleFiltersChange = (newFilters: TradeFilters) => {
    setFilters(newFilters);
    setPage(1);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  const handleLimitChange = (newLimit: number) => {
    setLimit(newLimit);
    setPage(1);
  };

  // Filter by direction client-side since API might not support it directly
  const filteredTrades = useMemo(() => {
    if (filters.direction === 'all') return trades;
    return trades.filter(t => t.direction === filters.direction);
  }, [trades, filters.direction]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Trades</h1>
          <p className="text-sm text-muted-foreground">
            View and manage your trade history
          </p>
        </div>
        <Link href="/journal">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Trade
          </Button>
        </Link>
      </div>

      <Card className="border-border/50">
        <CardContent className="p-4 space-y-4">
          <TradeFiltersComponent
            filters={filters}
            onFiltersChange={handleFiltersChange}
          />

          <TradeTable
            trades={filteredTrades}
            isLoading={isLoading}
            sortField={sortField}
            sortDirection={sortDirection}
            onSort={handleSort}
          />

          {pagination.total > 0 && (
            <Pagination
              page={pagination.page}
              totalPages={pagination.totalPages}
              total={pagination.total}
              limit={limit}
              onPageChange={handlePageChange}
              onLimitChange={handleLimitChange}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
