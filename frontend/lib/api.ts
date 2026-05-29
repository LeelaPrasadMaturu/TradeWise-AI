import Cookies from 'js-cookie';
import type {
  Trade,
  TradeStats,
  TradingRule,
  DisciplineScore,
  BehavioralAnalysis,
  CoachingAlert,
  PreMarketBriefing,
  PaginatedResponse,
  AuthResponse,
  UserTradingConfig,
  User,
  TaxReport,
  FlashbackWarning,
  GamePlan,
  EdgeAnalysis,
  EdgeStats,
  TimeAlertResponse,
  HoldTimeAnalysis,
  Playbook,
  PlaybookSetup,
  SetupMatchCriteria,
  SetupRules,
  SetupChecklist,
  SetupComparison,
  IndisciplineAnalysis,
  StopLossAnalysis,
  EarlyExitAnalysis,
} from '@/types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

class ApiClient {
  private getToken(): string | undefined {
    return Cookies.get('token');
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = this.getToken();
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (token) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({ message: 'An error occurred' }));
      const err = new Error(data.message || `HTTP error! status: ${response.status}`) as Error & { status: number; data: Record<string, unknown> };
      err.status = response.status;
      err.data = data;
      throw err;
    }

    return response.json();
  }

  // Auth
  async login(email: string, password: string): Promise<AuthResponse> {
    const response = await this.request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    Cookies.set('token', response.token, { expires: 7 });
    return response;
  }

  async register(name: string, email: string, password: string): Promise<AuthResponse> {
    const response = await this.request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    });
    Cookies.set('token', response.token, { expires: 7 });
    return response;
  }

  logout(): void {
    Cookies.remove('token');
  }

  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  // Trades
  async getTrades(params?: {
    page?: number;
    limit?: number;
    sort?: string;
    symbol?: string;
    result?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<PaginatedResponse<Trade>> {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) searchParams.append(key, String(value));
      });
    }
    const query = searchParams.toString();
    const response = await this.request<{
      trades: Trade[];
      totalPages: number;
      currentPage: number;
    }>(`/trades${query ? `?${query}` : ''}`);
    
    // Map backend response to frontend PaginatedResponse format
    return {
      data: response.trades || [],
      pagination: {
        page: Number(response.currentPage) || 1,
        limit: params?.limit || 10,
        total: (response.trades?.length || 0) * (response.totalPages || 1),
        totalPages: response.totalPages || 1,
      },
    };
  }

  async getTrade(id: string): Promise<Trade> {
    return this.request<Trade>(`/trades/${id}`);
  }

  async createTrade(trade: Partial<Trade>): Promise<Trade> {
    return this.request<Trade>('/trades', {
      method: 'POST',
      body: JSON.stringify(trade),
    });
  }

  async updateTrade(id: string, trade: Partial<Trade>): Promise<Trade> {
    return this.request<Trade>(`/trades/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(trade),
    });
  }

  async deleteTrade(id: string): Promise<void> {
    await this.request<void>(`/trades/${id}`, { method: 'DELETE' });
  }

  async getTradeStats(): Promise<TradeStats> {
    return this.request<TradeStats>('/trades/stats');
  }

  // Behavioral Analysis
  async getBehavioralPatterns(period?: string): Promise<BehavioralAnalysis> {
    const query = period ? `?period=${period}` : '';
    return this.request<BehavioralAnalysis>(`/behavioral/patterns${query}`);
  }

  async getBehavioralSummary(): Promise<{
    behavioralScore: number;
    tradingStyle: string;
    topIssues: Array<{
      type: string;
      severity: string;
      insight: string;
      costEstimate: number;
    }>;
    positivePatterns: string[];
  }> {
    return this.request(`/behavioral/summary`);
  }

  async getBaseline(): Promise<BehavioralAnalysis['baseline']> {
    return this.request(`/behavioral/baseline`);
  }

  // Discipline
  async getDisciplineScore(period?: string): Promise<DisciplineScore> {
    const endpoint = period ? `/discipline/score/${period}` : '/discipline/score';
    return this.request<DisciplineScore>(endpoint);
  }

  async getWeeklyReport(): Promise<DisciplineScore> {
    const response = await this.request<{ success: boolean; report: DisciplineScore }>('/discipline/weekly-report');
    return response.report;
  }

  async getCorrelation(): Promise<{
    winRateWhenCompliant: number;
    winRateWhenViolating: number;
    insight: string;
  }> {
    return this.request('/discipline/correlation');
  }

  async getViolations(): Promise<Array<{
    tradeId: string;
    symbol: string;
    date: string;
    violations: string[];
  }>> {
    const response = await this.request<{ success: boolean; count: number; violations: Array<{
      tradeId: string;
      symbol: string;
      date: string;
      violations: string[];
    }> }>('/discipline/violations');
    return response.violations || [];
  }

  // Indiscipline Insights
  async getIndisciplineAnalysis(days?: number): Promise<IndisciplineAnalysis> {
    const endpoint = days ? `/discipline/indiscipline?days=${days}` : '/discipline/indiscipline';
    const response = await this.request<{ success: boolean } & IndisciplineAnalysis>(endpoint);
    return response;
  }

  async getStopLossAnalysis(days?: number): Promise<StopLossAnalysis> {
    const endpoint = days ? `/discipline/stop-loss-analysis?days=${days}` : '/discipline/stop-loss-analysis';
    const response = await this.request<{ success: boolean } & StopLossAnalysis>(endpoint);
    return response;
  }

  async getEarlyExitAnalysis(days?: number): Promise<EarlyExitAnalysis> {
    const endpoint = days ? `/discipline/early-exit-analysis?days=${days}` : '/discipline/early-exit-analysis';
    const response = await this.request<{ success: boolean } & EarlyExitAnalysis>(endpoint);
    return response;
  }

  // Rules
  async getRules(): Promise<TradingRule[]> {
    const response = await this.request<{ success: boolean; count: number; rules: TradingRule[] }>('/rules');
    return response.rules || [];
  }

  async createRule(rule: Partial<TradingRule>): Promise<TradingRule> {
    return this.request<TradingRule>('/rules', {
      method: 'POST',
      body: JSON.stringify(rule),
    });
  }

  async updateRule(id: string, rule: Partial<TradingRule>): Promise<TradingRule> {
    return this.request<TradingRule>(`/rules/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(rule),
    });
  }

  async toggleRule(id: string): Promise<TradingRule> {
    return this.request<TradingRule>(`/rules/${id}/toggle`, {
      method: 'POST',
    });
  }

  async deleteRule(id: string): Promise<void> {
    await this.request<void>(`/rules/${id}`, { method: 'DELETE' });
  }

  async getRuleTemplates(): Promise<Array<{
    name: string;
    description: string;
    rules: Partial<TradingRule>[];
  }>> {
    return this.request('/rules/templates');
  }

  async applyTemplate(templateName: string): Promise<TradingRule[]> {
    return this.request<TradingRule[]>(`/rules/templates/${templateName}/apply`, {
      method: 'POST',
    });
  }

  async evaluateRulesRetroactively(periodDays: number = 90): Promise<{
    success: boolean;
    processed: number;
    created: number;
    updated: number;
    errors: number;
    rulesEvaluated: number;
    message?: string;
  }> {
    return this.request('/rules/evaluate-retroactively', {
      method: 'POST',
      body: JSON.stringify({ periodDays, forceRecheck: true }),
    });
  }

  // Trading Config
  async getTradingConfig(): Promise<UserTradingConfig> {
    return this.request<UserTradingConfig>('/rules/config/settings');
  }

  async updateTradingConfig(config: Partial<UserTradingConfig>): Promise<UserTradingConfig> {
    return this.request<UserTradingConfig>('/rules/config/settings', {
      method: 'PATCH',
      body: JSON.stringify(config),
    });
  }

  // Coach
  async getBriefing(): Promise<PreMarketBriefing> {
    return this.request<PreMarketBriefing>('/coach/briefing');
  }

  async sendBriefingEmail(): Promise<{
    success: boolean;
    message: string;
    briefing: PreMarketBriefing;
    deliveryResult: { success: boolean; method: string; error?: string };
  }> {
    return this.request('/coach/briefing/send', { method: 'POST' });
  }

  async getAlerts(): Promise<{ alerts: CoachingAlert[] }> {
    return this.request<{ alerts: CoachingAlert[] }>('/coach/alerts');
  }

  async getYesterdaySummary(): Promise<PreMarketBriefing['yesterdaySummary']> {
    return this.request('/coach/summary/yesterday');
  }

  // Import
  async importCSV(csv: string, broker?: string): Promise<{
    success: boolean;
    message: string;
    broker: string;
    summary: {
      totalExecutions: number;
      parsedExecutions: number;
      completedTrades: number;
      openPositions: number;
      imported: number;
      skipped: number;
    };
    importedTrades: Trade[];
  }> {
    return this.request('/import/csv', {
      method: 'POST',
      body: JSON.stringify({ csv, broker: broker || 'auto' }),
    });
  }

  async validateCSV(csv: string, broker?: string): Promise<{
    valid: boolean;
    broker: string;
    summary?: {
      totalExecutions: number;
      parsedExecutions: number;
      completedTrades: number;
      openPositions: number;
    };
    preview?: {
      trades: Trade[];
      openPositions: Trade[];
    };
    errors?: string[];
  }> {
    return this.request('/import/csv/validate', {
      method: 'POST',
      body: JSON.stringify({ csv, broker: broker || 'auto' }),
    });
  }

  // User Profile
  async getProfile(): Promise<User> {
    return this.request<User>('/auth/profile');
  }

  // Tax Reports
  async getTaxReport(fy?: string): Promise<TaxReport> {
    const query = fy ? `?fy=${fy}` : '';
    return this.request<TaxReport>(`/reports/tax${query}`);
  }

  async exportTaxReport(fy: string, format: 'csv' | 'pdf' = 'csv'): Promise<string> {
    const response = await fetch(
      `${API_BASE_URL}/reports/tax/export?fy=${fy}&format=${format}`,
      {
        headers: {
          Authorization: `Bearer ${this.getToken()}`,
        },
      }
    );
    if (!response.ok) throw new Error('Export failed');
    return response.text();
  }

  async getCapitalGainsSummary(fy?: string): Promise<TaxReport['summary']> {
    const query = fy ? `?fy=${fy}` : '';
    return this.request(`/reports/capital-gains${query}`);
  }

  async getFnOTurnover(fy?: string): Promise<{
    financialYear: string;
    turnoverCalculation: {
      totalTurnover: number;
      futures: { absolutePnLSum: number; trades: number };
      options: { absolutePnLSum: number; trades: number };
    };
    profitAndLoss: {
      grossPnL: number;
      charges: number;
      netPnL: number;
      profitPercentage: string;
    };
    taxAudit: {
      required: boolean;
      reason: string | null;
    };
  }> {
    const query = fy ? `?fy=${fy}` : '';
    return this.request(`/reports/fno-turnover${query}`);
  }

  async getAvailableFYs(): Promise<{ years: string[]; current: string }> {
    return this.request('/reports/available-years');
  }

  // Flashback Warnings
  async getFlashback(params?: {
    symbol?: string;
    hour?: number;
    emotion?: string;
  }): Promise<{
    hasWarnings: boolean;
    highSeverityCount: number;
    mediumSeverityCount: number;
    lowSeverityCount: number;
    topWarning: FlashbackWarning | null;
    warnings: FlashbackWarning[];
  }> {
    const searchParams = new URLSearchParams();
    if (params?.symbol) searchParams.append('symbol', params.symbol);
    if (params?.hour !== undefined) searchParams.append('hour', String(params.hour));
    if (params?.emotion) searchParams.append('emotion', params.emotion);
    const query = searchParams.toString();
    return this.request(`/coach/flashback${query ? `?${query}` : ''}`);
  }

  // Enhanced Game Plan
  async getGamePlan(): Promise<{
    success: boolean;
    briefing: PreMarketBriefing;
    gamePlan: GamePlan;
    flashbackSummary: {
      hasWarnings: boolean;
      highSeverityCount: number;
    };
  }> {
    return this.request('/coach/game-plan');
  }

  // Learning - Quiz & Flashcards
  async getQuiz(params?: { difficulty?: string; count?: number }): Promise<{
    success: boolean;
    quiz: {
      id: string;
      questions: Array<{
        id: string;
        question: string;
        options: string[];
        correctAnswer: number;
        explanation: string;
        relatedPattern?: string;
      }>;
      difficulty: string;
      generatedAt: string;
    };
  }> {
    const searchParams = new URLSearchParams();
    if (params?.difficulty) searchParams.append('difficulty', params.difficulty);
    if (params?.count) searchParams.append('count', String(params.count));
    const query = searchParams.toString();
    return this.request(`/explain/quiz${query ? `?${query}` : ''}`);
  }

  async getFlashcards(params?: { category?: string; count?: number }): Promise<{
    success: boolean;
    flashcards: Array<{
      id: string;
      front: string;
      back: string;
      category: string;
      relatedTrade?: string;
      difficulty: string;
    }>;
    categories: string[];
  }> {
    const searchParams = new URLSearchParams();
    if (params?.category) searchParams.append('category', params.category);
    if (params?.count) searchParams.append('count', String(params.count));
    const query = searchParams.toString();
    return this.request(`/explain/flashcards${query ? `?${query}` : ''}`);
  }

  async explainTerm(term: string, level?: string): Promise<{
    success: boolean;
    term: string;
    level: string;
    explanation: string;
    examples?: string[];
    relatedTerms?: string[];
  }> {
    const searchParams = new URLSearchParams({ term });
    if (level) searchParams.append('level', level);
    return this.request(`/explain/term?${searchParams.toString()}`);
  }

  async explainText(text: string, context?: string): Promise<{
    success: boolean;
    explanation: string;
    keyTerms?: Array<{ term: string; meaning: string }>;
  }> {
    return this.request('/explain', {
      method: 'POST',
      body: JSON.stringify({ text, context }),
    });
  }

  // Price Alerts
  async getPriceAlerts(): Promise<{
    success: boolean;
    alerts: Array<{
      _id: string;
      symbol: string;
      assetType: string;
      alertType: 'above' | 'below' | 'percentage_change';
      targetPrice?: number;
      percentageChange?: number;
      currentPrice?: number;
      triggered: boolean;
      triggeredAt?: string;
      active: boolean;
      createdAt: string;
    }>;
  }> {
    return this.request('/alerts');
  }

  async createPriceAlert(alert: {
    symbol: string;
    assetType?: string;
    alertType: 'above' | 'below' | 'percentage_change';
    targetPrice?: number;
    percentageChange?: number;
  }): Promise<{
    success: boolean;
    alert: {
      _id: string;
      symbol: string;
      alertType: string;
      targetPrice?: number;
    };
  }> {
    return this.request('/alerts', {
      method: 'POST',
      body: JSON.stringify(alert),
    });
  }

  async deletePriceAlert(id: string): Promise<void> {
    await this.request(`/alerts/${id}`, { method: 'DELETE' });
  }

  async togglePriceAlert(id: string): Promise<{
    success: boolean;
    alert: { _id: string; active: boolean };
  }> {
    return this.request(`/alerts/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ toggle: true }),
    });
  }

  // Weekly Insights
  async getWeeklyInsights(startDate?: string, endDate?: string): Promise<{
    period: { startDate: string; endDate: string };
    statistics: {
      totalTrades: number;
      winningTrades: number;
      losingTrades: number;
      breakevenTrades: number;
      openTrades: number;
      totalProfitLoss: number;
      avgProfitLoss: number;
      bestTrade: number;
      worstTrade: number;
      winRate: number;
    };
    emotionAnalysis: Record<string, number>;
    tagAnalysis: Record<string, number>;
    behavioralAnalysis?: {
      behavioralScore: number;
      tradingStyle: string;
      styleConfidence: number;
      patternsDetected: Array<{
        type: string;
        severity: string;
        message?: string;
        insight?: string;
      }>;
      positivePatterns: Array<{ type: string; message: string }>;
      recommendations: Array<{
        priority: string;
        category: string;
        recommendation: string;
        basedOn: string;
      }>;
    };
    tradesAnalyzed: number;
    aiInsights: string;
    generatedAt: string;
  }> {
    const searchParams = new URLSearchParams();
    if (startDate) searchParams.append('startDate', startDate);
    if (endDate) searchParams.append('endDate', endDate);
    const query = searchParams.toString();
    return this.request(`/insights/weekly${query ? `?${query}` : ''}`);
  }

  // Supported Brokers for Import
  async getSupportedBrokers(): Promise<{
    brokers: Array<{
      id: string;
      name: string;
      description: string;
      supportedFormats: string[];
    }>;
  }> {
    return this.request('/import/supported-brokers');
  }

  async getSampleCSV(broker?: string): Promise<string> {
    const query = broker ? `?broker=${broker}` : '';
    const response = await fetch(`${API_BASE_URL}/import/sample-csv${query}`, {
      headers: {
        Authorization: `Bearer ${this.getToken()}`,
      },
    });
    return response.text();
  }

  // Edge Analysis
  async getEdgeAnalysis(days: number = 90): Promise<EdgeAnalysis & { success: boolean }> {
    return this.request(`/edge/analysis?days=${days}`);
  }

  async compareEdge(currentDays: number = 30, previousDays: number = 30): Promise<{
    success: boolean;
    current: EdgeStats & { period: string };
    previous: EdgeStats & { period: string };
    changes: {
      winRate: number;
      totalPnL: number;
      avgPnL: number;
      profitFactor: number | string;
    };
    trending: 'improving' | 'declining';
  }> {
    return this.request(`/edge/compare?currentDays=${currentDays}&previousDays=${previousDays}`);
  }

  // Time-in-Trade Alerts
  async getTimeAlerts(): Promise<TimeAlertResponse & { success: boolean }> {
    return this.request('/edge/time-alerts');
  }

  async getHoldTimeAnalysis(days: number = 90): Promise<HoldTimeAnalysis & { success: boolean }> {
    return this.request(`/edge/hold-time-analysis?days=${days}`);
  }

  async checkTradeHoldTime(tradeId: string): Promise<{
    success: boolean;
    isOverheld: boolean;
    holdMinutes: number;
    avgHoldMinutes: number;
    percentOver: number;
    message: string;
  }> {
    return this.request(`/edge/check-trade/${tradeId}`);
  }

  // Playbook
  async getPlaybook(): Promise<{ success: boolean; playbook: Playbook }> {
    return this.request('/playbook');
  }

  async addSetup(setup: {
    name: string;
    description?: string;
    matchCriteria?: Partial<SetupMatchCriteria>;
    rules?: Partial<SetupRules>;
    checklist?: SetupChecklist[];
    color?: string;
    icon?: string;
  }): Promise<{ success: boolean; playbook: Playbook }> {
    return this.request('/playbook/setups', {
      method: 'POST',
      body: JSON.stringify(setup),
    });
  }

  async updateSetup(setupId: string, updates: Partial<PlaybookSetup>): Promise<{
    success: boolean;
    playbook: Playbook;
  }> {
    return this.request(`/playbook/setups/${setupId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteSetup(setupId: string): Promise<{ success: boolean; playbook: Playbook }> {
    return this.request(`/playbook/setups/${setupId}`, { method: 'DELETE' });
  }

  async autoTagTrade(trade: Partial<Trade>): Promise<{
    success: boolean;
    matched: boolean;
    setup: {
      id: string;
      name: string;
      color: string;
      rules: SetupRules;
      checklist: SetupChecklist[];
    } | null;
  }> {
    return this.request('/playbook/auto-tag', {
      method: 'POST',
      body: JSON.stringify({ trade }),
    });
  }

  async validateAgainstSetup(trade: Partial<Trade>, setupId: string): Promise<{
    success: boolean;
    valid: boolean;
    violations: Array<{ rule: string; message: string }>;
    setup: string;
  }> {
    return this.request('/playbook/validate', {
      method: 'POST',
      body: JSON.stringify({ trade, setupId }),
    });
  }

  async getSetupStats(setupId?: string): Promise<{
    success: boolean;
    stats: PlaybookSetup['stats'] | Array<{
      id: string;
      name: string;
      color: string;
      enabled: boolean;
    } & PlaybookSetup['stats']>;
  }> {
    const query = setupId ? `?setupId=${setupId}` : '';
    return this.request(`/playbook/stats${query}`);
  }

  async compareSetups(days: number = 90): Promise<SetupComparison & { success: boolean }> {
    return this.request(`/playbook/compare?days=${days}`);
  }

  async getSetupTrades(setupId: string, limit: number = 50): Promise<{
    success: boolean;
    setup: { id: string; name: string; color: string; stats: PlaybookSetup['stats'] };
    trades: Trade[];
    totalFound: number;
  }> {
    return this.request(`/playbook/setups/${setupId}/trades?limit=${limit}`);
  }

  async getSetupSuggestions(): Promise<{
    success: boolean;
    suggestions: Array<{
      keyword: string;
      count: number;
      winRate: number;
      totalPnL: number;
    }>;
    message: string;
  }> {
    return this.request('/playbook/suggestions');
  }

  async updatePlaybookSettings(settings: Partial<Playbook['settings']>): Promise<{
    success: boolean;
    settings: Playbook['settings'];
  }> {
    return this.request('/playbook/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  }
}

export const api = new ApiClient();
export default api;
