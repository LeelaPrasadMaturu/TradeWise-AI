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
      const error = await response.json().catch(() => ({ message: 'An error occurred' }));
      throw new Error(error.message || `HTTP error! status: ${response.status}`);
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
    return this.request<PaginatedResponse<Trade>>(`/trades${query ? `?${query}` : ''}`);
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
    return this.request<DisciplineScore>('/discipline/weekly-report');
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
    return this.request('/discipline/violations');
  }

  // Rules
  async getRules(): Promise<TradingRule[]> {
    return this.request<TradingRule[]>('/rules');
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
    preview: Trade[];
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
}

export const api = new ApiClient();
export default api;
