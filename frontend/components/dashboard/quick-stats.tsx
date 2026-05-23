'use client';

import { useQuery } from '@tanstack/react-query';
import { TrendingUp, TrendingDown, Target, Shield } from 'lucide-react';
import { StatCard } from './stat-card';
import { Skeleton } from '@/components/ui/skeleton';
import api from '@/lib/api';
import { formatCurrency, formatPercent, getPnLColor } from '@/lib/utils';

export function QuickStats() {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['trade-stats'],
    queryFn: () => api.getTradeStats(),
  });

  const { data: behavioral, isLoading: behavioralLoading } = useQuery({
    queryKey: ['behavioral-summary'],
    queryFn: () => api.getBehavioralSummary(),
  });

  const { data: discipline, isLoading: disciplineLoading } = useQuery({
    queryKey: ['discipline-score'],
    queryFn: () => api.getDisciplineScore(),
  });

  const isLoading = statsLoading || behavioralLoading || disciplineLoading;

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-[100px]" />
        ))}
      </div>
    );
  }

  const winRate = stats?.winRate || 0;
  const totalPnL = stats?.totalProfitLoss || 0;
  const behavioralScore = behavioral?.behavioralScore || 0;
  const disciplineScore = discipline?.overallScore || 0;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <StatCard
        title="Win Rate"
        value={`${winRate.toFixed(1)}%`}
        subtitle={`${stats?.winningTrades || 0}W / ${stats?.losingTrades || 0}L`}
        icon={winRate >= 50 ? TrendingUp : TrendingDown}
        valueClassName={winRate >= 50 ? 'text-profit' : 'text-loss'}
      />
      <StatCard
        title="Total P&L"
        value={formatCurrency(totalPnL)}
        subtitle={`${stats?.closedTrades || 0} closed trades`}
        icon={totalPnL >= 0 ? TrendingUp : TrendingDown}
        valueClassName={getPnLColor(totalPnL)}
      />
      <StatCard
        title="Behavioral Score"
        value={behavioralScore}
        subtitle={behavioral?.tradingStyle || 'Unknown style'}
        icon={Target}
        valueClassName={
          behavioralScore >= 70 ? 'text-profit' : 
          behavioralScore >= 50 ? 'text-warning' : 'text-loss'
        }
      />
      <StatCard
        title="Discipline Score"
        value={disciplineScore}
        subtitle={`${discipline?.compliantTrades || 0}/${discipline?.totalTrades || 0} compliant`}
        icon={Shield}
        valueClassName={
          disciplineScore >= 80 ? 'text-profit' : 
          disciplineScore >= 60 ? 'text-warning' : 'text-loss'
        }
      />
    </div>
  );
}
