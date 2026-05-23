'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, FileText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { DisciplineGauge } from '@/components/discipline/discipline-gauge';
import { RuleCard } from '@/components/discipline/rule-card';
import { ComplianceChart } from '@/components/discipline/compliance-chart';
import { RuleForm } from '@/components/discipline/rule-form';
import api from '@/lib/api';
import { TradingRule } from '@/types';
import { formatDate } from '@/lib/utils';

export default function DisciplinePage() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<TradingRule | null>(null);
  const [deleteRuleId, setDeleteRuleId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: score, isLoading: scoreLoading } = useQuery({
    queryKey: ['discipline-score'],
    queryFn: () => api.getDisciplineScore(),
  });

  const { data: weeklyReport, isLoading: reportLoading } = useQuery({
    queryKey: ['weekly-report'],
    queryFn: () => api.getWeeklyReport(),
  });

  const { data: rules, isLoading: rulesLoading } = useQuery({
    queryKey: ['trading-rules'],
    queryFn: () => api.getRules(),
  });

  const { data: correlation } = useQuery({
    queryKey: ['discipline-correlation'],
    queryFn: () => api.getCorrelation(),
  });

  const { data: violations } = useQuery({
    queryKey: ['violations'],
    queryFn: () => api.getViolations(),
  });

  const toggleMutation = useMutation({
    mutationFn: (id: string) => api.toggleRule(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trading-rules'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteRule(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trading-rules'] });
      setDeleteRuleId(null);
    },
  });

  const isLoading = scoreLoading || reportLoading || rulesLoading;

  const getRuleCompliance = (ruleId: string) => {
    const ruleStats = weeklyReport?.byRule?.find(r => r.ruleType === rules?.find(rule => rule._id === ruleId)?.ruleType);
    return ruleStats;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Discipline</h1>
          <p className="text-sm text-muted-foreground">
            Track rule compliance and improve trading discipline
          </p>
        </div>
        <Button onClick={() => setIsAddDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Rule
        </Button>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add Trading Rule</DialogTitle>
            </DialogHeader>
            <RuleForm
              onSuccess={() => {
                setIsAddDialogOpen(false);
                queryClient.invalidateQueries({ queryKey: ['trading-rules'] });
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Weekly Discipline Score</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[120px] w-full" />
            ) : (
              <DisciplineGauge
                score={score?.overallScore || 0}
                totalTrades={score?.totalTrades || 0}
                compliantTrades={score?.compliantTrades || 0}
              />
            )}
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Compliance vs Win Rate</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[120px] w-full" />
            ) : correlation ? (
              <ComplianceChart
                winRateCompliant={correlation.winRateWhenCompliant}
                winRateViolating={correlation.winRateWhenViolating}
              />
            ) : (
              <div className="flex h-[120px] items-center justify-center text-sm text-muted-foreground">
                Not enough data for correlation analysis
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Your Rules</h2>
            <span className="text-sm text-muted-foreground">
              {rules?.filter(r => r.enabled).length || 0} active
            </span>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-[100px] w-full" />
              ))}
            </div>
          ) : rules?.length === 0 ? (
            <Card className="border-border/50">
              <CardContent className="py-8 text-center">
                <FileText className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  No rules defined yet
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={() => setIsAddDialogOpen(true)}
                >
                  Add your first rule
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {rules?.map((rule) => {
                const ruleStats = getRuleCompliance(rule._id);
                return (
                  <RuleCard
                    key={rule._id}
                    rule={rule}
                    complianceRate={ruleStats?.complianceRate}
                    violations={ruleStats?.violations}
                    onToggle={(id) => toggleMutation.mutate(id)}
                    onEdit={(rule) => setEditingRule(rule)}
                    onDelete={(id) => setDeleteRuleId(id)}
                  />
                );
              })}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Recent Violations</h2>
          
          {violations && violations.length > 0 ? (
            <div className="space-y-2">
              {violations.slice(0, 5).map((v, index) => (
                <Card key={index} className="border-border/50">
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-sm">{v.symbol}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(v.date, 'MMM d, h:mm a')}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {v.violations.map((violation, i) => (
                        <span key={i} className="text-xs text-loss">
                          {violation}
                        </span>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="border-border/50">
              <CardContent className="py-8 text-center">
                <p className="text-sm text-muted-foreground">
                  No recent violations
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Dialog open={!!editingRule} onOpenChange={() => setEditingRule(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Rule</DialogTitle>
          </DialogHeader>
          {editingRule && (
            <RuleForm
              editRule={editingRule}
              onSuccess={() => {
                setEditingRule(null);
                queryClient.invalidateQueries({ queryKey: ['trading-rules'] });
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteRuleId} onOpenChange={() => setDeleteRuleId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete rule?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete this rule.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteRuleId && deleteMutation.mutate(deleteRuleId)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
