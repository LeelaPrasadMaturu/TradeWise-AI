export interface User {
  _id: string;
  email: string;
  name: string;
  createdAt: string;
}

export interface EmotionAnalysis {
  detected: 'positive' | 'negative' | 'neutral';
  confidence?: number;
  source?: string;
}

export interface PostTradeReview {
  mistake?: string;
  planFollowed?: boolean;
  movedStopLoss?: boolean;
  lesson?: string;
}

export interface Trade {
  _id: string;
  user: string;
  symbol: string;
  assetType?: string;
  direction: 'long' | 'short';
  quantity: number;
  entryPrice: number;
  exitPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
  positionValue?: number;
  tradeDate: string;
  entryTime?: string;
  exitTime?: string;
  reason?: string;
  exitReason?: string;
  tags: string[];
  result?: 'win' | 'loss' | 'breakeven' | 'open';
  profitLoss?: number;
  notes?: string;
  preTradeEmotion?: string;
  emotionAnalysis?: EmotionAnalysis;
  exitEmotionAnalysis?: EmotionAnalysis;
  postTradeReview?: PostTradeReview;
  postTradeAnalysis?: {
    summary: string;
    recommendations: string[];
    risksObserved: string[];
    generatedAt: string;
  };
  disciplineScore?: number;
  rulesViolated?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface TradeStats {
  totalTrades: number;
  openTrades: number;
  closedTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalProfitLoss: number;
  avgProfitLoss: number;
  avgWin: number;
  avgLoss: number;
  profitFactor?: number;
  byTag?: Record<string, {
    count: number;
    wins: number;
    winRate: number;
    totalPnL: number;
  }>;
}

export interface TradingRule {
  _id: string;
  user: string;
  name: string;
  description?: string;
  ruleType: string;
  action: 'warn' | 'block';
  params: Record<string, unknown>;
  enabled: boolean;
  createdAt: string;
}

export interface DisciplineScore {
  overallScore: number;
  totalTrades: number;
  compliantTrades: number;
  period: string;
  byRule?: Array<{
    ruleName: string;
    ruleType: string;
    complianceRate: number;
    violations: number;
  }>;
  correlation?: {
    winRateWhenCompliant: number;
    winRateWhenViolating: number;
    insight: string;
  };
}

export interface BehavioralPattern {
  type: string;
  severity: 'high' | 'medium' | 'low';
  message?: string;
  insight?: string;
  recommendation?: string;
  costEstimate?: {
    directCost: number;
    opportunityCost: number;
    totalEstimatedCost: number;
  };
  affectedTrades?: string[];
  [key: string]: unknown;
}

export interface BehavioralAnalysis {
  behavioralScore: number;
  tradingStyle: string;
  styleConfidence: number;
  tradeCount: number;
  patternsDetected: BehavioralPattern[];
  positivePatterns: Array<{
    type: string;
    message: string;
  }>;
  baseline: {
    tradingStyle: string;
    avgDailyTradeCount: number;
    baselineWinRate: number;
    avgPositionSize: number;
    avgHoldDurationMinutes: number;
    bestPerformingHours: number[];
    worstPerformingHours: number[];
  };
  recommendations: Array<{
    priority: string;
    category: string;
    recommendation: string;
    basedOn: string;
  }>;
}

export interface CoachingAlert {
  type: string;
  severity: 'info' | 'warning' | 'high' | 'critical';
  message: string;
  data?: Record<string, unknown>;
}

export interface PreMarketBriefing {
  generatedAt: string;
  greeting: string;
  yesterdaySummary: {
    tradeCount: number;
    wins: number;
    losses: number;
    winRate: number;
    pnl: number;
    pnlFormatted: string;
    message: string;
  };
  rulesViolated?: {
    count: number;
    rules: string[];
    message: string;
  };
  dayOfWeekWarning?: {
    dayName: string;
    winRate: number;
    warning: string;
  };
  bestHours?: {
    hours: Array<{ hour: number; winRate: number }>;
    message: string;
  };
  focusAreas: string[];
  tradingStyle: string;
  motivationalMessage: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ApiError {
  message: string;
  error?: string;
  status?: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface ChecklistItem {
  _id: string;
  question: string;
  required: boolean;
  action: 'warn' | 'block';
}

export interface UserTradingConfig {
  capital: number;
  capitalUpdatedAt?: string;
  checklistEnabled: boolean;
  blockOnFailure: boolean;
  requireEmotionalCheck: boolean;
  allowedEmotions: string[];
  blockedEmotions: string[];
  customChecklistItems: ChecklistItem[];
}

// Tax Report Types
export interface TradeSummary {
  _id: string;
  symbol: string;
  direction: string;
  entryDate: string;
  exitDate: string;
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  pnl: number;
  charges: number;
  netPnl: number;
  result: string;
  exchange?: string;
  segment: string;
  instrumentType: string;
  optionType?: string;
  strikePrice?: number;
  gainType?: string;
}

export interface TaxCategory {
  trades: TradeSummary[];
  totalPnL: number;
  totalCharges: number;
  netPnL: number;
  tradeCount: number;
  wins?: number;
  losses?: number;
  turnover?: number;
}

export interface TaxReport {
  financialYear: string;
  generatedAt: string;
  dateRange: {
    start: string;
    end: string;
  };
  equity: {
    stcg: TaxCategory;
    ltcg: TaxCategory;
  };
  fno: {
    futures: TaxCategory;
    options: TaxCategory;
    totalTurnover: number;
    totalNetPnL: number;
    totalCharges: number;
    tradeCount: number;
  };
  summary: {
    totalPnL: number;
    totalCharges: number;
    netPnL: number;
    totalTradeCount: number;
    equityTradeCount: number;
    fnoTradeCount: number;
  };
  byMonth: Record<string, { pnl: number; charges: number; trades: number }>;
  topSymbols: Array<{
    symbol: string;
    pnl: number;
    charges: number;
    trades: number;
    segment: string;
    instrumentType: string;
  }>;
}

// Flashback Warning Types
export interface FlashbackWarning {
  type: string;
  severity: 'high' | 'medium' | 'low';
  title: string;
  message: string;
  detail?: string;
  data?: Record<string, unknown>;
  recentTrades?: Array<{
    date: string;
    pnl: number;
    reason?: string;
  }>;
}

// Game Plan Types
export interface GamePlanItem {
  reason?: string;
  type?: string;
  message: string;
  detail?: string;
  data?: Record<string, unknown>;
}

export interface GamePlan {
  avoid: GamePlanItem[];
  focus: GamePlanItem[];
  rules: Array<{
    type: string;
    message: string;
    rules?: string[];
  }>;
  warnings?: FlashbackWarning[];
}
