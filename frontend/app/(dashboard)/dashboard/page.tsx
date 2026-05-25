'use client';

import { QuickStats } from '@/components/dashboard/quick-stats';
import { RecentTrades } from '@/components/dashboard/recent-trades';
import { BriefingCard } from '@/components/dashboard/briefing-card';
import { CoachingAlerts } from '@/components/dashboard/coaching-alerts';
import { GamePlan } from '@/components/dashboard/game-plan';

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Overview of your trading performance
        </p>
      </div>

      <BriefingCard />

      <QuickStats />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RecentTrades />
        </div>
        <div className="space-y-6">
          <GamePlan />
          <CoachingAlerts />
        </div>
      </div>
    </div>
  );
}
