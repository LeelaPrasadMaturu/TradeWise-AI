'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { TradeForm } from '@/components/trades/trade-form';
import { Skeleton } from '@/components/ui/skeleton';
import api from '@/lib/api';

function JournalContent() {
  const searchParams = useSearchParams();
  const editId = searchParams.get('edit');

  const { data: editTrade, isLoading } = useQuery({
    queryKey: ['trade', editId],
    queryFn: () => api.getTrade(editId!),
    enabled: !!editId,
  });

  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold text-foreground">
          {editId ? 'Edit Trade' : 'Log Trade'}
        </h1>
        <p className="text-sm text-muted-foreground">
          {editId ? 'Update your trade details' : 'Record a new trade in your journal'}
        </p>
      </div>

      {editId && isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-[300px] w-full" />
          <Skeleton className="h-[200px] w-full" />
        </div>
      ) : (
        <TradeForm editTrade={editTrade} />
      )}
    </>
  );
}

export default function JournalPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Suspense fallback={
        <div className="space-y-4">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-[300px] w-full" />
          <Skeleton className="h-[200px] w-full" />
        </div>
      }>
        <JournalContent />
      </Suspense>
    </div>
  );
}
