'use client';

import { useState } from 'react';
import { Search, X, Filter } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import type { DateRange } from 'react-day-picker';

export interface TradeFilters {
  search: string;
  result: string;
  direction: string;
  startDate?: Date;
  endDate?: Date;
}

interface TradeFiltersProps {
  filters: TradeFilters;
  onFiltersChange: (filters: TradeFilters) => void;
}

export function TradeFiltersComponent({ filters, onFiltersChange }: TradeFiltersProps) {
  const [dateRange, setDateRange] = useState<DateRange | undefined>(
    filters.startDate ? { from: filters.startDate, to: filters.endDate } : undefined
  );

  const hasActiveFilters = 
    filters.search || 
    filters.result !== 'all' || 
    filters.direction !== 'all' ||
    filters.startDate ||
    filters.endDate;

  const clearFilters = () => {
    onFiltersChange({
      search: '',
      result: 'all',
      direction: 'all',
      startDate: undefined,
      endDate: undefined,
    });
    setDateRange(undefined);
  };

  const updateFilter = (key: keyof TradeFilters, value: string | Date | undefined) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-1 items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by symbol..."
            value={filters.search}
            onChange={(e) => updateFilter('search', e.target.value)}
            className="pl-8"
          />
        </div>

        <Select
          value={filters.result}
          onValueChange={(value) => value && updateFilter('result', value)}
        >
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="Result" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Results</SelectItem>
            <SelectItem value="win">Win</SelectItem>
            <SelectItem value="loss">Loss</SelectItem>
            <SelectItem value="breakeven">Breakeven</SelectItem>
            <SelectItem value="open">Open</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={filters.direction}
          onValueChange={(value) => value && updateFilter('direction', value)}
        >
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="Direction" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="long">Long</SelectItem>
            <SelectItem value="short">Short</SelectItem>
          </SelectContent>
        </Select>

        <Popover>
          <PopoverTrigger>
            <Button variant="outline" className={cn(
              'justify-start text-left font-normal',
              !dateRange?.from && 'text-muted-foreground'
            )}>
              <Filter className="mr-2 h-4 w-4" />
              {dateRange?.from ? (
                dateRange.to ? (
                  <>
                    {format(dateRange.from, 'MMM d')} - {format(dateRange.to, 'MMM d')}
                  </>
                ) : (
                  format(dateRange.from, 'MMM d, yyyy')
                )
              ) : (
                'Date Range'
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              selected={dateRange}
              onSelect={(range) => {
                setDateRange(range);
                onFiltersChange({
                  ...filters,
                  startDate: range?.from,
                  endDate: range?.to,
                });
              }}
              numberOfMonths={2}
            />
          </PopoverContent>
        </Popover>
      </div>

      {hasActiveFilters && (
        <Button variant="ghost" size="sm" onClick={clearFilters}>
          <X className="mr-1 h-4 w-4" />
          Clear filters
        </Button>
      )}
    </div>
  );
}
